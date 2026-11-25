import { useState } from "react";
import { EmptyState } from "@/app/_components/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDate, fmtMoney } from "./utils";
import type { SfDueRow } from "./useSfDue";

// Pending SF bills (devices still not financed). Delete is a reversible-looking per-row action → inline confirm.
// Table from md up (e2e finds rows by bill number), cards below md.
export function SfDueList({ dueList, highlightOrderNo, onEdit, deleteOrder }: {
  dueList: SfDueRow[];
  highlightOrderNo: string | null;
  onEdit: (orderId: string) => void;
  deleteOrder: (id: string) => Promise<boolean>;
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const active = dueList.filter((o) => (o.unfinanced_count ?? 0) > 0);

  if (active.length === 0) return <EmptyState title="ไม่มีบิลค้าง" hint="กด “รับบิล SF” เพื่อรับเครื่องจากบิลใหม่" />;

  // A bill with a financed or sold device can no longer be deleted; say so in the button, not only in a tooltip.
  const actions = (o: SfDueRow, id: string, suffix = "") => {
    const locked = (o.financed_count ?? 0) > 0;
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(id)} data-testid={suffix ? undefined : `sf-due-edit-${id}`}>แก้ไข</Button>
        {locked ? (
          <Button type="button" variant="secondary" size="sm" disabled title="ลบไม่ได้: บิลนี้มีเครื่องที่ปล่อย/ขายไปแล้ว" data-testid={suffix ? undefined : `sf-due-delete-${id}`} className="bg-muted text-muted-foreground disabled:opacity-100">ลบไม่ได้</Button>
        ) : deleteConfirmId === id ? (
          <>
            <Button type="button" size="sm" onClick={() => { void deleteOrder(id); setDeleteConfirmId(null); }} data-testid={suffix ? undefined : `sf-due-delete-confirm-${id}`} className="bg-danger font-bold text-on-accent hover:bg-danger/90">ยืนยันลบ</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>ยกเลิก</Button>
          </>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteConfirmId(id)} data-testid={suffix ? undefined : `sf-due-delete-${id}`}>ลบ</Button>
        )}
      </div>
    );
  };
  const newChip = <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">ใหม่</span>;

  return (
    <>
      <div className="ucom-table-wrap hidden md:block" data-testid="sf-due-list">
        <table className="ucom-table">
          <thead>
            <tr><th scope="col">เลขที่บิล</th><th scope="col">วันที่รับ</th><th scope="col" className="text-right">เหลือ / ทั้งหมด</th><th scope="col" className="text-right">ยอดค้าง</th><th scope="col"><span className="sr-only">จัดการ</span></th></tr>
          </thead>
          <tbody>
            {active.map((o) => {
              const id = o.sf_order_id!;
              const isNew = o.order_no === highlightOrderNo;
              return (
                <tr key={id} className={isNew ? "bg-accent/60" : undefined}>
                  <td className="text-sm font-semibold">{o.order_no}{isNew && newChip}</td>
                  <td className="text-sm text-muted-foreground">{formatDate(o.ordered_at)}</td>
                  <td className="text-right text-sm tabular-nums">{o.unfinanced_count} / {o.device_count} เครื่อง</td>
                  <td className="text-right text-sm font-semibold tabular-nums">{o.amount_due !== null ? `฿${fmtMoney(o.amount_due)}` : "-"}</td>
                  <td>{actions(o, id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden" aria-label="บิลค้าง">
        {active.map((o) => {
          const id = o.sf_order_id!;
          return (
            <li key={id} className={`flex flex-col gap-3 rounded-xl p-4 shadow-card ${o.order_no === highlightOrderNo ? "bg-accent" : "bg-card"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{o.order_no}{o.order_no === highlightOrderNo && newChip}</p>
                  <p className="text-xs text-muted-foreground">รับ {formatDate(o.ordered_at)} · เหลือ {o.unfinanced_count} / {o.device_count} เครื่อง</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{o.amount_due !== null ? `฿${fmtMoney(o.amount_due)}` : "-"}</span>
              </div>
              {actions(o, id, "card")}
            </li>
          );
        })}
      </ul>
    </>
  );
}
