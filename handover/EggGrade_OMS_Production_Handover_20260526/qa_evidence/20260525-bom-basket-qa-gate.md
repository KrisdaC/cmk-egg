# UAT QA Gate Run — BOM / Basket Profile Stabilization

**Build under test:** `app/index.html` — MD5 `d340f2521bb7f759e00e9021d829c012` (post Task 8C-2E)
**Date / time (Bangkok):** 2026-05-25
**Tester:** Claude (automated QA gate)
**Method:** Static analysis + programmatic functional harness run against the real
master data (`demand_master_v3_corrected_v5_20260521.json`, 130 items). Mutated
no operator data — every test ran on in-memory deep copies.
**Scope focus:** Item-level BOM one-line model, Basket Profile, live recompute,
basket active-state fix, Uses-basket ON/OFF, selling-unit changes, basket SKU
selection & persistence — plus a regression sweep.

> **Method note.** This gate is a static + logic-level run. It exercises the real
> app functions with the real master data, so the BOM / Basket logic is verified
> end-to-end. It does **not** replace a 2-minute human browser smoke (open the
> app, watch the console, click each tab) — that is the only way to confirm pixel
> rendering and live DOM events, and is recommended as the final step before
> closeout. See "Browser-confirmation items" below.

---

## 1. Pass/Fail summary

| Area | Checks | Result |
|---|---|---|
| Static — parse & balance | 7 script blocks + 4 balance metrics | ✅ PASS |
| Area 1 — App boot / core symbols | 9 | ✅ PASS |
| Area 2 — Master Data Items (open/save/reopen) | 16 | ✅ PASS |
| Area 3 — Egg Profile → BOM | 6 | ✅ PASS |
| Area 4 — Basket Profile | 9 | ✅ PASS |
| Area 5 — Basket active-state / selling-unit change | 7 | ✅ PASS |
| Area 6 — Uses basket OFF | 7 | ✅ PASS |
| Area 7 — BOM UI section flow | 5 | ✅ PASS |
| Area 8 — Regression (tab render fns + diff) | 8 + diff audit | ✅ PASS |
| **Total functional assertions** | **67** | **67 / 67 PASS** |

**Bugs found: 0.** No code was changed during this gate.

### Static checks
- `node --check`: all 7 inline `<script>` blocks parse cleanly.
- Brace balance `{}` 6730 / 6730 — even. Bracket balance `[]` 2397 / 2397 — even.
- Paren imbalance `()` = −35 — the known, stable constant (parentheses inside
  string and regex literals); unchanged across the whole 8B-UI…8C-2E series.
- Backticks 1206 — even.

### Area 1 — App boot
- `MASTER_V3` loads as an object with an items array; all tab/boot entry
  functions (`setTab`, `renderOrders`, `renderPlanBom`, `renderBomSummary`,
  `onDailyPlanTabOpen`, `onOrdersTabOpen`, `onMasterV3TabOpen`, `loadMasterV3`)
  are defined.
- Boot path reviewed: `boot()` runs inside a `try/catch` that writes any failure
  to the `#sub` banner; data loads from `localStorage` in a fixed order.

### Area 2 — Master Data → Items
Tested four real SKUs — `30002` (FG egg), `33404` (mixed egg), `B0001` (FG basket
egg), `B1MK0001` (PACKAGING basket). For each: the BOM section and the Basket
Profile render without error, and a save round-trip (`normalizeMasterRecord`)
preserves `sku`, `name`, `selling_unit`, `units`, and the `bom.components` count —
no data loss.

### Area 3 — Egg Profile → BOM
On mixed egg `33404`: the BOM produces ≥2 egg lines, including a primary-minimum
line and a secondary-balance line. Changing `primary_grade`, `secondary_grade`,
or `min_primary` and recomputing changes the lines accordingly — confirming the
pure-recompute model that the live-recompute UI is built on (no close/reopen
needed).

### Area 4 — Basket Profile
`B0001` (basket flag absent in master) correctly infers "Uses basket" ON and
renders the checkbox checked; setting `has_basket_unit = false` renders it
unchecked and shows the "preserved but inactive" note. `_bomSelectBasketSku`
adds exactly one basket component carrying the chosen SKU; the basket unit
resolves from the selected basket SKU's master (`B1MK0001` → `ใบ`). The legacy
`basket_type` field does not appear in the Basket Profile body or the FG egg BOM
section.

### Area 5 — Basket active-state / selling-unit change
With "Uses basket" ON on `B0001` (`base_per_basket` = 70, stored component qty 1):
- selling unit `ตะกร้า` → basket qty **1**, not needs-review.
- selling unit `ฟอง` → basket qty **1/70** (recalculated; the stale stored `1` is
  not used), no "basket conversion missing".
- selling unit `แพ็ค 10` → basket qty **10/70**.
- A `ถาด` fixture (`base_per_pack` 30, `base_per_basket` 180) → **0.1667**.

### Area 6 — Uses basket OFF
On `B0001` with `has_basket_unit = false`: no active basket line in Components,
no basket row in Test Calculation, BOM status not failed by basket, basket
profile status benign, and the stored basket component is preserved in
`bom.components`. Re-checking ON makes the basket line reappear and recompute.

### Area 7 — BOM UI section flow
`_bomRenderItemEditSectionBody` emits, in order: status block, Output basis,
Components-per-output table, Test Calculation, and Technical/Advanced details.
Exactly one basket row is produced (no duplicate basket line).

### Area 8 — Regression
All tab render functions remain defined. A line-level diff of the current build
against the pre-8B-UI backup (`index-pre-bom-itemui3-20260525.html`, the start of
the recent series) shows **every change confined to two regions**: the Master
Data item-edit modal (lines ~10209–10313) and the item-edit BOM module (lines
~22939–23682). `renderPlanBom` (Daily Plan BOM, line 23704), `renderOrders`,
`renderBomSummary`, and all tab-open handlers fall outside the changed regions —
no regression surface for Orders, Daily Planning, Daily Plan BOM, Controlled
Lists, Logistics, or ใบน้อย.

---

## 2. Bugs found

**None.** Zero confirmed bugs. No blocking or non-blocking defects were found in
the BOM / Basket Profile logic, the recent active-state fix, or the regression
sweep.

## 3. Reproduction steps

Not applicable — no bugs found.

## 4. Blocking vs non-blocking

Not applicable — no bugs found.

## 5. Recommended minimal fix

None required.

## 6. Browser-confirmation items (recommended final step)

These are not bugs — they are the parts of the QA plan that only a live browser
can confirm 100%, and that this static gate verifies indirectly:

| Item | What the gate verified | What a browser confirms |
|---|---|---|
| Console has no red errors on boot | All 7 blocks parse; `boot()` is `try/catch`-guarded | The live console on real boot |
| Tabs render visually | Render functions defined, parse, untouched by recent work | Pixels actually drawn |
| Live recompute without close/reopen | `buildBomComponentLinesForItem` is a pure recompute | The `onchange` DOM wiring fires |

Recommended: a ~2-minute human smoke — open `app/index.html`, watch the console,
click Orders / Daily Planning / Daily Plan BOM / Controlled Lists / Logistics /
ใบน้อย, open one basket SKU, toggle "Uses basket", change the selling unit.

## 7. Readiness for final closeout

**The app is ready for final closeout from the QA gate's perspective.** Static
checks are clean, 67/67 functional assertions pass against real data, and the
regression diff proves the recent BOM/Basket work did not touch any other module.
The only outstanding step is the optional ~2-minute human browser smoke above —
recommended but not blocking, given the changes are provably confined.

## 8. Code-change confirmation

**No code was changed during this QA gate.** `app/index.html` MD5 is
`d340f2521bb7f759e00e9021d829c012` before and after this run — unchanged. The
gate was run entirely on in-memory deep copies of the master data; no operator
data was mutated.
