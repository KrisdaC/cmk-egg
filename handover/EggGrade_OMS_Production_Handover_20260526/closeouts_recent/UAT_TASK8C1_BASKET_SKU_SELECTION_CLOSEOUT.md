# UAT Task 8C-1 — Basket BOM SKU Selection — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `a1e9404e65f6ebc12c19a564ce60248b`
**Post-edit app MD5:** `57f171e9fe1d8a1e366fc1d27946e722`
**Rollback:** `cp _archive/index-pre-bom-basketsku-20260525.html app/index.html`

Adds an explicit basket-SKU selector to Item edit → BOM / สูตรผลิต. This is the
first write-capable BOM editor — scoped strictly to basket. No full packaging
BOM, no bulk upload, no Daily Plan change, no inventory.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored splices: (1) added `_bomRenderBasketSelector` + `_bomSelectBasketSku`; (2) wired the selector panel in after the Components table. |
| `_archive/index-pre-bom-basketsku-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8C1_BASKET_SKU_SELECTION_CLOSEOUT.md` | NEW — this file. |

`oms-production/`, `validateMasterItem`, `openEditItem`, `_readEditForm`,
`saveEdit`, `normalizeMasterRecord`, `item.units`, Orders, Daily Planning, Daily
Plan BOM, ใบน้อย, Logistics, Dispatch, Inventory — untouched. No master-data JSON
change. No BUG_LOG change (no new risk).

## B. What current basket BOM behavior was found

Pre-task, the Item edit → BOM section was entirely display-only. Basket
components (`component_role = 'basket'`) were only ever *read* — by
`buildBomComponentLinesForItem` (the single basket row) and the raw table in
Technical details. **Nothing in the modal could create or change them.** The 30
FG items that carry a basket component all got it from the 8B-0 import
(`source: "basket_bom_master_requirements_20260521"`). Five active PACKAGING +
basket Items exist (B1BC00001/2/3, B1CJ00001, B1MK0001).

## C. How basket SKU selection was added

A compact **inline dropdown panel** (`_bomRenderBasketSelector`) renders directly
under the Components table whenever the SKU uses baskets (`has_basket_unit`) or
already carries a basket component. It shows the current basket SKU and a
`<select>` of the PACKAGING + basket Items (`item_role = PACKAGING`,
`item_type = basket`); inactive items are labelled, a current SKU that is not in
the list is still shown so it cannot be lost. Non-basket packaging is excluded.

## D. How basket quantity is derived

`_bomSelectBasketSku` derives `qty_per_selling_unit` from Counting & Units only:
`calculateBasketRequirementFromItem(item, 1)` → `getSellingUnitBaseFactor ÷
base_per_basket`. It reads the live (possibly unsaved) form via `_readEditForm`,
so a just-edited conversion is used. `item.base_per_pack` is never read. A
fractional result (e.g. ถาด → 30/180 = 0.1667) is valid; the qty is treated as
unusable only when it cannot resolve at all, in which case it is left `null` and
the row is marked Needs review.

## E. How the selected basket component is stored

On selection, `_bomSelectBasketSku` creates **or updates one** row in
`_editingV3.item.bom.components`:

```
{ component_type:'packaging', component_role:'basket', component_sku, component_name,
  qty_per_selling_unit:<derived or null>, unit:'ใบ', required:true,
  needs_review:<true if qty null>, source:'bom_basket_selection',
  notes:<'basket_conversion_missing' if qty null else ''> }
```

`_editingV3.item` is the deep-copy working object; the row is **not persisted
until the operator saves the item normally** — `saveEdit` → `_readEditForm`
deep-copies it into the saved record → `persistMasterV3`. The change is verified
to survive a save + reopen cycle.

## F. Imported & duplicate basket components

- **Imported components** are recognised: the existing basket row is shown as the
  current SKU and is **updated in place** when the operator picks a different SKU
  — no duplicate row is ever created. Unknown extra fields on the row (e.g.
  `source_basket_type`) are preserved.
- **Multiple basket components** (an unexpected data state): the panel shows a
  warning listing the SKUs and **renders no selector** — nothing is deleted
  automatically; `_bomSelectBasketSku` also no-ops defensively. The operator
  resolves it manually. All data is preserved.

## G. Scope confirmations

- **No full packaging BOM built** — only the basket selector. No tray / cover /
  label / sticker / pack-material editor; no generic component editor; no add /
  delete-component UI. (Verified: no such functions exist.)
- **No Daily Plan BOM change** — `renderPlanBom` and its helpers untouched.
- **No Orders / Daily Planning / ใบน้อย / Logistics / Dispatch / Inventory
  logic change.** No inventory deduction. Selecting a basket SKU never
  auto-enables BOM — the 8B-UI-4 readiness gate stays a separate user decision.
- Nothing deleted: `bom.components` / `bom.routes` / `bom.notes` / legacy
  `bom.output_unit` / `item.units` / the basket packaging Items all intact.

## Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU, expand BOM / สูตรผลิต.

| # | Step | Expected |
|---|------|----------|
| F1 | SKU with basket conversion, no basket component | Components table shows "ต้องเลือก SKU ตะกร้า"; a basket-SKU dropdown panel appears below |
| F2 | Pick a basket SKU from the dropdown | The basket row updates to that SKU; qty matches the conversion |
| F3 | Save, reopen | The selected basket SKU persists and shows as current |
| F4 | SKU selling in ตะกร้า (180/180) | Basket qty per output = 1 |
| F5 | SKU selling in ถาด (30/180) | Basket qty per output ≈ 0.1667 |
| F6 | SKU with an imported basket component | Shows as the current SKU; changing it updates in place, no duplicate |
| F7 | SKU with two basket components | Warning shown, no dropdown, nothing deleted |
| F8 | SKU with a basket component but no conversion | Basket row + dropdown shown; status Needs review — basket conversion missing |
| F9 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## H. Final verdict — tests run

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +22/+22, `()` +94/+94, `[]` +20/+20);
imbalance offsets unchanged vs backup (braces 0, parens −35, brackets 0);
backticks 1206 (even, unchanged); `_bomRenderBasketSelector` / `_bomSelectBasketSku`
each defined once; `validateMasterItem`, `openEditItem`, `_readEditForm`,
`saveEdit`, `renderPlanBom`, `safeSet` intact.

Functional checks passed — **35/35** Node acceptance-test harness covering all 10
spec tests: placeholder shown when no SKU chosen (T1); selecting writes one
correctly-shaped basket component (T2); it survives save + reopen (T3); qty
derived from the conversion for whole (1) and fractional (0.1667) baskets
(T4–T5); an imported component is updated in place with no duplicate (T6);
multiple basket components warn and are never auto-deleted (T7); a missing
conversion yields a Needs-review row with null qty (T8); no tray/cover/label/
generic editor exists (T9); Daily Plan / core / Task-1 helpers intact (T10).

## Assumptions & limitations

- The selector sets a basket SKU; it does not offer a "remove basket component"
  action (deselection is out of scope for this task).
- When basket conversion is missing the SKU can still be selected, but the qty is
  left blank and the row is Needs review until Counting & Units is completed.
- The multiple-basket-components case is surfaced as a warning only; resolving it
  (choosing which one to keep) is left to a manual / future step.
