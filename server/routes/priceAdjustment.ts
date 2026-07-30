import { Router } from "express";
import { db } from "../db";
import {
  pricingWeeks,
  pricingAssumptions,
  priceProposals,
  priceProposalLines,
  priceProposalLineExceptions,
  activePrices,
  deliverySiteGroups,
  deliverySiteGroupMembers,
  deliverySites,
  businessPartners,
  items,
  materialCostRates,
} from "@shared/schema";
import { users } from "../db/schema/users";
import { desc, eq, and, like, inArray, isNull, aliasedTable } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const ASSUMPTION_COMPONENTS = ["transport_in", "transport_out", "disty_cost", "operations", "labor", "maintenance", "egg_loss"] as const;

// =============================================
// PRICING WEEKS
// =============================================

router.get("/weeks", async (_req, res) => {
  try {
    const weeks = await db
      .select({
        id: pricingWeeks.id,
        weekCode: pricingWeeks.weekCode,
        startDate: pricingWeeks.startDate,
        endDate: pricingWeeks.endDate,
        status: pricingWeeks.status,
        notes: pricingWeeks.notes,
        createdBy: pricingWeeks.createdBy,
        createdAt: pricingWeeks.createdAt,
        benchmarkPartner: {
          id: businessPartners.id,
          nickname: businessPartners.nickname,
          code: businessPartners.code,
        },
      })
      .from(pricingWeeks)
      .leftJoin(businessPartners, eq(pricingWeeks.benchmarkPartnerId, businessPartners.id))
      .orderBy(desc(pricingWeeks.id));

    return res.json(weeks);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch pricing weeks" });
  }
});

router.get("/weeks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [week] = await db
      .select({
        id: pricingWeeks.id,
        weekCode: pricingWeeks.weekCode,
        startDate: pricingWeeks.startDate,
        endDate: pricingWeeks.endDate,
        status: pricingWeeks.status,
        notes: pricingWeeks.notes,
        createdBy: pricingWeeks.createdBy,
        createdAt: pricingWeeks.createdAt,
        benchmarkPartnerId: pricingWeeks.benchmarkPartnerId,
      })
      .from(pricingWeeks)
      .where(eq(pricingWeeks.id, id));

    if (!week) return res.status(404).json({ message: "Pricing week not found" });

    const assumptions = await db
      .select({
        id: pricingAssumptions.id,
        pricingWeekId: pricingAssumptions.pricingWeekId,
        partnerId: pricingAssumptions.partnerId,
        siteGroupId: pricingAssumptions.siteGroupId,
        component: pricingAssumptions.component,
        value: pricingAssumptions.value,
        unit: pricingAssumptions.unit,
        notes: pricingAssumptions.notes,
        partner: {
          id: businessPartners.id,
          nickname: businessPartners.nickname,
          code: businessPartners.code,
        },
      })
      .from(pricingAssumptions)
      .leftJoin(businessPartners, eq(pricingAssumptions.partnerId, businessPartners.id))
      .where(eq(pricingAssumptions.pricingWeekId, id));

    let benchmarkPartner = null;
    if (week.benchmarkPartnerId) {
      const [bp] = await db
        .select({ id: businessPartners.id, nickname: businessPartners.nickname, code: businessPartners.code })
        .from(businessPartners)
        .where(eq(businessPartners.id, week.benchmarkPartnerId));
      benchmarkPartner = bp ?? null;
    }

    return res.json({ ...week, benchmarkPartner, assumptions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch pricing week" });
  }
});

const createWeekSchema = z.object({
  weekCode: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  benchmarkPartnerId: z.number().optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
});

router.post("/weeks", async (req, res) => {
  try {
    const parsed = createWeekSchema.parse(req.body);

    const existing = await db.query.pricingWeeks.findFirst({
      where: eq(pricingWeeks.weekCode, parsed.weekCode),
    });
    if (existing) {
      return res.status(409).json({ message: `Week ${parsed.weekCode} already exists` });
    }

    const [created] = await db.insert(pricingWeeks).values(parsed).returning();
    return res.status(201).json(created);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to create pricing week" });
  }
});

router.patch("/weeks/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({ status: z.string() }).parse(req.body);

    const week = await db.query.pricingWeeks.findFirst({
      where: eq(pricingWeeks.id, id),
    });
    if (!week) return res.status(404).json({ message: "Week not found" });

    if (status === "approved") {
      const assumptions = await db
        .select()
        .from(pricingAssumptions)
        .where(eq(pricingAssumptions.pricingWeekId, id));

      const partnerIds = Array.from(new Set(assumptions.map((a) => a.partnerId).filter(Boolean)));
      if (partnerIds.length === 0) {
        return res.status(400).json({ message: "Cannot approve: no customer assumptions configured" });
      }
      for (const pid of partnerIds) {
        const components = assumptions.filter((a) => a.partnerId === pid).map((a) => a.component);
        const missing = ASSUMPTION_COMPONENTS.filter((c) => !components.includes(c));
        if (missing.length > 0) {
          return res.status(400).json({
            message: `Cannot approve: customer ${pid} is missing components: ${missing.join(", ")}`,
            missing,
          });
        }
      }
    }

    if (status === "active") {
      await db
        .update(pricingWeeks)
        .set({ status: "archived" })
        .where(eq(pricingWeeks.status, "active"));
    }

    const [updated] = await db
      .update(pricingWeeks)
      .set({ status })
      .where(eq(pricingWeeks.id, id))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update week status" });
  }
});

// =============================================
// PRICING ASSUMPTIONS
// =============================================

router.get("/weeks/:weekId/assumptions", async (req, res) => {
  try {
    const weekId = Number(req.params.weekId);
    const rows = await db
      .select()
      .from(pricingAssumptions)
      .where(eq(pricingAssumptions.pricingWeekId, weekId));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch assumptions" });
  }
});

const upsertAssumptionSchema = z.object({
  component: z.enum(["transport_in", "transport_out", "dc_cost", "disty_cost", "operations", "labor", "maintenance", "egg_loss"]),
  partnerId: z.number(),
  siteGroupId: z.number().optional().nullable(),
  value: z.number(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

router.put("/weeks/:weekId/assumptions/:component", async (req, res) => {
  try {
    const weekId = Number(req.params.weekId);
    const component = req.params.component;
    const parsed = upsertAssumptionSchema.parse({ ...req.body, component });
    const siteGroupId = parsed.siteGroupId ?? null;

    const existing = await db.query.pricingAssumptions.findFirst({
      where: and(
        eq(pricingAssumptions.pricingWeekId, weekId),
        eq(pricingAssumptions.partnerId, parsed.partnerId),
        eq(pricingAssumptions.component, component),
        siteGroupId != null
          ? eq(pricingAssumptions.siteGroupId, siteGroupId)
          : isNull(pricingAssumptions.siteGroupId),
      ),
    });

    let result;
    if (existing) {
      [result] = await db
        .update(pricingAssumptions)
        .set({ value: parsed.value.toString(), unit: parsed.unit, notes: parsed.notes })
        .where(eq(pricingAssumptions.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(pricingAssumptions)
        .values({
          pricingWeekId: weekId,
          partnerId: parsed.partnerId,
          siteGroupId,
          component: parsed.component,
          value: parsed.value.toString(),
          unit: parsed.unit,
          notes: parsed.notes,
        })
        .returning();
    }

    return res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to save assumption" });
  }
});

router.delete("/assumptions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(pricingAssumptions).where(eq(pricingAssumptions.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete assumption" });
  }
});

// =============================================
// COST ANALYSIS (per-size breakdown for a partner/week)
// =============================================

router.get("/weeks/:weekId/cost-analysis", async (req, res) => {
  try {
    const weekId = Number(req.params.weekId);
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    const refStartDate = req.query.startDate ? String(req.query.startDate) : null;
    const refEndDate = req.query.endDate ? String(req.query.endDate) : null;

    // Fetch assumptions for this week + partner
    const assumptions = await db
      .select()
      .from(pricingAssumptions)
      .where(
        and(
          eq(pricingAssumptions.pricingWeekId, weekId),
          eq(pricingAssumptions.partnerId, partnerId),
        ),
      );

    // Fixed cost per egg = sum of all บาท components
    const fixedCostPerEgg = assumptions
      .filter((a) => a.unit !== "%")
      .reduce((sum, a) => sum + parseFloat(a.value || "0"), 0);

    // Disty cost as decimal (e.g. 5.87% → 0.0587)
    const distyCostPct =
      parseFloat(
        assumptions.find((a) => a.component === "disty_cost")?.value || "0",
      ) / 100;

    // ── Material costs: build a price map from uploaded rates ──
    const partnerRow = await db
      .select({ nickname: businessPartners.nickname })
      .from(businessPartners)
      .where(eq(businessPartners.id, partnerId))
      .limit(1);
    const partnerNickname = (partnerRow[0]?.nickname ?? "").replace(/'/g, "''");

    // DISTINCT ON (sku, partner) — gives latest rate per (sku, partner) combination
    const matRatesResult = await db.execute(`
      SELECT DISTINCT ON (mcr.sku, mcr.partner)
        mcr.sku,
        mcr.partner,
        mcr.tiered_prices
      FROM material_cost_rates mcr
      WHERE mcr.partner IN ('ALL', '${partnerNickname}')
        AND mcr.is_current = true
      ORDER BY mcr.sku, mcr.partner, mcr.effective_date DESC
    `);

    const REF_TIERS = ["300000","200000","100000","400000","500000","50000","30000","10000","5000"];

    const refTierPrice = (tp: Record<string, number | null>): number | null => {
      for (const t of REF_TIERS) {
        const v = tp[t];
        if (v != null && !isNaN(Number(v)) && Number(v) > 0) return Number(v);
      }
      return null;
    };

    // Build price map: packaging_sku → best price (partner-specific overrides ALL)
    const matPriceMap = new Map<string, number>();
    for (const r of matRatesResult.rows as any[]) {
      if ((r.partner as string) === 'ALL') {
        const price = refTierPrice(r.tiered_prices as Record<string, number | null>);
        if (price != null && !matPriceMap.has(r.sku)) matPriceMap.set(r.sku, price);
      }
    }
    for (const r of matRatesResult.rows as any[]) {
      if ((r.partner as string) !== 'ALL') {
        const price = refTierPrice(r.tiered_prices as Record<string, number | null>);
        if (price != null) matPriceMap.set(r.sku, price); // overrides ALL
      }
    }

    // Calculate material cost per egg from an item's packaging_profile BOM
    const calcMatCostPerEgg = (
      profileJson: string | Record<string, unknown> | null,
      effectiveEggsPerUnit: number
    ): number => {
      if (!profileJson || effectiveEggsPerUnit <= 0) return 0;
      let profile: Record<string, { enabled?: boolean; component_sku?: string; qty_per_pack?: number }>;
      try {
        // packaging_profile is JSONB — pg auto-parses it into an object; handle both cases
        profile = typeof profileJson === "string" ? JSON.parse(profileJson) : profileJson as typeof profile;
      } catch { return 0; }
      let costPerPack = 0;
      for (const slot of Object.values(profile)) {
        if (!slot.enabled || !slot.component_sku) continue;
        const price = matPriceMap.get(slot.component_sku);
        if (price == null) continue;
        costPerPack += price * (slot.qty_per_pack ?? 1);
      }
      return costPerPack / effectiveEggsPerUnit;
    };

    // Selling price data from order_items for this partner, with x4/x5 multiplier
    const rows = await db.execute(`
      SELECT
        i.id,
        i.sku,
        i.name,
        i.primary_size,
        i.secondary_size,
        i.min_primary,
        i.eggs_per_pack,
        i.packaging_profile,
        AVG(oi.unit_price::numeric) AS avg_unit_price,
        AVG(
          oi.unit_price::numeric /
          CASE
            WHEN i.name LIKE '%x5%' OR i.name LIKE '%X5%' THEN i.eggs_per_pack * 5
            WHEN i.name LIKE '%x4%' OR i.name LIKE '%X4%' THEN i.eggs_per_pack * 4
            ELSE i.eggs_per_pack
          END
        ) AS avg_price_per_egg,
        CASE
          WHEN i.name LIKE '%x5%' OR i.name LIKE '%X5%' THEN i.eggs_per_pack * 5
          WHEN i.name LIKE '%x4%' OR i.name LIKE '%X4%' THEN i.eggs_per_pack * 4
          ELSE i.eggs_per_pack
        END AS effective_eggs_per_unit,
        SUM(oi.quantity) AS total_quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN items i ON i.id = oi.item_id
      WHERE o.partner_id = ${partnerId}
        AND i.eggs_per_pack IS NOT NULL
        AND i.eggs_per_pack > 0
        ${refStartDate && refEndDate ? `AND o.order_date BETWEEN '${refStartDate}' AND '${refEndDate}'` : ""}
      GROUP BY i.id, i.sku, i.name, i.primary_size, i.secondary_size, i.min_primary, i.eggs_per_pack
      ORDER BY i.primary_size, i.secondary_size NULLS LAST, i.sku
    `);

    // Group by individual size — mixed SKUs are split into both component sizes
    type SkuEntry = {
      sku: string; name: string; avgPricePerEgg: number;
      effectiveEggsPerUnit: number; totalQuantity: number;
      splitQuantity: number; isMixed: boolean;
      materialCostPerEgg: number;
    };
    const sizeMap: Record<string, { primarySize: string; skus: SkuEntry[] }> = {};

    const ensureGroup = (size: string) => {
      if (!sizeMap[size]) sizeMap[size] = { primarySize: size, skus: [] };
    };

    for (const row of rows.rows as any[]) {
      const avgPricePerEgg = parseFloat(row.avg_price_per_egg);
      const effectiveEggsPerUnit = Number(row.effective_eggs_per_unit);
      const totalQuantity = Number(row.total_quantity);
      const isMixed = row.secondary_size != null;
      const materialCostPerEgg = calcMatCostPerEgg(
        row.packaging_profile as string | Record<string, unknown> | null,
        effectiveEggsPerUnit,
      );

      if (isMixed) {
        const minPrimary = row.min_primary != null ? Number(row.min_primary) : 60;
        const primaryRatio = minPrimary / 100;

        ensureGroup(row.primary_size);
        sizeMap[row.primary_size].skus.push({
          sku: row.sku, name: row.name, avgPricePerEgg, effectiveEggsPerUnit,
          totalQuantity, splitQuantity: Math.round(totalQuantity * primaryRatio), isMixed: true,
          materialCostPerEgg,
        });

        ensureGroup(row.secondary_size);
        sizeMap[row.secondary_size].skus.push({
          sku: row.sku, name: row.name, avgPricePerEgg, effectiveEggsPerUnit,
          totalQuantity, splitQuantity: Math.round(totalQuantity * (1 - primaryRatio)), isMixed: true,
          materialCostPerEgg,
        });
      } else {
        const size = row.primary_size ?? "?";
        ensureGroup(size);
        sizeMap[size].skus.push({
          sku: row.sku, name: row.name, avgPricePerEgg, effectiveEggsPerUnit,
          totalQuantity, splitQuantity: totalQuantity, isMixed: false,
          materialCostPerEgg,
        });
      }
    }

    // Build result rows
    const result = Object.values(sizeMap).map((group) => {
      const totalQty = group.skus.reduce((sum, s) => sum + s.splitQuantity, 0);
      const avgSellPerEgg =
        totalQty > 0
          ? group.skus.reduce((sum, s) => sum + s.avgPricePerEgg * s.splitQuantity, 0) / totalQty
          : 0;

      // Weighted average of per-SKU material costs (each SKU's BOM → matPriceMap lookup)
      const materialCostPerEgg = totalQty > 0
        ? group.skus.reduce((s, e) => s + e.materialCostPerEgg * e.splitQuantity, 0) / totalQty
        : 0;

      const distyCostPerEgg = distyCostPct * avgSellPerEgg;
      const totalCostPerEgg = fixedCostPerEgg + materialCostPerEgg + distyCostPerEgg;
      const eggRawCostPerEgg = avgSellPerEgg - totalCostPerEgg;

      const ps = group.primarySize;
      const sizeLabel =
        ps === "mixed" ? "คละ"
        : ["S", "M", "L"].includes(ps) ? `ขนาด ${ps}`
        : `เบอร์ ${ps}`;

      return {
        primarySize: ps,
        secondarySize: null,
        sizeLabel,
        skus: group.skus,
        totalQuantity: totalQty,
        avgSellPerEgg,
        fixedCostPerEgg,
        materialCostPerEgg,
        distyCostPerEgg,
        totalCostPerEgg,
        eggRawCostPerEgg,
        hasAssumptions: assumptions.length > 0,
      };
    });

    return res.json({
      weekId,
      partnerId,
      assumptions,
      fixedCostPerEgg,
      distyCostPct,
      sizes: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute cost analysis" });
  }
});

// =============================================
// PARTNER ITEMS — items from order history for a given partner
// =============================================

router.get("/partner-items", async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    if (!partnerId) return res.status(400).json({ message: "partnerId is required" });

    const rows = await db.execute(`
      SELECT DISTINCT ON (i.id)
        i.id, i.sku, i.name, i.primary_size, i.secondary_size,
        i.min_primary, i.eggs_per_pack, i.selling_unit, i.base_unit,
        i.item_number,
        ibp.customer_item_number,
        COALESCE(ibp.barcode_label, i.barcode_label) AS barcode_label
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN items i ON i.id = oi.item_id
      LEFT JOIN item_business_partners ibp
        ON ibp.item_id = i.id AND ibp.partner_id = ${partnerId}
      WHERE o.partner_id = ${partnerId}
        AND i.eggs_per_pack IS NOT NULL
        AND i.eggs_per_pack > 0
      ORDER BY i.id, i.primary_size NULLS LAST, i.sku
    `);

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch partner items" });
  }
});

router.get("/egg-items", async (_req, res) => {
  try {
    const rows = await db.execute(`
      SELECT
        id, sku, name, primary_size, secondary_size,
        min_primary, eggs_per_pack, selling_unit, base_unit
      FROM items
      WHERE eggs_per_pack IS NOT NULL AND eggs_per_pack > 0
      ORDER BY primary_size NULLS LAST, sku
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch egg items" });
  }
});

// GET /api/pricing/last-prices?partnerId=N
// Returns the most recent invoiced unit_price per item from order history
router.get("/last-prices", async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    if (!partnerId) return res.status(400).json({ message: "partnerId required" });

    const rows = await db.execute(`
      SELECT DISTINCT ON (oi.item_id)
        oi.item_id   AS "itemId",
        oi.unit_price AS "unitPrice",
        o.order_date  AS "orderDate"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.partner_id = ${partnerId}
        AND oi.unit_price > 0
      ORDER BY oi.item_id, o.order_date DESC, o.id DESC
    `);

    // Return as { itemId: unitPrice }
    const map: Record<number, number> = {};
    for (const r of rows.rows as any[]) {
      map[Number(r.itemId)] = parseFloat(r.unitPrice);
    }
    return res.json(map);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch last prices" });
  }
});

// GET /api/pricing/weeks/:weekId/quantities?partnerId=N
// Returns qty per item per site group for the week's date range
router.get("/weeks/:weekId/quantities", async (req, res) => {
  try {
    const weekId = Number(req.params.weekId);
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    if (!partnerId) return res.status(400).json({ message: "partnerId required" });

    // Use custom date range if provided, otherwise fall back to week dates
    let startDate: string;
    let endDate: string;
    if (req.query.startDate && req.query.endDate) {
      startDate = String(req.query.startDate);
      endDate = String(req.query.endDate);
    } else {
      const [week] = await db.select().from(pricingWeeks).where(eq(pricingWeeks.id, weekId)).limit(1);
      if (!week) return res.status(404).json({ message: "Week not found" });
      startDate = week.startDate as string;
      endDate = week.endDate as string;
    }

    const result = await db.execute(`
      SELECT
        oi.item_id,
        sgm.group_id AS site_group_id,
        SUM(oi.quantity)::integer AS quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN items i ON i.id = oi.item_id
      LEFT JOIN delivery_site_group_members sgm
        ON sgm.delivery_site_id = o.delivery_site_id
        AND EXISTS (
          SELECT 1 FROM delivery_site_groups dsg
          WHERE dsg.id = sgm.group_id AND dsg.partner_id = ${partnerId}
        )
      WHERE o.partner_id = ${partnerId}
        AND o.order_date BETWEEN '${startDate}' AND '${endDate}'
        AND i.eggs_per_pack IS NOT NULL AND i.eggs_per_pack > 0
      GROUP BY oi.item_id, sgm.group_id
    `);

    // Build { itemId: { "default": qty, "siteGroupId": qty } }
    const qtyMap: Record<number, Record<string, number>> = {};
    for (const row of result.rows as any[]) {
      const itemId = Number(row.item_id);
      const key = row.site_group_id != null ? String(row.site_group_id) : "default";
      if (!qtyMap[itemId]) qtyMap[itemId] = {};
      qtyMap[itemId][key] = Number(row.quantity);
    }
    return res.json(qtyMap);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch quantities" });
  }
});

// =============================================
// PRICE PROPOSALS
// =============================================

router.get("/proposals", async (req, res) => {
  try {
    const weekId = req.query.weekId ? Number(req.query.weekId) : undefined;

    const reviewerAlias = aliasedTable(users, "reviewer");
    const approverAlias = aliasedTable(users, "approver");
    const rows = await db
      .select({
        id: priceProposals.id,
        proposalNumber: priceProposals.proposalNumber,
        status: priceProposals.status,
        submittedBy: priceProposals.submittedBy,
        reviewedBy: priceProposals.reviewedBy,
        reviewedByUser: {
          email: reviewerAlias.email,
          firstName: reviewerAlias.first_name,
          lastName: reviewerAlias.last_name,
        },
        approvedBy: priceProposals.approvedBy,
        approvedByUser: {
          email: approverAlias.email,
          firstName: approverAlias.first_name,
          lastName: approverAlias.last_name,
        },
        approvedAt: priceProposals.approvedAt,
        effectiveDate: priceProposals.effectiveDate,
        effectiveDateTo: priceProposals.effectiveDateTo,
        notes: priceProposals.notes,
        createdAt: priceProposals.createdAt,
        partner: {
          id: businessPartners.id,
          nickname: businessPartners.nickname,
          code: businessPartners.code,
        },
        week: {
          id: pricingWeeks.id,
          weekCode: pricingWeeks.weekCode,
          status: pricingWeeks.status,
        },
      })
      .from(priceProposals)
      .leftJoin(businessPartners, eq(priceProposals.partnerId, businessPartners.id))
      .leftJoin(pricingWeeks, eq(priceProposals.pricingWeekId, pricingWeeks.id))
      .leftJoin(reviewerAlias, eq(priceProposals.reviewedBy, reviewerAlias.id))
      .leftJoin(approverAlias, eq(priceProposals.approvedBy, approverAlias.id))
      .where(weekId ? eq(priceProposals.pricingWeekId, weekId) : undefined)
      .orderBy(desc(priceProposals.id));

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch proposals" });
  }
});

router.get("/proposals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const reviewerAlias = aliasedTable(users, "reviewer");
    const approverAlias = aliasedTable(users, "approver");
    const [proposal] = await db
      .select({
        id: priceProposals.id,
        proposalNumber: priceProposals.proposalNumber,
        status: priceProposals.status,
        submittedBy: priceProposals.submittedBy,
        reviewedBy: priceProposals.reviewedBy,
        reviewedByUser: {
          email: reviewerAlias.email,
          firstName: reviewerAlias.first_name,
          lastName: reviewerAlias.last_name,
        },
        approvedBy: priceProposals.approvedBy,
        approvedByUser: {
          email: approverAlias.email,
          firstName: approverAlias.first_name,
          lastName: approverAlias.last_name,
        },
        approvedAt: priceProposals.approvedAt,
        effectiveDate: priceProposals.effectiveDate,
        effectiveDateTo: priceProposals.effectiveDateTo,
        notes: priceProposals.notes,
        createdAt: priceProposals.createdAt,
        partner: {
          id: businessPartners.id,
          nickname: businessPartners.nickname,
          code: businessPartners.code,
        },
        week: {
          id: pricingWeeks.id,
          weekCode: pricingWeeks.weekCode,
          status: pricingWeeks.status,
        },
      })
      .from(priceProposals)
      .leftJoin(businessPartners, eq(priceProposals.partnerId, businessPartners.id))
      .leftJoin(pricingWeeks, eq(priceProposals.pricingWeekId, pricingWeeks.id))
      .leftJoin(reviewerAlias, eq(priceProposals.reviewedBy, reviewerAlias.id))
      .leftJoin(approverAlias, eq(priceProposals.approvedBy, approverAlias.id))
      .where(eq(priceProposals.id, id));

    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const lines = await db
      .select({
        id: priceProposalLines.id,
        referencePrice: priceProposalLines.referencePrice,
        basePrice: priceProposalLines.basePrice,
        notes: priceProposalLines.notes,
        item: {
          id: items.id,
          sku: items.sku,
          name: items.name,
          baseUnit: items.baseUnit,
          eggsPerPack: items.eggsPerPack,
          primarySize: items.primarySize,
          secondarySize: items.secondarySize,
        },
      })
      .from(priceProposalLines)
      .leftJoin(items, eq(priceProposalLines.itemId, items.id))
      .where(eq(priceProposalLines.proposalId, id));

    // Fetch exceptions for all lines
    const lineIds = lines.map((l) => l.id);
    const exceptions = lineIds.length > 0
      ? await db
          .select({
            proposalLineId: priceProposalLineExceptions.proposalLineId,
            siteGroupId: priceProposalLineExceptions.siteGroupId,
            price: priceProposalLineExceptions.price,
          })
          .from(priceProposalLineExceptions)
          .where(inArray(priceProposalLineExceptions.proposalLineId, lineIds))
      : [];

    const exceptionsByLine: Record<number, { siteGroupId: number; price: string }[]> = {};
    for (const ex of exceptions) {
      if (!exceptionsByLine[ex.proposalLineId]) exceptionsByLine[ex.proposalLineId] = [];
      exceptionsByLine[ex.proposalLineId].push({ siteGroupId: ex.siteGroupId, price: ex.price });
    }

    const linesWithExceptions = lines.map((l) => ({
      ...l,
      exceptions: exceptionsByLine[l.id] ?? [],
    }));

    return res.json({ ...proposal, lines: linesWithExceptions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch proposal" });
  }
});

const createProposalSchema = z.object({
  pricingWeekId: z.number(),
  partnerId: z.number(),
  effectiveDate: z.string().optional(),
  effectiveDateTo: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(
    z.object({
      itemId: z.number(),
      referencePrice: z.number().optional(),
      basePrice: z.number().optional(),
      exceptions: z.array(z.object({
        siteGroupId: z.number(),
        price: z.number(),
      })).optional(),
      notes: z.string().optional(),
    }),
  ),
});

router.post("/proposals", async (req, res) => {
  try {
    const parsed = createProposalSchema.parse(req.body);

    const week = await db.query.pricingWeeks.findFirst({
      where: eq(pricingWeeks.id, parsed.pricingWeekId),
    });
    if (!week) return res.status(400).json({ message: "Pricing week not found" });
    if (week.status === "draft") {
      return res.status(400).json({ message: "Cannot create proposal: pricing week is not yet approved" });
    }

    const weekCode = week.weekCode.replace("-", "").replace("W", "W");
    const existing = await db
      .select({ proposalNumber: priceProposals.proposalNumber })
      .from(priceProposals)
      .where(like(priceProposals.proposalNumber, `PP-${weekCode}-%`))
      .orderBy(desc(priceProposals.proposalNumber))
      .limit(1);

    let seq = 1;
    if (existing.length > 0 && existing[0].proposalNumber) {
      seq = Number(existing[0].proposalNumber.split("-").pop()) + 1;
    }
    const proposalNumber = `PP-${weekCode}-${String(seq).padStart(3, "0")}`;

    let createdProposal: any;
    await db.transaction(async (tx) => {
      [createdProposal] = await tx
        .insert(priceProposals)
        .values({
          proposalNumber,
          pricingWeekId: parsed.pricingWeekId,
          partnerId: parsed.partnerId,
          scopeType: "customer",
          effectiveDate: parsed.effectiveDate ?? null,
          effectiveDateTo: parsed.effectiveDateTo ?? null,
          notes: parsed.notes,
          status: "draft",
        })
        .returning();

      if (parsed.lines.length > 0) {
        const insertedLines = await tx.insert(priceProposalLines).values(
          parsed.lines.map((l) => ({
            proposalId: createdProposal.id,
            itemId: l.itemId,
            referencePrice: l.referencePrice?.toString(),
            basePrice: l.basePrice?.toString(),
            notes: l.notes,
          })),
        ).returning();

        // Insert exceptions
        const exceptionRows: { proposalLineId: number; siteGroupId: number; price: string }[] = [];
        for (let i = 0; i < insertedLines.length; i++) {
          const lineExceptions = parsed.lines[i].exceptions ?? [];
          for (const ex of lineExceptions) {
            exceptionRows.push({
              proposalLineId: insertedLines[i].id,
              siteGroupId: ex.siteGroupId,
              price: ex.price.toString(),
            });
          }
        }
        if (exceptionRows.length > 0) {
          await tx.insert(priceProposalLineExceptions).values(exceptionRows);
        }
      }
    });

    return res.status(201).json(createdProposal);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to create proposal" });
  }
});

const updateProposalSchema = z.object({
  effectiveDate: z.string().optional(),
  effectiveDateTo: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        id: z.number().optional(),
        itemId: z.number(),
        referencePrice: z.number().optional(),
        basePrice: z.number().optional(),
        exceptions: z.array(z.object({
          siteGroupId: z.number(),
          price: z.number(),
        })).optional(),
        proposalPrice: z.number().optional(),
        counterPrice: z.number().optional(),
        finalLockedPrice: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

router.put("/proposals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = updateProposalSchema.parse(req.body);

    const proposal = await db.query.priceProposals.findFirst({
      where: eq(priceProposals.id, id),
    });
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (["approved"].includes(proposal.status || "")) {
      return res.status(400).json({ message: "Approved proposals cannot be edited" });
    }

    await db.transaction(async (tx) => {
      if (parsed.notes !== undefined || parsed.effectiveDate !== undefined || parsed.effectiveDateTo !== undefined) {
        await tx.update(priceProposals).set({
          ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
          ...(parsed.effectiveDate !== undefined ? { effectiveDate: parsed.effectiveDate } : {}),
          ...(parsed.effectiveDateTo !== undefined ? { effectiveDateTo: parsed.effectiveDateTo } : {}),
        }).where(eq(priceProposals.id, id));
      }

      if (parsed.lines) {
        await tx.delete(priceProposalLines).where(eq(priceProposalLines.proposalId, id));
        if (parsed.lines.length > 0) {
          const insertedLines = await tx.insert(priceProposalLines).values(
            parsed.lines.map((l) => ({
              proposalId: id,
              itemId: l.itemId,
              referencePrice: l.referencePrice?.toString(),
              basePrice: l.basePrice?.toString(),
              proposalPrice: l.proposalPrice?.toString(),
              counterPrice: l.counterPrice?.toString(),
              finalLockedPrice: l.finalLockedPrice?.toString(),
              notes: l.notes,
            })),
          ).returning();

          const exceptionRows: { proposalLineId: number; siteGroupId: number; price: string }[] = [];
          for (let i = 0; i < insertedLines.length; i++) {
            for (const ex of parsed.lines[i].exceptions ?? []) {
              exceptionRows.push({ proposalLineId: insertedLines[i].id, siteGroupId: ex.siteGroupId, price: ex.price.toString() });
            }
          }
          if (exceptionRows.length > 0) {
            await tx.insert(priceProposalLineExceptions).values(exceptionRows);
          }
        }
      }
    });

    return res.json({ id, message: "Proposal updated" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update proposal" });
  }
});

router.patch("/proposals/:proposalId/lines/:lineId", async (req, res) => {
  try {
    const proposalId = Number(req.params.proposalId);
    const lineId = Number(req.params.lineId);

    const parsed = z
      .object({
        basePrice: z.number().nullable().optional(),
        referencePrice: z.number().optional(),
        notes: z.string().optional(),
        exceptions: z.array(z.object({
          siteGroupId: z.number(),
          price: z.number().nullable(),
        })).optional(),
      })
      .parse(req.body);

    const proposal = await db.query.priceProposals.findFirst({
      where: eq(priceProposals.id, proposalId),
    });
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (proposal.status === "approved") {
      return res.status(400).json({ message: "Approved proposals cannot be edited" });
    }

    await db.transaction(async (tx) => {
      const updatePayload: Record<string, string | null | undefined> = {};
      if (parsed.basePrice !== undefined) updatePayload.basePrice = parsed.basePrice?.toString() ?? null;
      if (parsed.referencePrice !== undefined) updatePayload.referencePrice = parsed.referencePrice.toString();
      if (parsed.notes !== undefined) updatePayload.notes = parsed.notes;

      if (Object.keys(updatePayload).length > 0) {
        await tx
          .update(priceProposalLines)
          .set(updatePayload)
          .where(and(eq(priceProposalLines.id, lineId), eq(priceProposalLines.proposalId, proposalId)));
      }

      if (parsed.exceptions !== undefined) {
        // Upsert exceptions: delete then re-insert
        await tx.delete(priceProposalLineExceptions)
          .where(eq(priceProposalLineExceptions.proposalLineId, lineId));
        const toInsert = parsed.exceptions.filter((e) => e.price != null);
        if (toInsert.length > 0) {
          await tx.insert(priceProposalLineExceptions).values(
            toInsert.map((e) => ({
              proposalLineId: lineId,
              siteGroupId: e.siteGroupId,
              price: e.price!.toString(),
            }))
          );
        }
      }
    });

    return res.json({ id: lineId, message: "Line updated" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update line" });
  }
});

router.patch("/proposals/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, approvedBy } = z
      .object({ status: z.string(), approvedBy: z.string().optional() })
      .parse(req.body);

    const proposal = await db.query.priceProposals.findFirst({
      where: eq(priceProposals.id, id),
    });
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const VALID_TRANSITIONS: Record<string, string[]> = {
      draft: ["reviewed"],
      reviewed: ["approved", "draft"],
      approved: [],
    };
    const allowed = VALID_TRANSITIONS[proposal.status ?? ""] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from "${proposal.status}" to "${status}"` });
    }

    if (status === "approved") {
      const lines = await db
        .select()
        .from(priceProposalLines)
        .where(eq(priceProposalLines.proposalId, id));

      if (lines.length === 0) {
        return res.status(400).json({ message: "Cannot approve: proposal has no SKU lines" });
      }

      const missingBasePrice = lines.filter((l) => !l.basePrice);
      if (missingBasePrice.length > 0) {
        return res.status(400).json({
          message: `Cannot approve: ${missingBasePrice.length} SKU(s) missing base price`,
        });
      }
    }

    const sessionUserId = (req.session as any).userId as string | undefined;
    const updateValues: any = { status };
    if (status === "reviewed") {
      updateValues.reviewedBy = sessionUserId ?? null;
    }
    if (status === "approved") {
      updateValues.approvedBy = sessionUserId ?? null;
      updateValues.approvedAt = new Date();
    }
    if (status === "draft") {
      updateValues.reviewedBy = null;
    }

    const [updated] = await db
      .update(priceProposals)
      .set(updateValues)
      .where(eq(priceProposals.id, id))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update proposal status" });
  }
});

// =============================================
// ACTIVE PRICES
// =============================================

router.get("/active-prices", async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;

    const rows = await db
      .select({
        id: activePrices.id,
        itemId: activePrices.itemId,
        siteGroupId: activePrices.siteGroupId,
        scopeType: activePrices.scopeType,
        price: activePrices.price,
        effectiveDate: activePrices.effectiveDate,
        expiryDate: activePrices.expiryDate,
        status: activePrices.status,
        approvedBy: activePrices.approvedBy,
        approvedAt: activePrices.approvedAt,
        createdAt: activePrices.createdAt,
        item: {
          id: items.id,
          sku: items.sku,
          name: items.name,
          baseUnit: items.baseUnit,
        },
        partner: {
          id: businessPartners.id,
          nickname: businessPartners.nickname,
          code: businessPartners.code,
        },
      })
      .from(activePrices)
      .leftJoin(items, eq(activePrices.itemId, items.id))
      .leftJoin(businessPartners, eq(activePrices.partnerId, businessPartners.id))
      .where(partnerId ? eq(activePrices.partnerId, partnerId) : undefined)
      .orderBy(desc(activePrices.id));

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch active prices" });
  }
});

router.post("/proposals/:id/activate", async (req, res) => {
  try {
    const proposalId = Number(req.params.id);
    const { effectiveDate, approvedBy } = z
      .object({ effectiveDate: z.string(), approvedBy: z.string().optional() })
      .parse(req.body);

    const proposal = await db.query.priceProposals.findFirst({
      where: eq(priceProposals.id, proposalId),
    });
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (proposal.status !== "approved") {
      return res.status(400).json({ message: "Only approved proposals can be activated" });
    }

    const lines = await db
      .select()
      .from(priceProposalLines)
      .where(eq(priceProposalLines.proposalId, proposalId));

    if (lines.length === 0) return res.status(400).json({ message: "No lines to activate" });
    const lineIds = lines.map((l) => l.id);

    // Load all exceptions for these lines
    const allExceptions = await db
      .select()
      .from(priceProposalLineExceptions)
      .where(inArray(priceProposalLineExceptions.proposalLineId, lineIds));

    await db.transaction(async (tx) => {
      for (const line of lines) {
        if (!line.basePrice) continue;

        // Replace existing customer-scope active prices
        await tx
          .update(activePrices)
          .set({ status: "replaced" })
          .where(
            and(
              eq(activePrices.itemId, line.itemId),
              eq(activePrices.partnerId, proposal.partnerId),
              eq(activePrices.scopeType, "customer"),
              eq(activePrices.status, "active"),
            ),
          );

        // Insert base price (all branches)
        await tx.insert(activePrices).values({
          itemId: line.itemId,
          partnerId: proposal.partnerId,
          scopeType: "customer",
          price: line.basePrice,
          effectiveDate,
          status: "active",
          sourceProposalLineId: line.id,
          approvedBy,
          approvedAt: new Date(),
        });

        // Insert site-group exception prices
        const lineExceptions = allExceptions.filter((e) => e.proposalLineId === line.id);
        for (const ex of lineExceptions) {
          await tx
            .update(activePrices)
            .set({ status: "replaced" })
            .where(
              and(
                eq(activePrices.itemId, line.itemId),
                eq(activePrices.siteGroupId, ex.siteGroupId),
                eq(activePrices.status, "active"),
              ),
            );
          await tx.insert(activePrices).values({
            itemId: line.itemId,
            partnerId: proposal.partnerId,
            scopeType: "site_group",
            siteGroupId: ex.siteGroupId,
            price: ex.price,
            effectiveDate,
            status: "active",
            sourceProposalLineId: line.id,
            approvedBy,
            approvedAt: new Date(),
          });
        }
      }
    });

    return res.json({ message: "Prices activated successfully" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to activate prices" });
  }
});

// =============================================
// DELIVERY SITES (lookup for a partner)
// =============================================

router.get("/delivery-sites", async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    const rows = await db
      .select({
        id: deliverySites.id,
        siteCode: deliverySites.siteCode,
        displayName: deliverySites.displayName,
        branchName: deliverySites.branchName,
        partnerBranchCode: deliverySites.partnerBranchCode,
        province: deliverySites.province,
        addressLine1: deliverySites.addressLine1,
        deliveryType: deliverySites.deliveryType,
        isActive: deliverySites.isActive,
      })
      .from(deliverySites)
      .where(
        partnerId
          ? and(eq(deliverySites.partnerId, partnerId), eq(deliverySites.isActive, true))
          : eq(deliverySites.isActive, true),
      )
      .orderBy(deliverySites.siteCode);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch delivery sites" });
  }
});

// =============================================
// DELIVERY SITE GROUPS
// =============================================

router.get("/site-groups", async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    const rows = await db
      .select({
        id: deliverySiteGroups.id,
        name: deliverySiteGroups.name,
        description: deliverySiteGroups.description,
        isActive: deliverySiteGroups.isActive,
        createdAt: deliverySiteGroups.createdAt,
        partner: {
          id: businessPartners.id,
          nickname: businessPartners.nickname,
          code: businessPartners.code,
        },
      })
      .from(deliverySiteGroups)
      .leftJoin(businessPartners, eq(deliverySiteGroups.partnerId, businessPartners.id))
      .where(partnerId ? eq(deliverySiteGroups.partnerId, partnerId) : undefined)
      .orderBy(deliverySiteGroups.name);

    // Attach member site IDs in one extra query (avoids N+1)
    let memberSiteIdMap: Map<number, number[]> = new Map();
    if (rows.length > 0) {
      const memberRows = await db
        .select({ groupId: deliverySiteGroupMembers.groupId, siteId: deliverySiteGroupMembers.deliverySiteId })
        .from(deliverySiteGroupMembers)
        .where(inArray(deliverySiteGroupMembers.groupId, rows.map(r => r.id)));
      for (const m of memberRows) {
        if (!memberSiteIdMap.has(m.groupId)) memberSiteIdMap.set(m.groupId, []);
        memberSiteIdMap.get(m.groupId)!.push(m.siteId);
      }
    }

    return res.json(rows.map(r => ({ ...r, memberSiteIds: memberSiteIdMap.get(r.id) ?? [] })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch site groups" });
  }
});

router.get("/site-groups/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [group] = await db
      .select()
      .from(deliverySiteGroups)
      .where(eq(deliverySiteGroups.id, id));
    if (!group) return res.status(404).json({ message: "Site group not found" });

    const members = await db
      .select({
        id: deliverySiteGroupMembers.id,
        deliverySite: {
          id: deliverySites.id,
          siteCode: deliverySites.siteCode,
          displayName: deliverySites.displayName,
          branchName: deliverySites.branchName,
          province: deliverySites.province,
        },
      })
      .from(deliverySiteGroupMembers)
      .leftJoin(deliverySites, eq(deliverySiteGroupMembers.deliverySiteId, deliverySites.id))
      .where(eq(deliverySiteGroupMembers.groupId, id));

    return res.json({ ...group, members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch site group" });
  }
});

router.post("/site-groups", async (req, res) => {
  try {
    const parsed = z
      .object({
        partnerId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        siteIds: z.array(z.number()).optional(),
      })
      .parse(req.body);

    let createdGroup: any;
    await db.transaction(async (tx) => {
      [createdGroup] = await tx
        .insert(deliverySiteGroups)
        .values({ partnerId: parsed.partnerId, name: parsed.name, description: parsed.description })
        .returning();

      if (parsed.siteIds && parsed.siteIds.length > 0) {
        await tx.insert(deliverySiteGroupMembers).values(
          parsed.siteIds.map((siteId) => ({ groupId: createdGroup.id, deliverySiteId: siteId })),
        );
      }
    });

    return res.status(201).json(createdGroup);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to create site group" });
  }
});

router.put("/site-groups/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        siteIds: z.array(z.number()).optional(),
      })
      .parse(req.body);

    await db.transaction(async (tx) => {
      if (parsed.name !== undefined || parsed.description !== undefined) {
        await tx
          .update(deliverySiteGroups)
          .set({ name: parsed.name, description: parsed.description })
          .where(eq(deliverySiteGroups.id, id));
      }

      if (parsed.siteIds !== undefined) {
        await tx.delete(deliverySiteGroupMembers).where(eq(deliverySiteGroupMembers.groupId, id));
        if (parsed.siteIds.length > 0) {
          await tx.insert(deliverySiteGroupMembers).values(
            parsed.siteIds.map((siteId) => ({ groupId: id, deliverySiteId: siteId })),
          );
        }
      }
    });

    return res.json({ id, message: "Site group updated" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update site group" });
  }
});

router.delete("/site-groups/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(deliverySiteGroups).where(eq(deliverySiteGroups.id, id));
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete site group" });
  }
});

export default router;
