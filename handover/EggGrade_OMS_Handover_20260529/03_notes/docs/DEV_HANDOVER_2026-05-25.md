# EggGrade OMS UAT — Current App Overview & BOM Conversation Closeout

**Handover date:** 2026-05-25
**Build under test:** `app/index.html` — MD5 `d340f2521bb7f759e00e9021d829c012`, 25,478 lines, ~1.5 MB
**Globals:** `PARSER_VERSION = 13`, `BUILD_ID = "build 2026-05-07 06:59:43"`
**Audience:** the next development chat / developer. Assume no memory of the prior conversation.
**Status of this document:** documentation only — no code was changed to produce it.

> **How to read this document.** Statements are written as *confirmed facts* unless
> tagged **[needs verification]** (something a future chat should re-check against the
> live code or a browser) or **[assumption]** (a reasonable inference, not directly verified).

---

## 1. Executive Summary

**What the app is.** EggGrade OMS (a.k.a. CMK / ไชยมงคล Egg ERP) is an Order
Management System for an egg-packing factory in Thailand. It is a single self-contained
HTML file — `app/index.html` — that operators run in a browser. All data lives in the
browser's `localStorage`. There is no server database for the working system.

**What stage it is in.** The app is a live UAT (User Acceptance Testing) build in
active daily-style use. It is feature-mature for Orders, Daily Planning, ใบน้อย, and
Logistics, and is mid-build on the BOM (Bill of Materials) / production-formula feature.
A parked, separate NestJS+Prisma+React production rewrite exists under `oms-production/`
but is **frozen** and out of scope.

**What was stabilized in this conversation.** The work focused entirely on the
**item-level BOM and Basket Profile** inside the Master Data item editor. The BOM editor
was rebuilt around a single "one component-line model", a dedicated Basket Profile
section was created, live recompute was wired in, and a sequence of basket bugs was
fixed — culminating in a correct basket *active/inactive* state model (Task 8C-2E).

**Current readiness status.** A full QA gate was run on 2026-05-25
(`_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md`): **67/67 functional
assertions passed**, **zero confirmed bugs**, **no code changed during QA**. A
line-level diff confirmed every recent change is confined to the Master Data item-edit
modal and the item-edit BOM module — Orders, Daily Planning, Daily Plan BOM, Controlled
Lists, Logistics, and ใบน้อย were not touched. The app is considered **ready for closeout
of the BOM/Basket stabilization conversation**, with one recommended-but-not-blocking
step outstanding: a short human browser smoke (see §10 and §11).

---

## 2. App Architecture Overview

**Single-file UAT app.** The entire application — HTML, CSS, and JavaScript — is one
file, `app/index.html`. JavaScript lives in 7 inline `<script>` blocks (plus one
`application/octet-stream` block holding a compressed historical-data blob,
`HISTORY_B64`). There is no build step, no bundler, and no `npm install` needed to run
it; opening the file in a browser is the whole deployment.

**LocalStorage / MASTER_V3 data model.** Application state is persisted to
`localStorage` under a set of fixed keys. The most important is **`MASTER_V3`** (key
`demand_dashboard_master_v3`) — the master-data object holding `customers`, `sites`,
`items`, `option_sets`, and `meta`. Other keys include `ORDERS`, `PLANNING` (key
`demand_dashboard_planning_v2`), `DRAFTS`, `BOM_DONE`, uploaded-file state, user
mappings, and saved views. On boot, `loadMasterV3()` reads and parses `MASTER_V3` from
`localStorage`; runtime migrations then normalize older records.

**Safe persistence / backup strategy.** Writes go through a hardened layer added in the
earlier stabilization tasks:
- `safeSet(key, payload, opts)` — wraps every persist: it takes a backup before write,
  guards against empty overwrites, and warns on a >30% shrink.
- `safeSetLastSave(key)`, `listAllBackups()`, `restoreFromBackup(sourceKey)` — backup
  inventory and restore helpers.
- `persistMasterV3()` — the MASTER_V3-specific persist, with its own backup siblings.
- A global header strip (`renderHeaderStrip()`) shows `BUILD_ID`, record counts, a
  last-save label, and **⬇ Backup now** / **↻ Restore from file…** buttons, using a
  versioned JSON envelope (`schema_version: 2`).
- Rollback points: every pre-edit snapshot of `app/index.html` is kept under `_archive/`
  as `index-pre-*.html`.

**Main modules and how they relate.** The factory's daily flow drives the module
relationships: PO files are uploaded into **Orders** → orders are confirmed → **Daily
Planning** computes demand per round → **Daily Plan BOM** tells the packing floor what
raw eggs + packaging are needed → **ใบน้อย** generates warehouse pick slips → **Logistics
/ Trip Manager** assigns vehicles and drivers. **Master Data** (customers, sites, items)
is the reference data all of the above read from; **Controlled Lists / option_sets** are
the controlled vocabularies Master Data fields draw from.

---

## 3. Module-by-Module Overview

### Orders (tab `orders`; Drafts + Orders views)
- **Purpose.** Receive customer PO files, parse them into orders, and move orders
  through a status finite-state-machine.
- **Maturity.** Mature / production-grade for daily use.
- **Key data.** `ORDERS` keyed by date; per-order invoices and line items.
- **Major functions.** `renderOrders()`, `onOrdersTabOpen()`, `renderOrdersTable()`;
  status FSM (reason codes, transitions, `isNeedsAttention`).
- **Watch items.** The Orders status FSM and the placeholder lifecycle are on the
  protected do-not-touch list. **Not touched by the BOM/Basket conversation.**

### PO Intake / Upload
- **Purpose.** Parse Makro / BigC / Thaifood PO spreadsheets into Orders.
- **Maturity.** Mature; format-specific.
- **Major functions.** `parseMakroPoSheet`, `parseBigCPoXlsx`, `parseThaifoodPoXlsx`
  **[needs verification of exact current names]**; importer wiring via `_wireImporter()`.
- **Watch items.** Parsers are on the protected do-not-touch list. UAT-012 (CJ upload)
  is an open low-severity note in `BUG_LOG.md`.

### Daily Planning (tab `dailyplan`)
- **Purpose.** Turn confirmed orders into per-round demand; close rounds; drive BOM,
  ใบน้อย, and Logistics. Has 4 sub-tabs (`switchPlanSub`): **Demand**, **BOM**,
  **ใบน้อย/Picking**, **Logistics**.
- **Maturity.** Mature.
- **Key data.** `PLANNING` (key `demand_dashboard_planning_v2`) keyed by date — rounds
  R1–R4, assignments, accepted, adjustments, vehicle types, deferred, trips.
- **Major functions.** `onDailyPlanTabOpen()`, `renderPlanDemand()`,
  `renderPlanPicking()`, `renderPlanLogistics()`, `switchPlanSub()`, `getDayPlan(date)`.
- **Watch items.** Not touched by the BOM/Basket conversation.

### Daily Plan BOM (sub-tab `bom` of Daily Planning)
- **Purpose.** Roll up the day/round's confirmed orders into raw-egg + packaging
  requirements for the packing floor.
- **Maturity.** Working; **older logic than the new item-level BOM model.**
- **Major functions.** `renderPlanBom()` (line ~23704), plus its own family of
  `_bom*` helpers.
- **Watch items.** `renderPlanBom()` is a **separate code path** from the new item-edit
  BOM module. It was **not changed** in this conversation. UAT-016 (🟡 Medium, open) flags
  a conversion concern in `renderPlanBom`. Integrating Daily Plan BOM with the new
  one-component-line model is a recommended future sprint (see §12).

### Master Data (tab `master`)
- **Purpose.** Maintain customers, sites, and items (SKUs). Home of the item editor
  where the BOM/Basket work in this conversation lives.
- **Maturity.** Mature for customers/sites; item editor actively evolving (BOM section).
- **Key data.** `MASTER_V3.{customers, sites, items, option_sets}`.
- **Major functions.** `onMasterV3TabOpen()`, `openEditItem(it)`, `openEditCustomer`,
  `openEditSite`, `_readEditForm()`, `saveEdit()`, `normalizeMasterRecord()`,
  `validateMasterItem()`. The item editor renders sectioned `_sec(...)` blocks (see §4).
- **Watch items.** `openEditCustomer/Site/Item` validators and Master Data forms are on
  the protected list except where a task explicitly scoped a change. The item editor's
  BOM + Basket Profile sections are the actively-developed area.

### Controlled Lists / option_sets
- **Purpose.** Controlled vocabularies (e.g. `unit` set ~14 entries, `egg_grade` set
  ~7 entries) that Master Data fields draw from.
- **Maturity.** Mature; add-only reconciliation.
- **Major functions.** `ensureMasterOptionSets()` (seeds option_sets after load),
  `reconcileControlledListsFromMasterData()` (add-only sweep that pulls current master
  values into the lists), `getOptionSet()`, `getOptionLabel()`, `_v3SyncControlledLists()`.
- **Watch items.** `MASTER_V3.option_sets` is read via `getOptionSet` / `getOptionLabel`
  and must never be mutated directly. Reconciliation is **add-only** — it must not
  invalidate values already in use. Not touched by the BOM/Basket conversation.

### Logistics / Trip Manager (sub-tab `logistics`)
- **Purpose.** Assign vehicles, drivers, and plates to trips; group stops.
- **Maturity.** Mature.
- **Major functions.** `renderPlanLogistics()`, `_renderTripManagerHTML()`.
- **Watch items.** Not touched by the BOM/Basket conversation.

### ใบน้อย / Picklist (sub-tab `picking`)
- **Purpose.** Generate A6 warehouse pick slips from confirmed-delivery quantities.
- **Maturity.** Mature.
- **Major functions.** `renderPlanPicking()` and its pick-slip helpers.
- **Watch items.** Not touched by the BOM/Basket conversation.

### Backup / Restore / safeSet layer
- **Purpose.** Make every write reversible and surface save health to the operator.
- **Maturity.** Mature (stabilization Tasks 1 & 2).
- **Major functions.** `safeSet`, `safeSetLastSave`, `listAllBackups`,
  `restoreFromBackup`, `persistMasterV3`, `renderHeaderStrip`.
- **Watch items.** These primitives are on the protected do-not-touch list — call them,
  do not modify them. Manual QA of Tasks 1 & 2 is still tracked as open (UAT-001/002).

### Dashboard / Analytics (tab `analytics`)
- **Purpose.** Charts, pivots, and demand trend views over historical data.
- **Maturity.** Mature.
- **Watch items.** Not touched by the BOM/Basket conversation. **[needs verification of
  current analytics function names if a future sprint touches this tab.]**

---

## 4. Master Data / Item Model

The item editor (`openEditItem`) renders the modal as a stack of collapsible `_sec(...)`
sections. Confirmed sections, in order:

1. **Identity** (🟢 ข้อมูลหลัก) — `sku`, `name`, `barcode`, `description`, and the
   classification flags below.
2. **Counting & Units** (📐 หน่วยและการนับ) — the unit ladder (see §5).
3. **Basket Profile** (🧺 ข้อมูลตะกร้า) — renders `_bomRenderBasketProfile(it)`. The home
   for all basket setup (see §7).
4. **Egg Profile** (🥚 ข้อมูลไข่) — `is_egg`, `primary_grade`, `secondary_grade`,
   `min_primary`, `egg_content_type` (see §6).
5. **BOM / สูตรผลิต** (🧪 BOM / Production formula) — renders
   `_bomRenderItemEditSection(it)` (see §8).
6. **External References / Legacy Customer Mapping** (🔗) — partner/customer item codes.
7. **System / Audit** (🛠 ระบบ / ข้อมูลย้อนหลัง) — audit fields; the legacy
   `basket_type` field appears here, only for PACKAGING-basket items, as optional
   reference metadata.

**Item classification fields (confirmed in master data):**
- **Identity** — `sku`, `name`, `barcode`, `description`, `id`.
- **`item_role`** — e.g. `FG` (finished good), `WIP`, `PACKAGING`. Drives BOM
  visibility and basket-candidate selection.
- **`item_type`** — a subtype within a role; e.g. PACKAGING items use
  `item_type = "basket"` to mark a physical basket SKU.
- **Sellable / producible behavior** — `is_sellable`, `is_producable`, `is_egg`,
  `is_consumable`, `is_placeholder`, `is_active`.
- **Counting & Units** — `units.*` (see §5) plus the top-level `selling_unit`.
- **Egg Profile** — `is_egg`, `primary_grade`, `secondary_grade`, `min_primary`,
  `egg_content_type`.
- **Basket Profile** — `units.has_basket_unit`, `units.base_per_basket`,
  `units.basket_unit`, and the basket component inside `bom.components`.
- **BOM / สูตรผลิต** — `bom.enabled`, `bom.components[]`, `bom.routes[]`, `bom.notes`,
  `bom.output_unit`, `bom.no_bom_required` (legacy).
- **Technical / Legacy** — `basket_type`, `partner_id`, `partner_item_number`, audit
  timestamps.

**How the sections work together.** Counting & Units defines the conversion ladder.
Egg Profile and Basket Profile are *upstream sources* that feed the BOM section: the BOM
component table is computed, not free-typed. Egg lines come from Egg Profile; the basket
line comes from Basket Profile; other (packaging) lines come from BOM Setup / import.
The BOM section is therefore a **read-and-verify view over the other sections** plus its
own manual components.

---

## 5. Unit Conversion Model

Items carry a structured unit ladder in `item.units`:

- **`base_unit`** — the smallest counting unit (for eggs, `ฟอง`).
- **`pack_unit`** + **`base_per_pack`** — a pack level; `base_per_pack` is the integer
  count of base units per pack. `pack_unit` is a *label* (e.g. `"แพ็ค 10"`); the actual
  conversion is the integer `base_per_pack`.
- **`storage_unit`** + **`base_per_storage`** — a storage/pallet level (legacy
  `palette_unit` migrates here at runtime).
- **`basket_unit`** + **`base_per_basket`** + **`has_basket_unit`** — the basket level
  (see §7).
- **`selling_unit`** (top-level on the item, not under `units`) — the unit the SKU is
  sold/ordered in. **Confirmed rule: the production / output unit currently equals
  `selling_unit`** — one output unit = one selling unit. The BOM is "inputs per 1
  output (selling) unit".

**Canonical helper functions (use these — do not re-derive):**
- `normalizeItemUnits(item)` — returns a normalized `units` object. It infers
  `has_basket_unit` / `has_consumable_unit` from legacy data **only when the flag key is
  absent**; an explicit `false` is always respected. It also forces a clean
  `basket_unit = "ตะกร้า"` when basket is active.
- `getSellingUnitBaseFactor(item)` — base units per 1 selling unit, resolved against
  base / pack / basket. Returns `null` if the selling unit is none of those.
- `convertSellingQtyToBase(item, qty)` — selling-unit qty → base units.
- Related: `getBaseFactorForUnit`, `getItemUnitChoices`, `getSellingUnitChoices`,
  `convertQtyToBase`.

**Critical rule.** Do **not** read a top-level `item.base_per_pack` as a source of
truth. The real conversion lives under `item.units.*` and must be read via
`normalizeItemUnits` and the helpers above. A SKU may legally have
`pack_unit = "แพ็ค 10"` with `base_per_pack = 12` — the label and the integer can
disagree, and the integer wins.

---

## 6. Egg Profile & Egg BOM Logic

**Egg Profile drives egg BOM lines.** For an egg item (`is_egg !== false`), the egg
component lines in the BOM are *computed from* the Egg Profile fields — they are not
typed by hand.

**Egg lines are locked in the BOM.** In the component table, egg lines are rendered as
non-editable (`editable: false`, source `egg_profile`). To change them, the operator
edits the Egg Profile, not the BOM table.

**Single-grade SKU behavior.** A SKU with only a `primary_grade` produces a single egg
requirement line for that grade.

**Mixed SKU behavior.** A SKU with a `primary_grade` + `secondary_grade` (or
`egg_content_type = GRADED_MIX`) produces **two** egg lines: a **primary-minimum** line
and a **secondary-balance** line.

**`min_primary` semantics.** `min_primary` is the **minimum share of the primary grade**
in a mixed SKU (a percentage, e.g. `40` = at least 40% primary). The egg-split code
guards against the legacy fractional convention: a stored value `<= 1` is read as a
fraction (0.4 → 40%).

**Egg BOM is a minimum planning requirement, not a final physical allocation.** The egg
lines express the *minimum* raw-egg demand for planning. They do not represent the exact
physical eggs that will be pulled from stock.

**Larger eggs may substitute for smaller labels — later.** Business rule: a larger egg
grade can be used in place of a smaller-labelled one. The current BOM *notes* this
("ใช้เบอร์ใหญ่แทนได้") via `_bomLargerSizesLabel`, but **no automatic substitution and no
stock allocation is implemented yet.**

**Key functions.** `calculateEggSourceRequirements`, `splitBaseEggsByGrade`,
`calculateEggOutputTargets`, `calculateEggRequirementFromItem`, `_bomEggGradeLabel`,
`_bomLargerSizesLabel`.

---

## 7. Basket Profile & Basket BOM Logic

This is the **final basket model** after Task 8C-2E (2026-05-25).

**Basket Profile is the basket setup home.** All basket configuration — the active
switch, the conversion, and the chosen basket SKU — lives in the Basket Profile section
(`_bomRenderBasketProfileBody`). It is rendered inside the item editor and re-renders
live on field change.

**"Uses basket" is the active switch.** The basket is **active only when**
`normalizeItemUnits(it).has_basket_unit === true`. This single flag governs everything.
An explicit `false` is respected — `base_per_basket` alone does **not** reactivate a
basket the operator switched off.

**If "Uses basket" is ON:**
- A basket line appears in the BOM component table.
- Its quantity **recalculates from the current `selling_unit` and `base_per_basket`** —
  it is conversion-derived, never a stale stored number.

**If "Uses basket" is OFF:**
- The active basket line disappears from the BOM component table and from Test
  Calculation.
- Any stored basket component is **preserved but inactive** — it stays in
  `bom.components`, untouched, and the Basket Profile shows a small "preserved but
  inactive" note.
- BOM status does **not** fail because basket data is incomplete or absent.
- Re-checking "Uses basket" brings the stored basket SKU back as an active line and
  recomputes its quantity.

**Basket quantity comes from the FG basket conversion.** Quantity = base units per
selling unit ÷ `base_per_basket`, computed by `calculateBasketRequirementFromItem`.
Example: selling unit `ฟอง`, `base_per_basket` 180 → 1/180 basket per output;
selling unit `ถาด` with `base_per_pack` 30, `base_per_basket` 180 → 30/180 = 0.1667.

**Actual basket SKU comes from a selected PACKAGING + basket item.** The Basket Profile
has a dropdown of candidate items — those with `item_role = "PACKAGING"` and
`item_type = "basket"` (`_bomBasketCandidateItems`). Selecting one calls
`_bomSelectBasketSku`, which creates/updates the single basket component in
`bom.components`.

**The BOM line unit comes from the selected basket SKU master.** `_bomResolveBasketUnit`
resolves the basket component's display unit from the chosen basket Item's
`units.base_unit` (e.g. `ใบ`).

**`basket_type` / details is legacy optional metadata only.** It is reference text on
PACKAGING-basket items (e.g. "CJ - Grey", "S", "M"), shown in the System/Audit section.
It is **not used in BOM logic** and is not part of the main FG BOM flow.

---

## 8. Current BOM UI Model

The item-edit BOM section (`_bomRenderItemEditSectionBody`) renders, in order:

1. **BOM status block** — binary, hard-gated Enable (see below).
2. **Output / ผลิตอะไร** — `_bomRenderItemOutputSection`: the output basis (one output
   unit = one selling unit) with a warning box if the conversion cannot resolve.
3. **Components / ใช้อะไรบ้างต่อ 1 หน่วยผลิต** — `_bomRenderItemComponentsTable`: the one
   component table.
4. **Test Calculation / ทดลองคำนวณ** — `_bomRenderItemTestCalc`: enter a test output
   quantity, see computed requirements. The result is **not saved**.
5. **Technical / Legacy details** — `_bomItemAdvancedDetails`: advanced/legacy fields.

**The one component-line model.** The BOM is "the required inputs to make 1 output
unit." `buildBomComponentLinesForItem(item)` produces a normalized array of lines; each
line has:
- **component type** — egg / packaging_basket / basket_qty / packaging.
- **component / item** — name + SKU.
- **qty per output** — quantity required per 1 output unit.
- **unit**.
- **source** — where the line comes from.
- **status / where to edit** — a needs-review badge + a note pointing at the section
  that owns the line.

**Sources of lines:**
- **Egg Profile** — egg lines (`source: egg_profile`).
- **Basket Profile** — the basket line (`source: basket_profile`).
- **BOM Setup / Imported** — manual or imported packaging lines (`source: bom_setup`).
- **Technical / Legacy** — surfaced in the advanced section.

**Line behavior:**
- **Egg lines are locked** — edit the Egg Profile to change them.
- **The basket line is controlled by Basket Profile** — it is read-only in the BOM table;
  the basket SKU and conversion are edited in Basket Profile.
- **Future packaging lines (tray / cover / label / sticker / pack) will be editable** —
  a manual packaging-component editor is not built yet.

**Binary hard-gated BOM status (Task 8B-UI-4).** BOM "enabled" is a single checkbox that
can only be ticked when `_bomItemReadiness(it)` passes every check: the selling unit and
base conversion resolve, basket conversion resolves *if* the basket is active, there is
at least one BOM line, and no line needs review. When readiness fails, the checkbox is
disabled and a checklist shows what to fix. This replaced an earlier 3-way Draft / Done
status — there is intentionally **no Draft state**; BOM is all-or-none.

---

## 9. What We Completed in This Conversation

A chronological summary of the BOM/Basket stabilization conversation.

### Phase A — BOM direction
- Chose a **one-by-one** BOM-setup approach (configure SKUs individually) before any
  bulk upload.
- Decided the **egg requirement is derived from the Egg Profile**, not typed into the BOM.
- Decided the **actual basket must be selected as a material item** (a PACKAGING SKU),
  not free text.

### Phase B — Unit and Item Master cleanup
- Clarified the unit-conversion logic and the `units.*` ladder.
- Separated **basket conversion** (the quantity math) from **basket type** (a label).
- Later de-emphasized `basket_type` / details as legacy, optional metadata.

### Phase C — Controlled Lists
- Confirmed current master values should be **added into `option_sets`** (add-only).
- Confirmed Controlled Lists must **not invalidate data already in use**.

### Phase D — Egg BOM
- Built the item-level egg preview / egg component lines.
- Implemented mixed-egg handling driven by `min_primary` (primary minimum + secondary
  balance).
- Established egg BOM as a **minimum planning requirement**.
- Confirmed **no stock allocation** is done yet.

### Phase E — Basket BOM
- Established **basket conversion = the quantity logic**.
- Established the **basket SKU = a selected PACKAGING item**.
- Created the dedicated **Basket Profile** section.
- Fixed the basket **active-state** model (Task 8C-2E).

### Phase F — BOM UI model
- Rejected an earlier "BOM Rule vs BOM Components" two-table idea.
- Moved to a **single component-line model**.
- Moved **Test Calculation to after** the setup sections.

### Phase G — Bugs fixed
- **Live recompute** from the current (unsaved) form values (`_bomLiveRecompute`,
  Task 8C-2B).
- **Basket unit** taken from the selected basket SKU master (`_bomResolveBasketUnit`).
- **`basket_type` / details** moved to legacy / System-Audit.
- **Changing selling unit away from basket** fixed — basket qty now recalculates instead
  of failing (Task 8C-2E; closed bug UAT-041).
- **"Uses basket" OFF** fixed — an inactive basket no longer fails BOM (Task 8C-2E).
- **Stored basket component preserved but inactive** when basket is off.
- (Earlier, related) the "Uses basket" checkbox reading the raw vs normalized flag
  (Task 8C-2C; closed bug UAT-040).

### Phase H — QA gate (2026-05-25)
- **67 / 67 functional assertions passed.**
- **Zero confirmed bugs.**
- **No code changed during QA** (`app/index.html` MD5 identical before/after).
- A regression diff confirmed all recent changes are confined to the item-edit modal
  and BOM module.
- A short human browser smoke is **recommended** if not already done.
- Full run: `_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md`.

---

## 10. Current Known Issues / Watch Items

**Process / QA**
- **Human browser smoke status: unknown / [needs verification].** The 2026-05-25 QA
  gate was a static + logic-level run; a live-browser pass (boot, console, click each
  tab) is recommended before final closeout.
- No automated regression test suite exists (UAT-007, 🟡 Medium, open). QA is manual +
  static.

**Code-hygiene watch items (confirmed in `BUG_LOG.md`)**
- **Dead / unreferenced old BOM preview functions may remain** — UAT-037 lists an
  orphaned 8B-UI render chain (`_bomRenderEggBasketSection`, `_bomRefreshEggBasketPreview`,
  etc.). Left defined, harmless, per project convention.
- **Unused vars in `openEditItem`** — UAT-039 (`_basketUnitRaw` / `_basketUnitClean`).
- **Legacy `bom.no_bom_required`** — UAT-038: the field persists but is no longer
  settable in the UI; `validateMasterItem` still reads it.
- **Some legacy basket fields exist but are de-emphasized** — `basket_type`,
  `source_basket_type` on components; component shape differs between basket components
  and Task-4 egg/packaging components (UAT-035).
- **BOM Bulk Upload importer deprecated** — `parseBomWorkbook` / `_bomApplyCommit`
  (the "🧪 BOM Bulk Upload" button) is deprecated as of 2026-05-25 (UAT-049 /
  Task 10C). Use the manual Master Data item editor for new packaging SKUs. UAT-014
  and UAT-015 are moved from `open` to `deprecated-path`.

**Data watch items**
- **Items corrupted during the earlier basket bug may need a manual re-tick.** If an
  operator saved an item while bug UAT-040 was live, its `has_basket_unit` may be an
  explicit `false`; the operator re-ticks "Uses basket" once to restore it. No automatic
  data migration was done.

**Feature-integration watch items**
- **Daily Plan BOM (`renderPlanBom`) still uses older logic** and is a separate code
  path from the new item-level component-line model. Integrating the two is a future
  sprint.
- `renderPlanBom` conversion concern — UAT-016 (🟡 Medium, open).
- localStorage quota pressure as data grows — UAT-011 (🟡 Medium, open).

**Not built yet (confirmed scope gaps)**
- Full packaging BOM editor.
- Tray / cover / label / sticker / pack components.
- Bulk upload for BOM components.
- Inventory deduction.
- Lot selection.
- Production route selection.
- Substitution allocation (larger-egg substitution is noted, not automated).

---

## 11. Manual QA Checklist for Next Chat

A concise smoke to run in a browser before and after any new BOM sprint:

1. Boot the app (open `app/index.html`).
2. Check the browser console — no red errors.
3. Open **Orders** — renders normally.
4. Open **Daily Planning** — renders normally.
5. Open **Daily Plan BOM** (Daily Planning → BOM sub-tab) — renders normally.
6. Open **Master Data** — renders normally.
7. Open **Controlled Lists** — renders normally.
8. Open **Logistics** — renders normally.
9. Open **ใบน้อย** (Daily Planning → ใบน้อย sub-tab) — renders normally.
10. Open an **FG egg SKU** — egg lines appear in BOM.
11. Open a **mixed egg SKU** — primary-minimum + secondary-balance lines appear.
12. Open an **FG basket SKU** — Basket Profile shows "Uses basket" checked, a basket line appears.
13. **Toggle "Uses basket"** off then on — basket line disappears then reappears; BOM does not error when off.
14. **Change the selling unit** on a basket SKU — basket quantity recalculates.
15. Confirm the **BOM recalculates** live without closing/reopening the modal.
16. **Save and reopen** an item — no data loss.

Also confirm the **Backup / Restore UI** (header strip ⬇ Backup now / ↻ Restore) is present.

---

## 12. Files / Functions / Closeouts Referenced

**Files**
- `app/index.html` — the working system (MD5 `d340f2521bb7f759e00e9021d829c012`).
- `docs/BUG_LOG.md` — the living bug list (36 open rows; UAT-022/040/041 closed).
- `docs/QA_CHECKLIST.md` — the regression checklist; Section K is the regression gate.
- `docs/DEVELOPMENT_WORKFLOW.md` — the 10 rules of engagement.
- `docs/DEV_HANDOVER_2026-05-18.md` — earlier handover (Master Data contracts).
- `_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md` — the latest QA gate run.
- `_archive/closeouts/` — recent BOM/Basket task closeouts (see below).
- `_archive/closeouts-2026-05-18/` — stabilization Task 1/2/3 closeouts + the
  `UAT_PRO_STABILIZATION_PLAN.md`.
- `_archive/index-pre-*.html` — rollback snapshots, one per task.
- `oms-production/` — the **parked** production rewrite; do not touch.

**Key functions**
- Unit model: `normalizeItemUnits`, `getSellingUnitBaseFactor`, `convertSellingQtyToBase`,
  `getBaseFactorForUnit`, `getItemUnitChoices`, `getSellingUnitChoices`.
- Egg BOM: `calculateEggSourceRequirements`, `splitBaseEggsByGrade`,
  `calculateEggOutputTargets`, `calculateEggRequirementFromItem`, `_bomEggGradeLabel`,
  `_bomLargerSizesLabel`.
- BOM component model: `buildBomComponentLinesForItem`, `_bomItemReadiness`,
  `_bomRenderItemComponentsTable`, `_bomRenderItemOutputSection`,
  `_bomRenderItemTestCalc`, `_bomRenderItemStatusBlock`, `_bomRenderItemEditSection` /
  `_bomRenderItemEditSectionBody`, `_bomRecheckItemBom`.
- Basket: `_bomRenderBasketProfile` / `_bomRenderBasketProfileBody`,
  `_bomBasketProfileStatus`, `_bomBasketComponents`, `_bomBasketCandidateItems`,
  `_bomResolveBasketUnit`, `_bomSelectBasketSku`, `calculateBasketRequirementFromItem`,
  `_bomLiveRecompute`, `_bomRefreshBasketProfile`.
- Item editor: `openEditItem`, `_readEditForm`, `saveEdit`, `normalizeMasterRecord`,
  `validateMasterItem`.
- Daily Plan BOM: `renderPlanBom` (separate, older code path).
- Persistence / backup: `safeSet`, `safeSetLastSave`, `listAllBackups`,
  `restoreFromBackup`, `persistMasterV3`, `renderHeaderStrip`.
- Controlled Lists: `ensureMasterOptionSets`, `reconcileControlledListsFromMasterData`,
  `getOptionSet`, `getOptionLabel`, `_v3SyncControlledLists`.

**Closeouts (evidence base)**
- `_archive/closeouts/UAT_TASK8BUI_BOM_ITEM_UI_CLOSEOUT.md` — one component-line model.
- `_archive/closeouts/UAT_TASK8BUI2_BOM_UI_SIMPLIFY_CLOSEOUT.md` — UI simplification.
- `_archive/closeouts/UAT_TASK8BUI3_BOM_BASKET_QTY_SOURCE_CLOSEOUT.md` — conversion = qty source.
- `_archive/closeouts/UAT_TASK8BUI4_BOM_READINESS_GATE_CLOSEOUT.md` — binary hard gate.
- `_archive/closeouts/UAT_TASK8C1_BASKET_SKU_SELECTION_CLOSEOUT.md` — basket SKU selector.
- `_archive/closeouts/UAT_TASK8C2_BASKET_PROFILE_CLOSEOUT.md` — Basket Profile section.
- `_archive/closeouts/UAT_TASK8C2R_BASKET_UNIT_CLOSEOUT.md` — basket unit from SKU master.
- `_archive/closeouts/UAT_TASK8C2B_LIVE_RECOMPUTE_CLOSEOUT.md` — live recompute.
- `_archive/closeouts/UAT_TASK8C2C_BASKET_FLAG_FIX_CLOSEOUT.md` — has_basket_unit fix (UAT-040).
- `_archive/closeouts/UAT_TASK8C2E_BASKET_ACTIVE_STATE_CLOSEOUT.md` — active-state fix (UAT-041).
- `_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md` — the QA gate.

---

## 13. Safe Handoff Notes for Next Chat

Direct instructions for the next AI / developer working on this app:

- **Do not start by refactoring.** The single-file structure is intentional and
  load-bearing. Work with it, not against it.
- **Do not rebuild BOM from scratch.** The one-component-line model is the agreed
  design and is working. Extend it; do not replace it.
- **Preserve the UAT working flow.** Operators rely on this build daily. Boring and
  reversible beats clever and one-shot.
- **Treat Basket Profile as the source of basket setup.** All basket configuration
  (active switch, conversion, SKU) is owned by Basket Profile.
- **Treat Egg Profile as the source of egg lines.** Egg BOM lines are derived; they are
  locked in the BOM table.
- **Use the one component-line model.** `buildBomComponentLinesForItem` is the canonical
  producer of BOM lines — read from it; do not invent a parallel model.
- **Always inspect current code before editing.** The file is ~25k lines; grep for the
  exact function, read it, then plan exact-string edits. Do not fuzzy-match.
- **Use surgical edits with backups.** Back up `app/index.html` to
  `_archive/index-pre-<short>-YYYYMMDD.html` before any edit; apply anchored
  exact-string replacements that abort on any mismatch.
- **Run static checks and QA after each sprint.** `node --check` each inline script
  block, confirm brace/paren/bracket balance is unchanged, run an acceptance harness,
  and write a closeout report (sections A–H).
- **Do not touch Orders / Daily Planning / Logistics / ใบน้อย / Controlled Lists / PO
  parsers unless a task explicitly scopes them.** The recent BOM work was deliberately
  confined to the item-edit modal and the item-edit BOM module — keep that discipline.
- **Do not touch `oms-production/`.** It is a parked, frozen production rewrite.
- **Do not extend the BOM Bulk Upload importer** (`parseBomWorkbook` / `_bomApplyCommit`,
  the "🧪 BOM Bulk Upload" button). It is **deprecated** as of 2026-05-25 (Task 10C /
  UAT-049). It is a Phase 0–1 sketch with known data-loss behaviour on FG re-import
  (UAT-014) and a legacy two-sheet only schema (UAT-015), and it writes to
  `bom_material.{group, subgroup, family}` — a shape that no BOM UI currently reads.
  For new packaging SKUs use the **manual Master Data item editor** — it exposes the
  full unit model (base / pack / basket / storage / consumable + conversions). Existing
  items imported via the legacy path remain valid; do not rewrite them. If real bulk
  packaging-SKU import volume appears later, design a fresh additive item importer.
- **Use the existing helpers — do not reimplement them.** `safeSet`,
  `normalizeItemUnits`, `getSellingUnitBaseFactor`, `getOptionSet`, etc. are the
  contracts. Call them; do not fork them.
- **Log new risks in `docs/BUG_LOG.md`** the moment they are spotted, rather than
  silently fixing or ignoring them.

---

*End of handover. This document is a snapshot dated 2026-05-25; verify any
**[needs verification]** item and the live `BUG_LOG.md` before relying on it.*
