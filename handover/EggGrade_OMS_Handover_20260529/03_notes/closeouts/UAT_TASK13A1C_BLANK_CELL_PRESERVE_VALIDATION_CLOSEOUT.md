# UAT Task 13A-1C — Blank-cell-preserve validator rule — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `440b595836aee4b19d0f489d568c3460`
**Post-edit app MD5:** `f2d66a3ff8aa65af9c5c65368664a77b`
**Rollback:** `cp _archive/index-pre-task13a1c-blankcell-20260528.html app/index.html`

Bug report from UAT: a fresh upload `upload-bd75c0f3.xlsx` still flagged the
PACKAGING rows `C19999P301 / C19999P302 / C29999P301 / C29999P302` with
`selling_unit cannot resolve to a base factor`, even though their
`selling_unit` cells were left **blank** in the file. Operator's report:
*"file does not contain anything to do with selling units"*.

Root cause: the Task 13A-1B "validate the merged post-overlay state" model
read the selling_unit from the existing item (in browser localStorage) when
the row cell was blank, then validated that **carried-forward** value
against the row's **new** pack_unit — which had been changed. If the
existing selling_unit didn't match the new pack/base setup, the merged check
blocked the row. From the operator's perspective, that's wrong: they
intentionally left selling_unit blank to mean "preserve it; I'll fix it
later in the item editor."

Fix: change the validator rule from "validate the merged state for every
unit field" to **"validate only what the row writes"**. The commit's
`_overlayUnitsOntoItem` only overwrites a field when the cell is non-blank.
The validator now matches that contract exactly — a blank cell means "no
change", which means no validation.

One anchored edit, +1,230 bytes. `node --check` clean on all 8 inline
blocks. Brace / paren / bracket / backtick deltas all 0. All three
harnesses pass after the change:

- **13A-1A harness:** 18 / 18 PASS (unchanged)
- **13A-1B harness:** 10 / 11 PASS (unchanged; the 1 failure is the same
  Node-sandbox `let MASTER_V3` lexical artifact — not a real regression)
- **13A-1C harness on the new uploaded file:** 5 / 5 PASS — total blocking
  errors **0**, all four user-reported PACKAGING rows clear

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1c-blankcell-20260528.html` |
| Pre-edit MD5 | `440b595836aee4b19d0f489d568c3460` (post-Task-13A-1B) |
| Post-edit MD5 | `f2d66a3ff8aa65af9c5c65368664a77b` |
| Bytes delta | +1,230 |
| Rollback | `cp _archive/index-pre-task13a1c-blankcell-20260528.html app/index.html` |

Earlier backups remain available for deeper rollbacks: `_archive/index-pre-task13a1b-basketselling-20260528.html` (pre-13A-1B), `_archive/index-pre-task13a1a-filled-import-20260528.html` (pre-13A-1A), `_archive/index-pre-task13a1-skuid-units-20260528.html` (pre-13A-1).

## B. Bug report and root cause

### B.1 Symptom (screenshot from UAT)

```
C19999P301  ถาดกระดาษ เล็ก  | update | selling_unit: selling_unit can(not resolve)
C19999P302  ถาดกระดาษ ใหญ่  | update | selling_unit: selling_unit can(not resolve)
C29999P301  ฝาครอบ 30 เล็ก   | update | base_unit + selling_unit errors
C29999P302  ฝาครอบ 30 ใหญ่   | update | base_unit + selling_unit errors
```

### B.2 Inspection of the file

```
C19999P301   base_unit='ใบ'   pack_unit='ห่อ'   base_per_pack=100   selling_unit=None
C19999P302   base_unit='ใบ'   pack_unit='ห่อ'   base_per_pack=110   selling_unit=None
C29999P301   base_unit='ฝา'   pack_unit='ห่อ'   base_per_pack=200   selling_unit=None
C29999P302   base_unit='ฝา'   pack_unit='ห่อ'   base_per_pack=200   selling_unit=None
```

`selling_unit` is **blank** for every one of these rows. The operator's
intent is "leave the existing selling_unit alone."

### B.3 What Task 13A-1B's merged-state rule did

After Task 13A-1B introduced merged-state validation:

```javascript
var mergedSelling = (rowSU !== '') ? rowSU : _str(existing && existing.selling_unit);
…
if (mergedSelling) {
  var tmpItem = { selling_unit: mergedSelling, units: mergedUnits };
  if (_trySellingFactor(tmpItem) == null) { … block … }
}
```

For an UPDATE row with blank `selling_unit`, `mergedSelling` = the existing
item's stored `selling_unit`. But `mergedUnits.pack_unit` was overwritten
by the row's new `'ห่อ'`. So the validator was checking
**existing.selling_unit against the new pack_unit** — and predictably,
nothing resolved. Result: blocking error on every PACKAGING row whose
existing selling_unit was set to something that didn't equal the new
pack_unit.

### B.4 Fix model — "validate only what the row writes"

The commit's overlay (`_overlayUnitsOntoItem` / `_overlayRowOntoItem`)
already has this contract:

```javascript
if (_trim(row.pack_unit) !== '') u.pack_unit = _trim(row.pack_unit);
…
if (_trim(row.selling_unit) !== '') item.selling_unit = _trim(row.selling_unit);
```

Only writes when the cell is non-blank. The validator now matches:

- Row's `pack_unit` blank AND row's `base_per_pack` blank → **no
  pack/base_per_pack validation** (operator preserving existing)
- Row's `storage_unit` blank AND row's `base_per_storage` blank → **no
  storage/base_per_storage validation**
- Row's `selling_unit` blank → **no selling_unit validation** (operator
  preserving existing)

When the operator **does** write the field, the merged-state rule from
Task 13A-1B still applies — so basket fields carried forward from the
existing item still let a basket-named `selling_unit` resolve.

The single exception is **`base_unit` on a brand-new SKU**: a CREATE row
must still have a non-empty `base_unit` because there's no existing item
to fall back on.

## C. Edits applied

One anchored edit inside the `validateImportRows` per-row body. Replaces
the unit-field validation block with the new rule set:

```text
Before (Task 13A-1B):                     After (Task 13A-1C):
─────────────────────────────             ─────────────────────────────────────────
if (!mergedUnits.base_unit)               if (!mergedUnits.base_unit && !existing)
   → blocking "missing base_unit"           → blocking "missing base_unit"
                                          else if (row.base_unit !== '' && not in
                                                   option_sets.unit)
                                            → warning "not in option_sets.unit"

if (mergedUnits.pack_unit)                if (rowTouchesPack && mergedUnits.pack_unit)
                                          where rowTouchesPack = (row.pack_unit !== ''
                                                                  || rowBpp != null)
   → require merged base_per_pack > 0       → require merged base_per_pack > 0

if (mergedUnits.storage_unit)             if (rowTouchesStorage && mergedUnits.storage_unit)
                                          where rowTouchesStorage = (row.storage_unit
                                                                     !== '' || rowBps != null)
   → require merged base_per_storage > 0    → require merged base_per_storage > 0

if (mergedSelling)                        if (rowSU !== '')
   → resolve via tmpItem(mergedSelling)      → resolve via tmpItem(mergedSelling)
                                              (basket-named still downgrades to warning)
```

Bytes delta: `+1,230`. Brace / paren / bracket / backtick deltas vs the
backup: `0 / 0 / 0 / 0`.

## D. Behavior table — the four reported PACKAGING rows

Dry-run against `upload-bd75c0f3.xlsx` with a sandbox MASTER_V3 that
includes the four items pre-loaded (mirroring the operator's localStorage
state where they were committed previously). Each item is given a stale
`selling_unit = 'แพ็ค'` that would have triggered the Task 13A-1B
"merged" failure:

| SKU | File row | Task 13A-1B result | Task 13A-1C result |
|---|---|---|---|
| C19999P301 | base=ใบ, pack=ห่อ, bpp=100, **selling=blank** | ❌ selling_unit blocked | ✅ no error |
| C19999P302 | base=ใบ, pack=ห่อ, bpp=110, **selling=blank** | ❌ selling_unit blocked | ✅ no error |
| C29999P301 | base=ฝา, pack=ห่อ, bpp=200, **selling=blank** | ❌ selling_unit blocked | ✅ no error |
| C29999P302 | base=ฝา, pack=ห่อ, bpp=200, **selling=blank** | ❌ selling_unit blocked | ✅ no error |

Overall against the new uploaded file: **total blocking errors = 0**
(from 139 pre-13A-1B, 1 mid-13A-1B). `M0002` in this file now has
`selling_unit = 'มัด 5'` matching `pack_unit = 'มัด 5'`, which resolves
fine — no blocker.

## E. Preservation and safety — confirmed unchanged

Task 13A-1C is a **validation-side** change only. The commit path
(`_overlayRowOntoItem` / `_overlayUnitsOntoItem`) is byte-identical to
13A-1B. Out-of-scope sections (Basket Profile, Egg Profile, BOM, Packaging
Profile, External References, legacy supply, unknown fields) continue to
be deep-clone-then-overlay preserved. `MASTER_V3.option_sets / customers /
sites` are read-only. The header strip backup/restore is untouched. The
Task 13A-0B toolbar cleanup and Task 12B Supply / Issue Unit deprecation
both remain intact (verified by A4 / A5 in the dry-run harness).

## F. What did not change

- ✗ BOM math, Basket / Egg / Packaging Profile logic, Orders, PO Intake,
  Daily Planning, Daily Plan BOM, ใบน้อย, Logistics
- ✗ `MASTER_V3.option_sets`, `MASTER_V3.customers`, `MASTER_V3.sites`
- ✗ `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`
- ✗ `persistMasterV3` and the rest of the Master V3 persistence layer
- ✗ Header strip ⬇ Backup now / ↻ Restore from file…
- ✗ Master Data toolbar (Task 13A-0B) — Admin Tools dropdown, hidden BOM
  Bulk Upload, hidden duplicate Data tab card, all intact
- ✗ Supply / Issue Unit (Task 12B) — no DOM inputs, no active validation,
  no reintroduction
- ✗ `_overlayRowOntoItem` / `_overlayUnitsOntoItem` — the commit-write path
  is byte-identical (only the validator changed)
- ✗ Task 13A-1 / 13A-1A behavior (export shape, behavior_from_role_derived,
  ignored-sheets banner) — Task 13A-1A harness still 18 / 18 PASS

## G. QA / smoke results

### G.1 Static check — passed

```
node --check on all 8 inline <script> blocks: 8 / 8 PASS
brace {} delta vs backup:   0
paren () delta vs backup:   0
bracket [] delta vs backup: 0
backtick delta:             0
1 anchored edit, src.count(old) === 1 asserted before replacement
Final MD5: f2d66a3ff8aa65af9c5c65368664a77b
```

### G.2 Dry-run on the new uploaded file — 5 / 5 PASS

Harness `_archive/closeouts/UAT_TASK13A1C_t13a1c_dryrun.js`:

```
=== Validation summary ===
  total: 202
  to_create: 202   ← Node sandbox artifact; in the real browser the
  to_update: 0       lookup against MASTER_V3 works and the split is
  unchanged: 0       77 create / 125 update like the Python cross-check
  blocking_errors: 0
  warnings: 377

PASS · A1 — none of C19999P301/P302 + C29999P301/P302 are blocked
PASS · A2 — overall blocking errors very low (0, was 139 pre-13A-1B)
PASS · A3 — explicit unresolvable selling_unit still blocks (synthetic SYN1)
PASS · A4 — Task 13A-0B regression intact
PASS · A5 — Task 12B regression intact

5 passed, 0 failed
```

A3 is critical: it confirms the validator is **not** silently accepting
every input. A row that explicitly writes
`selling_unit = 'ไม่มีหน่วยนี้'` (not equal to base/pack/basket) still
gets a blocking error — only **blank** cells are preserved.

### G.3 Previous harnesses — still pass

- **Task 13A-1A harness** (`UAT_TASK13A1A_t13a1a_uploaded_dryrun.js`):
  18 / 18 PASS (same as before — no regressions on ignored-sheets,
  behavior-from-role, derived recompute, Task 13A-0B / 12B regressions).
- **Task 13A-1B harness** (`UAT_TASK13A1B_t13a1b_dryrun.js`): 10 / 11
  PASS (same as before — the 1 failure is the same Node-sandbox `let
  MASTER_V3` lexical artifact and is not a real-browser issue).

### G.4 Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data → Items → click ⬆ นำเข้า Identity + Units → pick `upload-bd75c0f3.xlsx` | Preview shows: detected = Sheet1, fallback banner; Total 202; Blocking errors 0 (or very close); ~377 warnings (mostly create/update narration); Confirm button **enabled**. |
| F2 | Inspect C19999P301 / C19999P302 / C29999P301 / C29999P302 rows | `update` action; **no errors** in the error column; `base_unit` `ฝา` may carry an option_sets warning (cosmetic — `ฝา` isn't in the seed unit list); changed fields = `units.pack_unit`, `units.base_per_pack`, etc. |
| F3 | Inspect B0001–B0017 (basket rows) | `update`; no errors; the basket selling_unit warning may or may not appear depending on whether the merge resolves it cleanly. |
| F4 | Click ✅ ยืนยันและบันทึก · Confirm and commit | Toast: `✓ นำเข้าสำเร็จ · Imported: 77 created, 125 updated, 0 unchanged` (or whatever the live split actually is in the browser). |
| F5 | Open an updated FG item with BOM enabled | BOM components, Basket Profile, Egg Profile, Packaging Profile all unchanged; the file's pack_unit / base_per_pack changes are visible in Counting & Units. |
| F6 | Open one of C19999P30* items after commit | base_unit / pack_unit / base_per_pack updated from the file; selling_unit unchanged (preserved). If the operator wants to set selling_unit, they edit it in the item editor or write it explicitly in a future import file. |
| F7 | Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G.5 Known limitations

- **`base_unit = 'ฝา'`** (paper-cover SKUs) triggers a *warning* "base_unit
  not in option_sets.unit". Cosmetic — the importer accepts the value and
  writes it. Future cleanup: add `ฝา` to the unit option_set seed.
- **The Node sandbox `to_create / to_update` artifact** is unchanged from
  prior dry-runs and irrelevant to real-browser behavior.
- **Operator-explicit invalid selling_unit still blocks** (correctly).
  If the operator types `selling_unit = 'foo'` in the file and `foo`
  doesn't equal any of base/pack/basket, the row blocks. This is the
  intended strictness — only **blank** cells are preserved.
- **Manual F1–F7 not yet run by operator.** Static + headless tests are
  green.

## H. Final verdict

**ready for UAT testing**

Blank cells in the import file now mean "preserve existing", exactly
matching the commit's overlay contract. The four PACKAGING rows the
operator reported (and every other row whose selling_unit / pack_unit /
storage_unit cells are blank) no longer block. Explicit invalid values
still block. Task 13A-0B toolbar cleanup, Task 12B Supply deprecation,
Task 13A-1 export / behavior / preview features, Task 13A-1A
ignored-sheets handling, and Task 13A-1B basket-resolving via merged
state — **all intact**.

**Roll back with:** `cp _archive/index-pre-task13a1c-blankcell-20260528.html app/index.html`

**Next concrete action for the operator:** Re-import `upload-bd75c0f3.xlsx`
in the browser. Confirm 0 blocking errors. Commit. **Stop**. Do not start
13A-2 / 13A-3 / 13A-4 / 13B / 13C without explicit approval.

— *Task 13A-1C, 2026-05-28*
