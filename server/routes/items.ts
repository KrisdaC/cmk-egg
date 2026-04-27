import { Router } from "express";
import { db } from "../db";
import { items, itemBusinessPartners, businessPartners } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db.query.items.findMany({
      orderBy: desc(items.id),
      with: {
        partners: {
          with: { partner: true },
          where: eq(itemBusinessPartners.isActive, true),
        },
      },
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await db.query.items.findFirst({
      where: eq(items.id, id),
      with: {
        partners: {
          with: { partner: true },
          where: eq(itemBusinessPartners.isActive, true),
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body;

    const payload = {
      sku: data.sku,
      name: data.name,
      description: data.description,
      partnerId: data.partner_id ?? null,
      itemNumber: data.item_number,
      barcodeLabel: data.barcode_label ?? null,
      itemType: data.item_type,
      itemRole: data.item_role,
      baseUnit: data.base_unit,
      sellingUnit: data.selling_unit ?? null,
      packUnit: data.pack_unit,
      paletteUnit: data.palette_unit,
      basketUnit: data.basket_unit ?? null,
      eggsPerBasket: data.eggs_per_basket ?? null,
      eggsPerPack: data.eggs_per_pack ?? null,
      eggsPerPalette: data.eggs_per_palette ?? null,
      isActive: data.is_active,
      isSellable: data.is_sellable ?? false,
    };

    let savedItem: typeof items.$inferSelect;

    if (data.id) {
      const [updated] = await db
        .update(items)
        .set(payload)
        .where(eq(items.id, data.id))
        .returning();
      savedItem = updated;
    } else {
      if (data.sku) {
        const existing = await db
          .select({ id: items.id })
          .from(items)
          .where(eq(items.sku, data.sku))
          .limit(1);

        if (existing.length > 0) {
          return res
            .status(409)
            .json({ message: `SKU "${data.sku}" already exists` });
        }
      }

      const [created] = await db.insert(items).values(payload).returning();
      savedItem = created;
    }

    // Sync linked partners if provided
    if (Array.isArray(data.partner_ids)) {
      await syncItemPartners(savedItem.id, data.partner_ids);
    }

    return res.json(savedItem);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /items/:id/partners — replace the full partner list for an item
router.put("/:id/partners", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const { partner_ids } = req.body as { partner_ids: number[] };

    if (!Array.isArray(partner_ids)) {
      return res.status(400).json({ message: "partner_ids must be an array" });
    }

    await syncItemPartners(id, partner_ids);

    const updated = await db
      .select({
        id: itemBusinessPartners.id,
        partnerId: itemBusinessPartners.partnerId,
        customerItemNumber: itemBusinessPartners.customerItemNumber,
        barcodeLabel: itemBusinessPartners.barcodeLabel,
        partnerCode: businessPartners.code,
        partnerName: businessPartners.businessName,
      })
      .from(itemBusinessPartners)
      .leftJoin(
        businessPartners,
        eq(itemBusinessPartners.partnerId, businessPartners.id),
      )
      .where(eq(itemBusinessPartners.itemId, id));

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const deleted = await db.delete(items).where(eq(items.id, id)).returning();

    if (!deleted.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

async function syncItemPartners(itemId: number, partnerIds: number[]) {
  const existing = await db
    .select({ partnerId: itemBusinessPartners.partnerId })
    .from(itemBusinessPartners)
    .where(eq(itemBusinessPartners.itemId, itemId));

  const existingIds = new Set(existing.map((r) => r.partnerId));
  const newIds = new Set(partnerIds);

  // Insert new links
  const toInsert = partnerIds.filter((pid) => !existingIds.has(pid));
  if (toInsert.length > 0) {
    await db.insert(itemBusinessPartners).values(
      toInsert.map((pid) => ({ itemId, partnerId: pid, isActive: true })),
    );
  }

  // Delete removed links
  const toDelete = [...existingIds].filter((pid) => !newIds.has(pid));
  for (const pid of toDelete) {
    await db
      .delete(itemBusinessPartners)
      .where(
        and(
          eq(itemBusinessPartners.itemId, itemId),
          eq(itemBusinessPartners.partnerId, pid),
        ),
      );
  }
}

export default router;
