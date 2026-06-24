# UAT Pro · Task 12G — Drop Category from manual Packaging materials — Closeout

**Date:** 2026-05-27
**Trigger:** User: "category no need.... just need the dropdown to select from supply and packaging"

## A. Files changed
- `app/index.html` — 4 anchored edits in `_bomRenderItemPackagingEditor` and `_bomAddPackagingComponent`.

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | — | — | small |
| `{` `}` balance | identical | identical | 0 |
| `(` `)` imbalance | −35 | −35 | 0 |
| `[` `]` balance | identical | identical | 0 |
| `node --check` × 8 inline JS blocks | passes | passes | — |
| Task 12B harness | passing | **27/27 still pass** | — |
| Task 12F-FIX harness | 32/32 | **39/39 pass** (new cases 9.d–f, 10.a–d) | — |

**Backup:** `_archive/index-pre-task12g-drop-category-20260527.html` (pre-MD5 `fbd94110f6bdd5c1db0883fe4f2b9478`). Post-MD5 `bc0f7cd26d1570b2a0e788953afc1b3e`.

## B. Root cause / decision
Category was redundant — the operator already picks the SKU from master, and the SKU has its own `item_type`. The user wanted to drop it entirely. `component_role` is now derived automatically from the picked SKU's `item_type`.

## C. Fix implemented
- **Existing-rows table:** the Category `<th>` and per-row Category `<td>` were removed. Columns are now Material · Qty / output · Unit · (Remove).
- **Add form:** the Category `<select id="bomPkgAddCat">` was removed. Inputs are now SKU · Qty · `+ Add material`.
- **SKU dropdown:** populated directly from `_bomPkgCandidateItems()` — the full PACKAGING + SUPPLY non-basket non-placeholder list (no item_type filter).
- **`_bomAddPackagingComponent`:** derives `component_role` from `picked.item_type` (lowercased), falls back to the legacy `cat` read if it ever returns, then `'other'`.

Dead code intentionally retained for back-compat:
- `_BOM_PKG_CATEGORIES` (the 6-entry category list)
- `_bomPkgAddRefreshSku()` (used only by the now-removed onchange)
- `_bomUpdatePkgCat()` (used only by the now-removed row select)
- `_bomPkgCategoryLabel()` (still useful for any pre-existing imported category code)
- `_bomPkgCandidatesByType()` (still used by the Packaging Profile rows from Task 12D)

## D. Manual add workflow verified

Harness 39/39 pass. Specifically:
- 4: Empty BOM → pick SKU → click Add → component appended with `component_role` derived from SKU's `item_type`.
- 6: Two different SKUs added (one tray, one cover) — both succeed.
- 9.a: No `bomPkgAddCat` rendered.
- 9.d: SKU dropdown lists all PACKAGING+SUPPLY non-basket SKUs in one combined list.
- 9.f: Existing-rows thead has no Category `<th>`.
- 10: With no `bomPkgAddCat` element in DOM, adding a cover SKU produces `component_role: 'cover'` automatically.

## E. What was intentionally not changed
- Stored data shape (`bom.components[]` fields untouched; existing rows' `component_role` values preserved on storage).
- BOM math, Daily Plan BOM, Orders, Planning, Logistics, PO parsers, `safeSet`, `option_sets`, `oms-production/`.
- Task 12B Supply Unit deprecation invariants (4 forbidden DOM patterns still count = 0).
- Earlier UI tasks (12C-R / 12C-R2 / 12D / 12E / 12F / 12F-FIX) all intact.
- Packaging Profile (the table above the manual editor) — unchanged.

## F. Manual QA
1. Open an FG → BOM → expand "Other packaging materials".
2. Confirm columns are only Material · Qty / output · Unit · (Remove). No Category column.
3. Confirm Add form has only SKU · Qty · `+ Add material`. No Category dropdown.
4. SKU dropdown lists all PACKAGING + SUPPLY non-basket items (trays + covers + supply pack-material + labels + stickers, etc.) in one combined list.
5. Pick C19999P302 (tray) → Qty 1 → `+ Add material` → row appears in table; `component_role` saved as `tray`.
6. Pick C29999P301 (cover) → Qty 1 → `+ Add material` → 2nd row appears; `component_role` saved as `cover`.
7. Save and reopen → both rows persist.
8. Packaging Profile section above untouched (6 columns from Task 12D).
9. No console errors. LANG toggle still works.

## G. Known risks
- BUG_LOG not updated (UI simplification, no defect).
- Existing items with a `component_role` outside `_BOM_PKG_CATEGORIES` (e.g., legacy imports) display normally; the role is just stored data now, no longer editable from this UI. If operators need to rename or fix categories on existing rows, that's a separate data-cleanup task.

## H. Final verdict
**Ready for UAT testing.**
**Rollback:** `cp _archive/index-pre-task12g-drop-category-20260527.html app/index.html`
