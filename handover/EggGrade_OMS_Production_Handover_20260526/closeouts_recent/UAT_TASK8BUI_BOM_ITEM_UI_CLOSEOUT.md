# UAT Task 8B-UI — Item-level BOM UI Rebuilt Around One Component-line Model — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `395b31eab245fa38e837394be1569236`
**Post-edit app MD5:** `9693724d7189ab591ca9aa01c13fd58c`
**Rollback:** `cp _archive/index-pre-bom-itemui3-20260525.html app/index.html`

UI / information-architecture cleanup of **Item edit → BOM / สูตรผลิต**. No calculation
scope added, no Daily Plan BOM change, no bulk upload, no inventory, no component editor.
Display-only — confirmed with the operator before starting.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored splices: (1) shortened the modal-level BOM note; (2) replaced `_bomRenderItemEditSection` and added 11 new render/helper functions. |
| `_archive/index-pre-bom-itemui3-20260525.html` | NEW — pre-edit app snapshot, MD5-verified against the live file before any edit. |
| `_archive/closeouts/UAT_TASK8BUI_BOM_ITEM_UI_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | +1 row (`UAT-037`). |

`oms-production/` untouched. Orders, Daily Planning, Daily Plan BOM (`renderPlanBom`),
ใบน้อย, Logistics, Dispatch, Inventory, Controlled Lists, persistence, PO parsers,
Master Data validators — all untouched. No master-data JSON change (this is a UI task).

## B. The problem — current BOM UI structure found

Item edit → BOM / สูตรผลิต rendered **six overlapping blocks** that made one simple
idea (what does 1 output unit consume?) look like many concepts:

1. an `enabled` / `no_bom_required` checkbox row;
2. a free-text **Output unit** field (manual `bom.output_unit`);
3. an Egg + Basket *preview* with a before/after toggle (`_bomRenderEggBasketSection`);
4. a separate **Basket BOM Component** table (`_bomRenderBasketBomSection`, 8B-0);
5. a **Components (N)** raw table;
6. a **Routes (N)** raw table.

Egg requirement, basket *quantity*, basket *SKU* and manual components each lived in a
different block with its own heading and its own long explanation — exactly the
redundancy the task targeted. The problem was never the calculation; it was the layout.

## C. How the UI was rebuilt — Output / Components / Test / Advanced

`_bomRenderItemEditSection` now renders four ordered sections:

- **A · ผลิตอะไร / Output** — finished SKU, item name, output unit and base
  conversion. Output unit is **read-only from `selling_unit`**; there is no manual
  output-unit field in the main view. Missing selling unit shows a warning, no crash.
- **B · ใช้อะไรบ้างต่อ 1 หน่วยผลิต / Components** — the main section: **one table**
  for every BOM line (see D). One short helper note above it.
- **C · ทดลองคำนวณ / Test Calculation** — a test-quantity input that multiplies
  every BOM line; appears **after** Output and Components. Preview only, never saved.
- **D · รายละเอียดขั้นสูง / Advanced** — a `<details>` element **collapsed by
  default**: raw components table, raw routes table, the legacy `bom.output_unit`
  field, BOM notes, and the updated-at stamp.

The two operational toggles (`bom.enabled`, `bom.no_bom_required`) stay at the top —
they gate whether the SKU joins BOM calculation, so they remain visible and functional.
Long repeated explanations, the far-away "auto from Egg Profile / Basket Conversion"
tables, the large dashed future-packaging block, and the visible empty "Components (0)
/ Routes (0)" sections are all gone; the future-packaging note is now one short line.

## D. The one component-line model

New UI-only helper **`buildBomComponentLinesForItem(item)`** returns a single
normalized list — every required input for **1 output (selling) unit** as one line:

```
{ component_type, component_name, component_sku, qty_per_output,
  unit, source, editable, needs_review, notes }
```

It folds four sources into that one shape:

1. **Egg lines** — from `calculateEggSourceRequirements(item, 1)` (Egg Profile).
   Single grade → one line; mixed → "เบอร์ X ขั้นต่ำ" + "เบอร์ Y ส่วนเติมคละ".
2. **Basket-quantity line** — from `calculateBasketRequirementFromItem(item, 1)`
   (Unit Conversion), only when basket conversion exists.
3. **Actual basket-SKU lines** — `item.bom.components` where `component_role = basket`.
4. **Other manual / imported components** — the remaining `item.bom.components`.

Auto lines (egg, basket quantity) are **virtual** — computed for display, never
written into `item.bom.components`. Manual/imported lines are read straight from
`item.bom.components`. The helper is pure: no I/O, no persistence.

**Locked vs editable display.** Each row shows a **Source** column (`Egg Profile` /
`Unit Conversion` / `BOM Setup`) and an **"Editable here?"** badge:
`🔒 ที่ Egg Profile` / `🔒 ที่ Counting & Units` for locked auto lines,
`✎ แก้ที่นี่ · BOM Setup` for manual lines, `⚠ ตรวจสอบ · Needs review` when data is
incomplete. This task is **display-only** — no in-modal component editor was built
(operator-confirmed scope); the badge tells the operator *where* a line is controlled.

**Egg lines** are generated from the Egg Profile and shown locked: a single-grade
SKU yields one egg line at the full base quantity; a mixed SKU yields a "ขั้นต่ำ"
(minimum) line for the primary grade and a "ส่วนเติมคละ" (planned balance) line for
the secondary, carrying the `min_primary` note and the "ใช้เบอร์ใหญ่แทนได้"
substitution hint. No substitution is auto-allocated.

**Basket** appears as two distinct lines, as the spec requires: the *basket quantity*
line (from unit conversion, locked) and the *actual basket SKU* line (from
`bom.components`, BOM Setup) — related but not the same thing.

## E. What was intentionally NOT changed

- **No data model change.** `item.bom.components`, `.routes`, `.notes`, `.enabled`,
  `.no_bom_required`, `.output_unit` keep their existing shapes. The legacy
  `bom.output_unit` field is preserved and stays editable inside Advanced; it is
  simply removed from the main view per the spec. Auto egg/basket lines are virtual.
- **No calculation scope added.** All numbers come from existing 8A-1 / 8A-2 helpers
  (`calculateEggSourceRequirements`, `calculateBasketRequirementFromItem`,
  `splitBaseEggsByGrade`). Test Calculation only multiplies those by a test quantity.
- **No Daily Plan BOM change.** `renderPlanBom`, `_bomRenderPlanEggSizeSection`,
  `_bomRenderMinReqTable`, `_bomAggregateSourceByGrade` untouched and still wired.
- **No Orders / Daily Planning / ใบน้อย / Logistics / Dispatch / Inventory /
  Controlled Lists logic.** No bulk upload, no inventory deduction, no lot selection.
- The old Item-modal preview render chain (`_bomRenderEggBasketSection` etc.) is left
  defined but unreferenced — dead code, retained per project convention (see UAT-037).

## F. Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU, expand BOM / สูตรผลิต.

| # | Step | Expected |
|---|------|----------|
| F1 | Open a mixed SKU (e.g. คละ 3-4) → BOM section | Starts with **A · Output**; output unit read-only from selling unit; no manual output-unit field in the main view |
| F2 | Look at section B | Egg, basket-quantity and manual basket/material lines are all in **one** Components table |
| F3 | Mixed SKU, 1 ถาด = 30, min 60 | Egg lines: "เบอร์ 3 ขั้นต่ำ 18" and "เบอร์ 4 ส่วนเติมคละ 12", both **Locked · Egg Profile** |
| F4 | SKU with a basket component | Basket-SKU line shows as **BOM Setup / Editable** (or Needs review if qty missing) |
| F5 | SKU with basket conversion | Basket-quantity line shows **Locked · Unit Conversion** |
| F6 | Scroll the BOM section | **C · Test Calculation** appears after Output and Components |
| F7 | Enter test qty 100 | Every line ×100 (e.g. 18→1,800, 12→1,200, tray 1→100) |
| F8 | Look for legacy tables | Components / Routes / notes are inside **D · Advanced**, collapsed — no empty "Components (0)" main section |
| F9 | Edit BOM notes / open a SKU with components, Save, reopen | `bom.components`, `bom.routes`, `bom.notes` still present and saved |
| F10 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## G. Known risks / BUG_LOG additions

- **UAT-037** (Low) — after the rebuild the previous Item-modal BOM preview render
  chain is unreferenced (`_bomRenderEggBasketSection` / `Result` / `Controls`,
  `_bomRefreshEggBasketPreview`, `_bomEbStatusNoteHtml`, `_bomOnEnabledToggle`,
  `_bomEbSetView`, `_bomRenderBasketBomSection`, plus preview-only producers
  `calculateItemBomEggBasketPreview` / `calculateEggRequirementFromItem`). Left
  defined per convention; harmless dead code; remove in a future cleanup pass.
- No QA-blocking risk identified. UAT-034/035 (basket data shape) are unchanged by
  this task — the one-line model reads both `qty_per_selling_unit` and `qty_per_basis`
  and flags any non-`per_selling_unit` basis as Needs review rather than mis-scaling.

## H. Final verdict

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 8 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +27/+27, `()` +209/+209, `[]` +4/+4);
imbalance offsets unchanged vs backup (braces 0, parens −35, brackets 0); backticks
1210→1206 (even); all 12 new symbols defined exactly once; Task 1/2 helpers
(`safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`, header strip)
intact; Daily Plan BOM helpers intact.

Functional checks passed — **29/29** Node acceptance-test harness, covering all 10
spec tests: Output read-only (T1), one component table (T2), locked egg lines
18/12 (T3), editable basket-SKU line (T4), locked basket-quantity line 0.1667 (T5),
Test Calculation placed last with A<B<C<D order (T6), ×100 multiplication (T7),
Advanced collapsed (T8), render does not mutate `item.bom` (T9), Daily Plan / core /
Task-1 helpers still defined (T10).
