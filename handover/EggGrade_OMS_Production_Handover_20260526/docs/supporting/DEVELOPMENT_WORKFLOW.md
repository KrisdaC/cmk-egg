# Development Workflow — EggGrade OMS UAT

A short set of rules for working safely on `app/index.html`. Written down so future-you, or anyone helping, doesn't have to re-derive them.

---

## 1. UAT-first

Every new feature lands inside `app/index.html` first. The production scaffold at `oms-production/` is **parked** and must not be extended unless explicitly unfrozen (see `UAT_PRO_STABILIZATION_PLAN.md` § "When to revisit the Factory production stack" for the two specific conditions that should trigger an unfreeze).

If you're about to add a feature in `oms-production/`, stop. Build it in the UAT first, ship it to operators, prove it works for two weeks, then revisit.

---

## 2. Backup before edit · สำรองก่อนแก้

Before any non-trivial edit to `app/index.html`, copy it to `_archive/` with a descriptive name:

```bash
cp app/index.html _archive/index-pre-<short-description>-YYYYMMDD.html
md5sum app/index.html _archive/index-pre-*.html
```

Examples of names that have worked:
- `_archive/index-pre-safeSet-20260518.html`
- `_archive/index-pre-header-strip-20260518.html`

Always verify the MD5 matches **before** you start editing — that's your proof of identical pre-state. Roll back is then `cp _archive/index-pre-…html app/index.html`. No git required.

---

## 3. Small, reversible changes

A good UAT change has all of these properties:

- Single-purpose: one feature or one bug fix per session
- Anchored: every edit replaces an exact string (no fuzzy regex), so it can be re-applied or reverted cleanly
- Additive when possible: new helpers next to existing ones, new HTML inserted rather than replaced
- Doesn't change wire format: existing localStorage keys keep their shape
- Closes in one session: don't leave a half-edited file overnight

If a change has to break one of these, document why in the closeout report.

---

## 4. Run the QA checklist before handover

Every handover snapshot (`cmk-handoff-LATEST.zip`, stakeholder update, ops-team rollout) is gated by a green pass on `docs/QA_CHECKLIST.md`.

How:

1. Copy `docs/QA_CHECKLIST.md` to `_archive/QA_CHECKLIST-RUNS/YYYYMMDD-<short-description>.md`
2. Run through every step in the copy
3. Tick boxes. Add notes for any deviation
4. If any **K-row in Section K fails**, do not ship. Fix or roll back.
5. Commit the completed run alongside the snapshot

---

## 5. Close every feature with a closeout report

Every meaningful UAT change ships with a markdown closeout report at the workspace root (one file per task), following the existing format:

```
A. Files changed
B. Sections / functions changed
C. New helpers added
D. UI changes
E. What was intentionally not changed
F. Manual QA checklist
G. Known risks
H. Final verdict
```

Naming convention: `UAT_TASK<N>_<NAME>_CLOSEOUT.md`.

The closeout doubles as the dev-team handoff note and the operator briefing. It also forces you to articulate the risks, which usually catches the bugs that the static checks missed.

---

## 6. Use BUG_LOG.md for known issues

Don't sit on known issues. The moment a bug or risk is identified:

1. Add a row to `docs/BUG_LOG.md`'s **Open** table
2. Assign a severity (🔴 / 🟠 / 🟡 / 🟢)
3. Write the reproduction steps, even if rough
4. If a workaround exists, document it inline
5. Set Status to `open` until it's actively being investigated

A row in BUG_LOG.md is cheap and stops the same issue being rediscovered four months later. Closed bugs stay in the file (in the **Closed** section) for historical context.

---

## 7. _archive/ is sacred

Every old `index-pre-*.html` is a recoverable rollback point. Don't delete entries from `_archive/` casually. The folder is small (~1 MB per backup) and storage is cheap.

Convention:
- `_archive/index-pre-<change>-YYYYMMDD.html` — code rollback points
- `_archive/QA_CHECKLIST-RUNS/YYYYMMDD-<short>.md` — completed QA runs
- `_archive/cmk-handoff-YYYYMMDD-*.zip` — dated handover snapshots (auto-managed by the existing handoff workflow)
- `_archive/STAKEHOLDER-UPDATE-YYYYMMDD.md` — old stakeholder messages

---

## 8. Don't touch oms-production/ unless explicitly unfrozen

The Factory scaffold parked at `oms-production/` is read-only by convention. Two events should trigger an unfreeze (per `UAT_PRO_STABILIZATION_PLAN.md`):

1. Two consecutive months without a localStorage corruption incident in the UAT
2. A specific operator pain that the UAT cannot solve (concurrency, audit history, real reporting workloads)

Until then, the scaffold is for reference, not for active work. Loop 1 of the Factory rebuild closed with minor known risks and is documented in `FACTORY_LOOP_1_CLOSEOUT.md`.

---

## 9. Quick reference — file paths

| What | Where |
|---|---|
| The UAT | `app/index.html` |
| Pre-edit backups | `_archive/index-pre-*.html` |
| QA Checklist | `docs/QA_CHECKLIST.md` |
| Past QA runs | `_archive/QA_CHECKLIST-RUNS/*.md` |
| Bug Log | `docs/BUG_LOG.md` |
| Latest dev handover | `docs/DEV_HANDOVER_*.md` |
| Stabilization plan | `UAT_PRO_STABILIZATION_PLAN.md` |
| Task closeout reports | `UAT_TASK*_CLOSEOUT.md` |
| Production scaffold (parked) | `oms-production/` |
| Master data seed | `demand_master_v3.json` |

---

## 10. Tone of voice

When working on this codebase:

- Prefer "boring and reversible" over "clever and one-shot"
- Write code comments tagged with the change context (e.g. `UAT Pro Task 1 · 2026-05-18` — matches the existing `// UAT41`, `// Phase 7B-1` tradition)
- Use the same Thai + English approach as the existing UI strings — never assume Thai-only or English-only
- Default to surfacing failures over silencing them
- When in doubt about scope, ask before editing. A small unrelated refactor is bigger than it looks
