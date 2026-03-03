import { Router } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import {
  drivers,
  insertDriverSchema,
  updateDriverSchema,
} from "@shared/schema";
import { z } from "zod";

const router = Router();

/**
 * GET /api/drivers
 */
router.get("/", async (_req, res) => {
  const data = await db.select().from(drivers).orderBy(drivers.id);
  res.json(data);
});

/**
 * GET /api/drivers/:id
 */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const driver = await db.query.drivers.findFirst({
    where: eq(drivers.id, id),
  });

  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  res.json(driver);
});

/**
 * POST /api/drivers
 * - CREATE if no id
 * - UPDATE if id exists
 */
router.post("/", async (req, res) => {
  try {
    const isUpdate = typeof req.body.id === "number";

    const payload = isUpdate
      ? updateDriverSchema.parse(req.body)
      : insertDriverSchema.parse(req.body);

    // 🔍 duplicate code check
    const existing = await db.query.drivers.findFirst({
      where: isUpdate
        ? and(eq(drivers.code, payload.code), ne(drivers.id, payload.id))
        : eq(drivers.code, payload.code),
    });

    if (existing) {
      return res.status(409).json({
        message: `Driver code "${payload.code}" already exists`,
        field: "code",
      });
    }

    // === UPDATE ===
    if (isUpdate) {
      const updated = await db
        .update(drivers)
        .set(payload)
        .where(eq(drivers.id, payload.id))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ message: "Driver not found" });
      }

      return res.json(updated[0]);
    }

    // === CREATE ===
    const created = await db.insert(drivers).values(payload).returning();

    return res.status(201).json(created[0]);

    res.json(result);
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
 * DELETE /api/drivers/:id
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  await db.delete(drivers).where(eq(drivers.id, id));
  res.status(204).send();
});

export default router;
