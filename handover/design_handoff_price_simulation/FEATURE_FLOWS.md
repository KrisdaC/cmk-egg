# Feature Flows — จำลองราคาและทำข้อเสนอ (Price Simulation & Proposal)

Logical flows for the dev team. UI copy is Thai; internal names in English.

---

## 1. Actors & high-level flow

- **Pricing analyst** (ผู้จัดทำราคา) — owns Step 1 (cost assumptions) and Step 2 (price proposal).
- **Approver / executive** (ผู้บริหาร) — owns Step 3 (approval).

```
Step 1                       Step 2                         Step 3
Cost assumptions      →      Price / proposal        →      Approval
─────────────────            ─────────────────              ─────────────────
open weekly round            pick customer                  filter by cost base(s)
save cost snapshot           set effective dates            + customer + status
submit customer cost   ──►   edit proposed prices     ──►   review request cards
estimates (per cust)         (warnings if < rec.)           approve  → signed quote
                             submit for approval            return   → back to Step 2
```

---

## 2. Core concepts

| Concept | Meaning |
|---|---|
| **Cost Base / round** | A weekly cost snapshot, keyed by ISO week (`2026W26`). All prices in a request trace back to exactly one cost base. |
| **Cost snapshot** | Per-egg production cost components saved for the round. Editing after save requires an explicit re-save (versioned). |
| **Customer cost estimate** | Delivery-group cost rules (e.g. transport ฿/egg) per customer. Status: `draft → submitted`. |
| **Price proposal / request** | A set of proposed SKU prices for one customer + effective date range, submitted against a cost base. Becomes "คำขอ #N" in approval. |
| **Recommended price** | System-computed floor guidance, derived from the reference egg value. Proposing below it raises a **warning** (never a hard block) that follows the request into approval. |
| **Reference egg value (ค่าไข่อ้างอิง)** | Per egg size. With a reference customer: implied from that customer's agreed prices, volume-weighted across their delivery groups. In ทุกราย mode: **volume-weighted average across ALL customers' selling prices** (weights = each channel's weekly egg volume), not a simple mean. |
| **Deadline** | Optional "approve by" time on a request (e.g. วันนี้ 17:00), shown red wherever the request appears. |

---

## 3. Step-by-step logic

### Step 1 — Cost assumptions
1. Analyst opens/creates a weekly round (`+ เริ่มรอบต้นทุนใหม่`). Rounds show status: กำลังทำงาน (working) / ปิดรอบแล้ว (closed).
2. Enters production cost components (฿/egg). **Save = snapshot** for that round; previous round + delta shown per component.
3. Enters/updates customer cost estimates (delivery-group cost rules) and **submits per customer** (`draft → submitted`, timestamped).
   - Delivery groups are managed in the **group-setup modal**: pick sites from the master list (multi-select) → move them into a group (or create a new group from the selection); set DC% / Disty% per group plus a default rule for unassigned sites. Saving creates a **new versioned setup** (e.g. v2026.07) with its own effective-from date — shown prominently in the modal header; past versions are kept in a log. **Rule:** setup versions are immutable once saved; a change = a new version effective from a chosen date.
4. SKU/material cost table supports search, supplier/category filters, upload, and per-row history.

**Rule R1 — pricing gate:** a customer can be priced in Step 2 only after their cost estimate for the active round is `submitted`. Otherwise Step 2 shows the locked banner with a jump-back action.

### Step 2 — Price / proposal
1. Analyst picks reference (specific customer or all) → reference egg values per size are shown (volume-weighted — see §2); a comparison view ranks net egg value across channels.
2. Picks **customer** (chips) and **effective date range** (start required; end optional). The all-customer schedule table opens inside the same card (proposal dates / effective ranges / statuses).
3. Edits proposed prices per SKU or per delivery group. Each row: previous price, proposed (editable), recommended, diff, margin, note.
   - **Rule R2:** proposed < recommended ⇒ amber warning on the row and a warning count on the request. Warnings never block submission.
   - `คัดลอกราคาแนะนำทั้งหมด` copies recommended into all proposed fields.
4. Actions: `พิมพ์ราคาเสนอ` (internal print) and `ส่งตรวจตัวเลข` (**submit for approval**).

**Rule R3 — submit:** submitting freezes the set into a request (`คำขอ #N`) with: customer, SKU count, effective range, cost base id, submitted at/by, warning count, optional deadline. Step 2 then shows the "submitted, awaiting approval" banner; the set is read-only until approved or returned.

### Step 3 — Approval

**Filter panel (one unit, two rows):**
- **Cost Base week-picker** (calendar-style, scales to hundreds of weeks):
  - Trigger shows current selection summary + live request count: `ทุกชุด · 11 คำขอ`, `2026W26 · 22–28 มิ.ย. · 4 คำขอ`, or `เลือก 2 ชุด · 6 คำขอ`.
  - Popover: quick picks **ทุกชุด** (clear → all) and **ล่าสุด** (latest week only); month navigation `‹ มิถุนายน 2026 ›`; one selectable row per ISO week of that month showing week id, date range, request count (`—` and muted when zero). **Multi-select**: clicking toggles; selection is a set of week ids; **empty set = all weeks**.
  - Selected weeks render as removable chips next to the trigger.
- **Customer filter**: dropdown (ทุกลูกค้า default). Active filter shows a clear button.
- **Status tabs**: ทั้งหมด / รออนุมัติ / ส่งกลับให้แก้ไข / อนุมัติแล้ว with counts. Counts respect the cost-base + customer filters. Selecting a tab filters the sections and forces that section open.
- **Pending cue** (`⏳ รอคุณอนุมัติ`): always-visible list of requests waiting for this approver — customer + request # + `⏰ deadline`. Click = deep link (sets customer filter + pending tab).

**Request lifecycle:**

```
                 ส่งตรวจตัวเลข (Step 2)
                        │
                        ▼
                  ┌──────────┐   อนุมัติ (confirm modal)    ┌──────────┐
                  │ pending  │ ───────────────────────────► │ approved │
                  │ รออนุมัติ │                              │ อนุมัติแล้ว│
                  └──────────┘                              └──────────┘
                        │                                        │
   ส่งกลับให้แก้ไข        │                                        ▼
   (reason required)    ▼                                 signed quotation
                  ┌──────────────┐                        (digital-sign meta,
                  │  returned    │                         doc id + hash,
                  │ ส่งกลับให้แก้ไข│                         printable PDF)
                  └──────────────┘
                        │  แก้ไขข้อเสนอ → jumps to Step 2 with
                        ▼  that customer loaded; analyst edits
                  (new submission → pending again)
```

- **Approve** (`อนุมัติคำขอนี้`): confirm modal summarises SKU count, effective range, cost base, and any warnings → on confirm, request becomes `approved`, gets approver + timestamp, and produces the **signed customer quotation** (document id `CMK-<week>-<CUST>-<reqNo>` + hash, signature block).
- **Return** (`ส่งกลับให้แก้ไข`): modal requires a reason (textarea). Request becomes `returned`, carrying reason + returned-at/by. The analyst sees it and jumps back to Step 2 via `แก้ไขข้อเสนอ`.
- **Print** (`พิมพ์ใบเสนอราคา`): customer quotation view for a pending request (marked draft until approved).

**Rule R4:** approval decisions are per request (customer × submission), not per SKU row.
**Rule R5:** approved requests are immutable; a price change requires a new request cycle.
**Rule R6:** deadlines are advisory sort/urgency signals, not auto-expiry.

---

## 4. State model (suggested)

### Entities
```
CostRound        { weekId, dateRange, status: working|closed }
CostSnapshot     { roundId, components[{name, value, unit}], savedAt, total }
CustCostEstimate { roundId, customerId, rules[...], status: draft|submitted, submittedAt }
PriceRequest     { id, reqNo, customerId, costBaseWeekId, effectiveStart, effectiveEnd?,
                   lines[{skuId, groupId, prevPrice, proposedPrice, recommendedPrice, note}],
                   warningCount, deadline?, submittedAt, submittedBy,
                   status: pending|returned|approved,
                   returnReason?, returnedAt?, returnedBy?,
                   approvedAt?, approvedBy?, docId?, docHash? }
```

### Approval-screen UI state
```
selectedCostBases : string[]   // week ids; [] = all
calendarMonth     : 'YYYY-MM'  // picker month nav
pickerOpen        : boolean
customerFilter    : 'all' | customerId
statusFilter      : 'all' | 'pending' | 'returned' | 'approved'
sectionCollapsed  : { pending?, returned?, approved? }   // all default OPEN
expandedCards     : Set<requestId>
modal             : null | {type:'approve',req} | {type:'return',req} | {type:'history',...} | {type:'quote',...}
```

### Derived values (recompute on any filter change)
```
visibleRequests = requests
  .filter(r => selectedCostBases.empty || selectedCostBases.has(r.costBaseWeekId))
  .filter(r => customerFilter=='all' || r.customerId==customerFilter)
statusCounts    = countBy(visibleRequests, status)      // drives tabs
pendingCue      = visibleRequests.where(status=='pending')
                    .map(r => {customer, reqNo, deadline})  // drives ⏳ pill
calendarWeeks(month) = ISO weeks overlapping month
                    .map(w => {weekId, dateRange, count: requests per w})
```

---

## 5. Edge cases

- **Week with no requests** selected in the picker → sections show empty-state text (e.g. "ไม่มีคำขอที่รออนุมัติ"); counts read 0. Valid state, not an error.
- **Effective ranges spanning months** display as `29 มิ.ย. – 5 ก.ค.`.
- **Multiple requests per customer** are distinct cards (`คำขอ #1`, `#2`) approved independently.
- **Returned + resubmitted**: resubmission creates a new pending request; the returned card's history is preserved.
- **Hundreds of weeks**: the picker is month-paged, so DOM stays ~5 rows; fetch per-week request counts per visible month.
- **Timezone**: week boundaries are Monday-start ISO weeks; deadlines are local factory time.
