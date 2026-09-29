import assert from "node:assert";
import { applyQueueToCatalog, type QueuedSale, type CatalogItemLike } from "./queue.ts";

// Mock catalog
const catalog: CatalogItemLike[] = [
  { id: "device-1", kind: "device", name: "iPhone 15 Pro (IMEI: 111111111111111)", price: 35000 },
  { id: "device-2", kind: "device", name: "Samsung S24 (IMEI: 222222222222222)", price: 28000 },
  { id: "product-1", kind: "product", name: "Focus Film", qty: 5, price: 150 },
  { id: "product-2", kind: "product", name: "Case Clear", qty: 2, price: 250 },
];

// Mock offline queue with 2 sales:
// Sale 1: Sold device-1 and 2x Focus Film
// Sale 2: Sold 3x Case Clear (exceeds stock 2)
const queue: QueuedSale[] = [
  {
    clientUuid: "uuid-1",
    payload: {
      items: [
        { kind: "device", device_unit_id: "device-1" },
        { kind: "product", product_id: "product-1", qty: 2 },
      ],
    },
    queuedAt: "2026-09-21T00:00:00.000Z",
    lastError: null,
  },
  {
    clientUuid: "uuid-2",
    payload: {
      items: [
        { kind: "product", product_id: "product-2", qty: 3 },
      ],
    },
    queuedAt: "2026-09-21T00:01:00.000Z",
    lastError: "OutOfStock",
  },
];

const result = applyQueueToCatalog(catalog, queue);

// 1. device-1 must be removed
assert.strictEqual(
  result.some((item) => item.id === "device-1"),
  false,
  "device-1 should be removed from catalog",
);

// 2. device-2 must remain
assert.strictEqual(
  result.some((item) => item.id === "device-2"),
  true,
  "device-2 should remain in catalog",
);

// 3. product-1 quantity must be decremented from 5 to 3
const product1 = result.find((item) => item.id === "product-1");
assert.ok(product1, "product-1 must exist");
assert.strictEqual(product1.qty, 3, "product-1 qty should be 3 (5 - 2)");

// 4. product-2 quantity must be clamped to 0 (2 - 3 => 0, not negative)
const product2 = result.find((item) => item.id === "product-2");
assert.ok(product2, "product-2 must exist");
assert.strictEqual(product2.qty, 0, "product-2 qty should clamp to 0");

// 5. Empty queue returns original catalog
const emptyQueueResult = applyQueueToCatalog(catalog, []);
assert.strictEqual(emptyQueueResult.length, catalog.length, "Empty queue leaves catalog intact");

console.log("✓ queue.check.mts passed all 5 assertions");
