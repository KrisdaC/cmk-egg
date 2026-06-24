import * as XLSX from "xlsx";

export interface ParsedPOLine {
  customerItemCode: string;
  itemName: string;
  poQty: number;
  poPrice: number;
}

export interface ParsedPO {
  poNumber: string;
  orderDate: string;
  deliveryDate: string;
  lines: ParsedPOLine[];
  // Site-detection hints extracted from the file
  _shipTo?: string;       // raw ship-to address text (Makro)
  _branchCode?: string;   // extracted branch code from PO number (Makro)
  _shipToCode?: string;   // Ship To EAN/code column (BigC)
}

export type POFormat = "makro" | "bigc" | "thaifood";

export const FORMAT_ACCEPT: Record<POFormat, string> = {
  makro:    ".xlsx,.xls",
  bigc:     ".csv,.txt,.xlsx,.xls",
  thaifood: ".xlsx,.xls",
};

// ── Site type returned by /api/pricing/delivery-sites ─────────────────────────

export interface DeliverySite {
  id: number;
  displayName: string;
  siteCode?: string;
  partnerBranchCode?: string | null;
  province?: string | null;
  addressLine1?: string | null;
  deliveryType?: string;
}

// ── Site auto-detection (mirrors handover parseMakroPoSheet + BigC logic) ─────

export function detectSiteFromPO(format: POFormat, pos: ParsedPO[], sites: DeliverySite[]): DeliverySite | null {
  if (!sites.length || !pos.length) return null;
  const po = pos[0];

  if (format === "makro") {
    // Step 1: match partner_branch_code against extracted PO branch code
    const branchCode = po._branchCode ?? "";
    if (branchCode) {
      const match = sites.find(s =>
        s.partnerBranchCode != null &&
        norm(s.partnerBranchCode) === norm(branchCode),
      );
      if (match) return match;
    }

    // Step 2: fuzzy province/city match from ship-to address text
    const shipTo = po._shipTo ?? "";
    if (shipTo) {
      for (const site of sites) {
        const hay = [site.displayName, site.province, site.addressLine1]
          .filter(Boolean)
          .join(" ");
        // Check if any word from the site's location appears in the ship-to text
        const provinceClean = (site.province ?? "").replace(/จังหวัด|เขต/g, "").trim();
        if (provinceClean && shipTo.includes(provinceClean)) return site;
        if (hay && shipTo.includes(site.displayName ?? "")) return site;
      }
    }
  }

  if (format === "thaifood") {
    const plantCode = po._branchCode ?? "";
    if (plantCode) {
      const match = sites.find(s =>
        s.partnerBranchCode != null &&
        norm(s.partnerBranchCode) === norm(plantCode),
      );
      if (match) return match;
      // Fallback: siteCode match
      const byCode = sites.find(s => norm(s.siteCode ?? "") === norm(plantCode));
      if (byCode) return byCode;
    }
  }

  if (format === "bigc") {
    const code = norm(po._shipToCode ?? "");
    if (code) {
      const match = sites.find(s => {
        const candidates = [s.siteCode, s.partnerBranchCode, String(s.id)].map(x => norm(x ?? ""));
        return candidates.includes(code);
      });
      if (match) return match;
    }
  }

  return null;
}

function norm(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

// ── File parsing ──────────────────────────────────────────────────────────────

export async function parseFile(format: POFormat, file: File): Promise<ParsedPO[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", codepage: 874, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (format === "makro") return parseMakro(ws, rows);
  if (format === "bigc")  return parseBigC(rows);
  if (format === "thaifood") return parseThaiFood(rows);
  return [];
}

// ── Makro parser (mirrors handover parseMakroPoSheet) ─────────────────────────

function parseMakro(ws: XLSX.WorkSheet, rows: any[][]): ParsedPO[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);

  const cell = (r: number, c: number): any => {
    const v = ws[XLSX.utils.encode_cell({ r, c })];
    return v ? v.v : null;
  };

  // Find the line-table header row (contains "รหัสแม็")
  let lineHeaderRow = -1;
  for (let r = 0; r <= Math.min(range.e.r, 80); r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const v = cell(r, c);
      if (typeof v === "string" && v.includes("รหัสแม็")) { lineHeaderRow = r; break; }
    }
    if (lineHeaderRow >= 0) break;
  }

  // Identify data columns
  const cols = { code: -1, name: -1, perPack: -1, unit: -1, qty: -1 };
  if (lineHeaderRow >= 0) {
    for (let c = 0; c <= range.e.c; c++) {
      const v = cell(lineHeaderRow, c);
      if (typeof v === "string") {
        if (v.includes("รหัสแม็")) cols.code = c;
        if (v.includes("รายการ")) cols.name = c;
        if (v.includes("จำนวน") && !v.includes("สั่งซื้อ") && cols.perPack === -1) cols.perPack = c;
        if (v.includes("จำนวนสั่งซื้อ")) cols.qty = c;
        if (v === "ชนิด" || v.startsWith("ชนิด")) cols.unit = c;
      }
    }
  }

  // Extract header metadata: PO number, dates, ship-to address
  let poNumber = "", orderDate = "", deliveryDate = "", shipTo = "";
  for (let r = 0; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const v = cell(r, c);
      if (typeof v !== "string") continue;
      if (r < (lineHeaderRow >= 0 ? lineHeaderRow : 80)) {
        if (v.includes("เลขที่ใบสั่งซื้อ")) {
          const nxt = cell(r + 1, c);
          if (nxt != null) poNumber = String(nxt);
        }
        if (v.includes("วันที่สั่งสินค้า")) {
          const nxt = cell(r + 1, c);
          if (nxt != null) orderDate = parseDateCell(nxt);
        }
        if (v.includes("โปรดส่งสินค้าไปที่")) {
          const parts: string[] = [];
          const limit = lineHeaderRow >= 0 ? lineHeaderRow : r + 8;
          for (let rr = r + 1; rr < r + 8 && rr < limit; rr++) {
            const x = cell(rr, c);
            if (x) parts.push(String(x).trim());
          }
          shipTo = parts.join(" ");
        }
      }
      // Delivery date — scan entire sheet (mirrors handover UAT50)
      if (v.includes("วันที่ส่งของ") && !deliveryDate) {
        const candidates = [cell(r, c+1), cell(r, c+2), cell(r+1, c), cell(r+1, c+1), cell(r+1, c+2)];
        for (const cand of candidates) {
          if (cand != null && cand !== "") { deliveryDate = parseDateCell(cand); break; }
        }
      }
    }
  }

  // Fallback: use simple row-based parser if column detection failed
  if (cols.code === -1 || cols.qty === -1) {
    return parseMakroSimple(rows, poNumber, orderDate, deliveryDate, shipTo);
  }

  // Parse line items
  const lines: ParsedPOLine[] = [];
  for (let r = lineHeaderRow + 1; r <= range.e.r; r++) {
    const code = cell(r, cols.code);
    const qty  = cell(r, cols.qty);
    if (code == null || code === "" || qty == null) continue;
    const codeStr = String(code).trim();
    if (!/^\d+$/.test(codeStr)) continue;
    const poQty = Number(qty) || 0;
    if (!poQty) continue;
    lines.push({
      customerItemCode: codeStr,
      itemName: String(cell(r, cols.name) ?? ""),
      poQty,
      poPrice: 0,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  return [{
    poNumber: poNumber || `MK-${today}`,
    orderDate: orderDate || today,
    deliveryDate: deliveryDate || today,
    lines,
    _shipTo: shipTo,
    _branchCode: extractMacroBranchCode(poNumber),
  }];
}

// Fallback row-based Makro parser (when header detection fails)
function parseMakroSimple(rows: any[][], poNumber: string, orderDate: string, deliveryDate: string, shipTo: string): ParsedPO[] {
  const startIndex = 28;
  if (rows.length <= startIndex) return [];

  const remarksIndex = rows.findIndex((row, idx) => {
    if (idx <= startIndex) return false;
    return row.some((cell) => String(cell).toLowerCase().includes("remarks"));
  });
  const endIndex = remarksIndex === -1 ? rows.length : remarksIndex;
  const dataRows = rows.slice(startIndex, endIndex).filter((r) => r.some((c) => c !== null && c !== ""));

  const trimmed = dataRows.map((row) => {
    const r = [...row];
    if (r.length > 16) r.splice(16, 1);
    if (r.length > 14) r.splice(14, 1);
    if (r.length > 13) r.splice(13, 1);
    if (r.length > 11) r.splice(11, 1);
    if (r.length > 9)  r.splice(9, 1);
    if (r.length > 7)  r.splice(7, 1);
    if (r.length > 4)  r.splice(4, 1);
    if (r.length > 2)  r.splice(2, 1);
    return r;
  });

  const today = new Date().toISOString().slice(0, 10);
  return [{
    poNumber: poNumber || `MK-${today}`,
    orderDate: orderDate || today,
    deliveryDate: deliveryDate || today,
    lines: trimmed
      .map((r) => ({
        customerItemCode: String(r[4] ?? ""),
        itemName: String(r[1] ?? ""),
        poQty: Number(r[7] ?? 0),
        poPrice: 0,
      }))
      .filter((l) => l.poQty > 0),
    _shipTo: shipTo,
    _branchCode: extractMacroBranchCode(poNumber),
  }];
}

// Extract Makro branch code from PO number:
// "7.89291153" → "7"  (part before the dot)
// "12345-22"   → "22" (part after the dash)
function extractMacroBranchCode(poNumber: string): string {
  const clean = (poNumber ?? "").replace(/[^\d.-]/g, "");
  if (clean.includes(".")) {
    const m = clean.match(/^(\d+)\./);
    if (m) return m[1];
  }
  if (clean.includes("-")) {
    const m = clean.match(/-(\d+)$/);
    if (m) return m[1];
  }
  const m = clean.match(/^(\d{1,4})/);
  return m ? m[1] : "";
}

// ── BigC parser ────────────────────────────────────────────────────────────────

function parseBigC(rows: any[][]): ParsedPO[] {
  if (rows.length < 2) return [];

  // Check if it has a header row (CSV/XLSX with column names)
  const header = rows[0].map((h: any) => String(h ?? "").trim());
  const cOrderNo    = header.findIndex(h => /order.?no|order.?number/i.test(h));
  const cOrderDate  = header.findIndex(h => /order.?date/i.test(h));
  const cDelivDate  = header.findIndex(h => /delivery.?date|deliv.?date/i.test(h));
  const cShipToEan  = header.findIndex(h => /ship.?to.?ean|ean.?number/i.test(h));
  const cItemCode   = header.findIndex(h => /internal.?product.?code|item.?code/i.test(h));
  const cEan        = header.findIndex(h => /^ean.?product/i.test(h));
  const cOrderQty   = header.findIndex(h => /order.?qty|order.?quantity/i.test(h));
  const cPrice      = header.findIndex(h => /price|unit.?price/i.test(h));

  const poMap: Record<string, ParsedPO> = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[Math.max(cOrderNo, 0)]) continue;

    const poNum = cOrderNo >= 0 ? String(r[cOrderNo] ?? "") : String(r[0] ?? "");
    if (!poNum) continue;

    const shipToCode = cShipToEan >= 0 ? String(r[cShipToEan] ?? "").trim() : "";

    if (!poMap[poNum]) {
      poMap[poNum] = {
        poNumber: poNum,
        orderDate: cOrderDate >= 0 ? parseDateCell(r[cOrderDate]) : "",
        deliveryDate: cDelivDate >= 0 ? parseDateCell(r[cDelivDate]) : parseDateCell(r[2]),
        lines: [],
        _shipToCode: shipToCode || undefined,
      };
    }

    const itemCode = cItemCode >= 0 ? String(r[cItemCode] ?? "") : String(r[4] ?? "");
    const ean      = cEan >= 0 ? String(r[cEan] ?? "") : "";
    const poQty    = cOrderQty >= 0 ? Number(r[cOrderQty]) : Number(r[30] ?? r[26] ?? 0);
    const poPrice  = cPrice >= 0 ? Number(r[cPrice]) : Number(r[32] ?? 0);

    if (poQty > 0) {
      poMap[poNum].lines.push({
        customerItemCode: ean || itemCode,
        itemName: String(r[cItemCode >= 0 ? cItemCode + 1 : 24] ?? ""),
        poQty,
        poPrice,
      });
    }
  }

  return Object.values(poMap);
}

// ── ThaiFood parser ────────────────────────────────────────────────────────────
// SAP flat export: row 0 = header, then one line item per row.
// Columns (0-indexed): 1=Plant, 2=Purchase Order, 9=Create Date,
//   12=Document Date, 14=Material, 15=Short Text, 18=Quantity,
//   20=Net Price, 23=Delivery Date

function parseThaiFood(rows: any[][]): ParsedPO[] {
  if (rows.length < 2) return [];

  const header = rows[0].map((h: any) => String(h ?? "").trim().toLowerCase());

  const ci = (name: string) => header.findIndex(h => h === name.toLowerCase());
  const cPlant      = ci("Plant");
  const cPO         = ci("Purchase Order");
  const cCreateDate = ci("Create Date");
  const cMaterial   = ci("Material");
  const cShortText  = ci("Short Text");
  const cQty        = ci("Quantity");
  const cPrice      = ci("Net Price");
  const cDelivDate  = ci("Delivery Date");

  // Fallback to positional if header detection fails
  const col = (r: any[], idx: number, fallback: number) =>
    idx >= 0 ? r[idx] : r[fallback];

  const poMap: Record<string, ParsedPO> = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const poNum = String(col(r, cPO, 2) ?? "").trim();
    if (!poNum) continue;

    const plant = String(col(r, cPlant, 1) ?? "").trim();

    if (!poMap[poNum]) {
      poMap[poNum] = {
        poNumber: poNum,
        orderDate: parseDateCell(col(r, cCreateDate, 9)),
        deliveryDate: parseDateCell(col(r, cDelivDate, 23)),
        lines: [],
        _branchCode: plant,
      };
    }

    const qty   = Number(col(r, cQty, 18)) || 0;
    const price = Number(col(r, cPrice, 20)) || 0;
    if (qty <= 0) continue;

    poMap[poNum].lines.push({
      customerItemCode: String(col(r, cMaterial, 14) ?? "").trim(),
      itemName: String(col(r, cShortText, 15) ?? "").trim(),
      poQty: qty,
      poPrice: price,
    });
  }

  return Object.values(poMap);
}

// ── Date cell parsing ─────────────────────────────────────────────────────────
// Handles every format seen in Makro / BigC / Thaifood PO files:
//  - JavaScript Date object (cellDates: true)
//  - Excel serial number (5-digit integer)
//  - DD/MM/YYYY  (Thai/European string)
//  - DD-MM-YYYY
//  - YYYYMMDD (8-digit string)
//  - ISO YYYY-MM-DD

function parseDateCell(v: any): string {
  if (v == null || v === "") return "";

  // JavaScript Date object returned by XLSX when cellDates: true
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Use local date parts to avoid UTC-midnight timezone shift
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(v).trim();

  // Excel serial date number (44000–50000 covers 2020–2036)
  if (/^\d{5}$/.test(s) && Number(s) > 40000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(Number(s));
      if (parsed?.y) {
        return `${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;
      }
    } catch { /* fall through */ }
  }

  // DD/MM/YYYY or DD-MM-YYYY (Thai / European format)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }

  // YYYYMMDD (8-digit string)
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  return "";
}
