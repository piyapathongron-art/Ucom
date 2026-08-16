import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4 md:p-8">
      <form
        action={login}
        className="ucom-surface w-full max-w-sm space-y-5 p-5 md:p-6"
      >
        <div className="border-b border-border pb-4">
          <p className="font-mono text-xs tracking-widest text-ink-muted">UCOM POS</p>
          <h1 className="mt-1 text-2xl font-semibold">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-sm text-ink-muted">เข้าสู่ระบบเพื่อใช้งานหน้าร้าน</p>
        </div>

        {error && (
          <p className="border border-danger bg-danger/10 p-3 text-sm text-danger">
            {error === "missing"
              ? "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ"
              : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}
          </p>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-ink">
            ชื่อผู้ใช้
          </label>
          <input
            id="username"
            name="username"
            required
            autoFocus
            autoComplete="username"
            className="ucom-field mt-1 w-full px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="ucom-field mt-1 w-full px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="ucom-primary w-full px-4 py-2 text-sm"
        >
          เข้าสู่ระบบ
        </button>
      </form>
    </main>
  );
}
