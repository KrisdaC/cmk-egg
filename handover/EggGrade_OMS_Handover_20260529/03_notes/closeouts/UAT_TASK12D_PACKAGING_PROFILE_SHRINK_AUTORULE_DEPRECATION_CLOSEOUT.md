# UAT Pro · Task 12D — Packaging Profile shrink + auto-rule deprecation — Closeout

**Date:** 2026-05-27
**Trigger:** User screenshot + instruction: "Depreciate auto mapping of BOM to SKU so status and the last column is un nessarily / item role no need to select pre-select of both supply and packaging cut the column."
**User decisions (AskUserQuestion):**
1. Auto-rule = **Fully deprecate** — force all rows to manual; existing `auto_by_rule` rows convert to `manual` on next render (the rule machinery is kept defined for backward compat but no longer fires).
2. Component SKU filter = **PACKAGING OR SUPPLY** — drop `item_role` selection, SKU dropdown shows items where role is either PACKAGING or SUPPLY (filtered by `item_type`).
3. Final columns = **Active · Slot · Item type · Component SKU · Qty / pack · Qty / selling unit** (6 columns; drop Item role, Status, Action).
**Out of scope:** stored data shape, BOM math, Daily Plan BOM (`renderPlanBom`), Orders, PO Intake, Daily Planning, ใบน้อย, Logistics, `MASTER_V3.option_sets`, `oms-production/`, Task 12B Supply / Issue Unit deprecation, all earlier UI language work (Tasks 12C-R / 12C-R2).

---

## A. Backup

- **Backup file:** `_archive/index-pre-task12d-packprofile-shrink-20260527.html`
- **Pre-edit MD5:** `2886574912d17e45347134d27fa9143f` (the post-Task-12C-R2 state from earlier today)
- **Post-edit MD5:** `2f0b079d8b3c0a4b8a1d7b37ce301310`

**Rollback (single command):**

```bash
cp _archive/index-pre-task12d-packprofile-shrink-20260527.html app/index.html
```

Reverts only Task 12D. Tasks 12B / 12C-R / 12C-R2 remain.

---

## B. Sections / functions changed

Net delta:

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,650 | 26,641 | **−9** |
| Bytes (UTF-8) | 1,584,300 | ~1,583,800 | −~500 |
| `{` / `}` balance | identical | identical | 0 |
| `(` / `)` imbalance | −35 (pre-existing) | −35 (preserved) | 0 |
| `[` / `]` balance | identical | identical | 0 |
| `node --check` across all 8 inline JS blocks | n/a | passes | — |
| Task 12B acceptance harness (27 assertions, 5 cases) | passing | **27 / 27 still pass** | — |

The negative line delta reflects the removed table cells. Brace/paren/bracket balance is preserved because each removed `<td>` / `<th>` is a JS string-concat that contributes equal opens and closes.

Ten anchored string replacements via a single Python script (`/sessions/.../outputs/apply_task12d.py`):

1. **`_bomRenderItemPackagingProfile` thead** (~line 24560) — removed the `<th>` cells for Item role, Status, and the trailing `<th> </th>` action header. Header now has 6 cells: Active · Slot · Item type · Component SKU · Qty / pack · Qty / selling unit.
2. **`_bomRenderItemPackagingProfile` row HTML** (~line 24692) — removed the `<td>` cells for `roleCell`, `statusCell`, `actionCell`. The variables `roleCell`, `roleOpts`, `roleInList`, `statusCell`, `actionCell` are still computed in the row scope (dead reads) — left in place per project convention to keep the diff small and reversible.
3. **Top descriptive hint** (~line 24553) — dropped "item_role" from the operator-facing wording ("…activatable with its own item_role / item_type / SKU" → "…with its own item type and SKU").
4. **Sequence hint** (~line 24555) — sequence is now `Slot → Item type → Component SKU → quantity` (was `Slot → item_role → item_type → Component SKU → quantity`). The hint also explains that the SKU dropdown now shows any PACKAGING or SUPPLY item matching the type.
5. **Bottom auto-rule hint** (~line 24722) — the "pack_base + tray uses the egg-size auto rule…" paragraph was removed entirely and replaced with a one-line code comment.
6. **`_bomPkgCandidatesByType`** (~line 24161) — the `itemRole` parameter is now ignored; the function returns master items where `item_role` is PACKAGING **or** SUPPLY (and `item_type` matches). The Task 11C-era `_bomPkgTrayCandidateItems` wrapper still works.
7. **`_bomSlotSetActive`** (~line 24296) — on slot activation, `selection_mode` is forced to `'manual'` and `rule_id` to `null`. No more `auto_by_rule` defaulting.
8. **`_bomSlotSetType`** (~line 24328) — on item_type change, `selection_mode` is forced to `'manual'`. The `_bomResolveRuleId` branch is removed.
9. **`_bomSyncProfileSlot`** (~line 24420) — the auto-rule resolution branch (`if (mode === 'auto_by_rule' && ruleId && _BOM_PROFILE_RULES[ruleId])`) is removed. Stored SKU is always read from `pp.component_sku`. Any item with stored `selection_mode='auto_by_rule'` now behaves as `manual` on render — the rule no longer fires.
10. **Render layer SKU preview** (~line 24622) — the `if (mode === 'auto_by_rule' && ruleId)` SKU preview block is removed; the dropdown always shows the operator-stored SKU.

The auto-rule machinery (`_BOM_PROFILE_RULES`, `_bomResolveRuleId`, `_bomSlotSetAuto`) is intentionally **kept defined** in `app/index.html` for backward compatibility — none of those functions are reachable from the UI anymore, and `_bomSyncProfileSlot` no longer invokes them, but stripping their definitions would widen the diff without changing operator-visible behavior. They are effectively dead code in the same family as UAT-013 / UAT-033 / UAT-037.

---

## C. UI before / after

### Packaging Profile table columns

| Before (9 columns) | After (6 columns) |
|---|---|
| Active · Slot · **Item role** · Item type · Component SKU · Qty / pack · Qty / selling unit · **Status** · **Action** | Active · Slot · Item type · Component SKU · Qty / pack · Qty / selling unit |

### Removed elements

- **"Item role" column.** Operators no longer pick PACKAGING vs SUPPLY per row. Stored `pp.item_role` defaults to `'PACKAGING'` on activation (existing rows keep whatever role they had); the Component SKU dropdown shows items in either role.
- **"Status" column.** No more `⚠ choose role / ⚠ choose type / ⚠ no SKU / ✅ auto (rule_id) / ✅ manual` per-row badge. The Components Table's "Status / Where to edit" column (a different table) still shows needs-review / locked-source badges and is the canonical place for those signals.
- **"Action" column.** No more `↻ auto` button or "by rule" indicator. With auto deprecated, there's nothing to switch back to.
- **Bottom "pack_base + tray: auto rule = tray_by_egg_size…" hint.** Removed.

### Behavior change

- **Existing items with `pp.selection_mode === 'auto_by_rule'`** (e.g. FGs with pack_base + tray active) will, on next render of the Item editor, show the **stored** `component_sku` rather than the rule-resolved one. For most items the two were already in sync because `_bomSyncProfileSlot` wrote the rule's SKU into `component_sku` during prior saves. For items where the rule had not yet been synced (e.g. brand-new tray slot just activated), the SKU will be empty and the operator must pick one.
- **No data was migrated.** `selection_mode='auto_by_rule'` and `rule_id` values remain in `MASTER_V3` for backward compatibility. The next time the operator clicks the Active checkbox or changes Item type on such a row, `_bomSlotSetActive` / `_bomSlotSetType` writes `selection_mode='manual'` and clears `rule_id`. Until then the stored values are simply ignored on render.
- **SKU dropdown** for any active slot now includes any master item whose `item_role` is `PACKAGING` or `SUPPLY` and whose `item_type` matches the row's item_type. Previously the dropdown was role-filtered to the row's `item_role`, which excluded SUPPLY items.

---

## D. What did not change

- **No stored data values changed.** `pp.item_role`, `pp.selection_mode`, `pp.rule_id` persist as-is across save/load. New rows write `item_role='PACKAGING'` + `selection_mode='manual'`.
- **No `bom.components[]` shape change.** `_bomSyncProfileSlot` still writes the same line shape (`component_role`, `component_sku`, `component_name`, `usage_basis`, `qty_per_selling_unit`, `source`, `source_added`, `needs_review`, `notes`).
- **BOM math unchanged.** `buildBomComponentLinesForItem`, `_bomOutputBaseFactor`, `_bomScaleFromSellingToOutput`, `_bomSellingEquivalentQty`, `_bomItemReadiness` — none of these were touched. Confirmed by harness §E.
- **`renderPlanBom` (Daily Plan BOM) untouched** per project §6 protected list.
- **`MASTER_V3.option_sets` untouched.** `ensureMasterOptionSets`, `reconcileControlledListsFromMasterData`, etc. were not edited.
- **Task 12B Supply / Issue Unit deprecation intact.** The 4 forbidden DOM patterns still count = 0; harness 27/27.
- **Tasks 12C-R / 12C-R2 LANG-aware labels intact.** The `_lng(th, en)` helper and 121 call sites are unchanged.
- **`_BOM_PROFILE_RULES` / `_bomResolveRuleId` / `_bomSlotSetAuto`** kept defined but unreachable from the UI. Removing them is a safe future cleanup.

---

## E. QA / smoke check

### Static checks (all green)

| Check | Result |
|---|---|
| `{`/`}` delta vs pre-task backup | **0** |
| `(`/`)` delta vs pre-task backup | **0** (pre-existing −35 preserved) |
| `[`/`]` delta vs pre-task backup | **0** |
| Line delta | **−9** (rows are 3 cells shorter; thead is 3 cells shorter; bottom hint is 1 paragraph shorter) |
| `node --check` on all 8 inline JS blocks | **all pass** |
| Removed `<th>` / `<td>` patterns (Item role, Status, Action) | **count = 0** |
| Packaging Profile shrunk-row block | **count = 1** (exact match) |
| `pp.selection_mode = 'manual'; pp.rule_id = null;` in `_bomSlotSetActive` | **present** |
| `// auto-rule deprecated. Always read` in `_bomSyncProfileSlot` | **present** |
| `_bomPkgCandidatesByType` accepts PACKAGING + SUPPLY | **present** |
| Old bottom auto-rule hint | **count = 0** |
| Task 12B forbidden DOM patterns | **count = 0** |
| **Task 12B acceptance harness (27 assertions, 5 cases)** | **27 / 27 pass** |

### Recommended visual spot-check (in the browser)

1. **Open the Item editor for an FG SKU → BOM section → Packaging Profile.** Verify the table has 6 columns: Active, Slot, Item type, Component SKU, Qty / pack, Qty / selling unit. No Item role column, no Status column, no Action column.
2. **Tick the Base Pack Active checkbox.** Confirm the Item type defaults to `tray`. Open the Component SKU dropdown — it should list items where role is PACKAGING **or** SUPPLY and type is `tray`. Pick one.
3. **Open an FG that previously had pack_base + tray as `auto_by_rule`.** Confirm:
   - The stored SKU (whatever was last persisted) shows in the SKU dropdown.
   - Editing the Item type → SKU clears (force manual). Selecting a new SKU saves it.
4. **Tick Cover / SKU barcode / Product label / Closer 1 / Closer 2 / Bulk barcode slots.** Each opens an SKU dropdown with PACKAGING or SUPPLY candidates matching the type. No more "PACKAGING / SUPPLY" role selector.
5. **Save the item, reload, reopen.** The selected SKUs persist. `selection_mode` for newly-activated rows reads `'manual'` in `localStorage.MASTER_V3` (DevTools Application tab). Pre-existing `'auto_by_rule'` values for unedited rows are still there (backward compat).
6. **BOM Components per output unit table** (above the Packaging Profile) still shows the same lines as before — the qty for each packaging line reads from the stored `qty_per_selling_unit` in `bom.components` (no behavior change).
7. **Test Calculation panel** still works — type a number and the table populates.
8. **No new console errors** when toggling slots or changing types.

---

## F. Known risks / BUG_LOG

`docs/BUG_LOG.md` was NOT updated — no real bug.

### Risks flagged in this closeout

1. **🟡 Brand-new tray slot may render with no SKU.** Previously, ticking pack_base + tray Active would auto-resolve the SKU via `tray_by_egg_size` (size 0 → C19999P302, others → C19999P301). With the rule deprecated, the new row has no SKU until the operator picks one. The needs-review badge in the Components table will indicate this. Mitigated by the SKU dropdown now showing both PACKAGING and SUPPLY candidates — finding C19999P301/P302 is one click.
2. **🟢 Items with `selection_mode='auto_by_rule'` in localStorage.** Their stored value is now ignored on render. The BOM line uses `pp.component_sku` as-is. If `pp.component_sku` was last written by `_bomSyncProfileSlot` during a save (the normal case), the rendered SKU equals the rule's last output and behavior is unchanged from the operator's perspective. If `pp.component_sku` was never written (rare — would require the operator to activate the slot, never save, and then re-open), the SKU will be empty. Operator can pick one to resolve.
3. **🟢 Dead code retained.** `_BOM_PROFILE_RULES`, `_bomResolveRuleId`, `_bomSlotSetAuto`, `_bomSlotSetRole`, plus the in-row `roleCell` / `statusCell` / `actionCell` variable computations are kept defined but unreachable. Removing them is a low-risk future cleanup; leaving them in keeps the rollback cleaner.
4. **🟢 The Component SKU dropdown now mixes PACKAGING and SUPPLY items.** Per the operator decision. The dropdown label shows `<SKU> — <name>`; operators may want a visual separator or grouping if SUPPLY items become common. Cosmetic follow-up if needed.

---

## G. Rollback command

```bash
cp _archive/index-pre-task12d-packprofile-shrink-20260527.html app/index.html
```

Single file, single command. Restores the Packaging Profile to its 9-column / auto-rule-enabled state; Tasks 12B / 12C-R / 12C-R2 remain intact.

---

## H. Final verdict

**Ready for UAT testing.**

The Packaging Profile now reads: Active · Slot · Item type · Component SKU · Qty / pack · Qty / selling unit. The auto-rule machinery is unreachable from the UI; all slot activations and item_type changes write `selection_mode='manual'`. The Component SKU dropdown shows both PACKAGING and SUPPLY candidates filtered by Item type. Task 12B Supply / Issue Unit deprecation and the Task 12C-R / 12C-R2 LANG-aware labels are intact; the Task 12B acceptance harness passes 27/27 as a regression gate.

**Stopped per the prior "stop after this task" instruction. No follow-up tasks started.**
