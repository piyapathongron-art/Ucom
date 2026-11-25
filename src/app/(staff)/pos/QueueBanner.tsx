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
  const tone = rejected.length > 0 ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning";

  return (
    <div data-testid="queue-banner" role="status" className={`flex flex-col gap-2 rounded-xl p-4 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold" data-testid="queue-count">
          บิลค้าง {queue.length} ใบ{rejected.length > 0 ? ` · ส่งไม่ผ่าน ${rejected.length} ใบ` : ""}
        </span>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          data-testid="queue-sync"
          className="h-10 rounded-full bg-card px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {isSyncing ? "กำลังส่ง" : "ส่งบิลค้าง"}
        </button>
      </div>
      <p className="text-foreground">บิลที่ทำไว้ตอนเชื่อมต่อไม่ได้ ระบบจะลองส่งเองเมื่อกลับมาออนไลน์</p>

      {rejected.length > 0 && (
        <ul data-testid="queue-rejected" className="flex flex-col gap-2">
          {rejected.map((s) => (
            <li key={s.clientUuid} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-foreground">
              <span>{s.lastError}</span>
              {onRemove && (
                <button
                  type="button"
                  data-testid={`queue-remove-${s.clientUuid}`}
                  onClick={() => onRemove(s.clientUuid)}
                  className="h-10 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger-bg"
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
