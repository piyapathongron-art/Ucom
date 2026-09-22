// Offline sale queue. Bumping the shape of QueuedSale means bumping the key too —
// a stale queue rehydrating into new code is how bills get lost.
const QUEUE_KEY = "ucom-pos-queue-v1";
const CATALOG_KEY = "ucom-pos-catalog-v1";

export type QueuedSale = {
  // = payload.client_uuid. rpc_create_sale returns the original bill for a uuid it has
  // already seen, so this must survive into the queue rather than being regenerated.
  clientUuid: string;
  payload: unknown;
  queuedAt: string;
  // set when the database answered and refused the bill; the row stays queued so a
  // human can decide what to do with it
  lastError: string | null;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.error("queue: cannot read " + key, err);
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("queue: cannot write " + key, err);
  }
}

export function readQueue(): QueuedSale[] {
  return read<QueuedSale[]>(QUEUE_KEY, []);
}

export function enqueue(sale: QueuedSale): QueuedSale[] {
  const next = [...readQueue(), sale];
  write(QUEUE_KEY, next);
  return next;
}

export function removeFromQueue(clientUuid: string): QueuedSale[] {
  const next = readQueue().filter((s) => s.clientUuid !== clientUuid);
  write(QUEUE_KEY, next);
  return next;
}

export function markFailed(clientUuid: string, reason: string): QueuedSale[] {
  const next = readQueue().map((s) =>
    s.clientUuid === clientUuid ? { ...s, lastError: reason } : s,
  );
  write(QUEUE_KEY, next);
  return next;
}

// A bill the database answered about is settled — it will never succeed on a retry, so
// it must not be sent again. One that never reached the database has no code and is
// safe to replay.
export function isDatabaseRejection(error: { code?: string } | null): boolean {
  return Boolean(error?.code);
}

export function readCachedCatalog<T>(): T | null {
  return read<T | null>(CATALOG_KEY, null);
}

export function writeCachedCatalog(value: unknown): void {
  write(CATALOG_KEY, value);
}

export type CatalogItemLike = {
  id?: string | null;
  kind?: string | null;
  qty?: number | null;
  name?: string | null;
  [key: string]: unknown;
};

// Deduct devices and products currently in the offline queue from catalog rows,
// ensuring items sold offline do not re-appear upon page reloads or cache reads.
export function applyQueueToCatalog<T extends CatalogItemLike>(
  rows: T[],
  queue: QueuedSale[],
): T[] {
  if (!queue || queue.length === 0 || !rows || rows.length === 0) {
    return rows;
  }

  const soldDeviceIds = new Set<string>();
  const soldQtyByProduct = new Map<string, number>();

  for (const sale of queue) {
    const payload = sale.payload as
      | {
          items?: Array<{
            kind?: string;
            device_unit_id?: string;
            product_id?: string;
            qty?: number;
          }>;
        }
      | undefined;
    if (!payload || !Array.isArray(payload.items)) continue;

    for (const item of payload.items) {
      if (item.kind === "device" && item.device_unit_id) {
        soldDeviceIds.add(item.device_unit_id);
      } else if (item.kind === "product" && item.product_id) {
        const qty = item.qty ?? 1;
        soldQtyByProduct.set(
          item.product_id,
          (soldQtyByProduct.get(item.product_id) ?? 0) + qty,
        );
      }
    }
  }

  if (soldDeviceIds.size === 0 && soldQtyByProduct.size === 0) {
    return rows;
  }

  return rows
    .filter(
      (row) => !(row.kind === "device" && row.id && soldDeviceIds.has(row.id)),
    )
    .map((row) => {
      if (row.kind === "product" && row.id && soldQtyByProduct.has(row.id)) {
        const decrement = soldQtyByProduct.get(row.id)!;
        return {
          ...row,
          qty: Math.max(0, (row.qty ?? 0) - decrement),
        };
      }
      return row;
    });
}
