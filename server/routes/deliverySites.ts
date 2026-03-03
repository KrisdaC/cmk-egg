import { Router } from "express";
import { db } from "../db";
import { businessPartners } from "@shared/schema";
import { asc, eq } from "drizzle-orm";
const router = Router();

// -----------------------------
// Delivery Sites
// -----------------------------

// GET /delivery-sites
router.get("/delivery-sites", async (req, res) => {
  // TODO: Validate query params if needed
  // TODO: Fetch delivery sites from storage
  // Example: const sites = await storage.deliverySites.getAll();
  // res.json(sites);
  res.status(501).json({ message: "Not implemented" });
});

// GET /delivery-sites/:id
router.get("/delivery-sites/:id", async (req, res) => {
  // TODO: Validate id param
  // TODO: Fetch delivery site by id from storage
  // Example: const site = await storage.deliverySites.getById(req.params.id);
  // if (!site) return res.status(404).json({ message: "Delivery site not found" });
  // res.json(site);
  res.status(501).json({ message: "Not implemented" });
});

// POST /delivery-sites
router.post("/delivery-sites", async (req, res) => {
  // TODO: Validate req.body
  // TODO: Create delivery site in storage
  // Example: const newSite = await storage.deliverySites.create(req.body);
  // res.status(201).json(newSite);
  res.status(501).json({ message: "Not implemented" });
});

// PATCH /delivery-sites/:id
router.patch("/delivery-sites/:id", async (req, res) => {
  // TODO: Validate id param and req.body
  // TODO: Update delivery site in storage
  // Example: const updated = await storage.deliverySites.update(req.params.id, req.body);
  // if (!updated) return res.status(404).json({ message: "Delivery site not found" });
  // res.json(updated);
  res.status(501).json({ message: "Not implemented" });
});

// DELETE /delivery-sites/:id
router.delete("/delivery-sites/:id", async (req, res) => {
  // TODO: Validate id param
  // TODO: Delete delivery site in storage
  // Example: const deleted = await storage.deliverySites.delete(req.params.id);
  // if (!deleted) return res.status(404).json({ message: "Delivery site not found" });
  // res.status(204).end();
  res.status(501).json({ message: "Not implemented" });
});

export default router;
