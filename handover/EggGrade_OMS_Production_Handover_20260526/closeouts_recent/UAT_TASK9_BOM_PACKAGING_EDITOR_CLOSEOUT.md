# UAT Task 9 — BOM Packaging Editor — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `d340f2521bb7f759e00e9021d829c012`
**Post-edit app MD5:** `40a2a43f855da34fbca7396da9898c6a`
**Rollback:** `cp _archive/index-pre-bom-pkgeditor-20260525.html app/index.html`

A new feature: a manual **packaging-component editor** for a finished good's
item-level BOM. An operator can now add / edit / remove packaging materials
(tray, cover, label, sticker, pack, other) on an FG SKU, where each line
references a real PACKAGING SKU from Master Data and carries a quantity per 1
output unit. This fills the gap the previous build flagged in the BOM section
with the note *"ถาด · ฝาครอบ · ฉลาก · สติกเกอร์ · วัสดุแพ็ค จะเพิ่มเป็นบรรทัดถัดไป"*.

Two anchored edits, both inside the Master Data Item-edit BOM module. Additive
only — one new code block of helpers plus one one-line wiring change. No existing
function was modified, no data shape was renamed, no calculation engine touched.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored edits, both in the Master Data Item-edit BOM module. (1) **Insert** — a new ~240-line block of packaging-editor helpers + render + handlers, placed immediately before `_bomRenderItemEditSection`. (2) **Replace** — one line inside `_bomRenderItemEditSectionBody`: the static placeholder note (*"Tray, cover, label, sticker, and pack material will be added next"*) is replaced by the live `_bomRenderItemPackagingEditor(it)` call. |
| `_archive/index-pre-bom-pkgeditor-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`d340f2521bb7f759e00e9021d829c012`) before any edit. |
| `_archive/closeouts/UAT_TASK9_BOM_PACKAGING_EDITOR_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | +3 rows in the Open table (`UAT-042`, `UAT-043`, `UAT-044`). |

**Diff footprint:** exactly 2 hunks — `23650a23651,23891` (241 lines added) and
`23675c23916` (1 line changed). 1 line removed, 242 added. Everything is between
lines 23651–23916, inside the item-edit BOM module.

## B. Sections / functions changed

- **`_bomRenderItemEditSectionBody(it)`** — the only existing function touched.
  One line changed: the placeholder `<div>…จะเพิ่มเป็นบรรทัดถัดไป…</div>` string
  literal is now `_bomRenderItemPackagingEditor(it) +`. The editor renders
  directly under the read-only "Components per output unit" table and above
  "Test Calculation". Nothing else in the function changed.

No other existing function was modified. `buildBomComponentLinesForItem`,
`_bomRenderItemComponentsTable`, `_bomItemReadiness`, `_bomRenderItemTestCalc`,
`_bomSelectBasketSku`, `normalizeItemUnits`, `_readEditForm`, `saveEdit` — all
unchanged. The new packaging components are written into `item.bom.components`
in the shape that `buildBomComponentLinesForItem`'s existing "other components"
branch already reads (`qty_per_selling_unit` + `usage_basis: 'per_selling_unit'`),
so they appear in the read-only Components table, the readiness gate, and Test
Calculation with **no change to those code paths**.

## C. New helpers added

All new symbols are prefixed `_bomPkg` / `_BOM_PKG_` (a fresh prefix, no
collision with existing names — verified each appears exactly once):

| Symbol | Purpose |
|---|---|
| `_BOM_PKG_CATEGORIES` | Fixed bilingual category list — tray / cover / label / sticker / pack / other. Codes are stored in `component_role` and are deliberately never `'basket'`. |
| `_BOM_PKG_LEGACY_LABELS` | Readable labels for legacy / bulk-import role codes (`pack_base`, `closer_1`, …) so pre-existing imported components still display sensibly. |
| `_bomPkgCategoryLabel(code)` | Bilingual label for a category code; falls back to a legacy label, then the raw code. |
| `_bomPkgCandidateItems()` | PACKAGING items eligible as materials — `item_role = PACKAGING`, **not** a basket (the Basket Profile owns those), not a placeholder. Sorted by SKU. |
| `_bomPkgComponentRows(it)` | `{ idx, comp }` for every non-basket component in `item.bom.components`; `idx` is the real array position used by the update / remove handlers. |
| `_bomPkgCompAt(idx)` | The editable (non-basket) component at `idx` in the item being edited, or `null`. Basket components are never returned. |
| `_bomRenderItemPackagingEditor(it)` | The editor UI — existing-rows table + add form, or empty-states. |
| `_bomAddPackagingComponent()` | Reads the add form, validates, appends one component to `item.bom.components`, then live-recomputes. |
| `_bomUpdatePkgQty(idx, value)` | Edits a line's qty-per-output; sets `usage_basis = 'per_selling_unit'`; flags `needs_review` when qty ≤ 0. |
| `_bomUpdatePkgCat(idx, value)` | Edits a line's category (`component_role`). |
| `_bomRemovePackagingComponent(idx)` | Removes one non-basket component after a bilingual confirm. Basket components are protected. |

The editor reuses existing helpers rather than reimplementing them: `escHtml`,
`_editingV3`, `MASTER_V3`, and `_bomLiveRecompute` (which already re-renders the
whole BOM section from live form state). Persistence is the normal Save path —
nothing new was added there.

## D. UI changes

A new **"วัสดุบรรจุภัณฑ์ · Packaging materials"** panel inside the FG item editor's
**BOM / สูตรผลิต** section, directly below the read-only "Components per output
unit" table:

- **Existing rows** — one editable table row per non-basket component: a
  **category** dropdown, the **material** (PACKAGING SKU name + code, read-only),
  a **qty / output** number input, the **unit** (read-only, from the SKU master),
  and a **remove (✕)** button. A qty of 0 / blank highlights the input amber.
- **Add form** — a category dropdown, a PACKAGING-SKU dropdown, a qty input
  (default 1), and a green **"+ เพิ่มวัสดุ · Add material"** button.
- **Empty-states** — "No packaging materials on this BOM yet" when the list is
  empty; an amber "No PACKAGING SKUs found — create an item with Item role =
  PACKAGING (non-basket) first" when Master Data has no eligible SKU.
- All strings are bilingual Thai + English, matching the existing UAT pattern.
- Edits live-recompute the whole BOM section (status block, component table,
  Test Calculation) immediately, via the existing `_bomLiveRecompute`.

No new CSS class was introduced — the editor reuses the existing `plan-matrix` /
`plan-matrix-wrap` table styling for visual consistency. New element IDs
(`bomPkgAddCat`, `bomPkgAddSku`, `bomPkgAddQty`) use the `bomPkg` prefix.

## E. What was intentionally not changed

- **`oms-production/`** — not touched.
- **The Task-1 persist functions** (`persistOrders`, `persistPlanning`,
  `persistDrafts`, `persistMaster`, `persistBomDone`, `saveUploaded`,
  `saveUserMappings`, `persistViews`), `persistMasterV3` and its siblings,
  `safeSet` / `safeSetLastSave` / `listAllBackups` / `restoreFromBackup`, and the
  Task-2 header strip — all untouched (verified by grep; each still present).
- **`buildBomComponentLinesForItem`** — not modified. The editor writes a
  component shape it already consumes, so the read-only Components table, the
  hard-gated readiness check (`_bomItemReadiness`) and Test Calculation pick up
  packaging lines for free.
- **The Basket Profile and egg logic** — the editor manages only non-basket
  components; basket components (`component_role === 'basket'`) are excluded from
  the candidate list, the row list, and every handler. Egg lines (from Egg
  Profile) are computed, not stored in `bom.components`, so they are unaffected.
- **Daily Plan BOM (`renderPlanBom`), legacy BOM Summary (`renderBomSummary`),
  Orders, Daily Planning, Logistics, ใบน้อย, Controlled Lists, PO parsers,
  Master Data validators** — not touched.
- **The component data shape** — no existing field renamed or restructured. New
  components add a `source_added: 'packaging_editor'` provenance tag; all other
  fields (`component_type`, `component_role`, `component_sku`, `component_name`,
  `qty_per_selling_unit`, `usage_basis`, `unit`, `required`, `needs_review`,
  `source`, `notes`) already exist on imported components.
- **The read-only "Components per output unit" table** — not extended to show
  the per-line category (logged as UAT-044, cosmetic).
- **`MASTER_V3.option_sets`** — no new option_set; categories are a fixed
  in-code list per the agreed scope, so Controlled Lists were not touched.

## F. Manual QA checklist

Reload `app/index.html` in the browser first (the feature is in the file, not in
saved data). To exercise the Add form you need at least one **non-basket
PACKAGING** SKU in Master Data — if none exists, create one (Item role =
PACKAGING, Item type = packaging) or see UAT-043.

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG egg SKU → BOM / สูตรผลิต section | A "วัสดุบรรจุภัณฑ์ · Packaging materials" panel appears below the Components table; the old "…will be added next" note is gone |
| F2 | With no non-basket PACKAGING SKU in Master Data | The panel shows the amber "No PACKAGING SKUs found…" empty-state; no Add form |
| F3 | With ≥1 non-basket PACKAGING SKU: pick a category + SKU + qty, click "+ Add material" | A new row appears in the Packaging materials table and a matching "📦 Packaging" line appears in "Components per output unit" |
| F4 | Inspect the new line | Qty = what you typed; Unit = the PACKAGING SKU's base unit; Source = "BOM Setup" |
| F5 | Change a row's qty to a valid number, then to 0 / blank | Valid: BOM recomputes live, line OK. Zero/blank: input turns amber, the line shows needs-review, and the BOM "Enable" checkbox is disabled |
| F6 | Change a row's category dropdown | The new category persists across the live re-render |
| F7 | Add the same PACKAGING SKU twice | Second add is blocked with "already on the BOM" — no duplicate row |
| F8 | Add with qty 0 (or blank) | Blocked with an alert; no row added |
| F9 | Click ✕ on a row | A bilingual confirm appears; on confirm the row disappears from both tables |
| F10 | Open a basket FG SKU | The basket line is shown by the Basket Profile only; it does **not** appear in the Packaging materials editor and cannot be removed there |
| F11 | Add a packaging line, Save the item, reopen it | The packaging component persisted — no data loss |
| F12 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally |

## G. Known risks

- **Manual QA F1–F12 not yet run** — static + Node acceptance tests only (see H).
- **Daily Plan BOM does not consume these components** — `renderPlanBom` is a
  separate, older code path; packaging materials defined here appear in the
  item-level BOM and Test Calculation only, not in the floor's Daily Plan BOM
  rollup. Logged as **UAT-042** (🟡 Medium). Same family as UAT-016.
- **Editor is empty until non-basket PACKAGING SKUs exist** — the current
  corrected master has 5 PACKAGING items, all `item_type = basket`, which the
  editor excludes. The Add form shows the empty-state until the operator creates
  real packaging SKUs. Logged as **UAT-043** (🟢 Low) — expected per the agreed
  "PACKAGING SKU only" scope.
- **Category not shown in the read-only Components table** — the category is
  stored, shown and editable in the Packaging materials editor, but the
  "Components per output unit" table shows only the generic "📦 Packaging" type.
  Logged as **UAT-044** (🟢 Low, cosmetic).
- **Index-addressed rows** — update / remove handlers address components by their
  array index in `item.bom.components`. Indices are recomputed on every live
  re-render, so they are always consistent within a render cycle; there is no
  stale-index window. Editing an imported (bulk-upload) component through the
  editor normalizes its `usage_basis` to `per_selling_unit` — intended, and it
  also clears the UAT-035 "basis is not per output unit" needs-review flag.
- **No new BUG_LOG risk found in Task 1 / Task 2 code** while working here.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.** `node --check` clean on all 7 executable inline
`<script>` blocks (the external CDN script and the `application/octet-stream`
`HISTORY_B64` blob excluded). Brace / bracket balance unchanged vs the backup
(`{}` delta 0, `[]` delta 0); paren imbalance −35, identical to the backup
(pre-existing, inside strings/regex — not introduced here); backticks even. All
11 new symbols present exactly once; all protected helpers (`safeSet`,
`persistMasterV3`, `buildBomComponentLinesForItem`, `_bomSelectBasketSku`,
`_bomResolveBasketUnit`, `_bomItemReadiness`, header strip) still present.

**Functional checks — passed.** A Node `vm` acceptance harness loaded the new
block in isolation with stubbed `escHtml` / `MASTER_V3` / `_editingV3` /
`document` / `alert` / `confirm` / `_bomLiveRecompute` and ran **35 / 35**
assertions: category labels incl. legacy + unknown codes; candidate filter
(non-basket PACKAGING only, placeholders + basket excluded, sorted); non-basket
row extraction with correct real indices; render empty-state vs add-form vs
existing-row (handlers correctly wired); add (correct sku/qty/role/unit/basis,
provenance tag, recompute fired); duplicate-add rejected with alert; zero-qty add
rejected; qty update incl. blank → needs-review; category update; basket
component protected from `_bomPkgCompAt` and from remove; remove with
confirm = false / true.

Harness: `pkg_editor_acceptance.js` (kept with the closeout evidence).

**Outstanding:** manual QA F1–F12 above, plus a human browser smoke, to be run by
the operator. Roll back with
`cp _archive/index-pre-bom-pkgeditor-20260525.html app/index.html` if any
K-row regression fails.
