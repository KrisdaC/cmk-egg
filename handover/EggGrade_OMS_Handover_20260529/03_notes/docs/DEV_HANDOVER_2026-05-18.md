# Dev Team Handover — 2026-05-18

**This drop covers the delta from the previous handover (2026-05-13).**
**Audience:** dev team picking up the production port.
**Single source of truth for this drop:** this file. Supersedes any earlier dev-handover scratch.

---

## TL;DR

Three workstreams have moved in parallel since the 2026-05-13 drop:

1. **UAT — Master Data hardened** (Phases 1 → 7C). Every dropdown is now backed by a Controlled Lists / `option_sets` table. Records store stable codes, never labels. A data-loss incident was caught and fixed; the full storage layer is now snapshot-backed.
2. **UAT — Stabilization pass** (Pro Stabilization Tasks 1 → 3). The master-only backup contract was lifted to a generic `safeSet` wrapper that protects all 8 localStorage writes. A persistent header strip shows version + counts + last-save + one-click Backup/Restore. Three new operator-facing docs landed in `docs/`.
3. **Factory — Loop 1 shipped to oms-production/.** The Controlled Lists port — Prisma schema + migration + seed + NestJS module + shared types + React hook + Settings UI — is in place, reviewed by Gemini (round 1), and the review fixes are applied. Read API + soft deactivate / reactivate only; further loops will handle write paths.

**Headline contract for the next factory loop:** business records store **stable codes, not labels**. Unit conversion **numbers** (`base_per_pack` / `base_per_basket` / `base_per_palette`) stay explicit on each SKU. BOM must read the numeric fields and must not infer conversion from unit labels.

---

## 1. UAT app — what changed in `app/index.html`

The single-file UAT grew from 1.39 MB → 1.42 MB (+25 KB / +570 lines) over the window. Two arcs were applied in sequence.

### 1a. Master Data Phases 1 → 7C (the big arc, 2026-05-13 → 2026-05-17)

A seven-phase walk through every Master Data surface, ending in a documented "frozen state" before any BOM work begins.

| Phase | What it shipped |
|---|---|
| **1** | Read-only Master Data Health panel + validators (`validateMasterCustomer/Site/Item`, `validateAllMasterData`, `_mdhBuildContext`). |
| **2A / 2B** | Block invalid saves through Phase 1 validators. Fixed save pipeline: normalize → resolve placeholder → validate → save, with FAIL-SAFE on validator errors. |
| **3A** | XLSX import validated before commit. |
| **4A** | Safe delete: referenced records deactivate (soft delete), hard delete only when unreferenced. `isMasterRecordReferenced(kind, record)` is the gate. |
| **5A** | Clean upload placeholder flow — dedupe on creation, resolve on Save. |
| **5B / 5Final / 5E** | Placeholder SKU → existing SKU mapping with persistent upload memory. Site placeholder → existing site mapping. Saved-mapping suggestion-before-commit for BigC + Thaifood parsers. |
| **5E hotfix** | `_aggregatePendingsForUpload` had a copy-vs-reference bug — push references not copies so confirm propagates from preview to commit. `_getStagedByKey` helper added because `let _bigcUpStaged` doesn't bind to `window`. |
| **Round 2 placeholder fix** | All three delete paths (`_attnDeleteTicket`, `_bulkDelete`, `deleteInvoice`) now delegate to central `deleteInvoiceById`. Ownership tracking: `created_from_ticket_ids` on placeholders, `_placeholder_item_id` / `_placeholder_sku` on lines. Orphan cleanup runs after every delete. |
| **6A / 6B** | Import reference protection — block missing / identity-changed referenced records; warn (non-blocking) on soft identity changes. |
| **7A through 7A-5** | Master Data UI rework. Page hierarchy, modal shell, grouped form sections for Customers / Sites / Items tabs. |
| **7B-1** | Controlled Lists / Dropdown Master **foundation**. New `MASTER_V3.option_sets` field with 15 seeded keys / 111 entries. Helpers: `getOptionSet`, `getOptionLabel`, `isOptionActive`, `isOptionValueReferenced`, `addOption`, `updateOption`, `deactivateOption`, `reactivateOption`. |
| **URGENT data-loss fix** | A `window.addEventListener('load', ensureMasterOptionSets)` hook was racing `boot()` — seed ran before `loadMasterV3()`, wiping the in-memory `MASTER_V3` and overwriting localStorage with empty arrays. Hook removed. `ensureMasterOptionSets()` now called inside `boot()` immediately after `loadMasterV3()`. Defensive guard added inside `ensureMasterOptionSets` that aborts if memory is empty while localStorage has records. |
| **EMERGENCY storage hardening** | `persistMasterV3({ force, snapshotReason })` empty-overwrite guard. Pre-write backup written to `MASTER_V3_KEY + "_backup_latest"` on every save. Timestamped snapshots (`MASTER_V3_KEY + "_backup_<ts>__<reason>"`). New helpers: `listMasterV3Backups()`, `restoreMasterV3FromBackup(key)`, `debugMasterV3Storage()`. |
| **Master JSON Restore** | New `importMasterV3JsonFile(file)` helper + UI button under Data & Settings. Accepts a raw `demand_master_v3.json` snapshot. Used to recover 28 customers / 155 sites / 128 items during the 2026-05-15 incident. |
| **7B-1B** | Read-only "Used Where?" usage map UI for option_sets. |
| **7B-2A** | Delivery Site form fields use `renderOptionSelect` for `delivery_type`, `delivery_zone`, `delivery_region`, `preferred_time_slot`, `preferred_load_in_time`, `acceptable_vehicles[]`. LANG-aware labels (`L(th, en)` helper). |
| **7B-2B** | Customer form uses `renderOptionSelect` for `customer_type`, `business_type`, `customer_tier`, `payment_terms`. LANG-aware labels. |
| **7B-2C** | Item form uses `renderOptionSelect` for `item_role`, `item_type` (was free-text), `egg_content_type`, `primary_grade`, `secondary_grade`, `selling_unit`, `units.base_unit/pack_unit/basket_unit/palette_unit`. Item table cells routed through `getOptionLabel`. **Helper text added: unit labels are for display only; conversion numbers must be entered separately.** |
| **7C** | Final stabilization freeze. Frozen-state header comment, legacy seed constants marked, LANG-aware status chips on all three master tables + Master Data Health panel, dev-comments documenting the contracts on `persistMasterV3`, `ensureMasterOptionSets`, `renderOptionSelect`. |

### 1b. UAT Pro Stabilization Tasks 1 → 3 (2026-05-18)

After the 7C freeze, three deliberate stabilization tasks. Each was rolled back to a known-good MD5 before editing; each closeout doc records pre-/post-MD5 and gives a one-line rollback command.

| Task | Closeout doc | What it shipped |
|---|---|---|
| **1 — safeSet rollout** | `_archive/closeouts-2026-05-18/UAT_TASK1_SAFESET_CLOSEOUT.md` | Generic `safeSet(key, payload, opts)` wrapper at the top of the storage layer. Empty-overwrite guard. Pre-write backup written to `<key>_backup_latest`. Shrink warning when JSON is >30% smaller than the previous value. Quota-aware error handling. Last-save tracking in `_SAFE_SET_LAST_SAVE[key]`. Console prefix `[safeSet]`. Returns `{ ok, blocked?, error?, key, sizeBytes, prevBytes }`. All 8 legacy persist functions (`persistOrders`, `persistPlanning`, `persistDrafts`, `persistMaster` legacy V1, `persistBomDone`, `saveUploaded`, `saveUserMappings`, `persistViews`) rewritten as one-line wrappers. +225 lines net to `app/index.html`. `node --check` clean. |
| **2 — Header status strip + Backup/Restore** | `_archive/closeouts-2026-05-18/UAT_TASK2_HEADER_STRIP_CLOSEOUT.md` | Always-visible header row reading `v3.122 · master synced 2 min ago · 28 cust / 155 sites / 128 items · ⚠ N placeholders`. Two buttons: ⬇ **Backup now** triggers `downloadFullBackup()` (writes a JSON envelope `{ schema_version, exported_at, build_id, parser_version, app_version, counts, payload }` to disk), 📥 **Restore** opens a file picker → `restoreFromFile()`. Reuses Task 1's `safeSet` so restore round-trips safely. Refreshes every 30 s. +345 lines net. |
| **3 — QA Checklist + Bug Log + Workflow** | `_archive/closeouts-2026-05-18/UAT_TASK3_DOCS_CLOSEOUT.md` | Three new files under `docs/`. **Zero code change** — MD5 of `app/index.html` verified identical before and after. |

### Combined UAT app delta (2026-05-13 → 2026-05-18)

| Metric | 2026-05-13 | 2026-05-18 | Δ |
|---|---|---|---|
| `app/index.html` size | ~1.34 MB | 1.42 MB | +84 KB |
| Line count | ~21,855 | 22,781 | +926 lines |
| `node --check` | clean | clean | — |
| Backtick parity | even | even | — |
| Backup snapshots | 1 (master only) | 8 (all persist keys) | +7 |
| `option_sets` keys | 0 | 15 | +15 |
| `option_sets` entries | 0 | 111 | +111 |
| Master record counts | 28 / 155 / 128 | 28 / 155 / 128 | unchanged (verified) |

---

## 2. New documentation surface

| File | Size | What it's for |
|---|---|---|
| `docs/QA_CHECKLIST.md` | 13 KB · 236 lines | The gate before any handover. Sections A–K with 70+ checkboxes covering Build/Boot, Safety/Backup, Master Data, Orders, PO Upload, Daily Plan, BOM, ใบน้อย, Export/Import, Language, plus a 12-row Regression gate. The intended workflow is to copy it to `_archive/QA_CHECKLIST-RUNS/YYYYMMDD-run.md` before each handover and tick boxes in the copy. |
| `docs/BUG_LOG.md` | 7.5 KB · 54 lines | Living markdown-table tracker. Severity scale (🔴 Blocker / 🟠 High / 🟡 Medium / 🟢 Low) and status scale (open / investigating / workaround-in-place / fixed-not-yet-released / closed). Replaces the stale `KNOWN_ISSUES.md`. Pre-filled with 12 rows covering Task 1 + Task 2 follow-ups and pre-existing minor risks. |
| `docs/DEVELOPMENT_WORKFLOW.md` | 5.7 KB · 143 lines | 10-section rules of engagement. **UAT-first** (feature lands in `app/index.html` before any production touch). **Backup before edit** (`cp app/index.html _archive/index-pre-<feature>-YYYYMMDD.html` + MD5 verify). When NOT to touch `oms-production/`. |
| `_archive/closeouts-2026-05-18/UAT_PRO_STABILIZATION_PLAN.md` | 20 KB | The plan that gated Tasks 1–3. Catalogues what the UAT already has, where the gaps are, and what to do next. Useful porting context. |
| `_archive/closeouts-2026-05-18/UAT_TASK1_SAFESET_CLOSEOUT.md` | 14 KB | Task 1 closeout with diff/MD5/QA matrix. |
| `_archive/closeouts-2026-05-18/UAT_TASK2_HEADER_STRIP_CLOSEOUT.md` | 17 KB | Task 2 closeout. |
| `_archive/closeouts-2026-05-18/UAT_TASK3_DOCS_CLOSEOUT.md` | 11 KB | Task 3 closeout. |
| `_archive/closeouts-2026-05-18/FACTORY_LOOP_1_CONTROLLED_LISTS.md` | 18 KB | The Loop 1 implementation note (architecture + 15 files changed + 4 routes). |
| `_archive/closeouts-2026-05-18/FACTORY_LOOP_1_CLOSEOUT.md` | 20 KB | Gemini review fixes (typed `ApiError`, `FALLBACK_ACTOR_ID`, 17 controller tests + 13 shared-helper tests). |
| `_archive/closeouts-2026-05-18/MIGRATION_MAP_2026-05-18.md` | 36 KB | UAT → Factory audit. Tab map, module map, schema diff, the three possible reads of "build the real stack", and Loop-1-only recommendation. |

The Stakeholder note at the workspace root (`STAKEHOLDER-UPDATE-LATEST.md`) still tracks the 2026-05-13 drop — it has not been refreshed for this handover. (Drop-cycle housekeeping per `WORKSPACE_GUIDE.md` is not part of this delta.)

---

## 3. Factory production scaffold — Loop 1 shipped (in `oms-production/`)

The first controlled-migration loop ported the UAT Phase 7B-1 `option_sets` foundation into the existing NestJS + Prisma + Vite/React scaffold. **15 files changed total** plus the Gemini-review followups in `_archive/closeouts-2026-05-18/FACTORY_LOOP_1_CLOSEOUT.md`. Loop 1 is **read API + soft deactivate / reactivate only.** Add / rename / reorder / customer-site-item migrations are intentionally deferred to later loops.

### Files in `oms-production/` touched by Loop 1

```
apps/api/
  prisma/
    schema.prisma                    [modified] +OptionSet, +OptionSetValue
    migrations/
      20260518120000_add_option_sets/
        migration.sql                [NEW]
    seed-option-sets.ts              [NEW] idempotent seed, 15 sets / 111 values
    seed.ts                          [modified] calls seedOptionSets()
  src/
    option-sets/
      option-sets.module.ts          [NEW]
      option-sets.controller.ts      [NEW] 4 routes
      option-sets.service.ts         [NEW] list / deactivate / reactivate / countReferences
      option-sets.controller.spec.ts [NEW] 17 cases
      option-sets.service.spec.ts    [modified] +1 stub-admin fallback case
      shared-option-set.spec.ts      [NEW] 13 pure-function cases
    app.module.ts                    [modified] registers OptionSetsModule

apps/web/
  src/
    lib/
      api.ts                         [modified] throws ApiError with .status, .body, .code
    hooks/
      useOptionSets.ts               [NEW] TanStack Query: list, values, deactivate, reactivate
    components/settings/
      ControlledListsSection.tsx     [NEW] viewer + DeactivateDialog + ReferenceWarningDialog
    pages/
      SettingsPage.tsx               [modified] mounts <ControlledListsSection />

packages/shared/
  src/
    option-set.ts                    [NEW] OPTION_SET_KEYS, schemas, Lang, resolveOptionLabel, normOptionCode
    index.ts                         [modified] re-exports
```

### Backend routes (`apps/api/src/option-sets/option-sets.controller.ts`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/option-sets` | required (AuthGuard) | List the 15 sets with metadata |
| `GET` | `/api/option-sets/:setKey/values` | required | List values for one set. Supports `?includeInactive=true`. |
| `POST` | `/api/option-sets/:setKey/values/:code/deactivate` | required | Body `{ reason?: string, force?: boolean }`. 409 STILL_REFERENCED with `referenced: { customer, site, item }` counts when value is in use and `force !== true`. |
| `POST` | `/api/option-sets/:setKey/values/:code/reactivate` | required | Restores `is_active=true`. |

All four routes write to `AuditLog` via `audit.log({ actor_id, … })`. `actor_id` falls back to `'stub-admin'` (matches `AuthGuard`) when not supplied, so service-to-service calls and future scheduled jobs cannot leak `actor_id: null`.

### Frontend ergonomics

The Settings page mounts `<ControlledListsSection />` above the existing API Keys section. Operator can toggle Thai / English labels and "show inactive." Trying to deactivate a referenced value escalates through:

1. `ApiError` with `e.status === 409 && e.code === 'STILL_REFERENCED'` is caught.
2. A `<ReferenceWarningDialog>` shows the value being deactivated, per-table reference counts (`ลูกค้า / สาขาส่งของ / สินค้า`, only non-zero rows), and the trade-off ("existing records keep showing this value; dropdowns hide it for new records").
3. Two clearly-labelled buttons: `ปิดหน้าต่าง · เก็บไว้` (keep active) and `ยืนยันปิดใช้งานทั้งที่ยังถูกอ้างอิงอยู่` (force).
4. The force path calls the same `useDeactivateOptionValue` hook with `force: true`. Same hook, same cache invalidation, no separate code path.

### Test surface

- `option-sets.controller.spec.ts` — 17 cases (auth-guard metadata binding, six payload-validation cases through the actual `ZodValidationPipe`, two paired force=false/true cases, list/listValues/reactivate, currentUser actor forwarding, `ListOptionValuesQuerySchema` string coercion).
- `option-sets.service.spec.ts` — pre-existing + 1 new `falls back to stub-admin actor when none provided`.
- `shared-option-set.spec.ts` — 13 pure-function cases for the shared helpers.

---

## 4. The data + safety contracts — for the next loops to mirror

Whether Loop 2 ports Customers / Sites / Items, or Loop 3 ports Orders / Daily Plan, these contracts must be enforced on the backend the same way they're enforced in the UAT.

### 4.1 `MASTER_V3.option_sets` shape (UAT) ⇔ Prisma `OptionSet` / `OptionSetValue` (factory)

```js
// UAT memory model:
MASTER_V3.option_sets = {
  delivery_type: [
    { code, label_th, label_en, is_active, sort_order, created_at, updated_at },
    …
  ],
  item_role: […], egg_content_type: […], vehicle_type: […],
  customer_tier: […], payment_terms: […], customer_type: […], business_type: […],
  delivery_region: […], delivery_zone: […],
  preferred_time_slot: […], preferred_load_in_time: […],
  item_type: […], egg_grade: […], unit: […],
};
```

Loop 1's Prisma equivalent (already shipped):

```prisma
model OptionSet {
  setKey      String   @id          // "delivery_type" | "item_role" | ... | "unit"
  labelTh     String
  labelEn     String
  createdAt   DateTime @default(now())
  values      OptionSetValue[]
}

model OptionSetValue {
  id              BigInt   @id @default(autoincrement())
  setKey          String
  code            String
  labelTh         String
  labelEn         String
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  deactivatedAt   DateTime?
  deactivatedBy   String?
  deactivatedReason String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  optionSet       OptionSet @relation(fields: [setKey], references: [setKey], onDelete: Restrict)

  @@unique([setKey, code])
}
```

### 4.2 Six contracts the rest of the port must follow

1. **Business records store stable codes, never labels.** `item.item_role = "FG"`, `customer.payment_terms = "Net30"`, `site.delivery_type = "direct_to_store"`. Labels are derived at render time via `resolveOptionLabel(values, code, lang)` (shared) or `getOptionLabel(setKey, code, LANG)` (UAT).
2. **Inactive option values are preserved on existing records.** Edit dialogs surface them with `(ปิดใช้งานแล้ว)` / `(Inactive)` suffix. New records don't see them.
3. **Unknown legacy free-text values are preserved.** Surfaced with `(ไม่อยู่ในรายการตัวเลือก)` / `(Not in controlled list)` suffix. We never silently mutate the record.
4. **Unit conversion NUMBERS stay explicit on each SKU.** `units.base_per_pack` / `base_per_basket` / `base_per_palette` must be editable number fields. Changing the unit-code dropdown (e.g. `pack_unit: "ถาด" → "แพ็ค 10"`) must **not** mutate those numeric fields. **BOM / Planning / ใบน้อย must read those numeric fields and must not infer conversion from unit labels.** A SKU with `pack_unit = "แพ็ค 10"` and `base_per_pack = 12` is legal — eggs-per-pack is 12, not 10.
5. **Boot order is load-then-seed.** Migration order on the backend should be the same: load existing rows before applying any defaults.
6. **Empty-overwrite guard on every writeable store.** Refuse to overwrite a non-trivial existing payload with an empty/near-empty one without an explicit `force` flag. Pre-write a backup before each save. The UAT now enforces this via `safeSet` across all 8 persist functions; the backend should enforce it via the audit-log + soft-delete pattern Loop 1 already uses.

### 4.3 Fields that reference `option_sets` (porting target)

| Entity | Field | option_set key |
|---|---|---|
| Customer | `customer_type` | `customer_type` |
| Customer | `business_type` | `business_type` |
| Customer | `customer_tier` | `customer_tier` |
| Customer | `payment_terms` | `payment_terms` |
| Site | `delivery_type` | `delivery_type` |
| Site | `delivery_zone` | `delivery_zone` |
| Site | `delivery_region` | `delivery_region` |
| Site | `preferred_time_slot` | `preferred_time_slot` |
| Site | `preferred_load_in_time` | `preferred_load_in_time` |
| Site | `acceptable_vehicles[]` (multi-select) | `vehicle_type` |
| Item | `item_role` | `item_role` |
| Item | `item_type` (was free-text) | `item_type` |
| Item | `egg_content_type` | `egg_content_type` |
| Item | `primary_grade` | `egg_grade` |
| Item | `secondary_grade` | `egg_grade` |
| Item | `selling_unit` | `unit` |
| Item | `units.base_unit` | `unit` |
| Item | `units.pack_unit` | `unit` |
| Item | `units.basket_unit` | `unit` |
| Item | `units.palette_unit` | `unit` |

**Stay explicit (numbers, not codes):** `units.base_per_pack`, `units.base_per_basket`, `units.base_per_palette`.

---

## 5. UAT helper APIs to mirror

Located in `app/index.html`. Each has an obvious server-side analogue.

| Helper | Purpose |
|---|---|
| `getOptionSet(setKey, { includeInactive, includeCurrentValue })` | Returns sorted active values (+ inactives if asked). Sort: `sort_order` → `label_th`. |
| `getOptionLabel(setKey, code, lang)` | Code → label. Appends `· ปิดใช้งานแล้ว · Inactive` suffix for inactive. |
| `isOptionActive(setKey, code)` | Boolean. |
| `isOptionValueReferenced(setKey, code)` | Scans `MASTER_V3.{customers, sites, items}` for any record using this code. Backend equivalent: `option-sets.service.ts → countReferences()` (already shipped in Loop 1). |
| `addOption / updateOption / deactivateOption / reactivateOption` | Mutating helpers. Loop 1 implements the deactivate/reactivate path; add/update is later. |
| `renderOptionSelect(setKey, currentValue, attrs, options)` | UI helper — builds `<select>` with inactive/unknown surfacing built in. Frontend equivalent already shipped: `<ControlledListsSection />`. |
| `_optLabel(opt)` / `resolveOptionLabel(values, code, lang)` (shared) | LANG-aware label extractor. |
| `safeSet(key, payload, opts)` | **New in Task 1.** Wraps every localStorage write with empty-overwrite guard + pre-write backup + shrink warning + quota-aware error handling + last-save tracking. **The backend equivalent is a write-through service that snapshots the previous row and refuses to commit a near-empty replacement without an explicit force flag.** |
| `downloadFullBackup()` / `restoreFromFile()` | **New in Task 2.** UI-level full backup with a version-stamped envelope. Backend should expose `/api/admin/backup` and `/api/admin/restore` with the same shape. |

---

## 6. What's still UAT-only (porting roadmap)

What Loop 1 shipped: **Controlled Lists API** (read + soft deactivate / reactivate).

What's still only in `app/index.html` and waits for future loops:

| Module | UAT lines (approx) | Status |
|---|---|---|
| `safeSet` + 8 persist functions | new in Task 1 | Backend should mirror with a write-through service + audit log on every save. |
| Header status strip + global Backup/Restore | new in Task 2 | Operator UI; backend just needs the `/api/admin/backup` endpoint. |
| Customer / Site / Item CRUD writes through controlled lists | Phases 7B-2A / 2B / 2C | Loop 2 candidate. |
| Placeholder lifecycle (`is_placeholder`, complete-in-place, map-to-existing, ownership tracking, central `deleteInvoiceById`) | Phases 5A / 5B / 5Final / 5E / Round 2 | Loop 3 candidate. Must be designed before PO Upload is fully ported. |
| PO Upload — Makro / BigC / Thaifood parsers | (already partly in `oms-production/`; UAT has saved-mapping suggestion-before-commit added on top) | Loop 4 candidate. |
| Daily Plan — Demand matrix, Trip Manager, round model (`draft → trip_plan_confirmed → logistics → dispatch`) | tasks #177–#192 | Larger loop, has its own pending tasks (#62 – #68). |
| BOM | unchanged in UAT this window | Reads `units.base_per_pack/basket/palette` numerically. Contract is documented. |
| ใบน้อย | unchanged | A6 universal template. |
| Analytics (top customers / pack-size / WoW/MoM) | already in `oms-production/` from earlier phases | — |

---

## 7. Files in this drop

```
uat-handover/
├── README.md, WORKSPACE_GUIDE.md
├── STAKEHOLDER-UPDATE-LATEST.md         (still the 2026-05-13 content)
├── BOM_FEATURE_BRIEF.md                 (next-loop spec, current)
│
├── app/
│   ├── index.html                       (1.42 MB current UAT)
│   └── sample-data/                     (Makro/BigC/Thaifood test files)
│
├── docs/                                ★ four new files this drop
│   ├── DEV_HANDOVER_2026-05-18.md       ← this file
│   ├── QA_CHECKLIST.md                  ★ new
│   ├── BUG_LOG.md                       ★ new (replaces KNOWN_ISSUES.md)
│   ├── DEVELOPMENT_WORKFLOW.md          ★ new
│   ├── CHANGELOG.md                     (last entry: v3.122 — see this doc for the v3.122 → 2026-05-18 delta)
│   ├── ARCHITECTURE_SUMMARY.md, FEATURE_SUMMARY.md, HANDOVER_CHECKLIST.md,
│   └── TECH_STACK_REVIEW.md, DEPLOYMENT_GUIDE.md
│
├── demand_master_v3.json                (Master snapshot — usable with Master JSON Restore button)
│
├── reference/                           (DESIGN_SYSTEM.md, OMS_Brief.md, OMS_Brief_Review.md, QTY_LIFECYCLE.md)
│
├── oms-production/                      ★ Loop 1 changes
│   apps/api/{prisma/{schema, migrations, seed-option-sets, seed}, src/option-sets/*, app.module},
│   apps/web/{lib/api.ts, hooks/useOptionSets, components/settings/ControlledListsSection, pages/SettingsPage},
│   packages/shared/{src/option-set, src/index}
│
└── _archive/
    ├── closeouts-2026-05-18/                       ★ this drop's working docs (moved here for tidiness)
    │   ├── UAT_PRO_STABILIZATION_PLAN.md
    │   ├── UAT_TASK1_SAFESET_CLOSEOUT.md
    │   ├── UAT_TASK2_HEADER_STRIP_CLOSEOUT.md
    │   ├── UAT_TASK3_DOCS_CLOSEOUT.md
    │   ├── FACTORY_LOOP_1_CONTROLLED_LISTS.md
    │   ├── FACTORY_LOOP_1_CLOSEOUT.md
    │   └── MIGRATION_MAP_2026-05-18.md
    ├── PRODUCTION_BUILD_PLAN-20260509.md           (superseded by MIGRATION_MAP)
    ├── KNOWN_ISSUES-20260509.md                    (replaced by docs/BUG_LOG.md)
    ├── index-pre-safeSet-20260518.html             (Task 1 pre-edit snapshot)
    ├── index-pre-header-strip-20260518.html        (Task 2 pre-edit snapshot)
    ├── app-history/                                (legacy backups from earlier in the project)
    ├── STAKEHOLDER-UPDATE-20260513.md
    ├── cmk-handoff-20260513-pre-changelog.zip
    ├── cmk-handoff-extracted-2026-05-13/
    └── oms-production-snapshot-2026-05-11.zip
```

The top-level closeout/plan markdowns are intentionally NOT in `docs/` — they're per-task working documents kept next to the README for visibility. The reusable / structural docs (handover, QA, bug log, workflow) live in `docs/`.

---

## 8. How to verify this build

Recommended order for the dev team:

1. **Open** `app/index.html` in any modern browser. Note the **build ID** in the new header strip (top of every page).
2. **Run** the checklist in `docs/QA_CHECKLIST.md` (≈10–15 min). All sections A–K should pass.
3. **Smoke** the new safety net:
   - Click ⬇ **Backup now** in the header strip → save the JSON envelope to disk.
   - Click 📥 **Restore** → pick the file you just saved → confirm the prompt → page reloads → counts match.
   - DevTools → run `debugMasterV3Storage()` and `listMasterV3Backups()` to confirm snapshot history.
4. **Smoke** Loop 1 in `oms-production/`:
   - Run the migration: `cd oms-production && pnpm prisma migrate dev` (or your equivalent), then `pnpm prisma db seed`.
   - Boot the API + web app.
   - Sign in (stub-admin), open Settings → Controlled Lists. Toggle TH / EN. Toggle "show inactive."
   - Try to deactivate a referenced value → the warning dialog should fire with per-table counts.
   - Force-deactivate → confirm → list refreshes → record still references the now-inactive value with the inactive suffix.
   - Run `pnpm test` inside `oms-production/apps/api/` → 17 controller + service + 13 shared-helper specs should pass.
5. **Read** [`_archive/closeouts-2026-05-18/MIGRATION_MAP_2026-05-18.md`](../_archive/closeouts-2026-05-18/MIGRATION_MAP_2026-05-18.md) § F for the recommended next loop scope.
6. **Decide** Loop 2 scope. The migration map's recommendation is Customers / Sites / Items writes through the option_sets pattern Loop 1 established.

---

## 9. Frozen-state quick reference

This block also lives inside `app/index.html` itself as a code comment near the legacy seed constants:

```
// Master Data 7C frozen state
// * option_sets are the SOURCE OF TRUTH for dropdown values.
// * Business records store STABLE CODES, not labels.
// * Labels are display-only — derived via getOptionLabel/_optLabel/renderOptionSelect.
// * Inactive option values are preserved on existing records (suffix).
// * Unit dropdowns on the Item form NEVER mutate base_per_pack/basket/palette.
// * Boot order: loadMasterV3() then ensureMasterOptionSets().
// * persistMasterV3 has an empty-overwrite guard + pre-write backup.
// * 2026-05-18 Pro Stabilization: safeSet generalizes that guard to all 8 persist functions.
```

---

## 10. Three incidents from this window (lessons for the port)

### Incident A — Master Data wipe on boot (2026-05-15)
**Cause:** A `window.addEventListener('load', ensureMasterOptionSets)` hook fired before `boot()` finished running `loadMasterV3()`. The seed function then persisted an empty `MASTER_V3` over the localStorage value.
**Fix:** Hook removed. Seed moved inside `boot()` after `loadMasterV3()`. Defensive guard inside the seed function aborts if memory is empty while localStorage has records.
**Port lesson:** Load-then-seed. Backend migrations should treat the order the same way — never default a value before reading the existing row.

### Incident B — Aggregator copy-vs-reference (2026-05-14)
**Cause:** `_aggregatePendingsForUpload` spread-copied mapping objects (`{ ...m, ticket_idx, ticket_po }`). Confirming a row in the flattened preview didn't propagate to the source ticket's `pendingMappings` because the preview held a different object.
**Fix:** Push references not copies. `m.ticket_idx = idx; items.push(m)`. Followup hotfix: `_getStagedByKey(key)` helper because `let _bigcUpStaged` doesn't bind to `window` / `globalThis`.
**Port lesson:** When the backend serializes mappings, use IDs not value-copies. Confirm/reject events should mutate by ID lookup.

### Incident C — Orphan placeholders after delete (2026-05-14)
**Cause:** Three independent delete paths (`_attnDeleteTicket`, `_bulkDelete`, `deleteInvoice`) each had their own logic; none cleaned up upload-created placeholders that became orphaned.
**Fix:** Central `deleteInvoiceById` helper + ownership tracking + all three delete paths delegate to it.
**Port lesson:** One delete service, not three. Cascade rules should be enforced server-side regardless of which UI button fired.

---

*Drop prepared 2026-05-18 by Sira (CEO, CMK / ไชยมงคล). Questions → sira.polpanumas@gmail.com.*
*Supersedes all earlier dev-handover scratch from today's working session — this is the single source of truth for the 2026-05-13 → 2026-05-18 delta.*
