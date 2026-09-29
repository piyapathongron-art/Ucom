// rose = system failure, yellow (tone="rule") = business rule. Message must already be Thai (see lib/errors.ts).
export function ErrorPanel({ message, tone = "system", onRetry }: { message: string; tone?: "system" | "rule"; onRetry?: () => void }) {
  const cls = tone === "system" ? "border-danger/40 text-danger" : "border-warning/40 bg-warning-bg text-warning";
  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${cls}`}>
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="ucom-secondary px-4 py-1.5 text-ink">ลองใหม่</button>}
    </div>
  );
}
