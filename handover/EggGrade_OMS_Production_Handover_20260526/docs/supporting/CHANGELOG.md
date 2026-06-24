# Changelog — EggGrade OMS

All notable UAT iterations between V3 and the v3.122 handover build.

For full per-UAT detail, see the `// UAT###` markers in `app/index.html`.

---

## v3.122 — Handover Build (2026-05-09)

- Project packaged for developer handover
- All `.bak*` working files excluded from deliverable
- Documentation suite added (README, ARCHITECTURE_SUMMARY, FEATURE_SUMMARY, DEPLOYMENT_GUIDE, KNOWN_ISSUES, TECH_STACK_REVIEW, CHANGELOG)
- Single HTML promoted to `app/index.html`

## v3.121 — Material-style customer pills
- Replaced heavy active state (white halo + outer black ring + scale 1.08 + ✓ checkmark) with clean Material chip pattern
- Inactive: outlined with brand color border + brand color text on white
- Active: filled with brand color + white text + bold + soft shadow
- CSS variable `--cust` carries the per-customer color for outline rendering

## v3.120 — Customer pill active comparison fix
- `String(_ticketCustFilter) === String(c.id)` to fix type-mismatch (numeric c.id vs string from onclick interpolation)

## v3.115 → v3.119 — Comprehensive Thai translation
- ~250 i18n keys added across Orders / Editor / Master / Attention / modals / toasts
- `data-i18n-ph` attribute support added for input placeholders
- `applyLang` re-renders dynamic UI on language switch
- Master Data tab Need Attention restored (UAT119, after temporary removal in UAT110)

## v3.111 → v3.114 — Need Attention polish
- Edit / Master / Delete action buttons on Attention rows
- Cross-date delete (was only looking at current date)
- Force-expand + auto-scroll to editor card

## v3.107 → v3.110 — Need Attention rollout
- Added Master Data placeholder rows to Orders Attention
- Added separate Master Data tab Attention block
- Removed Clear all button per request
- Removed Master tab block per request (re-added later in v3.119)

## v3.104 → v3.106 — Item picker + search
- Order editor item picker honors `customer.skus[]` catalog (not just legacy `partner_id`)
- Search aliases for egg sizes (`เบอร์ N`, `คละ X-Y`), pack sizes (`ถาด`, `แพ็ค N`, `มัด N`), unit terms
- Numeric tokens digit-bounded (`5` ≠ `15`)
- Bare unit words (`แพ็ค`, `มัด`) match all packed items

## v3.100 → v3.103 — Customer SKU catalog
- Added `customer.skus[]` for multi-SKU-per-customer (replaces 1-customer-per-SKU model)
- Multi-select picker grouped by egg grade
- Type filter + select-all-visible button
- Search shows flat list across groups

## v3.95 → v3.99 — Filter bar redesign + Need Attention
- Google Material-style filter bar (full-width search row + 4-col grid)
- Need Attention section pulled out of main list
- Editing/empty/pending tickets bypass date filter
- KPI status row repopulates from filtered set
- Defensive page preservation across filter changes

## v3.85 → v3.94 — Status flow + manual save
- Explicit "editing" status (highest priority)
- Sticky editor banner with Done/Save-as-draft/Delete/Submit
- Manual save model — no auto-save
- PO upload locks PO qty + items + customer (site stays editable)
- Order qty validation: every line must have a value before submit (use 0 to decline)
- Pending filter chip + redesign

## v3.78 → v3.84 — Empty drafts + pending bypass
- Empty drafts have no date and bypass date filter
- Pending tickets bypass all filters too
- Auto-cleanup of empty drafts when expanded then closed
- Mirrored action bar at top of editor

## v3.70 → v3.77 — Polish + sort/page
- dd-mm date format consistency
- New orders appear at top
- Customer filter pills follow filtered date
- Top-5 customers + Others rollup in eggs breakdown
- Search overrides all other filters
- Pending filter chip
- Priority-based default sort (editing → empty → pending → rest)

## v3.59 → v3.69 — Placeholder flow + BigC hardening
- Placeholder SKU/site flow on PO upload (auto-create, block status transition)
- Hide site/logistics/delivery-time for walk-in customers
- 3-state status in master (active / inactive / placeholder)
- BigC primary key migrated to EAN Product Code
- `_safeIdStr` for large EAN numbers (avoid scientific notation)
- BigC parser accepts xlsx (preserves EAN precision)
- Modal feedback when PO lines match placeholder SKUs

## v3.50 → v3.58 — Multi-customer PO + Thaifood
- Makro PO date parsing (order_date + delivery_date from xlsx cells)
- Delivery sites KPI breakdown by customer + DC/Direct
- Thaifood PO parser (SAP-style xlsx)
- Material code primary, Short Text fallback, auto-learn material→SKU
- Smart customer field mapping + ทั่วไป auto-rename
- Heuristic field rotation for ill-formed customer data

## v3.42 → v3.49 — Filters + sort + pagination
- Filter + sort by Group (G1/G2), Delivery type (Direct/DC), Fast-track
- Date range filter
- 20-row pagination
- Sortable column headers
- Multi-select rows + bulk actions toolbar
- Smart eggs/basket calculation in pack-mix display

## v3.35 → v3.41 — BigC + master polish
- EAN field added to site schema + CRUD
- BigC CSV parser + multi-ticket upload flow
- Hardened item matching with multiple strategies
- KPI total-eggs calculation fixed
- Site lookup by code + EAN

## v3.27 → v3.34 — Pack mix + item-grade migration
- Pack mix shows basket when basket info available
- Items use `selling_unit` pill, row mix uses `basket_unit`
- Item grades migrated into master data (replaces renderer regex)
- Logistics pulls from delivery site + ทั่วไป customer + DT pill consistency

## v3.10 → v3.26 — Visual system + master data hardening
- Pack-type pills, egg-size pills, delivery-type pills (.dt-pill family)
- Unified font stack + form element inheritance
- Bubble-row styling for ticket table
- Date filter — Yesterday + range mode
- Robust site filter (customer_id OR partner_id)
- DESIGN_SYSTEM.md written

## v3.0 → v3.9 — V3 foundation
- Inline-expand row replaces drawer
- Two-column editor layout (meta left, lines right)
- 4-tile KPI grid + Material-style filter bar
- 3-state status (draft / submitted / confirmed)
- Multi-customer PO upload stub (Makro live, BigC/Thaifood/CJ planned)

## V1 / V2 — see legacy folder
Demand_Dashboard_V1.html, _V2.html, _V3.html — kept in original workspace, excluded from handover. Refer to those if needed; otherwise treat them as deprecated.
