// server/routes/grading.ts
import { Router } from "express";
import { db } from "../db";
import { gradingReceivingLots, gradingOpeningStock, gradingYieldModels, gradingJobs, gradingJobResults, gradingPrintEvents, items } from "@shared/schema";
import { users } from "../db/schema/users";
import { desc, eq, and, sql } from "drizzle-orm";

const router = Router();

type Sub = { ref: string; qty: number | null; w: number | null };
type GradeLine = { size: string; qty: number | null };

function normalizeLot(body: any) {
  const material = body.material === "sized" ? "sized" : "raw";
  const origin = material === "sized" ? (body.origin === "grading_return" ? "grading_return" : "external") : null;

  const subs: Sub[] = Array.isArray(body.subs)
    ? body.subs.map((s: any) => ({ ref: String(s.ref ?? ""), qty: s.qty != null ? Number(s.qty) : null, w: s.w != null ? Number(s.w) : null }))
    : [];
  const gradeLines: GradeLine[] = Array.isArray(body.gradeLines)
    ? body.gradeLines.filter((g: any) => g.qty != null && g.qty !== "").map((g: any) => ({ size: String(g.size), qty: Number(g.qty) }))
    : [];

  const divided = material === "raw" && !!body.divided;

  return {
    lotNo: String(body.lotNo ?? "").trim(),
    recvDate: body.recvDate,
    farm: origin === "grading_return" ? null : (body.farm ? String(body.farm).trim() : null),
    material,
    origin,
    srcJobId: origin === "grading_return" && body.srcJobId != null ? Number(body.srcJobId) : null,
    qty: material === "raw" && !divided && body.qty != null && body.qty !== "" ? Number(body.qty) : null,
    avgWeight: material === "raw" && !divided && body.avgWeight != null && body.avgWeight !== "" ? String(body.avgWeight) : null,
    divided,
    subs: material === "raw" && divided ? subs : [],
    gradeLines: material === "sized" ? gradeLines : [],
    note: body.note ? String(body.note) : null,
  };
}

function validate(lot: ReturnType<typeof normalizeLot>) {
  const errors: string[] = [];
  if (!lot.lotNo) errors.push("lotNo is required");
  if (!lot.recvDate) errors.push("recvDate is required");
  if ((lot.material === "raw" || lot.origin === "external") && !lot.farm) errors.push("farm is required");
  if (lot.material === "sized") {
    if (!lot.origin) errors.push("origin is required for sized eggs");
    if (lot.origin === "grading_return" && lot.srcJobId == null) errors.push("srcJobId is required when origin is grading_return");
    if (lot.gradeLines.length === 0) errors.push("at least one grade line with a quantity is required");
    const sizes = lot.gradeLines.map(g => g.size);
    if (new Set(sizes).size !== sizes.length) errors.push("duplicate grade line sizes");
  } else {
    if (lot.divided) {
      if (lot.subs.length === 0) errors.push("at least one sub-lot is required");
      if (lot.subs.some(s => s.qty == null || s.qty <= 0)) errors.push("every sub-lot needs a quantity > 0");
    } else if (lot.qty == null || lot.qty <= 0) {
      errors.push("qty is required and must be > 0");
    }
  }
  return errors;
}

/** GET /api/grading/receiving-lots */
router.get("/receiving-lots", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(gradingReceivingLots)
      .orderBy(desc(gradingReceivingLots.recvDate), desc(gradingReceivingLots.createdAt));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load receiving lots" });
  }
});

/** POST /api/grading/receiving-lots */
router.post("/receiving-lots", async (req, res) => {
  try {
    const lot = normalizeLot(req.body);
    const errors = validate(lot);
    if (errors.length) return res.status(400).json({ message: errors.join("; ") });

    const [created] = await db.insert(gradingReceivingLots).values(lot).returning();
    return res.json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create receiving lot" });
  }
});

/** PATCH /api/grading/receiving-lots/:id */
router.patch("/receiving-lots/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const lot = normalizeLot(req.body);
    const errors = validate(lot);
    if (errors.length) return res.status(400).json({ message: errors.join("; ") });

    await db
      .update(gradingReceivingLots)
      .set({ ...lot, updatedAt: new Date() })
      .where(eq(gradingReceivingLots.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update receiving lot" });
  }
});

/** DELETE /api/grading/receiving-lots/:id
 * No allocation check yet — there's no grading-job/allocation table to check
 * against. Once that exists, this must refuse deletion of an allocated lot. */
router.delete("/receiving-lots/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.delete(gradingReceivingLots).where(eq(gradingReceivingLots.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete receiving lot" });
  }
});

/** PATCH /api/grading/receiving-lots/:id/reject — a real terminal status, not
 * a delete. Blocked once the lot has any grading job (would orphan real
 * planned/executed work). */
router.patch("/receiving-lots/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) return res.status(400).json({ message: "A reason is required" });
  try {
    const [lot] = await db.select().from(gradingReceivingLots).where(eq(gradingReceivingLots.id, id));
    if (!lot) return res.status(404).json({ message: "Lot not found" });
    if (lot.status === "rejected") return res.status(400).json({ message: "Lot is already rejected" });

    const jobs = await db.select().from(gradingJobs).where(eq(gradingJobs.lotId, id));
    if (jobs.length > 0) {
      return res.status(400).json({ message: "This lot already has grading job(s) — remove them before rejecting" });
    }

    const [updated] = await db
      .update(gradingReceivingLots)
      .set({ status: "rejected", rejectedReason: reason, rejectedAt: new Date(), updatedAt: new Date() })
      .where(eq(gradingReceivingLots.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to reject receiving lot" });
  }
});

/** PATCH /api/grading/receiving-lots/:id/unreject — undo a mistaken rejection */
router.patch("/receiving-lots/:id/unreject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [lot] = await db.select().from(gradingReceivingLots).where(eq(gradingReceivingLots.id, id));
    if (!lot) return res.status(404).json({ message: "Lot not found" });
    if (lot.status !== "rejected") return res.status(400).json({ message: "Lot is not rejected" });

    const [updated] = await db
      .update(gradingReceivingLots)
      .set({ status: "received", rejectedReason: null, rejectedAt: null, updatedAt: new Date() })
      .where(eq(gradingReceivingLots.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to undo rejection" });
  }
});

// ── Opening egg stock (manual, per grading date + size) ─────────────────────────

/** GET /api/grading/opening-stock?date=YYYY-MM-DD */
router.get("/opening-stock", async (req, res) => {
  const gradingDate = req.query.date as string | undefined;
  if (!gradingDate) return res.status(400).json({ message: "date required" });
  try {
    const rows = await db
      .select()
      .from(gradingOpeningStock)
      .where(eq(gradingOpeningStock.gradingDate, gradingDate));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load opening stock" });
  }
});

/** PUT /api/grading/opening-stock — upsert one (date, size) row */
router.put("/opening-stock", async (req, res) => {
  const { gradingDate, size, qty } = req.body as { gradingDate: string; size: string; qty: number };
  if (!gradingDate || !size || qty == null || isNaN(Number(qty))) {
    return res.status(400).json({ message: "gradingDate, size, and qty are required" });
  }
  try {
    const existing = await db
      .select({ id: gradingOpeningStock.id })
      .from(gradingOpeningStock)
      .where(and(eq(gradingOpeningStock.gradingDate, gradingDate), eq(gradingOpeningStock.size, size)));

    if (existing.length) {
      await db
        .update(gradingOpeningStock)
        .set({ qty: Number(qty), updatedAt: new Date() })
        .where(eq(gradingOpeningStock.id, existing[0].id));
    } else {
      await db.insert(gradingOpeningStock).values({ gradingDate, size, qty: Number(qty) });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to save opening stock" });
  }
});

// ── Opening stock — versioned, day-aged counts (the "Opening count" popup) ──────
// Section 2's "Planning balance" reads the simple size->qty grading_opening_stock
// table (above) — a confirmed version here is synced into it (see /confirm)
// rather than replacing it, so nothing else has to change how it reads
// opening stock.

type OpeningStockLine = {
  itemId: number;
  sku: string;
  name: string;
  outcome: string; // "0".."5" | "a-b" pair | "mixed"
  day1Qty: number | null;
  day2Qty: number | null;
  day3Qty: number | null;
  day4PlusQty: number | null;
  unit: string;
  unitEggs: number;
};

function outcomeForItem(it: { primarySize: string | null; secondarySize: string | null }): string {
  if (it.secondarySize) return `${it.primarySize}-${it.secondarySize}`;
  if (it.primarySize) return it.primarySize;
  return "mixed";
}

/** GET /api/grading/opening-stock/products — egg items for the product picker */
router.get("/opening-stock/products", async (_req, res) => {
  try {
    const rows = (await db.select().from(items).where(eq(items.isEgg, true))).filter(it => !(it.sku ?? "").toUpperCase().startsWith("TEST"));
    const products = rows.map(it => ({
      id: it.id,
      sku: it.sku,
      name: it.name,
      outcome: outcomeForItem(it),
      units: [
        { unit: "ฟอง", eggs: 1 },
        ...(it.basketUnit && Number(it.eggsPerBasket) > 0 ? [{ unit: it.basketUnit, eggs: Number(it.eggsPerBasket) }] : []),
        ...(it.packUnit && Number(it.eggsPerPack) > 0 ? [{ unit: it.packUnit, eggs: Number(it.eggsPerPack) }] : []),
        ...(it.paletteUnit && Number(it.eggsPerPalette) > 0 ? [{ unit: it.paletteUnit, eggs: Number(it.eggsPerPalette) }] : []),
      ],
    }));
    return res.json(products);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load products" });
  }
});

async function latestConfirmedVersion(gradingDate: string) {
  const rows = await db.execute(sql`
    SELECT id, version, as_of_time, confirmed_at
    FROM grading_opening_stock_versions
    WHERE grading_date = ${gradingDate}::date AND state = 'confirmed'
    ORDER BY version DESC LIMIT 1
  `);
  const r = (rows.rows as any[])[0];
  return r ? { id: r.id, version: r.version, asOfTime: r.as_of_time, confirmedAt: r.confirmed_at } : null;
}

/** GET /api/grading/opening-stock/draft?date= — the current editable draft for
 * this date (created empty, seeded with one row per base egg size, the first
 * time it's requested), plus the latest confirmed version's summary. */
router.get("/opening-stock/draft", async (req, res) => {
  const gradingDate = req.query.date as string | undefined;
  if (!gradingDate) return res.status(400).json({ message: "date required" });
  try {
    let rows = (
      await db.execute(sql`
        SELECT id, version, state, as_of_time, lines, created_at, confirmed_at
        FROM grading_opening_stock_versions
        WHERE grading_date = ${gradingDate}::date
        ORDER BY version DESC LIMIT 1
      `)
    ).rows as any[];

    if (!rows.length || rows[0].state !== "draft") {
      // Seed a new draft from base egg-size items (one row per size, lowest
      // item id wins when several items share a size) — a real starting
      // point, not fabricated counts (every bucket starts blank/unknown).
      const eggItems = (await db.select().from(items).where(eq(items.isEgg, true))).filter(it => !(it.sku ?? "").toUpperCase().startsWith("TEST"));
      const bySize = new Map<string, (typeof eggItems)[number]>();
      for (const it of eggItems) {
        if (it.secondarySize) continue; // pairs are added manually via "+ Add Product row"
        const size = it.primarySize ?? "mixed";
        if (!bySize.has(size) || it.id < bySize.get(size)!.id) bySize.set(size, it);
      }
      const order = ["0", "1", "2", "3", "4", "5", "mixed"];
      const seedLines: OpeningStockLine[] = order
        .filter(s => bySize.has(s))
        .map(s => {
          const it = bySize.get(s)!;
          return {
            itemId: it.id, sku: it.sku ?? "", name: it.name, outcome: outcomeForItem(it),
            day1Qty: null, day2Qty: null, day3Qty: null, day4PlusQty: null,
            unit: "ฟอง", unitEggs: 1,
          };
        });

      const [{ next }] = (
        await db.execute(sql`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM grading_opening_stock_versions WHERE grading_date = ${gradingDate}::date`)
      ).rows as any[];
      const ins = await db.execute(sql`
        INSERT INTO grading_opening_stock_versions (grading_date, version, state, lines)
        VALUES (${gradingDate}::date, ${Number(next)}, 'draft', ${JSON.stringify(seedLines)}::jsonb)
        RETURNING id, version, state, as_of_time, lines, created_at, confirmed_at
      `);
      rows = ins.rows as any[];
    }

    const d = rows[0];
    return res.json({
      id: d.id,
      version: d.version,
      state: d.state,
      asOfTime: d.as_of_time,
      lines: d.lines,
      createdAt: d.created_at,
      lastConfirmed: await latestConfirmedVersion(gradingDate),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load opening-stock draft" });
  }
});

/** PUT /api/grading/opening-stock/draft — save (not confirm) the current draft */
router.put("/opening-stock/draft", async (req, res) => {
  const { gradingDate, asOfTime, lines } = req.body as { gradingDate: string; asOfTime: string | null; lines: OpeningStockLine[] };
  if (!gradingDate || !Array.isArray(lines)) return res.status(400).json({ message: "gradingDate and lines are required" });
  try {
    const rows = (
      await db.execute(sql`
        SELECT id, state FROM grading_opening_stock_versions
        WHERE grading_date = ${gradingDate}::date ORDER BY version DESC LIMIT 1
      `)
    ).rows as any[];
    if (!rows.length || rows[0].state !== "draft") {
      return res.status(409).json({ message: "No open draft — reload the dialog" });
    }
    await db.execute(sql`
      UPDATE grading_opening_stock_versions
      SET as_of_time = ${asOfTime ?? null}, lines = ${JSON.stringify(lines)}::jsonb
      WHERE id = ${rows[0].id}
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to save draft" });
  }
});

/** POST /api/grading/opening-stock/confirm — freezes the current draft as an
 * immutable version, syncs its per-outcome totals into the simple
 * grading_opening_stock table (the one Planning Balance actually reads —
 * "COUNTED"), and opens a fresh blank draft (same product rows) after it. An
 * outcome is only written as a known total when every line for it has all
 * four age buckets filled in; otherwise its grading_opening_stock row is
 * removed so Planning Balance honestly shows "not counted" rather than a
 * guessed number. */
router.post("/opening-stock/confirm", async (req, res) => {
  const { gradingDate } = req.body as { gradingDate: string };
  if (!gradingDate) return res.status(400).json({ message: "gradingDate required" });
  try {
    const rows = (
      await db.execute(sql`
        SELECT id, version, state, lines FROM grading_opening_stock_versions
        WHERE grading_date = ${gradingDate}::date ORDER BY version DESC LIMIT 1
      `)
    ).rows as any[];
    if (!rows.length || rows[0].state !== "draft") {
      return res.status(409).json({ message: "No open draft to confirm" });
    }
    const draft = rows[0];
    const lines = (draft.lines ?? []) as OpeningStockLine[];

    const totalsByOutcome = new Map<string, { known: boolean; eggs: number }>();
    for (const l of lines) {
      const buckets = [l.day1Qty, l.day2Qty, l.day3Qty, l.day4PlusQty];
      const cur = totalsByOutcome.get(l.outcome) ?? { known: true, eggs: 0 };
      if (buckets.some(b => b == null)) {
        cur.known = false;
      } else {
        cur.eggs += buckets.reduce<number>((a, b) => a + Number(b ?? 0), 0) * (Number(l.unitEggs) || 1);
      }
      totalsByOutcome.set(l.outcome, cur);
    }

    await db.transaction(async tx => {
      await tx.execute(sql`
        UPDATE grading_opening_stock_versions SET state = 'confirmed', confirmed_at = now() WHERE id = ${draft.id}
      `);
      for (const [outcome, t] of Array.from(totalsByOutcome)) {
        if (t.known) {
          const existing = await tx
            .select({ id: gradingOpeningStock.id })
            .from(gradingOpeningStock)
            .where(and(eq(gradingOpeningStock.gradingDate, gradingDate), eq(gradingOpeningStock.size, outcome)));
          if (existing.length) {
            await tx.update(gradingOpeningStock).set({ qty: Math.round(t.eggs), updatedAt: new Date() }).where(eq(gradingOpeningStock.id, existing[0].id));
          } else {
            await tx.insert(gradingOpeningStock).values({ gradingDate, size: outcome, qty: Math.round(t.eggs) });
          }
        } else {
          await tx.delete(gradingOpeningStock).where(and(eq(gradingOpeningStock.gradingDate, gradingDate), eq(gradingOpeningStock.size, outcome)));
        }
      }
      // Start the next draft from the same product rows, buckets cleared —
      // counting continues, it doesn't restart from nothing.
      const nextLines: OpeningStockLine[] = lines.map(l => ({ ...l, day1Qty: null, day2Qty: null, day3Qty: null, day4PlusQty: null }));
      await tx.execute(sql`
        INSERT INTO grading_opening_stock_versions (grading_date, version, state, lines)
        VALUES (${gradingDate}::date, ${draft.version + 1}, 'draft', ${JSON.stringify(nextLines)}::jsonb)
      `);
    });

    return res.json({ ok: true, version: draft.version });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to confirm opening stock" });
  }
});

/** GET /api/grading/opening-stock/versions?date= — version history, newest first */
router.get("/opening-stock/versions", async (req, res) => {
  const gradingDate = req.query.date as string | undefined;
  if (!gradingDate) return res.status(400).json({ message: "date required" });
  try {
    const rows = (
      await db.execute(sql`
        SELECT id, version, state, as_of_time, lines, created_at, confirmed_at
        FROM grading_opening_stock_versions
        WHERE grading_date = ${gradingDate}::date
        ORDER BY version DESC
      `)
    ).rows as any[];
    return res.json(
      rows.map(r => {
        const lines = (r.lines ?? []) as OpeningStockLine[];
        let knownEggs = 0, unknownLines = 0;
        for (const l of lines) {
          const buckets = [l.day1Qty, l.day2Qty, l.day3Qty, l.day4PlusQty];
          if (buckets.some(b => b == null)) unknownLines++;
          else knownEggs += buckets.reduce<number>((a, b) => a + Number(b ?? 0), 0) * (Number(l.unitEggs) || 1);
        }
        return {
          id: r.id, version: r.version, state: r.state, asOfTime: r.as_of_time,
          lineCount: lines.length, unknownLines, knownEggs: Math.round(knownEggs),
          createdAt: r.created_at, confirmedAt: r.confirmed_at,
        };
      }),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load version history" });
  }
});

// ── Yield models (weight → size-composition forecast) ───────────────────────────

/** GET /api/grading/yield-models */
router.get("/yield-models", async (_req, res) => {
  try {
    const rows = await db.select().from(gradingYieldModels).orderBy(desc(gradingYieldModels.publishedAt));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load yield models" });
  }
});

/** PATCH /api/grading/yield-models/:id/activate */
router.patch("/yield-models/:id/activate", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.update(gradingYieldModels).set({ active: false }).where(eq(gradingYieldModels.active, true));
    await db.update(gradingYieldModels).set({ active: true }).where(eq(gradingYieldModels.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to activate yield model" });
  }
});

/** DELETE /api/grading/yield-models/:id */
router.delete("/yield-models/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.delete(gradingYieldModels).where(eq(gradingYieldModels.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete yield model" });
  }
});

// ── Grading jobs (minimal — see schema comment) ─────────────────────────────────

/** GET /api/grading/jobs — list all (client filters/groups by lotId) */
router.get("/jobs", async (_req, res) => {
  try {
    const rows = await db.select().from(gradingJobs).orderBy(desc(gradingJobs.createdAt));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load grading jobs" });
  }
});

/** POST /api/grading/jobs */
router.post("/jobs", async (req, res) => {
  const { lotId, productionDate, qty, machine, plannedStart, plannedEnd, mixedEggLane, note } = req.body as {
    lotId: number;
    productionDate: string;
    qty: number;
    machine?: string;
    plannedStart?: string;
    plannedEnd?: string;
    mixedEggLane?: boolean;
    note?: string;
  };
  if (!lotId || !productionDate || !qty || qty <= 0) {
    return res.status(400).json({ message: "lotId, productionDate, and a qty > 0 are required" });
  }
  try {
    const [lot] = await db.select().from(gradingReceivingLots).where(eq(gradingReceivingLots.id, lotId));
    if (!lot) return res.status(404).json({ message: "Lot not found" });

    const received =
      lot.material === "sized"
        ? (lot.gradeLines as { qty: number | null }[]).reduce((s, g) => s + (g.qty ?? 0), 0)
        : lot.divided
          ? (lot.subs as { qty: number | null }[]).reduce((s, sb) => s + (sb.qty ?? 0), 0)
          : (lot.qty ?? 0);

    const existingJobs = await db.select().from(gradingJobs).where(eq(gradingJobs.lotId, lotId));
    const alreadyPlanned = existingJobs.reduce((s, j) => s + j.qty, 0);
    const remaining = received - alreadyPlanned;
    if (qty > remaining) {
      return res.status(400).json({ message: `qty exceeds what's left to plan for this lot (${remaining} eggs remaining)` });
    }

    const [created] = await db
      .insert(gradingJobs)
      .values({
        lotId,
        productionDate,
        qty,
        machine: machine || null,
        plannedStart: plannedStart || null,
        plannedEnd: plannedEnd || null,
        mixedEggLane: mixedEggLane ?? true,
        note: note || null,
      })
      .returning();
    return res.json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create grading job" });
  }
});

/** DELETE /api/grading/jobs/:id */
router.delete("/jobs/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [result] = await db.select().from(gradingJobResults).where(eq(gradingJobResults.jobId, id));
    // A confirmed result already had real side effects (learned into the
    // yield history, possibly spun off a reprocess lot from ungraded eggs)
    // — deleting the job at that point would leave those orphaned, so it's
    // blocked. A draft result has no such side effects yet, so it's safe to
    // clean up along with the job (grading_job_results.job_id has no ON
    // DELETE CASCADE, so it has to be removed explicitly, first).
    if (result?.status === "confirmed") {
      return res.status(400).json({ message: "This job has a confirmed actual result — it can't be deleted." });
    }
    if (result) {
      await db.delete(gradingJobResults).where(eq(gradingJobResults.jobId, id));
    }
    await db.delete(gradingJobs).where(eq(gradingJobs.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete grading job" });
  }
});

/** PATCH /api/grading/jobs/:id/send-to-floor — one-way "planned" → "sent_to_floor" */
router.patch("/jobs/:id/send-to-floor", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [job] = await db.select().from(gradingJobs).where(eq(gradingJobs.id, id));
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status === "sent_to_floor") return res.json(job);
    const [updated] = await db
      .update(gradingJobs)
      .set({ status: "sent_to_floor", sentToFloorAt: new Date() })
      .where(eq(gradingJobs.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to send job to floor" });
  }
});

// ── Grading job results ("Record actual result") ────────────────────────────────

/** GET /api/grading/job-results — list all (client matches by jobId) */
router.get("/job-results", async (_req, res) => {
  try {
    const rows = await db.select().from(gradingJobResults);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load grading job results" });
  }
});

// Defect (ตำหนิ) category → the real DEFECT-role SKU that sells it. The
// compound combo SKUs (10106-10108) and the not-sellable "total loss" SKU
// (10105) are intentionally excluded — the result-entry form only captures
// independent per-category counts, so there's no real source data for a
// combo, and total loss isn't a sellable ตำหนิ. See
// /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
const DEFECT_CATEGORY_SKU: Record<string, string> = {
  dirty: "10103",
  thin: "10101",
  dent: "10102",
  crack: "10104",
  bag: "10109",
};

/** GET /api/grading/defect-stock — real "available to sell" per ตำหนิ
 * category: confirmed job-result defect counts (produced) minus real order
 * quantity against that category's SKU (sold). No stored balance — derived
 * fresh on every read, same pattern as every other "remaining" figure in
 * this app (Packing's PQ-remaining, BOM's material requirements). */
router.get("/defect-stock", async (_req, res) => {
  try {
    const produced: Record<string, number> = {};
    const confirmedResults = await db
      .select({ defects: gradingJobResults.defects })
      .from(gradingJobResults)
      .where(eq(gradingJobResults.status, "confirmed"));
    for (const r of confirmedResults) {
      for (const [key, qty] of Object.entries(r.defects ?? {})) {
        produced[key] = (produced[key] ?? 0) + Number(qty);
      }
    }

    const skus = Object.values(DEFECT_CATEGORY_SKU);
    const soldRows = (
      await db.execute(sql`
        SELECT i.sku, i.name, COALESCE(SUM(oi.quantity), 0) AS sold
        FROM items i
        LEFT JOIN order_items oi ON oi.item_id = i.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status IN ('confirmed', 'in_production', 'delivered')
        WHERE i.sku IN (${sql.join(skus.map(s => sql`${s}`), sql`, `)})
        GROUP BY i.sku, i.name
      `)
    ).rows as any[];
    const soldBySku = new Map<string, { name: string; sold: number }>(
      soldRows.map(r => [r.sku, { name: r.name, sold: Number(r.sold) }]),
    );

    const categories = Object.entries(DEFECT_CATEGORY_SKU).map(([id, sku]) => {
      const label = GRADING_DEFECT_LABEL[id] ?? id;
      const totalProduced = produced[id] ?? 0;
      const soldInfo = soldBySku.get(sku);
      const totalSold = soldInfo?.sold ?? 0;
      const availableRaw = totalProduced - totalSold;
      return {
        id, label, sku, itemName: soldInfo?.name ?? null,
        totalProduced, totalSold, availableRaw, available: Math.max(0, availableRaw),
      };
    });
    const total = categories.reduce(
      (acc, c) => ({
        totalProduced: acc.totalProduced + c.totalProduced,
        totalSold: acc.totalSold + c.totalSold,
        available: acc.available + c.available,
      }),
      { totalProduced: 0, totalSold: 0, available: 0 },
    );

    return res.json({ categories, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute defect stock" });
  }
});

const GRADING_DEFECT_LABEL: Record<string, string> = {
  dirty: "เปื้อน", thin: "บาง", dent: "บุบ", crack: "แตก", bag: "ไข่ถุง",
};

/** GET /api/grading/wip-stock — real "available to sell" per WIP (graded-egg)
 * SKU: confirmed grading job results graded directly into that SKU via
 * fgLines (produced) minus real order quantity against it (sold). Same
 * derive-don't-duplicate pattern as /defect-stock. Returns every active WIP
 * item (not just ones with production yet) so an untouched SKU shows a real
 * 0, not a missing row — distinct from the separate, manual
 * grading_opening_stock figure (a size-level aggregate, not per-SKU). See
 * /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md. */
router.get("/wip-stock", async (_req, res) => {
  try {
    const wipItems = (
      await db.execute(sql`
        SELECT id, sku, name, packaging_profile
        FROM items WHERE item_role = 'WIP' AND is_active != 'inactive'
        ORDER BY sku
      `)
    ).rows as any[];
    if (wipItems.length === 0) return res.json({ items: [], trayMaterialUsage: [] });

    const produced: Record<number, number> = {};
    // Real cumulative tray/cover material usage — e.g. how many C29999P301
    // covers have been used across every confirmed job. A running total
    // only: no starting stock is tracked anywhere yet, so there's no real
    // "available" balance to report, by design (per
    // /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md).
    // specialTrayLines PARTITION an fgLine's qty — never add to `produced`.
    const trayUsage: Record<string, { componentSku: string; componentName: string; totalUsed: number }> = {};
    const confirmedResults = await db
      .select({ fgLines: gradingJobResults.fgLines, specialTrayLines: gradingJobResults.specialTrayLines })
      .from(gradingJobResults)
      .where(eq(gradingJobResults.status, "confirmed"));
    for (const r of confirmedResults) {
      for (const line of r.fgLines ?? []) {
        if (line.itemId == null || line.qty == null) continue;
        produced[line.itemId] = (produced[line.itemId] ?? 0) + Number(line.qty);
      }
      for (const line of r.specialTrayLines ?? []) {
        if (!line.componentSku) continue;
        if (!trayUsage[line.componentSku]) trayUsage[line.componentSku] = { componentSku: line.componentSku, componentName: line.componentName, totalUsed: 0 };
        trayUsage[line.componentSku].totalUsed += Number(line.qty) || 0;
      }
    }

    const wipIds = wipItems.map(i => Number(i.id));
    const soldRows = (
      await db.execute(sql`
        SELECT oi.item_id, COALESCE(SUM(oi.quantity), 0) AS sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status IN ('confirmed', 'in_production', 'delivered')
        WHERE oi.item_id IN (${sql.join(wipIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY oi.item_id
      `)
    ).rows as any[];
    const soldByItemId = new Map<number, number>(soldRows.map(r => [Number(r.item_id), Number(r.sold)]));

    const items = wipItems.map(it => {
      const itemId = Number(it.id);
      const totalProduced = produced[itemId] ?? 0;
      const totalSold = soldByItemId.get(itemId) ?? 0;
      const availableRaw = totalProduced - totalSold;
      return {
        itemId, sku: it.sku, name: it.name,
        packagingProfile: it.packaging_profile ?? null,
        totalProduced, totalSold, availableRaw, available: Math.max(0, availableRaw),
      };
    });
    return res.json({ items, trayMaterialUsage: Object.values(trayUsage) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute WIP stock" });
  }
});

/** GET /api/grading/jobs/:jobId/result */
router.get("/jobs/:jobId/result", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) return res.status(400).json({ message: "Invalid jobId" });
  try {
    const [row] = await db.select().from(gradingJobResults).where(eq(gradingJobResults.jobId, jobId));
    return res.json(row ?? null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load grading job result" });
  }
});

/** PUT /api/grading/jobs/:jobId/result — upsert (draft or confirmed) */
// Real outcomes an actual result can report against — "6" is deliberately
// excluded, matching the app-wide rule that No.6 is never a real actual
// outcome (legacy/unmapped, no entry field anywhere).
const ACTUAL_RESULT_SIZES = ["0", "1", "2", "3", "4", "5", "mixed"];

// The only valid "which two sizes" a mixed line can report — always two
// adjacent sizes, never a wider or non-adjacent combination.
const MIXED_RANGES = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6"];

// `n` on a contribution is how many real lots it represents — 1 for a single
// confirmed job, but potentially hundreds for the "seed" entry (the historical
// import is one ledger entry bundling many real historical lots at this
// weight). Row-level `n` sums these, not the number of ledger entries, so it
// stays an honest lot count rather than jumping from 256 to 2 the moment one
// job blends in.
type YieldContribution = { qty: number; n: number; sizes: Record<string, number>; defects: Record<string, number> };
type YieldRow = {
  weight: number;
  sizes: Record<string, number>;
  defects: Record<string, number>;
  sum: number | null;
  active: boolean;
  source: "seed" | "actual";
  n: number;
  qtyTotal: number;
  contributions: Record<string, YieldContribution>; // "seed" = historical import; else jobId
};

const round2 = (v: number) => Math.round(v * 100) / 100;

// Recomputes a row's derived sizes/defects/sum/n/qtyTotal from its raw-count
// contributions ledger — one weighted blend across everything that has ever
// fed this weight bucket, rather than a single job's numbers overriding it.
function recomputeYieldRow(row: YieldRow) {
  const contribs = Object.values(row.contributions);
  const qtyTotal = contribs.reduce((s, c) => s + c.qty, 0);
  row.qtyTotal = qtyTotal;
  row.n = contribs.reduce((s, c) => s + (c.n ?? 1), 0);
  const sumCounts = (pick: (c: YieldContribution) => Record<string, number>) => {
    const totals: Record<string, number> = {};
    for (const c of contribs) for (const [k, v] of Object.entries(pick(c))) totals[k] = (totals[k] ?? 0) + v;
    const pct: Record<string, number> = {};
    for (const [k, v] of Object.entries(totals)) pct[k] = qtyTotal > 0 ? round2((v / qtyTotal) * 100) : 0;
    return pct;
  };
  row.sizes = sumCounts(c => c.sizes);
  row.defects = sumCounts(c => c.defects);
  row.sum = round2(
    Object.values(row.sizes).reduce((s, v) => s + v, 0) + Object.values(row.defects).reduce((s, v) => s + v, 0),
  );
  row.source = row.contributions["seed"] ? "seed" : "actual";
}

// Blends a confirmed job's real observed size/defect counts into its weight
// bucket's yield-history row — this is how the model "learns" from grading,
// instead of a user re-uploading a spreadsheet, and instead of one job's
// result silently overriding a well-sampled historical average: every
// contribution (the original historical import plus every confirmed job)
// is kept in the row's `contributions` ledger and the row's percentages are
// always the weighted blend of all of them. Only eligible when the lot has a
// single known weight (raw, not divided): a divided lot's job can't be
// attributed to one sub-lot's weight, so there's nothing honest to record.
// No-ops quietly (never fails the result save) if the job isn't eligible,
// nothing was recorded, or there's no active history row to append to.
// Idempotent per job — re-confirming an edited result replaces its own
// contribution instead of double-counting it, and buckets its own weight the
// same way the seed import was bucketed (nearest 0.1) so it blends into the
// right row instead of starting a new one at its own exact-decimal weight.
async function appendActualToYieldHistory(jobId: number) {
  const [job] = await db.select().from(gradingJobs).where(eq(gradingJobs.id, jobId));
  if (!job) return;
  const [lot] = await db.select().from(gradingReceivingLots).where(eq(gradingReceivingLots.id, job.lotId));
  if (!lot || lot.material !== "raw" || lot.divided || lot.avgWeight == null) return;

  const [result] = await db.select().from(gradingJobResults).where(eq(gradingJobResults.jobId, jobId));
  if (!result || result.status !== "confirmed") return;

  const actualQty = result.actualQty ?? job.qty;
  if (!actualQty || actualQty <= 0) return;

  const output = result.output as Record<string, number>;
  const fgLines = result.fgLines as { outcome: string; baseEggs: number }[];
  const sizeTotals: Record<string, number> = {};
  for (const size of ACTUAL_RESULT_SIZES) {
    if (output[size] != null) sizeTotals[size] = (sizeTotals[size] ?? 0) + output[size];
  }
  for (const fg of fgLines) {
    if (fg.baseEggs > 0) sizeTotals[fg.outcome] = (sizeTotals[fg.outcome] ?? 0) + fg.baseEggs;
  }
  if (Object.keys(sizeTotals).length === 0) return; // nothing recorded yet — nothing to learn from

  const [model] = await db.select().from(gradingYieldModels).where(eq(gradingYieldModels.active, true));
  if (!model) return; // no active history to append to

  const rows = model.rows as YieldRow[];
  const bucketWeight = Math.round(Number(lot.avgWeight) * 10) / 10;
  let row = rows.find(r => Math.round(Number(r.weight) * 10) / 10 === bucketWeight);
  if (!row) {
    row = {
      weight: bucketWeight,
      sizes: {},
      defects: {},
      sum: null,
      active: true,
      source: "actual",
      n: 0,
      qtyTotal: 0,
      contributions: {},
    };
    rows.push(row);
  }
  row.contributions[String(jobId)] = {
    qty: actualQty,
    n: 1,
    sizes: sizeTotals,
    defects: result.defects as Record<string, number>,
  };
  recomputeYieldRow(row);

  await db.update(gradingYieldModels).set({ rows }).where(eq(gradingYieldModels.id, model.id));
}

// Ungraded output from a confirmed job's actual result is real, accounted-
// for egg quantity that never got assigned a size — not a loss, just eggs
// that still need to be graded. Auto-creates (or, on re-confirm, updates) a
// new RAW receiving lot for it, linked back via srcJobId so it's traceable
// to the job it came from. The new lot carries the source lot's real farm
// through, and its weight too when the source is a single-weight raw lot
// (genuinely the same physical batch of eggs, just not yet sorted) — for a
// divided or sized source there's no single honest weight to carry over, so
// it's left null (the user fills it in before it can be forecasted). Never
// touches a return lot that's already been planned into a new job — editing
// the source job's ungraded qty at that point would corrupt the return lot's
// own accounting, so it's just left alone.
async function createOrUpdateReprocessLot(jobId: number, ungradedQty: number | null) {
  const [job] = await db.select().from(gradingJobs).where(eq(gradingJobs.id, jobId));
  if (!job) return;
  const [sourceLot] = await db.select().from(gradingReceivingLots).where(eq(gradingReceivingLots.id, job.lotId));
  if (!sourceLot) return;

  const [existingReturn] = await db
    .select()
    .from(gradingReceivingLots)
    .where(and(eq(gradingReceivingLots.srcJobId, jobId), eq(gradingReceivingLots.origin, "grading_return")));

  const qty = ungradedQty ?? 0;

  if (qty <= 0) {
    // Nothing ungraded (any more) — remove the auto-created lot only if it
    // was never planned against, so editing this down to 0 doesn't leave an
    // orphaned empty lot behind. Leave it alone if it's already in use.
    if (existingReturn) {
      const jobsAgainstIt = await db.select().from(gradingJobs).where(eq(gradingJobs.lotId, existingReturn.id));
      if (jobsAgainstIt.length === 0) {
        await db.delete(gradingReceivingLots).where(eq(gradingReceivingLots.id, existingReturn.id));
      }
    }
    return;
  }

  const singleWeight = sourceLot.material === "raw" && !sourceLot.divided ? sourceLot.avgWeight : null;

  if (existingReturn) {
    const jobsAgainstIt = await db.select().from(gradingJobs).where(eq(gradingJobs.lotId, existingReturn.id));
    if (jobsAgainstIt.length > 0) return; // already in use — don't corrupt it
    await db
      .update(gradingReceivingLots)
      .set({ qty, avgWeight: singleWeight, farm: sourceLot.farm, updatedAt: new Date() })
      .where(eq(gradingReceivingLots.id, existingReturn.id));
    return;
  }

  await db.insert(gradingReceivingLots).values({
    lotNo: `${sourceLot.lotNo}-R${jobId}`,
    recvDate: job.productionDate,
    farm: sourceLot.farm,
    material: "raw",
    origin: "grading_return",
    srcJobId: jobId,
    qty,
    avgWeight: singleWeight,
    divided: false,
    subs: [],
    gradeLines: [],
    note: `ยังไม่ผ่านการคัดจากงาน #${jobId} (ล็อต ${sourceLot.lotNo})`,
  });
}

router.put("/jobs/:jobId/result", async (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) return res.status(400).json({ message: "Invalid jobId" });
  const {
    actualQty,
    actualBySub,
    inputNote,
    actualStart,
    actualEnd,
    output,
    fgLines,
    mixedLines,
    ungradedQty,
    defects,
    weighingLoss,
    otherVariance,
    varianceNote,
    status,
    specialTrayLines,
  } = req.body as {
    actualQty?: number | null;
    actualBySub?: Record<string, number> | null;
    inputNote?: string | null;
    actualStart?: string | null;
    actualEnd?: string | null;
    output?: Record<string, number>;
    fgLines?: { itemId: number; sku: string; name: string; outcome: string; qty: number | null; unit: string; factor: number; baseEggs: number }[];
    mixedLines?: { range: string; qty: number }[];
    ungradedQty?: number | null;
    defects?: Record<string, number>;
    weighingLoss?: number | null;
    otherVariance?: number | null;
    varianceNote?: string | null;
    status?: "draft" | "confirmed";
    specialTrayLines?: { itemId: number; sku: string; name: string; componentSku: string; componentName: string; qty: number }[];
  };
  if (status !== "draft" && status !== "confirmed") {
    return res.status(400).json({ message: "status must be 'draft' or 'confirmed'" });
  }
  try {
    const [job] = await db.select().from(gradingJobs).where(eq(gradingJobs.id, jobId));
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "sent_to_floor") {
      return res.status(400).json({ message: "Send this job to the floor before recording an actual result" });
    }

    const values = {
      jobId,
      actualQty: actualQty ?? null,
      actualBySub: actualBySub ?? null,
      inputNote: inputNote || null,
      actualStart: actualStart || null,
      actualEnd: actualEnd || null,
      output: output ?? {},
      fgLines: Array.isArray(fgLines)
        ? fgLines
            .filter(l => l && l.itemId != null)
            .map(l => ({
              itemId: Number(l.itemId),
              sku: String(l.sku ?? ""),
              name: String(l.name ?? ""),
              outcome: String(l.outcome ?? ""),
              qty: l.qty != null && (l.qty as any) !== "" ? Number(l.qty) : null,
              unit: String(l.unit ?? ""),
              factor: Number(l.factor) || 0,
              baseEggs: Number(l.baseEggs) || 0,
            }))
        : [],
      mixedLines: Array.isArray(mixedLines)
        ? mixedLines
            .filter(l => l && MIXED_RANGES.includes(l.range) && l.qty != null && (l.qty as any) !== "")
            .map(l => ({ range: l.range, qty: Number(l.qty) || 0 }))
        : [],
      ungradedQty: ungradedQty ?? null,
      defects: defects ?? {},
      specialTrayLines: Array.isArray(specialTrayLines)
        ? specialTrayLines
            .filter(l => l && l.itemId != null && l.componentSku)
            .map(l => ({
              itemId: Number(l.itemId),
              sku: String(l.sku ?? ""),
              name: String(l.name ?? ""),
              componentSku: String(l.componentSku),
              componentName: String(l.componentName ?? ""),
              qty: Number(l.qty) || 0,
            }))
        : [],
      weighingLoss: weighingLoss ?? null,
      otherVariance: otherVariance ?? null,
      varianceNote: varianceNote || null,
      status,
      confirmedAt: status === "confirmed" ? new Date() : null,
      updatedAt: new Date(),
    };

    const [existing] = await db.select().from(gradingJobResults).where(eq(gradingJobResults.jobId, jobId));
    const [saved] = existing
      ? await db.update(gradingJobResults).set(values).where(eq(gradingJobResults.jobId, jobId)).returning()
      : await db.insert(gradingJobResults).values(values).returning();

    if (status === "confirmed") {
      try {
        await appendActualToYieldHistory(jobId);
      } catch (err) {
        // Never let history-learning break the actual result save itself.
        console.error("Failed to append to yield history:", err);
      }
      try {
        await createOrUpdateReprocessLot(jobId, saved.ungradedQty);
      } catch (err) {
        // Never let reprocess-lot creation break the actual result save itself.
        console.error("Failed to create/update reprocess lot:", err);
      }
    }

    return res.json(saved);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to save grading job result" });
  }
});

// ── Grading floor-document print events ("Floor documents") ────────────────────

/** GET /api/grading/print-events?date=YYYY-MM-DD — most recent first */
router.get("/print-events", async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date) return res.status(400).json({ message: "date is required" });
  try {
    const rows = await db
      .select()
      .from(gradingPrintEvents)
      .where(eq(gradingPrintEvents.productionDate, date))
      .orderBy(desc(gradingPrintEvents.printedAt));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load print history" });
  }
});

/** POST /api/grading/print-events — freezes a new revision for (date, scope) */
router.post("/print-events", async (req, res) => {
  const { productionDate, scope, jobIds } = req.body as {
    productionDate: string;
    scope: string;
    jobIds: number[];
  };
  if (!productionDate || !scope || !Array.isArray(jobIds) || !jobIds.length) {
    return res.status(400).json({ message: "productionDate, scope, and a non-empty jobIds are required" });
  }
  try {
    const jobs = await db
      .select()
      .from(gradingJobs)
      .where(eq(gradingJobs.productionDate, productionDate))
      .orderBy(desc(gradingJobs.createdAt));
    const relevantJobs = jobs.filter(j => jobIds.includes(j.id));
    if (!relevantJobs.length) return res.status(404).json({ message: "No matching jobs for that date" });

    const lotIds = Array.from(new Set(relevantJobs.map(j => j.lotId)));
    const lots = await db.select().from(gradingReceivingLots);
    const lotById = new Map(lots.filter(l => lotIds.includes(l.id)).map(l => [l.id, l]));

    const results = await db.select().from(gradingJobResults);
    const resultByJobId = new Map(results.filter(r => jobIds.includes(r.jobId)).map(r => [r.jobId, r]));

    // Sequence number matches the "#N" badge already shown on the Machine Job
    // Board — a job's position within its own machine's job list for that
    // date, not a global counter across machines.
    const jobsByMachine = new Map<string, typeof jobs>();
    for (const j of jobs) {
      const key = j.machine ?? "Unassigned";
      if (!jobsByMachine.has(key)) jobsByMachine.set(key, []);
      jobsByMachine.get(key)!.push(j);
    }
    const seqByJobId = new Map<number, number>();
    for (const arr of Array.from(jobsByMachine.values())) {
      arr.forEach((j, i) => seqByJobId.set(j.id, i + 1));
    }

    const [activeModel] = await db.select().from(gradingYieldModels).where(eq(gradingYieldModels.active, true));
    const yieldRef = activeModel ? `YF-${activeModel.id} · ${activeModel.name}` : null;
    const dateCompact = productionDate.replace(/-/g, "");

    const snapshot = relevantJobs.map(j => {
      const seq = seqByJobId.get(j.id) ?? 0;
      return {
        jobId: j.id,
        seq,
        lotNo: lotById.get(j.lotId)?.lotNo ?? null,
        farm: lotById.get(j.lotId)?.farm ?? null,
        material: lotById.get(j.lotId)?.material ?? null,
        avgWeight: lotById.get(j.lotId)?.avgWeight ?? null,
        divided: lotById.get(j.lotId)?.divided ?? false,
        subs: lotById.get(j.lotId)?.divided ? lotById.get(j.lotId)?.subs ?? null : null,
        machine: j.machine,
        productionDate: j.productionDate,
        qty: j.qty,
        plannedStart: j.plannedStart,
        plannedEnd: j.plannedEnd,
        jobStatus: j.status,
        resultStatus: resultByJobId.get(j.id)?.status ?? null,
        wiRef: `WI-G-${dateCompact}-${String(seq).padStart(3, "0")}`,
        yieldRef,
      };
    });

    const existing = await db
      .select()
      .from(gradingPrintEvents)
      .where(and(eq(gradingPrintEvents.productionDate, productionDate), eq(gradingPrintEvents.scope, scope)));
    const revision = existing.length + 1;

    let printedBy: string | null = null;
    const userId = (req as any).session?.userId;
    if (userId) {
      const [u] = await db.select().from(users).where(eq(users.id, userId));
      printedBy = u?.email ?? null;
    }

    const [created] = await db
      .insert(gradingPrintEvents)
      .values({ productionDate, scope, revision, jobIds, snapshot, printedBy })
      .returning();
    return res.json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to record print event" });
  }
});

export default router;
