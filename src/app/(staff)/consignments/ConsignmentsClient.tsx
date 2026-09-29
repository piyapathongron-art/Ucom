"use client";

import { useState } from "react";
import { PageFrame } from "@/app/_components/PageFrame";
import { SfPlusTab } from "../sf-commissions/SfPlusTab";
import { ConsignmentsTab } from "./ConsignmentsTab";

export type ConsignmentsTabKey = "out" | "in" | "sf";

const TABS: { key: ConsignmentsTabKey; label: string; cta: string }[] = [
  { key: "out", label: "ฝากออก", cta: "+ ฝากออก" },
  { key: "in", label: "ฝากเข้า", cta: "+ รับฝากเข้า" },
  { key: "sf", label: "SF+", cta: "+ รับบิล SF" },
];

// Merged page (ADR 0024): consignment out / in and SF+ share one header; the CTA follows the active tab.
export default function ConsignmentsClient({ initialTab }: { initialTab: ConsignmentsTabKey }) {
  const [tab, setTab] = useState<ConsignmentsTabKey>(initialTab);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <PageFrame
      page="consignments"
      title="ฝากขาย & SF+"
      description="ติดตามเครื่องฝากออก ฝากเข้า และบิล SF+ แยกการส่งเครื่อง การขาย และการรับ–จ่ายเงิน"
      actions={
        <button type="button" onClick={() => setIsDialogOpen(true)} data-testid={tab === "sf" ? "open-sf-intake" : "open-consignment-dialog"} className="ucom-primary px-[18px] py-2.5">
          {active.cta}
        </button>
      }
    >
      <div role="tablist" aria-label="ประเภท" className="flex gap-1 self-start rounded-full bg-sunken p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            data-testid={`consignments-tab-${t.key}`}
            onClick={() => { setTab(t.key); setIsDialogOpen(false); }}
            className={`rounded-full px-5 py-1.5 text-sm ${tab === t.key ? "bg-brand-ink font-semibold text-white" : "text-ink-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "sf"
        ? <SfPlusTab isCreateOpen={isDialogOpen} onCreateClose={() => setIsDialogOpen(false)} />
        : <ConsignmentsTab key={tab} direction={tab} isOpenDialog={isDialogOpen} onOpenDialogClose={() => setIsDialogOpen(false)} />}
    </PageFrame>
  );
}
