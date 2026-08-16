"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame } from "@/app/_components/PageFrame";
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setIsLoading(true);
    setError(null);
    try {
      const [rPending, rReceipts] = await Promise.all([
        supabase.from("v_sf_pending").select("*").order("financed_at", { ascending: false }),
        supabase.from("v_sf_receipts").select("*").order("received_on", { ascending: false }),
      ]);
      if (rPending.error) throw rPending.error;
      if (rReceipts.error) throw rReceipts.error;
      setPending(rPending.data ?? []);
      setReceipts(rReceipts.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // hop off the effect body before touching state — matches PosPage pattern
    Promise.resolve().then(() => fetchData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          className="rounded border border-danger bg-danger/10 p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-muted">กำลังโหลด...</div>
      ) : (
        <>
          <PendingList
            pending={pending}
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
