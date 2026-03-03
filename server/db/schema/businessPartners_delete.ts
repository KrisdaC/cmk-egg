import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const businessPartners = pgTable("business_partners", {
  id: serial("id").primaryKey(),

  code: varchar("code", { length: 50 }).notNull(),
  nickname: varchar("nickname", { length: 100 }),

  partnerType: varchar("partner_type", { length: 50 }),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  businessType: varchar("business_type", { length: 50 }),
  customerType: varchar("customer_type", { length: 50 }),

  branchCode: varchar("branch_code", { length: 50 }),
  branchName: varchar("branch_name", { length: 255 }),

  taxId: varchar("tax_id", { length: 50 }),

  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  district: varchar("district", { length: 100 }),
  subDistrict: varchar("sub_district", { length: 100 }),
  province: varchar("province", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }),

  creditDays: integer("credit_days"),
  paymentTerms: varchar("payment_terms", { length: 50 }),
  customerTier: varchar("customer_tier", { length: 50 }),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
