import { createClient } from "@supabase/supabase-js";

async function globalTeardown(): Promise<void> {
  // Load environment variables from .env.local using Node builtin
  process.loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }

  const supabase = createClient(url, anonKey);

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@ucom.local",
    password: "123456",
  });

  if (authError) {
    throw new Error(`Auth sign-in failed: ${authError.message}`);
  }

  let hasError = false;

  // Step c prep: query products where name like "ZZTEST%" BEFORE deleting sales
  let testProductIds: string[] = [];
  try {
    const { data: prodData, error: prodQueryErr } = await supabase
      .from("products")
      .select("id")
      .like("name", "ZZTEST%");

    if (prodQueryErr) throw prodQueryErr;
    if (prodData) {
      testProductIds = prodData.map((p) => p.id);
    }
  } catch (err) {
    console.error("Failed to query test product IDs:", err);
    hasError = true;
  }

  // Step a: sales
  // Select id from sale_items where name_snapshot like "ZZTEST%" plus select id from sale_items whose product_id is one of testProductIds
  try {
    const saleIds = new Set<string>();

    const { data: itemsByName, error: err1 } = await supabase
      .from("sale_items")
      .select("sale_id")
      // the repair specs close a job into a bill whose line reads "ค่าซ่อม ZZTEST-device-…",
      // so the marker sits mid-string — anchoring the pattern leaves those bills behind.
      .like("name_snapshot", "%ZZTEST%");

    if (err1) throw err1;
    if (itemsByName) {
      itemsByName.forEach((item) => {
        if (item.sale_id) saleIds.add(item.sale_id);
      });
    }

    if (testProductIds.length > 0) {
      const { data: itemsByProd, error: err2 } = await supabase
        .from("sale_items")
        .select("sale_id")
        .in("product_id", testProductIds);

      if (err2) throw err2;
      if (itemsByProd) {
        itemsByProd.forEach((item) => {
          if (item.sale_id) saleIds.add(item.sale_id);
        });
      }
    }

    const saleIdsArray = Array.from(saleIds);
    if (saleIdsArray.length > 0) {
      const { data: deletedSales, error: delSaleErr } = await supabase
        .from("sales")
        .delete()
        .in("id", saleIdsArray)
        .select("id");

      if (delSaleErr) throw delSaleErr;
      console.log(`cleanup: sales removed ${deletedSales ? deletedSales.length : 0}`);
    } else {
      console.log("cleanup: sales removed 0");
    }
  } catch (err) {
    console.error("cleanup: sales error", err);
    hasError = true;
  }

  // Step b: repair_jobs where customer_name like "ZZTEST%"
  try {
    const { data: deletedJobs, error: err } = await supabase
      .from("repair_jobs")
      .delete()
      .like("customer_name", "ZZTEST%")
      .select("id");

    if (err) throw err;
    console.log(`cleanup: repair_jobs removed ${deletedJobs ? deletedJobs.length : 0}`);
  } catch (err) {
    console.error("cleanup: repair_jobs error", err);
    hasError = true;
  }

  // Step d: device_units where model_name like "ZZTEST%"
  try {
    const { data: deletedUnits, error: err } = await supabase
      .from("device_units")
      .delete()
      .like("model_name", "ZZTEST%")
      .select("id");

    if (err) throw err;
    console.log(`cleanup: device_units removed ${deletedUnits ? deletedUnits.length : 0}`);
  } catch (err) {
    console.error("cleanup: device_units error", err);
    hasError = true;
  }

  // Step e: sf_orders where order_no like "TEST-SF%"
  try {
    const { data: deletedOrders, error: err } = await supabase
      .from("sf_orders")
      .delete()
      .like("order_no", "TEST-SF%")
      .select("id");

    if (err) throw err;
    console.log(`cleanup: sf_orders removed ${deletedOrders ? deletedOrders.length : 0}`);
  } catch (err) {
    console.error("cleanup: sf_orders error", err);
    hasError = true;
  }

  // Step c: products where name like "ZZTEST%"
  try {
    if (testProductIds.length > 0) {
      const { data: deletedProducts, error: err } = await supabase
        .from("products")
        .delete()
        .in("id", testProductIds)
        .select("id");

      if (err) throw err;
      console.log(`cleanup: products removed ${deletedProducts ? deletedProducts.length : 0}`);
    } else {
      console.log("cleanup: products removed 0");
    }
  } catch (err) {
    console.error("cleanup: products error", err);
    hasError = true;
  }

  if (hasError) {
    throw new Error("Test data cleanup encountered errors on one or more tables.");
  }
}

export default globalTeardown;
