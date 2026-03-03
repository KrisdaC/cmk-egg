CREATE TABLE "business_partners" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL CONSTRAINT "business_partners_code_key" UNIQUE,
	"nickname" text NOT NULL,
	"partner_type" text DEFAULT 'customer' NOT NULL,
	"business_name" text,
	"business_type" text,
	"customer_type" text,
	"branch_code" text,
	"branch_name" text,
	"tax_id" text,
	"address_line_1" text,
	"address_line_2" text,
	"district" text,
	"sub_district" text,
	"province" text,
	"postal_code" text,
	"country" text DEFAULT 'Thailand',
	"credit_days" integer DEFAULT 0,
	"payment_terms" text,
	"customer_tier" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "delivery_schedule_items" (
	"id" serial PRIMARY KEY,
	"schedule_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"sequence_order" integer DEFAULT 0,
	"estimated_arrival" time,
	"actual_arrival" time,
	"status" text DEFAULT 'pending',
	"notes" text
);
CREATE TABLE "delivery_schedules" (
	"id" serial PRIMARY KEY,
	"schedule_date" date NOT NULL,
	"driver_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"loading_zone" text,
	"departure_time" time,
	"status" text DEFAULT 'planned',
	"total_orders" integer DEFAULT 0,
	"total_eggs" numeric(10, 2),
	"estimated_distance" numeric(10, 2),
	"estimated_cost" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"schedule_number" text CONSTRAINT "delivery_schedules_schedule_number_key" UNIQUE
);
CREATE TABLE "delivery_sites" (
	"id" serial PRIMARY KEY,
	"partner_id" integer NOT NULL,
	"site_code" text NOT NULL CONSTRAINT "delivery_sites_site_code_key" UNIQUE,
	"display_name" text NOT NULL,
	"partner_branch_code" text,
	"branch_name" text,
	"delivery_type" text DEFAULT 'direct_to_store' NOT NULL,
	"address_line_1" text,
	"address_line_2" text,
	"district" text,
	"sub_district" text,
	"province" text,
	"postal_code" text,
	"country" text DEFAULT 'Thailand',
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"google_maps_url" text,
	"delivery_zone" text,
	"delivery_region" text,
	"preferred_time_slot" text,
	"access_instructions" text,
	"acceptable_vehicles" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"license_number" text,
	"phone" text,
	"email" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "drivers_code_key" UNIQUE
);
CREATE TABLE "egg_grade_compositions" (
	"id" serial PRIMARY KEY,
	"composition_code" text NOT NULL CONSTRAINT "egg_grade_compositions_composition_code_key" UNIQUE,
	"composition_name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "egg_grade_rules" (
	"id" serial PRIMARY KEY,
	"grade_code" text NOT NULL CONSTRAINT "egg_grade_rules_grade_code_key" UNIQUE,
	"grade_name" text NOT NULL,
	"min_weight_g" numeric(6, 3),
	"max_weight_g" numeric(6, 3),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
CREATE TABLE "egg_receiving_lots" (
	"id" serial PRIMARY KEY,
	"lot_number" text NOT NULL CONSTRAINT "egg_receiving_lots_lot_number_key" UNIQUE,
	"receive_date" timestamp DEFAULT now() NOT NULL,
	"supplier_id" integer NOT NULL,
	"total_eggs" integer DEFAULT 3000 NOT NULL,
	"total_trays" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"location_id" integer,
	"notes" text,
	"received_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "egg_sizes" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"code" text NOT NULL CONSTRAINT "egg_sizes_code_unique" UNIQUE,
	"min_weight" numeric(5, 2),
	"max_weight" numeric(5, 2),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "fb_egg_sizes_spec" (
	"id" serial PRIMARY KEY,
	"composition_id" integer NOT NULL,
	"grade_code" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"sequence" integer DEFAULT 0
);
CREATE TABLE "fg_pack_spec_grades" (
	"id" serial PRIMARY KEY,
	"spec_id" integer NOT NULL,
	"grade_code" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"sequence" integer DEFAULT 0
);
CREATE TABLE "fg_pack_specs" (
	"id" serial PRIMARY KEY,
	"spec_code" text NOT NULL CONSTRAINT "fg_pack_specs_spec_code_key" UNIQUE,
	"spec_name" text NOT NULL,
	"pack_type_id" integer NOT NULL,
	"min_total_weight_g" numeric(8, 2),
	"allow_below_grade_eggs" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"composition_id" integer
);
CREATE TABLE "fg_pack_type" (
	"id" serial,
	"code" text NOT NULL CONSTRAINT "pack_types_code_key" UNIQUE,
	"name" text NOT NULL,
	"thai_name" text NOT NULL,
	"eggs_per_pack" integer NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "pack_types_pkey" PRIMARY KEY("id")
);
CREATE TABLE "finished_goods_stock" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"packing_activity_id" integer,
	"batch_number" text,
	"quantity" integer NOT NULL,
	"location_id" integer,
	"production_date" date DEFAULT now(),
	"expiry_date" date,
	"status" text DEFAULT 'available',
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "finished_goods_stock_code_key" UNIQUE
);
CREATE TABLE "finished_pack_spec_grades" (
	"id" serial PRIMARY KEY,
	"spec_id" integer NOT NULL,
	"grade_code" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"sequence" integer DEFAULT 0
);
CREATE TABLE "finished_pack_specs" (
	"id" serial PRIMARY KEY,
	"spec_code" text NOT NULL CONSTRAINT "finished_pack_specs_spec_code_key" UNIQUE,
	"spec_name" text NOT NULL,
	"pack_eggs" integer NOT NULL,
	"min_total_weight_g" numeric(8, 2),
	"allow_below_grade_eggs" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "goods_receiving" (
	"id" serial PRIMARY KEY,
	"gr_number" text NOT NULL CONSTRAINT "goods_receiving_gr_number_unique" UNIQUE,
	"supplier_id" integer NOT NULL,
	"receiving_date" date DEFAULT now(),
	"batch_number" text NOT NULL,
	"total_quantity" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'pcs',
	"location_id" integer,
	"status" text DEFAULT 'received',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "grading_activities" (
	"id" serial PRIMARY KEY,
	"goods_receiving_id" integer NOT NULL,
	"grading_date" date DEFAULT now(),
	"egg_size_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"batch_number" text,
	"location_id" integer,
	"status" text DEFAULT 'graded',
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "grading_activities_code_key" UNIQUE
);
CREATE TABLE "grading_lots" (
	"id" serial PRIMARY KEY,
	"lot_number" integer NOT NULL CONSTRAINT "grading_lots_lot_number_key" UNIQUE,
	"bill_number" text,
	"receiving_date" date NOT NULL,
	"vehicle_plate" text,
	"driver_name" text,
	"weight_kg" numeric(10, 2),
	"purchase_price" numeric(12, 2),
	"input_quantity" integer NOT NULL,
	"graded_total" integer DEFAULT 0,
	"size_0_jumbo" integer DEFAULT 0,
	"size_1" integer DEFAULT 0,
	"size_2" integer DEFAULT 0,
	"size_3" integer DEFAULT 0,
	"size_4" integer DEFAULT 0,
	"size_5" integer DEFAULT 0,
	"size_6" integer DEFAULT 0,
	"undergrade_dirty" integer DEFAULT 0,
	"undergrade_thin" integer DEFAULT 0,
	"undergrade_dented" integer DEFAULT 0,
	"undergrade_cracked" integer DEFAULT 0,
	"undergrade_bag" integer DEFAULT 0,
	"loss_unrecoverable" integer DEFAULT 0,
	"qc_color_value" text,
	"qc_freshness" text,
	"status" text DEFAULT 'received',
	"location_id" integer,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "item_master" (
	"id" serial PRIMARY KEY,
	"item_code" text NOT NULL CONSTRAINT "item_master_item_code_key" UNIQUE,
	"item_name" text NOT NULL,
	"item_category" text NOT NULL,
	"egg_type" text,
	"grade_code" text,
	"base_uom" text NOT NULL,
	"lot_tracked" boolean DEFAULT true,
	"is_sellable" boolean DEFAULT false,
	"partner_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"allowed_grades" text[],
	"pack_eggs" integer,
	"min_total_weight_g" numeric(8, 2),
	"allow_below_grade_eggs" integer DEFAULT 0
);
CREATE TABLE "material_requirements" (
	"id" serial PRIMARY KEY,
	"production_request_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"required_quantity" numeric(10, 2) NOT NULL,
	"allocated_quantity" numeric(10, 2) DEFAULT '0',
	"consumed_quantity" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'pending'
);
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL
);
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"order_number" text CONSTRAINT "orders_order_number_key" UNIQUE,
	"delivery_site_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"order_date" date DEFAULT CURRENT_DATE,
	"delivery_date" date,
	"delivery_time" text,
	"status" text DEFAULT 'draft',
	"total_amount" numeric(10, 2),
	"logistics_status" text DEFAULT 'pending',
	"driver_id" integer,
	"vehicle_id" integer,
	"loading_zone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "packing_activities" (
	"id" serial PRIMARY KEY,
	"production_request_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"packing_date" date DEFAULT now(),
	"planned_quantity" integer NOT NULL,
	"actual_quantity" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "packing_activities_code_key" UNIQUE
);
CREATE TABLE "packing_material_usage" (
	"id" serial PRIMARY KEY,
	"packing_activity_id" integer NOT NULL,
	"sized_egg_stock_id" integer,
	"raw_material_id" integer,
	"quantity_used" numeric(10, 2) NOT NULL,
	"substituted_from_size" integer,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "partner_contacts" (
	"id" serial PRIMARY KEY,
	"partner_id" integer NOT NULL,
	"delivery_site_id" integer,
	"full_name" text NOT NULL,
	"role" text,
	"department" text,
	"phone" text,
	"mobile" text,
	"email" text,
	"line_id" text,
	"fax" text,
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "partner_contacts_code_key" UNIQUE
);
CREATE TABLE "partner_product_pack_specs" (
	"id" serial PRIMARY KEY,
	"partner_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"pack_spec_id" integer NOT NULL,
	"is_default" boolean DEFAULT false,
	"effective_from" date,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "price_adjustments" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"status" text DEFAULT 'pending',
	"requested_by" text,
	"approved_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"adjustment_number" text CONSTRAINT "price_adjustments_adjustment_number_key" UNIQUE
);
CREATE TABLE "product_recipes" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"quantity_required" numeric(10, 4) NOT NULL
);
CREATE TABLE "production_requests" (
	"id" serial PRIMARY KEY,
	"request_number" text CONSTRAINT "production_requests_request_number_unique" UNIQUE,
	"order_id" integer,
	"request_date" date DEFAULT now(),
	"required_date" date,
	"status" text DEFAULT 'pending',
	"priority" text DEFAULT 'normal',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"sku" text CONSTRAINT "products_sku_key" UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"partner_id" integer,
	"selling_units" text,
	"packing_units" text,
	"packs_per_selling_unit" numeric(10, 3) DEFAULT '1',
	"eggs_per_pack" integer DEFAULT 30,
	"eggs_per_selling_unit" integer DEFAULT 30,
	"egg_size_a" text,
	"egg_size_b" text,
	"percentage_a" integer DEFAULT 100,
	"eggs_per_selling_unit_a" numeric(10, 2),
	"eggs_per_selling_unit_b" numeric(10, 2),
	"sku_size_category" text,
	"crate_size" text,
	"pack_base" text,
	"lid_cover" text,
	"barcode_label" text,
	"sticker_label" text,
	"current_price" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"is_undergrade" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "raw_materials" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"sku" text CONSTRAINT "raw_materials_sku_unique" UNIQUE,
	"unit" text NOT NULL,
	"material_type" text NOT NULL,
	"min_stock" numeric(10, 2) DEFAULT '0',
	"current_stock" numeric(10, 2) DEFAULT '0',
	"cost_per_unit" numeric(10, 4),
	"supplier_id" integer,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
CREATE TABLE "sized_egg_stock" (
	"id" serial PRIMARY KEY,
	"egg_size_id" integer NOT NULL,
	"batch_number" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"location_id" integer,
	"grading_activity_id" integer,
	"received_date" date DEFAULT now(),
	"expiry_date" date,
	"status" text DEFAULT 'available',
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "sized_egg_stock_code_key" UNIQUE
);
CREATE TABLE "stock_locations" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"location_type" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "stock_locations_code_key" UNIQUE
);
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY,
	"movement_type" text NOT NULL,
	"movement_date" timestamp DEFAULT now(),
	"raw_material_id" integer,
	"sized_egg_stock_id" integer,
	"finished_goods_id" integer,
	"from_location_id" integer,
	"to_location_id" integer,
	"quantity" numeric(10, 2) NOT NULL,
	"batch_number" text,
	"reference_type" text,
	"reference_id" integer,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "stock_movements_code_key" UNIQUE
);
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"supplier_type" text DEFAULT 'eggs',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "suppliers_code_key" UNIQUE
);
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar CONSTRAINT "users_email_unique" UNIQUE,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY,
	"plate_number" text NOT NULL CONSTRAINT "vehicles_plate_number_unique" UNIQUE,
	"vehicle_type" text NOT NULL,
	"capacity" numeric(10, 2),
	"cost_per_km" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"code" text CONSTRAINT "vehicles_code_key" UNIQUE
);
ALTER TABLE "delivery_schedule_items" ADD CONSTRAINT "delivery_schedule_items_schedule_id_delivery_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "delivery_schedules"("id");
ALTER TABLE "delivery_schedules" ADD CONSTRAINT "delivery_schedules_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");
ALTER TABLE "delivery_schedules" ADD CONSTRAINT "delivery_schedules_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");
ALTER TABLE "delivery_sites" ADD CONSTRAINT "delivery_sites_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id");
ALTER TABLE "egg_receiving_lots" ADD CONSTRAINT "egg_receiving_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "egg_receiving_lots" ADD CONSTRAINT "egg_receiving_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "business_partners"("id");
ALTER TABLE "fb_egg_sizes_spec" ADD CONSTRAINT "fb_egg_sizes_spec_composition_id_fkey" FOREIGN KEY ("composition_id") REFERENCES "egg_grade_compositions"("id") ON DELETE CASCADE;
ALTER TABLE "fg_pack_spec_grades" ADD CONSTRAINT "fg_pack_spec_grades_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "fg_pack_specs"("id") ON DELETE CASCADE;
ALTER TABLE "fg_pack_specs" ADD CONSTRAINT "fg_pack_specs_composition_id_fkey" FOREIGN KEY ("composition_id") REFERENCES "egg_grade_compositions"("id");
ALTER TABLE "fg_pack_specs" ADD CONSTRAINT "fg_pack_specs_pack_type_id_fkey" FOREIGN KEY ("pack_type_id") REFERENCES "fg_pack_type"("id");
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_packing_activity_id_packing_activities_id_" FOREIGN KEY ("packing_activity_id") REFERENCES "packing_activities"("id");
ALTER TABLE "finished_pack_spec_grades" ADD CONSTRAINT "finished_pack_spec_grades_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "finished_pack_specs"("id") ON DELETE CASCADE;
ALTER TABLE "goods_receiving" ADD CONSTRAINT "goods_receiving_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "goods_receiving" ADD CONSTRAINT "goods_receiving_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");
ALTER TABLE "grading_activities" ADD CONSTRAINT "grading_activities_egg_size_id_egg_sizes_id_fk" FOREIGN KEY ("egg_size_id") REFERENCES "egg_sizes"("id");
ALTER TABLE "grading_activities" ADD CONSTRAINT "grading_activities_goods_receiving_id_goods_receiving_id_fk" FOREIGN KEY ("goods_receiving_id") REFERENCES "goods_receiving"("id");
ALTER TABLE "grading_activities" ADD CONSTRAINT "grading_activities_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "grading_lots" ADD CONSTRAINT "grading_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id");
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_production_request_id_production_requests" FOREIGN KEY ("production_request_id") REFERENCES "production_requests"("id");
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_site_id_fkey" FOREIGN KEY ("delivery_site_id") REFERENCES "delivery_sites"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");
ALTER TABLE "packing_activities" ADD CONSTRAINT "packing_activities_production_request_id_production_requests_id" FOREIGN KEY ("production_request_id") REFERENCES "production_requests"("id");
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_packing_activity_id_packing_activities_i" FOREIGN KEY ("packing_activity_id") REFERENCES "packing_activities"("id");
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_sized_egg_stock_id_sized_egg_stock_id_fk" FOREIGN KEY ("sized_egg_stock_id") REFERENCES "sized_egg_stock"("id");
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_substituted_from_size_egg_sizes_id_fk" FOREIGN KEY ("substituted_from_size") REFERENCES "egg_sizes"("id");
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_delivery_site_id_fkey" FOREIGN KEY ("delivery_site_id") REFERENCES "delivery_sites"("id");
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id");
ALTER TABLE "partner_product_pack_specs" ADD CONSTRAINT "partner_product_pack_specs_pack_spec_id_fkey" FOREIGN KEY ("pack_spec_id") REFERENCES "fg_pack_specs"("id");
ALTER TABLE "partner_product_pack_specs" ADD CONSTRAINT "partner_product_pack_specs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id");
ALTER TABLE "partner_product_pack_specs" ADD CONSTRAINT "partner_product_pack_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id");
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");
ALTER TABLE "sized_egg_stock" ADD CONSTRAINT "sized_egg_stock_egg_size_id_egg_sizes_id_fk" FOREIGN KEY ("egg_size_id") REFERENCES "egg_sizes"("id");
ALTER TABLE "sized_egg_stock" ADD CONSTRAINT "sized_egg_stock_grading_activity_id_grading_activities_id_fk" FOREIGN KEY ("grading_activity_id") REFERENCES "grading_activities"("id");
ALTER TABLE "sized_egg_stock" ADD CONSTRAINT "sized_egg_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_finished_goods_id_finished_goods_stock_id_fk" FOREIGN KEY ("finished_goods_id") REFERENCES "finished_goods_stock"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_location_id_stock_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "stock_locations"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sized_egg_stock_id_sized_egg_stock_id_fk" FOREIGN KEY ("sized_egg_stock_id") REFERENCES "sized_egg_stock"("id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_location_id_stock_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "stock_locations"("id");
CREATE UNIQUE INDEX "business_partners_code_key" ON "business_partners" ("code");
CREATE UNIQUE INDEX "business_partners_pkey" ON "business_partners" ("id");
CREATE UNIQUE INDEX "delivery_schedule_items_pkey" ON "delivery_schedule_items" ("id");
CREATE UNIQUE INDEX "delivery_schedules_pkey" ON "delivery_schedules" ("id");
CREATE UNIQUE INDEX "delivery_schedules_schedule_number_key" ON "delivery_schedules" ("schedule_number");
CREATE UNIQUE INDEX "delivery_sites_pkey" ON "delivery_sites" ("id");
CREATE UNIQUE INDEX "delivery_sites_site_code_key" ON "delivery_sites" ("site_code");
CREATE UNIQUE INDEX "drivers_code_key" ON "drivers" ("code");
CREATE UNIQUE INDEX "drivers_pkey" ON "drivers" ("id");
CREATE UNIQUE INDEX "egg_grade_compositions_composition_code_key" ON "egg_grade_compositions" ("composition_code");
CREATE UNIQUE INDEX "egg_grade_compositions_pkey" ON "egg_grade_compositions" ("id");
CREATE UNIQUE INDEX "egg_grade_rules_grade_code_key" ON "egg_grade_rules" ("grade_code");
CREATE UNIQUE INDEX "egg_grade_rules_pkey" ON "egg_grade_rules" ("id");
CREATE UNIQUE INDEX "egg_receiving_lots_lot_number_key" ON "egg_receiving_lots" ("lot_number");
CREATE UNIQUE INDEX "egg_receiving_lots_pkey" ON "egg_receiving_lots" ("id");
CREATE UNIQUE INDEX "egg_sizes_code_unique" ON "egg_sizes" ("code");
CREATE UNIQUE INDEX "egg_sizes_pkey" ON "egg_sizes" ("id");
CREATE UNIQUE INDEX "fb_egg_sizes_spec_pkey" ON "fb_egg_sizes_spec" ("id");
CREATE UNIQUE INDEX "fg_pack_spec_grades_pkey" ON "fg_pack_spec_grades" ("id");
CREATE UNIQUE INDEX "fg_pack_specs_pkey" ON "fg_pack_specs" ("id");
CREATE UNIQUE INDEX "fg_pack_specs_spec_code_key" ON "fg_pack_specs" ("spec_code");
CREATE UNIQUE INDEX "pack_types_code_key" ON "fg_pack_type" ("code");
CREATE UNIQUE INDEX "pack_types_pkey" ON "fg_pack_type" ("id");
CREATE UNIQUE INDEX "finished_goods_stock_code_key" ON "finished_goods_stock" ("code");
CREATE UNIQUE INDEX "finished_goods_stock_pkey" ON "finished_goods_stock" ("id");
CREATE UNIQUE INDEX "finished_pack_spec_grades_pkey" ON "finished_pack_spec_grades" ("id");
CREATE UNIQUE INDEX "finished_pack_specs_pkey" ON "finished_pack_specs" ("id");
CREATE UNIQUE INDEX "finished_pack_specs_spec_code_key" ON "finished_pack_specs" ("spec_code");
CREATE UNIQUE INDEX "goods_receiving_gr_number_unique" ON "goods_receiving" ("gr_number");
CREATE UNIQUE INDEX "goods_receiving_pkey" ON "goods_receiving" ("id");
CREATE UNIQUE INDEX "grading_activities_code_key" ON "grading_activities" ("code");
CREATE UNIQUE INDEX "grading_activities_pkey" ON "grading_activities" ("id");
CREATE UNIQUE INDEX "grading_lots_lot_number_key" ON "grading_lots" ("lot_number");
CREATE UNIQUE INDEX "grading_lots_pkey" ON "grading_lots" ("id");
CREATE UNIQUE INDEX "item_master_item_code_key" ON "item_master" ("item_code");
CREATE UNIQUE INDEX "item_master_pkey" ON "item_master" ("id");
CREATE UNIQUE INDEX "material_requirements_pkey" ON "material_requirements" ("id");
CREATE UNIQUE INDEX "order_items_pkey" ON "order_items" ("id");
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders" ("order_number");
CREATE UNIQUE INDEX "orders_pkey" ON "orders" ("id");
CREATE UNIQUE INDEX "packing_activities_code_key" ON "packing_activities" ("code");
CREATE UNIQUE INDEX "packing_activities_pkey" ON "packing_activities" ("id");
CREATE UNIQUE INDEX "packing_material_usage_pkey" ON "packing_material_usage" ("id");
CREATE UNIQUE INDEX "partner_contacts_code_key" ON "partner_contacts" ("code");
CREATE UNIQUE INDEX "partner_contacts_pkey" ON "partner_contacts" ("id");
CREATE UNIQUE INDEX "partner_product_pack_specs_pkey" ON "partner_product_pack_specs" ("id");
CREATE UNIQUE INDEX "price_adjustments_adjustment_number_key" ON "price_adjustments" ("adjustment_number");
CREATE UNIQUE INDEX "price_adjustments_pkey" ON "price_adjustments" ("id");
CREATE UNIQUE INDEX "product_recipes_pkey" ON "product_recipes" ("id");
CREATE UNIQUE INDEX "production_requests_pkey" ON "production_requests" ("id");
CREATE UNIQUE INDEX "production_requests_request_number_unique" ON "production_requests" ("request_number");
CREATE UNIQUE INDEX "products_pkey" ON "products" ("id");
CREATE UNIQUE INDEX "products_sku_key" ON "products" ("sku");
CREATE UNIQUE INDEX "raw_materials_pkey" ON "raw_materials" ("id");
CREATE UNIQUE INDEX "raw_materials_sku_unique" ON "raw_materials" ("sku");
CREATE INDEX "IDX_session_expire" ON "sessions" ("expire");
CREATE UNIQUE INDEX "sessions_pkey" ON "sessions" ("sid");
CREATE UNIQUE INDEX "sized_egg_stock_code_key" ON "sized_egg_stock" ("code");
CREATE UNIQUE INDEX "sized_egg_stock_pkey" ON "sized_egg_stock" ("id");
CREATE UNIQUE INDEX "stock_locations_code_key" ON "stock_locations" ("code");
CREATE UNIQUE INDEX "stock_locations_pkey" ON "stock_locations" ("id");
CREATE UNIQUE INDEX "stock_movements_code_key" ON "stock_movements" ("code");
CREATE UNIQUE INDEX "stock_movements_pkey" ON "stock_movements" ("id");
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers" ("code");
CREATE UNIQUE INDEX "suppliers_pkey" ON "suppliers" ("id");
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");
CREATE UNIQUE INDEX "vehicles_code_key" ON "vehicles" ("code");
CREATE UNIQUE INDEX "vehicles_pkey" ON "vehicles" ("id");
CREATE UNIQUE INDEX "vehicles_plate_number_unique" ON "vehicles" ("plate_number");