"use client";

import { useEffect, useState } from "react";
import { cashStatus } from "./client";
import type { CashStatus } from "./types";
let pendingStatus: Promise<CashStatus> | null = null;

export function useCashStatus() {
  const [status, setStatus] = useState<CashStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    pendingStatus ??= cashStatus().finally(() => { pendingStatus = null; });
    pendingStatus.then((value) => { if (isCurrent) { setStatus(value); setError(null); } })
      .catch(() => { if (isCurrent) setError("ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อและโหลดหน้าใหม่"); });
    return () => { isCurrent = false; };
  }, []);
  return { status, error, isReady: status !== null, isActive: Boolean(status?.epoch) };
}
