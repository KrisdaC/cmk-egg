# 03_notes — the paper trail

## What's here

```
docs/             ← living docs (BUG_LOG, CHANGELOG, DEV_HANDOVER, WORKFLOW, QA_CHECKLIST)
closeouts/        ← one .md per sprint since 2026-05-26 (10C → 13A-3)
harnesses/        ← Node vm acceptance harnesses (.js, runnable with plain node)
```

## Reading order

1. **First:** `docs/DEV_HANDOVER_2026-05-25.md` — most recent
   technical handover (covers the BOM editor + Task 7C-2 role/behavior
   preset, BOM math invariants, Packaging Profile contract).
2. **Then:** `docs/DEVELOPMENT_WORKFLOW.md` — the 10 rules of
   engagement.
3. **Then:** `docs/BUG_LOG.md` — open / deprecated-path rows. UAT-049
   is the canonical BOM Bulk Upload deprecation policy.
4. **Then:** the closeouts under `closeouts/` in **task-number order**
   (10C → 11B → 11C → … → 13A-3). Each is self-contained, sections
   A–H, with pre/post MD5 and rollback command.
5. **Then:** the harnesses under `harnesses/` if you want to verify
   any sprint's contract end-to-end.

## How a sprint closeout is structured

Every closeout in this directory follows the same shape:

```
A. Backup            — backup path + MD5 + rollback command
B. Sections changed  — list of touched functions and UI areas
C. ...               — sprint-specific
D./E./F. — Preservation / Safety / What did not change
G. QA / smoke        — node --check + acceptance harness results
H. Final verdict     — "ready for UAT testing"
```

Read § B for the diff scope and § G for the test evidence. § D/E/F
spell out what was deliberately NOT touched (so you can audit
preservation guarantees).

## Running the harnesses

```bash
cd /path/to/checkout
node 03_notes/harnesses/UAT_TASK13A3_cases_harness.js
```

All harnesses read `app/index.html` relative to the checkout root.
Plain `node` (v22+) — no npm install needed.

## Living docs vs closeouts

- **`docs/BUG_LOG.md`** is the canonical open-bug list. Closeouts may
  recommend updates here; the operator applies them after manual QA
  passes.
- **`docs/CHANGELOG.md`** (if present) is the per-UAT release log.
- **The closeouts are immutable** once written — they're the receipt
  for each sprint.
