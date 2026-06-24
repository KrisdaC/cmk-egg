# UAT Task 11D — Packaging Profile design correction (Slot ≠ permanent Type) — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `475ea759a90d6b3f64d1c0ce34eb9b22`
**Post-edit app MD5:** `b2d4c09aadf54e9f9f2575d74b21fd59`
**Rollback:** `cp _archive/index-pre-pkgprofile-design-correction-20260525.html app/index.html`

A design correction to the Packaging Profile that **supersedes the earlier
Task 11D (Type Semantics)** direction. The earlier 11D added an
`allowed_types` array per slot that implied each slot was permanently
typed; this sprint reframes that as a *suggested default*, and wires the
real filter to the **operator-chosen** `item_role` + `item_type` stored on
`packaging_profile.<slot>`. The slot is now a usage position, not a type
lock-in. Backward-compatible with Task 10B / 11C / earlier-11D data; no new
Master Data field; current sprint still keeps the operator UI scoped to
PACKAGING / tray for Base Pack.

Eight anchored edits, all inside the Packaging Profile area. No business
logic change in materialisation; only the field that supplies the value.

**Companion file:** the previous `UAT_TASK11D_PACKAGING_PROFILE_TYPE_SEMANTICS_CLOSEOUT.md`
remains on disk; this closeout supersedes its conceptual claim that slots
have a permanent type.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 8 anchored edits, all inside the Packaging Profile area (`_BOM_PACKAGING_SLOTS` comment, the two candidate helpers, `_bomPackBaseProfile`, `_bomPackBaseSetActive`, `_bomSyncPackBaseTray` enabled-check + materialise, the render's candidate-fetch line, the info banner). +2,749 bytes. |
| `_archive/index-pre-pkgprofile-design-correction-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`475ea759a90d6b3f64d1c0ce34eb9b22`). |
| `_archive/closeouts/UAT_TASK11D_PACKAGING_PROFILE_DESIGN_CORRECTION_CLOSEOUT.md` | NEW — this file. Companion to (and conceptual supersede of) the earlier `UAT_TASK11D_PACKAGING_PROFILE_TYPE_SEMANTICS_CLOSEOUT.md`. |
| `_archive/closeouts/UAT_TASK11D_task11d_correction_acceptance.js` | NEW — Node `vm` acceptance harness (23 assertions for `_bomPkgCandidatesByType` + the tray wrapper). |
| `docs/BUG_LOG.md` | **Not touched.** No new risk introduced; the change refines an existing path. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. Sections / functions changed

- **`_BOM_PACKAGING_SLOTS` comment** — reworded so `allowed_types` is described
  as a *suggested default per slot*, not a hard constraint. The actual SKU
  filter is now driven by `packaging_profile.<slot>.{item_role, item_type}`.
- **`_bomPkgCandidatesByType(itemRole, itemType, currentSku)`** — NEW
  generalised candidate helper. Filters Master Data by the operator-chosen
  item_role + item_type. Case-insensitive; defaults empty role to
  `PACKAGING`; returns `[]` for empty type. Same active-vs-inactive +
  placeholder + sort + current-sku-preservation semantics as Task 11C.
- **`_bomPkgTrayCandidateItems(currentSku)`** — now a **thin wrapper** that
  delegates to `_bomPkgCandidatesByType('PACKAGING', 'tray', currentSku)`.
  Behaviour identical to Task 11C; Task 11C's harness regresses 15 / 15.
- **`_bomPackBaseProfile()`** — when creating the profile for a brand-new item,
  initialises `item_role: 'PACKAGING'` and `item_type: 'tray'` alongside
  the existing fields. Pre-existing items keep their stored shape.
- **`_bomPackBaseSetActive(checked)`** — on enable, backfills
  `pb.item_role = 'PACKAGING'` and `pb.item_type = 'tray'` if absent, and
  keeps `pb.packaging_key` in sync with `pb.item_type`. Defaults only;
  never overwrites an existing value.
- **`_bomSyncPackBaseTray`** — the `enabled` check now reads
  `pp.item_type` (falling back to `pp.packaging_key` → `'tray'` for
  pre-Task-11D items), and only materialises when `item_type === 'tray'`
  (the only fully-supported sub-type this sprint). The materialised
  `line.packaging_key` is now `ppItemType` instead of literal `'tray'`
  — same value today, future-proof for richer types tomorrow.
- **`_bomRenderItemPackagingProfile`** — the SKU dropdown's candidate fetch
  now reads the profile's chosen `item_role` + `item_type` and calls
  `_bomPkgCandidatesByType` accordingly (falls back to the tray wrapper if
  the new helper is missing — defensive). The render is otherwise unchanged.
- **Info banner** — reworded to spell out that the BOM **slot** is a usage
  position, the material type comes from the SKU's `item_type`, and the
  Component SKU choices are filtered by the operator-chosen `item_role` +
  `item_type`. New line: *"Slots do not permanently pre-assign type."*

Everything else in the Packaging Profile area (placeholder rows, status
copy, qty/unit hints, auto/manual handlers, Test Calc, BOM readiness gate)
is byte-identical.

## C. New helpers added

| Symbol | Purpose |
|---|---|
| `_bomPkgCandidatesByType(itemRole, itemType, currentSku)` | Generalised candidate-item helper. Filters Master Data by any (item_role, item_type) pair. Case-insensitive, placeholder-aware, active/inactive-aware (preserves the currently-paired SKU), sorted. **Replaces** the slot→type pre-binding implied by the earlier 11D's `allowed_types` usage. |
| `_bomPkgTrayCandidateItems(currentSku)` | Re-implemented as a 1-line wrapper around the generalised helper. Preserves backward compatibility with Task 11C's render + harness. |

The data model now includes two **new fields** on `packaging_profile.<slot>`:

| Field | Default | Purpose |
|---|---|---|
| `item_role` | `'PACKAGING'` | Operator-chosen role for this row's component (currently always PACKAGING for Base Pack). |
| `item_type` | `'tray'` | Operator-chosen sub-type for this row's component (currently always tray for Base Pack). Used to drive the SKU filter and the materialised `packaging_key`. |

These are **additive only**. Pre-existing items (Task 10B / 11C / earlier-11D)
load unchanged; on first activation they get the defaults backfilled
non-destructively.

## D. UI changes

- **Info banner** above the Packaging Profile table — replaced with a longer
  bilingual version that says, in order: the model is **Slot → ประเภทวัสดุ
  (item_type) → SKU วัสดุ → จำนวน**; the slot is a standard usage position;
  the material type comes from the SKU's `item_type`; the Component SKU
  choices are filtered by the selected `item_role` + `item_type`; and
  *"Slots do not permanently pre-assign type."*
- **Base Pack row** — visually identical to the Task 11D Type Semantics
  version (Type cell still reads "ถาด · tray" read-only this sprint, since
  only tray is fully supported). Under the hood, the cell's value now comes
  from `packaging_profile.pack_base.item_type` defaulted to `'tray'`,
  not from a slot-hardcoded constant.
- **Placeholder rows** — unchanged. Their Type cells continue to show the
  read-only Task 11D `allowed_types` example labels (cover → `ฝาครอบ ·
  cover`, etc.) as a *suggested default*. The text "ยังไม่เปิดใช้งาน —
  ไม่มีผลต่อ BOM" is unchanged.
- **No layout change.** No new control. No new column.

## E. What was intentionally not changed

- **`oms-production/`** — not touched.
- **Orders, Daily Planning, `renderPlanBom`, `renderBomSummary`, ใบน้อย,
  Logistics, PO parsers, `safeSet`, header strip, BOM Bulk Upload importer,
  Master Data import/export/restore, Clear Master Data** — all untouched.
- **`MASTER_V3.option_sets`** — not touched. No new option_set codes; no new
  Master Data field. The existing `item_role` + `item_type` carry the
  taxonomy.
- **Egg Profile, Basket Profile, Test Calculation, BOM readiness gate, all
  five Packaging Profile handlers (`_bomPackBaseSetActive`,
  `_bomPackBaseSetSku`, `_bomPackBaseSetQty`, `_bomPackBaseSetAuto`,
  `_bomSyncPackBaseTray` materialise) by signature** — unchanged.
- **Type cell still read-only** ("ถาด · tray") — the brief allowed broader
  type selection later but said keep it scoped this sprint. No new Type
  dropdown was added.
- **`_bomPackBaseSetType`** — still orphan from Task 11C; not deleted.
  Will pick up purpose again when a Type dropdown is added.
- **`_bomPkgCandidateItems()` (Task 9 manual editor)** — unchanged.
- **`_BOM_PACKAGING_SLOTS.allowed_types`** — array values are unchanged;
  only the comment and the semantics around them have been reframed (now
  "suggested default" rather than "the only allowed").
- **No conversion / inventory / Daily Plan BOM logic.**
- **No new Master Data classification field** (`packaging_slot`,
  `packaging_subtype`, `packaging_scope`, etc.). The brief was explicit
  on this — we did not.
- **No destructive migration** of any existing `packaging_profile` data.

## F. Manual QA checklist

Reload `app/index.html` in the browser first.

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG → BOM section → Packaging Profile | The blue info banner above the table now contains the longer bilingual text including "Slots do not permanently pre-assign type." |
| F2 | Tick Active on Base Pack | The row activates as before; under the hood `packaging_profile.pack_base.item_role = 'PACKAGING'` and `item_type = 'tray'` are written if absent. |
| F3 | Click the Component SKU dropdown | Lists only PACKAGING + item_type = tray items (same as Task 11C). Cover / pack / label / sticker / basket / FG items are NOT present. |
| F4 | Open an FG with primary grade 0, tick Active | Component SKU auto-selects `C19999P302`; the materialised `bom.components` line has `packaging_key: 'tray'` (now sourced from `pp.item_type`, value unchanged). |
| F5 | Open an FG with primary grade 1–6, tick Active | Component SKU auto-selects `C19999P301`. |
| F6 | Pick a different tray SKU manually | `selection_mode` flips to `manual_override`; `↻ auto` appears. |
| F7 | Click `↻ auto` | Reverts to the rule-derived tray. |
| F8 | Save the FG, reopen it | All five existing fields (`enabled`, `packaging_key`, `component_sku`, `selection_mode`, `qty_per_selling_unit`) persist, plus the two new fields (`item_role`, `item_type`). |
| F9 | Open an FG that was saved BEFORE Task 11D (no `item_role` / `item_type` stored) | Loads with no error. On the next interaction (toggle Active, change SKU, change qty) the two new fields are backfilled with their PACKAGING / tray defaults; behaviour is unchanged from Task 11C. |
| F10 | Look at the 6 placeholder rows | They still show read-only suggested types in the Type column; still say "ยังไม่เปิดใช้งาน — ไม่มีผลต่อ BOM"; still disabled; still do not block BOM Enable. |
| F11 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally; no console errors. |

## G. Known risks

- **Manual QA F1–F11 not yet run** — static + Node `vm` acceptance only (see H).
- **The Type cell is still read-only this sprint.** The data model is now
  ready for a selectable Type dropdown (`item_role` + `item_type` are
  first-class fields), but the UI control is deferred — only tray is fully
  supported today. Adding the Type dropdown later is a small follow-up that
  uses the existing `allowed_types` (or a generalised
  `_bomPkgRolesAndTypes` lookup) to populate options.
- **A future operator change of `item_type` to non-tray would today
  un-materialise the controlled line** (the sync would no-op on non-tray),
  effectively behaving as "disable". This is intentional for this sprint
  ("Do not build this full behavior unless needed now; but do not design
  against it"); the data model and the sync gate are forward-compatible.
- **`_bomPackBaseSetType` remains orphan** (Task 11C). When a real Type
  dropdown is added, it becomes the natural writer for `pp.item_type`.
- The earlier closeout
  `UAT_TASK11D_PACKAGING_PROFILE_TYPE_SEMANTICS_CLOSEOUT.md` is still on
  disk. Its description of `allowed_types` as the "active row filter"
  no longer matches the code — that role moved to
  `_bomPkgCandidatesByType` driven by the profile's `item_role` +
  `item_type`. The Type Semantics closeout otherwise still applies
  (column rename, banner, placeholder labels).

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup
  (`{}` 0, `[]` 0, backticks even); paren imbalance −35, unchanged.
- New symbols (`function _bomPkgCandidatesByType`,
  `function _bomPkgTrayCandidateItems`, `item_role: 'PACKAGING', item_type:
  'tray'`, the two `var ppItemType = …` locals in sync + render,
  `line.packaging_key        = ppItemType;`, the new banner text) each
  present the expected number of times.
- Existing handlers (`_bomPackBaseSetActive`, `_bomPackBaseSetSku`,
  `_bomPackBaseSetQty`, `_bomPackBaseSetAuto`, `_bomSyncPackBaseTray`,
  `_bomRenderItemPackagingProfile`, `_bomPkgCandidateItems` (Task 9),
  `_bomSlotTypeDisplay` (Task 11D Type Semantics)) all intact.

**Functional checks — passed.**
- **New Node `vm` acceptance harness: 23 / 23.** Covers
  `_bomPkgCandidatesByType` (tray / cover / label / sticker / pack / basket
  / SUPPLY filtering), case-insensitive role + type, empty-type → empty,
  empty-role defaults to PACKAGING, active vs inactive (with current-sku
  preservation), placeholder exclusion, sort, and the tray-wrapper delegation.
- **Task 11C regression harness re-extracted and re-run: 15 / 15.** The tray
  wrapper continues to behave exactly as Task 11C's harness expects.
- **Task 11D (Type Semantics) regression harness re-extracted and re-run:
  23 / 23.** `_BOM_PACKAGING_SLOTS` shape, `allowed_types` per slot, and
  `_bomSlotTypeDisplay` are unchanged.

**Acceptance criteria 1–10:**
- AC1 (UI no longer implies each slot permanently pre-assigns a type) ✓ — banner explicitly says "Slots do not permanently pre-assign type" + slot's `allowed_types` reframed as suggested default.
- AC2 (Base Pack can still default to tray) ✓ — defaults wired in `_bomPackBaseProfile` and `_bomPackBaseSetActive`.
- AC3 (SKU dropdown for tray still filters PACKAGING + tray) ✓ — harness T1.
- AC4 (Data model can store selected item_role + item_type) ✓ — two new additive fields on `packaging_profile.<slot>`.
- AC5 (Auto egg-size tray rule only applies to Base Pack + tray) ✓ — sync gates on `ppItemType === 'tray'`.
- AC6 (Other rows remain inactive and no BOM impact) ✓ — sync ignores them; readiness gate not affected.
- AC7 (No new Master Data classification fields) ✓ — uses existing item_role + item_type only.
- AC8 (No conversion / inventory / Daily Plan BOM logic) ✓ — none added.
- AC9 (Existing Task 10B/11C data backward-compatible) ✓ — `item_type` falls back to `packaging_key` falls back to `'tray'` in both render and sync.
- AC10 (Section K regression) — to be confirmed by manual QA F11.

**Outstanding:** manual QA F1–F11 and Section K regression. Roll back with
`cp _archive/index-pre-pkgprofile-design-correction-20260525.html app/index.html`
if any K-row regression fails.
