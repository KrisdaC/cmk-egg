# UAT Task 13A-1D — Unit reference scanner fix (UAT-019 / UAT-031) — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual F-rows below not yet run)
**Pre-edit app MD5:** `f2d66a3ff8aa65af9c5c65368664a77b`
**Post-edit app MD5:** `64baf5a3f0427d35ab81a0d4708258ee`
**Rollback:** `cp _archive/index-pre-task13a1d-uatv019fix-20260528.html app/index.html`

Operator request: *"please add all to control list and delete what we not use"*.

This is not a new feature — the app already has both halves wired:

- **Add path (auto, on boot):** `reconcileControlledListsFromMasterData()`
  scans every item's `base / pack / basket / palette / storage / consumable /
  selling_unit` field and adds any missing unit value to
  `MASTER_V3.option_sets.unit`. Wired at boot (line 18827).
  Also reachable manually via the **🔄 เพิ่มค่าที่ใช้อยู่จริงเข้า
  Controlled Lists · Sync from current master values** button in Master Data
  → Controlled Lists → Unit.
- **Delete path (auto, on boot):** `_pruneStaleUnitOptions()` removes any
  unit option that is **not** in the canonical seed (`_NEW_OPTION_SEEDS.unit`)
  AND **not referenced by any item**. Wired at boot (line 18829).

But there was a real **bug** in the reference scanner used by both helpers
(documented as **UAT-019** and **UAT-031** in `docs/BUG_LOG.md`, both still
open as of this sprint): `isOptionValueReferenced('unit', code)` scanned
`base_unit / pack_unit / basket_unit / palette_unit / selling_unit` but
**not** `storage_unit` or `consumable_unit`. So:

- A unit used only at the storage level (`units.storage_unit = 'พาเลท'`,
  for example, on a modern item that doesn't carry the legacy
  `units.palette_unit` field) was counted as **unreferenced**.
- The deactivate-warning in Controlled Lists could mis-classify such units as
  "safe to deactivate" when in fact they were in use.
- `_pruneStaleUnitOptions` could silently remove a unit that storage-only
  items still pointed to.

Single anchored edit extends the scanner to include both modern fields. No
new dependency, no UI added, no logic change beyond closing the gap. **0**
brace / paren / bracket / backtick delta vs the backup. `node --check`
clean on all 8 inline `<script>` blocks. Closes **UAT-019** and **UAT-031**.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1d-uatv019fix-20260528.html` |
| Pre-edit MD5 | `f2d66a3ff8aa65af9c5c65368664a77b` (post-Task-13A-1C) |
| Post-edit MD5 | `64baf5a3f0427d35ab81a0d4708258ee` |
| Bytes delta | ≈ +600 (the new scanner lines, plus comment markers) |
| Rollback | `cp _archive/index-pre-task13a1d-uatv019fix-20260528.html app/index.html` |

## B. What changed

Single anchored edit inside the `case 'unit':` branch of
`isOptionValueReferenced(setKey, code)` at line ~8693.

**Before:**

```javascript
case 'unit':
  scan(MASTER_V3.items, r => {
    const u = r.units || {};
    return _normCode(u.base_unit) === c
        || _normCode(u.pack_unit) === c
        || _normCode(u.basket_unit) === c
        || _normCode(u.palette_unit) === c
        || _normCode(r.selling_unit) === c;
  }, r => 'SKU ' + (r.sku||r.id));
  break;
```

**After:**

```javascript
case 'unit':
  // UAT Pro · Task 13A-1D · 2026-05-28 — closes UAT-019 / UAT-031.
  scan(MASTER_V3.items, r => {
    const u = r.units || {};
    return _normCode(u.base_unit) === c
        || _normCode(u.pack_unit) === c
        || _normCode(u.basket_unit) === c
        || _normCode(u.storage_unit) === c       // UAT Pro · Task 13A-1D
        || _normCode(u.consumable_unit) === c    // UAT Pro · Task 13A-1D
        || _normCode(u.palette_unit) === c
        || _normCode(r.selling_unit) === c;
  }, r => 'SKU ' + (r.sku||r.id));
  break;
```

Every downstream caller of `isOptionValueReferenced` benefits automatically:

- `_pruneStaleUnitOptions` (boot-time prune, line 8465-ish)
- The Controlled Lists deactivate warning (line 8603)
- The per-row "Used Where?" usage counts in the Unit option_set table
  (lines 8844, 8927)

## C. Behavior the operator will see

### C.1 What happens on the next page reload (no operator action required)

1. Boot calls `reconcileControlledListsFromMasterData({persist:true})` →
   scans every item, adds any unit value referenced anywhere into
   `MASTER_V3.option_sets.unit`. This already covered storage_unit and
   consumable_unit on the **scan-in side**; the fix here is on the
   **scan-out (prune / usage warning)** side.
2. Boot calls `_pruneStaleUnitOptions()` →
   removes any unit option not in the canonical seed
   (`_NEW_OPTION_SEEDS.unit` = 17 codes) AND not referenced by any item.
   With Task 13A-1D, storage-only and consumable-only references now keep
   units safe from being pruned.
3. The dropdowns in Item edit (Base unit / Pack unit / Storage unit / Selling unit)
   pick up the freshly-added codes. The `(Not in controlled list)` /
   `(ไม่อยู่ในรายการตัวเลือก)` suffix disappears for any unit your master
   data actually uses.

### C.2 What to do after reloading

- Open Master Data → Controlled Lists → **หน่วยนับ · Unit (display only)**.
  You should now see every unit your items use (ห่อ, ลัง, ฝา, etc.) listed
  as Active options. Old / unused entries will be gone if the prune
  removed them on boot.
- If anything looks off, click the existing **🔄 เพิ่มค่าที่ใช้อยู่จริงเข้า
  Controlled Lists · Sync from current master values** button — it's a
  manual re-trigger of the same `reconcileControlledListsFromMasterData`.
- To explicitly deactivate a unit option (don't delete; keep history),
  open that option's row and use the existing **ปิดใช้งาน · Deactivate**
  action. The Controlled-Lists usage panel now correctly counts
  storage/consumable references before letting you confirm.

### C.3 What still won't get auto-deleted

Even after the fix, a unit value stays in `option_sets.unit` if **any** item
references it via any unit field. That includes the legacy basket-TYPE
strings (`'M'`, `'S'`, `'A'`, `'PAK'`, `'CJ - Grey'`, `'Makro - green'`) on
about 30 SKUs (see UAT-025 / UAT-026 / Task 7B). `normalizeItemUnits`
displays them as `'ตะกร้า'` in the UI, but the underlying stored value is
the legacy code — so the prune keeps them, and the deactivate warning will
correctly flag them as "still in use" if you try.

If you want those legacy basket-TYPE entries gone, the right path is
Task 7B follow-up: replace `units.basket_unit = 'M'/'S'/'A'` with
`'ตะกร้า'` on the affected items. This is a separate data-cleanup task —
out of scope here.

## D. What did not change

- ✗ BOM math, Basket / Egg / Packaging Profile logic, Orders, PO Intake,
  Daily Planning, Daily Plan BOM, ใบน้อย, Logistics
- ✗ `_NEW_OPTION_SEEDS.unit` (the canonical seed is unchanged — 17 codes
  including ฟอง / ถาด / พาเลท / ใบ / ดวง / etc.)
- ✗ `MASTER_V3.option_sets` mutation by Task 13A-1D itself — the fix is in
  the **scanner used by** the existing add/prune helpers; those helpers
  still own the actual mutation.
- ✗ `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`
- ✗ `persistMasterV3` and the rest of the Master V3 persistence layer
- ✗ Header strip ⬇ Backup now / ↻ Restore from file…
- ✗ Master Data toolbar (Task 13A-0B) — Admin Tools dropdown, hidden BOM
  Bulk Upload, hidden duplicate Data tab card all intact
- ✗ Supply / Issue Unit (Task 12B) — no DOM inputs reintroduced, no
  active validation, supply still deprecated
- ✗ The Task 13A-1 Master SKU import flow — Task 13A-1A / B / C behavior
  unchanged
- ✗ The existing Controlled Lists UI

## E. QA / smoke results

### E.1 Static — passed

```
node --check on all 8 inline <script> blocks: 8 / 8 PASS
brace {} delta vs backup: 0
paren () delta vs backup: 0
1 anchored edit, src.count(old) === 1 asserted before replacement
Final MD5: 64baf5a3f0427d35ab81a0d4708258ee
```

### E.2 Manual UAT — F-rows for the operator

| # | Step | Expected |
|---|------|----------|
| F1 | Reload `app/index.html` in the browser | App boots normally; no console errors. The boot-time reconcile + prune run silently. |
| F2 | Master Data → Items → open one of the SKUs that previously said "(Not in controlled list)" on its Pack unit (e.g. `C19999P301`) | The Pack unit dropdown now shows `ห่อ` as a clean option (no suffix). Same for Storage unit `ลัง`, Base unit `ฝา` on the cover SKUs. |
| F3 | Master Data → Controlled Lists → click **หน่วยนับ · Unit (display only)** in the left list | Every unit your items use is listed (ห่อ / ลัง / ฝา / พาเลท / etc.) as Active. The "Used Where?" column shows the correct count for storage/consumable-only units (used to show 0; now shows the real number). |
| F4 | Click the **🔄 เพิ่มค่าที่ใช้อยู่จริงเข้า Controlled Lists · Sync from current master values** button | Toast: either `✓ Controlled Lists เป็นปัจจุบันอยู่แล้ว · already in sync` (if boot already reconciled), or a count of newly-added values. |
| F5 | Try to deactivate a unit you know is in use (e.g. `พาเลท`) | The deactivate-warning dialog now shows the real usage count (was 0 for storage-only — bug); the operator is correctly warned before deactivating. |
| F6 | Section K regression (`docs/QA_CHECKLIST.md`) | Orders / Daily Planning / Daily Plan BOM / Master Data / ใบน้อย / Logistics open normally. No console errors. |

### E.3 What this closes in BUG_LOG

- **UAT-019** (`workaround-in-place` → recommended `closed`):
  *"The usage map (~line 8405) checks base/pack/basket/palette_unit but not
  the new storage_unit / consumable_unit fields"* — closed by this sprint.
- **UAT-031** (`workaround-in-place` → recommended `closed`):
  *"_pruneStaleUnitOptions decides 'referenced' via isOptionValueReferenced,
  whose unit case scans base/pack/basket/palette/selling unit but NOT
  storage_unit / consumable_unit"* — closed by this sprint.

BUG_LOG.md is **not** auto-updated by this closeout (per the project
workflow: closeouts propose, operator applies). After F1–F6 pass, the
operator may move UAT-019 / UAT-031 to the **Closed** section with build
note `Task 13A-1D (2026-05-28)`.

## F. Final verdict

**ready for UAT testing**

A two-line scanner fix that closes UAT-019 and UAT-031, makes the existing
auto-reconcile and auto-prune correct, and makes the operator's "add all
to control list and delete what we not use" workflow work end-to-end on a
single page reload — no new buttons, no new flows, no new option_sets
mutation by Task 13A-1D itself.

**Roll back with:** `cp _archive/index-pre-task13a1d-uatv019fix-20260528.html app/index.html`

**Next concrete action for the operator:** Reload the page once. Open
Master Data → Controlled Lists → หน่วยนับ. Verify ห่อ / ลัง / ฝา are
present and that legacy / unused entries are gone (or, where they're
legacy basket-TYPE strings on items, that you understand they're kept
because items still reference them via `basket_unit`). Then **stop** —
do not start 13A-2 / 13A-3 / 13A-4 / 13B / 13C without explicit approval.

— *Task 13A-1D, 2026-05-28*
