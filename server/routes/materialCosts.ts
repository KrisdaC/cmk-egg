import { Router } from "express";
import { db } from "../db";
import { materialCostRates, items } from "@shared/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const TIER_KEYS = ["5000000","1000000","500000","400000","300000","200000","100000","80000","70000","50000","40000","30000","20000","10000","5000"] as const;

const uploadRowSchema = z.object({
  sku: z.string().min(1),
  effectiveDate: z.string(),
  supplierName: z.string().min(1),
  partner: z.string().default("ALL"),
  itemDescription: z.string().optional(),
  tieredPrices: z.record(z.string(), z.number().nullable()),
  notes: z.string().optional(),
});

const uploadBodySchema = z.object({
  rows: z.array(uploadRowSchema).min(1).max(500),
});

// GET /api/material-costs - list all rates
router.get("/", async (_req, res) => {
  try {
    const rates = await db
      .select()
      .from(materialCostRates)
      .orderBy(desc(materialCostRates.effectiveDate));
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/material-costs/validate-skus - check which SKUs exist
router.post("/validate-skus", async (req, res) => {
  try {
    const { skus } = z.object({ skus: z.array(z.string()) }).parse(req.body);
    const unique = Array.from(new Set(skus));
    const found = await db
      .select({ sku: items.sku, name: items.name })
      .from(items)
      .where(inArray(items.sku, unique));
    const foundSet = new Set(found.map((r) => r.sku));
    const result: Record<string, { found: boolean; name?: string }> = {};
    for (const sku of unique) {
      const match = found.find((r) => r.sku === sku);
      result[sku] = { found: foundSet.has(sku), name: match?.name };
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/material-costs/upload - bulk insert rows
router.post("/upload", async (req, res) => {
  try {
    const { rows } = uploadBodySchema.parse(req.body);

    // Resolve which SKUs actually exist to avoid FK violations
    const uniqueSkus = Array.from(new Set(rows.map((r) => r.sku)));
    const foundRows = await db
      .select({ sku: items.sku })
      .from(items)
      .where(inArray(items.sku, uniqueSkus));
    const validSkus = new Set(foundRows.map((r) => r.sku));

    const inserted = await db
      .insert(materialCostRates)
      .values(
        rows.map((r) => ({
          sku: validSkus.has(r.sku) ? r.sku : null,
          effectiveDate: r.effectiveDate,
          supplierName: r.supplierName,
          partner: r.partner,
          itemDescription: r.itemDescription ?? null,
          tieredPrices: r.tieredPrices,
          notes: r.notes ?? null,
          isCurrent: true,
          uploadedBy: (req as any).user?.username ?? "system",
        }))
      )
      .returning({ id: materialCostRates.id });
    res.json({ inserted: inserted.length });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
