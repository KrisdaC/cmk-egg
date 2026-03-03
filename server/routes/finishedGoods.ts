import { Router } from "express";
import { db } from "../db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";
import { productBusinessPartners } from "@shared/schema";
const router = Router();

router.get("/", async (req, res) => {
  try {
    const finishedGoods = await db.query.products.findMany({
      orderBy: (products, { desc }) => [desc(products.id)],
    });

    res.json(finishedGoods);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid finished good id" });
    }

    const finishedGood = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!finishedGood) {
      return res.status(404).json({ message: "Finished good not found" });
    }

    const relations = await db.query.productBusinessPartners.findMany({
      where: eq(productBusinessPartners.productId, id),
    });

    const business_partner_ids = relations.map((r) => r.businessPartnerId);

    res.json({ ...finishedGood, business_partner_ids });
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

      sellingUnits: data.selling_units,
      packingUnits: data.packing_units,
      paletteUnits: data.palette_units,

      packsPerSellingUnit: data.packs_per_selling_unit,
      eggsPerPack: data.eggs_per_pack,
      eggsPerSellingUnit: data.eggs_per_selling_unit,

      skuSizeCategory: data.sku_size_category,
      packBase: data.pack_base,
      lidCover: data.lid_cover,
      barcodeLabel: data.barcode_label,
      stickerLabel: data.sticker_label,

      businessPartnerIds: data.business_partner_ids,

      isActive: data.is_active,
      isUndergrade: data.is_undergrade,
    };

    // UPDATE
    if (data.id) {
      const [updated] = await db
        .update(products)
        .set(payload)
        .where(eq(products.id, data.id))
        .returning();

      // 🔴 Clear old relations
      await db
        .delete(productBusinessPartners)
        .where(eq(productBusinessPartners.productId, data.id));

      // 🟢 Insert new relations
      if (
        Array.isArray(data.business_partner_ids) &&
        data.business_partner_ids.length > 0
      ) {
        await db.insert(productBusinessPartners).values(
          data.business_partner_ids.map((partnerId: number) => ({
            productId: data.id,
            businessPartnerId: partnerId,
          })),
        );
      }

      return res.json(updated);
    }

    // CREATE — prevent duplicate SKU
    if (!data.id) {
      const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, data.sku))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          message: `SKU "${data.sku}" already exists`,
        });
      }
    }

    // INSERT
    const [created] = await db.insert(products).values(payload).returning();

    // 🟢 Insert relations after product exists
    if (
      Array.isArray(data.business_partner_ids) &&
      data.business_partner_ids.length > 0
    ) {
      await db.insert(productBusinessPartners).values(
        data.business_partner_ids.map((partnerId: number) => ({
          productId: created.id,
          businessPartnerId: partnerId,
        })),
      );
    }

    return res.json(created);
  } catch (err: any) {
    console.error(err);
    //console.error("some error");

    if (err.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: err.errors,
      });
    }

    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid finished good id" });
    }

    // 🔴 Remove relations first
    await db
      .delete(productBusinessPartners)
      .where(eq(productBusinessPartners.productId, id));

    // 🔴 Delete product
    const deleted = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!deleted.length) {
      return res.status(404).json({ message: "Finished good not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
