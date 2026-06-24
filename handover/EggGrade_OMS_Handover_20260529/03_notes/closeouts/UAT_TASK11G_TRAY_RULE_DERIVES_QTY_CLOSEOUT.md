# UAT Task 11G — Tray auto-rule derives qty per selling unit — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `707c32fe1b7362e9646180c026a2ad09`
**Post-edit app MD5:** `5fd132beffef85a50bdf4597deb92e6e`
**Rollback:** `cp _archive/index-pre-tray-qty-derive-20260525.html app/index.html`

Fixes the bug visible in your `B0002 ไข่ไก่คละ (30ฟอง) ตราบิ๊กซี (2ถาด/ตระกร้า)`
screenshot: the BOM was correctly framed "per selling unit (60 ฟอง basket)",
the eggs were correctly 60, the basket was correctly 1, **but the tray
was 1 instead of 2**. The tray auto-rule resolved the right SKU but left
qty at the operator's default of 1. This sprint extends the rule to also
derive qty:

> **qty = (base units per 1 selling unit) ÷ (base_per_pack)**

For your item: 60 ÷ 30 = **2 trays per basket**. The materialised BOM line
now uses 2 ใบ; the Test Calculation, the Components-per-output-unit table,
and the readiness gate all see the correct number. The rule writes the
derived qty back to `packaging_profile.pack_base.qty_per_selling_unit` so
the UI reflects it. Editing the qty cell in auto mode now flips to manual
(mirrors the existing SKU-edit behaviour), so an operator who explicitly
sets a different qty keeps it.

Five anchored edits, all inside the BOM module. Manual-mode behaviour is
unchanged (rule qty is ignored — operator's qty wins).

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 5 anchored edits: (A) rule body now derives qty; (B) sync captures `rule.qty` alongside `rule.sku`; (C) `qtyRaw` prefers `ruleQty` in auto mode; (D) writes the rule-derived qty back to the profile in auto mode; (E) `_bomSlotSetQty` flips to manual when the operator edits qty in auto mode. +2,076 bytes. |
| `_archive/index-pre-tray-qty-derive-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`707c32fe1b7362e9646180c026a2ad09`). |
| `_archive/closeouts/UAT_TASK11G_TRAY_RULE_DERIVES_QTY_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK11G_task11g_acceptance.js` | NEW — Node `vm` acceptance harness (14 assertions). |
| `docs/BUG_LOG.md` | **Not touched.** This is a correctness fix on an existing path; no new known risk. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. The bug

Before this sprint the Packaging Profile pack_base/tray auto rule did:

- Resolve the right tray SKU by egg size (`size 0 → C19999P302`, `others → C19999P301`).
- Leave `qty_per_selling_unit` at whatever the operator's profile said (default `1`).

Combined with the per-selling-unit BOM framework, this produced:

| Selling unit | Eggs / output | Trays / output (before) | Trays / output (target) |
|---|---:|---:|---:|
| basket (60 ฟอง) — your screenshot | 60 ✓ | **1** ❌ | 2 |
| pack (30 ฟอง) | 30 ✓ | 1 ✓ | 1 |
| fong (1 ฟอง) | 1 ✓ | 1 ❌ | 1/30 |

The eggs scaled correctly because `calculateEggSourceRequirements` already
multiplies by `getSellingUnitBaseFactor`. The tray didn't scale because the
rule didn't compute qty at all — it deferred to `pp.qty_per_selling_unit`.

## C. The fix

**The rule now derives qty using exactly the same conversion that the eggs
already use.** `tray_by_egg_size(item)` now returns `{ sku, name, size, qty }`
where:

```js
qty = getSellingUnitBaseFactor(item) / item.units.base_per_pack
```

Both are existing fields; both already drive other BOM math (`getSellingUnitBaseFactor`
is what `calculateEggSourceRequirements` uses; `base_per_pack` is the FG's
pack-conversion). Reusing them keeps the tray qty in lockstep with the egg
qty per selling unit.

**Returns `qty: null` when the conversion can't resolve** (e.g. `base_per_pack`
missing, or `selling_unit` unset). Sync then falls back to
`pp.qty_per_selling_unit`. So legacy items and items missing a tray pack
size keep working as before.

**Sync writes the derived qty back to the profile** in auto mode so the
Packaging Profile Qty cell shows the right number on reopen and on save.

**Editing qty in auto mode now flips to manual** — mirroring the existing
SKU-edit behaviour. The operator's explicit qty is preserved; pressing
`↻ auto` returns to the rule's qty + rule's SKU.

## D. UI / label changes

None — this is a data-correctness fix. The Packaging Profile Qty cell now
shows the rule-derived value (e.g. **2** for your screenshot item), but the
column header, helpers, and table layout are unchanged from Task 11F.

## E. Legacy conflicts fixed

| Conflict | Before | After |
|---|---|---|
| Tray auto rule produced wrong qty for selling units larger than 1 pack | qty stuck at operator's default (1) | qty derived from `selling_unit_base_factor / base_per_pack` |
| Operator editing qty in auto mode was overwritten by the rule on next sync | edit silently reverted | edit flips to manual (mirrors `_bomSlotSetSku`) |
| Profile `qty_per_selling_unit` was stale for auto-mode items | not refreshed | sync writes the derived qty back |
| Manual mode behaviour | unchanged | unchanged (rule qty ignored) |

## F. What was intentionally not changed

- **`oms-production/`** — not touched.
- **Orders, Daily Planning, `renderPlanBom`, `renderBomSummary`, ใบน้อย, Logistics, PO parsers, `safeSet`, header strip, BOM Bulk Upload importer, Master Data import/export/restore, Clear Master Data** — all untouched.
- **`MASTER_V3.option_sets`** — not touched.
- **Egg Profile, Basket Profile** — unchanged. (Basket Profile already has its own equivalent qty derivation via `calculateBasketRequirementFromItem`; the tray now follows the same pattern.)
- **Other profile slots** — `cover`, label, sticker, closer, bulk label — unchanged. No rule applies to them today, so their behaviour is identical (operator-set qty in manual mode).
- **No new field, no rename, no conversion / inventory / Daily Plan BOM logic.**
- **Test Calculation, `buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomRenderItemPackagingProfile`, `_bomRenderItemComponentsTable`** — all unchanged. They read the new qty automatically via `bom.components` / `pp.qty_per_selling_unit`.

## G. Manual QA checklist

Reload `app/index.html` first.

| # | Step | Expected |
|---|------|----------|
| F1 | Open the FG from your screenshot (`B0002`) → BOM | The **tray** line in "Components per output unit" now reads **2 ใบ** (was 1). |
| F2 | Look at Packaging Profile → Base Pack row | Qty cell shows **2**. Status ✅ auto (tray_by_egg_size). |
| F3 | Click Test Calculation with test qty 1 | The tray row shows **2 ใบ** total (1 × 2). With test qty 10, shows 20 ใบ. |
| F4 | Open an FG whose selling unit IS the pack (selling_unit=ถาด, base_per_pack=30) | Tray qty = **1** (30 / 30). |
| F5 | Open an FG whose selling unit IS the base unit (selling_unit=ฟอง) | Tray qty = **1/30** ≈ 0.0333. Acceptable; operator can switch to manual to override. |
| F6 | On any auto-mode pack_base row, type a different qty into the Qty cell | The row flips to **manual** mode; `↻ auto` button appears; your typed qty persists. |
| F7 | Click `↻ auto` | Both SKU and qty revert to the rule values. |
| F8 | Open a legacy item with no `base_per_pack` set | Tray qty falls back to the stored `pp.qty_per_selling_unit` (legacy behaviour preserved). No error. |
| F9 | Save the FG, reopen | The derived qty persists in `packaging_profile.pack_base.qty_per_selling_unit`. |
| F10 | Open the Cover row on any FG, pick a cover SKU manually, qty 1 | Cover row materialises a cover line with **qty 1** (no rule applies to cover; manual mode unaffected). |
| F11 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally; no console errors. |

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup (`{}` 0, `[]` 0, backticks even); paren imbalance −35, unchanged.
- New tokens (`var ruleQty = null;`, `(ruleQty != null) ? ruleQty : pp.qty_per_selling_unit`, the auto-mode write-back, the `_bomSlotSetQty` manual-flip) all present once.
- All protected helpers (`_bomSyncProfileSlot`, `_bomSlotSetQty`, `_bomSlotSetSku`, `getSellingUnitBaseFactor`, `normalizeItemUnits`, `_bomDeriveTrayForItem`, `safeSet`, `persistMasterV3`, `_bomItemReadiness`, `buildBomComponentLinesForItem`, `renderPlanBom`) intact.

**Functional checks — passed.**
- **New Node `vm` acceptance harness: 14 / 14.** Covers:
  - **T1: basket-selling FG (your screenshot) → tray qty = 2** (60/30), SKU = P301, unit = ใบ, profile pp.qty written back, needs_review false.
  - T2: pack-selling FG → qty 1 (30/30).
  - T3: base-selling FG → qty 1/30.
  - T4: missing `base_per_pack` → falls back to `pp.qty` (legacy preserved).
  - T5: missing `selling_unit` → falls back.
  - T6: manual mode → `pp.qty` used, rule.qty ignored.
  - T7: size 0 → P302 + qty 2.
  - T8: non-tray type → qty preserved manually.
- **Regression — Task 11E harness: 37 / 37.** Generic slot sync, cover materialisation, basket protection, legacy-tag recognition — all unchanged.
- **Regression — Task 11F harness: 14 / 14.** SKU base_unit drives BOM unit; supply/storage units do NOT change BOM unit or qty; missing base_unit → needs_review.
- **Regression — Task 11C harness: 15 / 15.** Tray candidate filter unchanged.
- **Regression — Task 11D Type Semantics harness: 23 / 23.** `_BOM_PACKAGING_SLOTS` shape + `_bomSlotTypeDisplay` unchanged.

103 acceptance assertions passing in total.

**Acceptance:** the bug visible in the screenshot — tray qty 1 for a basket-selling FG — is fixed. Manual QA F1–F11 still to run.

**Outstanding:** manual QA F1–F11 and Section K regression. Roll back with
`cp _archive/index-pre-tray-qty-derive-20260525.html app/index.html` if any
K-row regression fails.
