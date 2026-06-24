EggGrade OMS / ERP — UAT → Production Handover Package
=======================================================

Package version : 1.0
Built           : 2026-05-26
Audience        : CTO · tech lead · FE · BE · DB · QA · product/ops owner

This zip is self-contained. Unzip anywhere; no installation needed.

────────────────────────────────────────────────────────────────────────
HOW TO READ THIS PACKAGE
────────────────────────────────────────────────────────────────────────

Start here:
   docs/production_handover/PRODUCTION_HANDOVER_EGGGRADE_OMS.md
       (master index · audience-to-document map · category boundary)

Then by role (full guidance in the master index § 1):

   CTO / tech lead     →  PRODUCTION_HANDOVER → PRODUCTION_ROADMAP
                          → LOGIC_BASE_SPEC § 1, § 2
                          → presentation deck slides 1–18
   Frontend dev        →  UI_BASIS_WITH_SCREENSHOTS  (end-to-end)
                          → LOGIC_BASE_SPEC § 5–§ 9
                          → TESTING_SCENARIOS Flow 1–10
   Backend dev         →  LOGIC_BASE_SPEC  (end-to-end)
                          → PRODUCTION_ROADMAP § "Service & API surface"
   DB / DBA            →  LOGIC_BASE_SPEC § 5, § 6, § 7, § 8, § 10
                          → DEV_DATA_TEST_PACKAGE_README
   QA tester           →  TESTING_SCENARIOS_AND_USER_FLOWS
                          → docs/supporting/QA_CHECKLIST.md
   Product / Ops owner →  UI_BASIS_WITH_SCREENSHOTS
                          → LOGIC_BASE_SPEC § 2
                          → PRODUCTION_ROADMAP

────────────────────────────────────────────────────────────────────────
PACKAGE LAYOUT
────────────────────────────────────────────────────────────────────────

  app/
    index.html                                      THE UAT working system (~1.6 MB, 26,113 lines)
                                                    Open in a browser to run. No build step needed.

  data/
    demand_master_v3_corrected_v5_20260521.json     Latest corrected master (use this as the seed)
    demand_master_v3.json                           Earlier master snapshot (kept for reference)
    Master_Packaging_SKUs_upload.xlsx               Packaging SKU import sample

  docs/production_handover/                         The 8-file handover package
    PRODUCTION_HANDOVER_EGGGRADE_OMS.md             ← START HERE (master index)
    LOGIC_BASE_SPEC.md                              Business logic, 15 sections
    UI_BASIS_WITH_SCREENSHOTS.md                    13 UI sections + screenshot checklist
    TESTING_SCENARIOS_AND_USER_FLOWS.md             10 flows + acceptance tests
    DEV_DATA_TEST_PACKAGE_README.md                 Test data file plan per tab
    PRODUCTION_ROADMAP.md                           6-phase migration plan
    DEV_HANDOVER_PRESENTATION_OUTLINE.md            31-slide outline
    EggGrade_OMS_Production_Handover.pptx           Actual 31-slide briefing deck

  docs/supporting/                                  Source-of-truth references
    BUG_LOG.md                                      Living bug list (36 open · 3 closed)
    QA_CHECKLIST.md                                 Regression gate template
    DEVELOPMENT_WORKFLOW.md                         10 rules of engagement
    DEV_HANDOVER_2026-05-25.md                      Most recent dev handover
    DEV_HANDOVER_2026-05-18.md                      Master Data contracts
    CHANGELOG.md                                    Per-UAT history

  qa_evidence/                                      Most recent QA gate runs
    20260525-bom-basket-qa-gate.md                  67/67 PASS, zero confirmed bugs
    20260521-bom-eggbasket.md                       Earlier gate

  closeouts_recent/                                 BOM stabilization series (Tasks 8B-UI to 10B)
    UAT_TASK8BUI_*  · UAT_TASK8C*_*  · UAT_TASK9_*  · UAT_TASK10*

────────────────────────────────────────────────────────────────────────
BUILD FINGERPRINT
────────────────────────────────────────────────────────────────────────

   app/index.html MD5                              193180d9008557d8d53a954b5e36a88e
   app/index.html lines                            26,113
   PARSER_VERSION                                  13
   BUILD_ID                                        build 2026-05-07 06:59:43

   demand_master_v3_corrected_v5_20260521.json MD5 40596f6038ebcee06f69e645da81e8fc
   master record counts                            customers=28 · sites=155 · items=130 · option_sets=0

   QA gate (most recent)                           67 / 67 PASS · 0 confirmed bugs
   Open bugs (BUG_LOG)                             36 (2 medium · 0 blocker)

────────────────────────────────────────────────────────────────────────
HOW TO RUN THE UAT (no install)
────────────────────────────────────────────────────────────────────────

  1. Open app/index.html directly in Chrome / Firefox / Safari
     (double-click; no server needed)
  2. To load the master data the first time:
     - Open the app
     - Go to "Data & settings" tab
     - Use the master JSON import (Import master)
     - Select data/demand_master_v3_corrected_v5_20260521.json
  3. To back up your current state:
     - Header strip → "⬇ Backup now" button → save the .json file
  4. To restore:
     - Header strip → "↻ Restore from file…" → pick the backup .json

────────────────────────────────────────────────────────────────────────
WHAT'S NOT IN THIS PACKAGE
────────────────────────────────────────────────────────────────────────

  - oms-production/    (the parked NestJS+Prisma+React scaffold; intentionally
                        excluded — see PRODUCTION_ROADMAP.md § 2 if you decide
                        to re-baseline it)
  - _archive/index-pre-*.html  (per-task rollback snapshots, ~50 MB; not needed
                                for production handover)
  - Operator's runtime localStorage data
                       (export from a live browser via "⬇ Backup now"; see
                        DEV_DATA_TEST_PACKAGE_README § 6.2 for procedure)
  - Screenshots of the live UAT
                       (capture from a browser per UI_BASIS_WITH_SCREENSHOTS
                        § 15 Screenshot Capture Checklist)

────────────────────────────────────────────────────────────────────────
NEXT FIVE ACTIONS FOR THE DEV TEAM
────────────────────────────────────────────────────────────────────────

  1. Read docs/production_handover/PRODUCTION_HANDOVER_EGGGRADE_OMS.md
  2. Capture screenshots per UI_BASIS § 15 (~15 min in a browser)
  3. Generate dev test data CSVs per DEV_DATA README § 6–7
  4. Re-run the QA gate against the current app/index.html MD5
  5. Decide on oms-production/ re-baseline vs fresh start (DECISION-01)

No edits to app/index.html are required for any of these.
