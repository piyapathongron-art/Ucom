import Link from "next/link";
import { Button } from "@/components/ui/button";

// Root not-found also handles every unmatched URL in the app.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-card p-6 text-center shadow-card">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold text-foreground">ไม่พบหน้านี้</h1>
        <p className="text-sm text-muted-foreground">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/pos">กลับหน้าขาย</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
