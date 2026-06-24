# Architecture Summary — EggGrade OMS

**Build:** UAT v3.122 — Handover
**Audience:** Incoming development team

---

## A. Project Overview

### What this application does
EggGrade OMS turns purchase orders received from major Thai retailers into trackable production orders. It replaces a previous Excel + chat-based workflow.

### Main business purpose
1. **Receive POs** from Makro, BigC, Thaifood (and eventually CJ) via xlsx/csv upload
2. **Track each order** through draft → submitted-to-production → confirmed
3. **Match line items** to internal SKUs and delivery sites via the master data
4. **Surface what needs attention** (placeholder SKUs/sites that need filling, pending tickets, items being edited)
5. **Maintain master data** for customers, delivery sites, and items/SKUs — including a customer-side SKU catalog so the same SKU can be sold to multiple customers

### Main user flows
- **PO upload** → modal preview → commit → ticket(s) created with line items, locked from edit on PO qty (UAT88)
- **Manual order** → "+ สร้างออเดอร์" → pick customer / site → add items → fill qty → submit
- **Daily review** → date filter (today/range/all) → see all open tickets → expand to edit → submit-for-production
- **Master data fix** → Need Attention shows placeholder records → ✎ แก้ไข opens edit dialog → uncheck Placeholder → save

### Current UAT scope
- Orders tab: full functionality (PO upload, manual orders, status flow, attention section, search, filters, pagination)
- Master Data tab: full CRUD for customers / sites / items, customer-SKU catalog, attention section
- **Daily plan**, **Data & settings**, **Analytics**: legacy V1 pivot table + drag-drop demand explorer — kept for reference but not part of UAT scope
- **Planning** + **Invoice** sub-tabs: empty placeholder views

### What is front-end only / mock / static
**Everything is front-end.** No backend exists. Specifically:
- All persistence is `localStorage`
- All file uploads are read in the browser (SheetJS); uploaded files are **not** stored anywhere
- No user accounts, no auth, no roles — every user sees the same data on their machine
- The "audit log" buttons in Master are local-only diagnostics
- The Analytics pivot table loads its data from `demand_lines_long.csv` if present in the same folder, otherwise empty

---

## B. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | None — vanilla JS | No React/Vue/Svelte |
| Language | JavaScript (ES2020) | No TypeScript |
| HTML | Single file | All markup, CSS, JS inline |
| UI library | None | Hand-rolled CSS, Material-inspired pills |
| Styling | Inline `<style>` block | ~640 CSS rules |
| State management | Module-scoped `let` variables + localStorage | No Redux/Zustand/Context |
| Routing | None — single page, tab switcher | `setTab(name)` toggles `display` |
| Data fetching | None — local files only | `XLSX.read()` for spreadsheets |
| Backend | **None** | Front-end only |
| Database | **None** | localStorage |
| Build tool | None | No webpack, vite, etc. |
| Package manager | npm (only for the dev static server) | No real dependencies |
| Deployment | Open the file in a browser | Or serve any static host |

External libraries (loaded inline as base64 in the file):
- **SheetJS / xlsx** — for parsing Makro/BigC/Thaifood spreadsheets

---

## C. Folder Structure (handover)

```
uat-handover/
├── app/
│   ├── index.html         # The complete UAT application
│   └── sample-data/       # Demand-line CSVs for the Analytics pivot
├── docs/                  # Developer handover docs (you are reading these)
├── reference/             # Original product brief + design system
├── package.json           # Dev-server-only convenience
├── .env.example           # No secrets; documented for completeness
└── README.md
```

The actual application has no folder structure — everything is `index.html`. This is the first thing your team will want to address.

### What belongs where (in the UAT file)
| Section | Approximate line range | Contents |
|---|---|---|
| `<head>` + CSS | 1–860 | Meta tags + ~640 inline CSS rules |
| HTML body | 855–1410 | Tab bar, all 5 tab views, modals, edit dialog |
| First `<script>` | 1411–~3000 | Loaded SheetJS bundle (base64) |
| Main app `<script>` | ~3000–end | I18N, MASTER/ORDERS state, all rendering, all handlers |

A search by feature is the easiest way in:
- `// UAT###` comments mark every feature increment (122 of them)
- `function renderTicketsTable` — the main Orders tab renderer
- `function _renderEditCard` — the inline order editor
- `function renderV3Customers/Sites/Items` — the Master Data tables
- `function _renderAttentionSection` / `_renderMasterAttentionSection` — the Need Attention blocks
- `function parseMakroPoSheet / parseBigCPoXlsx / parseThaifoodPoXlsx` — PO parsers
- `const I18N = { en:{}, th:{...} }` — full Thai dictionary (~250 keys)

---

## D. Feature Architecture (per major feature)

### D1. Orders / Tickets
- **Files:** entire `index.html`
- **Key functions:** `renderTicketsTable`, `_renderEditCard`, `_renderCustSection`, `_renderPoSection`, `_renderDatesSection`, `_renderLogisticsSection`, `_renderLinesSection`
- **Data inputs:** `ORDERS` (per-date buckets of invoice objects), `MASTER_V3.customers/sites/items`
- **Data outputs:** `ORDERS` (mutated in place), persisted via `persistOrders()` to `localStorage[ORDERS_KEY]`
- **Business rules:**
  - 4 statuses: `editing` (not saved yet), `draft`, `submitted`, `confirmed`
  - Cannot move to submitted/confirmed if a line uses a placeholder SKU or the site is a placeholder (see `_ticketHasPlaceholder`)
  - Cannot move to submitted/confirmed if any line has a missing Order qty (UAT87 `_ticketHasMissingOrderQty`)
  - PO-uploaded tickets: PO qty is locked, customer/items locked, site editable
- **Limitations:** no soft delete, no edit history, no concurrent-edit detection
- **Before production:** add server-side validation of every business rule listed above; assume the front-end can be bypassed

### D2. PO Upload
- **Key functions:** `onMakroPoFile / onBigCPoFile / onThaifoodPoFile`, `parseMakroPoSheet / parseBigCPoCsv / parseBigCPoXlsx / parseThaifoodPoXlsx`, `commitMakroPo / commitBigCPo / commitThaifoodPo`
- **Data flow:** browser file picker → `FileReader.readAsArrayBuffer` → `XLSX.read` → custom parser → preview modal → `commit*Po()` writes to ORDERS
- **Business rules:**
  - Each parser detects the customer's specific column layout
  - Site lookup tries multiple strategies: branch code, EAN, fuzzy customer-branch-code match (UAT41/66)
  - Item lookup tries: `partner_item_number` (EAN for BigC), Material code (Thaifood), name fallback (UAT53)
  - Unmatched items become **placeholder SKUs** (UAT60, prefix `PEND-`); unmatched sites become **placeholder sites**
  - Duplicate-PO detection: re-uploading the same PO# for the same customer surfaces a warning
- **Limitations:**
  - All parsing logic is inline; adding a new customer means writing a new parser by copy-paste
  - The CJ button is disabled (no parser written — sample file never received)
  - Large EAN numbers historically lost precision when Excel converted them to scientific notation; mitigated by `_safeIdStr` (UAT65/66) but rebuild should use string-typed columns from day one
- **Before production:** parsing should move server-side once you have a backend; the front-end should just upload the file

### D3. Master Data
- **Key functions:** `renderV3Customers / renderV3Sites / renderV3Items`, `openEditCustomer / openEditSite / openEditItem`, `_renderCustSkuPicker`, `_applyCustSkuFilters`
- **Data inputs:** `MASTER_V3 = { customers, sites, items }`
- **Persistence:** `persistMasterV3()` → `localStorage[MASTER_V3_KEY]`
- **Customer-SKU pairing:** lives in **`customer.skus[]`** (UAT100). Legacy `item.partner_id` is still respected as a fallback. The order editor's item picker honors both (UAT104).
- **Placeholder records:** items + sites have an `is_placeholder` flag set by upload. They render with a yellow `รอข้อมูล` badge until the user opens the edit dialog and unchecks the placeholder.
- **Limitations:** no validation of SKU uniqueness across customers; no enforced schema; deleting a customer doesn't cascade to its sites/items

### D4. Need Attention (Orders + Master tabs)
- **Key functions:** `_renderAttentionSection` (Orders), `_renderMasterAttentionSection` (Master)
- **What it shows:** editing tickets + empty drafts + pending tickets (Orders); placeholder SKUs + sites (Master)
- **Why this matters:** the Attention rows iterate **all date buckets** so they bypass the date filter — operations users see what needs work regardless of what they're filtering for
- **Action buttons:** ✎ แก้ไข (opens editor at the right date), ⚠ Master (opens the underlying placeholder record), ✕ ลบ (delete ticket across all dates — UAT111 fix)
- **Auto-scroll** lands the user on the editor card, not the collapsed row above it (UAT114)

### D5. Search & filters
- **Key functions:** `_itemSearchHay` (UAT105/106), `_hayMatch`, `setOrderDate`, `setGroupFilter`, `setDtFilter`, `setFastFilter`, `setTicketFilter`
- **Search**: AND-tokens with **digit-bounded numeric matching** so typing "5" finds เบอร์ 5 but not แพ็ค 15
- **Egg/pack aliases**: items get `เบอร์ N`, `คละ X-Y`, `ถาด`, `แพ็ค N`, `มัด N`, `pack N`, `pack`, `ฟอง`, `ตะกร้า` added to their searchable haystack based on `primary_grade`, `secondary_grade`, `units.base_per_pack`, `selling_unit`
- **Date filter**: 3 modes — All / Single / Range. Empty drafts and pending tickets bypass the date filter (always pinned to top via the Attention section)
- **Customer pills**: top-5-by-eggs auto-computed; selecting one filters the table

### D6. i18n
- **Key data:** `const I18N = { en:{}, th:{...} }` near line 1410
- **Function:** `t(key, fallback)` — returns Thai text in TH mode, English fallback in EN mode
- **HTML hooks:**
  - `data-i18n="key"` — translates `textContent`
  - `data-i18n-ph="key"` — translates `placeholder` attribute (UAT115)
- **JS hook:** wrap any user-facing string with `t("key", "english fallback")`
- **Default:** Thai (`LANG = "th"` initialized; persisted to `localStorage["demand_dashboard_lang"]`)
- **Re-render hook:** `applyLang()` re-runs `renderTicketsTable`, `_renderAttentionSection`, `_renderMasterAttentionSection` on language switch

---

## E. Data Flow

```
                            ┌──────────────────────────┐
   PO file (xlsx/csv) ──►  │ FileReader → SheetJS     │
                            │ → parser (per-customer)  │
                            └────────────┬─────────────┘
                                         │
                                         ▼
                            ┌──────────────────────────┐
   Manual order            │  Preview modal           │
   ─────────────────────►  │  (validate + show)       │
                            └────────────┬─────────────┘
                                         │ commit
                                         ▼
                  ┌──────────────────────────────────┐
                  │  ORDERS = { date: { invoices: } }│
                  │  MASTER_V3 = { customers, sites, │
                  │                items }           │
                  └────────────┬─────────────────────┘
                               │
                  persistOrders() / persistMasterV3()
                               │
                               ▼
                  ┌─────────────────────────────────┐
                  │  localStorage[ORDERS_KEY]       │
                  │  localStorage[MASTER_V3_KEY]    │
                  └────────────┬────────────────────┘
                               │
                               ▼
                  renderTicketsTable / renderV3*
                               │
                               ▼
                  DOM: tables, edit cards, attention rows
```

### Where to connect the future backend
Every place that calls `persistOrders()` or `persistMasterV3()` should become an API call. Every place that reads `ORDERS[date]` or `MASTER_V3.customers/sites/items` should become a fetch. There are roughly **40 call sites** across the file — `grep -n persistOrders\|persistMasterV3` to find them.

### Validation
Currently all in the browser (`_ticketHasPlaceholder`, `_ticketHasMissingOrderQty`, qty number checks). **None of this is enforceable until the same logic exists server-side.**

---

## F. State Management

### Local state (per-component)
- `_expandedTicketId` — which ticket is currently open in the inline editor
- `_currentPage`, `_userLastPage` — pagination
- `_orderDate`, `_orderDateTo`, `_orderRangeOn`, `_noDateFilter` — date filter state
- `_ticketCustFilter`, `_grpFilter`, `_dtFilter`, `_fsFilter`, `_pdFilter` — chip filters
- `_v3Sub` — which Master sub-tab (customers/sites/items)
- `_editingV3` — the edit-dialog working copy
- `_showLinePickerFor` — which ticket has the +Item picker open

### Shared state (module scope)
- `ORDERS` — all tickets, keyed by date
- `MASTER_V3` — customers / sites / items
- `LANG`, `I18N` — language + dictionary

### Suitability
For UAT, fine. For production with multiple users:
- All shared state must move server-side
- Optimistic updates need conflict detection (`updated_at` column)
- The "auto-save" model (UAT87 made it manual save explicit) needs revisiting once latency exists

---

## G. Deployment Notes

See `DEPLOYMENT_GUIDE.md` for full instructions. Summary:

- **Install:** `npm install` (only installs a dev static server)
- **Develop:** `npm run dev` → http://localhost:8080
- **Build:** none — `app/index.html` IS the build artifact
- **Production deploy:** drop `app/` onto any static host (S3+CloudFront, Netlify, Nginx, IIS, even a USB stick on the operations PC)
- **Environment variables:** none used — `.env.example` is intentionally empty
- **Risks:** see `KNOWN_ISSUES.md`

---

## H. Known Limitations

The full list lives in `KNOWN_ISSUES.md`. The most important ones for an architect to understand right now:

1. **All data is per-browser, per-device.** Two operations users on different machines have different data.
2. **No auth.** Anyone with the URL has full edit/delete.
3. **No audit trail.** Deleted tickets are gone.
4. **Single-file architecture.** A real change requires touching the same file as everyone else — no team can scale on this.
5. **CJ parser doesn't exist.** The button is greyed out.
6. **Planning + Invoice sub-tabs are empty placeholders.**
7. **Performance** is fine up to a few thousand tickets; beyond that, the full re-render-on-every-change pattern will show.
8. **No tests.** Manual UAT only.

These are intentional UAT scope decisions — not bugs. The rebuild on a real stack should treat them as v1 requirements.
