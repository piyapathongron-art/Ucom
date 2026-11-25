import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import { AppToaster } from "./_components/AppToaster";
import "./globals.css";

// ADR 0033: Anuphan for Thai and Latin text. It is a variable font, so no weights are listed.
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "Ucom POS",
  description: "ระบบขายหน้าร้าน Ucom",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${anuphan.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<AppToaster /></body>
    </html>
  );
}
