# Developer Test Data Package — README

> **Purpose.** Specify the test data files the production dev team needs to validate each module of the new system against the UAT behavior. This document lists the expected file shapes, columns, and how each file maps to the tabs in `app/index.html`.
>
> **Source data.** The current UAT runs on `demand_master_v3_corrected_v5_20260521.json` (130 items, ~314 KB). Any uploaded order data lives in browser `localStorage` and is **not** included in this package by default — it must be exported per the export plan below.
>
> **Status.** The dev data files listed here are **specifications**. The dev team (or operator) generates the files via the export procedure in § 7.

---

## 1. Where this fits

The production team needs three kinds of data to build behavior parity with the UAT:

1. **Master Data seed** — the customers, sites, items, controlled lists. The current UAT master JSON is the source.
2. **Operational sample** — a representative day's worth of orders, planning, BOM done state. Exported from `localStorage`.
3. **Test cases** — synthetic edge / negative / positive cases per tab. Generated for QA.

This README covers all three.

---

## 2. File layout

```
docs/dev_test_data/                                ← target output folder
├── README.md                                       ← this file (copied here from production_handover)
├── master/
│   ├── demand_master_v3.json                       ← master seed (existing)
│   ├── Master_Customers.csv                        ← flat CSV view of customers
│   ├── Master_Sites.csv                            ← flat CSV view of sites
│   ├── Master_Items.csv                            ← flat CSV view of items
│   ├── Item_Unit_Conversions.csv                   ← flat view of item.units.*
│   ├── Item_Egg_Profile.csv                        ← flat view of egg fields
│   ├── Item_Basket_Profile.csv                     ← flat view of basket fields
│   ├── Basket_Items.csv                            ← PACKAGING basket items only
│   ├── Item_BOM_Components.csv                     ← all components per item
│   ├── Item_BOM_Component_Lines_Normalized.csv     ← buildBomComponentLinesForItem output
│   └── Option_Sets.csv                             ← MASTER_V3.option_sets
├── orders/
│   ├── Orders_Header.csv                           ← per-ticket header
│   ├── Orders_Lines.csv                            ← per-line detail
│   └── Orders_Test_Cases.csv                       ← positive / negative / edge cases
└── daily_plan/
    ├── DailyPlan_Rounds.csv                        ← rounds per date
    ├── DailyPlan_Demand_Lines.csv                  ← per-line demand
    ├── DailyPlan_Demand_By_Customer.csv            ← rollup view
    ├── DailyPlan_Demand_By_SKU.csv                 ← rollup view
    ├── DailyPlan_BOM_FG_Required.csv               ← FG required from confirmed planning
    ├── DailyPlan_BOM_Egg_BeforeMix.csv             ← egg minimum requirement per grade
    ├── DailyPlan_BOM_Egg_AfterMix.csv              ← egg target after mix per grade
    ├── DailyPlan_BOM_Basket_Required.csv           ← basket required per basket SKU
    ├── DailyPlan_BOM_Component_Required.csv        ← per-component required
    └── DailyPlan_BOM_Warnings.csv                  ← needs-review rows
```

---

## 3. Master Data files — column specifications

### Master_Customers.csv

| Column | Type | Source field | Notes |
|---|---|---|---|
| customer_id | string | `MASTER_V3.customers[].id` | Primary key. |
| nickname | string | `.nickname` | Short label. |
| name | string | `.name` | Full legal / display name. |
| customer_type | string | `.customer_type` | Currently stores customer names on many records — see UAT-027. |
| is_active | boolean | `.is_active` | Default true. |
| created_at | datetime | `.created_at` | Bangkok TZ. |
| updated_at | datetime | `.updated_at` | Bangkok TZ. |

### Master_Sites.csv

| Column | Type | Notes |
|---|---|---|
| site_id | string | Primary key. |
| customer_id | string | FK to Master_Customers. |
| name | string | Site name. |
| region | string | From `option_sets.region`. |
| address | string | Free text. |
| is_active | boolean | |

### Master_Items.csv

| Column | Type | Source field | Notes |
|---|---|---|---|
| sku | string | `MASTER_V3.items[].sku` | Primary key. |
| name | string | `.name` | Display name. |
| item_role | string | `.item_role` | FG / WIP / PACKAGING / SUPPLY. |
| item_type | string | `.item_type` | Subtype within role. |
| barcode | string | `.barcode` | Optional. |
| selling_unit | string | `.selling_unit` | Top-level unit. |
| is_egg | boolean | `.is_egg` | |
| is_sellable | boolean | `.is_sellable` | |
| is_producable | boolean | `.is_producable` | |
| is_consumable | boolean | `.is_consumable` | |
| is_placeholder | boolean | `.is_placeholder` | |
| is_active | boolean | `.is_active` | |
| bom_enabled | boolean | `.bom.enabled` | |

### Item_Unit_Conversions.csv

| Column | Type | Notes |
|---|---|---|
| sku | string | FK to Master_Items. |
| base_unit | string | E.g., ฟอง. |
| pack_unit | string | Label. |
| base_per_pack | integer | The conversion. |
| storage_unit | string | |
| base_per_storage | integer | |
| basket_unit | string | Forced ตะกร้า when active. |
| base_per_basket | integer | |
| has_basket_unit | boolean | Active switch. |
| palette_unit | string | Legacy synonym. |
| consumable_unit | string | For SUPPLY items. |

### Item_Egg_Profile.csv

| Column | Type | Notes |
|---|---|---|
| sku | string | FK to Master_Items. |
| is_egg | boolean | |
| egg_content_type | string | single_grade / mixed_grade / ungraded. |
| primary_grade | string | From `option_sets.egg_grade`. |
| secondary_grade | string | Mixed SKUs only. |
| min_primary | numeric | 0–100 percent; legacy fractions ≤1 are read as percentages. |

### Item_Basket_Profile.csv

| Column | Type | Notes |
|---|---|---|
| sku | string | FK to Master_Items. |
| has_basket_unit | boolean | Active switch. |
| base_per_basket | integer | |
| basket_unit | string | |
| selected_basket_sku | string | The PACKAGING basket SKU chosen. |
| basket_type | string | Legacy metadata; not used in BOM logic. |

### Basket_Items.csv

The subset of `Master_Items` where `item_role = "PACKAGING"` AND `item_type = "basket"`.

| Column | Type | Notes |
|---|---|---|
| sku | string | Primary key. |
| name | string | |
| base_unit | string | Display unit for the basket line (e.g., ใบ). |
| basket_type | string | Legacy. |

### Item_BOM_Components.csv

All components stored in `item.bom.components[]`, one row per (sku, component_index).

| Column | Type | Notes |
|---|---|---|
| sku | string | FK to Master_Items. |
| component_index | integer | Position in components array. |
| component_type | string | egg / packaging_basket / basket_qty / packaging. |
| component_sku | string | The component's own SKU (if applicable). |
| component_name | string | |
| qty_per_output | numeric | |
| qty_per_basis | numeric | Legacy (Task 4 era). |
| qty_per_selling_unit | numeric | Used by basket components (Task 8B-0). |
| usage_basis | string | Legacy. |
| source | string | egg_profile / basket_profile / bom_setup / packaging_profile. |
| component_role | string | For packaging editor (Task 9): tray / cover / label / etc. |
| editable | boolean | |
| needs_review | boolean | |
| notes | string | |

### Item_BOM_Component_Lines_Normalized.csv

Output of `buildBomComponentLinesForItem(item)` for every FG item — the canonical view.

| Column | Type | Notes |
|---|---|---|
| sku | string | FK. |
| line_index | integer | |
| component_type | string | |
| component | string | Display name. |
| component_sku | string | |
| qty_per_output | numeric | |
| unit | string | Display unit. |
| source | string | |
| editable | boolean | |
| status | string | ok / needs_review. |
| notes | string | |

### Option_Sets.csv

| Column | Type | Notes |
|---|---|---|
| set_key | string | E.g., unit, egg_grade, item_role, item_type, region, vehicle_type, customer_type. |
| code | string | Internal code. |
| label_th | string | Thai label. |
| label_en | string | English label. |
| is_active | boolean | |

---

## 4. Orders files — column specifications

### Orders_Header.csv

| Column | Type | Notes |
|---|---|---|
| ticket_id | string | Primary key (or invoice_id; UAT uses ticket nomenclature). |
| customer_id | string | FK. |
| site_id | string | FK. |
| delivery_date | date | Bangkok TZ. |
| production_date | date | Bangkok TZ. |
| status | string | Order status FSM. |
| reason_code | string | When status is needs-attention. |
| is_needs_attention | boolean | |
| po_source | string | makro / bigc / thaifood / manual. |
| po_filename | string | Original upload filename. |
| created_at | datetime | |
| confirmed_at | datetime | |

### Orders_Lines.csv

| Column | Type | Notes |
|---|---|---|
| ticket_id | string | FK to Orders_Header. |
| line_index | integer | |
| sku | string | FK to Master_Items. |
| po_qty | numeric | From parser; immutable. |
| order_qty | numeric | Operator-editable. |
| selling_unit | string | At the time of order; usually matches item's selling_unit. |
| is_placeholder_sku | boolean | |
| notes | string | |

### Orders_Test_Cases.csv

| Column | Type | Notes |
|---|---|---|
| case_id | string | E.g., TC-ORD-001. |
| category | string | positive / negative / edge. |
| description | string | What the case proves. |
| input_pofile | string | Pointer to a sample PO file. |
| expected_status | string | Expected order status after upload. |
| expected_reason_code | string | If applicable. |
| expected_tickets | integer | Number of tickets created. |

---

## 5. Daily Plan files — column specifications

### DailyPlan_Rounds.csv

| Column | Type | Notes |
|---|---|---|
| date | date | Bangkok TZ. |
| round | string | R1 / R2 / R3 / R4. |
| confirmed_at | datetime | |
| confirmed_by | string | |

### DailyPlan_Demand_Lines.csv

| Column | Type | Notes |
|---|---|---|
| date | date | |
| round | string | |
| customer_id | string | FK. |
| site_id | string | FK. |
| sku | string | FK. |
| ticket_id | string | FK to Orders_Header. |
| order_qty | numeric | |
| planning_qty | numeric | |
| confirmed_planning_qty | numeric | |
| status | string | waiting / accepted / confirmed. |
| trip_id | string | FK to (future) Trips table. |

### DailyPlan_Demand_By_Customer.csv / DailyPlan_Demand_By_SKU.csv

Rollup views; columns are the obvious sums per `customer_id` or `sku`.

### DailyPlan_BOM_FG_Required.csv

| Column | Type | Notes |
|---|---|---|
| date | date | |
| round | string | |
| sku | string | |
| confirmed_planning_qty | numeric | |
| selling_unit | string | |

### DailyPlan_BOM_Egg_BeforeMix.csv

| Column | Type | Notes |
|---|---|---|
| date | date | |
| round | string | |
| sku | string | |
| egg_grade | string | E.g., M / L / S. |
| qty_min_required | numeric | Minimum primary or balance secondary. |
| unit | string | ฟอง. |

### DailyPlan_BOM_Egg_AfterMix.csv

Same shape as BeforeMix; qty_target instead of qty_min_required.

### DailyPlan_BOM_Basket_Required.csv

| Column | Type | Notes |
|---|---|---|
| date | date | |
| round | string | |
| basket_sku | string | The PACKAGING basket SKU. |
| qty_required | numeric | |
| unit | string | ใบ (or whatever the basket's base_unit is). |

### DailyPlan_BOM_Component_Required.csv

For Task-9 packaging components (when Daily Plan BOM integration ships — UAT-042 / UAT-046).

| Column | Type | Notes |
|---|---|---|
| date | date | |
| round | string | |
| component_sku | string | |
| component_role | string | tray / cover / label / sticker / pack / other. |
| qty_required | numeric | |
| unit | string | |

### DailyPlan_BOM_Warnings.csv

| Column | Type | Notes |
|---|---|---|
| date | date | |
| round | string | |
| sku | string | |
| warning_code | string | missing_conversion / missing_egg_grade / missing_basket_sku / etc. |
| message_th | string | |
| message_en | string | |

---

## 6. How to read the UAT to produce these files

The UAT does **not** generate any of these CSV files automatically. They must be exported from `localStorage` via the procedure below.

### 6.1 Master Data CSV exports

The current master is already serialized as JSON. Convert with a one-shot script:

```python
# Run with:  python3 export_master_to_csv.py demand_master_v3_corrected_v5_20260521.json
import json, csv, sys

src = sys.argv[1]
data = json.load(open(src))

# Master_Customers.csv
with open('Master_Customers.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['customer_id','nickname','name','customer_type','is_active','created_at','updated_at'])
    for c in data.get('customers', []):
        w.writerow([c.get('id'), c.get('nickname'), c.get('name'),
                    c.get('customer_type'), c.get('is_active', True),
                    c.get('created_at'), c.get('updated_at')])

# ... similar for sites, items, option_sets ...
```

**[Prod-Recommendation]** Build this as a CLI in the production tooling repo and rerun on every master-data import. Treat the CSVs as auditable views, never as the source of truth.

### 6.2 Operational data (orders / planning) export

The UAT's localStorage is the source. To export:

1. Open `app/index.html` in a browser.
2. DevTools → Console.
3. Run: `JSON.stringify(JSON.parse(localStorage.getItem('demand_dashboard_orders')))` — save the result.
4. Repeat for `demand_dashboard_planning_v2`, `demand_dashboard_bom_done`, `demand_dashboard_uploaded`, `demand_dashboard_mappings`.
5. Use the **⬇ Backup now** button in the header strip to grab everything at once (`schema_version: 2` envelope). The envelope contains `payload` (new format) and `_keys` (legacy format) — both are 1-to-1 with the live keys.

**[Needs-Verification]** Convert the backup JSON to per-tab CSV files. A small script can iterate `payload['demand_dashboard_orders']` and emit `Orders_Header.csv` + `Orders_Lines.csv`. The exact shape of the orders JSON should be inspected before scripting; `grep -n "persistOrders\|ORDERS =" app/index.html` and read the surrounding code.

### 6.3 Synthetic test-case generation

The dev team / QA generates `Orders_Test_Cases.csv` directly. Suggested seed cases:

| Case | Category | Sample input | Expected |
|---|---|---|---|
| TC-ORD-001 | positive | Makro PO with 5 valid rows | 1 ticket, 5 lines, status confirmed |
| TC-ORD-002 | positive | BigC PO with mixed grades | 1 ticket, lines reflect mixed-egg SKUs |
| TC-ORD-003 | negative | PO referencing unknown SKU | Needs Review chip, placeholder created |
| TC-ORD-004 | negative | PO with missing site code | Needs Review with missing_site |
| TC-ORD-005 | negative | Stale parser version (`UPLOADED.v < PARSER_VERSION`) | Upload rejected with parser-version toast |
| TC-ORD-006 | edge | PO with 0 rows | Upload completes with 0 tickets |
| TC-ORD-007 | edge | PO with duplicate row (same SKU twice) | Both lines retained; no auto-merge |
| TC-ORD-008 | edge | Manual order (no PO file) | PO Qty = null; order saves |

---

## 7. Export procedure (concrete steps)

Run by the operator once on the source machine (no code change required):

1. **Backup the live UAT.** Header strip → **⬇ Backup now** → save the JSON file.
2. **Export the master JSON.** Already on disk as `demand_master_v3_corrected_v5_20260521.json` (use this latest corrected file as the canonical master seed).
3. **Run `export_master_to_csv.py`** (a small script the dev team writes per § 6.1) to produce the eleven master CSVs.
4. **Run `export_backup_to_csv.py`** on the backup JSON from step 1 to produce the orders / planning CSVs.
5. **Hand-author `Orders_Test_Cases.csv`** from the case table above plus any additional cases QA wants.
6. **Drop everything into `docs/dev_test_data/`** in the structure shown in § 2.

Total time: ~30 minutes once the two scripts exist.

---

## 8. File-by-file status as of this handover

| File | Status |
|---|---|
| `demand_master_v3_corrected_v5_20260521.json` | **[UAT-Confirmed]** Exists, 314 KB, 130 items |
| `Master_*.csv` | **[Needs-Verification]** Not yet generated — run § 6.1 |
| `Item_*.csv` | **[Needs-Verification]** Not yet generated |
| `Option_Sets.csv` | **[Needs-Verification]** Not yet generated |
| `Orders_Header.csv` / `Orders_Lines.csv` | **[Needs-Verification]** Not yet generated — run § 6.2 against operator's machine |
| `Orders_Test_Cases.csv` | **[Needs-Verification]** Hand-author from § 6.3 |
| `DailyPlan_*.csv` | **[Needs-Verification]** Not yet generated |

**[Prod-Recommendation]** Treat this README + the master JSON as a complete **seed package** for production. Treat the operational CSVs as **a one-off export** for parity testing — not a recurring delivery; the new system will own that data on day one.

---

## 9. Mapping back to the UAT tabs

| Tab | Test data files needed |
|---|---|
| Orders | `Orders_Header.csv`, `Orders_Lines.csv`, `Orders_Test_Cases.csv` |
| Master Data | `Master_Customers.csv`, `Master_Sites.csv`, `Master_Items.csv`, `Item_Unit_Conversions.csv`, `Item_Egg_Profile.csv`, `Item_Basket_Profile.csv`, `Basket_Items.csv`, `Item_BOM_Components.csv`, `Item_BOM_Component_Lines_Normalized.csv`, `Option_Sets.csv` |
| Daily Planning · Demand | `DailyPlan_Rounds.csv`, `DailyPlan_Demand_Lines.csv`, `DailyPlan_Demand_By_Customer.csv`, `DailyPlan_Demand_By_SKU.csv` |
| Daily Planning · BOM | `DailyPlan_BOM_FG_Required.csv`, `DailyPlan_BOM_Egg_BeforeMix.csv`, `DailyPlan_BOM_Egg_AfterMix.csv`, `DailyPlan_BOM_Basket_Required.csv`, `DailyPlan_BOM_Component_Required.csv`, `DailyPlan_BOM_Warnings.csv` |

End of Developer Test Data Package README.
