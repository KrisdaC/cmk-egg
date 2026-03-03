import {
  pgTable,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { products } from "./products";
import { businessPartners } from "@shared/schema";

export const productBusinessPartners = pgTable(
  "product_business_partners",
  {
    id: serial("id").primaryKey(),

    productId: integer("product_id")
      .notNull()
      .references(() => products.id, {
        onDelete: "cascade",
      }),

    businessPartnerId: integer("business_partner_id")
      .notNull()
      .references(() => businessPartners.id, {
        onDelete: "cascade",
      }),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Prevent duplicate product ↔ partner pairs
    productPartnerUnique: uniqueIndex("uq_product_business_partner").on(
      table.productId,
      table.businessPartnerId,
    ),
  }),
);
