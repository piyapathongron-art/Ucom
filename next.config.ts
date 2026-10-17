import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.UCOM_LOCAL_CASH_LAB === "1" ? ".next/cash-lab" : ".next",
};

export default nextConfig;
