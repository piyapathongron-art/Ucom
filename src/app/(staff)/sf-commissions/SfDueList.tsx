import { useState } from "react";
import { EmptyState } from "@/app/_components/EmptyState";
import { formatDate, fmtMoney } from "./utils";
import type { SfDueRow } from "./useSfDue";

// Pending SF bills (devices still not financed). Delete is a reversible-looking per-row action → inline confirm.
export function SfDueList({ dueList, highlightOrderNo, onEdit, deleteOrder }: {
  dueList: SfDueRow[];
  highlightOrderNo: string | null;
  onEdit: (orderId: string) => void;
  deleteOrder: (id: string) => Promise<boolean>;
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const active = dueList.filter((o) => (o.unfinanced_count ?? 0) > 0);

  if (active.length === 0) return <EmptyState title="ไม่มีบิลค้าง" hint="กด “รับบิล SF” เพื่อรับเครื่องจากบิลใหม่" />;

  return (
    <div className="ucom-table-wrap" data-testid="sf-due-list">
      <table className="ucom-table">
        <thead>
          <tr><th>เลขที่บิล</th><th>วันที่รับ</th><th className="text-right">เหลือ / ทั้งหมด</th><th className="text-right">ยอดค้าง</th><th /></tr>
        </thead>
        <tbody>
          {active.map((o) => {
            const id = o.sf_order_id!;
            const locked = (o.financed_count ?? 0) > 0;
            return (
              <tr key={id} className={o.order_no === highlightOrderNo ? "bg-brand-ink/60" : undefined}>
                <td className="text-[13.5px] font-semibold">{o.order_no}</td>
                <td className="text-[13px] text-ink-muted">{formatDate(o.ordered_at)}</td>
                <td className="text-right text-[13.5px] tabular-nums">{o.unfinanced_count} / {o.device_count} เครื่อง</td>
                <td className="text-right text-[13.5px] font-semibold tabular-nums">{o.amount_due !== null ? `฿${fmtMoney(o.amount_due)}` : "-"}</td>
                <td>
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => onEdit(id)} data-testid={`sf-due-edit-${id}`} className="ucom-secondary px-3.5 py-1.5 text-xs">แก้ไข</button>
                    {deleteConfirmId === id ? (
                      <>
                        <button type="button" onClick={() => { void deleteOrder(id); setDeleteConfirmId(null); }} data-testid={`sf-due-delete-confirm-${id}`} className="rounded-full bg-danger px-3.5 py-1.5 text-xs font-bold text-on-accent">ยืนยันลบ</button>
                        <button type="button" onClick={() => setDeleteConfirmId(null)} className="ucom-secondary px-3.5 py-1.5 text-xs">ยกเลิก</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirmId(id)} data-testid={`sf-due-delete-${id}`} disabled={locked} title={locked ? "ลบไม่ได้: บิลนี้มีเครื่องที่ปล่อย/ขายไปแล้ว" : undefined} className="ucom-danger px-3.5 py-1.5 text-xs disabled:pointer-events-none disabled:opacity-40">ลบ</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
