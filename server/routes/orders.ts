// server/routes/orders.ts
import { Router } from "express";
import { db } from "../db";
import {
  orders,
  orderItems,
  businessPartners,
  deliverySites,
  orderStatusHistory,
  items,
  productionRequests,
  materialRequirements,
  deliveryScheduleItems,
  productionRoundStates,
  trips,
  vehicles,
  drivers,
  preliminaryShipmentPlans,
} from "@shared/schema";
import { desc, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";

import { todayBkk } from "@shared/date";
const router = Router();

// Eggs per one selling unit. The selling unit can differ from the pack unit
// (e.g. sells กะทัด, packs แพ็ค10), so match it against the item's unit tiers.
// Pack units carry a size suffix (แพ็ค10, มัด5), hence startsWith.
function eggsPerSellingUnit(row: any): number {
  const sellingUnit: string = (row.selling_unit ?? "").trim();
  const eggsPerPack = row.eggs_per_pack ? Number(row.eggs_per_pack) : 1;
  if (!sellingUnit) return eggsPerPack;
  if (sellingUnit === "ฟอง") return 1;
  const eggsPerBasket = Number(row.eggs_per_basket);
  if (row.basket_unit === sellingUnit && eggsPerBasket > 0) return eggsPerBasket;
  if (row.pack_unit && String(row.pack_unit).startsWith(sellingUnit)) return eggsPerPack;
  const eggsPerPalette = Number(row.eggs_per_palette);
  if (row.palette_unit === sellingUnit && eggsPerPalette > 0) return eggsPerPalette;
  return eggsPerPack;
}

const createOrderSchema = z.object({
  orderNumber: z.string().optional(),
  deliverySiteId: z.number(),
  partnerId: z.number(),
  orderDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  deliveryTime: z.string().optional(),
  status: z.string().optional(),
  logisticsStatus: z.string().optional(),
  driverId: z.number().optional(),
  vehicleId: z.number().optional(),
  loadingZone: z.string().optional(),
  notes: z.string().optional(),
  totalAmount: z.number().optional(),
  poNumber: z.string().optional(),
  source: z.string().optional(),
  products: z.array(
    z.object({
      itemId: z.number(),
      unitPrice: z.number(),
      quantity: z.number().min(1),
    }),
  ),
});

// =============================================
// PO INTAKE ENDPOINTS (must be before /:id)
// =============================================

/**
 * GET /api/orders/intake
 * PO register: orders with aggregated intake data + live price-check status
 */
router.get("/intake", async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const partnerFilter = req.query.partnerId ? Number(req.query.partnerId) : undefined;

    const rows = await db.execute(sql`
      SELECT
        o.id,
        o.order_number,
        o.po_number,
        o.order_date,
        o.delivery_date,
        o.delivery_time,
        o.pickup_date,
        o.pickup_time,
        o.status,
        o.source,
        o.adjustment_reason,
        o.adjustment_approved,
        o.notes,
        o.created_at,
        bp.id          AS partner_id,
        bp.nickname    AS partner_name,
        bp.code        AS partner_code,
        ds.id          AS delivery_site_id,
        ds.display_name AS delivery_site_name,
        ds.province,
        COUNT(oi.id)   AS line_count,

        -- PO qty in eggs
        COALESCE(SUM(oi.quantity::bigint * COALESCE(i.eggs_per_pack, 1)), 0) AS total_po_qty_eggs,

        -- Accepted qty in eggs (fallback to po_qty if not set)
        COALESCE(SUM(COALESCE(oi.accepted_qty, oi.quantity)::bigint * COALESCE(i.eggs_per_pack, 1)), 0) AS total_accepted_qty_eggs,

        -- Adjustment in eggs
        COALESCE(SUM((COALESCE(oi.accepted_qty, oi.quantity) - oi.quantity)::bigint * COALESCE(i.eggs_per_pack, 1)), 0) AS adjustment_eggs,

        -- Price-check status: worst across all lines
        CASE
          WHEN COUNT(oi.id) FILTER (WHERE ap.id IS NULL) > 0           THEN 'missing'
          WHEN COUNT(oi.id) FILTER (WHERE
            ap.id IS NOT NULL AND
            ABS(COALESCE(oi.po_price, oi.unit_price)::numeric - ap.price::numeric) > 0.01
          ) > 0 THEN 'mismatch'
          WHEN COUNT(oi.id) > 0 THEN 'match'
          ELSE 'no_lines'
        END AS price_check_status

      FROM orders o
      LEFT JOIN business_partners bp ON bp.id = o.partner_id
      LEFT JOIN delivery_sites    ds ON ds.id = o.delivery_site_id
      LEFT JOIN order_items       oi ON oi.order_id = o.id
      LEFT JOIN items              i  ON i.id = oi.item_id
      LEFT JOIN LATERAL (
        SELECT id, price FROM active_prices ap2
        WHERE ap2.item_id = oi.item_id
          AND ap2.partner_id = o.partner_id
          AND ap2.status = 'active'
        LIMIT 1
      ) ap ON true

      WHERE 1=1
        ${partnerFilter ? sql`AND o.partner_id = ${partnerFilter}` : sql``}
        ${statusFilter && statusFilter !== "all" ? sql`AND o.status = ${statusFilter}` : sql``}

      GROUP BY o.id, bp.id, bp.nickname, bp.code, ds.id, ds.display_name, ds.province
      ORDER BY o.id DESC
      LIMIT 200
    `);

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch intake list" });
  }
});

/**
 * GET /api/orders/:id/intake-detail
 * Single order with lines, price check, and active price
 */
router.get("/:id/intake-detail", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        poNumber: orders.poNumber,
        orderDate: orders.orderDate,
        deliveryDate: orders.deliveryDate,
        status: orders.status,
        source: orders.source,
        adjustmentReason: orders.adjustmentReason,
        adjustmentApproved: orders.adjustmentApproved,
        adjustmentApprovedBy: orders.adjustmentApprovedBy,
        adjustmentApprovedAt: orders.adjustmentApprovedAt,
        notes: orders.notes,
        partnerId: orders.partnerId,
        deliverySiteId: orders.deliverySiteId,
      })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) return res.status(404).json({ message: "Order not found" });

    const lineRows = await db.execute(sql`
      SELECT
        oi.id,
        oi.item_id,
        oi.quantity                                         AS po_qty,
        COALESCE(oi.accepted_qty, oi.quantity)             AS accepted_qty,
        oi.accepted_qty                                     AS accepted_qty_raw,
        oi.unit_price,
        COALESCE(oi.po_price, oi.unit_price)               AS po_price,
        oi.customer_item_code,
        i.sku,
        i.name,
        i.primary_size,
        i.secondary_size,
        i.eggs_per_pack,
        i.selling_unit,
        ap.price                                            AS active_price,
        CASE
          WHEN ap.id IS NULL THEN 'missing'
          WHEN ABS(COALESCE(oi.po_price, oi.unit_price)::numeric - ap.price::numeric) <= 0.01 THEN 'match'
          ELSE 'mismatch'
        END AS price_status
      FROM order_items oi
      JOIN items i ON i.id = oi.item_id
      LEFT JOIN LATERAL (
        SELECT id, price FROM active_prices ap2
        WHERE ap2.item_id = oi.item_id
          AND ap2.partner_id = (SELECT partner_id FROM orders WHERE id = ${orderId})
          AND ap2.status = 'active'
        LIMIT 1
      ) ap ON true
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.id
    `);

    return res.json({ ...order, lines: lineRows.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch intake detail" });
  }
});

/**
 * PATCH /api/orders/:id/intake-line/:lineId
 * Update accepted_qty (and optionally po_price) on a single line
 */
router.patch("/:id/intake-line/:lineId", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const lineId = Number(req.params.lineId);
    const parsed = z.object({
      acceptedQty: z.number().int().min(0).optional(),
      poPrice: z.number().optional(),
    }).parse(req.body);

    const updatePayload: Record<string, any> = {};
    if (parsed.acceptedQty !== undefined) updatePayload.accepted_qty = parsed.acceptedQty;
    if (parsed.poPrice !== undefined) updatePayload.po_price = parsed.poPrice.toString();

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Build update with only provided fields
    if (parsed.acceptedQty !== undefined && parsed.poPrice !== undefined) {
      await db.execute(sql`UPDATE order_items SET accepted_qty=${parsed.acceptedQty}, po_price=${parsed.poPrice.toString()} WHERE id=${lineId} AND order_id=${orderId}`);
    } else if (parsed.acceptedQty !== undefined) {
      await db.execute(sql`UPDATE order_items SET accepted_qty=${parsed.acceptedQty} WHERE id=${lineId} AND order_id=${orderId}`);
    } else if (parsed.poPrice !== undefined) {
      await db.execute(sql`UPDATE order_items SET po_price=${parsed.poPrice.toString()} WHERE id=${lineId} AND order_id=${orderId}`);
    }

    return res.json({ id: lineId, message: "Line updated" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update line" });
  }
});

/**
 * PATCH /api/orders/:id/intake
 * Update order-level intake fields: adjustmentReason, adjustmentApproved
 */
router.patch("/:id/intake", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const parsed = z.object({
      adjustmentReason: z.string().optional(),
      adjustmentApproved: z.boolean().optional(),
      adjustmentApprovedBy: z.string().optional(),
    }).parse(req.body);

    const updatePayload: any = {};
    if (parsed.adjustmentReason !== undefined) updatePayload.adjustmentReason = parsed.adjustmentReason;
    if (parsed.adjustmentApproved !== undefined) {
      updatePayload.adjustmentApproved = parsed.adjustmentApproved;
      if (parsed.adjustmentApproved) {
        updatePayload.adjustmentApprovedBy = parsed.adjustmentApprovedBy ?? "Supervisor";
        updatePayload.adjustmentApprovedAt = new Date();
      }
    }

    await db.update(orders).set(updatePayload).where(eq(orders.id, orderId));
    return res.json({ id: orderId, message: "Intake updated" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to update intake" });
  }
});

/**
 * POST /api/orders/:id/confirm
 * Confirm a PO (pending → confirmed). Validates price check + adjustment approval.
 */
router.post("/:id/confirm", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === "confirmed") return res.status(400).json({ message: "Already confirmed" });

    // Check for unapproved quantity adjustment
    const adjCheck = await db.execute(sql`
      SELECT SUM(COALESCE(oi.accepted_qty, oi.quantity) - oi.quantity) AS total_adj
      FROM order_items oi
      WHERE oi.order_id = ${orderId}
    `);
    const totalAdj = Number((adjCheck.rows[0] as any).total_adj) || 0;
    if (totalAdj !== 0 && !order.adjustmentApproved) {
      return res.status(400).json({ message: "การปรับยอดต้องได้รับการอนุมัติก่อน Confirm" });
    }

    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: "confirmed" }).where(eq(orders.id, orderId));
      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: order.status,
        toStatus: "confirmed",
      });
    });

    return res.json({ id: orderId, status: "confirmed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to confirm order" });
  }
});

/**
 * GET /api/orders/po-exists?poNumber=X&partnerId=Y
 * Quick duplicate-PO check used before showing the upload commit modal.
 */
router.get("/po-exists", async (req, res) => {
  const poNumber = req.query.poNumber as string;
  const partnerId = Number(req.query.partnerId);
  if (!poNumber || isNaN(partnerId)) {
    return res.status(400).json({ message: "poNumber and partnerId required" });
  }
  const existing = await db.query.orders.findFirst({
    where: sql`po_number = ${poNumber} AND partner_id = ${partnerId}`,
    columns: { orderNumber: true },
  });
  return res.json({ exists: !!existing, orderNumber: existing?.orderNumber ?? null });
});

/**
 * GET /api/orders/list-view
 * Orders table view — includes per-line selling_unit data for pack mix display.
 * Supports ?date=, ?status=, ?partnerId= filters.
 */
router.get("/list-view", async (req, res) => {
  try {
    const dateFilter = req.query.date as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const partnerFilter = req.query.partnerId ? Number(req.query.partnerId) : undefined;

    const rows = await db.execute(sql`
      SELECT
        o.id,
        o.order_number,
        o.po_number,
        o.order_date,
        o.delivery_date,
        o.status,
        o.source,
        o.notes,
        o.adjustment_approved,
        bp.id          AS partner_id,
        bp.nickname    AS partner_name,
        bp.code        AS partner_code,
        ds.id          AS delivery_site_id,
        ds.display_name AS delivery_site_name,
        ds.province,
        o.created_at,
        COALESCE(SUM(oi.quantity::bigint * COALESCE(i.eggs_per_pack, 1)), 0) AS total_eggs,
        COALESCE(SUM(COALESCE(oi.accepted_qty, oi.quantity)::bigint * COALESCE(i.eggs_per_pack, 1)), 0) AS accepted_eggs,
        json_agg(
          json_build_object(
            'line_id',       oi.id,
            'item_id',       oi.item_id,
            'sku',           i.sku,
            'name',          i.name,
            'selling_unit',  COALESCE(i.selling_unit, ''),
            'po_qty',        oi.quantity,
            'accepted_qty',  oi.accepted_qty,
            'eggs_per_pack', COALESCE(i.eggs_per_pack, 1),
            'primary_size',  i.primary_size,
            'secondary_size',i.secondary_size
          ) ORDER BY i.selling_unit NULLS LAST, oi.id
        ) FILTER (WHERE oi.id IS NOT NULL) AS lines
      FROM orders o
      LEFT JOIN business_partners bp ON bp.id = o.partner_id
      LEFT JOIN delivery_sites    ds ON ds.id = o.delivery_site_id
      LEFT JOIN order_items       oi ON oi.order_id = o.id
      LEFT JOIN items              i  ON i.id = oi.item_id
      WHERE o.status != 'cancelled'
        ${dateFilter ? sql`AND o.delivery_date::date = ${dateFilter}::date` : sql``}
        ${statusFilter && statusFilter !== "all" ? sql`AND o.status = ${statusFilter}` : sql``}
        ${partnerFilter ? sql`AND o.partner_id = ${partnerFilter}` : sql``}
      GROUP BY o.id, o.created_at, bp.id, bp.nickname, bp.code, ds.id, ds.display_name, ds.province
      ORDER BY o.id DESC
      LIMIT 500
    `);

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch orders list view" });
  }
});

/**
 * GET /api/orders/mixed-ratios
 * Master-data split for mixed-size eggs: for each pair (primary–secondary) the
 * min-primary % (primary size minimum, secondary size takes the balance).
 * Registered before /:id so it isn't swallowed by the generic routes.
 */
router.get("/mixed-ratios", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT primary_size, secondary_size, min_primary, COUNT(*) AS n
      FROM items
      WHERE secondary_size IS NOT NULL AND secondary_size <> '' AND primary_size IS NOT NULL
      GROUP BY primary_size, secondary_size, min_primary
      ORDER BY primary_size, secondary_size, n DESC
    `);
    const seen = new Set<string>();
    const out: { pair: string; primary: string; secondary: string; minPrimary: number | null }[] = [];
    for (const r of rows.rows as any[]) {
      const pair = `${r.primary_size}-${r.secondary_size}`;
      if (seen.has(pair)) continue; // most common min_primary wins
      seen.add(pair);
      out.push({
        pair,
        primary: r.primary_size,
        secondary: r.secondary_size,
        minPrimary: r.min_primary != null ? Number(r.min_primary) : null,
      });
    }
    return res.json(out);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch mixed ratios" });
  }
});

/**
 * GET /api/orders/daily?date=YYYY-MM-DD
 * Returns all orders for a delivery date, grouped by partner.
 * Used by the Orders Grid view.
 */
router.get("/daily", async (req, res) => {
  try {
    const date = (req.query.date as string) || todayBkk();

    const rows = await db.execute(sql`
      SELECT
        o.id              AS order_id,
        o.order_number,
        o.po_number,
        o.delivery_date,
        o.delivery_time,
        o.pickup_date,
        o.pickup_time,
        o.order_date,
        o.status,
        o.source,
        o.logistics_status,
        o.production_round,
        o.deferred_from_round,
        o.trip_id,
        o.stop_order,
        bp.id             AS partner_id,
        -- Several real walk-in-type partners share the literal nickname
        -- "ทั่วไป" (their actual name only lives in business_name) — fall
        -- back to that so Trip Manager's customer chips show something
        -- real/distinct instead of a dozen identical "ทั่วไป" pills.
        COALESCE(NULLIF(bp.nickname, 'ทั่วไป'), bp.business_name, bp.nickname) AS partner_name,
        bp.code           AS partner_code,
        ds.id             AS delivery_site_id,
        ds.display_name   AS delivery_site_name,
        ds.delivery_region,
        ds.province       AS delivery_province,
        ds.district       AS delivery_district,
        oi.id             AS line_id,
        oi.item_id,
        oi.quantity       AS po_qty,
        COALESCE(oi.accepted_qty, oi.quantity) AS order_qty,
        oi.planning_qty,
        i.sku,
        i.name            AS item_name,
        i.selling_unit,
        i.eggs_per_pack,
        i.pack_unit,
        i.basket_unit,
        i.eggs_per_basket,
        i.palette_unit,
        i.eggs_per_palette,
        i.primary_size,
        i.secondary_size,
        i.item_role
      FROM orders o
      LEFT JOIN business_partners bp ON bp.id = o.partner_id
      LEFT JOIN delivery_sites    ds ON ds.id = o.delivery_site_id
      LEFT JOIN order_items       oi ON oi.order_id = o.id
      LEFT JOIN items              i  ON i.id = oi.item_id
      WHERE o.delivery_date::date = ${date}::date
        AND o.status != 'cancelled'
      ORDER BY bp.id, o.trip_id NULLS LAST, o.stop_order NULLS LAST, o.id, oi.id
    `);

    // Group: partner → orders → lines
    const partnerMap: Record<number, any> = {};
    for (const row of rows.rows as any[]) {
      if (!partnerMap[row.partner_id]) {
        partnerMap[row.partner_id] = {
          partnerId: row.partner_id,
          partnerName: row.partner_name,
          partnerCode: row.partner_code,
          orders: {},
        };
      }
      const partner = partnerMap[row.partner_id];
      if (row.order_id && !partner.orders[row.order_id]) {
        partner.orders[row.order_id] = {
          id: row.order_id,
          orderNumber: row.order_number,
          poNumber: row.po_number,
          deliveryDate: row.delivery_date,
          deliveryTime: row.delivery_time || null,
          pickupDate: row.pickup_date || null,
          pickupTime: row.pickup_time || null,
          orderDate: row.order_date,
          status: row.status,
          source: row.source ?? null,
          logisticsStatus: row.logistics_status ?? null,
          productionRound: row.production_round ?? null,
          deferredFromRound: row.deferred_from_round ?? null,
          tripId: row.trip_id ?? null,
          stopOrder: row.stop_order ?? null,
          deliverySiteId: row.delivery_site_id,
          deliverySiteName: row.delivery_site_name,
          deliveryRegion: row.delivery_region || null,
          deliveryProvince: row.delivery_province || null,
          deliveryDistrict: row.delivery_district || null,
          lines: [],
        };
      }
      if (row.order_id && row.line_id) {
        partner.orders[row.order_id].lines.push({
          lineId: row.line_id,
          itemId: row.item_id,
          sku: row.sku,
          itemName: row.item_name,
          sellingUnit: row.selling_unit,
          packUnit: row.pack_unit || row.selling_unit,
          eggsPerPack: row.eggs_per_pack ? Number(row.eggs_per_pack) : 1,
          eggsPerSellingUnit: eggsPerSellingUnit(row),
          primarySize: row.primary_size,
          secondarySize: row.secondary_size,
          itemRole: row.item_role ?? null,
          poQty: Number(row.po_qty) || 0,
          orderQty: Number(row.order_qty) || 0,
          planningQty: row.planning_qty != null ? Number(row.planning_qty) : null,
        });
      }
    }

    // Compute day-level KPIs
    let totalOrders = 0, totalEggs = 0;
    const partnerSet = new Set<number>(), siteSet = new Set<number>();

    const partners = Object.values(partnerMap).map((p: any) => {
      p.orders = Object.values(p.orders);
      totalOrders += p.orders.length;
      partnerSet.add(p.partnerId);
      for (const o of p.orders) {
        siteSet.add(o.deliverySiteId);
        for (const l of o.lines) {
          totalEggs += l.orderQty * l.eggsPerPack;
        }
      }
      return p;
    });

    // Fetch round states for this date
    const roundRows = await db
      .select()
      .from(productionRoundStates)
      .where(eq(productionRoundStates.deliveryDate, date));
    const roundStates: Record<number, { closed: boolean; closedAt: string | null }> = {};
    for (const r of roundRows) {
      roundStates[r.round] = { closed: r.closedAt != null, closedAt: r.closedAt ? r.closedAt.toISOString() : null };
    }

    // Fetch trips for this date with vehicle and driver names
    const tripRows = await db.execute(sql`
      SELECT t.id, t.delivery_date, t.production_round, t.trip_number, t.name, t.notes,
             t.vehicle_id, v.plate_number AS vehicle_plate, v.vehicle_type, v.capacity_eggs,
             t.driver_id,  d.name         AS driver_name,
             t.confirmed_at, t.vehicle_confirmed_at, t.departed_at
      FROM trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN drivers  d ON d.id = t.driver_id
      WHERE t.delivery_date::date = ${date}::date
      ORDER BY t.trip_number, t.id
    `);
    const tripList = (tripRows.rows as any[]).map(r => ({
      id: r.id,
      deliveryDate: r.delivery_date,
      productionRound: r.production_round ?? null,
      tripNumber: r.trip_number,
      name: r.name ?? null,
      notes: r.notes ?? null,
      vehicleId: r.vehicle_id ?? null,
      vehiclePlate: r.vehicle_plate ?? null,
      vehicleType: r.vehicle_type ?? null,
      vehicleCapacityEggs: r.capacity_eggs != null ? Number(r.capacity_eggs) : null,
      driverId: r.driver_id ?? null,
      driverName: r.driver_name ?? null,
      confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : null,
      vehicleConfirmedAt: r.vehicle_confirmed_at ? new Date(r.vehicle_confirmed_at).toISOString() : null,
      departedAt: r.departed_at ? new Date(r.departed_at).toISOString() : null,
    }));

    return res.json({
      date,
      kpi: {
        orders: totalOrders,
        partners: partnerSet.size,
        sites: siteSet.size,
        eggs: totalEggs,
      },
      roundStates,
      partners,
      trips: tripList,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch daily orders" });
  }
});

// ── GET /api/orders/ad-demand?date=YYYY-MM-DD&days=30 ─────────────────────────
// "AD reference" — average daily demand by egg size over a trailing window
// ending at `date` (inclusive), from confirmed-ish orders. Used as a trend-only
// demand basis (Production > Grading), distinct from "Latest PQ" which uses the
// current round's actual planning quantities.

router.get("/ad-demand", async (req, res) => {
  try {
    const date = (req.query.date as string) || todayBkk();
    const days = Math.max(1, parseInt((req.query.days as string) || "30", 10));

    const rows = await db.execute(sql`
      SELECT
        i.primary_size,
        i.secondary_size,
        COALESCE(oi.accepted_qty, oi.quantity) AS order_qty,
        i.eggs_per_pack
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN items        i ON i.id = oi.item_id
      WHERE o.delivery_date::date <= ${date}::date
        AND o.delivery_date::date > (${date}::date - ${days}::int)
        AND o.status IN ('confirmed', 'in_production', 'delivered', 'shipped')
    `);

    const totalBySize: Record<string, number> = {};
    for (const row of rows.rows as any[]) {
      if (row.order_qty == null || row.eggs_per_pack == null) continue;
      const key = row.secondary_size ? `${row.primary_size}-${row.secondary_size}` : (row.primary_size ?? "mixed");
      totalBySize[key] = (totalBySize[key] ?? 0) + Number(row.order_qty) * Number(row.eggs_per_pack);
    }
    const avgPerDayBySize: Record<string, number> = {};
    for (const [size, total] of Object.entries(totalBySize)) avgPerDayBySize[size] = total / days;

    return res.json({ date, days, avgPerDaySize: avgPerDayBySize });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute AD reference demand" });
  }
});

// ── GET /api/orders/aq-reference ──────────────────────────────────────────────
// AQ = whole-day forecast used as a REFERENCE only (never changes OQ/PQ).
// Average daily eggs per SKU / size over a trailing history window ending the
// day before `date`, by one of three historical methods:
//   all            every working day: all sales ÷ production days in the window
//   weekday        only past days on the same weekday as `date`
//   weekday_month  same weekday AND the same week band (1–5) of the month
// Non-working weekdays and extra holidays are not production days (they are
// excluded from the divisor). Excluded partners are left out of the sums but
// still listed in `customers` so they can be re-included.
async function computeAqReference(query: Record<string, any>) {
  const date = (query.date as string) || todayBkk();
  const days = Math.min(365, Math.max(1, parseInt((query.days as string) || "30", 10) || 30));
  const methodRaw = String(query.method || "all");
  const method = ["all", "weekday", "weekday_month"].includes(methodRaw) ? methodRaw : "all";
  const nonWorking = new Set(
  String(query.nonWorking ?? "0").split(",").filter(x => x !== "").map(Number).filter(n => n >= 0 && n <= 6),
  );
  const holidays = new Set(String(query.holidays ?? "").split(",").filter(Boolean));
  const excluded = new Set(String(query.exclude ?? "").split(",").filter(Boolean).map(Number));

  const rows = await db.execute(sql`
  SELECT
    to_char(o.delivery_date::date, 'YYYY-MM-DD') AS day,
    bp.id        AS partner_id,
    bp.nickname  AS partner_name,
    i.sku, i.name AS item_name, i.primary_size, i.secondary_size,
    COALESCE(oi.accepted_qty, oi.quantity) AS order_qty,
    i.eggs_per_pack
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN items i ON i.id = oi.item_id
  LEFT JOIN business_partners bp ON bp.id = o.partner_id
  WHERE o.delivery_date::date <  ${date}::date
    AND o.delivery_date::date >= (${date}::date - ${days}::int)
    AND o.status IN ('confirmed', 'in_production', 'delivered', 'shipped')
  `);

  // Calendar helpers on plain YYYY-MM-DD (UTC-safe: no local-time parsing)
  const parts = (d: string) => d.split("-").map(Number) as [number, number, number];
  const dow = (d: string) => { const [y, m, dd] = parts(d); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); };
  const band = (d: string) => Math.ceil(parts(d)[2] / 7);
  const addDay = (d: string, n: number) => {
  const [y, m, dd] = parts(d);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
  };
  const targetDow = dow(date);
  const targetBand = band(date);
  const isProduction = (d: string) => !nonWorking.has(dow(d)) && !holidays.has(d);
  const counts = (d: string) =>
  method === "all" ? true
  : method === "weekday" ? dow(d) === targetDow
  : dow(d) === targetDow && band(d) === targetBand;

  // Every calendar day in the window, oldest first
  let productionDays = 0;
  for (let n = days; n >= 1; n--) {
  const d = addDay(date, -n);
  if (counts(d) && isProduction(d)) productionDays++;
  }

  const bySize: Record<string, number> = {};
  const bySku: Record<string, { sku: string; name: string; size: string; eggs: number }> = {};
  const customers: Record<number, { partnerId: number; name: string; eggs: number; days: Set<string> }> = {};
  const dataDays = new Set<string>();
  const byRow: Record<string, { size: string; sku: string; name: string; partnerId: number; partnerName: string; eggs: number }> = {};
  for (const r of rows.rows as any[]) {
  if (r.order_qty == null || r.eggs_per_pack == null) continue;
  const eggs = Number(r.order_qty) * Number(r.eggs_per_pack);
  const pid = Number(r.partner_id);
  if (!customers[pid]) customers[pid] = { partnerId: pid, name: r.partner_name ?? `#${pid}`, eggs: 0, days: new Set() };
  customers[pid].eggs += eggs;
  customers[pid].days.add(r.day);
  if (excluded.has(pid) || !counts(r.day)) continue;
  dataDays.add(r.day);
  const size = r.secondary_size ? `${r.primary_size}-${r.secondary_size}` : (r.primary_size ?? "mixed");
  bySize[size] = (bySize[size] ?? 0) + eggs;
  const key = r.sku ?? r.item_name;
  if (!bySku[key]) bySku[key] = { sku: r.sku ?? "", name: r.item_name, size, eggs: 0 };
  bySku[key].eggs += eggs;
  const rowKey = `${pid}|${key}`;
  if (!byRow[rowKey]) byRow[rowKey] = { size, sku: r.sku ?? "", name: r.item_name, partnerId: pid, partnerName: r.partner_name ?? `#${pid}`, eggs: 0 };
  byRow[rowKey].eggs += eggs;
  }

  const avg = (n: number) => (productionDays > 0 ? n / productionDays : 0);
  const avgPerDaySize: Record<string, number> = {};
  for (const [k, v] of Object.entries(bySize)) avgPerDaySize[k] = avg(v);

  return ({
  date,
  days,
  method,
  productionDays,
  dataDays: dataDays.size,
  // Not enough evidence to call the average a forecast
  insufficient: productionDays === 0 || dataDays.size < 3,
  weekBand: targetBand,
  avgPerDaySize,
  rows: Object.values(byRow).map(v => ({ ...v, avgEggs: avg(v.eggs) })),
  skus: Object.values(bySku)
    .map(v => ({ sku: v.sku, name: v.name, size: v.size, avgEggs: avg(v.eggs) }))
    .sort((a, b) => a.sku.localeCompare(b.sku)),
  customers: Object.values(customers)
    .map(c => ({
      partnerId: c.partnerId,
      name: c.name,
      eggs: c.eggs,
      orderDays: c.days.size,
      likelyOneTime: c.days.size <= 1,
      excluded: excluded.has(c.partnerId),
    }))
    .sort((a, b) => b.eggs - a.eggs),
  });
}

router.get("/aq-reference", async (req, res) => {
  try {
    return res.json(await computeAqReference(req.query as Record<string, any>));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to compute AQ reference" });
  }
});

const aqSnapshotSchema = z.object({
  date: z.string(),
  days: z.number().int().min(1).max(365),
  method: z.enum(["all", "weekday", "weekday_month"]),
  nonWorking: z.array(z.number().int().min(0).max(6)),
  holidays: z.array(z.string()),
  excluded: z.array(z.number().int()),
});

// GET /api/orders/aq-snapshots?date=YYYY-MM-DD — saved AQ versions, newest first
// (all dates when `date` is omitted). Read-only evidence: no edits, no deletes.
router.get("/aq-snapshots", async (req, res) => {
  try {
    const date = req.query.date as string | undefined;
    const rows = await db.execute(sql`
      SELECT id, to_char(planning_date, 'YYYY-MM-DD') AS planning_date, version, method, window_days,
             non_working, holidays, excluded_partner_ids, total_eggs, production_days, data_days,
             data, state, created_by, created_at
      FROM aq_snapshots
      ${date ? sql`WHERE planning_date = ${date}::date` : sql``}
      ORDER BY planning_date DESC, version DESC
      LIMIT 200
    `);
    return res.json(
      (rows.rows as any[]).map(r => ({
        id: r.id,
        planningDate: r.planning_date,
        version: r.version,
        method: r.method,
        windowDays: r.window_days,
        nonWorking: r.non_working,
        holidays: r.holidays,
        excludedPartnerIds: r.excluded_partner_ids,
        totalEggs: Number(r.total_eggs),
        productionDays: r.production_days,
        dataDays: r.data_days,
        avgPerDaySize: r.data?.avgPerDaySize ?? {},
        skus: r.data?.skus ?? [],
        state: r.state,
        createdBy: r.created_by,
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch AQ snapshots" });
  }
});

// POST /api/orders/aq-snapshots — computes AQ for the given config and saves it
// as the next version for that planning date; the previous active version
// becomes "superseded".
router.post("/aq-snapshots", async (req, res) => {
  try {
    const cfg = aqSnapshotSchema.parse(req.body);
    const aq = await computeAqReference({
      date: cfg.date,
      days: String(cfg.days),
      method: cfg.method,
      nonWorking: cfg.nonWorking.join(","),
      holidays: cfg.holidays.join(","),
      exclude: cfg.excluded.join(","),
    });
    if (aq.insufficient) {
      return res.status(422).json({ message: "Insufficient history — AQ not saved" });
    }
    const total = Object.values(aq.avgPerDaySize as Record<string, number>).reduce((a, b) => a + b, 0);
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('aq_snapshots'))`);
      const [{ next }] = (await tx.execute(sql`
        SELECT COALESCE(MAX(version), 0) + 1 AS next FROM aq_snapshots WHERE planning_date = ${cfg.date}::date
      `)).rows as any[];
      await tx.execute(sql`UPDATE aq_snapshots SET state = 'superseded' WHERE planning_date = ${cfg.date}::date AND state = 'active'`);
      const ins = await tx.execute(sql`
        INSERT INTO aq_snapshots
          (planning_date, version, method, window_days, non_working, holidays, excluded_partner_ids,
           total_eggs, production_days, data_days, data, state)
        VALUES
          (${cfg.date}::date, ${Number(next)}, ${cfg.method}, ${cfg.days},
           ${JSON.stringify(cfg.nonWorking)}::jsonb, ${JSON.stringify(cfg.holidays)}::jsonb,
           ${JSON.stringify(cfg.excluded)}::jsonb, ${total}, ${aq.productionDays}, ${aq.dataDays},
           ${JSON.stringify({ avgPerDaySize: aq.avgPerDaySize, skus: aq.skus })}::jsonb, 'active')
        RETURNING id, version
      `);
      return (ins.rows as any[])[0];
    });
    return res.status(201).json({ id: result.id, version: result.version });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid AQ config", issues: err.issues });
    console.error(err);
    return res.status(500).json({ message: "Failed to save AQ snapshot" });
  }
});

// ── PQ snapshots — a round's "published Planning Quantity" ──────────────────────
// Same architecture as aq_snapshots: "Send O-R{n}" doesn't just flip
// production_round_states.closed_at anymore — it also freezes a real,
// immutable snapshot of that round's order-line quantities as the next
// version. Before a round has ever been sent, its total is read live
// (unpublished) and the UI labels it "ร่าง · ยังไม่เผยแพร่"; once sent, Accum
// PQ / PQ รวม read the frozen snapshot total instead of the live one, so
// reopening a round and changing its orders doesn't silently change a
// number that's already been "published." Reopening never deletes or
// rewrites a past version — a later re-send just creates the next one.

const pqSnapshotSchema = z.object({
  date: z.string(),
  round: z.number().int().min(1).max(4),
});

async function computePqRoundData(date: string, round: number) {
  const rows = await db.execute(sql`
    SELECT
      o.id AS order_id, o.order_number, bp.id AS partner_id, bp.nickname AS partner_name,
      ds.display_name AS delivery_site_name,
      oi.item_id, i.sku, COALESCE(oi.planning_qty, oi.quantity) AS qty, COALESCE(i.eggs_per_pack, 1) AS eggs_per_pack
    FROM orders o
    LEFT JOIN business_partners bp ON bp.id = o.partner_id
    LEFT JOIN delivery_sites    ds ON ds.id = o.delivery_site_id
    LEFT JOIN order_items       oi ON oi.order_id = o.id
    LEFT JOIN items              i ON i.id = oi.item_id
    WHERE o.delivery_date::date = ${date}::date
      AND o.production_round = ${round}
      AND o.status IN ('confirmed', 'in_production', 'delivered')
  `);
  const byOrder: Record<number, any> = {};
  let totalEggs = 0;
  for (const r of rows.rows as any[]) {
    if (!byOrder[r.order_id]) {
      byOrder[r.order_id] = {
        orderId: r.order_id, orderNumber: r.order_number, partnerId: r.partner_id,
        partnerName: r.partner_name, deliverySiteName: r.delivery_site_name, lines: [],
      };
    }
    if (r.item_id) {
      const eggs = Number(r.qty) * Number(r.eggs_per_pack);
      byOrder[r.order_id].lines.push({ itemId: r.item_id, sku: r.sku, qty: Number(r.qty), eggsPerPack: Number(r.eggs_per_pack) });
      totalEggs += eggs;
    }
  }
  const data = Object.values(byOrder);
  return { data, totalEggs, orderCount: data.length };
}

// GET /api/orders/pq-snapshots?date=YYYY-MM-DD[&round=N] — saved PQ versions
// for the date (optionally one round), newest version first per round.
router.get("/pq-snapshots", async (req, res) => {
  try {
    const date = req.query.date as string | undefined;
    const round = req.query.round ? Number(req.query.round) : undefined;
    if (!date) return res.status(400).json({ message: "date required" });
    const rows = await db.execute(sql`
      SELECT id, to_char(delivery_date, 'YYYY-MM-DD') AS delivery_date, round, version,
             total_eggs, order_count, state, published_at, published_by
      FROM pq_snapshots
      WHERE delivery_date = ${date}::date
      ${round != null ? sql`AND round = ${round}` : sql``}
      ORDER BY round ASC, version DESC
    `);
    return res.json(
      (rows.rows as any[]).map(r => ({
        id: r.id,
        deliveryDate: r.delivery_date,
        round: r.round,
        version: r.version,
        totalEggs: Number(r.total_eggs),
        orderCount: r.order_count,
        state: r.state,
        publishedAt: r.published_at,
        publishedBy: r.published_by,
      })),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch PQ snapshots" });
  }
});

// POST /api/orders/pq-snapshots — publishes the next PQ version for a round
// from its current live order/line data; the previous active version for
// that (date, round) becomes "superseded" (kept, not deleted).
router.post("/pq-snapshots", async (req, res) => {
  try {
    const cfg = pqSnapshotSchema.parse(req.body);
    const { data, totalEggs, orderCount } = await computePqRoundData(cfg.date, cfg.round);
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pq_snapshots'))`);
      const [{ next }] = (await tx.execute(sql`
        SELECT COALESCE(MAX(version), 0) + 1 AS next FROM pq_snapshots WHERE delivery_date = ${cfg.date}::date AND round = ${cfg.round}
      `)).rows as any[];
      await tx.execute(sql`
        UPDATE pq_snapshots SET state = 'superseded' WHERE delivery_date = ${cfg.date}::date AND round = ${cfg.round} AND state = 'active'
      `);
      const ins = await tx.execute(sql`
        INSERT INTO pq_snapshots (delivery_date, round, version, total_eggs, order_count, data, state)
        VALUES (${cfg.date}::date, ${cfg.round}, ${Number(next)}, ${totalEggs}, ${orderCount}, ${JSON.stringify(data)}::jsonb, 'active')
        RETURNING id, version
      `);
      return (ins.rows as any[])[0];
    });
    return res.status(201).json({ id: result.id, version: result.version, totalEggs, orderCount });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid PQ snapshot request", issues: err.issues });
    console.error(err);
    return res.status(500).json({ message: "Failed to publish PQ snapshot" });
  }
});

// ── PATCH /api/orders/:id/details ─────────────────────────────────────────────
// Updates dates, times, notes without touching lines or status

router.patch("/:id/details", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { deliveryDate, deliveryTime, pickupDate, pickupTime, notes } = req.body as {
      deliveryDate?: string;
      deliveryTime?: string;
      pickupDate?: string;
      pickupTime?: string;
      notes?: string;
    };

    await db
      .update(orders)
      .set({
        ...(deliveryDate !== undefined && { deliveryDate: deliveryDate || null }),
        ...(deliveryTime !== undefined && { deliveryTime: deliveryTime || null }),
        ...(pickupDate !== undefined && { pickupDate: pickupDate || null }),
        ...(pickupTime !== undefined && { pickupTime: pickupTime || null }),
        ...(notes !== undefined && { notes: notes || null }),
      })
      .where(eq(orders.id, id));

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update order details" });
  }
});

// ── PATCH /api/orders/round-states ────────────────────────────────────────────
// Body: { date, round, closed: boolean }

router.patch("/round-states", async (req, res) => {
  try {
    const { date, round, closed } = req.body as { date: string; round: number; closed: boolean };
    if (!date || !round) return res.status(400).json({ message: "date and round required" });

    const existing = await db
      .select()
      .from(productionRoundStates)
      .where(
        sql`delivery_date = ${date}::date AND round = ${round}`
      );

    if (existing.length === 0) {
      await db.insert(productionRoundStates).values({
        deliveryDate: date,
        round,
        closedAt: closed ? new Date() : null,
      });
    } else {
      await db
        .update(productionRoundStates)
        .set({ closedAt: closed ? new Date() : null })
        .where(
          sql`delivery_date = ${date}::date AND round = ${round}`
        );
    }
    return res.json({ ok: true, closed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update round state" });
  }
});

// ── PATCH /api/orders/planning-lines ──────────────────────────────────────────
// Body: { updates: [{ orderItemId: number, planningQty: number | null }] }

router.patch("/planning-lines", async (req, res) => {
  try {
    const { updates } = req.body as {
      updates: { orderItemId: number; planningQty: number | null }[];
    };
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "updates required" });
    }
    for (const u of updates) {
      await db
        .update(orderItems)
        .set({ planningQty: u.planningQty })
        .where(eq(orderItems.id, u.orderItemId));
    }
    return res.json({ updated: updates.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update planning qty" });
  }
});

// ── PATCH /api/orders/assign-round ────────────────────────────────────────────
// Body: { orderIds: number[], round: number | null, deferReason?, deferReasonNote?, deferredFromRound? }
// Assigns (or clears) a production round for the given order IDs. The
// deferReason fields are optional and only meaningful for the "Defer to next
// round" action specifically (not other round reassignment) — when present
// they're recorded alongside the round change as a forward-only audit trail.

const DEFER_REASONS = ["trip", "vehicle", "delivery_time", "product", "other"];

router.patch("/assign-round", async (req, res) => {
  try {
    const { orderIds, round, deferReason, deferReasonNote, deferredFromRound } = req.body as {
      orderIds: number[];
      round: number | null;
      deferReason?: string | null;
      deferReasonNote?: string | null;
      deferredFromRound?: number | null;
    };
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds required" });
    }
    if (round !== null && (round < 1 || round > 4)) {
      return res.status(400).json({ message: "round must be 1–4 or null" });
    }
    if (deferReason != null) {
      if (!DEFER_REASONS.includes(deferReason)) {
        return res.status(400).json({ message: "Invalid deferReason" });
      }
      if (deferReason === "other" && !deferReasonNote?.trim()) {
        return res.status(400).json({ message: "deferReasonNote is required when deferReason is 'other'" });
      }
    }
    const updates: Record<string, any> = { productionRound: round };
    if (deferReason != null) {
      updates.deferReason = deferReason;
      updates.deferReasonNote = deferReasonNote?.trim() || null;
      updates.deferredFromRound = deferredFromRound ?? null;
      updates.deferredAt = new Date();
    }
    await db
      .update(orders)
      .set(updates)
      .where(inArray(orders.id, orderIds));
    return res.json({ updated: orderIds.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to assign round" });
  }
});

// ── Preliminary shipment plans ────────────────────────────────────────────────
// Feasibility-only draft groupings made during round planning — distinct from
// `trips`. Persisted so they survive a refresh, but never used by any other
// process (no downstream reads elsewhere in the app). Registered here, before
// the generic /:id routes below, so "preliminary-plans" isn't swallowed as an
// order-id lookup.

/** GET /api/orders/preliminary-plans?date=YYYY-MM-DD */
router.get("/preliminary-plans", async (req, res) => {
  const date = req.query.date as string | undefined;
  if (!date) return res.status(400).json({ message: "date required" });
  try {
    const rows = await db
      .select()
      .from(preliminaryShipmentPlans)
      .where(eq(preliminaryShipmentPlans.deliveryDate, date));
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load preliminary shipment plans" });
  }
});

/** POST /api/orders/preliminary-plans */
router.post("/preliminary-plans", async (req, res) => {
  const { deliveryDate, productionRound, label, groupLabel, orderIds } = req.body;
  if (!deliveryDate || !label || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ message: "deliveryDate, label, and orderIds required" });
  }
  try {
    const [created] = await db
      .insert(preliminaryShipmentPlans)
      .values({
        deliveryDate,
        productionRound: productionRound ?? null,
        label,
        groupLabel: groupLabel ?? null,
        orderIds,
      })
      .returning();
    return res.json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create preliminary shipment plan" });
  }
});

/** PATCH /api/orders/preliminary-plans/:id */
// addOrderIds merges into the plan's existing orderIds (union, deduped) —
// separate from a hypothetical direct `orderIds` overwrite so "Add to
// existing plan" can never accidentally drop orders already in the plan.
router.patch("/preliminary-plans/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const { vehicleId, loadInDate, loadInTime, deliverPlanDate, deliverPlanTime, addOrderIds, removeOrderIds } = req.body;
  try {
    const updates: Record<string, any> = {};
    if (vehicleId !== undefined) {
      const parsed = parseInt(vehicleId, 10);
      updates.vehicleId = vehicleId && !isNaN(parsed) ? parsed : null;
    }
    if (loadInDate !== undefined) updates.loadInDate = loadInDate || null;
    if (loadInTime !== undefined) updates.loadInTime = loadInTime || null;
    if (deliverPlanDate !== undefined) updates.deliverPlanDate = deliverPlanDate || null;
    if (deliverPlanTime !== undefined) updates.deliverPlanTime = deliverPlanTime || null;
    // addOrderIds (union) and removeOrderIds (set difference) — "Move to
    // another plan" in the UI is one removeOrderIds call on the source plan
    // plus one addOrderIds call on the target plan, not a single endpoint.
    if ((Array.isArray(addOrderIds) && addOrderIds.length > 0) || (Array.isArray(removeOrderIds) && removeOrderIds.length > 0)) {
      const [plan] = await db
        .select({ orderIds: preliminaryShipmentPlans.orderIds })
        .from(preliminaryShipmentPlans)
        .where(eq(preliminaryShipmentPlans.id, id));
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      let ids = plan.orderIds ?? [];
      if (Array.isArray(removeOrderIds) && removeOrderIds.length > 0) {
        const removeSet = new Set(removeOrderIds);
        ids = ids.filter((oid: number) => !removeSet.has(oid));
      }
      if (Array.isArray(addOrderIds) && addOrderIds.length > 0) {
        ids = Array.from(new Set([...ids, ...addOrderIds]));
      }
      updates.orderIds = ids;
    }
    await db.update(preliminaryShipmentPlans).set(updates).where(eq(preliminaryShipmentPlans.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update preliminary shipment plan" });
  }
});

/** DELETE /api/orders/preliminary-plans/:id */
router.delete("/preliminary-plans/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.delete(preliminaryShipmentPlans).where(eq(preliminaryShipmentPlans.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete preliminary shipment plan" });
  }
});

// =============================================
// STANDARD ORDER ENDPOINTS
// =============================================

/**
 * GET /api/orders
 * Get all orders with partner info and order lines
 */
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        deliveryDate: orders.deliveryDate,
        status: orders.status,
        totalAmount: orders.totalAmount,
        partner: {
          id: businessPartners.id,
          businessName: businessPartners.businessName,
          code: businessPartners.code,
        },
        orderLineId: orderItems.id,
        itemId: orderItems.itemId,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
        totalPrice: orderItems.totalPrice,
        baseUnit: items.baseUnit,
        itemName: items.name,
      })
      .from(orders)
      .leftJoin(businessPartners, eq(orders.partnerId, businessPartners.id))
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(items, eq(orderItems.itemId, items.id))
      .orderBy(desc(orders.id));

    const grouped: Record<number, any> = {};

    for (const row of rows) {
      if (!grouped[row.id]) {
        grouped[row.id] = {
          id: row.id,
          orderNumber: row.orderNumber,
          deliveryDate: row.deliveryDate,
          status: row.status,
          totalAmount: row.totalAmount,
          partner: row.partner,
          items: [],
        };
      }

      if (row.orderLineId) {
        grouped[row.id].items.push({
          id: row.orderLineId,
          itemId: row.itemId,
          itemName: row.itemName,
          unitPrice: row.unitPrice,
          quantity: row.quantity,
          totalPrice: row.totalPrice,
          sellingUnits: row.baseUnit,
        });
      }
    }

    const result = Object.values(grouped).sort((a: any, b: any) => b.id - a.id);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/**
 * GET /api/orders/:id
 * Get single order with partner and order lines
 */
router.get("/:id", async (req, res) => {
  try {
    const orderNumber = req.params.id;
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        deliverySiteId: orders.deliverySiteId,
        partnerId: orders.partnerId,
        orderDate: orders.orderDate,
        deliveryDate: orders.deliveryDate,
        deliveryTime: orders.deliveryTime,
        status: orders.status,
        logisticsStatus: orders.logisticsStatus,
        driverId: orders.driverId,
        vehicleId: orders.vehicleId,
        loadingZone: orders.loadingZone,
        notes: orders.notes,
        totalAmount: orders.totalAmount,
        partner: {
          id: businessPartners.id,
          businessName: businessPartners.businessName,
          code: businessPartners.code,
        },
        orderLineId: orderItems.id,
        itemId: orderItems.itemId,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
        totalPrice: orderItems.totalPrice,
        baseUnit: items.baseUnit,
        itemName: items.name,
      })
      .from(orders)
      .leftJoin(businessPartners, eq(orders.partnerId, businessPartners.id))
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(items, eq(orderItems.itemId, items.id))
      .where(eq(orders.orderNumber, orderNumber));

    if (!rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const first = rows[0];

    const order = {
      id: first.id,
      orderNumber: first.orderNumber,
      deliverySiteId: first.deliverySiteId,
      partnerId: first.partnerId,
      orderDate: first.orderDate,
      deliveryDate: first.deliveryDate,
      deliveryTime: first.deliveryTime,
      status: first.status,
      logisticsStatus: first.logisticsStatus,
      driverId: first.driverId,
      vehicleId: first.vehicleId,
      loadingZone: first.loadingZone,
      notes: first.notes,
      totalAmount: first.totalAmount,
      partner: first.partner,
      items: rows
        .filter((r) => r.orderLineId)
        .map((r) => ({
          id: r.orderLineId,
          itemId: r.itemId,
          itemName: r.itemName,
          unitPrice: r.unitPrice,
          quantity: r.quantity,
          totalPrice: r.totalPrice,
          sellingUnits: r.baseUnit,
        })),
    };

    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch order" });
  }
});

/**
 * POST /api/orders
 * Create a new order with items
 */
router.post("/", async (req, res) => {
  try {
    const parsed = createOrderSchema.parse(req.body);

    // Look for existing order by poNumber + partnerId (for uploads) or explicit orderNumber
    let existingOrder = parsed.poNumber
      ? await db.query.orders.findFirst({
          where: sql`po_number = ${parsed.poNumber} AND partner_id = ${parsed.partnerId}`,
        })
      : parsed.orderNumber
        ? await db.query.orders.findFirst({ where: eq(orders.orderNumber, parsed.orderNumber) })
        : null;

    const linesPayload = (order: { id: number }) =>
      parsed.products.map((line) => ({
        orderId: order.id,
        itemId: line.itemId,
        unitPrice: line.unitPrice.toString(),
        totalPrice: (line.unitPrice * line.quantity).toString(),
        quantity: line.quantity,
      }));

    if (existingOrder) {
      return res.status(409).json({
        message: `PO ${parsed.poNumber} already exists (order ${existingOrder.orderNumber}). No order was created.`,
        existingOrderNumber: existingOrder.orderNumber,
      });
    }

    // Create new order
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `SO${year}${month}`;

    const latest = await db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(like(orders.orderNumber, `${prefix}%`))
      .orderBy(desc(orders.orderNumber))
      .limit(1);

    let runningNumber = 1;
    if (latest.length > 0 && latest[0].orderNumber) {
      runningNumber = Number(latest[0].orderNumber.slice(-3)) + 1;
    }

    const orderNumber = `${prefix}${String(runningNumber).padStart(3, "0")}`;

    let createdOrder: any;

    await db.transaction(async (tx) => {
      [createdOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          deliverySiteId: parsed.deliverySiteId,
          partnerId: parsed.partnerId,
          orderDate: parsed.orderDate ?? undefined,
          deliveryDate: parsed.deliveryDate ?? undefined,
          deliveryTime: parsed.deliveryTime,
          status: parsed.status ?? "pending",
          logisticsStatus: parsed.logisticsStatus ?? "pending",
          driverId: parsed.driverId,
          vehicleId: parsed.vehicleId,
          loadingZone: parsed.loadingZone,
          notes: parsed.notes,
          totalAmount: parsed.totalAmount ? parsed.totalAmount.toString() : undefined,
          poNumber: parsed.poNumber,
          source: parsed.source ?? "manual",
        })
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId: createdOrder.id,
        fromStatus: null,
        toStatus: createdOrder.status ?? "pending",
      });

      const lines = linesPayload(createdOrder);
      if (lines.length > 0) await tx.insert(orderItems).values(lines);
    });

    return res.status(201).json(createdOrder);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error(err);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

const offPlanSchema = z.object({
  date: z.string(),
  customerName: z.string().min(1),
  partnerId: z.number().optional(),
  poNumber: z.string().optional(),
  lines: z.array(z.object({ itemId: z.number(), qty: z.number().positive() })).min(1),
});

/**
 * POST /api/orders/off-plan — ออเดอร์นอกแผน: a walk-in sale paid from
 * existing FG stock, no price, outside production planning. productionRound
 * stays null, which is also what keeps it out of every round-scoped
 * Packing/BOM query — no extra item_role-style guard needed, same as the
 * isFgLine pattern elsewhere in this app but even simpler here. Reuses an
 * existing business partner by name when one matches; otherwise creates a
 * real new partner + its first delivery site on the fly, since several real
 * walk-in-type partners in this catalog (customer_type "ทั่วไป") have zero
 * delivery sites today and couldn't take a normal order at all.
 */
router.post("/off-plan", async (req, res) => {
  try {
    const parsed = offPlanSchema.parse(req.body);
    let createdOrder: any;

    await db.transaction(async (tx) => {
      let partner: any = null;
      if (parsed.partnerId) {
        [partner] = await tx.select().from(businessPartners).where(eq(businessPartners.id, parsed.partnerId));
      }
      if (!partner) {
        [partner] = await tx
          .select()
          .from(businessPartners)
          .where(sql`lower(${businessPartners.businessName}) = lower(${parsed.customerName})`)
          .limit(1);
      }
      if (!partner) {
        const [lastCode] = await tx
          .select({ code: businessPartners.code })
          .from(businessPartners)
          .where(like(businessPartners.code, "C%"))
          .orderBy(desc(businessPartners.code))
          .limit(1);
        const nextNum = lastCode?.code ? Number(lastCode.code.replace(/\D/g, "")) + 1 : 1;
        [partner] = await tx
          .insert(businessPartners)
          .values({
            code: `C${String(nextNum).padStart(3, "0")}`,
            nickname: parsed.customerName,
            partnerType: "customer",
            businessName: parsed.customerName,
            customerType: "walk_in",
          })
          .returning();
      }

      let [site] = await tx.select().from(deliverySites).where(eq(deliverySites.partnerId, partner.id)).limit(1);
      if (!site) {
        const existingSites = await tx.select({ id: deliverySites.id }).from(deliverySites).where(eq(deliverySites.partnerId, partner.id));
        const seq = String(existingSites.length + 1).padStart(4, "0");
        [site] = await tx
          .insert(deliverySites)
          .values({
            partnerId: partner.id,
            siteCode: `DS-${partner.code}-${seq}`,
            displayName: parsed.customerName,
            deliveryType: "direct_to_store",
          })
          .returning();
      }

      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const prefix = `SO${year}${month}`;
      const latest = await tx
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(like(orders.orderNumber, `${prefix}%`))
        .orderBy(desc(orders.orderNumber))
        .limit(1);
      let runningNumber = 1;
      if (latest.length > 0 && latest[0].orderNumber) runningNumber = Number(latest[0].orderNumber.slice(-3)) + 1;
      const orderNumber = `${prefix}${String(runningNumber).padStart(3, "0")}`;

      [createdOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          deliverySiteId: site.id,
          partnerId: partner.id,
          deliveryDate: parsed.date,
          status: "confirmed",
          logisticsStatus: "pending",
          poNumber: parsed.poNumber || null,
          source: "off_plan",
        })
        .returning();

      await tx.insert(orderStatusHistory).values({ orderId: createdOrder.id, fromStatus: null, toStatus: "confirmed" });

      await tx.insert(orderItems).values(
        parsed.lines.map(l => ({
          orderId: createdOrder.id,
          itemId: l.itemId,
          quantity: l.qty,
          unitPrice: "0",
          totalPrice: "0",
        })),
      );
    });

    return res.status(201).json(createdOrder);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ message: "Failed to create off-plan order" });
  }
});

/**
 * PUT /api/orders/:id
 * Update an existing order and its lines
 */
router.put("/:id", async (req, res) => {
  const orderNumber = req.params.id;

  try {
    const parsed = createOrderSchema.parse(req.body);

    const existingOrder = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (["delivered", "cancelled"].includes(existingOrder.status || "")) {
      return res.status(400).json({
        message: "This order cannot be edited in its current status",
      });
    }

    await db.transaction(async (tx) => {
      if (parsed.status && parsed.status !== existingOrder.status) {
        await tx.insert(orderStatusHistory).values({
          orderId: existingOrder.id,
          fromStatus: existingOrder.status,
          toStatus: parsed.status,
        });
      }

      await tx
        .update(orders)
        .set({
          deliverySiteId: parsed.deliverySiteId,
          partnerId: parsed.partnerId,
          orderDate: parsed.orderDate ? new Date(parsed.orderDate) : undefined,
          deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : undefined,
          deliveryTime: parsed.deliveryTime,
          status: parsed.status,
          logisticsStatus: parsed.logisticsStatus,
          driverId: parsed.driverId,
          vehicleId: parsed.vehicleId,
          loadingZone: parsed.loadingZone,
          notes: parsed.notes,
          totalAmount: parsed.totalAmount ? parsed.totalAmount.toString() : undefined,
        })
        .where(eq(orders.orderNumber, orderNumber));

      await tx.delete(orderItems).where(eq(orderItems.orderId, existingOrder.id));

      const linesPayload = parsed.products.map((line) => ({
        orderId: existingOrder.id,
        itemId: line.itemId,
        unitPrice: line.unitPrice.toString(),
        totalPrice: (line.unitPrice * line.quantity).toString(),
        quantity: line.quantity,
      }));

      if (linesPayload.length > 0) {
        await tx.insert(orderItems).values(linesPayload);
      }
    });

    return res.json({ orderNumber, message: "Order updated successfully" });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error(err);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.transaction(async (tx) => {
      // 1. delivery schedule items
      await tx.delete(deliveryScheduleItems).where(eq(deliveryScheduleItems.orderId, id));
      // 2. material requirements → production requests
      const prRows = await tx
        .select({ id: productionRequests.id })
        .from(productionRequests)
        .where(eq(productionRequests.orderId, id));
      if (prRows.length > 0) {
        const prIds = prRows.map((r) => r.id);
        await tx.delete(materialRequirements).where(inArray(materialRequirements.productionRequestId, prIds));
        await tx.delete(productionRequests).where(inArray(productionRequests.id, prIds));
      }
      // 3. order status history
      await tx.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, id));
      // 4. order items
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      // 5. the order itself
      await tx.delete(orders).where(eq(orders.id, id));
    });
    return res.json({ message: "Order deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete order" });
  }
});

// ── Trip CRUD ──────────────────────────────────────────────────────────────────

/** POST /api/trips — create a trip */
router.post("/trips", async (req, res) => {
  const { deliveryDate, productionRound, name, vehicleId, driverId, notes } = req.body;
  if (!deliveryDate) return res.status(400).json({ message: "deliveryDate required" });
  try {
    // Auto-number: count existing trips for this date
    const existing = await db
      .select({ id: trips.id })
      .from(trips)
      .where(eq(trips.deliveryDate, deliveryDate));
    const tripNumber = existing.length + 1;
    const [created] = await db.insert(trips).values({
      deliveryDate,
      productionRound: productionRound ?? null,
      tripNumber,
      name: name ?? `Trip ${tripNumber}`,
      vehicleId: vehicleId ?? null,
      driverId: driverId ?? null,
      notes: notes ?? null,
    }).returning();
    return res.json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create trip" });
  }
});

/** POST /api/orders/trips/from-plans — turn preliminary shipment plans into trips.
 * Body: { date }. Only plans of a CLOSED order round (a closed round's plans are
 * final) that have not been pulled before. One trip per plan: named after the
 * plan label, with the plan's vehicle; the plan's orders that are still
 * unassigned go on it in delivery-time order. Safe to call repeatedly — each
 * plan is converted once (pulled_at), so a deleted trip is never recreated. */
router.post("/trips/from-plans", async (req, res) => {
  const { date } = req.body as { date?: string };
  if (!date) return res.status(400).json({ message: "date required" });
  try {
    const result = await db.transaction(async tx => {
      const closed = await tx
        .select({ round: productionRoundStates.round, closedAt: productionRoundStates.closedAt })
        .from(productionRoundStates)
        .where(eq(productionRoundStates.deliveryDate, date));
      const closedRounds = closed.filter(r => r.closedAt != null).map(r => r.round);
      if (closedRounds.length === 0) return { created: 0, tripIds: [] as number[] };

      const plans = (
        await tx.select().from(preliminaryShipmentPlans).where(eq(preliminaryShipmentPlans.deliveryDate, date))
      )
        .filter(p => p.pulledAt == null && p.productionRound != null && closedRounds.includes(p.productionRound))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

      const tripIds: number[] = [];
      for (const plan of plans) {
        const ids = (plan.orderIds as number[]) ?? [];
        const candidates = ids.length
          ? await tx
              .select({ id: orders.id, deliveryTime: orders.deliveryTime, tripId: orders.tripId, status: orders.status })
              .from(orders)
              .where(inArray(orders.id, ids))
          : [];
        const free = candidates
          .filter(o => o.tripId == null && o.status !== "cancelled")
          .sort((a, b) => (a.deliveryTime ?? "99:99").localeCompare(b.deliveryTime ?? "99:99") || a.id - b.id);

        if (free.length > 0) {
          const existing = await tx.select({ id: trips.id }).from(trips).where(eq(trips.deliveryDate, date));
          const tripNumber = existing.length + 1;
          const [created] = await tx
            .insert(trips)
            .values({
              deliveryDate: date,
              productionRound: plan.productionRound,
              tripNumber,
              name: plan.label,
              vehicleId: plan.vehicleId ?? null,
              notes: plan.groupLabel ?? null,
            })
            .returning();
          for (let i = 0; i < free.length; i++) {
            await tx.update(orders).set({ tripId: created.id, stopOrder: i + 1 }).where(eq(orders.id, free[i].id));
          }
          tripIds.push(created.id);
        }
        await tx.update(preliminaryShipmentPlans).set({ pulledAt: new Date() }).where(eq(preliminaryShipmentPlans.id, plan.id));
      }
      return { created: tripIds.length, tripIds };
    });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create trips from plans" });
  }
});

/** PATCH /api/trips/:id — update trip fields */
router.patch("/trips/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const { name, vehicleId, driverId, notes, productionRound } = req.body;
  try {
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (vehicleId !== undefined) updates.vehicleId = vehicleId;
    if (driverId !== undefined) updates.driverId = driverId;
    if (notes !== undefined) updates.notes = notes;
    if (productionRound !== undefined) updates.productionRound = productionRound;
    await db.update(trips).set(updates).where(eq(trips.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update trip" });
  }
});

/** DELETE /api/trips/:id — delete trip and unassign its orders */
router.delete("/trips/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.update(orders).set({ tripId: null, stopOrder: null }).where(eq(orders.tripId, id));
    await db.delete(trips).where(eq(trips.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete trip" });
  }
});

/** PATCH /api/trips/:id/confirm — ยืนยันเที่ยว: lock in this trip's order
 * composition. No hard enforcement elsewhere yet (nothing asked for
 * order-reassignment locking) — this just stamps the real timestamp the
 * trip-status ladder and checkout's own gate both read. */
router.patch("/trips/:id/confirm", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [updated] = await db.update(trips).set({ confirmedAt: new Date() }).where(eq(trips.id, id)).returning();
    if (!updated) return res.status(404).json({ message: "Trip not found" });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to confirm trip" });
  }
});

/** PATCH /api/trips/:id/confirm-vehicle — นัดรถ: lock in the vehicle/driver
 * assignment already set on the trip. */
router.patch("/trips/:id/confirm-vehicle", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!trip.vehicleId || !trip.driverId) {
      return res.status(400).json({ message: "ต้องเลือกรถและคนขับก่อนนัดรถ" });
    }
    const [updated] = await db.update(trips).set({ vehicleConfirmedAt: new Date() }).where(eq(trips.id, id)).returning();
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to confirm vehicle" });
  }
});

/** PATCH /api/trips/:id/checkout — เช็คเอาท์: dispatch. Stamps departed_at
 * and marks every order in this trip as logistics_status='dispatched' —
 * reuses that real, already-existing column instead of adding a new one.
 * Requires the trip to already be confirmed (same server-side step-order
 * enforcement Packing's round-states already uses, not just a disabled
 * button client-side). */
router.patch("/trips/:id/checkout", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!trip.confirmedAt) {
      return res.status(400).json({ message: "ต้องยืนยันเที่ยวก่อนเช็คเอาท์" });
    }
    let updated: any;
    await db.transaction(async (tx) => {
      [updated] = await tx.update(trips).set({ departedAt: new Date() }).where(eq(trips.id, id)).returning();
      await tx.update(orders).set({ logisticsStatus: "dispatched" }).where(eq(orders.tripId, id));
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to check out trip" });
  }
});

/** PATCH /api/orders/assign-trip — assign orders to a trip (or unassign with tripId=null) */
router.patch("/assign-trip", async (req, res) => {
  const { orderIds, tripId, stopOrders } = req.body;
  // stopOrders: optional Record<orderId, stopOrder>
  if (!Array.isArray(orderIds)) return res.status(400).json({ message: "orderIds must be array" });
  try {
    for (let i = 0; i < orderIds.length; i++) {
      const oid = orderIds[i];
      const stop = stopOrders ? stopOrders[oid] ?? (i + 1) : tripId ? (i + 1) : null;
      await db.update(orders)
        .set({ tripId: tripId ?? null, stopOrder: stop })
        .where(eq(orders.id, oid));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to assign trip" });
  }
});

/** PATCH /api/orders/reorder-stops — update stop_order for a single order within a trip */
router.patch("/reorder-stops", async (req, res) => {
  const { tripId, orderedIds } = req.body;
  // orderedIds: number[] — the order IDs in their desired stop sequence
  if (!tripId || !Array.isArray(orderedIds)) return res.status(400).json({ message: "tripId and orderedIds required" });
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(orders)
        .set({ stopOrder: i + 1 })
        .where(eq(orders.id, orderedIds[i]));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to reorder stops" });
  }
});

export default router;
