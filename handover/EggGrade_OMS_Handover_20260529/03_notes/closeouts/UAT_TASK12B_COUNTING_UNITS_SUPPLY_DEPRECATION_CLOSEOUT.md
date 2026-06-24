# UAT Pro · Task 12B — Counting & Units · Supply / Issue Unit deprecation — Closeout

**Date:** 2026-05-27
**Scope:** Fully deprecate the Supply / Issue Unit as an active conversion layer in the Master Data Item Editor's Counting & Units section. Legacy stored values must be preserved without using hidden editable DOM inputs.
**Predecessor:** This task supersedes the 2026-05-27 "BOM unit-display cleanup" closeout (`UAT_TASK_BOM_UNITDISPLAY_CLOSEOUT.md`) on the Supply Unit half. The previous fix hid `itemSupplyBlock` via `display:none` while keeping the `data-f` inputs in the DOM — the user rejected that as fragile. This task removes the block entirely and routes legacy preservation through `_readEditForm`'s natural deep-clone-then-overlay pattern.
**Out of scope:** Orders, PO Intake, Daily Planning, Daily Plan BOM (`renderPlanBom`), ใบน้อย, Logistics, `MASTER_V3.option_sets`, `oms-production/`, the `safeSet` / backup / restore layer, the PO parsers, the placeholder lifecycle. No localStorage key shape changed. No `MASTER_V3` field renamed or removed.

---

## A. Backup

- **Backup file:** `/Users/sirap./Documents/CMK/uat-handover/_archive/index-pre-task12b-supplydeprecate-20260527.html`
- **Pre-edit MD5:** `8767e3aacaf1a978acef73af0ed3534d` (this is the post-Task-BOM-unit-display state — the previous closeout in the same calendar day).
- **Post-edit MD5:** `5a1f81d47b295d470cec8d4f80d6d2c4`
- Both MDs were verified against the live file at the moment of copy.

**Rollback (single command):**

```bash
cp _archive/index-pre-task12b-supplydeprecate-20260527.html app/index.html
```

This reverts Task 12B only; the earlier BOM unit-display work remains in effect. To roll back further (to the pre-2026-05-27 state), use `_archive/index-pre-bom-unitdisplay-20260527.html` instead.

---

## B. Sections / functions changed

Net delta to `app/index.html`:

| | Before | After | Delta |
|---|---:|---:|---:|
| Lines | 26,624 | 26,633 | **+9** |
| Bytes (UTF-8) | 1,576,897 | 1,577,177 | +280 |
| `{` / `}` balance | identical | identical | 0 |
| `(` / `)` imbalance | 35 pre-existing | 35 (unchanged) | 0 |
| `[` / `]` balance | identical | identical | 0 |
| Node `--check` syntax across all 8 inline JS blocks | n/a | passes | — |

Six anchored string replacements via a single Python script (`/sessions/.../outputs/apply_task12b.py`). Each anchor was verified to appear exactly once before replacement. No fuzzy regex.

Files / functions touched in `app/index.html`:

1. **`openEditItem` → Counting & Units block (lines ~10237–10247)** — The entire `itemSupplyBlock` `<div>` containing the "Has supply / issue unit" checkbox, the `consumable_unit` select, and the `base_per_consumable` input was deleted. In its place is a small JS IIFE that renders a read-only legacy notice **only when** the item still carries legacy supply data (`has_consumable_unit === true`, or `consumable_unit` non-empty, or `base_per_consumable > 0`). No `<input>`, no `data-f`, no editable controls.
2. **`openEditItem` → ladder hint (line ~10220)** — Updated to the brief's exact wording: `โครงสร้างหน่วย: หน่วยฐาน → หน่วยแพ็ค/FG → หน่วยเก็บ → ตะกร้า → หน่วยขาย / Unit ladder: base → pack/FG → storage → basket → selling.`
3. **`_refreshUnitSectionVisibility` (line ~11257)** — The dead `set('itemSupplyBlock', false);` call was removed (the element no longer exists). Replaced with a Task 12B explanatory comment.
4. **`validateMasterItem` (lines ~14806–14813)** — The Task-7D "consumable: conditional on `has_consumable_unit`" warning block was deleted. Removed: "เปิดหน่วยแปรรูปแต่ไม่มีชื่อหน่วย", "เปิดหน่วยแปรรูปแต่ไม่มีฐานต่อหน่วย", "ปิดหน่วยแปรรูปแต่ยังมีข้อมูลเก่าค้างอยู่".
5. **`validateMasterItem` (line ~14819)** — `if (uu.has_consumable_unit && uu.consumable_unit) activeUnits.push(uu.consumable_unit);` was removed from the duplicate-unit-name check; the legacy consumable label is no longer counted as an active unit.
6. **`validateMasterItem` (lines ~14902–14905)** — The Task-7D "supply / issue unit set on a non-SUPPLY item" warning was deleted.

`_readEditForm`, `saveEdit`, `normalizeItemUnits`, `normalizeMasterRecord`, `_bomItemReadiness`, `buildBomComponentLinesForItem`, `_bomOutputBaseFactor`, `getSellingUnitBaseFactor`, `_bomSellingEquivalentQty`, `_bomSellingUnitLabel` — none of these were modified. They participate in the deprecation only by virtue of the DOM no longer carrying supply inputs.

Live MD5 after edits: `5a1f81d47b295d470cec8d4f80d6d2c4`.

---

## C. Counting & Units UI change

**Supply / Issue Unit is no longer rendered as an active UI section.** The Counting & Units form now contains exactly five rendered field clusters in this order:

1. **Base unit · หน่วยฐาน** (`data-f="units.base_unit"`)
2. **Pack / FG unit · หน่วยแพ็ค** (`data-f="units.pack_unit"`) + **Base per pack** (`data-f="units.base_per_pack"`)
3. **Storage unit · หน่วยจัดเก็บ** (`data-f="units.storage_unit"`) + **Base per storage** (`data-f="units.base_per_storage"`)
4. **Basket Profile** — owned by the existing Basket Profile section (unchanged from Task 8C-2E)
5. **Selling unit · หน่วยขาย** (`data-f="selling_unit"` via `_renderSellingUnitSelect`)

**No hidden editable DOM fields exist** for the supply unit. The static smoke check confirms:

- `data-f="units.consumable_unit"` — count = **0**
- `data-f="units.has_consumable_unit"` — count = **0**
- `data-f="units.base_per_consumable"` — count = **0**
- `id="itemSupplyBlock"` — count = **0**

When the open item still carries legacy supply data, a small **read-only** notice appears below the storage-unit row:

> **หน่วยจ่ายวัสดุ (legacy) · ข้อมูลเก่าเท่านั้น**
> Supply unit ถูกยกเลิกแล้ว — หน่วยจ่ายวัสดุให้ใช้ Pack / FG unit แทน
> Supply / issue unit is deprecated. Issue unit now follows Pack / FG unit.
> `has_consumable_unit = true  ·  consumable_unit = box  ·  base_per_consumable = 100`
> ค่าเก่าเก็บไว้เพื่อความเข้ากันได้ ไม่มีผลต่อ BOM / Validation · Legacy values kept for backward compatibility; do not affect BOM math or validation.

For items without legacy supply data (new items, clean items), the notice does not render — the supply concept is completely invisible.

The ladder hint at the top of Counting & Units now reads:

> ℹ โครงสร้างหน่วย: หน่วยฐาน → หน่วยแพ็ค/FG → หน่วยเก็บ → ตะกร้า → หน่วยขาย
> Unit ladder: base → pack/FG → storage → basket → selling.

The string "(supply)" / "(วัสดุ)" no longer appears in any operator-facing label.

---

## D. Legacy preservation method

**Legacy stored values are preserved by inertia in `_readEditForm`'s deep-clone-then-overlay pattern — no hidden DOM inputs are required.**

The mechanism, verified by the acceptance harness (Case 1):

```js
function _readEditForm() {
  const obj = JSON.parse(JSON.stringify(_editingV3.item));   // ← full deep clone of pre-edit item
  document.querySelectorAll("#editBody [data-f]").forEach(el => {
    // …overlay each [data-f] form input onto obj…
  });
  return obj;
}
```

Because the function starts with a deep clone of the entire `_editingV3.item`, any field that is **not addressed by a `[data-f]` form input** flows through unchanged. With the supply DOM inputs removed:

- `obj.units.consumable_unit` carries through verbatim from the source item.
- `obj.units.has_consumable_unit` carries through verbatim.
- `obj.units.base_per_consumable` carries through verbatim.

For **new items** (no pre-edit legacy data), the source object's `units` template — set in `openEditItem` lines 10079–10083 — is `{ base_unit: "ฟอง", base_per_pack: 30, pack_unit: "แพ็ค" }`. It contains **no consumable fields whatsoever**. The deep clone preserves that absence; no later step adds them. Confirmed by acceptance harness Case 2.

`normalizeMasterRecord` (line 14654) trims top-level strings only and does not touch the `units` object. `validateMasterItem` no longer warns on consumable fields (see § E). Therefore the path from `_readEditForm` → `normalizeMasterRecord` → `validateMasterRecordOnSave` → `MASTER_V3.items[*]` → `persistMasterV3()` preserves legacy supply fields verbatim and does not create them when absent.

**No save-side merge code was needed.** The previous closeout's hypothetical "merge legacy back in" approach turned out to be unnecessary once the DOM inputs were removed: the deep-clone pattern already handles preservation.

---

## E. Validation impact

**Missing or legacy supply / consumable fields no longer trigger any validation warning or error.**

Three validation paths were removed (see § B items 4, 5, 6):

| Removed warning | Trigger condition before | Now |
|---|---|---|
| "เปิดหน่วยแปรรูปแต่ไม่มีชื่อหน่วย / consumable_unit on but consumable_unit empty" | `has_consumable_unit === true && !consumable_unit` | silent |
| "เปิดหน่วยแปรรูปแต่ไม่มีฐานต่อหน่วย / base_per_consumable missing" | `has_consumable_unit === true && !(base_per_consumable > 0)` | silent |
| "ปิดหน่วยแปรรูปแต่ยังมีข้อมูลเก่าค้างอยู่ / legacy consumable data remains" | `!has_consumable_unit && (consumable_unit || base_per_consumable)` | silent |
| "มีหน่วยจ่ายวัสดุแต่ไม่ใช่สินค้า SUPPLY / supply unit on non-SUPPLY item" | `role !== 'SUPPLY' && (has_consumable_unit \|\| consumable_unit)` | silent |
| Duplicate-unit-name check pulling `consumable_unit` into activeUnits | `has_consumable_unit && consumable_unit` | not added |

Confirmed by the acceptance harness:

- **Case 1.b** — legacy SUPPLY item produces 0 supply-related warnings.
- **Case 3.c** — PACKAGING item with no supply fields produces 0 supply-related warnings, 0 blocking errors.
- **Case 5.a / 5.b** — FG item with `units` containing only `base_unit / pack_unit / base_per_pack` produces 0 supply-related warnings, 0 blocking errors.

Other validation paths (basket, storage, selling unit, sku/name uniqueness, etc.) are untouched and continue to behave as before.

---

## F. BOM impact

**BOM basis remains "per 1 production pack" (Task 11H, 2026-05-25). No BOM math changed.**

`_bomOutputBaseFactor(item)` continues to prefer `item.units.base_per_pack` and fall back to `getSellingUnitBaseFactor` for legacy items without pack conversion. None of the BOM helpers reference any consumable / supply field. Specifically verified:

- `_bomItemReadiness` (line 23002) — checks selling unit + base conversion, optional basket conversion, and BOM-line completeness. **Zero references** to `consumable_*`. Confirmed by acceptance Case 1.c / Case 5.c — no consumable check appears in the readiness checklist.
- `buildBomComponentLinesForItem` (line 23161) — builds egg / basket / packaging lines. **Zero references** to `consumable_*`.
- `_bomOutputBaseFactor` / `_bomOutputUnitLabel` / `_bomScaleFromSellingToOutput` / `_bomSellingEquivalentQty` / `_bomSellingUnitLabel` — all unchanged from earlier (Task 11H + Task BOM unit-display). **Zero references** to `consumable_*`.

The dual-basis math from the prior task (Case 4 in the acceptance harness) still works:

```
sellingUnitBaseFactor = 60        // 1 ตะกร้า = 60 ฟอง
outputBaseFactor     = 30         // 1 แพ็ค 30 = 30 ฟอง
sellingToPack        = 60 / 30 = 2
1 แพ็ค 30            = 0.5 ตะกร้า    ✓
_bomSellingEquivalentQty(item, 1) = 2  ✓  (1 tray per pack → 2 trays per selling unit)
_bomSellingEquivalentQty(item, 0.5) = 1  ✓  (0.5 basket per pack → 1 basket per selling unit)
```

Packaging Profile continues to read `units.base_unit` for the component qty unit and `units.base_per_pack` for the canonical basis. Basket Profile continues to derive basket-per-output via `_bomScaleFromSellingToOutput`. Neither path consults a supply field.

---

## G. Harness results

**Node vm acceptance harness:** `/sessions/.../outputs/task12b_acceptance_harness.js`
**Result:** **27 / 27 assertions passed · 0 failed.**

The harness extracts all 8 inline JS blocks from `app/index.html` and loads them into a vm sandbox with minimal DOM stubs (`document.querySelectorAll`, MutationObserver, IntersectionObserver, etc.). Two boot-time errors fire inside the loaded code (DOM access on null in the boot path); both are caught by the app's internal boot try/catch. The functions under test — `normalizeItemUnits`, `getSellingUnitBaseFactor`, `_bomOutputBaseFactor`, `_bomSellingEquivalentQty`, `_bomSellingUnitLabel`, `_bomItemReadiness`, `buildBomComponentLinesForItem`, `validateMasterItem`, `_readEditForm` — are all reachable and exercised.

Cases covered (from the brief):

| Case | Description | Assertions | Result |
|---|---|---:|---|
| 1 | Existing legacy supply data is preserved on save without hidden inputs | 5 | ✅ all pass |
| 2 | New item template does not create legacy supply / consumable fields | 6 | ✅ all pass |
| 3 | Packaging item with no supply data passes validation and BOM math | 3 | ✅ all pass |
| 4 | Basket-selling FG: 1 ตะกร้า = 2 แพ็ค 30; dual-basis equivalence | 7 | ✅ all pass |
| 5 | Missing supply fields do not warn, do not affect readiness, do not affect math | 6 | ✅ all pass |
| **Total** | | **27** | **27 / 27 ✅** |

Re-run the harness anytime with:

```bash
node /sessions/great-practical-fermat/mnt/outputs/task12b_acceptance_harness.js
```

---

## H. Known risks / BUG_LOG updates

`docs/BUG_LOG.md` was updated:

- **UAT-051 closed.** The "Supply unit deprecation hidden DOM" row from the earlier closeout has been marked `closed — superseded by Task 12B (2026-05-27)`. The hidden-DOM-inputs failure mode it described no longer exists.
- **UAT-052 added (🟢 Low, open).** "Master Data · Item edit · Supply / Issue Unit fully deprecated." Documents the new state: supply inputs removed from the active form, legacy values preserved silently in `MASTER_V3.items[*].units`, validation no longer warns. Notes that a future data-cleanup sprint could optionally strip the legacy keys from stored items, but that is out of scope here.
- **UAT-050 unchanged.** "BOM · Packaging Profile dual-basis display divergence" remains open and tracks a separate cosmetic note from the prior closeout.

No new red, orange, or yellow severity rows were introduced.

### Newly identified risks beyond BUG_LOG

1. **🟢 Schema drift for legacy items.** Items with stored `units.has_consumable_unit === true` (a state operators can no longer reach) will display the read-only legacy notice indefinitely. Operators may ask "how do I clear this?" — there is no UI to do so. By design for Task 12B; documented in UAT-052.
2. **🟢 `_showSupply` and `_isSupplyIsh` locals are now unused** in `openEditItem` (lines ~10172–10174). Left in place per project convention (same family as UAT-039); harmless dead consts. A future cleanup pass can remove them.

---

## Final verdict

**Ready for UAT testing.**

Acceptance criteria from the brief, point by point:

| # | Criterion | Status |
|---|---|---|
| 1 | Counting & Units no longer renders Supply / Issue Unit as an active form section | ✅ §C |
| 2 | No hidden editable supply-unit DOM fields as preservation mechanism | ✅ §C, smoke confirms count=0 |
| 3 | Unit ladder no longer includes Supply Unit as an active layer | ✅ §C |
| 4 | Existing legacy fields preserved on save | ✅ §D + harness Case 1 |
| 5 | New items do not create legacy supply / consumable fields | ✅ §D + harness Case 2 |
| 6 | Missing supply / consumable fields do not trigger validation warnings | ✅ §E + harness Cases 1.b / 3.c / 5.a |
| 7 | Missing supply / consumable fields do not affect BOM readiness | ✅ §F + harness Cases 1.c / 5.c |
| 8 | Missing supply / consumable fields do not affect BOM quantity calculation | ✅ §F + harness Cases 4 / 5.d |
| 9 | BOM basis remains Pack / FG / production pack | ✅ §F |
| 10 | Packaging Profile still works | ✅ §F (Task BOM unit-display intact) |
| 11 | Basket Profile still works | ✅ §F + harness Case 4 |
| 12 | Existing item-level BOM calculations remain unchanged | ✅ §F (no BOM helper modified) |
| 13 | No mutation of `MASTER_V3.option_sets` | ✅ §A out-of-scope list; no option_sets edits |
| 14 | No changes to Orders, PO parsers, Daily Planning, Daily Plan BOM, ใบน้อย, Logistics, oms-production/ | ✅ §A out-of-scope list; static smoke confirms no relevant edits |

**Rollback command:**

```bash
cp _archive/index-pre-task12b-supplydeprecate-20260527.html app/index.html
```

Stopped after this task per the brief. Daily Plan BOM integration was not started.
