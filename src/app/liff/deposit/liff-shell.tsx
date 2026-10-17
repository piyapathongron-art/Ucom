"use client";

import Script from "next/script";
import { useRef, useState, type ReactNode } from "react";

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
    {status === "ready" ? children : <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">ฝากเงินร้าน</h1>
      <p role={status === "failed" ? "alert" : "status"}>
        {status === "pending" ? "กำลังเตรียมฟอร์มฝากเงิน…" : "เปิดฟอร์มผ่าน LINE ไม่สำเร็จ กรุณาลองใหม่หรือเปิดผ่านเว็บ"}
      </p>
      {status === "failed" && <>
        <button type="button" className="ucom-primary px-4 py-3" onClick={() => window.location.reload()}>ลองใหม่</button>
        <a className="underline" href="/cash">เปิดฟอร์มผ่านเว็บ</a>
      </>}
    </main>}
  </>;
}
