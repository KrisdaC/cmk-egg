# UAT Task 13A-2 — BOM Sub-sections: Egg Inputs + Basket / Handling Unit · Export / Import — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `69370f6943b79ba257727e30e5a96c0e`
**Post-edit app MD5:** `bad7ff894b06994757281a37c6eea586`
**Rollback:** `cp _archive/index-pre-task13a2-eggbasket-20260528.html app/index.html`

Step 2 of the Master SKU Rebuild flow: a controlled export → clean →
import → validate → preview-diff → confirm → commit pipeline for only the
**Egg Inputs** and **Basket / Handling Unit** sub-sections of the
BOM / Production Formula. Identity, Counting & Units, role-derived behavior
flags, the rest of `bom.components` / `bom.routes`, Packaging Profile,
External References, and unknown fields are preserved by deep-clone-then-
overlay. New SKUs are **blocking** — Identity + Units (Step 1) remains the
only path for creation.

Two anchored edits in `app/index.html` plus a small bug-fix patch caught
by the headless harness. `node --check` clean on all 9 inline `<script>`
blocks. Brace / paren / bracket / backtick deltas all 0. **12 / 12 cases
PASS** plus prior harnesses (13A-1A 18/18, 13A-1C 5/5, 13A-1E 18/18) all
green.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a2-eggbasket-20260528.html` |
| Pre-edit MD5 | `69370f6943b79ba257727e30e5a96c0e` (post-Task-13A-1E) |
| Post-edit MD5 | `bad7ff894b06994757281a37c6eea586` |
| Bytes delta | ~+62 KB (HTML Step-2 card + new `<script>` block + harness-discovered `_simulateOverlay` guard) |
| Rollback | `cp _archive/index-pre-task13a2-eggbasket-20260528.html app/index.html` |

Earlier backups remain for deeper rollbacks: `_archive/index-pre-task13a1e-rolebehavior-20260528.html`, `_archive/index-pre-task13a1d-uatv019fix-20260528.html`, etc.

## B. Data-model inspection — actual fields found

### Egg Inputs (top-level on the item)

```
item.is_egg              boolean   (true = treat as egg; undefined treated as true elsewhere in app)
item.egg_content_type    string    (option_sets.egg_content_type: UNGRADED_EGG / UNDERGRADE / GRADED_SINGLE / GRADED_MIX)
item.primary_grade       string    (option_sets.egg_grade: '0'..'6')
item.secondary_grade     string    (option_sets.egg_grade)
item.min_primary         number    (percentage, e.g. 40 — UAT-036 guards fractional inputs)
```

**Egg BOM lines are derived**, never stored. Computed by:

- `splitBaseEggsByGrade(item, baseEggs)` — splits a base-egg requirement into single / mixed grade rows.
- `calculateEggSourceRequirements(item, outputQty)` — wraps the split helper.
- `_bomEggGradeLabel(g)` — display label (`เบอร์ N`).
- `_bomResolveEggSize(it, line)` — Daily-Plan egg-size column resolver.

### Basket / Handling Unit (mixed: units + bom.components)

```
item.units.has_basket_unit   boolean   (Task 7C / 8C-2: normalizeItemUnits infers true when base_per_basket > 0)
item.units.basket_unit       string    (normalized to 'ตะกร้า' when on)
item.units.base_per_basket   number    (the conversion integer)
```

Plus **one** row in `item.bom.components` where `component_role === 'basket'`:

```
{
  component_type: 'packaging',
  component_role: 'basket',
  component_sku: '<basket SKU>',
  component_name, qty_per_selling_unit, unit,
  source: 'basket_profile',
  required: true,
  needs_review: <true when conversion missing>,
  notes
}
```

Basket helpers reused (read-only):

- `_bomBasketCandidateItems()` — `MASTER_V3.items` filtered by `item_role='PACKAGING'` AND `item_type='basket'`.
- `_bomBasketComponents(it)` — the basket rows on the item.
- `_bomBasketProfileStatus(it)` — `{ok, msg}`.
- `_bomResolveBasketUnit(sku, fallback)` — base unit of the basket SKU.
- `calculateBasketRequirementFromItem(item, outputQty)` — derived qty.

## C. Export structure

Filename: `cmk-sku-bom-egg-basket-YYYYMMDD-HHmm.xlsx` (JSON fallback when XLSX is unavailable).

**Sheet 1 — `SKU_BOM_Egg_Basket`** (one row per SKU)

```
sku, name_th, name_en, item_role, item_type, is_active                — Identity (review only, never updated)
is_egg, egg_content_type, primary_grade, secondary_grade, min_primary — Egg Inputs (editable)
egg_profile_status_derived, egg_bom_lines_derived,
egg_missing_requirements_derived                                       — Egg derived (review only)
uses_basket, basket_sku, basket_unit, base_per_basket                  — Basket (editable)
basket_qty_per_pack_derived, basket_qty_per_selling_unit_derived,
basket_status_derived, basket_missing_requirements_derived             — Basket derived (review only)
```

**Sheet 2 — `Field_Dictionary_BOM_Egg_Basket`** — 21 rows: one per exported field, including `section, field_key, column_name, thai_label, english_label, data_type, required, required_when, editable_in_ui, dropdown_source, allowed_values_source, validation_rule, example_value, notes, legacy_status`.

**Sheet 3 — `Dropdown_Options_BOM_Egg_Basket`** — option codes used by:

- `egg_content_type` ← `option_sets.egg_content_type`
- `primary_grade / secondary_grade` ← `option_sets.egg_grade`
- `basket_sku` ← `_bomBasketCandidateItems()` (PACKAGING + item_type=basket)

`MASTER_V3.option_sets` is read-only. The importer NEVER adds option codes.

**Sheet 4 — `Validation_Rules_BOM_Egg_Basket`** — 12 rules (R-EB-01 through R-EB-12), each with `severity`, `applies_to_role`, `applies_to_item_type`, `condition`, `expected`, bilingual `error_message_*` and `suggested_fix_*`, `source_function`, and `status` (`enforced` / `derived` / `recommended_not_enforced`).

**Sheet 5 — `Current_Validation_Report_BOM_Egg_Basket`** — live scan of `MASTER_V3.items` via the in-app helpers, focused on Egg Inputs and Basket / Handling Unit issues only.

## D. Import flow

```
1. Operator clicks ⬆ นำเข้า Egg + Basket
   → t13a2_openImportPicker() → #t13a2ImportInput.click()

2. Operator picks .xlsx or .json
   → t13a2_handleImportFile(file)
   → _parseXlsxImport / _parseJsonImport
      • Locate sheet named SKU_BOM_Egg_Basket (case-insensitive); fall back
        to first sheet if absent.
      • Header normalization: any non-allowlisted column is recorded in
        ignored_columns[]. Other sheets are recorded in ignored_sheets[].

3. _validateImportRows(rows) — pure function, no mutation.
   Per row:
     • Blocking: blank sku, duplicate sku in file, sku not found in MASTER_V3
       (new SKUs blocked in this task), invalid egg_content_type,
       primary_grade / secondary_grade not in option_sets.egg_grade when set
       or required, GRADED_MIX requires primary + secondary + min_primary > 0,
       uses_basket=true but base_per_basket missing/≤0, uses_basket=true but
       basket_sku not selected, basket_sku not in _bomBasketCandidateItems
       (inactive basket = warning only).
     • Warnings: identity columns differ from current item (REVIEW ONLY —
       never overwritten); basket SKU inactive; out-of-scope columns ignored.
     • For each row, compute _egg_action, _basket_action, simulated derived
       statuses (egg_profile_status_derived, basket_status_derived) and a
       per-field _changes[] diff.

4. _showImportPreviewModal — full modal:
   • KPI strip: Total / Update / Unchanged / Blocking / Warnings / Identity
     mismatches (review only)
   • Ignored-sheets banner (Thai-first + English) and ignored-columns notice
   • Scope reminder: "Identity / Units / BOM Components / Packaging Profile
     will be preserved"
   • Per-row table with sku, name, role/type, egg_action, basket_action,
     errors, warnings, changed fields, derived statuses
   • Commit button DISABLED when blocking_errors > 0

5. Operator clicks ✅ ยืนยันและบันทึก. window.confirm() asks one final time
   with the exact wording from the brief.

6. _commitImport(parsed) — only path that mutates data:
   • persistMasterV3({ snapshotReason: 't13a2_pre' }) → pre-snapshot via safeSet
   • For each clean row:
       - existing & unchanged → counted, no write
       - existing & update    → deep-clone, then:
           _overlayEggInputs(next, row)       — Egg fields only when row sets them
           _overlayBasket(next, row, …)        — units flags + basket bom.component
   • Replace MASTER_V3.items
   • persistMasterV3({ force: true, snapshotReason: 't13a2_post' })
   • renderV3Items + renderHeaderStrip

7. Success toast: "✓ นำเข้าสำเร็จ · Imported: N updated, N unchanged, N skipped"
```

No automatic commit anywhere. Two confirmations (modal button + OS confirm). Out-of-scope columns are silently dropped to ignored_columns and warned in preview.

## E. Egg + Basket coverage

### E1. Editable fields the importer writes

```
Egg Inputs:
  is_egg
  egg_content_type
  primary_grade
  secondary_grade
  min_primary

Basket / Handling Unit:
  item.units.has_basket_unit
  item.units.basket_unit (always 'ตะกร้า' when on)
  item.units.base_per_basket
  ONE row in item.bom.components where component_role === 'basket'
    (component_sku, component_name, qty_per_selling_unit, unit, source,
     required, needs_review, notes)
```

### E2. Derived columns — review only, never persisted

```
egg_profile_status_derived     // not_egg / incomplete / complete
egg_bom_lines_derived          // splitBaseEggsByGrade summary
egg_missing_requirements_derived

basket_qty_per_pack_derived
basket_qty_per_selling_unit_derived  // calculateBasketRequirementFromItem
basket_status_derived          // _bomBasketProfileStatus().msg
basket_missing_requirements_derived
```

These appear in the export to help operators clean data outside the system. On import they are **recomputed** from current app logic; the workbook's stored values are ignored.

### E3. Blank-cell semantics (same as Task 13A-1C)

- Row cell blank → "preserve existing" → no validation, no write
- Row cell set → "operator wrote a value" → validate (merged with existing where applicable) and overlay
- Boolean column blank → preserve; `true` activates; `false` explicitly deactivates (per current app semantics, e.g. Task 8C-2E for basket: stored basket component preserved as inactive on deactivate; existing basket_unit / base_per_basket retained for data continuity)

## F. Preservation and safety

| Concern | Status | Evidence |
|---|---|---|
| Identity preserved (sku, name, item_role, item_type, is_active) | ✓ | Never written by `_overlayEggInputs` or `_overlayBasket`; identity mismatch surfaces as warning only, never overwrites. Verified Case 11. |
| Counting & Units preserved (base_unit, pack_unit, base_per_pack, storage_unit, base_per_storage, selling_unit) | ✓ | Untouched. Verified Case 11 (file's `units.base_unit` ignored). |
| Role-derived behavior flags preserved (is_sellable, is_producable, is_consumable) | ✓ | Untouched. Task 13A-1E still in charge for these. |
| BOM status / enabled flag preserved | ✓ | `bom.enabled` never written. |
| BOM components preserved (non-basket rows) | ✓ | Only the ONE basket row in `bom.components` is touched. Non-basket rows (`tray`, `cover`, etc.) untouched. Verified Cases 6, 7, 11 (`TRAY-1` row preserved on B0001 across both basket activate/deactivate and out-of-scope import). |
| BOM routes preserved | ✓ | `bom.routes` never read or written. |
| Packaging Profile preserved | ✓ | `packaging_profile.*` never touched. Verified Case 11. |
| External References preserved | ✓ | `external_refs.*`, `partner_codes`, `aliases`, `barcode`, `upload_mappings` never touched. Verified in deep-clone snapshot tests. |
| Legacy supply fields preserved on existing items | ✓ | `units.has_consumable_unit / consumable_unit / base_per_consumable` never read or written. |
| `MASTER_V3.option_sets` not mutated | ✓ | Read via `getOptionSet({ includeInactive: true })` only. No `addOption / updateOption / deactivateOption` calls. |
| `MASTER_V3.customers` / `.sites` not mutated | ✓ | Module never references them. |
| Unknown fields preserved | ✓ | Deep-clone-then-overlay leaves any non-allowlisted field intact. Verified via the synthetic `legacy_field` round-trip in Case 6/11. |
| Pre-write backup via existing path | ✓ | `persistMasterV3({ snapshotReason: 't13a2_pre' })` then `persistMasterV3({ force: true, snapshotReason: 't13a2_post' })` route through `safeSet`. |
| New SKU creation blocked | ✓ | `sku not found` is a blocking error. Verified Case 10. |

## G. QA / smoke results

### G1. Static — passed

```
node --check on all 9 inline <script> blocks: 9 / 9 PASS
brace {} delta vs backup:   +271 / +271 → net 0
paren () delta vs backup:   +908 / +908 → net 0
bracket [] delta vs backup: +124 / +124 → net 0
backtick delta:             0
2 anchored edits, each src.count(old) === 1 asserted before replacement,
plus one anchored fix-up patch (_simulateOverlay bom guard) caught by the
acceptance harness and immediately corrected (verified by re-running every
case after the patch).
Final MD5: bad7ff894b06994757281a37c6eea586
```

### G2. Acceptance harness — 12 / 12 PASS

`_archive/closeouts/UAT_TASK13A2_cases_harness.js` against a synthetic
MASTER_V3 with three FG items + three basket-candidate PACKAGING items:

```
PASS · Case 1 — Export current: per-SKU row with egg + basket + derived fields
PASS · Case 2 — Round-trip unchanged: 0 blocking, mostly unchanged
PASS · Case 3 — Egg single-grade: valid, derived complete
PASS · Case 4 — Egg mixed-grade: valid, derived complete
PASS · Case 5 — Egg inactive: is_egg=false; derived not_egg
PASS · Case 6 — Basket activate: SKU set, units written, identity/units preserved
PASS · Case 7 — Basket deactivate: has_basket_unit=false; basket component preserved as inactive
PASS · Case 8 — Invalid basket SKU: blocking; commit refused
PASS · Case 9 — Invalid egg grade: blocking with primary_grade error
PASS · Case 10 — Unknown SKU: blocking; no new SKU created
PASS · Case 11 — Out-of-scope columns ignored; Identity/Units/Packaging not changed
PASS · Case 12 — Identity + Units + 13A-1E behavior repair tools intact

12 passed, 0 failed
```

The harness needs a small Node-vm sandbox shim (overrides for `getOptionSet`,
`_bomBasketCandidateItems`, `normalizeItemUnits` etc.) to bypass a closure
capture quirk in the merged-block test setup. **In a real browser this is a
non-issue** — every `<script>` tag shares the same script realm and the
in-module `typeof getOptionSet === 'function'` resolves to the in-app
helper. Documented in the harness file's header comment.

### G3. Prior harnesses — no regression

- **Task 13A-1A harness:** 18 / 18 PASS (unchanged)
- **Task 13A-1C harness:** 5 / 5 PASS (unchanged)
- **Task 13A-1E harness:** 18 / 18 PASS (unchanged)

### G4. Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload app, Master Data → Items | The Master SKU Rebuild card now shows **Step 2: Egg Inputs + Basket / Handling Unit** below the Step 1 buttons and the 🔧 repair button. Two new buttons: ⬇ ส่งออก Egg + Basket and ⬆ นำเข้า Egg + Basket. |
| F2 | Click ⬇ ส่งออก Egg + Basket | A file `cmk-sku-bom-egg-basket-YYYYMMDD-HHmm.xlsx` downloads with the 5 sheets documented in § C. |
| F3 | Open in Excel; edit ONE row's `min_primary` (e.g. 40 → 45) on a GRADED_MIX FG; save | — |
| F4 | Click ⬆ นำเข้า Egg + Basket and pick the file | Preview modal opens; banner: "ℹ Only the SKU_BOM_Egg_Basket sheet was used"; that one row shows `update` action and `min_primary` in changed fields; everything else is `unchanged`. |
| F5 | Click ✅ ยืนยันและบันทึก, confirm | Toast: `✓ นำเข้าสำเร็จ · Imported: 1 updated, N unchanged, 0 skipped`. |
| F6 | Open the updated item in the Item editor | `min_primary` now shows 45 in the Egg Inputs section. BOM components (other than basket) unchanged. Packaging Profile unchanged. Identity / Counting & Units unchanged. |
| F7 | Try a row that activates basket on an FG that previously didn't use one: set `uses_basket=true`, pick a valid `basket_sku` from the dropdown options sheet, set `base_per_basket=70` | Preview shows `basket_activated`; commit. After commit, the item editor's Basket Profile shows the SKU + the conversion; `bom.components` now has ONE basket row + whatever other components existed before. |
| F8 | Try setting `uses_basket=false` on an item with basket | Preview shows `basket_deactivated`. Commit. Item editor's Basket Profile says "Uses basket: off"; the stored basket component is **preserved as inactive** (per Task 8C-2E). |
| F9 | Add a deliberately-bad row: `basket_sku = NOT-A-BASKET` with `uses_basket=true` | Preview shows a blocking error; commit disabled. |
| F10 | Add a new SKU (sku not in master) | Preview shows `sku not found in MASTER_V3.items` blocking error; commit disabled. **No new SKU is ever created by this importer.** |
| F11 | Add out-of-scope columns (e.g. `units.base_unit`, `bom.enabled`) | Preview shows "Out-of-scope columns ignored" banner; commit accepted. Re-open any updated item — `units.base_unit` unchanged, `bom.enabled` unchanged. |
| F12 | Verify the Task 13A-0B / 12B / 13A-1E regressions: open Master Data toolbar | No BOM Bulk Upload visible; ⚙ Admin Tools dropdown present; 🔧 Preview + Repair still works; Step 1 + Step 2 buttons all visible on Items sub-tab; Section K regression rows all pass. |
| F13 | `docs/QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G5. Known limitations

- **Egg BOM lines are recomputed, never imported.** This is by design — the lines are derived from is_egg + egg_content_type + grades by `splitBaseEggsByGrade`. Editing them in the file has no effect.
- **Basket qty is recomputed, never imported.** Same reason — `calculateBasketRequirementFromItem` is the source of truth.
- **Identity columns are review-only.** If you change `name_th` in the file, the importer surfaces a warning but does NOT overwrite the stored name. Use Step 1 (Identity + Units) for that.
- **Identity mismatch count is informational.** No commit blocking based on review-only column drift.
- **Inactive basket SKUs warn, not block.** Operators can still select an inactive basket via this importer; the Item editor will flag it.
- **`is_egg` cell parsing** is tolerant: `true / TRUE / 1 / "yes" / "active" / "on"` → true; `false / FALSE / 0 / "no" / "inactive" / "off"` → false; blank → preserve.
- **Node-sandbox quirk** documented in G2 — does not affect real-browser behavior.
- **Manual F1–F13 not yet run by operator.** Static + headless tests are green.

## H. Final verdict

**ready for UAT testing**

Step 2 of the Master SKU Rebuild — Egg Inputs + Basket / Handling Unit
export / import — is in place and end-to-end green in the headless
harness. Identity, Counting & Units, role-derived behavior flags, the
rest of `bom.components` / `bom.routes`, Packaging Profile, External
References, and unknown fields are preserved by deep-clone-then-overlay.
New SKUs are blocked (Step 1 owns creation). Task 13A-0B toolbar cleanup,
Task 12B Supply deprecation, Task 13A-1 / 1A / 1C / 1D / 1E behavior all
remain intact.

**Roll back with:** `cp _archive/index-pre-task13a2-eggbasket-20260528.html app/index.html`

**Next concrete action for the operator:** Reload the app, open Master
Data → Items, click ⬇ ส่งออก Egg + Basket, clean the file in Excel,
re-import via ⬆ นำเข้า Egg + Basket, confirm. **Stop**. Do not start
13A-3 / 13A-4 / 13B / 13C without explicit approval.

— *Task 13A-2, 2026-05-28*
