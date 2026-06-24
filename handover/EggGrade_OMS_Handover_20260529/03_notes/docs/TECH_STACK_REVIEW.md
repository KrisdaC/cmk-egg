# Tech Stack Review — EggGrade OMS

**Build:** UAT v3.122 — Handover
**Audience:** Business owner + technical lead

This is the honest CTO take. I'm not going to soft-pedal the limitations because soft-pedalling them is what wastes engineering budget six months from now.

---

## What was built and why

**Vanilla JS + single HTML file.** This was the right choice for UAT speed:

- Zero setup time → first working build in hours, not days
- Every change is "open file, edit, refresh" — fastest feedback loop possible
- Operations team can be put on it without any deployment infrastructure
- 122 UAT iterations in ~3 days — that velocity is impossible on a "real" stack

That speed bought you a working functional spec. **It didn't buy you a production system.**

---

## Pros (why the current stack made sense)

1. **Speed of iteration** — vanilla JS + localStorage means no compile step, no API to mock, no dev server. Every UAT cycle was minutes.
2. **Self-contained delivery** — one file, one URL, runs anywhere. Operations team got value before any infra existed.
3. **No vendor lock-in on the UI** — no proprietary form builder, no SaaS dependency. Logic is portable.
4. **Easy to demo / hand around** — email the file, tester opens it, instant UAT.
5. **Cheap to host** — any static host. Free tier of Netlify covers it forever.
6. **Easy to read for non-framework developers** — no `useEffect`/`useState`/build chain to understand. A backend dev can follow the JS.
7. **Domain logic is captured** — every business rule that survived UAT is encoded somewhere in the file. The dev team doesn't need to re-discover them.
8. **Bilingual UI built in** — `data-i18n` + `t()` pattern was added late but works cleanly.

---

## Cons / Risks (why the current stack is not production-ready)

### Architecture
- **Single 12k-line file** — only one developer can work on it at a time without merge conflicts. A team can't scale.
- **No module boundaries** — adding any feature touches the same file. Half the functions reference half the others.
- **No type safety** — vanilla JS, no TS. Every refactor risks runtime errors that don't show up until clicked.
- **No tests** — every regression is found by the operations team in production. UAT discovered 20+ bugs that came back from earlier UATs.
- **Render model is "rebuild everything"** — works at small scale, but hides whole categories of state bugs (UAT99 was symptomatic).

### Data
- **localStorage is the database.** No multi-user. No sync. No backup. No history. Different machines = different worlds.
- **No schema enforcement** — a typo in a field name corrupts data silently.
- **No transactions** — saving an order while another tab edits master data has no protection.
- **localStorage has a 5-10 MB hard limit** — the system will eventually hit it.

### Security
- **No authentication.** Anyone with the URL has admin rights.
- **No authorization / roles.** A new ops hire and the CFO see the same admin powers.
- **No audit trail.** Deleted orders are gone. Who deleted them? Unknown.
- **All business rules are client-side.** A determined user with DevTools open can submit anything.

### Operations
- **No monitoring / error tracking.** Bugs are reported by users, not detected.
- **No deployment versioning.** Browser cache is your "version control."
- **No rollback path** beyond "restore the old file and tell people to hard-refresh."
- **No backups.** Every browser is its own data store; nothing is synced anywhere.

### Maintainability for the dev team
- **No build pipeline** — easy now, but eventually needed for minification, code splitting, env switching.
- **No package manager for real dependencies** — SheetJS is inline base64. Updating it = manual paste.
- **Hard to add team members** — onboarding to "this 12k-line file" is rough.
- **Hard to reason about state** — module-scoped `let` variables and DOM as the source of truth.

### Vendor / tooling lock-in
- **None.** This is the one area where the stack is great. Everything is platform-agnostic.

---

## CTO Recommendation

I'm going to be direct: **do not productionize the current build. Use it as a behavior reference and rebuild on a real stack.**

The current build was a brilliant UAT vehicle. As a production system it has roughly six showstoppers (no auth, no multi-user, no backend, no audit trail, no tests, no team-scalable code structure). Patching any one of those means rebuilding most of the rest.

### Recommended next-stage stack

| Layer | Recommendation | Why |
|---|---|---|
| Front-end | **React + Vite + TypeScript** | Same JS the team already knows; TS catches the runtime bugs that UAT found one-by-one |
| UI library | **shadcn/ui + Tailwind** OR **Mantine** | Consistent components; the UAT design (chips, pills, cards) maps cleanly |
| State | **TanStack Query** + small Zustand store | Server state via Query; UI state via Zustand. Don't over-engineer with Redux. |
| Routing | **TanStack Router** or React Router | Either works |
| Backend | **NestJS + Prisma** OR **FastAPI + SQLAlchemy** | Pick by team's language preference. Both are productive and typed end-to-end. |
| Database | **PostgreSQL** | Real transactions, JSONB for flexible fields like `customer.skus[]` and `inv.lines[]` |
| Auth | **Microsoft Entra ID** (or Google Workspace SSO) | Free for SMB; no password management to own |
| File parsing | **SheetJS server-side** OR **openpyxl** (Py) | Move PO parsing off the browser to a worker queue |
| Hosting | Front-end on **Vercel/Netlify**; backend on **Railway/Render/Fly.io** | Cheap, fast, no DevOps team required |
| Observability | **Sentry** for errors, **Plausible/Umami** for analytics | Both have generous free tiers |
| CI/CD | **GitHub Actions** | Standard, free for private repos under reasonable usage |

### Migration plan (4-6 weeks of focused work)

| Week | Goal |
|---|---|
| 1 | Stack scaffolding, auth wired, core data model in Postgres, master data CRUD APIs |
| 2 | Master data tab parity (customers/sites/items + customer-SKU catalog) |
| 3 | Orders tab parity (table, filters, search, status flow) |
| 4 | PO upload (Makro + BigC + Thaifood parsers ported to backend) |
| 5 | Need Attention, audit log, role-based permissions, data import-from-UAT button |
| 6 | UAT on the new stack, cut over, decommission single-file build |

CJ parser, Planning view, Invoice view, mobile responsiveness, advanced reporting are post-rebuild work.

### What to do NOW vs LATER

**Now (this UAT-handover sprint)**
- Treat this package as the spec
- Align on next-stage stack with the dev team
- Set up the new repo + CI + deploy targets
- Begin the 6-week rebuild plan

**Soon**
- Migrate operations team to the new system on a flag
- Run both in parallel for ~2 weeks
- Cut over fully once the new system is stable

**Later (post-rebuild)**
- Build CJ parser when CJ provides sample files
- Build Planning view (production scheduling)
- Build Invoice view (incl. ร.3)
- Mobile / tablet layout
- Reporting dashboards

### What NOT to do

- ❌ Don't try to "refactor" the current single HTML file into modules. It's a rewrite either way; pretending it's a refactor will take 3× as long with no benefit.
- ❌ Don't bolt a backend onto the current single HTML file. The state model is wrong for it.
- ❌ Don't skip authentication "for now." Once the system is in real use, retrofitting auth is significantly harder than building with it.
- ❌ Don't skip server-side validation. Every business rule on the front-end must be enforced on the server.
- ❌ Don't move to a heavier framework than React unless the team specifically prefers it. Angular/Vue work too, but React gives the largest pool of hireable developers.
- ❌ Don't use Firebase / Supabase as a "no-backend" shortcut. The data model has enough relational complexity (customer → sites → tickets → lines, customer ↔ items M:N) that a real RDBMS pays for itself in week 2.

---

## Cost / time honest estimates

For a single full-stack senior dev:

| Phase | Time | Cost (rough, USD) |
|---|---|---|
| Stack setup + master data parity | 1.5 weeks | $5–8k |
| Orders + PO parity | 2.5 weeks | $9–14k |
| Auth + audit + Need Attention | 1 week | $3–5k |
| UAT + cutover | 1 week | $3–5k |
| **Total v1 production** | **~6 weeks** | **$20–32k** |

Plus ongoing hosting (~$50-100/mo for the first few hundred users) and one part-time dev for maintenance.

For a team of 2-3 devs, parallelizable down to ~3 weeks but the senior dev needs to lead the data model first.

---

## TL;DR for the business owner

You bought a working spec in UAT speed and that was the right move. Now buy a production system at production-stack speed. Don't try to upgrade the spec into the production system — that's the trap.

The dev team should:
1. Treat this folder as the spec
2. Pick React + a real backend
3. Spend 6 focused weeks rebuilding
4. Cut over, decommission, move on

You are not throwing away the UAT work. You are using it as the requirements document it always was.
