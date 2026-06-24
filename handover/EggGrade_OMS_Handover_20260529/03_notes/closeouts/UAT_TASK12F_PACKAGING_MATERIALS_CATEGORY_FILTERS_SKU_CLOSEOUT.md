# UAT Pro · Task 12F — Packaging materials editor: Category filters SKU — Closeout

**Date:** 2026-05-27
**Trigger:** User screenshot reported "1. category cannot be selected / 2. SKU cannot be selected". Root cause was a UX mismatch — Category was metadata-only and did NOT filter the SKU dropdown, so the SKU list showed every PACKAGING+SUPPLY non-basket item regardless of the Category selection. Operator workflow expected Category → filter SKU → pick SKU (matching the Packaging Profile pattern). Both dropdowns were always selectable in HTML terms, but the Category had no visible effect.

**Fix:**
- The Category select now has an `onchange="_bomPkgAddRefreshSku()"` handler.
- The new `_bomPkgAddRefreshSku()` helper rebuilds the SKU dropdown options by calling `_bomPkgCandidatesByType(null, category, prev)` — items where role is PACKAGING or SUPPLY AND `item_type === category`.
- Initial render of the Add form filters by the first Category (`tray`), so the SKU list starts narrow rather than dumping every eligible item.

**Out of scope:** stored data shape, BOM math, Daily Plan BOM, Orders / Planning / Logistics / PO Intake, `option_sets`, `oms-production/`, Task 12B Supply Unit deprecation.

---

## A. Backup

- **Backup file:** `_archive/index-pre-task12f-pkgmat-categoryfilter-20260527.html`
- **Pre-edit MD5:** `c885ab4e8d47c458abb5273b87ba7382` (post-Task-12E state)
- **Post-edit MD5:** `c868c799b932212c82506ef0e6306044`

**Rollback:**

```bash
cp _archive/index-pre-task12f-pkgmat-categoryfilter-20260527.html app/index.html
```

---

## B. Sections / functions changed

Two anchored edits:

1. **`_bomRenderItemPackagingEditor` Add-form branch** (~line 23932) — Category select now carries `onchange="_bomPkgAddRefreshSku()"`. Initial Category is preselected to the first `_BOM_PKG_CATEGORIES` entry (`tray`). The initial SKU dropdown is filtered by that category (uses `_bomPkgCandidatesByType(null, _initCat, '')`) rather than dumping all `cands`.
2. **New helper `_bomPkgAddRefreshSku()`** inserted right above `_bomAddPackagingComponent()` (~line 23960). Reads the Category select value, rebuilds the SKU select's options based on it, preserves the previously-selected SKU if it still matches the new filter, else clears to placeholder.

Net delta:

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,644 | 26,686 | +42 |
| Bytes | ~1,584,300 | ~1,587,500 | +~3,200 |
| `{` / `}` balance | identical | identical | 0 |
| `(` / `)` imbalance | −35 (pre-existing) | −35 (preserved) | 0 |
| `[` / `]` balance | identical | identical | 0 |
| `node --check` × 8 inline JS blocks | n/a | passes | — |
| Task 12B acceptance harness | passing | **27 / 27 pass** | — |

---

## C. Operator-visible result

### Before (the screenshot)

- Open Item editor → BOM section → "Packaging materials".
- Category dropdown defaults to `Tray`.
- SKU dropdown shows **every** PACKAGING or SUPPLY non-basket item: `C19999P301 — ถาดกระดาษ เล็ก`, `C19999P302 — ถาดกระดาษ ใหญ่`, `C29999P301 — ฝาครอบ 30 เล็ก`, `C29999P302 — ฝาครอบ 30 ใหญ่`.
- Changing Category does nothing visible — the SKU list never narrows. Operator concludes "Category cannot be selected".
- Operator wants to filter to just trays or just covers; cannot.

### After

- Open Item editor → BOM section → "Packaging materials".
- Category dropdown defaults to `Tray`; SKU dropdown shows ONLY tray items (`C19999P301`, `C19999P302`).
- Operator changes Category to `Cover`; SKU dropdown immediately refreshes to ONLY cover items (`C29999P301`, `C29999P302`).
- Operator picks an SKU, enters Qty, clicks `+ Add material` — line appears in the table above.
- If the operator's previously-selected SKU still matches the new category filter, it stays selected; otherwise the SKU dropdown returns to its placeholder.

### Workflow now matches the Packaging Profile pattern

The Packaging Profile (Task 12D) shows: Slot → Item type → Component SKU (filtered by type). The Packaging materials editor (Task 12F) now shows: Category → SKU (filtered by category, where category IS `item_type`). Same mental model, same filtering rule, same candidate pool (`_bomPkgCandidatesByType`).

---

## D. What did not change

- **No stored data shape changes.** `_bomAddPackagingComponent` still writes the same `bom.components[]` line shape; `component_role` is still set from the Category code.
- **No BOM math changes.** Confirmed by harness §E.
- **`_bomPkgCandidateItems()`** (the gate-keeper that decides whether to render the Add form vs the empty-state warning) is unchanged — it still returns all PACKAGING/SUPPLY non-basket items globally (Task 12E behavior). Only the Add-form's per-category filtering changed.
- **`_bomPkgCandidatesByType`** (the per-`item_type` filter from Task 12D) is reused as-is.
- **Existing rows** in the Packaging materials table (rendered by the "A. Existing packaging rows" branch above the Add form) — no change. Their Category dropdown still updates `component_role` via `_bomUpdatePkgCat`, independent of this filter logic.
- **Packaging Profile** (the table above this editor) — unchanged. Task 12D's 6-column layout and auto-rule deprecation remain.
- **Task 12B Supply Unit deprecation, Tasks 12C-R / 12C-R2 / 12D / 12E** — all intact. Harness 27/27.
- **`renderPlanBom`, `MASTER_V3.option_sets`, `oms-production/`** — untouched.

---

## E. QA / smoke check

### Static checks (all green)

| Check | Result |
|---|---|
| `{` / `}` delta vs pre-task backup | **0** |
| `(` / `)` delta vs pre-task backup | **0** (pre-existing −35 preserved) |
| `[` / `]` delta vs pre-task backup | **0** |
| `node --check` on all 8 inline JS blocks | **all pass** |
| New `function _bomPkgAddRefreshSku()` definition | **count = 1** |
| Category select carries `onchange="_bomPkgAddRefreshSku()"` | **count = 1** |
| Task 12B forbidden DOM patterns | **count = 0** |
| Task 12B acceptance harness | **27 / 27 pass** |

### Recommended visual spot-check

1. Open any FG SKU → BOM section → "Packaging materials" (expand the `<details>` if collapsed).
2. **Initial state:** Category = Tray; SKU dropdown shows only tray items.
3. Change Category to Cover → SKU dropdown now shows only cover items. Change to Label → only labels. Change to "Other" → SKU list may be empty if no items have `item_type='other'`.
4. With Category = Tray, pick `C19999P302 — ถาดกระดาษ ใหญ่`, set Qty = 1, click `+ Add material`. A new row appears in the table above with category `Tray`, name "ถาดกระดาษ ใหญ่", qty 1, unit `ใบ`.
5. Try to add the same SKU again: blocked by the duplicate-detection alert (`This material is already on the BOM`).
6. Switch LANG (Thai/English): the placeholder and labels switch single-language.
7. **The Packaging Profile section above** is unaffected — its 6-column layout and slot-by-slot SKU dropdowns (Task 12D) continue to work.

---

## F. Known risks / BUG_LOG

`docs/BUG_LOG.md` was NOT updated. The screenshot complaint was a UX mismatch, not a defect in the strict sense — both selects were always functionally selectable in HTML. This task closes the mismatch.

### Risks flagged

1. **🟢 Category = "Other" may show an empty SKU list.** If no master items carry `item_type='other'`, the dropdown is empty for that category. By design — operator picks a different category or creates a master item with the right type.
2. **🟢 SKU selection is not preserved across BOM-section re-renders.** If a parent re-render fires while the operator has a Category/SKU selection in progress (but before clicking `+ Add material`), the Add form rebuilds and the selection is lost. This matches the prior behavior — the Add form is part of the renderable BOM section. Future micro-pass could stash in-progress selections in module state if operators report it.
3. **🟢 The `_bomPkgCandidateItems()` global gate-keeper still excludes baskets.** If an operator wants to add a basket SKU as an "other" material, that route is intentionally blocked — basket SKUs are owned by the Basket Profile. No change here.

---

## G. Rollback command

```bash
cp _archive/index-pre-task12f-pkgmat-categoryfilter-20260527.html app/index.html
```

Reverts only Task 12F. Tasks 12B / 12C-R / 12C-R2 / 12D / 12E remain.

---

## H. Final verdict

**Ready for UAT testing.**

The "Packaging materials" Add form now filters the SKU dropdown by Category. Category=Tray → only trays. Category=Cover → only covers. Operator workflow matches the Packaging Profile pattern. Static checks green; Task 12B harness still 27/27.
