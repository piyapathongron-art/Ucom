import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-8">
      <form
        action={login}
        className="w-full max-w-xs space-y-4 rounded-lg border border-neutral-200 p-6"
      >
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>

        {error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-600">
            {error === "missing"
              ? "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ"
              : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}
          </p>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            ชื่อผู้ใช้
          </label>
          <input
            id="username"
            name="username"
            required
            autoFocus
            autoComplete="username"
            className="mt-1 w-full rounded border border-neutral-300 p-2"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-neutral-300 p-2"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-neutral-900 p-2 text-white"
        >
          เข้าสู่ระบบ
        </button>
      </form>
    </main>
  );
}
