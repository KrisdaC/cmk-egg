# Dev Team Handover Checklist

After receiving the `uat-handover-cleaned-project.zip`:

## Day 1 — Onboarding
- [ ] Unzip the package
- [ ] Read `README.md`
- [ ] Read `docs/ARCHITECTURE_SUMMARY.md` (~15 min)
- [ ] Read `docs/TECH_STACK_REVIEW.md` and align with the team on the rebuild plan (~30 min discussion)
- [ ] Run `npm install && npm run dev` and load the UAT in a browser
- [ ] Walk through every feature in `docs/FEATURE_SUMMARY.md`

## Day 2-3 — Reverse-engineering
- [ ] Open `app/index.html` and search for `// UAT###` markers to learn the iteration history
- [ ] Trace one full PO upload flow (e.g. Makro): file picker → parser → preview modal → commit → render
- [ ] Trace one full status-flow path: editing → draft → submitted (with placeholder block)
- [ ] Verify in browser DevTools that `localStorage.ORDERS_KEY` and `localStorage.MASTER_V3_KEY` look as expected
- [ ] Try a sample PO upload from `app/sample-data/` if applicable
- [ ] Open the Master Data tab → Need Attention → click ✎ แก้ไข on a placeholder → confirm the Edit dialog opens

## Week 1 — Rebuild kickoff (recommended)
- [ ] Pick stack per `TECH_STACK_REVIEW.md` (recommended: React + Vite + TS + NestJS + Postgres)
- [ ] Set up new repo with CI / linter / formatter
- [ ] Set up staging deploy target
- [ ] Translate the data model in `ARCHITECTURE_SUMMARY.md → § H` into Prisma schema or equivalent
- [ ] Build first API endpoints (master CRUD)
- [ ] Build first front-end shell (login + tab nav + master data CRUD parity)

## Before any production launch
- [ ] Tick everything in `docs/DEPLOYMENT_GUIDE.md → Production-readiness checklist`
- [ ] Tick everything in `docs/KNOWN_ISSUES.md → What the dev team should explicitly verify`
- [ ] Run a side-by-side UAT with operations team on the new build
- [ ] Plan cutover date + freeze on UAT-build changes
- [ ] Plan localStorage data export from existing UAT users (one-time JSON export → import to new system)

## Things to verify BEFORE writing code
1. **Will multiple operations staff use this concurrently?** If yes, confirm with business owner that backend/auth is in scope from day 1.
2. **Will mobile / tablet be needed?** If yes, scope responsive layout into v1.
3. **What roles need different permissions?** Currently everyone is admin.
4. **What happens to historical UAT data?** Migrate via export-import, or fresh start?
5. **CJ parser** — when can sample files be obtained?

## Things to NOT spend time on
- Don't refactor the existing single HTML file into JS modules. It's a rewrite either way.
- Don't try to add a backend behind the existing single HTML file. The state model is wrong for it.
- Don't translate more than what's already translated unless the business owner asks for it; the current TH coverage covers the critical paths.
- Don't redesign the UI from scratch. The current design is the spec for layout/component patterns; rebuild it identically in your framework's idioms.
