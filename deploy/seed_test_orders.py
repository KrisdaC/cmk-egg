#!/usr/bin/env python3
"""Create test orders for a delivery date (default: today, Bangkok time).

  python3 -I deploy/seed_test_orders.py                 # 40 orders for today
  python3 -I deploy/seed_test_orders.py --count 40 --date 2026-11-19
  python3 -I deploy/seed_test_orders.py --replace       # first delete earlier test orders of that date

Connection: PG* environment variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE ...).
Orders are tagged source='test-sample', status 'confirmed', no round / trip yet, no prices.
Customers and sites come from the database; each order uses FG items linked to that customer
(item_business_partners), or generic FG items for customers with no links. Deterministic (fixed seed).
"""
import argparse
import random
from datetime import datetime, timedelta, timezone

import psycopg2

# share of orders per customer code; anything not listed shares the remainder ("others")
WEIGHTS = {"C004": 12, "C001": 12, "C002": 7, "C003": 2}
SLOTS = ["05:00", "06:00", "07:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=40)
    ap.add_argument("--date")
    ap.add_argument("--replace", action="store_true")
    a = ap.parse_args()
    date = a.date or (datetime.now(timezone.utc) + timedelta(hours=7)).strftime("%Y-%m-%d")
    rnd = random.Random(20261119)

    conn = psycopg2.connect("")
    cur = conn.cursor()

    cur.execute("SELECT count(*) FROM orders WHERE source = 'test-sample' AND delivery_date = %s", (date,))
    existing = cur.fetchone()[0]
    if existing and not a.replace:
        raise SystemExit(f"{existing} test orders already exist for {date}. Use --replace to recreate them.")
    if existing:
        cur.execute("SELECT id FROM orders WHERE source = 'test-sample' AND delivery_date = %s", (date,))
        ids = [r[0] for r in cur.fetchall()]
        cur.execute("DELETE FROM order_items WHERE order_id = ANY(%s)", (ids,))
        cur.execute("DELETE FROM order_status_history WHERE order_id = ANY(%s)", (ids,))
        cur.execute("DELETE FROM orders WHERE id = ANY(%s)", (ids,))

    # customers with at least one active delivery site
    cur.execute(
        """SELECT bp.id, bp.code, ds.id FROM business_partners bp
           JOIN delivery_sites ds ON ds.partner_id = bp.id AND ds.is_active
           WHERE bp.is_active AND bp.partner_type IN ('customer', 'both') ORDER BY bp.code, ds.id"""
    )
    sites = {}
    pid = {}
    for p_id, code, s_id in cur.fetchall():
        sites.setdefault(code, []).append(s_id)
        pid[code] = p_id
    if not sites:
        raise SystemExit("no customers with delivery sites")

    cur.execute(
        """SELECT i.id, i.eggs_per_pack, i.pack_unit, ibp.partner_id
           FROM items i LEFT JOIN item_business_partners ibp ON ibp.item_id = i.id AND ibp.is_active
           WHERE i.item_role = 'FG' AND i.is_sellable AND i.is_active = 'active'"""
    )
    linked, generic = {}, []
    for item_id, epp, unit, partner in cur.fetchall():
        info = (item_id, epp or 1, unit or "")
        if partner:
            linked.setdefault(partner, []).append(info)
        else:
            generic.append(info)
    # items with a link are also "specific"; items without any link are generic
    linked_ids = {x[0] for v in linked.values() for x in v}
    generic = [g for g in generic if g[0] not in linked_ids]
    if not generic and not linked:
        raise SystemExit("no sellable FG items")

    # build the customer sequence: weighted customers first, the rest ("others") share what is left
    others = [c for c in sites if c not in WEIGHTS]
    plan = []
    for code, n in WEIGHTS.items():
        if code in sites:
            plan += [code] * n
    rest = a.count - len(plan)
    plan += [others[i % len(others)] for i in range(max(0, rest))] if others else []
    plan = plan[: a.count]
    rnd.shuffle(plan)

    yymm = date[2:4] + date[5:7]
    cur.execute("SELECT count(*) FROM orders WHERE order_number LIKE %s", (f"SO{yymm}%",))
    seq0 = cur.fetchone()[0]

    used_sites = {}
    total_lines = total_eggs = 0
    per_customer = {}
    for n, code in enumerate(plan, start=1):
        pool = sites[code]
        k = used_sites.get(code, 0)
        site_id = pool[k % len(pool)]            # walk through the customer's sites in turn
        used_sites[code] = k + 1
        partner_id = pid[code]
        items = linked.get(partner_id) or generic
        lines = rnd.sample(items, min(len(items), rnd.randint(2, 5)))
        number = f"SO{yymm}{seq0 + n:03d}"
        cur.execute(
            """INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, delivery_time,
                                   status, total_amount, logistics_status, notes, source)
               VALUES (%s,%s,%s,%s,%s,%s,'confirmed',0,'pending','ออเดอร์ทดสอบ','test-sample') RETURNING id""",
            (number, site_id, partner_id, date, date, rnd.choice(SLOTS)),
        )
        oid = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO order_status_history (order_id, from_status, to_status) VALUES (%s, NULL, 'confirmed')", (oid,)
        )
        for item_id, epp, unit in lines:
            # trays (30 eggs) in 5s, small packs in 10s
            qty = rnd.randrange(5, 41, 5) if epp >= 20 else rnd.randrange(10, 61, 10)
            cur.execute(
                "INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price) VALUES (%s,%s,%s,0,0)",
                (oid, item_id, qty),
            )
            total_lines += 1
            total_eggs += qty * epp
        per_customer[code] = per_customer.get(code, 0) + 1

    conn.commit()
    print(f"Created {len(plan)} orders for {date}: {total_lines} lines, {total_eggs:,} eggs")
    for code, n in sorted(per_customer.items(), key=lambda x: -x[1]):
        print(f"  {code}: {n}")


if __name__ == "__main__":
    main()
