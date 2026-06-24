# UAT Task 11D — Packaging Profile Type semantics (clarity refinement) — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `0c1de075d344d158d3b88f0c492a00e7`
**Post-edit app MD5:** `475ea759a90d6b3f64d1c0ce34eb9b22`
**Rollback:** `cp _archive/index-pre-pkgprofile-typesemantics-20260525.html app/index.html`

A small clarity refinement of the Packaging Profile table. The wiring is
**unchanged**; the model is now visible to operators and developers:
**Slot → Type / Sub-type (the existing Master Data `item_type`) → Component
SKU → Usage**. The Type column is renamed to "ประเภทวัสดุ · Type / Sub-type",
a short info note above the table explains the relationship, the placeholder
rows now show their *expected* type (read-only) instead of "—", and a
front-end `allowed_types` list on each slot makes the slot→type mapping
queryable in code.

Five anchored edits, all inside the Packaging Profile area. No business logic,
no data shape, no handler signature touched. Existing Master Data `item_type`
vocabulary (`tray / cover / pack / label / sticker / basket`) is what carries
the subtype — **no new option_set values added**.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 5 anchored edits, all inside `_bomRenderItemPackagingProfile` and the `_BOM_PACKAGING_SLOTS` const above it. +2,349 bytes. |
| `_archive/index-pre-pkgprofile-typesemantics-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`0c1de075d344d158d3b88f0c492a00e7`). |
| `_archive/closeouts/UAT_TASK11D_PACKAGING_PROFILE_TYPE_SEMANTICS_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK11D_task11d_acceptance.js` | NEW — Node `vm` acceptance harness (23 assertions). |
| `docs/BUG_LOG.md` | **Not touched.** Clarification only; no new risk. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. Sections / functions changed

- **`_BOM_PACKAGING_SLOTS`** (const, Task 10B) — each of the 7 entries gains an
  `allowed_types` array mirroring the existing Master Data `item_type`
  vocabulary. `pack_base → ['tray']`, `cover → ['cover']`,
  `barcode_sku_label → ['label']`, `product_label_sticker → ['sticker','label']`,
  `closer_1 → []`, `closer_2 → []`, `bulk_barcode_label → ['label']`.
  Empty array = "uncertain — show —". Existing fields (`role`, `th`, `en`,
  `ready`) are byte-identical.
- **`_bomSlotTypeDisplay(slot)`** — NEW helper, ~10 lines. Bilingual
  human-readable label for a slot's allowed_types list; falls back to "—" when
  the list is empty. Used by the placeholder rows.
- **`_bomRenderItemPackagingProfile(it)`** — four small surface edits:
  - Column header "ประเภท · Type" → "**ประเภทวัสดุ · Type / Sub-type**".
  - New info note above the table: *"ℹ ลำดับการเลือก: Slot → ประเภทวัสดุ
    (item_type) → SKU วัสดุ → จำนวน · The Type / Sub-type column is the
    packaging SKU `item_type`. The Component SKU dropdown is filtered by
    that type."* (blue `#F0F9FF` panel for emphasis).
  - Base Pack row Type cell — bolder (font-weight 500 → 600) + a bilingual
    `title` tooltip that says the sub-type filters which SKUs appear in the
    Component SKU dropdown.
  - Placeholder rows Type cell — now renders `_bomSlotTypeDisplay(s)` (greyed)
    instead of a bare "—", so an operator can see at a glance which future
    `item_type` each slot will accept.

Existing helpers and handlers left fully intact:
- `_bomPkgTrayCandidateItems(currentSku)` (Task 11C) — unchanged.
- `_bomSyncPackBaseTray`, all five `_bomPackBaseSet*` handlers,
  `_bomPackBaseProfile`, `_bomToggleOtherPkg`,
  `_bomRenderOtherPackagingSection` — byte-identical.
- `_bomPkgCandidateItems` (Task 9) — unchanged; still drives the manual
  "Other packaging materials" editor.

## C. New helpers added

| Symbol | Purpose |
|---|---|
| `_bomSlotTypeDisplay(slot)` | Read-only bilingual label for the placeholder rows' Type cell. Looks up each `allowed_types[]` code against a built-in TH ↔ EN map (tray / cover / pack / label / sticker / basket), joins with " / ", returns "—" when empty. |

The `allowed_types` field on `_BOM_PACKAGING_SLOTS` is also new — additive,
front-end-only taxonomy. **It is NOT a new Master Data field** and is not
persisted on any item.

## D. UI changes

Packaging Profile table:

- **Info banner** at the top of the panel (blue `#F0F9FF`):
  *"ℹ ลำดับการเลือก: **Slot → ประเภทวัสดุ (item_type) → SKU วัสดุ → จำนวน** ·
  The **Type / Sub-type** column is the packaging SKU `item_type` (tray /
  cover / pack / label / sticker). The **Component SKU** dropdown is filtered
  by that type."* Makes the model visible without changing any field name.
- **Column header** — was "ประเภท · Type"; now **"ประเภทวัสดุ · Type /
  Sub-type"**. Clarifies that this is the *subtype* of the packaging SKU.
- **Base Pack row Type cell** — still reads "ถาด · tray" (read-only), now in
  weight 600 with a bilingual tooltip: *"ประเภทวัสดุนี้ควบคุมว่า SKU ใดจะ
  ปรากฏใน Component SKU dropdown · This sub-type filters which SKUs appear in
  the Component SKU dropdown."*
- **Placeholder rows Type cell** — was "—"; now shows the expected
  `item_type` per row, greyed:
  - cover → `ฝาครอบ · cover`
  - SKU barcode label → `ฉลาก · label`
  - Product label / sticker → `สติ๊กเกอร์ · sticker / ฉลาก · label`
  - Closer 1 → `—` (uncertain; brief said "if uncertain show —")
  - Closer 2 → `—` (uncertain)
  - Bulk barcode label → `ฉลาก · label`
- **No layout change**; column widths stay the same. The placeholder rows
  still show "ยังไม่เปิดใช้งาน — ไม่มีผลต่อ BOM · Not active yet — no BOM
  impact" in the Status column and a disabled checkbox.

## E. What was intentionally not changed

- **`oms-production/`** — not touched.
- **Orders, Daily Planning, `renderPlanBom`, `renderBomSummary`, ใบน้อย,
  Logistics, PO parsers, `safeSet`, header strip, BOM Bulk Upload importer,
  Master Data import/export/restore, Clear Master Data** — all untouched.
- **`MASTER_V3.option_sets`** — not touched. No new option_set codes.
  The existing Master Data `item_type` dropdown (tray / cover / pack / label
  / sticker / basket) is the source of truth; this sprint adds a front-end
  mirror of that vocabulary in `allowed_types` but does not modify Master
  Data.
- **Egg Profile, Basket Profile, Test Calculation, BOM readiness gate,
  `_bomSyncPackBaseTray` materialization shape, all five Packaging Profile
  handlers** — unchanged.
- **Task 10A / 10B / 11C data shapes** — preserved byte-for-byte.
  `packaging_profile.pack_base.{enabled, packaging_key, component_sku,
  selection_mode, qty_per_selling_unit}` continue to load/save unchanged.
- **`_bomPkgTrayCandidateItems(currentSku)`** — unchanged. Component SKU
  dropdown still filters to `item_role = PACKAGING` AND `item_type = tray`
  (Task 11C). The new `allowed_types` data does not yet drive filtering for
  the Base Pack row; that wiring can become slot-driven later if/when more
  rows go active.
- **`_bomPackBaseSetType`** — still orphan from Task 11C; not deleted.
- **`_bomPkgCandidateItems()` (Task 9 manual editor)** — unchanged.
- **No conversion / inventory / Daily Plan BOM logic** introduced.
- **No new Master Data field** (`packaging_slot`, `packaging_subtype`,
  `packaging_scope`, etc.). The brief was explicit on this — we did not.

## F. Manual QA checklist

Reload `app/index.html` in the browser first.

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG → BOM section → Packaging Profile | A small blue info banner sits above the table: "Slot → Type/Sub-type (item_type) → SKU วัสดุ → จำนวน" |
| F2 | Read the table column header where it used to say "ประเภท · Type" | Now reads **"ประเภทวัสดุ · Type / Sub-type"** |
| F3 | Hover the Base Pack row's Type cell ("ถาด · tray") | Tooltip explains the sub-type controls which SKUs appear in the Component SKU dropdown |
| F4 | Look at the placeholder row "ฝาครอบ · Cover" | Type cell shows greyed text "ฝาครอบ · cover" (was "—") |
| F5 | Look at the placeholder row "ฉลาก barcode SKU" | Type cell shows greyed "ฉลาก · label" |
| F6 | Look at the placeholder row "ฉลาก / สติกเกอร์" (Product label / sticker) | Type cell shows greyed "สติ๊กเกอร์ · sticker / ฉลาก · label" |
| F7 | Look at Closer 1 and Closer 2 rows | Type cell remains "—" (uncertain) |
| F8 | Look at Bulk barcode label row | Type cell shows greyed "ฉลาก · label" |
| F9 | Click the Component SKU dropdown on Base Pack | Still filtered to PACKAGING + item_type=tray only (Task 11C behaviour unchanged) |
| F10 | Tick Active on a size-0 FG | Component SKU auto-selects `C19999P302`; the materialised `bom.components` line is unchanged in shape (component_role=pack_base, packaging_key=tray, source_added=packaging_profile_pack_base_tray) |
| F11 | Save the FG, reopen it | Active state, paired SKU, selection mode, qty all persist |
| F12 | None of the 6 placeholder rows enables a checkbox | Disabled checkboxes; no `bom.components` write; BOM Enable gate is not blocked by any placeholder row |
| F13 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally; no console errors |

## G. Known risks

- **Manual QA F1–F13 not yet run** — static + Node `vm` acceptance only (see H).
- **`allowed_types` is front-end-only taxonomy**, not persisted, not
  validated against Master Data. If a future sprint introduces a packaging
  item with an `item_type` that we haven't put in our `TH` map inside
  `_bomSlotTypeDisplay`, the label gracefully falls back to "code · code"
  (verified by harness T2l).
- **`product_label_sticker` shows two types** (sticker + label) in the Type
  cell. The brief alternated between "→ sticker" (UI section) and "→ [sticker,
  label]" (code-structure section); we followed the code-structure version
  so the future taxonomy is closer to reality. Easy to change later if you'd
  rather see only one.
- **The new `allowed_types` field does not yet drive the Base Pack SKU
  dropdown** — the dropdown still uses the dedicated `_bomPkgTrayCandidateItems`
  helper (which hard-codes `item_type=tray`). When more slots go active, the
  dropdown filter should be refactored to read `slot.allowed_types` instead.
  Documented as a future cleanup, not a risk today.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup (`{}` 0, `[]` 0,
  backticks even); paren imbalance −35, unchanged.
- New symbols (`function _bomSlotTypeDisplay`, `allowed_types: ['tray']`,
  `allowed_types: ['cover']`, `allowed_types: ['sticker','label']`,
  `ประเภทวัสดุ · Type / Sub-type`) each appear exactly once.
- Existing handlers (`_bomPackBaseSetActive`, `_bomPackBaseSetSku`,
  `_bomPackBaseSetQty`, `_bomPackBaseSetAuto`, `_bomSyncPackBaseTray`,
  `_bomPkgTrayCandidateItems`, `_bomPkgCandidateItems`,
  `_bomRenderItemPackagingProfile`) all intact, each `grep -Fc = 1`.

**Functional checks — passed.**
- New Node `vm` acceptance harness: **23 / 23**. Covers the `_BOM_PACKAGING_SLOTS`
  shape (7 slots, 6 ready=false, each `allowed_types` matches the spec) and
  `_bomSlotTypeDisplay` (every TH/EN mapping, multi-type join, empty
  fallback, null/undefined safety, unknown-code passthrough, every active
  slot has a non-empty allowed_types).
- Task 11C harness re-extracted from the updated file and re-run:
  **15 / 15** — `_bomPkgTrayCandidateItems` behaviour unchanged (filter
  correctness, basket/cover/label/sticker/pack/FG exclusion, inactive-with-
  current preservation, placeholder exclusion, sort, case-insensitive
  role/type, empty MASTER_V3).

**Acceptance criteria 1–7:**
- AC1 (UI communicates Slot → Type/Sub-type → SKU) ✓ — info banner + column rename + tooltip + placeholder labels.
- AC2 (Type/Sub-type is understood as existing Master Data `item_type`) ✓ — banner text says so explicitly.
- AC3 (Base Pack / tray SKU dropdown only shows PACKAGING + item_type=tray) ✓ — Task 11C unchanged; verified by 11C harness re-run.
- AC4 (Future rows remain inactive and no BOM impact) ✓ — disabled checkboxes; Status text "no BOM impact"; `_bomSyncPackBaseTray` ignores them.
- AC5 (No new Master Data fields) ✓ — `allowed_types` is front-end only.
- AC6 (No conversion / inventory / Daily Plan BOM logic) ✓ — none added.
- AC7 (Section K regression) — to be confirmed by manual QA F13.

**Outstanding:** manual QA F1–F13 and Section K regression. Roll back with
`cp _archive/index-pre-pkgprofile-typesemantics-20260525.html app/index.html`
if any K-row regression fails.
