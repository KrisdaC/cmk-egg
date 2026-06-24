# Feature Summary — EggGrade OMS

**Build:** UAT v3.122 — Handover
**Audience:** Business owner + dev team
**Legend:**
- ✅ Working — flow is end-to-end functional in UAT
- 🟡 Partial — works in some cases, has caveats
- 🔴 Mock / placeholder — UI exists, behavior is stub
- ⚙️ Needs backend — front-end logic done, needs server to be safe in production

---

## Top tabs

| Tab | Status | Notes |
|---|---|---|
| ออเดอร์ (Orders) | ✅ | The core UAT flow lives here |
| แผนรายวัน (Daily plan) | 🟡 | Legacy V1 demand grid; useful but not part of UAT scope |
| ข้อมูลหลัก (Master data) | ✅ | Full CRUD for customers/sites/items |
| ตั้งค่า/ข้อมูล (Data & settings) | 🟡 | File uploader + storage info; legacy V1 |
| วิเคราะห์ (Analytics) | 🟡 | Pivot table from V1; works but UAT didn't focus here |
| Drafts (legacy) | hidden | Hidden in UAT3+ — safe to delete in rebuild |

---

## Orders tab — feature breakdown

### Order intake — PO Upload

| Feature | Status | User role | Page / function | Input | Output | Business rules / notes |
|---|---|---|---|---|---|---|
| Upload Makro PO | ✅ | ops staff | Orders → ⬆ อัปโหลด PO → Makro | `.xlsx` | 1 ticket per PO; PO qty locked, customer locked, items locked, site editable | Site matched by branch code prefix (UAT79); duplicate PO# warns + lets user proceed |
| Upload BigC PO | ✅ | ops staff | Orders → BigC | `.xlsx` or `.csv` | 1 ticket per PO# in file | EAN-based item match; multi-PO files supported; site by EAN+code (UAT41/66) |
| Upload Thaifood PO | ✅ | ops staff | Orders → Thaifood | `.xlsx` (SAP export) | 1 ticket per PO | Material code primary; Short Text fallback; auto-learns material→SKU mapping (UAT53) |
| Upload CJ PO | 🔴 | ops staff | Orders → CJ | — | — | Button disabled — no sample file to design parser around |
| Manual order create | ✅ | ops staff | Orders → + สร้างออเดอร์ | manual entry | new editing-status ticket | Starts with no customer; user picks customer → site → adds items |
| Manual PO# entry | ✅ | ops staff | Editor → PO section → Type PO # | text | sets `inv.po_number` | Allowed unless ticket is upload-locked |

### Order management

| Feature | Status | User role | Page / function | Input | Output | Business rules / notes |
|---|---|---|---|---|---|---|
| 4-state status flow | ✅ | ops staff | Editor banner | click button | editing → draft → submitted → confirmed | Cannot submit if any line missing Order qty or any placeholder unresolved (UAT60/87) |
| Inline editor | ✅ | ops staff | Click ticket row | — | expands editor card with sections: Customer & site / PO / Dates / Logistics / Items | Auto-scroll lands on editor (UAT114) |
| Sections | ✅ | | Customer / Site / PO / Dates / Logistics / Items | dropdowns + inputs | persisted via `_editTicketField` | Site dropdown filters to current customer with multi-strategy match (UAT16) |
| Add line item | ✅ | | Editor → + เพิ่มรายการ | search box | adds line to inv.lines | Items shown if in customer.skus[], generic, or partner_id matches (UAT104) |
| Item picker search | ✅ | | + Item → search | text query | filtered items | Aliases: `เบอร์ N`, `คละ X-Y`, `ถาด`, `แพ็ค N`, `มัด N`, `ครอบ`, `ฝา` (UAT105/106) |
| Order qty validation | ✅ | | Editor → ส่งให้ฝ่ายผลิต | — | blocked + ⚠ alert if missing | Use 0 for items the store does not want (UAT87) |
| Set all Order = PO | ✅ | | Editor → ↓ ตั้งทุกบรรทัด สั่ง = PO | — | bulk-fills order_qty from po_qty | One-click for stores that ordered exactly the PO |
| No-delivery toggle | ✅ | | Editor → Customer & site | checkbox | hides delivery date/time + logistics | Auto-on for walk-in customer (UAT79) |
| Delete ticket | ✅ | | Editor → ลบ, or Attention row → ✕ ลบ | confirm | removed from ORDERS | Searches all date buckets (UAT78/111) |

### Filters & search

| Feature | Status | Notes |
|---|---|---|
| Date — All / Single / Range | ✅ | 3 modes mutex (UAT96) |
| Yest / Today / Tom shortcuts | ✅ | |
| Customer pills (top 5 by eggs) | ✅ | Active state shows filled brand-color pill (UAT121) |
| Group filter (G1 / G2 / —) | ✅ | |
| Type filter (ส่งตรง / DC) | ✅ | |
| Speed filter (ด่วน / ปกติ) | ✅ | |
| Search box | ✅ | Searches across all dates when active; bypasses other filters (UAT70-7) |
| Pagination — 20/page | ✅ | (UAT46) |
| Sort by column | ✅ | Click header to sort (UAT45) |
| Multi-select rows + bulk actions | ✅ | Toolbar appears on selection |

### Need Attention (Orders tab)

| Feature | Status | Notes |
|---|---|---|
| Lists editing tickets | ✅ | (UAT85/95) |
| Lists empty drafts | ✅ | Bypasses date filter (UAT74) |
| Lists pending tickets | ✅ | Pending = has placeholder SKU/site (UAT77) |
| ✎ แก้ไข button | ✅ | Switches date + force-expands editor + scrolls (UAT112/113/114) |
| ⚠ Master button | ✅ | Opens the placeholder master record |
| ✕ ลบ button | ✅ | Cross-date delete (UAT111) |

### KPIs

| Feature | Status | Notes |
|---|---|---|
| Tickets-by-status row | ✅ | Filtered to current view (UAT98) |
| Total eggs | ✅ | + per-customer breakdown (top 5 + Others) |
| Delivery sites count | ✅ | |
| Fast-track count | ✅ | Same-day orders |

---

## Master Data tab

| Feature | Status | Notes |
|---|---|---|
| Customers CRUD | ✅ | Full edit dialog with address / contact / nickname |
| Sites CRUD | ✅ | EAN, branch code, delivery type, vehicle list, distance |
| Items CRUD | ✅ | SKU, partner item number, units, egg grade, aliases, generic flag |
| Customer SKU catalog | ✅ | Multi-select with grouping by egg grade + type filter (UAT100/103) |
| Need Attention block | ✅ | Lists placeholder sites + SKUs with ✎ แก้ไข (UAT119) |
| Import master from xlsx | ✅ | Replaces full master tables |
| Export master to JSON | ✅ | Download for backup |
| Clear master data | ✅ | Confirms before wipe |
| Show inactive toggle | ✅ | |
| Filter by customer | ✅ | (sites + items only) |
| Filter by role | ✅ | (items only) |

---

## i18n

| Feature | Status | Notes |
|---|---|---|
| Thai (default) | ✅ | ~250 keys covering Orders, Master, Editor, Attention, modals, toasts (UAT115/116/117/118/119) |
| English | ✅ | Falls back to original English text via `data-i18n-orig` |
| Toggle live re-render | ✅ | Switching language re-renders dynamic UI on the spot (UAT115/119) |
| Number/date formatting | 🟡 | Uses native `toLocaleString` — not all touch-points use Thai locale yet |

---

## What is NOT built

| Area | Status | Notes |
|---|---|---|
| CJ PO parser | 🔴 | Button greyed out — needs sample file |
| Planning sub-tab | 🔴 | Placeholder text only |
| Invoice sub-tab | 🔴 | Placeholder text + ร.3 mention |
| Backend / API | 🔴 | None |
| Authentication | 🔴 | None |
| Multi-user | 🔴 | None — every browser is its own world |
| Audit trail | 🔴 | None — deletes are permanent |
| Reporting / dashboards | 🔴 | Analytics tab is legacy V1 pivot, not redesigned for OMS data |
| Notifications | 🔴 | None |
| Mobile / responsive | 🟡 | Layout is desktop-first; tablets ok-ish, phones not designed for |

---

## Open questions for business owner

1. **Multi-user / single-user?** If multiple staff need to work on the same orders simultaneously, the rebuild MUST go server-side from day one.
2. **Audit / approval workflow?** Should "submit to production" require a manager approval step? Currently anyone clicking the button can submit.
3. **Roles?** Ops staff / production planners / finance — do they need different permissions?
4. **Mobile use?** Will the production floor staff view this on phones/tablets?
5. **CJ format** — when can sample files be shared so the parser can be built?
6. **Planning view** — what should it actually show? Currently a placeholder.
7. **Invoice view** — same question. Includes "ออก ร.3" (Thai withholding tax form) which has its own format.
8. **Data retention** — how long should completed orders be kept queryable?

## Open questions for dev team

1. **Rebuild stack?** Recommendation in `TECH_STACK_REVIEW.md` — please align before starting.
2. **Migration path** — does data from existing UAT users (in their browsers) need to flow into the new system? If yes, the rebuild needs an "import from UAT export" button on day 1.
3. **i18n strategy** — keep it inline or move to JSON files? If TH is the only real language, this can be deferred.
4. **Test strategy** — what coverage does the team typically aim for?
