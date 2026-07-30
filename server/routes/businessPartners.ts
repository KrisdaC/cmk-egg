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
        nickname: businessPartners.nickname,
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

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select({
        id: businessPartners.id,
        code: businessPartners.code,
        nickname: businessPartners.nickname,
        businessName: businessPartners.businessName,
        taxId: businessPartners.taxId,
        addressLine1: businessPartners.addressLine1,
        addressLine2: businessPartners.addressLine2,
        district: businessPartners.district,
        subDistrict: businessPartners.subDistrict,
        province: businessPartners.province,
        postalCode: businessPartners.postalCode,
        creditDays: businessPartners.creditDays,
      })
      .from(businessPartners)
      .where(eq(businessPartners.id, id));

    if (!rows.length) return res.status(404).json({ message: "Partner not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch partner" });
  }
});

export default router;
