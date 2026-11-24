#!/usr/bin/env python3
"""Import master data from the filled master_data_template.xlsx into the database.

  python3 -I deploy/import_master_data.py FILE.xlsx            # validate only (default, writes nothing)
  python3 -I deploy/import_master_data.py FILE.xlsx --apply    # validate, then write in ONE transaction

Connection: standard PG* environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
Sheets (row 1 = headers, row 2 = hint row, data from row 3):
  1_Partners, 2_DeliverySites, 3_Items, 4_ItemPartnerLinks, 5_Drivers, 6_Vehicles
Safe to re-run: rows are matched on their natural key (partner code, site_code, item sku,
item+partner, driver code, vehicle plate) and updated instead of duplicated.

District convention: the app stores district = ตำบล/แขวง and sub_district = อำเภอ/เขต, while the
template hint described them the other way round. This importer follows the template (as the
people filling it in did) and swaps them on the way in, so data matches existing rows.
"""
import re
import sys
from decimal import Decimal, InvalidOperation

import openpyxl

LISTS = {
    "partner_type": {"customer", "supplier", "both"},
    "customer_type": {"Corporation", "Individual"},
    "payment_terms": {"COD", "Cash", "Credit", "Prepaid"},
    "customer_tier": {"Standard", "Wholesale", "Modern Trade"},
    "delivery_type": {"direct_to_store", "to_distribution_center"},
    "vehicle_access": {"4_wheel", "4_wheel_ext", "6_wheel", "refrigerated"},
    "item_role": {"FG", "WIP", "DEFECT", "RM", "PACKAGING"},
    "egg_content_type": {"GRADED_SINGLE", "GRADED_MIX", "UNGRADED_EGG", "UNDERGRADE"},
    "vehicle_type": {"truck", "van", "refrigerated"},
    "active_status": {"active", "inactive"},
}
# Values people typed that the app does not know → what they mean (agreed 2026-11-19)
PARTNER_TYPE_MAP = {"Others": "customer", "Logistics Partner": "supplier"}
errors, warnings = [], []


def err(sheet, row, msg):
    errors.append(f"{sheet} row {row}: {msg}")


def warn(sheet, row, msg):
    warnings.append(f"{sheet} row {row}: {msg}")


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def to_bool(v, default=None):
    v = clean(v)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "y", "t"):
        return True
    if s in ("false", "0", "no", "n", "f"):
        return False
    raise ValueError(f"not TRUE/FALSE: {v!r}")


def to_int(v):
    v = clean(v)
    if v is None:
        return None
    d = Decimal(str(v))
    if d != d.to_integral_value():
        raise ValueError(f"not a whole number: {v!r}")
    return int(d)


def to_num(v):
    v = clean(v)
    if v is None:
        return None
    return Decimal(str(v))


def grade_of(v):
    v = to_text(v)
    return int(v) if v is not None and v.isdigit() else None


def to_text(v):
    v = clean(v)
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v)


def read_sheet(wb, name):
    if name not in wb.sheetnames:
        errors.append(f"sheet '{name}' not found")
        return [], []
    ws = wb[name]
    headers = [clean(c.value) for c in ws[1]]
    rows = []
    for i, r in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
        if all(clean(c) is None for c in r):
            continue
        rows.append((i, dict(zip(headers, r))))
    return headers, rows


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(2)
    wb = openpyxl.load_workbook(args[0], data_only=True)

    # ── 1 partners ──
    S = "1_Partners"
    _, rows = read_sheet(wb, S)
    partners, seen = [], set()
    for i, r in rows:
        try:
            code = to_text(r.get("code"))
            nick = to_text(r.get("nickname"))
            ptype = to_text(r.get("partner_type")) or "customer"
            if not code:
                err(S, i, "code is required")
                continue
            if not nick:
                nick = to_text(r.get("business_name"))
                if nick:
                    warn(S, i, f"{code}: no nickname, using business_name")
                else:
                    err(S, i, f"{code}: nickname (or business_name) is required")
            if ptype in PARTNER_TYPE_MAP:
                warn(S, i, f"{code}: partner_type {ptype!r} mapped to {PARTNER_TYPE_MAP[ptype]!r}")
                ptype = PARTNER_TYPE_MAP[ptype]
            if code in seen:
                err(S, i, f"duplicate code {code}")
            seen.add(code)
            if ptype not in LISTS["partner_type"]:
                err(S, i, f"{code}: partner_type {ptype!r} not in {sorted(LISTS['partner_type'])}")
            for col in ("customer_type", "payment_terms", "customer_tier"):
                v = to_text(r.get(col))
                if v and v not in LISTS[col]:
                    warn(S, i, f"{code}: {col} {v!r} not in the dropdown list")
            tax = to_text(r.get("tax_id"))
            if tax and not re.fullmatch(r"\d{13}", tax):
                warn(S, i, f"{code}: tax_id {tax!r} is not 13 digits")
            partners.append(
                dict(
                    code=code, nickname=nick, partner_type=ptype,
                    business_name=to_text(r.get("business_name")),
                    # The template's "customer_type" (Corporation / Individual) is the form's business type;
                    # its "customer_tier" (Modern Trade …) is the form's customer type. See migrations/ note.
                    business_type=to_text(r.get("business_type")) or (to_text(r.get("customer_type")) if to_text(r.get("customer_type")) in ("Corporation", "Individual") else None),
                    customer_type=(to_text(r.get("customer_tier")) if to_text(r.get("customer_tier")) in ("Modern Trade", "Traditional Trade") else (to_text(r.get("customer_type")) if to_text(r.get("customer_type")) in ("Modern Trade", "Traditional Trade") else None)),
                    branch_code=to_text(r.get("branch_code")), branch_name=to_text(r.get("branch_name")),
                    tax_id=tax,
                    address_line_1=to_text(r.get("address_line_1")), address_line_2=to_text(r.get("address_line_2")),
                    # template sub_district = ตำบล/แขวง → DB district ; template district = อำเภอ/เขต → DB sub_district
                    district=to_text(r.get("sub_district")), sub_district=to_text(r.get("district")),
                    province=to_text(r.get("province")), postal_code=to_text(r.get("postal_code")),
                    country=to_text(r.get("country")) or "Thailand",
                    payment_terms=to_text(r.get("payment_terms")), credit_days=to_int(r.get("credit_days")),
                    customer_tier=(to_text(r.get("customer_tier")) if to_text(r.get("customer_tier")) not in ("Modern Trade", "Traditional Trade") else None),
                    is_active=to_bool(r.get("is_active"), True),
                )
            )
        except (ValueError, InvalidOperation) as e:
            err(S, i, str(e))
    partner_codes = {p["code"] for p in partners}

    # ── 2 delivery sites ──
    S = "2_DeliverySites"
    _, rows = read_sheet(wb, S)
    sites, seen = [], set()
    for i, r in rows:
        try:
            pc, sc, dn = to_text(r.get("partner_code")), to_text(r.get("site_code")), to_text(r.get("display_name"))
            if not sc:
                err(S, i, "site_code is required")
                continue
            if not pc or pc not in partner_codes:
                err(S, i, f"{sc}: partner_code {pc!r} not found in 1_Partners")
            if not dn:
                err(S, i, f"{sc}: display_name is required")
            if sc in seen:
                err(S, i, f"duplicate site_code {sc}")
            seen.add(sc)
            dt = to_text(r.get("delivery_type")) or "direct_to_store"
            if dt not in LISTS["delivery_type"]:
                err(S, i, f"{sc}: delivery_type {dt!r} invalid")
            av = to_text(r.get("acceptable_vehicles"))
            avl = [x.strip() for x in av.split(",") if x.strip()] if av else None
            for x in avl or []:
                if x not in LISTS["vehicle_access"]:
                    warn(S, i, f"{sc}: acceptable_vehicles value {x!r} not in the list")
            sites.append(
                dict(
                    partner_code=pc, site_code=sc, display_name=dn,
                    partner_branch_code=to_text(r.get("partner_branch_code")), branch_name=to_text(r.get("branch_name")),
                    delivery_type=dt, address_line_1=to_text(r.get("address_line_1")),
                    district=to_text(r.get("sub_district")), sub_district=to_text(r.get("district")),
                    province=to_text(r.get("province")), postal_code=to_text(r.get("postal_code")),
                    latitude=to_num(r.get("latitude")), longitude=to_num(r.get("longitude")),
                    google_maps_url=to_text(r.get("google_maps_url")),
                    delivery_region=to_text(r.get("delivery_region")), delivery_zone=to_text(r.get("delivery_zone")),
                    distance_from_plant=to_int(r.get("distance_from_plant")),
                    preferred_time_slot=to_text(r.get("preferred_time_slot")),
                    access_instructions=to_text(r.get("access_instructions")),
                    acceptable_vehicles=avl, is_active=to_bool(r.get("is_active"), True),
                )
            )
        except (ValueError, InvalidOperation) as e:
            err(S, i, str(e))

    # ── 3 items ──
    S = "3_Items"
    _, rows = read_sheet(wb, S)
    items, seen = [], set()
    for i, r in rows:
        try:
            sku, name = to_text(r.get("sku")), to_text(r.get("name"))
            if not sku:
                err(S, i, "sku is required")
                continue
            if not name:
                err(S, i, f"{sku}: name is required")
            if sku in seen:
                err(S, i, f"duplicate sku {sku}")
            seen.add(sku)
            role = to_text(r.get("item_role"))
            if role not in LISTS["item_role"]:
                err(S, i, f"{sku}: item_role {role!r} not in {sorted(LISTS['item_role'])}")
            pc = to_text(r.get("partner_code"))
            if pc and pc not in partner_codes:
                err(S, i, f"{sku}: partner_code {pc!r} not found in 1_Partners")
            ect = to_text(r.get("egg_content_type"))
            if ect and ect not in LISTS["egg_content_type"]:
                warn(S, i, f"{sku}: egg_content_type {ect!r} not in the list")
            active = to_text(r.get("is_active")) or "active"
            if active not in LISTS["active_status"]:
                err(S, i, f"{sku}: is_active must be active/inactive, got {active!r}")
            is_egg = to_bool(r.get("is_egg"), False)
            if role == "FG" and is_egg and not to_text(r.get("primary_size")):
                warn(S, i, f"{sku}: FG egg item without primary_size")
            if role == "FG" and not to_int(r.get("eggs_per_pack")):
                warn(S, i, f"{sku}: FG item without eggs_per_pack")
            items.append(
                dict(
                    sku=sku, name=name, item_role=role, item_type=to_text(r.get("item_type")), partner_code=pc,
                    description=to_text(r.get("description")), selling_unit=to_text(r.get("selling_unit")),
                    base_unit=to_text(r.get("base_unit")), pack_unit=to_text(r.get("pack_unit")),
                    basket_unit=to_text(r.get("basket_unit")), storage_unit=to_text(r.get("storage_unit")),
                    is_egg=is_egg, is_egg_item=is_egg, egg_content_type=ect,
                    primary_size=to_text(r.get("primary_size")), secondary_size=to_text(r.get("secondary_size")),
                    min_primary=to_int(r.get("min_primary")),
                    # older copies of size/min share that the item form reads
                    primary_grade=grade_of(r.get("primary_size")), secondary_grade=grade_of(r.get("secondary_size")),
                    min_primary_grade=to_int(r.get("min_primary")), eggs_per_pack=to_int(r.get("eggs_per_pack")),
                    pack_per_basket=to_int(r.get("pack_per_basket")), eggs_per_basket=to_int(r.get("eggs_per_basket")),
                    basket_per_palette=to_int(r.get("basket_per_palette")), eggs_per_palette=to_int(r.get("eggs_per_palette")),
                    base_per_storage=to_int(r.get("base_per_storage")), basket_sku=to_text(r.get("basket_sku")),
                    barcode_label=to_text(r.get("barcode_label")),
                    is_sellable=to_bool(r.get("is_sellable"), False), is_producable=to_bool(r.get("is_producable"), False),
                    is_consumable=to_bool(r.get("is_consumable"), False), is_active=active,
                )
            )
        except (ValueError, InvalidOperation) as e:
            err(S, i, str(e))
    skus = {x["sku"] for x in items}
    for x in items:
        if x["basket_sku"] and x["basket_sku"] not in skus:
            warn("3_Items", "-", f"{x['sku']}: basket_sku {x['basket_sku']!r} is not an item in this file")

    # ── 4 item–partner links ──
    S = "4_ItemPartnerLinks"
    _, rows = read_sheet(wb, S)
    links, seen = [], set()
    for i, r in rows:
        try:
            sku, pc = to_text(r.get("sku")), to_text(r.get("partner_code"))
            if not sku or not pc:
                err(S, i, "sku and partner_code are required")
                continue
            if sku not in skus:
                err(S, i, f"sku {sku!r} not found in 3_Items")
            if pc not in partner_codes:
                err(S, i, f"partner_code {pc!r} not found in 1_Partners")
            if (sku, pc) in seen:
                err(S, i, f"duplicate link {sku} / {pc}")
            seen.add((sku, pc))
            links.append(
                dict(sku=sku, partner_code=pc, customer_item_number=to_text(r.get("customer_item_number")),
                     barcode_label=to_text(r.get("barcode_label")), is_active=to_bool(r.get("is_active"), True))
            )
        except (ValueError, InvalidOperation) as e:
            err(S, i, str(e))

    # ── 5 drivers ──
    S = "5_Drivers"
    _, rows = read_sheet(wb, S)
    drivers, seen = [], set()
    for i, r in rows:
        try:
            code, name = to_text(r.get("code")), to_text(r.get("name"))
            if not name:
                err(S, i, "name is required")
                continue
            if code and code in seen:
                err(S, i, f"duplicate driver code {code}")
            if code:
                seen.add(code)
            drivers.append(dict(code=code, name=name, license_number=to_text(r.get("license_number")),
                                phone=to_text(r.get("phone")), email=to_text(r.get("email")),
                                is_active=to_bool(r.get("is_active"), True)))
        except ValueError as e:
            err(S, i, str(e))

    # ── 6 vehicles ──
    S = "6_Vehicles"
    _, rows = read_sheet(wb, S)
    vehicles, seen = [], set()
    for i, r in rows:
        try:
            plate, vt = to_text(r.get("plate_number")), to_text(r.get("vehicle_type"))
            if not plate:
                err(S, i, "plate_number is required")
                continue
            if not vt:
                err(S, i, f"{plate}: vehicle_type is required")
            elif vt not in LISTS["vehicle_type"]:
                warn(S, i, f"{plate}: vehicle_type {vt!r} not in {sorted(LISTS['vehicle_type'])}")
            if plate in seen:
                err(S, i, f"duplicate plate_number {plate}")
            seen.add(plate)
            vehicles.append(dict(code=to_text(r.get("code")), plate_number=plate, vehicle_type=vt,
                                 capacity=to_num(r.get("capacity")), capacity_eggs=to_int(r.get("capacity_eggs")),
                                 cost_per_km=to_num(r.get("cost_per_km")), is_active=to_bool(r.get("is_active"), True)))
        except (ValueError, InvalidOperation) as e:
            err(S, i, str(e))

    print("Parsed:", {k: len(v) for k, v in dict(partners=partners, sites=sites, items=items, links=links,
                                                  drivers=drivers, vehicles=vehicles).items()})
    for w in warnings[:40]:
        print("WARN ", w)
    if len(warnings) > 40:
        print(f"WARN  ... and {len(warnings) - 40} more warnings")
    for e in errors:
        print("ERROR", e)
    if errors:
        print(f"\n{len(errors)} error(s) — nothing written. Fix the spreadsheet and re-run.")
        sys.exit(1)
    if not apply:
        print(f"\nValidation passed ({len(warnings)} warning(s)). Re-run with --apply to write.")
        return

    import psycopg2
    from psycopg2.extras import execute_values  # noqa: F401

    conn = psycopg2.connect("")  # PG* environment variables
    conn.autocommit = False
    cur = conn.cursor()

    def upsert_by(table, key, data, cols, extra_sets=""):
        """INSERT … ON CONFLICT is not available for tables without a unique key, so match on `key` manually."""
        cur.execute(f"SELECT id FROM {table} WHERE {key} = %s", (data[key],))
        row = cur.fetchone()
        if row:
            sets = ", ".join(f"{c} = %({c})s" for c in cols if c != key)
            cur.execute(f"UPDATE {table} SET {sets}{extra_sets} WHERE id = %(__id)s", {**data, "__id": row[0]})
            return row[0]
        ph = ", ".join(f"%({c})s" for c in cols)
        cur.execute(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({ph}) RETURNING id", data)
        return cur.fetchone()[0]

    pcols = ["code", "nickname", "partner_type", "business_name", "business_type", "customer_type", "branch_code", "branch_name",
             "tax_id", "address_line_1", "address_line_2", "district", "sub_district", "province", "postal_code",
             "country", "payment_terms", "credit_days", "customer_tier", "is_active"]
    pid = {p["code"]: upsert_by("business_partners", "code", p, pcols) for p in partners}

    scols = ["partner_id", "site_code", "display_name", "partner_branch_code", "branch_name", "delivery_type",
             "address_line_1", "district", "sub_district", "province", "postal_code", "latitude", "longitude",
             "google_maps_url", "delivery_region", "delivery_zone", "distance_from_plant", "preferred_time_slot",
             "access_instructions", "acceptable_vehicles", "is_active"]
    for s in sites:
        s = {**s, "partner_id": pid[s["partner_code"]]}
        upsert_by("delivery_sites", "site_code", s, scols)

    icols = ["sku", "name", "item_role", "item_type", "partner_id", "description", "selling_unit", "base_unit",
             "pack_unit", "basket_unit", "storage_unit", "is_egg", "egg_content_type", "primary_size",
             "secondary_size", "min_primary", "primary_grade", "secondary_grade", "min_primary_grade", "is_egg_item", "eggs_per_pack", "pack_per_basket", "eggs_per_basket",
             "basket_per_palette", "eggs_per_palette", "base_per_storage", "basket_sku", "barcode_label",
             "is_sellable", "is_producable", "is_consumable", "is_active"]
    iid = {}
    for x in items:
        x = {**x, "partner_id": pid.get(x["partner_code"])}
        iid[x["sku"]] = upsert_by("items", "sku", x, icols)

    for l in links:
        cur.execute(
            """INSERT INTO item_business_partners (item_id, partner_id, customer_item_number, barcode_label, is_active)
               VALUES (%s,%s,%s,%s,%s)
               ON CONFLICT (item_id, partner_id) DO UPDATE SET customer_item_number = EXCLUDED.customer_item_number,
                 barcode_label = EXCLUDED.barcode_label, is_active = EXCLUDED.is_active""",
            (iid[l["sku"]], pid[l["partner_code"]], l["customer_item_number"], l["barcode_label"], l["is_active"]),
        )

    dcols = ["code", "name", "license_number", "phone", "email", "is_active"]
    for d in drivers:
        if d["code"]:
            upsert_by("drivers", "code", d, dcols)
        else:
            cur.execute("INSERT INTO drivers (name, license_number, phone, email, is_active) VALUES (%s,%s,%s,%s,%s)",
                        (d["name"], d["license_number"], d["phone"], d["email"], d["is_active"]))
    vcols = ["code", "plate_number", "vehicle_type", "capacity", "capacity_eggs", "cost_per_km", "is_active"]
    for v in vehicles:
        upsert_by("vehicles", "plate_number", v, vcols)

    conn.commit()
    for t in ("business_partners", "delivery_sites", "items", "item_business_partners", "drivers", "vehicles"):
        cur.execute(f"SELECT count(*) FROM {t}")
        print(f"{t}: {cur.fetchone()[0]}")
    print("Committed.")


if __name__ == "__main__":
    main()
