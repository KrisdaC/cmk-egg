import { db } from "../server/db";
import { vendors, products, gradingLots } from "../shared/schema";
import { eq } from "drizzle-orm";

const vendorData = [
  { code: "ตกเกรด", name: "ตกเกรด (Undergrade)" },
  { code: "TT", name: "TT (Internal Brand)" },
  { code: "BC", name: "Big C" },
  { code: "CJ", name: "CJ Express" },
  { code: "MK", name: "Makro" },
  { code: "MS", name: "MSP-EGGS" },
  { code: "TF", name: "Tops/Central Food" },
  { code: "ME", name: "Mother's Egg" },
];

const productData = [
  { sku: "10101", name: "ไข่ไก่บาง", vendorCode: "ตกเกรด", sellingUnits: "ฟอง", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 1, eggSizeA: "บาง", percentageA: 100, isUndergrade: true },
  { sku: "10102", name: "ไข่ไก่บุบ", vendorCode: "ตกเกรด", sellingUnits: "ฟอง", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 1, eggSizeA: "บุบ", percentageA: 100, isUndergrade: true },
  { sku: "10103", name: "ไข่ไก่เปื้อน", vendorCode: "ตกเกรด", sellingUnits: "ฟอง", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 1, eggSizeA: "เปื้อน", percentageA: 100, isUndergrade: true },
  { sku: "10104", name: "ไข่แตกน้ำไหล", vendorCode: "ตกเกรด", sellingUnits: "ฟอง", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 1, eggSizeA: "แตก", percentageA: 100, isUndergrade: true },
  { sku: "10105", name: "ไข่คัดสูญเสีย", vendorCode: "ตกเกรด", sellingUnits: "ฟอง", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 1, eggSizeA: "แตก", percentageA: 100, isUndergrade: true },
  { sku: "30001", name: "ไข่ไก่เบอร์ 0 บรรจุ 4 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 4", packsPerSellingUnit: "1.000", eggsPerPack: 4, eggsPerSellingUnit: 4, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0" },
  { sku: "30002", name: "ไข่ไก่เบอร์ 0 บรรจุ 10 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 10 - ใหญ่", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0" },
  { sku: "30003", name: "ไข่ไก่เบอร์ 0 บรรจุ 15 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 15", packsPerSellingUnit: "1.000", eggsPerPack: 15, eggsPerSellingUnit: 15, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0" },
  { sku: "30004", name: "ไข่ไก่เบอร์ 0 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาดใหญ่/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0" },
  { sku: "30101", name: "ไข่ไก่เบอร์ 1 บรรจุ 4 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 4", packsPerSellingUnit: "1.000", eggsPerPack: 4, eggsPerSellingUnit: 4, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1" },
  { sku: "30102", name: "ไข่ไก่เบอร์ 1 บรรจุ 10 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 10", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1" },
  { sku: "30103", name: "ไข่ไก่เบอร์ 1 บรรจุ 15 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 15", packsPerSellingUnit: "1.000", eggsPerPack: 15, eggsPerSellingUnit: 15, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1" },
  { sku: "30104", name: "ไข่ไก่เบอร์ 1 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1" },
  { sku: "30201", name: "ไข่ไก่เบอร์ 2 บรรจุ 4 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 4", packsPerSellingUnit: "1.000", eggsPerPack: 4, eggsPerSellingUnit: 4, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2" },
  { sku: "30202", name: "ไข่ไก่เบอร์ 2 บรรจุ 10 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 10", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2" },
  { sku: "30203", name: "ไข่ไก่เบอร์ 2 บรรจุ 15 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 15", packsPerSellingUnit: "1.000", eggsPerPack: 15, eggsPerSellingUnit: 15, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2" },
  { sku: "30204", name: "ไข่ไก่เบอร์ 2 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2" },
  { sku: "30301", name: "ไข่ไก่เบอร์ 3 บรรจุ 4 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 4", packsPerSellingUnit: "1.000", eggsPerPack: 4, eggsPerSellingUnit: 4, eggSizeA: "3", percentageA: 100, skuSizeCategory: "3" },
  { sku: "30302", name: "ไข่ไก่เบอร์ 3 บรรจุ 10 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 10", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "3", percentageA: 100, skuSizeCategory: "3" },
  { sku: "30303", name: "ไข่ไก่เบอร์ 3 บรรจุ 15 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 15", packsPerSellingUnit: "1.000", eggsPerPack: 15, eggsPerSellingUnit: 15, eggSizeA: "3", percentageA: 100, skuSizeCategory: "3" },
  { sku: "30304", name: "ไข่ไก่เบอร์ 3 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "3", percentageA: 100, skuSizeCategory: "3" },
  { sku: "30401", name: "ไข่ไก่เบอร์ 4 บรรจุ 4 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 4", packsPerSellingUnit: "1.000", eggsPerPack: 4, eggsPerSellingUnit: 4, eggSizeA: "4", percentageA: 100, skuSizeCategory: "4" },
  { sku: "30402", name: "ไข่ไก่เบอร์ 4 บรรจุ 10 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 10", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "4", percentageA: 100, skuSizeCategory: "4" },
  { sku: "30403", name: "ไข่ไก่เบอร์ 4 บรรจุ 15 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 15", packsPerSellingUnit: "1.000", eggsPerPack: 15, eggsPerSellingUnit: 15, eggSizeA: "4", percentageA: 100, skuSizeCategory: "4" },
  { sku: "30404", name: "ไข่ไก่เบอร์ 4 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "4", percentageA: 100, skuSizeCategory: "4" },
  { sku: "30501", name: "ไข่ไก่เบอร์ 5 บรรจุ 4 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 4", packsPerSellingUnit: "1.000", eggsPerPack: 4, eggsPerSellingUnit: 4, eggSizeA: "5", percentageA: 100, skuSizeCategory: "5" },
  { sku: "30502", name: "ไข่ไก่เบอร์ 5 บรรจุ 10 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 10", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "5", percentageA: 100, skuSizeCategory: "5" },
  { sku: "30503", name: "ไข่ไก่เบอร์ 5 บรรจุ 15 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ฟอง", packingUnits: "แพ็ค 15", packsPerSellingUnit: "1.000", eggsPerPack: 15, eggsPerSellingUnit: 15, eggSizeA: "5", percentageA: 100, skuSizeCategory: "5" },
  { sku: "30504", name: "ไข่ไก่เบอร์ 5 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "5", percentageA: 100, skuSizeCategory: "5" },
  { sku: "30604", name: "ไข่ไก่เบอร์ 6 บรรจุ 30 ฟอง/ถาด", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "6", percentageA: 100, skuSizeCategory: "6" },
  { sku: "32304", name: "ไข่ไก่เบอร์ 2-3 บรรจุ 30 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "2", eggSizeB: "3", percentageA: 50, skuSizeCategory: "2-3 M" },
  { sku: "33404", name: "ไข่ไก่เบอร์ 3-4 บรรจุ 30 ฟอง/แพ็ค", vendorCode: "TT", sellingUnits: "ถาด", packingUnits: "ถาด", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "3", eggSizeB: "4", percentageA: 50, skuSizeCategory: "3-4 S" },
  { sku: "B0001", name: "WRF_ไข่ไก่คละ (10ฟอง) ตราบิ๊กซี (14 แพ็ค/ตระกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "แพ็ค 10", packsPerSellingUnit: "14.000", eggsPerPack: 10, eggsPerSellingUnit: 140, eggSizeA: "3", eggSizeB: "4", percentageA: 15, eggsPerSellingUnitA: "21", eggsPerSellingUnitB: "119", skuSizeCategory: "3-4 S", crateSize: "M" },
  { sku: "B0002", name: "WRF_ไข่ไก่คละ (30ฟอง) ตราบิ๊กซี (2ถาด/ตระกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "2.000", eggsPerPack: 30, eggsPerSellingUnit: 60, eggSizeA: "3", eggSizeB: "4", percentageA: 50, eggsPerSellingUnitA: "30", eggsPerSellingUnitB: "30", skuSizeCategory: "3-4 S", crateSize: "S" },
  { sku: "B0003", name: "WRF_ไข่ไก่คละ (30ฟอง) ตราบิ๊กซี (6ถาด/ตระกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "6.000", eggsPerPack: 30, eggsPerSellingUnit: 180, eggSizeA: "3", eggSizeB: "4", percentageA: 50, eggsPerSellingUnitA: "90", eggsPerSellingUnitB: "90", skuSizeCategory: "3-4 S", crateSize: "M" },
  { sku: "B0004", name: "WRF_ไข่ไก่คละขนาด 2+3 (30 ฟอง) ตราบิ๊กซี (6ถาด/ตะกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "6.000", eggsPerPack: 30, eggsPerSellingUnit: 180, eggSizeA: "2", eggSizeB: "3", percentageA: 50, eggsPerSellingUnitA: "90", eggsPerSellingUnitB: "90", skuSizeCategory: "2-3 M", crateSize: "M" },
  { sku: "B0005", name: "WRF_ไข่ไก่เบอร์ 0 แพ็ค 10 ฟอง ตราบิ๊กซี (14 แพ็ค/ตะกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "แพ็ค 10 - ใหญ่", packsPerSellingUnit: "14.000", eggsPerPack: 10, eggsPerSellingUnit: 140, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0", crateSize: "M" },
  { sku: "B0006", name: "WRF_ไข่ไก่เบอร์ 1 แพ็ค 10 ฟอง ตราบิ๊กซี (14 แพ็ค/ตะกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "แพ็ค 10", packsPerSellingUnit: "14.000", eggsPerPack: 10, eggsPerSellingUnit: 140, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1", crateSize: "M" },
  { sku: "B0009", name: "WRF_ไข่ไก่เบอร์ 2 (30ฟอง) ตราบิ๊กซี (6ถาด/ตระกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "ถาด", packsPerSellingUnit: "6.000", eggsPerPack: 30, eggsPerSellingUnit: 180, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2", crateSize: "M" },
  { sku: "B0011", name: "WRF_ไข่คละเบอร์2+3แพ็ค10 ฟอง(14แพ็ค/ตะกร้า)", vendorCode: "BC", sellingUnits: "ตะกร้า", packingUnits: "แพ็ค 10", packsPerSellingUnit: "14.000", eggsPerPack: 10, eggsPerSellingUnit: 140, eggSizeA: "2", eggSizeB: "3", percentageA: 20, eggsPerSellingUnitA: "28", eggsPerSellingUnitB: "112", skuSizeCategory: "2-3 M", crateSize: "M" },
  { sku: "C0001", name: "ยกนิ้วไข่ไก่ขนาด S แพ็ค 30 ฟอง", vendorCode: "CJ", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "4", eggSizeB: "5", percentageA: 50, skuSizeCategory: "4-5 XS", crateSize: "CJ - Grey" },
  { sku: "C0002", name: "ยกนิ้วไข่ไก่ขนาด M แพ็ค 30 ฟอง", vendorCode: "CJ", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "3", eggSizeB: "4", percentageA: 50, skuSizeCategory: "3-4 S", crateSize: "CJ - Grey" },
  { sku: "C0003", name: "ยกนิ้วไข่ไก่ขนาด L แพ็ค 30 ฟอง", vendorCode: "CJ", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "1", eggSizeB: "2", percentageA: 50, skuSizeCategory: "1-2 L", crateSize: "CJ - Grey" },
  { sku: "C0004", name: "ยกนิ้วไข่ไก่สดเบอร์ 2 แพ็ค 30 ฟอง", vendorCode: "CJ", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2", crateSize: "CJ - Grey" },
  { sku: "M0001", name: "ARO ไข่ไก่คละเบอร์ 3-4 มีฝา 30ฟอง", vendorCode: "MK", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "3", eggSizeB: "4", percentageA: 50, skuSizeCategory: "3-4 S" },
  { sku: "M0002", name: "ARO ไข่ไก่คละเบอร์ 3-4 ไม่มีฝา 30ฟองx5", vendorCode: "MK", sellingUnits: "มัด 5", packingUnits: "ถาด", packsPerSellingUnit: "5.000", eggsPerPack: 30, eggsPerSellingUnit: 150, eggSizeA: "3", eggSizeB: "4", percentageA: 50, skuSizeCategory: "3-4 S" },
  { sku: "M0003", name: "ARO ไข่ไก่เบอร์ 0 (10ฟอง/แพ็ค)", vendorCode: "MK", sellingUnits: "แพ็ค 10", packingUnits: "แพ็ค 10 - ใหญ่", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0" },
  { sku: "M0004", name: "ARO ไข่ไก่ เบอร์ 0 มีฝา 30 ฟอง", vendorCode: "MK", sellingUnits: "ถาด", packingUnits: "ถาดใหญ่/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "0", percentageA: 100, skuSizeCategory: "0" },
  { sku: "M0005", name: "ARO ไข่ไก่เบอร์ 1 (10ฟอง/แพ็ค)", vendorCode: "MK", sellingUnits: "แพ็ค 10", packingUnits: "แพ็ค 10", packsPerSellingUnit: "1.000", eggsPerPack: 10, eggsPerSellingUnit: 10, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1" },
  { sku: "M0007", name: "ARO ไข่ไก่ เบอร์ 1 มีฝา 30 ฟอง", vendorCode: "MK", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "1", percentageA: 100, skuSizeCategory: "1" },
  { sku: "M0010", name: "ARO ไข่ไก่ เบอร์ 2 มีฝา 30 ฟอง", vendorCode: "MK", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "2", percentageA: 100, skuSizeCategory: "2" },
  { sku: "M0014", name: "ARO ไข่ไก่ เบอร์ 3 มีฝา 30 ฟอง", vendorCode: "MK", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "3", percentageA: 100, skuSizeCategory: "3" },
  { sku: "M0017", name: "ARO ไข่ไก่เบอร์ 4 มีฝา 30 ฟอง", vendorCode: "MK", sellingUnits: "ถาด", packingUnits: "ถาด/ครอบ", packsPerSellingUnit: "1.000", eggsPerPack: 30, eggsPerSellingUnit: 30, eggSizeA: "4", percentageA: 100, skuSizeCategory: "4" },
];

const gradingLotData = [
  { lotNumber: 6266, billNumber: "26/1286", receivingDate: "2025-12-29", vehiclePlate: "80-9588", driverName: "ประสิทธ์", weightKg: "21.28", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121742, size0Jumbo: 9798, size1: 33949, size2: 50256, size3: 24324, size4: 3291, size5: 124, size6: 0, undergradeDirty: 1182, undergradeThin: 630, undergradeDented: 1052, undergradeCracked: 331, undergradeBag: 5, lossUnrecoverable: 1058, qcColorValue: "AA", qcFreshness: "2050:42:14" },
  { lotNumber: 6267, billNumber: "26/1287", receivingDate: "2025-12-29", vehiclePlate: "80-9428", driverName: "ธนะชัย", weightKg: "21.6", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 119185, size0Jumbo: 16701, size1: 36912, size2: 44010, size3: 18821, size4: 2610, size5: 131, size6: 0, undergradeDirty: 2751, undergradeThin: 1405, undergradeDented: 840, undergradeCracked: 969, undergradeBag: 5, lossUnrecoverable: 845, qcColorValue: "AA", qcFreshness: "2034:50:24" },
  { lotNumber: 6268, billNumber: "26/1288", receivingDate: "2025-12-29", vehiclePlate: "80-9588", driverName: "รุ่งโรจน์", weightKg: "20.98", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 119765, size0Jumbo: 8560, size1: 26856, size2: 47104, size3: 30604, size4: 6278, size5: 363, size6: 0, undergradeDirty: 3434, undergradeThin: 688, undergradeDented: 676, undergradeCracked: 505, undergradeBag: 5, lossUnrecoverable: 927, qcColorValue: "AA", qcFreshness: "1991:18:14" },
  { lotNumber: 6269, billNumber: "26/1289", receivingDate: "2025-12-29", vehiclePlate: "80-9428", driverName: "ธนะชัย", weightKg: "20.59", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121962, size0Jumbo: 4140, size1: 21010, size2: 50888, size3: 38031, size4: 7426, size5: 467, size6: 0, undergradeDirty: 1375, undergradeThin: 561, undergradeDented: 1025, undergradeCracked: 292, undergradeBag: 5, lossUnrecoverable: 780, qcColorValue: "AA", qcFreshness: "2063:25:26" },
  { lotNumber: 6270, billNumber: null, receivingDate: "2025-12-29", vehiclePlate: "80-9803", driverName: "วันชัย", weightKg: "20.48", purchasePrice: "371070", inputQuantity: 119700, gradedTotal: 113284, size0Jumbo: 2666, size1: 21138, size2: 41862, size3: 35966, size4: 10417, size5: 1235, size6: 0, undergradeDirty: 4988, undergradeThin: 291, undergradeDented: 429, undergradeCracked: 278, undergradeBag: 5, lossUnrecoverable: 425, qcColorValue: "AA", qcFreshness: "1994:48:29" },
  { lotNumber: 6271, billNumber: null, receivingDate: "2025-12-29", vehiclePlate: "80-7498", driverName: "เอกลักษ์", weightKg: "19.94", purchasePrice: "371070", inputQuantity: 119700, gradedTotal: 114467, size0Jumbo: 2734, size1: 11660, size2: 36706, size3: 41024, size4: 19324, size5: 3019, size6: 0, undergradeDirty: 3635, undergradeThin: 477, undergradeDented: 456, undergradeCracked: 217, undergradeBag: 5, lossUnrecoverable: 443, qcColorValue: "AA", qcFreshness: "2032:42:14" },
  { lotNumber: 6272, billNumber: "26/1290", receivingDate: "2025-12-29", vehiclePlate: "80-9532", driverName: "อดิศร", weightKg: "20.63", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 123094, size0Jumbo: 4049, size1: 20836, size2: 52506, size3: 38015, size4: 7214, size5: 474, size6: 0, undergradeDirty: 1056, undergradeThin: 346, undergradeDented: 639, undergradeCracked: 183, undergradeBag: 5, lossUnrecoverable: 677, qcColorValue: "AA", qcFreshness: "2040:33:07" },
  { lotNumber: 6273, billNumber: "26/1291", receivingDate: "2025-12-30", vehiclePlate: "80-9588", driverName: "รุ่งโรจน์", weightKg: "21.19", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121331, size0Jumbo: 10418, size1: 31948, size2: 47614, size3: 26558, size4: 4509, size5: 284, size6: 0, undergradeDirty: 1562, undergradeThin: 1269, undergradeDented: 927, undergradeCracked: 265, undergradeBag: 5, lossUnrecoverable: 641, qcColorValue: "AA", qcFreshness: "2023:55:12" },
  { lotNumber: 6274, billNumber: "26/1292", receivingDate: "2025-12-30", vehiclePlate: "80-9525", driverName: "มอส", weightKg: "21.35", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 120541, size0Jumbo: 12646, size1: 33998, size2: 46648, size3: 23338, size4: 3677, size5: 234, size6: 0, undergradeDirty: 1283, undergradeThin: 1421, undergradeDented: 873, undergradeCracked: 1005, undergradeBag: 5, lossUnrecoverable: 872, qcColorValue: "AA", qcFreshness: "2044:00:29" },
  { lotNumber: 6275, billNumber: null, receivingDate: "2025-12-30", vehiclePlate: "80-9139", driverName: "เวียงชัย", weightKg: "20.32", purchasePrice: "371070", inputQuantity: 119700, gradedTotal: 112619, size0Jumbo: 4246, size1: 17158, size2: 39218, size3: 37164, size4: 12802, size5: 2031, size6: 0, undergradeDirty: 4822, undergradeThin: 397, undergradeDented: 558, undergradeCracked: 420, undergradeBag: 5, lossUnrecoverable: 879, qcColorValue: "AA", qcFreshness: "1992:46:05" },
  { lotNumber: 6276, billNumber: "26/1293", receivingDate: "2025-12-30", vehiclePlate: "80-9424", driverName: "ธนชัย", weightKg: "21.63", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121503, size0Jumbo: 17315, size1: 41410, size2: 44205, size3: 16491, size4: 1993, size5: 89, size6: 0, undergradeDirty: 1489, undergradeThin: 600, undergradeDented: 660, undergradeCracked: 545, undergradeBag: 5, lossUnrecoverable: 1198, qcColorValue: "AA", qcFreshness: "2006:19:41" },
  { lotNumber: 6277, billNumber: "26/1294", receivingDate: "2025-12-30", vehiclePlate: "80-9588", driverName: "รุ่งโรจน์", weightKg: "21.02", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121943, size0Jumbo: 9223, size1: 29095, size2: 48532, size3: 29630, size4: 5143, size5: 320, size6: 0, undergradeDirty: 1492, undergradeThin: 692, undergradeDented: 779, undergradeCracked: 296, undergradeBag: 5, lossUnrecoverable: 793, qcColorValue: "AA", qcFreshness: "1996:58:05" },
  { lotNumber: 6278, billNumber: null, receivingDate: "2025-12-30", vehiclePlate: "80-9139", driverName: "เวียงชัย", weightKg: "22.04", purchasePrice: "418500", inputQuantity: 135000, gradedTotal: 129600, size0Jumbo: 22340, size1: 42219, size2: 44700, size3: 17351, size4: 2694, size5: 296, size6: 0, undergradeDirty: 1843, undergradeThin: 1014, undergradeDented: 450, undergradeCracked: 579, undergradeBag: 5, lossUnrecoverable: 1509, qcColorValue: "AA", qcFreshness: "1972:50:53" },
  { lotNumber: 6279, billNumber: "26/1295", receivingDate: "2025-12-31", vehiclePlate: "80-9618", driverName: "ประสิทธ์", weightKg: "20.75", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121993, size0Jumbo: 5306, size1: 23243, size2: 51586, size3: 34977, size4: 6469, size5: 412, size6: 0, undergradeDirty: 1521, undergradeThin: 734, undergradeDented: 930, undergradeCracked: 248, undergradeBag: 5, lossUnrecoverable: 569, qcColorValue: "AA", qcFreshness: "2003:16:48" },
  { lotNumber: 6280, billNumber: "26/1296", receivingDate: "2025-12-31", vehiclePlate: "80-9525", driverName: "มอส", weightKg: "21.69", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 120894, size0Jumbo: 16209, size1: 40165, size2: 46109, size3: 16562, size4: 1778, size5: 71, size6: 0, undergradeDirty: 1438, undergradeThin: 889, undergradeDented: 953, undergradeCracked: 587, undergradeBag: 5, lossUnrecoverable: 1234, qcColorValue: "AA", qcFreshness: "2015:58:34" },
  { lotNumber: 6281, billNumber: "26/1297", receivingDate: "2025-12-31", vehiclePlate: "80-9588", driverName: "รุ่งโรจน์", weightKg: "21.29", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 121444, size0Jumbo: 11827, size1: 35042, size2: 48072, size3: 23156, size4: 3187, size5: 160, size6: 0, undergradeDirty: 1392, undergradeThin: 802, undergradeDented: 989, undergradeCracked: 667, undergradeBag: 5, lossUnrecoverable: 701, qcColorValue: "AA", qcFreshness: "2007:54:43" },
  { lotNumber: 6282, billNumber: null, receivingDate: "2025-12-31", vehiclePlate: "80-9128", driverName: "สมพงษ์", weightKg: "21.55", purchasePrice: "0", inputQuantity: 135000, gradedTotal: 130134, size0Jumbo: 13511, size1: 35075, size2: 50128, size3: 26939, size4: 4251, size5: 230, size6: 0, undergradeDirty: 1433, undergradeThin: 869, undergradeDented: 646, undergradeCracked: 447, undergradeBag: 5, lossUnrecoverable: 1466, qcColorValue: "AA", qcFreshness: "1947:50:24" },
  { lotNumber: 6283, billNumber: "26/1298", receivingDate: "2026-01-01", vehiclePlate: "80-9424", driverName: "ธนะชัย", weightKg: "20.95", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 122005, size0Jumbo: 8603, size1: 27927, size2: 48985, size3: 30725, size4: 5422, size5: 343, size6: 0, undergradeDirty: 1407, undergradeThin: 889, undergradeDented: 912, undergradeCracked: 214, undergradeBag: 5, lossUnrecoverable: 568, qcColorValue: "AA", qcFreshness: "2004:18:43" },
  { lotNumber: 6284, billNumber: "26/1299", receivingDate: "2026-01-01", vehiclePlate: "80-9618", driverName: "ประสิทธ์", weightKg: "21.58", purchasePrice: "403200", inputQuantity: 126000, gradedTotal: 120498, size0Jumbo: 15331, size1: 39858, size2: 45328, size3: 17729, size4: 2168, size5: 84, size6: 0, undergradeDirty: 1895, undergradeThin: 806, undergradeDented: 1286, undergradeCracked: 330, undergradeBag: 5, lossUnrecoverable: 1180, qcColorValue: "AA", qcFreshness: "1994:52:48" },
];

async function seedRealData() {
  console.log("Starting real data seed...");

  try {
    console.log("Inserting vendors...");
    const vendorMap: { [key: string]: number } = {};
    for (const v of vendorData) {
      const [vendor] = await db.insert(vendors).values(v).onConflictDoNothing().returning();
      if (vendor) {
        vendorMap[v.code] = vendor.id;
      } else {
        const [existing] = await db.select().from(vendors).where(eq(vendors.code, v.code));
        if (existing) vendorMap[v.code] = existing.id;
      }
    }
    console.log(`Inserted ${Object.keys(vendorMap).length} vendors`);

    console.log("Inserting products...");
    let productCount = 0;
    for (const p of productData) {
      const vendorId = vendorMap[p.vendorCode];
      const productInsert = {
        sku: p.sku,
        name: p.name,
        vendorId,
        sellingUnits: p.sellingUnits,
        packingUnits: p.packingUnits,
        packsPerSellingUnit: p.packsPerSellingUnit,
        eggsPerPack: p.eggsPerPack,
        eggsPerSellingUnit: p.eggsPerSellingUnit,
        eggSizeA: p.eggSizeA,
        eggSizeB: p.eggSizeB || null,
        percentageA: p.percentageA,
        eggsPerSellingUnitA: (p as any).eggsPerSellingUnitA || null,
        eggsPerSellingUnitB: (p as any).eggsPerSellingUnitB || null,
        skuSizeCategory: (p as any).skuSizeCategory || null,
        crateSize: (p as any).crateSize || null,
        isUndergrade: (p as any).isUndergrade || false,
      };
      await db.insert(products).values(productInsert).onConflictDoNothing();
      productCount++;
    }
    console.log(`Inserted ${productCount} products`);

    console.log("Inserting grading lots...");
    let lotCount = 0;
    for (const lot of gradingLotData) {
      await db.insert(gradingLots).values({
        lotNumber: lot.lotNumber,
        billNumber: lot.billNumber,
        receivingDate: lot.receivingDate,
        vehiclePlate: lot.vehiclePlate,
        driverName: lot.driverName,
        weightKg: lot.weightKg,
        purchasePrice: lot.purchasePrice,
        inputQuantity: lot.inputQuantity,
        gradedTotal: lot.gradedTotal,
        size0Jumbo: lot.size0Jumbo,
        size1: lot.size1,
        size2: lot.size2,
        size3: lot.size3,
        size4: lot.size4,
        size5: lot.size5,
        size6: lot.size6,
        undergradeDirty: lot.undergradeDirty,
        undergradeThin: lot.undergradeThin,
        undergradeDented: lot.undergradeDented,
        undergradeCracked: lot.undergradeCracked,
        undergradeBag: lot.undergradeBag,
        lossUnrecoverable: lot.lossUnrecoverable,
        qcColorValue: lot.qcColorValue,
        qcFreshness: lot.qcFreshness,
        status: "completed",
      }).onConflictDoNothing();
      lotCount++;
    }
    console.log(`Inserted ${lotCount} grading lots`);

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Seed error:", error);
    throw error;
  }
}

seedRealData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
