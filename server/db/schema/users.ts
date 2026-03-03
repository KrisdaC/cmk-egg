import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull(),

  first_name: text("first_name"),
  last_name: text("last_name"),
  profile_image_url: text("profile_image_url"),

  password_hash: text("password_hash"),

  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});
