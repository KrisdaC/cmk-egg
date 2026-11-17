# CMK Factory Design System

A generic, reusable UI design system for **factory operations software**. It
defines typography, color tokens, component patterns (cards, pills, tables,
tabs, buttons) and a bilingual **Thai-first / English** operator voice once, so
every app shares one look.

First applied to an **Order Management System (OMS)** — an egg-grading factory's
order desk. Now the backbone for a **Manufacturing Resource Planning (MRP) /
production-flow system** that turns confirmed orders into a production +
material plan, and will integrate with the order system. Built for dense,
legible, operator-facing factory tooling — **boring, reversible, fast to
scan**. Factory floor first, not marketing polish.

## Source material

This system was extracted from a reference codebase provided read-only:

- `design-system-src/` (mounted local folder) —
  - `styles.css` (UAT v3.122) — all CSS from the reference app: tokens, pills,
    cards, tables, tabs, buttons, the Daily-Plan command layer.
  - `DESIGN_SYSTEM.md` — OMS component conventions (pill families, status
    pills, KPI tiles, bubble rows, items-grid alignment, egg-grade schema).
  - `DAILY_PLANNING_DESIGN_SYSTEM.md` — MRP page-layout rules (page hierarchy,
    sticky/round-first header, KPI rules, row/grid order, language rule).
  - `components.html` — a minimal rendered component showcase.

No live design file or repo URL was provided; the above local folder is the
single source of truth.

---

## CONTENT FUNDAMENTALS — how copy is written

- **Bilingual, Thai-first, single active language at render.** The UI shows
  *one* language at a time (via `_lng('TH','EN')`), never `TH · EN` pairs. The
  exception is item/SKU names that are themselves bilingual data. Thai is the
  operator's working language; English labels appear in English builds.
- **Operational wording, not technical.** Say what the operator should *do* or
  *see*, not the system's internal model. Avoid jargon like "Projected".
  Examples: round status reads **"กำลังทำงาน / ปิดรอบแล้ว / ยังไม่เปิด"** (working /
  closed / not yet open), not "Active/Inactive". Material shortfall reads
  **"สั่งเพิ่ม 1,180"** (order 1,180 more), not "Deficit".
- **Quantity is the hero; everything else supports it.** Numbers are the
  loudest thing in a row. Conversions and specs are muted below.
- **Ready is quiet, warnings are loud and actionable.** A satisfied state is a
  soft muted "พร้อมผลิต / Plan ready"; a problem is an amber action-worded chip
  with a count and what to do.
- **Voice is calm and reversible.** No exclamation, no marketing adjectives, no
  hype. Tone: a clipboard on the factory floor. Dense but legible.
- **Casing.** Section headers are 11px UPPERCASE with 0.4px tracking. Body and
  labels are sentence case. Buttons use the verb first (ปิดรอบ · Close round).
- **No emoji as decoration.** A tiny set of functional glyphs only (see
  Iconography). ⚡ marks same-day; ●✓↪○ encode round state. Never faces, never
  emoji cards.
- **Pronouns.** The product rarely addresses the user; it states facts and
  offers actions ("23 รายการ", "ต้องยืนยันแพ็คก่อน"). Neither "I" nor "you" voice.

---

## VISUAL FOUNDATIONS

**Overall vibe.** A pale, near-white operator console. Information density is
high but never noisy: everything sits on white **bubble** cards floating on a
`#fafbfc` page, separated by air, organized into fixed columns. Color is used
almost entirely for *meaning* (status, entity identity), not decoration.

- **Color.** Neutral grayscale carries 90% of the UI (`#1a1a1a` text → `#888`
  hints → `#d6d8dc` borders → `#fafbfc` page). Meaning comes from a small
  semantic set (info blue `#0C447C`, success green `#27500A`, warning amber
  `#854F0B`, danger `#791F1F`) always as **text-on-soft-tint**, never
  saturated blocks. Entities (customers, sizes, packaging) each get **one
  canonical pair** — a saturated fill + a soft same-hue tint — defined once in
  `components/lib/categorical.js`; never improvise a per-page color. Ordered
  data (egg grade, priority) uses a **warm→cool sequential ramp**.
- **Type.** Inter (Latin) + Noto Sans Thai (Thai) for UI; IBM Plex Mono for
  codes/IDs/PO numbers (in `#0C447C`). All numbers `tabular-nums`. Body 12–13px;
  section headers 11px uppercase `#888`. Scale is small and dense by design.
- **Cards / surfaces.** The "bubble": white, **1px `#d6d8dc` border, 8px
  radius, shadow `0 1px 2px rgba(0,0,0,.04)`**. KPI tiles, panels, editor
  sections and *table rows* are all the same bubble family. The MRP board uses
  a softer variant: 12–14px radius, hairline `#eef0f3` border, lighter shadow.
- **Pills are the primary unit.** Status, category, type, size — almost
  everything classifiable renders as a pill (10px radius, weight 600, 10–11px).
  Round-status and filter chips use fully-round `9999px`.
- **Borders & shadows.** Borders are the main separator (hairline grays);
  shadows are extremely subtle (`/.04`) — they lift a card a hair off the page,
  never a drop-shadow flourish. Popovers `0 6px 18px /.12`, modals `0 16px 48px
  /.30`.
- **Spacing & layout.** Page padding 14×18px, card padding 12×14px, 12–14px
  vertical rhythm. Tables are **fixed-column grids**: identity left · spec
  middle · quantity right (hero, bold, tabular) · status far right. Sticky
  headers are fully opaque; KPIs are never sticky. One level of detail panel
  under a row — avoid card-in-card-in-card.
- **Backgrounds.** Flat solids only. No gradients, no imagery, no textures, no
  patterns. The page is `#fafbfc`; cards are white. (Mesh/gradient backgrounds
  are explicitly *out of vocabulary*.)
- **Corner radii.** 5px inputs/buttons · 6px small chips · 8px cards/pills/rows
  · 10px pills · 12–14px soft MRP cards · 9999px round/filter chips.
- **Animation.** Minimal and functional. Short `0.1–0.12s` color/background
  transitions on hover; a `0.12s` caret rotate on expand. No bounces, no
  parallax, no entrance choreography, no infinite loops. Reversible and instant.
- **Hover states.** Rows/cards lighten to `#fafbfc`; tabs darken text to
  `#1a1a1a`; buttons darken fill slightly; filter chips invert to filled.
- **Press / active states.** Active filter pills become filled (brand color or
  black) with white text and a subtle ring; no shrink/scale transforms.
- **Focus.** Inputs get a `#185FA5` border + soft `rgba(24,95,165,.12)` halo.
- **Transparency / blur.** Essentially none in content. Only modal scrims use a
  translucent dark overlay; no glass/blur effects.
- **Imagery.** There is none. This is a data tool; the "imagery" is the data
  itself — pills, numbers, and grids. Don't add stock photos or illustrations.

---

## ICONOGRAPHY

This system is **deliberately near-iconless** — it relies on pills, color and
typography, not an icon set. There is no bundled icon font or SVG sprite in the
reference app.

- **Functional Unicode glyphs only**, used sparingly and always with a text
  label:
  - `⚡` — same-day / urgent (paired with "วันเดียว").
  - `●` working round · `✓` closed round · `↪` receiving/deferred · `○` not-yet-open · `ALL` aggregate (round-status tokens; see `RoundChip`).
  - `▾` select/disclosure caret · `⌕` search · `×` remove/close.
- **No emoji as decoration**, ever. No emoji cards, no faces.
- **No hand-drawn SVG icons.** If a future surface genuinely needs line icons,
  introduce a single CDN set with a matching stroke weight (e.g. Lucide /
  Phosphor at ~1.5px) and document the choice here — but prefer a pill or a
  word first. Status is communicated by **color + word**, not a glyph.
- Codes and IDs (PO numbers, SKUs) act as visual anchors and are set in mono
  `#0C447C` — they read as "machine identifiers", a deliberate iconographic
  role.

---

## Tokens & files

- **`styles.css`** (root) — the single entry point consumers link. `@import`
  lines only.
  - `tokens/fonts.css` — webfonts (Inter, Noto Sans Thai, IBM Plex Mono).
  - `tokens/colors.css` — base neutrals + semantic aliases.
  - `tokens/categorical.css` — customer / egg-size / packaging / delivery /
    round-status entity pairs.
  - `tokens/typography.css` — font families, scale, weights.
  - `tokens/spacing.css` — spacing, radius, shadow tokens.
  - `primitives.css` — canonical CSS classes (`.cmk-pill`, `.cmk-status`,
    `.cmk-btn`, `.cmk-card`, `.cmk-tabs`, `.cmk-table`) for plain-HTML consumers.
- **`components/lib/categorical.js`** — the **one** canonical entity→color
  mapping. Add new customers/families here, nowhere else.

## Components (`window.CMKFactoryDesignSystem_e4dc70`)

| Component | Where |
|---|---|
| `Button` | `components/buttons/` |
| `CustomerPill`, `StatusPill`, `SizePill`, `PackPill`, `DeliveryTypePill`, `RoundChip`, `FilterChip` | `components/pills/` |
| `Card`, `KpiTile` | `components/surfaces/` |
| `Tabs` | `components/navigation/` |
| `BubbleTable` | `components/data/` |

Each directory has a `@dsCard` showcase HTML; key components have a
`.prompt.md` with usage.

## UI kits

- **`ui_kits/order_management/`** — OMS: Orders board + inline editor + Master
  data.
- **`ui_kits/daily_planning/`** — MRP: round-first Demand/FG board + Raw
  Material board.

## Foundation specimen cards

`guidelines/` — Type (UI, mono, scale), Colors (neutrals, semantic, customer,
egg ramp, round), Spacing (radii, shadows, rhythm). All render in the Design
System tab.

---

## CAVEATS / substitutions

- **Fonts load from the Google Fonts CDN** (`tokens/fonts.css`), not self-hosted
  woff2. Inter, Noto Sans Thai and IBM Plex Mono are the real intended faces —
  this is a hosting choice, not a substitution. The reference app's stack also
  lists `'Sukhumvit Set'` / `'IBM Plex Sans Thai'` as Thai fallbacks; these
  remain in the font-family list for systems that have them.
- The reference `styles.css` carries many app-specific classes (the full
  Daily-Plan command layer, matrix tables, print sheets). This system ships the
  **reusable core** as tokens + primitives + React components; the deep
  app-specific layout classes were intentionally not re-shipped wholesale.
