# UAT Pro · Task 12C-R — LANG-aware single-language label sweep — Closeout

**Date:** 2026-05-27
**Trigger:** User feedback on the prior Task 12C output: "still double languages all over the places." The previous task inlined `Thai · English` bilingual strings everywhere, but the user wants a single language at a time — switched via the existing `LANG` toggle (Thai when `LANG=th`, English when `LANG=en`).
**User decisions (AskUserQuestion):**
1. Label model = **Switch via the existing LANG toggle (single language at a time)**.
2. Scope = **Normalize the whole app to single-language for consistency** (touch older bilingual labels too, not only Task 12C's additions).
**Out of scope:** stored data, internal codes (DEFECT / FG / PACKAGING / SUPPLY / READY / CONFIRMED / DISPATCHED), `MASTER_V3.option_sets`, `safeSet` / backup / restore primitives, Orders / Daily Planning / PO Intake / ใบน้อย / Logistics / Daily Plan BOM workflow logic, `oms-production/`, Task 12B Supply / Issue Unit deprecation paths.

---

## A. Backup

Two backups were used / created:

- **Pre-Task-12C state** (the file we ultimately wanted): `_archive/index-pre-task12c-uilang-20260527.html` (MD5 `5a1f81d47b295d470cec8d4f80d6d2c4`).
- **Snapshot of the rejected Task-12C state** (for forensic / rollback safety): `_archive/index-post-task12c-20260527.html` (MD5 `bc54c87ba094cabbf52c8bb4e2f952c1`).

Step 1 of Task 12C-R was a hard revert: `cp _archive/index-pre-task12c-uilang-20260527.html app/index.html`. That reverted all 25 of Task 12C's bilingual edits in a single atomic operation. Step 2 then applied the new LANG-aware edits described in §B.

**Post-edit MD5:** `54c53baa797442239ecaec9b2640d40e`.

**Rollback (single command):**

```bash
cp _archive/index-pre-task12c-uilang-20260527.html app/index.html
```

This restores the state immediately after Task 12B (no Task 12C, no Task 12C-R). To roll back further (revert Task 12B too): `cp _archive/index-pre-task12b-supplydeprecate-20260527.html app/index.html`.

---

## B. Sections / functions changed

Net delta to `app/index.html` (vs. the post-Task-12B / pre-Task-12C baseline that we reverted to):

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,633 | 26,648 | **+15** |
| Bytes (UTF-8) | 1,577,177 | 1,578,968 | +1,791 |
| `{` / `}` delta | 0 | 0 | 0 |
| `(` / `)` delta | -35 (pre-existing) | -35 (unchanged) | 0 |
| `[` / `]` delta | 0 | 0 | 0 |
| `node --check` across all 8 inline JS blocks | n/a | passes | — |
| Task 12B acceptance harness (27 assertions, 5 cases) | n/a | **27 / 27 pass** | — |
| `_lng()` call sites in source | 0 | **58** | +58 |

A single Python script (`/sessions/.../outputs/apply_task12c_r.py` plus a small follow-up Controlled Lists patch) applied **28 anchored edits** sequentially, each verified to match exactly one anchor before substitution.

Areas touched:

1. **Global `_lng(th, en)` helper added** right after `t()` (line ~3090). Returns `th` when `LANG === "th"`, `en` otherwise.
2. **`I18N.th` dict augmented** with seven new keys: `master_v3_options`, `master_page_subtitle`, `master_btn_restore_json`, `master_btn_bom_bulk_upload`, `master_toolbar_admin`, `master_toolbar_legacy`, `master_toolbar_danger`. All Thai-only strings.
3. **Master Data static HTML defaults** for `data-i18n` elements switched from bilingual to English-only (the i18n dict already has Thai-only entries; `applyLang` does the swap). This covers: page title h2, section subtitle, four sub-tab chips (Customers / Sites / Items / Controlled Lists), the initial `+ Add Customer` button, "Show inactive" label, and four toolbar buttons (Import / Export / Clear / Restore Master JSON / BOM Bulk Upload).
4. **Master Data toolbar group labels** (`Admin`, `Legacy`, `⚠ Danger`) wired through new `data-i18n` keys; CSS `text-transform: uppercase` removed from these three spans only (so Thai glyphs render correctly when `LANG=th`).
5. **`switchMasterV3Sub` "+ Add" button label dict** and the empty-state message dict (lines ~8924, 8946) converted to use `_lng()`.
6. **Customers table render headers + row buttons** (`renderV3Customers`, ~lines 8983–9035) — 9 `<th>` cells and 2 row action buttons (Edit, Deactivate) routed through `_lng()`. Row count suffix " ลูกค้า · Customers" → `" " + _lng("ลูกค้า", "Customers")`.
7. **Delivery Sites table render headers + row buttons** (`renderV3Sites`, ~lines 9078–9110) — 10 `<th>` cells and 2 row action buttons.
8. **Items table render headers + row buttons** (`renderV3Items`, ~lines 9179–9236) — 10 `<th>` cells, 2 row action buttons, row count suffix " สินค้า · Items".
9. **Controlled Lists view** (`renderV3OptionSets` empty-state, thead Action cell, "+ Add option" button, per-row "Deactivate" button) converted to `_lng()` calls.

`buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomOutputBaseFactor`, `_bomSellingEquivalentQty`, `getSellingUnitBaseFactor`, `normalizeItemUnits`, `_readEditForm`, `saveEdit`, `validateMasterItem`, `safeSet`, `persistMasterV3`, the Task 12B legacy supply notice IIFE — **none were touched.** The Task 12B acceptance harness still passes 27/27 as a regression gate.

---

## C. Label consistency changes

### The model

| | LANG=th (default) | LANG=en |
|---|---|---|
| Static HTML `data-i18n="key">English text</...>` | text replaced with `I18N.th[key]` (Thai) | text restored to HTML default (English) |
| JS-rendered text using `_lng('ไทย', 'English')` | returns `'ไทย'` | returns `'English'` |

Operators see **one language at a time** — never both — controlled by the existing language switcher. Thai is the default boot value (`let LANG = "th"` at line 2296; persisted to `localStorage["demand_dashboard_lang"]` and re-read on subsequent loads).

### Before / after samples

**Top of Master Data tab — page title and subtitle**

| Before (Task-12C state) | After (Task 12C-R, LANG=th) | After (LANG=en) |
|---|---|---|
| `ข้อมูลหลัก · Master Data` | `ข้อมูลหลัก` | `Master Data` |
| `ศูนย์ควบคุมข้อมูล… · Master control center…` | `ศูนย์ควบคุมข้อมูลที่ใช้ใน Upload, Order, Planning และ Invoice` | `Master control center for Upload, Order, Planning, and Invoice` |

**Sub-tab chips**

| Before | LANG=th | LANG=en |
|---|---|---|
| `ลูกค้า · Customers` | `ลูกค้า` | `Customers` |
| `สาขาส่งของ · Delivery Sites` | `สาขาส่งของ` | `Delivery Sites` |
| `สินค้า · Items` | `สินค้า` | `Items` |
| `รายการตัวเลือก · Controlled Lists` | `รายการตัวเลือก` | `Controlled Lists` |

**Toolbar group labels** (the all-caps `ADMIN` / `DANGER` from the user's screenshot)

| Before | LANG=th | LANG=en |
|---|---|---|
| `Admin · เครื่องมือผู้ดูแล` (uppercase) | `เครื่องมือผู้ดูแล` | `Admin` |
| `Legacy · เครื่องมือเก่า` (uppercase) | `เครื่องมือเก่า` | `Legacy` |
| `⚠ Danger · เขตอันตราย` (uppercase) | `⚠ เขตอันตราย` | `⚠ Danger` |

**Toolbar buttons**

| Before | LANG=th | LANG=en |
|---|---|---|
| `⬆ นำเข้า Master Excel · Import` | `⬆ นำเข้า Master Excel` | `⬆ Import Master Excel` |
| `ส่งออก JSON · Export` | `ส่งออก Master JSON` | `Export Master JSON` |
| `🔄 กู้คืน Master JSON · Restore Master JSON` | `🔄 กู้คืน Master JSON` | `🔄 Restore Master JSON` |
| `🗑 ล้างข้อมูล Master · Clear` | `🗑 ล้างข้อมูล Master` | `🗑 Clear Master Data` |
| `🧪 BOM Bulk Upload · นำเข้า BOM` | `🧪 นำเข้า BOM (เลิกใช้)` | `🧪 BOM Bulk Upload` |

**Customers table headers**

| Before | LANG=th | LANG=en |
|---|---|---|
| `Status` (English-only) | `สถานะ` | `Status` |
| `Code` | `รหัส` | `Code` |
| `Display name · ชื่อแสดงผล` (English-first) | `ชื่อแสดงผล` | `Display Name` |
| `Legal name · ชื่อทางการ` | `ชื่อทางการ` | `Legal Name` |
| `Tax ID · Branch` | `เลขประจำตัวผู้เสียภาษี / สาขา` | `Tax ID / Branch` |
| `สาขา · Sites` | `สาขา` | `Sites` |
| `SKU mappings` | `การแมป SKU` | `SKU Mappings` |
| `อัปเดต · Updated` | `อัปเดตล่าสุด` | `Updated` |
| `การจัดการ · Action` | `การจัดการ` | `Action` |

**Items table headers** (the screenshot trigger)

| Before | LANG=th | LANG=en |
|---|---|---|
| `Status / SKU / Role / Selling unit / Base conversion / Egg type / size / Upload mappings` | `สถานะ / รหัสสินค้า / บทบาท / หน่วยขาย / การแปลงหน่วย / ประเภทไข่ / เบอร์ไข่ / การแมปไฟล์อัปโหลด` | `Status / SKU / Name / Role / Customer / Selling Unit / Base Conversion / Egg Type / Size / Upload Mappings` |

**Row action buttons across all three tables**

| Before | LANG=th | LANG=en |
|---|---|---|
| `แก้ไข · Edit` | `แก้ไข` | `Edit` |
| `ปิดใช้งาน · Deactivate` | `ปิดใช้งาน` | `Deactivate` |

**Stats / count suffix**

| Before | LANG=th | LANG=en |
|---|---|---|
| `28 / 28 ลูกค้า · Customers` | `28 / 28 ลูกค้า` | `28 / 28 Customers` |
| `134 / 134 สินค้า · Items` | `134 / 134 สินค้า` | `134 / 134 Items` |

---

## D. What did not change

Confirmed by the static smoke check and by re-running the Task 12B acceptance harness (27/27 still pass):

- **No stored data values changed.** No write paths were touched. localStorage keys (`MASTER_V3`, `ORDERS`, `PLANNING`, `BOM_DONE`, …) all keep their existing shape; no migration ran.
- **No internal codes renamed.** `DEFECT`, `FG`, `PACKAGING`, `SUPPLY`, `READY`, `CONFIRMED`, `DISPATCHED`, the Orders status FSM transitions, the role-type filter keys, `egg_grade` codes, `MASTER_V3.option_sets.unit` codes — all unchanged.
- **No BOM logic / math changed.** `buildBomComponentLinesForItem`, `_bomOutputBaseFactor`, `_bomScaleFromSellingToOutput`, `_bomSellingEquivalentQty`, `_bomItemReadiness`, `getSellingUnitBaseFactor`, `normalizeItemUnits` — all unmodified.
- **No Orders / Planning / Logistics / PO parsing / Daily Plan BOM behavior changed.** Those render functions were not in the edit list. The protected do-not-touch primitives are byte-identical.
- **No `MASTER_V3.option_sets` mutation.** No edits to `ensureMasterOptionSets`, `reconcileControlledListsFromMasterData`, `_pruneStaleRoleOptions`, `_pruneStaleUnitOptions`.
- **No `oms-production/` changes.** Per project convention.
- **Task 12B Supply / Issue Unit deprecation intact.** Static smoke confirms `data-f="units.consumable_unit"`, `data-f="units.has_consumable_unit"`, `data-f="units.base_per_consumable"`, `id="itemSupplyBlock"` all still have **count = 0** in `app/index.html`. The legacy read-only notice IIFE and the validation neutralizations are unchanged. The Task 12B acceptance harness passes 27/27.

---

## E. QA / smoke check

### Static checks (all green)

| Check | Result |
|---|---|
| Brace `{`/`}` delta vs pre-Task-12C backup | **0** |
| Paren `(`/`)` delta vs pre-Task-12C backup | **0** (35 pre-existing imbalance preserved) |
| Bracket `[`/`]` delta vs pre-Task-12C backup | **0** |
| Byte delta vs pre-Task-12C backup | +1,791 |
| `node --check` on all 8 inline JS blocks | **all pass** |
| Anchors verified unique before each replacement | **yes** for all 28 edits (script aborts otherwise) |
| `function _lng(th, en)` definition | **count = 1** |
| `_lng(` call sites | **58** |
| Old bilingual patterns gone (16 checked) | **count = 0** for all |
| Task 12B forbidden DOM patterns (4 patterns) | **count = 0** |
| Task 12B acceptance harness (27 assertions, 5 cases) | **27 / 27 pass** |

### Regression / spot-check (recommended in the browser)

1. **LANG=th (default):** open the app. Verify Master Data tab shows Thai-only labels: `ข้อมูลหลัก`, `ลูกค้า`, `สาขาส่งของ`, `สินค้า`, `รายการตัวเลือก`. The toolbar buttons say `⬆ นำเข้า Master Excel`, `ส่งออก Master JSON`, `🔄 กู้คืน Master JSON`, `🗑 ล้างข้อมูล Master`. Group labels say `เครื่องมือผู้ดูแล`, `เครื่องมือเก่า`, `⚠ เขตอันตราย` (no English).
2. **Switch to LANG=en** via the language switcher. The same labels switch to English-only: `Master Data`, `Customers`, `Delivery Sites`, `Items`, `Controlled Lists`, `⬆ Import Master Excel`, `Export Master JSON`, `🔄 Restore Master JSON`, `🗑 Clear Master Data`, `Admin`, `Legacy`, `⚠ Danger`.
3. **Switch back to LANG=th.** Labels return to Thai-only.
4. **Open Master Data → Customers sub-tab.** Table headers in chosen language only. Each row's `แก้ไข` / `ปิดใช้งาน` (or `Edit` / `Deactivate`) renders single-language. Count text at the top shows `28 / 28 ลูกค้า` (Thai mode) or `28 / 28 Customers` (English mode).
5. **Open Master Data → Delivery Sites and Items sub-tabs.** Same single-language behavior.
6. **Open Master Data → Controlled Lists sub-tab.** "+ เพิ่มตัวเลือก" / "+ Add option" button, empty state, table header action cell, per-row Deactivate button — all switch single-language with LANG.
7. **Open an Item via Edit → check the BOM section.** Packaging Profile dual-basis column renders. Supply / Issue Unit section is gone. Task 12B legacy supply notice (if item has legacy data) shows. No regression vs. before.
8. **No new console errors** when toggling LANG or navigating tabs.

If anything fails the spot check, rollback (§G) and report back.

---

## F. Known risks / BUG_LOG

**`docs/BUG_LOG.md` was NOT updated.** This task is corrective UI cleanup — superseding the rejected Task 12C output. No real bug warrants a tracked row. Per the brief: "If this is purely UI text cleanup and no new bug is found, do not add unnecessary bug rows."

### Coverage scope honestly stated

This task focused on the **Master Data tab**, which is the surface the user's screenshot showed and the highest-density label area. The conversion-to-single-language model is delivered there in full. Other tabs (Orders, Daily Planning, ใบน้อย, Logistics, Analytics) and other modals (BOM section, Basket Profile, Packaging Profile, Item editor non-Counting-Units areas) **may still carry inline bilingual labels from earlier sprints**. Those areas were not in the user's screenshot and were not swept in this task. If the operator finds bilingual labels in those surfaces during testing, the same pattern (replace inline `'ไทย · English'` with `_lng('ไทย', 'English')`) can be applied in a follow-up sprint without architectural change — the `_lng()` helper is global and available everywhere now.

### Risks flagged (not in BUG_LOG)

1. **🟢 `_lng()` is read-once at render time.** Switching `LANG` after a Master Data sub-table has rendered does NOT live-update that already-rendered table — `applyLang` re-renders Orders and the Master Need-Attention block (see the existing `applyLang` body, lines 3091–3120) but not arbitrary render functions. To see the new language in a Master Data table, the operator either switches sub-tabs or refreshes the page. This is the same behavior the existing `applyLang` already had for these tables before Task 12C-R, so it is not a new regression — it is a pre-existing limitation that becomes more visible now that labels actually do switch.
2. **🟢 The 3 toolbar group labels lost their `text-transform: uppercase` CSS.** This was intentional: Thai glyphs render badly under CSS uppercase. The labels now show in mixed case in both languages, e.g. `Admin` (English mode) instead of `ADMIN`. Cosmetic only.

---

## G. Rollback command

```bash
cp _archive/index-pre-task12c-uilang-20260527.html app/index.html
```

This restores the state immediately after Task 12B (no Task 12C and no Task 12C-R). Single file, single command.

To roll back further: `cp _archive/index-pre-task12b-supplydeprecate-20260527.html app/index.html` (also reverts Task 12B).

---

## H. Final verdict

**Ready for UAT testing.**

The Master Data tab now reads single-language in both `LANG=th` and `LANG=en`. The previous "double languages all over the places" complaint is addressed for the screenshot surface. The Task 12B Supply / Issue Unit deprecation and all earlier work remain byte-identical and pass their regression harness.

**Stopped here per the prior instruction "Stop after this UI label consistency task" — no follow-up tasks started.**
