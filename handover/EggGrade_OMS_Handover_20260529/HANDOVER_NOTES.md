# Handover Notes — what changed between 2026-05-26 and 2026-05-29

This is the human-friendly diff. Each entry is one anchored sprint; full
detail lives in `03_notes/closeouts/UAT_TASK<N>_*.md`.

The whole period is two stories:

1. **BOM editor consolidation** (Task 10C → 12I): the legacy BOM Bulk
   Upload was deprecated; the Item editor's BOM section gained Egg
   Inputs / Basket / Packaging Profile as proper sub-cards with
   one-component-line logic.
2. **Master SKU Rebuild flow** (Task 13A-0A → 13A-3): a controlled
   per-section export → clean in Excel → import → preview → confirm →
   commit pipeline. Section by section: Identity + Counting & Units →
   Egg + Basket → BOM + Packaging.

---

## Phase A — BOM editor consolidation (10C → 12I)

| Task | Date | What it did | Why |
|---|---|---|---|
| **10C** | 05-25 | Deprecated **BOM Bulk Upload** (docs-only sprint). Functions kept callable; button gets a visible "⚠ Deprecated" pill in Task 11B. | Old importer replaces `bom.components` wholesale and bypasses Counting & Units. Modern path is the Master Data item editor. |
| **11B** | 05-25 | Master Data toolbar visual cleanup — Admin / Legacy / ⚠ Danger group labels; BOM Bulk Upload visibly demoted. | Operators were clicking destructive paths. |
| **11C** | 05-25 | Packaging Profile recognises **existing item_type** values (e.g. an item already typed "tray") even when not in the slot's allowed list. | Pre-existing items shouldn't be invalidated by a new UI taxonomy. |
| **11D** | 05-25 | Packaging Profile design correction: slot keeps an `allowed_types` SUGGESTION; the operator-chosen role+type drives the SKU picker. | Hard constraints would have re-broken existing data. |
| **11E** | 05-25 | Packaging Profile becomes a **generic slot editor** — every slot in `_BOM_PACKAGING_SLOTS` is now activatable with its own role/type/SKU/qty/mode. | Replaces hardcoded pack_base-only logic. |
| **11F** | 05-25 | Packaging SKU **base_unit gate** — the BOM line cannot be expressed unless the packaging SKU has a `units.base_unit`. | Avoids silent fall-back to "piece". |
| **11G** | 05-25 | Pack-base/tray slot's qty is **derived from the egg-tray rule** when in auto mode. Manual mode still allowed. | Operators were typing the same tray qty by hand. |
| **11H** | 05-25 | BOM basis = **production pack** (the operator's chosen pack), not a derived selling unit. | Clarifies the math basis used by the Test Calculation panel. |
| **12B** | 05-27 | **Supply / Issue Unit fully deprecated.** Form inputs deleted; legacy `units.has_consumable_unit / consumable_unit / base_per_consumable` preserved on save by deep-clone-then-overlay. Validator no longer warns on missing/legacy supply fields. | The supply layer was unused; preserving the field shape avoids data loss. |
| **12C / 12C-R / 12C-R2** | 05-27 | Global UI label consistency + BOM section becomes language-aware (TH/EN single-language render). | UX consistency before the rebuild flow. |
| **12D** | 05-27 | Packaging Profile **auto-rule deprecation** — every slot is now manual; operator picks the Component SKU explicitly. | Predictable behavior; rule-engine kept defined for backward compat. |
| **12E** | 05-27 | Packaging materials picker now includes **SUPPLY** items (not just PACKAGING). | Tape / labels / chemicals legitimately belong here. |
| **12F** | 05-27 | Packaging materials category filter fixed + "Other" dropdown bubble bug. | Operator usability. |
| **12G** | 05-27 | Manual packaging editor: category removed (Packaging Profile owns categories); manual rows are now generic "Additional materials". | Reduces redundancy between Profile and Manual editors. |
| **12H** | 05-28 | **Egg Inputs UI cleanup.** Replaced the technical egg_content_type dropdown (UNGRADED_EGG / UNDERGRADE / GRADED_SINGLE / GRADED_MIX) with operator-friendly 3-option select + Mixed grade checkbox. Hidden `data-f="egg_content_type"` preserves the canonical code; calc engine unchanged. Plus untick-Mixed fix-up — clear `secondary_grade` / `min_primary` so the BOM drops back to single-line correctly. | Operator language matches the operator's mental model. |
| **12H (others slot)** | 05-27 | Added an `other` slot to `_BOM_PACKAGING_SLOTS` for miscellaneous PACKAGING / SUPPLY materials. | Catch-all without breaking the existing 7-slot table. |
| **12I** | 05-27 | Item editor BOM section becomes a hierarchical card: 🥚 Egg Inputs → 🧺 Basket / Handling Unit → 📦 Packaging Profile under 🧪 BOM / Production Formula. | Sets up the parent structure that Task 13A-2 and 13A-3 build on. |

---

## Phase B — Master SKU Rebuild flow (13A-0A → 13A-3)

The **Master SKU Rebuild** section is the operator-facing card under
Master Data → Items. It's the controlled per-section workflow:

```
Step 1 — Identity + Counting & Units      ← Task 13A-1 + 13A-1A/B/C/D/E/F
Step 2 — Egg Inputs + Basket / Handling   ← Task 13A-2 + 13A-2B/C
Step 3 — BOM + Packaging Profile          ← Task 13A-3
```

| Task | Date | Headline |
|---|---|---|
| **13A-0A** | 05-28 | Inspection-only audit of every existing import/export path. Recommended Admin Tools / Hide / Keep / Do-not-touch classifications. **No code change.** |
| **13A-0B** | 05-28 | UI-only deprecation pass: moved Import Master Excel + Clear Master Data into a new ⚙ Admin Tools dropdown; hid the BOM Bulk Upload button from the toolbar; hid the duplicate Export All / Import All card in the Data tab. All hidden functions remain callable. |
| **13A-1** | 05-28 | **Step 1 export / import** for Identity + Counting & Units. 5 sheets initially (later cleaned by 13A-2B/C). Preview → diff → confirm → commit; deep-clone-then-overlay preserves out-of-scope sections. |
| **13A-1A** | 05-28 | Use ONLY `SKU_Identity_Units` as the import source; ignore the technical supporting sheets even when present. Plus a new `behavior_from_role_derived` review column from `_ROLE_BEHAVIOR_DEFAULTS`. |
| **13A-1B** | 05-28 | Basket-selling-unit fix: validate against the **merged post-overlay state**, so an FG SKU whose selling_unit is "ตะกร้า" but whose basket fields live on the existing item resolves correctly. Plus JSON-fallback parser. |
| **13A-1C** | 05-28 | "Validate only what the row writes" — blank cells preserve existing (no validation), filled cells validate. Matches the commit's overlay-only-when-non-blank rule. |
| **13A-1D** | 05-28 | Closes **UAT-019 / UAT-031** — `isOptionValueReferenced('unit', ...)` scanner extended to include `storage_unit` and `consumable_unit`. The auto-reconcile + auto-prune helpers now correctly count modern-field usage. |
| **13A-1E** | 05-28 | **One-time data repair tool** for role-derived behavior flags (PACKAGING items that came in with `is_sellable=true`). Preview → confirm → backup → apply → persist. Future imports also write `is_sellable / is_producable / is_consumable` from `_ROLE_BEHAVIOR_DEFAULTS[item_role]`. |
| **13A-1F** | 05-28 | **Selling_unit blocking matches the in-app validator** — only sellable roles (FG / DEFECT) block on unresolvable selling_unit; non-sellable roles (PACKAGING / RM / SUPPLY / WIP) warn instead. Plus preview's `action` column now reads `error` (not `unchanged`) when a row has errors. |
| **13A-2** | 05-28 | **Step 2 export / import** for 🥚 Egg Inputs + 🧺 Basket / Handling Unit. New SKUs are blocked (Step 1 owns creation). Deep-clone-then-overlay preserves Identity / Units / behavior / BOM / Packaging Profile. |
| **13A-2B** | 05-28 | Clean operator export templates: removed deprecated supply columns + derived columns from the main sheets; replaced technical sheets with `Behavior_Function_Summary` + `Dropdown_Reference`. Backward-compat: older files with derived columns still re-import cleanly. |
| **13A-2C** | 05-28 | Operator feedback applied: re-added `Validation_Rules` for review; new `Column_Info` sheet explicitly tags each column as read-only / review-only / editable; behavior summary restructured to be **behavior-driven** (3 sections: Behavior driver / Role default / Sub-section gate); Step 2 main sheet drops `egg_content_type` and puts `egg_input_type` first in chronological order. |
| **13A-3** | 05-29 | **Step 3 export / import** for 🧪 remaining BOM + 📦 Packaging Profile. Three editable data sheets: `SKU_BOM_Packaging`, `Packaging_Profile_Slots`, `BOM_Manual_Components` (manual rows are `source_added='packaging_editor'` only). Component classification — egg / basket / packaging_profile / manual / untagged — keeps every row in its rightful place. |

---

## What's still open

- **Task 13A-4** — External References / Legacy Customer Mapping
  export / import (next).
- **Task 13B** — Full Master SKU re-upload dry run.
- **Task 13C** — Confirmed commit / replace after dry-run is clean.

The Task 13A-* preview / diff / commit primitives + the
deep-clone-then-overlay pattern are reusable for 13A-4 and 13B/13C.

---

## Test status at handover

```
13A-1A: 18 / 18 PASS
13A-1C:  5 /  5 PASS
13A-1E: 18 / 18 PASS
13A-1F:  9 /  9 PASS
13A-2:  12 / 12 PASS
13A-2B: 14 / 14 PASS
13A-2C: 26 / 26 PASS
13A-3:   9 /  9 PASS
12H:    32 / 32 PASS
12H untick fix-up: 10 / 10 PASS
```

All harnesses live under `03_notes/harnesses/`. They run with
plain `node` (v22+). No npm install required.

---

*Handover prepared 2026-05-29. App MD5 eadbac2a24a6b75e09f05af3cec5c555.*
