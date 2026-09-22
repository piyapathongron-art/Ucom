"use client";

import type { QueuedSale } from "./queue";

export function QueueBanner({
  queue,
  isSyncing,
  onSync,
  onRemove,
}: {
  queue: QueuedSale[];
  isSyncing: boolean;
  onSync: () => void;
  onRemove?: (clientUuid: string) => void;
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
        <ul data-testid="queue-rejected" className="mx-auto mt-1 max-w-[1440px] list-disc pl-5 text-xs space-y-1">
          {rejected.map((s) => (
            <li key={s.clientUuid} className="flex items-center justify-between gap-2">
              <span>{s.lastError}</span>
              {onRemove && (
                <button
                  type="button"
                  data-testid={`queue-remove-${s.clientUuid}`}
                  onClick={() => onRemove(s.clientUuid)}
                  className="rounded border border-danger/40 bg-danger/20 px-2 py-0.5 text-[0.7rem] font-medium text-danger hover:bg-danger/30 transition-colors"
                >
                  ลบบิลนี้ทิ้ง
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
