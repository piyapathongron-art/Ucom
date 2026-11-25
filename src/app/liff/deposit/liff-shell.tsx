"use client";

import Script from "next/script";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    liff?: { init: (config: { liffId: string; withLoginOnExternalBrowser: boolean }) => Promise<void> };
  }
}

export default function LiffShell({ liffId, sdkUrl, children }: {
  liffId: string | null; sdkUrl: string; children: ReactNode;
}) {
  const [status, setStatus] = useState<"pending" | "ready" | "failed">(liffId ? "pending" : "failed");
  const hasStarted = useRef(false);
  function initialize() {
    if (hasStarted.current) return;
    hasStarted.current = true;
    // Keep the original query (including liff.state) intact until the SDK resolves.
    Promise.resolve().then(() => {
      if (!liffId || !window.liff) throw new Error("LIFF unavailable");
      return window.liff.init({ liffId, withLoginOnExternalBrowser: false });
    }).then(() => setStatus("ready"), () => setStatus("failed"));
  }
  return <>
    {liffId && <Script src={sdkUrl} onReady={initialize} onError={() => setStatus("failed")} />}
    {status === "ready" ? children : <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">ฝากเงินร้าน</h1>
      {status === "pending" ? <div role="status" className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 text-center shadow-card">
        <span aria-hidden="true" className="size-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" />
        <p className="font-semibold">กำลังเตรียมฟอร์มฝากเงิน…</p>
      </div> : <div role="alert" className="space-y-3 rounded-xl bg-danger-bg p-5 text-danger">
        <p className="text-sm font-semibold">เปิดฟอร์มผ่าน LINE ไม่สำเร็จ กรุณาลองใหม่หรือเปิดผ่านเว็บ</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-12 font-bold" onClick={() => window.location.reload()}>ลองใหม่</Button>
          <Button asChild variant="outline" className="h-12 bg-card font-semibold"><a href="/cash">เปิดฟอร์มผ่านเว็บ</a></Button>
        </div>
      </div>}
      <p className="text-center text-sm text-muted-foreground">ถ้ายังไม่ได้เข้าสู่ระบบ จะขึ้นหน้าเข้าสู่ระบบด้วยชื่อผู้ใช้ร้านก่อน</p>
    </main>}
  </>;
}
