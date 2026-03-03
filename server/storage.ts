import { db } from "./db";
import { 
  suppliers, drivers, vehicles, businessPartners, deliverySites, partnerContacts,
  stockLocations, eggSizes, products, rawMaterials,
  productRecipes, priceAdjustments, goodsReceiving, gradingActivities, sizedEggStock,
  orders, orderItems, productionRequests, materialRequirements, packingActivities,
  packingMaterialUsage, finishedGoodsStock, deliverySchedules, deliveryScheduleItems, stockMovements,
  gradingLots,
  eggGradeRules, itemMaster, eggReceivingLots,
  packTypes, fgPackSpecs, fgPackSpecGrades, partnerProductPackSpecs,
  eggGradeCompositions, eggGradeCompositionItems,
  type InsertSupplier, type InsertDriver, type InsertVehicle, type InsertBusinessPartner,
  type InsertDeliverySite, type InsertPartnerContact,
  type InsertStockLocation, type InsertEggSize, type InsertProduct, type InsertRawMaterial,
  type InsertProductRecipe, type InsertPriceAdjustment, type InsertGoodsReceiving,
  type InsertGradingActivity, type InsertOrder, type InsertOrderItem,
  type InsertProductionRequest, type InsertPackingActivity,
  type InsertDeliverySchedule, type InsertDeliveryScheduleItem,
  type InsertGradingLot,
  type InsertItemMaster,
  type InsertEggReceivingLot,
  type InsertPackType, type InsertFgPackSpec, type InsertFgPackSpecGrade, type InsertPartnerProductPackSpec,
  type InsertEggGradeComposition, type InsertEggGradeCompositionItem
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte, sum } from "drizzle-orm";

export class DatabaseStorage {
  // === Suppliers ===
  async getSuppliers() {
    return await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }
  async getSupplier(id: number) {
    const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return s;
  }
  async createSupplier(data: InsertSupplier) {
    const [s] = await db.insert(suppliers).values(data).returning();
    return s;
  }
  async updateSupplier(id: number, data: Partial<InsertSupplier>) {
    const [s] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return s;
  }

  // === Drivers ===
  async getDrivers() {
    return await db.select().from(drivers).orderBy(desc(drivers.createdAt));
  }
  async getDriver(id: number) {
    const [d] = await db.select().from(drivers).where(eq(drivers.id, id));
    return d;
  }
  async createDriver(data: InsertDriver) {
    const [d] = await db.insert(drivers).values(data).returning();
    return d;
  }
  async updateDriver(id: number, data: Partial<InsertDriver>) {
    const [d] = await db.update(drivers).set(data).where(eq(drivers.id, id)).returning();
    return d;
  }

  // === Vehicles ===
  async getVehicles() {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }
  async getVehicle(id: number) {
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return v;
  }
  async createVehicle(data: InsertVehicle) {
    const [v] = await db.insert(vehicles).values(data).returning();
    return v;
  }
  async updateVehicle(id: number, data: Partial<InsertVehicle>) {
    const [v] = await db.update(vehicles).set(data).where(eq(vehicles.id, id)).returning();
    return v;
  }

  // === Business Partners ===
  async getBusinessPartners(partnerType?: string) {
    return await db.query.businessPartners.findMany({
      with: { 
        deliverySites: true,
        contacts: true
      },
      orderBy: desc(businessPartners.createdAt)
    });
  }
  async getBusinessPartner(id: number) {
    return await db.query.businessPartners.findFirst({
      where: eq(businessPartners.id, id),
      with: { 
        deliverySites: true,
        contacts: true
      }
    });
  }
  async createBusinessPartner(data: InsertBusinessPartner) {
    const [c] = await db.insert(businessPartners).values(data).returning();
    return c;
  }
  async updateBusinessPartner(id: number, data: Partial<InsertBusinessPartner>) {
    const [c] = await db.update(businessPartners).set(data).where(eq(businessPartners.id, id)).returning();
    return c;
  }
  async deleteBusinessPartner(id: number) {
    await db.delete(partnerContacts).where(eq(partnerContacts.partnerId, id));
    await db.delete(deliverySites).where(eq(deliverySites.partnerId, id));
    await db.delete(businessPartners).where(eq(businessPartners.id, id));
  }
  
  // Backward compatibility aliases
  async getCustomerAccounts() { return this.getBusinessPartners("customer"); }
  async getCustomerAccount(id: number) { return this.getBusinessPartner(id); }
  async createCustomerAccount(data: InsertBusinessPartner) { return this.createBusinessPartner(data); }
  async updateCustomerAccount(id: number, data: Partial<InsertBusinessPartner>) { return this.updateBusinessPartner(id, data); }
  async deleteCustomerAccount(id: number) { return this.deleteBusinessPartner(id); }
  
  // Vendor methods for supplier-type partners
  async getVendors() {
    return await db.query.businessPartners.findMany({
      where: sql`${businessPartners.partnerType} = 'supplier' OR ${businessPartners.partnerType} = 'both'`,
      orderBy: businessPartners.code
    });
  }
  async getVendor(id: number) {
    const [v] = await db.select().from(businessPartners).where(eq(businessPartners.id, id));
    return v;
  }
  async getVendorByCode(code: string) {
    const [v] = await db.select().from(businessPartners).where(eq(businessPartners.code, code));
    return v;
  }
  async createVendor(data: InsertBusinessPartner) {
    const [v] = await db.insert(businessPartners).values({ ...data, partnerType: 'supplier' }).returning();
    return v;
  }
  
  // === Delivery Sites ===
  async getDeliverySites() {
    return await db.query.deliverySites.findMany({
      with: { partner: true, contacts: true },
      orderBy: desc(deliverySites.createdAt)
    });
  }
  async getDeliverySite(id: number) {
    return await db.query.deliverySites.findFirst({
      where: eq(deliverySites.id, id),
      with: { partner: true, contacts: true }
    });
  }
  async createDeliverySite(data: InsertDeliverySite) {
    const [d] = await db.insert(deliverySites).values(data).returning();
    return d;
  }
  async updateDeliverySite(id: number, data: Partial<InsertDeliverySite>) {
    const [d] = await db.update(deliverySites).set(data).where(eq(deliverySites.id, id)).returning();
    return d;
  }
  async deleteDeliverySite(id: number) {
    await db.delete(partnerContacts).where(eq(partnerContacts.deliverySiteId, id));
    await db.delete(deliverySites).where(eq(deliverySites.id, id));
  }
  
  // === Partner Contacts ===
  async getPartnerContacts() {
    return await db.query.partnerContacts.findMany({
      with: { partner: true },
      orderBy: desc(partnerContacts.createdAt)
    });
  }
  async getPartnerContact(id: number) {
    return await db.query.partnerContacts.findFirst({
      where: eq(partnerContacts.id, id),
      with: { partner: true }
    });
  }
  async createPartnerContact(data: InsertPartnerContact) {
    const [c] = await db.insert(partnerContacts).values(data).returning();
    return c;
  }
  async updatePartnerContact(id: number, data: Partial<InsertPartnerContact>) {
    const [c] = await db.update(partnerContacts).set(data).where(eq(partnerContacts.id, id)).returning();
    return c;
  }
  async deletePartnerContact(id: number) {
    await db.delete(partnerContacts).where(eq(partnerContacts.id, id));
  }
  
  // Backward compatibility aliases for contacts
  async getCustomerContacts() { return this.getPartnerContacts(); }
  async getCustomerContact(id: number) { return this.getPartnerContact(id); }
  async createCustomerContact(data: InsertPartnerContact) { return this.createPartnerContact(data); }
  async updateCustomerContact(id: number, data: Partial<InsertPartnerContact>) { return this.updatePartnerContact(id, data); }
  async deleteCustomerContact(id: number) { return this.deletePartnerContact(id); }

  // === Stock Locations ===
  async getStockLocations() {
    return await db.select().from(stockLocations);
  }
  async createStockLocation(data: InsertStockLocation) {
    const [l] = await db.insert(stockLocations).values(data).returning();
    return l;
  }

  // === Egg Sizes ===
  async getEggSizes() {
    return await db.select().from(eggSizes).orderBy(eggSizes.sortOrder);
  }
  async createEggSize(data: InsertEggSize) {
    const [e] = await db.insert(eggSizes).values(data).returning();
    return e;
  }

  // === Grading Lots ===
  async getGradingLots() {
    return await db.query.gradingLots.findMany({
      orderBy: desc(gradingLots.receivingDate)
    });
  }
  async getGradingLot(id: number) {
    return await db.query.gradingLots.findFirst({
      where: eq(gradingLots.id, id)
    });
  }
  async getGradingLotByLotNumber(lotNumber: number) {
    return await db.query.gradingLots.findFirst({
      where: eq(gradingLots.lotNumber, lotNumber)
    });
  }
  async createGradingLot(data: InsertGradingLot) {
    const [g] = await db.insert(gradingLots).values(data).returning();
    return g;
  }
  async updateGradingLot(id: number, data: Partial<InsertGradingLot>) {
    const [g] = await db.update(gradingLots).set(data).where(eq(gradingLots.id, id)).returning();
    return g;
  }

  // === Products ===
  async getProducts() {
    return await db.query.products.findMany({
      with: { partner: true },
      orderBy: desc(products.createdAt)
    });
  }
  async getProduct(id: number) {
    return await db.query.products.findFirst({
      where: eq(products.id, id),
      with: { partner: true, recipes: { with: { rawMaterial: true } } }
    });
  }
  async createProduct(data: InsertProduct) {
    const [p] = await db.insert(products).values(data).returning();
    return p;
  }
  async updateProduct(id: number, data: Partial<InsertProduct>) {
    const [p] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return p;
  }

  // === Raw Materials ===
  async getRawMaterials() {
    return await db.query.rawMaterials.findMany({
      with: { supplier: true },
      orderBy: desc(rawMaterials.createdAt)
    });
  }
  async getRawMaterial(id: number) {
    return await db.query.rawMaterials.findFirst({
      where: eq(rawMaterials.id, id),
      with: { supplier: true }
    });
  }
  async createRawMaterial(data: InsertRawMaterial) {
    const [r] = await db.insert(rawMaterials).values(data).returning();
    return r;
  }
  async updateRawMaterial(id: number, data: Partial<InsertRawMaterial>) {
    const [r] = await db.update(rawMaterials).set(data).where(eq(rawMaterials.id, id)).returning();
    return r;
  }

  // === Product Recipes ===
  async getProductRecipes(productId: number) {
    return await db.query.productRecipes.findMany({
      where: eq(productRecipes.productId, productId),
      with: { rawMaterial: true }
    });
  }
  async createProductRecipe(data: InsertProductRecipe) {
    const [r] = await db.insert(productRecipes).values(data).returning();
    return r;
  }
  async deleteProductRecipe(id: number) {
    await db.delete(productRecipes).where(eq(productRecipes.id, id));
  }

  // === Price Adjustments ===
  async getPendingPriceAdjustments() {
    return await db.query.priceAdjustments.findMany({
      where: eq(priceAdjustments.status, "pending"),
      with: { product: true }
    });
  }
  async createPriceAdjustment(data: InsertPriceAdjustment) {
    const [a] = await db.insert(priceAdjustments).values(data).returning();
    return a;
  }
  async approvePriceAdjustment(id: number, approvedBy: string) {
    const [adj] = await db.update(priceAdjustments)
      .set({ status: "approved", approvedBy })
      .where(eq(priceAdjustments.id, id))
      .returning();
    if (adj) {
      await db.update(products).set({ currentPrice: adj.newPrice }).where(eq(products.id, adj.productId));
    }
    return adj;
  }
  async rejectPriceAdjustment(id: number) {
    const [adj] = await db.update(priceAdjustments)
      .set({ status: "rejected" })
      .where(eq(priceAdjustments.id, id))
      .returning();
    return adj;
  }

  // === Goods Receiving ===
  async getGoodsReceivingList() {
    return await db.query.goodsReceiving.findMany({
      with: { supplier: true, location: true },
      orderBy: desc(goodsReceiving.createdAt)
    });
  }
  async getGoodsReceiving(id: number) {
    return await db.query.goodsReceiving.findFirst({
      where: eq(goodsReceiving.id, id),
      with: { supplier: true, location: true, gradingActivities: { with: { eggSize: true } } }
    });
  }
  async createGoodsReceiving(data: InsertGoodsReceiving) {
    const count = await db.select({ count: sql<number>`count(*)` }).from(goodsReceiving);
    const grNumber = `GR-${new Date().getFullYear()}-${String(Number(count[0].count) + 1).padStart(4, '0')}`;
    const [gr] = await db.insert(goodsReceiving).values({ ...data, grNumber }).returning();
    return gr;
  }

  // === Grading Activities ===
  async getGradingActivities() {
    return await db.query.gradingActivities.findMany({
      with: { goodsReceiving: true, eggSize: true, location: true },
      orderBy: desc(gradingActivities.createdAt)
    });
  }
  async getGradingByGr(grId: number) {
    return await db.query.gradingActivities.findMany({
      where: eq(gradingActivities.goodsReceivingId, grId),
      with: { eggSize: true }
    });
  }
  async createGradingActivity(data: InsertGradingActivity) {
    const [g] = await db.insert(gradingActivities).values(data).returning();
    // Create sized egg stock entry
    await db.insert(sizedEggStock).values({
      eggSizeId: data.eggSizeId,
      batchNumber: data.batchNumber || `BATCH-${Date.now()}`,
      quantity: data.quantity,
      locationId: data.locationId,
      gradingActivityId: g.id,
      status: "available"
    });
    return g;
  }

  // === Sized Egg Stock ===
  async getSizedEggStock() {
    return await db.query.sizedEggStock.findMany({
      where: eq(sizedEggStock.status, "available"),
      with: { eggSize: true, location: true },
      orderBy: sizedEggStock.receivedDate
    });
  }
  async getSizedEggStockSummary() {
    return await db
      .select({
        eggSizeId: sizedEggStock.eggSizeId,
        totalQuantity: sum(sizedEggStock.quantity),
      })
      .from(sizedEggStock)
      .where(eq(sizedEggStock.status, "available"))
      .groupBy(sizedEggStock.eggSizeId);
  }

  // === Orders ===
  async getOrders() {
    return await db.query.orders.findMany({
      with: { deliverySite: true, partner: true, driver: true, vehicle: true },
      orderBy: desc(orders.createdAt)
    });
  }
  async getOrder(id: number) {
    return await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { deliverySite: true, partner: true, driver: true, vehicle: true, items: { with: { product: true } } }
    });
  }
  async createOrder(orderData: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]) {
    return await db.transaction(async (tx) => {
      const count = await tx.select({ count: sql<number>`count(*)` }).from(orders);
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(Number(count[0].count) + 1).padStart(5, '0')}`;
      
      let totalAmount = 0;
      items.forEach(item => { totalAmount += Number(item.totalPrice); });

      const [order] = await tx.insert(orders).values({ 
        ...orderData, 
        orderNumber,
        totalAmount: totalAmount.toString(),
        status: "confirmed"
      }).returning();

      if (items.length > 0) {
        await tx.insert(orderItems).values(items.map(item => ({ ...item, orderId: order.id })));
      }

      // Create production request
      const prCount = await tx.select({ count: sql<number>`count(*)` }).from(productionRequests);
      const requestNumber = `PR-${new Date().getFullYear()}-${String(Number(prCount[0].count) + 1).padStart(5, '0')}`;
      await tx.insert(productionRequests).values({
        orderId: order.id,
        requestNumber,
        requiredDate: orderData.deliveryDate,
        status: "pending"
      });

      return order;
    });
  }
  async updateOrderStatus(id: number, status: string) {
    const [o] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return o;
  }

  // === Production Requests ===
  async getProductionRequests() {
    return await db.query.productionRequests.findMany({
      with: { order: { with: { deliverySite: true, partner: true } } },
      orderBy: desc(productionRequests.createdAt)
    });
  }
  async getProductionRequest(id: number) {
    return await db.query.productionRequests.findFirst({
      where: eq(productionRequests.id, id),
      with: { 
        order: { with: { deliverySite: true, partner: true, items: { with: { product: { with: { partner: true } } } } } },
        materialRequirements: { with: { rawMaterial: true } },
        packingActivities: { with: { product: true } }
      }
    });
  }
  async getMaterialRequirements(productionRequestId: number) {
    return await db.query.materialRequirements.findMany({
      where: eq(materialRequirements.productionRequestId, productionRequestId),
      with: { rawMaterial: true }
    });
  }
  async getDailyAggregatedRequirements() {
    const today = new Date().toISOString().split('T')[0];
    return await db.query.productionRequests.findMany({
      where: eq(productionRequests.status, "pending"),
      with: { 
        order: { with: { items: { with: { product: { with: { partner: true, recipes: { with: { rawMaterial: true } } } } } } } }
      }
    });
  }

  // === Packing Activities ===
  async getPackingActivities() {
    return await db.query.packingActivities.findMany({
      with: { productionRequest: { with: { order: true } }, product: true },
      orderBy: desc(packingActivities.createdAt)
    });
  }
  async createPackingActivity(data: InsertPackingActivity) {
    const [p] = await db.insert(packingActivities).values(data).returning();
    return p;
  }
  async updatePackingActivity(id: number, data: { actualQuantity: number; status: string }) {
    const [p] = await db.update(packingActivities)
      .set(data)
      .where(eq(packingActivities.id, id))
      .returning();
    
    // If completed, create finished goods entry
    if (data.status === "completed" && p) {
      const activity = await db.query.packingActivities.findFirst({
        where: eq(packingActivities.id, id),
        with: { product: true }
      });
      if (activity) {
        await db.insert(finishedGoodsStock).values({
          productId: activity.productId,
          packingActivityId: id,
          batchNumber: `FG-${Date.now()}`,
          quantity: data.actualQuantity,
          status: "available"
        });
      }
    }
    return p;
  }

  // === Finished Goods ===
  async getFinishedGoods() {
    return await db.query.finishedGoodsStock.findMany({
      with: { product: true, location: true },
      orderBy: finishedGoodsStock.productionDate
    });
  }
  async getFinishedGoodsSummary() {
    return await db
      .select({
        productId: finishedGoodsStock.productId,
        totalQuantity: sum(finishedGoodsStock.quantity),
      })
      .from(finishedGoodsStock)
      .where(eq(finishedGoodsStock.status, "available"))
      .groupBy(finishedGoodsStock.productId);
  }

  // === Delivery Schedules ===
  async getDeliverySchedules() {
    return await db.query.deliverySchedules.findMany({
      with: { driver: true, vehicle: true, items: { with: { order: { with: { deliverySite: true, partner: true } } } } },
      orderBy: desc(deliverySchedules.scheduleDate)
    });
  }
  async getDeliverySchedule(id: number) {
    return await db.query.deliverySchedules.findFirst({
      where: eq(deliverySchedules.id, id),
      with: { driver: true, vehicle: true, items: { with: { order: { with: { deliverySite: true, partner: true, items: true } } } } }
    });
  }
  async createDeliverySchedule(data: InsertDeliverySchedule) {
    const [s] = await db.insert(deliverySchedules).values(data).returning();
    return s;
  }
  async addOrderToSchedule(scheduleId: number, data: Omit<InsertDeliveryScheduleItem, 'scheduleId'>) {
    const [i] = await db.insert(deliveryScheduleItems).values({ ...data, scheduleId }).returning();
    // Update order logistics status
    await db.update(orders).set({ logisticsStatus: "scheduled" }).where(eq(orders.id, data.orderId));
    return i;
  }
  async updateDeliveryScheduleStatus(id: number, status: string) {
    const [s] = await db.update(deliverySchedules).set({ status }).where(eq(deliverySchedules.id, id)).returning();
    return s;
  }

  // === Stock Movements ===
  async getStockMovements() {
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.movementDate)).limit(100);
  }

  // === Reports ===
  async getSalesByAccount(startDate?: string, endDate?: string) {
    let query = db
      .select({
        partnerId: orders.partnerId,
        partnerName: businessPartners.businessName,
        totalOrders: sql<number>`count(${orders.id})`,
        totalAmount: sum(orders.totalAmount),
      })
      .from(orders)
      .innerJoin(businessPartners, eq(orders.partnerId, businessPartners.id))
      .where(eq(orders.status, "delivered"))
      .groupBy(orders.partnerId, businessPartners.businessName);
    
    return await query;
  }

  async getSalesBySku(startDate?: string, endDate?: string, customerId?: number) {
    return await db
      .select({
        productId: orderItems.productId,
        productName: products.name,
        sku: products.sku,
        totalQuantity: sum(orderItems.quantity),
        totalRevenue: sum(orderItems.totalPrice),
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .groupBy(orderItems.productId, products.name, products.sku);
  }

  async getEggSizeCounts() {
    return await db
      .select({
        eggSizeId: sizedEggStock.eggSizeId,
        sizeName: eggSizes.name,
        sizeCode: eggSizes.code,
        totalQuantity: sum(sizedEggStock.quantity),
      })
      .from(sizedEggStock)
      .innerJoin(eggSizes, eq(sizedEggStock.eggSizeId, eggSizes.id))
      .where(eq(sizedEggStock.status, "available"))
      .groupBy(sizedEggStock.eggSizeId, eggSizes.name, eggSizes.code);
  }

  async getLogisticsCosts() {
    return await db
      .select({
        vehicleId: deliverySchedules.vehicleId,
        plateNumber: vehicles.plateNumber,
        totalSchedules: sql<number>`count(${deliverySchedules.id})`,
        totalEstimatedCost: sum(deliverySchedules.estimatedCost),
        totalDistance: sum(deliverySchedules.estimatedDistance),
      })
      .from(deliverySchedules)
      .innerJoin(vehicles, eq(deliverySchedules.vehicleId, vehicles.id))
      .groupBy(deliverySchedules.vehicleId, vehicles.plateNumber);
  }

  // === Dashboard ===
  async getDashboardSummary() {
    const [orderStats] = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${orders.status} = 'confirmed')`,
      inProduction: sql<number>`count(*) filter (where ${orders.status} = 'in_production')`,
      ready: sql<number>`count(*) filter (where ${orders.status} = 'ready')`,
    }).from(orders);

    const [productionStats] = await db.select({
      pending: sql<number>`count(*) filter (where ${productionRequests.status} = 'pending')`,
      inProgress: sql<number>`count(*) filter (where ${productionRequests.status} = 'in_progress')`,
    }).from(productionRequests);

    const [pendingApprovals] = await db.select({
      count: sql<number>`count(*)`
    }).from(priceAdjustments).where(eq(priceAdjustments.status, "pending"));

    return {
      orders: orderStats,
      production: productionStats,
      pendingPriceApprovals: Number(pendingApprovals.count),
    };
  }

  // === NEW ITEM MASTER SYSTEM ===

  // Egg Grade Rules
  async getEggGradeRules() {
    return await db.select().from(eggGradeRules).orderBy(eggGradeRules.sortOrder);
  }
  async getEggGradeRule(id: number) {
    const [r] = await db.select().from(eggGradeRules).where(eq(eggGradeRules.id, id));
    return r;
  }

  // Item Master
  async getItemMasterList() {
    return await db.query.itemMaster.findMany({
      with: { partner: true },
      orderBy: [itemMaster.itemCategory, itemMaster.itemCode]
    });
  }
  async getItemMasterByCategory(category: string) {
    return await db.query.itemMaster.findMany({
      where: eq(itemMaster.itemCategory, category),
      with: { partner: true },
      orderBy: itemMaster.itemCode
    });
  }
  async getItemMaster(id: number) {
    return await db.query.itemMaster.findFirst({
      where: eq(itemMaster.id, id),
      with: { partner: true }
    });
  }
  async createItemMaster(data: InsertItemMaster) {
    const [item] = await db.insert(itemMaster).values(data).returning();
    return item;
  }
  async updateItemMaster(id: number, data: Partial<InsertItemMaster>) {
    const [item] = await db.update(itemMaster).set(data).where(eq(itemMaster.id, id)).returning();
    return item;
  }
  async deleteItemMaster(id: number) {
    await db.delete(itemMaster).where(eq(itemMaster.id, id));
  }

  // Pack Types
  async getPackTypes() {
    return await db.select().from(packTypes).orderBy(packTypes.sortOrder);
  }
  async getPackType(id: number) {
    const [pt] = await db.select().from(packTypes).where(eq(packTypes.id, id));
    return pt;
  }
  async createPackType(data: InsertPackType) {
    const [pt] = await db.insert(packTypes).values(data).returning();
    return pt;
  }
  async updatePackType(id: number, data: Partial<InsertPackType>) {
    const [pt] = await db.update(packTypes).set(data).where(eq(packTypes.id, id)).returning();
    return pt;
  }
  async deletePackType(id: number) {
    await db.delete(packTypes).where(eq(packTypes.id, id));
  }

  // Egg Grade Compositions
  async getEggGradeCompositions() {
    return await db.query.eggGradeCompositions.findMany({
      with: { items: true },
      orderBy: eggGradeCompositions.compositionCode
    });
  }
  async getEggGradeComposition(id: number) {
    return await db.query.eggGradeCompositions.findFirst({
      where: eq(eggGradeCompositions.id, id),
      with: { items: true }
    });
  }
  async getEggGradeCompositionByCode(code: string) {
    return await db.query.eggGradeCompositions.findFirst({
      where: eq(eggGradeCompositions.compositionCode, code),
      with: { items: true }
    });
  }
  async createEggGradeComposition(data: InsertEggGradeComposition, items: { gradeCode: string; percentage: string }[]) {
    return await db.transaction(async (tx) => {
      const [comp] = await tx.insert(eggGradeCompositions).values(data).returning();
      if (items.length > 0) {
        await tx.insert(eggGradeCompositionItems).values(
          items.map((g, idx) => ({ gradeCode: g.gradeCode, percentage: g.percentage, compositionId: comp.id, sequence: idx + 1 })) // 1-based sequence
        );
      }
      return await tx.query.eggGradeCompositions.findFirst({
        where: eq(eggGradeCompositions.id, comp.id),
        with: { items: true }
      });
    });
  }
  async updateEggGradeComposition(id: number, data: Partial<InsertEggGradeComposition>, items?: { gradeCode: string; percentage: string }[]) {
    return await db.transaction(async (tx) => {
      const [comp] = await tx.update(eggGradeCompositions).set(data).where(eq(eggGradeCompositions.id, id)).returning();
      if (!comp) return undefined;
      if (items !== undefined) {
        // Always delete existing items first
        await tx.delete(eggGradeCompositionItems).where(eq(eggGradeCompositionItems.compositionId, id));
        // Insert new items if any
        if (items.length > 0) {
          await tx.insert(eggGradeCompositionItems).values(
            items.map((g, idx) => ({ gradeCode: g.gradeCode, percentage: g.percentage, compositionId: id, sequence: idx + 1 })) // 1-based sequence
          );
        }
      }
      return await tx.query.eggGradeCompositions.findFirst({
        where: eq(eggGradeCompositions.id, id),
        with: { items: true }
      });
    });
  }
  async compositionCodeExists(code: string): Promise<boolean> {
    const existing = await db.query.eggGradeCompositions.findFirst({
      where: eq(eggGradeCompositions.compositionCode, code)
    });
    return !!existing;
  }
  async deleteEggGradeComposition(id: number) {
    await db.delete(eggGradeCompositions).where(eq(eggGradeCompositions.id, id));
  }

  // FG Pack Specs
  async getFgPackSpecs() {
    return await db.query.fgPackSpecs.findMany({
      with: { grades: true, packType: true, composition: { with: { items: true } } },
      orderBy: fgPackSpecs.specCode
    });
  }
  async getFgPackSpec(id: number) {
    return await db.query.fgPackSpecs.findFirst({
      where: eq(fgPackSpecs.id, id),
      with: { grades: true, packType: true, composition: { with: { items: true } } }
    });
  }
  async createFgPackSpec(data: InsertFgPackSpec, grades: { gradeCode: string; percentage: string }[]) {
    return await db.transaction(async (tx) => {
      const [spec] = await tx.insert(fgPackSpecs).values(data).returning();
      if (grades.length > 0) {
        await tx.insert(fgPackSpecGrades).values(
          grades.map((g, idx) => ({ gradeCode: g.gradeCode, percentage: g.percentage, specId: spec.id, sequence: idx }))
        );
      }
      return await tx.query.fgPackSpecs.findFirst({
        where: eq(fgPackSpecs.id, spec.id),
        with: { grades: true, packType: true, composition: { with: { items: true } } }
      });
    });
  }
  async updateFgPackSpec(id: number, data: Partial<InsertFgPackSpec>, grades?: { gradeCode: string; percentage: string }[]) {
    return await db.transaction(async (tx) => {
      const [spec] = await tx.update(fgPackSpecs).set(data).where(eq(fgPackSpecs.id, id)).returning();
      if (!spec) return undefined;
      if (grades !== undefined && grades.length > 0) {
        await tx.delete(fgPackSpecGrades).where(eq(fgPackSpecGrades.specId, id));
        await tx.insert(fgPackSpecGrades).values(
          grades.map((g, idx) => ({ gradeCode: g.gradeCode, percentage: g.percentage, specId: id, sequence: idx }))
        );
      }
      return await tx.query.fgPackSpecs.findFirst({
        where: eq(fgPackSpecs.id, id),
        with: { grades: true, packType: true, composition: { with: { items: true } } }
      });
    });
  }
  async deleteFgPackSpec(id: number) {
    await db.delete(fgPackSpecs).where(eq(fgPackSpecs.id, id));
  }
  async getNextPackSpecCode() {
    const result = await db.select({ count: sql<number>`count(*)` }).from(fgPackSpecs);
    const nextNum = (result[0]?.count ?? 0) + 1;
    return `SPEC-${String(nextNum).padStart(4, '0')}`;
  }

  // Partner-Product Pack Specs (Many-to-Many)
  async getPartnerProductPackSpecs(partnerId?: number) {
    if (partnerId) {
      return await db.query.partnerProductPackSpecs.findMany({
        where: eq(partnerProductPackSpecs.partnerId, partnerId),
        with: { partner: true, product: true, packSpec: { with: { grades: true, packType: true } } }
      });
    }
    return await db.query.partnerProductPackSpecs.findMany({
      with: { partner: true, product: true, packSpec: { with: { grades: true, packType: true } } }
    });
  }
  async createPartnerProductPackSpec(data: InsertPartnerProductPackSpec) {
    const [ppps] = await db.insert(partnerProductPackSpecs).values(data).returning();
    return ppps;
  }
  async updatePartnerProductPackSpec(id: number, data: Partial<InsertPartnerProductPackSpec>) {
    const [ppps] = await db.update(partnerProductPackSpecs).set(data).where(eq(partnerProductPackSpecs.id, id)).returning();
    return ppps;
  }
  async deletePartnerProductPackSpec(id: number) {
    await db.delete(partnerProductPackSpecs).where(eq(partnerProductPackSpecs.id, id));
  }

  // Egg Receiving Lots
  async getEggReceivingLots() {
    return await db.query.eggReceivingLots.findMany({
      with: { supplier: true, location: true },
      orderBy: desc(eggReceivingLots.createdAt)
    });
  }
  async getEggReceivingLot(id: number) {
    return await db.query.eggReceivingLots.findFirst({
      where: eq(eggReceivingLots.id, id),
      with: { supplier: true, location: true }
    });
  }
  async getEggReceivingLotsBySupplier(supplierId: number) {
    return await db.query.eggReceivingLots.findMany({
      where: eq(eggReceivingLots.supplierId, supplierId),
      with: { supplier: true, location: true },
      orderBy: desc(eggReceivingLots.createdAt)
    });
  }
  async createEggReceivingLot(data: InsertEggReceivingLot) {
    const [lot] = await db.insert(eggReceivingLots).values(data).returning();
    return lot;
  }
  async updateEggReceivingLot(id: number, data: Partial<InsertEggReceivingLot>) {
    const [lot] = await db.update(eggReceivingLots).set(data).where(eq(eggReceivingLots.id, id)).returning();
    return lot;
  }
  async deleteEggReceivingLot(id: number) {
    await db.delete(eggReceivingLots).where(eq(eggReceivingLots.id, id));
  }
  async getNextLotNumber() {
    const year = new Date().getFullYear();
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(eggReceivingLots)
      .where(sql`EXTRACT(YEAR FROM ${eggReceivingLots.createdAt}) = ${year}`);
    const nextNum = (result[0]?.count ?? 0) + 1;
    return `LOT-${year}-${String(nextNum).padStart(4, '0')}`;
  }
}

export const storage = new DatabaseStorage();
