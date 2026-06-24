# UAT Task 11F — PACKAGING / SUPPLY unit-conversion contract — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `e848e5a0c6eb24fe6adfc2c3aaebe6df`
**Post-edit app MD5:** `707c32fe1b7362e9646180c026a2ad09`
**Rollback:** `cp _archive/index-pre-pkg-unit-contract-20260525.html app/index.html`

Makes the PACKAGING / SUPPLY unit contract explicit in the UAT. The
materialised BOM line **must** use the selected component SKU's `base_unit`
(not the supply / storage unit); the operator-facing labels in the item
editor now spell out which unit drives BOM and which is for later display;
and the Packaging Profile sync now flags `needs_review` when the selected
PACKAGING SKU has no `base_unit` set in Master Data — instead of silently
falling back to `"piece"`.

Eight anchored edits, all inside the BOM module + the item editor's
Counting & Units block. **No business logic was added** — the sync already
read `base_unit` from the SKU; this sprint adds a validation gate, clarifies
copy, and tightens the contract. Existing data shape is preserved
byte-for-byte (the existing `units.consumable_unit` / `base_per_consumable`
field IS the "supply unit" the brief talks about — no rename).

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 8 anchored edits across (a) `_bomSyncProfileSlot` (3 small edits for the missing-base_unit gate + note), (b) the item editor's Counting & Units / Supply block helper text (3 edits), (c) the Packaging Profile table Qty column header + bottom hint (2 edits). +1,253 bytes. |
| `_archive/index-pre-pkg-unit-contract-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`e848e5a0c6eb24fe6adfc2c3aaebe6df`). |
| `_archive/closeouts/UAT_TASK11F_PACKAGING_SUPPLY_UNIT_CONVERSION_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK11F_task11f_acceptance.js` | NEW — Node `vm` acceptance harness (14 assertions). |
| `docs/BUG_LOG.md` | **Not touched.** Clarification + a gate; no new known-risk row needed. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. Current conversion-section inspection findings

Inspection results before any edit (these informed the scope):

1. **The existing item.units shape carries everything we need.** No new field had to be invented:
   - `units.base_unit` — the canonical BOM consumption unit (e.g. `ใบ`, `ดวง`).
   - `units.pack_unit` + `units.base_per_pack` — pack level (used by FG selling-unit conversion).
   - `units.storage_unit` + `units.base_per_storage` — storage / pallet level. Legacy `palette_unit` / `base_per_palette` migrates here in `normalizeItemUnits` at runtime.
   - `units.has_consumable_unit` + `units.consumable_unit` + `units.base_per_consumable` — **this IS the "supply unit"** the brief talks about. The editor already labels it "หน่วยจ่ายวัสดุ · Supply / issue unit (SUPPLY items only)" (line 10239–10245). No rename needed.
2. **`_bomSyncProfileSlot` already used the right field** for the materialised line: `var skuUnit = ((skuItem.units && skuItem.units.base_unit) || skuItem.base_unit || '');` → `line.unit = skuUnit || 'piece';`. The contract was already correct; the **only real defect** was: when `skuUnit` came out empty (SKU has no `base_unit`), the sync silently wrote `unit = 'piece'` and did NOT flag `needs_review`. The operator had no signal that the SKU was misconfigured.
3. **Test Calculation already displays the correct unit.** `_bomRenderItemTestCalc` reads `ln.unit` from `buildBomComponentLinesForItem`, which carries the materialised `line.unit` through. No fix needed in the Test Calc render.
4. **`buildBomComponentLinesForItem` otherComps branch** passes the materialised component's `c.unit` straight through to the rendered line. Already correct.
5. **`validateMasterItem`** already warns when `storage_unit` is set but `base_per_storage <= 0`, and similarly for `consumable_unit` / `base_per_consumable` (lines 14802 onward). Existing warnings are kept; no new validation rules were added here.
6. **The Counting & Units editor block** already exposed all the right fields (lines 10215–10245). The helper-text wording, however, did NOT make it clear which unit drives BOM vs. which is for later display. That was a real source of operator confusion.

## C. Unit contract implemented

The contract is now explicit in both code and UI:

| Unit (existing field) | Role | Used in BOM consumption math? | Used in display / later issue? | Blocks BOM Enable when missing? |
|---|---|:--:|:--:|:--:|
| `units.base_unit` | **BOM consumption unit** | **Yes** — `_bomSyncProfileSlot` writes `line.unit = sku.units.base_unit` | Yes (also shown in Components / Test Calc tables) | **Yes** — active profile row flags `needs_review` |
| `units.consumable_unit` (supply / issue unit) | Later display / warehouse issue | No | Reserved for later UI | No — leaving blank does not block Enable |
| `units.storage_unit` | Warehouse / pallet level | No | Inventory display only | No — orthogonal to BOM consumption |
| `units.pack_unit` | Selling-unit conversion (FG) | Yes for FG (`getSellingUnitBaseFactor`) | n/a for PACKAGING / SUPPLY | n/a here |

Key invariants the sync now enforces:
- Materialised `bom.components` line `unit` = **selected component SKU's `units.base_unit`** (never `consumable_unit`, never `storage_unit`, never parsed from a label).
- The Packaging Profile `qty_per_selling_unit` is in the **component SKU base unit**, expressed as "base units per 1 FG selling pack" — copied through to the BOM line unchanged. No supply-unit conversion is applied.
- An active profile row whose selected SKU has no `base_unit` set → `needs_review = true` with the explicit note *"SKU `<sku>` ยังไม่ได้ตั้ง base_unit ใน Master Data · packaging SKU has no base_unit — BOM line needs a consumption unit"*. The existing `_bomItemReadiness` gate blocks BOM Enable on `needs_review`.
- Missing `consumable_unit` / `storage_unit` on the SKU → **does not** flag, does not block Enable. They are not BOM consumption fields.

## D. UI / label changes

Item editor → Counting & Units (`📐 หน่วยและการนับ`):

| Section | Before helper | After helper |
|---|---|---|
| Base unit | *"Base unit is the smallest counting unit for this item."* | *"Base unit is the smallest counting unit. **For PACKAGING / SUPPLY items, this is the BOM consumption unit (e.g. tray = ใบ, label = ดวง).**"* |
| Storage unit | *"Warehouse/storage only, e.g. pallet, crate, case — cannot be a selling unit."* | *"Warehouse/storage only, e.g. pallet, crate, case — cannot be a selling unit, **and not used in BOM consumption math yet.**"* |
| Supply / issue unit (`หน่วยจ่ายวัสดุ`) | *"For operating-supply issue logic — not a selling unit."* | *"**Used later for BOM / warehouse issue display, not for BOM consumption math yet. Leaving this blank does not block BOM Enable.**"* |

Packaging Profile table:

- Qty column header: `จำนวน · Qty/output` → **`จำนวน · Qty / FG pack`**.
- New helper line directly below the table:
  *"ℹ จำนวนเป็น base unit ของ SKU วัสดุที่เลือก (ไม่ใช่ supply unit / storage unit) — อ่านว่า "จำนวนหน่วยฐาน ต่อ 1 pack สินค้าขาย" · **Qty is in the selected component SKU base unit (not the supply / storage unit) — read as base units per 1 FG selling pack.**"*
- Existing temporary-conversion hint kept directly below the new one.

No new control was added. No field name changed. No new option_set value.

## E. Legacy conflicts fixed

| Conflict (per the brief) | Found? | Resolution |
|---|---|---|
| Materialised packaging line uses `supply_unit` instead of `base_unit` | NO — already used `base_unit`. | No change needed (verified by Task 11E sync code). |
| Materialised line uses top-level `base_unit` when `units.base_unit` differs | NO — sync reads `units.base_unit` first, falls back to top-level only when absent. | Confirmed correct. |
| Packaging Profile Qty label implies supply unit | YES — `Qty/output` was ambiguous. | Edit 5a + 5b. |
| Test Calculation displays the wrong unit for a packaging component | NO — Test Calc reads `ln.unit` directly. | No change needed. |
| Validation allows active Packaging Profile row with selected SKU but missing `base_unit` | **YES — this was the real defect.** Sync silently wrote `unit = 'piece'` and did not flag. | **Edits 1a/1b/1c** — sync now flags `needs_review` with an explicit note; readiness gate blocks Enable. |
| Operator could not tell which unit drives BOM and which is for later display | YES — helper text was unclear. | Edits 2, 3, 4. |

## F. What was intentionally not changed

- **`oms-production/`** — not touched.
- **Orders, Daily Planning, `renderPlanBom` (UAT-016 untouched), `renderBomSummary`, ใบน้อย, Logistics, PO parsers, `safeSet`, header strip, BOM Bulk Upload importer, Master Data import/export/restore, Clear Master Data** — all untouched.
- **`MASTER_V3.option_sets`** — not touched.
- **Egg Profile** — unchanged.
- **Basket Profile** — unchanged. (Confirmed via grep: `_bomSelectBasketSku` still reads the selected basket SKU's `units.base_unit` via `_bomResolveBasketUnit`, the same contract; no edit needed.)
- **`normalizeItemUnits`, `validateMasterItem` unit rules, `getSellingUnitBaseFactor`, `convertSellingQtyToBase`** — untouched. Pre-existing warnings for "storage_unit set but base_per_storage missing" and "consumable_unit set but base_per_consumable missing" still apply.
- **Field names** — no rename. The existing `units.consumable_unit` + `units.base_per_consumable` ARE the "supply unit" the brief refers to; the editor already labels them as Supply / issue unit. **No data migration. No new field.**
- **No conversion math** added: `qty_per_selling_unit` is passed through the sync unchanged. A SKU's `base_per_consumable` is not consumed for any BOM math in this sprint.
- **No inventory deduction, no Daily Plan BOM integration, no bulk-importer change, no new Master Data classification field.**
- **`_bomSyncProfileSlot`'s overall flow** — unchanged. Only the `needsReview` gate, the local `skuHasBaseUnit`, and one new note clause were added.
- **All Task 11E generic slot editor logic** — unchanged. Cover row still materialises; tray auto rule still works (regression-tested 37 / 37 against Task 11E harness).

## G. Manual QA checklist

Reload `app/index.html` in the browser first.

**Prep:** make sure at least one of your PACKAGING SKUs has the canonical fields:
- `C19999P301 ถาดกระดาษ เล็ก` — `item_role=PACKAGING`, `item_type=tray`, `units.base_unit=ใบ`. Optionally `units.has_consumable_unit=true`, `units.consumable_unit=มัด`, `units.base_per_consumable=100`.
- `C29999P301 ฝาครอบ 30 เล็ก` — `item_role=PACKAGING`, `item_type=cover`, `units.base_unit=ใบ`.

| # | Step | Expected |
|---|------|----------|
| F1 | Open a PACKAGING item editor → Counting & Units | Base-unit helper now spells out *"For PACKAGING / SUPPLY items, this is the BOM consumption unit (e.g. tray = ใบ, label = ดวง)."* |
| F2 | Same item, Supply unit block | Helper text now reads *"Used later for BOM / warehouse issue display, not for BOM consumption math yet. Leaving this blank does not block BOM Enable."* |
| F3 | Same item, Storage unit row | Helper text now reads *"…cannot be a selling unit, and not used in BOM consumption math yet."* |
| F4 | Open an FG → Packaging Profile, activate the **Cover** row, pick `C29999P301`, qty 1 | Components per output unit table shows the cover line with **unit = ใบ** (cover SKU's base_unit). Status ✅ manual. |
| F5 | Add a supply unit (`units.has_consumable_unit=true`, `consumable_unit=มัด`, `base_per_consumable=100`) to the cover SKU. Reopen the FG. | Components table **still** shows unit = ใบ (NOT มัด). Qty unchanged. |
| F6 | Add a storage unit (`storage_unit=กล่อง`, `base_per_storage=20`) to the cover SKU. Reopen the FG. | Same as F5 — unit stays ใบ; qty unchanged. |
| F7 | Remove `base_unit` from a test packaging SKU you've activated in a profile row | The active row now shows ⚠ in the Status column with the note *"packaging SKU has no base_unit — BOM line needs a consumption unit"*. **BOM Enable becomes disabled.** |
| F8 | Restore the `base_unit` | Row goes ✅ again; BOM Enable re-enables. |
| F9 | Open the Packaging Profile table | Qty column header now reads **"จำนวน · Qty / FG pack"**. Helper below the table explains *"Qty is in the selected component SKU base unit (not the supply / storage unit) — read as base units per 1 FG selling pack."* |
| F10 | Tick Active on **Base Pack** with primary grade 0 | Tray auto rule still selects `C19999P302`; unit displays correctly (ใบ if the tray SKU has base_unit set; ⚠ + needs_review if not). |
| F11 | Click Test Calculation | The packaging row shows the SKU's base_unit in the Unit column (e.g. ใบ). |
| F12 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally; no console errors. |

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup (`{}` 0, `[]` 0, backticks even); paren imbalance −35, unchanged.
- New copy fragments and the new gate (`skuHasBaseUnit`, the note clause, `Qty / FG pack`, the new bottom hint) all present exactly once.
- All protected helpers / data-f attributes still intact: `_bomSyncProfileSlot`, `_bomSyncPackagingProfile`, `_bomRenderItemPackagingProfile`, `normalizeItemUnits`, `validateMasterItem`, `safeSet`, `persistMasterV3`, `openEditItem`, `renderPlanBom`, `renderBomSummary`, `buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomPkgCandidatesByType`. Each `data-f` attribute on `units.base_unit / consumable_unit / base_per_consumable / storage_unit / base_per_storage` still present.

**Functional checks — passed.**
- **New Node `vm` acceptance harness: 14 / 14.** Covers:
  - Materialised line uses SKU `base_unit` (T1a/c).
  - Cover line not `needs_review` when SKU is well-formed (T1b).
  - SKU with `consumable_unit` (supply) does NOT change the line unit (T2a) and does NOT change the qty (T2b).
  - SKU with `storage_unit` does NOT change the line unit (T3).
  - SKU with **missing `base_unit`** → `needs_review` and the note mentions `base_unit` (T4a/b).
  - SKU with an **empty `units` object** → `needs_review` (T5).
  - SKU with only `base_unit` (no supply unit) → `needs_review` false (T6) — proving missing supply unit does not block.
  - Tray auto rule regression: size 3 → P301 + unit ใบ; size 0 → P302 (T7a/b).
  - Qty preserved exactly through sync (no `/100`, no `*100`) (T8).
- **Task 11E regression harness re-extracted and re-run: 37 / 37.** Generic slot sync, cover activation, basket protection, legacy-tag recognition, all unchanged.

**Acceptance criteria 1–11:**
- AC1 (editor distinguishes base unit = BOM unit, supply unit = later display) ✓ — Edits 2 + 4.
- AC2 (materialised BOM lines use SKU `base_unit`) ✓ — confirmed in Task 11E + reinforced; harness T1.
- AC3 (qty clearly "base units per 1 FG selling pack") ✓ — Qty column rename + new helper line + base-unit helper copy.
- AC4 (active row with missing base_unit → `needs_review` + blocks Enable) ✓ — Edits 1a/1b/1c; harness T4–T5.
- AC5 (missing supply_unit does NOT block Enable) ✓ — harness T6.
- AC6 (invalid supply conversion does NOT affect BOM consumption math) ✓ — qty preserved; harness T2/T8.
- AC7 (Test Calculation shows packaging unit = base_unit) ✓ — Test Calc reads `ln.unit` which is the materialised SKU base_unit (no change needed, verified by inspection).
- AC8 (save and reopen preserves base / supply / storage fields) ✓ — no field renamed; existing `data-f` attributes intact.
- AC9 (no Daily Plan BOM / inventory / importer logic added) ✓ — none added.
- AC10 (Task 11E generic slot editor still works: cover SKU appears, tray auto rule works) ✓ — Task 11E harness 37 / 37.
- AC11 (Section K regression) — to be confirmed by manual QA F12.

**Outstanding:** manual QA F1–F12 and Section K regression. Roll back with
`cp _archive/index-pre-pkg-unit-contract-20260525.html app/index.html` if any
K-row regression fails.
