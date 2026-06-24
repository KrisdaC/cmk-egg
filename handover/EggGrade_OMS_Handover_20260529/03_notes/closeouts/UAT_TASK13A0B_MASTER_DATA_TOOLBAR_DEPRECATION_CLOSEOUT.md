# UAT Task 13A-0B — Master Data toolbar deprecation pass (UI-only) — Closeout

**Date:** 2026-05-28
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA F1–F12 below not yet run)
**Pre-edit app MD5:** `c868c799b932212c82506ef0e6306044`
**Post-edit app MD5:** `bf130b2496b1eebe391c49ba0df634aa`
**Rollback:** `cp _archive/index-pre-master-cta-deprecate-20260528.html app/index.html`

A small, visual-only reorganization of the Master Data toolbar and the Data &
Settings tab, executing the operator-approved decisions from Task 13A-0A.
**Zero function deleted, zero business logic changed, zero data mutated.**
Four anchored edits, +433 bytes total. Brace/paren/bracket/backtick balance
identical to the backup. All 7 inline `<script>` blocks pass `node --check`.

The visible Master Data toolbar now reads, left-to-right:

```
[+ Add …]  [filters]  [search]  [Show inactive]  …  Export Master JSON  🔄 Restore Master JSON  ⚙ Admin Tools ▾
```

The ⚙ Admin Tools dropdown contains the two admin-only paths (⬆ Import
Master Excel and 🗑 Clear Master Data). The legacy 🧪 BOM Bulk Upload button
is removed from the DOM, and the duplicate "Backup & restore all data" card
in the Data & Settings tab is hidden via `display:none`. All five hidden
functions remain defined and remain reachable from DevTools console for
emergency / round-trip use.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 4 anchored edits. (1) Master Data toolbar block at line ~2178 — replaced 15 lines of admin/legacy/danger-grouped buttons with a 6-line block (Export Master JSON + 🔄 Restore Master JSON + ⚙ Admin Tools dropdown). (2) Data & Settings tab at line ~2245 — appended `display:none` to the yellow "Backup & restore all data" card's outer div. (3) Added `_closeMasterAdminTools()` helper at line ~16815, immediately after the existing `_closeUploadDropdown()`. (4) Added one new i18n key `master_admin_tools_btn` (TH dictionary) at line ~2727. Total +433 bytes, 4 diff hunks. |
| `_archive/index-pre-master-cta-deprecate-20260528.html` | NEW — pre-edit snapshot, MD5-verified identical to `app/index.html` before any edit (`c868c799…`). |
| `_archive/closeouts/UAT_TASK13A0B_MASTER_DATA_TOOLBAR_DEPRECATION_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | **Not touched.** Proposed updates listed in § G but not applied in this sprint, matching Task 13A-0A's audit. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** No new risk introduced. |

## B. Sections / functions changed

No JavaScript function modified. No function deleted. Only the four anchored
DOM/script-text edits described above. The full diff is 4 hunks; the new
helper `_closeMasterAdminTools()` is 4 lines + 1 comment line:

```javascript
// UAT Pro · Task 13A-0B · 2026-05-28 — close Master Admin Tools dropdown after a selection
function _closeMasterAdminTools() {
  const el = document.getElementById("masterAdminTools");
  if (el) el.removeAttribute("open");
}
```

It mirrors `_closeUploadDropdown()` exactly. No other JS body added.

## C. New helpers added

- `_closeMasterAdminTools()` — closes the Admin Tools `<details>` after a
  selection. Parallel structure to `_closeUploadDropdown()`.
- DOM id `masterAdminTools` — the `<details>` container of the Admin Tools
  dropdown.
- i18n key `master_admin_tools_btn` (TH only) → `"⚙ เครื่องมือผู้ดูแล ▾"`.
  EN falls back to the inline DOM text `"⚙ Admin Tools ▾"`.

## D. UI changes made

**Master Data toolbar** (before / after):

```
BEFORE:
  + Add ...   filters/search/Show inactive   |spacer|
  [Admin]   ⬆ Import Master Excel
  [Legacy]  🧪 BOM Bulk Upload ⚠ Deprecated
            Export Master JSON
            🔄 Restore Master JSON
  | sep |  [⚠ Danger]  🗑 Clear Master Data

AFTER:
  + Add ...   filters/search/Show inactive   |spacer|
  Export Master JSON
  🔄 Restore Master JSON
  ⚙ Admin Tools ▾           ← <details> dropdown
     └─ ⬆ Import Master Excel
     └─ 🗑 Clear Master Data
```

- **🧪 BOM Bulk Upload** button — removed from the toolbar DOM entirely.
  `openBomBulkUpload` function is unchanged, callable via DevTools console for
  the legacy round-trip use case documented in UAT-049 / Task 10C closeout.
  `parseBomWorkbook` + `_bomApplyCommit` + the helpers + `commitBomImport` +
  `_bomDownloadImportReview` all remain defined.
- **⬆ Import Master Excel** — moved from the toolbar to inside the ⚙ Admin
  Tools dropdown. Same `onclick="document.getElementById('importFileInput').click()"`
  handler, plus a `_closeMasterAdminTools()` call after it so the dropdown
  collapses when the operator picks a file. The hidden file input
  `#importFileInput` stays in the toolbar DOM exactly where it was.
- **🗑 Clear Master Data** — moved from the toolbar to inside the ⚙ Admin
  Tools dropdown. Same `onclick="clearMasterV3()"` handler plus the close
  helper. The danger styling (light-red background, red text, bold weight)
  is preserved.
- **Group labels "Admin / Legacy / ⚠ Danger"** — the three small inline span
  labels added in Task 11B are removed because the grouping is now expressed
  by the dropdown itself. The TH dictionary entries `master_toolbar_admin /
  _legacy / _danger` are kept (orphaned but harmless) for rollback safety,
  with a comment.
- **Vertical separator span** before the old Danger button — removed.
- **Export Master JSON** and **🔄 Restore Master JSON** — unchanged, same
  position, same styling. Visible primary paths for the day-to-day Master
  Data round-trip.

**Data & Settings tab — "Backup & restore all data" yellow card** (lines ~2245–2256):

- The outer wrapper div had `display:none` appended to its existing inline
  style.
- The two buttons (⬇ Export All Data / ⬆ Import All Data) and the hidden
  `#importAllInput` file input are still present in the DOM (so the existing
  `onchange="importAllData(this.files[0])"` wiring is preserved — `restoreFromFile`
  delegates to `importAllData`, and that delegation still works), but
  invisible to the operator.

**Global header strip** (line ~1656):
- Unchanged. ⬇ Backup now and ↻ Restore from file… stay as the canonical
  full-state backup/restore pair.

## E. What was intentionally not changed

- **`oms-production/`** — not touched (project-wide hard constraint).
- **`safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`,
  `persistMasterV3`, `restoreMasterV3FromBackup`, `listMasterV3Backups`,
  `debugMasterV3Storage`, `ensureMasterOptionSets`** — Task 1 / Master V3
  persistence core, untouched.
- **`downloadFullBackup`, `restoreFromFile`, `renderHeaderStrip`** — Task 2
  header strip, untouched.
- **`exportMasterV3`, `importMasterV3JsonFile`, `clearMasterV3`,
  `importMasterFromXlsx`, `parseImporterWorkbook`, `validateMasterImportCandidate`,
  `commitImport`** — all click handlers and their parser/validator/commit
  bodies are byte-identical to the backup. Only their click entry points moved
  (or stayed in place for the Master JSON pair).
- **`openBomBulkUpload`, `parseBomWorkbook`, `_bomApplyCommit`,
  `_bomMapLegacyPackagingRow`, `_bomMapLegacyMasterSkuRow`,
  `_bomBuildEggComponents`, `_bomBuildPackagingComponents`,
  `_bomFamilyFromSubgroup`, `showBomImportPreview`, `commitBomImport`,
  `_bomDownloadImportReview`** — all defined exactly as before (verified by
  grep). The button is gone, the legacy round-trip path is still callable from
  the console.
- **`exportAllData`, `importAllData`** — defined exactly as before (verified by
  grep). The Data tab card is hidden via `display:none`, but `restoreFromFile`'s
  delegation to `importAllData` still works because the function body is
  untouched.
- **PO upload parsers and handlers** (`onMakroPoFile`, `parseMakroPoSheet`,
  `onBigCPoFile`, `parseBigCPoCsv`, `parseBigCPoXlsx`, `onThaifoodPoFile`,
  `parseThaifoodPoXlsx`, `onPoUploadInRow`) — out of scope, untouched.
- **Daily plan drop zone**, `clearUploaded`, `exportLines` — out of scope,
  untouched.
- **`MASTER_V3.option_sets`** — never read or written by this sprint.
- **Orders status FSM**, **placeholder lifecycle**, **Master Data forms /
  validators**, **BOM math**, **Basket / Egg / Packaging Profile**, **ใบน้อย**,
  **Logistics**, **`BOM_DONE_KEY`**, **`persistBomDone`** — all untouched.
- **`docs/BUG_LOG.md`**, **`docs/DEV_HANDOVER_2026-05-25.md`**, **`docs/QA_CHECKLIST.md`** — not touched.
- **`BUILD_ID`, `PARSER_VERSION`** — not touched.
- **TH/EN dictionaries** — added ONE new TH key (`master_admin_tools_btn`).
  Existing TH keys `master_toolbar_admin / _legacy / _danger` are now orphaned
  but kept for rollback safety with a comment explaining why.
- **`.upload-po-wrap` and `.upload-po-menu` CSS** — reused as-is, no new CSS
  rule added.

## F. Manual QA checklist

Reload `app/index.html` in the browser first. Run before declaring this sprint
green.

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data tab | Toolbar shows **+ Add …**, filters, search, Show inactive on the left; on the right: **Export Master JSON**, **🔄 Restore Master JSON**, **⚙ Admin Tools ▾**. The legacy "🧪 BOM Bulk Upload" button is GONE. The "Admin / Legacy / ⚠ Danger" group labels are GONE. |
| F2 | Click **⚙ Admin Tools ▾** | A dropdown opens directly below the button, containing two rows: **⬆ Import Master Excel** (white background) and **🗑 Clear Master Data** (light-red background, red text, bold). Min width ≈ 240px. |
| F3 | Click **⬆ Import Master Excel** inside the dropdown | The file picker opens (same `#importFileInput` as before). After cancelling, the Admin Tools dropdown should close on its own. |
| F4 | Pick a real Master Excel file from the file picker | The existing import preview modal opens; commit and cancel both still work. |
| F5 | Click **🗑 Clear Master Data** inside the dropdown | Native `confirm()` dialog appears with the existing Thai "Clear all master V3 data? You will need to re-import." text. Press Cancel — Master Data must not be wiped. Admin Tools dropdown closes. |
| F6 | Click **Export Master JSON** (toolbar — outside the dropdown) | A `demand_master_v3.json` download starts immediately. |
| F7 | Click **🔄 Restore Master JSON** (toolbar — outside the dropdown) | The hidden `#masterJsonRestoreInput` file picker opens. Cancelling does nothing. Picking a valid Master JSON file still shows the existing confirm dialog with current → new counts. |
| F8 | Switch to **Data & Settings** tab | The yellow "💾 Backup & restore all data" card is **not visible**. The drop-zone, file search, and ⬇ Export filtered lines CSV row are visible as before. No console errors. |
| F9 | Look at the global header strip | ⬇ **Backup now** and ↻ **Restore from file…** are visible exactly as before. Click ⬇ Backup now — a `cmk-uat-backup-YYYYMMDD-HHMM.json` download starts. |
| F10 | Click ↻ Restore from file…, pick a valid backup, accept both confirms | App reloads with the restored data. (Same flow as before.) |
| F11 | DevTools console: run `openBomBulkUpload()` | The legacy 🧪 BOM Bulk Upload file picker opens. Cancelling does nothing. Picking a valid legacy 2-sheet workbook shows the preview modal as before. Commit / Download Import_Review still work. (This proves the function remains callable from console for legacy round-trip — UAT-049.) |
| F12 | DevTools console: run `exportAllData()` then `clearMasterV3()` then refresh | `exportAllData()` saves a `cmk-uat-data-…json`. `clearMasterV3()` shows confirm + clears (or Cancel keeps data). `restoreMasterV3FromBackup()` still recovers from a pre-clear snapshot. |
| F13 | Switch language TH ↔ EN | All visible buttons translate. The Admin Tools summary reads "⚙ Admin Tools ▾" in EN, "⚙ เครื่องมือผู้ดูแล ▾" in TH. Inner two buttons translate via `master_btn_import` / `master_btn_clear` (existing keys, unchanged). |
| F14 | `docs/QA_CHECKLIST.md` Section K regression rows | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics open normally. No console errors. |

## G. Known risks

- **Manual QA F1–F14 not yet run** — only static checks have run (see § H).
- **Console-only access to legacy paths** — `openBomBulkUpload()`,
  `exportAllData()`, `importAllData(file)` are now reachable only via DevTools.
  Operators who relied on the toolbar/yellow card will need DevTools or a brief
  walkthrough from the admin. Acceptable per the operator's explicit scope.
- **The orphaned TH keys** `master_toolbar_admin / _legacy / _danger` linger in
  the dictionary at line ~2725. Pure dead weight (no DOM consumer); marked
  with a comment for the next cleanup. No new BUG_LOG row added — same family
  as UAT-013 / UAT-033 / UAT-037 / UAT-039.
- **The hidden `#importAllInput` file input** at line ~2256 is still in the DOM
  but its host card is `display:none`. The element is reachable via
  `getElementById` but not via the visible card UI. This is intentional —
  `restoreFromFile` synthesizes a `File` and calls `importAllData(file)`
  directly, so the hidden card's input element is not actually needed. Future
  cleanup could remove the hidden input entirely, but this sprint left it in
  place to keep the diff minimal.
- **`.upload-po-wrap` class reuse** — by reusing the existing PO-upload
  dropdown CSS for the Admin Tools dropdown, both dropdowns share the same
  hover/open styling. Visually consistent; no new CSS surface area. If both
  dropdowns are open simultaneously, the z-index (50) is the same — newest
  wins. Acceptable in practice.

**Proposed BUG_LOG updates** — not applied in this sprint. Recommend the
operator add these in a follow-up docs-only pass once F1–F14 are green:

- **UAT-014** (`deprecated-path`, BOM Bulk Upload wholesale-replace): append
  an owner-notes line "2026-05-28 (Task 13A-0B): operator CTA removed from
  Master Data toolbar; function `openBomBulkUpload` remains callable from
  DevTools console for legacy round-trip."
- **UAT-015** (`deprecated-path`, BOM Bulk Upload legacy 2-sheet only):
  identical owner-notes append.
- **UAT-049** (canonical deprecation policy): append "Task 13A-0B (2026-05-28)
  removed the operator-visible CTA; the path is now console-only."
- **New row UAT-053** (proposed, 🟢 Low, `deprecated-path`): "Data & Settings
  tab's 'Backup & restore all data' yellow card is hidden as of Task 13A-0B
  (2026-05-28). Superseded by the global header strip's ⬇ Backup now and
  ↻ Restore from file…. Functions `exportAllData` and `importAllData` remain
  defined; `restoreFromFile` delegates to `importAllData`."

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks (the
  application/octet-stream HISTORY_B64 block is correctly skipped).
- Brace / bracket / backtick / paren delta vs the backup:
  - `{}` delta: **0** (+1 each side from `_closeMasterAdminTools()` body)
  - `()` delta: **0**
  - `[]` delta: **0**
  - backtick delta: **0**
- All 4 anchored edits asserted `src.count(old) == 1` before replacement.
- All 9 existing handler functions (`openBomBulkUpload`, `exportAllData`,
  `importAllData`, `clearMasterV3`, `importMasterFromXlsx`, `parseBomWorkbook`,
  `_bomApplyCommit`, `exportMasterV3`, `importMasterV3JsonFile`) — verified
  `^function NAME` exactly 1 occurrence each.
- All 7 protected helpers (`safeSet`, `safeSetLastSave`, `listAllBackups`,
  `restoreFromBackup`, `downloadFullBackup`, `restoreFromFile`,
  `_closeUploadDropdown`) — verified 1 occurrence each.
- `onclick="openBomBulkUpload()"` count: **0** (button removed from DOM, as
  intended).
- New symbols present exactly as expected: `masterAdminTools` (2 occurrences =
  id + getElementById), `_closeMasterAdminTools` (3 = def + 2 onclicks),
  `master_admin_tools_btn` (2 = data-i18n + TH dict entry).
- File diff: exactly **4 hunks** (matches the 4 anchored edits).

**Acceptance criteria — operator-approved scope:**
- AC1 Keep Export Master JSON / 🔄 Restore Master JSON visible ✓ — see § D.
- AC2 Keep global header strip ⬇ Backup now / ↻ Restore from file… visible ✓ — line 1656/1661 unchanged.
- AC3 Move ⬆ Import Master Excel + 🗑 Clear Master Data into ⚙ Admin Tools ✓ — see § D.
- AC4 Hide 🧪 BOM Bulk Upload from normal UI ✓ — button removed from DOM; function intact.
- AC5 Hide duplicate Data & Settings Export All / Import All card ✓ — `display:none` on the yellow card; functions intact.
- AC6 No new import / export built ✓ — zero new parser, validator, or commit flow.
- AC7 No data or logic changed ✓ — zero `MASTER_V3` mutation, zero `option_sets` mutation, zero localStorage write, zero JS function body modified.
- AC8 Static smoke check passes ✓ — see above.
- AC9 Closeout written ✓ — this file.

**Outstanding:** manual QA F1–F14 and Section K regression. Roll back with
`cp _archive/index-pre-master-cta-deprecate-20260528.html app/index.html` if
any K-row regression fails.

**Next concrete action for the operator:** run F1–F14 above (and Section K
regression). If green, the operator may approve adding the four proposed
BUG_LOG rows (§ G) in a docs-only follow-up, and then approve **Task 13A-1**
(Identity + Counting & Units export/import — the actual rebuild).

— *Task 13A-0B, 2026-05-28*
