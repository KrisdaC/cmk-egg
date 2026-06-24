# 01_app — the working system

## What's here

```
app/
└── index.html            ← THE working app (drag-and-drop into Chrome)
                            MD5 eadbac2a24a6b75e09f05af3cec5c555
                            ~28k lines, ~1.9 MB single-file HTML

rollback_points/           ← every pre-edit backup since 2026-05-26
                            naming: index-pre-<short-name>-YYYYMMDD.html
```

## Load procedure

1. Open Chrome (a fresh profile recommended; data lives in localStorage).
2. Drag `app/index.html` into a Chrome tab.
3. Header strip should appear with build label and `⬇ Backup now` /
   `↻ Restore from file…` buttons.
4. Master Data → Items → Master SKU Rebuild card shows three Steps
   (Identity + Units / Egg + Basket / BOM + Packaging) plus the
   🔧 Repair behavior tool.

## First-time setup

1. Master Data toolbar → **🔄 Restore Master JSON** → pick
   `../02_data/demand_master_v3.json` (or the corrected v5 file).
2. Confirm the count summary; items appear in the table.
3. Optional: click ⬇ Backup now from the header strip to get a
   localStorage backup for safety.

## Rollback

Every closeout names its pre-edit backup. To roll back a single sprint:

```
cp rollback_points/index-pre-<short>-YYYYMMDD.html app/index.html
```

To roll all the way back to the 2026-05-26 state, the previous-handover
zip in `../00_prior_handover/` has its own `app/index.html`.

## Static verification

```
md5sum app/index.html
# expected: eadbac2a24a6b75e09f05af3cec5c555

# All inline <script> blocks compile cleanly:
node --check app/index.html  # — won't work directly, but the closeouts
                              # have per-block node --check evidence.
```
