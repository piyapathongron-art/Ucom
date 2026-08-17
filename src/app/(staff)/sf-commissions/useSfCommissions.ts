import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayInBangkok } from "./utils";

export function useSfCommissions(onSuccess: () => Promise<void>) {
  const supabase = createClient();

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordAmount, setRecordAmount] = useState("");
  const [recordDate, setRecordDate] = useState(() => todayInBangkok());
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctAmount, setCorrectAmount] = useState("");
  const [correctDate, setCorrectDate] = useState(() => todayInBangkok());
  const [correctReason, setCorrectReason] = useState("");
  const [correctSubmitting, setCorrectSubmitting] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);

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
      await onSuccess();
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
      await onSuccess();
    } catch (err) {
      setCorrectError(err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setCorrectSubmitting(false);
    }
  };

  return {
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
  };
}
