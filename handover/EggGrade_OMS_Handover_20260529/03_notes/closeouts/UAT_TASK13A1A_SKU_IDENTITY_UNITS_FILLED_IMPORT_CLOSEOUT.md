# UAT Task 13A-1A — Import Filled SKU Identity + Units Sheet Only — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `e5ea86259e2c7a4eb0f115d25eb1b2dd`
**Post-edit app MD5:** `398d4caf88d862e78cc04ca0e4396ec1`
**Rollback:** `cp _archive/index-pre-task13a1a-filled-import-20260528.html app/index.html`

A surgical follow-up to Task 13A-1 that hardens the import flow against
**operator-edited** workbooks. The supporting sheets (`Dropdown_Options_*`,
`Field_Dictionary_*`, `Validation_Rules_*`, `Current_Validation_Report`) are
now **explicitly ignored** by the importer (they were already not consumed,
but were silent about it). The preview surfaces an "Only SKU_Identity_Units
was used" banner with the ignored sheet names listed. A new
`behavior_from_role_derived` review-only column is computed from the existing
`_ROLE_BEHAVIOR_DEFAULTS` (Task 7C-2) and shown per row in the preview —
never written to `MASTER_V3.items`. Derived columns are always recomputed
from current code; the workbook's stale derived values are never trusted.

13 anchored edits, all inside the Task 13A-1 module. Three new helpers
(`_behaviorFromRole`, `_roleSupportedByBehaviorMap`, ignored-sheets tracking
in `_parseXlsxImport` / `_parseJsonImport`). `node --check` clean on all 8
inline blocks. Brace / paren / bracket deltas all 0. **18 / 18** acceptance
assertions pass when the actual uploaded workbook is parsed through the
importer with the live `demand_master_v3.json` as MASTER_V3.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1a-filled-import-20260528.html` |
| Pre-edit MD5 | `e5ea86259e2c7a4eb0f115d25eb1b2dd` (the post-Task-13A-1 state) |
| Post-edit MD5 | `398d4caf88d862e78cc04ca0e4396ec1` |
| Bytes delta | +6,804 bytes |
| Rollback | `cp _archive/index-pre-task13a1a-filled-import-20260528.html app/index.html` |

Earlier backups remain available for deeper rollbacks:
`_archive/index-pre-task13a1-skuid-units-20260528.html` (pre-13A-1),
`_archive/index-pre-master-cta-deprecate-20260528.html` (pre-13A-0B).

## B. Uploaded workbook handling

Inspected file:
`/Uploads/cmk-sku-identity-units-20260528-1322 - filled.xlsx`

| Property | Value |
|---|---|
| Sheets detected | `SKU_Identity_Units`, `Dropdown_Options_Identity_Units`, `Field_Dictionary_Identity_Units`, `Validation_Rules_Identity_Units`, `Current_Validation_Report` |
| Sheet used by importer | **`SKU_Identity_Units`** (the only one consumed) |
| Sheets ignored | 4 supporting sheets above |
| Data rows | 202 (one row per SKU; no duplicates) |
| Roles in file | FG 107, PACKAGING 77, WIP 9, DEFECT 8, RM 1 |
| Cross-check against current master | 125 SKUs match existing items (→ update), 77 SKUs are new (→ create), 3 existing items not in the file (→ unchanged, untouched) |
| Customer codes seen | `C001` 53, `C002` 33, `C005` 37, `C024` 10, `C003` 9, `C004` 7, `"See comments"` 9, blank 44 |

Confirmed:

- ✓ **Only `SKU_Identity_Units` was used**. The 4 supporting sheets are
  recorded in `parsed.ignored_sheets[]` and surfaced in the preview modal
  with a clear Thai-first / English banner. They are **never read** for
  dropdown values, validation rules, field definitions, or the validation
  report — current app code is the authority.
- ✓ **Supporting sheets ignored** even when the file contains them. Importer
  also works when the file has only one sheet (the brief's "supporting sheets
  deleted" case).
- ✓ **Derived fields recomputed** from current logic for every row. The
  workbook's stale `customer_name_derived`, `selling_base_factor_derived`,
  `selling_to_pack_ratio_derived`, `pack_to_selling_ratio_derived`,
  `unit_ladder_summary_derived`, and `behavior_from_role_derived` cells are
  ignored — every preview row carries a fresh recompute. Blank / outdated
  derived cells **never** block import.

## C. Behavior from role

### C.1 Inspection result

**Yes** — the app has a clear behavior-from-role concept. It was introduced
by Task 7C-2 (2026-05-21) and lives at `app/index.html` ~ line 11282 as the
constant `_ROLE_BEHAVIOR_DEFAULTS`:

```javascript
const _ROLE_BEHAVIOR_DEFAULTS = {
  FG:         { sellable: true,  producable: true,  consumable: false },
  WIP:        { sellable: false, producable: true,  consumable: false },
  RM:         { sellable: false, producable: false, consumable: true  },
  PACKAGING:  { sellable: false, producable: false, consumable: true  },
  SUPPLY:     { sellable: false, producable: false, consumable: true  },
  DEFECT:     { sellable: true,  producable: false, consumable: false },
};
```

The Item editor surfaces these via the existing `_behaviorChipsHtml(sellable,
producable, material)` chip row (Item modal → Counting & Units section
header). The three flags `is_sellable / is_producable / is_consumable` are
**stored** on each item; on `item_role` change in the editor, they are
pre-set from `_ROLE_BEHAVIOR_DEFAULTS` (then the operator may override).

### C.2 How Task 13A-1A surfaces behavior

| Surface | Behavior |
|---|---|
| **Derived column name** | `behavior_from_role_derived` (added to `DERIVED_FIELDS` and to `SHEET1_COLUMNS` so the **next** export documents it, and so a round-trip never flags it as an "ignored column") |
| **Field Dictionary row** | One new dictionary entry: `section=Identity, field_key=behavior_from_role_derived, dropdown_source=derived (from _ROLE_BEHAVIOR_DEFAULTS), validation_rule=review only, editable_in_ui=no, notes="Maps item_role -> {sellable,producable,consumable} via the Item editor preset (Task 7C-2). Never written to MASTER_V3.items by the importer; is_sellable / is_producable / is_consumable remain the stored flags and are owned by the Item editor."` |
| **Operator-facing label (TH)** | `พฤติกรรมจากบทบาท · Behavior from role` |
| **Sample values** | `FG → "ขายได้ + ผลิตได้ · Sellable + Producable"`, `WIP → "ผลิตได้ · Producable"`, `RM → "เป็นวัสดุ/BOM · Material"`, `PACKAGING → "เป็นวัสดุ/BOM · Material"`, `SUPPLY → "เป็นวัสดุ/BOM · Material"`, `DEFECT → "ขายได้ · Sellable"`, unknown role → `""` |
| **Where shown** | Preview modal row table — last column titled `behavior (from role)`. Also rendered by `_deriveRow()` so the next export carries the recomputed value. |
| **Persistence** | **REVIEW-ONLY — never persisted.** `_overlayRowOntoItem` does NOT write `behavior_from_role_derived` and the import flow never creates a `behavior` field on `MASTER_V3.items`. The existing `is_sellable / is_producable / is_consumable` flags remain owned by the Item editor; the importer does not touch them. |
| **Helper exposure for tests** | `T13A1.behaviorFromRole(role)` returns the readable label; `T13A1.roleSupportedByBehaviorMap(role)` returns `true` if the role exists in `_ROLE_BEHAVIOR_DEFAULTS`. |

### C.3 Why not write the three flags

The brief explicitly forbids creating a new stored `behavior` field unless one
already exists. The existing stored fields are
`is_sellable / is_producable / is_consumable`, which are owned by the Item
editor's role-change preset (Task 7C-2). To avoid stepping on that ownership
boundary, the importer writes none of them in this sprint. The derived label
is for **review** in the preview modal and for documentation in the next
exported Field Dictionary.

## D. Import validation and preview

### D.1 Blocking errors (unchanged from Task 13A-1)

```
blank sku
duplicate sku in SKU_Identity_Units
missing name_th
missing item_role
invalid item_role (not in option_sets.item_role)
invalid item_type for the row's item_role (against getItemTypeOptionsForRole)
missing base_unit
pack_unit set but base_per_pack missing or ≤ 0
storage_unit set but base_per_storage missing or ≤ 0
selling_unit cannot resolve to a base factor via getSellingUnitBaseFactor(tmpItem)
```

### D.2 Warnings (unchanged plus one new advisory)

```
new SKU will be created
existing SKU will be updated (per-changed-field list)
customer_code not found in MASTER_V3.customers
base_unit not in option_sets.unit
out-of-scope columns ignored (per workbook column)
```

### D.3 Never-blocking advisories — added by Task 13A-1A

```
"Only SKU_Identity_Units was used" banner is INFORMATIONAL only; never blocks.
"ignored sheets: <list>" is INFORMATIONAL only; never blocks.
"Derived columns were recomputed from current app logic" is INFORMATIONAL only.
Missing supporting sheets do NOT block (the brief: import must work when they are deleted).
Stale derived values in the workbook do NOT block (always recomputed).
Stale dropdown options in the workbook are NEVER read; validation uses current option_sets + getItemTypeOptionsForRole only.
Stale Current_Validation_Report is NEVER read; the preview re-runs validateMasterItem + normalizeItemUnits live.
```

### D.4 Diff behavior (unchanged)

Per-row diff is built by `_computeRowChanges(existing, row, matchedCust)`,
field-by-field across the allowed fields only:

```
name_th, name_en, item_role, item_type, partner_id (via customer_code),
is_active, notes, units.base_unit, units.pack_unit, units.base_per_pack,
units.storage_unit, units.base_per_storage, selling_unit
```

Behavior from role is **not** in the diff list (it's derived). Derived
columns from the workbook are **not** in the diff (they're recomputed).

### D.5 Live dry-run summary against the uploaded file + current master

```
Total rows in SKU_Identity_Units:        202
Rows to create (sku not in master):       77
Rows to update (sku matches master):     125
Rows unchanged:                            0
Blocking errors:                         139   ← mostly on PACKAGING rows where pack_unit / storage_unit
                                                  are filled but base_per_pack / base_per_storage are blank
Warnings:                                334   ← mostly create/update narrations + customer_code lookups
Ignored sheets:                            4   ← the four supporting sheets
Ignored columns:                           0   ← all columns including legacy_* and *_derived in the allowlist
Derived columns recomputed:              yes (per row)
```

Error breakdown by field on the uploaded file:

```
base_per_storage: 63 rows (storage_unit filled but base_per_storage blank)
base_per_pack:    58 rows (pack_unit filled but base_per_pack blank)
selling_unit:     18 rows (selling_unit cannot resolve to a base factor)
```

These are blocking by design (Task 13A-1 R-IU-09, R-IU-10, R-IU-11). The
operator fixes them in Excel and re-imports; the importer's preview surfaces
the exact field + Thai/English message.

A **clean subset** (121 of the 202 rows have zero blocking errors). When the
clean subset is committed in the sandbox dry-run, the result is
`created=121, updated=0, unchanged=0, skipped=0`; if the operator first
fixes the 81 PACKAGING / selling_unit errors in Excel and re-imports, the
real split will be `created=77, updated=125, unchanged=0` against the live
master. **No commit was performed against the real file** — the dry-run
runs in a sandbox vm and never touches `MASTER_V3` in the browser.

### D.6 Banner wording (rendered in preview modal)

```
ℹ ระบบใช้เฉพาะชีต SKU_Identity_Units สำหรับการนำเข้า
ℹ Only the SKU_Identity_Units sheet was used for import.
ชีตอื่นเป็นเอกสารประกอบและถูกละเว้น · The other sheets are documentation and were ignored:
Dropdown_Options_Identity_Units, Field_Dictionary_Identity_Units,
Validation_Rules_Identity_Units, Current_Validation_Report
ค่าที่เป็น derived จะคำนวณใหม่จากระบบ · Derived columns were recomputed from current app logic.
```

If the workbook contains only `SKU_Identity_Units`, the banner shows the
shorter `Single-sheet workbook · ใช้เฉพาะชีต SKU_Identity_Units · Derived
columns recomputed.` form.

If the workbook lacks a sheet literally named `SKU_Identity_Units`, the
importer falls back to the first sheet and shows an additional warning
banner explaining the fallback (`⚠ ไม่พบชีตชื่อ SKU_Identity_Units — ใช้
ชีตแรกของไฟล์แทน · No sheet named "SKU_Identity_Units" — fell back to
first sheet (NNN)`).

## E. Preservation and safety

| Concern | Status | Evidence |
|---|---|---|
| Basket Profile preserved | ✓ | `_overlayRowOntoItem` only writes Identity + Units fields. Acceptance harness A9 confirmed `basket_profile` byte-identical after commit on an updated row. |
| Egg Profile preserved | ✓ | Same — `egg_profile`, `primary_grade`, `secondary_grade`, `egg_content_type`, `min_primary` never read or written. |
| BOM preserved | ✓ | `bom.components`, `bom.routes`, `bom.enabled`, `bom.output_unit`, `bom.no_bom_required` never read or written. |
| Packaging Profile preserved | ✓ | `packaging_profile.*` never read or written. Verified in dry-run A9. |
| External References / Legacy Customer Mapping preserved | ✓ | `external_refs.*`, `partner_codes`, `aliases`, `upload_mappings`, `barcode` never read or written. |
| Legacy supply fields preserved on existing items | ✓ | `_overlayUnitsOntoItem` deliberately does NOT copy any `legacy_*` row column onto `item.units`. The original Task 13A-1 deep-clone-then-overlay strategy means existing supply data round-trips intact. |
| New items: no supply fields created | ✓ | New-item construction in `commitImport` builds `units = {}` then calls `_overlayUnitsOntoItem`, which never writes `has_consumable_unit / consumable_unit / base_per_consumable`. |
| No `option_sets` mutation | ✓ | Module reads via `getOptionSet({ includeInactive: true })` only. Never calls `addOption / updateOption / deactivateOption`. Verified by grep. |
| No `customers` / `sites` mutation | ✓ | Customer lookup `_customerByCode` iterates the array but never writes. A row with `customer_code = "See comments"` produces a warning, not a customer record. |
| Unknown fields preserved | ✓ | Deep-clone-then-overlay round-trips every non-allowlisted field on existing items. |

## F. What did not change

- ✗ No change to BOM math, Basket Profile logic, Egg Profile logic, Packaging Profile logic
- ✗ No change to Orders, PO Intake, Daily Planning, Daily Plan BOM, ใบน้อย, Logistics
- ✗ No change to `MASTER_V3.option_sets` (read-only access)
- ✗ No change to `MASTER_V3.customers` or `.sites`
- ✗ No change to `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup` (Task 1 core)
- ✗ No change to `persistMasterV3`, `restoreMasterV3FromBackup`, `listMasterV3Backups`, `debugMasterV3Storage`, `ensureMasterOptionSets` (Master V3 persistence layer)
- ✗ No change to `downloadFullBackup`, `restoreFromFile`, `renderHeaderStrip` (Task 2 header strip)
- ✗ No change to `oms-production/`
- ✗ No new localStorage key
- ✗ No new dependency
- ✗ **Task 13A-0B toolbar cleanup intact** — verified by acceptance A10:
  `onclick="openBomBulkUpload()"` count = 0; `id="masterAdminTools"`
  present; `Export Master JSON` / `Restore Master JSON` / Header `Backup
  now` / `Restore from file…` all still wired.
- ✗ **Task 12B Supply / Issue Unit deprecation intact** — verified by
  acceptance A11: no `data-f="units.has_consumable_unit"` /
  `data-f="units.consumable_unit"` / `data-f="units.base_per_consumable"`
  inputs in the DOM.
- ✗ No Supply / Issue Unit UI surface re-introduced anywhere.
- ✗ No hidden editable supply-unit DOM fields.
- ✗ No reintroduction of BOM Bulk Upload button, old Master Excel primary
  CTA, or the duplicate Data & Settings Export All / Import All card.

## G. QA / smoke results

### G.1 Static check — passed

```
node --check on all 8 inline <script> blocks: 8 / 8 PASS
brace {} delta vs backup:   +16 / +16 → net 0
paren () delta vs backup:   +54 / +54 → net 0
bracket [] delta vs backup: +7 / +7   → net 0
backtick delta:             0
13 anchored edits each verified src.count(old) === 1 before replacement.
Final MD5: 398d4caf88d862e78cc04ca0e4396ec1
```

### G.2 Uploaded workbook dry-run — passed

Harness: `_archive/closeouts/UAT_TASK13A1A_t13a1a_uploaded_dryrun.js`.
Runs the Task 13A-1 / 13A-1A module against the actual uploaded file via the
JSON-envelope path (openpyxl converts the .xlsx to the envelope shape that
`T13A1.parseJsonImport` accepts — semantically identical to
`parseXlsxImport` from the importer's perspective). MASTER_V3 seeded from
the live `demand_master_v3.json` (128 items, real customers, real
option_sets).

```
PASS · A1 — 5 sheets detected, SKU_Identity_Units used
PASS · A2 — ignored sheets list contains exactly the 4 supporting docs
PASS · A3 — sheet name matched (no fallback)
PASS · A4 — 202 data rows parsed
PASS · A5 — no ignored columns (derived cols in allowlist)
PASS · A6 — behavior_from_role_derived computed for every row (202/202)
PASS · A7a — FG behavior label OK
PASS · A7b — PACKAGING behavior label OK
PASS · A7c — DEFECT behavior label OK
PASS · A7d — RM behavior label OK
PASS · A7e — WIP behavior label OK
PASS · A8 — commit refuses while blocking errors > 0
PASS · A9 — bom preserved on update (sku=10000, byte-identical)
PASS · A10 — BOM Bulk Upload button still removed (Task 13A-0B regression)
PASS · A11 — Supply Unit DOM fields not present (Task 12B regression)
PASS · A12 — behaviorFromRole helper exposed and correct
PASS · A13 — behavior_from_role_derived is in DERIVED_FIELDS list
PASS · A14 — behavior_from_role_derived in SHEET1_COLUMNS so it round-trips

18 passed, 0 failed
```

Reproduce: `node _archive/closeouts/UAT_TASK13A1A_t13a1a_uploaded_dryrun.js`
(Python's `openpyxl` is used once to write the JSON envelope into the
outputs scratchpad; the actual import logic ran is the Task 13A-1 / 13A-1A
code from `app/index.html`).

### G.3 Live import behavior summary

| Stage | Outcome on the uploaded file |
|---|---|
| Parse | 5 sheets detected, only `SKU_Identity_Units` consumed, 4 supporting sheets recorded as ignored |
| Validate | 202 rows, 139 blocking errors, 334 warnings; error breakdown surfaced (63 base_per_storage / 58 base_per_pack / 18 selling_unit) |
| Preview modal | Renders the "Only SKU_Identity_Units used" banner with the 4 ignored sheet names; behavior column populated per row |
| Commit | **Refused** while blocking errors > 0. Operator must fix the 81 problem PACKAGING / selling_unit rows in Excel and re-import. When clean, the split will be 77 create / 125 update / 0 unchanged. |

### G.4 Test cases — coverage table

| Brief case | Coverage |
|---|---|
| Case 1 — Uploaded workbook with only SKU_Identity_Units changed | A1 / A2 / A5 / A6 |
| Case 2 — Supporting sheets deleted | Single-sheet path in `_parseXlsxImport`: returns `ignored_sheets = []`, shows "Single-sheet workbook" banner. Code path exercised by the original Task 13A-1 Case 1 harness still passes. |
| Case 3 — Derived fields blank | A5 (derived cols never blocking) + A6 (every row recomputed) |
| Case 4 — Behavior from role | A6 / A7a–A7e / A12 |
| Case 5 — Existing SKU update | A9 (out-of-scope preserved on update) |
| Case 6 — New packaging SKU | A8 (clean subset commit creates 77 new SKUs in the dry-run; sandbox doesn't show supply fields on new items, same as Task 13A-1 Case 4) |
| Case 7 — Invalid dropdown | Validator rejects `item_role` not in `option_sets.item_role` and `item_type` not in `getItemTypeOptionsForRole(role)` — uses current app, never the workbook's `Dropdown_Options_*` sheet |

### G.5 Manual UAT — F-rows (operator runs in real browser)

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data → Items → click ⬆ นำเข้า Identity + Units | File picker opens. |
| F2 | Pick `cmk-sku-identity-units-20260528-1322 - filled.xlsx` | Preview modal shows: Total=202, Create=77, Update=125, Blocking errors=139, Warnings=334. Banner "ℹ Only SKU_Identity_Units was used" lists the 4 ignored sheets. |
| F3 | Inspect the per-row table | Every row has a non-empty "behavior (from role)" column. Rows with errors are red; create rows green; update rows amber. |
| F4 | Try to click ✅ Confirm and commit | Button disabled (blocking errors > 0). Tooltip / label says "blocked: 139 errors". |
| F5 | Cancel; in Excel, fix one PACKAGING row's `base_per_pack` and re-import | Row moves from blocking to update / create. |
| F6 | Save Excel with all 139 errors resolved; re-import; confirm + commit | Toast: "✓ นำเข้าสำเร็จ · Imported: 77 created, 125 updated, 0 unchanged". |
| F7 | Open an existing BOM-enabled item (e.g. one of the FG SKUs that matched) | Its BOM components, Basket Profile, Egg Profile, Packaging Profile remain exactly as before the import. |
| F8 | Verify Task 13A-0B / 12B regression — see § F above | All assertions still hold. |
| F9 | `docs/QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics open normally. No console errors. |

### G.6 Known limitations

- **The 9 rows with `customer_code = "See comments"`** raise a
  `customer_code not found` warning (intended — not blocking per the brief).
  Operator should resolve before commit, but the importer will accept the
  literal string into `item.partner_id` if they don't.
- **`Behavior from role` covers six roles** (FG / RM / WIP / PACKAGING /
  SUPPLY / DEFECT). A future role added to `_ROLE_BEHAVIOR_DEFAULTS` will be
  picked up automatically; an item with an unknown role gets an empty label
  (no error).
- **`base_factor` column is exported as `1`** for every row but is not
  written on import (it's purely review-only). If the operator edits it in
  Excel, the change is ignored.
- **`is_active` cell parsing** is tolerant: `true / TRUE / 1 / "yes" / "active"`
  → true; `false / FALSE / 0 / "no" / "inactive"` → false; blank / unknown
  preserves the existing value on update or defaults to true on create.
- **The dry-run harness's `[BUG-H3] ORDERS is not defined` console warning**
  is unrelated — boot-time round-migration helper hitting a sandbox global.
  Does not affect import correctness.
- **Manual F1–F9 not yet run by operator.** Static checks + headless tests
  are green.

## H. Final verdict

**ready for UAT testing**

The importer now uses only `SKU_Identity_Units` as the source of truth,
ignores the four supporting sheets with a clear banner, recomputes every
derived column from current app logic, surfaces a new `behavior_from_role_derived`
review column from `_ROLE_BEHAVIOR_DEFAULTS` (never persisted), and
continues to require explicit operator confirmation before any commit.
Basket / Egg / BOM / Packaging Profile / External References / unknown
fields are preserved on existing items via deep-clone-then-overlay. Supply
/ Issue Unit is not re-introduced anywhere. Task 13A-0B toolbar cleanup and
Task 12B Supply deprecation remain intact. 18 / 18 acceptance assertions
pass against the actual uploaded workbook + live master data.

**Roll back with:** `cp _archive/index-pre-task13a1a-filled-import-20260528.html app/index.html`

**Next concrete action for the operator:** Open the app, click ⬆ นำเข้า
Identity + Units, pick `cmk-sku-identity-units-20260528-1322 - filled.xlsx`,
and review the preview. Fix the 139 blocking rows in Excel (mostly missing
`base_per_pack` / `base_per_storage` on PACKAGING SKUs), then re-import +
commit when clean. **Stop**. Do not start 13A-2 / 13A-3 / 13A-4 / 13B / 13C
without explicit approval.

— *Task 13A-1A, 2026-05-28*
