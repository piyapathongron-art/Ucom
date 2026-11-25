"use client"; // Error boundaries must be Client Components

// Replaces the root layout when it fails, so globals.css and the Anuphan font are not loaded here:
// everything is inline, with the ADR 0033 colours written out.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          background: "#f3f4f8",
          color: "#111827",
          fontFamily: '"Leelawadee UI", "Noto Sans Thai", Tahoma, sans-serif',
        }}
      >
        <title>Ucom POS · เกิดข้อผิดพลาด</title>
        <main
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#ffffff",
            borderRadius: 22,
            padding: 24,
            textAlign: "center",
            boxShadow: "0 1px 2px rgb(16 24 40 / 0.04), 0 4px 16px rgb(16 24 40 / 0.06)",
          }}
        >
          <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>ระบบขัดข้องชั่วคราว</h1>
          <p style={{ fontSize: 14, color: "#4b5563", margin: "0 0 16px", lineHeight: 1.6 }}>
            ข้อมูลที่บันทึกไปแล้วไม่หาย ลองโหลดใหม่ ถ้ายังไม่ได้ให้แจ้งเจ้าของร้านพร้อมรหัสด้านล่าง
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace", margin: "0 0 16px" }}>รหัส {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              height: 44,
              padding: "0 24px",
              border: 0,
              borderRadius: 999,
              background: "#1d4ed8",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ลองอีกครั้ง
          </button>
        </main>
      </body>
    </html>
  );
}
