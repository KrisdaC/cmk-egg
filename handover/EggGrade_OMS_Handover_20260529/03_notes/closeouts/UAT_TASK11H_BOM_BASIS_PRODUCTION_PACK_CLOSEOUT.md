# UAT Task 11H — Item-level BOM Basis = Production Pack (not Selling Unit)

**Date:** 2026-05-27  
**Status:** Ready for UAT testing  
**File touched:** `app/index.html` only.

---

## A. Problem

UAT operator reported (screenshot, B0002):

> "The BOM still requires for a selling unit, not the pack unit."

B0002 is sold as `ตะกร้า` (1 basket = 60 eggs = 2 production packs of 30). The Item-level BOM screen was reading `getSellingUnitBaseFactor(item)` and rendering "per 1 ตะกร้า" — which is the wrong basis for the packing floor. The floor packs in **production packs** (`units.pack_unit` × `units.base_per_pack`), and tray, basket, and egg counts must be expressed per pack.

Task 11G had partially patched the tray rule under the per-selling-unit basis (qty = f/bpp). That hid the underlying issue but did not fix it: eggs and baskets still showed per-selling-unit quantities. This task corrects the **basis** itself, then reverts the 11G tray formula to its natural form (`qty: 1` per pack).

## B. Scope (and explicit non-scope)

Touched:
- New helpers: `_bomOutputBaseFactor`, `_bomOutputUnitLabel`, `_bomScaleFromSellingToOutput`
- `buildBomComponentLinesForItem` — egg line and basket line scaled by `pb/su`
- `_bomRenderItemOutputSection` — output unit label = production pack
- `_bomRenderItemTestCalc` — Test Calc input is now "production packs"
- `_BOM_PROFILE_RULES.tray_by_egg_size` — qty reverted to `1` (per pack)
- Two cosmetic labels: Packaging Profile column header + hint copy

**Not touched** (verified by grep):
- `calculateEggSourceRequirements` — unchanged; only its caller's interpretation of the result is rescaled
- `calculateBasketRequirementFromItem` — unchanged
- `getSellingUnitBaseFactor`, `normalizeItemUnits` — unchanged
- `_bomSyncPackagingProfile`, `_bomSyncProfileSlot` — unchanged
- `safeSet`, header strip, persist functions — untouched (Task 1/2 helpers intact)
- Orders, Daily Plan, `renderPlanBom`, `renderBomSummary`, ใบน้อย, Logistics, PO parsers — none modified
- `oms-production/` — not touched
- `MASTER_V3.option_sets` — not mutated
- No new Master Data fields; no new localStorage keys

## C. The contract change

| Aspect | Before (11G) | After (11H) |
|---|---|---|
| BOM basis | 1 selling unit | 1 production pack |
| Output unit label | `selling_unit` | `units.pack_unit` (falls back to selling_unit when `base_per_pack` absent) |
| Egg qty | `req per 1 selling unit` | `req × (pb/su)` per pack |
| Basket qty | `convQty per 1 selling unit` | `convQty × (pb/su)` per pack |
| Tray rule qty | `f / bpp` (Task 11G workaround) | `1` (per pack — natural form) |
| Test Calc input | "× quantity" of selling units | "× quantity" of production packs |

`pb` = `units.base_per_pack` (production-pack size in base units).  
`su` = `getSellingUnitBaseFactor(item)` (selling unit in base units).  
`scale = pb / su` — for B0002: 30 / 60 = 0.5. For pack-selling SKUs: 30 / 30 = 1. For single-egg SKUs: 1 / 1 = 1.

When `base_per_pack` is absent (a fong-selling item with no pack contract), `_bomOutputBaseFactor` falls back to `getSellingUnitBaseFactor` and the basis is effectively per selling unit — no operator-visible change for those items.

## D. Worked example — B0002

`B0002`: `selling_unit = "ตะกร้า"`, `pack_unit = "แพ็ค 30"`, `base_per_pack = 30`, `base_per_basket = 60`, `egg_size = "L"`.

| Component | Before | After |
|---|---|---|
| Eggs | 60 per ตะกร้า | 30 per แพ็ค 30 |
| Tray ถาด 30 L | 1 per ตะกร้า (or 2 under Task 11G) | 1 per แพ็ค 30 |
| Basket | 1 per ตะกร้า | 0.5 per แพ็ค 30 |
| Test Calc, qty=10 | 600 eggs / 10 trays / 10 baskets | 300 eggs / 10 trays / 5 baskets |

Test Calc with `qty=10` now means "10 production packs" → 300 eggs, 10 trays, 5 baskets. This matches what the packing floor actually does in 10 trays' worth of work.

## E. Edits applied

9 anchored edits via Python script `apply_11h.py`:

```
edit A (insert BOM-basis helpers) OK
edit B (scale egg qty per pack) OK
edit C (scale basket convQty per pack) OK
edit D (rewrite _bomRenderItemOutputSection — pack basis) OK
edit E (_bomRenderItemTestCalc uses output unit) OK
edit F (test qty label clarification) OK
edit G (tray rule qty = 1 per pack) OK
edit H1 (Packaging Profile column header) OK
edit H2 (Packaging Profile hint -> production pack) OK
APPLIED 9 edits  orig=1570290  new=1574132  delta=3842
```

## F. Static smoke check

- **Brace/paren delta vs pre-edit snapshot:** balanced. `+7/+7` braces, `+57/+57` parens, `+0/+0` brackets, `+2/+2` backticks. Pre-existing `-35` paren imbalance is unchanged (not introduced).
- **`node --check` of inline `<script>` blocks:** 7 blocks, **0 errors**.
- **Symbol audit:** `_bomOutputBaseFactor`, `_bomOutputUnitLabel`, `_bomScaleFromSellingToOutput` each declared exactly once. Old Task 11G per-selling-unit tray formula `qty: (f && bpp) ? (f / bpp) : 1` is **removed**. Protected helpers (`calculateEggSourceRequirements`, `calculateBasketRequirementFromItem`, `getSellingUnitBaseFactor`, `normalizeItemUnits`, `buildBomComponentLinesForItem`, `_bomSyncPackagingProfile`, `_bomSyncProfileSlot`) each declared exactly once. `safeSet` count unchanged (2 pre = 2 post — pre-existing).

## G. Acceptance harness

`harness_11h.js` runs in Node `vm` against a bundle extracted from the live file.

```
OK    T1a B0002 output base factor (eggs per pack) = 30
OK    T1b B0002 selling-unit base factor = 60
OK    T1c B0002 scale from selling to output = 30/60 = 0.5
OK    T1d B0002 output label = "แพ็ค 30"
OK    T2a P0001 output base factor = 30
OK    T2b P0001 selling-unit base factor = 30
OK    T2c P0001 scale = 1
OK    T2d P0001 output label = "แพ็ค 30"
OK    T3a E0001 output base factor (fallback to selling) = 1
OK    T3b E0001 selling-unit base factor = 1
OK    T3c E0001 scale = 1
OK    T3d E0001 output label = "ฟอง"
OK    T4a tray rule for B0002 returns qty=1
OK    T4b tray rule for P0001 returns qty=1
OK    T4c tray rule for E0001 returns qty=1
OK    T5a empty item -> base factor null
OK    T5b empty item -> label "pack"
OK    T5c empty item -> scale defaults to 1
OK    T6 calculateEggSourceRequirements still returns an object for 1 ฟอง

19 passed, 0 failed
```

## H. Rollback

If UAT QA fails this feature, restore the pre-edit snapshot:

```bash
cp _archive/index-pre-bom-basis-pack-20260525.html app/index.html
```

MD5 verification before/after:
- Pre-edit snapshot: `5fd132beffef85a50bdf4597deb92e6e`
- Post-edit current: `42fb29772c4f586d73c1d2a8e58af37e`

Confirm with `md5sum app/index.html _archive/index-pre-bom-basis-pack-20260525.html`. After rollback the two MD5s must match.

---

## What QA should look at

1. Open an Item with `pack_unit = "แพ็ค 30"` / `base_per_pack = 30` / `selling_unit = "ตะกร้า"` / `base_per_basket = 60` (e.g. B0002). The BOM output section should now say **"Per 1 แพ็ค 30"**, not "Per 1 ตะกร้า".
2. Tray row shows **qty 1**, basket row shows **qty 0.5**, egg row shows **30**.
3. Test Calc input: typing `10` should produce 300 eggs, 10 trays, 5 baskets — and the label should read "10 production packs" (or the Thai equivalent visible in the UI string).
4. A pack-selling SKU (selling_unit = pack_unit) should be unchanged in numbers; only the label clarifies that the basis is the production pack.
5. A fong-selling SKU with no pack contract should be unchanged.

If any of (1)–(5) is wrong, file a row in `docs/BUG_LOG.md` and roll back with the command above.
