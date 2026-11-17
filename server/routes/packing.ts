// server/routes/packing.ts
// Packing's real data model — see /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md
// for the full phased plan. No Drizzle table defs for packing_round_states /
// packing_targets (same choice as aq_snapshots/pq_snapshots) — plain
// migrations/0037_packing_targets.sql + raw SQL here.
import { Router } from "express";
import { db } from "../db";
import { items } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ISSUE_LABEL, extractBomSlots, resolveBomComponents } from "../lib/bomResolve";

const router = Router();

// ── Product search (step 1 of "+ เพิ่ม SKU จาก AQ") ──────────────────────────────

router.get("/products", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) return res.json([]);
  try {
    const rows = await db.execute(sql`
      SELECT id, sku, name, eggs_per_pack, pack_unit, primary_size, secondary_size, partner_id
      FROM items
      WHERE is_sellable = true AND (sku ILIKE ${"%" + q + "%"} OR name ILIKE ${"%" + q + "%"})
      ORDER BY sku
      LIMIT 30
    `);
    return res.json(
      (rows.rows as any[]).map(r => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        eggsPerPack: r.eggs_per_pack ? Number(r.eggs_per_pack) : 1,
        packUnit: r.pack_unit,
        primarySize: r.primary_size,
        secondarySize: r.secondary_size,
        partnerId: r.partner_id,
      })),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to search products" });
  }
});

// ── Round lifecycle (เป้าแพ็ก → แผนวัตถุดิบ → ใบสั่งงาน → closed) ────────────────
// Absence of a row = step 1 not confirmed yet, nothing locked — same "no row
// = default/open state" convention production_round_states already uses.

router.get("/round-states", async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date) return res.status(400).json({ message: "date required" });
  try {
    const rows = await db.execute(sql`
      SELECT round, target_confirmed_at, material_plan_confirmed_at, work_order_sent_at, closed_at
      FROM packing_round_states WHERE delivery_date = ${date}::date
    `);
    const byRound: Record<number, any> = {};
    for (const r of rows.rows as any[]) {
      byRound[r.round] = {
        round: r.round,
        targetConfirmedAt: r.target_confirmed_at,
        materialPlanConfirmedAt: r.material_plan_confirmed_at,
        workOrderSentAt: r.work_order_sent_at,
        closedAt: r.closed_at,
      };
    }
    return res.json(byRound);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load packing round states" });
  }
});

const STEP_COLUMNS: Record<string, string> = {
  target: "target_confirmed_at",
  materialPlan: "material_plan_confirmed_at",
  workOrder: "work_order_sent_at",
  close: "closed_at",
};
// Each step requires the previous one — enforced here too, not just in the UI.
const STEP_ORDER = ["target", "materialPlan", "workOrder", "close"];

router.patch("/round-states", async (req, res) => {
  const { date, round, step, value } = req.body as { date: string; round: number; step: string; value: boolean };
  if (!date || !round || !STEP_COLUMNS[step]) {
    return res.status(400).json({ message: "date, round, and a valid step are required" });
  }
  try {
    const existing = (
      await db.execute(sql`
        SELECT target_confirmed_at, material_plan_confirmed_at, work_order_sent_at, closed_at
        FROM packing_round_states WHERE delivery_date = ${date}::date AND round = ${round}
      `)
    ).rows[0] as any;
    const col: Record<string, any> = existing ?? {
      target_confirmed_at: null, material_plan_confirmed_at: null, work_order_sent_at: null, closed_at: null,
    };
    if (value) {
      const idx = STEP_ORDER.indexOf(step);
      const prevStep = idx > 0 ? STEP_ORDER[idx - 1] : null;
      if (prevStep && !col[STEP_COLUMNS[prevStep]]) {
        return res.status(409).json({ message: `ขั้นก่อนหน้า (${prevStep}) ยังไม่เสร็จ` });
      }
      // Real server-side enforcement (not just the UI disabling the
      // button) — confirming "แผนวัตถุดิบ" requires every target line in
      // this round to have *some* configured BOM. A simpler check than
      // GET /material-plan's full resolution (that one also flags
      // unresolved component SKUs/missing qty, which needs an extra
      // component-lookup round trip) — this guard only catches the "no
      // BOM configured at all" case, which is deliberately the one the UI
      // gate can't be trusted to have caught if its materialPlan fetch is
      // stale. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
      if (step === "materialPlan") {
        const targetRows = (
          await db.execute(sql`
            SELECT pt.item_id, i.packaging_profile, i.additional_materials
            FROM packing_targets pt JOIN items i ON i.id = pt.item_id
            WHERE pt.delivery_date = ${date}::date AND pt.round = ${round}
          `)
        ).rows as any[];
        for (const t of targetRows) {
          const { slots, extras } = extractBomSlots(t);
          if (slots.length === 0 && extras.length === 0) {
            return res.status(409).json({ message: "มี SKU ที่ยังไม่ตั้งค่า BOM/Packaging Profile ครบ — แก้ไขก่อนยืนยันแผนวัตถุดิบ" });
          }
        }
      }
    }
    const columnSql = sql.raw(STEP_COLUMNS[step]);
    if (!existing) {
      await db.execute(sql`
        INSERT INTO packing_round_states (delivery_date, round, ${columnSql}) VALUES (${date}::date, ${round}, ${value ? sql`now()` : null})
      `);
    } else {
      await db.execute(sql`
        UPDATE packing_round_states SET ${columnSql} = ${value ? sql`now()` : null}
        WHERE delivery_date = ${date}::date AND round = ${round}
      `);
    }
    // Sending the work order (step 3) is a real bulk action — stamps every
    // not-yet-sent target line for this round, same shape as Grading's "ส่ง
    // G-P" sending every planned job.
    if (step === "workOrder" && value) {
      await db.execute(sql`
        UPDATE packing_targets SET sent_at = now(), updated_at = now()
        WHERE delivery_date = ${date}::date AND round = ${round} AND sent_at IS NULL
      `);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update packing round state" });
  }
});

// ── Packing targets (one row per date/round/item) ───────────────────────────────

router.get("/targets", async (req, res) => {
  const date = req.query.date as string | undefined;
  const round = req.query.round ? Number(req.query.round) : undefined;
  if (!date) return res.status(400).json({ message: "date required" });
  try {
    const rows = await db.execute(sql`
      SELECT pt.id, pt.delivery_date, pt.round, pt.item_id, pt.qty_eggs, pt.ready_by, pt.source,
             pt.aq_snapshot_id, pt.adjust_reason, pt.sent_at, pt.created_at,
             i.sku, i.name AS item_name, i.eggs_per_pack, i.primary_size, i.secondary_size,
             i.partner_id, bp.nickname AS partner_name
      FROM packing_targets pt
      JOIN items i ON i.id = pt.item_id
      LEFT JOIN business_partners bp ON bp.id = i.partner_id
      WHERE pt.delivery_date = ${date}::date
      ${round != null ? sql`AND pt.round = ${round}` : sql``}
      ORDER BY pt.round, pt.created_at
    `);
    return res.json(
      (rows.rows as any[]).map(r => ({
        id: r.id,
        deliveryDate: r.delivery_date,
        round: r.round,
        itemId: r.item_id,
        sku: r.sku,
        itemName: r.item_name,
        eggsPerPack: Number(r.eggs_per_pack ?? 1),
        primarySize: r.primary_size,
        secondarySize: r.secondary_size,
        partnerId: r.partner_id,
        partnerName: r.partner_name,
        qtyEggs: Number(r.qty_eggs),
        readyBy: r.ready_by,
        source: r.source,
        aqSnapshotId: r.aq_snapshot_id,
        adjustReason: r.adjust_reason,
        sentAt: r.sent_at,
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load packing targets" });
  }
});

const createTargetSchema = z.object({
  date: z.string(),
  round: z.number().int().min(1).max(4),
  itemId: z.number().int(),
  qtyEggs: z.number().positive(),
  readyBy: z.string().nullable().optional(),
  source: z.enum(["aq", "manual"]).default("manual"),
  aqSnapshotId: z.number().int().nullable().optional(),
  adjustReason: z.string().nullable().optional(),
});

router.post("/targets", async (req, res) => {
  try {
    const body = createTargetSchema.parse(req.body);
    const [item] = await db.select({ eggsPerPack: items.eggsPerPack }).from(items).where(eq(items.id, body.itemId));
    if (!item) return res.status(404).json({ message: "Item not found" });
    const eggsPerPack = item.eggsPerPack || 1;
    if (body.qtyEggs % eggsPerPack !== 0) {
      return res.status(400).json({ message: `จำนวนต้องหาร ${eggsPerPack} ลงตัว (${eggsPerPack} ฟอง/แพ็ก)` });
    }
    const ins = await db.execute(sql`
      INSERT INTO packing_targets (delivery_date, round, item_id, qty_eggs, ready_by, source, aq_snapshot_id, adjust_reason)
      VALUES (${body.date}::date, ${body.round}, ${body.itemId}, ${body.qtyEggs}, ${body.readyBy ?? null},
              ${body.source}, ${body.aqSnapshotId ?? null}, ${body.adjustReason ?? null})
      RETURNING id
    `);
    return res.status(201).json({ id: (ins.rows[0] as any).id });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid target", issues: err.issues });
    console.error(err);
    return res.status(500).json({ message: "Failed to create packing target" });
  }
});

router.patch("/targets/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const { qtyEggs, readyBy, adjustReason } = req.body as { qtyEggs?: number; readyBy?: string | null; adjustReason?: string | null };
  try {
    if (qtyEggs != null) {
      const [row] = (
        await db.execute(sql`
          SELECT i.eggs_per_pack FROM packing_targets pt JOIN items i ON i.id = pt.item_id WHERE pt.id = ${id}
        `)
      ).rows as any[];
      if (!row) return res.status(404).json({ message: "Target not found" });
      const eggsPerPack = Number(row.eggs_per_pack) || 1;
      if (qtyEggs % eggsPerPack !== 0) {
        return res.status(400).json({ message: `จำนวนต้องหาร ${eggsPerPack} ลงตัว (${eggsPerPack} ฟอง/แพ็ก)` });
      }
    }
    await db.execute(sql`
      UPDATE packing_targets SET
        qty_eggs = COALESCE(${qtyEggs ?? null}, qty_eggs),
        ready_by = ${readyBy !== undefined ? readyBy : sql`ready_by`},
        adjust_reason = ${adjustReason !== undefined ? adjustReason : sql`adjust_reason`},
        updated_at = now()
      WHERE id = ${id}
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update packing target" });
  }
});

router.delete("/targets/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.execute(sql`DELETE FROM packing_targets WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete packing target" });
  }
});

// ── "②แผนวัตถุดิบ" — real BOM-completeness check for this round's targets ──────
// Reuses the exact same packaging_profile/additional_materials resolution
// server/routes/bom.ts already does (see server/lib/bomResolve.ts) — just
// scoped to this ROUND's real packing_targets instead of the whole day's PQ.
// Deliberately NOT a material-supply/stock check — no inventory data exists
// anywhere to compute that honestly (see
// /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md). `blocking`
// is what the frontend gates step ②'s confirm button on.
router.get("/material-plan", async (req, res) => {
  const date = req.query.date as string | undefined;
  const round = req.query.round ? Number(req.query.round) : undefined;
  if (!date || !round) return res.status(400).json({ message: "date and round required" });

  try {
    const targetRows = (
      await db.execute(sql`
        SELECT pt.id AS target_id, pt.item_id, pt.qty_eggs,
               i.sku, i.name, i.eggs_per_pack, i.packaging_profile, i.additional_materials
        FROM packing_targets pt
        JOIN items i ON i.id = pt.item_id
        WHERE pt.delivery_date = ${date}::date AND pt.round = ${round}
        ORDER BY pt.created_at
      `)
    ).rows as any[];

    if (targetRows.length === 0) return res.json({ date, round, lines: [], materials: [], blocking: false });

    const referencedSkus = new Set<string>();
    const bomByTarget = new Map<number, ReturnType<typeof extractBomSlots>>();
    for (const t of targetRows) {
      const { slots, extras } = extractBomSlots(t);
      bomByTarget.set(t.target_id, { slots, extras });
      for (const s of slots) referencedSkus.add(s.component_sku!);
      for (const m of extras) referencedSkus.add(m.component_sku!);
    }
    const componentRows = referencedSkus.size
      ? ((
          await db.execute(sql`
            SELECT sku, name, item_type FROM items WHERE sku IN (${sql.join(Array.from(referencedSkus).map(s => sql`${s}`), sql`, `)})
          `)
        ).rows as any[])
      : [];
    const componentBySku = new Map<string, any>(componentRows.map(r => [r.sku, r]));

    const materialsBySku = new Map<string, { componentSku: string; componentName: string | null; itemType: string | null; totalQtyNeeded: number; resolved: boolean; usedByTargetLines: { sku: string; name: string; qtyNeeded: number }[] }>();
    const lines = targetRows.map(t => {
      const bom = bomByTarget.get(t.target_id) ?? { slots: [], extras: [] };
      // plannedPacks here is the pack count implied by qty_eggs/eggs_per_pack
      // (same unit qty_per_pack components are expressed in), not the raw egg qty.
      const eggsPerPack = Number(t.eggs_per_pack) || 1;
      const plannedPacks = Number(t.qty_eggs) / eggsPerPack;
      const { components, issueReasons } = resolveBomComponents(bom.slots, bom.extras, plannedPacks, componentBySku);

      for (const c of components) {
        if (!materialsBySku.has(c.componentSku)) {
          materialsBySku.set(c.componentSku, { componentSku: c.componentSku, componentName: c.componentName, itemType: c.itemType, totalQtyNeeded: 0, resolved: c.resolved, usedByTargetLines: [] });
        }
        const m = materialsBySku.get(c.componentSku)!;
        m.totalQtyNeeded += c.qtyNeeded;
        m.usedByTargetLines.push({ sku: t.sku, name: t.name, qtyNeeded: c.qtyNeeded });
      }

      return {
        targetId: t.target_id, itemId: t.item_id, sku: t.sku, itemName: t.name,
        status: issueReasons.size > 0 ? ("needs_setup" as const) : ("ready" as const),
        issues: Array.from(issueReasons).map(kind => ISSUE_LABEL[kind] ?? kind),
      };
    });

    const materials = Array.from(materialsBySku.values())
      .map(m => ({ ...m, status: m.resolved ? ("ready" as const) : ("needs_setup" as const) }))
      .sort((a, b) => b.totalQtyNeeded - a.totalQtyNeeded);

    return res.json({
      date, round, lines, materials,
      blocking: lines.some(l => l.status === "needs_setup"),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute material plan" });
  }
});

// ── Section 3 "บันทึกผลแพ็กจริง" — real actual-vs-plan ───────────────────────────
// A packing_targets row is the plan; packing_target_results is its real
// result (1:1, draft/confirmed). Only "issued" lines (sent_at set — the
// round's work order was actually sent) are in scope, matching the
// reference prototype's own gate. See
// /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.

router.get("/target-results", async (req, res) => {
  const date = req.query.date as string | undefined;
  const round = req.query.round ? Number(req.query.round) : undefined;
  if (!date || !round) return res.status(400).json({ message: "date and round required" });
  try {
    const rows = await db.execute(sql`
      SELECT pt.id AS target_id, pt.item_id, pt.qty_eggs AS target_qty_eggs, pt.ready_by,
             i.sku, i.name AS item_name, i.eggs_per_pack,
             ptr.actual_qty_eggs, ptr.station, ptr.note, ptr.status, ptr.confirmed_at
      FROM packing_targets pt
      JOIN items i ON i.id = pt.item_id
      LEFT JOIN packing_target_results ptr ON ptr.target_id = pt.id
      WHERE pt.delivery_date = ${date}::date AND pt.round = ${round} AND pt.sent_at IS NOT NULL
      ORDER BY pt.created_at
    `);
    return res.json(
      (rows.rows as any[]).map(r => ({
        targetId: r.target_id,
        itemId: r.item_id,
        sku: r.sku,
        itemName: r.item_name,
        eggsPerPack: Number(r.eggs_per_pack ?? 1),
        readyBy: r.ready_by,
        targetQtyEggs: Number(r.target_qty_eggs),
        actualQtyEggs: r.actual_qty_eggs != null ? Number(r.actual_qty_eggs) : null,
        station: r.station,
        note: r.note,
        status: r.status ?? null,
        confirmedAt: r.confirmed_at,
      })),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load packing target results" });
  }
});

router.put("/target-results/:targetId", async (req, res) => {
  const targetId = parseInt(req.params.targetId, 10);
  if (isNaN(targetId)) return res.status(400).json({ message: "Invalid targetId" });
  const { actualQtyEggs, station, note, status } = req.body as {
    actualQtyEggs: number; station?: string | null; note?: string | null; status: "draft" | "confirmed";
  };
  if (actualQtyEggs == null || actualQtyEggs < 0) return res.status(400).json({ message: "actualQtyEggs must be >= 0" });
  if (status !== "draft" && status !== "confirmed") return res.status(400).json({ message: "status must be 'draft' or 'confirmed'" });
  try {
    const [target] = (await db.execute(sql`SELECT id, sent_at FROM packing_targets WHERE id = ${targetId}`)).rows as any[];
    if (!target) return res.status(404).json({ message: "Target not found" });
    if (!target.sent_at) return res.status(400).json({ message: "บันทึกผลแพ็กได้เมื่อรอบแพ็กของวันนี้ส่งงานแล้ว · ยืนยันเป้าแพ็กและแผนวัตถุดิบ แล้วกดส่งงานในส่วนที่ 2" });

    const existing = (await db.execute(sql`SELECT id FROM packing_target_results WHERE target_id = ${targetId}`)).rows[0] as any;
    const confirmedAt = status === "confirmed" ? sql`now()` : sql`NULL`;
    if (existing) {
      await db.execute(sql`
        UPDATE packing_target_results SET
          actual_qty_eggs = ${actualQtyEggs}, station = ${station ?? null}, note = ${note ?? null},
          status = ${status}, confirmed_at = ${confirmedAt}, updated_at = now()
        WHERE target_id = ${targetId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO packing_target_results (target_id, actual_qty_eggs, station, note, status, confirmed_at)
        VALUES (${targetId}, ${actualQtyEggs}, ${station ?? null}, ${note ?? null}, ${status}, ${confirmedAt})
      `);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to save packing target result" });
  }
});

/** GET /api/packing/fg-stock?date=YYYY-MM-DD — "สต็อก FG" today-only
 * movement view. Not a real per-SKU stock ledger: there is no lot tracking
 * or physical-count feature anywhere in this app (checked: finished_goods_
 * stock/stock_movements/sized_egg_stock/egg_receiving_lots all exist in the
 * schema but have zero rows — legacy scaffolding, never wired up). So:
 *   - ยกมา = the real CONFIRMED opening-stock total for this item's size
 *     (grading_opening_stock, keyed by date+outcome — the same table the
 *     existing "Opening stock" feature writes to on confirm). That table
 *     tracks by outcome/size, not by individual SKU, so this is shared
 *     across every FG SKU of the same size (e.g. 30001 and 30002 both
 *     "เบอร์ 0" share one ยกมา figure) — real, just not SKU-exact. null
 *     when nothing has ever been confirmed for that size (shown as "ไม่ได้
 *     นับ", not guessed as 0).
 *   - เข้า = this date's real confirmed packing_target_results, across
 *     every round (not just one), summed in eggs.
 *   - เบิก = this date's real dispatched orders — specifically, orders
 *     whose trip was actually checked out (trips.departed_at) ON this
 *     date, not just orders whose delivery_date is this date, since
 *     checkout is the real event that consumes stock.
 *   - คงเหลือ = ยกมา (if known, else 0) + เข้า − เบิก. ± นับ has no real
 *     physical-count feature behind it and is always null.
 * See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md. */
router.get("/fg-stock", async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date) return res.status(400).json({ message: "date required" });
  try {
    const fgItems = (
      await db.execute(sql`
        SELECT i.id, i.sku, i.name, i.eggs_per_pack, i.primary_size, i.secondary_size, i.pack_unit, i.selling_unit,
               bp.nickname AS customer_name
        FROM items i
        LEFT JOIN business_partners bp ON bp.id = i.partner_id
        WHERE i.is_sellable = true AND i.item_role = 'FG'
        ORDER BY sku
      `)
    ).rows as any[];

    const openingRows = (
      await db.execute(sql`SELECT size, qty FROM grading_opening_stock WHERE grading_date = ${date}::date`)
    ).rows as any[];
    const openingBySize = new Map<string, number>(openingRows.map(r => [String(r.size), Number(r.qty)]));

    const inRows = (
      await db.execute(sql`
        SELECT pt.item_id, SUM(ptr.actual_qty_eggs) AS in_eggs
        FROM packing_target_results ptr
        JOIN packing_targets pt ON pt.id = ptr.target_id
        WHERE pt.delivery_date = ${date}::date AND ptr.status = 'confirmed'
        GROUP BY pt.item_id
      `)
    ).rows as any[];
    const inByItem = new Map<number, number>(inRows.map(r => [Number(r.item_id), Number(r.in_eggs)]));

    const outRows = (
      await db.execute(sql`
        SELECT oi.item_id, SUM(COALESCE(oi.accepted_qty, oi.quantity) * COALESCE(i.eggs_per_pack, 1)) AS out_eggs
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN items i ON i.id = oi.item_id
        JOIN trips t ON t.id = o.trip_id
        WHERE o.logistics_status = 'dispatched' AND t.departed_at::date = ${date}::date
        GROUP BY oi.item_id
      `)
    ).rows as any[];
    const outByItem = new Map<number, number>(outRows.map(r => [Number(r.item_id), Number(r.out_eggs)]));

    const skus = fgItems.map(it => {
      const outcome = it.secondary_size ? "mixed" : String(it.primary_size ?? "");
      const openingEggs = openingBySize.has(outcome) ? openingBySize.get(outcome)! : null;
      const inEggs = inByItem.get(Number(it.id)) ?? 0;
      const outEggs = outByItem.get(Number(it.id)) ?? 0;
      return {
        itemId: Number(it.id), sku: it.sku, name: it.name,
        eggsPerPack: Number(it.eggs_per_pack) || 1,
        primarySize: it.primary_size, secondarySize: it.secondary_size,
        packUnit: it.pack_unit, sellingUnit: it.selling_unit,
        // Real, but only populated for OEM-branded SKUs whose prefix
        // unambiguously maps to an existing partner (M00xx→Makro,
        // B00xx→BigC, T00xx→Thaifood) — null for everything else (generic
        // "3xxxx" SKUs, and brand prefixes with no confident real partner
        // match). Not derived from order history, which is too noisy.
        customerName: it.customer_name ?? null,
        openingEggs, inEggs, outEggs,
        netEggs: (openingEggs ?? 0) + inEggs - outEggs,
      };
    });

    return res.json({
      date,
      totals: {
        openingEggs: openingBySize.size > 0 ? Array.from(openingBySize.values()).reduce((s, v) => s + v, 0) : null,
        inEggs: skus.reduce((s, r) => s + r.inEggs, 0),
        outEggs: skus.reduce((s, r) => s + r.outEggs, 0),
        netEggs: skus.reduce((s, r) => s + r.netEggs, 0),
        skuCount: skus.filter(r => r.inEggs > 0 || r.outEggs > 0 || (r.openingEggs ?? 0) > 0).length,
      },
      skus,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute FG stock" });
  }
});

/** GET /api/packing/summary?date=YYYY-MM-DD — everything the Daily Operations
 * "สรุปผล" tab needs that DailyData (/api/orders/daily) doesn't already carry:
 *   - targets: every packing target for the date (all rounds, sent or not)
 *     joined to its real result (if any) and item attributes, so the client
 *     can build plan-vs-packed by SKU / size / pack type / station / hour.
 *   - carriedTrips: trips planned for an EARLIER delivery date that actually
 *     departed on this date ("ยกมา") — invisible to /orders/daily, which only
 *     returns trips for this delivery date.
 * Real data only: there is no per-station egg-issue (ไข่เบิกเข้า) or hourly
 * entry log in the schema, so neither is returned. */
router.get("/summary", async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date) return res.status(400).json({ message: "date required" });
  try {
    const targetRows = (
      await db.execute(sql`
        SELECT pt.id AS target_id, pt.round, pt.item_id, pt.qty_eggs, pt.sent_at,
               i.sku, i.name AS item_name, i.eggs_per_pack, i.primary_size, i.secondary_size,
               i.pack_unit, i.selling_unit,
               ptr.actual_qty_eggs, ptr.station, ptr.status, ptr.confirmed_at
        FROM packing_targets pt
        JOIN items i ON i.id = pt.item_id
        LEFT JOIN packing_target_results ptr ON ptr.target_id = pt.id
        WHERE pt.delivery_date = ${date}::date
        ORDER BY pt.round, i.sku
      `)
    ).rows as any[];

    const carriedRows = (
      await db.execute(sql`
        SELECT t.id, t.delivery_date, t.trip_number, t.name, t.departed_at,
               v.plate_number AS vehicle_plate, v.vehicle_type, d.name AS driver_name,
               COALESCE(SUM(COALESCE(oi.accepted_qty, oi.quantity) * COALESCE(i.eggs_per_pack, 1)), 0) AS eggs,
               COUNT(DISTINCT o.delivery_site_id) AS stops
        FROM trips t
        LEFT JOIN vehicles v ON v.id = t.vehicle_id
        LEFT JOIN drivers  d ON d.id = t.driver_id
        LEFT JOIN orders o ON o.trip_id = t.id AND o.status != 'cancelled'
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN items i ON i.id = oi.item_id
        WHERE t.departed_at::date = ${date}::date AND t.delivery_date::date < ${date}::date
        GROUP BY t.id, v.plate_number, v.vehicle_type, d.name
        ORDER BY t.departed_at
      `)
    ).rows as any[];

    return res.json({
      date,
      targets: targetRows.map(r => ({
        targetId: r.target_id,
        round: r.round,
        itemId: r.item_id,
        sku: r.sku,
        itemName: r.item_name,
        eggsPerPack: Number(r.eggs_per_pack ?? 1) || 1,
        primarySize: r.primary_size,
        secondarySize: r.secondary_size,
        packUnit: r.pack_unit || r.selling_unit || null,
        targetQtyEggs: Number(r.qty_eggs),
        sentAt: r.sent_at,
        actualQtyEggs: r.actual_qty_eggs != null ? Number(r.actual_qty_eggs) : null,
        station: r.station ?? null,
        status: r.status ?? null,
        confirmedAt: r.confirmed_at ?? null,
      })),
      carriedTrips: carriedRows.map(r => ({
        id: r.id,
        deliveryDate: r.delivery_date,
        tripNumber: r.trip_number,
        name: r.name,
        departedAt: r.departed_at,
        vehiclePlate: r.vehicle_plate ?? null,
        vehicleType: r.vehicle_type ?? null,
        driverName: r.driver_name ?? null,
        eggs: Number(r.eggs),
        stops: Number(r.stops),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load summary" });
  }
});

export default router;
