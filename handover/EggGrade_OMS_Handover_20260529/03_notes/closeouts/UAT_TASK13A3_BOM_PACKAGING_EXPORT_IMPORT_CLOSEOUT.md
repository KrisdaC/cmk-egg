# UAT Task 13A-3 — BOM / Production Formula + Packaging Profile Export / Import — Closeout

**Date:** 2026-05-29
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `a473abb1881932a250ce07ecf3085fe8`
**Post-edit app MD5:** `eadbac2a24a6b75e09f05af3cec5c555`
**Rollback:** `cp _archive/index-pre-task13a3-bompackaging-20260529.html app/index.html`

Step 3 of the Master SKU rebuild flow. A controlled export → clean →
import → validate → preview/diff → confirm → commit pipeline for the
**remaining BOM / Production Formula fields** and the **Packaging
Profile** sub-section only. Egg Inputs and Basket / Handling Unit were
covered by Task 13A-2 and are deliberately untouched here.

Two anchored edits in `app/index.html` (one Step-3 UI block + one
self-contained `<script>` module appended at the end). `node --check`
clean on all 10 inline `<script>` blocks. Brace / paren / bracket /
backtick deltas all 0. **9 / 9 acceptance cases pass.** All 9 prior
harnesses still green (13A-1A 18/18, 13A-1C 5/5, 13A-1E 18/18, 13A-1F
9/9, 13A-2 12/12, 13A-2B 14/14, 13A-2C 26/26, 12H 32/32, 12H untickfix
10/10).

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a3-bompackaging-20260529.html` |
| Pre-edit MD5 | `a473abb1881932a250ce07ecf3085fe8` (post-Task-13A-1F) |
| Post-edit MD5 | `eadbac2a24a6b75e09f05af3cec5c555` |
| Bytes delta | +49,860 (HTML Step 3 card + ~793-line new module) |
| Rollback | `cp _archive/index-pre-task13a3-bompackaging-20260529.html app/index.html` |

## B. Data-model inspection — actual fields found

### B1. BOM-level (top of `item.bom`)

```
item.bom.enabled           boolean   data-f="bom.enabled"
item.bom.no_bom_required   boolean   (legacy lenient flag — never settable via Task 12H+ UI but still read by validator)
item.bom.output_unit       string    data-f="bom.output_unit"
item.bom.notes             string    data-f="bom.notes"
item.bom.components[]      Array     (NOT exported as a whole — components classified below)
item.bom.routes[]          Array     (out of scope — preserved untouched)
item.bom.updated_at / updated_by     (audit; updated_at refreshed on commit)
```

### B2. Packaging Profile (`item.packaging_profile`)

8 standard slots from `_BOM_PACKAGING_SLOTS`:

```
pack_base, cover, barcode_sku_label, product_label_sticker,
closer_1, closer_2, bulk_barcode_label, other
```

Each slot, when active, lives at `item.packaging_profile.<slot_role>`:

```javascript
{
  enabled: true|false,
  requirement_status: 'required'|'optional',
  item_role: 'PACKAGING',
  item_type: 'tray' | 'cover' | 'label' | 'sticker' | 'pack' | 'other',
  component_sku: '<SKU>',
  component_name: '<name>',
  qty_per_selling_unit: <number>,
  selection_mode: 'manual',        // 'auto_by_rule' is deprecated per Task 12D
  rule_id: null,
  packaging_key: '<same as item_type>'
}
```

### B3. `bom.components[]` classification (the safety contract)

Every component row is classified into one of five buckets:

| Class | Detector | Owned by | Task 13A-3 behavior |
|---|---|---|---|
| `egg` | `component_type === 'egg'` | derived by `splitBaseEggsByGrade` at render time | **never stored; never touched** |
| `basket` | `component_role === 'basket'` OR `source === 'basket_profile'` | Task 13A-2 (Basket Profile) | **preserved verbatim** |
| `packaging_profile` | `source_added` starts with `packaging_profile_` (incl. legacy `packaging_profile_pack_base_tray`) | Packaging Profile sync (`_bomSyncPackagingProfile`) | **owned indirectly** — Step 3 updates the profile, then re-runs the in-app sync helper |
| `manual` | `source_added === 'packaging_editor'` (Task 9 manual editor) | manual operator entry | **only rows of this class are exported and updatable** by Step 3 |
| `untagged` | none of the above (legacy / unknown) | unknown | **excluded from export; preserved on commit** |

Helper: `T13A3.classify(component)` returns one of the five classes.

## C. Export structure

Filename: `cmk-sku-bom-packaging-YYYYMMDD-HHmm.xlsx` (JSON fallback if XLSX is unavailable).

**Sheet 1 — `SKU_BOM_Packaging`** · one row per SKU. 10 columns:
```
sku, name_th, name_en, item_role, item_type, is_active,     ← Identity (review-only)
bom_enabled, no_bom_required, bom_output_unit, bom_notes    ← editable BOM-level
```

**Sheet 2 — `Packaging_Profile_Slots`** · one row per SKU × slot (only slots actually configured on the item are exported — empty items don't pollute the workbook). 9 columns:
```
sku, slot_key, slot_label_th, slot_label_en,                ← read-only match + review labels
slot_enabled, slot_item_type, packaging_sku, qty_per_selling_unit,  ← editable
selection_mode                                              ← review-only (always "manual" per Task 12D)
```

**Sheet 3 — `BOM_Manual_Components`** · one row per **manually-added** packaging component (rows with `source_added === 'packaging_editor'` only — Task 9 manual editor). Egg / basket / packaging-profile / untagged-legacy rows are NEVER exported here. 6 columns:
```
sku, component_sku,        ← read-only match keys
component_role,            ← editable (one of tray / cover / label / sticker / pack / other)
qty_per_basis, notes,      ← editable
unit                       ← review-only (auto-derived from packaging SKU base_unit)
```

**Sheet 4 — `Column_Info`** · per-column read-only / review-only / editable annotation for all three editable sheets. 25 rows total.

**Sheet 5 — `Behavior_Function_Summary`** · same 3-section behavior-driven layout as Step 1 + Step 2 (Behavior driver / Role default / Sub-section gate — 12 rows).

**Sheet 6 — `Dropdown_Reference`** · option codes for Step 3 only:
```
slot_key            — 8 _BOM_PACKAGING_SLOTS roles
component_role      — 6 _BOM_PKG_CATEGORIES codes
packaging_sku       — every PACKAGING / SUPPLY item (item_type != basket) from MASTER_V3
```

Both Behavior_Function_Summary and Dropdown_Reference are documentation only — the importer ignores them as data sources.

## D. Import flow

```
1. Operator clicks ⬆ นำเข้า BOM + Packaging
   → t13a3_openImportPicker()

2. Operator picks .xlsx / .xls / .json
   → t13a3_handleImportFile(file)
   → _parseXlsxImport / _parseJsonImport
       • Builds a sheetMap from every sheet in the file.
       • Locates SKU_BOM_Packaging, Packaging_Profile_Slots,
         BOM_Manual_Components (any subset; missing = skipped).
       • Other sheets recorded in ignored_sheets[] and surfaced in
         the preview banner.
       • Each found sheet is parsed via _aoaToObjects with that sheet's
         specific allowlist. Out-of-scope columns recorded as
         ignored_columns and warned (never written).

3. _validateAll(parsed)
       Per sheet:
         BOM:    sku must match existing; identity columns warn-only;
                 diff for bom.enabled / no_bom_required / output_unit / notes
         Slot:   sku + slot_key match; slot_key in _BOM_PACKAGING_SLOTS;
                 if slot_enabled (merged) → packaging_sku must be PACKAGING/SUPPLY
                 (item_type != basket) AND qty_per_selling_unit > 0;
                 inactive packaging_sku = warning
         Manual: sku must match; component_sku must match an existing manual row
                 (source_added='packaging_editor') — NEW manual rows are
                 out of scope (warn + skip on commit per safety contract);
                 component_sku must be in the packaging candidate pool
       Action computed: error | update | unchanged | skip_not_manual.

4. _showPreviewModal — full modal:
   • KPI strip: Total rows / BOM updates / Slot updates / Manual updates /
     Unchanged / Blocking / Warnings
   • Ignored sheets banner; ignored columns notice
   • Scope reminder: "Identity / Units / Egg Inputs / Basket preserved"
   • Three per-sheet diff tables — sku, key columns, action, errors,
     warnings, changed fields
   • Commit button DISABLED when blocking_errors > 0

5. Operator clicks ✅ ยืนยันและบันทึก.
   window.confirm() with bilingual scope wording.

6. _commitImport(parsed) — the only path that mutates data:
   • persistMasterV3({snapshotReason:'t13a3_pre'})  → pre-snapshot via safeSet
   • Build per-SKU "working" deep-clones; sheets accumulate edits on the same
     item before writing back (so an item touched by all three sheets gets
     one consistent post-overlay state).
   • Apply BOM-level edits  → bom.enabled / no_bom_required / output_unit / notes
   • Apply slot edits       → packaging_profile[slot].{enabled,item_type,
                              component_sku, component_name (resolved from MASTER_V3),
                              qty_per_selling_unit}; selection_mode forced to 'manual'.
   • Apply manual edits     → ONLY rows where (sku, component_sku) maps to an
                              existing manual component (source_added=
                              'packaging_editor'); overlay component_role /
                              qty_per_basis / notes. New manual rows are
                              warned + skipped (no creation in this task).
   • For every touched item, call the in-app _bomSyncPackagingProfile
     helper to re-materialize the profile-controlled rows in bom.components.
     This means a slot edit that switches packaging_sku updates the
     materialized component row through the same code path the Item editor
     uses on save — no parallel implementation.
   • Swap into MASTER_V3.items; persistMasterV3({force:true, snapshotReason:'t13a3_post'}).
   • renderV3Items + renderHeaderStrip.

7. Toast: "✓ นำเข้าสำเร็จ · Imported: N BOM, N slot, N manual".
```

## E. Editable fields and what is deliberately excluded

### E1. Editable

| Sheet | Field | Write target |
|---|---|---|
| SKU_BOM_Packaging | bom_enabled | `item.bom.enabled` |
| SKU_BOM_Packaging | no_bom_required | `item.bom.no_bom_required` |
| SKU_BOM_Packaging | bom_output_unit | `item.bom.output_unit` |
| SKU_BOM_Packaging | bom_notes | `item.bom.notes` |
| Packaging_Profile_Slots | slot_enabled | `item.packaging_profile[slot].enabled` (+ requirement_status) |
| Packaging_Profile_Slots | slot_item_type | `item.packaging_profile[slot].item_type` + `.packaging_key` |
| Packaging_Profile_Slots | packaging_sku | `item.packaging_profile[slot].component_sku` (+ component_name resolved from MASTER_V3) |
| Packaging_Profile_Slots | qty_per_selling_unit | `item.packaging_profile[slot].qty_per_selling_unit` |
| BOM_Manual_Components | component_role | manual row's `component_role` |
| BOM_Manual_Components | qty_per_basis | manual row's `qty_per_basis` |
| BOM_Manual_Components | notes | manual row's `notes` |

### E2. Deliberately excluded

- **Egg fields** (`is_egg`, `egg_content_type`, `primary_grade`,
  `secondary_grade`, `min_primary`) — owned by Task 13A-2.
- **Basket fields** (`units.has_basket_unit`, `units.basket_unit`,
  `units.base_per_basket`, the `component_role='basket'` row) — owned
  by Task 13A-2.
- **Identity / Counting & Units** — owned by Task 13A-1; warns on
  mismatch but never overwrites.
- **Role-derived behavior flags** (Task 13A-1E) — never written here.
- **Egg-derived components** — never stored, never imported.
- **`bom.routes`** — preserved verbatim.
- **`item.bom.components` rows of class `packaging_profile`** — NOT
  overlaid as raw rows; they're re-materialized via the in-app
  `_bomSyncPackagingProfile` helper after profile slot edits.
- **`item.bom.components` rows of class `untagged`** — never read or
  written. Legacy rows from old imports keep their values.
- **External References / Legacy Customer Mapping** — Task 13A-4
  scope; preserved here.
- **`MASTER_V3.option_sets / customers / sites`** — read-only.
- **New SKU creation** — not allowed in Step 3. New SKUs come from
  Step 1.
- **New manual BOM rows** — not created by this importer; existing
  manual rows are updatable only.

## F. Preservation and safety — verified

| Concern | Status | Evidence |
|---|---|---|
| Identity preserved | ✓ | Case 3 — name / role / type byte-identical after slot update. |
| Counting & Units preserved | ✓ | Case 3 — `units` JSON.stringify identical. |
| Role-derived behavior flags preserved | ✓ | Task 13A-1E logic untouched; verified Case 9 regression. |
| Egg Inputs preserved | ✓ | Case 3 — `is_egg / primary_grade` unchanged after slot edit. |
| Basket preserved | ✓ | Case 3 — the `component_role='basket'` row in `bom.components` is byte-identical; `units.base_per_basket` unchanged. |
| Egg-derived components | ✓ | Never stored. |
| Basket component row | ✓ | `_classify(c)==='basket'` keeps it out of the manual sheet AND out of the commit overlay. |
| External References preserved | ✓ | Case 3 — `external_refs.partner` retained. |
| `bom.routes` preserved | ✓ | Case 3 — `bom.routes.length === 1` after commit. |
| Unknown / legacy untagged components | ✓ | `_classify(c)==='untagged'` → excluded from export, untouched on commit. |
| Legacy supply fields | ✓ | Step 3 never touches `units.has_consumable_unit / consumable_unit / base_per_consumable`. |
| Persist via existing path | ✓ | `persistMasterV3({force:true, snapshotReason:'t13a3_post'})` routes through `safeSet`. |
| No `option_sets` mutation | ✓ | Module never calls add/update/deactivate option. |
| No customer / site mutation | ✓ | Module never references them on write. |
| New SKU blocked | ✓ | Case 6. |

## G. QA / smoke results

### G1. Static — passed

```
node --check on all 10 inline <script> blocks: 10 / 10 PASS
brace {} delta vs backup:   0
paren () delta vs backup:   0
bracket [] delta vs backup: 0
backtick delta:             0
Final MD5: eadbac2a24a6b75e09f05af3cec5c555
```

### G2. Acceptance harness — 9 / 9 PASS

`_archive/closeouts/UAT_TASK13A3_cases_harness.js`:

```
PASS · Case 1 — Export shape: no deprecated, no derived columns; required editable headers present
PASS · Case 2 — Round-trip unchanged: 0 blocking, 0 updates (everything matches)
PASS · Case 3 — Packaging slot update: applied; Identity/Units/Egg/Basket/External/bom.routes all preserved
PASS · Case 4 — Invalid packaging SKU: blocking error; commit refused
PASS · Case 5 — Non-PACKAGING SKU rejected as packaging_sku
PASS · Case 6 — Unknown SKU: blocking; no new SKU created
PASS · Case 7 — Out-of-scope columns ignored on Step 3 import
PASS · Case 8 — Manual component classification distinguishable; export includes manual only
PASS · Case 9 — Regression: 13A-1/2/1E exports + Task 12B/13A-0B intact

9 passed, 0 failed
```

### G3. Prior harnesses — all green

- **Task 13A-1A:** 18 / 18
- **Task 13A-1C:** 5 / 5
- **Task 13A-1E:** 18 / 18
- **Task 13A-1F:** 9 / 9
- **Task 13A-2:** 12 / 12
- **Task 13A-2B:** 14 / 14
- **Task 13A-2C:** 26 / 26
- **Task 12H:** 32 / 32
- **Task 12H untick fix-up:** 10 / 10

### G4. Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload app, Master Data → Items | The Master SKU Rebuild card now shows **Step 3: BOM + Packaging Profile** below Step 1 + Step 2. Two new buttons: ⬇ ส่งออก BOM + Packaging and ⬆ นำเข้า BOM + Packaging. |
| F2 | Click ⬇ ส่งออก BOM + Packaging | Downloads `cmk-sku-bom-packaging-YYYYMMDD-HHmm.xlsx` with 6 sheets: `SKU_BOM_Packaging`, `Packaging_Profile_Slots`, `BOM_Manual_Components`, `Column_Info`, `Behavior_Function_Summary`, `Dropdown_Reference`. |
| F3 | Inspect the three data sheets | `SKU_BOM_Packaging` has one row per master item. `Packaging_Profile_Slots` has only rows for slots actually configured on items (FG SKUs that touched Packaging Profile). `BOM_Manual_Components` has only rows that were added through the Item editor's Task 9 "Additional materials" / manual packaging editor. |
| F4 | Inspect `Column_Info` | `sku` rows are tagged read-only (match key); identity columns (`name_th, item_role, item_type, is_active`) are "review-only (warn if differs)"; editable columns are tagged "editable". |
| F5 | Edit one slot row's `packaging_sku` (e.g. swap to a different PACKAGING SKU with the same item_type), save, re-import | Preview shows ONE row in the Slot section with action=`update`, changed=`slot.component_sku`; commit. |
| F6 | Open that item in the Item editor → Packaging Profile | The slot's Component SKU is now the new one. Identity / Units / Egg / Basket / other components untouched. |
| F7 | Try a slot row with `packaging_sku='NONEXISTENT'` and `slot_enabled=true` | Preview shows blocking error `packaging_sku not found or not eligible`. Commit disabled. |
| F8 | Try a slot row with `packaging_sku` pointing to an FG SKU | Same blocking error (FG is not a packaging candidate). |
| F9 | Add a `BOM_Manual_Components` row for a sku/component_sku that does NOT exist as a manual row | Preview shows action=`skip_not_manual` + warning "no existing manual component row matches — row IGNORED on commit". Commit proceeds for other rows; this row does nothing. |
| F10 | Verify all prior surfaces intact | Step 1 + Step 2 buttons + the 🔧 Preview + Repair button still visible and functional on Items sub-tab. |
| F11 | Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G5. Known limitations

- **No new manual BOM rows.** Step 3 only updates existing rows tagged
  `source_added === 'packaging_editor'`. Operators add new manual
  packaging materials in the Item editor (Task 9 "Additional
  materials" expander).
- **No `bom.routes` editing.** Out of scope. Preserved verbatim.
- **`unit` in `BOM_Manual_Components` is review-only** — the column is
  auto-derived from the packaging SKU's `base_unit`. Editing it in
  Excel has no effect.
- **`selection_mode` in `Packaging_Profile_Slots` is review-only** —
  always written as `'manual'` per Task 12D auto-rule deprecation.
- **Packaging-profile-controlled `bom.components` rows are
  re-materialized** through the in-app `_bomSyncPackagingProfile` after
  each slot edit. If that helper is unavailable in some headless
  context, the slots are still written correctly to
  `packaging_profile[slot]` but the materialized component row may not
  appear until the next time `_bomSyncPackagingProfile` runs.
- **Manual F1–F11 not yet run by operator.** Static + headless tests
  are green.

## H. Final verdict

**ready for UAT testing**

Step 3 of the Master SKU rebuild is in place: a controlled three-sheet
import for the remaining BOM-level fields + Packaging Profile slots +
optionally the Task 9 manual packaging components. Egg Inputs, Basket /
Handling Unit, Identity, Counting & Units, behavior flags, External
References, `bom.routes`, untagged-legacy components, and the egg
calculation engine are all preserved by classification + deep-clone-
then-overlay. New SKUs and new manual rows are blocked / skipped per
the safety contract. Task 13A-0B / Task 12B / Task 12H /
Task 13A-1E / Task 13A-1F / Task 13A-2 / Task 13A-2B / Task 13A-2C
all intact.

**Roll back with:** `cp _archive/index-pre-task13a3-bompackaging-20260529.html app/index.html`

**Next concrete action for the operator:** Reload the app. Click ⬇
ส่งออก BOM + Packaging. Open the workbook and inspect the three data
sheets. **Stop**. Do not start 13A-4 / 13B / 13C without explicit
approval.

— *Task 13A-3, 2026-05-29*
