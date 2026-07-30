import { Router } from "express";
import { db } from "../db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/settings — return all settings as { key: value }
router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(systemSettings).orderBy(systemSettings.key);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch settings" });
  }
});

// PATCH /api/settings/:key — update a single setting value
router.patch("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ message: "value is required" });

    await db
      .update(systemSettings)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(systemSettings.key, key));

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update setting" });
  }
});

export default router;
