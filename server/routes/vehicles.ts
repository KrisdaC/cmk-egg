import { Router } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import {
  vehicles,
  insertVehicleSchema,
  updateVehicleSchema,
} from "@shared/schema";
import { z } from "zod";

const router = Router();

/**
 * GET /api/vehicles
 */
router.get("/", async (_req, res) => {
  const data = await db.select().from(vehicles).orderBy(vehicles.id);
  res.json(data);
});

/**
 * GET /api/vehicles/:id
 */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const vehicle = await db.query.vehicles.findFirst({
    where: eq(vehicles.id, id),
  });

  if (!vehicle) {
    return res.status(404).json({ message: "Vehicle not found" });
  }

  res.json(vehicle);
});

/**
 * POST /api/vehicles
 * - CREATE if no id
 * - UPDATE if id exists
 */
router.post("/", async (req, res) => {
  try {
    const isUpdate = typeof req.body.id === "number";

    const payload = isUpdate
      ? updateVehicleSchema.parse(req.body)
      : insertVehicleSchema.parse(req.body);

    const { id, code, plateNumber } = payload;

    // 🔍 duplicate CODE check
    const existingCode = await db.query.vehicles.findFirst({
      where: isUpdate
        ? and(eq(vehicles.code, code), ne(vehicles.id, id))
        : eq(vehicles.code, code),
    });

    if (existingCode) {
      return res.status(409).json({
        message: `Vehicle code "${code}" already exists`,
        field: "code",
      });
    }

    // 🔍 duplicate PLATE NUMBER check
    const existingPlate = await db.query.vehicles.findFirst({
      where: isUpdate
        ? and(eq(vehicles.plateNumber, plateNumber), ne(vehicles.id, id))
        : eq(vehicles.plateNumber, plateNumber),
    });

    if (existingPlate) {
      return res.status(409).json({
        message: `Plate number "${plateNumber}" already exists`,
        field: "plateNumber",
      });
    }

    // === UPDATE ===
    if (isUpdate) {
      const updated = await db
        .update(vehicles)
        .set(payload)
        .where(eq(vehicles.id, id))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      return res.json(updated[0]);
    }

    // === CREATE ===
    const created = await db.insert(vehicles).values(payload).returning();

    return res.status(201).json(created[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: err.errors,
      });
    }
    throw err;
  }
});

/**
 * DELETE /api/vehicles/:id
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const deleted = await db
    .delete(vehicles)
    .where(eq(vehicles.id, id))
    .returning();

  if (!deleted.length) {
    return res.status(404).json({ message: "Vehicle not found" });
  }

  res.status(204).send();
});

export default router;
