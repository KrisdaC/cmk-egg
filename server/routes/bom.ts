// server/routes/bom.ts
// Production Requirements/BOM — see /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md
// Entirely read-only: one endpoint joins this round's real PQ (same query
// shape as computePqRoundData in orders.ts) against items.packaging_profile/
// additional_materials (already real, live BOM data — see Items.tsx's
// PKG_SLOTS) and returns everything the frontend renders. No writes, no new
// tables.
import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { ComponentLine, ISSUE_LABEL, extractBomSlots, resolveBomComponents } from "../lib/bomResolve";

const router = Router();

type Issue = { kind: string; sku: string; name: string; detail: string };

router.get("/requirements", async (req, res) => {
  const date = req.query.date as string | undefined;
  const round = req.query.round ? Number(req.query.round) : undefined;
  if (!date || !round) return res.status(400).json({ message: "date and round required" });

  try {
    // 1) This round's real PQ, per order line — same filter computePqRoundData
    //    uses, plus excluding DEFECT/WIP (and anything else non-FG) items:
    //    those are scrap/graded-stock sales with no packaging BOM of their
    //    own, not finished goods to be produced this round — without this
    //    filter they'd wrongly show up as "needs_setup" and inflate egg
    //    demand. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
    const pqRows = (
      await db.execute(sql`
        SELECT bp.nickname AS partner_name, oi.item_id,
               COALESCE(oi.planning_qty, oi.quantity) AS qty
        FROM orders o
        LEFT JOIN business_partners bp ON bp.id = o.partner_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN items i ON i.id = oi.item_id
        WHERE o.delivery_date::date = ${date}::date
          AND o.production_round = ${round}
          AND o.status IN ('confirmed', 'in_production', 'delivered')
          AND oi.item_id IS NOT NULL
          AND (i.item_role IS NULL OR i.item_role = 'FG')
      `)
    ).rows as any[];

    const itemIds = Array.from(new Set(pqRows.map(r => Number(r.item_id))));
    if (itemIds.length === 0) {
      return res.json({ date, round, eggDemand: { total: 0, bySize: [], byCustomer: [] }, finishedGoods: [], materials: [], issues: [], issueTotal: 0 });
    }

    // 2) Batch-load the FG items themselves.
    const fgItemRows = (
      await db.execute(sql`
        SELECT id, sku, name, item_role, item_type, eggs_per_pack, primary_size, secondary_size,
               selling_unit, pack_unit, base_unit, is_sellable, packaging_profile, additional_materials
        FROM items WHERE id IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})
      `)
    ).rows as any[];
    const fgItemById = new Map<number, any>(fgItemRows.map(r => [Number(r.id), r]));

    // 3) Collect every component_sku referenced by any FG item's BOM, then
    //    batch-resolve those against items too (materials are plain items
    //    rows with item_role IN ('PACKAGING','SUPPLY')).
    const referencedSkus = new Set<string>();
    const fgBom = new Map<number, ReturnType<typeof extractBomSlots>>();
    for (const it of fgItemRows) {
      const { slots, extras } = extractBomSlots(it);
      fgBom.set(Number(it.id), { slots, extras });
      for (const s of slots) referencedSkus.add(s.component_sku!);
      for (const m of extras) referencedSkus.add(m.component_sku!);
    }
    const componentRows = referencedSkus.size
      ? ((
          await db.execute(sql`
            SELECT sku, name, item_type
            FROM items WHERE sku IN (${sql.join(Array.from(referencedSkus).map(s => sql`${s}`), sql`, `)})
          `)
        ).rows as any[])
      : [];
    const componentBySku = new Map<string, any>(componentRows.map(r => [r.sku, r]));

    // 4) Build per-FG-item component lines + classify setup issues.
    const issues: Issue[] = [];
    const plannedPacksByItem = new Map<number, number>();
    for (const r of pqRows) plannedPacksByItem.set(Number(r.item_id), (plannedPacksByItem.get(Number(r.item_id)) ?? 0) + Number(r.qty));

    const finishedGoods = itemIds.map(itemId => {
      const it = fgItemById.get(itemId);
      const plannedPacks = plannedPacksByItem.get(itemId) ?? 0;
      const byCustomer: Record<string, number> = {};
      for (const r of pqRows) {
        if (Number(r.item_id) !== itemId) continue;
        const name = r.partner_name ?? "ไม่ทราบลูกค้า";
        byCustomer[name] = (byCustomer[name] ?? 0) + Number(r.qty);
      }

      if (!it) {
        issues.push({ kind: "missing_master", sku: `item#${itemId}`, name: "(ไม่พบใน Items)", detail: "ไม่พบ SKU นี้ใน Master Data" });
        return {
          itemId, sku: `item#${itemId}`, name: "(ไม่พบใน Items)", sellingUnit: null, packUnit: null, baseUnit: null,
          eggsPerPack: 0, primarySize: null, secondarySize: null, totalQtyPacks: plannedPacks, totalEggs: 0,
          byCustomer: Object.entries(byCustomer).map(([partnerName, qtyPacks]) => ({ partnerName, qtyPacks })),
          components: [] as ComponentLine[], status: "needs_setup" as const, issueReasons: ["missing_master"],
        };
      }

      const eggsPerPack = Number(it.eggs_per_pack ?? 0);
      const bom = fgBom.get(itemId) ?? { slots: [], extras: [] };
      const { components, issueReasons } = resolveBomComponents(bom.slots, bom.extras, plannedPacks, componentBySku);

      for (const reason of Array.from(issueReasons)) {
        issues.push({ kind: reason, sku: it.sku ?? `item#${itemId}`, name: it.name, detail: ISSUE_LABEL[reason] ?? reason });
      }

      return {
        itemId, sku: it.sku, name: it.name, sellingUnit: it.selling_unit, packUnit: it.pack_unit, baseUnit: it.base_unit,
        eggsPerPack, primarySize: it.primary_size, secondarySize: it.secondary_size,
        totalQtyPacks: plannedPacks, totalEggs: plannedPacks * eggsPerPack,
        byCustomer: Object.entries(byCustomer).map(([partnerName, qtyPacks]) => ({ partnerName, qtyPacks })),
        components, status: issueReasons.size > 0 ? ("needs_setup" as const) : ("ready" as const),
        issueReasons: Array.from(issueReasons),
      };
    });

    // 5) Material requirements — aggregate every FG line's components by component SKU.
    const materialsBySku = new Map<string, { componentSku: string; componentName: string | null; itemType: string | null; totalQtyNeeded: number; resolved: boolean; usedByFgLines: { sku: string; name: string; qtyNeeded: number }[] }>();
    for (const fg of finishedGoods) {
      for (const c of fg.components) {
        if (!materialsBySku.has(c.componentSku)) {
          materialsBySku.set(c.componentSku, { componentSku: c.componentSku, componentName: c.componentName, itemType: c.itemType, totalQtyNeeded: 0, resolved: c.resolved, usedByFgLines: [] });
        }
        const m = materialsBySku.get(c.componentSku)!;
        m.totalQtyNeeded += c.qtyNeeded;
        m.usedByFgLines.push({ sku: fg.sku, name: fg.name, qtyNeeded: c.qtyNeeded });
      }
    }
    const materials = Array.from(materialsBySku.values())
      .map(m => ({ ...m, status: m.resolved ? ("ready" as const) : ("needs_setup" as const) }))
      .sort((a, b) => b.totalQtyNeeded - a.totalQtyNeeded);

    // 6) Egg demand — by size, by customer (same shape as Packing's pqBySizeToday).
    const bySize: Record<string, number> = {};
    const byCustomerEggs: Record<string, number> = {};
    for (const r of pqRows) {
      const it = fgItemById.get(Number(r.item_id));
      if (!it) continue;
      const eggs = Number(r.qty) * Number(it.eggs_per_pack ?? 0);
      const size = it.secondary_size ? `${it.primary_size}-${it.secondary_size}` : (it.primary_size ?? "mixed");
      bySize[size] = (bySize[size] ?? 0) + eggs;
      const custName = r.partner_name ?? "ไม่ทราบลูกค้า";
      byCustomerEggs[custName] = (byCustomerEggs[custName] ?? 0) + eggs;
    }
    const eggDemand = {
      total: Object.values(bySize).reduce((s, v) => s + v, 0),
      bySize: Object.entries(bySize).map(([size, eggs]) => ({ size, eggs })).sort((a, b) => b.eggs - a.eggs),
      byCustomer: Object.entries(byCustomerEggs).map(([partnerName, eggs]) => ({ partnerName, eggs })).sort((a, b) => b.eggs - a.eggs),
    };

    // Issue catalog summary (grouped counts, matching the prototype's "N issues" card).
    const issueSummary = Array.from(
      issues.reduce((m, i) => {
        if (!m.has(i.kind)) m.set(i.kind, { kind: i.kind, label: ISSUE_LABEL[i.kind] ?? i.kind, skus: [] as { sku: string; name: string; detail: string }[] });
        const g = m.get(i.kind)!;
        if (!g.skus.some(s => s.sku === i.sku)) g.skus.push({ sku: i.sku, name: i.name, detail: i.detail });
        return m;
      }, new Map<string, { kind: string; label: string; skus: { sku: string; name: string; detail: string }[] }>()).values(),
    ).map(g => ({ ...g, count: g.skus.length }));

    return res.json({
      date, round,
      eggDemand,
      finishedGoods: finishedGoods.sort((a, b) => b.totalEggs - a.totalEggs),
      materials,
      issues: issueSummary,
      issueTotal: issueSummary.reduce((s, g) => s + g.count, 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute BOM requirements" });
  }
});

export default router;
