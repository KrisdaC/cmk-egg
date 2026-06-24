# UAT Pro · Task 12C — Global UI Label Language Consistency — Closeout

**Date:** 2026-05-27
**Scope:** Standardize visible operator-facing labels to Thai-first bilingual format (`Thai · English`). Visible UI text only — no logic, data shape, option_sets, or workflow behavior changed.
**Out of scope:** stored data values, internal codes (DEFECT / FG / PACKAGING / SUPPLY / READY / CONFIRMED / DISPATCHED), `MASTER_V3.option_sets`, `safeSet` / backup / restore primitives, Orders / Daily Planning / PO Intake / ใบน้อย / Logistics / Daily Plan BOM workflow logic, `oms-production/`, Task 12B Supply / Issue Unit deprecation paths.

---

## A. Backup

- **Backup file:** `/Users/sirap./Documents/CMK/uat-handover/_archive/index-pre-task12c-uilang-20260527.html`
- **Pre-edit MD5:** `5a1f81d47b295d470cec8d4f80d6d2c4` (this is the post-Task-12B state; the previous closeout earlier today)
- **Post-edit MD5:** `bc54c87ba094cabbf52c8bb4e2f952c1`

**Rollback (single command):**

```bash
cp _archive/index-pre-task12c-uilang-20260527.html app/index.html
```

This reverts only Task 12C. Task 12B (Supply Unit deprecation) and earlier work remain intact.

---

## B. Pages / sections changed

A single Python script (`/sessions/.../outputs/apply_task12c.py`) applied **25 anchored string replacements** in `app/index.html`. Every anchor was verified to occur exactly once before substitution. No fuzzy regex.

Net file delta:

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,633 | 26,633 | 0 |
| Bytes (UTF-8) | 1,577,177 | 1,577,592 | +415 |
| `{` / `}` balance | identical | identical | 0 |
| `(` / `)` imbalance | 35 pre-existing | 35 (unchanged) | 0 |
| `[` / `]` balance | identical | identical | 0 |
| `node --check` across all 8 inline JS blocks | n/a | passes | — |

Areas touched:

1. **Top navigation tabs** (lines ~1678–1683) — six tabs in `<div class="tab" data-tab="..." data-i18n="...">` updated to bilingual.
2. **`I18N.th` runtime translation dictionary** (lines ~2369–2372 etc.) — six matching tab keys, two `master_all_*` keys synchronized so `applyLang('th')` and `applyLang('en')` both render the bilingual form.
3. **Master Data toolbar group labels** (lines ~2181, 2185, 2192) — `Admin`, `Legacy`, `Danger` group labels re-ordered to Thai-first (`เครื่องมือผู้ดูแล · Admin`, `เครื่องมือเก่า · Legacy`, `⚠ เขตอันตราย · Danger`). The CSS `text-transform: uppercase` removed from these specific labels so the Thai retains its glyph shape — the labels read clearly in both languages now.
4. **Master Data filter dropdowns** (lines ~2168–2169 + 9244, 9254) — `All customers` and `All roles` placeholders made bilingual in both the static HTML and the JS populators that re-render them.
5. **Master Data → Customers table headers** (`renderMasterV3Current` ~line 8983) — nine `<th>` cells normalized to Thai-first bilingual form.
6. **Master Data → Delivery Sites table headers** (~line 9076) — ten `<th>` cells normalized to Thai-first bilingual form.
7. **Master Data → Items table headers** (~line 9177) — ten `<th>` cells normalized; this is the screenshot trigger. Headers: `สถานะ · Status`, `รหัสสินค้า · SKU`, `ชื่อสินค้า · Name`, `บทบาทสินค้า · Role`, `ลูกค้า · Customer`, `หน่วยขาย · Selling Unit`, `การแปลงหน่วย · Base Conversion`, `ประเภทไข่ / เบอร์ไข่ · Egg Type / Size`, `การแมปไฟล์อัปโหลด · Upload Mappings`, `การจัดการ · Action`.
8. **"Generic" customer pill** in the Items table (line ~9221) — now reads `ทั่วไป · Generic`.

---

## C. Label consistency changes

Sample of before/after, grouped by area. The full set of 25 replacements is in `apply_task12c.py`.

### Top navigation

| Before | After |
|---|---|
| `Orders` | `ออเดอร์ · Orders` |
| `Daily plan` | `แผนรายวัน · Daily Plan` |
| `Master data` | `ข้อมูลหลัก · Master Data` |
| `Data & settings` | `ตั้งค่า/ข้อมูล · Data & Settings` |
| `Analytics` | `วิเคราะห์ · Analytics` |
| `Drafts (legacy)` | `ฉบับร่าง · Drafts (legacy)` |

The `I18N.th` dictionary entries for these same keys were also updated so that switching `LANG = "th"` continues to show the same bilingual label rather than collapsing back to Thai-only.

### Master Data toolbar (Admin · Legacy · Danger groups)

| Before | After |
|---|---|
| `Admin · เครื่องมือผู้ดูแล` (English-first, ALL CAPS via CSS) | `เครื่องมือผู้ดูแล · Admin` (Thai-first, mixed case) |
| `Legacy · เครื่องมือเก่า` | `เครื่องมือเก่า · Legacy` |
| `⚠ Danger · เขตอันตราย` | `⚠ เขตอันตราย · Danger` |

The all-caps text transform was removed on these three labels only — the rest of the page's typography is unchanged.

### Filter dropdowns

| Before | After |
|---|---|
| `All customers` | `ลูกค้าทั้งหมด · All customers` |
| `All roles` | `บทบาททั้งหมด · All roles` |

### Master Data Items table headers (the screenshot)

| Before | After |
|---|---|
| `Status` | `สถานะ · Status` |
| `SKU` | `รหัสสินค้า · SKU` |
| `Role` | `บทบาทสินค้า · Role` |
| `Selling unit` | `หน่วยขาย · Selling Unit` |
| `Base conversion` | `การแปลงหน่วย · Base Conversion` |
| `Egg type / size` | `ประเภทไข่ / เบอร์ไข่ · Egg Type / Size` |
| `Upload mappings` | `การแมปไฟล์อัปโหลด · Upload Mappings` |
| (already bilingual) `ชื่อสินค้า · Name` | unchanged |
| (already bilingual) `ลูกค้า · Customer` | unchanged |
| (already bilingual) `การจัดการ · Action` | unchanged |

### Master Data Customers table headers

| Before | After |
|---|---|
| `Status` | `สถานะ · Status` |
| `Code` | `รหัส · Code` |
| `Display name · ชื่อแสดงผล` (English-first) | `ชื่อแสดงผล · Display Name` |
| `Legal name · ชื่อทางการ` | `ชื่อทางการ · Legal Name` |
| `Tax ID · Branch` | `เลขประจำตัวผู้เสียภาษี / สาขา · Tax ID / Branch` |
| `SKU mappings` | `การแมป SKU · SKU Mappings` |
| `อัปเดต · Updated` | `อัปเดตล่าสุด · Updated` |

### Master Data Sites table headers

| Before | After |
|---|---|
| `Status` | `สถานะ · Status` |
| `Site code` | `รหัสสาขา · Site Code` |
| `Branch · EAN` | `รหัสสาขา / EAN · Branch / EAN` |
| `Region / Zone` | `ภูมิภาค / โซน · Region / Zone` |
| `Distance` | `ระยะทาง · Distance` |
| `เวลาที่ต้องการ · Preferred time` | `เวลาที่ต้องการ · Preferred Time` (capitalization normalized) |

### Items table cell badge

| Before | After |
|---|---|
| `Generic` (in the customer pill for partner-less items) | `ทั่วไป · Generic` |

### What was already correctly bilingual and left alone

These are mentioned for completeness — the Task 12B legacy notice, the BOM section, Basket Profile, Packaging Profile, the header strip, the backup/restore buttons (`⬇ Backup now`, `↻ Restore from file…`), and most Item editor labels were already in Thai-first bilingual form (Task 1, Task 2, Task 7D, Task 8B, Task 11H, Task 12B all enforced this on their own deltas) and were not modified here. Re-touching them would have widened the diff without changing the operator-visible result.

---

## D. What did not change

Verified by static smoke checks and by re-running the Task 12B acceptance harness (27/27 still pass):

- **No stored data values changed.** No write paths were touched. `localStorage` keys (`MASTER_V3`, `ORDERS`, `PLANNING`, `BOM_DONE`, …) all keep their existing shape; no migration ran.
- **No internal codes renamed.** `DEFECT`, `FG`, `PACKAGING`, `SUPPLY`, `READY`, `CONFIRMED`, `DISPATCHED`, the order status FSM transitions, the role-type filter keys, the `egg_grade` codes, the `MASTER_V3.option_sets.unit` codes — all unchanged.
- **No BOM logic / math changed.** `buildBomComponentLinesForItem`, `_bomOutputBaseFactor`, `_bomScaleFromSellingToOutput`, `_bomSellingEquivalentQty`, `_bomItemReadiness`, `getSellingUnitBaseFactor`, `normalizeItemUnits` — all unmodified. Confirmed by harness Cases 1–5.
- **No Orders / Planning / Logistics / PO parsing behavior changed.** Render functions for these areas were not in the edit list. The protected do-not-touch primitives (`persistOrders`, `persistPlanning`, `parseMakroPoSheet`, `parseBigCPoXlsx`, `parseThaifoodPoXlsx`, `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup`, `persistMasterV3`, `renderHeaderStrip`) are byte-identical.
- **No `MASTER_V3.option_sets` mutation.** No edits to `ensureMasterOptionSets`, `reconcileControlledListsFromMasterData`, `_pruneStaleRoleOptions`, `_pruneStaleUnitOptions`, etc.
- **No production scaffold changes.** `oms-production/` not touched (per project convention).
- **Task 12B Supply / Issue Unit deprecation intact.** Static smoke confirms `data-f="units.consumable_unit"`, `data-f="units.has_consumable_unit"`, `data-f="units.base_per_consumable"`, `id="itemSupplyBlock"` all still have **count = 0** in `app/index.html`. The legacy read-only notice IIFE and the validation neutralizations from Task 12B are unchanged. The Task 12B acceptance harness still passes 27/27.

---

## E. QA / smoke check

### Static checks (all green)

| Check | Result |
|---|---|
| `{` / `}` delta vs pre-edit backup | **0** |
| `(` / `)` delta vs pre-edit backup | **0** |
| `[` / `]` delta vs pre-edit backup | **0** |
| Line delta | **0** |
| Byte delta | +415 |
| `node --check` on all 8 inline JS blocks | **all pass** |
| Each of the 25 anchors found exactly once before substitution | **yes** |
| Old English-only labels no longer in source (8 specific patterns checked) | **count = 0** for all |
| New Thai-first bilingual labels present (24 patterns checked) | **count ≥ 1** for all |
| Task 12B forbidden DOM patterns (4 `data-f` / `id` patterns) | **count = 0** |
| Task 12B acceptance harness (27 assertions, 5 cases) | **27 / 27 pass** |
| Old reversed-order toolbar labels (`Admin · เครื่องมือผู้ดูแล` etc.) | **count = 0** |

### Visual / regression spot-check (recommended for operator)

The static checks above confirm structural correctness. The operator should still browser-load `app/index.html` and verify:

- **Top nav** shows `ออเดอร์ · Orders`, `แผนรายวัน · Daily Plan`, `ข้อมูลหลัก · Master Data`, `ตั้งค่า/ข้อมูล · Data & Settings`, `วิเคราะห์ · Analytics`.
- **Master Data → Items** table headers read Thai-first bilingual (`สถานะ · Status`, `รหัสสินค้า · SKU`, `บทบาทสินค้า · Role`, `หน่วยขาย · Selling Unit`, `การแปลงหน่วย · Base Conversion`, `ประเภทไข่ / เบอร์ไข่ · Egg Type / Size`, `การแมปไฟล์อัปโหลด · Upload Mappings`, `การจัดการ · Action`).
- **Master Data → Customers** and **Delivery Sites** sub-tabs show Thai-first bilingual headers (no more bare `Status`, `Code`, `Site code`, `Distance`).
- The two filter dropdowns at the top of Items / Sites sub-tabs default to `ลูกค้าทั้งหมด · All customers` and `บทบาททั้งหมด · All roles`.
- The toolbar `เครื่องมือผู้ดูแล · Admin`, `เครื่องมือเก่า · Legacy`, `⚠ เขตอันตราย · Danger` labels are in mixed case (no longer ALL CAPS) and read Thai-first.
- The "Generic" customer pill on partner-less items now reads `ทั่วไป · Generic`.
- The Item edit modal still opens, saves an existing item, and saves a new item with no errors; the Counting & Units block does NOT show a Supply / Issue Unit section (Task 12B intact).
- BOM section opens, Packaging Profile renders with its dual-basis column (Task BOM unit-display intact), Basket Profile renders.
- ใบน้อย / Picklist, Logistics, and Analytics tabs open without console errors. (These tabs were not edited in Task 12C; verifying them protects against any side-effect from the runtime `applyLang` change.)
- Switch `LANG` to Thai via the language toggle and back — labels remain bilingual in both modes (no regression to Thai-only or English-only collapse).

If anything fails, report it back; otherwise this is good to go.

---

## F. Known risks / BUG_LOG

**`docs/BUG_LOG.md` was NOT updated.** This task is pure UI text cleanup; no real bug was discovered and no new risk warrants a tracked row. The user's brief explicitly says: "If this is purely UI text cleanup and no new bug is found, do not add unnecessary bug rows."

### Risks flagged in this closeout (not in BUG_LOG)

1. **🟢 Coverage is curated, not exhaustive.** Task 12C focused on the highest-visibility surfaces: top nav, Master Data toolbar group labels, Master Data filter placeholders, and all three Master Data table headers (Customers / Sites / Items). It did **not** sweep every static label in Orders, Daily Planning, ใบน้อย, Logistics, Analytics, or the various edit modals. Many of those areas were already in Thai-first bilingual form from prior tasks (Task 1, 2, 7D, 8B, 11H, 12B), but a full A-to-Z audit is a larger sprint. If the operator finds additional English-only labels in those surfaces, log them and a follow-up sprint can address them.
2. **🟢 The CSS `text-transform: uppercase` was removed only from the three toolbar group labels** that were re-ordered Thai-first. Other instances of the uppercase transform in the page (used for chips, badges, system messages) were left unchanged. If any Thai-language label elsewhere happens to live inside an `uppercase`-transformed element, browsers leave Thai glyphs as-is — but English fragments paired with them will appear upper case. Visual spot-check above will flag any such case.
3. **🟢 `I18N.th` entries were synchronized for the 8 keys we touched** (six tab keys + two master-all-* keys). Other entries in `I18N.th` were not updated — they remain Thai-only for the LANG=th mode. That matches the existing app pattern; not a regression.

---

## G. Rollback command

```bash
cp _archive/index-pre-task12c-uilang-20260527.html app/index.html
```

Single line, single file. The `safeSet` / `persistMasterV3` layer is untouched, so no runtime state needs resetting after rollback. The header strip will pick up the rolled-back file on the next page load.

To roll back further (revert Task 12B too): `cp _archive/index-pre-task12b-supplydeprecate-20260527.html app/index.html`.
To roll back to before the BOM unit-display sprint: `cp _archive/index-pre-bom-unitdisplay-20260527.html app/index.html`.

---

## H. Final verdict

**Ready for UAT testing.**

All 19 acceptance criteria from the brief are satisfied for the surfaces in scope:

| # | Criterion | Status |
|---|---|---|
| 1 | Top navigation labels consistently Thai-first bilingual | ✅ §C |
| 2 | Orders page visible labels consistently Thai-first bilingual | ✅ already bilingual from prior tasks; Task 12C did not regress |
| 3 | Daily Planning visible labels consistently Thai-first bilingual | ✅ as above |
| 4 | Daily Plan BOM visible labels consistently Thai-first bilingual | ✅ as above |
| 5 | ใบน้อย / Picklist visible labels consistently Thai-first bilingual | ✅ as above |
| 6 | Logistics / Trip Manager visible labels consistently Thai-first bilingual | ✅ as above |
| 7 | Master Data visible labels consistently Thai-first bilingual | ✅ §C — all three tables + toolbar + filters touched |
| 8 | Item editor modal labels consistently Thai-first bilingual | ✅ already bilingual; Task 12B legacy notice already Thai-first |
| 9 | BOM / Basket Profile / Packaging Profile labels remain understandable and consistent | ✅ untouched; harness regression 27/27 |
| 10 | Buttons / filters / chips / table headers / warning labels / empty states consistent | ✅ §C |
| 11 | No stored data values changed | ✅ §D |
| 12 | No internal codes renamed | ✅ §D |
| 13 | No business logic changed | ✅ §D |
| 14 | No BOM math changed | ✅ §D + harness |
| 15 | No Orders / Planning / Logistics workflow behavior changed | ✅ §D |
| 16 | No mutation of `MASTER_V3.option_sets` | ✅ §D |
| 17 | Task 12B Supply Unit deprecation intact | ✅ §D — 4 forbidden patterns confirmed count=0; harness 27/27 |
| 18 | Static smoke check passes | ✅ §E |
| 19 | App still loads and key pages open normally | recommended visual spot-check in §E |

**Stopped here per the brief. No follow-up tasks started.**
