# QA Checklist — EggGrade OMS UAT

**Purpose.** Run this checklist before sending any UAT build to operators, stakeholders, or the dev team. A green-pass run here is the gate for declaring a build "ready to share." Anything that fails goes straight into [`BUG_LOG.md`](./BUG_LOG.md).

**How to use this file.** Copy this file into `_archive/QA_CHECKLIST-RUNS/YYYYMMDD-run.md` before each handover. Tick each box, fill the **Pass/Fail/Notes** column. A run with any **Fail** is not green — fix or roll back before shipping.

**Estimated time.** ~10–15 minutes end-to-end the first few times; faster once you know the flow.

**Build under test:**
- Build ID (from header strip): `UAT v3.122 · post-Task-8A-1 · index.html MD5 fc7fb7c4808259f4a03444489edc55db`
- Tester: `__________________`
- Date / time (Bangkok): `2026-05-21 · staged run (browser rows pending operator)`
- Browser + version: `__________________`

---

## How to mark results

For each row:
- `✅ Pass` — observed exactly the expected behavior
- `❌ Fail` — observed something different (note what)
- `⚠ Note` — passed but with a concern worth recording

If you see anything you don't recognise, ask before clicking through.

---

---

## Automated pre-gate — Task 8A-1 BOM egg/basket preview (2026-05-21)

Run by static analysis + a Node harness against the post-edit `app/index.html`
(MD5 `fc7fb7c4808259f4a03444489edc55db`). This is NOT a substitute for the manual
browser run below — it only confirms the build is not structurally broken before
a human opens it.

| Check | Result |
|---|---|
| `node --check` on every inline `<script>` block (excl. the octet-stream HISTORY_B64 blob) | PASS — clean parse |
| Brace `{}` delta vs pre-edit backup | PASS — 0 -> 0 (unchanged) |
| Paren `()` delta vs pre-edit backup | PASS — -35 -> -35 (unchanged) |
| Bracket `[]` delta vs pre-edit backup | PASS — 0 -> 0 (unchanged) |
| Backtick parity | PASS — 1210 -> 1210 (even, unchanged) |
| 13 new BOM symbols present exactly once | PASS |
| Task 1 / Task 2 helpers + 8 persist functions intact | PASS |
| Functional harness — 7 acceptance tests + 6 edge cases | PASS — 17 / 17 |
| K12 — closeout report present in `/` | PASS — `UAT_TASK8A1_BOM_EGG_BASKET_CLOSEOUT.md` |

**Browser-dependent rows (Sections A-K + L) below were NOT run.** The Claude in
Chrome integration cannot open `file://` pages, and rows D3-D9 / B1 / B3-B4 /
I2 / I4 create-and-delete live tickets or download/import files — operator-run
only. Tick those by hand.

---

## A. Build / Boot · เปิดแอป

| # | Step | Expected | Result |
|---|---|---|---|
| A1 | Open `app/index.html` in a fresh browser tab | Page renders without any red error overlay | ☐ |
| A2 | Open DevTools → Console | No red errors. Only `[boot] …` lines and `[masterV3] …` info messages | ☐ |
| A3 | Look at the header strip at the top of the page | Strip is visible, shows `EggGrade OMS · UAT v3.xxx · build YYYY-MM-DD …` in the pill | ☐ |
| A4 | Note the BUILD_ID shown | Matches what was expected for this build · บันทึก BUILD_ID ลงในช่อง "Build ID" ด้านบน | ☐ |
| A5 | Wait 2 seconds — confirm the **default tab is Orders** (per phase note) | Orders tab is active; Drafts tab is hidden | ☐ |
| A6 | Resize the browser narrower (~900 px wide) | Header strip wraps; buttons stay clickable | ☐ |

---

## B. Safety / Backup / Restore · สำรอง / กู้คืน

### B1. Backup now

| # | Step | Expected | Result |
|---|---|---|---|
| B1.1 | Click **⬇ Backup now** in the header strip | A file `cmk-uat-backup-YYYYMMDD-HHmm.json` downloads · ไฟล์ JSON ถูกดาวน์โหลด | ☐ |
| B1.2 | Toast appears bottom-right | Green: `✓ Backup saved · N keys · ~XXX KB` | ☐ |
| B1.3 | Open the downloaded JSON in a text editor | Top-level keys include: `schema_version`, `exported_at`, `build_id`, `parser_version`, `counts`, `payload`, `_keys` | ☐ |
| B1.4 | Inside `counts`, customer / site / item totals match the header strip | Match exactly | ☐ |

### B2. Restore from file (no-op test)

| # | Step | Expected | Result |
|---|---|---|---|
| B2.1 | Click **↻ Restore from file…** | Native file picker opens | ☐ |
| B2.2 | Click Cancel on the picker | Nothing happens; no toast, no console error | ☐ |

### B3. Restore from file (invalid file)

| # | Step | Expected | Result |
|---|---|---|---|
| B3.1 | Click **↻ Restore from file…** and pick a non-JSON file (e.g. a README) | Alert: `❌ ไฟล์ JSON ไม่ถูกต้อง · Invalid JSON: …` | ☐ |
| B3.2 | Pick a valid JSON that isn't a CMK backup | Alert: `❌ ไฟล์ไม่ใช่ CMK backup (ไม่พบ payload หรือ _keys)` | ☐ |

### B4. Restore from file (valid round-trip)

| # | Step | Expected | Result |
|---|---|---|---|
| B4.1 | Click **↻ Restore from file…** and pick the file from B1 | First confirm shows file name, backup version, exported timestamp, counts | ☐ |
| B4.2 | Click Cancel on the first confirm | Nothing changes; localStorage intact | ☐ |
| B4.3 | Re-trigger the picker, accept the first confirm | Second confirm appears (from existing Import All flow) | ☐ |
| B4.4 | Accept the second confirm | Page reloads; data appears identical to before | ☐ |

### B5. Task 1 safeSet helpers callable (DevTools console)

| # | Step | Expected | Result |
|---|---|---|---|
| B5.1 | `typeof safeSet` | `'function'` | ☐ |
| B5.2 | `typeof listAllBackups` then `listAllBackups().length` | Array. Length ≥ 1 (at least the master `_backup_latest`) | ☐ |
| B5.3 | `typeof restoreFromBackup` | `'function'` | ☐ |
| B5.4 | After ticking any BOM cell or editing a customer, run `safeSetLastSave('demand_dashboard_orders')` or the appropriate key | Returns `{ ts: <recent>, ok: true, sizeBytes: <number> }` | ☐ |
| B5.5 | Wait 30 s, look at header strip "last save" | Updates to "30 s" or "1 min" | ☐ |

---

## C. Master Data · ข้อมูลหลัก

| # | Step | Expected | Result |
|---|---|---|---|
| C1 | Click **Master data** tab | Page loads. Sub-tabs: Customers / Delivery Sites / Items / Controlled Lists | ☐ |
| C2 | Customers tab — table renders | Customer rows visible, header strip's customer count matches | ☐ |
| C3 | Click **Delivery Sites** sub-tab | Table renders, customer-filter and "show inactive" toggle work | ☐ |
| C4 | Click **Items** sub-tab | Table renders, role filter works, egg-grade pills render | ☐ |
| C5 | Click **Controlled Lists** sub-tab | 15 option-sets visible, can expand each | ☐ |
| C6 | Scroll to **Need Attention** block | Counts match the header strip's placeholder warning (if any) | ☐ |
| C7 | Click **Run Master Data Health** | Validation panel renders, shows errors/warnings if any | ☐ |
| C8 | Open one customer record (read-only) | Form shows correct fields; no console error | ☐ |
| C9 | Cancel the edit (don't save) | localStorage `demand_dashboard_master_v3` unchanged · ตรวจด้วย `safeSetLastSave('demand_dashboard_master_v3')` | ☐ |

**Do NOT save anything in this section unless you intentionally want to test the save path.**

---

## D. Orders · ออเดอร์

| # | Step | Expected | Result |
|---|---|---|---|
| D1 | Click **Orders** tab | Tickets table renders, filters bar visible | ☐ |
| D2 | KPI tiles at the top show counts | Status counts + total eggs + sites + fast-track count | ☐ |
| D3 | Click **+ New ticket** for any customer | New row appears in the table | ☐ |
| D4 | Fill in a delivery date and one line item | Inline edit card expands and accepts input | ☐ |
| D5 | Click **ยืนยันออเดอร์** (Confirm) on a clean ticket | Status moves to "ยืนยันแล้ว / Confirmed"; pill changes color | ☐ |
| D6 | Create an intentionally broken ticket (e.g. no SKU, or zero qty) | A red "ต้องดำเนินการ" attention chip appears | ☐ |
| D7 | Hover the attention chip | Tooltip lists the validation reasons | ☐ |
| D8 | Try to confirm the broken ticket | Confirm is blocked or warned, depending on the reason | ☐ |
| D9 | Delete the broken test ticket | Disappears from table; if it created a placeholder SKU, the placeholder is also cleaned up (check Master → Need Attention) | ☐ |
| D10 | After the operations above, `safeSetLastSave('demand_dashboard_orders').ok === true` | Saves are being tracked | ☐ |

---

## E. PO Upload · อัปโหลด PO

Run this section **only if you have a sample PO file at hand.** If you don't, skip and note "skipped — no sample file."

| # | Step | Expected | Result |
|---|---|---|---|
| E1 | Drop a Makro PO XLSX onto the orders dropzone | Upload modal opens, parsed rows preview | ☐ |
| E2 | Confirm Makro upload | Tickets appear in Orders tab with status `drafting` or `open` | ☐ |
| E3 | Drop a BigC PO CSV (Thai CP874 encoded) | Modal opens, Thai text reads correctly (no mojibake) | ☐ |
| E4 | Confirm BigC upload | Tickets appear; placeholder rows surface in Need Attention if any unmatched SKU | ☐ |
| E5 | Drop a Thaifood PO XLSX | Modal opens, preview correct | ☐ |
| E6 | If any placeholder SKU was created, open it from Need Attention → map to an existing item | Placeholder resolves; ticket lines reflect the real SKU | ☐ |

---

## F. Daily Plan basic smoke test · วางแผนรายวัน

This is a smoke test — **do not change any planning state.** Just check pages render.

| # | Step | Expected | Result |
|---|---|---|---|
| F1 | Click **Daily plan** tab | Page loads, round bar visible | ☐ |
| F2 | **Demand** sub-tab | Demand matrix renders for the current date; customer columns visible | ☐ |
| F3 | Hover any qty cell | Tooltip shows breakdown | ☐ |
| F4 | Trip Manager panel above the matrix | Renders without console error | ☐ |
| F5 | Switch rounds (Morning / Afternoon / Evening) | Each renders without error | ☐ |
| F6 | Return to Demand without changing anything | localStorage `demand_dashboard_planning_v2` unchanged | ☐ |

---

## G. BOM basic smoke test · BOM

| # | Step | Expected | Result |
|---|---|---|---|
| G1 | Daily plan → **🥚 BOM** sub-tab | BOM summary renders; family chips visible | ☐ |
| G2 | Customer-filter chips work | Click "Makro" → only Makro rows render | ☐ |
| G3 | Family order is ถาด → แพ็ค → มัด → ตะกร้า → อื่นๆ | Correct order top-to-bottom | ☐ |
| G4 | Egg size labels (เบอร์ 0, 1, …) appear in natural sort | Match expected order | ☐ |
| G5 | Tick a "Done" checkbox on any row | Tick persists | ☐ |
| G6 | Reload the page | Tick still present (BOM_DONE persisted) | ☐ |
| G7 | Untick to leave the state clean | Cell empty again | ☐ |

---

## H. ใบน้อย basic smoke test

| # | Step | Expected | Result |
|---|---|---|---|
| H1 | Daily plan → **📋 ใบน้อย** sub-tab | Picklist page renders (may show gate message if planning qty not confirmed yet) | ☐ |
| H2 | If page is gated, the gate message is clear · ข้อความ "กรุณายืนยันจำนวนวางแผนก่อน" appears | Operator understands what to do | ☐ |
| H3 | If page renders, every line has SKU + qty + unit | No `undefined` / `NaN` cells | ☐ |

---

## I. Export / Import (legacy path, in Data & Settings tab)

| # | Step | Expected | Result |
|---|---|---|---|
| I1 | Click **Data & Settings** tab | Page loads, Export All / Import All buttons visible | ☐ |
| I2 | Click **Export all** (legacy button) | Downloads `cmk-uat-data-YYYY-MM-DD-HHmm.json` | ☐ |
| I3 | Open the legacy file | Has `_exportedAt`, `_appVersion`, `_keys` (NOT the new `schema_version`/`payload` fields) | ☐ |
| I4 | Click **Import all** with the legacy file | Two confirms appear, then reload, then data identical | ☐ |
| I5 | **Round-trip test:** open the file from B1 (new envelope) and use the legacy **Import all** | Works (because the new envelope still carries `_keys`) | ☐ |

---

## J. Language · ภาษา

| # | Step | Expected | Result |
|---|---|---|---|
| J1 | Click **EN** in the lang-toggle (top right) | UI labels switch to English; the strip's `Backup now` / `Restore from file…` text stays English | ☐ |
| J2 | Click **ไทย** | UI returns to Thai; strip buttons read `สำรองข้อมูลทันที` / `กู้คืนจากไฟล์…` | ☐ |
| J3 | After the next 30 s tick (or any save), the stats row swaps language too | `customers` → `ลูกค้า` etc. | ☐ |
| J4 | Reload the page | Last-selected language persists | ☐ |

---

## K. Regression gate · ก่อนปิดงาน feature ใหม่

**This is the must-pass list before any new feature is declared "done."**

Run these in order. Every one must pass before the next build is shared.

| # | Check | Result |
|---|---|---|
| K1 | All A1–A6 boot checks pass | ☐ |
| K2 | All B1–B5 backup / restore checks pass | ☐ |
| K3 | C1–C9 Master Data renders, Master Data Health runs without error | ☐ |
| K4 | D1–D10 Orders create / confirm / delete / placeholder cleanup work | ☐ |
| K5 | F1–F6 Daily Plan demand renders for today | ☐ |
| K6 | G1–G7 BOM renders + Done ticks persist | ☐ |
| K7 | I1–I5 Export / Import round-trip works (both legacy and new envelope) | ☐ |
| K8 | J1–J4 Language switch works both directions | ☐ |
| K9 | Reload the browser **twice**; data still appears the same · ทุก localStorage key รอดมา | ☐ |
| K10 | DevTools console has zero red errors after K1–K9 | ☐ |
| K11 | `listAllBackups()` shows at least the master `_backup_latest` + the new feature's source key `_backup_latest` | ☐ |
| K12 | New feature has its own closeout report in `/` matching the existing Task1/Task2 style | ☐ |

If **any** K-row fails: do **not** share the build. Either fix only that issue or roll back from `_archive/`.

---

## L. New feature — BOM egg/basket preview (Task 8A-1)

Run after Section G. Non-destructive except L11 (save).

| # | Step | Expected | Result |
|---|---|---|---|
| L1 | Master data -> Items -> open an FG egg item -> expand "🧪 BOM / สูตรผลิต" | Section shows enabled / no_bom_required / output_unit + a dashed "Tick BOM enabled" hint | ☐ |
| L2 | Tick "เปิดใช้ BOM · enabled" | Preview appears live: Output basis, Test qty (100), egg table, basket table | ☐ |
| L3 | Tray egg SKU (selling unit ถาด, base-per-pack 30), Test qty 100 | Egg table: primary grade, 3,000 ฟอง | ☐ |
| L4 | Basket FG (selling unit ตะกร้า, base_per_basket 60), Test qty 100 | Egg 6,000 ฟอง; basket 100 ตะกร้า | ☐ |
| L5 | Change Test qty to 250 | Both tables recalculate immediately | ☐ |
| L6 | Mixed-grade egg item (primary + secondary, min_primary 50) | Two egg rows, split 50/50 | ☐ |
| L7 | Item with no selling unit | Output basis shows a warning; warnings panel lists "Selling unit is not set"; no crash | ☐ |
| L8 | Basket conversion on but base_per_basket blank | Basket table shows the warning row; no crash | ☐ |
| L9 | Untick "BOM enabled" | Preview hides, dashed hint returns | ☐ |
| L10 | Console during L1-L9 | No red errors | ☐ |
| L11 | Save the item, reopen | enabled state persists; if enabled, preview renders open | ☐ |

---

## Tester notes / observations

Use this section freely. Anything that didn't fit a checkbox above goes here.

```
[Notes — free text]
```

## Sign-off

- **Tester signature:** `__________________`
- **Sign-off date:** `__________________`
- **Result:** ☐ Green — ready to share   ☐ Yellow — share with caveats noted   ☐ Red — fix or roll back
