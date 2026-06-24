# UAT Task 10C — BOM Bulk Upload importer deprecation (docs-only) — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (no app code changed — verify by re-reading the docs)
**Pre-edit app MD5:** `193180d9008557d8d53a954b5e36a88e`
**Post-edit app MD5:** `193180d9008557d8d53a954b5e36a88e`   *(identical — no app code touched)*
**Rollback:** revert the 6 anchored edits in `docs/BUG_LOG.md` and
`docs/DEV_HANDOVER_2026-05-25.md` (no `app/index.html` backup is needed; the file
was not modified).

A **docs-only** sprint. The BOM Bulk Upload importer (`parseBomWorkbook` /
`_bomApplyCommit`, the **🧪 BOM Bulk Upload** button) is hereby marked
**deprecated**: it must not be extended for new packaging SKUs, and the manual
Master Data item editor becomes the canonical path for adding packaging items.

No `app/index.html` code was changed. The previously-rolled-back Task 10C-draft
patch (which extended `_bomMapLegacyPackagingRow` / `_bomApplyCommit` for richer
schema) stays rolled back; that change would have piled new legacy on UAT-014 /
UAT-015, which was exactly the compounding the operator wanted to avoid.

---

## A. Files changed / created

| File | Change |
|---|---|
| `docs/BUG_LOG.md` | 4 anchored edits: extended the **Status scale** with `deprecated-path`; flipped **UAT-014** and **UAT-015** from `open` to `deprecated-path` (workaround + owner notes rewritten to point at the policy); added **UAT-049** as the canonical deprecation policy row. |
| `docs/DEV_HANDOVER_2026-05-25.md` | 2 anchored edits: § 13 ("Safe Handoff Notes") gains a new "Do not extend the BOM Bulk Upload importer" bullet; § 10 ("Current Known Issues / Watch Items") gains a "BOM Bulk Upload importer deprecated" sub-bullet under Code-hygiene watch items. |
| `_archive/closeouts/UAT_TASK10C_BOM_BULK_UPLOAD_DEPRECATION_CLOSEOUT.md` | NEW — this file. |
| `app/index.html` | **Not touched.** MD5 identical before and after (`193180d9008557d8d53a954b5e36a88e`). No `_archive/index-pre-*.html` was needed because no edit was made to the working system. |

## B. Sections / functions changed

None in `app/index.html`. The changes are purely declarative: a status-scale
extension, two row status flips, one new BUG_LOG row, and two new bullets in
the DEV_HANDOVER notes.

## C. New helpers added

None.

## D. UI changes

None. The **🧪 BOM Bulk Upload** button is still present in Master Data and
still functions as before — clicking it still parses the legacy two-sheet shape
and runs `_bomApplyCommit`. This sprint is *policy*, not *code*: existing
items imported via the legacy path remain valid, and the path can still be used
for legacy-shape Packaging.xlsx files if absolutely necessary. Operators should
prefer the manual editor for any new packaging SKU going forward.

## E. What was intentionally not changed

- **`app/index.html`** — not touched, by design. No `_bomMapLegacyPackagingRow`
  extension, no `_bomApplyCommit` rewrite, no UI banner on the BOM Bulk Upload
  button. A UI banner / hide-the-button is a possible follow-up micro-sprint if
  the operator wants visible deprecation; for now the deprecation is documented
  only.
- **The existing BOM Bulk Upload code path** is not deleted. It is still
  callable; this lets previously-imported items round-trip cleanly and lets the
  operator re-run a legacy Packaging.xlsx if a historical need surfaces.
- **`bom_material.{group, subgroup, family}`** stays where it is — a
  write-only field nothing in the BOM UI consumes. We did not remove or rewrite
  it; doing so would touch every item that has it. Pure read-only-legacy data.
- **UAT-014 was not "fixed."** It was *deprecated by removing the use-case*: the
  data-loss path remains in code but is now off the supported path. Same for
  UAT-015's normalized-shape gap. Both are flagged `deprecated-path` so future
  scans treat them differently from active `open` bugs.
- **No new importer was built.** The 2 paper trays needed for UAT-045 go in
  via the manual editor. The clean additive item importer (with full unit
  model and grouping/subgrouping) is explicitly deferred until there is real
  bulk-import volume.
- **No code helpers, line numbers, or anchors moved.** Every existing
  reference to `parseBomWorkbook`, `_bomApplyCommit`, `_bomMapLegacyPackagingRow`
  still points at the same line in `app/index.html`.

## F. Manual QA checklist

This is a docs-only sprint — there is nothing to functionally test inside the
running app. The verification is reading the docs:

| # | Step | Expected |
|---|------|----------|
| F1 | Open `docs/BUG_LOG.md` → "How to use this file" | Status scale lists `deprecated-path` with a short explanation |
| F2 | Find the UAT-014 row | Status column reads `deprecated-path`; workaround / owner notes reference UAT-049 |
| F3 | Find the UAT-015 row | Status column reads `deprecated-path`; workaround / owner notes reference UAT-049 |
| F4 | Find the UAT-049 row (after UAT-048) | Severity 🟢 Low, status `deprecated-path`, area "BOM Bulk Upload · deprecation policy", with the full policy text |
| F5 | Open `docs/DEV_HANDOVER_2026-05-25.md` → § 13 Safe Handoff Notes | A "Do not extend the BOM Bulk Upload importer" bullet appears right after the `oms-production/` bullet |
| F6 | Same file → § 10 Current Known Issues / Watch Items → Code-hygiene watch items | A "BOM Bulk Upload importer deprecated" sub-bullet appears after the UAT-035 line |
| F7 | Open Master Data → click 🧪 BOM Bulk Upload | The button still works exactly as before (deprecation is policy, not code) |
| F8 | Re-open any item edited via the legacy importer | The item still loads, still validates, still shows correct units (existing data preserved) |
| F9 | `md5sum app/index.html` | `193180d9008557d8d53a954b5e36a88e` — identical to the pre-sprint MD5 |

## G. Known risks

- **The BOM Bulk Upload button is still in the UI without any visible
  deprecation marker.** An operator could still click it. Acceptable for now;
  optional follow-up: add a "Deprecated — see UAT-049" tooltip / banner. Logged
  as **UAT-050** (🟢 Low) if needed in a follow-up — not added this sprint to
  keep the scope strictly docs-only.
- **`bom_material.{group,subgroup,family}` remains as write-only legacy data**
  on items previously imported through the legacy path. Pure cosmetic data at
  rest. A future cleanup could either build a BOM-menu dropdown consumer for
  it (if the field shape is judged useful) or strip it (if a fresh grouping
  model is chosen). Deliberately deferred.
- **The unit model is still not fed by any importer.** The manual editor is the
  only path that writes `storage_unit` / `consumable_unit` / their conversions.
  This is the deliberate consequence of deprecating without replacing: when
  real bulk-import volume appears, the new importer must be designed against
  the full unit model from day one.
- **Manual QA F1–F9 not yet performed** — verification is reading the docs +
  one MD5 check.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Sanity checks passed.**
- `md5sum app/index.html` = `193180d9008557d8d53a954b5e36a88e`, identical to
  the pre-sprint MD5 — the working system is byte-identical.
- The 4 BUG_LOG anchored edits each replaced exactly one occurrence (Python
  `assert src.count(old) == 1` per edit).
- The 2 DEV_HANDOVER anchored edits each replaced exactly one occurrence.
- Visual verification: `grep -n` confirms the new UAT-049 row, the
  `deprecated-path` markers on UAT-014/UAT-015, and the new bullets in
  DEV_HANDOVER § 10 and § 13.

**No `node --check`, no acceptance harness, no brace-balance check** — these
guards apply to `app/index.html` edits; this sprint did not touch it.

**Next concrete action for the operator:** add `C19999P301` (ถาดกระดาษ เล็ก)
and `C19999P302` (ถาดกระดาษ ใหญ่) via Master Data → New Item, setting
`item_role = PACKAGING`, `item_type = packaging`, `base_unit = ใบ`, and using
Counting & Units for storage / consumable conversion as appropriate. That
unblocks UAT-045 on the canonical (manual) path and exercises the full unit
model end-to-end.
