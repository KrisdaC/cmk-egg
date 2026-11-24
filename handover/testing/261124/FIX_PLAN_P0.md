# P0 fix plan — UAT feedback of 24 Nov 2026

Source: `Master data.docx` and `PO ingestions.docx` (this folder). Tracker: `handover/testing/UAT_issue_tracker.xlsx`.
Scope: the 15 P0 findings, in six steps. P1/P2 findings are named only where a P0 fix depends on them.

How sure each statement is: **Verified** = I read the code line myself. **Read** = reported by a code investigation, not re-checked by me. **Unknown** = needs a database look or a decision.

---

## At a glance

| Step | Findings | What | Size | Depends on | Touches UAT data |
|---|---|---|---|---|---|
| 1 | X3, X2, D1 (data part) | Data fixes: Thaifood codes, BigC units, branch codes | S | needs your inputs (see "What I need from you") | Yes |
| 2 | F1 | One Bangkok-time date helper; fix the quick date buttons | S | none | No |
| 3 | K2, X1 | `item_customer_codes` table, API, item-form table, lookup rewrite | L | step 1 | Yes (backfill) |
| 4 | B1, B2, B3, T1, T2 | BigC and Thaifood readers: two quantities, site match, one row per PO, held lines, per-PO dates | L | step 3 | Yes (new columns) |
| 5 | S1, S2, F3 | Planned production date, Outstanding screen | L | none (best after 2) | Yes (new column) |
| 6 | K1 | Edit forms show what is stored; round-trip test | M | none (before anyone edits master data) | No |

Steps 2, 5 and 6 do not depend on the data work, so they can run in parallel with 3 and 4 if more than one person builds.

Each step ships on its own: backup, apply its migration, pull, build, restart, run its acceptance tests (the same procedure as `deploy/UAT_DEPLOY.md`).

---

## Decisions this plan relies on

| Decision | Source | Effect |
|---|---|---|
| Sell in the selling unit, produce in packs; packs per basket links them (BigC only for now) | Decided; question "Makro/Thaifood too?" assumed **BigC only** | B1, X2 |
| One mapping table, customer + code unique, several codes per item | Decided | K2, X1, T1 |
| BigC twin item (B01…) is the **DC** version; the key needs the channel | Question 1, assumed **A** | X1 |
| Thaifood 2000001163–65 are the same products as T0001–T0003 | Question, assumed **yes** | T1, X3 |
| Held lines instead of skipped lines | Decided | T1 |
| Planner selects what is produced; no automatic lead time | Decided | S1, S2 |
| QA does not save test records | Question 2, assumed **nothing saved** | K1 proof is done by a developer-run test (step 6) |

If an assumption is answered the other way, step 3 (twins) and step 1 (Thaifood codes) are the parts that change.

---

## Step 1 — Data fixes (X3, X2, D1)

No code, but several need your input (see "What I need from you before each step"). Take a backup first (`pg_dump`), run in one transaction, and count rows before and after.

**X3 — missing codes**
- Today one code per item and customer is stored (`item_business_partners.customer_item_number`; unique on item + partner). The lookup also matches `item_business_partners.barcode_label` (**Read**). So as a bridge until step 3: put the new Thaifood code (2000001163–65) in `customer_item_number` of T0001–T0003 and the old code (2000000524–26) in `barcode_label`. Both then match. Step 3 moves both into the new table.
- M0022 and M0023 have no Makro code: **you decide** — give each a code, or retire the item.

**X2 — BigC units**
- Set `items.selling_unit = 'ตะกร้า'` on the 12 BigC [Direct] items (B02…). `selling_unit` is free text (**Read**), so the value saves. Check `pack_per_basket` is set on all 12; the report says it equals the file's Packing Size for all 14 BigC items.
- Holding the customer's order unit on the code row is step 3.
- Until step 4 ships, do not upload BigC files for real: the app would still read cartons as packs.

**D1 — branch codes**
- Makro 27, Makro 161 and Thaifood 9795 each sit on two sites. **You decide** which site keeps each code.
- Thaifood plants 9629 and 9906 need sites: **I need the site names** (the sample files carry the plant codes; I do not know whether they carry names).
- The code is made required and unique per customer in step 3 (it needs the clean data first).

**Check after:** `SELECT partner_id, lower(partner_branch_code), count(*) … HAVING count(*)>1` returns no rows; every one of the 12 items has `selling_unit='ตะกร้า'`; a Thaifood preview shows the three codes as matched.

---

## Step 2 — F1: dates in Bangkok time

**Cause (Verified):** `addDays` builds `new Date(iso + "T00:00:00")` (local midnight), moves the day, then `toISOString().slice(0,10)`. In UTC+7 local midnight is 17:00 UTC the day before, so the result is one day early. With today = 24 Nov: yesterday → 22 Nov, tomorrow → 24 Nov. That matches the QA report. `todayISO()` also uses UTC, so it is a day behind between 00:00 and 07:00.

**Fix**
1. New `client/src/lib/date.ts` (and a server mirror) with pure string helpers, no `toISOString`:
   - `todayBkk()` = `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())`
   - `addDaysISO(iso, n)` using `Date.UTC(y, m-1, d+n)` and `getUTC*`
2. Replace the local copies and wrong call sites (**Read**):
   - `OrdersGrid.tsx:139-144` and its calls (317, 327, 1101-1102, 1151-1153, 1431-1433, 1613-1620). The pickup default `addDays(delivery,-1)` is also off by one (it gives two days before).
   - `POIntake.tsx:231`, `po-parsers.ts:214,250` (`MK-${today}` fallback), pricing screens (`QuotationModal.tsx:93`, `PriceAdjustment.tsx:1057`, `PriceSimulation.tsx:120-121`, `Proposals.tsx:261,510`).
   - Server defaults at `orders.ts:458,656,700` and `storage.ts:468` (default date = UTC today).
   - `DailyPlan.tsx:128-139`: its `todayISO` is fragile (correct only if the browser runs in UTC). Delete the local copies and import the helper.
   - Already safe: the server's `addDay` (`orders.ts:731`) and the `Asia/Bangkok` display formatting.
3. Note: `DailyOrderSummary.tsx:54` has a hard-coded `defaultValue="2026-01-02"` (**Read**); fix it in passing.

**Acceptance:** with the clock at 24 Nov 00:30 and at 14:00 Bangkok time, "เมื่อวาน" = 23 Nov, "วันนี้" = 24 Nov, "พรุ่งนี้" = 25 Nov, on the order list, the daily plan and the pricing screens. Add unit tests for the helper over a month boundary (30 Nov → 1 Dec) and a year boundary.

---

## Step 3 — K2 + X1: customer codes table

**Today (Read):** codes are stored in `item_business_partners` (one row per item and customer, unique), but the item API's `syncItemPartners` never writes them (they were backfilled by migration 0003). The lookup (`POST /api/items/lookup-customer-codes`, `items.ts:61-150`) builds one map keyed by code only, not by customer, so the last row wins with no order. Fallback 2 searches all items, so it can match another customer's item. That is the silent pick X1 describes.

**Schema (migration 0042)**
```
item_customer_codes(
  id, item_id → items, partner_id → business_partners,
  customer_product_code text NOT NULL,
  barcode text, channel text NULL  -- 'store' | 'dc' | NULL
  order_unit text,                 -- unit the customer orders in (X2)
  is_active boolean, valid_from date, valid_to date, created_at, updated_at)
UNIQUE (partner_id, customer_product_code, coalesce(channel,''))  [active rows]
```
- Backfill from `item_business_partners.customer_item_number` (and `barcode_label` for the bridged Thaifood codes from step 1).
- **The index will fail on the 12 BigC codes** that sit on two SKUs until each has a channel. Backfill script: the [Direct] item gets `channel='store'`, the twin (B01…, or the Mini item B03023002) gets `channel='dc'` (assumption A). The script prints the 12 pairs for you to confirm before the index is created. **Unknown:** whether every twin really is the DC version.

**API (`items.ts`)**
- `GET /items/:id` includes `customerCodes`.
- `PUT /items/:id/customer-codes` replaces the list; a unique violation returns 409 with the clashing item named.
- Lookup becomes `{ partnerId, codes[], channel? }`: query the new table first (exact match after trimming spaces); if more than one active row matches, return `ambiguous` with the candidates instead of choosing. Remove global Fallback 2.

**UI (`Items.tsx`)**
- A "Customer codes" table on the item form (customer, code, barcode, order unit, channel, active) using a field array; saves with the item. Add the codes as a column in the item list (K3 filter work is P1 and can follow).

**Other readers to switch** (they assume one row per item and customer): `items.ts` `partner-items` (~330), `priceAdjustment.ts:541`, `NewProposal.tsx:51-52`, `DailyPlan.tsx:3076`.

**Branch code uniqueness (D1, second half), migration 0042 or 0045:** a unique index on `(partner_id, lower(partner_branch_code))` where not null, added only after step 1's data fix passes. "Required for customers that order by file" needs a per-customer flag that does not exist yet: add `business_partners.orders_by_file boolean`, validate on POST **and PATCH** (PATCH currently skips validation, `storage.ts:152-159`), and show the code as a column in the site list.

**Acceptance:** BigC code 2000004617912 with PO type 0 resolves to B02001014 and with PO type 3 to B01001014; the same code on two active store rows is refused; the Thaifood old and new codes both resolve to T0001; the item form shows, adds and deletes codes; two sites of one customer cannot share a branch code.

---

## Step 4 — BigC and Thaifood readers (B1, B2, B3, T1, T2)

**Where the code is (Read, with the key parts Verified):** the live upload is in `OrdersGrid.tsx` (`handleUploadFile` 1180, `UploadResultModal` 822, `handleUploadCommit` 1317), parsers in `client/src/lib/po-parsers.ts`, create in `POST /api/orders` (`orders.ts:1429`). An older path (`POIntake.tsx` → `POUploadReview.tsx`) duplicates parts of this logic. **Before starting, confirm which screen QA used**; fix `OrdersGrid` and either route the old path to the same code or retire it, so the two cannot drift.

**Order of work inside the step**
1. **Parse text correctly.** Decode the BigC CSV with `new TextDecoder("windows-874")` and read cells as text, so PO numbers keep leading zeros. (`codepage: 874` in `XLSX.read` may not take effect without the codepage tables, **Unknown**.) This is a P1 piece (B7), pulled in because B1/B2 need correct values.
2. **B2.** `po-parsers.ts:295`: `findIndex(/ship.?to.?ean|ean.?number/i)` returns "Supplier EAN Number" first (**Verified**). Use `/^ship.?to.?ean/i`. Match to `partner_branch_code` as trimmed exact text.
3. **B3 + T2.** Remove the `isThaiFood` gating: run site detection per PO (`detectSiteFromPO(format, [po], sites)`), store `{ siteId, orderDate, deliveryDate }` per PO, show **one editable row per PO** in the preview, and send the map to the commit. Today one `delivDate` state overrides every PO (`OrdersGrid.tsx:1337`). The Thaifood sample has one date per PO and five dates over 83 POs (**Read**), so per-PO dates solve T2.
4. **B1: two quantities.** Migration 0043:
   - `order_items.selling_qty integer`, `selling_unit text` (cartons / ตะกร้า), `mapping_status text` ('mapped' | 'waiting'), and `order_items.item_id` made nullable.
   - `orders.po_type text`, `po_group text`, `source_file text` (also serves O2 later).
   - Keep `order_items.quantity` as the **pack quantity** (what production, planning and packing already read), so nothing downstream changes meaning. BigC: `selling_qty` = cartons; `quantity` = cartons × `pack_per_basket`.
   - The lookup returns `pack_per_basket` and `basket_unit`. Warn in the preview when the file's Packing Size differs from the item.
   - **You decide the price basis:** BigC has `Gross Case Price` (per carton) and `Price Per Unit` (per pack). With `quantity` in packs, the line total only works with the per-pack price. Recommended: `unit_price` = Price Per Unit, and show the carton price beside it in the preview.
   - Zod: add `sellingQty`, `sellingUnit` to `createOrderSchema` (`orders.ts:41-64`) and write them in the insert (`orders.ts:1442-1449`).
   - Store PO type (0 store / 3 DC), group (from "Order Note"), and use PO type as the channel in the step 3 lookup.
5. **T1: held lines.** Send unmatched lines too, with `itemId: null`, `customer_item_code` (the column exists but is never written), `mapping_status='waiting'`. Do not drop a PO that has no mapped line. Every query that reads order lines for planning must skip lines with a null item or waiting status: the daily endpoint, PQ rows (`bom.ts:37`), packing and trips. List and test each. "Map from the preview" and "re-read PO" (T4) follow later.
6. **Duplicate PO handling.** Today one existing PO aborts the whole file (B4, P1). Do not widen this step, but make sure the preview marks each PO New / Already loaded instead of failing on the first duplicate if it is cheap while you are in `OrdersGrid`.

**Acceptance (use the sample files in this folder):**
- BigC CSV: 10 POs, 31 lines; **25,048 eggs** in total; PO 0092688144 = **5,150 eggs** (28 cartons → 56 trays at 2 per carton); PO numbers keep their zeros; the three ship-to codes match BigC สัตหีบ, the DC and บ่อวิน; PO 92803504 lands on บ่อวิน for 26 Nov (not the DC for 25 Nov); Thai text reads cleanly.
- Thaifood weekly file: 83–85 POs; unmatched lines become waiting lines, none dropped; each PO has its own delivery date; with the step 1 codes, about 90% of the eggs are matched.
- Makro files still load exactly as before (regression: PO 15.2652973 = 34,500 eggs on Makro ระยอง).
- A held line does not appear in the daily plan, packing targets or PQ.

---

## Step 5 — S1, S2, F3: planned production date and Outstanding screen

**Today (Read):** `GET /api/orders/daily` filters `delivery_date = date`, so a day's plan is "orders delivering that day". The only way into a round is "Add all to O-R1" (`PATCH /api/orders/assign-round`, `orders.ts:1123`). There is no order status "draft": drafts are `status='pending'`. `production_round` (1–4, null = unassigned) and a defer concept (`deferred_from_round`) already exist.

**Schema (migration 0044):** `orders.planned_production_date date` (indexed). No backfill needed, because of the fallback below.

**Safe rollout**
1. `/daily` and `bom.ts` use `COALESCE(o.planned_production_date, o.delivery_date)`. Orders nobody has selected behave exactly as today, so deploying the column changes nothing until the planner starts selecting. Return both dates so the plan can show planned delivery beside production.
2. **Carry-over:** include orders whose planned production date is before the viewed day and that are not finished (status not delivered, not cancelled), and mark them "carried over".
3. New endpoints: `GET /api/orders/outstanding` (confirmed orders with no planned production date, plus a count of `pending` drafts) and `PATCH /api/orders/plan-production` (set the date for many orders at once; optionally the round).
4. **Outstanding screen:** tick boxes; "Produce today / Produce tomorrow / pick a date"; select by customer or delivery date (a Thaifood week is 83–85 POs); warning for orders whose planned delivery is today or tomorrow and are not selected; "N orders still in draft" with a link (S5). The order list opens on it (F3). Dates use the step 2 helper.

**Review points (Read):** the demand and history queries (`orders.ts:668-723`) read `delivery_date` as demand; decide whether they follow the plan date. Dispatch and stock logic in `packing.ts:461,588` must stay on the real delivery date. `trips`, `packing_targets`, `preliminary_shipment_plans`, `pq_snapshots` and `production_round_states` are keyed by a `delivery_date` column that will really hold the plan date; this is only a naming mismatch, so do not rename in this step.

**Acceptance:** an order delivering 25 Nov, selected on 24 Nov with "Produce today", appears in the 24 Nov plan with delivery 25 Nov beside it; an unselected order does not appear in any plan; an order not finished on its day shows as carried over the next day; the draft count matches `status='pending'`.

---

## Step 6 — K1: forms show what is stored

**Causes (Read; two or three need a database look first):**

| Form | Cause |
|---|---|
| Item | Primary grade 0 is treated as missing (`!!watchPrimaryGrade`, `Items.tsx` ~507/510/429; use `!= null`). Selling unit options are built only from the current base/pack/basket values, so a stored 'แพ็ค' can fall outside them (~534-540). `item_type`, `item_role`, `base_unit` and the BOM `item_type` have fixed lists with no fallback for a stored value. The role effect (~518-530) overwrites `is_sellable`, `is_producable` and `item_type` after a reset. The BOM check is hard-coded: `pass: watchIsEgg \|\| false` (~500), so "Cannot enable" shows for every non-egg item. |
| Partner | Payment terms options are `Cash`, `COD`, `Credit 7/15/30 Days`, but the data holds plain "Credit". The form defaults `paymentTerms ?? "COD"` and **re-derives `creditDays` from the selected terms on save** (~506, ~520), which silently changes data. Why Corporation / Modern Trade show blank is **Unknown**: the options exist, so the stored strings probably differ in case or spacing; check the real values. |
| Site | Region options use slugs (`northeast`) while data holds Thai text ('ภาคอีสาน'), so nothing matches (`Customers.tsx` ~40-48, ~1537). |

**Fix**
1. For every select in the three forms: add the stored value as an extra option when it is not in the list (as `pack_unit` already does with a "(legacy)" entry), so opening a record never blanks a field.
2. Replace truthy checks on numbers with `!= null`; make the role effect skip the first run after a reset; replace the hard-coded BOM check with the real BOM lines.
3. Normalise on load: region aliases → one canonical value; payment terms 'Credit' kept as stored. **Stop re-deriving `creditDays` on save** unless the user changes the terms.
4. **Proof test.** `package.json` has no test framework (scripts: dev, build, start, check, db:push). Add `vitest`. Extract pure `recordToFormValues` / `formValuesToPayload` functions from the three forms and assert `payload(form(record))` deep-equals the record, for fixtures including grade 0, a legacy selling unit, a Thai-text region and 'Credit'. Also assert every stored value appears in its option list. This is the test the report asks for; it also lets QA's question 2 be answered by a developer instead.
5. A data migration to normalise region values is the lasting fix for D3 (P1); not required for sign-off if the fallback option is in.

**Acceptance:** open and save an unchanged item, partner and site: a database diff shows no changes (run on a scratch copy). The five finished goods QA opened show their selling unit, grade and Base Pack component.

---

## Migrations, in order

| # | Content | Step |
|---|---|---|
| 0042 | `item_customer_codes` + backfill + unique index; `business_partners.orders_by_file`; branch-code unique index (after step 1 data is clean) | 3 |
| 0043 | `order_items.selling_qty/selling_unit/mapping_status`, `item_id` nullable; `orders.po_type/po_group/source_file` | 4 |
| 0044 | `orders.planned_production_date` + index | 5 |

All use `IF NOT EXISTS`, are added to `deploy/uat_migrate.sql`, and are applied on UAT before the matching code is pulled (old code keeps working on added columns; a nullable `item_id` needs the new code before held lines are created).

---

## Risks

- **Redefining order lines.** Keeping `quantity` as the pack quantity avoids touching planning, packing and trips. The risk is invoices and prices that should read cartons: audit every reader of `order_items.quantity` before step 4 ships.
- **Held lines leaking into the plan.** A line with no item breaks any query that joins `items` with an inner join. Test every consumer of order lines.
- **Plan date vs delivery date.** The fallback keeps today's behaviour until the planner selects. The trips and packing tables keep their `delivery_date` column name while meaning the plan date.
- **Two upload paths.** The old `POIntake` path duplicates logic; if it stays reachable, the fixes must apply to both.
- **Twins.** If question 1 is answered B or C instead of A, step 3's backfill changes (retire or merge the twins instead of assigning channels).
- **Parser tests are manual today.** The sample files are the only test data; add parser unit tests that read them (PO totals, ship-to matches, per-PO dates).
- **My own earlier work.** Some findings trace to the import I did: the district/sub-district swap (D2) came from a template hint I wrote the wrong way round, and the region list in the template did not match the form's (D3). Re-import will need the corrected template.

---

## What I need from you before each step

| Step | Needed |
|---|---|
| 1 | Makro codes for M0022 and M0023, or retire them. Which site keeps branch codes Makro 27, Makro 161, Thaifood 9795. Site names for Thaifood plants 9629 and 9906. |
| 3 | Confirm the 12 BigC twin pairs (I will list them) are store vs DC. |
| 4 | Price basis (recommended: per pack). Which screen QA used for upload. OK to pull the small P1 pieces in (text decoding, per-PO New/Already-loaded marking). |
| 5 | Whether demand and history queries (`orders.ts:668-723`) should follow the plan date. |
| 6 | OK to add `vitest` as the repo's first test dependency. |
| All | A deploy window for each UAT step, and whether the five QA test orders (SO2611015–19) may be deleted first. |

---

## Suggested order of work

1. Step 2 (F1) and step 6 (K1) first: small, independent, and K1 protects master data from risky edits while the data work happens.
2. Step 1 as soon as your inputs arrive.
3. Step 3, then step 4, one UAT deploy each, retested with the sample files.
4. Step 5 last: the largest behaviour change, and the only one that changes how the planner works day to day.
