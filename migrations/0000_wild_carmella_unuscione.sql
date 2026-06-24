CREATE TABLE "active_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"partner_id" integer,
	"delivery_site_id" integer,
	"scope_type" text DEFAULT 'customer',
	"price" numeric(10, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"status" text DEFAULT 'draft',
	"source_proposal_line_id" integer,
	"approved_by" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "business_partners_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "delivery_schedule_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"sequence_order" integer DEFAULT 0,
	"estimated_arrival" time,
	"actual_arrival" time,
	"status" text DEFAULT 'pending',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "delivery_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_number" text,
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
	CONSTRAINT "delivery_schedules_schedule_number_unique" UNIQUE("schedule_number")
);
--> statement-breakpoint
CREATE TABLE "delivery_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"site_code" text NOT NULL,
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "delivery_sites_site_code_unique" UNIQUE("site_code")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"license_number" text,
	"phone" text,
	"email" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "drivers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fb_egg_sizes_spec" (
	"id" serial PRIMARY KEY NOT NULL,
	"composition_id" integer NOT NULL,
	"grade_code" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"sequence" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "egg_grade_compositions" (
	"id" serial PRIMARY KEY NOT NULL,
	"composition_code" text NOT NULL,
	"composition_name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "egg_grade_compositions_composition_code_unique" UNIQUE("composition_code")
);
--> statement-breakpoint
CREATE TABLE "egg_grade_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"grade_code" text NOT NULL,
	"grade_name" text NOT NULL,
	"min_weight_g" numeric(6, 3),
	"max_weight_g" numeric(6, 3),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "egg_grade_rules_grade_code_unique" UNIQUE("grade_code")
);
--> statement-breakpoint
CREATE TABLE "egg_receiving_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_number" text NOT NULL,
	"receive_date" timestamp DEFAULT now() NOT NULL,
	"supplier_id" integer NOT NULL,
	"total_eggs" integer DEFAULT 3000 NOT NULL,
	"total_trays" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"location_id" integer,
	"notes" text,
	"received_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "egg_receiving_lots_lot_number_unique" UNIQUE("lot_number")
);
--> statement-breakpoint
CREATE TABLE "egg_sizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"min_weight" numeric(5, 2),
	"max_weight" numeric(5, 2),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "egg_sizes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fg_pack_spec_grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"spec_id" integer NOT NULL,
	"grade_code" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"sequence" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "fg_pack_specs" (
	"id" serial PRIMARY KEY NOT NULL,
	"spec_code" text NOT NULL,
	"spec_name" text NOT NULL,
	"pack_type_id" integer NOT NULL,
	"composition_id" integer,
	"min_total_weight_g" numeric(8, 2),
	"allow_below_grade_eggs" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "fg_pack_specs_spec_code_unique" UNIQUE("spec_code")
);
--> statement-breakpoint
CREATE TABLE "finished_goods_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"product_id" integer NOT NULL,
	"packing_activity_id" integer,
	"batch_number" text,
	"quantity" integer NOT NULL,
	"location_id" integer,
	"production_date" date DEFAULT now(),
	"expiry_date" date,
	"status" text DEFAULT 'available',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "finished_goods_stock_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "goods_receiving" (
	"id" serial PRIMARY KEY NOT NULL,
	"gr_number" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"receiving_date" date DEFAULT now(),
	"batch_number" text NOT NULL,
	"total_quantity" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'pcs',
	"location_id" integer,
	"status" text DEFAULT 'received',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "goods_receiving_gr_number_unique" UNIQUE("gr_number")
);
--> statement-breakpoint
CREATE TABLE "grading_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"goods_receiving_id" integer NOT NULL,
	"grading_date" date DEFAULT now(),
	"egg_size_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"batch_number" text,
	"location_id" integer,
	"status" text DEFAULT 'graded',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "grading_activities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "grading_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_number" integer NOT NULL,
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "grading_lots_lot_number_unique" UNIQUE("lot_number")
);
--> statement-breakpoint
CREATE TABLE "item_business_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"customer_item_number" varchar,
	"barcode_label" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "item_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_code" text NOT NULL,
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
	CONSTRAINT "item_master_item_code_unique" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"partner_id" integer,
	"item_number" varchar,
	"item_type" varchar,
	"item_role" varchar,
	"selling_unit" varchar,
	"base_unit" varchar,
	"pack_unit" varchar,
	"palette_unit" varchar,
	"basket_unit" varchar,
	"eggs_per_basket" integer,
	"eggs_per_pack" integer,
	"eggs_per_palette" integer,
	"barcode_label" varchar,
	"is_active" varchar DEFAULT 'active',
	"is_sellable" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_request_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"required_quantity" numeric(10, 2) NOT NULL,
	"allocated_quantity" numeric(10, 2) DEFAULT '0',
	"consumed_quantity" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text,
	"delivery_site_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"order_date" date DEFAULT now(),
	"delivery_date" date,
	"delivery_time" text,
	"status" text DEFAULT 'pending',
	"total_amount" numeric(10, 2),
	"logistics_status" text DEFAULT 'pending',
	"driver_id" integer,
	"vehicle_id" integer,
	"loading_zone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "fg_pack_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"thai_name" text NOT NULL,
	"eggs_per_pack" integer NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "fg_pack_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "packing_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"production_request_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"packing_date" date DEFAULT now(),
	"planned_quantity" integer NOT NULL,
	"actual_quantity" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "packing_activities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "packing_material_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"packing_activity_id" integer NOT NULL,
	"sized_egg_stock_id" integer,
	"raw_material_id" integer,
	"quantity_used" numeric(10, 2) NOT NULL,
	"substituted_from_size" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
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
	CONSTRAINT "partner_contacts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "partner_product_pack_specs" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"pack_spec_id" integer NOT NULL,
	"is_default" boolean DEFAULT false,
	"effective_from" date,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_number" text,
	"product_id" integer NOT NULL,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"status" text DEFAULT 'pending',
	"requested_by" text,
	"approved_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "price_adjustments_adjustment_number_unique" UNIQUE("adjustment_number")
);
--> statement-breakpoint
CREATE TABLE "price_proposal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"reference_price" numeric(10, 2),
	"proposal_price" numeric(10, 2),
	"counter_price" numeric(10, 2),
	"final_locked_price" numeric(10, 2),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "price_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_number" text,
	"pricing_week_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"status" text DEFAULT 'draft',
	"submitted_by" text,
	"approved_by" text,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "price_proposals_proposal_number_unique" UNIQUE("proposal_number")
);
--> statement-breakpoint
CREATE TABLE "pricing_assumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pricing_week_id" integer NOT NULL,
	"component" text NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"unit" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_code" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"benchmark_partner_id" integer,
	"status" text DEFAULT 'draft',
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pricing_weeks_week_code_unique" UNIQUE("week_code")
);
--> statement-breakpoint
CREATE TABLE "product_business_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"business_partner_id" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"quantity_required" numeric(10, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text,
	"order_id" integer,
	"request_date" date DEFAULT now(),
	"required_date" date,
	"status" text DEFAULT 'pending',
	"priority" text DEFAULT 'normal',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "production_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"partner_id" integer,
	"selling_units" text,
	"packing_units" text,
	"palette_units" text,
	"eggs_per_selling_unit" integer DEFAULT 1,
	"eggs_per_pack" integer DEFAULT 1,
	"packs_per_basket" integer DEFAULT 1,
	"baskets_per_palette" integer DEFAULT 1,
	"sku_size_category" text,
	"crate_size" text,
	"pack_base" text,
	"lid_cover" text,
	"barcode_label" text,
	"sticker_label" text,
	"current_price" numeric(10, 2),
	"type" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "raw_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text NOT NULL,
	"material_type" text NOT NULL,
	"min_stock" numeric(10, 2) DEFAULT '0',
	"current_stock" numeric(10, 2) DEFAULT '0',
	"cost_per_unit" numeric(10, 4),
	"supplier_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "raw_materials_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "sized_egg_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"egg_size_id" integer NOT NULL,
	"batch_number" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"location_id" integer,
	"grading_activity_id" integer,
	"received_date" date DEFAULT now(),
	"expiry_date" date,
	"status" text DEFAULT 'available',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sized_egg_stock_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"location_type" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "stock_locations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
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
	CONSTRAINT "stock_movements_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"supplier_type" text DEFAULT 'eggs',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "suppliers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"plate_number" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"capacity" numeric(10, 2),
	"cost_per_km" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "vehicles_code_unique" UNIQUE("code"),
	CONSTRAINT "vehicles_plate_number_unique" UNIQUE("plate_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "active_prices" ADD CONSTRAINT "active_prices_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_prices" ADD CONSTRAINT "active_prices_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_prices" ADD CONSTRAINT "active_prices_delivery_site_id_delivery_sites_id_fk" FOREIGN KEY ("delivery_site_id") REFERENCES "public"."delivery_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_prices" ADD CONSTRAINT "active_prices_source_proposal_line_id_price_proposal_lines_id_fk" FOREIGN KEY ("source_proposal_line_id") REFERENCES "public"."price_proposal_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedule_items" ADD CONSTRAINT "delivery_schedule_items_schedule_id_delivery_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."delivery_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedule_items" ADD CONSTRAINT "delivery_schedule_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedules" ADD CONSTRAINT "delivery_schedules_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_schedules" ADD CONSTRAINT "delivery_schedules_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_sites" ADD CONSTRAINT "delivery_sites_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fb_egg_sizes_spec" ADD CONSTRAINT "fb_egg_sizes_spec_composition_id_egg_grade_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."egg_grade_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_receiving_lots" ADD CONSTRAINT "egg_receiving_lots_supplier_id_business_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_receiving_lots" ADD CONSTRAINT "egg_receiving_lots_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fg_pack_spec_grades" ADD CONSTRAINT "fg_pack_spec_grades_spec_id_fg_pack_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."fg_pack_specs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fg_pack_specs" ADD CONSTRAINT "fg_pack_specs_pack_type_id_fg_pack_type_id_fk" FOREIGN KEY ("pack_type_id") REFERENCES "public"."fg_pack_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fg_pack_specs" ADD CONSTRAINT "fg_pack_specs_composition_id_egg_grade_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."egg_grade_compositions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_packing_activity_id_packing_activities_id_fk" FOREIGN KEY ("packing_activity_id") REFERENCES "public"."packing_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receiving" ADD CONSTRAINT "goods_receiving_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receiving" ADD CONSTRAINT "goods_receiving_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_activities" ADD CONSTRAINT "grading_activities_goods_receiving_id_goods_receiving_id_fk" FOREIGN KEY ("goods_receiving_id") REFERENCES "public"."goods_receiving"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_activities" ADD CONSTRAINT "grading_activities_egg_size_id_egg_sizes_id_fk" FOREIGN KEY ("egg_size_id") REFERENCES "public"."egg_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_activities" ADD CONSTRAINT "grading_activities_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_lots" ADD CONSTRAINT "grading_lots_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_business_partners" ADD CONSTRAINT "item_business_partners_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_business_partners" ADD CONSTRAINT "item_business_partners_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_master" ADD CONSTRAINT "item_master_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_production_request_id_production_requests_id_fk" FOREIGN KEY ("production_request_id") REFERENCES "public"."production_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_site_id_delivery_sites_id_fk" FOREIGN KEY ("delivery_site_id") REFERENCES "public"."delivery_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_activities" ADD CONSTRAINT "packing_activities_production_request_id_production_requests_id_fk" FOREIGN KEY ("production_request_id") REFERENCES "public"."production_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_activities" ADD CONSTRAINT "packing_activities_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_packing_activity_id_packing_activities_id_fk" FOREIGN KEY ("packing_activity_id") REFERENCES "public"."packing_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_sized_egg_stock_id_sized_egg_stock_id_fk" FOREIGN KEY ("sized_egg_stock_id") REFERENCES "public"."sized_egg_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_material_usage" ADD CONSTRAINT "packing_material_usage_substituted_from_size_egg_sizes_id_fk" FOREIGN KEY ("substituted_from_size") REFERENCES "public"."egg_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_delivery_site_id_delivery_sites_id_fk" FOREIGN KEY ("delivery_site_id") REFERENCES "public"."delivery_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_product_pack_specs" ADD CONSTRAINT "partner_product_pack_specs_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_product_pack_specs" ADD CONSTRAINT "partner_product_pack_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_product_pack_specs" ADD CONSTRAINT "partner_product_pack_specs_pack_spec_id_fg_pack_specs_id_fk" FOREIGN KEY ("pack_spec_id") REFERENCES "public"."fg_pack_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_adjustments" ADD CONSTRAINT "price_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposal_lines" ADD CONSTRAINT "price_proposal_lines_proposal_id_price_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."price_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposal_lines" ADD CONSTRAINT "price_proposal_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_pricing_week_id_pricing_weeks_id_fk" FOREIGN KEY ("pricing_week_id") REFERENCES "public"."pricing_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_assumptions" ADD CONSTRAINT "pricing_assumptions_pricing_week_id_pricing_weeks_id_fk" FOREIGN KEY ("pricing_week_id") REFERENCES "public"."pricing_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_weeks" ADD CONSTRAINT "pricing_weeks_benchmark_partner_id_business_partners_id_fk" FOREIGN KEY ("benchmark_partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_business_partners" ADD CONSTRAINT "product_business_partners_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_business_partners" ADD CONSTRAINT "product_business_partners_business_partner_id_business_partners_id_fk" FOREIGN KEY ("business_partner_id") REFERENCES "public"."business_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_requests" ADD CONSTRAINT "production_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sized_egg_stock" ADD CONSTRAINT "sized_egg_stock_egg_size_id_egg_sizes_id_fk" FOREIGN KEY ("egg_size_id") REFERENCES "public"."egg_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sized_egg_stock" ADD CONSTRAINT "sized_egg_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sized_egg_stock" ADD CONSTRAINT "sized_egg_stock_grading_activity_id_grading_activities_id_fk" FOREIGN KEY ("grading_activity_id") REFERENCES "public"."grading_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sized_egg_stock_id_sized_egg_stock_id_fk" FOREIGN KEY ("sized_egg_stock_id") REFERENCES "public"."sized_egg_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_finished_goods_id_finished_goods_stock_id_fk" FOREIGN KEY ("finished_goods_id") REFERENCES "public"."finished_goods_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_location_id_stock_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_location_id_stock_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ibp_item_partner_unique" ON "item_business_partners" USING btree ("item_id","partner_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");