# EggGrade OMS — UAT → Production Handover (Master Index)

> **Document set version:** 1.0 · **Date issued:** 2026-05-26
> **Source build under test:** `app/index.html` — MD5 `193180d9008557d8d53a954b5e36a88e`, 26,113 lines, ~1.6 MB
> **Globals:** `PARSER_VERSION = 13`, `BUILD_ID = "build 2026-05-07 06:59:43"`
> **Latest QA gate:** `_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md` — **67 / 67 PASS · zero confirmed bugs**

---

## 0. How to read this package

This is the **production handover** for the EggGrade OMS / CMK ไชยมงคล Egg ERP system. The current UAT (in `app/index.html`) is the **source of truth for business logic, UX, and workflow validation**. It is **not** the source of truth for production architecture — the production dev team must re-implement the system on a proper backend while preserving the validated UAT behavior.

Every claim in this package is tagged into one of four explicit categories. The categories are never mixed inside a single bullet, table row, or rule.

| Tag | Meaning |
|---|---|
| **[UAT-Confirmed]** | The behavior is built into the UAT and verified by a QA gate run or a task closeout. The production system must preserve it. |
| **[Prod-Recommendation]** | A specific recommendation for how the production dev team should implement the area — architecture, framework, schema, or rollout. The UAT does not currently work this way. |
| **[Future-Feature]** | Designed and documented but not built in the UAT yet. Not blocking for production MVP unless the roadmap puts it there. |
| **[Needs-Verification]** | A statement that could not be confirmed against the UAT files at handover time. The dev team must verify in a browser, console, or with a SME before relying on it. |

If you see a sentence without one of these tags it is reference / orientation material, not a behavioral claim.

---

## 1. Audience and entry points

This package is written for six roles. Each role has a recommended reading order.

**CTO / Tech lead.** Read in order: this index → `PRODUCTION_ROADMAP.md` → `LOGIC_BASE_SPEC.md` § 1 (Logic Executive Summary) and § 2 (End-to-End Business Flow) → `DEV_HANDOVER_PRESENTATION_OUTLINE.md` (skim slide 1–15). Use the roadmap to set milestones and the logic spec to set acceptance criteria.

**Frontend developer.** Read `UI_BASIS_WITH_SCREENSHOTS.md` end-to-end, then `LOGIC_BASE_SPEC.md` § 5–§ 9 (unit, egg, basket, BOM, daily plan BOM logic), then `TESTING_SCENARIOS_AND_USER_FLOWS.md` (Flows 1–10). The UAT HTML file (`app/index.html`) is the visual + interaction reference — open it in a browser side-by-side with the UI doc.

**Backend developer.** Read `LOGIC_BASE_SPEC.md` end-to-end, then `PRODUCTION_ROADMAP.md` § "Service & API surface" and § "Persistence model". The UAT's `MASTER_V3` localStorage shape is the model contract for now (Master Data, Items, Option Sets); the production database must be able to round-trip that shape during migration.

**Database developer.** Read `LOGIC_BASE_SPEC.md` § 5 (Unit Conversion), § 6 (Egg Profile), § 7 (Basket Profile), § 8 (BOM), then `DEV_DATA_TEST_PACKAGE_README.md` to understand the per-tab test data shape. Use those two documents to draft the relational schema.

**QA tester.** Read `TESTING_SCENARIOS_AND_USER_FLOWS.md` end-to-end, then `UI_BASIS_WITH_SCREENSHOTS.md` (for screen-level acceptance), then this index's "Key Documents" section. The existing `docs/QA_CHECKLIST.md` is the regression gate template; copy it per release.

**Product owner / operations owner.** Read `UI_BASIS_WITH_SCREENSHOTS.md` first (it mirrors what operators see), then `LOGIC_BASE_SPEC.md` § 2 (End-to-End Business Flow), then `PRODUCTION_ROADMAP.md`. Use the testing scenarios as a UAT sign-off worksheet with operators.

---

## 2. Package contents

All paths are relative to the workspace root `/Users/sirap./Documents/CMK/uat-handover/`.

| # | File | Purpose | Audience |
|---|---|---|---|
| 1 | `docs/production_handover/PRODUCTION_HANDOVER_EGGGRADE_OMS.md` | This index — entry point, audience guide, document map | All |
| 2 | `docs/production_handover/LOGIC_BASE_SPEC.md` | Business logic, data flow, status flow, calculation rules, validation rules, source-of-truth-per-module | CTO / BE / FE / DB / QA |
| 3 | `docs/production_handover/UI_BASIS_WITH_SCREENSHOTS.md` | Screen-by-screen UX: user goal, inputs, outputs, validation, mapping to logic | FE / QA / PO |
| 4 | `docs/production_handover/TESTING_SCENARIOS_AND_USER_FLOWS.md` | 10 user flows with Mermaid diagrams and acceptance tests | QA / PO / BE |
| 5 | `docs/production_handover/DEV_DATA_TEST_PACKAGE_README.md` | What test data files the dev team needs, per tab; export plan | BE / DB / QA |
| 6 | `docs/production_handover/PRODUCTION_ROADMAP.md` | Phased migration plan, unfreeze conditions, target stack, risk register | CTO / BE / FE |
| 7 | `docs/production_handover/DEV_HANDOVER_PRESENTATION_OUTLINE.md` | 31-slide outline for live briefing | CTO / PO |
| 8 | `docs/production_handover/EggGrade_OMS_Production_Handover.pptx` | Actual PowerPoint deck — built from the outline | CTO / PO |

---

## 3. Source documents this package is built from

The package is **derived from**, and stays **consistent with**, the following primary documents already in the project. If any of these change after this handover, the package may diverge — re-issue when they do.

| Source | Used as evidence for |
|---|---|
| `app/index.html` | All tab structure, function names, UI strings (read-only inspection) |
| `docs/BUG_LOG.md` | Open bugs (UAT-001..048), closed bugs, known limitations |
| `docs/QA_CHECKLIST.md` | Regression gate sections A–K; copy for each release |
| `docs/DEV_HANDOVER_2026-05-25.md` | Architecture, BOM/Basket model, function inventory |
| `docs/DEV_HANDOVER_2026-05-18.md` | Master Data contracts, unit-conversion rule |
| `docs/DEVELOPMENT_WORKFLOW.md` | 10 rules of engagement, protected do-not-touch list |
| `docs/CHANGELOG.md` | Per-UAT history |
| `_archive/closeouts/UAT_TASK4_BOM_PHASE01_CLOSEOUT.md` | BOM Phase 0–1 foundation |
| `_archive/closeouts/UAT_TASK5_BOM_UNIT_CONVERSION_CLOSEOUT.md` | Unit conversion contract |
| `_archive/closeouts/UAT_TASK6_BOM_ITEM_UX_CLOSEOUT.md` | Item editor UX |
| `_archive/closeouts/UAT_TASK7*_*.md` | Controlled lists / role / type / unit cleanup |
| `_archive/closeouts/UAT_TASK8A*_*.md` | Egg BOM visibility + mixed-egg min/max |
| `_archive/closeouts/UAT_TASK8B*_*.md` | One component-line model, basket BOM |
| `_archive/closeouts/UAT_TASK8C*_*.md` | Basket Profile + active state |
| `_archive/closeouts/UAT_TASK9_BOM_PACKAGING_EDITOR_CLOSEOUT.md` | Packaging materials editor |
| `_archive/closeouts/UAT_TASK10A*_*.md` | Packaging Profile (tray) |
| `_archive/closeouts/UAT_TASK10B*_*.md` | Packaging Profile table / pairing |
| `_archive/closeouts-2026-05-18/UAT_PRO_STABILIZATION_PLAN.md` | Strategic posture, oms-production parking |
| `_archive/closeouts-2026-05-18/MIGRATION_MAP_2026-05-18.md` | Earlier migration mapping |
| `_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md` | Most recent QA gate (67/67 PASS) |
| `_archive/QA_CHECKLIST-RUNS/20260521-bom-eggbasket.md` | Earlier QA gate |
| `demand_master_v3_corrected_v5_20260521.json` | Master Data seed (130 items) |
| `oms-production/STATUS.md` | Parked production scaffold marker |

---

## 4. Category boundary — what each part of the package commits to

**A. Confirmed UAT behavior.** Sections labeled **[UAT-Confirmed]** in `LOGIC_BASE_SPEC.md`, `UI_BASIS_WITH_SCREENSHOTS.md`, and `TESTING_SCENARIOS_AND_USER_FLOWS.md`. Production must replicate these.

**B. Production recommendations.** Sections labeled **[Prod-Recommendation]** in `LOGIC_BASE_SPEC.md` and `PRODUCTION_ROADMAP.md`. These describe *how* to implement, not *what* the system does today.

**C. Future features.** Sections labeled **[Future-Feature]** — designed, not built. Includes dispatch / loaded / delivered quantities, automatic egg substitution, inventory deduction, lot selection, route optimization, Daily Plan BOM integration with the new component-line model, full packaging BOM editor.

**D. Needs verification.** Sections labeled **[Needs-Verification]** — assumed reasonable but not confirmed against the UAT files. The dev team must verify before relying on them.

---

## 5. Top-level system map

The EggGrade OMS supports the daily operations of an egg-packing factory in Thailand. The factory receives purchase orders from large retailers (Makro, BigC, Thaifood) and from independent wholesale customers, packs eggs into branded SKUs, and dispatches by vehicle to multiple delivery sites.

The UAT models five **functional modules** plus shared **master data**:

```
                       ┌─────────────────────────────────────────────┐
                       │              MASTER DATA                    │
                       │  customers · sites · items · option_sets    │
                       │  unit conversions · egg profile · basket    │
                       │      profile · BOM components               │
                       └────────────────┬────────────────────────────┘
                                        │ read
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   ORDERS    │  │  PO INTAKE  │  │ DAILY PLAN  │  │  DAILY PLAN │  │ LOGISTICS / │
│             │  │  / UPLOAD   │  │   DEMAND    │  │     BOM     │  │ ใบน้อย      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │                │
       └────────────────┴───────┬────────┴────────────────┴────────────────┘
                                ▼
                          (operator daily loop)
```

A fuller flow with Mermaid is in `LOGIC_BASE_SPEC.md` § 2 and `DEV_HANDOVER_PRESENTATION_OUTLINE.md` slide 4–5.

---

## 6. Quantity terminology — the canonical glossary

These distinctions are load-bearing for the entire package. **[UAT-Confirmed]** unless noted.

| Term | Meaning | Source / owner | Stage |
|---|---|---|---|
| **PO Qty** | Original quantity on the customer document / HQ PO. | PO intake parsers; immutable after upload. | Order creation |
| **Order Qty** | Operational requested order quantity (customer / store / branch). | Orders module; may differ from PO Qty after adjustment. | Order creation |
| **Planning Qty** | Quantity used for demand and logistics planning. | Daily Plan Demand. May be adjusted operationally. | Demand planning |
| **Confirmed Planning Qty** | Planning Qty after operator confirmation (locked from BOM rollup). | Daily Plan Demand (Confirm action). | Demand → BOM gate |
| **BOM Requirement** | Material / egg / basket / packaging quantity computed from Confirmed Planning Qty using item.bom. | Daily Plan BOM + item BOM model. | Production planning |
| **Dispatch Qty** | Final send decision (may differ from Confirmed Planning Qty after late operations). | **[Future-Feature]** Not built. | Dispatch |
| **Loaded Qty** | Actual quantity loaded onto truck. | **[Future-Feature]** Not built. | Logistics execution |
| **Delivered Qty** | Quantity confirmed received by customer. | **[Future-Feature]** Not built. | Delivery |

The boundary between "Planning Qty" and "Confirmed Planning Qty" is the **rollup gate** — BOM does not read drafts.

---

## 7. Protected do-not-touch surfaces (UAT-side)

Inherited from `docs/DEVELOPMENT_WORKFLOW.md` and the stabilization plan. The production dev team does not need to honor these on the *new* system, but it must preserve their **semantics**:

- Orders status FSM (reason codes, transitions, `isNeedsAttention`).
- Placeholder lifecycle (`_findOrCreatePlaceholderItem`, `resolvePlaceholderItemToExisting`, `cleanupOrphanPlaceholdersAfterTicketDelete`, the unified `deleteInvoiceById`).
- Master Data forms (`openEditCustomer`, `openEditSite`, `openEditItem`) and validators (`validateMasterCustomer/Site/Item`).
- PO upload parsers (`parseMakroPoSheet`, `parseBigCPoXlsx`, `parseThaifoodPoXlsx`).
- `MASTER_V3.option_sets` — read via `getOptionSet` / `getOptionLabel`, never mutated.
- `BUILD_ID`, `PARSER_VERSION` — read-only globals.
- Bangkok-TZ date math (`nowBangkokISO`, `_todayISO`, `_addDays`, all `_fmt*Date*` helpers).
- `safeSet`, `safeSetLastSave`, `listAllBackups`, `restoreFromBackup` — call them, don't modify them.

Full list in `docs/DEVELOPMENT_WORKFLOW.md` rule 8 and in `LOGIC_BASE_SPEC.md` § 1.

---

## 8. Current QA status snapshot

**[UAT-Confirmed]** As of 2026-05-25:

- Latest gate: `_archive/QA_CHECKLIST-RUNS/20260525-bom-basket-qa-gate.md` — 67 / 67 functional assertions PASS, 0 confirmed bugs, no code changed during QA.
- Open bugs in `docs/BUG_LOG.md`: 36 open (mostly 🟢 Low cosmetic / data-quality), 2 🟡 Medium not blocking daily operations, 3 closed (UAT-022, UAT-040, UAT-041).
- Manual browser smoke for stabilization Tasks 1 & 2 still tracked open (UAT-001, UAT-002) — recommended but not blocking.
- Static checks: all 7 inline script blocks `node --check` clean; brace `{}` balanced 6730/6730; bracket `[]` balanced 2397/2397; paren imbalance constant (string/regex literals).

**[Needs-Verification]** The production handover does **not** re-run the QA gate against `app/index.html` MD5 `193180d9...` — the QA gate file referenced is from MD5 `d340f252...`. Between those two builds the line count changed from 25,478 to 26,113. The package treats the recorded gate as the latest functional reference. Production team should request a fresh QA gate before kicking off backend implementation, or treat the delta as a small additive change to be re-tested.

---

## 9. Production recommendation — one sentence

**[Prod-Recommendation]** Re-implement the UAT business logic on a proper backend (PostgreSQL + a TypeScript service layer such as NestJS or Fastify; React or Next.js front-end) — preserving every UAT-confirmed rule in this package — *without* extending `oms-production/` until the two unfreeze conditions in `UAT_PRO_STABILIZATION_PLAN.md` are met. Rebuild the data model from `MASTER_V3` and the BOM model from `buildBomComponentLinesForItem`. Do **not** treat `app/index.html` as production code — treat it as the *executable specification* of the validated behavior. Full rationale and phasing in `PRODUCTION_ROADMAP.md`.

---

## 10. Document map

```
docs/production_handover/
├── PRODUCTION_HANDOVER_EGGGRADE_OMS.md      ← you are here
├── LOGIC_BASE_SPEC.md                        ← business logic, 9 sections
├── UI_BASIS_WITH_SCREENSHOTS.md              ← 13 UI sections, screenshots checklist
├── TESTING_SCENARIOS_AND_USER_FLOWS.md       ← 10 flows + acceptance tests
├── DEV_DATA_TEST_PACKAGE_README.md           ← test data file plan
├── PRODUCTION_ROADMAP.md                     ← phased migration plan
├── DEV_HANDOVER_PRESENTATION_OUTLINE.md      ← 31-slide briefing outline
└── EggGrade_OMS_Production_Handover.pptx     ← actual deck (built from outline)
```

End of master index.
