import { Router } from "express";
import { db } from "../db";
import { businessPartners } from "@shared/schema";
import { asc, eq } from "drizzle-orm";

const router = Router();

/**
 * GET /api/business-partners
 * Used for dropdowns / selectors
 */
router.get("/", async (req, res) => {
  try {
    const partners = await db
      .select({
        id: businessPartners.id,
        code: businessPartners.code,
        name: businessPartners.businessName,
        isActive: businessPartners.isActive,
      })
      .from(businessPartners)
      .where(eq(businessPartners.isActive, true))
      .orderBy(asc(businessPartners.businessName));

    res.json(partners);
  } catch (err) {
    console.error("Failed to fetch business partners");

    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);
    }

    res.status(500).json({
      message: "Failed to fetch business partners",
    });
  }
});

export default router;
