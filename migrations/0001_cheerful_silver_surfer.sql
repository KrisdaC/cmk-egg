CREATE TABLE "delivery_site_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"delivery_site_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_site_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "active_prices" ADD COLUMN "site_group_id" integer;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD COLUMN "scope_type" text DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "price_proposals" ADD COLUMN "site_group_id" integer;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD COLUMN "delivery_site_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_site_group_members" ADD CONSTRAINT "delivery_site_group_members_group_id_delivery_site_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."delivery_site_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_site_group_members" ADD CONSTRAINT "delivery_site_group_members_delivery_site_id_delivery_sites_id_fk" FOREIGN KEY ("delivery_site_id") REFERENCES "public"."delivery_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_site_groups" ADD CONSTRAINT "delivery_site_groups_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_prices" ADD CONSTRAINT "active_prices_site_group_id_delivery_site_groups_id_fk" FOREIGN KEY ("site_group_id") REFERENCES "public"."delivery_site_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_site_group_id_delivery_site_groups_id_fk" FOREIGN KEY ("site_group_id") REFERENCES "public"."delivery_site_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_delivery_site_id_delivery_sites_id_fk" FOREIGN KEY ("delivery_site_id") REFERENCES "public"."delivery_sites"("id") ON DELETE no action ON UPDATE no action;