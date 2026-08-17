"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame } from "@/app/_components/PageFrame";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import type { Tables } from "@/lib/types/database";
import { PendingList } from "./PendingList";
import { ReceiptsList } from "./ReceiptsList";
import { useSfCommissions } from "./useSfCommissions";
import { useSfDue } from "./useSfDue";
import { SfDueList } from "./SfDueList";
import { todayInBangkok, fmtMoney, formatDate } from "./utils";

type PendingRow = Tables<"v_sf_pending">;
type ReceiptRow = Tables<"v_sf_receipts">;

export default function SfCommissionsPage() {
  const supabase = createClient();

  const [isOwner, setIsOwner] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);
  const [tab, setTab] = useState<"due" | "pending" | "receipts">("due");

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
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
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

  return (
    <PageFrame
      page="sf-commissions"
      eyebrow="SF+ / COMMISSION LEDGER"
      title="ค่าคอม SF+"
      description="บันทึกยอดที่รับเงินจริง และตรวจสอบรายการยืนยันแล้ว"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">RECEIPT LEDGER</span>}
    >
      <div role="tablist" className="mb-4 flex items-center gap-4 border-b border-border">
        {(
          [
            ["due", `บิล SF ค้าง (${nDue})`],
            ["pending", "รอบันทึกค่าคอม"],
            ["receipts", "ยืนยันแล้ว"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            data-testid={`sf-tab-${key}`}
            onClick={() => setTab(key)}
            className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:border-border hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          data-testid="sf-commissions-error"
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-danger bg-danger/10 p-4 text-sm text-danger mb-4"
        >
          <span>{error}</span>
          <button type="button" onClick={() => void fetchData()} className="ucom-danger px-3 py-1.5 text-sm">
            ลองใหม่
          </button>
        </div>
      )}

      {(isLoading || dueIsLoading) && <div className="text-ink-muted mb-4">กำลังโหลด...</div>}

      {tab === "due" && (
        <SfDueList
          dueList={dueList}
          devicesByOrder={devicesByOrder}
          loadDevicesForOrder={loadDevicesForOrder}
          saveOrder={saveOrder}
          deleteOrder={deleteOrder}
          error={dueError}
          setError={setDueError}
        />
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
    </PageFrame>
  );
}
