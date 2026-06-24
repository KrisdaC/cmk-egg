# UI Basis with Screenshots — EggGrade OMS

> **Purpose.** Document the actual UAT user experience screen-by-screen so the production frontend team can reproduce it without operator interviews. Companion to `LOGIC_BASE_SPEC.md` (the logic side).
>
> **Source build:** `app/index.html` — MD5 `193180d9008557d8d53a954b5e36a88e`. Open the file in a browser side-by-side with this document for a faithful reproduction.
>
> **Screenshot status:** This handover was prepared without a connected browser session. **Every "[SCREENSHOT NEEDED]" marker** in this document is a placeholder; capture it from the live UAT before delivering this package to the dev team. The Screenshot Capture Checklist at the end lists every shot in order.

---

## 0. How to use this document

For each of the 13 UI sections below:

- **User role** — who interacts with the screen.
- **User goal** — what decision the user is trying to make.
- **Screenshot anchor** — where to capture the shot (Tab → sub-tab → state).
- **Main inputs** — fields the user fills in.
- **Main outputs** — what the system produces in response.
- **Status changes** — which order / planning / BOM / item state changes as a result.
- **Validation / error / needs-review behavior** — what gates the user.
- **Logic map** — pointer back to `LOGIC_BASE_SPEC.md` section that owns the business rules.
- **Related test scenarios** — pointer to `TESTING_SCENARIOS_AND_USER_FLOWS.md` flow #.

All section headers are tagged **[UAT-Confirmed]** unless explicitly noted.

---

## 1. Orders page (Tab `orders`)

**User role.** Operations / order admin.

**User goal.** Review incoming POs and manual orders. Confirm orders for daily plan. Resolve any "needs attention" cases (missing customer/site/SKU).

**Screenshot anchor.** App boot → `Orders` tab is the default landing screen.

**[SCREENSHOT NEEDED]** UI-01-orders-landing.png — full Orders tab on first load, showing the order list, status filters, and the four KPI cards (Tickets by status, Total eggs, Delivery sites, Fast-track).

**Visual structure (from `app/index.html` around lines 1860–1885):**

```
┌─ Orders                                                    ───────┐
│                                                                   │
│  [Tickets by status]  [Total eggs]  [Delivery sites] [Fast-track] │
│      KPI               KPI            KPI              KPI        │
│                                                                   │
│  Filters: customer · region · egg_size · sku · site · day_type    │
│                                                                   │
│  ┌─ Orders table ────────────────────────────────────────────────┐│
│  │ Date │ Customer │ Site │ Status │ Qty │ Needs Attention │ …  ││
│  └───────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.**

- Search box / filter chips on customer, region, egg size, SKU, site, day-of-week.
- Per-row "Edit invoice" action opens the invoice modal.
- Confirm / un-confirm toggle per ticket.

**Main outputs.**

- Filtered orders table.
- Status badges per ticket (`isNeedsAttention` highlights).
- Confirmed orders surface in Daily Plan Demand.

**Status changes.** Order draft → confirmed → enters Daily Plan Demand. The Orders status FSM is on the protected do-not-touch list per `DEVELOPMENT_WORKFLOW.md` rule 8.

**Validation / needs-review.** Missing customer / site / SKU surfaces in the "Needs Attention" KPI and per-row badge. Placeholder items (`is_placeholder = true`) display a distinct chip and must be resolved before confirmation.

**Logic map.** `LOGIC_BASE_SPEC.md` § 3 (Order Logic), § 11 (Validation rules), § 12 (Order FSM).

**Related test scenarios.** Flow 1 (Order with PO), Flow 2 (Order without PO), Flow 10 (Needs Review).

---

## 2. PO Intake / Upload page

**User role.** Operations / order admin.

**User goal.** Upload Makro / BigC / Thaifood PO spreadsheets and confirm the parsed result before committing to Orders.

**Screenshot anchor.** Orders tab → "Upload PO" action → file picker → Makro PO upload result modal (lines 2038–2070 in `app/index.html`).

**[SCREENSHOT NEEDED]** UI-02-po-upload-makro.png — Makro PO upload result modal showing parsed rows, customer/site mapping result, and the Confirm / Cancel buttons.

**[SCREENSHOT NEEDED]** UI-02b-po-upload-bigc.png — BigC PO upload result modal (same pattern, parser-specific column mapping).

**[SCREENSHOT NEEDED]** UI-02c-po-upload-thaifood.png — Thaifood PO upload result modal.

**Visual structure.**

```
┌─ Makro PO upload result ─────────────────────────────────────────┐
│                                                                   │
│  Source: filename.xlsx                                            │
│  Rows parsed: 42 · Mapped: 38 · Needs review: 4                  │
│                                                                   │
│  ┌─ Per-row table ────────────────────────────────────────────┐  │
│  │ Row │ Date │ Site │ SKU │ Qty │ Status │ Mapping ……         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Cancel]                                          [Confirm]     │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** File picker → XLSX file. Per-row mapping override (when auto-map ambiguous).

**Main outputs.** Parsed order lines with PO Qty locked at parse time; mapped customer / site / SKU references; placeholder items created for unknown SKUs.

**Status changes.** Successful confirm → order tickets created in `ORDERS` (key `demand_dashboard_orders`).

**Validation / needs-review.** Parser version `PARSER_VERSION` is stored alongside the uploaded record; stale uploads are invalidated when the parser version bumps. Unknown SKU rows create placeholders rather than failing the upload.

**Logic map.** `LOGIC_BASE_SPEC.md` § 3.1 (Order with PO), § 11 (Validation).

**Related test scenarios.** Flow 1 (Order with PO), Flow 10 (Needs Review).

---

## 3. Daily Planning — Demand (Tab `dailyplan` → sub-tab Demand)

**User role.** Production planner / operations supervisor.

**User goal.** Turn confirmed orders into a per-round demand picture. Accept lines into rounds R1..R4. Confirm planning quantities for BOM rollup.

**Screenshot anchor.** Daily Plan tab → Demand sub-tab.

**[SCREENSHOT NEEDED]** UI-03-dailyplan-demand.png — Daily Plan Demand sub-tab showing waiting list, round acceptance UI, per-customer grouping.

**Visual structure.**

```
┌─ Daily plan · Demand · YYYY-MM-DD ───────────────────────────────┐
│                                                                   │
│  Round selector: [R1] [R2] [R3] [R4]                             │
│                                                                   │
│  ┌─ Waiting (not yet accepted) ──────────────────────────────┐    │
│  │ Customer │ Site │ SKU │ Order Qty │ Planning Qty │ Action │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ Accepted into round R1 ──────────────────────────────────┐    │
│  │ Customer │ Site │ SKU │ Confirmed Planning Qty │ Confirm  │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.**

- Round selector (R1..R4).
- Per-line "Accept into round" button.
- Per-line Planning Qty adjustment.
- Confirm-round action (`planAcceptIntoRound` is wired at around line 20909).

**Main outputs.**

- Confirmed Planning Qty per line in `PLANNING` (key `demand_dashboard_planning_v2`).
- BOM rollup is recomputed off these confirmed lines.

**Status changes.** Waiting → Accepted into round → Confirmed.

**Validation / needs-review.** Lines with missing master-data references cannot be accepted; warning chip displays.

**Logic map.** `LOGIC_BASE_SPEC.md` § 4.1 (Demand Planning), § 4.3 (Confirmed for BOM).

**Related test scenarios.** Flow 4 (Demand Planning), Flow 6 (Confirmed for BOM).

---

## 4. Daily Planning — Logistics (Tab `dailyplan` → sub-tab Logistics)

**User role.** Logistics / dispatch planner.

**User goal.** Group demand lines into trips, assign vehicles, plan delivery routes.

**Screenshot anchor.** Daily Plan tab → Logistics sub-tab.

**[SCREENSHOT NEEDED]** UI-04-dailyplan-logistics.png — Trip Manager UI with per-trip card, vehicle assignment, stop ordering.

**Visual structure.**

```
┌─ Daily plan · Logistics · YYYY-MM-DD ────────────────────────────┐
│                                                                   │
│  ┌─ Trip 1 · Vehicle TYPE_A · plate XXX-1234 ───────────────┐    │
│  │ Stop 1: Customer A, Site X (3 SKUs, 240 base eggs)        │    │
│  │ Stop 2: Customer B, Site Y (1 SKU, 60 base eggs)          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ Trip 2 · Vehicle TYPE_B ────────────────────────────────┐    │
│  │ … unassigned demand lines below …                          │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** Vehicle assignment dropdown (from `option_sets.vehicle_type`), stop ordering, per-trip driver / plate fields.

**Main outputs.** Trip-grouped delivery plan. Feeds the printed pick-slip headers in ใบน้อย.

**Status changes.** Demand lines move from "unassigned" to "assigned to trip N."

**Validation / needs-review.** No automated capacity check (operator judges); vehicle capacity is shown as reference only.

**Logic map.** `LOGIC_BASE_SPEC.md` § 4.2 (Logistics Planning).

**Related test scenarios.** Flow 5 (Logistics Planning).

---

## 5. Daily Planning — BOM (Tab `dailyplan` → sub-tab BOM)

**User role.** Production supervisor / packing floor lead.

**User goal.** See what raw eggs + packaging + baskets are needed for the confirmed orders of the day.

**Screenshot anchor.** Daily Plan tab → BOM (🥚) sub-tab.

**[SCREENSHOT NEEDED]** UI-05-dailyplan-bom.png — Daily Plan BOM rollup with family grouping (`ถาด → แพ็ค → มัด → ตะกร้า → อื่นๆ`), per-customer chip filter, and BOM done flags.

**[SCREENSHOT NEEDED]** UI-05b-dailyplan-bom-eggsize.png — the 🥚 Egg Size Requirement panel (lines around 22088 in `app/index.html`).

**Visual structure.**

```
┌─ Daily plan · BOM · YYYY-MM-DD ──────────────────────────────────┐
│                                                                   │
│  Customer filter: [All] [Customer A] [Customer B] …               │
│                                                                   │
│  ┌─ ถาด (tray) ───────────────────────────────────────────────┐   │
│  │ SKU │ Qty │ Eggs per pack │ Total eggs │ Done?              │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌─ แพ็ค (pack) ──────────────────────────────────────────────┐   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌─ มัด (bundle) ─────────────────────────────────────────────┐   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌─ ตะกร้า (basket) ──────────────────────────────────────────┐   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌─ อื่นๆ (other) ─────────────────────────────────────────────┐   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🥚 Egg Size Requirement                                          │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Grade │ Before-mix min │ After-mix target │ Substitutes    │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** Customer filter chips, per-row "done" tick (writes to `BOM_DONE`, key `demand_dashboard_bom_done`).

**Main outputs.** Egg base counts per grade, packaging counts per family, basket counts per type. Surface "needs review" badges for rows where conversion or grade resolution failed.

**Status changes.** Per-row BOM done flag.

**Validation / needs-review.** UAT-016 / UAT-042 / UAT-046 known gaps — `renderPlanBom` does not yet read `item.bom.components`; packaging materials defined in the new editor (Task 9) appear in item-level BOM and Test Calculation only, not in Daily Plan BOM rollup. **[Future-Feature]** Unified integration.

**Logic map.** `LOGIC_BASE_SPEC.md` § 9 (Daily Plan BOM Logic).

**Related test scenarios.** Flow 6 (Confirmed for BOM / Production Planning).

---

## 6. Master Data (Tab `master`)

**User role.** Master data administrator / product owner.

**User goal.** Maintain customers, sites, items, and controlled lists.

**Screenshot anchor.** Master Data tab → Customers sub-tab on first open.

**[SCREENSHOT NEEDED]** UI-06-master-customers.png — Customers list with header, search, and the Need Attention block.

**[SCREENSHOT NEEDED]** UI-06b-master-sites.png — Delivery Sites list with customer filter and "show inactive" toggle.

**[SCREENSHOT NEEDED]** UI-06c-master-items.png — Items list with role filter and egg-grade pills (note: 130 items in `demand_master_v3_corrected_v5_20260521.json`).

**[SCREENSHOT NEEDED]** UI-06d-master-controlled-lists.png — 15 option-sets accordion view.

**[SCREENSHOT NEEDED]** UI-06e-master-health.png — Master Data Health panel after clicking "Run Master Data Health".

**Visual structure (lines 2144 in `app/index.html`).**

```
┌─ ข้อมูลหลัก · Master Data ───────────────────────────────────────┐
│                                                                   │
│  Sub-tabs:                                                        │
│  [Customers] [Delivery Sites] [Items] [Controlled Lists]          │
│                                                                   │
│  [Need Attention] panel (placeholder counts)                      │
│  [Run Master Data Health] button                                  │
│                                                                   │
│  ┌─ Customers table ──────────────────────────────────────────┐   │
│  │ ID │ Nickname │ Name │ Type │ Active? │ Edit               │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** Search, filter chips, per-row "Edit" action.

**Main outputs.** Edits write to `MASTER_V3` via `persistMasterV3`. Backup is taken before every write.

**Status changes.** Master records get `updated_at` / audit metadata on save.

**Validation.** `validateMasterCustomer / Site / Item` are on the protected list. Warnings surface in the Master Data Health panel.

**Logic map.** `LOGIC_BASE_SPEC.md` § 1 (Master Data logic), § 10 (Source-of-truth-per-module), § 11 (Validation).

**Related test scenarios.** Flow 7 (Item Master setup for egg SKU), Flow 8 (basket SKU), Flow 9 (mixed egg SKU).

---

## 7. Item Edit — Counting & Units section

**User role.** Master data administrator.

**User goal.** Set the unit ladder for an SKU so BOM math resolves.

**Screenshot anchor.** Master Data → Items → click any FG row → Item Edit modal → expand "📐 หน่วยและการนับ · Counting & Units" section.

**[SCREENSHOT NEEDED]** UI-07-item-edit-counting-units.png — Counting & Units section expanded, showing the conversion ladder, the conversion preview chips, and the selling-unit dropdown.

**Visual structure.**

```
┌─ 📐 หน่วยและการนับ · Counting & Units ────────────────────────────┐
│                                                                   │
│  Base unit:     [ฟอง  ▼]                                          │
│  Pack unit:     [แพ็ค 10] · base_per_pack: [12]                   │
│  Storage unit:  [พาเลท]  · base_per_storage: [1800]               │
│  Basket unit:   ตะกร้า    · base_per_basket: [180]                │
│  (basket conversion is managed in Basket Profile, below)          │
│                                                                   │
│  Selling unit:  [ถาด  ▼] (snapshot at modal open; save+reopen to  │
│                            refresh — UAT-017)                     │
│                                                                   │
│  Conversion preview chips:                                        │
│   1 ถาด = 30 ฟอง · 1 พาเลท = 1800 ฟอง · 1 ตะกร้า = 180 ฟอง       │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** Numeric `base_per_*` values, label strings for unit names, selling-unit dropdown.

**Main outputs.** Updated `item.units.*` on save.

**Status changes.** Selling-unit choice may flip BOM readiness (Task 8B-UI-4 gate).

**Validation.** Critical rule: `pack_unit` is a label; `base_per_pack` is the integer conversion. Do not parse digits out of the label string.

**Known UX caveats.** UAT-017 (selling-unit dropdown is a snapshot at modal open); UAT-029 (preview chips computed at open, not live on edit). Both intentional, "save and reopen to refresh."

**Logic map.** `LOGIC_BASE_SPEC.md` § 5 (Unit Conversion Logic).

**Related test scenarios.** Flow 7 (egg SKU setup), Flow 8 (basket SKU setup).

---

## 8. Item Edit — Egg Profile section

**User role.** Master data administrator.

**User goal.** Define the egg grade(s) for an egg SKU.

**Screenshot anchor.** Item Edit modal → "🥚 ข้อมูลไข่ · Egg Profile" section.

**[SCREENSHOT NEEDED]** UI-08-item-edit-egg-profile-single.png — single-grade SKU (only `primary_grade` set).

**[SCREENSHOT NEEDED]** UI-08b-item-edit-egg-profile-mixed.png — mixed SKU showing `primary_grade`, `secondary_grade`, `min_primary` field, and the bottom egg BOM preview with the two-line split.

**Visual structure.**

```
┌─ 🥚 ข้อมูลไข่ · Egg Profile ───────────────────────────────────────┐
│                                                                   │
│  is_egg:               [✓]                                        │
│  Egg content type:     [single grade ▼ | mixed grade | ungraded] │
│  Primary grade:        [M ▼]                                      │
│  Secondary grade:      [S ▼]   (mixed only)                       │
│  Min primary (%):      [40]    (mixed only; 0–100)                │
│                                                                   │
│  Preview (snapshot at open · UAT-032):                            │
│   Primary minimum line:  40% × total egg base → M                 │
│   Secondary balance line: 60% × total egg base → S                │
│                                                                   │
│  Note: ใช้เบอร์ใหญ่แทนได้ · larger eggs may substitute              │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** `is_egg` toggle, `egg_content_type` dropdown, primary/secondary grade dropdowns (from `option_sets.egg_grade`), `min_primary` integer field.

**Main outputs.** Egg-derived BOM lines via `splitBaseEggsByGrade`.

**Status changes.** Egg lines in BOM table re-derive on save and reopen.

**Validation.** `min_primary <= 1` is treated as a fraction (legacy guard). The code is correct; the stored value may still need a cosmetic re-save to normalize.

**Logic map.** `LOGIC_BASE_SPEC.md` § 6 (Egg Profile Logic).

**Related test scenarios.** Flow 7 (egg SKU setup), Flow 9 (mixed egg SKU).

---

## 9. Item Edit — Basket Profile section

**User role.** Master data administrator.

**User goal.** Set the basket conversion and pick the physical basket SKU.

**Screenshot anchor.** Item Edit modal → "🧺 ข้อมูลตะกร้า · Basket Profile" section.

**[SCREENSHOT NEEDED]** UI-09-item-edit-basket-profile-on.png — Basket Profile with "Uses basket" checked, base_per_basket field, basket SKU dropdown showing PACKAGING + basket candidates, and the live-recomputed quantity preview.

**[SCREENSHOT NEEDED]** UI-09b-item-edit-basket-profile-off.png — Basket Profile with "Uses basket" unchecked, showing the "preserved but inactive" note.

**Visual structure.**

```
┌─ 🧺 ข้อมูลตะกร้า · Basket Profile ───────────────────────────────┐
│                                                                   │
│  Uses basket:          [✓]                                        │
│  base_per_basket:      [180]                                      │
│  Basket SKU:           [B1MK0001 · ตะกร้า Makro ▼]                │
│                          (candidates: PACKAGING items with        │
│                          item_type = basket)                      │
│                                                                   │
│  Live quantity preview (Task 8C-2B):                              │
│   Selling unit ถาด → 30 / 180 = 0.1667 basket per output         │
│                                                                   │
│  When unchecked:                                                  │
│   "Stored basket component preserved but inactive"                │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** `has_basket_unit` checkbox, `base_per_basket` integer, basket SKU dropdown.

**Main outputs.** Updates the single basket component in `bom.components` (via `_bomSelectBasketSku`).

**Status changes.** BOM line appears / disappears in the Components table; BOM readiness re-evaluates.

**Validation.** Active basket needs `base_per_basket > 0` AND a selected basket SKU. Inactive basket fails neither.

**Known design notes.** Active switch is the single governor (Task 8C-2E). Basket qty is conversion-derived; stored qty is informational only. Basket unit (display) comes from the selected basket SKU's `units.base_unit`.

**Logic map.** `LOGIC_BASE_SPEC.md` § 7 (Basket Profile Logic).

**Related test scenarios.** Flow 8 (basket SKU setup), Flow 10 (Needs Review).

---

## 10. Item Edit — BOM / สูตรผลิต section

**User role.** Master data administrator.

**User goal.** Verify (and tick `bom.enabled`) the BOM for an FG SKU. Run a Test Calculation to sanity-check.

**Screenshot anchor.** Item Edit modal → "🧪 BOM / สูตรผลิต · Production formula" section.

**[SCREENSHOT NEEDED]** UI-10-item-edit-bom.png — full BOM section showing status block, Output basis, Components-per-output table (with egg lines, basket line, packaging lines), and Test Calculation area.

**[SCREENSHOT NEEDED]** UI-10b-item-edit-bom-readiness-fail.png — same screen but with `_bomItemReadiness` failing; checkbox disabled and checklist showing.

**[SCREENSHOT NEEDED]** UI-10c-item-edit-bom-packaging-editor.png — Packaging materials editor introduced Task 9 (lines 22808: "BOM Bulk Upload · ตรวจก่อน commit" modal).

**Visual structure.**

```
┌─ 🧪 BOM / สูตรผลิต · Production formula ─────────────────────────┐
│                                                                   │
│  [Status block] BOM enabled: [✓] (disabled when readiness fails)  │
│  When disabled: checklist of what to fix.                         │
│                                                                   │
│  Output / ผลิตอะไร                                                │
│   1 output unit = 1 ถาด (selling_unit)                           │
│                                                                   │
│  Components per output unit · ใช้อะไรบ้างต่อ 1 หน่วยผลิต          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Type      │ Item / SKU            │ Qty │ Unit │ Source     │ │
│  │ 🥚 Egg    │ ไข่ไก่ M (locked)      │ 30  │ ฟอง  │ egg_profile│ │
│  │ 🧺 Basket │ B1MK0001 (locked)     │ 0.16│ ใบ   │ basket_*  │ │
│  │ 📦 Pack   │ C19999P301 ถาดกระดาษ  │ 1   │ ใบ   │ bom_setup │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Test Calculation · ทดลองคำนวณ                                    │
│   Test output qty: [100]   → [Run]                                │
│   Result table (not saved)                                        │
│                                                                   │
│  Technical / Advanced details                                     │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** `bom.enabled` checkbox; per-line edits for editable (packaging) lines; Test qty input.

**Main outputs.** Component lines via `buildBomComponentLinesForItem`; readiness state via `_bomItemReadiness`.

**Status changes.** `bom.enabled` toggle.

**Validation / needs-review.** Egg lines locked (edit Egg Profile). Basket line locked (edit Basket Profile). Packaging lines editable. Readiness gate: 5 checks (see `LOGIC_BASE_SPEC.md` § 8.4).

**Known orphaned helpers.** UAT-037 — earlier preview chain (`_bomRenderEggBasketSection` etc.) is unused but left defined.

**Logic map.** `LOGIC_BASE_SPEC.md` § 8 (BOM Logic).

**Related test scenarios.** Flow 6 (Confirmed for BOM), Flow 7 (egg SKU), Flow 8 (basket SKU), Flow 9 (mixed egg SKU).

---

## 11. Controlled Lists (Tab `master` → sub-tab Controlled Lists)

**User role.** Master data administrator.

**User goal.** Govern dropdowns used across Master Data (units, egg grades, item roles, item types, vehicle types, regions, customer types).

**Screenshot anchor.** Master Data → Controlled Lists sub-tab.

**[SCREENSHOT NEEDED]** UI-11-controlled-lists.png — Controlled Lists accordion view with 15 option-sets visible.

**[SCREENSHOT NEEDED]** UI-11b-controlled-lists-used-where.png — the "Used Where?" panel for one option (e.g. `unit`).

**Visual structure.**

```
┌─ Controlled Lists ───────────────────────────────────────────────┐
│                                                                   │
│  ▸ unit (14 entries)                                              │
│  ▾ egg_grade (7 entries: S/M/L/XL/Jumbo/…)                        │
│      Code   │ Label TH  │ Label EN │ Active? │ Used Where?       │
│      S       เบอร์ S      Size S       ✓                          │
│      M       เบอร์ M      Size M       ✓                          │
│  ▸ item_role                                                      │
│  ▸ item_type                                                      │
│  ▸ vehicle_type                                                   │
│  ▸ region                                                         │
│  ▸ customer_type                                                  │
│  ▸ … (15 sets total)                                              │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** Add new option (kept add-only); toggle active; edit label TH/EN.

**Main outputs.** `MASTER_V3.option_sets[setKey][]` updates.

**Validation.** Add-only reconciliation. Must not invalidate values already in use. The "Used Where?" map (UAT-019, UAT-031) misses `storage_unit` / `consumable_unit` references for the `unit` set.

**Logic map.** `LOGIC_BASE_SPEC.md` § 10 (Source-of-truth-per-module), § 11 (Validation).

**Related test scenarios.** Flow 7 (egg SKU setup uses egg_grade), Flow 8 (basket uses item_type=basket).

---

## 12. Logistics — Trip Manager

**User role.** Logistics planner.

**User goal.** Plan trips, vehicles, drivers, stop ordering.

**Screenshot anchor.** Daily Plan → Logistics sub-tab → Trip Manager card. (Same screen as section 4 above; this section dives deeper into per-trip detail.)

**[SCREENSHOT NEEDED]** UI-12-logistics-trip-manager.png — Trip Manager card open for one trip, showing vehicle, driver, stops, drop sequence.

**Visual structure.** Same as section 4. The Trip Manager view shows per-trip detail with vehicle type from `option_sets.vehicle_type`, driver name, plate, and the ordered list of stops with site addresses.

**Main inputs.** Drag-and-drop / move-up/down for stop order; vehicle / driver / plate fields.

**Main outputs.** Trip-grouped delivery plan; feeds ใบน้อย pick-slip headers.

**Logic map.** `LOGIC_BASE_SPEC.md` § 4.2 (Logistics Planning).

**Related test scenarios.** Flow 5 (Logistics Planning).

---

## 13. ใบน้อย (pick / check / driver document)

**User role.** Warehouse / pick floor.

**User goal.** Print A6 pick slips for each customer trip.

**Screenshot anchor.** Daily Plan → ใบน้อย / Picking sub-tab.

**[SCREENSHOT NEEDED]** UI-13-bainoi-list.png — list of ใบน้อย slips per trip / customer / site.

**[SCREENSHOT NEEDED]** UI-13b-bainoi-printable.png — printable A6 slip preview.

**Visual structure.**

```
┌─ ใบน้อย · Pick slips ─────────────────────────────────────────────┐
│                                                                   │
│  ┌─ Trip 1 · Vehicle TYPE_A ────────────────────────────────┐    │
│  │  Slip 1 · Customer A · Site X      [Print]                │    │
│  │  Slip 2 · Customer B · Site Y      [Print]                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Printable A6 slip:                                               │
│  ┌────────────────────────────────────────────┐                  │
│  │  Customer · Site · Trip · Date              │                  │
│  │  ┌──────────────────────────────────────┐   │                  │
│  │  │ SKU │ Qty │ Eggs │ Picked? │ Checked? │   │                  │
│  │  └──────────────────────────────────────┘   │                  │
│  │  Driver: __________   Plate: __________     │                  │
│  └────────────────────────────────────────────┘                  │
└───────────────────────────────────────────────────────────────────┘
```

**Main inputs.** Per-slip Print action; per-row tick (picked/checked) on paper, not in the app currently.

**Main outputs.** Printable A6 PDF/HTML.

**Status changes.** None in the app today — the slip is a paper hand-off document. **[Future-Feature]** Loaded Qty / Delivered Qty back-fed into the app.

**Logic map.** `LOGIC_BASE_SPEC.md` § 2 stages 11–14.

**Related test scenarios.** Flow 5 (Logistics — feeds ใบน้อย).

---

## 14. Cross-cutting UI elements

### 14.1 Header strip

Built in stabilization Task 2 (see `_archive/closeouts-2026-05-18/UAT_TASK2_HEADER_STRIP_CLOSEOUT.md`).

**[SCREENSHOT NEEDED]** UI-14-header-strip.png — top-of-screen header showing build pill, record counts, last-save label, ⬇ Backup now and ↻ Restore from file… buttons.

Shows `BUILD_ID`, customer / site / item counts, last-save label (updates every 30 s). Buttons trigger versioned JSON backup envelope (`schema_version: 2`).

### 14.2 Master Data Health panel

Surfaced by clicking **Run Master Data Health** in the Master Data tab.

**[SCREENSHOT NEEDED]** UI-14b-master-health-panel.png — health panel with the warning counts and per-row drill-down.

Non-blocking warnings: duplicate unit names, selling-unit not in base/pack/basket, legacy basket_type, etc. Warnings never block save.

### 14.3 Tickets table (Orders detail)

`renderTicketsTable` (line 15269) renders the per-ticket detail with sections: PO (locked from upload), Dates & timing, Logistics, Quantity Lifecycle (PO → Confirmed → Planning → Dispatch), Audit timeline, Items.

**[SCREENSHOT NEEDED]** UI-14c-ticket-detail.png — Order ticket open, all sections visible, including the PO → Confirmed → Planning → Dispatch lifecycle indicator (line 12971).

---

## 15. Screenshot Capture Checklist

Run through this list in a fresh browser session with `app/index.html` and the latest master loaded. Save each capture under `docs/production_handover/screenshots/` with the exact filename listed. Replace each `[SCREENSHOT NEEDED]` placeholder above with a Markdown image embed once captured.

| # | Filename | Tab → state |
|---|---|---|
| 01 | UI-01-orders-landing.png | App boot → Orders tab default |
| 02 | UI-02-po-upload-makro.png | Orders → Upload PO → Makro PO result modal |
| 02b | UI-02b-po-upload-bigc.png | Orders → Upload PO → BigC result modal |
| 02c | UI-02c-po-upload-thaifood.png | Orders → Upload PO → Thaifood result modal |
| 03 | UI-03-dailyplan-demand.png | Daily Plan → Demand sub-tab |
| 04 | UI-04-dailyplan-logistics.png | Daily Plan → Logistics sub-tab |
| 05 | UI-05-dailyplan-bom.png | Daily Plan → BOM sub-tab (family rollup) |
| 05b | UI-05b-dailyplan-bom-eggsize.png | Same screen, scroll to Egg Size Requirement |
| 06 | UI-06-master-customers.png | Master Data → Customers default |
| 06b | UI-06b-master-sites.png | Master Data → Delivery Sites |
| 06c | UI-06c-master-items.png | Master Data → Items |
| 06d | UI-06d-master-controlled-lists.png | Master Data → Controlled Lists |
| 06e | UI-06e-master-health.png | Master Data → Run Master Data Health |
| 07 | UI-07-item-edit-counting-units.png | Item Edit → Counting & Units section |
| 08 | UI-08-item-edit-egg-profile-single.png | Item Edit → Egg Profile (single grade) |
| 08b | UI-08b-item-edit-egg-profile-mixed.png | Item Edit → Egg Profile (mixed) |
| 09 | UI-09-item-edit-basket-profile-on.png | Item Edit → Basket Profile (Uses basket ON) |
| 09b | UI-09b-item-edit-basket-profile-off.png | Item Edit → Basket Profile (Uses basket OFF) |
| 10 | UI-10-item-edit-bom.png | Item Edit → BOM section (readiness pass) |
| 10b | UI-10b-item-edit-bom-readiness-fail.png | Item Edit → BOM (readiness fail) |
| 10c | UI-10c-item-edit-bom-packaging-editor.png | Item Edit → BOM → Packaging editor |
| 11 | UI-11-controlled-lists.png | Master Data → Controlled Lists accordion |
| 11b | UI-11b-controlled-lists-used-where.png | Controlled List → "Used Where?" panel |
| 12 | UI-12-logistics-trip-manager.png | Daily Plan → Logistics → Trip card open |
| 13 | UI-13-bainoi-list.png | Daily Plan → ใบน้อย list |
| 13b | UI-13b-bainoi-printable.png | ใบน้อย → Print preview |
| 14 | UI-14-header-strip.png | Top of any screen (close-up) |
| 14b | UI-14b-master-health-panel.png | Master Data Health output |
| 14c | UI-14c-ticket-detail.png | Order ticket open with all sections |

**[Needs-Verification]** This handover was produced without browser access. The dev team / operator captures these shots in a single sitting (~15 minutes) and replaces every `[SCREENSHOT NEEDED]` marker above with the image embed.

End of UI Basis document.
