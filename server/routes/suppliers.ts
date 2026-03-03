import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertSupplierSchema, updateSupplierSchema } from "@shared/schema";
import { db } from "../db";
import { and, eq, ne } from "drizzle-orm";
import { suppliers } from "@shared/schema";

const router = express.Router();

router.get("/", async (req, res) => {
  const suppliers = await storage.getSuppliers();
  res.status(200).json(suppliers);
});

router.post("/", async (req, res) => {
  try {
    const isUpdate = typeof req.body.id === "number";

    const payload = isUpdate
      ? updateSupplierSchema.parse(req.body)
      : insertSupplierSchema.parse(req.body);

    const { id, code } = payload;

    // === DUPLICATE CODE CHECK ===
    const existing = await db.query.suppliers.findFirst({
      where: isUpdate
        ? and(eq(suppliers.code, code), ne(suppliers.id, id))
        : eq(suppliers.code, code),
    });

    if (existing) {
      return res.status(409).json({
        message: `Supplier code "${code}" already exists`,
        field: "code",
      });
    }

    // === UPDATE ===
    if (isUpdate && id !== undefined) {
      const updated = await db
        .update(suppliers)
        .set(payload)
        .where(eq(suppliers.id, id))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      return res.json(updated[0]);
    }

    // === CREATE ===
    const created = await db.insert(suppliers).values(payload).returning();

    return res.status(201).json(created[0]);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: err.errors,
      });
    }

    return res.status(400).json({
      error: err.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  const supplier = await storage.getSupplier(req.params.id);
  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found" });
  }
  res.status(200).json(supplier);
});

router.put("/:id", async (req, res) => {
  try {
    const supplierData = supplierSchema.parse(req.body);
    const updatedSupplier = await storage.updateSupplier(
      req.params.id,
      supplierData,
    );
    if (!updatedSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.status(200).json(updatedSupplier);
  } catch (error) {
    res.status(400).json({ error: error.errors || error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const deleted = await db
    .delete(suppliers)
    .where(eq(suppliers.id, id))
    .returning();

  if (!deleted.length) {
    return res.status(404).json({ error: "Supplier not found" });
  }

  return res.status(204).send();
});

export default router;
