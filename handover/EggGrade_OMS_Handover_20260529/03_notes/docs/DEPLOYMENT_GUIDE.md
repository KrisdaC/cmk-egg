# Deployment Guide — EggGrade OMS

**Build:** UAT v3.122 — Handover

The application is a **single static HTML file**. There is nothing to build. This guide covers local dev, demo deployment, and what changes when the rebuild lands.

---

## Local setup

### Option A — open the file directly
```bash
# macOS
open app/index.html

# Windows
start app/index.html

# Linux
xdg-open app/index.html
```

Most modern browsers will run the app fine via `file://`. If you hit any quirks (especially around fetching the optional sample CSV), use Option B.

### Option B — npm static server
```bash
npm install
npm run dev
```
Then open http://localhost:8080 — the dev server is `http-server` (only ~30 KB, no real dependencies). The `package.json` exists for convenience only; the app does not depend on it.

### Browser support
- Chrome / Edge / Firefox / Safari — current and previous major version
- The app uses `localStorage`, `FileReader`, and `URL.createObjectURL` — all supported since ~2015
- No IE11 support and not planned

---

## Build process

**There is no build step.** `app/index.html` is the deployment artifact.

If your team adds a build pipeline later (recommended for the rebuild), keep `app/index.html` available as a separate "UAT reference build" so the operations team can keep using it.

---

## Deployment process (UAT-grade)

For the current single-file build, deployment = "host a static file."

### 1. Static hosting (any provider)
Drop `app/` onto:
- **Netlify** — `netlify deploy --prod --dir=app`
- **Vercel** — `vercel --prod app`
- **AWS S3 + CloudFront** — `aws s3 sync app/ s3://your-bucket/ --delete`
- **GitHub Pages** — push `app/` to a `gh-pages` branch
- **Nginx / IIS / Apache** — copy `app/` to the docroot
- **A USB stick on the operations PC** — also fine for UAT

### 2. Update workflow
1. Receive new `index.html` from dev
2. Replace the file on the host
3. Tell users to hard-refresh (Cmd-Shift-R / Ctrl-F5) to bust the browser cache
4. Their `localStorage` data persists across reloads

### 3. Versioning
The visible header shows the version: `EggGrade OMS · UAT v3.122 — Handover Build`. Bump it when shipping a new copy so users can confirm they're on the latest.

---

## Environment variables

**None.** The app does not read `process.env` or any runtime config. `.env.example` exists for completeness only and is empty by design.

When the rebuild adds an API, you'll want at minimum:
```
VITE_API_BASE_URL=https://api.example.com
VITE_APP_ENV=production
```

---

## Hosting assumptions

- **Static hosting only** — no Node/Python/PHP runtime needed
- **HTTPS recommended** for production (Netlify/Vercel/CloudFront give you this for free)
- **No CORS issues** — the app makes no cross-origin requests
- **No analytics** included; add at the deployment layer if needed (CloudFront logs, Plausible script, etc.)

---

## Backend / API assumptions

The current build has **no backend**. For the rebuild, plan for:

### Required endpoints (minimum for v1)
```
GET    /api/orders?date=...&status=...
POST   /api/orders
PATCH  /api/orders/:id
DELETE /api/orders/:id
POST   /api/orders/:id/transition  { to: "submitted" | "confirmed" }

GET    /api/master/customers
GET    /api/master/sites
GET    /api/master/items
POST   /api/master/customers
PATCH  /api/master/customers/:id
... same for sites and items

POST   /api/po-upload     { customer: "makro|bigc|thaifood|cj", file: <multipart> }
GET    /api/attention     # editing + pending tickets across all dates
```

### Server-side validation that MUST exist
Anything currently checked in the front-end has to be re-checked server-side because the client is untrusted:

- Status transitions blocked when placeholder records exist
- Status transitions blocked when any line is missing Order qty
- Customer-SKU pairing enforced (an item can only be added if the customer's catalog allows it OR the item is generic)
- PO duplicate detection
- Site lookup with multi-strategy matching (move from `_findSiteById` and similar)

---

## Production-readiness checklist

Mark each item with the team before going live:

### Architecture
- [ ] Rebuild on a real framework + backend? See `TECH_STACK_REVIEW.md`
- [ ] Database chosen and schema migrated from current `MASTER_V3` shape
- [ ] Authentication wired (recommended: SSO via Microsoft/Google)
- [ ] Roles defined (ops / planner / finance / admin)
- [ ] API documented (OpenAPI / postman collection)

### Security
- [ ] HTTPS enforced
- [ ] Auth tokens with reasonable expiry
- [ ] Input validation server-side
- [ ] File upload size limits + virus scanning (PO uploads accept arbitrary xlsx/csv)
- [ ] Rate limiting on PO upload endpoint
- [ ] CORS allowlist locked down

### Operations
- [ ] Backup strategy for the database (daily minimum)
- [ ] Audit log table (who did what, when)
- [ ] Export-to-CSV for completed orders
- [ ] Monitoring (uptime + error tracking — Sentry or similar)
- [ ] Logs retained ≥ 30 days

### Data
- [ ] Migration path from UAT localStorage data (export JSON from UAT, import to new system)
- [ ] Master data seed for production (customers, real sites, real items)
- [ ] Test data for staging environment

### UAT continuity
- [ ] Keep the UAT URL alive while the rebuild is in progress so ops staff can keep working
- [ ] Document a clear cut-over date and a freeze on UAT changes

---

## Known deployment risks

1. **localStorage limit** is 5–10 MB depending on browser. Once a customer accumulates a few thousand tickets with line items, this will fill up. Symptom: silent save failures or "storage full" toast (UAT117).
2. **No multi-device sync.** Two users on different PCs see different data. There is **no warning** about this in the UI.
3. **Browser cache is the deployment.** If you don't bump the version + tell users to hard-refresh, they'll keep running the old build.
4. **The PO parsers are tightly coupled to specific spreadsheet shapes.** A retailer's column rename will silently produce empty matches. There are no automated tests covering this.
5. **Date handling is local-time string-based.** No timezone awareness. Fine for one-country one-warehouse use; will break the moment a multi-region rollout is considered.

---

## Rolling back

If a new version breaks something:
1. Restore the previous `index.html` from your backup / git history
2. Tell users to hard-refresh
3. Their `localStorage` data is preserved — they'll see the old UI with the same orders

There is no database to migrate back, so rollback is trivial.
