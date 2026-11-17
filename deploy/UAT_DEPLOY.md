# UAT deployment runbook

Target: UAT server (`root@165.22.48.49`, PM2) currently at commit `70a23b4` (30 Jul 2026, confirmed). Everything after it ships in this release: 5 commits to `b42ab97` and migrations 0018–0040.
Deploy: code up to commit `b42ab97` (`main`) + database migrations 0018 → 0040.

**What changes**
- Code: grading, packing, trip status (Delivery/Checkout), Daily Operations Overview and สรุปผล, BOM, many `orders` changes. 77 files, `package.json` unchanged (no `npm install` needed).
- Database: 23 hand-written SQL migrations (0018–0040), all **additive** (new tables/columns). Nothing is dropped. Old code keeps working on the new schema, so rollback is simple.
- Env vars: **none new**.

**Never do:** `pg_restore` / `psql < dump` of the local database onto UAT (the old procedure in `.env` comments). It would wipe UAT's data. Only apply `deploy/uat_migrate.sql`.

Tested locally: restored the 2026-06-24 dump into a scratch database, applied 0013–0017 + `uat_migrate.sql` → schema identical to the local database (0 column differences); re-running it is a no-op; `npm run build` passes.

---

## 0. Before you start (on your Mac)
```bash
git pull && git log -1 --oneline        # should be b42ab97 or later
npm run build                            # optional sanity check, ~10s
```
Pick a quiet time; the app restarts for a few seconds.

## 1. On the UAT server — look first, change nothing
```bash
ssh root@165.22.48.49
cd <app dir>                              # where the app lives (check: pm2 describe <app> → "exec cwd")
git log -1 --oneline && git status --short   # what version is running? any local edits on the server?
pm2 list
export DATABASE_URL=...                   # same value the app uses (see its .env)
psql "$DATABASE_URL" -f deploy/uat_precheck.sql   # copy the file up first if the server's repo is old
```
Read the precheck output:
- Section 1 tells you which migrations UAT already has (`MISSING` = will be applied; fine either way, the script skips what exists).
- If **0017** is `MISSING`, UAT is older than expected: also run `migrations/0013`–`0017` first (all idempotent), then continue.
- Section 2 = row counts to compare after deploy (nothing should drop).

## 2. Backup (required)
```bash
pg_dump "$DATABASE_URL" -F c --no-owner --no-acl -f ~/uat_backup_$(date +%Y%m%d_%H%M).dump
ls -lh ~/uat_backup_*.dump
git rev-parse HEAD > ~/uat_prev_commit.txt   # remember the running version for rollback
```

## 3. Migrate the database (before the new code)
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/uat_migrate.sql
psql "$DATABASE_URL" -f deploy/uat_precheck.sql | grep -c MISSING     # expect 0
```
Single transaction: on any error nothing is applied. Safe to re-run.

## 3b. Clean the items (DESTRUCTIVE — UAT items are re-imported afterwards)
Decision made: wipe items **and everything pointing at them** (order lines, packing targets, price-proposal lines, active prices, item–partner links, pack specs). Orders keep their headers but will have **no lines** until re-entered; trips, partners, sites, vehicles, drivers are untouched. `material_cost_rates` rows are kept (their SKU link is saved and restored in step 6).
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=yes -f deploy/uat_clean_items.sql
```
Without `-v confirm=yes` it does nothing. It is one transaction, and the backup from step 2 is your undo.

## 4. Deploy the code
```bash
git pull origin main
npm run build                             # no npm install needed (package.json unchanged)
pm2 restart <app name> && pm2 logs <app name> --lines 50 --nostream
```
(`start` = `NODE_ENV=production node dist/index.cjs`; the server is a git checkout at `70a23b4`, so `git pull` fast-forwards cleanly.) Use `script/check-server-logs.sh` from your Mac to tail logs.

## 4b. Re-import items, then re-link material costs
Import the items (master data template / the app's import), then restore the material-cost SKU links:
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/uat_relink_material_costs.sql
```
It lists any saved SKUs that are not in the new item list; add them to the import and run it again.

## 5. Smoke test (browser, UAT URL)
1. Log in; Daily Operations opens, tabs are Thai, date filter at top.
2. **แผนผลิต** (orders) loads for a date with orders; no error toast.
3. **ผลิต → คัดไข่ / แพ็กสินค้า / BOM** each open.
4. **จัดเที่ยวส่ง** and **เช็คเอาท์** list trips (uses new `trips.departed_at`).
5. **สรุปผล** renders (KPIs may be 0 if UAT has no packing data yet).
6. Row counts from precheck section 2 unchanged (`psql "$DATABASE_URL" -f deploy/uat_precheck.sql`).

## 6. Rollback
Migrations are additive, so the old code runs fine on the new schema:
```bash
git checkout $(cat ~/uat_prev_commit.txt) && npm run build && pm2 restart <app name>
```
Rollback does **not** bring items back — restore the backup for that:
`pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner ~/uat_backup_<timestamp>.dump`

---

## Things to know / decide
- **New features start empty on UAT.** Grading (receiving lots, opening stock, jobs, yield history), packing targets/results, AQ/PQ snapshots have no data until users enter it. The local grading yield model came from a spreadsheet import and is **not** carried over; migration 0030 only renames/backfills an existing one.
- **Items need size/pack data** (`primary_size`, `pack_unit`, `eggs_per_pack`) for สรุปผล and packing to group correctly. Compare with `select count(*) filter (where primary_size is null) from items where item_role='FG'` on UAT.
- **Master data load:** `handover/master_data_template.xlsx` is ready; there is no importer script yet, so use whatever import you normally use for items.
- **Auth:** the server uses its own `.env` (`AUTH_MODE`, `SESSION_SECRET`, DB URL); nothing in this release changes it.
- **Git hygiene:** these files are committed to the repo and look like database dumps or credentials: `backup_20260624_130933.dump`, `root@165.22.48.49`, `schema.sql`, `cookies.txt`. Consider removing them from the repo (and rotating anything sensitive) before more people get access.
