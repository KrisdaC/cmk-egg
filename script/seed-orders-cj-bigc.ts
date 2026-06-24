/**
 * Seed orders for CJ Express (partner_id=7) and Big C (partner_id=6) for pricing week 2.
 *
 * Also:
 * - Fixes CJ item primary_size/secondary_size/min_primary (was "S","M","L")
 * - Fixes BigC item primary_size for B0006 (was "0", should be "1")
 * - Fixes BigC item eggs_per_pack to reflect total eggs per selling unit (ตะกร้า)
 * - Seeds pricing assumptions for BigC (week_id=2)
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

// ─── IDs confirmed from DB ───────────────────────────────────────────────────
const PARTNER_CJ = 7;  // C003 CJ Express
const PARTNER_BC = 6;  // C002 Big C
const WEEK_ID = 2;     // 20260518 (2026-05-25 to 2026-05-30)

// Delivery sites
const SITE_CJ = 76;    // DS-C003-0001  CJ ศูนย์กระจายสินค้า ขอนแก่น
const SITE_BC_DC = 72; // DS-C002-0001  BigC ศูนย์กระจายสินค้า ฉะเชิงเทรา
const SITE_BC_1  = 73; // DS-C002-0002  BigC สาขา พัทยากลาง
const SITE_BC_2  = 74; // DS-C002-0003  BigC สาขา พระราม4
const SITE_BC_3  = 75; // DS-C002-0004  BigC สาขา เอกมัย

// CJ item IDs
const CJ_C0001 = 567; // ยกนิ้วขนาด S 30ฟอง  → size 4/5
const CJ_C0002 = 568; // ยกนิ้วขนาด M 30ฟอง  → size 3/4
const CJ_C0003 = 569; // ยกนิ้วขนาด L 30ฟอง  → size 1/2
const CJ_C0004 = 570; // ไข่สดเบอร์ 2 30ฟอง  → size 2 (already correct)

// BigC item IDs
const BC_B0003 = 556; // 6ถาด×30=180egg, mix 3-4 50/50
const BC_B0004 = 557; // 6ถาด×30=180egg, mix 2-3 60/40 (primary=2)
const BC_B0005 = 558; // 14pk×10=140egg, size 0
const BC_B0006 = 559; // 14pk×10=140egg, size 1 (primary_size was wrong=0)
const BC_B0009 = 562; // 2ถาด×30=60egg,  size 2
const BC_B0011 = 564; // 14pk×10=140egg, mix 2-3 20/80 (primary=2 min=20)
const BC_B0015 = 638; // 6ถาด×30=180egg, size 1
const BC_B0016 = 639; // 6ถาด×30=180egg, size 3

// ─── 1. Fix item master data ─────────────────────────────────────────────────
async function fixItems() {
  console.log("Fixing item master data...");

  // CJ: S → size 4 (primary) + 5 (secondary), 50/50
  await db.execute(sql`UPDATE items SET primary_size='4', secondary_size='5', min_primary=50 WHERE id=${CJ_C0001}`);
  // CJ: M → size 3 (primary) + 4 (secondary), 50/50
  await db.execute(sql`UPDATE items SET primary_size='3', secondary_size='4', min_primary=50 WHERE id=${CJ_C0002}`);
  // CJ: L → size 1 (primary) + 2 (secondary), 50/50
  await db.execute(sql`UPDATE items SET primary_size='1', secondary_size='2', min_primary=50 WHERE id=${CJ_C0003}`);
  // CJ: เบอร์ 2 (already primary_size='2'), ensure min_primary set
  await db.execute(sql`UPDATE items SET min_primary=100 WHERE id=${CJ_C0004} AND (min_primary IS NULL OR min_primary=0)`);

  // BigC: B0003 mixed → primary=3, secondary=4, 50/50; eggs_per_pack=180
  await db.execute(sql`UPDATE items SET primary_size='3', secondary_size='4', min_primary=50, eggs_per_pack=180 WHERE id=${BC_B0003}`);
  // BigC: B0004 primary=2, secondary=3, 60/40; eggs_per_pack=180
  await db.execute(sql`UPDATE items SET eggs_per_pack=180 WHERE id=${BC_B0004}`);
  // BigC: B0005 size 0; eggs_per_pack=140
  await db.execute(sql`UPDATE items SET eggs_per_pack=140 WHERE id=${BC_B0005}`);
  // BigC: B0006 wrong primary_size=0 → fix to 1; eggs_per_pack=140
  await db.execute(sql`UPDATE items SET primary_size='1', eggs_per_pack=140 WHERE id=${BC_B0006}`);
  // BigC: B0009 size 2; eggs_per_pack=60
  await db.execute(sql`UPDATE items SET eggs_per_pack=60 WHERE id=${BC_B0009}`);
  // BigC: B0011 primary=2, secondary=3, 20/80; eggs_per_pack=140
  await db.execute(sql`UPDATE items SET eggs_per_pack=140 WHERE id=${BC_B0011}`);
  // BigC: B0015 size 1; eggs_per_pack=180
  await db.execute(sql`UPDATE items SET eggs_per_pack=180 WHERE id=${BC_B0015}`);
  // BigC: B0016 size 3; eggs_per_pack=180
  await db.execute(sql`UPDATE items SET eggs_per_pack=180 WHERE id=${BC_B0016}`);

  console.log("Item master fixed.");
}

// ─── 2. Seed BigC pricing assumptions (week 2) ───────────────────────────────
async function seedBigCAssumptions() {
  console.log("Seeding BigC pricing assumptions for week 2...");

  const assumptions = [
    // Fixed cost components (บาท/ฟอง)
    { component: "transport_in",  value: "0.0290", unit: "บาท" },
    { component: "transport_out", value: "0.1200", unit: "บาท" }, // higher: DC redistribution
    { component: "operations",    value: "0.0150", unit: "บาท" },
    { component: "labor",         value: "0.0800", unit: "บาท" },
    { component: "maintenance",   value: "0.0430", unit: "บาท" },
    { component: "egg_loss",      value: "0.0300", unit: "บาท" },
    // Disty cost (% of sell price)
    { component: "disty_cost",    value: "7.5000", unit: "%" },
  ];

  for (const a of assumptions) {
    await db.execute(sql`
      INSERT INTO pricing_assumptions (pricing_week_id, partner_id, component, value, unit)
      VALUES (${WEEK_ID}, ${PARTNER_BC}, ${a.component}, ${a.value}, ${a.unit})
      ON CONFLICT DO NOTHING
    `);
  }

  console.log(`Inserted ${assumptions.length} BigC assumptions.`);
}

// ─── 3. Seed CJ Express orders ───────────────────────────────────────────────
async function seedCJOrders() {
  console.log("Seeding CJ Express orders...");

  // 5 recurring weekly delivery orders spread across recent weeks
  const orders = [
    { num: "ORD-CJ-0001", date: "2026-05-03", delDate: "2026-05-04", site: SITE_CJ },
    { num: "ORD-CJ-0002", date: "2026-05-08", delDate: "2026-05-09", site: SITE_CJ },
    { num: "ORD-CJ-0003", date: "2026-05-12", delDate: "2026-05-13", site: SITE_CJ },
    { num: "ORD-CJ-0004", date: "2026-05-17", delDate: "2026-05-18", site: SITE_CJ },
    { num: "ORD-CJ-0005", date: "2026-05-23", delDate: "2026-05-24", site: SITE_CJ },
  ];

  // Items per order: C0001 S, C0002 M, C0003 L, C0004 เบอร์2
  // qty (ถาด), unitPrice (฿/ถาด 30 eggs)
  const lines = [
    { itemId: CJ_C0001, qty: 200, price: "116.00" }, // size 4/5
    { itemId: CJ_C0002, qty: 300, price: "130.00" }, // size 3/4
    { itemId: CJ_C0003, qty: 150, price: "170.00" }, // size 1/2
    { itemId: CJ_C0004, qty: 100, price: "156.00" }, // size 2
  ];

  let inserted = 0;
  for (const o of orders) {
    const total = lines.reduce((s, l) => s + l.qty * parseFloat(l.price), 0);

    const result = await db.execute(sql`
      INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status, total_amount)
      VALUES (${o.num}, ${o.site}, ${PARTNER_CJ}, ${o.date}, ${o.delDate}, 'delivered', ${total.toFixed(2)})
      ON CONFLICT (order_number) DO NOTHING
      RETURNING id
    `);

    const orderId = (result.rows[0] as any)?.id ?? null;
    if (!orderId) {
      console.log(`  Skipped ${o.num} (already exists)`);
      continue;
    }

    for (const l of lines) {
      const lineTotal = (l.qty * parseFloat(l.price)).toFixed(2);
      await db.execute(sql`
        INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
        VALUES (${orderId}, ${l.itemId}, ${l.qty}, ${l.price}, ${lineTotal})
      `);
    }

    inserted++;
    console.log(`  Created ${o.num} (id=${orderId})`);
  }

  console.log(`CJ Express: ${inserted} orders seeded.`);
}

// ─── 4. Seed BigC orders ─────────────────────────────────────────────────────
async function seedBigCOrders() {
  console.log("Seeding BigC orders...");

  // 5 orders, all to the DC (BigC delivers via DC to stores)
  const orders = [
    { num: "ORD-BC-0001", date: "2026-05-04", delDate: "2026-05-06", site: SITE_BC_DC },
    { num: "ORD-BC-0002", date: "2026-05-07", delDate: "2026-05-09", site: SITE_BC_DC },
    { num: "ORD-BC-0003", date: "2026-05-12", delDate: "2026-05-14", site: SITE_BC_DC },
    { num: "ORD-BC-0004", date: "2026-05-18", delDate: "2026-05-20", site: SITE_BC_DC },
    { num: "ORD-BC-0005", date: "2026-05-22", delDate: "2026-05-24", site: SITE_BC_DC },
  ];

  // Unit prices are per ตะกร้า (selling unit). eggs_per_pack is now set to total
  // eggs per basket so avg_price_per_egg = unit_price / eggs_per_pack gives correct value.
  //
  //  price/egg: 0=6.80, 1=6.10, 2=5.20, 3=4.60, 4=4.05
  //  B0003 (180egg, 3-4 50/50, avg 4.325): 778.50 → 779
  //  B0004 (180egg, 2-3 60%, avg ~4.96):   892.80 → 893
  //  B0005 (140egg, size0, 6.80):           952
  //  B0006 (140egg, size1, 6.10):           854
  //  B0009 ( 60egg, size2, 5.20):           312
  //  B0011 (140egg, 2-3 20%, avg 4.72):     660.80 → 661
  //  B0015 (180egg, size1, 6.10):          1098
  //  B0016 (180egg, size3, 4.60):           828
  const lines = [
    { itemId: BC_B0003, qty: 50,  price: "779.00"  }, // 3-4 mix (6 ถาด)
    { itemId: BC_B0004, qty: 30,  price: "893.00"  }, // 2-3 mix (6 ถาด)
    { itemId: BC_B0005, qty: 20,  price: "952.00"  }, // size 0  (14 pk)
    { itemId: BC_B0006, qty: 30,  price: "854.00"  }, // size 1  (14 pk)
    { itemId: BC_B0009, qty: 60,  price: "312.00"  }, // size 2  (2 ถาด)
    { itemId: BC_B0011, qty: 40,  price: "661.00"  }, // 2-3 mix (14 pk)
    { itemId: BC_B0015, qty: 25,  price: "1098.00" }, // size 1  (6 ถาด)
    { itemId: BC_B0016, qty: 45,  price: "828.00"  }, // size 3  (6 ถาด)
  ];

  let inserted = 0;
  for (const o of orders) {
    const total = lines.reduce((s, l) => s + l.qty * parseFloat(l.price), 0);

    const result = await db.execute(sql`
      INSERT INTO orders (order_number, delivery_site_id, partner_id, order_date, delivery_date, status, total_amount)
      VALUES (${o.num}, ${o.site}, ${PARTNER_BC}, ${o.date}, ${o.delDate}, 'delivered', ${total.toFixed(2)})
      ON CONFLICT (order_number) DO NOTHING
      RETURNING id
    `);

    const orderId = (result.rows[0] as any)?.id ?? null;
    if (!orderId) {
      console.log(`  Skipped ${o.num} (already exists)`);
      continue;
    }

    for (const l of lines) {
      const lineTotal = (l.qty * parseFloat(l.price)).toFixed(2);
      await db.execute(sql`
        INSERT INTO order_items (order_id, item_id, quantity, unit_price, total_price)
        VALUES (${orderId}, ${l.itemId}, ${l.qty}, ${l.price}, ${lineTotal})
      `);
    }

    inserted++;
    console.log(`  Created ${o.num} (id=${orderId})`);
  }

  console.log(`BigC: ${inserted} orders seeded.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await fixItems();
    await seedBigCAssumptions();
    await seedCJOrders();
    await seedBigCOrders();
    console.log("\nDone!");
  } catch (err) {
    console.error("Seed error:", err);
    throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
