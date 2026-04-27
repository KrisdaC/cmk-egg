import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  time,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// === TABLE DEFINITIONS ===

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // SUP-0001
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  supplierType: text("supplier_type").default("eggs"), // eggs, packaging, labels
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drivers
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // DRV-0001
  name: text("name").notNull(),
  licenseNumber: text("license_number"),
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vehicles
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // VHC-0001
  plateNumber: text("plate_number").notNull().unique(),
  vehicleType: text("vehicle_type").notNull(), // truck, van, refrigerated
  capacity: decimal("capacity", { precision: 10, scale: 2 }), // in eggs or pallets
  costPerKm: decimal("cost_per_km", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Business Partners - Unified entity for customers and vendors/brands
// Level 1: Partner (who we do business with - billing/branding entity)
// Level 2: DeliverySite (where we deliver to)
export const businessPartners = pgTable("business_partners", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // Short code: TT, BC, MK, CJ, etc.
  nickname: text("nickname").notNull(), // Display name: "MK - Makro", "Big C"

  // Partner Type
  partnerType: text("partner_type").notNull().default("customer"), // customer, supplier, both

  // Business Identity (for billing/invoicing)
  businessName: text("business_name"), // Legal name for invoicing (optional for simple partners)
  businessType: text("business_type"), // individual, corporation
  customerType: text("customer_type"), // traditional_trade, modern_trade
  branchCode: text("branch_code"), // 5-digit Thai branch code (00000 = HQ)
  branchName: text("branch_name"), // สาขาระยอง, สำนักงานใหญ่, etc.
  taxId: text("tax_id"), // 13-digit Thai tax ID

  // Billing Address
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  district: text("district"), // ตำบล/แขวง
  subDistrict: text("sub_district"), // อำเภอ/เขต
  province: text("province"), // จังหวัด
  postalCode: text("postal_code"),
  country: text("country").default("Thailand"),

  // Payment Terms (shared across all delivery sites)
  creditDays: integer("credit_days").default(0),
  paymentTerms: text("payment_terms"), // COD, Credit, Prepaid
  customerTier: text("customer_tier"), // Standard, Wholesale, Modern Trade

  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Delivery Sites - One row per delivery location (many per partner)
export const deliverySites = pgTable("delivery_sites", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id")
    .references(() => businessPartners.id)
    .notNull(),

  // Site Identity
  siteCode: text("site_code").notNull().unique(), // e.g., MK-SKR-001 (Makro Samut Sakhon)
  displayName: text("display_name").notNull(), // Short name for display
  partnerBranchCode: text("partner_branch_code"), // Partner's branch code (e.g., M022 for Makro)
  branchName: text("branch_name"), // Branch name

  // Delivery Type
  deliveryType: text("delivery_type").notNull().default("direct_to_store"), // direct_to_store, to_distribution_center

  // Address
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  district: text("district"),
  subDistrict: text("sub_district"),
  province: text("province"),
  postalCode: text("postal_code"),
  country: text("country").default("Thailand"),

  // Geolocation
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  googleMapsUrl: text("google_maps_url"),

  // Delivery preferences
  deliveryZone: text("delivery_zone"), // Zone/Region for logistics planning
  deliveryRegion: text("delivery_region"), // Renamed - using both during transition
  preferredTimeSlot: text("preferred_time_slot"), // Morning, Afternoon, Evening, or specific time
  accessInstructions: text("access_instructions"), // Gate code, loading dock info
  acceptableVehicles: text("acceptable_vehicles").array(), // pickup, 6-wheel, 10-wheel, trailer

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Partner Contacts - Contacts linked to partner (can optionally be site-specific)
export const partnerContacts = pgTable("partner_contacts", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // PC-0001
  partnerId: integer("partner_id")
    .references(() => businessPartners.id)
    .notNull(),
  deliverySiteId: integer("delivery_site_id").references(
    () => deliverySites.id,
  ), // Optional: site-specific contact

  // Contact Details
  fullName: text("full_name").notNull(),
  role: text("role"), // Owner, Purchasing, Billing, Receiving, General
  department: text("department"),

  // Communication
  phone: text("phone"),
  mobile: text("mobile"),
  email: text("email"),
  lineId: text("line_id"), // LINE messaging app ID
  fax: text("fax"),

  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stock Locations
export const stockLocations = pgTable("stock_locations", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // LOC-0001
  name: text("name").notNull(),
  locationType: text("location_type").notNull(), // raw_receiving, grading, packing, finished_goods, shipping
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Egg Sizes (Grade classifications) - LEGACY, use eggGradeRules instead
export const eggSizes = pgTable("egg_sizes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Jumbo, Extra Large, Large, Medium, Small, Pewee
  code: text("code").notNull().unique(), // J, XL, L, M, S, P
  minWeight: decimal("min_weight", { precision: 5, scale: 2 }), // grams
  maxWeight: decimal("max_weight", { precision: 5, scale: 2 }), // grams
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================
// NEW ITEM MASTER SYSTEM (Per Spec Document)
// =============================================

// Egg Grade Rules - Legal weight-based grading (LAW TABLE)
// This represents Thai law for egg grading and MUST be data-driven
export const eggGradeRules = pgTable("egg_grade_rules", {
  id: serial("id").primaryKey(),
  gradeCode: text("grade_code").notNull().unique(), // B0, B1, B2, B3, B4, B5, UNDER
  gradeName: text("grade_name").notNull(), // เบอร์ 0, เบอร์ 1, etc.
  minWeightG: decimal("min_weight_g", { precision: 6, scale: 3 }), // NULL for UNDER lower bound
  maxWeightG: decimal("max_weight_g", { precision: 6, scale: 3 }), // NULL for B0 upper bound
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

// Pack Types - Lookup table for packaging formats
// Used across the system for FG specs and order processing
export const packTypes = pgTable("fg_pack_type", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // PACK4, PACK10, PACK12, PACK15, TRAY30, BUNDLE4, BUNDLE5
  name: text("name").notNull(), // Pack 4, Pack 10, Pack 12, Pack 15, ถาด, มัด 4, มัด 5
  thaiName: text("thai_name").notNull(), // แพ็ค 4, แพ็ค 10, etc.
  eggsPerPack: integer("eggs_per_pack").notNull(), // 4, 10, 12, 15, 30, 120, 150
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

// Item Master - Single source of truth for Eggs and Packaging Goods (STATIC DATA)
export const itemMaster = pgTable("item_master", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(), // EGG-UNGR, EGG-GRD-B0, FG-B0-10, PKG-TRAY30
  itemName: text("item_name").notNull(),
  itemCategory: text("item_category").notNull(), // EGG, PACKAGING

  // For EGG category only
  eggType: text("egg_type"), // UNGR (ungraded), GRADED, UNDER (undergraded), FG (finished goods)
  gradeCode: text("grade_code"), // B0, B1, B2, B3, B4, B5, UNDER - single grade for GRADED items

  // Unit of measure
  baseUom: text("base_uom").notNull(), // ALWAYS 'EGG' for eggs, 'PCS' for packaging

  // Stock tracking
  lotTracked: boolean("lot_tracked").default(true),
  isSellable: boolean("is_sellable").default(false),

  // For packaging linked to specific customer
  partnerId: integer("partner_id").references(() => businessPartners.id), // NULL = shared item

  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================
// EGG GRADE COMPOSITIONS - Reusable grade formulas
// =============================================

// Egg Grade Compositions - Unique grade formulas (eliminates redundancy)
// Example: egg_spec_b1_100 = 100% B1, egg_spec_b3b4_40_60 = 40% B3 + 60% B4
export const eggGradeCompositions = pgTable("egg_grade_compositions", {
  id: serial("id").primaryKey(),
  compositionCode: text("composition_code").notNull().unique(), // egg_spec_b1_100, egg_spec_b3b4_40_60
  compositionName: text("composition_name").notNull(), // "เบอร์ 1 100%", "คละ M (3-4)"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Egg Grade Composition Items (fb_egg_sizes_spec) - Grade percentages per composition
// Example: 40% size 3 (B3), 60% size 4 (B4)
export const eggGradeCompositionItems = pgTable("fb_egg_sizes_spec", {
  id: serial("id").primaryKey(),
  compositionId: integer("composition_id")
    .references(() => eggGradeCompositions.id, { onDelete: "cascade" })
    .notNull(),
  gradeCode: text("grade_code").notNull(), // B0, B1, B2, B3, B4, B5, UNDER
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(), // 40.00, 60.00, etc.
  sequence: integer("sequence").default(0), // display order
});

// =============================================
// FG PACK SPECS - Finished Goods Pack Specifications
// =============================================

// FG Pack Specifications - Official spec sheets for finished goods
export const fgPackSpecs = pgTable("fg_pack_specs", {
  id: serial("id").primaryKey(),
  specCode: text("spec_code").notNull().unique(), // SPEC-0001
  specName: text("spec_name").notNull(), // "แพ็ค 10 ฟอง เบอร์ L"
  packTypeId: integer("pack_type_id")
    .references(() => packTypes.id)
    .notNull(), // Reference to pack type
  compositionId: integer("composition_id").references(
    () => eggGradeCompositions.id,
  ), // Reference to grade composition
  minTotalWeightG: decimal("min_total_weight_g", { precision: 8, scale: 2 }), // minimum weight for pack
  allowBelowGradeEggs: integer("allow_below_grade_eggs").default(0), // tolerance for below-grade eggs
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// LEGACY: FG Pack Spec Grades - Kept for backward compatibility during migration
// Will be removed after full migration to eggGradeCompositions
export const fgPackSpecGrades = pgTable("fg_pack_spec_grades", {
  id: serial("id").primaryKey(),
  specId: integer("spec_id")
    .references(() => fgPackSpecs.id, { onDelete: "cascade" })
    .notNull(),
  gradeCode: text("grade_code").notNull(), // B0, B1, B2, B3, B4, B5, UNDER
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(), // 40.00, 60.00, etc.
  sequence: integer("sequence").default(0), // display order
});

// Partner-Product-Pack Specs - Many-to-many assignment
// Same product can have different specs for different business partners
export const partnerProductPackSpecs = pgTable("partner_product_pack_specs", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id")
    .references(() => businessPartners.id)
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  packSpecId: integer("pack_spec_id")
    .references(() => fgPackSpecs.id)
    .notNull(),
  isDefault: boolean("is_default").default(false), // Default spec for this partner-product combo
  effectiveFrom: date("effective_from"), // When this assignment becomes active
  effectiveTo: date("effective_to"), // When this assignment ends (null = indefinite)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for Egg Grade Compositions
export const eggGradeCompositionsRelations = relations(
  eggGradeCompositions,
  ({ many }) => ({
    items: many(eggGradeCompositionItems),
    fgPackSpecs: many(fgPackSpecs),
  }),
);

export const eggGradeCompositionItemsRelations = relations(
  eggGradeCompositionItems,
  ({ one }) => ({
    composition: one(eggGradeCompositions, {
      fields: [eggGradeCompositionItems.compositionId],
      references: [eggGradeCompositions.id],
    }),
  }),
);

// Relations for Pack Specs
export const fgPackSpecsRelations = relations(fgPackSpecs, ({ one, many }) => ({
  packType: one(packTypes, {
    fields: [fgPackSpecs.packTypeId],
    references: [packTypes.id],
  }),
  composition: one(eggGradeCompositions, {
    fields: [fgPackSpecs.compositionId],
    references: [eggGradeCompositions.id],
  }),
  grades: many(fgPackSpecGrades), // LEGACY - for backward compatibility
  partnerProductSpecs: many(partnerProductPackSpecs),
}));

export const fgPackSpecGradesRelations = relations(
  fgPackSpecGrades,
  ({ one }) => ({
    spec: one(fgPackSpecs, {
      fields: [fgPackSpecGrades.specId],
      references: [fgPackSpecs.id],
    }),
  }),
);

export const partnerProductPackSpecsRelations = relations(
  partnerProductPackSpecs,
  ({ one }) => ({
    partner: one(businessPartners, {
      fields: [partnerProductPackSpecs.partnerId],
      references: [businessPartners.id],
    }),
    product: one(products, {
      fields: [partnerProductPackSpecs.productId],
      references: [products.id],
    }),
    packSpec: one(fgPackSpecs, {
      fields: [partnerProductPackSpecs.packSpecId],
      references: [fgPackSpecs.id],
    }),
  }),
);

export const packTypesRelations = relations(packTypes, ({ many }) => ({
  fgPackSpecs: many(fgPackSpecs),
}));

// =============================================
// OPERATIONAL TABLES - Egg Receiving
// =============================================

// Egg Receiving Lots - Fixed 3000 eggs per lot (10 trays × 30 eggs)
export const eggReceivingLots = pgTable("egg_receiving_lots", {
  id: serial("id").primaryKey(),
  lotNumber: text("lot_number").notNull().unique(), // LOT-YYYY-NNNN format
  receiveDate: timestamp("receive_date").notNull().defaultNow(),

  // Supplier info
  supplierId: integer("supplier_id")
    .references(() => businessPartners.id)
    .notNull(),

  // Fixed quantity per lot
  totalEggs: integer("total_eggs").notNull().default(3000), // Always 3000 eggs
  totalTrays: integer("total_trays").notNull().default(10), // 10 trays × 30 eggs/tray

  // Status tracking
  status: text("status").notNull().default("received"), // received, grading, graded, consumed

  // Stock location
  locationId: integer("location_id").references(() => stockLocations.id),

  // Notes
  notes: text("notes"),

  // Audit
  receivedBy: text("received_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Egg Receiving Lot Relations
export const eggReceivingLotsRelations = relations(
  eggReceivingLots,
  ({ one }) => ({
    supplier: one(businessPartners, {
      fields: [eggReceivingLots.supplierId],
      references: [businessPartners.id],
    }),
    location: one(stockLocations, {
      fields: [eggReceivingLots.locationId],
      references: [stockLocations.id],
    }),
  }),
);

// Insert schemas for egg receiving
export const insertEggReceivingLotSchema = createInsertSchema(
  eggReceivingLots,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEggReceivingLot = z.infer<typeof insertEggReceivingLotSchema>;
export type EggReceivingLot = typeof eggReceivingLots.$inferSelect;

// =============================================
// END NEW ITEM MASTER SYSTEM
// =============================================

// Products (Selling products - packed eggs)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").unique(),
  name: text("name").notNull(),
  description: text("description"),
  partnerId: integer("partner_id").references(() => businessPartners.id), // Brand/Vendor partner
  sellingUnits: text("selling_units"), // ฟอง, ถาด, ตะกร้า, แพ็ค, มัด
  packingUnits: text("packing_units"), // แพ็ค 4, ถาด, ถาด/ครอบ, etc
  paletteUnits: text("palette_units"), // แพ็ค 4, ถาด, ถาด/ครอบ, etc
  eggsPerSellingUnit: integer("eggs_per_selling_unit").default(1),
  eggsPerPack: integer("eggs_per_pack").default(1),
  packsPerBasket: integer("packs_per_basket").default(1),
  basketsPerPalette: integer("baskets_per_palette").default(1),
  // eggSizeA: text("egg_size_a"), // Primary egg size: 0, 1, 2, 3, 4, 5, 6, or undergrade types
  // eggSizeB: text("egg_size_b"), // Secondary egg size for mixed products
  // percentageA: integer("percentage_a").default(100), // Percentage of size A (100% = single size)
  // eggsPerSellingUnitA: decimal("eggs_per_selling_unit_a", {
  //   precision: 10,
  //   scale: 2,
  // }),
  // eggsPerSellingUnitB: decimal("eggs_per_selling_unit_b", {
  //   precision: 10,
  //   scale: 2,
  // }),
  skuSizeCategory: text("sku_size_category"), // 0, 1, 2, 3, 4, 5, 6, 2-3 M, 3-4 S, etc
  crateSize: text("crate_size"), // no, S, M, A, CJ - Grey
  packBase: text("pack_base"), // packaging material code
  lidCover: text("lid_cover"), // lid material code
  barcodeLabel: text("barcode_label"),
  stickerLabel: text("sticker_label"),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  type: text("type"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Items - Updated version of Finished Goods (products)
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  sku: text("sku"),
  name: text("name").notNull(),
  description: text("description"),
  partnerId: integer("partner_id").references(() => businessPartners.id),
  itemNumber: varchar("item_number"),
  itemType: varchar("item_type"),
  itemRole: varchar("item_role"),
  sellingUnit: varchar("selling_unit"),
  baseUnit: varchar("base_unit"),
  packUnit: varchar("pack_unit"),
  paletteUnit: varchar("palette_unit"),
  basketUnit: varchar("basket_unit"),
  eggsPerBasket: integer("eggs_per_basket"),
  eggsPerPack: integer("eggs_per_pack"),
  eggsPerPalette: integer("eggs_per_palette"),
  barcodeLabel: varchar("barcode_label"),
  isActive: varchar("is_active").default("active"),
  isSellable: boolean("is_sellable").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Item ↔ Business Partners (Many-to-Many)
export const itemBusinessPartners = pgTable(
  "item_business_partners",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => businessPartners.id, { onDelete: "cascade" }),
    customerItemNumber: varchar("customer_item_number"),
    barcodeLabel: varchar("barcode_label"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("ibp_item_partner_unique").on(t.itemId, t.partnerId)],
);

// Product ↔ Business Partners (Many-to-Many)
export const productBusinessPartners = pgTable("product_business_partners", {
  id: serial("id").primaryKey(),

  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  businessPartnerId: integer("business_partner_id")
    .notNull()
    .references(() => businessPartners.id, { onDelete: "cascade" }),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
});

// Raw Materials (packaging, labels, raw eggs batches, etc)
export const rawMaterials = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  unit: text("unit").notNull(), // pcs, kg, pallets, boxes
  materialType: text("material_type").notNull(), // raw_egg, packaging, label, consumable
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).default("0"),
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).default(
    "0",
  ),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 4 }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product Recipes (BOM - Bill of Materials)
export const productRecipes = pgTable("product_recipes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  rawMaterialId: integer("raw_material_id")
    .references(() => rawMaterials.id)
    .notNull(),
  quantityRequired: decimal("quantity_required", {
    precision: 10,
    scale: 4,
  }).notNull(),
});

// Price Adjustments (Weekly price changes with approval workflow)
export const priceAdjustments = pgTable("price_adjustments", {
  id: serial("id").primaryKey(),
  adjustmentNumber: text("adjustment_number").unique(), // PA-0001
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  oldPrice: decimal("old_price", { precision: 10, scale: 2 }),
  newPrice: decimal("new_price", { precision: 10, scale: 2 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected
  requestedBy: text("requested_by"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Grading Lots (Raw egg batches received and graded - matches real data)
export const gradingLots = pgTable("grading_lots", {
  id: serial("id").primaryKey(),
  lotNumber: integer("lot_number").notNull().unique(), // 6266, 6267, etc
  billNumber: text("bill_number"), // 26/1286, etc
  receivingDate: date("receiving_date").notNull(),
  vehiclePlate: text("vehicle_plate"), // 80-9588
  driverName: text("driver_name"),
  weightKg: decimal("weight_kg", { precision: 10, scale: 2 }), // 21.28
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
  inputQuantity: integer("input_quantity").notNull(), // จำนวนเข้า 126,000
  gradedTotal: integer("graded_total").default(0), // Sum of graded output
  size0Jumbo: integer("size_0_jumbo").default(0), // JUMBO & No.0
  size1: integer("size_1").default(0),
  size2: integer("size_2").default(0),
  size3: integer("size_3").default(0),
  size4: integer("size_4").default(0),
  size5: integer("size_5").default(0),
  size6: integer("size_6").default(0),
  undergradeDirty: integer("undergrade_dirty").default(0), // เปื้อน
  undergradeThin: integer("undergrade_thin").default(0), // บาง
  undergradeDented: integer("undergrade_dented").default(0), // บุบ
  undergradeCracked: integer("undergrade_cracked").default(0), // แตก
  undergradeBag: integer("undergrade_bag").default(0), // ไข่ถุง
  lossUnrecoverable: integer("loss_unrecoverable").default(0), // เก็บไม่ได้
  qcColorValue: text("qc_color_value"), // AA, etc
  qcFreshness: text("qc_freshness"), // 2050:42:14
  status: text("status").default("received"), // received, grading, completed
  locationId: integer("location_id").references(() => stockLocations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Goods Receiving (Raw egg batches from suppliers)
export const goodsReceiving = pgTable("goods_receiving", {
  id: serial("id").primaryKey(),
  grNumber: text("gr_number").notNull().unique(), // GR-2024-0001
  supplierId: integer("supplier_id")
    .references(() => suppliers.id)
    .notNull(),
  receivingDate: date("receiving_date").defaultNow(),
  batchNumber: text("batch_number").notNull(), // For traceability
  totalQuantity: decimal("total_quantity", {
    precision: 10,
    scale: 2,
  }).notNull(),
  unit: text("unit").default("pcs"),
  locationId: integer("location_id").references(() => stockLocations.id),
  status: text("status").default("received"), // received, in_grading, completed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Grading Activities (Raw eggs sorted by size)
export const gradingActivities = pgTable("grading_activities", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // GA-0001
  goodsReceivingId: integer("goods_receiving_id")
    .references(() => goodsReceiving.id)
    .notNull(),
  gradingDate: date("grading_date").defaultNow(),
  eggSizeId: integer("egg_size_id")
    .references(() => eggSizes.id)
    .notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(), // eggs of this size
  batchNumber: text("batch_number"), // Inherits or creates new batch
  locationId: integer("location_id").references(() => stockLocations.id),
  status: text("status").default("graded"), // graded, in_stock, consumed
  createdAt: timestamp("created_at").defaultNow(),
});

// Sized Egg Stock (Current stock of graded eggs by size)
export const sizedEggStock = pgTable("sized_egg_stock", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // SES-0001
  eggSizeId: integer("egg_size_id")
    .references(() => eggSizes.id)
    .notNull(),
  batchNumber: text("batch_number").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  locationId: integer("location_id").references(() => stockLocations.id),
  gradingActivityId: integer("grading_activity_id").references(
    () => gradingActivities.id,
  ),
  receivedDate: date("received_date").defaultNow(),
  expiryDate: date("expiry_date"),
  status: text("status").default("available"), // available, reserved, consumed
  createdAt: timestamp("created_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").unique(),
  deliverySiteId: integer("delivery_site_id")
    .references(() => deliverySites.id)
    .notNull(), // Where to deliver
  partnerId: integer("partner_id")
    .references(() => businessPartners.id)
    .notNull(), // Who to bill
  orderDate: date("order_date").defaultNow(),
  deliveryDate: date("delivery_date"),
  deliveryTime: text("delivery_time"), // Preferred time slot
  status: text("status").default("pending"), // draft, confirmed, in_production, ready, shipped, delivered, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  logisticsStatus: text("logistics_status").default("pending"), // pending, scheduled, dispatched, delivered
  driverId: integer("driver_id").references(() => drivers.id),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  loadingZone: text("loading_zone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Items
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  itemId: integer("item_id")
    .references(() => items.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by"), // optional
  changedAt: timestamp("changed_at").defaultNow(),
});

// Production Requests (Generated from orders)
export const productionRequests = pgTable("production_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").unique(),
  orderId: integer("order_id").references(() => orders.id),
  requestDate: date("request_date").defaultNow(),
  requiredDate: date("required_date"),
  status: text("status").default("pending"), // pending, in_progress, completed, cancelled
  priority: text("priority").default("normal"), // low, normal, high, urgent
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Material Requirements (What's needed for production)
export const materialRequirements = pgTable("material_requirements", {
  id: serial("id").primaryKey(),
  productionRequestId: integer("production_request_id")
    .references(() => productionRequests.id)
    .notNull(),
  rawMaterialId: integer("raw_material_id")
    .references(() => rawMaterials.id)
    .notNull(),
  requiredQuantity: decimal("required_quantity", {
    precision: 10,
    scale: 2,
  }).notNull(),
  allocatedQuantity: decimal("allocated_quantity", {
    precision: 10,
    scale: 2,
  }).default("0"),
  consumedQuantity: decimal("consumed_quantity", {
    precision: 10,
    scale: 2,
  }).default("0"),
  status: text("status").default("pending"), // pending, allocated, partial, consumed
});

// Packing Activities
export const packingActivities = pgTable("packing_activities", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // PK-0001
  productionRequestId: integer("production_request_id")
    .references(() => productionRequests.id)
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  packingDate: date("packing_date").defaultNow(),
  plannedQuantity: integer("planned_quantity").notNull(),
  actualQuantity: integer("actual_quantity").default(0),
  status: text("status").default("pending"), // pending, in_progress, completed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Packing Material Usage (Track what stock was used in packing)
export const packingMaterialUsage = pgTable("packing_material_usage", {
  id: serial("id").primaryKey(),
  packingActivityId: integer("packing_activity_id")
    .references(() => packingActivities.id)
    .notNull(),
  sizedEggStockId: integer("sized_egg_stock_id").references(
    () => sizedEggStock.id,
  ),
  rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id),
  quantityUsed: decimal("quantity_used", { precision: 10, scale: 2 }).notNull(),
  substitutedFromSize: integer("substituted_from_size").references(
    () => eggSizes.id,
  ), // If smaller size was used as replacement
  createdAt: timestamp("created_at").defaultNow(),
});

// Finished Goods Stock
export const finishedGoodsStock = pgTable("finished_goods_stock", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // FG-0001
  productId: integer("product_id")
    .references(() => products.id)
    .notNull(),
  packingActivityId: integer("packing_activity_id").references(
    () => packingActivities.id,
  ),
  batchNumber: text("batch_number"),
  quantity: integer("quantity").notNull(),
  locationId: integer("location_id").references(() => stockLocations.id),
  productionDate: date("production_date").defaultNow(),
  expiryDate: date("expiry_date"),
  status: text("status").default("available"), // available, reserved, shipped
  createdAt: timestamp("created_at").defaultNow(),
});

// Delivery Schedules (Daily logistics planning)
export const deliverySchedules = pgTable("delivery_schedules", {
  id: serial("id").primaryKey(),
  scheduleNumber: text("schedule_number").unique(), // SCH-2024-0001
  scheduleDate: date("schedule_date").notNull(),
  driverId: integer("driver_id")
    .references(() => drivers.id)
    .notNull(),
  vehicleId: integer("vehicle_id")
    .references(() => vehicles.id)
    .notNull(),
  loadingZone: text("loading_zone"),
  departureTime: time("departure_time"),
  status: text("status").default("planned"), // planned, loading, departed, completed
  totalOrders: integer("total_orders").default(0),
  totalEggs: decimal("total_eggs", { precision: 10, scale: 2 }),
  estimatedDistance: decimal("estimated_distance", { precision: 10, scale: 2 }),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Delivery Schedule Items (Orders assigned to a schedule)
export const deliveryScheduleItems = pgTable("delivery_schedule_items", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id")
    .references(() => deliverySchedules.id)
    .notNull(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  sequenceOrder: integer("sequence_order").default(0), // Delivery sequence
  estimatedArrival: time("estimated_arrival"),
  actualArrival: time("actual_arrival"),
  status: text("status").default("pending"), // pending, delivered, failed
  notes: text("notes"),
});

// Stock Movements (For FIFO tracking)
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // SM-0001
  movementType: text("movement_type").notNull(), // receiving, grading, packing, shipping, adjustment
  movementDate: timestamp("movement_date").defaultNow(),
  rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id),
  sizedEggStockId: integer("sized_egg_stock_id").references(
    () => sizedEggStock.id,
  ),
  finishedGoodsId: integer("finished_goods_id").references(
    () => finishedGoodsStock.id,
  ),
  fromLocationId: integer("from_location_id").references(
    () => stockLocations.id,
  ),
  toLocationId: integer("to_location_id").references(() => stockLocations.id),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  batchNumber: text("batch_number"),
  referenceType: text("reference_type"), // order, production, gr, adjustment
  referenceId: integer("reference_id"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  rawMaterials: many(rawMaterials),
  goodsReceiving: many(goodsReceiving),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  orders: many(orders),
  deliverySchedules: many(deliverySchedules),
}));

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  orders: many(orders),
  deliverySchedules: many(deliverySchedules),
}));

export const itemBusinessPartnersRelations = relations(
  itemBusinessPartners,
  ({ one }) => ({
    item: one(items, {
      fields: [itemBusinessPartners.itemId],
      references: [items.id],
    }),
    partner: one(businessPartners, {
      fields: [itemBusinessPartners.partnerId],
      references: [businessPartners.id],
    }),
  }),
);

export const businessPartnersRelations = relations(
  businessPartners,
  ({ many }) => ({
    deliverySites: many(deliverySites),
    contacts: many(partnerContacts),
    orders: many(orders),
    products: many(products),
    itemPartners: many(itemBusinessPartners),
  }),
);

export const deliverySitesRelations = relations(
  deliverySites,
  ({ one, many }) => ({
    partner: one(businessPartners, {
      fields: [deliverySites.partnerId],
      references: [businessPartners.id],
    }),
    contacts: many(partnerContacts),
    orders: many(orders),
  }),
);

export const partnerContactsRelations = relations(
  partnerContacts,
  ({ one }) => ({
    partner: one(businessPartners, {
      fields: [partnerContacts.partnerId],
      references: [businessPartners.id],
    }),
    deliverySite: one(deliverySites, {
      fields: [partnerContacts.deliverySiteId],
      references: [deliverySites.id],
    }),
  }),
);

export const stockLocationsRelations = relations(
  stockLocations,
  ({ many }) => ({
    goodsReceiving: many(goodsReceiving),
    gradingLots: many(gradingLots),
    gradingActivities: many(gradingActivities),
    sizedEggStock: many(sizedEggStock),
    finishedGoods: many(finishedGoodsStock),
  }),
);

export const eggSizesRelations = relations(eggSizes, ({ many }) => ({
  gradingActivities: many(gradingActivities),
  sizedEggStock: many(sizedEggStock),
}));

// New Item Master System Relations
export const itemMasterRelations = relations(itemMaster, ({ one }) => ({
  partner: one(businessPartners, {
    fields: [itemMaster.partnerId],
    references: [businessPartners.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  partner: one(businessPartners, {
    fields: [products.partnerId],
    references: [businessPartners.id],
  }),
  priceAdjustments: many(priceAdjustments),
  recipes: many(productRecipes),
  orderItems: many(orderItems),
  packingActivities: many(packingActivities),
  finishedGoods: many(finishedGoodsStock),
}));

export const gradingLotsRelations = relations(gradingLots, ({ one }) => ({
  location: one(stockLocations, {
    fields: [gradingLots.locationId],
    references: [stockLocations.id],
  }),
}));

export const rawMaterialsRelations = relations(
  rawMaterials,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [rawMaterials.supplierId],
      references: [suppliers.id],
    }),
    usedInRecipes: many(productRecipes),
    requirements: many(materialRequirements),
  }),
);

export const productRecipesRelations = relations(productRecipes, ({ one }) => ({
  product: one(products, {
    fields: [productRecipes.productId],
    references: [products.id],
  }),
  rawMaterial: one(rawMaterials, {
    fields: [productRecipes.rawMaterialId],
    references: [rawMaterials.id],
  }),
}));

export const priceAdjustmentsRelations = relations(
  priceAdjustments,
  ({ one }) => ({
    product: one(products, {
      fields: [priceAdjustments.productId],
      references: [products.id],
    }),
  }),
);

export const goodsReceivingRelations = relations(
  goodsReceiving,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [goodsReceiving.supplierId],
      references: [suppliers.id],
    }),
    location: one(stockLocations, {
      fields: [goodsReceiving.locationId],
      references: [stockLocations.id],
    }),
    gradingActivities: many(gradingActivities),
  }),
);

export const gradingActivitiesRelations = relations(
  gradingActivities,
  ({ one, many }) => ({
    goodsReceiving: one(goodsReceiving, {
      fields: [gradingActivities.goodsReceivingId],
      references: [goodsReceiving.id],
    }),
    eggSize: one(eggSizes, {
      fields: [gradingActivities.eggSizeId],
      references: [eggSizes.id],
    }),
    location: one(stockLocations, {
      fields: [gradingActivities.locationId],
      references: [stockLocations.id],
    }),
    sizedEggStock: many(sizedEggStock),
  }),
);

export const sizedEggStockRelations = relations(sizedEggStock, ({ one }) => ({
  eggSize: one(eggSizes, {
    fields: [sizedEggStock.eggSizeId],
    references: [eggSizes.id],
  }),
  location: one(stockLocations, {
    fields: [sizedEggStock.locationId],
    references: [stockLocations.id],
  }),
  gradingActivity: one(gradingActivities, {
    fields: [sizedEggStock.gradingActivityId],
    references: [gradingActivities.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  deliverySite: one(deliverySites, {
    fields: [orders.deliverySiteId],
    references: [deliverySites.id],
  }),
  partner: one(businessPartners, {
    fields: [orders.partnerId],
    references: [businessPartners.id],
  }),
  driver: one(drivers, {
    fields: [orders.driverId],
    references: [drivers.id],
  }),
  vehicle: one(vehicles, {
    fields: [orders.vehicleId],
    references: [vehicles.id],
  }),
  items: many(orderItems),
  productionRequests: many(productionRequests),
  deliveryScheduleItems: many(deliveryScheduleItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  item: one(items, {
    fields: [orderItems.itemId],
    references: [items.id],
  }),
}));

export const productionRequestsRelations = relations(
  productionRequests,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [productionRequests.orderId],
      references: [orders.id],
    }),
    materialRequirements: many(materialRequirements),
    packingActivities: many(packingActivities),
  }),
);

export const materialRequirementsRelations = relations(
  materialRequirements,
  ({ one }) => ({
    productionRequest: one(productionRequests, {
      fields: [materialRequirements.productionRequestId],
      references: [productionRequests.id],
    }),
    rawMaterial: one(rawMaterials, {
      fields: [materialRequirements.rawMaterialId],
      references: [rawMaterials.id],
    }),
  }),
);

export const packingActivitiesRelations = relations(
  packingActivities,
  ({ one, many }) => ({
    productionRequest: one(productionRequests, {
      fields: [packingActivities.productionRequestId],
      references: [productionRequests.id],
    }),
    product: one(products, {
      fields: [packingActivities.productId],
      references: [products.id],
    }),
    materialUsage: many(packingMaterialUsage),
    finishedGoods: many(finishedGoodsStock),
  }),
);

export const packingMaterialUsageRelations = relations(
  packingMaterialUsage,
  ({ one }) => ({
    packingActivity: one(packingActivities, {
      fields: [packingMaterialUsage.packingActivityId],
      references: [packingActivities.id],
    }),
    sizedEggStock: one(sizedEggStock, {
      fields: [packingMaterialUsage.sizedEggStockId],
      references: [sizedEggStock.id],
    }),
    rawMaterial: one(rawMaterials, {
      fields: [packingMaterialUsage.rawMaterialId],
      references: [rawMaterials.id],
    }),
    substitutedSize: one(eggSizes, {
      fields: [packingMaterialUsage.substitutedFromSize],
      references: [eggSizes.id],
    }),
  }),
);

export const finishedGoodsStockRelations = relations(
  finishedGoodsStock,
  ({ one }) => ({
    product: one(products, {
      fields: [finishedGoodsStock.productId],
      references: [products.id],
    }),
    packingActivity: one(packingActivities, {
      fields: [finishedGoodsStock.packingActivityId],
      references: [packingActivities.id],
    }),
    location: one(stockLocations, {
      fields: [finishedGoodsStock.locationId],
      references: [stockLocations.id],
    }),
  }),
);

export const deliverySchedulesRelations = relations(
  deliverySchedules,
  ({ one, many }) => ({
    driver: one(drivers, {
      fields: [deliverySchedules.driverId],
      references: [drivers.id],
    }),
    vehicle: one(vehicles, {
      fields: [deliverySchedules.vehicleId],
      references: [vehicles.id],
    }),
    items: many(deliveryScheduleItems),
  }),
);

export const deliveryScheduleItemsRelations = relations(
  deliveryScheduleItems,
  ({ one }) => ({
    schedule: one(deliverySchedules, {
      fields: [deliveryScheduleItems.scheduleId],
      references: [deliverySchedules.id],
    }),
    order: one(orders, {
      fields: [deliveryScheduleItems.orderId],
      references: [orders.id],
    }),
  }),
);

// === INSERT SCHEMAS ===

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});
export const updateSupplierSchema = insertSupplierSchema.extend({
  id: z.number(),
});
export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true,
});
export const updateDriverSchema = insertDriverSchema.extend({
  id: z.number(),
});
export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
});
export const updateVehicleSchema = insertVehicleSchema.extend({
  id: z.number(),
});
export const insertBusinessPartnerSchema = createInsertSchema(
  businessPartners,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeliverySiteSchema = createInsertSchema(deliverySites).omit({
  id: true,
  createdAt: true,
});
export const insertPartnerContactSchema = createInsertSchema(
  partnerContacts,
).omit({ id: true, createdAt: true });
export const insertStockLocationSchema = createInsertSchema(
  stockLocations,
).omit({ id: true, createdAt: true });
export const insertEggSizeSchema = createInsertSchema(eggSizes).omit({
  id: true,
  createdAt: true,
});
export const insertEggGradeRuleSchema = createInsertSchema(eggGradeRules).omit({
  id: true,
});
export const insertPackTypeSchema = createInsertSchema(packTypes).omit({
  id: true,
});
export const insertEggGradeCompositionSchema = createInsertSchema(
  eggGradeCompositions,
).omit({ id: true, createdAt: true });
export const insertEggGradeCompositionItemSchema = createInsertSchema(
  eggGradeCompositionItems,
).omit({ id: true });
export const insertFgPackSpecSchema = createInsertSchema(fgPackSpecs).omit({
  id: true,
  createdAt: true,
});
export const insertFgPackSpecGradeSchema = createInsertSchema(
  fgPackSpecGrades,
).omit({ id: true }); // LEGACY
export const insertPartnerProductPackSpecSchema = createInsertSchema(
  partnerProductPackSpecs,
).omit({ id: true, createdAt: true });
export const insertItemMasterSchema = createInsertSchema(itemMaster).omit({
  id: true,
  createdAt: true,
});
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export const insertGradingLotSchema = createInsertSchema(gradingLots).omit({
  id: true,
  createdAt: true,
});
export const insertRawMaterialSchema = createInsertSchema(rawMaterials).omit({
  id: true,
  createdAt: true,
});
export const insertProductRecipeSchema = createInsertSchema(
  productRecipes,
).omit({ id: true });
export const insertPriceAdjustmentSchema = createInsertSchema(
  priceAdjustments,
).omit({ id: true, createdAt: true });
export const insertGoodsReceivingSchema = createInsertSchema(
  goodsReceiving,
).omit({ id: true, createdAt: true });
export const insertGradingActivitySchema = createInsertSchema(
  gradingActivities,
).omit({ id: true, createdAt: true });
export const insertSizedEggStockSchema = createInsertSchema(sizedEggStock).omit(
  { id: true, createdAt: true },
);
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});
export const insertProductionRequestSchema = createInsertSchema(
  productionRequests,
).omit({ id: true, createdAt: true });
export const insertMaterialRequirementSchema = createInsertSchema(
  materialRequirements,
).omit({ id: true });
export const insertPackingActivitySchema = createInsertSchema(
  packingActivities,
).omit({ id: true, createdAt: true });
export const insertPackingMaterialUsageSchema = createInsertSchema(
  packingMaterialUsage,
).omit({ id: true, createdAt: true });
export const insertFinishedGoodsStockSchema = createInsertSchema(
  finishedGoodsStock,
).omit({ id: true, createdAt: true });
export const insertDeliveryScheduleSchema = createInsertSchema(
  deliverySchedules,
).omit({ id: true, createdAt: true });
export const insertDeliveryScheduleItemSchema = createInsertSchema(
  deliveryScheduleItems,
).omit({ id: true });
export const insertStockMovementSchema = createInsertSchema(
  stockMovements,
).omit({ id: true, createdAt: true });

// === TYPES ===

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type BusinessPartner = typeof businessPartners.$inferSelect;
export type InsertBusinessPartner = z.infer<typeof insertBusinessPartnerSchema>;

export type DeliverySite = typeof deliverySites.$inferSelect;
export type InsertDeliverySite = z.infer<typeof insertDeliverySiteSchema>;

export type PartnerContact = typeof partnerContacts.$inferSelect;
export type InsertPartnerContact = z.infer<typeof insertPartnerContactSchema>;

export type StockLocation = typeof stockLocations.$inferSelect;
export type InsertStockLocation = z.infer<typeof insertStockLocationSchema>;

export type EggSize = typeof eggSizes.$inferSelect;
export type InsertEggSize = z.infer<typeof insertEggSizeSchema>;

export type EggGradeRule = typeof eggGradeRules.$inferSelect;
export type InsertEggGradeRule = z.infer<typeof insertEggGradeRuleSchema>;

export type PackType = typeof packTypes.$inferSelect;
export type InsertPackType = z.infer<typeof insertPackTypeSchema>;

export type EggGradeComposition = typeof eggGradeCompositions.$inferSelect;
export type InsertEggGradeComposition = z.infer<
  typeof insertEggGradeCompositionSchema
>;

export type EggGradeCompositionItem =
  typeof eggGradeCompositionItems.$inferSelect;
export type InsertEggGradeCompositionItem = z.infer<
  typeof insertEggGradeCompositionItemSchema
>;

export type FgPackSpec = typeof fgPackSpecs.$inferSelect;
export type InsertFgPackSpec = z.infer<typeof insertFgPackSpecSchema>;

export type FgPackSpecGrade = typeof fgPackSpecGrades.$inferSelect; // LEGACY
export type InsertFgPackSpecGrade = z.infer<typeof insertFgPackSpecGradeSchema>; // LEGACY

export type PartnerProductPackSpec =
  typeof partnerProductPackSpecs.$inferSelect;
export type InsertPartnerProductPackSpec = z.infer<
  typeof insertPartnerProductPackSpecSchema
>;

export type ItemMaster = typeof itemMaster.$inferSelect;
export type InsertItemMaster = z.infer<typeof insertItemMasterSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type GradingLot = typeof gradingLots.$inferSelect;
export type InsertGradingLot = z.infer<typeof insertGradingLotSchema>;

export type RawMaterial = typeof rawMaterials.$inferSelect;
export type InsertRawMaterial = z.infer<typeof insertRawMaterialSchema>;

export type ProductRecipe = typeof productRecipes.$inferSelect;
export type InsertProductRecipe = z.infer<typeof insertProductRecipeSchema>;

export type PriceAdjustment = typeof priceAdjustments.$inferSelect;
export type InsertPriceAdjustment = z.infer<typeof insertPriceAdjustmentSchema>;

export type GoodsReceiving = typeof goodsReceiving.$inferSelect;
export type InsertGoodsReceiving = z.infer<typeof insertGoodsReceivingSchema>;

export type GradingActivity = typeof gradingActivities.$inferSelect;
export type InsertGradingActivity = z.infer<typeof insertGradingActivitySchema>;

export type SizedEggStock = typeof sizedEggStock.$inferSelect;
export type InsertSizedEggStock = z.infer<typeof insertSizedEggStockSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type ProductionRequest = typeof productionRequests.$inferSelect;
export type InsertProductionRequest = z.infer<
  typeof insertProductionRequestSchema
>;

export type MaterialRequirement = typeof materialRequirements.$inferSelect;
export type InsertMaterialRequirement = z.infer<
  typeof insertMaterialRequirementSchema
>;

export type PackingActivity = typeof packingActivities.$inferSelect;
export type InsertPackingActivity = z.infer<typeof insertPackingActivitySchema>;

export type PackingMaterialUsage = typeof packingMaterialUsage.$inferSelect;
export type InsertPackingMaterialUsage = z.infer<
  typeof insertPackingMaterialUsageSchema
>;

export type FinishedGoodsStock = typeof finishedGoodsStock.$inferSelect;
export type InsertFinishedGoodsStock = z.infer<
  typeof insertFinishedGoodsStockSchema
>;

export type DeliverySchedule = typeof deliverySchedules.$inferSelect;
export type InsertDeliverySchedule = z.infer<
  typeof insertDeliveryScheduleSchema
>;

export type DeliveryScheduleItem = typeof deliveryScheduleItems.$inferSelect;
export type InsertDeliveryScheduleItem = z.infer<
  typeof insertDeliveryScheduleItemSchema
>;

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;

export const itemsRelations = relations(items, ({ one, many }) => ({
  partner: one(businessPartners, {
    fields: [items.partnerId],
    references: [businessPartners.id],
  }),
  partners: many(itemBusinessPartners),
}));

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
});
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

// === BACKWARD COMPATIBILITY ALIASES ===
// These aliases allow existing code to work while transitioning to new names
export type CustomerAccount = BusinessPartner;
export type InsertCustomerAccount = InsertBusinessPartner;
export type CustomerContact = PartnerContact;
export type InsertCustomerContact = InsertPartnerContact;
export type Vendor = BusinessPartner;
export type InsertVendor = InsertBusinessPartner;
export const insertCustomerAccountSchema = insertBusinessPartnerSchema;
export const insertCustomerContactSchema = insertPartnerContactSchema;
export const insertVendorSchema = insertBusinessPartnerSchema;
