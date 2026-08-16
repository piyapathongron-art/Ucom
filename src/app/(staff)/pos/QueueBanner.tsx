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
          ? "border-b border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger"
          : "border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning"
      }
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-3">
        <span className="font-medium" data-testid="queue-count">บิลค้าง {queue.length} ใบ</span>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          data-testid="queue-sync"
          className="rounded border border-current px-2 py-1 text-xs font-medium underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50"
        >
          {isSyncing ? "กำลังส่ง" : "ส่งบิลค้าง"}
        </button>
      </div>

      {rejected.length > 0 && (
        <ul data-testid="queue-rejected" className="mx-auto mt-1 max-w-[1440px] list-disc pl-5 text-xs">
          {rejected.map((s) => (
            <li key={s.clientUuid}>{s.lastError}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
