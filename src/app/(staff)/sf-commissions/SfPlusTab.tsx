"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { SkeletonRows } from "@/app/_components/Skeleton";
import { toThaiError } from "@/lib/errors";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import type { Tables } from "@/lib/types/database";
import { PendingList } from "./PendingList";
import { ReceiptsList } from "./ReceiptsList";
import { useSfCommissions } from "./useSfCommissions";
import { useSfDue } from "./useSfDue";
import { SfDueList } from "./SfDueList";
import { SfIntakeDialog, type SfDialogMode } from "./SfIntakeDialog";
import { todayInBangkok, fmtMoney, formatDate } from "./utils";

type PendingRow = Tables<"v_sf_pending">;
type ReceiptRow = Tables<"v_sf_receipts">;

type SubTab = "due" | "pending" | "receipts";

// SF+ tab of the merged consignment page. The CTA (รับบิล SF) lives in the page header, so the parent
// passes `isCreateOpen`; after a save we jump to บิลค้าง and highlight the new bill.
export function SfPlusTab({ isCreateOpen, onCreateClose }: { isCreateOpen: boolean; onCreateClose: () => void }) {
  const supabase = createClient();

  const [isOwner, setIsOwner] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);
  const [tab, setTab] = useState<SubTab>("due");
  const [editId, setEditId] = useState<string | null>(null);
  const [highlightOrderNo, setHighlightOrderNo] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const deferredPendingSearch = useDeferredValue(pendingSearch);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [receiptsSearch, setReceiptsSearch] = useState("");
  const deferredReceiptsSearch = useDeferredValue(receiptsSearch);
  const [receiptsPage, setReceiptsPage] = useState(1);
  const [receiptsPageSize, setReceiptsPageSize] = useState(20);
  const [receiptsTotal, setReceiptsTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const fetchData = async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const pendingRange = pageRange(pendingPage, pendingPageSize);
      const receiptsRange = pageRange(receiptsPage, receiptsPageSize);
      let pendingQuery = supabase.from("v_sf_pending").select("*", { count: "exact" });
      const pendingFilter = orIlike(["imei", "model_name"], deferredPendingSearch);
      if (pendingFilter) pendingQuery = pendingQuery.or(pendingFilter);
      let receiptsQuery = supabase.from("v_sf_receipts").select("*", { count: "exact" });
      const receiptsFilter = orIlike(["imei", "model_name"], deferredReceiptsSearch);
      if (receiptsFilter) receiptsQuery = receiptsQuery.or(receiptsFilter);
      const [rPending, rReceipts] = await Promise.all([
        pendingQuery
          .order("financed_at", { ascending: false })
          .order("device_unit_id", { ascending: true })
          .range(pendingRange.from, pendingRange.to),
        receiptsQuery
          .order("received_on", { ascending: false })
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: false })
          .range(receiptsRange.from, receiptsRange.to),
      ]);
      if (rPending.error) throw rPending.error;
      if (rReceipts.error) throw rReceipts.error;
      if (requestId !== requestRef.current) return;
      const nextPending = rPending.data ?? [];
      const nextReceipts = rReceipts.data ?? [];
      const nextPendingTotal = rPending.count ?? nextPending.length;
      const nextReceiptsTotal = rReceipts.count ?? nextReceipts.length;
      if (nextPending.length === 0 && nextPendingTotal > 0 && pendingPage > 1) setPendingPage((c) => Math.max(1, c - 1));
      else setPending(nextPending);
      if (nextReceipts.length === 0 && nextReceiptsTotal > 0 && receiptsPage > 1) setReceiptsPage((c) => Math.max(1, c - 1));
      else setReceipts(nextReceipts);
      setPendingTotal(nextPendingTotal);
      setReceiptsTotal(nextReceiptsTotal);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(toThaiError(err));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  };

  const {
    recordingId, setRecordingId,
    recordAmount, setRecordAmount,
    recordDate, setRecordDate,
    recordSubmitting,
    recordError, setRecordError,
    handleRecord,
    correctingId, setCorrectingId,
    correctAmount, setCorrectAmount,
    correctDate, setCorrectDate,
    correctReason, setCorrectReason,
    correctSubmitting,
    correctError, setCorrectError,
    handleCorrect,
  } = useSfCommissions(fetchData);

  const {
    dueList,
    devicesByOrder,
    isLoading: dueIsLoading,
    error: dueError,
    setError: setDueError,
    loadDueList,
    loadDevicesForOrder,
    createOrder,
    saveOrder,
    deleteOrder,
  } = useSfDue(fetchData);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            setIsOwner(data?.role === "owner");
            setRoleResolved(true);
          });
      } else {
        setRoleResolved(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage, pendingPageSize, deferredPendingSearch, receiptsPage, receiptsPageSize, deferredReceiptsSearch]);

  useEffect(() => {
    Promise.resolve().then(() => loadDueList());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nDue = dueList.filter((o) => (o.unfinanced_count ?? 0) > 0).length;
  const editOrder = editId ? dueList.find((o) => o.sf_order_id === editId) : undefined;
  const dialogMode: SfDialogMode | null = isCreateOpen
    ? { type: "create" }
    : editOrder && devicesByOrder[editOrder.sf_order_id!]
      ? { type: "edit", order: editOrder, devices: devicesByOrder[editOrder.sf_order_id!] }
      : null;

  function openEdit(orderId: string) {
    setEditId(orderId);
    if (!devicesByOrder[orderId]) void loadDevicesForOrder(orderId);
  }

  async function onCreate(payload: Parameters<typeof createOrder>[0]) {
    const ok = await createOrder(payload);
    if (ok) {
      setTab("due");
      setHighlightOrderNo(payload.order_no);
    }
    return ok;
  }

  const subTabs: [SubTab, string][] = [["due", `บิลค้าง (${nDue})`], ["pending", "รอค่าคอม"], ["receipts", "ยืนยันแล้ว"]];

  return (
    <>
      <div role="tablist" className="flex flex-wrap gap-2">
        {subTabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            data-testid={`sf-tab-${key}`}
            onClick={() => { setTab(key); setHighlightOrderNo(null); }}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-brand-ink font-semibold text-white" : "ucom-field border-dashed text-ink-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorPanel message={error} onRetry={() => void fetchData()} />}

      {(isLoading || dueIsLoading) && tab !== "due" && <SkeletonRows cols={5} />}

      {tab === "due" && (
        dueIsLoading && dueList.length === 0
          ? <SkeletonRows cols={5} />
          : <>
              {dueError && <ErrorPanel message={dueError} onRetry={() => { setDueError(null); void loadDueList(); }} />}
              <SfDueList dueList={dueList} highlightOrderNo={highlightOrderNo} onEdit={openEdit} deleteOrder={deleteOrder} />
            </>
      )}

      {tab === "pending" && (
        <PendingList
          pending={pending}
          search={pendingSearch}
          onSearchChange={(value) => {
            setPendingSearch(value);
            setPendingPage(1);
          }}
          page={pendingPage}
          pageSize={pendingPageSize}
          total={pendingTotal}
          isLoading={isLoading}
          onPageChange={setPendingPage}
          onPageSizeChange={(value) => {
            setPendingPageSize(value);
            setPendingPage(1);
          }}
          recordingId={recordingId}
          recordAmount={recordAmount}
          recordDate={recordDate}
          recordSubmitting={recordSubmitting}
          recordError={recordError}
          onOpen={(id) => { setRecordingId(id); setRecordAmount(""); setRecordDate(todayInBangkok()); setRecordError(null); }}
          onCancel={() => { setRecordingId(null); setRecordError(null); }}
          onAmountChange={setRecordAmount}
          onDateChange={setRecordDate}
          onSubmit={handleRecord}
          formatDate={formatDate}
          todayInBangkok={todayInBangkok}
        />
      )}

      {tab === "receipts" && (
        <ReceiptsList
          receipts={receipts}
          search={receiptsSearch}
          onSearchChange={(value) => {
            setReceiptsSearch(value);
            setReceiptsPage(1);
          }}
          page={receiptsPage}
          pageSize={receiptsPageSize}
          total={receiptsTotal}
          isLoading={isLoading}
          onPageChange={setReceiptsPage}
          onPageSizeChange={(value) => {
            setReceiptsPageSize(value);
            setReceiptsPage(1);
          }}
          isOwner={isOwner}
          roleResolved={roleResolved}
          correctingId={correctingId}
          correctAmount={correctAmount}
          correctDate={correctDate}
          correctReason={correctReason}
          correctSubmitting={correctSubmitting}
          correctError={correctError}
          onOpen={(r) => { setCorrectingId(r.device_unit_id ?? null); setCorrectAmount(String(r.amount ?? "")); setCorrectDate(r.received_on ?? todayInBangkok()); setCorrectReason(""); setCorrectError(null); }}
          onCancel={() => { setCorrectingId(null); setCorrectError(null); }}
          onAmountChange={setCorrectAmount}
          onDateChange={setCorrectDate}
          onReasonChange={setCorrectReason}
          onSubmit={handleCorrect}
          formatDate={formatDate}
          fmtMoney={fmtMoney}
          todayInBangkok={todayInBangkok}
        />
      )}
      {dialogMode && (
        <SfIntakeDialog
          key={dialogMode.type + (editId ?? "")}
          mode={dialogMode}
          onClose={() => { onCreateClose(); setEditId(null); }}
          onCreate={onCreate}
          onEdit={saveOrder}
        />
      )}
    </>
  );
}
