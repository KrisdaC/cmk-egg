import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),

  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),

  sellingUnits: text("selling_units"),
  packingUnits: text("packing_units"),
  paletteUnits: text("palette_units"),

  packsPerSellingUnit: integer("packs_per_selling_unit").notNull(),
  eggsPerPack: integer("eggs_per_pack").notNull(),
  eggsPerSellingUnit: integer("eggs_per_selling_unit").notNull(),

  skuSizeCategory: text("sku_size_category"),
  packBase: text("pack_base"),
  lidCover: text("lid_cover"),
  barcodeLabel: text("barcode_label"),
  stickerLabel: text("sticker_label"),

  isActive: boolean("is_active").default(true),
  isUndergrade: boolean("is_undergrade").default(false),
});
