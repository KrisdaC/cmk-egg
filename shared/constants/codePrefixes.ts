/**
 * Code Prefix Standards for EggGrade ERP
 * 
 * All user-facing codes follow format: PREFIX-NNNN (e.g., BP-0001)
 * Internal IDs remain as integers for database efficiency.
 * 
 * These prefixes are used for:
 * - Display in UI and printed documents
 * - Search and filtering by users
 * - Human communication (phone/email references)
 */

export const CODE_PREFIXES = {
  // Master Data - Entities
  BUSINESS_PARTNER: 'BP',      // BP-0001 - ลูกค้า/ซัพพลายเออร์
  DELIVERY_SITE: 'DS',         // DS-0001 - สถานที่จัดส่ง
  PARTNER_CONTACT: 'PC',       // PC-0001 - ผู้ติดต่อ
  SUPPLIER: 'SUP',             // SUP-0001 - ซัพพลายเออร์ (legacy)
  DRIVER: 'DRV',               // DRV-0001 - พนักงานขับรถ
  VEHICLE: 'VHC',              // VHC-0001 - ยานพาหนะ
  STOCK_LOCATION: 'LOC',       // LOC-0001 - สถานที่เก็บ
  
  // Master Data - Products
  PRODUCT: 'PRD',              // PRD-0001 - สินค้า
  RAW_MATERIAL: 'MAT',         // MAT-0001 - วัตถุดิบ
  EGG_SIZE: 'SZ',              // SZ-0 to SZ-6 - ขนาดไข่
  
  // New Item Master System
  ITEM_MASTER: 'ITEM',         // ITEM-0001 - รายการสินค้า/วัตถุดิบ
  EGG_GRADE_RULE: 'GRD',       // GRD-0001 - กฎการคัดขนาดไข่
  FINISHED_PACK_SPEC: 'FPS',   // FPS-0001 - สเปคการแพ็ค
  
  // Transaction Documents
  ORDER: 'ORD',                // ORD-2024-0001 - คำสั่งซื้อ
  GOODS_RECEIVING: 'GR',       // GR-2024-0001 - ใบรับสินค้า
  GRADING_LOT: 'GL',           // GL-0001 - ล็อตคัดขนาด
  GRADING_ACTIVITY: 'GA',      // GA-0001 - กิจกรรมคัดขนาด
  PRODUCTION_REQUEST: 'PR',    // PR-2024-0001 - ใบขอผลิต
  PACKING_ACTIVITY: 'PK',      // PK-0001 - กิจกรรมแพ็ค
  DELIVERY_SCHEDULE: 'SCH',    // SCH-2024-0001 - ตารางจัดส่ง
  
  // Stock & Inventory
  SIZED_EGG_STOCK: 'SES',      // SES-0001 - สต็อกไข่คัดขนาด
  FINISHED_GOODS: 'FG',        // FG-0001 - สินค้าสำเร็จรูป
  STOCK_MOVEMENT: 'SM',        // SM-0001 - การเคลื่อนไหวสต็อก
  
  // Other
  PRICE_ADJUSTMENT: 'PA',      // PA-0001 - ปรับราคา
} as const;

export type CodePrefix = typeof CODE_PREFIXES[keyof typeof CODE_PREFIXES];

/**
 * Format a code with prefix and padded number
 * @param prefix - The prefix from CODE_PREFIXES
 * @param id - The numeric ID
 * @param padding - Number of digits to pad (default: 4)
 * @returns Formatted code like "BP-0001"
 */
export function formatCode(prefix: string, id: number, padding: number = 4): string {
  return `${prefix}-${String(id).padStart(padding, '0')}`;
}

/**
 * Format a document number with year
 * @param prefix - The prefix from CODE_PREFIXES  
 * @param id - The numeric ID
 * @param year - The year (default: current year)
 * @param padding - Number of digits to pad (default: 4)
 * @returns Formatted code like "ORD-2024-0001"
 */
export function formatDocumentNumber(
  prefix: string, 
  id: number, 
  year?: number,
  padding: number = 4
): string {
  const y = year ?? new Date().getFullYear();
  return `${prefix}-${y}-${String(id).padStart(padding, '0')}`;
}

/**
 * Parse a code to extract prefix and ID
 * @param code - The formatted code like "BP-0001" or "ORD-2024-0001"
 * @returns Object with prefix and id, or null if invalid
 */
export function parseCode(code: string): { prefix: string; id: number; year?: number } | null {
  // Try document number format first: PREFIX-YYYY-NNNN
  const docMatch = code.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (docMatch) {
    return {
      prefix: docMatch[1],
      year: parseInt(docMatch[2], 10),
      id: parseInt(docMatch[3], 10),
    };
  }
  
  // Try simple format: PREFIX-NNNN
  const simpleMatch = code.match(/^([A-Z]+)-(\d+)$/);
  if (simpleMatch) {
    return {
      prefix: simpleMatch[1],
      id: parseInt(simpleMatch[2], 10),
    };
  }
  
  return null;
}
