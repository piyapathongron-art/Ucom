"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/app/_components/EmptyState";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { SkeletonRows } from "@/app/_components/Skeleton";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ConsignActionDialog, ConsignOpenDialog } from "./ConsignDialogs";
import { fmt, statusLabel, type Action, type ActionValues, type CaseRow, type Direction, type OpenValues } from "./consignTypes";
import { cashStatus, cashWrite, getReceivingDevice, getReceivingDeviceToken, receiptDevice } from "@/lib/cash/client";
import { GENERIC_ERROR, toThaiError } from "@/lib/errors";

// Show the real cause when we know it: a Thai RPC message (duplicate IMEI, share ≥ price, paused
// receiving) or a Thai error from the cash client (not the receiving device, an unconfirmed cash
// operation). Anything else, such as a network failure, keeps the "refresh and check" advice.
function consignError(error: unknown, fallback: string): string {
  const fromRpc = toThaiError(error);
  if (fromRpc !== GENERIC_ERROR) return fromRpc;
  if (error instanceof Error && !("code" in error) && /^[฀-๿]/.test(error.message)) return error.message;
  return fallback;
}

const PAGE_SIZE = 25;

function TableHead() {
  return <thead><tr><th scope="col">เครื่อง</th><th scope="col">คู่ค้า</th><th scope="col" className="text-right">ราคาตั้ง</th><th scope="col">สถานะ</th><th scope="col">ยอดที่เกี่ยวข้อง</th><th scope="col">จัดการ</th></tr></thead>;
}

// Status chip on the ADR 0033 text-on-tint pairs: waiting on money is amber, money done is green, open/returned is neutral.
const STATUS_TONE: Record<string, string> = {
  reported_sold: "bg-warning-bg text-warning",
  sold_unpaid: "bg-warning-bg text-warning",
  settled: "bg-success-bg text-success",
  paid: "bg-success-bg text-success",
};

// The date of the step the case is at, not the day it was opened (rollout plan, Step 1).
function stepDate(row: CaseRow): string {
  const at = { reported_sold: row.reported_at, sold_unpaid: row.sold_at, settled: row.settled_at, paid: row.paid_at, returned: row.returned_at }[row.status ?? ""] ?? null;
  const iso = at ?? row.created_at;
  if (!iso) return "";
  const day = new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
  return row.status === "placed" || !at ? `ตั้งแต่ ${day}` : day;
}

function StatusCell({ row }: { row: CaseRow }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[row.status ?? ""] ?? "bg-muted text-foreground"}`}>{statusLabel[row.status ?? ""] ?? row.status}</span>
      <span className="text-xs text-muted-foreground">{stepDate(row)}</span>
    </span>
  );
}

const FLOW: Record<Direction, string> = {
  out: "ฝากอยู่ → คู่ค้าแจ้งขาย → รับเงินเต็มยอด · คืนเครื่องได้ระหว่างที่ยังฝากอยู่ (ย้อนกลับไม่ได้)",
  in: "ฝากอยู่ → ขายหน้าร้านและรับเงินลูกค้า → จ่ายเจ้าของเครื่อง · คืนเครื่องได้ระหว่างที่ยังฝากอยู่ (ย้อนกลับไม่ได้)",
};

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
    } catch (error) {
      toast.error(consignError(error, direction === "out"
        ? "ยังยืนยันผลฝากออกไม่ได้ กรุณารีเฟรชหน้าและตรวจว่า IMEI เป็นเครื่องซื้อขาดที่มีต้นทุน"
        : "ยังยืนยันผลรับฝากไม่ได้ กรุณารีเฟรชหน้าและตรวจ IMEI ที่อาจซ้ำกัน"), { duration: Infinity });
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
      const cash = action === "return" || action === "report" ? null : await cashStatus();
      const device = cash && action !== "pay" ? receiptDevice(cash) : getReceivingDevice();
      const result = action === "return"
        ? await supabase.rpc("rpc_consignment_return", { p_id: caseId })
        : action === "report"
          ? await supabase.rpc("rpc_consignment_report_out", { p_id: caseId, p_sale_price: salePrice, p_partner_share: partnerShare })
          : action === "settle"
            ? await cashWrite(`consign_settle:${caseId}`, "consign_settle", { id: caseId, method: paymentMethod, account, device, deviceToken: getReceivingDeviceToken() }, () => supabase.rpc("rpc_consignment_settle_out", { p_id: caseId, p_payment_method: paymentMethod, p_receiving_account: account }), values.operationId)
            : action === "sell"
              ? await cashWrite(`consign_sell:${caseId}`, "consign_sell", { id: caseId, amount: values.amountText, share: values.shareText, method: paymentMethod, account, device, deviceToken: getReceivingDeviceToken() }, () => supabase.rpc("rpc_consignment_sell_in", { p_id: caseId, p_sale_price: salePrice, p_partner_share: partnerShare, p_payment_method: paymentMethod, p_receiving_account: account }), values.operationId)
              : await cashWrite(`consign_pay:${caseId}`, "consign_pay", { id: caseId, fund: values.fund }, () => supabase.rpc("rpc_consignment_pay_in", { p_id: caseId, p_payment_method: paymentMethod }), values.operationId);
      if (result.error) throw result.error;
    } catch (error) {
      toast.error(consignError(error, "ยังยืนยันผลไม่ได้ กรุณารีเฟรชสถานะก่อนลองอีกครั้ง"), { duration: Infinity });
      return false;
    }
    toast.success("บันทึกรายการฝากขายแล้ว");
    refresh();
    return true;
  }

  // Next-step buttons. Names stay as e2e finds them; return is amber because it cannot be undone.
  const actions = (row: CaseRow) => (
    <>
      {row.direction === "out" && row.status === "placed" && <Button type="button" size="sm" onClick={() => setSelected({ row, action: "report" })}>แจ้งขาย</Button>}
      {row.direction === "out" && row.status === "reported_sold" && <Button type="button" size="sm" onClick={() => setSelected({ row, action: "settle" })}>รับเงิน</Button>}
      {row.direction === "in" && row.status === "placed" && <Button type="button" size="sm" onClick={() => setSelected({ row, action: "sell" })}>ขายหน้าร้าน</Button>}
      {row.direction === "in" && row.status === "sold_unpaid" && <Button type="button" size="sm" onClick={() => setSelected({ row, action: "pay" })}>จ่ายเจ้าของ</Button>}
      {row.status === "placed" && <Button type="button" size="sm" variant="secondary" className="bg-warning-bg text-warning hover:bg-warning-bg/80" onClick={() => setSelected({ row, action: "return" })}>คืนเครื่อง</Button>}
    </>
  );
  const hasNext = page * PAGE_SIZE < total;
  return (
    <>
      {loadError && <ErrorPanel message={loadError} onRetry={refresh} />}
      {isLoading ? <SkeletonRows cols={6} head={<TableHead />} /> : rows.length > 0 ? (
        <>
          <div className="ucom-table-wrap hidden md:block">
            <table className="ucom-table">
              <TableHead />
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  <td><span className="block text-sm font-semibold">{row.model_name}</span><span className="block text-xs tabular-nums text-muted-foreground">IMEI {row.imei}</span></td>
                  <td className="text-sm">{row.counterparty_name}</td>
                  <td className="text-right text-sm font-semibold tabular-nums">{fmt(row.listed_price)}</td>
                  <td><StatusCell row={row} /></td>
                  <td className="text-sm tabular-nums text-muted-foreground">{amountNote(row)}</td>
                  <td><div className="flex flex-wrap gap-2">{actions(row)}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden" aria-label={direction === "out" ? "เครื่องฝากออก" : "เครื่องฝากเข้า"}>
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{row.model_name}</p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">IMEI {row.imei} · {row.counterparty_name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{fmt(row.listed_price)}</span>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <StatusCell row={row} />
                  <span className="text-sm tabular-nums text-muted-foreground">{amountNote(row)}</span>
                </div>
                {(row.status === "placed" || row.status === "reported_sold" || row.status === "sold_unpaid") && <div className="flex flex-wrap gap-2">{actions(row)}</div>}
              </li>
            ))}
          </ul>
        </>
      ) : !loadError && <EmptyState title={direction === "out" ? "ยังไม่มีเครื่องฝากออก" : "ยังไม่มีเครื่องฝากเข้า"} hint="กดปุ่มมุมขวาบนเพื่อเริ่มรายการแรก" />}
      {(total > 0 || page > 1) && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>หน้า {page} · {total.toLocaleString("th-TH")} รายการ</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="bg-card" disabled={page === 1} onClick={() => { setPage((value) => value - 1); setIsLoading(true); }}>ก่อนหน้า</Button>
          <Button type="button" variant="outline" size="sm" className="bg-card" disabled={!hasNext} onClick={() => { setPage((value) => value + 1); setIsLoading(true); }}>ถัดไป</Button>
        </div>
      </div>}
      <p className="rounded-xl border border-dashed border-border-strong bg-card px-4 py-3 text-sm text-muted-foreground">{FLOW[direction]}</p>
      {isOpenDialog && <ConsignOpenDialog direction={direction} onClose={onOpenDialogClose} onSubmit={openCase} />}
      {selected && <ConsignActionDialog key={selected.row.id + selected.action} row={selected.row} action={selected.action} onClose={() => setSelected(null)} onSubmit={completeAction} />}
    </>
  );
}
