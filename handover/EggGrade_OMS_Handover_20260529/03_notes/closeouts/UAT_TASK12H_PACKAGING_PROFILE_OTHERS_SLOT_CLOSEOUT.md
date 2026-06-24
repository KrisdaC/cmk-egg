# UAT Pro · Task 12H — Add 'Others' slot to Packaging Profile — Closeout

**Date:** 2026-05-27
**Trigger:** User: `Active | Slot | Item type | Component SKU | Qty / pack | Qty / selling unit · Can be the same · Slot = others · type = others`. User wants a generic catch-all slot in the Packaging Profile so miscellaneous materials can be picked there (parallels the role the now-simplified "Other packaging materials" manual editor still plays below).

## A. Files changed
- `app/index.html` — one anchored edit to `_BOM_PACKAGING_SLOTS`.

| | Before | After | Δ |
|---|---:|---:|---:|
| `_BOM_PACKAGING_SLOTS` entries | 7 | **8** | +1 |
| `{` `}` balance | identical | identical | 0 (+1 / +1) |
| `(` `)` imbalance | −35 | −35 | 0 |
| `[` `]` balance | identical | identical | 0 (+1 / +1) |
| `node --check` × inline JS blocks | passes | **passes** | — |
| Task 12B acceptance harness | 27/27 | **27/27** | — |
| Task 12F-FIX/12G harness | 39/39 | **39/39** | — |

**Backup:** `_archive/index-pre-task12h-others-slot-20260527.html` (pre-MD5 `c7c9ebc5f4710541a582f670612c0c66`). Post-MD5 `e5ea86259e2c7a4eb0f115d25eb1b2dd`.

## B. What changed
One new entry appended to `_BOM_PACKAGING_SLOTS`:

```js
{ role: 'other', th: 'อื่นๆ', en: 'Others', ready: false, allowed_types: ['other'] }
```

The Packaging Profile table now renders **8 rows** instead of 7: pack ฐาน · ฝาครอบ · ฉลาก barcode SKU · ฉลาก / สติกเกอร์ · Closer 1 · Closer 2 · ฉลาก barcode Bulk · **อื่นๆ (Others)**.

When the operator activates the Others slot:
- `pp.item_role` defaults to `'PACKAGING'` (per `_bomSlotSetActive`).
- `pp.item_type` defaults to `'other'` (the first entry in `allowed_types`).
- The Item type dropdown lists `other` plus every other distinct `item_type` found on PACKAGING master items (via `_bomPkgTypesByRole`), so the operator can override `other` with a more specific type if useful.
- The Component SKU dropdown lists every PACKAGING **or** SUPPLY non-basket non-placeholder master item whose `item_type` matches the chosen type (via `_bomPkgCandidatesByType`, unchanged from Task 12D).
- Qty defaults to `1`.
- Stored row shape: `{ enabled, item_role, item_type, packaging_key, component_sku, qty_per_selling_unit, selection_mode:'manual', rule_id:null, requirement_status }`.

## C. What was intentionally not changed
- No other entry in `_BOM_PACKAGING_SLOTS` modified.
- No render code edited — the row loop iterates the array and renders the new entry with the same HTML pattern.
- No data migration; existing items don't have `packaging_profile.other` populated until the operator activates the new slot for a given item.
- `_BOM_PROFILE_RULES`, `_bomResolveRuleId`, `_bomSlotSetAuto` — still defined but unreachable (Task 12D deprecation intact).
- BOM math, Daily Plan BOM (`renderPlanBom`), Orders, Planning, Logistics, PO parsers, `safeSet`, `option_sets`, `oms-production/` — all untouched.
- Task 12B Supply / Issue Unit deprecation invariants intact (4 forbidden DOM patterns still count = 0).
- Tasks 12C-R / 12C-R2 / 12D / 12E / 12F / 12F-FIX / 12G — all intact.

## D. QA / smoke
Static smoke: brace/paren/bracket deltas match the new object literal (+1 / +1 / +1 / +1 for `{`, `}`, `[`, `]`); `node --check` passes on all inline JS blocks; Task 12B harness still 27/27; Task 12F-FIX/12G harness still 39/39.

### Recommended browser spot-check
1. Open any FG → BOM section → Packaging Profile.
2. Confirm the table now has **8 rows**, the last labeled `อื่นๆ` (or `Others` under LANG=en).
3. Tick its Active checkbox. Item type defaults to `other`. Component SKU dropdown is empty unless a master item has `item_type='other'`.
4. Change Item type to `tray` → SKU dropdown shows tray items.
5. Pick a SKU, set Qty, save the item. Reopen — the Others slot row is still active with the chosen SKU.
6. Untick Active → the materialized `packaging_profile_other` BOM-component line is removed.
7. The other 7 slots behave exactly as before.

## E. Known risks
- BUG_LOG not updated — additive UI change, no defect.
- The Others slot is intentionally permissive (any item_type accepted). If two distinct slots end up with the same type+SKU, the duplicate-SKU guard in `_bomAddPackagingComponent` only fires on the manual editor; in the Packaging Profile, two slots can in principle materialize the same SKU. Operators should pick distinct SKUs per slot. A future micro-pass could add a profile-internal duplicate check.

## F. Final verdict
**Ready for UAT testing.**

**Rollback:** `cp _archive/index-pre-task12h-others-slot-20260527.html app/index.html`
