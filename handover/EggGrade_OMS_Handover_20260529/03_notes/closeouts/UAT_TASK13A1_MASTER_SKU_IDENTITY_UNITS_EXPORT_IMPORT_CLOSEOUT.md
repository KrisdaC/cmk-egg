# UAT Task 13A-1 — Master SKU Identity + Counting & Units Export / Import — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA F-rows below not yet run)
**Pre-edit app MD5:** `bc0f7cd26d1570b2a0e788953afc1b3e`
**Post-edit app MD5:** `c7c9ebc5f4710541a582f670612c0c66`
**Rollback:** `cp _archive/index-pre-task13a1-skuid-units-20260528.html app/index.html`

The first real Master SKU rebuild tool. A new section "🛠 สร้างใหม่ Master SKU
· Master SKU Rebuild" appears below the Master Data Items toolbar with two
buttons: **⬇ ส่งออก Identity + Units · Export Identity + Units** and **⬆
นำเข้า Identity + Units · Import Identity + Units**. Export produces a 5-sheet
.xlsx (with a JSON fallback when XLSX is unavailable); Import runs a strict
dry-run → validate → preview/diff → confirm → commit pipeline that touches
ONLY Identity and Counting & Units fields. Out-of-scope structures (Basket,
Egg, BOM, Packaging, External References, unknown fields) are preserved by
deep-clone-then-overlay.

Three anchored edits to `app/index.html`. New self-contained `<script>` block
(~56 KB, IIFE-wrapped) appended after the existing inline scripts.
`node --check` clean on all 8 inline `<script>` blocks. Brace / paren / bracket
deltas all 0. 9 / 9 Node-vm acceptance cases pass.

---

## A. Backup

| Item | Value |
|---|---|
| Backup file | `_archive/index-pre-task13a1-skuid-units-20260528.html` |
| Pre-edit MD5 | `bc0f7cd26d1570b2a0e788953afc1b3e` (matches the post-Task-13A-0B file at start of sprint) |
| Post-edit MD5 | `c7c9ebc5f4710541a582f670612c0c66` |
| Bytes delta | +60,570 bytes (HTML section + JS module + show/hide hook) |
| Rollback command | `cp _archive/index-pre-task13a1-skuid-units-20260528.html app/index.html` |

A `_archive/index-pre-master-cta-deprecate-20260528.html` (Task 13A-0B backup)
is also available if a deeper rollback is needed.

## B. Sections / functions changed

### B.1 New UI section (HTML)

Added between the Master Data toolbar's closing `</div>` (post-13A-0B) and
the `master-table-wrap`. The section has `id="t13a1RebuildSection"` and is
hidden by default (`style="display:none"`). The new
`switchMasterV3Sub` hook (Edit B) toggles it visible only when `_v3Sub === "items"`.

Inside the section:
- Title: `🛠 สร้างใหม่ Master SKU · Master SKU Rebuild` (i18n key `t13a1_title`)
- Subtitle: `Step 1: Identity + Counting & Units only` (`t13a1_subtitle`)
- Scope statement, Thai-first and English (four lines, `t13a1_scope_th/_en` + `t13a1_preserve_th/_en`)
- Two CTAs:
  - `⬇ ส่งออก Identity + Units · Export Identity + Units` → `t13a1_exportIdentityUnits()`
  - `⬆ นำเข้า Identity + Units · Import Identity + Units` → `t13a1_openImportPicker()`
- Hidden `<input type="file" id="t13a1ImportInput">` wired to `t13a1_handleImportFile(f)` on change

### B.2 `switchMasterV3Sub()` (JS, surgical 6-line addition)

Right after the existing `v3RoleCtl` / `v3CustCtl` display toggles, added:

```javascript
// UAT Pro · Task 13A-1 · 2026-05-28 — Master SKU Rebuild section is items-only.
try {
  const _t13a1Sec = document.getElementById("t13a1RebuildSection");
  if (_t13a1Sec) _t13a1Sec.style.display = (sub === "items") ? "" : "none";
} catch (_e) {}
```

No other JS code touched in this function.

### B.3 New self-contained `<script>` block — Task 13A-1 module

Inserted **after** the existing final `</script>`, **before** `</body></html>`,
as a new `<script>` element so the diff is isolated and existing line numbers
are unchanged. Wrapped in an IIFE (`(function(){ … })();`) to avoid leaking
locals. Public surface (window-attached):

| Symbol | Purpose |
|---|---|
| `t13a1_exportIdentityUnits()` | Export entry. Builds 5 sheets, writes xlsx (or JSON if XLSX missing). |
| `t13a1_openImportPicker()` | Click the hidden `#t13a1ImportInput` file picker. |
| `t13a1_handleImportFile(file)` | Read+parse, validate, build diff, show preview modal. |
| `t13a1_closeImportModal()` | Close the preview modal. |
| `t13a1_confirmAndCommit()` | Confirm dialog + commit on click. Disabled when blocking errors > 0. |
| `T13A1` (namespace object) | Internal helpers exposed for the Node vm acceptance harness. |

Internal helpers (IIFE-local):

```
_clone, _str, _trim, _num, _bool, _now, _safeToast, _safeEscHtml
_customerByPartnerId, _customerByCode
_tryValidateItem, _tryNormalizeUnits, _trySellingFactor, _tryItemBaseFactor,
_tryItemTypeOptionsForRole, _tryGetOptionSet
_deriveRow
_buildFieldDictionary, _buildDropdownOptions, _buildValidationRules,
_buildCurrentValidationReport
_writeWorkbookDownload, _objsToAoA
exportIdentityUnits   (== t13a1_exportIdentityUnits)
openImportPicker, handleImportFile
_parseJsonImport, _parseXlsxImport, _aoaToObjects
validateImportRows, _computeRowChanges, buildDiff
showImportPreviewModal, closeImportModal, confirmAndCommit, commitImport
_overlayRowOntoItem, _overlayUnitsOntoItem
```

No existing function modified. No existing function removed. No existing
function renamed.

## C. Export structure

File name: `cmk-sku-identity-units-YYYYMMDD-HHmm.xlsx` (or `.json` fallback when
`XLSX` is not available — the sandbox case only).

**Sheet 1 — `SKU_Identity_Units`** · one row per `MASTER_V3.items` entry.
Columns (in order):

```
Identity:        sku, name_th, name_en, item_role, item_type, customer_code,
                 customer_name_derived, is_active, notes
Counting & Units: base_unit, base_factor, pack_unit, base_per_pack,
                 storage_unit, base_per_storage, selling_unit,
                 selling_base_factor_derived, selling_to_pack_ratio_derived,
                 pack_to_selling_ratio_derived, unit_ladder_summary_derived
Legacy (review): legacy_has_consumable_unit, legacy_consumable_unit,
                 legacy_base_per_consumable
```

Derived columns are review-only and never persisted. Legacy supply columns are
review-only and never active import fields.

**Sheet 2 — `Field_Dictionary_Identity_Units`** · 22 rows, one per exported
field. Columns: `section, field_key, column_name, thai_label, english_label,
data_type, required, required_when, editable_in_ui, dropdown_source,
allowed_values_source, validation_rule, example_value, notes, legacy_status`.
The three `units.consumable_*` rows carry `legacy_status = deprecated`.

**Sheet 3 — `Dropdown_Options_Identity_Units`** · option values used by
Identity + Counting & Units. Columns: `dropdown_name, source, code, label_th,
label_en, is_active, sort_order, used_in_field, notes`. Sources:
- `item_role` ← `option_sets` (`getOptionSet('item_role')`)
- `unit` ← `option_sets` (`getOptionSet('unit')`)
- `item_type` ← `hardcoded` (`getItemTypeOptionsForRole(role)` for each of FG / RM / WIP / PACKAGING / SUPPLY / DEFECT)
- `customer` ← `customers` (`MASTER_V3.customers`)

`MASTER_V3.option_sets` is read only — **never** mutated.

**Sheet 4 — `Validation_Rules_Identity_Units`** · 14 rules
(`R-IU-01 … R-IU-14`), columns: `rule_id, section, field_key, severity,
applies_to, condition, expected, error_message_th, error_message_en,
source_function, notes`. Rules marked `recommended_not_enforced` are clearly
flagged (e.g. R-IU-12 on supply, R-IU-14 on is_active default).

**Sheet 5 — `Current_Validation_Report`** · current data run through
`validateMasterItem` (and `normalizeItemUnits`-backed unit checks). Only rows
whose error / warning `field` lives in the Identity or Counting & Units sets
are surfaced. Columns: `sku, name, item_role, item_type, section, field_key,
severity, message_th, message_en, suggested_fix`.

## D. Import flow

```
1. operator clicks ⬆ นำเข้า Identity + Units
   → t13a1_openImportPicker() → #t13a1ImportInput.click()

2. Operator picks .xlsx or .json
   → t13a1_handleImportFile(file)
   → FileReader.readAsArrayBuffer (xlsx) | readAsText (json)
   → _parseXlsxImport / _parseJsonImport
       • Locate sheet named SKU_Identity_Units (case-insensitive); fall back
         to first sheet if absent.
       • Header row normalized: legacy aliases mapped
         (name→name_th, partner_id→customer_code, palette_unit→storage_unit,
          base_per_palette→base_per_storage).
       • Any non-allowlisted column is captured as an "ignored" column.

3. validateImportRows(rows) — pure function, no mutation.
   For each row:
     • Build per-row lookups for sku (existing item match) and customer_code.
     • Blocking errors: blank sku, duplicate sku in file, missing name_th,
       missing item_role, invalid item_role (option_sets), invalid item_type
       for role, missing base_unit, base_per_pack invalid/≤0 when pack_unit
       set, base_per_storage invalid/≤0 when storage_unit set, selling_unit
       that cannot resolve to a base factor via getSellingUnitBaseFactor.
     • Warnings: customer_code not found, base_unit not in option_sets,
       and the per-row create/update/unchanged narration.
     • Computed _action ∈ { 'create', 'update', 'unchanged' }.
     • For 'update': _changes[] of { field, before, after } for every
       allowed field that differs.

4. buildDiff(validatedRows) — partition into create / update / unchanged / error.

5. showImportPreviewModal — full-screen modal with KPI strip
   (Total / Create / Update / Unchanged / Blocking errors / Warnings),
   ignored-columns banner, scope reminder ("Basket/Egg/BOM/Packaging will be
   preserved"), and a per-row table (sku, name_th, action, errors, warnings,
   changed fields). Commit button is DISABLED when blocking_errors > 0.

6. Operator clicks ✅ ยืนยันและบันทึก · Confirm and commit.
   → t13a1_confirmAndCommit()
   → window.confirm() with the exact wording from the brief
     (Thai-first + English).

7. commitImport(parsed) — only path that mutates data:
     • Pre-import snapshot via persistMasterV3({snapshotReason:'t13a1_pre'}).
     • For each row with no _errors:
         - existing & unchanged → counted, no write
         - existing & update    → deep-clone existing item, deep-clone its
                                   .units, overlay ONLY allowed fields,
                                   stamp updated_at, replace in place.
         - new                  → minimal valid item: sku, name(/_th/_en),
                                   item_role, item_type, partner_id, is_active,
                                   notes, selling_unit, units. No empty bom,
                                   no empty basket_profile, no empty
                                   packaging_profile, NO supply fields.
     • Replace MASTER_V3.items, then persistMasterV3({force:true,
       snapshotReason:'t13a1_post'}) — goes through safeSet, which records a
       backup before the write and surfaces quota errors.
     • Re-render via renderV3Items + renderHeaderStrip.
     • Toast summary: created / updated / unchanged.

8. Success toast: "✓ นำเข้าสำเร็จ · Imported: N created, N updated, N unchanged".
```

No automatic commit immediately after upload. No silent commit. Every commit
is gated by an OS-level `confirm()` after the operator has reviewed the
preview modal.

## E. Identity + Counting & Units coverage

### E.1 Fields exported

| Section | Field | Source on item |
|---|---|---|
| Identity | `sku` | `item.sku` |
| Identity | `name_th` | `item.name_th` ?? `item.name` |
| Identity | `name_en` | `item.name_en` (often empty on legacy items) |
| Identity | `item_role` | `item.item_role` |
| Identity | `item_type` | `item.item_type` |
| Identity | `customer_code` | resolved from `item.partner_id` via `MASTER_V3.customers` |
| Identity | `customer_name_derived` | `customer.nickname` (review-only) |
| Identity | `is_active` | `item.is_active` (default true) |
| Identity | `notes` | `item.notes` (free text) |
| Counting & Units | `base_unit` | `units.base_unit` |
| Counting & Units | `base_factor` | always 1 (review-only) |
| Counting & Units | `pack_unit` | `units.pack_unit` (LABEL only) |
| Counting & Units | `base_per_pack` | `units.base_per_pack` (the real conversion integer) |
| Counting & Units | `storage_unit` | `units.storage_unit` (legacy `palette_unit` migrated at read) |
| Counting & Units | `base_per_storage` | `units.base_per_storage` (legacy `base_per_palette` migrated at read) |
| Counting & Units | `selling_unit` | `item.selling_unit` |
| Counting & Units | `selling_base_factor_derived` | `getSellingUnitBaseFactor(item)` (review-only) |
| Counting & Units | `selling_to_pack_ratio_derived` | `selling_factor / _itemBaseFactor(item)` (review-only) |
| Counting & Units | `pack_to_selling_ratio_derived` | inverse of above (review-only) |
| Counting & Units | `unit_ladder_summary_derived` | "1 ฟอง · 1 แพ็ค 10 = 30 ฟอง · 1 พาเลท = 3000 ฟอง" (review-only) |
| Legacy (review) | `legacy_has_consumable_unit` | `units.has_consumable_unit` |
| Legacy (review) | `legacy_consumable_unit` | `units.consumable_unit` |
| Legacy (review) | `legacy_base_per_consumable` | `units.base_per_consumable` |

### E.2 Fields the import flow is allowed to write

```
name_th  →  item.name AND item.name_th  (legacy compat: write both)
name_en  →  item.name_en
item_role
item_type
customer_code → item.partner_id (via customer.code lookup, preferring customer.id)
is_active
notes
units.base_unit
units.pack_unit
units.base_per_pack
units.storage_unit
units.base_per_storage
selling_unit
```

`base_factor` is exported as 1 but never written on import — it is documented
(by the Field Dictionary) as derived.

### E.3 Fields the import flow MUST NOT write

```
bom.*                                 — Basket / BOM components preserved
basket_profile.*
egg_profile.*
packaging_profile.*
external_refs.*
units.has_consumable_unit            — Supply / Issue Unit deprecation (Task 12B)
units.consumable_unit
units.base_per_consumable
routes
upload_mappings
audit fields (created_at, created_by …) — except updated_at, which the existing app stamps on every mutation
unknown / undocumented fields
```

## F. Preservation and safety

| Concern | How it's enforced |
|---|---|
| Basket Profile preserved | Deep-clone-then-overlay. `_overlayRowOntoItem` writes only the allowed Identity + Units fields; `basket_profile`, `units.has_basket_unit`, `units.basket_unit`, `units.base_per_basket` are never read or written. Verified in Case 3. |
| Egg Profile preserved | Same — `egg_profile.*`, `primary_grade`, `secondary_grade`, `min_primary`, `egg_content_type` never touched. Verified in Case 3. |
| BOM preserved | `bom.components`, `bom.routes`, `bom.enabled`, `bom.output_unit`, `bom.no_bom_required`, `bom.updated_at` never read or written. Verified in Case 3. |
| Packaging Profile preserved | `packaging_profile.*` (including the Task 10A `uses_base_pack` rule and any `_bomSyncPackBaseTray`-managed components) never touched. Verified in Case 3. |
| External References preserved | `external_refs.*`, `partner_codes`, `aliases`, `upload_mappings`, `barcode` never touched. Verified in Case 3. |
| Unknown fields preserved | Deep-clone-then-overlay strategy means any field not in the allowlist round-trips from the existing item. Verified in Case 3 with a synthetic `legacy_field`. |
| `MASTER_V3.option_sets` not mutated | Module never calls `addOption / updateOption / deactivateOption`. Reads via `getOptionSet`/`getOptionLabel` only. Verified by grep of the new code. |
| `MASTER_V3.customers` / `.sites` not mutated | `customer_code` resolution is read-only (`_customerByCode` iterates the array but never writes). No new customers created from an import row. |
| Supply / Issue Unit not reintroduced | `_overlayUnitsOntoItem` deliberately does NOT copy `legacy_has_consumable_unit / legacy_consumable_unit / legacy_base_per_consumable` from the row onto `item.units`. New items get a `units` object with NO supply keys. Verified in Cases 4 and 7. |
| Persist via existing path | `commitImport` calls `persistMasterV3({force:true, snapshotReason:'t13a1_post'})` which routes through `safeSet`, which writes a `_backup_latest` mirror before the actual write. The `snapshotReason` is recorded in `safeSetLastSave(MASTER_V3_KEY)`. |
| No new localStorage key | Module reads from `MASTER_V3` in memory only. `safeSet` writes to the existing `demand_dashboard_master_v3` key. |
| No new option_set value | Verified: module calls `getOptionSet` only with `{ includeInactive: true }`. |
| No new dependency | Reuses already-loaded XLSX library. JSON fallback uses only Blob / URL.createObjectURL / FileReader, all already in use elsewhere in the app. |

## G. QA / smoke results

### G.1 Static checks

| Check | Result |
|---|---|
| `node --check` per inline `<script>` block | **8 / 8 PASS** (including the new 56,985-byte Task 13A-1 module) |
| Brace `{}` delta vs backup | `+246 / +246` → **net 0** |
| Paren `()` delta vs backup | `+783 / +783` → **net 0** |
| Bracket `[]` delta vs backup | `+97 / +97` → **net 0** |
| Backtick delta | `+6` (three pairs of new template literals in the inline preview HTML) |
| Edit count | 3 anchored edits, each asserted `src.count(old) == 1` before replacement; plus one follow-up surgical fix to the `var msg = …` confirm-dialog string after a Python-heredoc `\n` escape issue was caught by `node --check` and immediately corrected (verified by re-running `node --check` and re-running every acceptance case). |
| Final post-edit MD5 | `c7c9ebc5f4710541a582f670612c0c66` |

### G.2 Node vm acceptance harness

`_archive/closeouts/UAT_TASK13A1_t13a1_acceptance.js` — extracts every inline
script from `app/index.html`, loads them into a `vm.createContext` sandbox
with browser stubs, then exercises the `T13A1` namespace against a synthetic
`MASTER_V3` containing two FG items, two customers, and option_sets for
`item_role` and `unit`. Result: **9 / 9 PASS** —

```
PASS · Case 1 — export rows include Identity, Units, derived ratios, legacy supply preservation
PASS · Case 2 — round-trip re-import: 0 blocking errors, no data loss
PASS · Case 3 — update existing SKU units: diff correct, out-of-scope preserved
PASS · Case 4 — new packaging SKU: created, 0 errors, no supply fields
PASS · Case 5 — duplicate SKU is blocking; commit refuses
PASS · Case 6 — invalid selling_unit blocks commit
PASS · Case 7 — legacy supply preserved on existing; not created on new
PASS · Case 8 — out-of-scope columns ignored; never written to item
PASS · Case 9 — Task 13A-0B + 12B regressions: hidden/preserved as expected
```

Reproduce with `node _archive/closeouts/UAT_TASK13A1_t13a1_acceptance.js` from
the repo root. The harness emits one harmless boot-time `[BUG-H3]` warning
about an unrelated `ORDERS is not defined` migration; that's the round-1
migration helper in the giant main JS block hitting a globals reference that
the sandbox didn't stub. It does not affect the Task 13A-1 module load (the
sandbox uses per-block try/catch).

### G.3 Manual UAT — F-rows (operator runs in real browser)

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data → Items sub-tab | "🛠 สร้างใหม่ Master SKU · Master SKU Rebuild" panel visible directly under the toolbar; the two CTAs are visible. Switching to Customers / Sites / Controlled Lists hides the panel. |
| F2 | Click ⬇ ส่งออก Identity + Units | A file `cmk-sku-identity-units-YYYYMMDD-HHmm.xlsx` downloads. Open in Excel — 5 sheets exist with the column shapes documented in § C. |
| F3 | Open the exported xlsx, do NOT change anything, then click ⬆ นำเข้า Identity + Units and pick the file | Preview modal opens; 0 blocking errors; total = item count; mostly "unchanged" rows; warnings only on "new SKU" or "customer not found" if applicable. |
| F4 | Confirm and commit the unchanged import | Toast: "✓ นำเข้าสำเร็จ · Imported: 0 created, 0 updated, N unchanged". MASTER_V3 unchanged. Open an item that had BOM / Basket / Egg Profile — they are all still there. |
| F5 | Edit one SKU's `base_per_pack` in Excel (e.g. 30 → 12), save, re-import | Preview row marked "update", `units.base_per_pack` listed under changed fields. Commit. Open the item in the Master Data editor — only the pack count changed. BOM / Basket / Egg Profile / Packaging Profile / External Refs intact. |
| F6 | Add a new row: sku=C19999P301, name_th=ถาดกระดาษ เล็ก, item_role=PACKAGING, item_type=tray, base_unit=ใบ, pack_unit=row, base_per_pack=500, storage_unit=box, base_per_storage=500, selling_unit=row. Re-import. | Preview row marked "create"; 0 blocking errors. Commit. New item appears in Master Data → Items. Item editor shows correct base/pack/storage; Supply / Issue Unit block is NOT rendered. |
| F7 | Add a duplicate row of the same SKU within the same file. Re-import. | Both rows show "duplicate sku in import file" blocking error. Commit button disabled. |
| F8 | Change one row's selling_unit to "ไม่มีหน่วยนี้" (not equal to base/pack/basket). Re-import. | Row shows "selling_unit cannot resolve to a base factor" blocking error. Commit button disabled. |
| F9 | In Excel, add an extra column `basket_profile.has_basket` = TRUE on every row. Re-import. | Preview shows "⚠ Out-of-scope columns ignored: basket_profile.has_basket". Existing rows where everything else is unchanged remain "unchanged". Commit accepted (zero blocking errors). Re-open any item — basket profile unchanged. |
| F10 | Verify Task 13A-0B regression: open Master Data toolbar | + Add, search, Show inactive, Export Master JSON, 🔄 Restore Master JSON, ⚙ Admin Tools dropdown visible. NO 🧪 BOM Bulk Upload button. ⚙ Admin Tools → ⬆ Import Master Excel + 🗑 Clear Master Data inside. |
| F11 | Verify Task 12B regression: open any item editor | Counting & Units section shows Base / Pack / Storage / Selling. NO Supply / Issue Unit active form fields. (Legacy items may show a small read-only legacy notice — unchanged from Task 12B.) |
| F12 | Verify header safety tools: header strip | ⬇ Backup now and ↻ Restore from file… both still visible and functional. |
| F13 | `docs/QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics open normally. No console errors. |

### G.4 Generated file name (sample)

`cmk-sku-identity-units-20260528-1730.xlsx`

### G.5 Known limitations

- **JSON fallback path** only triggers when `XLSX` is not loaded (e.g. Node
  sandbox in the acceptance harness). In the live UAT, XLSX is always present
  (loaded for PO upload + the existing BOM Bulk Upload code path), so the
  primary download is always .xlsx. The JSON envelope mirrors the same sheet
  shapes (`envelope.sheets[sheetName] = aoa`).
- **`item_type` option set divergence (UAT-023 / UAT-028 / UAT-030)** is
  reflected in the Field Dictionary's notes column (the hardcoded
  `getItemTypeOptionsForRole` map is the source of truth for the dropdown, NOT
  `option_sets.item_type`). Importer validates against the hardcoded map.
- **Customer lookup** is by `customer.code` only. If a customer's code is
  empty or duplicated across customers (rare), the first match wins. A future
  micro-pass can add a strict-mode that requires unique codes; the brief
  flagged this as acceptable warning-only.
- **Legacy `name` vs `name_th`** — the existing master uses a single `name`
  field for almost every item. Export emits the value as `name_th` and leaves
  `name_en` blank; import writes both `item.name` and `item.name_th` to keep
  every downstream consumer working (Daily Plan, BOM, ใบน้อย, etc.).
- **Re-importing the same exported xlsx without edits** can show a non-zero
  "update" count if a) any cell was retyped by Excel (e.g. number formatting
  forced a trailing decimal), or b) a customer_code was empty in the source
  but present-as-empty-string in the export. Behavior is correct (the diff
  detects the change) but cosmetic. Recommended workaround: leave the
  exported xlsx untouched for round-trip sanity tests.
- **The acceptance harness `[BUG-H3] ORDERS is not defined` warning** is
  unrelated to Task 13A-1. It is a boot-time round-migration helper in the
  main JS block hitting a missing sandbox global. Does not affect the module
  load.
- **Manual QA F1–F13 not yet run by operator.** Static + headless tests are
  green.

## H. Final verdict

**ready for UAT testing**

The Master SKU Rebuild section is in place; the export round-trips cleanly;
the import flow validates, previews, diffs, requires explicit confirmation,
and commits only Identity + Counting & Units. Out-of-scope structures
(Basket, Egg, BOM, Packaging, External References, unknown fields) are
preserved by deep-clone-then-overlay. Supply / Issue Unit is not
reintroduced. Task 13A-0B toolbar and Task 12B Supply deprecation are
unchanged. 9 / 9 acceptance cases pass headless.

**Roll back with:** `cp _archive/index-pre-task13a1-skuid-units-20260528.html app/index.html`

**Next concrete action for the operator:** run F1–F13 above (and Section K
regression). When green, **stop**. Do not start 13A-2 / 13A-3 / 13A-4 /
13B / 13C without explicit approval.

— *Task 13A-1, 2026-05-28*
