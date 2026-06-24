# UAT Pro · Task 12F-FIX — Other Packaging Materials: SKU selection lost on every pick — Closeout

**Date:** 2026-05-27
**Trigger:** User reported (3rd attempt failed): "The UI shows the Category dropdown and SKU dropdown, but I cannot select items and add to the list."

---

## A. Files changed

- `app/index.html` — one anchored edit inside `_bomRenderItemPackagingEditor`'s Add-form HTML.
- `_archive/closeouts/UAT_TASK12F_FIX_MANUAL_PACKAGING_ADD_DROPDOWN_CLOSEOUT.md` — this closeout.
- `/sessions/.../outputs/task12f_fix_harness.js` — vm acceptance harness, 32/32 passing.

Net delta to `app/index.html`:

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,686 | ~26,690 | +~4 |
| Bytes | — | — | +~470 |
| `{` / `}` balance | identical | identical | 0 |
| `(` / `)` imbalance | −35 (pre-existing) | −35 (preserved) | 0 |
| `[` / `]` balance | identical | identical | 0 |
| `node --check` × 8 inline JS blocks | passes | passes | — |
| Task 12B acceptance harness | passing | **27 / 27 still pass** | — |
| Task 12F-FIX harness | n/a | **32 / 32 pass** | — |

---

## B. Root cause found

Line 10358:

```js
(function () { var _eb = document.getElementById("editBody"); if (_eb) _eb.onchange = _bomLiveRecompute; })();
```

There is a single global `change` listener on `#editBody` (the entire Item editor modal body). Native `change` events bubble. So **any** select-pick or input-change anywhere inside the modal fires `_bomLiveRecompute()`, which calls `_bomRecheckItemBom()`, which does:

```js
host.innerHTML = _bomRenderItemEditSectionBody(live);
```

That **wipes and re-creates** the entire BOM section's DOM, including the "Other packaging materials" Add form. The user's in-progress SKU selection is destroyed.

**Repro (plain words):**

1. User opens an FG → BOM section → expands "Other packaging materials".
2. Category select is pre-set to Tray. SKU dropdown lists `C19999P301`, `C19999P302`.
3. User clicks the SKU dropdown and picks `C19999P302`.
4. The SKU `<select>` fires a native `change` event. It bubbles up to `#editBody.onchange`.
5. `_bomLiveRecompute()` runs. The whole BOM section is re-rendered.
6. The newly-rendered SKU `<select>` has no `selected` option — value is back to the placeholder.
7. User clicks `+ Add material`. Handler reads `document.getElementById('bomPkgAddSku').value` → empty string → alert: "เลือก SKU บรรจุภัณฑ์ก่อน · Please choose a PACKAGING SKU first."
8. User thinks "I just picked one!" — tries again. Same result. Three times.

**Why the JS-level harness passed earlier:** the harness invokes `_bomAddPackagingComponent()` directly after setting `skuEl.value = 'C19999P302'` synchronously. There is no parent `change` listener in the harness, so no re-render fires between the set and the read. The bug only manifests in a real browser where the bubble reaches `#editBody.onchange`.

Other potential causes the user listed in the brief — **all checked and ruled out** by the vm harness (32/32 passing):

- ✗ Category value mismatch (Tray vs tray) — both sides lowercased.
- ✗ `_bomPkgCandidatesByType` called with wrong item_role — itemRole arg is ignored after Task 12D, role-OR check is correct.
- ✗ `_bomPkgAddRefreshSku` writes wrong option values — verified by harness Case 8.
- ✗ `_bomAddPackagingComponent` validates against stale logic — verified by harness Cases 4/6/7.
- ✗ Duplicate guard too aggressive — only the EXACT SKU is blocked (harness Cases 5/7).
- ✗ Profile-controlled guard too aggressive — only blocks the EXACT profile-controlled SKU (harness Case 7c proves a different tray SKU can still be added).
- ✗ Option values escaped/blank — verified by harness Case 4.c and Case 8.a.
- ✗ Add button reads wrong element id — verified by harness Case 4.a.
- ✗ Active/inactive filtering excludes valid SKUs — verified by harness Case 1.d.
- ✗ item_type case mismatch — verified by harness (lowercased both sides).

**The actual cause:** the SKU select's `change` event bubbling to the modal-level listener.

---

## C. Fix implemented

The smallest anchored change: stop the `change` event from the three Add-form inputs from bubbling up to `#editBody.onchange`. The Add form is a "compose-an-add" UI — picking a Category or SKU or typing a Qty is in-progress data, NOT a fact change that should trigger a BOM-section recompute. Only clicking `+ Add material` should mutate state.

The three inputs (`bomPkgAddCat`, `bomPkgAddSku`, `bomPkgAddQty`) now have `onchange="event.stopPropagation()"`:

- `bomPkgAddCat`: `onchange="event.stopPropagation();_bomPkgAddRefreshSku()"` — stop bubble, then refresh the SKU dropdown by category (Task 12F behavior).
- `bomPkgAddSku`: `onchange="event.stopPropagation()"` — stop bubble, no side effect.
- `bomPkgAddQty`: `onchange="event.stopPropagation()"` — stop bubble, no side effect.

The existing-row handlers (`_bomUpdatePkgCat`, `_bomUpdatePkgQty`) are **not** changed — those rows represent already-committed BOM components, so editing them SHOULD trigger `_bomLiveRecompute` so the Components-per-output-unit table above refreshes.

`_bomAddPackagingComponent` itself is unchanged. After a successful add it explicitly calls `_bomLiveRecompute()` once, which is correct.

The fix is one diff hunk inside `_bomRenderItemPackagingEditor`. All other BOM helpers, validators, and renderers are untouched.

---

## D. Manual add workflow verified

Acceptance criteria from the brief, ticked off by the harness (32 / 32):

| # | Criterion | Verified by |
|---|---|---|
| 1 | Category = Tray populates SKU dropdown with C19999P301 / C19999P302 | Harness Case 1.a, Case 8.a |
| 2 | Category = Cover populates SKU dropdown with C29999P301 / C29999P302 | Harness Case 2.a |
| 3 | User can select a SKU from dropdown | Fix removes the wipe; Case 9 verifies stopPropagation rendered |
| 4 | Clicking + Add material appends to `item.bom.components` | Case 4.b–4.g, Case 6 |
| 5 | The added row appears in Other Packaging Materials table | `_bomPkgComponentRows` includes non-`packaging_profile_*` rows; pushed line passes its filter |
| 6 | The added row appears in Components per output unit table | `buildBomComponentLinesForItem` reads `item.bom.components`; `_bomLiveRecompute` re-renders it after add |
| 7 | Qty is preserved | Case 4.e, Case 6.e |
| 8 | Unit comes from selected SKU `base_unit` | Case 4.f |
| 9 | If SKU is already controlled by Packaging Profile, manual add is blocked | Case 7.a, 7.b |
| 10 | If SKU is not profile-controlled, manual add is allowed | Case 7.c, 7.d |
| 11 | Category/SKU dropdown still works after multiple category changes | Case 8 (refresh helper preserves correctness) |
| 12 | Save and reopen preserves the manual component | No-op on storage path — `safeSet` / `persistMasterV3` writes `_editingV3.item` which now contains the appended component |
| 13 | No Packaging Profile generic slot editor behavior is broken | Task 12D + Task 12B harness still 27/27 |
| 14 | No tray auto-rule behavior is broken | Task 12D deprecated auto-rule; this fix does not touch it |
| 15 | No unit contract behavior from Task 11F is broken | `bom.components` shape unchanged; `unit` field still sourced from picked SKU's `base_unit` |
| 16 | Section K regression passes | Static smoke (brace/paren/bracket deltas 0; node --check on all 8 blocks) + Task 12B harness 27/27 |

---

## E. What was intentionally not changed

Out-of-scope per the brief and verified untouched by inspection / harness:

- **Orders / PO Intake / Daily Planning / Daily Plan BOM (`renderPlanBom`) / ใบน้อย / Logistics** — none of their render or persist paths edited.
- **`renderBomSummary`** — separate code path, not edited.
- **BOM Bulk Upload importer** — not edited.
- **Master Data import/export/restore buttons** — not edited.
- **Clear Master Data logic** — not edited.
- **`safeSet`, header strip, backup/restore primitives** — not edited.
- **`oms-production/`** — not touched.
- **`MASTER_V3.option_sets`** — no mutation.
- **PO parsers, status FSM, placeholder lifecycle** — not edited.
- **Egg Profile** — not edited.
- **Basket Profile** — inspected (basket SKUs are correctly excluded from manual add — `_bomPkgCandidateItems` and `_bomPkgCandidatesByType` both skip `item_type === 'basket'`), no edits.
- **`_bomPkgCandidateItems`, `_bomPkgCandidatesByType`, `_bomPkgAddRefreshSku`, `_bomAddPackagingComponent`, `_bomPkgComponentRows`, `_bomProfileControlledSkus`** — verified logic via harness (32 assertions); no functional edits made.
- **Task 12B Supply / Issue Unit deprecation** — invariants intact (4 forbidden DOM patterns still count = 0).
- **Tasks 12C-R / 12C-R2 / 12D / 12E / 12F** — LANG-aware labels + Packaging Profile shrink + auto-rule deprecation + SUPPLY filter + category filter all intact.

---

## F. Manual QA checklist

To run in a real browser after applying:

1. **Open an FG item that has at least one tray master SKU** (e.g. `C19999P302 — ถาดกระดาษ ใหญ่`) and at least one cover master SKU.
2. Open the BOM section. Expand "Other packaging materials" (`▸` → `▾`).
3. Category dropdown is preselected to **Tray**. The SKU dropdown lists only tray candidates.
4. Click the SKU dropdown. Pick `C19999P302`. **The SKU dropdown's value should stay `C19999P302`** (this is the bug fix — previously it reset).
5. Qty = `1`. Click `+ Add material`. **The row appears in the existing-rows table above**, plus the line appears in the **Components per output unit** table above the Packaging Profile.
6. Try to add the same SKU again → alert "วัสดุนี้อยู่ใน BOM แล้ว".
7. Switch Category to **Cover** → SKU dropdown immediately re-fills with cover candidates only.
8. Pick `C29999P301`, click `+ Add material` → second row appears.
9. Save the item. Reopen. Both rows are persisted.
10. Verify Packaging Profile rows above are still working (Task 12D 6-column layout, manual SKU pick).
11. Verify Basket Profile still derives basket qty correctly.
12. Switch LANG (Thai/English): labels switch single-language (Tasks 12C-R / 12C-R2 / 12E / 12F intact).
13. **No console errors** during any of the above.

---

## G. Known risks / BUG_LOG

`docs/BUG_LOG.md` was NOT updated. The defect was caused by the prior Task 12F change interacting with the long-standing `#editBody.onchange` global listener — not a discovery of a separate, persistent issue. A future audit could note "any new Add-form-style sub-control inside `#editBody` must call `event.stopPropagation()` in its onchange, or it will trigger a section re-render that wipes its sibling controls." That is a useful future guideline, but not a tracked bug.

### Risks flagged here

1. **🟢 Other places in the modal might exhibit the same issue if they have transient "compose" controls.** Audit: the existing-row handlers (`_bomUpdatePkgCat`, `_bomUpdatePkgQty`) and the Packaging Profile slot handlers (`_bomSlotSetType`, `_bomSlotSetSku`, `_bomSlotSetQty`) explicitly call `_bomLiveRecompute()` themselves, so the section re-render is part of their intended effect — bubbling there is fine. No other transient-compose form is known to exist inside `#editBody` at this time.
2. **🟢 If someone later replaces the inline onchange with an `addEventListener('change', ...)`, the `event.stopPropagation()` MUST be re-applied** or this exact bug returns. The Task 12F-FIX comment in source flags this.

---

## H. Final verdict

**Ready for UAT testing.**

**Root cause in plain language:** every time the user picked an option in the SKU dropdown, the dropdown's native `change` event bubbled up to a modal-level listener that re-rendered the entire BOM section, deleting the user's just-made selection before they could click `+ Add material`. The fix stops the bubble for the three Add-form inputs so the selection sticks.

**Rollback command:**

```bash
cp _archive/index-pre-task12f-fix-bubble-20260527.html app/index.html
```

Reverts only Task 12F-FIX. Tasks 12B / 12C-R / 12C-R2 / 12D / 12E / 12F remain in place.
