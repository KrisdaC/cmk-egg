import { z } from 'zod';
import { 
  insertSupplierSchema, insertDriverSchema, insertVehicleSchema, insertCustomerAccountSchema, insertDeliverySiteSchema,
  insertCustomerContactSchema, insertStockLocationSchema, insertEggSizeSchema, insertProductSchema, insertRawMaterialSchema,
  insertProductRecipeSchema, insertPriceAdjustmentSchema, insertGoodsReceivingSchema,
  insertGradingActivitySchema, insertSizedEggStockSchema, insertOrderSchema, insertOrderItemSchema,
  insertProductionRequestSchema, insertPackingActivitySchema, insertDeliveryScheduleSchema,
  insertDeliveryScheduleItemSchema, insertVendorSchema, insertGradingLotSchema,
  insertEggGradeRuleSchema, insertItemMasterSchema, insertEggReceivingLotSchema,
  insertPackTypeSchema, insertFgPackSpecSchema, insertPartnerProductPackSpecSchema,
  insertEggGradeCompositionSchema
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  // Suppliers
  suppliers: {
    list: { method: 'GET' as const, path: '/api/suppliers', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/suppliers', input: insertSupplierSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/suppliers/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/suppliers/:id', input: insertSupplierSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Drivers
  drivers: {
    list: { method: 'GET' as const, path: '/api/drivers', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/drivers', input: insertDriverSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/drivers/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/drivers/:id', input: insertDriverSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Vehicles
  vehicles: {
    list: { method: 'GET' as const, path: '/api/vehicles', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/vehicles', input: insertVehicleSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/vehicles/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/vehicles/:id', input: insertVehicleSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Customer Accounts (billing entities)
  customerAccounts: {
    list: { method: 'GET' as const, path: '/api/customer-accounts', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/customer-accounts', input: insertCustomerAccountSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/customer-accounts/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/customer-accounts/:id', input: insertCustomerAccountSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },
  
  // Delivery Sites (one row per delivery location)
  deliverySites: {
    list: { method: 'GET' as const, path: '/api/delivery-sites', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/delivery-sites', input: insertDeliverySiteSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/delivery-sites/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/delivery-sites/:id', input: insertDeliverySiteSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Customer Contacts
  customerContacts: {
    list: { method: 'GET' as const, path: '/api/customer-contacts', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/customer-contacts', input: insertCustomerContactSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/customer-contacts/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/customer-contacts/:id', input: insertCustomerContactSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Stock Locations
  stockLocations: {
    list: { method: 'GET' as const, path: '/api/stock-locations', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/stock-locations', input: insertStockLocationSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
  },

  // Egg Sizes (LEGACY)
  eggSizes: {
    list: { method: 'GET' as const, path: '/api/egg-sizes', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/egg-sizes', input: insertEggSizeSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
  },

  // === NEW ITEM MASTER SYSTEM ===
  
  // Egg Grade Rules (LAW TABLE - weight to grade mapping)
  eggGradeRules: {
    list: { method: 'GET' as const, path: '/api/egg-grade-rules', responses: { 200: z.array(z.any()) } },
    get: { method: 'GET' as const, path: '/api/egg-grade-rules/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Item Master (Eggs and Packaging)
  itemMaster: {
    list: { method: 'GET' as const, path: '/api/item-master', responses: { 200: z.array(z.any()) } },
    listByCategory: { method: 'GET' as const, path: '/api/item-master/category/:category', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/item-master', input: insertItemMasterSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/item-master/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/item-master/:id', input: insertItemMasterSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
    delete: { method: 'DELETE' as const, path: '/api/item-master/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  // Pack Types (Lookup table)
  packTypes: {
    list: { method: 'GET' as const, path: '/api/pack-types', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/pack-types', input: insertPackTypeSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/pack-types/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/pack-types/:id', input: insertPackTypeSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
    delete: { method: 'DELETE' as const, path: '/api/pack-types/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  // Egg Grade Compositions (Reusable grade formulas)
  eggGradeCompositions: {
    list: { method: 'GET' as const, path: '/api/egg-grade-compositions', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/egg-grade-compositions', input: insertEggGradeCompositionSchema.extend({ items: z.array(z.object({ gradeCode: z.string(), percentage: z.string() })) }), responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/egg-grade-compositions/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    getByCode: { method: 'GET' as const, path: '/api/egg-grade-compositions/code/:code', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/egg-grade-compositions/:id', input: insertEggGradeCompositionSchema.partial().extend({ items: z.array(z.object({ gradeCode: z.string(), percentage: z.string() })).optional() }), responses: { 200: z.any(), 404: errorSchemas.notFound } },
    delete: { method: 'DELETE' as const, path: '/api/egg-grade-compositions/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  // FG Pack Specs (Finished Goods Pack Specifications)
  fgPackSpecs: {
    list: { method: 'GET' as const, path: '/api/fg-pack-specs', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/fg-pack-specs', input: insertFgPackSpecSchema.extend({ grades: z.array(z.object({ gradeCode: z.string(), percentage: z.string() })) }), responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/fg-pack-specs/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/fg-pack-specs/:id', input: insertFgPackSpecSchema.partial().extend({ grades: z.array(z.object({ gradeCode: z.string(), percentage: z.string() })).optional() }), responses: { 200: z.any(), 404: errorSchemas.notFound } },
    delete: { method: 'DELETE' as const, path: '/api/fg-pack-specs/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
    nextCode: { method: 'GET' as const, path: '/api/fg-pack-specs/next-code', responses: { 200: z.object({ specCode: z.string() }) } },
  },

  // Partner-Product Pack Specs (Many-to-Many)
  partnerProductPackSpecs: {
    list: { method: 'GET' as const, path: '/api/partner-product-pack-specs', responses: { 200: z.array(z.any()) } },
    listByPartner: { method: 'GET' as const, path: '/api/partner-product-pack-specs/partner/:partnerId', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/partner-product-pack-specs', input: insertPartnerProductPackSpecSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    update: { method: 'PATCH' as const, path: '/api/partner-product-pack-specs/:id', input: insertPartnerProductPackSpecSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
    delete: { method: 'DELETE' as const, path: '/api/partner-product-pack-specs/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  // Egg Receiving Lots (OPERATIONAL - Good Receive)
  eggReceivingLots: {
    list: { method: 'GET' as const, path: '/api/egg-receiving-lots', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/egg-receiving-lots', input: insertEggReceivingLotSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/egg-receiving-lots/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/egg-receiving-lots/:id', input: insertEggReceivingLotSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
    delete: { method: 'DELETE' as const, path: '/api/egg-receiving-lots/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
    nextLotNumber: { method: 'GET' as const, path: '/api/egg-receiving-lots/next-number', responses: { 200: z.object({ lotNumber: z.string() }) } },
  },

  // Vendors
  vendors: {
    list: { method: 'GET' as const, path: '/api/vendors', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/vendors', input: insertVendorSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/vendors/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Grading Lots
  gradingLots: {
    list: { method: 'GET' as const, path: '/api/grading-lots', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/grading-lots', input: insertGradingLotSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/grading-lots/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/grading-lots/:id', input: insertGradingLotSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Products
  products: {
    list: { method: 'GET' as const, path: '/api/products', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/products', input: insertProductSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/products/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/products/:id', input: insertProductSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Raw Materials
  rawMaterials: {
    list: { method: 'GET' as const, path: '/api/raw-materials', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/raw-materials', input: insertRawMaterialSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/raw-materials/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    update: { method: 'PATCH' as const, path: '/api/raw-materials/:id', input: insertRawMaterialSchema.partial(), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Product Recipes (BOM)
  productRecipes: {
    list: { method: 'GET' as const, path: '/api/products/:productId/recipes', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/product-recipes', input: insertProductRecipeSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    delete: { method: 'DELETE' as const, path: '/api/product-recipes/:id', responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  // Price Adjustments
  priceAdjustments: {
    listPending: { method: 'GET' as const, path: '/api/price-adjustments/pending', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/price-adjustments', input: insertPriceAdjustmentSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    approve: { method: 'PATCH' as const, path: '/api/price-adjustments/:id/approve', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    reject: { method: 'PATCH' as const, path: '/api/price-adjustments/:id/reject', responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Goods Receiving
  goodsReceiving: {
    list: { method: 'GET' as const, path: '/api/goods-receiving', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/goods-receiving', input: insertGoodsReceivingSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/goods-receiving/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Grading Activities
  gradingActivities: {
    list: { method: 'GET' as const, path: '/api/grading-activities', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/grading-activities', input: insertGradingActivitySchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    byGr: { method: 'GET' as const, path: '/api/goods-receiving/:grId/grading', responses: { 200: z.array(z.any()) } },
  },

  // Sized Egg Stock
  sizedEggStock: {
    list: { method: 'GET' as const, path: '/api/sized-egg-stock', responses: { 200: z.array(z.any()) } },
    summary: { method: 'GET' as const, path: '/api/sized-egg-stock/summary', responses: { 200: z.array(z.any()) } },
  },

  // Orders
  orders: {
    list: { method: 'GET' as const, path: '/api/orders', responses: { 200: z.array(z.any()) } },
    create: { 
      method: 'POST' as const, 
      path: '/api/orders', 
      input: insertOrderSchema.extend({ items: z.array(insertOrderItemSchema.omit({ orderId: true })) }),
      responses: { 201: z.any(), 400: errorSchemas.validation } 
    },
    get: { method: 'GET' as const, path: '/api/orders/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    updateStatus: { method: 'PATCH' as const, path: '/api/orders/:id/status', input: z.object({ status: z.string() }), responses: { 200: z.any(), 404: errorSchemas.notFound } },
  },

  // Production Requests
  production: {
    listRequests: { method: 'GET' as const, path: '/api/production-requests', responses: { 200: z.array(z.any()) } },
    getRequest: { method: 'GET' as const, path: '/api/production-requests/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    getRequirements: { method: 'GET' as const, path: '/api/production-requests/:id/requirements', responses: { 200: z.array(z.any()) } },
    dailyAggregated: { method: 'GET' as const, path: '/api/production/daily-requirements', responses: { 200: z.any() } },
  },

  // Packing Activities
  packing: {
    list: { method: 'GET' as const, path: '/api/packing-activities', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/packing-activities', input: insertPackingActivitySchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    updateProgress: { method: 'PATCH' as const, path: '/api/packing-activities/:id', input: z.object({ actualQuantity: z.number(), status: z.string() }), responses: { 200: z.any() } },
  },

  // Finished Goods Stock
  finishedGoods: {
    list: { method: 'GET' as const, path: '/api/finished-goods', responses: { 200: z.array(z.any()) } },
    summary: { method: 'GET' as const, path: '/api/finished-goods/summary', responses: { 200: z.array(z.any()) } },
  },

  // Delivery Schedules
  deliverySchedules: {
    list: { method: 'GET' as const, path: '/api/delivery-schedules', responses: { 200: z.array(z.any()) } },
    create: { method: 'POST' as const, path: '/api/delivery-schedules', input: insertDeliveryScheduleSchema, responses: { 201: z.any(), 400: errorSchemas.validation } },
    get: { method: 'GET' as const, path: '/api/delivery-schedules/:id', responses: { 200: z.any(), 404: errorSchemas.notFound } },
    addOrder: { method: 'POST' as const, path: '/api/delivery-schedules/:id/orders', input: insertDeliveryScheduleItemSchema.omit({ scheduleId: true }), responses: { 201: z.any() } },
    updateStatus: { method: 'PATCH' as const, path: '/api/delivery-schedules/:id/status', input: z.object({ status: z.string() }), responses: { 200: z.any() } },
  },

  // Stock Movements
  stockMovements: {
    list: { method: 'GET' as const, path: '/api/stock-movements', responses: { 200: z.array(z.any()) } },
  },

  // Reports
  reports: {
    salesByCustomer: { 
      method: 'GET' as const, 
      path: '/api/reports/sales-by-customer',
      input: z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional(),
      responses: { 200: z.array(z.any()) } 
    },
    salesBySku: { 
      method: 'GET' as const, 
      path: '/api/reports/sales-by-sku',
      input: z.object({ startDate: z.string().optional(), endDate: z.string().optional(), customerId: z.string().optional() }).optional(),
      responses: { 200: z.array(z.any()) } 
    },
    eggSizeCounts: { 
      method: 'GET' as const, 
      path: '/api/reports/egg-size-counts',
      responses: { 200: z.array(z.any()) } 
    },
    logisticsCosts: { 
      method: 'GET' as const, 
      path: '/api/reports/logistics-costs',
      input: z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional(),
      responses: { 200: z.any() } 
    },
  },

  // Dashboard
  dashboard: {
    summary: { method: 'GET' as const, path: '/api/dashboard/summary', responses: { 200: z.any() } },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
