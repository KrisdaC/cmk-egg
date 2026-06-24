# UAT Task 10A — Packaging Profile: Base Pack / Tray Auto-BOM — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `40a2a43f855da34fbca7396da9898c6a`
**Post-edit app MD5:** `4e58fd0d9ab3597f43a2293f80d28813`
**Rollback:** `cp _archive/index-pre-packprofile-tray-20260525.html app/index.html`

The first slot of the deeper Master Data packaging model: a **Packaging Profile**
with one standard BOM slot — **pack ฐาน / Base Pack** — and one type under it —
**tray / ถาดกระดาษ**. When an FG uses a base-pack tray, the correct paper tray is
auto-derived from egg size and materialized into `item.bom.components`, where the
existing Components table, readiness gate and Test Calculation consume it.

Two-level data model as briefed: `component_role` = the standard slot
(`"pack_base"`), `packaging_key` = the specific type (`"tray"`). Future slots
(cover, labels, closers, bulk label) and other base-pack types (pack 4/10/12/15)
were **not** built — out of scope for this sprint.

Eight anchored edits, all inside the item-edit BOM `_bom*` module. Additive — one
new ~200-line code block plus seven small wiring edits. `openEditItem` and every
protected path were left untouched.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 8 anchored edits, all in the item-edit BOM module (lines ~22971–24141). One inserted code block (helpers + materializer + render) and seven small wiring edits. See section B. |
| `_archive/index-pre-packprofile-tray-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`40a2a43f855da34fbca7396da9898c6a`) before any edit. |
| `_archive/closeouts/UAT_TASK10A_PACKAGING_PROFILE_TRAY_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK10A_packprofile_acceptance.js` | NEW — the Node `vm` acceptance harness (41 assertions). |
| `docs/BUG_LOG.md` | +3 rows in the Open table (`UAT-045`, `UAT-046`, `UAT-047`). |

**Diff footprint:** 8 hunks, all between lines 22971–24141 — the `_bom*` BOM
module. 226 lines added. `openEditItem`, `renderPlanBom`, `renderBomSummary`,
`safeSet`, `persistMasterV3` are byte-identical (only line-shifted past the
insert point).

## B. Sections / functions changed

Seven existing functions received small anchored edits; none had its existing
behaviour altered for non-tray data:

- **`_bomLiveRecompute`** — now calls `_bomSyncPackBaseTray` (deriving from the
  live form clone) before the existing basket refresh + BOM re-check, so the
  tray line is re-materialized on every modal field change.
- **`_bomRenderItemEditSectionBody`** — one added line: `_bomRenderItemPackagingProfile(it)`
  renders between the read-only Components table and the Task-9 Packaging
  materials editor.
- **`buildBomComponentLinesForItem`** (otherComps push) — a profile-owned line
  (`source_added === 'packaging_profile_pack_base_tray'`) now reports
  `source: 'packaging_profile'` and `editable: false` instead of the hardcoded
  `'bom_setup' / true`. All other components are unchanged.
- **`_bomLineSourceLabel`** / **`_bomLineEditableLabel`** — one new `case` /
  line each, for the `packaging_profile` source ("📋 ที่ Packaging Profile").
- **`_bomPkgComponentRows`** (Task 9) — now excludes the profile-owned tray line
  so the Task-9 manual editor neither lists nor lets the operator edit it.
- **`_bomAddPackagingComponent`** (Task 9) — a guard blocks adding a tray SKU
  (`C19999P301` / `C19999P302`) as a manual component while the Packaging
  Profile controls pack_base/tray.

## C. New helpers added

All new symbols are in one inserted block; each verified present exactly once:

| Symbol | Purpose |
|---|---|
| `_BOM_TRAY_LARGE_SKU` = `C19999P302`, `_BOM_TRAY_SMALL_SKU` = `C19999P301` | The two paper-tray SKUs. |
| `_BOM_TRAY_LARGE_NAME` / `_BOM_TRAY_SMALL_NAME` | Fallback Thai names (ใหญ่ / เล็ก) when the SKU is not in Master Data. |
| `_BOM_PACKBASE_TRAY_TAG` = `packaging_profile_pack_base_tray` | The provenance tag identifying the profile-owned component. |
| `_bomDeriveTrayForItem(it)` | Resolves egg size → tray. Size `0` → large; any other resolved size, or a non-egg SKU → small; an egg SKU with no primary grade → unresolved. |
| `_bomTraySkuInfo(sku)` | Looks the tray SKU up in `MASTER_V3` for its real name + base unit. |
| `_bomSyncPackBaseTray(realItem, liveItem)` | The materializer. Derives from `liveItem`, writes the profile-owned component to `realItem.bom.components`. |
| `_bomRenderItemPackagingProfile(it)` | The Packaging Profile sub-block UI. |

## D. UI changes

A new **"📦 รูปแบบบรรจุภัณฑ์ · Packaging Profile"** sub-block inside the FG item
editor's BOM / สูตรผลิต section, between the read-only Components table and the
Task-9 Packaging materials editor:

- **Field 1 — `ใช้ pack ฐาน? · Uses base pack?`** (checkbox).
- **Field 2 — `ประเภท pack ฐาน · Base pack type`** (select; only option `ถาดกระดาษ · Tray`).
- **Field 3 — `จำนวนต่อ 1 หน่วยผลิต · Qty per output`** (number, default 1).
- **Tray rule preview** — `เบอร์ 0 → C19999P302 ถาดกระดาษ ใหญ่ · เบอร์อื่น → C19999P301 ถาดกระดาษ เล็ก`.
- **Live status** — green "auto-added to BOM: <sku> <name> × <qty> <unit>" when
  valid; amber "BOM Enable is blocked" listing the reason (egg size / SKU / qty)
  when not; grey "Off" when disabled.
- All strings are bilingual Thai + English. Fields are `data-f` inputs; changes
  bubble to the existing `#editBody.onchange → _bomLiveRecompute`, which
  re-materializes the tray line and re-renders the BOM section.

The three fields are placed inside the BOM section deliberately, so the protected
`openEditItem` did not need to be touched. No new CSS class — the block reuses
`row-active` / `edit-row` for visual consistency with the rest of the editor.

## E. What was intentionally not changed

- **`oms-production/`**, **Daily Plan BOM (`renderPlanBom`)**, **legacy BOM
  Summary (`renderBomSummary`)**, **Orders**, **Daily Planning**, **Logistics**,
  **ใบน้อย**, **PO parsers**, **`safeSet`**, **the header strip**,
  **`MASTER_V3.option_sets`** — none touched (verified by grep + line-shift-only
  diff).
- **`openEditItem`** — not touched. The Packaging Profile renders as a sub-block
  inside the BOM section (`_bomRenderItemEditSectionBody`) rather than as a new
  top-level `_sec`, specifically to avoid editing the protected Master Data form.
- **Out-of-scope packaging slots** — cover, SKU barcode label, product
  label/sticker, closer 1, closer 2, bulk barcode label — not built. The model
  (`component_role` slot + `packaging_key` type) is ready for them later.
- **Daily Plan BOM integration, bulk BOM upload, inventory deduction,
  substitution logic, oms-production migration** — not built (out of scope).
- **Egg lines** — still derived solely from the Egg Profile; `_bomSyncPackBaseTray`
  never touches them (egg lines are computed, not stored in `bom.components`).
- **Basket components** — `_bomSyncPackBaseTray` explicitly skips any component
  with `component_role === 'basket'`; the basket stays controlled only by the
  Basket Profile.
- **Existing component shapes / localStorage keys** — nothing renamed. New
  fields are additive: `item.packaging_profile.pack_base { enabled, packaging_key,
  qty_per_selling_unit }` (top-level, preserved by `normalizeMasterRecord`'s
  object spread) and `packaging_key` + `source_added` on the materialized
  component (both already-used field names on imported components).
- **`_bomItemReadiness`** — not edited. Blocking BOM Enable on an invalid tray is
  achieved purely by setting `needs_review = true` on the materialized component,
  which the existing readiness gate already counts.

## F. Manual QA checklist

Reload `app/index.html` first. **Prerequisite:** create the two tray SKUs in
Master Data (`C19999P301` ถาดกระดาษ เล็ก, `C19999P302` ถาดกระดาษ ใหญ่,
Item role = PACKAGING) — they are not in the current corrected master, so until
they exist every "Uses base pack" FG will correctly show needs-review (see
UAT-045).

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG with primary grade **0** → BOM section → Packaging Profile; tick "Uses base pack" | Status shows ✅ auto-added `C19999P302 ถาดกระดาษ ใหญ่`; a `pack_base` line appears in the Components table |
| F2 | Open an FG with primary grade **1–6**, tick "Uses base pack" | Status + Components table show `C19999P301 ถาดกระดาษ เล็ก` |
| F3 | Untick "Uses base pack" | The pack_base/tray line disappears from the Components table; no needs-review from it |
| F4 | With "Uses base pack" on, change "Qty per output" to 3 → open Test Calculation | The tray line total scales with qty 3 |
| F5 | Set qty to 0 or blank | Tray line shows needs-review; the BOM **Enable** checkbox is disabled |
| F6 | Open an egg FG with **no primary grade**, tick "Uses base pack" | Amber "egg size cannot be determined — BOM Enable blocked"; Enable disabled |
| F7 | Before the tray SKUs exist in Master Data, tick "Uses base pack" | Amber "tray SKU not in Master Data — blocked" (resolves once F-prerequisite SKUs are created) |
| F8 | In the Task-9 "Packaging materials" editor, try to add `C19999P301`/`C19999P302` while the profile controls tray | Blocked with "managed by the Packaging Profile" alert |
| F9 | Confirm the profile-owned tray line is **not** listed as an editable row in the Task-9 editor | It appears only in the read-only Components table + the Packaging Profile |
| F10 | Add a normal non-tray packaging material in the Task-9 editor | Still works (Task 9 unaffected) |
| F11 | Save the FG, reopen it | "Uses base pack", type, qty and the tray line all persist |
| F12 | Open a basket FG; confirm the basket line | Still controlled only by the Basket Profile — unaffected |
| F13 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally |

## G. Known risks

- **Manual QA F1–F13 not yet run** — static + Node acceptance tests only (see H).
- **Tray SKUs absent from the corrected master** — `C19999P301` / `C19999P302`
  are not in `demand_master_v3_corrected_v5_20260521.json`. Until the operator
  creates them, every "Uses base pack" FG is correctly blocked from BOM Enable.
  Logged as **UAT-045** (🟡 Medium) — this is the *specified* behaviour, not a
  defect, but it gates real use of the feature.
- **Daily Plan BOM does not consume the tray line** — `renderPlanBom` is the
  older separate code path; the pack_base/tray component appears in the
  item-level BOM, readiness gate and Test Calculation only. Logged as
  **UAT-046** (🟢 Low) — out of scope this sprint; same family as UAT-042 / UAT-016.
- **Adopted manual tray line is removed on disable** — if the profile adopts a
  pre-existing manual tray line and the operator later unticks "Uses base pack",
  that (now profile-owned) line is removed. Re-ticking re-creates the correct
  line from the rule. Logged as **UAT-047** (🟢 Low).
- **`packaging_profile` is written on every item save** — once this build ships,
  saving any qualifying item materializes `item.packaging_profile.pack_base`
  (with `enabled:false` if unused). Additive and backward-compatible; no existing
  field renamed.
- **Egg size uses the primary grade only** — a mixed SKU is classified by its
  primary grade (primary 0 → large tray). This matches the brief ("clearly size
  0 → large; mixed non-zero → small").

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.** `node --check` clean on all 7 executable inline
`<script>` blocks. Brace / bracket / backtick balance identical to the backup
(`{}` 0, `[]` 0, backtick even); paren imbalance −35, unchanged vs the backup
(pre-existing). All new symbols present exactly once; `safeSet`, `persistMasterV3`,
`buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomSelectBasketSku`,
`renderPlanBom`, `openEditItem`, `normalizeMasterRecord` all intact. Diff = 8
hunks, all within the `_bom*` module (lines 22971–24141).

**Functional checks — passed.** A Node `vm` acceptance harness ran **41 / 41**
assertions: egg-size → tray derivation (size 0 → large; 1–6 → small; "เบอร์ 0"
prefix; mixed primary-0 → large; non-egg → small; egg-no-grade → unresolved);
tray SKU lookup; materializer (one line created, correct role/key/sku/source/
tag/unit/qty; idempotent re-sync; disable removes only the profile line and
preserves manual components; needs_review on missing SKU / unresolved size /
qty 0 / blank qty; adoption of one tray-like manual line without duplication;
extra tray-like lines flagged needs_review; basket components untouched; derive
from liveItem, write to realItem); and the render (data-f inputs, valid /
blocked / off states, tray-rule preview).

**Acceptance criteria 1–12** are all met by the implementation; criteria 1–11
are covered by the harness and confined-diff analysis, criterion 12 (Section K
regression) is the operator's manual QA pass (F13).

**Outstanding:** manual QA F1–F13, including creating the two tray SKUs in
Master Data, plus a human browser smoke. Roll back with
`cp _archive/index-pre-packprofile-tray-20260525.html app/index.html` if any
K-row regression fails.
