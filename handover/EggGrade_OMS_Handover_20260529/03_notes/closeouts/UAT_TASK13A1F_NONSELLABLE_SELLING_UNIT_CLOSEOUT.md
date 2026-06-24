# UAT Task 13A-1F — selling_unit validation matches in-app rules; action='error' shows in preview — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `bc978fa4934788f3b6f37371af471975`
**Post-edit app MD5:** `a473abb1881932a250ce07ecf3085fe8`
**Rollback:** `cp _archive/index-pre-task13a1f-nonsellableselling-20260528.html app/index.html`

Operator report from the preview after exporting + re-importing:

> rows C19999P301 / C19999P302 / C29999P301 / C29999P302 show
> `selling_unit: selling_unit can…` blocking errors AND the action
> column says "unchanged" — confusing.

**Root cause.**

1. The file carries `selling_unit = 'แพ็ค'` on those four PACKAGING SKUs,
   but the items' `base_unit = 'ใบ' / 'ฝา'` and `pack_unit = 'ห่อ'` —
   so `'แพ็ค'` doesn't match any unit on the item and
   `getSellingUnitBaseFactor` returns null. The Task 13A-1 / 1B / 1C
   importer raised this as **blocking**.

2. But the **in-app** `validateMasterItem` only requires a valid
   `selling_unit` when `is_sellable = true`. PACKAGING items are
   non-sellable per Task 13A-1E / `_ROLE_BEHAVIOR_DEFAULTS`, so the
   stored value is unused by the calc engine — the app would happily
   save it. My importer was being **stricter than the app**.

3. The preview's `action` column was computed BEFORE checking for
   errors, so a row that had no changes but had a validation error was
   misleadingly classified as `unchanged` while the error column showed
   red.

**Fix.** Two anchored edits in `_validateImportRows`:

1. Gate the `selling_unit` blocking-error path with an effective
   sellable check: read role → `_ROLE_BEHAVIOR_DEFAULTS` (Task 13A-1E
   contract). When the resolved role is non-sellable, an unresolvable
   `selling_unit` is **a warning, not a blocking error**.
   Sellable roles (FG, DEFECT) still block as before; basket-named
   selling_units still warn via the Task 13A-1B downgrade.
2. Make `row._action = 'error'` take precedence over the
   change-count classification, so the preview shows the right thing.

Two anchored edits, +1,935 bytes. `node --check` clean on all 9 inline
blocks. `9 / 9` acceptance cases pass — including a dry-run of the
user's actual uploaded file against the live `demand_master_v3.json`
that returns **`blocking_errors: 0`** (was 4 selling_unit blockers on
the reported rows). All eight prior harnesses still green.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1f-nonsellableselling-20260528.html` |
| Pre-edit MD5 | `bc978fa4934788f3b6f37371af471975` (post-Task-13A-2C) |
| Post-edit MD5 | `a473abb1881932a250ce07ecf3085fe8` |
| Bytes delta | +1,935 |
| Rollback | `cp _archive/index-pre-task13a1f-nonsellableselling-20260528.html app/index.html` |

## B. Rule alignment with the in-app validator

The in-app `validateMasterItem` (line ~14787) only treats a missing /
broken `selling_unit` as a blocking error when `i.is_sellable === true`:

```javascript
if (i.is_sellable && !_mdhNorm(n.selling_unit)) {
  errors.push({ field: 'selling_unit', msg: 'สินค้าขายแต่ไม่มีหน่วยขาย / Missing selling unit for sellable item', ... });
}
```

The importer now mirrors that rule:

| Effective role (after Task 13A-1E behavior apply) | Sellable? | Unresolvable `selling_unit` | Basket-named `selling_unit` |
|---|---|---|---|
| FG | yes | **blocking** | warning (Task 13A-1B downgrade) |
| DEFECT | yes | **blocking** | warning |
| WIP | no | **warning** | warning |
| RM | no | **warning** | warning |
| PACKAGING | no | **warning** | warning |
| SUPPLY | no | **warning** | warning |

The "effective role" is the **post-overlay** role — if the row's
`item_role` cell is non-blank it wins, otherwise the existing item's
role is used. This matches Task 13A-1E's overlay contract.

The warning message clearly tells the operator what's happening:

> *selling_unit set on a non-sellable role (PACKAGING) — stored but
> ignored by the calc engine · selling_unit ตั้งบน role ที่ไม่ขาย
> ระบบไม่ใช้คำนวณ*

## C. Action column precedence

`row._action` now resolves in this order:

```
row has _errors  → 'error'
row !exists      → 'create'
row has _changes → 'update'
otherwise        → 'unchanged'
```

Before Task 13A-1F, the existing-and-error case fell through to
`unchanged` (because change count was 0), even though the row was red
and blocked. The preview now reads consistently: red rows are labelled
`error`.

## D. What did not change

- ✗ The in-app `validateMasterItem` and the egg / basket calculation
  helpers — byte-identical.
- ✗ Task 13A-1B "merged units" approach.
- ✗ Task 13A-1C "validate only what the row writes".
- ✗ Task 13A-1E role-derived behavior overlay (the importer still
  derives is_sellable from role on commit; this Task 13A-1F change is
  purely **validation-side**).
- ✗ Task 12H operator-friendly egg UI + untick fix-up.
- ✗ Task 13A-2 / 13A-2B / 13A-2C export structure and Egg + Basket
  import flow.
- ✗ `MASTER_V3.option_sets`, customers, sites, BOM math, Packaging
  Profile, Orders, Daily Planning, ใบน้อย, Logistics.
- ✗ `safeSet`, header strip backup/restore, `oms-production/`.

## E. QA / smoke results

### E1. Static — passed

```
node --check on all 9 inline <script> blocks: 9 / 9 PASS
brace / paren / bracket / backtick deltas: 0 net change
2 anchored edits, each src.count(old) === 1 asserted before replacement
Final MD5: a473abb1881932a250ce07ecf3085fe8
```

### E2. Acceptance harness — 9 / 9 PASS

`_archive/closeouts/UAT_TASK13A1F_cases_harness.js`:

```
PASS · Case 1 — PACKAGING with unresolvable selling_unit: warning only, NOT blocking
PASS · Case 2 — FG with unresolvable selling_unit: still BLOCKING
PASS · Case 3 — RM with unresolvable selling_unit: NOT blocking
PASS · Case 4 — Action column shows "error" for FG row with blocking error
PASS · Case 5 — PACKAGING row with stable selling_unit: 0 blocking errors (action=update)
PASS · Case 6 — Uploaded file: 4 PACKAGING rows no longer blocked on selling_unit (was 4, now 0)
PASS · Regression — Task 13A-1E repair tool retained
PASS · Regression — BOM Bulk Upload still hidden
PASS · Regression — Supply Unit DOM fields absent

9 passed, 0 failed
```

### E3. Live dry-run against `demand_master_v3.json` (operator's master)

When the user's uploaded
`cmk-sku-identity-units-20260529-1347.xlsx` is parsed through the
importer against the actual 128-item `demand_master_v3.json`:

```
Total rows:           202
to_create:             77
to_update:            125
unchanged:              0
Blocking errors:        0   ← was 4 selling_unit blockers on the reported rows
Warnings:             527   ← mostly create/update narrations + soft warnings
```

The four PACKAGING rows the operator reported (C19999P301 / C19999P302
/ C29999P301 / C29999P302) now carry a single soft warning each
("selling_unit set on a non-sellable role (PACKAGING) — stored but
ignored by the calc engine") instead of a blocking error.

### E4. Prior harnesses — all green

- **Task 13A-1A:** 18 / 18
- **Task 13A-1C:** 5 / 5
- **Task 13A-1E:** 18 / 18
- **Task 13A-2:** 12 / 12
- **Task 13A-2B:** 14 / 14
- **Task 13A-2C:** 26 / 26
- **Task 12H:** 32 / 32
- **Task 12H untick fix-up:** 10 / 10

### E5. Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload app, Master Data → Items → ⬆ นำเข้า Identity + Units → pick `cmk-sku-identity-units-20260529-1347.xlsx` | Preview shows: 0 blocking errors. The 4 PACKAGING rows (C19999P30* / C29999P30*) now have action=`unchanged` (or `update`), one **warning** each that reads "selling_unit set on a non-sellable role (PACKAGING)…". |
| F2 | Click ✅ ยืนยันและบันทึก | Confirms; commits. Items unchanged; warning has no effect on stored data. |
| F3 | Open one of those items in the Item editor | Counting & Units: base / pack as before. selling_unit retains `แพ็ค` (operator-set; the calc engine doesn't use it for PACKAGING). Item editor saves fine without warnings. |
| F4 | Try importing a row with `item_role=FG` and `selling_unit='NOT_A_UNIT'` | Preview shows action=`error`; commit button disabled — sellable roles still block on unresolvable selling_unit. |
| F5 | Verify Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

## F. Final verdict

**ready for UAT testing**

The selling_unit blocking error now applies only to sellable roles —
matching the in-app `validateMasterItem` contract. PACKAGING / RM /
SUPPLY / WIP rows with stored selling_unit values that don't resolve
get a soft warning instead of a hard block. The preview's action
column correctly reads `error` for rows with blocking errors instead of
mis-labelling them `unchanged`. The user's uploaded
`cmk-sku-identity-units-20260529-1347.xlsx` now imports with **0
blocking errors**.

**Roll back with:** `cp _archive/index-pre-task13a1f-nonsellableselling-20260528.html app/index.html`

**Next concrete action for the operator:** reload the app, re-import the
file. Confirm 0 blocking errors and commit. The four PACKAGING rows
that previously blocked now carry only a soft warning.

— *Task 13A-1F, 2026-05-28*
