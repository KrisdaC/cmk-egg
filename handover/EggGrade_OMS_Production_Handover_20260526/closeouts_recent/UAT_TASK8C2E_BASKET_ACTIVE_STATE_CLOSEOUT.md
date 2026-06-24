# UAT Task 8C-2E — Basket Profile Active-State Fix — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `72b81a4349a38adb1bd4dccd7691387e`
**Post-edit app MD5:** `d340f2521bb7f759e00e9021d829c012`
**Rollback:** `cp _archive/index-pre-bom-basketactive-20260525.html app/index.html`

A targeted bug fix for two UAT failures: (1) changing `selling_unit` away from
ตะกร้า broke the basket BOM line, and (2) unchecking "Uses basket" still failed
BOM status. Three anchored edits in the Item-edit BOM module. No data change, no
Daily Plan / Orders / Logistics change, no basket data deleted.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 3 anchored edits — all in the Master Data Item-edit BOM module: (1) `buildBomComponentLinesForItem` basket section rewritten — Case A made conversion-authoritative, Case C deleted; (2) `_bomBasketProfileStatus` no longer fails when basket is inactive; (3) `_bomRenderBasketProfileBody` adds a "preserved but inactive" note. |
| `_archive/index-pre-bom-basketactive-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8C2E_BASKET_ACTIVE_STATE_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | +1 row in the Closed section (`UAT-041`). |

`oms-production/`, `normalizeItemUnits`, `_readEditForm`, `_bomSelectBasketSku`,
`_bomItemReadiness`, `openEditItem`, `validateMasterItem`, Orders, Daily Planning,
Daily Plan BOM (`renderPlanBom`), legacy BOM Summary (`renderBomSummary`), ใบน้อย,
Logistics, Dispatch, Inventory — untouched. No master-data JSON change.

## B. The two bugs

**Bug 1 — change selling unit away from ตะกร้า → basket BOM fails.**
`_bomSelectBasketSku` stamps the basket component's `qty_per_selling_unit` with
the conversion result *at the moment the SKU is picked*. If the SKU was chosen
while `selling_unit = ตะกร้า`, the stored qty is `1`. The operator then changes
`selling_unit` to ฟอง (or ถาด). `buildBomComponentLinesForItem` **Case A**
recomputed the conversion correctly (1/180) but then compared it against the
stale stored `1`, found a mismatch, and set `needs_review = true` with
"stored qty differs from basket conversion" — so BOM status failed even though
the conversion itself was perfectly fine.

**Bug 2 — uncheck "Uses basket" → BOM still fails.**
`buildBomComponentLinesForItem` had a **Case C**: "basket component exists but no
basket conversion → emit the line anyway with `needs_review = true` and
'basket conversion missing'." When the operator unchecked "Uses basket"
(`has_basket_unit = false`), the stored basket component was still in
`item.bom.components`, so Case C fired and produced an **active failing line** for
a basket the operator had deliberately turned off. `_bomItemReadiness`'s
"All component lines complete" check counted that line, so BOM status failed.
`_bomBasketProfileStatus` separately returned `ok:false`
("basket component exists but Uses basket is off") — a second false failure.

**Root cause, both:** there was no real *active vs inactive* concept for the
basket. A stored basket component was always treated as active, and a stored qty
was trusted as if the operator had typed it.

## C. The fix

**State model — one switch.** The basket is **active** only when
`normalizeItemUnits(it).has_basket_unit === true`. Everything else is **inactive**.
`normalizeItemUnits` already honours this correctly: an explicit `false` is never
re-inferred back to true (`base_per_basket` alone does NOT reactivate a basket the
operator switched off), and a missing flag is inferred from legacy data. No change
was needed in `normalizeItemUnits` or `_readEditForm`.

**Edit 1 — `buildBomComponentLinesForItem`, basket section.**
- **Case A (active basket + stored component)** — the conversion-derived quantity
  is now *authoritative*; the stored `qty_per_selling_unit` is informational only
  and is never a failure. When the conversion resolves, the line is OK
  (`needs_review = false`); if a stale stored qty differs, the note simply records
  "stored qty recalculated". The line only needs review when the conversion
  itself cannot resolve (missing `base_per_basket`, or the selling unit's base
  factor cannot be resolved).
- **Case C deleted.** An inactive basket (`has_basket_unit !== true`) now emits
  **no basket line at all**, even when a stored basket component exists. The
  component data stays untouched in `item.bom.components`.
- Case B (active conversion, no SKU chosen → "choose a basket SKU" placeholder)
  and Case D (no basket at all → no line) are unchanged.

**Edit 2 — `_bomBasketProfileStatus`.** When the basket is inactive, the status
is now `ok:true` — a benign "Basket off — stored basket SKU is preserved but
inactive" message instead of a needs-review failure.

**Edit 3 — `_bomRenderBasketProfileBody`.** When the basket is inactive but a
stored basket component still exists, a small grey note now reads
"Stored basket SKU is preserved but inactive because 'Uses basket' is off."

`_bomItemReadiness` needed no edit: once an inactive basket emits no line and an
active basket's line is `needs_review = false` when the conversion resolves, the
"All component lines complete" check self-corrects.

## D. Active vs inactive — behaviour table

| `has_basket_unit` | Stored basket comp? | BOM Components | Test Calc | BOM status | Basket Profile |
|---|---|---|---|---|---|
| `true` + conversion resolves | yes | 1 active line, qty from conversion, OK | basket line shown | not failed by basket | "complete" |
| `true`, `base_per_basket` missing | yes/no | needs-review line / placeholder | — | needs review | needs review |
| `true`, no SKU chosen | no | "choose a basket SKU" placeholder | placeholder | needs review | "basket SKU not selected" |
| `false` (operator unchecked) | yes | **no basket line** | **no basket line** | **not failed** | "preserved but inactive" note |
| `false` / absent, no basket data | no | no basket line | no basket line | not failed | "does not use a basket" |

## E. Manual QA checklist

Reload `app/index.html` in the browser first (the fix is in the file, not in any
saved data).

| # | Step | Expected |
|---|------|----------|
| F1 | Open a basket item, keep "Uses basket" checked, change `selling_unit` ตะกร้า → ฟอง | Basket BOM line stays active; qty recomputes to 1 / `base_per_basket`; no "basket conversion missing" |
| F2 | Same item, change `selling_unit` → ถาด (with `base_per_pack` set) | Basket qty = `base_per_pack` / `base_per_basket` (e.g. 30/180 = 0.1667); line OK |
| F3 | Open a basket item that has a chosen basket SKU, **uncheck** "Uses basket" | BOM Components shows no basket row; Test Calc shows no basket line; BOM status does not fail because of basket |
| F4 | After F3, the Basket Profile | Shows "basket inactive / preserved but inactive" note; the stored SKU is still listed |
| F5 | Re-check "Uses basket" | Previous basket SKU reappears as an active line; qty recalculates from the current selling unit |
| F6 | An item with no basket data at all | No basket row, no basket error anywhere |
| F7 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## F. Data safety / scope

- **No basket data deleted or rewritten.** The fix only changes how stored basket
  components are *read and displayed*. `item.bom.components` (including basket
  components), `item.units`, routes and notes are never mutated by these edits.
- An inactive basket's stored component is **preserved** — re-checking "Uses
  basket" brings it straight back as an active line.
- `_bomSelectBasketSku` still writes `qty_per_selling_unit` when a SKU is picked;
  that value is now treated as informational, so a later selling-unit change no
  longer makes it a failure.
- No calculation-engine change. `calculateBasketRequirementFromItem`,
  `convertSellingQtyToBase`, `getSellingUnitBaseFactor`, `normalizeItemUnits` are
  unchanged — the fix uses them as the canonical helpers. `item.base_per_pack`
  (the wrong path) is never read.
- All three changed functions are called only within the Item-edit BOM module
  (lines ~23009–23599). Verified by grep: no caller in `renderPlanBom`,
  `renderBomSummary`, Orders, Daily Planning, or Logistics. No Daily Plan / Orders
  / Planning / Dispatch / Inventory logic changed.

## G. Final verdict — tests run

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/bracket deltas balanced (`{}` 6730/6730, `[]` 2397/2397); imbalance offsets
unchanged vs the backup (braces 0, parens −35, brackets 0); backticks 1206 (even,
unchanged). Case C confirmed removed (`else if (basketComps.length) {` count = 0).

Functional checks passed — **23/23** Node acceptance-test harness covering all
seven spec tests: T1 selling unit ฟอง → basket qty 1/180, line active, no
"conversion missing"; T2 selling unit ถาด → basket qty 30/180 = 0.1667, line OK;
T3 uncheck "Uses basket" → no active basket line, profile status OK, no
basket-related failing readiness check, stored component preserved; T4 re-check →
basket line + previous SKU reappear, qty recalculates; T5 missing
`base_per_basket` fails only when active; T6 no-basket item → no line, no error;
T7 non-basket components still produced, no basket line leaks.

## H. Limitations

- Manual QA F1–F7 has not yet been run — static + Node acceptance tests only.
- `_bomSelectBasketSku` still stamps a stored `qty_per_selling_unit` at SKU-pick
  time. It is now harmless (treated as informational), but the field remains in
  the component shape; a future cleanup could stop writing it entirely.
- An item saved with an explicit `has_basket_unit = false` while the 8C-2 bug was
  live (see UAT-040) will correctly show as inactive — the operator re-ticks
  "Uses basket" once to reactivate it. This fix does not auto-migrate such items.
- The "preserved but inactive" note appears in the Basket Profile section; it is
  not surfaced in a separate Technical/Legacy panel. Cosmetic only.
