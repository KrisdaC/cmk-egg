# UAT Task 8C-2 — Basket Profile UX Consolidation — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `57f171e9fe1d8a1e366fc1d27946e722`
**Post-edit app MD5:** `b1854761d951d79825697162f3e8132e`
**Rollback:** `cp _archive/index-pre-bom-basketprofile-20260525.html app/index.html`

Consolidates all basket setup into one dedicated **Basket Profile** section of
Item edit, modelled on Egg Profile. UX / data-meaning cleanup — no new persisted
fields, no destructive migration, no Daily Plan / Orders / Inventory change.

**Note:** this task edited `openEditItem`, which the project rules normally
protect — done with the operator's explicit authorization, via minimal anchored
splices; the save/validate machinery was not touched.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 7 anchored splices: new Basket Profile `_sec` in `openEditItem`; Counting & Units basket block → read-only summary; 8C-1 block replaced by the 8C-2 Basket Profile functions; basket-line `source` → `basket_profile`; `_bomLineSourceLabel` / `_bomLineEditableLabel` get a `basket_profile` case; in-BOM basket selector call removed. |
| `_archive/index-pre-bom-basketprofile-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8C2_BASKET_PROFILE_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | +1 row (`UAT-039`). |

`oms-production/`, `validateMasterItem`, `_readEditForm`, `saveEdit`,
`normalizeMasterRecord`, Orders, Daily Planning, Daily Plan BOM, ใบน้อย,
Logistics, Dispatch, Inventory — untouched. No master-data JSON change.

## B. Where basket fields existed before

Basket setup was split across two places: **Counting & Units** held the
conversion (`units.has_basket_unit`, `units.basket_unit`, `units.base_per_basket`
in the `itemBasketBlock`), and the **BOM section** held the 8C-1 basket-SKU
selector (writing one `component_role:'basket'` row). It felt like basket was
entered twice.

## C. How Basket Profile was added

A new collapsible section **🧺 ข้อมูลตะกร้า · Basket Profile** is inserted into
`openEditItem` right after Counting & Units (a peer of Egg Profile, collapsed
unless the SKU is basket-relevant). All its logic lives in new BOM-module
functions; `openEditItem` only gains one `_sec(...)` call. The section has five
parts:

- **A — Uses basket** (`units.has_basket_unit` checkbox)
- **B — Basket conversion** (`units.basket_unit` fixed "ตะกร้า"; `units.base_per_basket`; helper text)
- **C — Actual basket SKU** (dropdown of PACKAGING + basket Items)
- **D — Calculated qty per selling unit** — read-only, `selling_unit_base_factor ÷ base_per_basket`
- **E — Status** — OK / Needs review (missing base_per_basket, missing SKU, multiple components, stored-qty mismatch, or "Uses basket off but a component exists")

## D. Counting & Units — summarized, not duplicated

The Counting & Units `itemBasketBlock` is now a **read-only summary** — a single
breadcrumb line ("Basket conversion and the basket SKU are configured in the
Basket Profile section below", plus the current conversion). The editable basket
fields (`has_basket_unit`, `basket_unit`, `base_per_basket`) **moved** to Basket
Profile; each `data-f` now appears in exactly one editable place, so basket is
never configured twice. The `units.basket_unit` clean-vs-legacy handling was
copied verbatim, so no legacy basket-unit value is force-reset.

## E. How basket SKU selection works & is stored

`_bomSelectBasketSku(sku)` (now living in Basket Profile) creates **or updates
one** `component_role:'basket'` row in `_editingV3.item.bom.components`:

```
{ component_type:'packaging', component_role:'basket', component_sku, component_name,
  qty_per_selling_unit:<derived>, unit:'ใบ', required:true,
  needs_review:<true if qty null>, source:'basket_profile', notes:'' }
```

Quantity is derived from the basket conversion (`calculateBasketRequirementFromItem`
→ `getSellingUnitBaseFactor ÷ base_per_basket`; `item.base_per_pack` never read).
The row is not persisted until the operator saves the item normally. An imported
basket component is updated in place — no duplicate. Multiple basket components →
a warning, no automatic deletion. Selecting a SKU never auto-enables BOM.

## F. How BOM displays basket after this change

The BOM section no longer hosts the basket selector. Its Components table simply
**displays** the basket line, now with **Source = "Basket Profile"** (the line
`source` is `basket_profile` for all cases; `_bomLineSourceLabel` maps it, and
`_bomLineEditableLabel` shows "📋 ที่ Basket Profile"). When the Basket Profile
is incomplete the basket line carries its Needs-review status as before.

## G. Confirmations

- **No basket data deleted.** `item.bom.components`, routes, notes, `item.units`,
  the basket packaging Items — all intact. Unchecking "Uses basket" keeps the
  component and shows a warning. Verified: render/build leave `item.bom`
  unmutated; only `_bomSelectBasketSku` writes, and only to the working copy.
- **No new persisted fields** — Basket Profile is a UI grouping of existing
  `units.*` and `bom.components` data. No destructive migration.
- **No full packaging BOM built** — basket only; no tray/cover/label/sticker
  editor, no bulk upload, no generic component editor.
- **No Daily Plan BOM change** — `renderPlanBom` and helpers untouched.
- **No Orders / Daily Planning / ใบน้อย / Logistics / Dispatch / Inventory
  change.** No inventory deduction. `validateMasterItem` and the form's
  save/validate machinery untouched.

## Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU.

| # | Step | Expected |
|---|------|----------|
| F1 | Expand "🧺 Basket Profile" on a basket SKU | Shows Uses basket, base per basket, basket SKU dropdown, calculated qty, status |
| F2 | Look at Counting & Units | Basket is a read-only summary line only — not editable in two places |
| F3 | Pick a basket SKU in Basket Profile | The basket component is recorded; calculated qty + status update |
| F4 | Save, reopen | Basket Profile shows the selected basket SKU |
| F5 | Open the BOM section | The basket line shows Source = "Basket Profile" |
| F6 | A basket SKU with Uses basket on but no SKU chosen | Basket Profile status = Needs review |
| F7 | Untick "Uses basket" on a SKU that has a basket component | Warning shown; the component is not deleted |
| F8 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## H. Final verdict — tests run

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +33/+33, `()` +88/+88, `[]` +4/+4);
imbalance offsets unchanged vs backup (braces 0, parens −35, brackets 0);
backticks 1206 (even, unchanged); the new Basket Profile functions each defined
once; the editable basket `data-f` fields appear exactly once each (no
double-entry); `openEditItem`, `validateMasterItem`, `renderPlanBom`, `safeSet`
intact.

Functional checks passed — **26/26** Node acceptance-test harness covering all 8
spec tests: the Basket Profile renders all five parts (T1); Counting & Units has
no duplicate editable basket fields (T2); selecting a SKU writes one
`source:'basket_profile'` component (T3); it survives save + reopen (T4); the BOM
table shows the basket line with Source = Basket Profile (T5); a missing SKU
yields a Needs-review status (T6); unchecking Uses basket warns and deletes
nothing (T7); Daily Plan / core / Task-1 helpers and `openEditItem` intact (T8).

## Assumptions & limitations

- `bom.no_bom_required` and the `_basketUnitClean` / `_basketUnitRaw` consts in
  `openEditItem` are now unused dead code (logged as UAT-039) — harmless, kept
  per convention.
- Basket Profile cannot "remove" a basket component (deselection is out of
  scope); multiple basket components are surfaced as a warning for manual review.
- The Basket Profile re-checks against the live form via a "↻ Re-check" button;
  cross-section edits (e.g. changing the selling unit) refresh on Re-check.
