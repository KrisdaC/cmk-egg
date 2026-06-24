# UAT Task 8B-UI-2 — Simplify BOM UI After the One-line Model — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `9693724d7189ab591ca9aa01c13fd58c`
**Post-edit app MD5:** `a0d124023516ee21bca37c87e161d77a`
**Rollback:** `cp _archive/index-pre-bom-itemui4-20260525.html app/index.html`

UI/UX cleanup of **Item edit → BOM / สูตรผลิต**, building on 8B-UI. Display cleanup
only — no calculation change, no Daily Plan BOM change, no in-table editor, no data
mutation. One anchored splice replacing the whole 8B-UI render block.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 1 anchored splice — the entire 8B-UI render block (16 functions) replaced with the 8B-UI-2 version. |
| `_archive/index-pre-bom-itemui4-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8BUI2_BOM_UI_SIMPLIFY_CLOSEOUT.md` | NEW — this file. |

`oms-production/` untouched. Orders, Daily Planning, Daily Plan BOM (`renderPlanBom`),
ใบน้อย, Logistics, Dispatch, Inventory, Controlled Lists, persistence, PO parsers,
Master Data validators — all untouched. No master-data JSON change.

## B. What was confusing in the previous UI

After 8B-UI the BOM section was cleaner but still had four rough edges:

1. `bom.enabled` and `bom.no_bom_required` were **two independent checkboxes** —
   a user could tick both and the meaning was unclear.
2. The **Output** section was a full bordered card for information (SKU, unit,
   conversion) that is already obvious.
3. **Basket appeared twice** in the main Components table — a "basket quantity"
   row from Unit Conversion and a "basket SKU" row from BOM Setup — for what is
   one physical requirement.
4. The **Advanced** section repeated the component data as a raw table, so the
   same SKU showed up in two tables in the same flow.

## C. How BOM status was simplified

The two checkboxes are replaced by **one status selector** (`<select>`):

- 📝 **Draft / Preview only** → `enabled=false, no_bom_required=false`
- ✅ **Active / Use in planning** → `enabled=true, no_bom_required=false`
- 🚫 **No BOM required** → `enabled=false, no_bom_required=true`

The persisted fields `bom.enabled` and `bom.no_bom_required` are **kept unchanged**
(renaming them would have been risky). They are now two hidden, `data-f`-bound
checkboxes; the visible selector drives them through `_bomOnStatusChange()`. On
render the hidden checkboxes are derived from `_bomStatusValue(bom)`, so the two
flags can never both read "active" — a contradictory item (both flags true) is
shown, and saved, as **No BOM required**. The save path is unchanged: `_readEditForm`
still reads the two checkboxes.

## D. How Output / BOM basis was compacted

The bordered Output card is replaced by a **one-line BOM basis header**:

> BOM basis · ฐาน BOM: **B0014 — ไข่ไก่เบอร์ 0 …** · `1 ตะกร้า = 180 ฟอง`

No card, no border. The output unit stays **read-only, derived from `selling_unit`**;
there is no manual `output_unit` field in the main flow. A warning box appears
**only** when the selling unit or its base conversion cannot be resolved.

## E. How basket duplicate rows were handled

`buildBomComponentLinesForItem` now emits **one** basket row, never two:

- **Case A — conversion + basket component:** one row for the actual basket SKU,
  qty from the BOM component; the unit conversion becomes a validation note —
  "ตรงกับหน่วยแปลง · matches conversion: N ตะกร้า", or "⚠ ต่างจากหน่วยแปลง" +
  Needs review when the component qty and the conversion disagree (>2%).
- **Case B — conversion but no basket component:** one placeholder row,
  "ต้องเลือก SKU ตะกร้า", qty = the conversion quantity, unit ตะกร้า, source
  Unit Conversion, **Needs review**.
- **Case C — basket component but conversion missing:** the basket SKU row is
  shown and marked **Needs review — basket conversion missing**.

Because Test Calculation multiplies the same line list, it also shows one basket
row, not two. The Components table is retitled **"ส่วนประกอบต่อ 1 หน่วยผลิต ·
Components per output unit"** with one short note ("Each row is one input required
for 1 output unit") and six columns: Type, Component, Qty per output, Unit, Source,
Status / Where to edit (the status badge and its note merged into one column).

## F. How Advanced was changed

Renamed **"ข้อมูลเทคนิค / ฟิลด์เดิม · Technical / Legacy details"**, still
collapsed by default. Inside it no longer repeats the main component table in the
normal flow:

- the raw stored-components table is behind its **own nested `<details>`**,
  labelled "Raw stored components — technical reference";
- routes are behind a nested `<details>` labelled "feature not active";
- the legacy `bom.output_unit` field stays here, editable, for compatibility;
- **BOM notes were promoted out** of Technical into the main flow (a compact
  field below Test Calculation).

## G. Data safety / what was NOT changed

- **No data deleted or mutated.** `item.bom.components`, `.routes`, `.notes`,
  `.enabled`, `.no_bom_required`, `.output_unit` keep their shapes and save paths.
  The only coercion is the intended one in section C (a contradictory both-flags
  item normalizes to No BOM required on save).
- **No calculation logic changed/expanded.** All numbers still come from the
  existing 8A-1/8A-2 helpers; Test Calculation only multiplies them.
- **No Daily Plan BOM change.** `renderPlanBom`, `_bomRenderPlanEggSizeSection`,
  `_bomRenderMinReqTable` untouched and still wired.
- **No Orders / Planning / ใบน้อย / Logistics / Dispatch / Inventory / Controlled
  Lists change.** No in-table editor (deferred). No bulk upload, no inventory.
- No new BUG_LOG rows — no new risk identified. UAT-037 (orphaned 8B-UI preview
  chain) is unchanged and still applies.

## Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU, expand BOM / สูตรผลิต.

| # | Step | Expected |
|---|------|----------|
| F1 | Look at the top of the BOM section | One **BOM status** dropdown (Draft / Active / No BOM required) — no loose checkboxes |
| F2 | Look below the status | Compact one-line **BOM basis** header; no large card |
| F3 | Open a SKU with basket conversion **and** a basket component | **One** basket row (actual SKU); note says it matches the conversion |
| F4 | Open a SKU with basket conversion **but no** basket component | One placeholder row "ต้องเลือก SKU ตะกร้า", Needs review |
| F5 | Open a SKU with a basket component **but no** conversion | Basket SKU row marked Needs review — conversion missing |
| F6 | Expand **Technical / Legacy details** | Raw components table is behind its own nested toggle, not duplicated in the main flow |
| F7 | Enter test qty 100 | Test Calculation shows one basket row, not two |
| F8 | Edit BOM notes / status, Save, reopen | Status, notes, components, routes, legacy output_unit all preserved |
| F9 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## H. Final verdict

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +15/+15, `()` +55/+55, `[]` 0/0);
imbalance offsets unchanged vs backup (braces 0, parens −35, brackets 0);
backticks 1206 (even, unchanged); all new/modified symbols defined exactly once;
one live `data-f="bom.enabled"` input (+1 comment), `bom.no_bom_required` /
`bom.notes` / `bom.output_unit` one each; Task 1/2 helpers and Daily Plan BOM
helpers intact.

Functional checks passed — **40/40** Node acceptance-test harness covering all 9
spec tests: one BOM status with contradictory-state normalization (T1), compact
read-only BOM basis (T2), basket de-duplicated to one row across cases A/B/C
(T3–T5), Advanced not duplicative with the raw table behind a nested details (T6),
Test Calculation using the cleaned rows (T7), no `item.bom` mutation and all
`data-f` fields preserved (T8), Daily Plan / core / Task-1 helpers and the egg
split unchanged (T9).
