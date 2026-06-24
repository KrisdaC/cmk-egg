# UAT Pro · Task 12C-R2 — BOM section single-language sweep — Closeout

**Date:** 2026-05-27
**Trigger:** User screenshot showing the BOM section / Item editor still rendering inline `Thai · English` bilingual labels even after Task 12C-R. Those labels were never wired through `data-i18n` and were not in Task 12C-R's Master Data scope.
**Goal:** Apply the same LANG-aware `_lng(th, en)` pattern to the BOM section inside the Item editor — components table, output basis header, Packaging Profile, "Other packaging" editor, Test Calculation table — so operators see a single language at a time.
**Out of scope (unchanged):** Daily Plan BOM (`renderPlanBom`), Orders, PO Intake, Daily Planning, ใบน้อย, Logistics, `MASTER_V3.option_sets`, `safeSet` / backup / restore primitives, PO parsers, placeholder lifecycle, `oms-production/`, Task 12B Supply / Issue Unit deprecation, all BOM math and `bom.components` shape.

---

## A. Backup

- **Backup file:** `_archive/index-pre-task12c-r2-bomsection-20260527.html`
- **Pre-edit MD5:** `54c53baa797442239ecaec9b2640d40e` (the post-Task-12C-R state)
- **Post-edit MD5:** `2886574912d17e45347134d27fa9143f`

**Rollback (single command):**

```bash
cp _archive/index-pre-task12c-r2-bomsection-20260527.html app/index.html
```

This reverts Task 12C-R2 only. Tasks 12B and 12C-R remain intact.

---

## B. Sections / functions changed

Net delta vs. pre-Task-12C-R2 baseline:

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,648 | 26,650 | +2 |
| Bytes (UTF-8) | 1,578,968 | ~1,584,300 | +5,332 |
| `{` / `}` balance | identical | identical | 0 |
| `(` / `)` imbalance | -35 (pre-existing) | -35 (pre-existing) | 0 |
| `[` / `]` balance | identical | identical | 0 |
| `node --check` across all 8 inline JS blocks | n/a | passes | — |
| Task 12B acceptance harness (27 assertions, 5 cases) | passing | **27 / 27 still pass** | — |
| `_lng()` call sites | 58 (after 12C-R) | **121** | **+63** |

Functions touched in `app/index.html`:

1. **`_bomLineTypeLabel`** (~line 22987) — all 4 case returns now use `_lng()`.
2. **`_bomLineSourceLabel`** (~line 22999) — all 7 case returns now use `_lng()`. The English half is now the operator-facing label when LANG=en (e.g. `Egg Profile`); the Thai half is operator-facing when LANG=th (e.g. `ข้อมูลไข่`).
3. **`_bomLineEditableLabel`** (~line 23013) — 6 status badges wrapped: `⚠ Needs review`, `📋 In Basket Profile`, `📋 In Packaging Profile`, `✎ Edit here · BOM Setup`, `🔒 Locked · Egg Profile`, `🔒 Locked · Counting & Units`.
4. **`_bomRenderItemComponentsTable`** thead (~line 23358) — 6 column headers wrapped: Type, Component, Qty / output, Unit, Source, Status / Where to edit.
5. **`_bomRenderItemOutputSection`** (~line 23394) — BOM basis header wrapped (`BOM basis (per 1 production pack):` / `ฐาน BOM (ต่อ 1 pack ผลิต):`).
6. **`_bomRenderItemEditSectionBody`** (~lines 24841–24848) — five section headings/hints wrapped: "Components per output unit" + descriptive hint, "Test Calculation" + descriptive hint, "Test output qty (number of production packs)" input label.
7. **`_bomRenderItemTestCalc`** thead (~line 23435) — 5 column headers wrapped: Type, Component, "Per 1 \<selling unit\>", "Total for N \<selling unit\>", Unit.
8. **`_bomRenderItemPackagingProfile`** (~lines 24551–24723) — title (`📦 Packaging Profile` / `📦 รูปแบบบรรจุภัณฑ์`), 2 descriptive paragraphs, 8 table-header cells (Active, Slot, Item role, Item type, Component SKU, Qty / pack, Qty / selling unit, Status), 3 bottom helper-text paragraphs, the inactive-slot status pill ("off — no BOM impact"), and the per-row slot label that previously concatenated `slot.th + ' · ' + slot.en`.
9. **`_bomRenderOtherPackagingSection`** (~lines 23916–23944) — the "วัสดุบรรจุภัณฑ์ · Packaging materials" sub-editor: empty-state, table headers (Category, Material, Qty / output, Unit), category-dropdown labels, SKU placeholder, Add form (Category / PACKAGING SKU / Qty / output / + Add material button), no-PACKAGING-SKU warning. The `_BOM_PKG_CATEGORIES` concat (`th + ' · ' + en`) also routes through `_lng()`.

Approximately **35 anchored string replacements** were applied across two Python passes (`apply_task12c_r2.py` plus a small follow-up patch for the Test Calc thead and Other Packaging editor). Each anchor was verified unique before substitution.

---

## C. Label consistency changes

### Behavior model (unchanged from Task 12C-R)

- **LANG=th** (default): operators see Thai-only strings (`🥚 ไข่`, `ข้อมูลไข่`, `ทดลองคำนวณ`, `📦 รูปแบบบรรจุภัณฑ์`, `จำนวน (ต่อ 1 pack ผลิต)`, etc.).
- **LANG=en**: operators see English-only strings (`🥚 Egg`, `Egg Profile`, `Test Calculation`, `📦 Packaging Profile`, `Qty / pack (per 1 production pack)`, etc.).
- Never both at the same time.

### Before / after samples

**BOM basis header (top of the BOM section)**

| Before | LANG=th | LANG=en |
|---|---|---|
| `BOM basis · ฐาน BOM (per 1 production pack · ต่อ 1 pack ผลิต):` | `ฐาน BOM (ต่อ 1 pack ผลิต):` | `BOM basis (per 1 production pack):` |

**Components table column headers**

| Before | LANG=th | LANG=en |
|---|---|---|
| `ประเภท · Type` | `ประเภท` | `Type` |
| `รายการ · Component` | `รายการ` | `Component` |
| `ต่อ 1 หน่วยผลิต · Qty / output` | `ต่อ 1 หน่วยผลิต` | `Qty / output` |
| `หน่วย · Unit` | `หน่วย` | `Unit` |
| `ที่มา · Source` | `ที่มา` | `Source` |
| `สถานะ / แก้ที่ไหน · Status / Where to edit` | `สถานะ / แก้ที่ไหน` | `Status / Where to edit` |

**Component-line type badges** (rendered via `_bomLineTypeLabel`)

| Before | LANG=th | LANG=en |
|---|---|---|
| `🥚 ไข่ · Egg` | `🥚 ไข่` | `🥚 Egg` |
| `🧺 จำนวนตะกร้า · Basket qty` | `🧺 จำนวนตะกร้า` | `🧺 Basket qty` |
| `📦 ตะกร้า · Basket SKU` | `📦 ตะกร้า` | `📦 Basket SKU` |
| `📦 บรรจุภัณฑ์ · Packaging` | `📦 บรรจุภัณฑ์` | `📦 Packaging` |

**Source labels** (rendered via `_bomLineSourceLabel`)

| Before | LANG=th | LANG=en |
|---|---|---|
| `Egg Profile · ข้อมูลไข่` | `ข้อมูลไข่` | `Egg Profile` |
| `Unit Conversion · หน่วยนับ` | `หน่วยนับ` | `Unit Conversion` |
| `Basket Profile · ข้อมูลตะกร้า` | `ข้อมูลตะกร้า` | `Basket Profile` |
| `Basket Conversion · หน่วยแปลงตะกร้า` | `หน่วยแปลงตะกร้า` | `Basket Conversion` |
| `Packaging Profile · รูปแบบบรรจุภัณฑ์` | `รูปแบบบรรจุภัณฑ์` | `Packaging Profile` |
| `BOM Setup · ตั้งใน BOM` | `ตั้งใน BOM` | `BOM Setup` |
| `BOM Setup + Basket Conversion · ตั้งใน BOM + หน่วยแปลง` | `ตั้งใน BOM + หน่วยแปลง` | `BOM Setup + Basket Conversion` |

**Status / "where to edit" badges**

| Before | LANG=th | LANG=en |
|---|---|---|
| `⚠ ตรวจสอบ · Needs review` | `⚠ ตรวจสอบ` | `⚠ Needs review` |
| `📋 ที่ Basket Profile` | `📋 ที่ Basket Profile` | `📋 In Basket Profile` |
| `📋 ที่ Packaging Profile` | `📋 ที่ Packaging Profile` | `📋 In Packaging Profile` |
| `✎ แก้ที่นี่ · BOM Setup` | `✎ แก้ที่นี่` | `✎ Edit here · BOM Setup` |
| `🔒 ล็อก · Egg Profile` | `🔒 ล็อก · ข้อมูลไข่` | `🔒 Locked · Egg Profile` |
| `🔒 ล็อก · Counting & Units` | `🔒 ล็อก · หน่วยและการนับ` | `🔒 Locked · Counting & Units` |

**Packaging Profile (the largest part of the user's screenshot)**

| Before | LANG=th | LANG=en |
|---|---|---|
| `📦 รูปแบบบรรจุภัณฑ์ · Packaging Profile` (title) | `📦 รูปแบบบรรจุภัณฑ์` | `📦 Packaging Profile` |
| `ช่องบรรจุภัณฑ์มาตรฐานของ FG — … · Standard packaging slots for an FG — …` | Thai-only | English-only |
| `ใช้งาน · Active` (column header) | `ใช้งาน` | `Active` |
| `ช่อง BOM · Slot` | `ช่อง BOM` | `Slot` |
| `บทบาท · Item role` | `บทบาท` | `Item role` |
| `ประเภทวัสดุ · Item type` | `ประเภทวัสดุ` | `Item type` |
| `SKU วัสดุ · Component SKU` | `SKU วัสดุ` | `Component SKU` |
| `จำนวน · Qty / pack (per 1 production pack)` | `จำนวน (ต่อ 1 pack ผลิต)` | `Qty / pack (per 1 production pack)` |
| `เทียบหน่วยขาย · Qty / selling unit` | `เทียบหน่วยขาย` | `Qty / selling unit` |
| `สถานะ · Status` | `สถานะ` | `Status` |
| Slot rows: `pack ฐาน · Base Pack` / `ฝาครอบ · Cover` / `ฉลาก barcode SKU · SKU barcode label` / `ฉลาก / สติกเกอร์ · Product label / sticker` / `Closer 1` / `Closer 2` / `ฉลาก barcode Bulk · Bulk barcode label` | each shows Thai-only | each shows English-only |
| `ปิดอยู่ — ไม่มีผลต่อ BOM · off — no BOM impact` (inactive slot status) | `ปิดอยู่ — ไม่มีผลต่อ BOM` | `off — no BOM impact` |

**"Other packaging" editor** (sub-area of the BOM section)

| Before | LANG=th | LANG=en |
|---|---|---|
| Table headers: `หมวด · Category` / `วัสดุ · Material` / `ต่อ 1 หน่วยผลิต · Qty / output` / `หน่วย · Unit` | each shows Thai-only | each shows English-only |
| `+ เพิ่มวัสดุ · Add material` button | `+ เพิ่มวัสดุ` | `+ Add material` |
| `— เลือก SKU บรรจุภัณฑ์ · choose a PACKAGING SKU —` placeholder | Thai-only | English-only |
| Empty state: `ยังไม่มีวัสดุบรรจุภัณฑ์ในสูตรนี้ · No packaging materials on this BOM yet` | Thai-only | English-only |
| No-PACKAGING-SKU warning | Thai-only | English-only |
| Category dropdown options (e.g. `Tray · ถาด`) | Thai-only via `_BOM_PKG_CATEGORIES[j].th` | English-only via `.en` |

**Test Calculation table**

| Before | LANG=th | LANG=en |
|---|---|---|
| `ประเภท · Type` | `ประเภท` | `Type` |
| `รายการ · Component` | `รายการ` | `Component` |
| `ต่อ 1 <selling unit>` (e.g. `ต่อ 1 ตะกร้า`) | `ต่อ 1 <selling unit>` | `Per 1 <selling unit>` |
| `รวม · Total for N <selling unit>` | `รวม N <selling unit>` | `Total for N <selling unit>` |
| `หน่วย · Unit` | `หน่วย` | `Unit` |
| Section heading `ทดลองคำนวณ · Test Calculation` | `ทดลองคำนวณ` | `Test Calculation` |
| Section hint `ℹ ใช้ตรวจสูตรก่อนนำไปวางแผน — ไม่บันทึกผล · Check the formula before planning. The result is not saved.` | Thai-only | English-only |
| Test qty input label `จำนวนทดสอบ · Test output qty (จำนวน pack ผลิต · number of production packs)` | `จำนวนทดสอบ (จำนวน pack ผลิต)` | `Test output qty (number of production packs)` |

---

## D. What did not change

Confirmed by static smoke and by re-running the Task 12B acceptance harness (27/27 still pass):

- **No stored data / `bom.components` shape changes.** Persisted item data flows through unmodified.
- **No BOM math changes.** `buildBomComponentLinesForItem`, `_bomOutputBaseFactor`, `_bomScaleFromSellingToOutput`, `_bomSellingEquivalentQty`, `_bomItemReadiness`, `calculateBasketRequirementFromItem`, `calculateEggSourceRequirements` — all unmodified.
- **No Orders / Daily Planning / PO Intake / Logistics / ใบน้อย behavior changes.** None of those render functions were edited.
- **Daily Plan BOM (`renderPlanBom`) NOT touched.** Three bilingual labels (`วัสดุ · Material`, `รวม · Total`, `หมายเหตุ · Notes`) inside `renderPlanBom` (line ~24876+) were intentionally **left in place** per the project-instructions §6 protected list. A grep confirms they live at lines 25102, 25109, 25110 — inside `renderPlanBom`'s table render — and were not part of the user's screenshot scope.
- **No mutation of `MASTER_V3.option_sets`.** No edits to `ensureMasterOptionSets`, `reconcileControlledListsFromMasterData`, `_pruneStaleRoleOptions`, `_pruneStaleUnitOptions`.
- **No `oms-production/` changes.**
- **Task 12B Supply / Issue Unit deprecation intact.** Static smoke confirms the 4 forbidden patterns (`data-f="units.consumable_unit"`, `data-f="units.has_consumable_unit"`, `data-f="units.base_per_consumable"`, `id="itemSupplyBlock"`) all still count = 0. The Task 12B acceptance harness passes 27/27.

---

## E. QA / smoke check

### Static checks (all green)

| Check | Result |
|---|---|
| Brace `{`/`}` delta vs pre-task backup | **0** |
| Paren `(`/`)` delta vs pre-task backup | **0** (pre-existing -35 imbalance preserved; net +67/+67 inside `_lng()` calls themselves) |
| Bracket `[`/`]` delta vs pre-task backup | **0** |
| `node --check` on all 8 inline JS blocks | **all pass** |
| Anchors verified unique before each replacement | **yes** for all 35 edits |
| `function _lng(th, en)` definition | **count = 1** |
| `_lng(` call sites in source | **121** (up from 58 after Task 12C-R) |
| Old bilingual patterns swept | **count = 0** for all 28 patterns checked |
| Task 12B forbidden DOM patterns | **count = 0** |
| Task 12B acceptance harness (27 assertions, 5 cases) | **27 / 27 pass** |
| Out-of-scope bilingual in `renderPlanBom` (3 patterns) | left in place (intentional, per project §6) |

### Recommended visual spot-check (in the browser)

1. **LANG=th (default):** Open any FG SKU → Item Editor → BOM section. Confirm operator-facing labels are Thai-only: `ส่วนประกอบต่อ 1 หน่วยผลิต`, `ประเภท / รายการ / หน่วย / ที่มา / สถานะ`, `📦 รูปแบบบรรจุภัณฑ์`, table headers Thai-only, slot rows Thai-only (`pack ฐาน`, `ฝาครอบ`, `ฉลาก barcode SKU`, etc.), `ทดลองคำนวณ`.
2. **Switch to LANG=en.** Same surfaces now read English-only: `Components per output unit`, `Type / Component / Unit / Source / Status / Where to edit`, `📦 Packaging Profile`, `Base Pack / Cover / SKU barcode label`, `Test Calculation`.
3. **Edit a Packaging Profile slot.** Active checkbox toggles, qty input accepts numbers, the "Qty / selling unit" read-only column recomputes (Task BOM unit-display intact).
4. **Open the BOM Test Calculation panel.** Enter a test qty → table renders single-language column headers.
5. **Open the "Other packaging materials" sub-editor.** Empty state, headers, add form (Category / PACKAGING SKU / Qty / output / + Add material) all single-language.
6. **Master Data tab.** Customers / Sites / Items table headers and row buttons still single-language (Task 12C-R intact).
7. **No new console errors** when switching LANG or opening/closing the Item editor.
8. **Daily Plan BOM** still shows its original bilingual labels (`วัสดุ · Material`, `รวม · Total`, `หมายเหตุ · Notes`) — that's expected; out of scope for this task.

---

## F. Known risks / BUG_LOG

**`docs/BUG_LOG.md` was NOT updated.** Continuation of the UI cleanup; no new bug.

### Risks flagged (not in BUG_LOG)

1. **🟢 Coverage scope honestly stated.** This task swept the Item editor's BOM section (Components table, Output basis header, Packaging Profile, Other Packaging editor, Test Calculation panel, line-type / source / status badges). It did NOT touch:
   - `renderPlanBom` (Daily Plan BOM) — protected by project §6.
   - The various Master Data Health summary tables in lines 22138/22428/22455/22967 (egg-target preview, basket-requirement preview, legacy basket-component preview). Those panels are auxiliary views; they still carry inline bilingual headers from earlier sprints. If they appear in operator-facing screens during testing, log the request and a follow-up sprint can apply the same `_lng()` pattern.
   - Item editor sections OUTSIDE the BOM area (Identity, Counting & Units, Egg Profile, Basket Profile, External References, System / Audit). Those still have inline bilingual labels from earlier sprints — they are also actively edited and lower risk to touch in a separate sprint.
2. **🟢 `_lng()` is read-once at render time.** Same as Task 12C-R note: switching `LANG` mid-session does not live-update an already-rendered BOM section. Closing and reopening the Item editor refreshes labels. This is consistent behavior with `applyLang`'s existing pattern for these tables.

---

## G. Rollback command

```bash
cp _archive/index-pre-task12c-r2-bomsection-20260527.html app/index.html
```

Single file, single command. Reverts Task 12C-R2 only; Tasks 12B and 12C-R remain.

To roll back further: `cp _archive/index-pre-task12c-uilang-20260527.html app/index.html` (also reverts Task 12C-R) or `cp _archive/index-pre-task12b-supplydeprecate-20260527.html app/index.html` (also reverts Task 12B).

---

## H. Final verdict

**Ready for UAT testing.**

The Item editor BOM section now reads single-language in both `LANG=th` and `LANG=en` modes. The user's screenshot pain points — Components table headers, Packaging Profile labels, slot rows, descriptive hints, status badges — are all routed through the global `_lng(th, en)` helper. Task 12B Supply Unit deprecation and all earlier BOM math are untouched; the Task 12B acceptance harness passes 27/27 as a regression gate.

**Stopped per the prior "stop after this UI label consistency task" instruction. Daily Plan BOM integration not started; the few remaining bilingual labels inside `renderPlanBom` are intentionally left in place per project §6.**
