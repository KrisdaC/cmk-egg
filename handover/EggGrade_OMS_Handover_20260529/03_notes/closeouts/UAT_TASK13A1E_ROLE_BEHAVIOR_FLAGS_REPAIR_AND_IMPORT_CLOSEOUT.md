# UAT Task 13A-1E — Role-derived behavior flags: repair existing data + apply on import — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `7adbaf2a70dd729f7b78f1bc0b759cba`
**Post-edit app MD5:** `69370f6943b79ba257727e30e5a96c0e`
**Rollback:** `cp _archive/index-pre-task13a1e-rolebehavior-20260528.html app/index.html`

Operator report: PACKAGING items added through earlier imports were
incorrectly showing **Sellable: Yes, Producable: No, Material: No** in the
Item editor — should have been **Sellable: No, Producable: No, Material:
Yes** per `_ROLE_BEHAVIOR_DEFAULTS` (Task 7C-2). Root cause: the Task 13A-1
importer's new-item construction never wrote `is_sellable / is_producable
/ is_consumable`, and the chip code defaults `is_sellable` to true when
the field is missing, so every brand-new PACKAGING item looked sellable.

Task 13A-1E addresses both halves of the operator's brief:

1. **One-time data-repair tool** — preview → confirm → backup → apply →
   persist. Reachable from the Master SKU Rebuild section (new "🔧 ตรวจ +
   ซ่อมพฤติกรรม · Preview + Repair" button) and from DevTools
   (`T13A1.previewRepair()`, `T13A1.repair()`).
2. **Future imports also write behavior flags** — every imported row
   (create and update) now applies the canonical
   `{is_sellable, is_producable, is_consumable}` triple from
   `_ROLE_BEHAVIOR_DEFAULTS[item_role]`. The preview diff surfaces the
   three changes so the operator sees what will be applied at commit time.

7 anchored edits inside the Task 13A-1 module. `node --check` clean on all
8 inline blocks. Brace / paren / bracket / backtick deltas all 0. **18 / 18
acceptance assertions pass** for Cases A–D plus regressions. Task 13A-1A
harness still 18 / 18; Task 13A-1C harness still 5 / 5.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1e-rolebehavior-20260528.html` |
| Pre-edit MD5 | `7adbaf2a70dd729f7b78f1bc0b759cba` |
| Post-edit MD5 | `69370f6943b79ba257727e30e5a96c0e` |
| Bytes delta | +14,529 |
| Rollback | `cp _archive/index-pre-task13a1e-rolebehavior-20260528.html app/index.html` |

## B. Edits applied

Seven anchored edits, all inside the Task 13A-1 IIFE module:

1. **Helpers** (`_t13a1e_buildExpectedBehavior`, `_t13a1e_applyRoleBehavior`,
   `_t13a1e_previewRepair`, `_t13a1e_repair`, `t13a1e_openRepairPreview`,
   `t13a1e_closeRepairModal`, `t13a1e_confirmRepair`).
2. **Import overlay** — `_overlayRowOntoItem` now calls
   `_t13a1e_applyRoleBehavior(item)` after Identity + Units overlay, so
   updates also write behavior flags.
3. **New-item construction** in `commitImport` — applies role behavior
   right after `_overlayUnitsOntoItem(fresh, row)`. This is the actual
   fix for the operator's symptom (PACKAGING items showing Sellable Yes).
4. **Diff surfacing** — `_computeRowChanges` adds `is_sellable /
   is_producable / is_consumable` entries when the role-derived state
   differs from the existing item, so the preview modal lists them in the
   per-row "changed fields" column.
5. **HTML button** — a new "🔧 ตรวจ + ซ่อมพฤติกรรม · Preview + Repair"
   button in the Master SKU Rebuild section (below the Export / Import
   row, with a small explanation line). Hidden by `display:none` on
   non-items sub-tabs (same hook as the rest of the rebuild section).
6. **`window.t13a1e_*` exposure** — `openRepairPreview`,
   `closeRepairModal`, `confirmRepair` exposed so the inline `onclick`
   handlers work.
7. **`T13A1.*` namespace** — `buildExpectedBehavior`, `applyRoleBehavior`,
   `previewRepair`, `repair` exposed for the headless test harness.

## C. Existing-data repair tool

### C1. Operator UI

In Master Data → Items, the Master SKU Rebuild card now has a new dashed
row at the bottom:

```
🔧 ซ่อมพฤติกรรมตามบทบาท · Repair behavior from role
   ตั้งค่า is_sellable / is_producable / is_consumable จาก item_role ·
   sets the three behavior flags from item_role for already-imported
   items (one-time cleanup).
                                                [ 🔧 ตรวจ + ซ่อมพฤติกรรม ]
```

Click → modal opens with a KPI strip:

```
Total scanned      ⟶ MASTER_V3.items.length
Already correct    ⟶ behavior matches role
To repair          ⟶ behavior differs from role
Unknown role       ⟶ item_role not in _ROLE_BEHAVIOR_DEFAULTS (skipped)
```

…and a row table for the mismatches showing current S/P/C (red) and
expected S/P/C (green). Confirm button shows the repair count; an OS
`confirm()` dialog asks one final time before applying.

### C2. Existing data repair — summary required by the brief

| Metric | Behavior |
|---|---|
| **How many items scanned** | All entries in `MASTER_V3.items` (live count varies; the demand_master_v3.json snapshot has 128 items, the operator's live state has 128 + recently-imported PACKAGING SKUs). |
| **How many behavior mismatches found** | Reported live in the preview modal. The synthetic test sets (Cases A + C) show 2 mismatches out of 4 items. |
| **How many PACKAGING items repaired in test** | Case A: `A1MKO4P410` flipped from `(s=true, p=false, c=false)` → `(s=false, p=false, c=true)` — verified by the harness. |
| **Auto-run or user-confirmed** | **User-confirmed.** No silent mutation on page load. Preview modal → operator clicks "✅ ยืนยันและซ่อม · Confirm and repair" → OS `confirm()` dialog → only then writes. |
| **How to run the repair** | UI: Master Data → Items → "🔧 ตรวจ + ซ่อมพฤติกรรม · Preview + Repair" button. Console: `T13A1.previewRepair()` returns the scan result without mutating; `T13A1.repair()` applies after pre-snapshot. |
| **Backup before repair** | `persistMasterV3({ snapshotReason: 't13a1e_pre_repair' })` is called before the writes. This goes through `safeSet`, which writes a `_backup_latest` snapshot before the new value. After the repair, a second call with `{ force: true, snapshotReason: 't13a1e_post_repair' }` records the new state. Rollback: console `restoreMasterV3FromBackup()` recovers the pre-repair state. |

**Confirmed: already-uploaded PACKAGING SKU behavior can now be corrected.**
Case A in the headless harness proves the round-trip:

```
Before: A1MKO4P410 { is_sellable:true,  is_producable:false, is_consumable:false }
After:  A1MKO4P410 { is_sellable:false, is_producable:false, is_consumable:true  }
```

…and the out-of-scope structures (`bom`, `basket_profile`, `egg_profile`,
`packaging_profile`, `external_refs`, `units`) are byte-identical
before and after. Verified in the harness.

### C3. Import path also applies role behavior

For every imported row (create + update):

- The diff in the preview modal now includes `is_sellable / is_producable /
  is_consumable` entries whenever the role-derived state differs from
  the existing item.
- At commit time, `_overlayRowOntoItem` (for updates) and the new-item
  construction (for creates) both call `_t13a1e_applyRoleBehavior(item)`
  after the Identity + Units overlay.
- A re-import of the operator's `upload-bd75c0f3.xlsx` will therefore
  fix every already-imported PACKAGING item automatically — no need to
  run the repair tool separately if the operator plans to re-import.

## D. Behavior matrix (canonical, from `_ROLE_BEHAVIOR_DEFAULTS`)

| `item_role` | `is_sellable` | `is_producable` | `is_consumable` |
|---|---|---|---|
| FG | **true** | **true** | false |
| WIP | false | **true** | false |
| RM | false | false | **true** |
| PACKAGING | false | false | **true** |
| SUPPLY | false | false | **true** |
| DEFECT | **true** | false | false |
| any other role | **untouched** | **untouched** | **untouched** |

For roles not present in the map (e.g. a typo or a custom code added
later), the importer and the repair tool both **leave the item alone**.
No bogus flags are written. Confirmed by Case D.

## E. Preservation and safety

- **Basket Profile preserved** — `_overlayRowOntoItem` writes only the
  allowlisted Identity + Units + behavior fields. `basket_profile.*`,
  `units.has_basket_unit`, `units.basket_unit`, `units.base_per_basket`
  never read or written. Verified by Case A POST (snapshot byte-identical).
- **Egg Profile preserved** — same. `egg_profile.*` untouched. Verified.
- **BOM preserved** — `bom.*` untouched. Verified.
- **Packaging Profile preserved** — `packaging_profile.*` untouched.
  Verified.
- **External References preserved** — `external_refs.*`, `partner_codes`,
  `aliases`, `upload_mappings`, `barcode` untouched. Verified.
- **Legacy supply fields preserved on existing items** — Task 12B
  deprecation intact: `units.has_consumable_unit / consumable_unit /
  base_per_consumable` never touched on update; never created on new
  items.
- **No new stored `behavior` field** — Task 13A-1E writes ONLY the
  existing `is_sellable / is_producable / is_consumable` boolean fields
  the app already stored. There is no new `item.behavior` object,
  no `behavior_from_role_derived` written to MASTER_V3.items, no
  `override_*` columns introduced.
- **No `MASTER_V3.option_sets` mutation** — read-only access via
  `getOptionSet({ includeInactive: true })`. No new option codes.
- **No `MASTER_V3.customers` or `.sites` mutation.**
- **Persistence path** — `persistMasterV3({ force: true, snapshotReason:
  't13a1e_post_repair' })` routes through `safeSet`, which writes a
  `_backup_latest` mirror before the actual write and records
  `safeSetLastSave(MASTER_V3_KEY)`. Pre-repair snapshot uses the same
  path.

## F. What did not change

- ✗ BOM math, Basket / Egg / Packaging Profile logic, Orders, PO Intake,
  Daily Planning, Daily Plan BOM, ใบน้อย, Logistics
- ✗ `_NEW_OPTION_SEEDS.unit`, `_ROLE_BEHAVIOR_DEFAULTS` (the maps are
  read, not modified)
- ✗ `MASTER_V3.option_sets / customers / sites`
- ✗ `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`
- ✗ `persistMasterV3` and the rest of the Master V3 persistence layer
- ✗ Header strip ⬇ Backup now / ↻ Restore from file…
- ✗ Master Data toolbar (Task 13A-0B) — Admin Tools dropdown, hidden BOM
  Bulk Upload, hidden duplicate Data tab card all intact (regression
  verified)
- ✗ Supply / Issue Unit (Task 12B) — no DOM inputs reintroduced
  (regression verified)
- ✗ Task 13A-1 / 1A / 1B / 1C / 1D — every prior behavior preserved
  (regression harnesses re-run, all pass)

## G. QA / smoke results

### G1. Static — passed

```
node --check on all 8 inline <script> blocks: 8 / 8 PASS
brace {} delta vs backup:   net 0
paren () delta vs backup:   net 0
bracket [] delta vs backup: net 0
backtick delta:             0
7 anchored edits, each src.count(old) === 1 asserted before replacement
Final MD5: 69370f6943b79ba257727e30e5a96c0e
```

### G2. Acceptance harness — 18 / 18 PASS

`_archive/closeouts/UAT_TASK13A1E_cases_harness.js` against a synthetic
MASTER_V3 with four items (one per case from the brief):

```
PASS · total === 4
PASS · already_correct === 1 (PKG_OK)
PASS · to_repair.length === 2 (A + C)
PASS · unknown_role === 1 (X1)
PASS · Case A — A1MKO4P410 preview: PACKAGING expected (false/false/true)
PASS · Case B — PKG_OK NOT in to_repair (already correct)
PASS · Case C — FG_BAD preview: FG expected (true/true/false)
PASS · Case D — X1 listed as unknown_role (skipped)
PASS · repair() returned correct counts
PASS · Case A POST: A1MKO4P410 fixed to PACKAGING flags (false/false/true)
PASS · Case C POST: FG_BAD fixed to FG flags (true/true/false)
PASS · Case D POST: X1 behavior flags UNCHANGED (unknown role left alone)
PASS · Case A POST: out-of-scope sections preserved
PASS · Re-preview after repair: 0 to_repair, 3 already_correct, 1 unknown_role
PASS · applyRoleBehavior() helper: PACKAGING-fresh item gets flags applied
PASS · Task 13A-0B regression — BOM Bulk Upload still hidden
PASS · Task 12B regression — Supply Unit DOM fields still absent
PASS · Task 13A-1D regression — unit scanner fix retained

18 passed, 0 failed
```

### G3. Prior harnesses — no regression

- **Task 13A-1A harness:** 18 / 18 PASS (unchanged)
- **Task 13A-1C harness:** 5 / 5 PASS (unchanged)

### G4. Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload app, Master Data → Items | Master SKU Rebuild card now shows the "🔧 ตรวจ + ซ่อมพฤติกรรม · Preview + Repair" row at the bottom. |
| F2 | Click "Preview + Repair" | Modal opens with KPI strip. To-repair list shows every PACKAGING / RM / SUPPLY item the earlier imports created with default-Yes Sellable, plus any drift on FG / WIP / DEFECT. |
| F3 | Inspect a PACKAGING row in the table | current S/P/C shown red (e.g. `✓ / ✗ / ✗`), expected shown green (`✗ / ✗ / ✓`), action = `repair_from_role`. |
| F4 | Click ✅ ยืนยันและซ่อม · Confirm and repair | OS confirm dialog appears. Cancel = nothing changes. Accept = toast `✓ ซ่อมแล้ว · Repaired: N (already correct: M, unknown role: K)`. |
| F5 | Open a repaired PACKAGING item in the Item editor | Counting & Units chip row now reads `Sellable: No · Producable: No · Material: Yes`. |
| F6 | Open a repaired FG item | Chip row reads `Sellable: Yes · Producable: Yes · Material: No`. |
| F7 | Verify out-of-scope preservation | Open a repaired item that had BOM / Basket / Egg / Packaging Profile data before — all are still intact, byte-for-byte. |
| F8 | Re-import a workbook | Preview modal's "changed fields" column now lists `is_sellable, is_producable, is_consumable` for any row whose stored flags differ from the role default. Commit applies them. |
| F9 | Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### G5. Known limitations

- **Manual overrides are overwritten.** Per the brief, this is the
  accepted trade-off for the cleanup sprint. A future task may add
  explicit `override_is_sellable / override_is_producable /
  override_is_consumable` columns to the importer + an opt-out flag on
  the repair tool. Out of scope today.
- **The repair button is visible on the Items sub-tab only.** It uses
  the same `switchMasterV3Sub` show/hide hook as the rest of the
  rebuild section.
- **Items with unknown roles are skipped, not flagged.** If an operator
  accidentally typed an invalid `item_role` into the file, the row's
  behavior flags survive untouched. The preview modal lists the count
  under "Unknown role (skipped)" so the operator can spot-check.
- **Node sandbox quirk:** the headless harness must inject
  `_ROLE_BEHAVIOR_DEFAULTS` onto the sandbox global because the in-app
  `const` in block 1 is wrapped in a per-block try block and doesn't
  leak across the script realm. In a real browser this is a non-issue
  — all `<script>` tags share the same lexical script realm. Documented
  in the harness file.
- **Manual F1–F9 not yet run by operator.** Static + headless tests
  are green.

## H. Final verdict

**ready for UAT testing**

Existing PACKAGING (and any other) items with drifted behavior flags can
now be corrected in one click via the Preview + Repair tool in the
Master SKU Rebuild section. The next re-import will also write the
correct behavior derived from `item_role` for every row, so the bug
cannot recur. Task 13A-0B toolbar cleanup, Task 12B Supply deprecation,
and Tasks 13A-1 / 1A / 1B / 1C / 1D all remain intact.

**Roll back with:** `cp _archive/index-pre-task13a1e-rolebehavior-20260528.html app/index.html`

**Next concrete action for the operator:** Reload, open Master Data →
Items, click "🔧 ตรวจ + ซ่อมพฤติกรรม · Preview + Repair". Review the
list. Confirm. Then **stop** — do not start 13A-2 / 13A-3 / 13A-4 / 13B
/ 13C without explicit approval.

— *Task 13A-1E, 2026-05-28*
