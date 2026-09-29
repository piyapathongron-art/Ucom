// Placeholder rows reuse the real table grid: pass the real header via `head` and column count via `cols`.
export function SkeletonRows({ cols, rows = 5, head }: { cols: number; rows?: number; head?: React.ReactNode }) {
  return (
    <div className="ucom-table-wrap" aria-busy="true" aria-label="กำลังโหลด">
      <table className="ucom-table">
        {head}
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}><div className="h-4 animate-pulse rounded-full bg-border motion-reduce:animate-none" style={{ width: `${55 + ((r + c) % 3) * 15}%` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
