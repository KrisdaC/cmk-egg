# UAT Task 8B-UI-4 — Binary BOM Status with a Hard Readiness Gate — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `b12a6ca5fceb8a2ad5859a659d4a906b`
**Post-edit app MD5:** `a1e9404e65f6ebc12c19a564ce60248b`
**Rollback:** `cp _archive/index-pre-bom-itemui6-20260525.html app/index.html`

Replaces the three-way BOM status with a binary, hard-gated Enable. Display /
validation cleanup only — no calculation change, no Daily Plan change, no Orders
/ Planning / ใบน้อย / Logistics change, no data deleted.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 2 anchored splices: (1) `_bomStatusValue` + `_bomOnStatusChange` replaced by `_bomItemReadiness` + `_bomRenderItemStatusBlock` + `_bomRecheckItemBom`; (2) `_bomRenderItemEditSection` split into a host wrapper + `_bomRenderItemEditSectionBody`. |
| `_archive/index-pre-bom-itemui6-20260525.html` | NEW — pre-edit snapshot, MD5-verified before any edit. |
| `_archive/closeouts/UAT_TASK8BUI4_BOM_READINESS_GATE_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | +1 row (`UAT-038`). |

`oms-production/`, `validateMasterItem`, `openEditItem`, Orders, Daily Planning,
Daily Plan BOM, ใบน้อย, Logistics, Dispatch, Inventory, persistence — untouched.
No master-data JSON change.

## B. Why this change

8B-UI-2 gave BOM status three values (Draft / Active / No BOM required) on two
free checkboxes. Per the operator's decision, status should instead be **all or
none** and should *guarantee* the data is correct before the BOM is turned on —
so the numbers the BOM section shows can be trusted.

## C. How BOM status was simplified

BOM status is now a single binary: **Enabled** / **Not enabled**, one checkbox.
"Draft" is gone (a half-built BOM is simply "not enabled"). The "No BOM required"
UI control is removed too — pure on/off, as decided.

- The persisted field `bom.enabled` is unchanged and still saved via the
  checkbox's `data-f="bom.enabled"`.
- `bom.no_bom_required` is **kept in storage** (not deleted — data safety) but is
  no longer shown or settable. See UAT-038.
- `_bomStatusValue` / `_bomOnStatusChange` (the 8B-UI-2 selector helpers) are
  removed — no longer referenced.

## D. The hard readiness gate

`_bomItemReadiness(it)` runs four checks (two are conditional) — exactly what the
operator asked the status to ensure:

**Conversion units**

1. Selling unit is set **and** resolves to a base conversion (`getSellingUnitBaseFactor`).
2. If the SKU uses baskets — `base_per_basket` is a positive number.

**Completeness of the data**

3. The BOM has at least one component line.
4. No component line is in "Needs review" (this rolls up egg-profile gaps,
   missing basket SKU, missing qty, etc. — every ⚠ in the Components table).

The **Enable checkbox is a hard gate**: when any check fails the checkbox is
`disabled` and unchecked, so it cannot be ticked and a save records
`bom.enabled = false`. When all checks pass the checkbox becomes interactive and
the operator chooses to enable. A live **checklist** under the checkbox shows
every check with ✓ / ✗ and a fix hint for each failure.

**Auto-heal:** if an item was Enabled but its data later degraded, the gate now
fails — the checkbox renders disabled + unchecked, a warning says it "will be
turned off on save", and the next save sets `bom.enabled = false`. The invariant
"enabled = true only with complete data" therefore always holds.

**Re-check:** a "↻ Re-check" button re-evaluates the whole BOM section against the
current, unsaved form values (`_readEditForm`), so after the operator fixes a
field elsewhere in the modal the gate updates without needing a save + reopen.
`_bomRenderItemEditSection` now wraps its body in `<div id="bomSectionHost">` so
the re-check can re-render in place.

## E. Data safety / scope

- **Nothing deleted.** `bom.enabled`, `bom.no_bom_required`, `bom.components`,
  `bom.routes`, `bom.notes`, legacy `bom.output_unit` keep their shapes and save
  paths. Verified: render / readiness / status-block leave `item.bom` byte-identical.
- **No calculation change.** Readiness reuses the existing helpers
  (`buildBomComponentLinesForItem`, `getSellingUnitBaseFactor`,
  `normalizeItemUnits`) — it only reads them.
- **`validateMasterItem` not touched** (it is on the protected do-not-touch list).
- No Daily Plan BOM / Orders / Planning / ใบน้อย / Logistics / Dispatch /
  Inventory change. The gate certifies item-level data; it does not yet make the
  Daily Plan skip non-Enabled SKUs — that remains a separate future decision.

## F. Manual QA checklist

Open **Master Data → Items → Edit** on a finished-goods SKU, expand BOM / สูตรผลิต.

| # | Step | Expected |
|---|------|----------|
| F1 | Open a SKU with a complete egg/basket setup | Status shows ✅, all checklist rows ✓, Enable checkbox is tickable |
| F2 | Open a SKU missing its selling unit or base conversion | Status ⛔, the conversion check is ✗, Enable checkbox is greyed out / locked |
| F3 | Open a mixed egg SKU missing min_primary | "All component lines complete" is ✗; Enable stays locked |
| F4 | A SKU previously Enabled, now with data removed | Warning "was enabled but data is now incomplete"; on save it becomes Not enabled |
| F5 | Fix the missing data in another section, click "↻ Re-check" | The checklist turns green and Enable unlocks — no save/reopen needed |
| F6 | There is no Draft option and no "No BOM required" control | Status is a single Enable checkbox only |
| F7 | Save an Enabled SKU, reopen | `bom.enabled`, components, routes, notes all preserved |
| F8 | QA_CHECKLIST.md Section K regression | Orders / Daily Planning / Master Data / Controlled Lists / ใบน้อย / Logistics open normally |

## G. Known risks / BUG_LOG additions

- **UAT-038** (Low) — `bom.no_bom_required` is now a legacy field with no UI
  control; existing `true` values persist and still suppress the
  `validateMasterItem` "BOM not specified" warning (the validator is on the
  protected do-not-touch list). Lenient, not harmful; a future data pass could
  clear legacy values.

## H. Final verdict

**Ready for UAT testing.**

Static checks passed: `node --check` clean on all 7 inline `<script>` blocks;
brace/paren/bracket deltas balanced (`{}` +19/+19, `()` +41/+41, `[]` +5/+5);
imbalance offsets unchanged vs backup (braces 0, parens −35, brackets 0);
backticks 1206 (even, unchanged); new symbols (`_bomItemReadiness`,
`_bomRenderItemStatusBlock`, `_bomRecheckItemBom`, `_bomRenderItemEditSectionBody`)
each defined once; `_bomStatusValue` / `_bomOnStatusChange` / `bomStatusSel`
fully removed; `data-f="bom.enabled"` one input; `data-f="bom.no_bom_required"`
0 occurrences; `validateMasterItem`, `safeSet`, `renderPlanBom` intact.

Functional checks passed — **34/34** Node acceptance-test harness: readiness is
true only for a complete SKU and false for missing selling unit, missing
`base_per_basket`, a mixed egg missing min_primary, and an empty BOM; the Enable
checkbox is interactive when ready and disabled when not; ready+enabled renders
checked; a degraded (was-enabled) item renders disabled + unchecked with the
turn-off warning; the section is wrapped in `bomSectionHost`, the Re-check button
is present and safe to call, no Draft / no `no_bom_required` control remains; the
checklist shows the conversion and completeness checks; `item.bom` is not
mutated; `validateMasterItem` / `renderPlanBom` / `safeSet` intact.
