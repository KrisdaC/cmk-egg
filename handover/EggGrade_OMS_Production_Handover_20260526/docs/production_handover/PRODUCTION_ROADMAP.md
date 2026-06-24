# Production Roadmap — EggGrade OMS

> **Purpose.** Lay out the phased migration plan from the UAT (single-file `app/index.html`) to a production-grade system. Includes the parked `oms-production/` scaffold's status, recommended target stack, milestones, and a risk register.
>
> **Source references.** `_archive/closeouts-2026-05-18/UAT_PRO_STABILIZATION_PLAN.md`, `_archive/closeouts-2026-05-18/MIGRATION_MAP_2026-05-18.md`, `oms-production/STATUS.md`, `docs/DEV_HANDOVER_2026-05-25.md`.

---

## 1. Strategic posture

**[UAT-Confirmed]**: As of 2026-05-18 the stance documented in `UAT_PRO_STABILIZATION_PLAN.md` is:

1. **The UAT is production-in-fact.** Operators run their day on `app/index.html`. Every change is small, reversible, and observable.
2. **Stabilize before extending.** No new features were added on top of an unsafe foundation. Tasks 1–3 (safeSet layer, header strip, docs) were completed in May 2026. BOM was then stabilized in Tasks 4–10B.

**[Prod-Recommendation]**: The same posture must continue into production migration. The migration plan in this document is **additive and parallel** — it stands up a production system *alongside* the UAT, validates it against operator workflows, then cuts over. The UAT remains the operator's daily tool until production demonstrably matches it.

---

## 2. Parked oms-production/ scaffold

**[UAT-Confirmed]**: `oms-production/` is a NestJS + Prisma + React scaffold built in Phases 0–6 plus Loop 1 (Controlled Lists). It is **parked** as of 2026-05-18.

Two specific unfreeze conditions in `UAT_PRO_STABILIZATION_PLAN.md`:

1. The UAT's persistence layer is stable end-to-end (✅ Tasks 1 + 2 done, manual QA pending).
2. A clear product owner / dev team commits to maintaining the production stack.

Neither has been confirmed met since the document was written. The package recommends **not** extending `oms-production/` until both are explicitly addressed.

**[Prod-Recommendation]** Re-baseline. If the dev team decides to continue with `oms-production/`, do so only after:

- Reading `oms-production/STATUS.md`, `oms-production/FACTORY_LOOP_1_CONTROLLED_LISTS.md`, `oms-production/FACTORY_LOOP_1_CLOSEOUT.md`, and `_archive/closeouts-2026-05-18/MIGRATION_MAP_2026-05-18.md` end-to-end.
- Re-running `pnpm install` / equivalent and verifying the scaffold still builds with current toolchain.
- Re-baselining Prisma schema against the latest `MASTER_V3` shape (the shape evolved during the BOM/Basket stabilization work).
- Confirming the dev team will own ongoing maintenance, otherwise it will park again.

If the dev team decides to start fresh, `oms-production/` is a useful **reference** for the data model and the Controlled Lists API surface but should **not** be treated as load-bearing code.

---

## 3. Target stack — recommendation

**[Prod-Recommendation]**: A reasonable target stack that minimizes drift from the UAT model:

| Layer | Choice | Why |
|---|---|---|
| Database | PostgreSQL 15+ | Standard, has good JSONB for the `units` ladder and `option_sets`, well-supported in Thailand. |
| ORM / migrations | Prisma or Drizzle | Prisma was used in oms-production/; Drizzle if the team prefers SQL-first. |
| Service layer | NestJS (TypeScript) or Fastify | Already familiar from oms-production/; NestJS gives DI + validation pipes that match the UAT validator pattern. |
| Frontend | React (Vite or Next.js) | Re-uses TypeScript across stack; Next.js if SSR / SEO is wanted (not needed for an internal OMS). |
| UI components | Tailwind + Radix / shadcn | Modern, accessible, fast to build. |
| State | TanStack Query + Zustand | Server state via Query; UI state via Zustand. |
| Auth | Auth.js (NextAuth) or built-in | Single-tenant internal app; password + MFA is enough at start. |
| Realtime | Server-sent events or WebSockets | For Daily Plan multi-user editing. |
| File parsing | SheetJS (xlsx) | Same library the UAT uses. Re-use parsers verbatim where possible. |
| Backup | Daily DB snapshots to S3-compatible storage | Mirrors UAT's `safeSet` philosophy at infra level. |
| Hosting | Containerized (Docker) on Hetzner / Vultr / AWS | Stack-agnostic; pick what the team can operate. |

**[Future-Feature]**: Mobile companion apps (Android tablets at the picking floor) are out of MVP scope but should be considered for the loaded / delivered qty feature loop.

---

## 4. Phased migration plan

### Phase P0 — Foundation (2 weeks)

**Goal**: stand up the production repo skeleton + CI.

**Deliverables**:
- Monorepo (apps/web + apps/api + packages/shared).
- PostgreSQL local dev via Docker Compose.
- Prisma / Drizzle schema covering customers, sites, items, option_sets — direct 1:1 with `MASTER_V3` (no normalization yet beyond what the JSON already implies).
- One end-to-end "hello world" round-trip: create a customer via API → see it in the DB → list it on the web.
- CI: type check, build, lint, run a single Jest test.

**Acceptance**: a fresh clone + `make up` brings up a working system that can store and list one customer.

### Phase P1 — Master Data parity (3 weeks)

**Goal**: full Master Data tab behavior equivalent to the UAT.

**Deliverables**:
- Customers / Sites / Items CRUD APIs.
- Items API exposes every field from `LOGIC_BASE_SPEC.md` § 10 source-of-truth-per-module table.
- Item editor frontend rendering Identity, Counting & Units, Basket Profile, Egg Profile, BOM, External References, System / Audit — mirror the UAT's `_sec(...)` structure.
- Validators: port `validateMasterCustomer / Site / Item` to TypeScript pure functions in `packages/shared/validation`.
- Master Data Health panel.
- Import: bulk import the master JSON via the import button. Round-trip an export.

**Acceptance**: Test Flows 7, 8, 9 (item master setup, basket SKU, mixed egg) pass on the production system.

### Phase P2 — Orders + PO Intake (2 weeks)

**Goal**: Orders tab behavior equivalent to the UAT, including the three PO parsers.

**Deliverables**:
- Orders CRUD APIs.
- PO upload: port `parseMakroPoSheet`, `parseBigCPoXlsx`, `parseThaifoodPoXlsx` to a Node service module (extract from UAT, run as a pure function).
- Placeholder lifecycle equivalents.
- Orders status FSM as a Drizzle/Prisma state machine + explicit `status` + `reason_code` columns.
- Frontend Orders list + ticket detail (PO, Dates & timing, Logistics, Quantity Lifecycle, Audit timeline, Items).

**Acceptance**: Test Flows 1, 2, 3 (orders) pass.

### Phase P3 — Daily Plan Demand + Logistics (2 weeks)

**Goal**: Daily Plan tab demand-side + Logistics sub-tab.

**Deliverables**:
- Planning rounds + lines tables.
- Round acceptance + confirm APIs.
- Logistics planning APIs (trips, stops, vehicles).
- ใบน้อย printable A6 slip generation.

**Acceptance**: Test Flows 4, 5 pass.

### Phase P4 — BOM (3 weeks)

**Goal**: Item-level BOM + Daily Plan BOM rollup, fully integrated (closes UAT-016, UAT-042, UAT-046).

**Deliverables**:
- Port `buildBomComponentLinesForItem` to a server-side computation (TypeScript, same algorithm).
- BOM readiness service.
- Daily Plan BOM endpoint that calls the per-item component-line producer for each Confirmed Planning Qty line and aggregates by component SKU.
- BOM rollup UI on Daily Plan → BOM sub-tab, with family grouping and the Egg Size Requirement panel.
- Resolve UAT-016 (read `units.base_per_pack`), UAT-042 / UAT-046 (route Daily Plan BOM through the new component-line model).

**Acceptance**: Test Flow 6 passes. Daily Plan BOM correctly rolls up packaging materials from the new editor (Task 9) and Packaging Profile (Task 10A).

### Phase P5 — Cutover preparation (2 weeks)

**Goal**: dual-run readiness.

**Deliverables**:
- Backup / restore parity (or a clear "production owns this" story).
- Audit log + journal of all writes.
- User auth + RBAC (Operations admin / Production planner / Logistics planner / QA / Read-only).
- Parallel-run plan: production system processes a "shadow" of one day's UAT activity and we diff results.
- Sign-off checklist from operators + QA.

**Acceptance**: Operators agree to dual-run for 5 working days.

### Phase P6 — Cutover (1–2 weeks of dual-run + 1 day cutover)

**Goal**: production becomes the operator's daily tool.

**Deliverables**:
- Dual run completes with diffs analyzed and resolved.
- UAT is frozen (kept readable as historical reference).
- Production assumes the operator's daily traffic.
- Post-cutover smoke run for 1 week.

**Acceptance**: 1 full work-week on production with no regression vs. the last UAT run.

### Phase P7+ — Future features

**[Future-Feature] backlog (no scheduled date):**

- Dispatch Qty → Loaded Qty → Delivered Qty pipeline.
- Inventory deduction + reservation.
- Lot selection.
- Production route selection.
- Automatic egg-grade substitution allocation (larger eggs for smaller labels).
- Full packaging BOM editor with bulk import.
- BOM Bulk Upload (the import flow stub at line ~22808 in the UAT).
- CJ PO parser (UAT-012).
- Mobile tablets at picking floor.
- Real-time analytics + alerting.

---

## 5. Migration data plan

### 5.1 One-time master import

Source: `demand_master_v3_corrected_v5_20260521.json` (or the latest corrected master available at cutover).

Plan:

1. Parse the JSON.
2. Insert customers → sites → items → option_sets in that order (FKs).
3. Re-run `ensureMasterOptionSets`-equivalent to populate any missing option sets.
4. Run a validation sweep (the Master Data Health panel equivalent). Any **blocking** errors stop the import; warnings continue.
5. Audit log: record `imported_from = "demand_master_v3_corrected_v5_20260521.json"` with import timestamp on every row.

### 5.2 One-time operational import

Source: operator's most recent **⬇ Backup now** JSON (the Task-2 envelope, `schema_version: 2`).

Plan:

1. Parse the envelope.
2. For each key in `payload`, route to the corresponding production table:
   - `demand_dashboard_orders` → `orders` + `order_lines`
   - `demand_dashboard_planning_v2` → `planning_rounds` + `planning_lines`
   - `demand_dashboard_bom_done` → `planning_lines.bom_done_flag`
   - `demand_dashboard_uploaded` → `po_uploads` (audit only)
   - `demand_dashboard_mappings` → `user_sku_mappings`
   - `demand_dashboard_views` → `user_views`
3. Diff the imported state vs operator's expectation; surface any anomalies.

### 5.3 Cutover-day procedure

1. Operator stops UAT writes (last save at T0).
2. Export latest backup (UAT header strip → ⬇ Backup now).
3. Import the backup into production via the procedure above.
4. Verify counts: customers, sites, items, open orders, current rounds.
5. Operator starts production writes (T0 + ~30 min).
6. UAT is kept available read-only for at least 30 days post-cutover.

---

## 6. Risk register

| ID | Risk | Severity | Probability | Mitigation |
|---|---|---|---|---|
| RR-01 | Data loss during cutover | 🔴 Blocker | Low | Dual-run for 5 days; UAT backup before cutover; rollback plan to UAT. |
| RR-02 | Drift between UAT and production behavior surfaces after cutover | 🟠 High | Medium | Acceptance tests in `TESTING_SCENARIOS_AND_USER_FLOWS.md` run against production daily during dual-run. |
| RR-03 | UAT-016 / UAT-042 / UAT-046 (BOM rollup) reproduced incorrectly | 🟠 High | Medium | Phase P4 explicitly closes these; do not cut over until P4 acceptance passes. |
| RR-04 | Operator training cost | 🟡 Medium | High | UI mirrors UAT 1:1 in Phase P1–P3; minimize visual reflow. |
| RR-05 | Bangkok TZ handled incorrectly server-side | 🟠 High | Medium | All date logic uses Asia/Bangkok explicitly; UTC is never used directly. Add a unit test that fails if any production query returns a date using UTC midnight. |
| RR-06 | Master data schema drift mid-migration | 🟡 Medium | Low | Pin master JSON version. Treat `demand_master_v3_corrected_v5_20260521.json` as the migration baseline. |
| RR-07 | Performance regression at 1000+ orders/day | 🟡 Medium | Low | Load test in Phase P5 with a synthetic 5× workload. |
| RR-08 | Backup / restore parity not met | 🟠 High | Medium | Phase P5 has explicit backup/restore tasks; do not cut over until they pass. |
| RR-09 | Validators differ subtly between UAT and production | 🟡 Medium | High | Port validators to `packages/shared` as pure TypeScript functions; reuse on both server and client. |
| RR-10 | Option set drift (add-only rule violated) | 🟢 Low | Low | API-level guard: option-set deletion is blocked when any record references the value. |

---

## 7. Open issues in current UAT to carry forward

These items in `docs/BUG_LOG.md` block or complicate the migration if not addressed in the production rewrite:

| Bug | Severity | Action in production |
|---|---|---|
| UAT-016 | 🟡 Medium | Read `units.base_per_pack` (fix done in production by design). |
| UAT-042 | 🟡 Medium | Integrate Daily Plan BOM with `buildBomComponentLinesForItem` (Phase P4). |
| UAT-046 | 🟢 Low | Same as UAT-042. |
| UAT-007 | 🟡 Medium | Add automated regression tests (Phase P0 onward — required, not optional). |
| UAT-011 | 🟡 Medium | localStorage quota — non-issue in production (DB-backed). |
| UAT-027 | 🟡 Medium | Clean up `customer_type` data on migration import. |
| UAT-001, UAT-002 | 🟢 Low | Run the original manual QA on the last UAT pass during dual-run. |

---

## 8. Production team responsibilities

**[Prod-Recommendation]**: assign these roles before Phase P0 starts.

| Role | Responsibility |
|---|---|
| **Tech lead** | Owns architecture, sequence, cutover decision. Reads `LOGIC_BASE_SPEC.md` end-to-end. |
| **Backend developer** | Owns API + DB layer. Owns porting validators and the BOM model. |
| **Frontend developer** | Owns UI. Reads `UI_BASIS_WITH_SCREENSHOTS.md` end-to-end + screenshots. |
| **Database developer / DBA** | Owns schema + migrations + backup. |
| **QA tester** | Owns running acceptance tests in `TESTING_SCENARIOS_AND_USER_FLOWS.md` against each phase. |
| **Product owner / Ops owner** | Owns operator UAT during dual-run. Decides cutover go/no-go. |

---

## 9. Decision log template

For every architectural decision during migration, capture:

```
# DECISION-NN — title
Date: YYYY-MM-DD
Status: proposed / accepted / superseded
Context: …
Options considered: …
Decision: …
Consequences: …
Reverses / replaces: DECISION-MM (if applicable)
```

Store in `docs/production_handover/decisions/`.

---

## 10. First three actions for the production team

**[Prod-Recommendation]**: after reading this package:

1. **Confirm the two unfreeze conditions** for `oms-production/` (or formally decide to start fresh). Document the decision as DECISION-01.
2. **Re-run the latest UAT QA gate** against the current `app/index.html` (MD5 `193180d9...`) so the production team has a fresh evidence base, not a 1-day-stale one.
3. **Stand up Phase P0** in a parallel repo. Do not edit `app/index.html` for this purpose.

End of Production Roadmap.
