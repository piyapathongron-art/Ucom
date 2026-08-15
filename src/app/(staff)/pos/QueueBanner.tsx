"use client";

import type { QueuedSale } from "./queue";

export function QueueBanner({
  queue,
  isSyncing,
  onSync,
}: {
  queue: QueuedSale[];
  isSyncing: boolean;
  onSync: () => void;
}) {
  if (queue.length === 0) return null;

  const rejected = queue.filter((s) => s.lastError);

  return (
    <div
      data-testid="queue-banner"
      className={
        rejected.length > 0
          ? "border-b border-danger bg-danger/10 px-4 py-2 text-sm text-danger"
          : "border-b border-warning bg-warning/10 px-4 py-2 text-sm text-warning"
      }
    >
      <div className="flex items-center gap-3">
        <span data-testid="queue-count">บิลค้าง {queue.length} ใบ</span>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          data-testid="queue-sync"
          className="underline disabled:opacity-50"
        >
          {isSyncing ? "กำลังส่ง" : "ส่งบิลค้าง"}
        </button>
      </div>

      {rejected.length > 0 && (
        <ul data-testid="queue-rejected" className="mt-1 list-disc pl-5">
          {rejected.map((s) => (
            <li key={s.clientUuid}>{s.lastError}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
