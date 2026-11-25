import { login } from "./actions";
import { SubmitButton } from "./submit-button";
import { safeReturnPath } from "@/lib/safe-return";

const field = "h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export default async function LoginForm({
  searchParams,
  appearance = "default",
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
  appearance?: "default" | "phone";
}) {
  const { error, next } = await searchParams;
  const isPhone = appearance === "phone";

  const form = (
    <form action={login} className="flex w-full max-w-sm flex-col gap-5 rounded-xl bg-card p-7 shadow-card">
      <input type="hidden" name="next" value={safeReturnPath(next)} />
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-11 place-items-center rounded-md bg-primary text-lg font-bold text-primary-foreground">U</span>
        <h1 className="text-xl font-bold text-foreground">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted-foreground">ใช้ชื่อผู้ใช้ที่เจ้าของร้านตั้งให้</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
          {error === "missing" ? "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ" : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ลองอีกครั้ง"}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-semibold text-foreground">ชื่อผู้ใช้</label>
        <input id="username" name="username" required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="เช่น somchai.staff" className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-foreground">รหัสผ่าน</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-muted-foreground">ลืมรหัสผ่าน ติดต่อเจ้าของร้านเพื่อตั้งใหม่ให้</p>
    </form>
  );

  // The LIFF deposit page reuses the form inside LINE: card only, no brand panel.
  if (isPhone) return <main className="flex min-h-full flex-1 items-center justify-center bg-background p-4">{form}</main>;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background p-4 lg:p-8">
      <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
        <section className="hidden flex-col gap-5 lg:flex" aria-label="เกี่ยวกับระบบ">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-md bg-primary text-xl font-bold text-primary-foreground">U</span>
            <span className="text-2xl font-bold text-foreground">Ucom POS</span>
          </div>
          <h2 className="text-3xl leading-tight font-bold text-balance text-foreground">ขาย ซ่อม ปิดร้าน ครบในที่เดียว</h2>
          <p className="max-w-md text-base leading-7 text-muted-foreground">ระบบหน้าร้านสำหรับพนักงานและเจ้าของร้าน ใช้ได้ทั้งคอมพิวเตอร์ แท็บเล็ต และมือถือ</p>
          <ul className="flex flex-wrap gap-2 text-sm font-semibold">
            <li className="rounded-full bg-accent px-3.5 py-1.5 text-accent-foreground">นับเงินปิดร้านแบบไม่เห็นยอด</li>
            <li className="rounded-full bg-accent px-3.5 py-1.5 text-accent-foreground">สรุปยอดส่ง LINE</li>
          </ul>
        </section>
        <div className="flex justify-center lg:justify-end">{form}</div>
      </div>
    </main>
  );
}
