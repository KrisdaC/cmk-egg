// server/routes/orders.ts
import { Router } from "express";
import { db } from "../db";
import {
  orders,
  orderItems,
  businessPartners,
  orderStatusHistory,
  items,
  productionRequests,
  materialRequirements,
  deliveryScheduleItems,
  productionRoundStates,
  trips,
  vehicles,
  drivers,
} from "@shared/schema";
import { desc, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

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
 * GET /api/orders/daily?date=YYYY-MM-DD
 * Returns all orders for a delivery date, grouped by partner.
 * Used by the Orders Grid view.
 */
router.get("/daily", async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const rows = await db.execute(sql`
      SELECT
        o.id              AS order_id,
        o.order_number,
        o.po_number,
        o.delivery_date,
        o.order_date,
        o.status,
        o.production_round,
        o.trip_id,
        o.stop_order,
        bp.id             AS partner_id,
        bp.nickname       AS partner_name,
        bp.code           AS partner_code,
        ds.id             AS delivery_site_id,
        ds.display_name   AS delivery_site_name,
        oi.id             AS line_id,
        oi.item_id,
        oi.quantity       AS po_qty,
        COALESCE(oi.accepted_qty, oi.quantity) AS order_qty,
        oi.planning_qty,
        i.sku,
        i.name            AS item_name,
        i.selling_unit,
        i.eggs_per_pack,
        i.primary_size,
        i.secondary_size
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
          orderDate: row.order_date,
          status: row.status,
          productionRound: row.production_round ?? null,
          tripId: row.trip_id ?? null,
          stopOrder: row.stop_order ?? null,
          deliverySiteId: row.delivery_site_id,
          deliverySiteName: row.delivery_site_name,
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
          eggsPerPack: row.eggs_per_pack ? Number(row.eggs_per_pack) : 1,
          primarySize: row.primary_size,
          secondarySize: row.secondary_size,
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
             t.vehicle_id, v.plate_number AS vehicle_plate, v.vehicle_type,
             t.driver_id,  d.name         AS driver_name
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
      driverId: r.driver_id ?? null,
      driverName: r.driver_name ?? null,
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
// Body: { orderIds: number[], round: number | null }
// Assigns (or clears) a production round for the given order IDs.

router.patch("/assign-round", async (req, res) => {
  try {
    const { orderIds, round } = req.body as { orderIds: number[]; round: number | null };
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds required" });
    }
    if (round !== null && (round < 1 || round > 4)) {
      return res.status(400).json({ message: "round must be 1–4 or null" });
    }
    await db
      .update(orders)
      .set({ productionRound: round })
      .where(inArray(orders.id, orderIds));
    return res.json({ updated: orderIds.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to assign round" });
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
