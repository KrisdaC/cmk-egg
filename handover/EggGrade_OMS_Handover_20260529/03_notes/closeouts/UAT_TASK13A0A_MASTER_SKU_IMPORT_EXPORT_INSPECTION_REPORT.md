# UAT Task 13A-0A — Master SKU Import / Export Path Inspection — Decision-only audit

**Date:** 2026-05-28
**Author:** Claude (UAT pair)
**Branch:** UAT single-file (`app/index.html`)
**Status:** Inspection complete — waiting for user decision
**App MD5 (pre-inspection):** `c868c799b932212c82506ef0e6306044`
**App MD5 (post-inspection):** `c868c799b932212c82506ef0e6306044`  *(identical — no code changed)*
**No backup created:** this is an inspection / report sprint only. No `app/index.html` edit was made, so no `_archive/index-pre-*.html` was needed.
**Rollback:** none required. If this report itself needs to be removed: `rm _archive/closeouts/UAT_TASK13A0A_MASTER_SKU_IMPORT_EXPORT_INSPECTION_REPORT.md`.

This sprint is an audit only. It maps every existing import / export / upload
path that operators can reach today, classifies each one, and proposes a
deprecation / hide / keep plan for Task 13A-0B. **No code, UI, data, or
BUG_LOG entry was changed.**

---

## A. Inspection scope

### Files inspected (read-only)

| File | Purpose for this audit |
|---|---|
| `app/index.html` (26,644 lines, MD5 `c868c799…`) | The working system — the only place import / export / upload paths can live for the UAT |
| `_archive/closeouts/UAT_TASK10C_BOM_BULK_UPLOAD_DEPRECATION_CLOSEOUT.md` | Confirms BOM Bulk Upload is policy-deprecated since 2026-05-25 |
| `_archive/closeouts/UAT_TASK11B_MASTER_DATA_LEGACY_CTA_CLEANUP_CLOSEOUT.md` | Confirms the Master Data toolbar already carries Admin / Legacy / Danger group labels and that 🧪 BOM Bulk Upload + 🗑 Clear Master Data are visibly demoted/danger-styled |
| `_archive/closeouts/UAT_TASK7E_BOM_ITEM_MASTER_REIMPORT_CLOSEOUT.md` | Confirms the Master JSON Restore path is the operator-sanctioned route for the corrected master files (`demand_master_v3_corrected_v*_*.json`) |
| `_archive/closeouts-2026-05-18/UAT_TASK1_SAFESET_CLOSEOUT.md` (referenced via brief) | Confirms `safeSet` / `safeSetLastSave` / `listAllBackups` / `restoreFromBackup` are the persistence/backup core and must not be modified |
| `_archive/closeouts-2026-05-18/UAT_TASK2_HEADER_STRIP_CLOSEOUT.md` (referenced via brief) | Confirms the header strip's ⬇ Backup now / ↻ Restore from file… are the canonical safety tools |
| `docs/BUG_LOG.md` | Current open / deprecated-path rows — context for status decisions; no row added or modified by this sprint |
| `docs/DEV_HANDOVER_2026-05-25.md`, `docs/DEV_HANDOVER_2026-05-18.md` | Master Data contract + unit-conversion rule reminder |

### Search terms used (bash `grep -nE`)

```
openBomBulkUpload | parseBomWorkbook | _bomApplyCommit | _bomMapLegacyPackagingRow
exportMasterV3 | importMasterV3JsonFile | importMasterFromXlsx | parseImporterWorkbook
clearMasterV3 | masterJsonRestoreInput | importFileInput | commitImport
downloadFullBackup | restoreFromFile | restoreMasterV3FromBackup
listMasterV3Backups | debugMasterV3Storage | listAllBackups
safeSet | importAllData | exportAllData
type="file" | FileReader | XLSX.read | XLSX.utils
onMakroPoFile | onBigCPoFile | onThaifoodPoFile | onPoUploadInRow
parseMakroPoSheet | parseBigCPoXlsx | parseThaifoodPoXlsx
exportLines | clearUploaded | fileInput
⬇ Backup | ↻ Restore | Restore from file | Import All | Export All
```

### UI surfaces inspected

| UI surface | Lines (approx) | Notes |
|---|---|---|
| Global header strip — `appHeaderStrip` | 1649–1672 | ⬇ Backup now + ↻ Restore from file… (Task 2) |
| Orders header — PO Upload dropdown | 1985–1992 + 12924 | Makro / BigC / Thaifood / CJ PO file inputs |
| Master Data sub-tabs + toolbar `v3-toolbar` | 2155–2195 | All five master data CTAs |
| Data & Settings tab — "Backup & restore all data" yellow card | 2245–2253 | ⬇ Export All Data / ⬆ Import All Data |
| Data & Settings tab — Daily-plan drop-zone | 2257–2270 | `fileInput`, `clearUploaded()`, `exportLines()` |
| Item edit modal | n/a | Verified: no master-SKU import/export entry point exists inside `openEditItem` |

### Function-level entry points cataloged

```
9284  exportMasterV3()                          // writes demand_master_v3.json
9298  importMasterV3JsonFile(file)              // 🔄 Restore Master JSON handler
9391  clearMasterV3()                           // 🗑 Clear Master Data handler
9410  debugMasterV3Storage()                    // console diagnostic
9440  listMasterV3Backups()                     // console enumeration
9459  restoreMasterV3FromBackup(backupKey)      // console-only emergency restore
9494  _wireImporter()                           // binds #importFileInput to importMasterFromXlsx
7081  downloadFullBackup()                      // header-strip ⬇ Backup now
7166  restoreFromFile(file)                     // header-strip ↻ Restore from file…
7336  importMasterFromXlsx(file)                // Master Excel import entry
7361  parseImporterWorkbook(wb)                 // 3-sheet parser (Customers / Sites / Items)
8100  commitImport()                            // Master Excel preview → commit
22583 _bomMapLegacyPackagingRow(arr)            // legacy "Master Packaging SKUs" row mapper
22599 parseBomWorkbook(wb)                      // legacy 2-sheet BOM parser
22693 _bomApplyCommit(parsed)                   // wholesale write of bom.components + packaging upsert
22762 openBomBulkUpload()                       // 🧪 BOM Bulk Upload button handler (DEPRECATED policy 2026-05-25)
22787 showBomImportPreview(parsed)              // preview modal
22893 commitBomImport()                         // commit confirm + apply
22905 _bomDownloadImportReview()                // 3-sheet xlsx review export
26488 exportAllData()                           // older Data-tab Export All
26524 importAllData(file)                       // older Data-tab Import All (also what restoreFromFile delegates to)
13846 onPoUploadInRow(invId, files)             // per-row PO upload (in-Order context)
15825 parseBigCPoCsv / 15996 parseBigCPoXlsx
16168 onBigCPoFile / 16397 parseThaifoodPoXlsx
16549 onThaifoodPoFile / 16824 onMakroPoFile / 16846 parseMakroPoSheet
6869  safeSet(key, payload, opts)               // Task 1 core (protected — do not modify)
6958  safeSetLastSave(key)                      // Task 1 helper
6972  listAllBackups()                          // Task 1 enumeration
7012  restoreFromBackup(sourceKey)              // Task 1 console restore
```

### What is OUT of scope for this audit

- PO upload parsers (`onMakroPoFile`, `onBigCPoFile`, `onThaifoodPoFile`, `onPoUploadInRow`, `parseMakroPoSheet`, `parseBigCPoXlsx`, `parseThaifoodPoXlsx`, `parseBigCPoCsv`) — these ingest customer purchase orders, not Master SKU / BOM / packaging data. Listed for completeness only; **no rebuild decision applies to them**.
- Daily-plan-day drop zone (`fileInput`, `clearUploaded`, `exportLines`) — daily ops data, not Master.
- `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup` (Task 1 core) — protected primitives. Listed in the audit table so the difference between *backup/restore safety tools* and *Master SKU re-import tools* is explicit, but their classification is permanently DO NOT TOUCH per the project's hard constraints.

---

## B. Feature audit table

Columns: **F** = feature; **UI** = where the operator sees it today; **Fn** = function name(s) entered; **Behavior** = one-line summary; **Data** = what it writes/reads; **Commit** = does it persist immediately?; **Dry-run** = is there a preview step before committing?; **Diff** = is the operator shown a record-level diff before commit?; **Operator?** = can a normal user reach it from the UI (no console)?; **Risk** = principal risk; **Recommend** = decision class; **Reason** = short justification.

### B.1 Master Data toolbar (the cluster the brief calls out)

| F | UI | Fn | Behavior | Data | Commit | Dry-run | Diff | Operator? | Risk | Recommend | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ⬆ Import Master Excel | Master Data → "Admin" group → ⬆ Import Master Excel (line 2182) | `importMasterFromXlsx` → `parseImporterWorkbook` → `showImportPreview` → `commitImport` | Parses a 3-sheet workbook (Customers, Delivery Sites, Items header at row 4). Validates via `validateMasterImportCandidate` + Phase 6A reference protection. Shows a preview modal. **Commit replaces Master Data** (button label literally reads "แทนที่ Master Data · Replace Master Data" at line 2238). | Writes `MASTER_V3.customers / sites / items`; preserves `option_sets`; routes through `persistMasterV3` (which routes through `safeSet`) | Only on explicit click of "Replace Master Data" in preview modal | ✔ preview modal lists records + counts + issues | ✗ no per-record diff vs current master — it's "replace all" | ✔ button visible in Master Data toolbar | **Wholesale replace** of customers/sites/items. Unit model coverage is partial (writes `units.base_per_pack/basket/palette` but not `storage_unit`/`consumable_unit`/`base_per_storage`/`base_per_consumable`). Item.bom not touched. Has Phase 6A reference protection (blocks if active Orders/Planning reference would break). | **DEPRECATE LATER (operator path) — KEEP AS ADMIN ONLY** | The Identity + Counting & Units export/import in Task 13A-1 supersedes this path for ongoing Master SKU work. The validate-and-preview infrastructure (`validateMasterImportCandidate`, Phase 6A `_collectReferencedMasterKeys`) is reusable for the new path and must not be deleted. Hide from the default Master Data toolbar; move behind an "Admin Tools" expandable so it stays available for emergency reload from a known-good xlsx, but doesn't sit next to the new importer. |
| 🧪 BOM Bulk Upload | Master Data → "Legacy" group → 🧪 BOM Bulk Upload (line 2185) — already styled with dashed grey border, italic, and a ⚠ Deprecated amber pill | `openBomBulkUpload` → `parseBomWorkbook` → `_bomApplyCommit` (via `showBomImportPreview` → `commitBomImport`) | Parses a legacy 2-sheet workbook ("Master SKUs" header on row 7, "Master Packaging SKUs" header on row 2). Upserts packaging items as `item_role=PACKAGING` (hardcodes `base_unit='ชิ้น'`). **Replaces `item.bom.components` and `item.bom.routes` wholesale** on every FG re-import. | Writes `MASTER_V3.items[*]` (adds new packaging; upserts existing); writes `MASTER_V3.items[*].bom.components`, `…bom.routes`, `…bom.output_unit`, `…bom.updated_at`; writes `bom_material.{subgroup,family,net_cost,loss_pct,customer_scope}` (write-only legacy field no UI consumes). Routes through `persistMasterV3` via `safeSet`. | On explicit click of "Commit · บันทึก N FG + N packaging" in preview modal | ✔ preview modal shows FG/packaging counts, components, warnings | ✗ no per-record diff vs current; FG `bom.components` is overwritten, not merged | ✔ button still visible (handler intact, only visually demoted per Task 11B) | (1) **Replaces** `bom.components` (UAT-014). (2) Importer never reads `storage_unit` / `consumable_unit` / `base_per_storage` / `base_per_consumable` / `base_per_pack` (UAT-049). (3) Bypasses Counting & Units (writes hardcoded `base_unit='ชิ้น'`). (4) Bypasses Packaging Profile + Basket Profile + Egg Profile machinery built in Tasks 10A–12D. (5) Writes `bom_material.{group,subgroup,family}` which the BOM UI does not consume (write-only legacy data). | **HIDE LATER (operator path) — KEEP CODE FOR ROUND-TRIP** | Already policy-deprecated as of 2026-05-25 (Task 10C / UAT-049). It is on the rebuild critical path because it bypasses Counting & Units and the Packaging Profile / Basket Profile machinery that Tasks 10A–12D codified. Recommend removing the visible operator CTA (move the button into an Admin Tools collapsed panel OR fully hide and leave the function callable from console only) and keeping `openBomBulkUpload` / `parseBomWorkbook` / `_bomApplyCommit` defined for legacy round-trip. Re-importing the same legacy Packaging.xlsx on an FG would still nuke the new packaging profile data. |
| Export Master JSON | Master Data → "Admin" group → Export Master JSON (line 2186) | `exportMasterV3` | Writes `MASTER_V3` (customers / sites / items / option_sets / meta) verbatim to `demand_master_v3.json`. No filter, no transform. | Read-only; downloads JSON | n/a (writes a download) | n/a | n/a | ✔ button visible | None — it's a pure read of in-memory MASTER_V3 to a download. **This is the snapshot the operator uses as the source-of-truth file outside the app** (Task 7E proved the workflow). | **KEEP — it is the operator's offline edit/handover source** | This is the modern, full-fidelity Master snapshot. Operators round-trip via this file for every corrected master (`demand_master_v3_corrected_v*_*.json`). Do not touch. The new Task 13A-1 importer should accept this exact JSON shape on the import side. |
| 🔄 Restore Master JSON | Master Data → "Admin" group → 🔄 Restore Master JSON (line 2187) | `importMasterV3JsonFile` (file input `masterJsonRestoreInput`) | Reads `demand_master_v3.json`-shaped JSON. Validates at least one of customers/sites/items is a non-empty array. Confirms with current vs new counts. Writes a named pre-restore backup (`MASTER_V3_KEY + "_backup_before_json_restore_…"`) AND `_backup_latest`. Then `persistMasterV3({force:true, snapshotReason: "manual_master_json_restore"})` and `loadMasterV3()` / `ensureMasterOptionSets()` / re-renders. **Preserves existing `option_sets` if the file omits them.** Does NOT touch Orders / Planning / Uploads. | Replaces `MASTER_V3.customers / sites / items / meta`; preserves option_sets unless the file carries new ones; explicit pre-write backup | After single `confirm()` dialog | ✔ confirm dialog shows current → new counts | ✗ no per-record diff (replace, not merge) | ✔ button visible | Wholesale replace, but with explicit pre-restore backup + confirm. **This is the operator's safe re-import path** (the one Task 7E sanctioned). | **KEEP — operator-sanctioned re-import path** | The Task 7E re-import demonstrated that this is the safe path: pre-restore backup, named snapshot, confirm dialog, preserved option_sets, and integrates with `loadMasterV3` migration hooks. This is the **primary surface that Task 13A-1's "import → validate → preview diff → confirm → commit" flow should evolve from**, not replace. |
| 🗑 Clear Master Data | Master Data → "⚠ Danger" group → 🗑 Clear Master Data (line 2193) — already styled red dashed | `clearMasterV3` | `confirm()` then wipes MASTER_V3 (customers/sites/items → empty arrays; option_sets → `{}`). Writes a pre-clear timestamped backup before wiping. Then `persistMasterV3({force:true, snapshotReason:"clear_master_confirmed"})`. | Replaces `MASTER_V3` with empty arrays + empty `option_sets`. Writes `MASTER_V3_KEY + "_backup_" + ts + "__clear_master"` and `_backup_latest` before wiping. | After single `confirm()` dialog | ✗ none — it's a destructive button | ✗ no diff | ✔ button visible | Total data loss in one click. Existing safety: a pre-clear timestamped backup is written first. **Task 11B's danger styling and tooltip already make the operator aware**, and the tooltip tells them to ⬇ Backup now first. | **KEEP — but recommend moving deeper into an Admin Tools collapsed panel** | This is a danger-zone admin operation. The current visual treatment is loud; the lift to a collapsed Admin panel is cosmetic improvement only. The pre-clear timestamped backup is essential safety infrastructure — do not change. |

### B.2 Header strip (Task 2 safety tools — do not confuse with Master SKU re-import)

| F | UI | Fn | Behavior | Data | Commit | Dry-run | Diff | Operator? | Risk | Recommend | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ⬇ Backup now (header) | Global header strip → ⬇ Backup now (line 1656) | `downloadFullBackup` | Sweeps every `demand_dashboard_*` localStorage key into one JSON envelope (schema_version: 2, plus legacy `_keys` field for backward compat). Includes Orders, Planning, Master V3, Uploads, BOM_DONE, Saved Views, Lang, etc. Writes `cmk-uat-backup-YYYYMMDD-HHMM.json`. | Read-only; downloads JSON | n/a | n/a | n/a | ✔ button visible globally | None — pure read. **This is the operator's full-state safety net**, written for any pre-destructive operation. | **KEEP — top-priority safety tool, must not be touched** | This is the canonical pre-destructive safety net (Task 2). All danger paths (Clear Master, Restore Master JSON, BOM Bulk Upload commit) reference it in their tooltips. The header position makes it accessible at all times. Do not move, do not rename, do not collapse. |
| ↻ Restore from file… (header) | Global header strip → ↻ Restore from file… (line 1661) | `restoreFromFile` → `importAllData` | Accepts both the new envelope (`payload`) and the legacy envelope (`_keys`). Validates JSON, validates schema, shows operator confirm with: file name, build_id, exported_at, key count, master counts, placeholder warning. Then synthesizes the legacy shape and delegates to `importAllData`. **`importAllData` wipes every `demand_dashboard_*` key then writes the new ones, then reloads the page.** | Replaces every `demand_dashboard_*` key. Reloads page. | After TWO `confirm()` dialogs (one in `restoreFromFile`, one inside `importAllData`) | ✔ first confirm shows summary | ✗ no per-key diff | ✔ button visible globally | Total state replace — but only via a backup file written by ⬇ Backup now. Two confirms; not silently committable. | **KEEP — paired safety tool** | This is the only operator-reachable "restore the whole app from a backup" path. Do not touch. |
| ⬇ Export All Data (Data tab) | Data & Settings tab → yellow "Backup & restore all data" card (line 2250) | `exportAllData` | Older sibling of `downloadFullBackup`. Same sweep of `demand_dashboard_*` keys, but writes only the legacy `{_exportedAt, _appVersion, _keys}` envelope (no `payload`/`schema_version`/`counts`). Writes `cmk-uat-data-YYYY-MM-DDTHH-MM.json`. | Read-only; downloads JSON | n/a | n/a | n/a | ✔ in Data & Settings tab | Duplicates ⬇ Backup now functionally but with a strictly less-rich envelope. Existing operators may have muscle memory for it. | **NEED USER DECISION — keep or fold into ⬇ Backup now** | Two operator-visible "export everything" buttons (`exportAllData` in Data tab + `downloadFullBackup` in header) is redundant. Both write valid restore-ready files (importAllData accepts either). Recommend either (a) keep both — they're harmless duplicates and `exportAllData` predates Task 2 (no behavior change) — or (b) hide the Data-tab card since the header button supersedes it. **Do not delete the function** — `restoreFromFile` synthesizes the legacy shape and `importAllData` is on the hot path of every backup restore. |
| ⬆ Import All Data (Data tab) | Data & Settings tab → yellow card (line 2251) | `importAllData` (also reached from `restoreFromFile`) | Reads the legacy envelope (or anything with `_keys`). Two confirms. Wipes every `demand_dashboard_*` key. Writes new keys. Reloads page. | Replaces every `demand_dashboard_*` key | After two confirms | ✗ none — counts only | ✗ no diff | ✔ in Data & Settings tab | Total replace. Already gated by two confirms. | **NEED USER DECISION — keep or hide; do NOT delete the function** | Same as ⬇ Export All Data: redundant with header ↻ Restore from file…, but the function `importAllData` is the implementation that the header path delegates to. Hiding the visible button is acceptable; deleting the function is not. |

### B.3 Console-only emergency / diagnostic helpers (no operator CTA exists today)

| F | UI | Fn | Behavior | Data | Commit | Dry-run | Diff | Operator? | Risk | Recommend | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `restoreMasterV3FromBackup(backupKey)` | DevTools console only | `restoreMasterV3FromBackup` | Reads one named `MASTER_V3_KEY_backup_…` entry from localStorage and restores it into Master Data (in-memory + persisted). Writes a "before_restore" snapshot first. | Replaces `MASTER_V3.*` from the backup key | Immediate (function call) | ✗ | ✗ | ✗ console only (no button) | Bypasses the file-based confirm UX. Operator must know the key name. | **KEEP AS-IS — emergency-only via console** | This is the rollback escape hatch used in incident recovery. Per the project's hard constraints it must not be modified. It does not need a CTA (operators should not rummage among internal backup keys). |
| `listMasterV3Backups()` | DevTools console | `listMasterV3Backups` | Enumerates every `MASTER_V3_KEY_backup*` key with its C/S/I counts | Read-only | n/a | n/a | n/a | ✗ console only | None | **KEEP AS-IS** | Diagnostic. |
| `debugMasterV3Storage()` | DevTools console | `debugMasterV3Storage` | Prints memory vs localStorage counts + lists backups | Read-only | n/a | n/a | n/a | ✗ console only | None | **KEEP AS-IS** | Diagnostic. |
| `listAllBackups()` (Task 1) | DevTools console | `listAllBackups` (line 6972) | Enumerates every `_backup_*` key for the 11 protected localStorage keys | Read-only | n/a | n/a | n/a | ✗ console only | None | **DO NOT TOUCH** | Task 1 core — protected. |
| `restoreFromBackup(sourceKey)` (Task 1) | DevTools console | `restoreFromBackup` (line 7012) | Restores any single protected key from its `_backup_latest` | Replaces one key | Immediate | ✗ | ✗ | ✗ console only | UAT-003 known: in-memory state not auto-refreshed for generic keys (operator reloads page) | **DO NOT TOUCH** | Task 1 core — protected. |
| `safeSet(key, payload, opts)` (Task 1) | n/a (called everywhere) | `safeSet` (line 6869) | Backup-before-write + empty-overwrite guard + 30% shrink warning, on every persist | Writes any key | Immediate | ✗ | ✗ | ✗ infrastructure | None | **DO NOT TOUCH** | Task 1 core — protected. |

### B.4 Out-of-scope file paths (PO upload + daily plan) — listed for completeness only

| F | UI | Fn | Behavior | Recommend |
|---|---|---|---|---|
| Makro PO upload | Orders → ⬆ Upload PO ▾ → Makro · xlsx | `onMakroPoFile` → `parseMakroPoSheet` | Parses Makro PO xlsx → Orders | **DO NOT TOUCH** — PO ingestion, not Master Data |
| BigC PO upload | Orders → ⬆ Upload PO ▾ → BigC · csv or xlsx | `onBigCPoFile` → `parseBigCPoCsv` / `parseBigCPoXlsx` | Parses BigC PO → Orders | **DO NOT TOUCH** |
| Thaifood PO upload | Orders → ⬆ Upload PO ▾ → Thaifood · xlsx | `onThaifoodPoFile` → `parseThaifoodPoXlsx` | Parses Thaifood PO → Orders | **DO NOT TOUCH** |
| In-Order PO upload | Each Order row → 📄 file picker | `onPoUploadInRow` | Per-order PO replacement | **DO NOT TOUCH** |
| Daily plan drop zone | Data & Settings → drop zone (line 2262) | `fileInput` handler | Bulk daily plan xlsx ingest | **DO NOT TOUCH** — daily ops |
| Clear uploaded (daily) | Data & Settings | `clearUploaded` | Wipes daily plan uploads (keeps historical) | **DO NOT TOUCH** |
| Export filtered lines CSV | Data & Settings | `exportLines` | Daily plan CSV export | **DO NOT TOUCH** |

---

## C. Recommended decisions (Task 13A-0B input)

These are recommendations only. **No code or UI change is being made by this sprint.** The operator approves or amends in Task 13A-0B.

### KEEP — current safe features

- **⬇ Backup now (header)** — `downloadFullBackup` · the canonical pre-destructive safety net. Do not touch.
- **↻ Restore from file… (header)** — `restoreFromFile` → `importAllData` · paired safety. Do not touch.
- **Export Master JSON** — `exportMasterV3` · the operator's offline edit / handover source. Do not touch. Task 13A-1 should accept this file shape on the import side.
- **🔄 Restore Master JSON** — `importMasterV3JsonFile` · Task 7E-sanctioned re-import. **This is the surface to evolve from in Task 13A-1**, not replace. Pre-restore backup, confirm with counts, preserved option_sets, integrates with `loadMasterV3` migration hooks — all reusable.
- **🗑 Clear Master Data** — `clearMasterV3` · keep functionally as-is; current Task 11B styling is already loud. Consider moving into an Admin Tools collapsed panel (cosmetic).

### KEEP — backup / restore / emergency tools (separate category — these are NOT re-import tools)

- `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup` — Task 1 core, permanently protected.
- `persistMasterV3`, `restoreMasterV3FromBackup`, `listMasterV3Backups`, `debugMasterV3Storage`, `ensureMasterOptionSets` — Master V3 persistence layer, permanently protected.

### DEPRECATE LATER — old operator paths, do not use for new Master SKU rebuild

- **⬆ Import Master Excel** — function `importMasterFromXlsx` + `parseImporterWorkbook` + the existing `commitImport`. Move from the visible Master Data toolbar into an "Admin Tools" collapsed panel. Keep code intact — the validate-and-preview infrastructure is reusable for Task 13A-1.

### HIDE LATER — dangerous / confusing operator paths

- **🧪 BOM Bulk Upload** button — `openBomBulkUpload` is the visible CTA. Remove the button from the Master Data toolbar entirely (or move into Admin Tools collapsed panel with a clear "legacy round-trip only" header). Already policy-deprecated since 2026-05-25 (Task 10C / UAT-049). Keep all four code functions defined (`openBomBulkUpload`, `parseBomWorkbook`, `_bomApplyCommit`, `_bomMapLegacyPackagingRow`, plus the helpers `_bomBuildEggComponents`, `_bomBuildPackagingComponents`, `_bomFamilyFromSubgroup`, `showBomImportPreview`, `commitBomImport`, `_bomDownloadImportReview`) — they round-trip the legacy 2-sheet Packaging.xlsx files that exist on operator disks (e.g. `Master_Packaging_SKUs_upload.xlsx` is in the workspace root).

### ADMIN ONLY LATER — keep but clearly separated from the daily Master toolbar

- **⬇ Export All Data / ⬆ Import All Data** (Data & Settings yellow card) — these duplicate the header tools. Recommendation: keep the Data-tab card visible but move it behind a "▾ Admin Tools" expander on the Data & Settings tab. The functions `exportAllData` and `importAllData` MUST stay defined — `restoreFromFile` depends on `importAllData`.
- **🗑 Clear Master Data** — move to an Admin Tools collapsed panel for visual safety (cosmetic only).
- **⬆ Import Master Excel** — see "DEPRECATE LATER" — same Admin Tools panel.

### REMOVE FROM UI LATER — keep code for rollback, no operator CTA

- **🧪 BOM Bulk Upload** button — see "HIDE LATER".

### DO NOT TOUCH

- Header strip ⬇ Backup now + ↻ Restore from file…
- Export Master JSON / 🔄 Restore Master JSON (kept; evolve in 13A-1, do not delete)
- `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`
- `persistMasterV3`, `restoreMasterV3FromBackup`, `listMasterV3Backups`, `debugMasterV3Storage`, `ensureMasterOptionSets`
- All PO upload paths (out of scope)
- `fileInput` daily plan drop zone, `clearUploaded`, `exportLines` (out of scope — daily ops)
- `oms-production/` (project-wide hard constraint)

### NEED USER DECISION

1. **Are we hiding the ⬇ Export All Data / ⬆ Import All Data card from Data & Settings**, or keeping it as a redundant operator-visible copy of the header strip tools?
2. **Are we hiding 🧪 BOM Bulk Upload entirely**, or moving it into an Admin Tools collapsed panel with a "legacy round-trip only" header?
3. **For ⬆ Import Master Excel**: move to Admin Tools collapsed panel (recommended), or remove from the visible UI completely (operators have used it for the modern 3-sheet workbook).
4. **For 🗑 Clear Master Data**: keep where it is with the current loud styling, or move into Admin Tools panel?
5. **Scope of Task 13A-0B**: should the deprecation pass also add operator-facing copy ("Use Task 13A-1 import →" pointer banners) on each hidden/deprecated CTA, or stay silent and rely on the Admin Tools grouping?

---

## D. Risk summary

### D.1 BOM Bulk Upload risk (highest)

- **Wholesale replace of `bom.components` and `bom.routes`** on every FG re-import (UAT-014). Manual edits made in the Master Data item editor — which Tasks 9, 10A–12E built the modern UI for — are lost on re-import of the same legacy workbook.
- **Bypasses Counting & Units** (Task 5/7D/12B): hardcodes `base_unit = 'ชิ้น'`, never reads `storage_unit` / `consumable_unit` / `base_per_storage` / `base_per_consumable` / `base_per_pack`.
- **Bypasses Packaging Profile** (Task 10A/11D/11G), **Basket Profile** (Task 8C2), **Egg Profile** (Task 8A) — the profile-derived components materialized by `buildBomComponentLinesForItem` would be overwritten by whatever the workbook re-imports.
- **Writes `bom_material.{group,subgroup,family}`** — a shape no current BOM UI consumes; pure write-only legacy data at rest on ~125 items (Task 7E).
- Mitigation today: Task 11B's visible Deprecated pill and tooltip. Mitigation **needed**: remove the operator-facing CTA so the button can't be clicked by accident.

### D.2 Old SKU / Packaging Excel import risk

- ⬆ Import Master Excel writes `MASTER_V3.items[*].units.base_per_pack/basket/palette` from workbook columns but **does not** write `storage_unit`/`consumable_unit`/`base_per_storage`/`base_per_consumable` — those need to be set in the item editor afterwards. Items imported via this path go in with an incomplete unit model.
- This path predates the Packaging Profile / Basket Profile / Egg Profile editors and does not write any `bom.*` data — so packaging materialization, basket BOM, and egg profile remain unset until the operator opens each item in the editor.
- It is still useful as an emergency "reload from the master xlsx" path.

### D.3 Paths without preview/diff (commit-immediately)

- **🗑 Clear Master Data** — one confirm, no diff. Mitigated by Task 11B styling + pre-clear backup. Recommend keeping the styling, considering an Admin Tools panel lift.
- **🔄 Restore Master JSON** — one confirm; shows count summary but no per-record diff. Mitigated by named pre-restore backup. Acceptable today; **Task 13A-1 should add a real preview-diff step** when it builds on this surface.
- **⬆ Import Master Excel** — preview modal exists but is replace-not-merge. No per-record diff vs current master.
- **🧪 BOM Bulk Upload** — preview modal exists but commit is wholesale replace of `bom.components`.

### D.4 Paths that overwrite BOM components

- **🧪 BOM Bulk Upload** — see D.1.
- ⬆ Import Master Excel — does **not** overwrite `bom.components` (it skips the BOM tree entirely).
- 🔄 Restore Master JSON — replaces entire items[] which **does** carry `bom.*` (if the JSON has it); equivalent to a full reload from the file.

### D.5 Paths that bypass Counting & Units

- **🧪 BOM Bulk Upload** — bypasses (hardcodes `base_unit='ชิ้น'`).
- ⬆ Import Master Excel — writes the `pack/basket/palette` levels but not `storage`/`consumable`.

### D.6 Backup / restore tools mistakenly confused with re-import

- ⬇ Backup now is **not** a Master SKU export — it is a full-state safety snapshot of every `demand_dashboard_*` localStorage key, including Orders / Planning / Uploads / BOM_DONE / Saved Views / Lang.
- ↻ Restore from file… is **not** a Master SKU re-import — it replaces every `demand_dashboard_*` key and reloads the page.
- Export Master JSON / 🔄 Restore Master JSON **is** the Master SKU export/import — narrower scope, named pre-restore backup, preserves option_sets.

The two pairs must remain visually distinguishable in Task 13A-0B.

### D.7 Known BUG_LOG rows touching these paths (no row needs urgent change today)

- **UAT-003** (`workaround-in-place`): generic-key restore needs page reload. Out of scope for Task 13A.
- **UAT-014** (`deprecated-path`): BOM Bulk Upload wholesale replace. Already covered by UAT-049.
- **UAT-015** (`deprecated-path`): BOM Bulk Upload only recognizes legacy 2-sheet shape. Already covered by UAT-049.
- **UAT-049** (`deprecated-path`): canonical deprecation policy for BOM Bulk Upload. **Task 13A-0B will close the operator-visible part by removing the CTA.** Do not change UAT-049 in this audit.
- **UAT-052** (`open`): Supply / Issue Unit fully deprecated as a form section but legacy values preserved on items. Affects how Task 13A-1's importer should treat `units.consumable_unit` / `base_per_consumable` data at rest.

**Proposed BUG_LOG updates** (do NOT apply now; record here for Task 13A-0B's closeout):

- After Task 13A-0B hides 🧪 BOM Bulk Upload: update UAT-014 / UAT-015 / UAT-049 owner notes to record that the operator CTA is gone, while the function remains callable from console.
- After Task 13A-0B moves ⬆ Import Master Excel into Admin Tools: add a new UAT-row recording the relocation (severity 🟢 Low, `deprecated-path` or `workaround-in-place`).

No BUG_LOG change applied by Task 13A-0A.

---

## E. Proposed next task — TASK 13A-0B

This is a proposal only. The operator approves / amends and a separate closeout reports execution.

```text
TASK 13A-0B — Deprecate selected legacy import/export paths (UI-only)

Goal: thin the visible Master Data toolbar so operators see the minimum set of
safe CTAs for ongoing daily work, and the import/export rebuild in 13A-1+ has
a clean canvas to land on. NO function deleted. NO function refactored.
Master toolbar visual surgery only.

Recommended actions (in execution order, each a single anchored edit):

1. KEEP visible in the Master Data toolbar — no change:
     + Add Customer / Site / Item        (primary CTA)
     Export Master JSON                  (the operator's offline source)
     🔄 Restore Master JSON              (Task 7E-sanctioned re-import path)

2. MOVE into a new "▾ Admin Tools" collapsed panel below the toolbar (or behind
   a single "Admin Tools" button that opens a small dropdown):
     ⬆ Import Master Excel
     🗑 Clear Master Data
   Keep both buttons' click handlers exactly as-is (importFileInput click,
   clearMasterV3). Only the DOM position and the "Admin" group label change.

3. HIDE the 🧪 BOM Bulk Upload button from the toolbar entirely. Either:
     (a) move into the "▾ Admin Tools" panel with a clear "legacy round-trip
         only — UAT-049" header, OR
     (b) remove the button from the DOM (do NOT delete the function).
   The four parser/commit functions and the helper functions remain defined
   for legacy round-trip. The hidden #masterJsonRestoreInput pattern is the
   reference: the input stays in the DOM, only the visible button is removed
   if option (b) is chosen.

4. KEEP the global header strip exactly as-is — ⬇ Backup now and ↻ Restore
   from file… stay where operators learned to find them.

5. CONSIDER hiding the Data & Settings tab's yellow "Backup & restore all
   data" card (⬇ Export All Data / ⬆ Import All Data) because the header
   strip supersedes it. Do NOT delete the functions: `restoreFromFile`
   delegates to `importAllData`, and the synthetic-file path needs it.
   This is the question marked NEED USER DECISION #1 above.

6. NEED USER DECISION on the five questions in § C.

7. Closeout report at _archive/closeouts/UAT_TASK13A0B_*.md, sections A–H,
   matching the existing format. List exact anchored edits. Record
   pre/post MD5. Save backup as
   _archive/index-pre-master-cta-deprecate-20260528.html.

8. QA gate: docs/QA_CHECKLIST.md Section K regression rows + manual checks
   that every hidden function still works when called from console
   (openBomBulkUpload(), exportAllData(), importAllData(file), clearMasterV3(),
   restoreMasterV3FromBackup(), and the visible header strip pair).

Do NOT do in 13A-0B:
   - No new export. No new import. No new parser. No new validator.
   - No data mutation. No localStorage key renaming.
   - No app/index.html structural refactor.
   - No BOM math / Basket Profile / Egg Profile / Packaging Profile change.
   - No oms-production/ change.

Do NOT start 13A-1, 13A-2, 13A-3, 13A-4, 13B, 13C from inside 13A-0B.
```

The above is **not started by this audit**.

---

## F. What did not change in Task 13A-0A

Verified by file diff (`md5sum` before == after) and by the absence of any Edit / Write call against `app/index.html`, `docs/BUG_LOG.md`, `docs/DEV_HANDOVER_*.md`, `demand_master_v3.json`, or any other workspace file other than the new audit report.

- ✗ no code in `app/index.html` changed
- ✗ no UI changed (no button hidden, moved, deleted, restyled)
- ✗ no data changed (no localStorage write, no MASTER_V3 mutation, no `option_sets` mutation)
- ✗ no new import or export tool built
- ✗ no parser added
- ✗ no validation logic added
- ✗ no commit flow added
- ✗ no BOM math changed
- ✗ no Basket Profile / Egg Profile / Packaging Profile logic changed
- ✗ no Orders / PO Intake / Daily Planning / ใบน้อย / Logistics behavior changed
- ✗ no `option_sets` mutation
- ✗ no `oms-production/` change
- ✗ no `docs/BUG_LOG.md` row added, edited, moved, or status-changed
- ✗ no `docs/DEV_HANDOVER_*.md` change
- ✗ no `safeSet` / `safeSetLastSave` / `listAllBackups` / `restoreFromBackup` modification
- ✗ no `_archive/index-pre-*.html` backup created (none needed — no edit)

Only this single file was added:
- `_archive/closeouts/UAT_TASK13A0A_MASTER_SKU_IMPORT_EXPORT_INSPECTION_REPORT.md` (this report)

`app/index.html` MD5: `c868c799b932212c82506ef0e6306044` — identical before and after this audit.

---

## G. Decision checklist for the operator

Tick what to do in Task 13A-0B. Anything left unticked stays as-is.

```
[ ] Approve KEEPING in the visible Master Data toolbar:
       + Add Customer / Site / Item
       Export Master JSON
       🔄 Restore Master JSON

[ ] Approve KEEPING the global header strip exactly as-is:
       ⬇ Backup now
       ↻ Restore from file…

[ ] Approve MOVING into an "▾ Admin Tools" collapsed panel (handler unchanged):
       ⬆ Import Master Excel
       🗑 Clear Master Data

[ ] Approve HIDING the 🧪 BOM Bulk Upload button from the toolbar
    (keep openBomBulkUpload / parseBomWorkbook / _bomApplyCommit defined for
    legacy round-trip via console). Decide:
       ( ) (a) into the Admin Tools collapsed panel under a "legacy" header
       ( ) (b) remove button from DOM entirely

[ ] Approve HIDING the Data & Settings tab's "Backup & restore all data" yellow
    card (⬇ Export All Data / ⬆ Import All Data). Functions stay defined.
       ( ) Keep visible (status quo)
       ( ) Hide the visible card

[ ] Approve a new "13A-0B closeout will record BUG_LOG updates for UAT-014 /
    UAT-015 / UAT-049 / a new relocation row" plan, with no row touched until
    that closeout runs.

[ ] Approve starting Task 13A-0B (UI-only deprecation pass, no rebuild) after
    the boxes above are ticked.

[ ] Defer Task 13A-1 Identity + Counting & Units export/import until after
    13A-0B is QA-green.
```

---

## H. Final verdict

**inspection complete — waiting for user decision**

No code, UI, data, or BUG_LOG entry was changed by Task 13A-0A. Task 13A-0B has been scoped and is NOT started.
