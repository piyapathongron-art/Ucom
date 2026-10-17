import CashContent from "./cash-content";

export default function CashPage({ searchParams }: { searchParams: Promise<{ handover?: string }> }) {
  return <CashContent searchParams={searchParams} />;
}
