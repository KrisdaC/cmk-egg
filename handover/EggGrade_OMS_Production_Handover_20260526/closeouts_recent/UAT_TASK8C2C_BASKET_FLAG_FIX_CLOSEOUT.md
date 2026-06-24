# UAT Task 8C-2C — Basket Profile "Uses basket" Flag Fix — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `6ddb4a8257c63ac2d3171c4e7c5c566c`
**Post-edit app MD5:** `72b81a4349a38adb1bd4dccd7691387e`
**Rollback:** `cp _archive/index-pre-bom-basketflag-20260525.html app/index.html`

A bug fix for the UAT failure "change selling unit to a non-basket unit → fails".
Two-line correction. Display/logic only — no data change, no Daily Plan / Orders.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored 1-line fixes: `_bomRenderBasketProfileBody` and `_bomBasketProfileStatus` now read the **normalized** `has_basket_unit`. |
| `_archive/index-pre-bom-basketflag-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8C2C_BASKET_FLAG_FIX_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | +1 row in the Closed section (`UAT-040`). |

`oms-production/`, `openEditItem`, `validateMasterItem`, Orders, Daily Planning,
Daily Plan BOM, ใบน้อย, Logistics, Dispatch, Inventory — untouched. No master-data
JSON change.

## B. The bug

Reported in UAT: on item **B0014**, changing the selling unit from ตะกร้า to ฟอง
left the basket BOM line stuck at qty **1 ใบ** and "basket conversion missing",
instead of recomputing to 1/180 ใบ.

**Root cause.** 29 basket items — including B0014 — store `units.base_per_basket`
and `units.basket_unit` but **no explicit `units.has_basket_unit` key**.
`normalizeItemUnits` *infers* `has_basket_unit = true` from those fields, which is
why the items work everywhere else. But the 8C-2 Basket Profile read the **raw**
`it.units.has_basket_unit` (`undefined`) for the "Uses basket" checkbox, so the
checkbox rendered **unchecked**. The moment any field changed, `_readEditForm`
read the unchecked checkbox and wrote `units.has_basket_unit = false` — turning
the inferred-true flag into an explicit false. With `has_basket_unit` now false,
`buildBomComponentLinesForItem` saw "no basket conversion", dropped the basket
line into the Case-C "conversion missing" path, and showed the stale stored
`qty_per_selling_unit` instead of recomputing.

This was a regression introduced by 8C-2: the pre-8C-2 Counting & Units checkbox
correctly used the **normalized** value; moving it into Basket Profile switched it
to the raw value.

## C. The fix

In both `_bomRenderBasketProfileBody` and `_bomBasketProfileStatus`, `usesBasket`
now reads `normalizeItemUnits(it).has_basket_unit` (the inferred value) instead of
the raw `it.units.has_basket_unit`:

- For the 29 inferred-flag items, the "Uses basket" checkbox now renders
  **checked** — matching reality. A save then records `has_basket_unit = true`
  (making the inference explicit and correct), instead of corrupting it to false.
- With the flag intact, `buildBomComponentLinesForItem` keeps the basket line on
  the Case-A path, so changing the selling unit recomputes the basket quantity
  correctly (e.g. selling ฟอง → 1/180 ใบ).
- Explicit `has_basket_unit: false` and items with no basket data still render
  unchecked — unchanged.

## D. Manual QA checklist

| # | Step | Expected |
|---|------|----------|
| F1 | Open B0014 → Basket Profile | "Uses basket" is **checked** |
| F2 | Change B0014's selling unit ตะกร้า → ฟอง | BOM basket line recomputes (≈ 0.0056 ใบ per ฟอง), not stuck at 1, not "conversion missing" |
| F3 | Change it back to ตะกร้า | Basket line returns to 1 ใบ |
| F4 | An item with no basket at all | "Uses basket" stays unchecked |
| F5 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / ใบน้อย / Logistics open normally |

## E. Data safety / scope

- **No data changed.** The fix only changes which value the UI *reads*; it
  writes nothing. Existing `item.bom.components`, `item.units`, routes, notes —
  untouched.
- An item already saved with a corrupted `has_basket_unit = false` (if any
  operator hit this before the fix) will now render its checkbox unchecked; the
  operator re-ticks "Uses basket" once to restore it. No automatic migration is
  done — flagged as a limitation below.
- No calculation engine change; `buildBomComponentLinesForItem` already used the
  normalized value and is unchanged. No Daily Plan / Orders / Logistics change.

## F. Final verdict — tests run

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +1/+1, `()` +2/+2, `[]` 0/0); imbalance
offsets unchanged vs backup (braces 0, parens −35, brackets 0); backticks 1206
(even, unchanged).

Functional checks passed — **12/12** Node acceptance-test harness: an
inferred-flag item (B0014-shaped) now renders "Uses basket" **checked**; explicit
`false` and no-basket items still render unchecked, explicit `true` checked; the
Basket Profile status no longer wrongly says "Uses basket is off"; changing the
selling unit to ฟอง recomputes the basket line to 1/180 (not the stale 1, not
"conversion missing"); selling unit ตะกร้า still yields 1; Daily Plan / core
helpers intact.

## G. Limitations

- If an operator already saved an item while the bug was live, its
  `has_basket_unit` may be an explicit `false`. The fix cannot tell that apart
  from a deliberate false, so such an item shows "Uses basket" unchecked until
  the operator re-ticks it once. A data sweep could re-infer the flag for the 29
  items if needed — out of scope here.
- The read-only basket summary in Counting & Units is rendered once at modal open
  and does not live-refresh; it is cosmetic only.
