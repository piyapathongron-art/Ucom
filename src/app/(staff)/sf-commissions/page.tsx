import { redirect } from "next/navigation";

// SF+ merged into the consignment page (ADR 0024); kept as a redirect so old links/bookmarks still work.
export default function SfCommissionsPage() {
  redirect("/consignments?tab=sf");
}
