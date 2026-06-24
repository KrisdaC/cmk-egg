# 02_data — Master Data seed files

## What's here

| File | Purpose |
|---|---|
| `demand_master_v3.json` | Canonical Master V3 seed (128 items as of 05-17). Used by the in-app **🔄 Restore Master JSON** path. |
| `demand_master_v3_corrected_v5_20260521.json` | The corrected v5 set from Task 7E re-import (125 items, ~382 field updates including pruned barcode prefixes, normalized T-series spacing, storage_unit migration). Use this for a clean start. |
| `Master_Packaging_SKUs_upload.xlsx` | Legacy two-sheet packaging workbook the old BOM Bulk Upload reads (DEPRECATED — kept only for round-trip with historical files). |

## Loading

Use **Master Data → Restore Master JSON** in the app. The path is the
operator-sanctioned re-import flow (Task 7E closeout) — it makes a
pre-restore backup, validates `customers/sites/items` arrays, preserves
existing `option_sets` if the file omits them, and re-renders Master
Data after restore.

Do NOT use the old Import Master Excel for these — it's an admin path
under ⚙ Admin Tools and won't accept JSON.

## Data shape

```
{
  "customers": [ { id, code, nickname, business_name, … }, … ],
  "sites":     [ { id, customer_id, site_code, display_name, … }, … ],
  "items":     [
    {
      id, sku, name (or name_th), name_en, item_role, item_type,
      partner_id, is_active, is_sellable, is_producable, is_consumable,
      selling_unit,
      units: {
        base_unit, base_per_pack, pack_unit,
        basket_unit, base_per_basket, has_basket_unit,
        storage_unit, base_per_storage,
        // Supply / Issue Unit — DEPRECATED (Task 12B); kept for backward compat
        has_consumable_unit, consumable_unit, base_per_consumable
      },
      is_egg, egg_content_type, primary_grade, secondary_grade, min_primary,
      packaging_profile: { <slot_role>: { enabled, item_type, component_sku, … } },
      bom: { enabled, no_bom_required, output_unit, notes, components: […], routes: […] },
      external_refs: { … },
      created_at, updated_at, created_from
    }, …
  ],
  "option_sets": {
    item_role: [...], item_type: [...], unit: [...], egg_content_type: [...],
    egg_grade: [...], delivery_type: [...], customer_type: [...], …
  },
  "meta": { version: 3, updated: <epoch_ms> }
}
```

## What NOT to do

- Don't edit JSON files by hand — the option_sets seeding has subtle
  ordering rules; use the in-app editor.
- Don't import these via the old Import Master Excel — that path is
  for `.xlsx` only.
- Don't replace `partner_id` values manually — they reference
  `customers[].id` (or `.code` as a fallback).
