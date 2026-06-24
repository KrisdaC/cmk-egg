# UAT Task 8C-2 (clarification) — Basket Unit from Selected Item + Locked Basket Row — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `b1854761d951d79825697162f3e8132e`
**Post-edit app MD5:** `94498c0fb7004362a255064fde970e16`
**Rollback:** `cp _archive/index-pre-bom-basketunit-20260525.html app/index.html`

A refinement to Basket Profile (8C-2): the basket BOM line's unit now comes from
the selected basket Item's own base unit, and the basket row in the BOM table is
locked (Basket Profile owns it). Display / data-meaning cleanup only.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored splices: (1) 8C-2 block — added `_bomResolveBasketUnit`, `_bomSelectBasketSku` writes the item-derived unit, Basket Profile qty uses it; (2) basket section of `buildBomComponentLinesForItem` — line unit resolved from the basket Item, basket rows `editable:false`. |
| `_archive/index-pre-bom-basketunit-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8C2R_BASKET_UNIT_CLOSEOUT.md` | NEW — this file. |

`oms-production/`, `openEditItem`, `validateMasterItem`, Orders, Daily Planning,
Daily Plan BOM, ใบน้อย, Logistics, Dispatch, Inventory — untouched. No master-data
JSON change. No BUG_LOG change (no new risk).

## B. The seven clarification points

1. **`basket_type` is optional metadata** — already satisfied. `basket_type` is a
   free-text field shown only on PACKAGING basket Items (Identity section); it is
   not required, and the Basket Profile code never reads it. Basket identity comes
   from the basket SKU + Item name. No change needed.
2. **Basket unit from the selected Item** — `_bomSelectBasketSku` now sets the
   component's `unit` from the basket Item's base unit (see C/E), not a hard-coded
   `ใบ`.
3. **Basket BOM row is locked** — the basket line in the BOM Components table is
   now `editable:false`; its Source is "Basket Profile" and its badge reads "📋
   ที่ Basket Profile" — the operator edits it in Basket Profile, not in BOM.
4. **Basket qty** = `selling_unit_base_factor ÷ FG.units.base_per_basket` —
   already correct (via `calculateBasketRequirementFromItem`). No change.
5. **Basket row unit** = the basket Item's `units.base_unit` / `base_unit`,
   fallback `ใบ` — implemented via `_bomResolveBasketUnit` (see E).
6. **No separate basket selector in BOM** — already satisfied by 8C-2; the
   selector lives only in Basket Profile. No change.
7. **No automatic mutation / no Daily Plan / Orders / etc. change** — honoured;
   see G.

## C. New helper — `_bomResolveBasketUnit(sku, fallback)`

Looks up a basket Item by SKU and returns `item.units.base_unit` (or top-level
`item.base_unit`); if the Item is missing or has no base unit, it returns the
fallback, ultimately `ใบ`. Pure; read-only.

## D. Locked basket BOM row

`buildBomComponentLinesForItem` now sets `editable:false` on every basket line
(cases A/B/C). The line still shows Source = "Basket Profile" and the
"📋 ที่ Basket Profile" badge — so the BOM Components table presents the basket
row as read-only and points the operator to Basket Profile to change it. Egg
lines and the non-basket component lines are unaffected.

## E. How the basket unit is now derived

- **On selection** — `_bomSelectBasketSku` writes `row.unit = _bomResolveBasketUnit(sku, 'ใบ')`,
  i.e. the chosen basket Item's own base unit.
- **On display** — the basket line in `buildBomComponentLinesForItem` resolves
  its unit with `_bomResolveBasketUnit(component_sku, c.unit || 'ใบ')`, so the BOM
  table reflects the Item's current base unit even for an imported component
  whose stored `unit` is stale. The stored value is used only as a fallback if
  the Item can't be found; nothing is written back.
- **Basket Profile** — the "Basket qty per selling unit" line shows the same
  resolved unit.

With the current master data all five basket Items have `units.base_unit = "ใบ"`,
so the visible unit stays `ใบ` today — but it is now correctly derived rather
than hard-coded, so a basket Item with a different base unit will display right.

## F. Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU → Basket Profile.

| # | Step | Expected |
|---|------|----------|
| F1 | Select a basket SKU | The basket component's unit = that basket Item's base unit |
| F2 | Open the BOM section | The basket line shows that unit, Source = Basket Profile |
| F3 | Look at the basket row's status column | "📋 ที่ Basket Profile" — read-only, edited in Basket Profile |
| F4 | A basket Item with no base unit | The basket line unit falls back to ใบ |
| F5 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## G. Confirmations

- **No automatic mutation of existing basket data** — `_bomResolveBasketUnit` and
  the display path are read-only; verified `MASTER_V3.items` is byte-identical
  after select + build. `_bomSelectBasketSku` writes only on an explicit user
  selection, into the working copy, persisted only on a normal Save.
- **No full packaging BOM, no bulk upload, no generic editor.**
- **No Daily Plan BOM / Orders / Daily Planning / ใบน้อย / Logistics / Dispatch /
  Inventory change.** `basket_type` not used for BOM calculation or FG basket
  selection.

## H. Final verdict — tests run

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +4/+4, `()` +26/+26, `[]` +3/+3);
imbalance offsets unchanged vs backup (braces 0, parens −35, brackets 0);
backticks 1206 (even, unchanged); `_bomResolveBasketUnit` defined once;
`renderPlanBom`, `safeSet`, `validateMasterItem` intact.

Functional checks passed — **17/17** Node acceptance-test harness:
`_bomResolveBasketUnit` reads `units.base_unit`, top-level `base_unit`, and falls
back to ใบ; selecting a basket SKU writes the Item's base unit (อัน / ใบ);
the basket BOM line is `editable:false` with a Basket-Profile badge; the BOM
display unit is resolved from the Item even when the stored component unit is
stale; the Basket Profile qty line uses the resolved unit; `MASTER_V3` is not
mutated; Daily Plan / Task-1 helpers intact.
