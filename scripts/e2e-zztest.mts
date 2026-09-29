// Preflight + cleanup for Playwright write runs against the shared (production) Supabase project.
//   node scripts/e2e-zztest.mts list [--out snapshot.json]          read-only: what test rows exist now
//   node scripts/e2e-zztest.mts cleanup --snapshot snapshot.json    DRY RUN: rows created since the snapshot
//   node scripts/e2e-zztest.mts cleanup --snapshot snapshot.json --apply   delete exactly those rows
// Only rows carrying a test marker (ZZTEST% / TEST-SF%) AND absent from the snapshot are ever touched.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Ids = Record<string, string[]>;
const ORDER = ["consignments", "sales", "repair_jobs", "sf_commission_receipts", "device_units", "sf_orders", "products", "expenses", "shop_income"] as const;

async function ids(table: string, column: string, pattern: string): Promise<string[]> {
  const { data, error } = await service.from(table).select("id").like(column, pattern);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function collect(): Promise<Ids> {
  const products = await ids("products", "name", "ZZTEST%");
  const devices = await ids("device_units", "model_name", "ZZTEST%");
  const saleIds = new Set<string>();
  const byName = await service.from("sale_items").select("sale_id").like("name_snapshot", "%ZZTEST%");
  const byNote = await service.from("sales").select("id").like("note", "%ZZTEST%");
  if (byName.error || byNote.error) throw new Error("sales lookup failed");
  byName.data?.forEach((r) => r.sale_id && saleIds.add(r.sale_id));
  byNote.data?.forEach((r) => saleIds.add(r.id));
  if (products.length) {
    const r = await service.from("sale_items").select("sale_id").in("product_id", products);
    r.data?.forEach((x) => x.sale_id && saleIds.add(x.sale_id));
  }
  if (devices.length) {
    const r = await service.from("sale_items").select("sale_id").in("device_unit_id", devices);
    r.data?.forEach((x) => x.sale_id && saleIds.add(x.sale_id));
  }
  const receipts = devices.length ? ((await service.from("sf_commission_receipts").select("id").in("device_unit_id", devices)).data ?? []).map((r) => r.id) : [];
  return {
    consignments: await ids("consignments", "counterparty_name", "ZZTEST%"),
    sales: [...saleIds],
    repair_jobs: await ids("repair_jobs", "customer_name", "ZZTEST%"),
    sf_commission_receipts: receipts,
    device_units: devices,
    sf_orders: await ids("sf_orders", "order_no", "TEST-SF%"),
    products,
    expenses: await ids("expenses", "name", "ZZTEST%"),
    shop_income: await ids("shop_income", "name", "ZZTEST%"),
  };
}

const flag = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const [, , cmd] = process.argv;

if (cmd === "list") {
  const now = await collect();
  for (const t of ORDER) console.log(`${t.padEnd(24)} ${now[t].length}`);
  const out = flag("--out");
  if (out) { writeFileSync(out, JSON.stringify(now, null, 2)); console.log(`snapshot written: ${out}`); }
} else if (cmd === "cleanup") {
  const snapFile = flag("--snapshot");
  if (!snapFile) throw new Error("--snapshot <file> is required");
  const before: Ids = JSON.parse(readFileSync(snapFile, "utf8"));
  const now = await collect();
  const created = Object.fromEntries(ORDER.map((t) => [t, now[t].filter((id) => !(before[t] ?? []).includes(id))])) as Ids;
  const apply = process.argv.includes("--apply");
  console.log(apply ? "APPLY: deleting rows created since the snapshot" : "DRY RUN: would delete rows created since the snapshot");
  for (const t of ORDER) console.log(`${t.padEnd(24)} ${created[t].length}${created[t].length ? "  " + created[t].join(",") : ""}`);
  if (apply) {
    for (const t of ORDER) {
      if (!created[t].length) continue;
      if (t === "sales") await service.from("sale_items").delete().in("sale_id", created[t]);
      const { data, error } = await service.from(t).delete().in("id", created[t]).select("id");
      if (error) throw new Error(`${t}: ${error.message}`);
      console.log(`deleted ${t}: ${data?.length ?? 0}`);
    }
  }
} else {
  console.log("usage: list [--out file] | cleanup --snapshot file [--apply]");
}
