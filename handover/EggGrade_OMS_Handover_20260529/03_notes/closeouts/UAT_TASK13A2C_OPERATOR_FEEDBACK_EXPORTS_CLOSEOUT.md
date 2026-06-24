# UAT Task 13A-2C — Operator feedback applied to Step 1 + Step 2 exports — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `8ca4edf360691e656ffb2073d74b5bea`
**Post-edit app MD5:** `bc978fa4934788f3b6f37371af471975`
**Rollback:** `cp _archive/index-pre-task13a2c-feedback-20260528.html app/index.html`

Four operator-feedback fixes applied to the Step 1 + Step 2 clean
exports from Task 13A-2B:

1. **Validation_Rules sheet is back.** Operators wanted it for review.
   Both Step 1 and Step 2 workbooks include it again, drawn from the
   in-app `_buildValidationRules()` already defined in each module.
2. **New Column_Info sheet** explicitly marks every main-sheet column as
   **read-only**, **review-only**, or **editable**, with bilingual notes
   on what blank means (preserve existing) and which values are required.
3. **Behavior_Function_Summary restructured to be behavior-driven.**
   Per the operator: behavior is the real driver of function enablement;
   role is just a preset of behavior. The sheet now has three sections:
   `Behavior driver` (3 rows — what each flag enables), `Role default`
   (6 rows — preset triple per role), `Sub-section gate` (3 rows —
   conditional sub-section visibility).
4. **Step 2 main sheet: `egg_content_type` removed from export;
   chronological egg order.** Operator-friendly `egg_input_type` +
   `egg_is_mixed` (Task 12H cohesion) replace the canonical code on the
   export side. `egg_content_type` stays in the wider import allowlist so
   OLD files re-parse cleanly. Egg fields now read left-to-right in
   operator workflow order: `is_egg → egg_input_type → egg_is_mixed →
   primary_grade → secondary_grade → min_primary`.

4 anchored edits, +10,460 bytes. `node --check` clean on all 9 inline
blocks. Brace / paren / bracket / backtick deltas all 0. **26 / 26 new
acceptance cases pass**; all seven prior harnesses still green (after a
small compatibility patch to the 13A-2B harness's two assertions that
checked the now-superseded export shape).

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a2c-feedback-20260528.html` |
| Pre-edit MD5 | `8ca4edf360691e656ffb2073d74b5bea` (post-Task-13A-2B) |
| Post-edit MD5 | `bc978fa4934788f3b6f37371af471975` |
| Bytes delta | +10,460 |
| Rollback | `cp _archive/index-pre-task13a2c-feedback-20260528.html app/index.html` |

## B. Each feedback item — what changed

### B1. Feedback #1 — "Validation Rules is very good for review, can be here"

**Re-added** `Validation_Rules` sheet to **both** export workbooks. Drawn
from the in-app `_buildValidationRules()` already defined in each
module (12 rules in Step 1, 12 rules in Step 2). Columns: `rule_id,
section, field_key, severity, applies_to, condition, expected,
error_message_th, error_message_en, source_function, notes`. Read by
operators for review only — importers do not use the sheet as
validation authority (current app code stays the source of truth).

### B2. Feedback #2 — "Indicate what is read-only and what will be uploaded"

**New `Column_Info` sheet** in both workbooks. Per-column usage tag with
4 possible values:

| Usage tag | Meaning |
|---|---|
| **read-only (match key)** | `sku` — required, used only to match an existing item. Blank `sku` is a blocking error. |
| **review-only (warn if differs)** | Step 2's identity columns (`name_th, name_en, item_role, item_type, is_active`) — surfaced in the preview, never overwritten on commit. |
| **read-only (derived = 1)** | Step 1's `base_factor` — fixed = 1, ignored on import. |
| **editable** | Everything else — overlay-writes on commit. |
| **editable (only when ...)** | Conditional editable (e.g. `secondary_grade` editable when mixed; `basket_sku` editable when uses_basket=true). |

Columns: `column_name, scope, usage, type, allow_blank_means, notes_th, notes_en`.

Step 1 Column_Info has 15 rows (one per editable column). Step 2 has
16 rows.

### B3. Feedback #3 — "Behavior is the driver of function enablement; role is a preset"

**Restructured `Behavior_Function_Summary`** to a three-section
behavior-driven layout. Columns: `section, key, label_th, label_en,
enables_th, enables_en, notes_th, notes_en`.

```
SECTION 1 · Behavior driver  (3 rows — the real drivers)
  is_sellable=true   → Orders / Sales path enabled
  is_producable=true → BOM / Production target enabled (BOM Enable gate applies)
  is_consumable=true → Can appear as a BOM component on other SKUs

SECTION 2 · Role default     (6 rows — preset triple from _ROLE_BEHAVIOR_DEFAULTS)
  FG        → sellable + producable
  WIP       → producable
  RM        → consumable
  PACKAGING → consumable
  SUPPLY    → consumable (Task 12B Supply deprecated)
  DEFECT    → sellable

SECTION 3 · Sub-section gate (3 rows — conditional visibility)
  🥚 Egg Inputs              shown when item.is_egg = true
  🧺 Basket / Handling Unit  shown when units.has_basket_unit = true
  📦 Packaging Profile       shown when item_role = FG
```

Each Role-default row carries a note that says
"*Editable in the Item Editor — role only seeds the default; the behavior
flags drive function*". The sheet is read top-to-bottom: first you
learn what each behavior enables, then which roles preset which
behaviors, then which sub-sections appear under what conditions.

### B4. Feedback #4 — "egg_content_type — we replaced with egg_input_type; chronological order"

**Step 2 main sheet — `SKU_BOM_Egg_Basket`** — egg group columns now read
in workflow order:

```
BEFORE (Task 13A-2B):
  is_egg, egg_content_type, primary_grade, secondary_grade, min_primary,
  egg_input_type, egg_is_mixed

AFTER (Task 13A-2C, chronological):
  is_egg              ← (decision 1: is it an egg item?)
  egg_input_type      ← (decision 2: raw / under / graded?)
  egg_is_mixed        ← (decision 3: if graded, is it mixed?)
  primary_grade       ← (decision 4: which primary number?)
  secondary_grade     ← (decision 5: if mixed, which secondary?)
  min_primary         ← (decision 6: if mixed, what % primary minimum?)
```

`egg_content_type` is **removed from the export columns** entirely. The
operator-friendly `egg_input_type` + `egg_is_mixed` from Task 12H
replace it on the operator side. On commit, the import flow still
writes the canonical `egg_content_type` to the stored item via
`_t12h_uiToStored(type, mixed)` — calc engine
(`splitBaseEggsByGrade`, etc.) sees no change.

`egg_content_type` **stays in the wider import allowlist** so any old
file that still has the column re-parses cleanly (the column is
accepted but ignored on commit if `egg_input_type` is also set).

Step 2 main sheet column count drops from **17 → 16** (egg_content_type
removed).

## C. Final sheet inventory per export

### Step 1 — `cmk-sku-identity-units-YYYYMMDD-HHmm.xlsx`

| # | Sheet | Purpose |
|---|---|---|
| 1 | `SKU_Identity_Units` | 15 editable Identity + Counting & Units columns (unchanged from 13A-2B) |
| 2 | `Column_Info` | NEW — per-column read-only/editable annotation |
| 3 | `Validation_Rules` | RE-ADDED — 14 rules (R-IU-01..R-IU-14) for review |
| 4 | `Behavior_Function_Summary` | RESTRUCTURED — 12 rows across 3 behavior-driven sections |
| 5 | `Dropdown_Reference` | Scoped option codes (item_role, unit, item_type per role, customer_code) |

### Step 2 — `cmk-sku-bom-egg-basket-YYYYMMDD-HHmm.xlsx`

| # | Sheet | Purpose |
|---|---|---|
| 1 | `SKU_BOM_Egg_Basket` | 16 columns; egg_content_type removed; chronological egg order |
| 2 | `Column_Info` | NEW — per-column read-only/review-only/editable annotation |
| 3 | `Validation_Rules` | RE-ADDED — 12 rules (R-EB-01..R-EB-12) for review |
| 4 | `Behavior_Function_Summary` | Same 3-section behavior-driven summary as Step 1 |
| 5 | `Dropdown_Reference` | Scoped option codes (egg_content_type kept here for documentation, egg_input_type added, egg_grade, basket_sku candidates) |

## D. Import compatibility

| File shape | Behavior |
|---|---|
| **NEW clean Step 2 file** (no `egg_content_type`, egg_input_type + egg_is_mixed only) | Parses cleanly. egg_input_type=raw/under/graded resolves to canonical egg_content_type on commit. |
| **OLD Step 2 file** with `egg_content_type` (no `egg_input_type`) | egg_content_type is in the wider import allowlist → parsed into the row. Validator uses it directly (Task 12H cohesion: if egg_input_type is set in row it wins; otherwise egg_content_type is used). |
| **Hybrid file** with BOTH columns | egg_input_type wins (operator-friendly intent honoured). |
| **Old file with derived columns** | Still in the wider allowlist → not flagged ignored → ignored on commit. |
| **File without Validation_Rules / Behavior_Function_Summary / Column_Info sheets** | All supporting sheets are documentation only. Their absence does not affect import. |

## E. What did not change

- ✗ Import source-of-truth — Step 1 = `SKU_Identity_Units`, Step 2 = `SKU_BOM_Egg_Basket`; single-sheet fallback (Task 13A-1A) intact.
- ✗ `MASTER_V3.option_sets` — read-only access; no new codes.
- ✗ BOM math, Packaging Profile, Basket Profile, Egg calculation (`splitBaseEggsByGrade`, etc.) — byte-identical.
- ✗ Orders, PO Intake, Daily Planning, Daily Plan BOM, ใบน้อย, Logistics.
- ✗ `safeSet`, `persistMasterV3`, header strip backup/restore.
- ✗ Master Data toolbar (Task 13A-0B) — Admin Tools dropdown, hidden BOM Bulk Upload, hidden duplicate Data tab card all intact.
- ✗ Supply / Issue Unit (Task 12B) — no DOM inputs reintroduced.
- ✗ Task 12H operator-friendly egg UI + untick fix-up — intact.
- ✗ Task 13A-1 / 1A / 1B / 1C / 1D / 1E / 13A-2 / 13A-2B modules — all helper functions retained; only the export sheet list + SHEET1_EXPORT_COLUMNS shape changed.

## F. Regression protection

| Regression | Status |
|---|---|
| Task 12B — Supply Unit deprecation | ✓ (verified in harness) |
| Task 13A-0B — BOM Bulk Upload hidden | ✓ |
| Task 12H — egg UI helpers + untick fix-up | ✓ (32/32 + 10/10) |
| Task 13A-1E — role-behavior repair tool | ✓ (18/18) |
| Task 13A-2 — Egg + Basket import flow | ✓ (12/12) |
| Task 13A-2B — clean exports + wider allowlist | ✓ (14/14 after a small patch to two assertions that explicitly checked the OLD shape Task 13A-2C deliberately changed; those assertions are now compatible with the new 3-section Behavior_Function_Summary and the egg_content_type-free export) |

## G. QA / smoke results

### G1. Static — passed

```
node --check on all 9 inline <script> blocks: 9 / 9 PASS
brace {} delta vs backup:   +11 / +11 → net 0
paren () delta vs backup:   +111 / +111 → net 0
bracket [] delta vs backup: +9 / +9 → net 0
backtick delta:             0
4 anchored edits, each src.count(old) === 1 asserted before replacement
Final MD5: bc978fa4934788f3b6f37371af471975
```

### G2. Acceptance harness — 26 / 26 PASS

`_archive/closeouts/UAT_TASK13A2C_cases_harness.js` covers all four
feedback items + regression:

```
PASS · Feedback #1a — Step 1 export includes Validation_Rules sheet
PASS · Feedback #1b — Step 2 export includes Validation_Rules sheet
PASS · Feedback #2a — Step 1 Column_Info: sku is read-only (match key)
PASS · Feedback #2b — Step 1 Column_Info: name_th is editable
PASS · Feedback #2c — Step 2 Column_Info: sku is read-only
PASS · Feedback #2d — Step 2 Column_Info: name_th is review-only (not overwritten)
PASS · Feedback #2e — Step 2 Column_Info: egg_input_type is editable
PASS · Feedback #2f — Step 1 Column_Info: base_factor flagged as read-only derived
PASS · Feedback #3a — Behavior driver section has 3 rows
PASS · Feedback #3b — Role default section has 6 rows
PASS · Feedback #3c — Sub-section gate section has 3 rows
PASS · Feedback #3d — Section order: Behavior driver → Role default → Sub-section gate
PASS · Feedback #3e — is_sellable=true → enables Orders/Sales
PASS · Feedback #3f — FG role default = sellable + producable
PASS · Feedback #3g — PACKAGING role default = consumable
PASS · Feedback #4a — egg_content_type removed from Step 2 export columns
PASS · Feedback #4b — Egg fields in chronological order
PASS · Feedback #4c — egg_content_type STILL in wider import allowlist
PASS · Feedback #4d — OLD file with egg_content_type: column NOT flagged as ignored
PASS · Feedback #4e — NEW clean file without egg_content_type: parses cleanly
PASS · Step 1 export columns unchanged (15 clean columns)
PASS · Headers: Behavior_Function_Summary uses new behavior-driven layout
PASS · Regression — BOM Bulk Upload still hidden (Task 13A-0B)
PASS · Regression — Supply Unit DOM fields still absent (Task 12B)
PASS · Regression — Task 12H + fix-up helpers retained
PASS · Regression — Task 13A-1E repair tool retained

26 passed, 0 failed
```

### G3. Prior harnesses — all green

- **Task 13A-1A**: 18 / 18 PASS
- **Task 13A-1C**: 5 / 5 PASS
- **Task 13A-1E**: 18 / 18 PASS
- **Task 13A-2**: 12 / 12 PASS
- **Task 12H prior**: 32 / 32 PASS
- **Task 12H untick fix-up**: 10 / 10 PASS
- **Task 13A-2B**: 14 / 14 PASS (after two assertions patched to recognize the new export shape)

### G4. Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload app, Master Data → Items → click ⬇ ส่งออก Identity + Units | Downloads `cmk-sku-identity-units-…xlsx` with 5 sheets: `SKU_Identity_Units, Column_Info, Validation_Rules, Behavior_Function_Summary, Dropdown_Reference`. |
| F2 | Open `Column_Info` sheet | One row per column on the main sheet, with `usage` clearly marking `sku` as "read-only (match key)", `base_factor` as "read-only (derived = 1)", and the rest as "editable". |
| F3 | Open `Validation_Rules` sheet | 14 rules R-IU-01..R-IU-14 visible for review with severity, condition, expected, bilingual error messages. |
| F4 | Open `Behavior_Function_Summary` sheet | Three sections in order: Behavior driver (3 rows), Role default (6 rows), Sub-section gate (3 rows). Total 12 rows. Each Role default row notes that role only seeds the default. |
| F5 | Click ⬇ ส่งออก Egg + Basket → open the new file | Same 5-sheet shape. `SKU_BOM_Egg_Basket` main sheet has 16 columns in chronological order. No `egg_content_type` column. |
| F6 | Step 2's `Column_Info`: confirm sku is read-only, name_th/item_role are review-only, all egg + basket fields are editable, secondary_grade and base_per_basket marked "only when ..." | — |
| F7 | Edit an old Step 2 file that still has `egg_content_type` → re-import via ⬆ นำเข้า Egg + Basket | Preview banner: "Only the SKU_BOM_Egg_Basket sheet was used". `egg_content_type` column is parsed (NOT in the "Out-of-scope columns ignored" warning). Commit proceeds. |
| F8 | Edit a new Step 2 file without `egg_content_type` → re-import | Parses cleanly. `egg_input_type` + `egg_is_mixed` are the operator-facing controls. After commit, the stored item's `egg_content_type` is the canonical code (verified by opening the item in the editor). |
| F9 | Verify all prior surfaces remain intact | Task 12B / 13A-0B / 12H / 13A-1E / 13A-2 all intact. |
| F10 | Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G5. Known limitations

- **The Step 2 file still accepts `egg_content_type`** for backward compat
  with old files. If both `egg_input_type` AND `egg_content_type` are
  set in the same row, `egg_input_type` wins (Task 12H cohesion intent).
- **Behavior_Function_Summary is documentation only.** The importer does
  not validate behavior assertions against this sheet — current app code
  remains the validation authority.
- **`Column_Info`'s "usage" column is text, not enum.** Operators read
  it, the importer ignores it.
- **Manual F1–F10 not yet run by operator.** Static + headless tests
  are green.

## H. Final verdict

**ready for UAT testing**

All four operator-feedback items addressed in the Step 1 + Step 2
exports. Validation_Rules is back for review. Column_Info explicitly
marks read-only / review-only / editable per column. The
Behavior_Function_Summary is restructured to make the
behavior-drives-function intent explicit and to show role merely as a
preset. The Step 2 main sheet drops the canonical egg_content_type
in favour of the operator-friendly egg_input_type / egg_is_mixed pair
from Task 12H, with chronological column order. Backward compatibility
preserved for OLD files. Task 13A-0B toolbar, Task 12B Supply
deprecation, Task 12H egg UI + untick fix-up, Task 13A-1 / 1A / 1B /
1C / 1D / 1E / 13A-2 / 13A-2B all intact.

**Roll back with:** `cp _archive/index-pre-task13a2c-feedback-20260528.html app/index.html`

**Next concrete action for the operator:** Reload the app. Click ⬇
ส่งออก Identity + Units and ⬇ ส่งออก Egg + Basket. Inspect the
five sheets in each workbook — especially `Column_Info` (per-column
read-only/editable annotation) and the restructured
`Behavior_Function_Summary` (behavior-driven, role-as-preset).
**Stop**. Do not start 13A-3 / 13A-4 / 13B / 13C without explicit
approval.

— *Task 13A-2C, 2026-05-28*
