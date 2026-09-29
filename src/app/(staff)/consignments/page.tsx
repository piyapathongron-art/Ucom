import ConsignmentsClient from "./ConsignmentsClient";

export default async function ConsignmentsPage({ searchParams }: PageProps<"/consignments">) {
  const { tab } = await searchParams;
  return <ConsignmentsClient initialTab={tab === "sf" ? "sf" : tab === "in" ? "in" : "out"} />;
}
