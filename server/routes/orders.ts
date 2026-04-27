// server/routes/orders.ts
import { Router } from "express";
import { db } from "../db";
import {
  orders,
  orderItems,
  businessPartners,
  orderStatusHistory,
  items,
} from "@shared/schema";
import { desc, eq, like } from "drizzle-orm";
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
  products: z.array(
    z.object({
      itemId: z.number(),
      unitPrice: z.number(),
      quantity: z.number().min(1),
    }),
  ),
});

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

    const existing = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, parsed.orderNumber),
    });

    if (existing) {
      return res.status(409).json({
        message: `Order number "${parsed.orderNumber}" already exists`,
        field: "orderNumber",
      });
    }

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
          orderDate: parsed.orderDate ? new Date(parsed.orderDate) : undefined,
          deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : undefined,
          deliveryTime: parsed.deliveryTime,
          status: parsed.status ?? "pending",
          logisticsStatus: parsed.logisticsStatus ?? "pending",
          driverId: parsed.driverId,
          vehicleId: parsed.vehicleId,
          loadingZone: parsed.loadingZone,
          notes: parsed.notes,
          totalAmount: parsed.totalAmount ? parsed.totalAmount.toString() : undefined,
        })
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId: createdOrder.id,
        fromStatus: null,
        toStatus: createdOrder.status ?? "pending",
      });

      const linesPayload = parsed.products.map((line) => ({
        orderId: createdOrder.id,
        itemId: line.itemId,
        unitPrice: line.unitPrice.toString(),
        totalPrice: (line.unitPrice * line.quantity).toString(),
        quantity: line.quantity,
      }));

      if (linesPayload.length > 0) {
        await tx.insert(orderItems).values(linesPayload);
      }
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

export default router;
