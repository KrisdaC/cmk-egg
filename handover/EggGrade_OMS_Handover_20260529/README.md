# EggGrade OMS — Handover · 2026-05-29

This package hands over the **EggGrade OMS** (a.k.a. CMK / ไชยมงคล Egg ERP)
UAT working system since the last full handover on **2026-05-26**. The
working system is the single-file HTML app at `01_app/app/index.html`
running on `localStorage` in the operator's browser.

**App at handover time:**
- File: `01_app/app/index.html`
- MD5: `eadbac2a24a6b75e09f05af3cec5c555`
- Lines: 30379
- Size: ~1 MB

---

## 📦 Package contents

```
EggGrade_OMS_Handover_20260529/
├── README.md                ← this file (start here)
├── HANDOVER_NOTES.md        ← what changed since 2026-05-26 (chronological)
│
├── 00_prior_handover/       ← the previous 2026-05-26 handover zips for reference
│
├── 01_app/                  ← THE working system + rollback points
│   ├── README.md            ← how to load + verify
│   ├── app/
│   │   └── index.html       ← the working app — open in a browser
│   └── rollback_points/     ← timestamped pre-edit backups for every sprint since 05-26
│
├── 02_data/                 ← Master Data seed files (operator round-trip files)
│   ├── README.md
│   ├── demand_master_v3.json
│   ├── demand_master_v3_corrected_v5_20260521.json
│   └── Master_Packaging_SKUs_upload.xlsx
│
└── 03_notes/                ← the entire paper trail
    ├── README.md
    ├── docs/                ← BUG_LOG / CHANGELOG / DEV_HANDOVER / WORKFLOW / QA_CHECKLIST
    ├── closeouts/           ← one closeout per Task since 05-26 (10C → 13A-3)
    └── harnesses/           ← Node vm acceptance harnesses
```

---

## 🚀 Quick start (developer)

1. **Open the app.** Drag `01_app/app/index.html` into a fresh Chrome
   profile. Master Data lives in `localStorage` — first load shows
   an empty system.
2. **Seed Master Data.** Master Data → `🔄 Restore Master JSON` →
   pick `02_data/demand_master_v3.json` (or
   `demand_master_v3_corrected_v5_20260521.json` for the corrected
   set). Confirm the count summary; data appears in the items table.
3. **Read the recent state.** Open
   `03_notes/docs/DEV_HANDOVER_2026-05-25.md` (latest dev handover)
   then walk forward through `03_notes/closeouts/` in task-number
   order: 10C → 11B → 11C → … → 13A-3.
4. **Run the headless tests.** From a checkout root with the same
   relative paths, run any of the `03_notes/harnesses/*.js` files
   with Node v22+. The harnesses cite their own MD5 of the app file
   they were authored against.
5. **Roll back if needed.** Every closeout names its
   pre-edit backup in `01_app/rollback_points/`. The format is
   `index-pre-<short-name>-YYYYMMDD.html`. Restore with a single
   `cp`.

---

## 🧭 Where to look first

- **What changed:** `HANDOVER_NOTES.md` (this directory).
- **Bug list:** `03_notes/docs/BUG_LOG.md`.
- **Workflow rules:** `03_notes/docs/DEVELOPMENT_WORKFLOW.md` — 10
  rules of engagement (read rule 8 about `oms-production/` parked
  scaffold).
- **QA gate:** `03_notes/docs/QA_CHECKLIST.md` — Section K is the
  per-build regression.
- **Each sprint's diff/test:** `03_notes/closeouts/UAT_TASK<N>_*`.

The previous handover (in `00_prior_handover/`) is the canonical
starting state. Apply the chronological closeouts from there.

---

## 🔒 Hard constraints carried forward

- **Do not extend** `oms-production/` (parked scaffold).
- **Do not reintroduce** BOM Bulk Upload visible CTA, Supply / Issue
  Unit input fields, duplicate Export All / Import All visible card,
  or the old Master Excel as a primary CTA.
- **Backup the app before every edit** —
  `_archive/index-pre-<short>-YYYYMMDD.html` is the convention.
- **Persistence routes through `safeSet`** — no direct
  `localStorage.setItem` for the eight protected keys.
- **Anchored edits, not fuzzy regex** — the file is 28k+ lines; use
  Python with `assert src.count(old) == 1` before every
  `src.replace`.

---

*Handover prepared 2026-05-29. App MD5 `eadbac2a24a6b75e09f05af3cec5c555`.*
