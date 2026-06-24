# UAT Task 11C — Packaging Profile model clarification (existing item_type) — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `1c7937dbf5240b8f5c2b1dc3cdfaf5ae`
**Post-edit app MD5:** `0c1de075d344d158d3b88f0c492a00e7`   *(see Note 1)*
**Rollback:** `cp _archive/index-pre-pkgprofile-subtype-20260525.html app/index.html`

Clarifies the Packaging Profile model around the **existing** Master Data
`item_type` field — no new `packaging_slot` / `packaging_subtype` / option_set
entries are introduced. The Base Pack row now:

- Renders **Type** as read-only `ถาด · tray` (the existing item_type already
  carries the subtype; a redundant dropdown is gone).
- Pulls Component SKU options from a new tray-only candidate helper that
  filters Master Data to `item_role = PACKAGING` AND `item_type = tray`.
- Excludes cover / pack / label / sticker / basket / FG items from the dropdown.
- Keeps inactive tray SKUs in the list **only** when they are the currently-paired
  SKU (so a historically-stored value remains visible to the operator).
- Placeholder rows now read "ยังไม่เปิดใช้งาน — ไม่มีผลต่อ BOM" /
  "Not active yet — no BOM impact" instead of generic "coming soon".
- Bottom helper text now spells out the tray-only scope and the temporary
  nature of qty / unit conversion.

All Task 10A / 10B data shapes are preserved. No code was deleted.

> **Note 1.** The recorded post-edit MD5 above is checked against the file at
> the moment this closeout was written. If you re-run any tooling that
> re-saves the file, recompute via `md5sum app/index.html` to confirm.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 5 anchored edits, all inside `_bomRenderItemPackagingProfile` and one new helper just before it. +2,399 bytes. No JS function deleted; no UI handler renamed. |
| `_archive/index-pre-pkgprofile-subtype-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`1c7937dbf5240b8f5c2b1dc3cdfaf5ae`) before any edit. |
| `_archive/closeouts/UAT_TASK11C_PACKAGING_PROFILE_EXISTING_TYPE_CLARIFICATION_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK11C_task11c_acceptance.js` | NEW — Node `vm` acceptance harness (15 assertions for the new tray-only candidate helper). |
| `docs/BUG_LOG.md` | **Not touched.** This sprint clarifies an existing path without introducing new risk. The pre-existing UAT-045 (tray SKUs not in master) still applies on the canonical path; UAT-049 (BOM Bulk Upload deprecation) still applies. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. Sections / functions changed

- **`_bomRenderItemPackagingProfile(it)`** (Task 10A/10B function) — four small
  edits to the Base Pack row's Type cell, the candidate-fetch line, the
  placeholder-row text, and the bottom helper text. The function's signature,
  data writes, and overall structure are unchanged.
- **`_bomPkgTrayCandidateItems(currentSku)`** — NEW helper, ~16 lines, inserted
  immediately before `_bomRenderItemPackagingProfile`. Returns active
  PACKAGING-type tray items, plus the currently-paired SKU (even if inactive)
  for historical visibility, excluding placeholders, sorted by SKU.

Existing functions left fully intact:
- `_bomSyncPackBaseTray`, `_bomPackBaseProfile`, `_bomPackBaseSetActive`,
  `_bomPackBaseSetSku`, `_bomPackBaseSetQty`, `_bomPackBaseSetAuto` —
  unchanged; handler-bound onchange/onclick attributes byte-identical.
- `_bomPackBaseSetType(v)` — function still exists; the dropdown that used to
  call it is gone, so it becomes orphan (kept per "do not delete code yet").
- `_bomPkgCandidateItems()` (Task 9) — unchanged; still used by the Task 9
  manual "Other packaging materials" editor.

## C. New helpers added

| Symbol | Purpose |
|---|---|
| `_bomPkgTrayCandidateItems(currentSku)` | Tray-only PACKAGING candidates for the Base Pack SKU dropdown. Uses the existing Master Data `item_type` field (which already supports `tray / cover / pack / label / sticker / basket`); no new packaging_slot / packaging_subtype invented. Honours `is_active` (false → excluded unless current sku), `is_placeholder` (true → excluded), and sorts by SKU. |

## D. UI changes

Base Pack row of the Packaging Profile table:

- **Type cell** — was a `<select>` containing one option `ถาดกระดาษ · Tray`.
  Now a small **read-only** label `ถาด · tray` (greys out when the row is
  inactive). This removes a redundant click target.
- **Component SKU dropdown** — now populated from the new
  `_bomPkgTrayCandidateItems` helper. The list contains only Master Data items
  with `item_role = PACKAGING` AND `item_type = tray`. Cover, pack, label,
  sticker, basket, and FG items are not selectable. The current-paired-but-
  unlisted SKU still renders as a preserved "not listed" option (existing
  behaviour, unchanged) so historical data is visible.

Placeholder rows 2–7 of the table:

- Status cell now reads `ยังไม่เปิดใช้งาน — ไม่มีผลต่อ BOM ·
  Not active yet — no BOM impact` (replacing the prior `เร็วๆ นี้ · coming soon`).
  The rows still have a disabled checkbox and render as inactive — no BOM line is
  written by them, no readiness check is blocked, no `bom.components` change is made.

Bottom of the panel:

- Three short bilingual hints replace the single previous hint:
  1. Tray-only scope: `ตอนนี้ pack ฐาน รองรับเฉพาะถาด — รายการ SKU ดึงจาก
     Master Data ที่เป็น PACKAGING / tray · For now, Base Pack supports only
     tray; the SKU list is filtered to Master Data items with role PACKAGING
     and type tray.`
  2. Egg-size rule (unchanged content, slightly reformatted).
  3. Temporary qty/unit caveat: `จำนวนและหน่วยยังเป็น setup เบื้องต้น —
     conversion logic จะพัฒนาแยกภายหลัง · Qty and unit conversion are
     temporary setup fields; full conversion logic will be developed
     separately.`

## E. What was intentionally not changed

- **`oms-production/`** — not touched.
- **Orders, Daily Planning, `renderPlanBom`, `renderBomSummary`, ใบน้อย,
  Logistics, PO parsers, `safeSet`, header strip, BOM Bulk Upload importer,
  Master Data import / export / restore buttons, `clearMasterV3`** — all
  untouched (verified by file diff: the only changes are within the BOM module
  and confined to the Packaging Profile render).
- **`MASTER_V3.option_sets`** — not touched. No new option_set values added.
  The existing Master Data `item_type` field (which already lists `tray /
  cover / pack / label / sticker / basket` under `item_role = PACKAGING`)
  carries the subtype.
- **Basket Profile, Egg Profile, Test Calculation, BOM status/readiness gate** — unchanged.
- **The Task 10A/10B data shape** — preserved byte-for-byte. `packaging_profile.pack_base`
  still carries `enabled`, `packaging_key`, `component_sku`, `selection_mode`,
  `qty_per_selling_unit`. No migration, no rewrite, no destructive change.
- **`_bomSyncPackBaseTray` materialization** — unchanged. The component still
  writes `component_role: 'pack_base'`, `packaging_key: 'tray'`,
  `component_sku: <chosen tray SKU>`, `source: 'Packaging Profile'`,
  `source_added: 'packaging_profile_pack_base_tray'`.
- **`_bomPackBaseSetType` function** — kept defined (orphan after the dropdown
  removal). Per project convention ("do not delete code yet"). Logged as
  orphan in the dead-helpers family; will be addressed in a future cleanup sprint.
- **`_bomPkgCandidateItems()` (Task 9 helper)** — unchanged; still drives the
  Task 9 manual "Other packaging materials" editor under the collapsible
  section, which intentionally allows the operator to add non-tray packaging
  components (cover/label/sticker/etc) by hand.
- **No conversion / inventory / Daily Plan BOM logic** introduced. No
  `storage_unit` / `consumable_unit` flow. The qty / unit fields remain
  temporary setup fields, clearly labelled as such in the new helper text.

## F. Manual QA checklist

Reload `app/index.html` in the browser first.

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG item → BOM section → Packaging Profile | Base Pack row shows **Type** as read-only "ถาด · tray" (no dropdown). |
| F2 | Click the Component SKU dropdown on the Base Pack row | The list contains only Master Data items with `item_role = PACKAGING` AND `item_type = tray`. Cover / pack / label / sticker / basket / FG items are NOT present. |
| F3 | Open an FG with primary grade 0, tick Active | Component SKU auto-selects `C19999P302 ถาดกระดาษ ใหญ่`; status shows `auto (เบอร์ 0)`. |
| F4 | Open an FG with primary grade 1–6, tick Active | Component SKU auto-selects `C19999P301 ถาดกระดาษ เล็ก`. |
| F5 | In the SKU dropdown, pick the other tray SKU manually | `selection_mode` flips to `manual_override`; an `↻ auto` button appears. |
| F6 | Click `↻ auto` | The SKU reverts to the rule-derived tray. |
| F7 | Inspect rows 2–7 (cover / SKU barcode label / product label / closer 1 / closer 2 / bulk barcode label) | Status reads "ยังไม่เปิดใช้งาน — ไม่มีผลต่อ BOM · Not active yet — no BOM impact". The checkboxes are disabled. None of these rows materialises a `bom.components` entry. |
| F8 | With only Base Pack active and all required fields valid | BOM Enable is **not** blocked by the placeholder rows; the gate only considers the active Base Pack tray (egg size resolved, tray SKU present, qty > 0). |
| F9 | Look at the bottom of the panel | Three small hints visible: (a) tray-only scope, (b) egg-size rule, (c) "qty/unit is temporary setup". |
| F10 | Save the FG, reopen it | Active state, paired Component SKU, selection mode, and qty all persist exactly as before. |
| F11 | Open an item that historically stored a non-tray PACKAGING SKU under `packaging_profile.pack_base.component_sku` | The dropdown still surfaces that stored SKU as a "not listed" option so the operator can see what's there and re-pick a real tray. |
| F12 | Open a basket FG | The basket line is still controlled only by the Basket Profile — Packaging Profile changes do not affect it. |
| F13 | Open the Master Data manual "Other packaging materials" editor (collapsible "▸") | It still lists all non-basket PACKAGING items (Task 9 path) — unaffected by Task 11C. |
| F14 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally; no console errors. |

## G. Known risks

- **Manual QA F1–F14 not yet run** — static + Node vm acceptance only (see H).
- **`_bomPackBaseSetType` is now orphan** — its only caller (the Type dropdown)
  was removed in Edit B; the function definition remains. Harmless. Group it
  with the existing dead-helpers family (UAT-013 / UAT-033 / UAT-037 / UAT-039)
  for a single future cleanup sprint.
- **No new flag for "stored SKU is not type=tray"** — if an operator's saved
  `component_sku` references a Master Data item that exists but is no longer
  `item_type = tray`, the dropdown will still display it as "not listed" but
  won't mark it as type-mismatched. Edge case; deferred. (Would need ~3 lines
  in the render and a tiny UI badge.)
- **Tray SKUs still need to exist in Master Data for the feature to be useful**
  — UAT-045 still applies. The clarification doesn't change that constraint.
- **The temporary qty/unit caveat is now explicit in the UI** — operators
  may ask when "full conversion logic" arrives. The hint text directs them
  that it will be developed separately; this matches the brief's "do not build
  storage / consumable conversion here" scope.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup (`{}` 0, `[]` 0,
  backticks even); paren imbalance −35, unchanged.
- All five Packaging Profile handlers (`_bomPackBaseSetActive`,
  `_bomPackBaseSetSku`, `_bomPackBaseSetQty`, `_bomPackBaseSetAuto`,
  `_bomSyncPackBaseTray`) verified `grep -Fc = 1`.
- The old `_bomPackBaseSetType(this.value)` call site is gone (count = 0); the
  function definition remains intact (count = 1) per "do not delete code."
- `_bomPkgCandidateItems` (Task 9) still defined and reachable.

**Functional checks — passed.** A Node `vm` acceptance harness ran **15 / 15**
assertions on `_bomPkgTrayCandidateItems`:
- Filters to `item_role = PACKAGING` AND `item_type = tray` only.
- Excludes cover / label / sticker / pack / basket / FG.
- Excludes inactive tray SKUs unless they match the currently-paired SKU.
- Excludes placeholder items even when current.
- Sorts by SKU.
- Case-insensitive on `item_role` and `item_type`.
- Empty MASTER_V3 → empty result.

**Acceptance criteria 1–14:**
- AC1 (Slot → existing item_type → SKU → Usage clarified) ✓ — model documented in this closeout + UI now reflects it.
- AC2 (No new packaging_slot / packaging_subtype fields) ✓ — no new data fields introduced.
- AC3 (Base Pack row shows Tray as the only active type) ✓ — read-only "ถาด · tray".
- AC4 (Component SKU dropdown pulls PACKAGING + item_type=tray) ✓ — harness T1a-j.
- AC5 (Dropdown does not show cover/pack/label/sticker/basket) ✓ — harness T1c-g.
- AC6 (Size 0 auto-selects C19999P302) ✓ — `_bomDeriveTrayForItem` unchanged.
- AC7 (Other sizes auto-select C19999P301) ✓ — same.
- AC8 (Manual override only allows PACKAGING/tray SKUs) ✓ — dropdown filtered.
- AC9 (Placeholder rows say no BOM impact) ✓ — text replaced.
- AC10 (Placeholder rows do not block BOM Enable) ✓ — they were never writers; status is now explicit.
- AC11 (Qty/output remains simple and marked as temporary) ✓ — explicit helper text.
- AC12 (No conversion / inventory / Daily Plan BOM logic) ✓ — none added.
- AC13 (Save and reopen preserves existing Task 10B data) ✓ — data shape unchanged.
- AC14 (Section K regression) — to be confirmed by manual QA F14.

**Outstanding:** manual QA F1–F14 and Section K regression. Roll back with
`cp _archive/index-pre-pkgprofile-subtype-20260525.html app/index.html` if any
K-row regression fails.
