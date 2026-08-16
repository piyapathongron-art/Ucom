import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <form
        action={login}
        className="ucom-surface flex w-full max-w-sm flex-col gap-5 p-8"
      >
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[0.7rem] bg-ink font-mono text-lg font-bold text-background">
            U
          </div>
          <h1 className="text-[17px] font-bold">เข้าสู่ระบบ Ucom</h1>
          <p className="text-xs text-ink-muted">ระบบขายหน้าร้าน</p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-xs font-semibold text-warning md:hidden">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path d="M3 8.5c2.5-2.2 5.6-3.5 9-3.5s6.5 1.3 9 3.5M6 12c1.8-1.5 3.9-2.3 6-2.3s4.2.8 6 2.3M9.3 15.3c.8-.6 1.7-1 2.7-1s1.9.4 2.7 1M12 18.5h.01" />
            <line x1="3" y1="3" x2="21" y2="21" />
          </svg>
          เพื่อประสบการณ์ที่ดีที่สุด แนะนำให้ใช้แท็บเล็ตหรือเดสก์ท็อป
        </div>

        {error && (
          <p className="border border-danger bg-danger/10 p-3 text-sm text-danger">
            {error === "missing"
              ? "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ"
              : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-xs font-semibold text-ink-muted">
            ชื่อผู้ใช้
          </label>
          <input
            id="username"
            name="username"
            required
            autoFocus
            autoComplete="username"
            placeholder="เช่น somchai.staff"
            className="ucom-field px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-ink-muted">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="ucom-field px-3.5 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          className="ucom-primary mt-1 w-full justify-center px-4 py-3 text-sm"
        >
          เข้าสู่ระบบ
        </button>

        <p className="text-center text-[11.5px] text-ink-muted">
          ลืมรหัสผ่าน ติดต่อเจ้าของร้านเพื่อรีเซ็ตให้
        </p>
      </form>
    </main>
  );
}
