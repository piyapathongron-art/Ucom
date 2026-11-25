"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { Button } from "@/components/ui/button";

// Next 16: `retry()` re-fetches and re-renders the failed segment (prefer it over `reset()`).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-card p-6 text-center shadow-card">
        <h1 className="text-xl font-semibold text-foreground">หน้านี้โหลดไม่สำเร็จ</h1>
        <p className="text-sm text-muted-foreground">
          ข้อมูลที่บันทึกไปแล้วไม่หาย ลองโหลดใหม่อีกครั้ง ถ้ายังไม่ได้ให้ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วแจ้งเจ้าของร้านพร้อมรหัสด้านล่าง
        </p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">รหัส {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>ลองอีกครั้ง</Button>
          <Button variant="outline" asChild>
            <Link href="/pos">กลับหน้าขาย</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
