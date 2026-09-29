import { ReportClient } from "./ReportClient";

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const { view } = await searchParams;
  return <ReportClient initialView={view === "bills" ? "bills" : view === "drill" ? "drill" : "summary"} />;
}
