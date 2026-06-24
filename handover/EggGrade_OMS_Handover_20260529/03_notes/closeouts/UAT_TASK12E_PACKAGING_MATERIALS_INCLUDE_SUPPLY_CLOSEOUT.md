# UAT Pro · Task 12E — Packaging materials editor: include SUPPLY items — Closeout

**Date:** 2026-05-27
**Trigger:** User screenshot showing the "Packaging materials" (manual editor below the Packaging Profile) with an empty SKU dropdown. The user's master data has all 5 PACKAGING items marked `item_type='basket'` (per UAT-043), so the previous PACKAGING-only filter returned zero candidates.
**Root cause:** Task 12D updated `_bomPkgCandidatesByType` (used by the Packaging Profile rows) to include both PACKAGING and SUPPLY items. But the **separate** function `_bomPkgCandidateItems()` (used by the "Other packaging" / `_bomRenderItemPackagingEditor` below the Profile) was not touched and still restricted to `item_role='PACKAGING'` AND `item_type != 'basket'`.
**Fix:** Apply the same rule here — PACKAGING OR SUPPLY, still exclude baskets. Also fix three remaining inline bilingual labels in this section (title, subtitle, bottom hint).
**Out of scope:** stored data shape, BOM math, Daily Plan BOM, Orders, Planning, Logistics, `option_sets`, `oms-production/`, Task 12B Supply Unit deprecation paths.

---

## A. Backup

- **Backup file:** `_archive/index-pre-task12e-pkgmat-supply-20260527.html`
- **Pre-edit MD5:** `2f0b079d8b3c0a4b8a1d7b37ce301310` (post-Task-12D state)
- **Post-edit MD5:** `c885ab4e8d47c458abb5273b87ba7382`

**Rollback:**

```bash
cp _archive/index-pre-task12e-pkgmat-supply-20260527.html app/index.html
```

---

## B. Sections / functions changed

Five anchored edits in `_bomRenderItemPackagingEditor` and `_bomPkgCandidateItems`:

1. **`_bomPkgCandidateItems()`** (~line 23833) — the candidate filter for the "Packaging materials" SKU dropdown now accepts items where `item_role` is PACKAGING **or** SUPPLY (and `item_type != 'basket'`, `is_placeholder !== true`). Same semantics as `_bomPkgCandidatesByType` after Task 12D.
2. **Empty-state warning** (~line 23951) — when no eligible SKUs exist, the warning now reads:
   - TH: `⚠ ไม่พบ SKU วัสดุที่ใช้ได้ใน Master Data — สร้างสินค้าที่ Item role = PACKAGING หรือ SUPPLY (ไม่ใช่ตะกร้า) ก่อน จึงจะเพิ่มวัสดุได้`
   - EN: `⚠ No PACKAGING or SUPPLY SKUs found — create an item with Item role = PACKAGING or SUPPLY (non-basket) first.`
3. **Section subtitle** (~line 23882) — was a bilingual inline string mentioning "PACKAGING SKU"; now wrapped in `_lng()` with updated wording mentioning both PACKAGING and SUPPLY.
4. **Section title** (~line 23881) — was `วัสดุบรรจุภัณฑ์ · Packaging materials` inline; now `_lng('วัสดุบรรจุภัณฑ์', 'Packaging materials')`.
5. **Bottom helper hint** (~line 23949) — was bilingual inline; now wrapped in `_lng()`.

Net delta:

| | Before | After | Δ |
|---|---:|---:|---:|
| Lines | 26,641 | 26,648 | +7 |
| Bytes | 1,583,800 | ~1,584,300 | +~500 |
| `{` `}` balance | identical | identical | 0 |
| `(` `)` imbalance | −35 | −35 | 0 |
| `[` `]` balance | identical | identical | 0 |
| `node --check` × 8 inline JS blocks | n/a | passes | — |
| Task 12B acceptance harness | passing | **27 / 27 pass** | — |
| PACKAGING-or-SUPPLY filter occurrences | 1 (Task 12D) | **2** | +1 |

---

## C. Operator-visible result

### Before

- Open Item editor → BOM section → "Packaging materials" (vัสดุบรรจุภัณฑ์).
- Category dropdown defaults to Tray.
- PACKAGING SKU dropdown shows only `— Choose a PACKAGING SKU —` placeholder (no items).
- Operator cannot add any "other" packaging materials beyond the Packaging Profile slots.

### After

- Open Item editor → BOM section → "Packaging materials".
- Section title is single-language (Thai or English per LANG).
- Subtitle now reads: "…picked from any PACKAGING or SUPPLY SKU in Master Data" / "…เลือกจาก SKU ที่บทบาทเป็น PACKAGING หรือ SUPPLY ใน Master Data".
- PACKAGING SKU dropdown lists every master item whose `item_role` is PACKAGING **or** SUPPLY and whose `item_type` is not `basket`. Inactive items appear with `(inactive)` suffix only if currently selected.
- If the operator's master has no such items at all, the warning reads "⚠ No PACKAGING or SUPPLY SKUs found — create an item with Item role = PACKAGING or SUPPLY (non-basket) first" — actionable next step.

### Category dropdown behavior

The Category dropdown (Tray / Cover / Label / Sticker / Pack material / Other) is **metadata only** — it tags the stored `component_role` for the line but does not filter the SKU dropdown. Operators can pair any category with any eligible SKU. This matches the existing data model (Task 11E).

---

## D. What did not change

- **No stored data shape changes.** `bom.components[]` entries written by `_bomAddPackagingComponent` still have the same fields (`component_role`, `component_sku`, `component_name`, `qty_per_selling_unit`, `unit`, `usage_basis`, etc.).
- **No BOM math changes.** Confirmed by harness 27/27.
- **`renderPlanBom` (Daily Plan BOM) untouched.** Out of scope per project §6.
- **`MASTER_V3.option_sets` untouched.**
- **`oms-production/` untouched.**
- **Task 12B Supply Unit deprecation intact.** 4 forbidden DOM patterns still count = 0; harness 27/27.
- **Tasks 12C-R / 12C-R2 / 12D intact.** The `_lng()` helper and previous LANG-aware sweeps remain. Task 12D's Packaging Profile column shrink and auto-rule deprecation are unaffected.

---

## E. QA / smoke check

### Static checks (all green)

| Check | Result |
|---|---|
| `{` `}` delta | **0** |
| `(` `)` delta | **0** (pre-existing −35 preserved) |
| `[` `]` delta | **0** |
| `node --check` on all 8 inline JS blocks | **all pass** |
| Old strict-PACKAGING filter in `_bomPkgCandidateItems` | **count = 0** |
| Old PACKAGING-only warning text | **count = 0** |
| New PACKAGING-or-SUPPLY warning text (TH + EN) | **count = 1** each |
| PACKAGING-or-SUPPLY role filter in source (across both candidate functions) | **2 occurrences** |
| Task 12B forbidden DOM patterns | **count = 0** |
| Task 12B acceptance harness | **27 / 27 pass** |

### Recommended visual spot-check

1. Open an FG with at least one master item where `item_role` is PACKAGING or SUPPLY and `item_type != 'basket'` (e.g. a tray / cover / label / sticker / pack-material item).
2. Open Item editor → BOM section → "Packaging materials" sub-editor.
3. The PACKAGING SKU dropdown should list those items. Pick one, enter Qty / output, click `+ Add material`. The line appears in the table above.
4. If the operator's master has zero eligible items, the warning text now mentions both PACKAGING and SUPPLY as acceptable roles.
5. Switch LANG toggle: title, subtitle, table headers, warning, and bottom hint all switch single-language.
6. The Packaging Profile section above is unaffected by this fix; it still uses Task 12D's 6-column layout.

---

## F. Known risks / BUG_LOG

`docs/BUG_LOG.md` was NOT updated — this is a follow-up corrective fix to Task 12D, not a new bug. The previously logged UAT-043 ("All PACKAGING items in the current master are `item_type=basket`") was the root cause this fix addresses for the "Other packaging" editor; the workaround it suggested (create a non-basket PACKAGING SKU) is now broadened — operators may also create SUPPLY items.

### Risks flagged

1. **🟢 SUPPLY items in the Packaging materials dropdown.** If operators have SUPPLY items (e.g. consumables) in master, those will now appear in the dropdown alongside PACKAGING items. This is the user-requested behavior. If visually confusing, a future micro-pass could add a role suffix to the option label (e.g. `SKU — name (SUPPLY)`).
2. **🟢 Empty `item_type` items are still excluded.** The dropdown only shows items whose `item_type` is set (and not `basket`). Items with empty `item_type` won't appear — same as before this task.

---

## G. Rollback command

```bash
cp _archive/index-pre-task12e-pkgmat-supply-20260527.html app/index.html
```

Reverts only Task 12E. Tasks 12B / 12C-R / 12C-R2 / 12D remain intact.

---

## H. Final verdict

**Ready for UAT testing.**

The "Packaging materials" sub-editor's PACKAGING SKU dropdown now lists items where `item_role` is PACKAGING or SUPPLY (still excluding baskets). Combined with Task 12D's identical change to the Packaging Profile rows, both packaging-related dropdowns in the Item editor now share the same candidate model. Static checks green; Task 12B harness still 27/27.
