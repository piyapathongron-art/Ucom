import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { AppToaster } from "./_components/AppToaster";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ucom POS",
  description: "ระบบขายหน้าร้าน Ucom",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<AppToaster /></body>
    </html>
  );
}
