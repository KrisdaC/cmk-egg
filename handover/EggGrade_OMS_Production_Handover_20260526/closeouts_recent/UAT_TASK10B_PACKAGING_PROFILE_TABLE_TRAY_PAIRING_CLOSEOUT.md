# UAT Task 10B — Packaging Profile UX + Tray Pairing Refinement — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `4e58fd0d9ab3597f43a2293f80d28813`
**Post-edit app MD5:** `193180d9008557d8d53a954b5e36a88e`
**Rollback:** `cp _archive/index-pre-packprofile-table-20260525.html app/index.html`

A refinement of Task 10A. Two things changed: (1) the Packaging Profile is now a
**compact 7-row component-slot table** instead of a long vertical form, so it
will scale when the other six packaging slots are built; (2) the tray is now an
**explicitly paired PACKAGING SKU** — the table shows the actual paired tray SKU
in an editable dropdown, the egg-size rule auto-selects it, and the operator may
override it (with a ↻ auto control to return to the rule). The Task 9 manual
editor was demoted to a collapsible **"Other packaging materials"** section.

Four anchored edits, all inside the item-edit BOM `_bom*` module. `openEditItem`
and every protected path were left untouched.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 4 anchored edits, all in the item-edit BOM module (lines ~23862–24310). Two whole-function replacements, one wiring swap, one guard widening. +168 lines. |
| `_archive/index-pre-packprofile-table-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`4e58fd0d9ab3597f43a2293f80d28813`) before any edit. |
| `_archive/closeouts/UAT_TASK10B_PACKAGING_PROFILE_TABLE_TRAY_PAIRING_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK10B_packprofile_table_acceptance.js` | NEW — the Node `vm` acceptance harness (32 assertions). |
| `docs/BUG_LOG.md` | +1 row in the Open table (`UAT-048`). |

`openEditItem`, `renderPlanBom`, `renderBomSummary`, `safeSet`, `persistMasterV3`,
`buildBomComponentLinesForItem` are byte-identical (only line-shifted). The diff
is confined to lines 23862–24310 — the `_bom*` BOM module.

## B. Sections / functions changed

- **`_bomSyncPackBaseTray`** (rewritten) — now resolves the paired tray SKU by
  `selection_mode`: `auto_by_egg_size` derives the SKU from the egg-size rule;
  `manual_override` uses the operator-chosen `component_sku`. The resolved SKU is
  written back onto `packaging_profile.pack_base.component_sku` (auto mode), and
  a missing `selection_mode` is backfilled. All Task 10A behaviour — needs-review
  gating, manual-line adoption, basket protection, disable removes only the
  profile-owned line — is preserved.
- **`_bomRenderItemPackagingProfile`** (rewritten) — the long vertical form is
  replaced by a compact 7-row table (see D).
- **`_bomRenderItemEditSectionBody`** — one line: the Task 9 manual editor is now
  rendered through `_bomRenderOtherPackagingSection(it)` instead of directly.
- **`_bomAddPackagingComponent`** (Task 9) — the tray-duplicate guard was widened:
  it now also blocks adding the Packaging Profile's *current* `component_sku`
  (not just the two rule SKUs), so a manually-overridden tray cannot be
  duplicated either.

## C. New helpers / data model

**Data model — additive, backward-compatible.** `packaging_profile.pack_base`
gains two fields; Task 10A items (which lack them) default safely:

```
item.packaging_profile.pack_base = {
  enabled: true,
  packaging_key: "tray",
  component_sku: "C19999P302",         // NEW — the actual paired tray SKU
  selection_mode: "auto_by_egg_size",  // NEW — or "manual_override"
  qty_per_selling_unit: 1
}
```

**New symbols** (each verified present exactly once):

| Symbol | Purpose |
|---|---|
| `_BOM_PACKAGING_SLOTS` | The 7 standard FG packaging slots; only `pack_base` has `ready:true`. |
| `_bomPackBaseProfile()` | Ensures and returns `_editingV3.item.packaging_profile.pack_base`. |
| `_bomPackBaseSetActive / SetType / SetSku / SetQty / SetAuto` | Base Pack row handlers. `SetSku` flips `selection_mode` to `manual_override`; `SetAuto` returns it to `auto_by_egg_size`. |
| `_bomOtherPkgExpanded` / `_bomToggleOtherPkg` | Open/closed state + toggle for the "Other packaging materials" section. |
| `_bomRenderOtherPackagingSection(it)` | Collapsible wrapper around the Task 9 manual editor. |

## D. UI changes

**The Packaging Profile is now a table** — columns: ใช้งาน · Active │ ช่อง BOM ·
Standard slot │ ประเภท · Type │ SKU วัสดุ · Component SKU │ จำนวน · Qty/output │
สถานะ · Rule / Status │ Action. Seven rows:

- **Row 1 — pack ฐาน · Base Pack** (functional): an Active checkbox; a Type
  dropdown (only `ถาดกระดาษ · Tray`); a **Component SKU dropdown** listing the
  tray PACKAGING SKUs and showing the actual paired SKU selected; a Qty input
  (default 1); a status cell (`✅ auto (เบอร์ N)` / `✅ manual` / `⚠ …blocked`);
  and a `↻ auto` button shown in manual mode.
- **Rows 2–7** — Cover, SKU barcode label, Product label/sticker, Closer 1,
  Closer 2, Bulk barcode label — rendered greyed and disabled with a
  `เร็วๆ นี้ · coming soon` status, so the table structure is ready for the
  future slots.

**The Component SKU is now visible and editable.** The egg-size rule
auto-selects the tray (size 0 → `C19999P302 ถาดกระดาษ ใหญ่`, other sizes →
`C19999P301 ถาดกระดาษ เล็ก`); the operator can pick a different tray SKU, which
switches the row to `manual_override`; `↻ auto` returns it to the rule. This
makes the tray behave like the Basket Profile — a real paired Master Data SKU.

**The Task 9 manual editor was demoted.** It now sits below the Packaging Profile
table inside a collapsible **"▸ วัสดุบรรจุภัณฑ์อื่น · Other packaging materials"**
section, collapsed by default. All strings remain bilingual Thai + English; no
new CSS class — the table reuses `plan-matrix`.

## E. What was intentionally not changed

- **`oms-production/`, `renderPlanBom`, `renderBomSummary`, Orders, Daily
  Planning, ใบน้อย, Logistics, PO parsers, `safeSet`, the header strip,
  `MASTER_V3.option_sets`** — none touched.
- **`openEditItem`** — not touched. The Packaging Profile table renders inside
  the BOM section, not as a top-level `_sec`.
- **Out-of-scope packaging slots** — cover, SKU barcode label, product
  label/sticker, closers, bulk label — render as disabled "coming soon" rows;
  no logic was built for them.
- **Daily Plan BOM integration, bulk BOM upload, inventory deduction,
  production migration** — not built (out of scope).
- **Basket** — `_bomSyncPackBaseTray` still skips `component_role === 'basket'`;
  the basket stays controlled only by the Basket Profile.
- **Egg lines** — still derived solely from the Egg Profile.
- **Task 10A data** — preserved. The new `component_sku` / `selection_mode`
  fields are additive; a Task-10A item with only `{enabled, packaging_key,
  qty_per_selling_unit}` loads, defaults to `auto_by_egg_size`, and is upgraded
  in place on first sync. No existing field renamed; `bom.components` is not
  destructively migrated.
- **`buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomLineSourceLabel`,
  `_bomLineEditableLabel`, `_bomPkgComponentRows`** — unchanged from Task 10A;
  they already consume the profile-owned component correctly.

## F. Manual QA checklist

Reload `app/index.html` first. **Prerequisite:** the tray SKUs `C19999P301` and
`C19999P302` must exist in Master Data (Item role = PACKAGING) — see UAT-045.

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG → BOM section → Packaging Profile | A compact 7-row table; Base Pack is the only enabled row, the other six show "coming soon" |
| F2 | Open an FG with primary grade **0**, tick Active on the Base Pack row | Component SKU dropdown shows `C19999P302 ถาดกระดาษ ใหญ่`; status `✅ auto (เบอร์ 0)`; a `pack_base` line appears in the Components table |
| F3 | Open an FG with primary grade **1–6**, tick Active | Component SKU shows `C19999P301 ถาดกระดาษ เล็ก` |
| F4 | In the Component SKU dropdown pick a different tray SKU | Status changes to `✅ manual`; an `↻ auto` button appears; the chosen SKU is materialized into the BOM line |
| F5 | Click `↻ auto` | The SKU reverts to the rule-derived one; status returns to `auto` |
| F6 | Change Qty per output to 3 → open Test Calculation | The tray line total scales with qty 3 |
| F7 | Set Qty to 0 or blank while active | Status shows ⚠ blocked; BOM **Enable** checkbox is disabled |
| F8 | Tick Active on an egg FG with **no primary grade** (auto mode) | Status `⚠ egg size unresolved`; BOM Enable blocked |
| F9 | Before the tray SKUs exist in Master Data, tick Active | Status `⚠ SKU not in Master Data`; BOM Enable blocked |
| F10 | Untick Active | The `pack_base` line disappears from the Components table |
| F11 | Expand "▸ Other packaging materials" | The Task 9 manual editor appears; it does **not** list the profile-controlled tray line |
| F12 | In the manual editor, try to add `C19999P301`/`C19999P302` (or the manually-overridden tray SKU) while the profile controls tray | Blocked with the "managed by the Packaging Profile" alert |
| F13 | Save the FG, reopen it | Active state, paired Component SKU, selection mode and qty all persist |
| F14 | Open a basket FG | The basket line is still controlled only by the Basket Profile — unaffected |
| F15 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally |

## G. Known risks

- **Manual QA F1–F15 not yet run** — static + Node acceptance tests only (see H).
- **Tray SKUs still absent from the corrected master** — `C19999P301` /
  `C19999P302` are not in `demand_master_v3_corrected_v5_20260521.json`; until
  the operator creates them, an active Base Pack row in auto mode is correctly
  blocked. Carried over as **UAT-045** (🟡 Medium).
- **Daily Plan BOM still does not consume the tray line** — carried over as
  **UAT-046** (🟢 Low); out of scope this sprint.
- **"Other packaging materials" toggle is sticky across items** — `_bomOtherPkgExpanded`
  is a module-level flag, not reset per modal open (this would require touching
  the protected `openEditItem`). It is collapsed by default; once expanded it
  stays expanded for subsequent items in the same session. Logged as **UAT-048**
  (🟢 Low).
- **Manual override is not validated against the egg-size rule** — by design: a
  `manual_override` tray SKU is accepted as-is (status shows `manual`), even if
  it differs from what the rule would pick. The `↻ auto` control returns to the
  rule. This is the intended behaviour of manual override.
- The Task 10A adoption note (**UAT-047**, 🟢 Low) still applies.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.** `node --check` clean on all 7 executable inline
`<script>` blocks. Brace / bracket / backtick balance identical to the backup
(`{}` 0, `[]` 0, backtick even; paren imbalance −35, pre-existing, unchanged).
All 7 new symbols present exactly once; `safeSet`, `persistMasterV3`,
`buildBomComponentLinesForItem`, `_bomItemReadiness`, `renderPlanBom`,
`openEditItem`, `_bomSelectBasketSku` all intact. Diff confined to lines
23862–24310 (the `_bom*` module).

**Functional checks — passed.** A Node `vm` acceptance harness ran **32 / 32**
assertions: `_bomSyncPackBaseTray` under both selection modes (auto derives by
egg size and writes `component_sku` back; manual_override uses the chosen SKU and
does not overwrite it; manual accepts any tray SKU; blank manual SKU / unresolved
egg size / missing master SKU → needs_review; Task-10A item defaults to auto and
backfills `selection_mode`; disable removes only the profile line); the table
render (7 rows, 6 coming-soon, wired handlers, paired SKU pre-selected, auto vs
manual status, off state); the five Base Pack handlers (create profile, enable,
SKU pick flips to manual_override, ↻ auto reverts, qty incl. blank→null,
null-safe with no item); and the "Other packaging materials" collapsible
(collapsed hides the editor, toggle flips state + re-checks, expanded shows it).

**Acceptance criteria 1–12** are all met; 1–11 are covered by the harness and the
confined-diff analysis, criterion 12 (Section K regression) is the operator's
manual QA pass (F15).

**Outstanding:** manual QA F1–F15, including creating the two tray SKUs in
Master Data, plus a human browser smoke. Roll back with
`cp _archive/index-pre-packprofile-table-20260525.html app/index.html` if any
K-row regression fails.
