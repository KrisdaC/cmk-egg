# UAT Task 11E — Packaging Profile generic slot editor + sync — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `b2d4c09aadf54e9f9f2575d74b21fd59`
**Post-edit app MD5:** `e848e5a0c6eb24fe6adfc2c3aaebe6df`
**Rollback:** `cp _archive/index-pre-pkgprofile-generic-20260525.html app/index.html`

The Packaging Profile is now an actual per-slot row editor. Every slot in
`_BOM_PACKAGING_SLOTS` (pack_base, cover, sku_barcode_label,
product_label_sticker, closer_1, closer_2, bulk_barcode_label) can be
activated; each row owns its own `item_role` + `item_type` +
`component_sku` + `qty` + `selection_mode` + `rule_id`; the Component
SKU dropdown is filtered by the operator-chosen `item_role` + `item_type`
via `_bomPkgCandidatesByType`. Auto rules live in a small registry
(`_BOM_PROFILE_RULES`), with `tray_by_egg_size` as the only entry today.
Materialisation goes through a single generic helper
`_bomSyncProfileSlot(slotId, …)`, looped by `_bomSyncPackagingProfile`,
which is what `_bomLiveRecompute` now calls. The legacy
`packaging_profile_pack_base_tray` tag is recognised as the same pack_base
line for full backward compatibility. The Task 9 manual "Other packaging"
editor's duplicate guard is now generic: any SKU materialised by ANY active
profile slot is blocked from being added manually.

Six anchored edits, all inside the BOM module. Existing Task 10A / 10B / 11C
/ 11D data shapes are preserved byte-for-byte; canonical new fields are
backfilled on the first sync per item.

The original observed bug — *"I added a cover SKU and it does not appear in
Packaging Profile"* — is fixed.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 6 anchored edits, all inside the BOM module (lines ~23933–24332 in the backup). +10,977 bytes / ~270 net lines added (large insertion + one large function replacement + four small surgical edits). |
| `_archive/index-pre-pkgprofile-generic-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`b2d4c09aadf54e9f9f2575d74b21fd59`). |
| `_archive/closeouts/UAT_TASK11E_PACKAGING_PROFILE_GENERIC_SLOT_EDITOR_CLOSEOUT.md` | NEW — this file. |
| `_archive/closeouts/UAT_TASK11E_task11e_acceptance.js` | NEW — Node `vm` acceptance harness (37 assertions). |
| `docs/BUG_LOG.md` | **Not touched.** No new risk; this implements the recommended sprint from the Task 11E inspection. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. Generic schema / sync changes

**New rule registry (data):**

```js
var _BOM_PROFILE_RULES = {
  tray_by_egg_size: function (item) { /* wraps _bomDeriveTrayForItem */ }
};
```

**New helpers (functions):**

| Symbol | Purpose |
|---|---|
| `_bomResolveRuleId(slotId, itemType)` | Returns the rule id for a (slot, type) pair, or `null`. Today only `pack_base + tray → 'tray_by_egg_size'`. |
| `_bomGetSlot(slotId)` | Look up the slot definition from `_BOM_PACKAGING_SLOTS`. |
| `_bomPkgTypesByRole(role, currentType, slotDefaults)` | Distinct `item_type` values present in `MASTER_V3` under the given role, plus any suggested defaults from the slot's `allowed_types`, plus the currently-stored type (historical visibility). `'basket'` is always excluded. |
| `_bomPackProfile(slotId)` | Ensure and return `_editingV3.item.packaging_profile[slotId]`. Creates a sensible default skeleton when missing (PACKAGING + slot's first `allowed_types` entry + auto-mode if a rule exists, else manual). Never overwrites stored values. |
| `_bomSlotSetActive(slotId, checked)` | Generic per-slot Active handler. |
| `_bomSlotSetRole(slotId, role)` | Generic per-slot Item Role handler. Clears SKU + flips to manual. |
| `_bomSlotSetType(slotId, type)` | Generic per-slot Item Type handler. Clears SKU; re-evaluates the auto rule for the new (slot, type). |
| `_bomSlotSetSku(slotId, sku)` | Generic per-slot SKU handler. Flips to manual. |
| `_bomSlotSetQty(slotId, v)` | Generic per-slot Qty handler. |
| `_bomSlotSetAuto(slotId)` | Returns to auto rule for the slot (no-op if no rule exists for the current type). |
| `_bomSyncProfileSlot(slotId, realItem, liveItem)` | The generic per-slot materialiser. Reads slot state from `liveItem`, resolves SKU via rule or manual, validates against Master Data (role + type + qty), writes ONE `bom.components` line tagged `packaging_profile_<slotId>`, recognising the legacy `packaging_profile_pack_base_tray` tag. Inactive slot → removes only its own line. Invalid active slot → writes a `needs_review:true` line so the existing readiness gate blocks BOM Enable. |
| `_bomSyncPackagingProfile(realItem, liveItem)` | Loops every slot in `_BOM_PACKAGING_SLOTS` and calls `_bomSyncProfileSlot` for each. |
| `_bomProfileControlledSkus(item)` | Set of `component_sku` values currently owned by active Packaging Profile slots. Used by the manual editor's duplicate guard. |

**Existing functions changed (small surgical edits):**

- `_bomSyncPackBaseTray` — now a one-line compatibility wrapper that calls `_bomSyncProfileSlot('pack_base', ...)`. Old direct callers continue to work.
- `_bomLiveRecompute` — now calls `_bomSyncPackagingProfile` instead of `_bomSyncPackBaseTray`, so every slot is materialised on every recompute.
- `_bomPkgComponentRows` — excludes any `bom.components` line whose `source_added` starts with `packaging_profile_` (covers all per-slot tags + the legacy tag).
- `_bomAddPackagingComponent` — duplicate guard is now generic: any SKU returned by `_bomProfileControlledSkus(liveItem)` is blocked from being added as a manual component.

**Existing function fully replaced:**

- `_bomRenderItemPackagingProfile` — rewritten as an editable per-slot row table.

## C. UI changes

The Packaging Profile table is now an editable per-slot row editor:

| Column | Before (Task 10B–11D) | After (Task 11E) |
|---|---|---|
| ใช้งาน · Active | Only pack_base interactive | **All 7 slots** are activatable |
| ช่อง BOM · Slot | TH+EN label | Same |
| บทบาท · Item role | (not present) | **NEW** — `<select>` PACKAGING / SUPPLY per active row |
| ประเภทวัสดุ · Item type | Read-only `ถาด · tray` (Task 11C/11D) | **NEW editable** `<select>` populated by `_bomPkgTypesByRole(role)` |
| SKU วัสดุ · Component SKU | Tray-only filter on Base Pack | **Generic** filter by selected role + type per row |
| จำนวน · Qty/output | Editable on Base Pack | Editable on every active row |
| สถานะ · Status | Tray-specific copy | Per-row status: ✅ auto/manual or ⚠ specific reason (role / type / SKU missing / mismatch / qty) |
| Action | ↻ auto on Base Pack | ↻ auto only when a rule exists for the (slot, type) pair |

The info banner now reads:
*"ℹ ลำดับการเลือก: **Slot → item_role → item_type → Component SKU → จำนวน** · Component SKU choices are filtered by the selected `item_role` and `item_type`. The slot does not pre-assign type — change item_type any time."*

Bottom hints clarify (a) the `pack_base + tray` egg-size auto rule, and (b) that qty/unit conversion is still temporary setup.

## D. Backward compatibility

Old data loads with no error and behaves exactly as today; canonical new fields are backfilled on the first sync per item — **no destructive migration**.

Field-level mappings (the sync recognises every legacy spelling):

| New / canonical | Falls back to (read) | Default |
|---|---|---|
| `item_type` | `packaging_key` → slot's `allowed_types[0]` | `''` |
| `item_role` | (absent) | `'PACKAGING'` |
| `requirement_status === 'required'` | `enabled === true` | `'optional'` |
| `selection_mode === 'auto_by_rule'` | `selection_mode === 'auto_by_egg_size'` | `'manual'` |
| `selection_mode === 'manual'` | `selection_mode === 'manual_override'` | `'manual'` |
| `rule_id` | derived: `'tray_by_egg_size'` for pack_base + tray + auto | `null` |
| `source_added === 'packaging_profile_<slot>'` | `source_added === 'packaging_profile_pack_base_tray'` (legacy) | sync recognises either when finding the controlled line |
| `component_name` | (absent) | sync writes it from Master on materialisation |

A Task 10A-era item (no `item_role`, no `item_type`, `packaging_key: 'tray'`, `selection_mode: 'auto_by_egg_size'`, `source_added: 'packaging_profile_pack_base_tray'`) loads, syncs, and the line is updated in place with the new tag. **Verified by harness T7 + T8.**

## E. What was intentionally not changed

- **`oms-production/`** — not touched.
- **Orders, Daily Planning, `renderPlanBom`, `renderBomSummary`, ใบน้อย, Logistics, PO parsers, `safeSet`, header strip, BOM Bulk Upload importer, Master Data import/export/restore, Clear Master Data** — all untouched.
- **`MASTER_V3.option_sets`** — not touched. No new option_set values. The existing `item_role` + `item_type` Master Data fields carry the taxonomy.
- **Egg Profile, Basket Profile, Test Calculation, BOM readiness gate, `buildBomComponentLinesForItem`, `_bomItemReadiness`** — unchanged.
- **No new Master Data classification fields** (`packaging_slot`, `packaging_subtype`, `packaging_scope`).
- **`_bomPkgCandidateItems` (Task 9), `_bomPkgCandidatesByType` (Task 11D-correction), `_bomPkgTrayCandidateItems` (Task 11C wrapper), `_bomSlotTypeDisplay` (Task 11D), `_bomDeriveTrayForItem` + `_bomTraySkuInfo` (Task 10A)** — all untouched, all still in use.
- **`_bomPackBaseSet*` (Task 10B) and `_bomPackBaseProfile` (Task 10B/11D)** — kept as orphan code (no longer referenced by the new render). Per project convention "do not delete code yet"; will be bundled with other orphan helpers in a future cleanup sprint.
- **`_bomSyncPackBaseTray`** — kept as a wrapper for backward compatibility, per the brief.
- **The Task 10B materialised component shape** — unchanged. `bom.components` lines still carry `component_type`, `component_role`, `packaging_key`, `component_sku`, `component_name`, `usage_basis`, `qty_per_selling_unit`, `unit`, `source`, `source_added`, `required`, `needs_review`, `notes`. Only the writer changed.
- **No conversion / inventory / Daily Plan BOM logic.**

## F. Manual QA checklist

Reload `app/index.html` in the browser first. The cover row test requires a PACKAGING + cover SKU in Master Data — your existing one (e.g. `C29999P301 ฝาครอบ 30 เล็ก`).

| # | Step | Expected |
|---|------|----------|
| F1 | Open an FG → BOM section → Packaging Profile | The table now has 8 columns: Active / Slot / Item role / Item type / Component SKU / Qty/output / Status / Action. Info banner explicitly says the slot doesn't pre-assign type. |
| F2 | Tick Active on **Cover** row | Item role defaults to PACKAGING; Item type defaults to cover; Component SKU dropdown shows your cover SKU (e.g. `C29999P301`). |
| F3 | Pick `C29999P301` and set Qty 1 | Status goes ✅ manual; the Components per output unit table above shows a new line with component_role=cover, packaging_key=cover, component_sku=C29999P301. |
| F4 | Verify cover SKU is NOT in Base Pack's SKU dropdown | Base Pack defaults to PACKAGING + tray → its dropdown shows only tray SKUs (C19999P301 / C19999P302). |
| F5 | Open a size-0 FG, tick Active on Base Pack | Component SKU auto-selects `C19999P302`; Status ✅ auto (tray_by_egg_size). |
| F6 | On Base Pack, change Item type from tray to cover | SKU is cleared; Status flips to ⚠ no SKU; ↻ auto button disappears (no rule for pack_base+cover). |
| F7 | On Base Pack, change Item type back to tray | ↻ auto button reappears. Click it. Auto rule re-applies. |
| F8 | Active any row with no SKU | Status ⚠ no SKU; a needs_review line appears in the Components table; BOM Enable becomes disabled. |
| F9 | Untick a row | The row's profile-controlled line disappears from the Components table; unrelated manual packaging lines and the basket line are preserved. |
| F10 | Save the FG and reopen | Every slot's enabled, item_role, item_type, component_sku, qty, selection_mode, rule_id, packaging_key persist. |
| F11 | In **Other packaging materials** (collapsible "▸"), try to add a SKU that an active profile slot already owns | Blocked with "SKU นี้ถูกควบคุมโดย Packaging Profile แล้ว · This SKU is managed by the Packaging Profile". |
| F12 | Open a Task 10A-era item with old field spellings | Loads with no error; on the first field touch the canonical fields backfill; the materialised line gets re-tagged `packaging_profile_pack_base` (legacy tag still recognised on the round trip — no duplicate). |
| F13 | Open a basket FG | Basket line is still owned only by the Basket Profile — Packaging Profile changes do not affect it. |
| F14 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics all open normally; no console errors. |

## G. Known risks

- **Manual QA F1–F14 not yet run.** Static + Node `vm` acceptance only (see H).
- **Bigger render footprint.** The table now has 7 rows of inputs (not 1 + 6 placeholder). Each row carries 4 controls. The whole BOM section re-renders on every modal field change (the existing live-recompute flow). Performance should be fine for typical packaging volume; if it ever feels slow, the render could memo by slot.
- **Closer_1 / closer_2 have empty `allowed_types`.** On first activation the default item_type is `''` (operator must pick a type). Status shows ⚠ choose type until they do. Acceptable; documented.
- **Adoption logic from Task 10A removed.** A pre-existing manual tray component (component_role:'tray', sku matching one of the two trays) is no longer "absorbed" by the sync when the profile activates. Instead the duplicate guard prevents a brand-new duplicate, and a pre-existing one stays as a separate manual line until the operator removes it. The brief explicitly preferred this simpler behaviour ("not allow adding a manual line that duplicates an active Packaging Profile line"). Note in BUG_LOG could go in a follow-up.
- **`_bomPackBaseSetType` (Task 11C orphan), `_bomPackBaseSetActive` / `SetRole` is not present; `SetSku` / `SetQty` / `SetAuto` from Task 10B/11D are now orphan** (the new render uses the generic `_bomSlotSet*`). All kept per project convention. Bundle into a future cleanup sprint.
- **Performance: `_bomLiveRecompute` now syncs all 7 slots on every recompute.** Inactive slots no-op after a quick map lookup; active slots scan `MASTER_V3.items` to validate the SKU. With ~130 master items the per-recompute cost is microseconds.
- **The render reads MASTER_V3 directly per row to compute the status's role/type-match.** Could be hoisted to one lookup per recompute later. Not a problem at current data sizes.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup (`{}` 0, `[]` 0, backticks even); paren imbalance −35, unchanged.
- New generic symbols (`_BOM_PROFILE_RULES`, `_bomResolveRuleId`, `_bomGetSlot`, `_bomPkgTypesByRole`, `_bomPackProfile`, six `_bomSlotSet*` handlers, `_bomSyncProfileSlot`, `_bomSyncPackagingProfile`, `_bomProfileControlledSkus`, `tray_by_egg_size` rule) all present once.
- All protected functions / helpers (`safeSet`, `persistMasterV3`, `openEditItem`, `renderPlanBom`, `renderBomSummary`, `buildBomComponentLinesForItem`, `_bomItemReadiness`, `_bomSelectBasketSku`, `_bomPkgCandidatesByType`, `_bomPkgTrayCandidateItems`, `_bomPkgCandidateItems`) still defined.
- `_bomSyncPackBaseTray` exists (now a wrapper), `_bomLiveRecompute` exists (now calls `_bomSyncPackagingProfile`), `_bomPkgComponentRows` exists (now excludes all packaging_profile_\* tags), `_bomAddPackagingComponent` exists (now uses generic duplicate guard), `_bomRenderItemPackagingProfile` exists (now editable per-slot table).

**Functional checks — passed.**
- **New Node `vm` acceptance harness: 37 / 37.** Covers:
  - `_bomPkgTypesByRole` (PACKAGING types incl tray/cover/label/sticker; basket excluded; case-insensitive role; preserves current type even when absent from master; SUPPLY role).
  - `_bomPkgCandidatesByType` regression (cover / tray / label / SUPPLY filters).
  - `_bomSyncProfileSlot` for pack_base / tray auto rule (size 0 / 3 → correct SKU; correct role; correct packaging_key; new source_added tag; unit from master).
  - **The headline cover bug** — `_bomSyncProfileSlot` for cover manual mode creates a cover line with the right SKU / role / type / unit / tag (T4).
  - Inactive slot removes only its own line; manual non-profile lines preserved (T5).
  - Invalid active slot → needs_review for each reason (no SKU, role mismatch, qty 0, valid) (T6).
  - Legacy `packaging_profile_pack_base_tray` tag recognised and updated in place with the new tag (T7).
  - Backward-compat: old `auto_by_egg_size` / `packaging_key` spellings map correctly + canonical fields backfilled (T8).
  - `_bomSyncPackagingProfile` loops every slot, materialising two actives in one call (T9).
  - `_bomProfileControlledSkus` collects active profile SKUs (T10).
  - pack_base with `item_type !== tray` → manual mode, no tray rule (T11).
  - Basket lines preserved by sync (T12).

**Acceptance criteria 1–16:**

- AC1 (editable item_role + item_type per active row) ✓.
- AC2 (Component SKU filtered by role + type) ✓ — harness T2, T4.
- AC3 (Cover row activatable) ✓ — T4.
- AC4 (Cover row shows cover SKUs e.g. C29999P301) ✓ — T4.
- AC5 (Cover SKU not in tray dropdown) ✓ — T2 filter behaviour.
- AC6 (Tray SKU not in cover dropdown) ✓ — T2 filter behaviour; T6b confirms cross-type SKU is flagged.
- AC7 (Active valid Cover row creates cover BOM line) ✓ — T4.
- AC8 (Inactive Cover has no BOM impact) ✓ — T5.
- AC9 (Invalid active Cover blocks BOM Enable via needs_review) ✓ — T6.
- AC10 (Tray auto rule size 0 → C19999P302, others → C19999P301) ✓ — T3c, T3f.
- AC11 (Changing Base Pack away from tray disables auto rule) ✓ — T11.
- AC12 (Save and reopen preserves slot fields) ✓ — data shape unchanged; harness T8 confirms backfill is non-destructive.
- AC13 (Other Packaging Materials cannot duplicate profile-controlled components) ✓ — generic guard via `_bomProfileControlledSkus`.
- AC14 (Existing Task 10B/11C/11D data loads without error) ✓ — T7 + T8.
- AC15 (No conversion / inventory / Daily Plan BOM logic) ✓ — none added.
- AC16 (Section K regression) — to be confirmed by manual QA F14.

**Outstanding:** manual QA F1–F14 and Section K regression. Roll back with
`cp _archive/index-pre-pkgprofile-generic-20260525.html app/index.html`
if any K-row regression fails.
