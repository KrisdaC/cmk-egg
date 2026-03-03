import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { authRouter } from "./auth/routes";
import finishedGoodsRoutes from "./routes/finishedGoods";
import businessPartnersRoutes from "./routes/businessPartners";
import suppliersRoutes from "./routes/suppliers";
import driversRoutes from "./routes/drivers";
import vehiclesRoutes from "./routes/vehicles";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  console.log("REGISTER ROUTES CALLED");
  app.use("/api/auth", authRouter);

  app.use("/api/finished-goods", finishedGoodsRoutes);
  app.use("/api/business-partners", businessPartnersRoutes);
  app.use("/api/suppliers", suppliersRoutes);
  app.use("/api/drivers", driversRoutes);
  app.use("/api/vehicles", vehiclesRoutes);
  // app.use("/api/customer-accounts", customerAccountsRoutes);
  // app.use("/api/delivery-sites", deliverySitesRoutes);

  // === Suppliers ===
  // app.get(api.suppliers.list.path, async (req, res) => {
  //   const data = await storage.getSuppliers();
  //   res.json(data);
  // });
  // app.post(api.suppliers.create.path, async (req, res) => {
  //   try {
  //     const input = api.suppliers.create.input.parse(req.body);
  //     const result = await storage.createSupplier(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.suppliers.get.path, async (req, res) => {
  //   const data = await storage.getSupplier(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Supplier not found" });
  //   res.json(data);
  // });
  // app.patch(api.suppliers.update.path, async (req, res) => {
  //   const data = await storage.updateSupplier(Number(req.params.id), req.body);
  //   if (!data) return res.status(404).json({ message: "Supplier not found" });
  //   res.json(data);
  // });

  // === Drivers ===
  // app.get(api.drivers.list.path, async (req, res) => {
  //   const data = await storage.getDrivers();
  //   res.json(data);
  // });
  // app.post(api.drivers.create.path, async (req, res) => {
  //   try {
  //     const input = api.drivers.create.input.parse(req.body);
  //     const result = await storage.createDriver(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.drivers.get.path, async (req, res) => {
  //   const data = await storage.getDriver(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Driver not found" });
  //   res.json(data);
  // });
  // app.patch(api.drivers.update.path, async (req, res) => {
  //   const data = await storage.updateDriver(Number(req.params.id), req.body);
  //   if (!data) return res.status(404).json({ message: "Driver not found" });
  //   res.json(data);
  // });

  // === Vehicles ===
  // app.get(api.vehicles.list.path, async (req, res) => {
  //   const data = await storage.getVehicles();
  //   res.json(data);
  // });
  // app.post(api.vehicles.create.path, async (req, res) => {
  //   try {
  //     const input = api.vehicles.create.input.parse(req.body);
  //     const result = await storage.createVehicle(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.vehicles.get.path, async (req, res) => {
  //   const data = await storage.getVehicle(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Vehicle not found" });
  //   res.json(data);
  // });
  // app.patch(api.vehicles.update.path, async (req, res) => {
  //   const data = await storage.updateVehicle(Number(req.params.id), req.body);
  //   if (!data) return res.status(404).json({ message: "Vehicle not found" });
  //   res.json(data);
  // });

  // === Customer Accounts ===
  app.get(api.customerAccounts.list.path, async (req, res) => {
    const data = await storage.getCustomerAccounts();
    res.json(data);
  });
  app.post(api.customerAccounts.create.path, async (req, res) => {
    try {
      const input = api.customerAccounts.create.input.parse(req.body);
      const result = await storage.createCustomerAccount(input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });
  app.get(api.customerAccounts.get.path, async (req, res) => {
    const data = await storage.getCustomerAccount(Number(req.params.id));
    if (!data)
      return res.status(404).json({ message: "Customer account not found" });
    res.json(data);
  });
  app.patch(api.customerAccounts.update.path, async (req, res) => {
    const data = await storage.updateCustomerAccount(
      Number(req.params.id),
      req.body,
    );
    if (!data)
      return res.status(404).json({ message: "Customer account not found" });
    res.json(data);
  });
  app.delete("/api/customer-accounts/:id", async (req, res) => {
    await storage.deleteCustomerAccount(Number(req.params.id));
    res.status(204).send();
  });

  // === Delivery Sites ===
  app.get(api.deliverySites.list.path, async (req, res) => {
    const data = await storage.getDeliverySites();
    res.json(data);
  });
  app.post(api.deliverySites.create.path, async (req, res) => {
    try {
      const input = api.deliverySites.create.input.parse(req.body);
      const result = await storage.createDeliverySite(input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });
  app.get(api.deliverySites.get.path, async (req, res) => {
    const data = await storage.getDeliverySite(Number(req.params.id));
    if (!data)
      return res.status(404).json({ message: "Delivery site not found" });
    res.json(data);
  });
  app.patch(api.deliverySites.update.path, async (req, res) => {
    const data = await storage.updateDeliverySite(
      Number(req.params.id),
      req.body,
    );
    if (!data)
      return res.status(404).json({ message: "Delivery site not found" });
    res.json(data);
  });
  app.delete("/api/delivery-sites/:id", async (req, res) => {
    await storage.deleteDeliverySite(Number(req.params.id));
    res.status(204).send();
  });

  // === Customer Contacts ===
  app.get(api.customerContacts.list.path, async (req, res) => {
    const data = await storage.getCustomerContacts();
    res.json(data);
  });
  app.post(api.customerContacts.create.path, async (req, res) => {
    try {
      const input = api.customerContacts.create.input.parse(req.body);
      const result = await storage.createCustomerContact(input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });
  app.get(api.customerContacts.get.path, async (req, res) => {
    const data = await storage.getCustomerContact(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Contact not found" });
    res.json(data);
  });
  app.patch(api.customerContacts.update.path, async (req, res) => {
    const data = await storage.updateCustomerContact(
      Number(req.params.id),
      req.body,
    );
    if (!data) return res.status(404).json({ message: "Contact not found" });
    res.json(data);
  });
  app.delete("/api/customer-contacts/:id", async (req, res) => {
    await storage.deleteCustomerContact(Number(req.params.id));
    res.status(204).send();
  });

  // === Stock Locations ===
  // app.get(api.stockLocations.list.path, async (req, res) => {
  //   const data = await storage.getStockLocations();
  //   res.json(data);
  // });
  // app.post(api.stockLocations.create.path, async (req, res) => {
  //   try {
  //     const input = api.stockLocations.create.input.parse(req.body);
  //     const result = await storage.createStockLocation(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });

  // === Egg Sizes (LEGACY) ===
  // app.get(api.eggSizes.list.path, async (req, res) => {
  //   const data = await storage.getEggSizes();
  //   res.json(data);
  // });
  // app.post(api.eggSizes.create.path, async (req, res) => {
  //   try {
  //     const input = api.eggSizes.create.input.parse(req.body);
  //     const result = await storage.createEggSize(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });

  // === NEW ITEM MASTER SYSTEM ===

  // Egg Grade Rules
  // app.get(api.eggGradeRules.list.path, async (req, res) => {
  //   const data = await storage.getEggGradeRules();
  //   res.json(data);
  // });
  // app.get(api.eggGradeRules.get.path, async (req, res) => {
  //   const data = await storage.getEggGradeRule(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Grade rule not found" });
  //   res.json(data);
  // });

  // Item Master
  // app.get(api.itemMaster.list.path, async (req, res) => {
  //   const data = await storage.getItemMasterList();
  //   res.json(data);
  // });
  // app.get(api.itemMaster.listByCategory.path, async (req, res) => {
  //   const data = await storage.getItemMasterByCategory(req.params.category);
  //   res.json(data);
  // });
  // app.get(api.itemMaster.get.path, async (req, res) => {
  //   const data = await storage.getItemMaster(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Item not found" });
  //   res.json(data);
  // });
  // app.post(api.itemMaster.create.path, async (req, res) => {
  //   try {
  //     const input = api.itemMaster.create.input.parse(req.body);
  //     const result = await storage.createItemMaster(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.itemMaster.update.path, async (req, res) => {
  //   const data = await storage.updateItemMaster(
  //     Number(req.params.id),
  //     req.body,
  //   );
  //   if (!data) return res.status(404).json({ message: "Item not found" });
  //   res.json(data);
  // });
  // app.delete(api.itemMaster.delete.path, async (req, res) => {
  //   await storage.deleteItemMaster(Number(req.params.id));
  //   res.status(204).send();
  // });

  // === Pack Types (Lookup Table) ===
  // app.get(api.packTypes.list.path, async (req, res) => {
  //   const data = await storage.getPackTypes();
  //   res.json(data);
  // });
  // app.get(api.packTypes.get.path, async (req, res) => {
  //   const data = await storage.getPackType(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Pack type not found" });
  //   res.json(data);
  // });
  // app.post(api.packTypes.create.path, async (req, res) => {
  //   try {
  //     const input = api.packTypes.create.input.parse(req.body);
  //     const result = await storage.createPackType(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.packTypes.update.path, async (req, res) => {
  //   const data = await storage.updatePackType(Number(req.params.id), req.body);
  //   if (!data) return res.status(404).json({ message: "Pack type not found" });
  //   res.json(data);
  // });
  // app.delete(api.packTypes.delete.path, async (req, res) => {
  //   await storage.deletePackType(Number(req.params.id));
  //   res.status(204).send();
  // });

  // === Egg Grade Compositions ===
  // app.get(api.eggGradeCompositions.list.path, async (req, res) => {
  //   const data = await storage.getEggGradeCompositions();
  //   res.json(data);
  // });
  // app.get(api.eggGradeCompositions.get.path, async (req, res) => {
  //   const data = await storage.getEggGradeComposition(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Composition not found" });
  //   res.json(data);
  // });
  // app.get(api.eggGradeCompositions.getByCode.path, async (req, res) => {
  //   const data = await storage.getEggGradeCompositionByCode(req.params.code);
  //   if (!data)
  //     return res.status(404).json({ message: "Composition not found" });
  //   res.json(data);
  // });
  // app.post(api.eggGradeCompositions.create.path, async (req, res) => {
  //   try {
  //     const input = api.eggGradeCompositions.create.input.parse(req.body);
  //     const { items, ...compData } = input;
  //     if (!items || items.length === 0) {
  //       return res
  //         .status(400)
  //         .json({ message: "ต้องระบุอย่างน้อย 1 เบอร์", field: "items" });
  //     }
  //     // Check for duplicate code
  //     if (
  //       compData.compositionCode &&
  //       (await storage.compositionCodeExists(compData.compositionCode))
  //     ) {
  //       return res
  //         .status(400)
  //         .json({ message: "รหัสสูตรนี้มีอยู่แล้ว", field: "compositionCode" });
  //     }
  //     const totalPercentage = items.reduce((sum, g) => {
  //       const pct = parseFloat(g.percentage);
  //       if (isNaN(pct)) throw new Error("Invalid percentage");
  //       return sum + pct;
  //     }, 0);
  //     if (Math.abs(totalPercentage - 100) > 0.01) {
  //       return res.status(400).json({
  //         message: "ผลรวมเปอร์เซ็นต์ต้องเท่ากับ 100%",
  //         field: "items",
  //       });
  //     }
  //     const result = await storage.createEggGradeComposition(compData, items);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     if (err instanceof Error && err.message === "Invalid percentage") {
  //       return res
  //         .status(400)
  //         .json({ message: "เปอร์เซ็นต์ไม่ถูกต้อง", field: "items" });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.eggGradeCompositions.update.path, async (req, res) => {
  //   try {
  //     const input = api.eggGradeCompositions.update.input.parse(req.body);
  //     const { items, ...compData } = input;
  //     if (items !== undefined) {
  //       if (items.length === 0) {
  //         return res
  //           .status(400)
  //           .json({ message: "ต้องระบุอย่างน้อย 1 เบอร์", field: "items" });
  //       }
  //       const totalPercentage = items.reduce((sum, g) => {
  //         const pct = parseFloat(g.percentage);
  //         if (isNaN(pct)) throw new Error("Invalid percentage");
  //         return sum + pct;
  //       }, 0);
  //       if (Math.abs(totalPercentage - 100) > 0.01) {
  //         return res.status(400).json({
  //           message: "ผลรวมเปอร์เซ็นต์ต้องเท่ากับ 100%",
  //           field: "items",
  //         });
  //       }
  //     }
  //     const data = await storage.updateEggGradeComposition(
  //       Number(req.params.id),
  //       compData,
  //       items,
  //     );
  //     if (!data)
  //       return res.status(404).json({ message: "Composition not found" });
  //     res.json(data);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     if (err instanceof Error && err.message === "Invalid percentage") {
  //       return res
  //         .status(400)
  //         .json({ message: "เปอร์เซ็นต์ไม่ถูกต้อง", field: "items" });
  //     }
  //     throw err;
  //   }
  // });
  // app.delete(api.eggGradeCompositions.delete.path, async (req, res) => {
  //   await storage.deleteEggGradeComposition(Number(req.params.id));
  //   res.status(204).send();
  // });

  // === FG Pack Specs ===
  // app.get(api.fgPackSpecs.nextCode.path, async (req, res) => {
  //   const specCode = await storage.getNextPackSpecCode();
  //   res.json({ specCode });
  // });
  // app.get(api.fgPackSpecs.list.path, async (req, res) => {
  //   const data = await storage.getFgPackSpecs();
  //   res.json(data);
  // });
  // app.get(api.fgPackSpecs.get.path, async (req, res) => {
  //   const data = await storage.getFgPackSpec(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Pack spec not found" });
  //   res.json(data);
  // });
  // app.post(api.fgPackSpecs.create.path, async (req, res) => {
  //   try {
  //     const input = api.fgPackSpecs.create.input.parse(req.body);
  //     const { grades, ...specData } = input;
  //     if (!grades || grades.length === 0) {
  //       return res
  //         .status(400)
  //         .json({ message: "ต้องระบุอย่างน้อย 1 เบอร์", field: "grades" });
  //     }
  //     const totalPercentage = grades.reduce((sum, g) => {
  //       const pct = parseFloat(g.percentage);
  //       if (isNaN(pct)) throw new Error("Invalid percentage");
  //       return sum + pct;
  //     }, 0);
  //     if (Math.abs(totalPercentage - 100) > 0.01) {
  //       return res.status(400).json({
  //         message: "ผลรวมเปอร์เซ็นต์ต้องเท่ากับ 100%",
  //         field: "grades",
  //       });
  //     }
  //     const result = await storage.createFgPackSpec(specData, grades);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     if (err instanceof Error && err.message === "Invalid percentage") {
  //       return res
  //         .status(400)
  //         .json({ message: "เปอร์เซ็นต์ไม่ถูกต้อง", field: "grades" });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.fgPackSpecs.update.path, async (req, res) => {
  //   try {
  //     const input = api.fgPackSpecs.update.input.parse(req.body);
  //     const { grades, ...specData } = input;
  //     if (grades !== undefined) {
  //       if (grades.length === 0) {
  //         return res
  //           .status(400)
  //           .json({ message: "ต้องระบุอย่างน้อย 1 เบอร์", field: "grades" });
  //       }
  //       const totalPercentage = grades.reduce((sum, g) => {
  //         const pct = parseFloat(g.percentage);
  //         if (isNaN(pct)) throw new Error("Invalid percentage");
  //         return sum + pct;
  //       }, 0);
  //       if (Math.abs(totalPercentage - 100) > 0.01) {
  //         return res.status(400).json({
  //           message: "ผลรวมเปอร์เซ็นต์ต้องเท่ากับ 100%",
  //           field: "grades",
  //         });
  //       }
  //       const data = await storage.updateFgPackSpec(
  //         Number(req.params.id),
  //         specData,
  //         grades,
  //       );
  //       if (!data)
  //         return res.status(404).json({ message: "Pack spec not found" });
  //       res.json(data);
  //     } else {
  //       const data = await storage.updateFgPackSpec(
  //         Number(req.params.id),
  //         specData,
  //       );
  //       if (!data)
  //         return res.status(404).json({ message: "Pack spec not found" });
  //       res.json(data);
  //     }
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     if (err instanceof Error && err.message === "Invalid percentage") {
  //       return res
  //         .status(400)
  //         .json({ message: "เปอร์เซ็นต์ไม่ถูกต้อง", field: "grades" });
  //     }
  //     throw err;
  //   }
  // });
  // app.delete(api.fgPackSpecs.delete.path, async (req, res) => {
  //   await storage.deleteFgPackSpec(Number(req.params.id));
  //   res.status(204).send();
  // });

  // === Partner-Product Pack Specs (Many-to-Many) ===
  // app.get(api.partnerProductPackSpecs.list.path, async (req, res) => {
  //   const data = await storage.getPartnerProductPackSpecs();
  //   res.json(data);
  // });
  // app.get(api.partnerProductPackSpecs.listByPartner.path, async (req, res) => {
  //   const data = await storage.getPartnerProductPackSpecs(
  //     Number(req.params.partnerId),
  //   );
  //   res.json(data);
  // });
  // app.post(api.partnerProductPackSpecs.create.path, async (req, res) => {
  //   try {
  //     const input = api.partnerProductPackSpecs.create.input.parse(req.body);
  //     const result = await storage.createPartnerProductPackSpec(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.partnerProductPackSpecs.update.path, async (req, res) => {
  //   const data = await storage.updatePartnerProductPackSpec(
  //     Number(req.params.id),
  //     req.body,
  //   );
  //   if (!data)
  //     return res
  //       .status(404)
  //       .json({ message: "Partner product pack spec not found" });
  //   res.json(data);
  // });
  // app.delete(api.partnerProductPackSpecs.delete.path, async (req, res) => {
  //   await storage.deletePartnerProductPackSpec(Number(req.params.id));
  //   res.status(204).send();
  // });

  // // === Egg Receiving Lots (OPERATIONAL) ===
  // app.get(api.eggReceivingLots.nextLotNumber.path, async (req, res) => {
  //   const lotNumber = await storage.getNextLotNumber();
  //   res.json({ lotNumber });
  // });
  // app.get(api.eggReceivingLots.list.path, async (req, res) => {
  //   const data = await storage.getEggReceivingLots();
  //   res.json(data);
  // });
  // app.post(api.eggReceivingLots.create.path, async (req, res) => {
  //   try {
  //     const input = api.eggReceivingLots.create.input.parse(req.body);
  //     const result = await storage.createEggReceivingLot({
  //       ...input,
  //       totalEggs: 3000,
  //       totalTrays: 10,
  //       status: "received",
  //     });
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.eggReceivingLots.get.path, async (req, res) => {
  //   const data = await storage.getEggReceivingLot(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Egg receiving lot not found" });
  //   res.json(data);
  // });
  // app.patch(api.eggReceivingLots.update.path, async (req, res) => {
  //   const { totalEggs, totalTrays, ...safeData } = req.body;
  //   const data = await storage.updateEggReceivingLot(
  //     Number(req.params.id),
  //     safeData,
  //   );
  //   if (!data)
  //     return res.status(404).json({ message: "Egg receiving lot not found" });
  //   res.json(data);
  // });
  // app.delete(api.eggReceivingLots.delete.path, async (req, res) => {
  //   await storage.deleteEggReceivingLot(Number(req.params.id));
  //   res.status(204).send();
  // });

  // === Vendors ===
  // app.get(api.vendors.list.path, async (req, res) => {
  //   const data = await storage.getVendors();
  //   res.json(data);
  // });
  // app.post(api.vendors.create.path, async (req, res) => {
  //   try {
  //     const input = api.vendors.create.input.parse(req.body);
  //     const result = await storage.createVendor(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.vendors.get.path, async (req, res) => {
  //   const data = await storage.getVendor(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Vendor not found" });
  //   res.json(data);
  // });

  // === Grading Lots ===
  // app.get(api.gradingLots.list.path, async (req, res) => {
  //   const data = await storage.getGradingLots();
  //   res.json(data);
  // });
  // app.post(api.gradingLots.create.path, async (req, res) => {
  //   try {
  //     const input = api.gradingLots.create.input.parse(req.body);
  //     const result = await storage.createGradingLot(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.gradingLots.get.path, async (req, res) => {
  //   const data = await storage.getGradingLot(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Grading lot not found" });
  //   res.json(data);
  // });
  // app.patch(api.gradingLots.update.path, async (req, res) => {
  //   const data = await storage.updateGradingLot(
  //     Number(req.params.id),
  //     req.body,
  //   );
  //   if (!data)
  //     return res.status(404).json({ message: "Grading lot not found" });
  //   res.json(data);
  // });

  // === Products ===
  // app.get(api.products.list.path, async (req, res) => {
  //   const data = await storage.getProducts();
  //   res.json(data);
  // });
  // app.post(api.products.create.path, async (req, res) => {
  //   try {
  //     const input = api.products.create.input.parse(req.body);
  //     const result = await storage.createProduct(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.products.get.path, async (req, res) => {
  //   const data = await storage.getProduct(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Product not found" });
  //   res.json(data);
  // });
  // app.patch(api.products.update.path, async (req, res) => {
  //   const data = await storage.updateProduct(Number(req.params.id), req.body);
  //   if (!data) return res.status(404).json({ message: "Product not found" });
  //   res.json(data);
  // });

  // === Raw Materials ===
  // app.get(api.rawMaterials.list.path, async (req, res) => {
  //   const data = await storage.getRawMaterials();
  //   res.json(data);
  // });
  // app.post(api.rawMaterials.create.path, async (req, res) => {
  //   try {
  //     const input = api.rawMaterials.create.input.parse(req.body);
  //     const result = await storage.createRawMaterial(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.rawMaterials.get.path, async (req, res) => {
  //   const data = await storage.getRawMaterial(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Raw material not found" });
  //   res.json(data);
  // });
  // app.patch(api.rawMaterials.update.path, async (req, res) => {
  //   const data = await storage.updateRawMaterial(
  //     Number(req.params.id),
  //     req.body,
  //   );
  //   if (!data)
  //     return res.status(404).json({ message: "Raw material not found" });
  //   res.json(data);
  // });

  // === Product Recipes ===
  // app.get(api.productRecipes.list.path, async (req, res) => {
  //   const data = await storage.getProductRecipes(Number(req.params.productId));
  //   res.json(data);
  // });
  // app.post(api.productRecipes.create.path, async (req, res) => {
  //   try {
  //     const input = api.productRecipes.create.input.parse(req.body);
  //     const result = await storage.createProductRecipe(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.delete(api.productRecipes.delete.path, async (req, res) => {
  //   await storage.deleteProductRecipe(Number(req.params.id));
  //   res.status(204).send();
  // });

  // === Price Adjustments ===
  // app.get(api.priceAdjustments.listPending.path, async (req, res) => {
  //   const data = await storage.getPendingPriceAdjustments();
  //   res.json(data);
  // });
  // app.post(api.priceAdjustments.create.path, async (req, res) => {
  //   try {
  //     const input = api.priceAdjustments.create.input.parse(req.body);
  //     const result = await storage.createPriceAdjustment(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.priceAdjustments.approve.path, async (req, res) => {
  //   const approvedBy = (req as any).user?.claims?.sub || "system";
  //   const data = await storage.approvePriceAdjustment(
  //     Number(req.params.id),
  //     approvedBy,
  //   );
  //   if (!data) return res.status(404).json({ message: "Adjustment not found" });
  //   res.json(data);
  // });
  // app.patch(api.priceAdjustments.reject.path, async (req, res) => {
  //   const data = await storage.rejectPriceAdjustment(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Adjustment not found" });
  //   res.json(data);
  // });

  // === Goods Receiving ===
  // app.get(api.goodsReceiving.list.path, async (req, res) => {
  //   const data = await storage.getGoodsReceivingList();
  //   res.json(data);
  // });
  // app.post(api.goodsReceiving.create.path, async (req, res) => {
  //   try {
  //     const input = api.goodsReceiving.create.input.parse(req.body);
  //     const result = await storage.createGoodsReceiving(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.goodsReceiving.get.path, async (req, res) => {
  //   const data = await storage.getGoodsReceiving(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Goods receiving not found" });
  //   res.json(data);
  // });

  // === Grading Activities ===
  // app.get(api.gradingActivities.list.path, async (req, res) => {
  //   const data = await storage.getGradingActivities();
  //   res.json(data);
  // });
  // app.post(api.gradingActivities.create.path, async (req, res) => {
  //   try {
  //     const input = api.gradingActivities.create.input.parse(req.body);
  //     const result = await storage.createGradingActivity(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.gradingActivities.byGr.path, async (req, res) => {
  //   const data = await storage.getGradingByGr(Number(req.params.grId));
  //   res.json(data);
  // });

  // === Sized Egg Stock ===
  // app.get(api.sizedEggStock.list.path, async (req, res) => {
  //   const data = await storage.getSizedEggStock();
  //   res.json(data);
  // });
  // app.get(api.sizedEggStock.summary.path, async (req, res) => {
  //   const data = await storage.getSizedEggStockSummary();
  //   res.json(data);
  // });

  // === Orders ===
  // app.get(api.orders.list.path, async (req, res) => {
  //   const data = await storage.getOrders();
  //   res.json(data);
  // });
  // app.post(api.orders.create.path, async (req, res) => {
  //   try {
  //     const { items, ...orderData } = api.orders.create.input.parse(req.body);
  //     const result = await storage.createOrder(orderData, items);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.orders.get.path, async (req, res) => {
  //   const data = await storage.getOrder(Number(req.params.id));
  //   if (!data) return res.status(404).json({ message: "Order not found" });
  //   res.json(data);
  // });
  // app.patch(api.orders.updateStatus.path, async (req, res) => {
  //   const { status } = api.orders.updateStatus.input.parse(req.body);
  //   const data = await storage.updateOrderStatus(Number(req.params.id), status);
  //   if (!data) return res.status(404).json({ message: "Order not found" });
  //   res.json(data);
  // });

  // === Production ===
  // app.get(api.production.listRequests.path, async (req, res) => {
  //   const data = await storage.getProductionRequests();
  //   res.json(data);
  // });
  // app.get(api.production.getRequest.path, async (req, res) => {
  //   const data = await storage.getProductionRequest(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Production request not found" });
  //   res.json(data);
  // });
  // app.get(api.production.getRequirements.path, async (req, res) => {
  //   const data = await storage.getMaterialRequirements(Number(req.params.id));
  //   res.json(data);
  // });
  // app.get(api.production.dailyAggregated.path, async (req, res) => {
  //   const data = await storage.getDailyAggregatedRequirements();
  //   res.json(data);
  // });

  // === Packing ===
  // app.get(api.packing.list.path, async (req, res) => {
  //   const data = await storage.getPackingActivities();
  //   res.json(data);
  // });
  // app.post(api.packing.create.path, async (req, res) => {
  //   try {
  //     const input = api.packing.create.input.parse(req.body);
  //     const result = await storage.createPackingActivity(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.packing.updateProgress.path, async (req, res) => {
  //   const input = api.packing.updateProgress.input.parse(req.body);
  //   const data = await storage.updatePackingActivity(
  //     Number(req.params.id),
  //     input,
  //   );
  //   res.json(data);
  // });

  // === Finished Goods ===

  // app.get(api.finishedGoods.list.path, async (req, res) => {
  //   const data = await storage.getFinishedGoods();
  //   res.json(data);
  // });
  // app.get(api.finishedGoods.summary.path, async (req, res) => {
  //   const data = await storage.getFinishedGoodsSummary();
  //   res.json(data);
  // });

  // === Delivery Schedules ===
  // app.get(api.deliverySchedules.list.path, async (req, res) => {
  //   const data = await storage.getDeliverySchedules();
  //   res.json(data);
  // });
  // app.post(api.deliverySchedules.create.path, async (req, res) => {
  //   try {
  //     const input = api.deliverySchedules.create.input.parse(req.body);
  //     const result = await storage.createDeliverySchedule(input);
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.get(api.deliverySchedules.get.path, async (req, res) => {
  //   const data = await storage.getDeliverySchedule(Number(req.params.id));
  //   if (!data)
  //     return res.status(404).json({ message: "Delivery schedule not found" });
  //   res.json(data);
  // });
  // app.post(api.deliverySchedules.addOrder.path, async (req, res) => {
  //   try {
  //     const input = api.deliverySchedules.addOrder.input.parse(req.body);
  //     const result = await storage.addOrderToSchedule(
  //       Number(req.params.id),
  //       input,
  //     );
  //     res.status(201).json(result);
  //   } catch (err) {
  //     if (err instanceof z.ZodError) {
  //       return res.status(400).json({
  //         message: err.errors[0].message,
  //         field: err.errors[0].path.join("."),
  //       });
  //     }
  //     throw err;
  //   }
  // });
  // app.patch(api.deliverySchedules.updateStatus.path, async (req, res) => {
  //   const { status } = api.deliverySchedules.updateStatus.input.parse(req.body);
  //   const data = await storage.updateDeliveryScheduleStatus(
  //     Number(req.params.id),
  //     status,
  //   );
  //   res.json(data);
  // });

  // === Stock Movements ===
  // app.get(api.stockMovements.list.path, async (req, res) => {
  //   const data = await storage.getStockMovements();
  //   res.json(data);
  // });

  // === Reports ===
  // app.get(api.reports.salesByCustomer.path, async (req, res) => {
  //   const data = await storage.getSalesByAccount(
  //     req.query.startDate as string,
  //     req.query.endDate as string,
  //   );
  //   res.json(data);
  // });
  // app.get(api.reports.salesBySku.path, async (req, res) => {
  //   const data = await storage.getSalesBySku(
  //     req.query.startDate as string,
  //     req.query.endDate as string,
  //     req.query.customerId ? Number(req.query.customerId) : undefined,
  //   );
  //   res.json(data);
  // });
  // app.get(api.reports.eggSizeCounts.path, async (req, res) => {
  //   const data = await storage.getEggSizeCounts();
  //   res.json(data);
  // });
  // app.get(api.reports.logisticsCosts.path, async (req, res) => {
  //   const data = await storage.getLogisticsCosts();
  //   res.json(data);
  // });

  // === Dashboard ===
  // app.get(api.dashboard.summary.path, async (req, res) => {
  //   const data = await storage.getDashboardSummary();
  //   res.json(data);
  // });

  // Seed data on startup
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  // Check if already seeded (check egg sizes first)
  const existingEggSizes = await storage.getEggSizes();
  if (existingEggSizes.length > 0) return;

  // Egg Sizes
  const sizes = [
    {
      name: "Jumbo",
      code: "J",
      minWeight: "70",
      maxWeight: "999",
      sortOrder: 1,
    },
    {
      name: "Extra Large",
      code: "XL",
      minWeight: "64",
      maxWeight: "69.99",
      sortOrder: 2,
    },
    {
      name: "Large",
      code: "L",
      minWeight: "57",
      maxWeight: "63.99",
      sortOrder: 3,
    },
    {
      name: "Medium",
      code: "M",
      minWeight: "50",
      maxWeight: "56.99",
      sortOrder: 4,
    },
    {
      name: "Small",
      code: "S",
      minWeight: "43",
      maxWeight: "49.99",
      sortOrder: 5,
    },
    {
      name: "Peewee",
      code: "P",
      minWeight: "0",
      maxWeight: "42.99",
      sortOrder: 6,
    },
  ];
  for (const s of sizes) await storage.createEggSize(s);

  // Stock Locations
  const locations = [
    { name: "Raw Receiving", locationType: "raw_receiving" },
    { name: "Grading Area", locationType: "grading" },
    { name: "Packing Station", locationType: "packing" },
    { name: "Finished Goods Warehouse", locationType: "finished_goods" },
    { name: "Shipping Dock", locationType: "shipping" },
  ];
  for (const l of locations) await storage.createStockLocation(l);

  // Suppliers
  const supplier1 = await storage.createSupplier({
    name: "Farm Fresh Eggs Ltd",
    contactPerson: "John Farmer",
    phone: "555-1234",
    supplierType: "eggs",
  });
  const supplier2 = await storage.createSupplier({
    name: "PackRight Supplies",
    contactPerson: "Mary Packer",
    phone: "555-5678",
    supplierType: "packaging",
  });

  // Raw Materials
  await storage.createRawMaterial({
    name: "Raw Eggs (Unsorted)",
    sku: "RAW-001",
    unit: "pcs",
    materialType: "raw_egg",
    currentStock: "5000",
    supplierId: supplier1.id,
  });
  await storage.createRawMaterial({
    name: "12-Egg Carton",
    sku: "PKG-12C",
    unit: "pcs",
    materialType: "packaging",
    currentStock: "1000",
    costPerUnit: "0.25",
    supplierId: supplier2.id,
  });
  await storage.createRawMaterial({
    name: "30-Egg Tray",
    sku: "PKG-30T",
    unit: "pcs",
    materialType: "packaging",
    currentStock: "500",
    costPerUnit: "0.15",
    supplierId: supplier2.id,
  });
  await storage.createRawMaterial({
    name: "Grade A Label",
    sku: "LBL-A",
    unit: "pcs",
    materialType: "label",
    currentStock: "2000",
    costPerUnit: "0.02",
    supplierId: supplier2.id,
  });

  // Drivers
  await storage.createDriver({
    name: "Mike Driver",
    licenseNumber: "DL-12345",
    phone: "555-1111",
  });
  await storage.createDriver({
    name: "Sarah Wheels",
    licenseNumber: "DL-67890",
    phone: "555-2222",
  });

  // Vehicles
  await storage.createVehicle({
    plateNumber: "ABC-1234",
    vehicleType: "refrigerated",
    capacity: "5000",
    costPerKm: "2.50",
  });
  await storage.createVehicle({
    plateNumber: "XYZ-5678",
    vehicleType: "van",
    capacity: "2000",
    costPerKm: "1.50",
  });

  // Customer accounts and delivery sites are seeded separately via SQL

  // Products (using new schema with eggSizeA)
  await storage.createProduct({
    sku: "EGG-L-12",
    name: "Large Eggs 12-pack",
    description: "Grade A Large Eggs",
    eggSizeA: "1",
    percentageA: 100,
    eggsPerPack: 12,
    sellingUnits: "pack",
    packingUnits: "pack",
    currentPrice: "4.99",
  });
  await storage.createProduct({
    sku: "EGG-XL-12",
    name: "Extra Large Eggs 12-pack",
    description: "Grade A Extra Large Eggs",
    eggSizeA: "0",
    percentageA: 100,
    eggsPerPack: 12,
    sellingUnits: "pack",
    packingUnits: "pack",
    currentPrice: "5.49",
  });
  await storage.createProduct({
    sku: "EGG-L-30",
    name: "Large Eggs 30-pack Tray",
    description: "Commercial Grade A Large",
    eggSizeA: "1",
    percentageA: 100,
    eggsPerPack: 30,
    sellingUnits: "tray",
    packingUnits: "tray",
    currentPrice: "10.99",
  });
}
