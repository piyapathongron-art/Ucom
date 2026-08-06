#!/usr/bin/env python3
"""
Generate SQL to import US_POS_Backup_2026-08-04.json into the Ucom POS schema
(migrations 20260805120000/100/200 already applied to bihgcdceovfettoxmgme).

Classification rules discovered by inspecting the actual file (not guessed):

- inventory row is a PHONE (-> device_units) if group == 'โทรศัพท์', OR if its
  productId is a clean 15-digit numeric string regardless of group. The second
  clause exists because 2 real phones (real 15-digit IMEI, Samsung model,
  phone-tier price) are mis-filed under group 'ท' and 'ทั่วไป' — ADR 0007 already
  flags the 'ท' typo as dirty data that must be cleaned during import; importing
  those 2 rows as generic accessories would misrepresent real phones as
  countable stock with an IMEI as a SKU.
  All other inventory rows -> products.

- phone IMEI cleanup: 2 IMEIs are prefixed with stray Thai combining marks from
  a data-entry glitch (Unicode category Mn) — stripped before storing. 1 IMEI is
  blank (real gap in the source data) — given a synthetic 'IMPORT-<legacy id>'
  placeholder so the NOT NULL UNIQUE constraint holds; flagged in the report.

- sale line item kind:
    group == 'เติมเงิน' (always type='service' in source) -> kind='topup',
      carrier parsed from name "[เติมเงิน] <Carrier>"; confirmed only 3 carrier
      values appear (True/Ais/Dtac), matching the seeded carriers exactly.
    otherwise type='product' -> kind='product', type='service' -> kind='service'.
  Source data has NO 'device' or top-level 'topup' type — the old app tracked
  phone sales as ordinary product lines. product_id is left null for phone
  lines (their identity is name_snapshot); this matches ADR 0007's explicit
  decision to import sold phones as device_units with status='sold' WITHOUT
  linking them to the historical bill line — matching by IMEI across dirty
  historical data is not reliable enough to assert silently, so it isn't done.
  Repair-service lines ("[ซ่อม] ...", cost>0, costAlreadyRecorded=true) keep
  their real historical cost — that's the "cost already lives in the bill
  line" the schema's usual staff-facing zero-cost-service rule (enforced by
  rpc_create_sale, not by a table constraint) does not apply to a bulk import
  writing directly to the tables.

- money identity confirmed for all 1,071 bills, no exceptions:
    total = subtotal - billDiscount
    subtotal = sum(price*qty - itemDiscount) over the bill's items
  so importing unit_price/qty/item_discount/bill_discount as-is makes
  v_sale_profit.net_revenue reproduce `total` exactly. Expected sum: 1,454,600.

- expenses: only the 53 rows that are neither "ต้นทุนงานซ่อม: ..." (108, cost
  already lives in the sale/service line, ADR 0003) nor
  SF+/ไทยช่วยไทย/ผ่อน/ผ่อน jmart/หักมัดจำ (45, ADR 0007 — no IMEI, no order,
  can't be reconstructed) are imported as public.expenses.

Every imported row gets is_imported = true. UUIDs are uuid5-derived from the
legacy numeric id so the script is idempotent (safe to re-run; every INSERT
uses ON CONFLICT DO NOTHING).
"""
import json
import os
import re
import uuid
import unicodedata
from pathlib import Path

SRC = Path(
    os.environ.get("UCOM_BACKUP_JSON", "/Users/arty/Downloads/US_POS_Backup_2026-08-04.json")
)
# generated SQL is disposable output — regenerate rather than commit it
OUT_DIR = Path(__file__).parent / "generated"
OUT_DIR.mkdir(exist_ok=True)

NS = uuid.UUID("6f6a1b2e-2b2e-4f2e-9b2e-000000000001")  # fixed namespace for this import


def uid(kind: str, legacy_id) -> str:
    return str(uuid.uuid5(NS, f"{kind}:{legacy_id}"))


def esc(s):
    if s is None:
        return "NULL"
    if isinstance(s, bool):
        return "true" if s else "false"
    if isinstance(s, (int, float)):
        return repr(s)
    return "'" + str(s).replace("\\", "\\\\").replace("'", "''") + "'"


def clean_imei(pid: str, legacy_id: int) -> str:
    pid = pid or ""
    # strip stray Thai combining marks (Unicode category Mn) some IMEIs picked up
    cleaned = "".join(ch for ch in pid if unicodedata.category(ch) != "Mn")
    if not cleaned:
        return f"IMPORT-{legacy_id}"
    return cleaned


data = json.loads(SRC.read_text())

report = {"warnings": []}

# ── categories ───────────────────────────────────────────────
inventory = data["inventory"]


def is_phone(row) -> bool:
    pid = str(row.get("productId") or "")
    if row.get("group") == "โทรศัพท์":
        return True
    return bool(re.fullmatch(r"\d{15}", pid))


phones = [r for r in inventory if is_phone(r)]
accessories = [r for r in inventory if not is_phone(r)]
assert len(phones) + len(accessories) == len(inventory)
report["phones"] = len(phones)
report["accessories"] = len(accessories)

# categories actually used by accessory rows
used_categories = sorted({r.get("group") for r in accessories if r.get("group")})

sql_categories = []
for name in used_categories:
    sql_categories.append(
        f"insert into public.categories (id, name) values "
        f"({esc(uid('category', name))}, {esc(name)}) on conflict (name) do nothing;"
    )

# ── products (accessories) ──────────────────────────────────
sql_products = []
product_id_by_legacy = {}
for r in accessories:
    pid = uid("product", r["id"])
    product_id_by_legacy[r["id"]] = pid
    cat_id = f"(select id from public.categories where name = {esc(r.get('group'))})" if r.get("group") else "NULL"
    sql_products.append(
        "insert into public.products "
        "(id, sku, name, category_id, cost, price, qty, is_imported) values "
        f"({esc(pid)}, {esc(str(r.get('productId')) or None)}, {esc(r['name'])}, {cat_id}, "
        f"{esc(r.get('cost', 0))}, {esc(r.get('price', 0))}, {esc(r.get('qty', 0))}, true) "
        "on conflict (id) do nothing;"
    )

# map legacy productId (string) -> new product id, for linking sale lines later
product_id_by_pid = {
    str(r.get("productId")): product_id_by_legacy[r["id"]]
    for r in accessories
    if r.get("productId")
}

# ── device_units (phones) ───────────────────────────────────
sql_devices = []
imei_seen = {}
for r in phones:
    imei = clean_imei(str(r.get("productId") or ""), r["id"])
    if imei in imei_seen:
        report["warnings"].append(f"duplicate imei after cleanup: {imei} (legacy ids {imei_seen[imei]}, {r['id']})")
        imei = f"{imei}-DUP-{r['id']}"
    imei_seen[imei] = r["id"]
    status = "sold" if r.get("qty", 0) == 0 else "in_stock"
    dev_id = uid("device", r["id"])
    sql_devices.append(
        "insert into public.device_units "
        "(id, imei, model_name, acquisition, status, list_price, cost, is_imported) values "
        f"({esc(dev_id)}, {esc(imei)}, {esc(r['name'])}, 'purchased', {esc(status)}, "
        f"{esc(r.get('price', 0))}, {esc(r.get('cost'))}, true) "
        "on conflict (id) do nothing;"
    )

report["device_sold"] = sum(1 for r in phones if r.get("qty", 0) == 0)
report["device_in_stock"] = sum(1 for r in phones if r.get("qty", 0) != 0)

# ── sales + sale_items ───────────────────────────────────────
sql_sales = []
sql_items = []

carrier_id_expr = {
    "True": "(select id from public.topup_carriers where name = 'True')",
    "Ais": "(select id from public.topup_carriers where name = 'Ais')",
    "Dtac": "(select id from public.topup_carriers where name = 'Dtac')",
}

total_sum_expected = 0
line_kind_counts = {"product": 0, "service": 0, "topup": 0}

for s in data["salesLog"]:
    sale_id = uid("sale", s["id"])
    total_sum_expected += s["total"]
    sql_sales.append(
        "insert into public.sales "
        "(id, sold_at, payment_method, bill_discount, bill_discount_reason, "
        "client_uuid, is_imported) values "
        f"({esc(sale_id)}, {esc(s['date'])}, {esc(s['paymentMethod'])}, "
        f"{esc(s.get('billDiscount', 0))}, {esc(s.get('billDiscountReason') or None)}, "
        f"{esc('legacy-' + str(s['id']))}, true) "
        "on conflict (id) do nothing;"
    )

    for idx, it in enumerate(s["items"]):
        # NOT uid(it['id']): product lines reuse the inventory row's id, so the same
        # accessory sold across many bills carries an identical legacy id. Keying on
        # that collided and `on conflict do nothing` silently swallowed 782 of the
        # 1,573 lines (caught by the rehearsal revenue check, which came up 114,077
        # short). The bill id plus position within the bill is the real identity.
        item_id = uid("sale_item", f"{s['id']}:{idx}")
        group = it.get("group")
        pid = str(it.get("productId") or "")

        if group == "เติมเงิน":
            kind = "topup"
            carrier = it["name"].replace("[เติมเงิน]", "").strip()
            carrier_expr = carrier_id_expr.get(carrier)
            if carrier_expr is None:
                report["warnings"].append(f"unknown topup carrier '{carrier}' on item {it['id']}")
                continue
            line_kind_counts["topup"] += 1
            sql_items.append(
                "insert into public.sale_items "
                "(id, sale_id, kind, topup_carrier_id, name_snapshot, unit_cost, "
                "unit_price, qty) values "
                f"({esc(item_id)}, {esc(sale_id)}, 'topup', {carrier_expr}, "
                f"{esc(it['name'])}, {esc(it.get('cost', 0))}, {esc(it['price'])}, "
                f"{esc(it.get('qty', 1))}) on conflict (id) do nothing;"
            )
        elif it.get("type") == "service":
            line_kind_counts["service"] += 1
            sql_items.append(
                "insert into public.sale_items "
                "(id, sale_id, kind, name_snapshot, unit_cost, unit_price, qty, "
                "item_discount, item_discount_reason) values "
                f"({esc(item_id)}, {esc(sale_id)}, 'service', {esc(it['name'])}, "
                f"{esc(it.get('cost', 0))}, {esc(it['price'])}, {esc(it.get('qty', 1))}, "
                f"{esc(it.get('itemDiscount', 0))}, {esc(it.get('itemDiscountReason') or None)}) "
                "on conflict (id) do nothing;"
            )
        else:
            # kind='product'. Phone lines (group == 'โทรศัพท์') intentionally get
            # product_id = NULL — ADR 0007: sold phones become device_units with
            # status='sold' but are not linked back to the historical bill line.
            new_product_id = None if group == "โทรศัพท์" else product_id_by_pid.get(pid)
            line_kind_counts["product"] += 1
            prod_expr = esc(new_product_id) if new_product_id else "NULL"
            sql_items.append(
                "insert into public.sale_items "
                "(id, sale_id, kind, product_id, name_snapshot, unit_cost, unit_price, "
                "qty, item_discount, item_discount_reason) values "
                f"({esc(item_id)}, {esc(sale_id)}, 'product', {prod_expr}, {esc(it['name'])}, "
                f"{esc(it.get('cost', 0))}, {esc(it['price'])}, {esc(it.get('qty', 1))}, "
                f"{esc(it.get('itemDiscount', 0))}, {esc(it.get('itemDiscountReason') or None)}) "
                "on conflict (id) do nothing;"
            )

report["sales"] = len(data["salesLog"])
report["sale_items"] = sum(line_kind_counts.values())
report["line_kind_counts"] = line_kind_counts
report["expected_total_sum"] = total_sum_expected

# Guard the generator against silent row loss from primary-key collisions: every
# emitted id must be distinct, or `on conflict do nothing` drops rows at load time
# and the totals quietly come up short.
def assert_unique_ids(statements, label, expected):
    ids = re.findall(r"values\s*\(\s*'([0-9a-f-]{36})'", "\n".join(statements))
    assert len(ids) == expected, f"{label}: emitted {len(ids)} rows, expected {expected}"
    assert len(set(ids)) == len(ids), (
        f"{label}: {len(ids) - len(set(ids))} duplicate ids — rows would be lost"
    )

source_line_total = sum(len(s["items"]) for s in data["salesLog"])
assert_unique_ids(sql_items, "sale_items", source_line_total)
assert_unique_ids(sql_sales, "sales", len(data["salesLog"]))
assert_unique_ids(sql_products, "products", len(accessories))
assert_unique_ids(sql_devices, "device_units", len(phones))
assert sum(line_kind_counts.values()) == source_line_total, (
    f"line kinds sum to {sum(line_kind_counts.values())}, source has {source_line_total}"
)

# ── expenses (real ones only) ───────────────────────────────
sql_expenses = []
skipped_repair = 0
skipped_sf = 0
sf_names = {"SF+", "ไทยช่วยไทย", "ผ่อน", "ผ่อน jmart", "หักมัดจำ"}
for e in data["expenseList"]:
    name = e.get("name", "")
    if "ต้นทุนงานซ่อม" in name:
        skipped_repair += 1
        continue
    if name in sf_names:
        skipped_sf += 1
        continue
    exp_id = uid("expense", e["id"])
    sql_expenses.append(
        "insert into public.expenses (id, name, amount, spent_at, is_imported) values "
        f"({esc(exp_id)}, {esc(name)}, {esc(e['amount'])}, "
        f"{esc(e['date'][:10])}, true) on conflict (id) do nothing;"
    )

report["expenses_imported"] = len(sql_expenses)
report["expenses_skipped_repair"] = skipped_repair
report["expenses_skipped_sf"] = skipped_sf
assert skipped_repair == 108, skipped_repair
assert skipped_sf == 45, skipped_sf
assert len(sql_expenses) == 53, len(sql_expenses)

# ── write batched SQL files ─────────────────────────────────
def write_batches(name, statements, batch_size=150):
    for i in range(0, len(statements), batch_size):
        chunk = statements[i : i + batch_size]
        (OUT_DIR / f"{name}_{i // batch_size:03d}.sql").write_text("\n".join(chunk) + "\n")


write_batches("01_categories", sql_categories)
write_batches("02_products", sql_products)
write_batches("03_devices", sql_devices)
write_batches("04_sales", sql_sales)
write_batches("05_items", sql_items)
write_batches("06_expenses", sql_expenses)

(OUT_DIR / "_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
