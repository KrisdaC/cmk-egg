# UAT Pro · Task 12G — Item Editor BOM UI Flow Reorganization — Closeout

**Date:** 2026-05-27
**Trigger:** User: "Reorganize the Item editor so BOM / Production Formula is the clear parent and Egg, Basket, Packaging are sub-sections of the same BOM setup."
**Conceptual hierarchy implemented:**
- **BOM / Production Formula** = single parent section
- Sub-cards inside it: **Egg inputs** → **Basket / Handling Unit** → **Packaging Profile** (preset slots) → **Additional materials** (manual, exception path) → **Components per output unit** (read-only derived) → **Test Calculation**

> Note: an earlier task in this codebase was also called "Task 12G" (drop Category from manual Packaging materials). This closeout uses the unique filename the user specified — `UAT_TASK12G_BOM_UI_FLOW_REORGANIZATION_CLOSEOUT.md` — and is independent of that earlier file.

---

## A. Files changed

- `app/index.html` — four anchored edits.
- `_archive/index-pre-task12i-bom-uiflow-20260527.html` — pre-edit backup.
- `_archive/closeouts/UAT_TASK12G_BOM_UI_FLOW_REORGANIZATION_CLOSEOUT.md` — this closeout.

| | Before | After | Δ |
|---|---:|---:|---:|
| `{` `}` balance | identical | identical | 0 (+1 / +1 from new helper) |
| `(` `)` imbalance | −35 (pre-existing) | −35 (preserved) | 0 |
| `[` `]` balance | identical | identical | 0 |
| `node --check` × inline JS blocks | passes | **passes (9/9)** | — |
| Task 12B acceptance harness | 27/27 | **27/27 still pass** | — |
| Task 12F-FIX / 12G-prev harness | 39/39 | **39/39 still pass** | — |
| All Egg + Basket `data-f` form fields | present in DOM | **still present** (just relocated) | — |

**Backup MD5 (pre-edit):** `64baf5a3f0427d35ab81a0d4708258ee`
**Post-edit MD5:** `7adbaf2a70dd729f7b78f1bc0b759cba`

The four anchored edits in `app/index.html`:

1. `openEditItem` (~line 10346) — removed the two standalone `_sec(...)` blocks (Basket Profile + Egg Profile). The BOM section now stands as the sole parent for Egg / Basket / Packaging; its `_sec` header is renamed from `🧪 BOM / Production formula` to `🧪 BOM / Production Formula` and the intro hint now reads "BOM defines all inputs needed to produce one output unit. Egg, basket, and packaging are sub-sections of the same BOM setup." / "BOM คือสูตรการผลิต — ไข่ ตะกร้า และบรรจุภัณฑ์ เป็นส่วนประกอบย่อยของสูตรเดียวกัน".
2. New helper **`_bomRenderItemEggInputsSubcard(it)`** inserted right above `_bomRenderItemEditSection`. Renders the same `data-f="is_egg" / egg_content_type / primary_grade / secondary_grade / min_primary` inputs as the (now-removed) standalone Egg Profile, wrapped in a styled yellow sub-card.
3. New helper **`_bomRenderItemBasketSubcard(it)`** inserted alongside. Wraps the existing `_bomRenderBasketProfile(it)` in a styled green sub-card.
4. **`_bomRenderItemEditSectionBody(it)`** reordered to the new flow (see §B), with an updated descriptive line above the Components table noting the table is auto-derived from Egg / Basket / Packaging above. The "Other packaging materials" collapsible header renamed to "**วัสดุเพิ่มเติม · Additional materials**".

---

## B. UI flow changed

### Before (4 standalone peer sections in the Item editor)

```
Item editor
 ├─ B2. Basket Profile        (standalone section)
 ├─ C.  Egg Profile           (standalone section)
 └─ D.  BOM / สูตรผลิต        (standalone section)
        ├─ Status block
        ├─ Output basis
        ├─ Components per output unit
        ├─ Packaging Profile
        ├─ Other packaging materials  (collapsible)
        └─ Test Calculation
```

### After (one parent BOM section; Egg + Basket become sub-cards)

```
Item editor
 └─ D.  🧪 BOM / Production Formula   (parent section)
        ├─ Helper banner: "BOM defines all inputs needed to produce one output unit.
        │                  Egg, basket, and packaging are sub-sections of the same BOM setup."
        ├─ 1. BOM Status block          (Enable / readiness / Re-check)
        ├─ 2. 🥚 Egg inputs             (sub-card, yellow tint)
        ├─ 3. 🧺 Basket / Handling Unit (sub-card, green tint)
        ├─ 4. BOM basis header          (output / production-pack)
        ├─ 5. 📦 Packaging Profile      (8-slot preset table from Task 12D + Task 12H)
        ├─ 6. ▸ Additional materials    (collapsible, manual, exception path)
        ├─ 7. Components per output unit (read-only derived table — auto-derived note)
        ├─ 8. ทดลองคำนวณ · Test Calculation
        ├─ BOM notes
        └─ Technical / Legacy details
```

The two formerly-standalone sibling sections (Basket Profile, Egg Profile) are gone from the Item editor's top-level layout. Their inputs render inside BOM as sub-cards with the same `data-f` attribute paths, so `_readEditForm` and the save pipeline are unchanged.

---

## C. Section naming changed

| Before | After |
|---|---|
| `🧺 ข้อมูลตะกร้า · Basket Profile` (standalone section header) | Sub-card heading: `🧺 ตะกร้า / หน่วยจัดส่ง · Basket / Handling Unit` |
| `🥚 ข้อมูลไข่ · Egg Profile` (standalone section header) | Sub-card heading: `🥚 วัตถุดิบไข่ · Egg inputs` |
| `🧪 BOM / สูตรผลิต · BOM / Production formula` | `🧪 BOM / สูตรผลิต · BOM / Production **F**ormula` (capitalized 'F') |
| `วัสดุบรรจุภัณฑ์อื่น · Other packaging materials` (collapsible header) | `วัสดุเพิ่มเติม · Additional materials` |
| Components table description | + suffix: "— สร้างอัตโนมัติจาก Egg / Basket / Packaging ด้านบน · auto-derived from Egg / Basket / Packaging above" |
| `📦 รูปแบบบรรจุภัณฑ์ · Packaging Profile` | unchanged (per brief) |

Sub-card subtitles added:

- Egg sub-card: "ตั้งค่าเบอร์ไข่หลัก / เบอร์รอง / สัดส่วน — เส้น BOM ของไข่ถูกคำนวณจากค่าที่ตั้งที่นี่" / "Set egg grade / mix / ratios. The egg BOM lines are derived from these values."
- Basket sub-card: "ตะกร้าเป็นหน่วยจัดส่ง / handling — ไม่ใช่ฐาน production pack" / "Basket is a handling / selling-container unit — not the production-pack basis."

---

## D. What was intentionally not changed

Confirmed by static smoke and two regression harnesses (27/27 + 39/39 still pass):

- **No data shape changes.** `it.bom.components[]`, `it.units.*`, `it.packaging_profile.*` — all untouched. `data-f` attribute paths for Egg fields (`is_egg`, `egg_content_type`, `primary_grade`, `secondary_grade`, `min_primary`) and Basket fields (`units.has_basket_unit`, `units.base_per_basket`, `units.basket_unit`) are preserved verbatim — they just render in new locations under `#editBody`. `_readEditForm` finds them the same way.
- **No calculation logic changes.** `calculateEggSourceRequirements`, `calculateBasketRequirementFromItem`, `_bomOutputBaseFactor`, `_bomScaleFromSellingToOutput`, `buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomRenderItemTestCalc` — all unmodified.
- **No data migration.** Existing items continue to render whatever they have stored.
- **Packaging Profile generic slot editor untouched** (Tasks 12D + 12H intact: 8 slots, manual mode, PACKAGING+SUPPLY filtering).
- **Other Packaging Materials (now "Additional materials") add workflow untouched** (Tasks 12F-FIX + 12G-prev intact: stopPropagation on Add-form inputs; no Category; SKU dropdown shows full PACKAGING+SUPPLY non-basket list; component_role auto-derived from picked SKU's item_type).
- **BOM readiness logic untouched** (Tasks 11H + 12B intact).
- **Daily Plan BOM (`renderPlanBom`) untouched.** Out of scope per project §6.
- **Orders, Logistics, ใบน้อย, PO parsers, `safeSet`, `oms-production/`, `MASTER_V3.option_sets`** — all untouched.
- **Task 12B Supply / Issue Unit deprecation intact** (4 forbidden DOM patterns still count = 0).
- **LANG-aware single-language labels (Tasks 12C-R / 12C-R2 / 12E / 12F / 12G-prev)** intact across the renamed and reorganized sections — all new and renamed labels use `_lng(th, en)`.

---

## E. Manual QA checklist

Run in a fresh browser tab. LANG defaults to `th`.

1. **Open the Items master tab** → click Edit on any FG SKU.
2. Scroll the Item editor modal. Confirm there are **no** standalone "🧺 Basket Profile" or "🥚 Egg Profile" sections. The only BOM-related section in the modal is the single parent **`🧪 BOM / สูตรผลิต`** card (or `🧪 BOM / Production Formula` in LANG=en).
3. Expand the BOM section. Confirm the helper banner is visible:
   - Thai: "BOM คือสูตรการผลิต — ไข่ ตะกร้า และบรรจุภัณฑ์ เป็นส่วนประกอบย่อยของสูตรเดียวกัน"
   - English: "BOM defines all inputs needed to produce one output unit. Egg, basket, and packaging are sub-sections of the same BOM setup."
4. Confirm the sub-cards render in this order inside BOM:
   1. BOM Status block (Enable / readiness chips / Re-check button)
   2. **🥚 วัตถุดิบไข่ · Egg inputs** (yellow sub-card)
   3. **🧺 ตะกร้า / หน่วยจัดส่ง · Basket / Handling Unit** (green sub-card)
   4. BOM basis header (output / production-pack)
   5. **📦 รูปแบบบรรจุภัณฑ์ · Packaging Profile** (8-row preset table)
   6. **▸ วัสดุเพิ่มเติม · Additional materials** (collapsible, collapsed by default)
   7. **ส่วนประกอบต่อ 1 หน่วยผลิต · Components per output unit** (read-only table; description notes it's auto-derived)
   8. **ทดลองคำนวณ · Test Calculation** (test qty input + result table)
5. **Egg inputs sub-card:**
   - Toggle "เป็นไข่ · Is egg item" → save → reopen. The toggle state persists.
   - Pick a Primary grade → save → reopen. The grade persists.
   - Confirm the Components table above updates the egg line accordingly (after a Save+reopen, or after the live-recompute fires).
6. **Basket / Handling Unit sub-card:**
   - Toggle "ใช้ตะกร้า · Uses basket" → save → reopen. The state persists.
   - For a basket-selling FG, change `base_per_basket` → confirm the basket BOM line's derived qty updates correctly.
7. **BOM Enable / readiness:**
   - For an FG with required data filled, the Enable checkbox can be ticked. Save → reopen → tick persists.
   - For an FG with missing data, the Enable checkbox is disabled and the readiness checklist explains what's missing. This behavior is unchanged from Task 11H / Task 12B.
8. **Packaging Profile (the 8-row preset table):**
   - Tick Active on any slot. Item type defaults to the slot's first allowed type. SKU dropdown lists PACKAGING + SUPPLY items matching that type.
   - The new "อื่นๆ / Others" 8th slot (Task 12H) is still there.
9. **Additional materials (collapsible):**
   - Click the `▸` header to expand. Add form has SKU + Qty + `+ Add material` (no Category dropdown — Task 12G-prev).
   - Add an SKU → row appears in the existing-rows table; component_role saved from the picked item's item_type.
10. **Components per output unit:**
    - The read-only table shows lines derived from Egg / Basket / Packaging Profile / Additional materials. Description notes "auto-derived from Egg / Basket / Packaging above".
11. **Test Calculation:**
    - Change the test qty → the multiplied table updates. Math unchanged from prior tasks.
12. **Save the item, close, reopen.** All inputs (egg, basket, packaging, additional, notes) persist.
13. **Re-open a NON-FG item** (e.g. a PACKAGING or SUPPLY master record). The BOM section renders the existing "ℹ BOM แสดงเฉพาะสินค้า FG / ผลิตได้ / ขายได้ / ไข่" fallback message (unchanged behavior). Egg + Basket sub-cards do not render for non-qualifying items, by design.
14. **LANG toggle:** switch between Thai and English. Sub-card headings, sub-card subtitles, and the Additional materials header all switch single-language.
15. **No console errors** when opening the editor, expanding/collapsing the BOM section, toggling Egg/Basket fields, picking SKUs, saving.

---

## F. Known risks

`docs/BUG_LOG.md` was NOT updated — this is UI flow / grouping only, no functional defect introduced.

1. **🟢 Non-qualifying items (pure PACKAGING / SUPPLY records with `is_egg=false, is_sellable=false, is_producable!==true, item_role!=='FG'`) no longer expose Egg/Basket fields in the editor.** Previously these items had standalone Egg Profile and Basket Profile sections visible (collapsible). After this task, those fields render only inside the BOM section, which for non-qualifying items shows the "BOM shows for FG / producable / sellable / egg items" fallback. The `data-f` inputs don't render in that fallback, so the existing values (if any) flow through unchanged via `_readEditForm`'s deep clone — no data loss — but the operator cannot edit them on a non-qualifying item without first changing `item_role` or one of the qualifying flags. This matches the intended semantic (PACKAGING items don't have egg/basket properties).
2. **🟢 `_showBasket` / `_isEggIt` local vars in `openEditItem` are still computed** (they gate the Counting & Units visibility blocks) but their usage in the standalone-section collapse-state is gone. Harmless dead reads in two places; left as-is for minimal diff (same family as UAT-039).
3. **🟢 Sub-card visual styling is intentional and minimal** — yellow tint for Egg, green tint for Basket, the existing off-white for Packaging Profile, grey for Additional materials. If the operator finds the four tints visually noisy, neutralizing them to a single tint is a one-line cosmetic follow-up.

---

## G. Static checks

| Check | Result |
|---|---|
| `{` `}` delta vs pre-task backup | **0** (+1 / +1 from the new helper braces, balanced) |
| `(` `)` delta vs pre-task backup | **0** (pre-existing −35 preserved) |
| `[` `]` delta vs pre-task backup | **0** |
| `node --check` on all 9 inline JS blocks | **passes** |
| `function _bomRenderItemEggInputsSubcard(it)` defined | **count = 1** |
| `function _bomRenderItemBasketSubcard(it)` defined | **count = 1** |
| `_bomRenderItemEditSectionBody` calls both sub-cards | confirmed |
| Standalone `🧺 Basket Profile` / `🥚 Egg Profile` `_sec(...)` calls removed | **count = 0** for the section labels |
| BOM section renamed to `🧪 BOM / Production Formula` (capital 'F') | confirmed |
| All Egg + Basket `data-f` form fields still present in source | **all 7 fields present** |
| "Other packaging materials" header replaced by "Additional materials" / "วัสดุเพิ่มเติม" | confirmed |
| Task 12B forbidden DOM patterns | **count = 0** |
| Task 12B acceptance harness (27 assertions, 5 cases) | **27 / 27 pass** |
| Task 12F-FIX / 12G-prev harness (39 assertions, 10 cases) | **39 / 39 pass** |

---

## H. Final verdict

**Ready for UAT testing.**

Acceptance criteria from the brief, ticked off:

| # | Criterion | Status |
|---|---|---|
| 1 | Item editor shows one clear parent section: BOM / Production Formula | ✅ §B (single `_sec` block) |
| 2 | Egg inputs appear as a sub-section inside BOM | ✅ §B sub-card #2 |
| 3 | Basket / Handling Unit appears as a sub-section inside BOM | ✅ §B sub-card #3 |
| 4 | Packaging Profile appears as a sub-section inside BOM | ✅ §B sub-card #5 (unchanged from prior tasks) |
| 5 | Additional / manual materials appear under Packaging Profile, not as a separate main concept | ✅ §B sub-section #6, renamed |
| 6 | Components table still shows the same calculated lines as before | ✅ harness 27/27 (BOM math) + 39/39 (component rendering) |
| 7 | BOM Enable / readiness gate still works | ✅ §B sub-card #1 (untouched logic) |
| 8 | Test Calculation still works | ✅ §B sub-card #8 (untouched math) |
| 9 | No data shape changes | ✅ §D (all `data-f` fields preserved) |
| 10 | No calculation logic changes | ✅ §D (no calc helpers edited) |
| 11 | Section K regression passes | ✅ §G (static smoke + two harnesses) |

**Rollback command:**

```bash
cp _archive/index-pre-task12i-bom-uiflow-20260527.html app/index.html
```

Single file, single command. Reverts only this task. Tasks 12B / 12C-R / 12C-R2 / 12D / 12E / 12F / 12F-FIX / 12G-prev / 12H all remain intact.
