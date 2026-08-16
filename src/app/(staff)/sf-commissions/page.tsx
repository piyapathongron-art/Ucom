"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame } from "@/app/_components/PageFrame";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import type { Tables } from "@/lib/types/database";
import { PendingList } from "./PendingList";
import { ReceiptsList } from "./ReceiptsList";

type PendingRow = Tables<"v_sf_pending">;
type ReceiptRow = Tables<"v_sf_receipts">;

function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default function SfCommissionsPage() {
  const supabase = createClient();

  const [isOwner, setIsOwner] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);

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

  // Record form state (per pending device)
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordAmount, setRecordAmount] = useState("");
  const [recordDate, setRecordDate] = useState(() => todayInBangkok());
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Correction form state (owner only, per receipt device_unit_id)
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctAmount, setCorrectAmount] = useState("");
  const [correctDate, setCorrectDate] = useState(() => todayInBangkok());
  const [correctReason, setCorrectReason] = useState("");
  const [correctSubmitting, setCorrectSubmitting] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);

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

  const fetchData = async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const pendingRange = pageRange(pendingPage, pendingPageSize);
      const receiptsRange = pageRange(receiptsPage, receiptsPageSize);
      let pendingQuery = supabase
        .from("v_sf_pending")
        .select("*", { count: "exact" });
      const pendingFilter = orIlike(["imei", "model_name"], deferredPendingSearch);
      if (pendingFilter) pendingQuery = pendingQuery.or(pendingFilter);
      let receiptsQuery = supabase
        .from("v_sf_receipts")
        .select("*", { count: "exact" });
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
      if (nextPending.length === 0 && nextPendingTotal > 0 && pendingPage > 1) {
        setPendingPage((current) => Math.max(1, current - 1));
      } else {
        setPending(nextPending);
      }
      if (nextReceipts.length === 0 && nextReceiptsTotal > 0 && receiptsPage > 1) {
        setReceiptsPage((current) => Math.max(1, current - 1));
      } else {
        setReceipts(nextReceipts);
      }
      setPendingTotal(nextPendingTotal);
      setReceiptsTotal(nextReceiptsTotal);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    // hop off the effect body before touching state — matches PosPage pattern
    Promise.resolve().then(() => fetchData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage, pendingPageSize, deferredPendingSearch, receiptsPage, receiptsPageSize, deferredReceiptsSearch]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingId) return;
    setRecordError(null);
    const amountNum = parseFloat(recordAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setRecordError("ยอดต้องไม่ติดลบ");
      return;
    }
    if (!recordDate) {
      setRecordError("กรุณาระบุวันที่รับเงิน");
      return;
    }
    setRecordSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_record_sf_commission", {
        p_device_unit_id: recordingId,
        p_amount: amountNum,
        p_received_on: recordDate,
      });
      if (rpcErr) {
        setRecordError(rpcErr.message);
        return;
      }
      setRecordingId(null);
      setRecordAmount("");
      setRecordDate(todayInBangkok());
      await fetchData();
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setRecordSubmitting(false);
    }
  };

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingId) return;
    setCorrectError(null);
    if (!correctReason.trim()) {
      setCorrectError("ต้องระบุเหตุผลในการแก้ไข");
      return;
    }
    const amountNum = parseFloat(correctAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setCorrectError("ยอดต้องไม่ติดลบ");
      return;
    }
    if (!correctDate) {
      setCorrectError("กรุณาระบุวันที่รับเงิน");
      return;
    }
    setCorrectSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_correct_sf_commission", {
        p_device_unit_id: correctingId,
        p_void_reason: correctReason.trim(),
        p_amount: amountNum,
        p_received_on: correctDate,
      });
      if (rpcErr) {
        setCorrectError(rpcErr.message);
        return;
      }
      setCorrectingId(null);
      setCorrectAmount("");
      setCorrectDate(todayInBangkok());
      setCorrectReason("");
      await fetchData();
    } catch (err) {
      setCorrectError(err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setCorrectSubmitting(false);
    }
  };

  return (
    <PageFrame
      page="sf-commissions"
      eyebrow="SF+ / COMMISSION LEDGER"
      title="ค่าคอม SF+"
      description="บันทึกยอดที่รับเงินจริง และตรวจสอบรายการยืนยันแล้ว"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">RECEIPT LEDGER</span>}
    >

      {error && (
        <div
          data-testid="sf-commissions-error"
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-danger bg-danger/10 p-4 text-sm text-danger"
        >
          <span>{error}</span>
          <button type="button" onClick={() => void fetchData()} className="ucom-danger px-3 py-1.5 text-sm">
            ลองใหม่
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-muted">กำลังโหลด...</div>
      ) : (
        <>
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
            onOpen={(deviceUnitId) => {
              setRecordingId(deviceUnitId);
              setRecordAmount("");
              setRecordDate(todayInBangkok());
              setRecordError(null);
            }}
            onCancel={() => {
              setRecordingId(null);
              setRecordError(null);
            }}
            onAmountChange={setRecordAmount}
            onDateChange={setRecordDate}
            onSubmit={handleRecord}
            formatDate={formatDate}
            todayInBangkok={todayInBangkok}
          />

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
            onOpen={(row) => {
              setCorrectingId(row.device_unit_id ?? null);
              setCorrectAmount(String(row.amount ?? ""));
              setCorrectDate(row.received_on ?? todayInBangkok());
              setCorrectReason("");
              setCorrectError(null);
            }}
            onCancel={() => {
              setCorrectingId(null);
              setCorrectError(null);
            }}
            onAmountChange={setCorrectAmount}
            onDateChange={setCorrectDate}
            onReasonChange={setCorrectReason}
            onSubmit={handleCorrect}
            formatDate={formatDate}
            fmtMoney={fmtMoney}
            todayInBangkok={todayInBangkok}
          />
        </>
      )}
    </PageFrame>
  );
}
