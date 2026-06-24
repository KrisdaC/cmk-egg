# UAT Task 13A-2B — Clean Operator Export Templates for Step 1 + Step 2 — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `b70e265e7a38b7cacaf6650f01c5fa88`
**Post-edit app MD5:** `8ca4edf360691e656ffb2073d74b5bea`
**Rollback:** `cp _archive/index-pre-task13a2b-cleanexports-20260528.html app/index.html`

Cleans both operator export templates so the workbooks become **simple
input forms**, not technical audit dumps. The exported main sheets carry
only the columns operators should edit; the technical
Field_Dictionary / Validation_Rules / Current_Validation_Report sheets
are removed from the normal operator export and replaced by two friendly
guidance sheets shared by Step 1 + Step 2:

- **`Behavior_Function_Summary`** — the role → behavior / function matrix
  derived from `_ROLE_BEHAVIOR_DEFAULTS` (FG / WIP / RM / PACKAGING /
  SUPPLY / DEFECT).
- **`Dropdown_Reference`** — the option codes operators may pick from,
  scoped per export (Identity columns for Step 1; Egg + Basket columns
  for Step 2).

Importers still **accept the old workbooks** (with derived + legacy
columns) — those columns are in the wider import allowlist so they
parse without being flagged as "ignored", and the commit overlay simply
never writes them. The brief's full backward-compatibility contract is
upheld.

5 anchored edits + 2 small follow-up exposures. `node --check` clean on
all 9 inline `<script>` blocks. Brace / paren / bracket / backtick deltas
all 0. **14 / 14 acceptance cases pass** (Cases 1–8 plus 1 Dropdown
bonus plus 5 regressions). All six prior harnesses still green
(13A-1A 18/18, 13A-1C 5/5, 13A-1E 18/18, 13A-2 12/12, 12H prior 32/32,
12H untickfix 10/10).

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a2b-cleanexports-20260528.html` |
| Pre-edit MD5 | `b70e265e7a38b7cacaf6650f01c5fa88` (post-Task-12H + fix-up) |
| Post-edit MD5 | `8ca4edf360691e656ffb2073d74b5bea` |
| Bytes delta | +6,291 |
| Rollback | `cp _archive/index-pre-task13a2b-cleanexports-20260528.html app/index.html` |

Prior backups remain for deeper rollbacks: `_archive/index-pre-task12h-egguicleanup-20260528.html`, `_archive/index-pre-task13a2-eggbasket-20260528.html`, etc.

## B. Export cleanup — what was removed / kept / added

### B1. Step 1 — `SKU_Identity_Units`

**Removed columns from the main sheet:**
```
customer_name_derived
selling_base_factor_derived
selling_to_pack_ratio_derived
pack_to_selling_ratio_derived
unit_ladder_summary_derived
behavior_from_role_derived
legacy_has_consumable_unit
legacy_consumable_unit
legacy_base_per_consumable
```

**Kept columns (15) — editable Identity + Counting & Units only:**
```
sku, name_th, name_en, item_role, item_type, customer_code, is_active, notes,
base_unit, base_factor, pack_unit, base_per_pack,
storage_unit, base_per_storage, selling_unit
```

**Removed supporting sheets:**
- `Field_Dictionary_Identity_Units`
- `Dropdown_Options_Identity_Units`
- `Validation_Rules_Identity_Units`
- `Current_Validation_Report`

**Added supporting sheets (shared with Step 2):**
- `Behavior_Function_Summary` — 6-row role/behavior matrix.
- `Dropdown_Reference` — scoped option codes for the editable Identity + Units columns.

### B2. Step 2 — `SKU_BOM_Egg_Basket`

**Removed columns from the main sheet:**
```
egg_profile_status_derived
egg_bom_lines_derived
egg_missing_requirements_derived
basket_qty_per_pack_derived
basket_qty_per_selling_unit_derived
basket_status_derived
basket_missing_requirements_derived
```

**Kept columns (17) — editable Egg + Basket + identity (review-only):**
```
sku, name_th, name_en, item_role, item_type, is_active,            (review-only matching)
is_egg, egg_content_type, primary_grade, secondary_grade, min_primary,
egg_input_type, egg_is_mixed,                                       (Task 12H friendly cols, editable)
uses_basket, basket_sku, basket_unit, base_per_basket
```

**Removed supporting sheets:**
- `Field_Dictionary_BOM_Egg_Basket`
- `Dropdown_Options_BOM_Egg_Basket`
- `Validation_Rules_BOM_Egg_Basket`
- `Current_Validation_Report_BOM_Egg_Basket`

**Added supporting sheets (shared with Step 1):**
- `Behavior_Function_Summary`
- `Dropdown_Reference` (Egg + Basket scope)

### B3. New file names (unchanged)

- Step 1: `cmk-sku-identity-units-YYYYMMDD-HHmm.xlsx`
- Step 2: `cmk-sku-bom-egg-basket-YYYYMMDD-HHmm.xlsx`

## C. Behavior_Function_Summary — role → behavior / function matrix

Derived from `_ROLE_BEHAVIOR_DEFAULTS` (Task 7C-2). One row per role, 12 columns.

| `item_role` | sellable | producable | consumable | order_sales | bom_production | as_bom_component | egg_inputs | basket | packaging_profile | notes_th / notes_en |
|---|---|---|---|---|---|---|---|---|---|---|
| FG | true | true | false | true | true | false | when is_egg=true | when uses_basket=true | yes | สินค้าสำเร็จรูป… / Finished goods… |
| WIP | false | true | false | false | true | false | when is_egg=true | no | no | กึ่งสำเร็จรูป… / Semi-finished… |
| RM | false | false | true | false | false | true | no | no | no | วัตถุดิบ… / Raw materials… |
| PACKAGING | false | false | true | false | false | true | no | no | no | วัสดุบรรจุภัณฑ์… / Packaging… |
| SUPPLY | false | false | true | false | false | true | no | no | no | วัสดุสิ้นเปลือง… / Supplies (Task 12B)… |
| DEFECT | true | false | false | true | false | false | no | no | no | ของเสีย / ผลพลอยได้… / Defects… |

Columns: `item_role, behavior_sellable, behavior_producable, behavior_consumable, enabled_order_sales, enabled_bom_production, enabled_as_bom_component, enabled_egg_inputs, enabled_basket_handling_unit, enabled_packaging_profile, notes_th, notes_en`.

Source helper: `_t13a2b_buildBehaviorFunctionSummary()` (module scope; both
T13A1 and T13A2 IIFEs call it; reads `_ROLE_BEHAVIOR_DEFAULTS` directly).

## D. Import compatibility — backward and forward

The cleanup is on the **export** side. The import allowlist
(`SHEET1_COLUMNS` in both modules) was **kept wide** so:

| File shape | Behavior |
|---|---|
| **Old Step 1 file** — contains `customer_name_derived`, `selling_base_factor_derived`, `pack_to_selling_ratio_derived`, etc. | Columns are in the allowlist → NOT flagged in `ignored_columns` → parsed into the row dict → silently ignored on commit (overlay only writes the editable allowlist). |
| **New clean Step 1 file** — no derived columns | Parses cleanly. Preview recomputes derived values via `_deriveRow` and `_t12h_storedToUi`. No blocking error from missing derived columns. |
| **Old Step 1 file** with `legacy_has_consumable_unit` etc. | Allowlisted. Parsed, not written. Existing item's `units.has_consumable_unit / consumable_unit / base_per_consumable` are preserved verbatim via deep-clone-then-overlay (Task 12B contract intact). |
| **Old Step 2 file** — contains `egg_profile_status_derived`, `basket_qty_per_pack_derived`, etc. | Same — allowlisted, ignored, no warning. |
| **New clean Step 2 file** — no derived columns | Parses cleanly. Preview computes egg/basket derived statuses live. |
| **Any file** with the technical sheets (Field_Dictionary, Validation_Rules, Current_Validation_Report) | Sheets ignored as data source per Task 13A-1A — surfaced in `ignored_sheets[]` and shown in the preview banner. |

Verified by harness Cases 3, 4, 5, 6, 7 (above). Step 2 friendly columns
`egg_input_type` and `egg_is_mixed` from Task 12H cohesion are retained
in the clean export so the workbook continues to match the new Item
editor UI.

## E. What did not change

- ✗ Import source-of-truth — Step 1 still parses `SKU_Identity_Units`,
  Step 2 still parses `SKU_BOM_Egg_Basket`; both fall back to the first
  sheet when the canonical name is missing (Task 13A-1A behavior).
- ✗ `MASTER_V3.option_sets` — read-only access via `getOptionSet`. No new
  codes added by the helpers.
- ✗ `MASTER_V3.customers` / `.sites` — read-only.
- ✗ BOM math, Packaging Profile, Basket Profile, Egg calculation
  (`splitBaseEggsByGrade`, etc.) — byte-identical.
- ✗ Orders, PO Intake, Daily Planning, Daily Plan BOM, ใบน้อย,
  Logistics.
- ✗ Packaging Profile import/export (still future — Task 13A-3 scope).
- ✗ `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`.
- ✗ `persistMasterV3` and the rest of the Master V3 persistence layer.
- ✗ Header strip ⬇ Backup now / ↻ Restore from file…
- ✗ Master Data toolbar (Task 13A-0B) — Admin Tools dropdown, hidden
  BOM Bulk Upload, hidden duplicate Data tab card all intact
  (regression verified).
- ✗ Supply / Issue Unit (Task 12B) — no DOM inputs reintroduced
  (regression verified).
- ✗ Task 12H operator-friendly egg UI + the untick-Mixed fix-up — intact
  (regression verified).
- ✗ Task 13A-1 / 1A / 1B / 1C / 1D / 1E / 13A-2 module helpers and
  validators are unchanged; the only change to those modules is the
  column-list refactor and the export-sheet replacement.

## F. Regression protection — verified in this sprint

| Regression | How verified | Status |
|---|---|---|
| Task 12B — Supply Unit deprecation | grep for `data-f="units.has_consumable_unit"` returns 0 | ✓ |
| Task 13A-0B — BOM Bulk Upload hidden | grep for `onclick="openBomBulkUpload()"` returns 0 | ✓ |
| Task 13A-1E — role-behavior repair tool | `t13a1e_openRepairPreview` exposed on window | ✓ |
| Task 13A-2 — Egg + Basket import flow | harness Case 5/6 + full 13A-2 cases harness pass 12/12 | ✓ |
| Task 12H — Egg UI helpers | `_t12h_storedToUi` + `_t12h_uiToStored` + `_t12h_shouldShowMixedFields` still present and behave per spec | ✓ |

## G. QA / smoke results

### G1. Static — passed

```
node --check on all 9 inline <script> blocks: 9 / 9 PASS
brace {} delta vs backup:   +14 / +14 → net 0
paren () delta vs backup:   +75 / +75 → net 0
bracket [] delta vs backup: +25 / +25 → net 0
backtick delta:             0
5 anchored edits + 2 namespace exposures, each src.count(old) === 1 asserted before replacement
Final MD5: 8ca4edf360691e656ffb2073d74b5bea
```

### G2. Acceptance harness — 14 / 14 PASS

`_archive/closeouts/UAT_TASK13A2B_cases_harness.js`:

```
PASS · Case 1 — Step 1 clean export columns + wider allowlist retained
PASS · Case 2 — Step 2 clean export columns + wider allowlist retained
PASS · Case 3 — Import OLD Step 1 file: derived + legacy columns parsed but ignored on commit
PASS · Case 4 — Import NEW clean Step 1 file: parses cleanly, no derived needed
PASS · Case 5 — Import OLD Step 2 file: derived columns parsed but ignored on commit
PASS · Case 6 — Import NEW clean Step 2 file: parses cleanly, no derived needed
PASS · Case 7 — Deprecated supply fields absent in file: legacy values preserved internally on existing items
PASS · Case 8 — Behavior_Function_Summary matches _ROLE_BEHAVIOR_DEFAULTS for all 6 roles
PASS · Bonus — Dropdown_Reference builds correctly for both scopes
PASS · Regression — BOM Bulk Upload still hidden (Task 13A-0B)
PASS · Regression — Supply Unit DOM fields still absent (Task 12B)
PASS · Regression — Task 12H helpers retained
PASS · Regression — Task 12H fix-up retained
PASS · Regression — Task 13A-1E repair tool retained

14 passed, 0 failed
```

### G3. Prior harnesses — no regression

- **Task 13A-1A**: 18 / 18 PASS
- **Task 13A-1C**: 5 / 5 PASS
- **Task 13A-1E**: 18 / 18 PASS
- **Task 13A-2**: 12 / 12 PASS
- **Task 12H prior**: 32 / 32 PASS
- **Task 12H untick fix-up**: 10 / 10 PASS

### G4. Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload app, Master Data → Items → click ⬇ ส่งออก Identity + Units | Downloads `cmk-sku-identity-units-…xlsx`. Open in Excel. |
| F2 | Inspect Step 1 file | Three sheets: `SKU_Identity_Units` (15 editable columns, no derived, no legacy), `Behavior_Function_Summary` (6 rows, one per role), `Dropdown_Reference`. NO `Field_Dictionary_…`, NO `Validation_Rules_…`, NO `Current_Validation_Report`. |
| F3 | Re-import the freshly-exported Step 1 file unchanged | Preview banner: "Only SKU_Identity_Units used. Other sheets: Behavior_Function_Summary, Dropdown_Reference." Total = item count; ~unchanged. 0 blocking errors. |
| F4 | Step 2: click ⬇ ส่งออก Egg + Basket; inspect file | Three sheets: `SKU_BOM_Egg_Basket` (17 editable columns; egg_input_type + egg_is_mixed present per Task 12H cohesion; no derived), `Behavior_Function_Summary`, `Dropdown_Reference`. |
| F5 | Re-import the freshly-exported Step 2 file unchanged | Preview banner identical; 0 blocking errors. |
| F6 | Import an OLD Step 1 / Step 2 file (one you have from before Task 13A-2B — with `customer_name_derived`, `egg_profile_status_derived`, etc.) | Preview parses normally; old derived columns do NOT appear in the "Out-of-scope columns ignored" warning. Commit proceeds. |
| F7 | Open the new `Behavior_Function_Summary` sheet in Excel | 6 rows for FG / WIP / RM / PACKAGING / SUPPLY / DEFECT with `behavior_sellable` / `behavior_producable` / `behavior_consumable` boolean columns, `enabled_*` capability columns, and bilingual notes. Values match the Item editor's "Behavior (from role)" chips. |
| F8 | Open the new `Dropdown_Reference` sheet | Step 1: shows `item_role` codes, `unit` codes, role-filtered `item_type` codes, and `customer_code` codes. Step 2: shows `egg_content_type`, `egg_input_type` (raw/under/graded), `egg_grade`, and `basket_sku` candidates. No deprecated supply codes. |
| F9 | Verify Task 12B / Task 13A-0B / Task 12H / Task 13A-1E / Task 13A-2 surfaces remain intact | Master Data toolbar: + Add, Export Master JSON, Restore Master JSON, ⚙ Admin Tools, no BOM Bulk Upload. Egg Inputs sub-card: 3-option select + Mixed checkbox per Task 12H. Item editor → 🔧 Preview + Repair button works. Step 2 import still validates Egg + Basket properly. |
| F10 | Section K regression (`docs/QA_CHECKLIST.md`) | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G5. Known limitations

- **Operators who relied on the technical sheets** (Field_Dictionary,
  Validation_Rules, Current_Validation_Report) will not see them in
  the normal export anymore. Per the brief, a future
  separate admin/debug export can carry them — out of scope here.
- **The wider import allowlist still accepts the old derived
  columns.** They're parsed into the row dict but never written by the
  overlay. If a file has clearly-wrong values in those columns
  (e.g. `selling_base_factor_derived = 999`), the importer doesn't
  warn — the values are simply ignored. This is the same behaviour as
  before Task 13A-2B.
- **`egg_input_type` and `egg_is_mixed` remain in the Step 2 clean
  export** because they are operator-friendly **editable** columns
  added by Task 12H cohesion (they back the new UI's Raw / Under /
  Graded + Mixed controls). The brief lists only the canonical
  `is_egg / egg_content_type / primary_grade / secondary_grade /
  min_primary` — Task 12H's friendly columns are additive and remain.
- **Manual F1–F10 not yet run by operator.** Static + headless tests
  are green.

## H. Final verdict

**ready for UAT testing**

Both operator exports are now clean input templates. Derived columns
are removed from the main sheets and recomputed at preview time.
Deprecated supply columns are gone from the exports but preserved
internally on existing items (Task 12B contract intact). The two
shared guidance sheets (`Behavior_Function_Summary` and
`Dropdown_Reference`) carry exactly the documentation the operator
needs to clean data in Excel — no audit overhead. Importers still
accept old workbooks with derived / legacy columns. Task 13A-0B
toolbar, Task 12B Supply deprecation, Task 12H egg UI + untick fix-up,
Task 13A-1E behavior repair tool, and Task 13A-2 Egg + Basket import
all remain intact.

**Roll back with:** `cp _archive/index-pre-task13a2b-cleanexports-20260528.html app/index.html`

**Next concrete action for the operator:** Reload the app. Click ⬇
ส่งออก Identity + Units, then ⬇ ส่งออก Egg + Basket. Inspect the
new clean main sheets and the two new guidance sheets in Excel.
**Stop**. Do not start 13A-3 / 13A-4 / 13B / 13C without explicit
approval.

— *Task 13A-2B, 2026-05-28*
