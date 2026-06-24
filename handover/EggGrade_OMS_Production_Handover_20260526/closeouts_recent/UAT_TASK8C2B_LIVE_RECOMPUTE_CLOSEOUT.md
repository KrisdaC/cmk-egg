# UAT Task 8C-2B — Live BOM Recompute + Basket Profile Logic Cleanup — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `94498c0fb7004362a255064fde970e16`
**Post-edit app MD5:** `6ddb4a8257c63ac2d3171c4e7c5c566c`
**Rollback:** `cp _archive/index-pre-bom-liverecompute-20260525.html app/index.html`

A 3-point correction sprint: BOM previews recompute live from the form, the
basket BOM unit comes from the selected basket SKU, and the basket type/details
field is de-emphasized. Display / data-meaning cleanup only.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 4 anchored splices: 8C-2 block → 8C-2B (adds `_bomLiveRecompute`, reworded Basket Profile); a `change` listener wired on the edit modal; `basket_type` moved from Identity to System/Audit. |
| `_archive/index-pre-bom-liverecompute-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8C2B_LIVE_RECOMPUTE_CLOSEOUT.md` | NEW — this file. |

`oms-production/`, `validateMasterItem`, `_readEditForm`, `saveEdit`, Orders,
Daily Planning, Daily Plan BOM, ใบน้อย, Logistics, Dispatch, Inventory —
untouched. No master-data JSON change. No BUG_LOG change (no new risk).

## B. Why BOM did not update after changing Egg / Basket fields

The BOM section rendered once when the modal opened. Only the BOM "↻ Re-check"
button and the basket field handlers re-rendered it. Changing **Egg Profile** or
**Counting & Units** fields (in their own modal sections) had no handler wired,
so the BOM component lines kept showing the old egg / basket result until the
modal was closed and reopened.

## C. How BOM preview now recomputes from current form values

A single `change` listener is wired on the edit modal body
(`editBody.onchange = _bomLiveRecompute`). `change` events bubble, so **any**
field change in the modal triggers `_bomLiveRecompute()`, which re-renders both
the Basket Profile and the BOM section from `_readEditForm()` — i.e. the current,
unsaved form values — via the existing `_bomRefreshBasketProfile` and
`_bomRecheckItemBom`. The BOM component lines are pure functions of the item, so
they recompute correctly from the live draft. Nothing is persisted — Test
Calculation remains preview-only. The "↻ Re-check" buttons are kept as a manual
fallback.

## D. Which fields trigger refresh

All of them — the modal-level `change` listener covers `is_egg`,
`egg_content_type`, `primary_grade`, `secondary_grade`, `min_primary`,
`selling_unit`, `units.base_unit`, `units.pack_unit`, `units.base_per_pack`,
`units.has_basket_unit`, `units.basket_unit`, `units.base_per_basket`, and the
basket SKU select. The basket fields also keep their own inline `onchange` as a
defensive backup. One listener instead of a dozen individually-wired inputs.

## E. How the selected basket SKU is looked up & how its unit is derived

`_bomSelectBasketSku` and `_bomResolveBasketUnit` look the SKU up in
`MASTER_V3.items` (`item_role = PACKAGING`, `item_type = basket`). The basket BOM
line's **unit** is the selected basket Item's own base unit —
`selectedBasketItem.units.base_unit` (or top-level `base_unit`), falling back to
`ใบ` only when the Item has none. The **quantity** is
`selling_unit_base_factor ÷ FG.units.base_per_basket` via
`calculateBasketRequirementFromItem` (`item.base_per_pack` never read). Source =
"Basket Profile". (This was already in place from the 8C-2 clarification and is
re-confirmed here.)

## F. What happened to the basket type/details field

`basket_type` was a free-text field ("CJ - Grey, S, M…") in the prominent
**Identity** section. It is **moved** into the collapsed **System / Audit**
section, shown only for PACKAGING + basket Items, relabelled
"Basket type / description (legacy · optional)". It is not required, not on FG
items, not used in any BOM / basket-selection / unit logic. Existing values are
preserved (the field still saves via `data-f="basket_type"` — now exactly once).

## G. Confirmations

- **No data deleted.** `bom.components`, basket components, `item.units`, legacy
  `basket_type` values, routes, notes — all preserved. Verified `MASTER_V3` is
  byte-identical after select + build + render. `_bomLiveRecompute` is read-only
  re-rendering; `_bomSelectBasketSku` writes only on explicit selection.
- **No full packaging BOM, no bulk upload.**
- **No Daily Plan BOM / Orders / Daily Planning / ใบน้อย / Logistics / Dispatch /
  Inventory change.** `validateMasterItem` and the save machinery untouched.

## Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU.

| # | Step | Expected |
|---|------|----------|
| F1 | Change primary_grade (e.g. เบอร์ 3 → เบอร์ 2) | The BOM egg line updates immediately — no close/reopen |
| F2 | Change `base_per_basket` in Basket Profile | Calculated basket qty + the BOM basket line update immediately |
| F3 | Change the selected basket SKU to one with a different base unit | The BOM basket line unit updates to that SKU's base unit |
| F4 | Open an FG item | No basket type/details free-text field in the main flow |
| F5 | Open a PACKAGING item_type = basket → System / Audit | basket type/details appears as an optional legacy field |
| F6 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## H. Final verdict — tests run

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +1/+1, `()` +5/+5, `[]` 0/0); imbalance
offsets unchanged vs backup (braces 0, parens −35, brackets 0); backticks 1206
(even, unchanged); `_bomLiveRecompute` defined once, `_bomOnBasketProfileChange`
fully removed; `data-f="basket_type"` appears exactly once; `openEditItem`,
`validateMasterItem`, `renderPlanBom`, `safeSet` intact.

Functional checks passed — **20/20** Node acceptance-test harness: `_bomLiveRecompute`
is defined and safe; the BOM egg line follows the current `primary_grade` and the
basket qty follows the current `base_per_basket` (recompute proven); the edit-modal
`change` listener is wired; the basket unit is derived from the selected SKU's
base unit; the Basket Profile layout order is Uses basket → Actual basket SKU →
Basket conversion → Calculated, with the helper text; `basket_type` appears once,
relabelled legacy/optional, and the old Identity label is gone; `MASTER_V3` is
not mutated; Daily Plan / core helpers intact.

## Assumptions & limitations

- Live refresh fires on `change` (commit/blur for text & number inputs, immediate
  for selects & checkboxes) — not on every keystroke; the "↻ Re-check" buttons
  cover any gap.
- The modal `change` listener also fires on unrelated field edits — it simply
  re-renders the BOM previews identically (harmless, no persistence).
