# UAT Task 12H — Egg Inputs UI Cleanup (Raw / Under-grade / Graded + Mixed) — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `bad7ff894b06994757281a37c6eea586`
**Post-edit app MD5:** `c033e6fe8b8ad2cb0176d14c04058a87`
**Rollback:** `cp _archive/index-pre-task12h-egguicleanup-20260528.html app/index.html`

A UI normalization layer over the Egg Inputs sub-card in the BOM /
Production Formula section. Operators now see three plain choices —
**Raw egg / Under-grade / Graded egg** — with a Mixed grade checkbox
that appears only when Graded is selected. Secondary grade and the
minimum primary ratio appear only when Graded + Mixed.

Stored field `egg_content_type` is preserved: the visible controls write
through a **hidden** `data-f="egg_content_type"` input that holds the
canonical code, so `_readEditForm`, save, validation, and the entire
egg-calculation chain (`splitBaseEggsByGrade`,
`calculateEggSourceRequirements`, `calculateEggOutputTargets`) keep
running unchanged. The Task 13A-2 Egg + Basket workbook gains two
operator-friendly columns (`egg_input_type`, `egg_is_mixed`) so the file
matches what operators now see in the UI — when set, the friendly
columns resolve to the canonical code at commit time.

Six anchored edits — one to the Item-editor renderer, five for Task 13A-2
cohesion. `node --check` clean on all 9 inline blocks. Brace / paren /
bracket / backtick deltas all 0. **32 / 32 acceptance cases pass**. All
four prior harnesses (13A-1A 18/18, 13A-1C 5/5, 13A-1E 18/18, 13A-2
12/12) re-run green.

---

## A. Files changed

| File | Change |
|---|---|
| `app/index.html` | 6 anchored edits. **Edit 1** (line ~24968): replaces `_bomRenderItemEggInputsSubcard` with the new layout and inserts the five `_t12h_*` global helpers above it. **Edits 2–6** (Task 13A-2 module): extends `SHEET1_COLUMNS`, `_deriveRow`, `_validateImportRows`, `_buildFieldDictionary`, and `_buildValidationRules` so the workbook matches the UI. Total +8,635 bytes. |
| `_archive/index-pre-task12h-egguicleanup-20260528.html` | NEW — pre-edit snapshot, MD5-verified identical (`bad7ff89…`). |
| `_archive/closeouts/UAT_TASK12H_EGG_INPUTS_UI_CLEANUP_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK12H_cases_harness.js` | NEW — 32-case headless acceptance harness. |
| `docs/BUG_LOG.md` | **Not touched.** No new known risk surfaced. |

## B. UI changes made

### B1. Item editor — Egg Inputs sub-card (Master Data → Items → open any item → BOM / Production Formula → 🥚 Egg Inputs)

**Before** — one technical dropdown:

```
Egg content type  [UNGRADED_EGG / UNDERGRADE / GRADED_SINGLE / GRADED_MIX]
Primary grade     [grade picker]   (always visible)
Secondary grade   [grade picker]   (always visible)
Min primary %     [number input]   (always visible)
```

**After** — friendly select + conditional fields:

```
Egg input type · ประเภทวัตถุดิบไข่   [— pick one —, Raw egg, Under-grade, Graded egg]
└─ Mixed grade · เป็นไข่ผสมเบอร์   [checkbox]   (shown only when Graded)
   ├─ Primary grade · เบอร์หลัก         [grade picker]    (shown only when Graded)
   ├─ Secondary grade · เบอร์รอง         [grade picker]    (shown only when Graded + Mixed)
   └─ Min primary ratio (%) · สัดส่วนขั้นต่ำของเบอร์หลัก (%)  [number input]  (shown only when Graded + Mixed)
```

Helper text under the sub-card title:

> ภาษาไทย: *เลือกชนิดวัตถุดิบไข่ก่อน ถ้าเป็นไข่เบอร์ผสม ให้ติ๊ก Mixed grade แล้วใส่สัดส่วน*
> English: *Choose the egg input type first. If it is a mixed graded egg, tick Mixed grade and set the ratio.*

The "Is egg item" checkbox (`data-f="is_egg"`) is unchanged.

### B2. Hidden canonical code

The canonical `egg_content_type` value still drives every downstream
function. It now lives in a hidden `<input type="hidden" data-f="egg_content_type">`
that the visible controls write to via two onchange handlers:

```javascript
_t12h_onEggInputTypeChange()  // fires when "Egg input type" select changes
_t12h_onEggMixedChange()      // fires when "Mixed grade" checkbox toggles
```

`_readEditForm` continues to read the field from `[data-f="egg_content_type"]`,
so the save flow is byte-identical to before.

### B3. Legacy out-of-list codes — passive preservation

If an existing item carries a stored code outside the four canonical
values (e.g. `GRADED_MIXED_ADJACENT` or any custom string), the renderer:

- Sets the visible select to a **best-effort match** (Graded + Mixed for
  `GRADED_MIXED_ADJACENT`; blank for genuinely unknown codes).
- Initializes the hidden input with the **raw stored value** (verbatim).
- Renders a small amber notice: *"⚠ ค่าที่บันทึกไว้เดิม: `<code>` — ยังคงเก็บไว้ในระบบ; แก้ไขที่ช่องด้านบนเพื่อบันทึกค่ามาตรฐานใหม่."*
- If the operator never touches the visible controls and saves, the
  legacy code is preserved verbatim. The moment they pick something from
  the dropdown, the hidden input is overwritten with a canonical code.

### B4. Task 13A-2 cohesion — Egg + Basket workbook

The Task 13A-2 `SKU_BOM_Egg_Basket` sheet now carries **two extra
columns** placed right after `min_primary`:

```
egg_input_type   ['raw' | 'under' | 'graded' | '']
egg_is_mixed     [boolean]
```

On export they're derived from the stored `egg_content_type` via the
same `_t12h_storedToUi` helper used by the UI. On import they're
**accepted alongside** `egg_content_type` — when a row sets
`egg_input_type` (non-blank), the importer resolves it to a canonical
code via `_t12h_uiToStored(...)` and that takes priority over a raw
`egg_content_type` cell. This keeps the workbook in lock-step with the
new UI: operators can clean their data in Excel using the same friendly
labels they see in the Item editor.

The Field Dictionary sheet gains two new entries documenting these
columns. The Validation Rules sheet's R-EB-03 note is extended to spell
out the priority rule.

## C. Legacy value mapping

| Stored `egg_content_type` | Visible "Egg input type" | "Mixed grade" |
|---|---|---|
| `UNGRADED_EGG` | **Raw egg** | unchecked |
| `UNDERGRADE` | **Under-grade** | unchecked |
| `GRADED_SINGLE` | **Graded egg** | unchecked |
| `GRADED_MIX` | **Graded egg** | checked |
| `GRADED_MIXED_ADJACENT` *(legacy alt)* | **Graded egg** | checked |
| `""` / `null` | blank | unchecked |
| any other legacy value | blank + amber notice | unchecked |

| Operator's UI selection | Written `egg_content_type` |
|---|---|
| Raw egg | `UNGRADED_EGG` |
| Under-grade | `UNDERGRADE` |
| Graded egg + Mixed unchecked | `GRADED_SINGLE` |
| Graded egg + Mixed checked | `GRADED_MIX` |
| blank | `""` |

**Note on `GRADED_MIXED_ADJACENT`:** the existing
`splitBaseEggsByGrade` only treats `GRADED_MIX` as mixed (and falls
through to "mixed" when `secondary_grade` is set). Items stored as
`GRADED_MIXED_ADJACENT` that lacked a secondary_grade were therefore
being calculated as **single** despite the operator-visible label.
Task 12H normalizes them to `GRADED_MIX` the moment the operator touches
the UI controls — this is a quiet improvement (matches the operator's
visible intent), not a regression.

## D. Egg calculation compatibility

`splitBaseEggsByGrade`, `calculateEggSourceRequirements`,
`calculateEggOutputTargets`, the BOM readiness gate (`_bomItemReadiness`),
and the Daily-Plan egg-size resolver are **byte-identical** to the
backup. They all key off `egg_content_type` (and `secondary_grade`),
which still hold the same canonical values.

Verified by the harness:

```
PASS · Calc: UNGRADED_EGG single-target/single-source unchanged
PASS · Calc: GRADED_SINGLE one egg requirement line
PASS · Calc: GRADED_MIX → mixed target + 2 source lines (primary min + secondary balance)
```

## E. What was intentionally not changed

- ✗ `MASTER_V3.option_sets.egg_content_type` — read only by the new
  renderer (the old call to `renderOptionSelect('egg_content_type', ...)`
  is gone, replaced by a static 3-option select). The option_set itself
  is untouched.
- ✗ `_EGG_CONTENT_TYPES` seed — unchanged (still
  `["UNGRADED_EGG","UNDERGRADE","GRADED_SINGLE","GRADED_MIX"]`).
- ✗ Packaging Profile, Basket Profile, Generic Packaging Slot Editor,
  Tray qty rule (Task 11G), Unit conversion (Task 11F).
- ✗ Daily Plan BOM (`renderPlanBom`), Orders, Daily Planning, ใบน้อย,
  Logistics, PO parsers.
- ✗ `safeSet` / header strip / `oms-production/`.
- ✗ BOM Bulk Upload importer (still hidden per Task 13A-0B).
- ✗ Task 13A-1 / 1A / 1B / 1C / 1D / 1E modules (Identity + Units,
  ignored-sheets banner, basket merged-state, blank-cell preserve, unit
  scanner fix, role-behavior repair tool) — all intact.
- ✗ `splitBaseEggsByGrade` and every other egg-calculation helper —
  byte-identical to the backup.

## F. Manual QA checklist

Reload `app/index.html` in the browser first.

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data → Items → open an item with `egg_content_type='UNGRADED_EGG'` | Egg input type select shows **Raw egg**; Mixed grade row hidden; Primary / Secondary / Min primary rows hidden. |
| F2 | Open an item with `egg_content_type='UNDERGRADE'` | Select shows **Under-grade**; Mixed / Primary / Secondary / Min hidden. |
| F3 | Open an item with `egg_content_type='GRADED_SINGLE'` and a primary_grade | Select shows **Graded egg**; Mixed checkbox visible & unchecked; Primary grade visible; Secondary / Min hidden. |
| F4 | Open an item with `egg_content_type='GRADED_MIX'` + primary + secondary + min_primary=40 | Select shows **Graded egg**; Mixed checkbox visible & **checked**; Primary / Secondary / Min primary rows all visible with current values. |
| F5 | If you can find one — open an item with `egg_content_type='GRADED_MIXED_ADJACENT'` | Select shows **Graded egg**, Mixed **checked**; the small "⚠ Legacy stored value: GRADED_MIXED_ADJACENT — preserved as-is" notice appears. Saving without changes preserves the legacy code; picking the dropdown again rewrites to GRADED_MIX. |
| F6 | Switch a Raw item to Graded egg in the dropdown | Mixed checkbox row appears; Primary grade row appears; Secondary / Min still hidden. Save → opens fine. |
| F7 | On a Graded item, tick Mixed grade | Secondary grade row appears; Min primary ratio row appears. Untick → both disappear. |
| F8 | On an Under-grade item, save without changing anything | Stored `egg_content_type` still equals `UNDERGRADE` (unchanged). |
| F9 | On a Graded + Mixed item, change min_primary from 40 to 45, save, reopen | Min primary now shows 45. BOM lines (Daily Plan + per-SKU Test Calculation) reflect the new 45/55 split. |
| F10 | BOM enable button readiness | A Graded item with primary + secondary + min_primary set still passes `_bomItemReadiness` and the BOM Enable checkbox unlocks (when other gates pass). |
| F11 | Master SKU Rebuild → click ⬇ ส่งออก Egg + Basket | The downloaded `cmk-sku-bom-egg-basket-…xlsx` has two extra columns: `egg_input_type` and `egg_is_mixed`, populated per row. |
| F12 | Edit one row's `egg_input_type` from `graded` to `raw` in Excel, then re-import via ⬆ นำเข้า Egg + Basket | Preview shows that row as `update` with `egg_content_type` changed to `UNGRADED_EGG`. Commit. Reopen the item — select now shows Raw egg. |
| F13 | Section K regression (`docs/QA_CHECKLIST.md`) | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |
| F14 | Open Master Data → Controlled Lists → egg_content_type | Still shows the 4 canonical codes from the seed; nothing added or removed by this sprint. |

## G. Known risks

- **Manual QA F1–F14 not yet run** — only static + headless tests.
- **Legacy code auto-normalization.** Items stored as
  `GRADED_MIXED_ADJACENT` are rewritten to `GRADED_MIX` the first time
  the operator opens and re-saves the item editor with the egg dropdown
  touched. This matches what the calculation engine treats as mixed
  (improvement, not regression — see § C); operators who care about
  the legacy code should leave the visible dropdown untouched on those
  items.
- **The Task 13A-2 workbook gains two new columns.** Files exported
  before Task 12H lack `egg_input_type` / `egg_is_mixed`. The importer
  accepts them as missing (blank cells = preserve existing), so old
  exports still re-import cleanly. New exports include the columns.
- **`Egg content type` label is gone from the Item editor.** The select
  now reads "Egg input type" / "ประเภทวัตถุดิบไข่". Operators who
  searched for the old label will find the new field one row down.
- **The dropdown render no longer calls `renderOptionSelect('egg_content_type', ...)`.**
  If you ever add an `is_active=false` entry to
  `option_sets.egg_content_type`, the new select will NOT render it
  (the new select is a static 3-option list). The hidden input still
  preserves whatever code is stored. Acceptable per the brief; documented.

## H. Final verdict

**ready for UAT testing**

The technical dropdown is replaced with three operator-friendly choices
plus a Mixed checkbox; conditional rows show only the fields that apply.
The calculation engine is byte-identical and verified — Single / Mixed
behaviour preserved. Existing legacy items load correctly and save back
to canonical codes; truly unknown codes are preserved verbatim. The
Task 13A-2 Egg + Basket workbook gains matching friendly columns so the
operator's Excel mirrors the new UI end-to-end. Task 13A-0B toolbar,
Task 12B Supply deprecation, and the Task 13A-1 / 1A / 1C / 1D / 1E /
13A-2 modules all remain intact.

**Roll back with:** `cp _archive/index-pre-task12h-egguicleanup-20260528.html app/index.html`

**Next concrete action for the operator:** Reload the app, open a few
egg items in Master Data → Items, confirm the new dropdown + Mixed
checkbox behave as expected, then re-export via Step 2 (Egg + Basket)
to see the new friendly columns in the workbook. **Stop**.

— *Task 12H, 2026-05-28*

---

## I. Fix-up — 2026-05-28 — Untick Mixed should drop the BOM back to single

**Bug reported by operator after F4 manual test:**

> "tick the Mix → 2 sizes appear in BOM ✓ ; untick → 2 sizes still appear ✗
> intended: untick should change show 2 → show 1"

**Root cause.** Unticking Mixed correctly rewrote
`egg_content_type = GRADED_SINGLE`, but **`secondary_grade` was left in
place**. The calc engine treats an item as mixed if
`egg_content_type === 'GRADED_MIX'` **OR** `!!secondary_grade`
(see `splitBaseEggsByGrade` ~line 22032). So the stale `secondary_grade`
kept the BOM in mixed mode even though the visible UI showed single.

**Fix.** Both onchange handlers
(`_t12h_onEggInputTypeChange` and `_t12h_onEggMixedChange`) now clear the
hidden `data-f="secondary_grade"` and `data-f="min_primary"` inputs
when leaving the Graded+Mixed state. A small pure helper
`_t12h_shouldShowMixedFields(type, mixed)` and a DOM patch helper
`_t12h_clearLeftoverEggFields()` were added; both are exposed globally.

**Diff:** 1 anchored edit, +1,186 bytes. `node --check` clean on all 9
inline blocks.

**Pre-fix MD5:** `c033e6fe8b8ad2cb0176d14c04058a87`
**Post-fix MD5:** `b70e265e7a38b7cacaf6650f01c5fa88`

**New harness `_archive/closeouts/UAT_TASK12H_untickfix_harness.js`:** **10 / 10
PASS**, including a demo-bug case proving the stale-secondary path WAS
producing a 2-line mixed BOM, and a fix-verify case proving the cleared
state produces a 1-line single BOM. **All prior harnesses still green**
(13A-1A 18/18, 13A-1C 5/5, 13A-1E 18/18, 13A-2 12/12, 12H prior 32/32).

**Operator follow-up:**
- Open a GRADED_MIX item, untick Mixed → secondary grade + min primary
  inputs disappear AND clear; the BOM preview (and Daily Plan BOM) now
  shows a **single** egg line for that SKU.
- Re-ticking Mixed re-shows the inputs blank — the operator enters new
  values; data is not auto-restored (consistent with the brief's
  "no graded-mix fields unless required" rule).

**Rollback:** the same backup file
`_archive/index-pre-task12h-egguicleanup-20260528.html` rolls back the
full Task 12H sprint including this fix-up.
