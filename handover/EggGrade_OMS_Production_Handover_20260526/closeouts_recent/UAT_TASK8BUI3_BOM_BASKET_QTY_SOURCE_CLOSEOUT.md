# UAT Task 8B-UI-3 — Basket Conversion as the Quantity Source — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `a0d124023516ee21bca37c87e161d77a`
**Post-edit app MD5:** `b12a6ca5fceb8a2ad5859a659d4a906b`
**Rollback:** `cp _archive/index-pre-bom-itemui5-20260525.html app/index.html`

A correction to the 8B-UI / 8B-UI-2 basket model. Display / validation cleanup
only — no calculation engine change, no Daily Plan change, no mutation of
`item.bom.components` or `item.units`.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored splices: (1) `_bomLineSourceLabel` — 2 new source tokens; (2) the basket section of `buildBomComponentLinesForItem` — reworked cases A/B/C/D. |
| `_archive/index-pre-bom-itemui5-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8BUI3_BOM_BASKET_QTY_SOURCE_CLOSEOUT.md` | NEW — this file. |

`oms-production/` untouched. Orders, Daily Planning, Daily Plan BOM, ใบน้อย,
Logistics, Dispatch, Inventory, persistence, Master Data validators — untouched.
No master-data JSON change. No BUG_LOG change (no new risk).

## B. The correction

8B-UI-2 de-duplicated basket into one row but, in case A (conversion + basket
component), it displayed the **stored component qty** and used the conversion
only as a check. The correct model:

- **Basket conversion** (`units.has_basket_unit` / `base_per_basket` in Counting
  & Units) = the **quantity source** — how many baskets are required, mathematically.
- **BOM component** (`component_role = basket`, `component_sku`) = the **material
  identity** — which basket SKU is used.

So the displayed basket qty must come from the conversion; the stored component
qty is only validated against it (and never overwritten by this UI task).

## C. Basket qty formula

`basket_qty_per_output = getSellingUnitBaseFactor(item) / normalizeItemUnits(item).base_per_basket`

This is exactly what the existing canonical helper `calculateBasketRequirementFromItem(item, 1)`
computes (via `convertSellingQtyToBase` → `getSellingUnitBaseFactor`). The builder
reuses that helper. The legacy / wrong field `item.base_per_pack` is **not read
anywhere** (verified: 0 occurrences). A fractional result (e.g. 0.1667 baskets per
ถาด) is correct at the per-output-unit level and is now accepted as a valid
conversion qty — only a conversion that cannot produce a number at all is treated
as unusable.

## D. The four display cases (in `buildBomComponentLinesForItem`)

- **Case A — conversion + basket component.** One row: component = the actual
  basket SKU/name; **qty = conversion-derived**; unit = ใบ; source =
  `bom_setup_conv` ("BOM Setup + Basket Conversion"). The stored
  `qty_per_selling_unit` is compared to the conversion qty — within 2% →
  **OK / matches basket conversion**; outside → **Needs review** with a note
  showing the stored value. If no stored qty, the conversion qty is shown and
  noted "derived from basket conversion". The stored value is never overwritten.
- **Case B — conversion, no basket component.** One placeholder row:
  "ต้องเลือก SKU ตะกร้า"; qty = conversion-derived; unit = ตะกร้า; source =
  `basket_conversion`; **Needs review — actual basket SKU missing**.
- **Case C — basket component, no conversion.** The basket SKU row is shown
  using the stored qty; **Needs review — basket conversion missing**.
- **Case D — neither.** No basket row.

There is never both a "basket quantity" row and a "basket SKU" row.

## E. Test Calculation

Test Calculation multiplies the same de-duplicated line list, so when an actual
basket SKU exists it shows only one basket line: `testQty × basket_qty_per_output`
ใบ. When the basket SKU is missing (case B) the single placeholder line shows
`testQty × basket_qty_per_output` ตะกร้า under the name "ต้องเลือก SKU ตะกร้า",
i.e. the conversion still tells the operator how many baskets are implied. No
separate "basket quantity" result row is produced.

## F. Data safety / what was NOT changed

- `item.bom.components`, `item.units`, routes, notes, legacy `bom.output_unit` —
  not mutated, not deleted (verified: render/build/test-calc leave `item.bom` and
  `item.units` byte-identical).
- No calculation engine change — `calculateBasketRequirementFromItem`,
  `getSellingUnitBaseFactor`, `convertSellingQtyToBase`, `normalizeItemUnits`
  are reused unchanged.
- No Daily Plan BOM / Orders / Planning / ใบน้อย / Logistics / Dispatch /
  Inventory change.

## G. Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU, expand BOM / สูตรผลิต.

| # | Step | Expected |
|---|------|----------|
| F1 | SKU with basket conversion **and** a basket component | One basket row — the actual SKU; qty matches the conversion; source "BOM Setup + Basket Conversion"; status OK |
| F2 | A basket SKU whose stored qty disagrees with the conversion | Row shows the **conversion** qty and is flagged Needs review |
| F3 | A basket SKU with no stored qty | Row shows the conversion qty, note "derived from basket conversion" |
| F4 | SKU with basket conversion but **no** basket component | One "ต้องเลือก SKU ตะกร้า" placeholder, Needs review |
| F5 | SKU with a basket component but **no** conversion | Basket SKU row, Needs review — basket conversion missing |
| F6 | Test Calculation, qty 100 | One basket row only (testQty × conversion qty); no separate basket-quantity row |
| F7 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## H. Final verdict

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +5/+5, `()` +6/+6, `[]` 0/0); imbalance
offsets unchanged vs backup (braces 0, parens −35, brackets 0); backticks 1206
(even, unchanged); `buildBomComponentLinesForItem` / `_bomLineSourceLabel` each
defined once; `item.base_per_pack` — 0 occurrences.

Functional checks passed — **32/32** Node acceptance-test harness: case A shows
the conversion-derived qty for whole (180/180 = 1) and fractional (30/180 =
0.1667) baskets; a stored-vs-conversion mismatch shows the conversion value and
flags Needs review; a missing stored qty falls back to the conversion; case B
placeholder, case C stored-qty + warning, case D no row; Test Calculation shows
one basket row at testQty × conversion qty; `item.bom` and `item.units` are not
mutated; Daily Plan / Task-1 helpers intact.
