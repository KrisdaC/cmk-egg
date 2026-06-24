# BOM Phase 0–1 — Testing & Upload Schema Guide

**Audience:** you, Sira, testing the build before it goes to operators.
**Date:** 2026-05-18
**Build under test:** `app/index.html` after Task 4 (post-edit MD5 `ba71297dc853316b37ce5e88369fa1ec`).
**Rollback if anything goes wrong:** `cp _archive/index-pre-bom-phase01-20260518.html app/index.html`

This guide has two parts:
1. **Upload file schema** — what an importable BOM workbook must look like.
2. **Step-by-step test instructions** — what to click, what to expect.

---

# PART 1 · Upload file schema

The Phase 0–1 importer reads two specific sheets out of the workbook you upload. Other sheets in the file are **ignored** (they show up in the preview's "Sheets ignored" line, so nothing is silently dropped). You can upload the existing `app/sample-data/Packaging.xlsx` as-is — it already has the right shape.

## Sheet 1 · `Master SKUs` (FG / finished goods)

**Sheet name:** must be `Master SKUs` (case-insensitive, optional trailing `s`).
**Header row:** row **7**.
**Data rows:** row **8** onwards.
**Why row 7:** the legacy spreadsheet has six rows of section markers / row numbers above the real header — the parser skips them automatically. Don't move the header.

| Col | Header (verbatim) | Required? | Type / example | Notes |
|---|---|---|---|---|
| **B** (2) | `Product code` | **REQUIRED** | text · `30002` or `B0008` | Must match an existing `item.sku` in Master Data. **Unknown FG SKUs are SKIPPED with a warning** (`UNKNOWN_FG`). Add the SKU to Master Data first, then re-import. |
| **C** (3) | `Product name` | recommended | text · `ไข่ไก่เบอร์ 0 บรรจุ 10 ฟอง/แพ็ค` | Shown in preview; not written back to the master record. |
| **D** (4) | `Product code 2` | optional | text · alias | Ignored by Phase 0–1. |
| **E** (5) | `Vendor name` | recommended | text · `TT`, `BC`, `MK`, `TF`, `LT`, `ME`, `ตกเกรด` | Customer code. Shown in preview. |
| **F** (6) | `Selling units` | recommended | text · `ฟอง`, `ถาด`, `แพ็ค 10` | Written to `item.bom.output_unit`. |
| **G** (7) | `Packing units` | recommended | text · `แพ็ค 10`, `แพ็ค 4`, `ถาด` | Display label; the **number** of eggs per pack lives separately in `item.units.base_per_pack`. |
| **H** (8) | `pack /selling units` | optional | number · `1` | |
| **I** (9) | `ไข่ (ฟอง) /pack` | **required for egg FG** | number · `10` | Falls back to `eggs_per_selling_unit` if missing. |
| **J** (10) | `ไข่ (ฟอง) /selling units` | **required for egg FG** | number · `10` | If both this AND egg size A are present, used to build the egg-component row. |
| K (11) | `Packaging cost per selling units` | optional | number | **Not used in Phase 0–1.** |
| L (12) | `Packaging cost per ฟอง` | optional | number | **Not used in Phase 0–1.** |
| **M** (13) | `Size ไข่ A` | **required for egg FG** | text · `0`, `1`, `2`, `3`, `4`, `5`, `6` | Egg size label. Becomes one egg-component row. |
| N (14) | `Size ไข่ B` | optional | text · `4` | Only for mixed SKUs (e.g. คละ 3-4). When present, **both A and B rows are flagged `needs_review = true`**. |
| O (15) | `% SKU A` | optional | number 0–1 · `0.4` | Mixed-SKU ratio. Display only — qty comes from the next two columns. |
| **P** (16) | `ฟองต่อ/selling units A` | **required when Size A present** | number · `10` | Eggs of Size A per selling unit. |
| Q (17) | `ฟองต่อ/selling units B` | required when Size B present | number · `18` | Eggs of Size B per selling unit. |
| R (18) | `SKU size` | optional | text · `0`, `1-2 L` | Display label only. |
| S (19) | `Size ตะกร้า` | optional | text · `A`, `no` | Display only in Phase 0–1. Basket-qty logic is Phase 2. |
| **T** (20) | `pack ฐาน` | optional | text · packaging SKU code · `C39999P040` | → component `role=pack_base`, `usage=per_inner_pack`, `qty=1`. **Must exist in Sheet 2** or warning fires. |
| U (21) | `ฝาครอบ` | optional | text · packaging SKU code | → `role=cover`, `usage=per_inner_pack`, `qty=1`. |
| V (22) | `ฉลาก barcode SKUs` | optional | text · packaging SKU code | → `role=barcode_sku_label`, `usage=per_inner_pack`, `qty=1`. |
| W (23) | `ฉลาก label/sticker` | optional | text · packaging SKU code | → `role=product_label_sticker`, `usage=per_inner_pack`, `qty=1`, **`needs_review=true`** (you may want a different rule per customer). |
| X (24) | `Closer 1` | optional | text · packaging SKU code | → `role=closer_1`, `usage=manual`, **`needs_review=true`** (qty depends on machine). |
| Y (25) | `Closer 2` | optional | text · packaging SKU code | → `role=closer_2`, `usage=manual`, **`needs_review=true`**. |
| Z (26) | `ฉลาก barcode Bulk` | optional | text · packaging SKU code | → `role=bulk_barcode_label`, `usage=per_selling_unit`, `qty=1`, **`needs_review=true`**. |
| AA (27) | `Selling units per Pallet` | optional | number · `120` | Display only in Phase 0–1. |

## Sheet 2 · `Master Packaging SKUs` (packaging master)

**Sheet name:** must be `Master Packaging SKUs` (case-insensitive, optional trailing `s` on `SKUs`).
**Header row:** row **2**.
**Data rows:** row **3** onwards.

| Col | Header (verbatim) | Required? | Type / example | Notes |
|---|---|---|---|---|
| **B** (2) | `SKU NUMBER` | **REQUIRED** | text · `A19999P040`, `C39999P040`, `C29999P301` | This is the code the FG sheet references in columns T–Z. Goes into `MASTER_V3.items[].sku` for the upserted packaging item. |
| **C** (3) | `SKU name` | recommended | text · `ถาดกระดาษ 30 ใหญ่` | Goes into `MASTER_V3.items[].name`. |
| D (4) | `Customers` | optional | text · `All`, `TT`, `MK` | Scope label. Stored in `item.bom_material.customer_scope`. |
| E (5) | `Group` | optional | text · `Packaging` | Display only. |
| **F** (6) | `Subgroup` | recommended | text · `ถาดกระดาษ`, `ฝาครอบ`, `สติกเกอร์`, `ฉลาก`, `สายรัด`, `กล่องสำเร็จ`, `เชือก`, `แมก`, `คาร์บอน` | Drives **family classification** for display in Daily Plan → BOM. Family is auto-derived (see family map below). |
| G (7) | `ราคาซื้อ (ล่าสุด) +ขนส่ง+ VAT` | optional | number | Stored in `item.bom_material.purchase_cost` (informational; not used by BOM calc yet). |
| H (8) | `อัตราการสูญเสีย %` | optional | number 0–1 · `0.005` | Stored in `item.bom_material.loss_pct`. |
| I (9) | `Net cost` | optional | number | Stored in `item.bom_material.net_cost`. |

### Subgroup → family map (auto)

| If `Subgroup` contains… | Family becomes |
|---|---|
| `ฝาครอบ`, `ครอบ` | `ฝาครอบ` |
| `ถาดกระดาษ`, `ถาด`, `tray` | `ถาด` |
| `กล่อง`, `แพ็ค`, `pack` | `แพ็ค` |
| `สติกเกอร์`, `สติ๊กเกอร์`, `ฉลาก`, `label`, `sticker` | `ฉลาก` |
| `สายรัด`, `เชือก`, `strap` | `สายรัด` |
| `มัด`, `bundle` | `มัด` |
| `ตะกร้า`, `basket` | `ตะกร้า` |
| anything else | `อื่นๆ` |

## Relationship between the two sheets

```
        Master SKUs (FG)                  Master Packaging SKUs
        ----------------                  ---------------------
        Product code (col B)               SKU NUMBER (col B)
              │                                    ▲
              │ must already exist in              │ packaging-SKU code
              │ MASTER_V3.items.sku                │ from FG cols T..Z
              ▼                                    │ is looked up here
       MASTER_V3.items[i]            ──────────────┘
              │
              │ becomes
              ▼
       item.bom = {
         enabled, no_bom_required, output_unit,
         components: [
           // egg row(s) from FG cols I, J, M, N, P, Q
           { component_type: 'egg', component_name: 'เบอร์ 2', ... },
           // packaging row(s) from FG cols T..Z
           { component_type: 'packaging', component_role: 'pack_base',
             component_sku: 'C39999P040', component_name: ..., ... },
         ],
         routes: [ ... ],   // auto-built only for mixed SKUs (Size A + B)
         updated_at, updated_by: 'bom_phase01_import'
       }
```

### What happens at commit time

| Source row | Lookup in `MASTER_V3.items` | Action |
|---|---|---|
| FG row, `Product code` **found** | yes | `item.bom` written (replaces any existing `components` / `routes` — see **UAT-014** caveat below) |
| FG row, `Product code` **not found** | no | **SKIPPED**, warning row `UNKNOWN_FG` |
| Packaging row, `SKU NUMBER` **found** | yes | soft-merge: fills blank `name`, sets `item_role='PACKAGING'`, attaches `item.bom_material`. Never overwrites a non-empty existing name. |
| Packaging row, `SKU NUMBER` **not found** | no | **NEW item created** with `item_role='PACKAGING'`, `is_consumable=true`, `units.base_unit='ชิ้น'`, `bom_material:{ subgroup, family, net_cost, loss_pct, customer_scope }` |
| FG component references packaging SKU **not in Sheet 2** | — | component row gets `needs_review=true` + warning `UNKNOWN_PACKAGING_SKU` |

**UAT-014 caveat:** if you re-import the same FG SKU after manually editing its BOM, your manual edits to `components` / `routes` are **replaced**. The importer auto-snapshots `MASTER_V3` before and after (named `bom_phase01_import_pre` / `bom_phase01_import_post`), so you can recover with `restoreMasterV3FromBackup('demand_dashboard_master_v3_backup_…__bom_phase01_import_pre')` in DevTools.

---

# PART 2 · Step-by-step test instructions

Before you start: open the **Console** in DevTools (Cmd-Option-I → Console tab). Most of the smoke checks below run a small JS snippet there.

## Test A · Smoke / no-regression (3 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| A1 | Open `app/index.html` in a fresh tab. | Page renders. Header strip shows version + counts. No red errors in console. | ☐ |
| A2 | In Console run `MASTER_V3.items.length` | A number (likely 128). Same as the header strip's "items" count. | ☐ |
| A3 | Click **Master data** tab → **Items** sub-tab. | Items table renders. Same rows as before. | ☐ |
| A4 | Click **Daily Plan** tab → **🥚 BOM** sub-tab on a date with orders. | Renders exactly as before. No new families appear (only if you've added packaging SKUs whose subgroup contains the new keywords). | ☐ |
| A5 | In Console run `typeof openBomBulkUpload, typeof parseBomWorkbook, typeof commitBomImport, typeof _bomRenderItemEditSection` | All four should print `'function'`. | ☐ |

If A1–A5 all pass, nothing has regressed. Move to Test B.
**If A1 fails (red error overlay or boot fails):** roll back immediately (`cp _archive/index-pre-bom-phase01-20260518.html app/index.html`).

## Test B · BOM bulk upload — preview then cancel (3 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| B1 | Master Data → Items toolbar. Find the new button **🧪 BOM Bulk Upload · นำเข้า BOM** between Import Excel and Export JSON. | Button is visible, not greyed out. Hover tooltip says "BOM Phase 0–1 · ingest Packaging.xlsx (preview then commit)". | ☐ |
| B2 | Click it. | Native file picker opens. | ☐ |
| B3 | Choose `app/sample-data/Packaging.xlsx`. | Full-screen preview overlay appears within ~2 seconds. | ☐ |
| B4 | Read the four KPI cards. | `FG SKU พบในไฟล์`: ~124. `Packaging SKU`: ~87. `Component rows`: >0. `Warnings`: >0 (most will be `UNKNOWN_FG` because the seed master only has 128 items and not all are in this xlsx). | ☐ |
| B5 | Read the "Sheets used / Sheets ignored" line. | Used: `Master SKUs, Master Packaging SKUs`. Ignored: `วางแผนไข่รายวัน, วางแผนไข่รายสัปดาห์, Production order`. | ☐ |
| B6 | Scroll the **รายการ FG (top 80)** table. Look at the `known?` column. | A mix of ✓ and `unknown` (yellow background) rows. Egg-components and packaging-components show in their columns. | ☐ |
| B7 | Scroll the **คำเตือน** table. | Rows for any `UNKNOWN_FG` and `UNKNOWN_PACKAGING_SKU` warnings. `issue_level` is `warn`, not `error`. | ☐ |
| B8 | Click **⬇ Download Import_Review**. | XLSX file downloads. Open it: three sheets `Import_Review`, `FG_Components`, `Packaging_SKU_Master`. | ☐ |
| B9 | Click **ยกเลิก · Cancel**. | Modal closes. | ☐ |
| B10 | In Console run `MASTER_V3.items.length` | **Unchanged** from A2. Nothing was committed. | ☐ |

If B1–B10 all pass, the read/preview path works without side-effects.

## Test C · BOM bulk upload — commit (5 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| C1 | In Console: run `_pre = MASTER_V3.items.length` to remember the pre-count. | A number. | ☐ |
| C2 | Click **🧪 BOM Bulk Upload · นำเข้า BOM** → pick `Packaging.xlsx` → wait for preview. | Same preview as B3. | ☐ |
| C3 | Click **✅ Commit · บันทึก N FG + M packaging**. | Confirm dialog: "Commit BOM import? Pre-snapshot will be written before save." | ☐ |
| C4 | Click OK. | Toast: `✓ Imported · X FG BOMs · Y new packaging · Z packaging updated · W FG skipped`. Modal closes. Items table refreshes. | ☐ |
| C5 | In Console: `MASTER_V3.items.length - _pre` | Equals **Y** (the number of new packaging items from the toast). | ☐ |
| C6 | In Console: `listMasterV3Backups().slice(-3)` | Bottom of the list shows two new entries ending in `__bom_phase01_import_pre` and `__bom_phase01_import_post`. | ☐ |
| C7 | In Console: `MASTER_V3.items.filter(i => i.bom && i.bom.enabled).length` | Equals **X** from the toast (the number of FG BOMs written). | ☐ |
| C8 | In Console: `MASTER_V3.items.find(i => i.sku === 'A19999P040')` | Returns an item with `item_role: 'PACKAGING'`, `name: 'ถาดกระดาษ 30 ใหญ่'` (or similar), and `bom_material: { subgroup: 'ถาด' or similar, family: 'ถาด', ... }`. | ☐ |

## Test D · Item edit BOM section (4 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| D1 | Master Data → Items. Filter / search for an FG SKU you know was committed (e.g. `30002` if it exists). | Item appears in the list. | ☐ |
| D2 | Click **แก้ไข · Edit** on that row. | Edit modal opens. | ☐ |
| D3 | Scroll to find the section **🧪 BOM / สูตรผลิต · BOM / Production formula**. Click **แสดง · Show**. | Section expands. You see two checkboxes (`เปิดใช้ BOM` and `ไม่ต้องมี BOM`), an Output unit text box, a Components table with rows, an empty Routes table (or one row if mixed-size SKU), a Notes textarea, and an "อัปเดตล่าสุด · Updated:" line with `bom_phase01_import`. | ☐ |
| D4 | Verify `เปิดใช้ BOM` is **checked**. | Yes. | ☐ |
| D5 | Uncheck `เปิดใช้ BOM`, tick `ไม่ต้องมี BOM`, type "test" in Notes. Click **บันทึก · Save**. | Modal closes. Toast `Saved`. | ☐ |
| D6 | Re-open the same item. Expand BOM section. | `เปิดใช้ BOM` is unchecked. `ไม่ต้องมี BOM` is checked. Notes shows "test". Components table unchanged. | ☐ |
| D7 | In Console: `MASTER_V3.items.find(i => i.sku === '30002').bom` | Object with `enabled: false`, `no_bom_required: true`, `notes: 'test'`, plus the original `components[]` and `updated_at` from the import. | ☐ |
| D8 | Re-tick `เปิดใช้ BOM`, untick `ไม่ต้องมี BOM`, clear Notes. Save. | Round-trip works cleanly. | ☐ |

## Test E · Validation warnings (2 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| E1 | Master Data → click **Run Master Data Health**. | Health panel renders. | ☐ |
| E2 | Filter / scroll to Items warnings. | New warnings for FG/sellable items that don't have BOM enabled/no_bom_required set: `ยังไม่ระบุ BOM (enable / no_bom_required)`. | ☐ |
| E3 | Look for "blockingErrors" count. | **Not increased** by any BOM-related issue. (Phase 0–1 only adds warnings.) | ☐ |
| E4 | Take any FG item you didn't import (still has no `bom`). Click Edit → Save without changing anything. | Save succeeds. The "ยังไม่ระบุ BOM" warning shows in the validation box but does NOT block the save. | ☐ |

## Test F · Round-trip via Backup / Restore (3 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| F1 | Header strip → **⬇ Backup now**. | JSON file downloads (`cmk-uat-backup-…json`). | ☐ |
| F2 | Open the file in a text editor. Search for `"bom"` and for `"PACKAGING"`. | Both present. The committed `item.bom` objects and the packaging items survive in the backup. | ☐ |
| F3 | Header strip → **↻ Restore from file…** → pick the file from F1 → accept both confirms. | Page reloads. | ☐ |
| F4 | Re-run C5, C7, C8 console snippets. | Same numbers as before restore. `item.bom` survives the round trip. | ☐ |

## Test G · No-regression on other modules (5 min)

| # | Step | Expected | ✓ |
|---|---|---|---|
| G1 | Orders tab → open any existing draft / invoice. | Loads as before. | ☐ |
| G2 | Daily Plan → Demand sub-tab. | Renders. | ☐ |
| G3 | Daily Plan → 🥚 BOM sub-tab on a date with orders. | Renders. Same V2 layout. | ☐ |
| G4 | Daily Plan → ใบน้อย sub-tab. | Renders. | ☐ |
| G5 | Daily Plan → 🚛 Logistics sub-tab. | Renders. | ☐ |
| G6 | Master Data → upload a Makro / BigC PO file as you normally would. | Existing PO upload path works unchanged. | ☐ |

---

## If any test fails

1. Note which step + what you saw.
2. Add a row to `docs/BUG_LOG.md` under Open.
3. If it's a 🔴 Blocker (data loss, crash, can't open the app): **roll back**
   ```bash
   cp _archive/index-pre-bom-phase01-20260518.html app/index.html
   ```
   and ping me with the row from BUG_LOG.

## Optional · Save your test run

When you're done, save a copy of this file to `_archive/QA_CHECKLIST-RUNS/20260518-bom-phase01-RUN.md` with the boxes ticked and any deviation notes. That's the discipline `docs/DEVELOPMENT_WORKFLOW.md` rule 4 asks for.
