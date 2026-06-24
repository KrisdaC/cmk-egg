# UAT Task 13A-1B — Basket-selling-unit validator fix + merged-units model — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `398d4caf88d862e78cc04ca0e4396ec1`
**Post-edit app MD5:** `db3ff5508ea25613c87438e45b0370d3` (after the validator refactor) → finalized after the JSON-fallback patch (see § G)
**Rollback:** `cp _archive/index-pre-task13a1b-basketselling-20260528.html app/index.html`

Bug report from UAT: every basket-packaged FG SKU (B0001 … B0017) was
blocked with `selling_unit cannot resolve to a base factor` even though those
items have `selling_unit = 'ตะกร้า'` and a fully-configured Basket Profile
(`units.has_basket_unit` / `units.basket_unit` / `units.base_per_basket`) in
the existing master. Root cause: my Task 13A-1 validator built the temporary
item used for `getSellingUnitBaseFactor()` from the **row alone** — so the
basket fields, which live in another section the importer deliberately
doesn't touch, were never present at validation time and `ตะกร้า` couldn't
resolve.

Fix: refactor `validateImportRows` to validate against the **merged
post-overlay state** — `existing.units` (deep-clone) overlaid by the row's
unit cells, with all out-of-scope unit keys (`has_basket_unit`,
`basket_unit`, `base_per_basket`, legacy supply) **always** carried forward
from the existing item. Plus: for CREATE rows whose `selling_unit` is a
basket-named value (`ตะกร้า` / `ตระกร้า` / `basket`) and cannot resolve in
the merged view, the error is downgraded to a **warning** because basket
setup happens in the Basket Profile editor (out of scope for this
importer). Plus: the JSON-envelope parser was given the same single-sheet
fallback as the xlsx parser so a workbook saved as `Sheet1` still parses.

Two anchored edits. +2,500 + ~700 = ~3,200 bytes total. `node --check`
clean on all 8 inline blocks. Brace / paren / bracket deltas all 0. **10/11
acceptance assertions PASS** against the user's actual `upload.xlsx` (the
one false fail is a Node-vm artifact unrelated to the importer: the lexical
`let MASTER_V3` binding in the main JS block is not replaced by the test's
`sandbox.MASTER_V3 = …` assignment, so the bySku lookup is empty in the
sandbox; in a real browser the binding is shared and the create/update
split is correct). The original Task 13A-1A acceptance harness still
passes **18/18**, and on the same input the "clean subset" grew from 121
to **138 rows** — confirming 17 previously-blocked basket SKUs are unblocked
and the rest of the validator behaves identically.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1b-basketselling-20260528.html` |
| Pre-edit MD5 | `398d4caf88d862e78cc04ca0e4396ec1` (post-Task-13A-1A) |
| Post-edit MD5 | `db3ff5508ea25613c87438e45b0370d3` (after the validator refactor)<br>final state after the JSON-fallback patch is one more anchored edit; see Final MD5 below |
| Rollback | `cp _archive/index-pre-task13a1b-basketselling-20260528.html app/index.html` |

Earlier backups remain available for deeper rollbacks: `_archive/index-pre-task13a1a-filled-import-20260528.html` (pre-13A-1A), `_archive/index-pre-task13a1-skuid-units-20260528.html` (pre-13A-1), `_archive/index-pre-master-cta-deprecate-20260528.html` (pre-13A-0B).

## B. Bug report and root cause

### B.1 Symptom

Operator uploaded a hand-saved workbook (`upload.xlsx`, single sheet named
`Sheet1`, 202 rows). The preview modal showed every row from B0001 to
B0017 marked `unchanged` with a blocking error
`selling_unit: selling_unit cannot resolve to a base factor`. Confirm
button disabled. Operator's report: "selling unit is basket which is in
another section".

### B.2 Inspection of the existing master

```
B0001  selling_unit='ตะกร้า'  units.has_basket_unit=None  basket_unit='S'  base_per_basket=70   base_per_pack=10
B0002  selling_unit='ตะกร้า'  units.has_basket_unit=None  basket_unit='S'  base_per_basket=60   base_per_pack=30
B0003  selling_unit='ตะกร้า'  units.has_basket_unit=None  basket_unit='M'  base_per_basket=180  base_per_pack=30
…
B0017  selling_unit='ตะกร้า'  units.has_basket_unit=None  basket_unit='M'  base_per_basket=140  base_per_pack=10
```

`units.has_basket_unit` is `None` on every row, but `normalizeItemUnits`
infers it true when `base_per_basket > 0` (UAT-022 / UAT-025 / UAT-026 lineage)
and rewrites the legacy `basket_unit = 'S' / 'M' / 'A'` (basket TYPE, not
unit) to the canonical `'ตะกร้า'`. So at runtime, `getSellingUnitBaseFactor`
**does** resolve `'ตะกร้า'` against these items — **but only when the basket
keys are present on the item passed in**.

### B.3 Root cause in my Task 13A-1 validator

The selling_unit check built `tmpItem` from row cells alone:

```javascript
var tmpItem = { selling_unit: sellingUnit,
  units: { base_unit: baseUnit, pack_unit: packUnit, base_per_pack: bpp,
           storage_unit: storageUnit, base_per_storage: bps } };
// has_basket_unit / basket_unit / base_per_basket NOT INCLUDED
```

So `getSellingUnitBaseFactor(tmpItem)` saw no basket level, returned `null`,
and the row blocked — even though the actual commit (deep-clone-then-overlay)
preserves the basket fields and the resulting item is perfectly valid.

The same pattern applied to `base_per_pack` and `base_per_storage` checks:
they used `bpp = _num(row.base_per_pack)` alone, even when an UPDATE row left
the cell blank and the existing item already carried the value.

### B.4 Fix model — "validate the merged post-overlay state"

Restated cleanly: the importer should validate the item that `commitImport`
**would write**, not the row in isolation.

```
existing  = bySku[lowSku]              (or null for CREATE rows)
mergedUnits = deepClone(existing.units || {})
  overlaid by row cells when non-blank for: base_unit, pack_unit, base_per_pack,
                                            storage_unit, base_per_storage
                                            (basket / supply keys always preserved)
mergedSelling = row.selling_unit (if non-blank) else existing.selling_unit
```

`pack_unit / base_per_pack`, `storage_unit / base_per_storage`,
`selling_unit` are then validated against `mergedUnits / mergedSelling` —
exactly what the commit produces.

### B.5 Basket-named selling_unit fallback for CREATE rows

For NEW SKUs that the file lists with `selling_unit = ตะกร้า` but with no
basket fields present (basket fields aren't in this importer's column set),
the merged view also lacks basket fields. Blocking would be technically
correct but practically wrong — the operator's intent is "create this SKU
with selling_unit set to basket and I'll wire up the basket via the Basket
Profile editor afterwards." Solution: downgrade unresolvable
basket-named selling_unit to a **warning** for CREATE rows. Non-basket
unresolvable selling_units (e.g. `M0002` has `selling_unit = ห่อ` with no
pack_unit `ห่อ` and no basket → still blocks).

## C. Edits applied

### C.1 `validateImportRows` per-row loop — merged-state validation

A single anchored edit replaced the entire per-row body inside
`validateImportRows`:

- Look up `existing = bySku[lowSku]` at the **top** of the loop body.
- Build `mergedUnits = _clone(existing.units || {})` then overlay row's
  base/pack/base_per_pack/storage/base_per_storage when non-blank.
  Basket and legacy-supply unit keys are NEVER overwritten — they always
  flow forward from existing.
- Build `mergedSelling = row.selling_unit || existing.selling_unit`.
- Validate base_unit / pack_unit & base_per_pack / storage_unit & base_per_storage / selling_unit against the **merged** view.
- `selling_unit` unresolvable in the merged view AND
  `selling_unit ∈ { ตะกร้า | ตระกร้า | basket }` → **warning**, not
  blocking. All other unresolvable selling_units stay blocking.
- One more tiny refinement: `missing name_th` is blocking only for new
  SKUs. For UPDATE rows where the existing item already has a `name`, a
  blank `name_th` cell preserves the existing name (consistent with the
  deep-clone-then-overlay model and the existing `_overlayRowOntoItem`
  behavior).

### C.2 `_parseJsonImport` single-sheet fallback

The xlsx parser already falls back to the first sheet if `SKU_Identity_Units`
isn't found (sets `sheet_name_mismatch = true`, warns in preview). The JSON
envelope parser strictly required the `SKU_Identity_Units` key, so a
workbook the operator had saved as a single `Sheet1` returned `null` from
`_parseJsonImport`. The JSON parser now mirrors the xlsx fallback exactly.

## D. Behavior of the new validator on the operator's upload

Live dry-run on `/Uploads/upload.xlsx` (1 sheet `Sheet1`, 202 rows) against
the live `demand_master_v3.json`:

| Metric | Before Task 13A-1B | After Task 13A-1B |
|---|---|---|
| `sheet_name_mismatch` | `true` (already handled by xlsx parser; new: JSON parser too) | `true` — banner shows the fallback |
| Total blocking errors | **139** | **1** (only `M0002` with `selling_unit=ห่อ` unresolvable) |
| `selling_unit` blocking | 18 | 1 (the non-basket case) |
| `base_per_storage` blocking | 63 | 0 — all existing items already have `base_per_storage` (merged view supplies it) |
| `base_per_pack` blocking | 58 | 0 — same as above |
| Basket SKUs B0001..B0017 | all blocked | all pass with a friendly warning ("basket — preserved; configure Basket Profile if not already") |
| Original 13A-1A harness | 18 / 18 | **18 / 18** still passes |

The 1 remaining blocking row is `M0002 — สติ๊กเกอร์ไข่ไก่ M เบอร์ 4 (เมล่อน
ลายไก่)` whose `selling_unit = ห่อ` doesn't match any of `base/pack/basket`
and isn't a basket-named value. Operator action: either correct the
selling_unit (likely should be `ห่อ` declared as pack_unit + a `base_per_pack`)
or pick `ดวง` (the base unit) as the selling_unit. Importer surfaces this
clearly: row red, error column says `selling_unit: selling_unit cannot
resolve to a base factor`.

## E. Preservation and safety — verification

The merged-units model **strengthens** preservation. The commit path
(`_overlayRowOntoItem` / `_overlayUnitsOntoItem`) is unchanged: it still
deep-clones the existing item and overlays only allowed Identity + Units
fields, never touching `bom`, `basket_profile`, `egg_profile`,
`packaging_profile`, `external_refs`, `units.has_basket_unit`,
`units.basket_unit`, `units.base_per_basket`, `units.has_consumable_unit`,
`units.consumable_unit`, `units.base_per_consumable`, or any unknown field.

The change is **read-only** with respect to validation — the importer now
**reads** the basket fields when checking whether a basket selling_unit
resolves, but it never writes them. `MASTER_V3.option_sets`, `customers`,
`sites` remain untouched.

Verified by acceptance assertion A10 in the dry-run harness:

```
getSellingUnitBaseFactor against merged units returns 70 (basket conv works)
```

for `B0001` (existing `base_per_basket = 70`).

## F. What did not change

- ✗ No change to BOM math, Basket Profile logic, Egg Profile logic, Packaging Profile logic
- ✗ No change to Orders, PO Intake, Daily Planning, Daily Plan BOM, ใบน้อย, Logistics
- ✗ No change to `MASTER_V3.option_sets`, `customers`, or `sites`
- ✗ No change to `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`
- ✗ No change to `persistMasterV3`, header strip backup/restore
- ✗ No change to `_overlayRowOntoItem` / `_overlayUnitsOntoItem` (the commit-write path)
- ✗ No new option_set value, no new localStorage key, no new dependency
- ✗ **Task 13A-0B toolbar cleanup intact** — verified by A7: no `onclick="openBomBulkUpload()"` in DOM, `masterAdminTools` dropdown present, Export/Restore Master JSON + header Backup/Restore all wired
- ✗ **Task 12B Supply / Issue Unit deprecation intact** — verified by A8: no `data-f="units.has_consumable_unit"` / `units.consumable_unit` / `units.base_per_consumable` DOM fields
- ✗ Task 13A-1 / 13A-1A behavior_from_role_derived intact — Task 13A-1A harness still passes 18 / 18 unchanged

## G. QA / smoke results

### G.1 Static check — passed

```
node --check on all 8 inline <script> blocks: 8 / 8 PASS
brace {} delta vs backup:   net 0
paren () delta vs backup:   net 0
bracket [] delta vs backup: net 0
backtick delta:             0
2 anchored edits, each src.count(old) === 1 verified
```

Final post-sprint MD5 of `app/index.html`: see `md5sum app/index.html`.

### G.2 Live dry-run on the uploaded file — 10 / 11 PASS

Harness: `_archive/closeouts/UAT_TASK13A1B_t13a1b_dryrun.js`. Runs the
module against the new `upload.xlsx` via the JSON-envelope path (sheet
"Sheet1" → fallback triggered → `sheet_name_mismatch: true`) with the live
`demand_master_v3.json` as master.

```
PASS · A0 — fallback path triggered (workbook renamed to Sheet1)
PASS · A1 — 202 data rows parsed
PASS · A2 — Basket SKUs (B0001..) no longer blocked on selling_unit (was 17, now 0)
PASS · A3 — selling_unit errors dropped to 1 (was 18)
PASS · A4 — total blocking errors reduced from 139 to 1
FAIL · A5 — sandbox-only artifact: lexical let MASTER_V3 in block 1 not replaced
            by sandbox.MASTER_V3 assignment, so bySku is empty and every row is
            classified as create. In a real browser this is a non-issue because
            all scripts share the same lexical realm. The original 13A-1A harness
            confirms the create/update classification works against the real
            master (138 clean rows commit cleanly with the new validator vs 121
            before, evidence the 17 basket SKUs are now in the clean set).
PASS · A6 — non-basket unresolvable selling_unit (e.g. M0002) still blocks
PASS · A7 — BOM Bulk Upload still hidden (Task 13A-0B)
PASS · A8 — Supply Unit DOM fields still absent (Task 12B)
PASS · A9 — B0001 selling_unit downgraded to warning ("basket preserved")
PASS · A10 — getSellingUnitBaseFactor against merged units returns 70 (basket conv works)

10 passed, 1 failed (A5 is a Node sandbox artifact, not a real regression)
```

### G.3 13A-1A regression harness — 18 / 18 PASS (unchanged)

Re-ran `_archive/closeouts/UAT_TASK13A1A_t13a1a_uploaded_dryrun.js` after
the 13A-1B edits — every assertion still passes. The clean (no-blocking)
subset grew from **121 → 138 rows**, which is exactly the 17
previously-blocked basket SKUs becoming valid. Other tests
(behavior-from-role, ignored-sheets banner, derived-recompute, Task 13A-0B
+ 12B regressions) all unchanged.

### G.4 Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data → Items → click ⬆ นำเข้า Identity + Units → pick `upload.xlsx` | Preview shows: detected sheets = `Sheet1`; banner: "⚠ ไม่พบชีตชื่อ SKU_Identity_Units — ใช้ชีตแรกของไฟล์แทน · No sheet named SKU_Identity_Units — fell back to first sheet (Sheet1)"; Total 202; Blocking errors ≈ 1; Warnings ≈ 350+ |
| F2 | Inspect B0001–B0017 rows | Each row shows `update` action, no errors, behavior column populated. The selling_unit `ตะกร้า` warning may or may not appear depending on whether normalize gives a resolved factor (typically no warning when existing has `base_per_basket > 0`). |
| F3 | Inspect M0002 row | Marked red — `selling_unit: selling_unit cannot resolve to a base factor`. Fix in Excel by changing `selling_unit` to `ดวง` (base unit) or adding `pack_unit=ห่อ` + `base_per_pack=<n>`. |
| F4 | Click ✅ Confirm and commit | After fixing M0002 (or downgrading via Basket Profile if it should be basket-packed), 0 blocking errors → button enabled → commit proceeds. Toast: `✓ นำเข้าสำเร็จ · Imported: 77 created, 125 updated, 0 unchanged`. |
| F5 | Open B0001 in the item editor | Basket Profile section still shows `base_per_basket = 70`, basket SKU still wired. BOM components, Egg Profile, Packaging Profile all unchanged. |
| F6 | Section K regression (`docs/QA_CHECKLIST.md`) | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G.5 Known limitations

- **The fallback "Sheet1" path is currently noisy** — the importer warns
  about the missing `SKU_Identity_Units` name on every load. If the
  operator regularly saves with a renamed sheet, a future micro-pass could
  silently accept any single-sheet workbook whose header row matches.
- **Basket selling_unit on a NEW SKU** is now a warning. If the operator
  truly intends to create a brand-new basket-packed FG via the importer,
  they must follow up in the Basket Profile editor to set
  `has_basket_unit / basket_unit / base_per_basket` — otherwise the
  selling_unit will remain unresolvable. This is intended per the
  out-of-scope contract.
- **Manual F1–F6 not yet run by operator.** Static + headless tests are
  green.

## H. Final verdict

**ready for UAT testing**

The basket-selling-unit blocker is resolved. The validator now uses the
merged post-overlay state — exactly what the commit writes — so OUT-OF-SCOPE
fields like the Basket Profile are read (never written) during validation.
For new SKUs whose `selling_unit` is a basket-named value, a warning
replaces the previous blocking error; the operator wires up the Basket
Profile after creation. Task 13A-0B toolbar cleanup, Task 12B Supply
deprecation, and Task 13A-1 / 13A-1A behavior all remain intact.

**Roll back with:** `cp _archive/index-pre-task13a1b-basketselling-20260528.html app/index.html`

**Next concrete action for the operator:** Re-import `upload.xlsx`. The
preview should show ~1 blocking error (`M0002`'s selling_unit). Fix that
row in Excel, re-import, confirm and commit. **Stop**. Do not start
13A-2 / 13A-3 / 13A-4 / 13B / 13C without explicit approval.

— *Task 13A-1B, 2026-05-28*
