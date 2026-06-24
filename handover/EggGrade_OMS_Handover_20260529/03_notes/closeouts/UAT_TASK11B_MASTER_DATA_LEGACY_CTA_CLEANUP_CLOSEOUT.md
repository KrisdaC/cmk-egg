# UAT Task 11B — Master Data Legacy CTA Cleanup — Closeout

**Date:** 2026-05-25
**Branch:** UAT single-file (`app/index.html`)
**Status:** Ready for UAT testing (manual QA below not yet run)
**Pre-edit app MD5:** `193180d9008557d8d53a954b5e36a88e`
**Post-edit app MD5:** `1c7937dbf5240b8f5c2b1dc3cdfaf5ae`
**Rollback:** `cp _archive/index-pre-master-cta-cleanup-20260525.html app/index.html`

A small, visual-only cleanup of the Master Data header CTA cluster. The
**🧪 BOM Bulk Upload** button (deprecated by Task 10C / UAT-049) is now
visibly marked Deprecated, the **🗑 Clear Master Data** button is visibly
labelled Danger, and three tiny group labels ("Admin", "Legacy", "Danger")
separate the right-side button cluster into Admin tools / Legacy / Danger
Zone. Zero changes to any click handler, zero changes to business logic.

Four anchored edits, all inside the Master Data toolbar (lines ~2180–2200
in `app/index.html`). No JS function modified. `node --check` clean on all 7
inline `<script>` blocks; brace / paren / bracket / backtick balance
identical to the backup.

---

## A. Files changed / created

| File | Change |
|---|---|
| `app/index.html` | 4 anchored edits, all in the Master Data toolbar (`.v3-toolbar`). +1,543 bytes / 3 visible diff hunks at lines 2180, 2183, 2190. No JS or business logic changed. |
| `_archive/index-pre-master-cta-cleanup-20260525.html` | NEW — pre-edit snapshot, MD5-verified identical (`193180d9008557d8d53a954b5e36a88e`) before any edit. |
| `_archive/closeouts/UAT_TASK11B_MASTER_DATA_LEGACY_CTA_CLEANUP_CLOSEOUT.md` | NEW — this file. |
| `docs/BUG_LOG.md` | **Not touched.** No new risk introduced — Task 10C's UAT-049 already covers the deprecation; this sprint operationalises it visually. |
| `docs/DEV_HANDOVER_2026-05-25.md` | **Not touched.** |

## B. UI changes made

The Master Data header toolbar is reorganised by **labels only** — buttons stay
in the same flex row in the same order, with three small inline group labels
now separating them:

```
[Primary group]                                                                                                  [Right cluster]
[+ Add Customer / Site / Item]  [search]  [Show inactive]  ...flex spacer...  [Admin] ⬆ Import ・ [Legacy] 🧪 BOM Bulk Upload ⚠ Deprecated ・ ส่งออก JSON ・ 🔄 Restore  |  [⚠ Danger] 🗑 Clear
```

- **`Admin · เครื่องมือผู้ดูแล`** — small uppercase grey label inserted just before the **⬆ Import Master Excel** button. It groups Import / Export / Restore visually as admin tools without restructuring the layout.
- **`Legacy · เครื่องมือเก่า`** — small uppercase amber label inserted just before the **🧪 BOM Bulk Upload** button. The button itself is now visually muted (`background:#FAFAFA`, italic, dashed grey border, grey text) and carries a small inline pill `⚠ Deprecated` with an amber background. Tooltip rewritten to spell out the deprecation in Thai + English and point at UAT-049 / Task 10C.
- **`⚠ Danger · เขตอันตราย`** — small uppercase red label inserted right after the existing visual separator (`1px height:24px`) that already sits before the Clear button.
- **🗑 Clear Master Data** — styling strengthened: light-red background (`#FEF2F2`), dashed red border (`#F87171`), bold font; tooltip rewritten to include the word "DANGER" + a "no undo" warning and a pointer to the header strip's **⬇ Backup now** button. The button text itself is unchanged (the `data-i18n="master_btn_clear"` key is preserved).

Buttons unchanged in this sprint:
- **+ Add Customer / + Add Site / + Add Item** (`v3AddBtn`) — remains the primary CTA (blue, bold, no change).
- **⬆ Import Master Excel** — same look, only now visually preceded by the "Admin" group label.
- **ส่งออก JSON · Export** and **🔄 Restore Master JSON** — same look.

## C. Deprecated UI marked

The **🧪 BOM Bulk Upload** button now carries three independent deprecation signals:

1. **Inline pill** — visible "⚠ Deprecated" amber badge next to the button label.
2. **Visual demotion** — background `#FAFAFA`, text grey `#9CA3AF`, italic font, dashed grey border. It no longer looks like a primary CTA.
3. **Tooltip / `title` attribute rewritten** to: *"⚠ Deprecated · เลิกใช้สำหรับงานใหม่ — ใช้ Master Data item editor แทน · Deprecated — do not use for new packaging SKUs. Use the Master Data item editor instead. See UAT-049 / Task 10C closeout. The button still works for legacy round-trip."*

Plus the new **"Legacy · เครื่องมือเก่า"** group label preceding it makes the
classification visible in the toolbar even without hovering.

**The click handler `onclick="openBomBulkUpload()"` is unchanged** — the button
remains fully functional for legacy round-trip exactly as Task 10C committed
to. Verified: `grep -Fc 'onclick="openBomBulkUpload()"' app/index.html` = 1.

## D. Danger-zone UI marked

The **🗑 Clear Master Data** button now carries four danger signals:

1. **"⚠ Danger · เขตอันตราย"** group label inserted right after the existing
   visual separator — operator sees the danger zone marker before the button.
2. **Light-red background** (`#FEF2F2`) — distinct from any other button on the page.
3. **Dashed red border** (`#F87171`, upgraded from the previous lighter `#FCA5A5`).
4. **Bold font weight** and **tooltip rewritten** to spell out "DANGER", "no undo",
   and to direct the operator to the header strip's **⬇ Backup now** action
   before clicking.

The existing `class="btn btn-danger"`, `data-i18n="master_btn_clear"`, and the
inner text (`🗑 ล้างข้อมูล Master · Clear`) are preserved so the i18n system
still resolves the label on language switch. The `onclick="clearMasterV3()"`
handler is unchanged.

## E. What was intentionally not changed

- **`oms-production/`** — not touched.
- **`safeSet`**, **`persistMasterV3`**, the **header strip**, **`MASTER_V3.option_sets`**, **PO parsers**, **Orders**, **Daily Planning**, **`renderPlanBom`**, **`renderBomSummary`** (orphan UI flagged in the Task 11A inspection — deletion deferred to a future sprint with proof), **ใบน้อย**, **Logistics**, **BOM_DONE_KEY**, **`persistBomDone`** — all untouched. Verified by file diff: the only changes are 4 hunks in lines 2180–2193 (the Master Data toolbar).
- **All click handlers** — `openBomBulkUpload`, `clearMasterV3`, the file-input clickers for Import and JSON Restore, and `exportMasterV3` — are unchanged. Verified by `grep -Fc` each = 1.
- **`buildBomComponentLinesForItem`**, **`_bomItemReadiness`**, the **Packaging Profile / Basket Profile / Egg Profile** stack, **`renderPlanBom`** — all untouched. This is a UI-skin sprint only.
- **The `+ Add Customer / Site / Item` primary CTA (`v3AddBtn`)** — unchanged. Still the primary action with the same styling.
- **Item editor (`openEditItem`) and the New Item flow** — not touched. The canonical "add new packaging SKU" path now flagged by Task 10C remains exactly as it was.
- **`bom_material.*`** data-at-rest on existing items — left alone.
- **No dropdown / collapsed-drawer restructure** was performed. The brief allowed it as preferred but said "if too risky, do the minimum." The minimum (group labels + visual deprecation + danger affordance) was sufficient to satisfy all acceptance criteria without restructuring the flex toolbar.
- **`docs/BUG_LOG.md` and `docs/DEV_HANDOVER_2026-05-25.md`** — not touched. No new risk was introduced; Task 10C's UAT-049 already documents the deprecation, and this sprint just operationalises it visually.

## F. Manual QA checklist

Reload `app/index.html` in the browser first.

| # | Step | Expected |
|---|------|----------|
| F1 | Open Master Data tab | The toolbar shows: Add button, search, Show inactive on the left; on the right cluster you can read "**Admin**" before Import, "**Legacy**" before BOM Bulk Upload, and "**⚠ Danger**" before Clear |
| F2 | Look at 🧪 BOM Bulk Upload | Greyed background, dashed border, italic text, a small "⚠ Deprecated" amber pill next to the label |
| F3 | Hover over 🧪 BOM Bulk Upload | Tooltip reads "⚠ Deprecated · เลิกใช้สำหรับงานใหม่ — ใช้ Master Data item editor แทน · ..." with the UAT-049 / Task 10C reference |
| F4 | Click 🧪 BOM Bulk Upload | Still opens the legacy importer file picker (handler unchanged); preview-then-commit flow still works for legacy Packaging.xlsx files |
| F5 | Look at 🗑 Clear Master Data | Light-red background, dashed red border, bold font; preceded by the "⚠ Danger" red label |
| F6 | Hover over 🗑 Clear Master Data | Tooltip starts with "⚠ DANGER" and warns about no-undo + ⬇ Backup now |
| F7 | Click 🗑 Clear Master Data | Same destructive flow as before (handler unchanged) — confirmation dialog appears as before; pressing Cancel keeps the data |
| F8 | Click + Add Customer / Add Site / Add Item | Still opens the item editor with the same flow; primary CTA unchanged |
| F9 | Click ⬆ Import Master Excel, ส่งออก JSON, 🔄 Restore Master JSON | All three still work exactly as before; only the "Admin" group label is new |
| F10 | Switch language (TH ↔ EN) | The data-i18n labels still translate. The new group labels are bilingual and don't depend on i18n |
| F11 | `QA_CHECKLIST.md` Section K regression | Orders / Daily Planning / Daily Plan BOM / Master Data / Controlled Lists / ใบน้อย / Logistics open normally; no console errors |

## G. Known risks

- **Manual QA F1–F11 not yet run** — static checks only (see H).
- **The Master Data toolbar is a flex row with no wrapping rules added.** Adding three small inline labels (`Admin`, `Legacy`, `⚠ Danger`) widens the right cluster by ~120 px in total. On the typical operator screen this fits; on a narrow viewport some buttons may shift to a second row (the toolbar already wraps for the existing controls). Acceptable; no new BUG_LOG row.
- **The visible "⚠ Deprecated" pill is rendered inside the button's innerHTML**, which means an i18n language switch that calls `el.innerText = '...'` would erase it. The BOM Bulk Upload button has **no `data-i18n` attribute**, so the i18n system does not touch its content. Verified by `grep` — no `data-i18n` on that button.
- **The orphan `renderBomSummary` UI surface flagged by Task 11A is still in the codebase** but is unreachable from the live DOM (its host `id="bomHost"` does not exist). This sprint did not address it; deletion-with-proof is deferred to a later cleanup sprint per the Stage 5 plan in the Task 11A report.

## H. Final verdict — tests run

**Ready for UAT testing.**

**Static checks — passed.**
- `node --check` clean on all 7 executable inline `<script>` blocks.
- Brace / bracket / backtick balance identical to the backup (`{}` 0, `[]` 0, backtick even); paren imbalance −35, unchanged.
- All 5 click handlers (`openBomBulkUpload`, `clearMasterV3`, `importFileInput`-click, `exportMasterV3`, `masterJsonRestoreInput`-click) verified `grep -Fc = 1`.
- Diff = exactly 3 hunks at backup lines 2179a2180, 2181c2183, 2186c2190 — confined to the Master Data toolbar.

**Functional check — none needed.**
- No JS function was modified; node `--check` covers syntax. There is no behaviour change to test in a `vm` harness.

**Acceptance criteria 1–10:**
- AC1 (BOM Bulk Upload no longer looks primary) ✓ — italic, grey, dashed border.
- AC2 (Clearly says Deprecated / Legacy / Do not use for new work) ✓ — visible pill + group label + tooltip.
- AC3 (Import / Export / Restore visually understood as admin tools) ✓ — "Admin" group label.
- AC4 (Clear Master Data visually separated as dangerous) ✓ — "⚠ Danger" label + reinforced styling + tooltip.
- AC5 (Add Customer / Site / Item remains easy and primary) ✓ — unchanged.
- AC6 (No business logic changes) ✓ — zero JS function modified.
- AC7 (BOM Bulk Upload still works) ✓ — handler unchanged, verified by grep.
- AC8 (Section K regression) — to be confirmed by operator manual QA (F11).
- AC9 (Static smoke check passes) ✓ — see above.
- AC10 (Closeout written) ✓ — this file.

**Outstanding:** manual QA F1–F11 and Section K regression. Roll back with
`cp _archive/index-pre-master-cta-cleanup-20260525.html app/index.html` if any
K-row regression fails.
