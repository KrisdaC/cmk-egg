# Handoff: จำลองราคาและทำข้อเสนอ (Price Simulation & Proposal)

## Overview
An internal pricing desk for an egg factory, built on the **CMK Factory Design System**. It takes a weekly cost snapshot ("Cost Base"), lets a pricing analyst simulate and propose customer prices per SKU / delivery group, and routes the proposals through an executive approval gate that produces a signed customer quotation.

Three steps, one screen each, navigated by the sticky header stepper:

1. **สมมติฐานต้นทุน** — Cost assumptions (weekly cost rounds, production cost snapshot, per-customer cost estimates, material/SKU costs)
2. **ราคา / ข้อเสนอ** — Price simulation & proposal per customer
3. **ราคาอนุมัติ** — Approval queue (review, approve, return for edits, print/signed quote)

See **FEATURE_FLOWS.md** for the logical flows, state machine, and business rules.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, not production code to ship. Your task is to **recreate these designs in your codebase's existing environment** (React, Vue, etc.) using its established patterns and libraries. If no frontend environment exists yet, pick the framework most appropriate for your stack and implement the designs there.

- `Price Simulation & Proposal (standalone).html` — **open this in any browser**. Fully self-contained (fonts, styles, JS inlined). This is the reference to click through.
- `source/Price Simulation & Proposal.dc.html` — the editable source (custom component format). Open the whole `source/` folder as a static site if you want to inspect it running; otherwise read it as markup + logic reference. The state logic lives in the `class Component` script at the bottom — it documents every interaction handler.
- `source/_ds/` — the CMK Factory Design System tokens (CSS custom properties) and component bundle the design is built on. **All colors, type, spacing come from these token files** — implement against equivalent tokens, not hard-coded values.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interaction states are final and follow the CMK Factory Design System. Recreate the UI faithfully using your codebase's component library, mapping the token values below.

## Screens / Views

### Shared shell
- Sticky white header (`border-bottom: 1px var(--border-default)`): page title 18px/700 Thai + 11px hint English subtitle, then step tabs `1 · สมมติฐานต้นทุน › 2 · ราคา / ข้อเสนอ › 3 · ราคาอนุมัติ`. Active tab = dark fill (`--gray-900`) white text; inactive = white bordered.
- Scrollable main area, page background `--surface-page` (#fafbfc), content padding 16×18px.
- Everything sits on white "bubble" cards: 1px `--border-default` (#d6d8dc) border, 8px radius, shadow `0 1px 2px rgba(0,0,0,.04)`, padding ~12×14px.
- Type: Inter + Noto Sans Thai; IBM Plex Mono (`.num`, tabular) for all numbers, codes, week IDs. Body 12–13px; section headers 9.5–11px UPPERCASE, letter-spacing .4px, color #999. UI is Thai-first.

### Step 1 — สมมติฐานต้นทุน (Cost assumptions)
- **Purpose:** establish the weekly cost snapshot everything else prices against.
- **Layout:** 2-column grid `282px | 1fr`.
- **Left rail — รอบต้นทุน (cost rounds):** primary dark button `+ เริ่มรอบต้นทุนใหม่`, then a vertical list of week cards (`2026W26`, date range, StatusPill: กำลังทำงาน / ปิดรอบแล้ว, warning notes). Selected week = highlighted border.
- **Right column, stacked cards:**
  - **ต้นทุนการผลิต** — per-egg production cost components table (this round vs last round vs change, signed diff coloring), dashed-top total row `ต้นทุนทั้งโรงงาน / ฟอง ฿X.XX`, save-snapshot state pill + button.
  - **ต้นทุนประเมินของลูกค้า** — delivery-group cost rules grid (transport ฿/egg etc.) and per-customer submit state (draft/submitted + time). Submitting a customer's estimate is what unlocks pricing for that customer in Step 2.
  - **ต้นทุนวัตถุดิบ / SKU** — searchable, filterable (supplier, category) SKU cost table with upload action and expandable history rows.

### Step 2 — ราคา / ข้อเสนอ (Price / proposal)
- **Purpose:** simulate and set proposed prices for one customer at a time; submit the set for approval.
- **Row 1 card:** reference selector (อ้างอิงจาก: customer or ทุกราย เฉลี่ยถ่วงน้ำหนัก), read-only cost-round label, reference egg value strip (per size pills, ฿/egg — **volume-weighted average of selling prices**, see FEATURE_FLOWS §2), and a collapsible cross-channel comparison table (net egg value per size per customer, highlights best channel).
- **Row 2 card (one unit):** top row = labeled columns (label above control, bottom-aligned): ลูกค้า customer chips (categorical colors) + overflow select | hairline divider | เริ่มใช้ effective date range (start required, success-green; end optional). The collapsible schedule table (กำหนดการราคา: proposal date, effective range, status pill per customer) opens **inside the same card** under a hairline top border, sharing the 14px edges.
- **Gate banners:** locked amber banner `🔒 ยังตั้งราคาไม่ได้` (with jump-back button) when the customer's cost estimate isn't submitted; blue info banner when the price set has been submitted for approval.
- **Price table card:** header = customer chip + `ราคาเสนอรายกลุ่มจุดส่ง` + StatusPill + actions (`คัดลอกราคาแนะนำทั้งหมด`, `พิมพ์ราคาเสนอ`, dark primary `ส่งตรวจตัวเลข`). Toolbar: group-by segmented control (ราย SKU / รายกลุ่มจุดส่ง), egg-size filter, sort, expand/collapse. Rows: grid with previous price, editable proposed price, recommended price, diff vs recommended (signed color), margin, warning text (below-recommended amber), note. Warnings never block — they surface and travel with the request to approval.

### Step 3 — ราคาอนุมัติ (Approval)
- **Purpose:** the final gate: review submitted requests, approve or return them.
- **Filter panel (one card, two connected rows):**
  - *Row A (white, 11×14px padding):* `COST BASE` label + **calendar week-picker trigger** (bordered button: current summary e.g. `ทุกชุด · 11 คำขอ ▾`). Popover (312px, radius 8, shadow `0 6px 18px rgba(0,0,0,.12)`): quick chips `ทุกชุด` / `ล่าสุด · 2026W26`, month navigation `‹ มิถุนายน 2026 ›`, then one row per ISO week — `W26 | 22–28 มิ.ย. | 4 คำขอ | ✓` — multi-select toggle; selected = dark fill; weeks with no requests muted with `—`. Selected weeks also render as removable chips (`2026W26 22–28 มิ.ย. ×`) next to the trigger. Right side: `ลูกค้า` dropdown (ทุกลูกค้า / per customer) + `× ทุกลูกค้า` clear when filtered.
  - *Row B (surface-page tint, top hairline):* status tabs with counts — ทั้งหมด / รออนุมัติ / ส่งกลับให้แก้ไข / อนุมัติแล้ว (colored dot + count) — and, right-aligned, the amber **pending cue** pill `⏳ รอคุณอนุมัติ` listing each waiting request: customer chip + request # + `⏰ deadline` (danger red), each clickable to jump to it.
- **Request sections** (all default open, collapsible): รออนุมัติ / ส่งกลับให้แก้ไข / อนุมัติแล้ว, each a stack of request cards.
- **Request card:** customer chip + `คำขอ #N` pill + status pill; meta lines (SKU count, effective date, submitted at/by, deadline in red); amber warning strip `⚠ คำเตือน: ต่ำกว่าราคาแนะนำ N รายการ` when applicable; expandable detail (delivery-group tables: SKU, prev, proposed, change, effective, warning; per-row price history modal). Footer actions for pending: `ดูรายละเอียด` / `ส่งกลับให้แก้ไข` / `พิมพ์ใบเสนอราคา` / dark primary `อนุมัติคำขอนี้`. Approved cards show digital-signature meta and a signed-PDF quote action; returned cards show the return reason + `แก้ไขข้อเสนอ` jump to Step 2.
- **Modals:** approve confirmation (summary + warnings), return-for-edit (required reason textarea), price history, customer quotation print view (A4-style document with company/customer info, price table, signature blocks).

### Delivery-group setup modal (ตั้งค่ากลุ่มจัดส่งและต้นทุน)
- **Header:** title + subtitle, then a bottom-aligned context strip: prominent ลูกค้า selector (bold, dark 1.5px border) | divider | current version (v-id + Active pill + effective range) → **new version box** (success-green tint) holding the มีผลตั้งแต่ date input. Previous-version note right-aligned.
- **Left panel:** Master Delivery Site list — search, region filter, "เฉพาะที่ยังไม่จัดกลุ่ม" toggle; rows toggle selection on click (checkbox + blue tint). When ≥1 selected, a blue info bar appears: "เลือกแล้ว N จุดส่ง — กด 'ย้ายที่เลือกมาที่นี่' ที่กลุ่มปลายทาง" + clear link.
- **Right panel order:** ค่าเริ่มต้น default card (amber) → compact one-line **+ เพิ่มกลุ่มใหม่** (name input + สร้าง (N) button, dashed border) → group cards (DC% / Disty% / note inputs, member chips with ×, ย้ายที่เลือกมาที่นี่ / เลิกใช้ actions) → version log.
- **Footer:** change summary (new version · effective date · N การเปลี่ยน) + ยกเลิก / บันทึกเป็น Setup เวอร์ชันใหม่ (enabled only when dirty).

## Interactions & Behavior
- All hovers: 0.1–0.12s background/color transitions; rows lighten to #fafbfc; carets rotate on expand. No entrance animations.
- Calendar picker: click-outside closes (transparent fixed overlay); toggling weeks updates all counts/lists immediately; empty selection = "ทุกชุด" (all weeks).
- Status tabs both filter the list and force the matching section open.
- Pending-cue chips deep-link: set customer filter + pending tab.
- Approve → confirm modal → card moves to อนุมัติแล้ว, counts update, signed meta appears. Return → reason modal (textarea, placeholder suggests wording) → card moves to ส่งกลับให้แก้ไข with reason shown.
- Print views open as in-app document overlays (browser print → PDF).

## State Management
See FEATURE_FLOWS.md §4 for the full state model and transitions. Key server-backed entities: CostRound(week), CostSnapshot, CustomerCostEstimate, PriceProposal(request), ApprovalDecision. Key UI state: current step, selected customer, cost-base multi-select (empty = all), customer filter, status filter, per-card expansion, modal state.

## Design Tokens
From `source/_ds/.../tokens/` (use these files as the source of truth):
- Neutrals: `--gray-900 #1a1a1a` (text, primary buttons) → `--gray-050 #fafbfc` (page); borders `#d6d8dc` default, `#ecedf0` subtle.
- Semantic (text-on-tint): info `#0C447C / #E6F1FB`, success `#27500A / #EAF3DE`, warning `#854F0B / #FAEEDA`, danger `#791F1F / #FCEBEB`.
- Mono/code accent: `--blue-ink #0C447C`; interactive blue `--blue-700 #185FA5`.
- Customer/entity colors: `tokens/categorical.css` — one canonical fill+tint pair per customer; never improvise.
- Radii: 5px inputs/buttons · 6px chips · 8px cards · 9999px round chips/pills. Shadows: card `0 1px 2px /.04`, popover `0 6px 18px /.12`, modal `0 16px 48px /.30`.
- Type scale: page title 20px, section h2 14–15px, body 12–13px, meta 11px, labels 9.5–10px uppercase. Numbers always `tabular-nums` / IBM Plex Mono.

## Tweakable theme props (prototype-only)
The prototype root accepts three theme props applied as CSS-variable overrides — useful for taste-testing, not required in production: `surfaceTone` (cool/warm/slate/paper), `signalStrength` (calm/balanced/vivid status tints), `typeface` (inter/sarabun/plex).

## Assets
No imagery or icon set — the design system is deliberately near-iconless. Only functional Unicode glyphs (⏳ ⏰ ⚠ ✓ × ▾ ‹ ›) and the Google-Fonts webfonts (Inter, Noto Sans Thai, IBM Plex Mono).

## Files
- `Price Simulation & Proposal (standalone).html` — self-contained clickable reference
- `FEATURE_FLOWS.md` — logical flows, state machine, business rules
- `source/Price Simulation & Proposal.dc.html` — source markup + interaction logic
- `source/support.js` — prototype runtime (not for production)
- `source/_ds/` — design-system tokens, primitives CSS, component bundle
