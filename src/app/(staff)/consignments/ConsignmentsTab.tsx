"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/app/_components/EmptyState";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { SkeletonRows } from "@/app/_components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { ConsignActionDialog, ConsignOpenDialog } from "./ConsignDialogs";
import { fmt, statusLabel, type Action, type ActionValues, type CaseRow, type Direction, type OpenValues } from "./consignTypes";

const PAGE_SIZE = 25;

function TableHead() {
  return <thead><tr><th>เครื่อง</th><th>คู่ค้า</th><th className="text-right">ราคาตั้ง</th><th>สถานะ</th><th>ยอดที่เกี่ยวข้อง</th><th>จัดการ</th></tr></thead>;
}

function amountNote(row: CaseRow) {
  switch (row.status) {
    case "reported_sold": return `รอรับ ${fmt(row.receivable_amount)}`;
    case "settled": return `รับแล้ว ${fmt(row.receivable_amount)}`;
    case "sold_unpaid": return `ต้องจ่าย ${fmt(row.partner_share)}`;
    case "paid": return `จ่ายแล้ว ${fmt(row.partner_share)}`;
    default: return "—";
  }
}

// One direction of the merged page (ฝากออก / ฝากเข้า). Parent keys it by direction so state resets on switch.
export function ConsignmentsTab({ direction, isOpenDialog, onOpenDialogClose }: { direction: Direction; isOpenDialog: boolean; onOpenDialogClose: () => void }) {
  const supabase = createClient();
  const loadRequest = useRef(0);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ row: CaseRow; action: Action } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const requestId = ++loadRequest.current;
    Promise.resolve(supabase.from("v_pos_consignments")
      .select("*", { count: "exact" })
      .eq("direction", direction)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1))
      .then((result) => {
        if (!isCurrent || requestId !== loadRequest.current) return;
        if (result.error) throw result.error;
        setRows(result.data ?? []);
        setTotal(result.count ?? 0);
        setLoadError(null);
      })
      .catch(() => {
        if (!isCurrent || requestId !== loadRequest.current) return;
        setRows([]);
        setTotal(0);
        setLoadError("โหลดข้อมูลฝากขายไม่สำเร็จ กรุณาลองใหม่หลังเปิดใช้งานฐานข้อมูลรุ่นล่าสุด");
      })
      .finally(() => { if (isCurrent && requestId === loadRequest.current) setIsLoading(false); });
    return () => { isCurrent = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, page, reloadKey]);

  const refresh = () => { setIsLoading(true); setReloadKey((value) => value + 1); };

  async function openCase(values: OpenValues) {
    try {
      if (direction === "out") {
        const stock = await supabase.from("v_pos_stock").select("id, acquisition, cost")
          .eq("kind", "device").eq("code", values.imei).eq("status", "in_stock").single();
        if (stock.error || !stock.data?.id || stock.data.acquisition !== "purchased" || stock.data.cost === null) throw new Error("device not eligible");
        const result = await supabase.rpc("rpc_consignment_open_out", { p_device_id: stock.data.id, p_counterparty: values.counterparty, p_listed_price: values.listedPrice });
        if (result.error) throw result.error;
      } else {
        const result = await supabase.rpc("rpc_consignment_open_in", { p_imei: values.imei, p_model_name: values.modelName, p_counterparty: values.counterparty, p_listed_price: values.listedPrice });
        if (result.error) throw result.error;
      }
    } catch {
      toast.error(direction === "out"
        ? "ยังยืนยันผลฝากออกไม่ได้ กรุณารีเฟรชหน้าและตรวจว่า IMEI เป็นเครื่องซื้อขาดที่มีต้นทุน"
        : "ยังยืนยันผลรับฝากไม่ได้ กรุณารีเฟรชหน้าและตรวจ IMEI ที่อาจซ้ำกัน", { duration: Infinity });
      return false;
    }
    toast.success("บันทึกการฝากเครื่องแล้ว");
    setPage(1);
    refresh();
    return true;
  }

  async function completeAction(values: ActionValues) {
    const caseId = selected?.row.id;
    if (!selected || !caseId) return false;
    const { action } = selected;
    const { salePrice, partnerShare, paymentMethod } = values;
    const account = values.receivingAccount || null;
    try {
      const result = action === "return"
        ? await supabase.rpc("rpc_consignment_return", { p_id: caseId })
        : action === "report"
          ? await supabase.rpc("rpc_consignment_report_out", { p_id: caseId, p_sale_price: salePrice, p_partner_share: partnerShare })
          : action === "settle"
            ? await supabase.rpc("rpc_consignment_settle_out", { p_id: caseId, p_payment_method: paymentMethod, p_receiving_account: account })
            : action === "sell"
              ? await supabase.rpc("rpc_consignment_sell_in", { p_id: caseId, p_sale_price: salePrice, p_partner_share: partnerShare, p_payment_method: paymentMethod, p_receiving_account: account })
              : await supabase.rpc("rpc_consignment_pay_in", { p_id: caseId, p_payment_method: paymentMethod });
      if (result.error) throw result.error;
    } catch {
      toast.error("ยังยืนยันผลไม่ได้ กรุณารีเฟรชสถานะก่อนลองอีกครั้ง", { duration: Infinity });
      return false;
    }
    toast.success("บันทึกรายการฝากขายแล้ว");
    refresh();
    return true;
  }

  const btn = "rounded-full px-3.5 py-1.5 text-xs";
  return (
    <>
      {loadError && <ErrorPanel message={loadError} onRetry={refresh} />}
      {isLoading ? <SkeletonRows cols={6} head={<TableHead />} /> : rows.length > 0 ? (
        <div className="ucom-table-wrap">
          <table className="ucom-table">
            <TableHead />
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td><span className="text-[13.5px] font-semibold">{row.model_name}</span><br /><span className="text-xs text-ink-muted">IMEI {row.imei}</span></td>
                <td className="text-[13px]">{row.counterparty_name}</td>
                <td className="text-right text-[13.5px] font-semibold tabular-nums">{fmt(row.listed_price)}</td>
                <td className="text-[13px]">{statusLabel[row.status ?? ""] ?? row.status}<br /><span className="text-xs text-ink-muted">{row.created_at ? new Date(row.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : ""}</span></td>
                <td className="text-xs text-ink-muted">{amountNote(row)}</td>
                <td><div className="flex flex-wrap gap-1">
                  {row.status === "placed" && <button type="button" className={`ucom-secondary ${btn}`} onClick={() => setSelected({ row, action: "return" })}>คืนเครื่อง</button>}
                  {row.direction === "out" && row.status === "placed" && <button type="button" className={`ucom-primary ${btn}`} onClick={() => setSelected({ row, action: "report" })}>แจ้งขาย</button>}
                  {row.direction === "out" && row.status === "reported_sold" && <button type="button" className={`ucom-primary ${btn}`} onClick={() => setSelected({ row, action: "settle" })}>รับเงิน</button>}
                  {row.direction === "in" && row.status === "placed" && <button type="button" className={`ucom-primary ${btn}`} onClick={() => setSelected({ row, action: "sell" })}>ขายหน้าร้าน</button>}
                  {row.direction === "in" && row.status === "sold_unpaid" && <button type="button" className={`ucom-primary ${btn}`} onClick={() => setSelected({ row, action: "pay" })}>จ่ายเจ้าของ</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : !loadError && <EmptyState title={direction === "out" ? "ยังไม่มีเครื่องฝากออก" : "ยังไม่มีเครื่องฝากเข้า"} hint="กดปุ่มมุมขวาบนเพื่อเริ่มรายการแรก" />}
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>หน้า {page} · {total} รายการ</span>
        <div className="flex gap-2">
          <button type="button" className="ucom-secondary px-3.5 py-1.5 disabled:opacity-40" disabled={page === 1} onClick={() => { setPage((value) => value - 1); setIsLoading(true); }}>ก่อนหน้า</button>
          <button type="button" className="ucom-secondary px-3.5 py-1.5 disabled:opacity-40" disabled={page * PAGE_SIZE >= total} onClick={() => { setPage((value) => value + 1); setIsLoading(true); }}>ถัดไป</button>
        </div>
      </div>
      {isOpenDialog && <ConsignOpenDialog direction={direction} onClose={onOpenDialogClose} onSubmit={openCase} />}
      {selected && <ConsignActionDialog key={selected.row.id + selected.action} row={selected.row} action={selected.action} onClose={() => setSelected(null)} onSubmit={completeAction} />}
    </>
  );
}
