"use client";

import { useState } from "react";
import { PageFrame } from "@/app/_components/PageFrame";
import { Button } from "@/components/ui/button";
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
        <Button type="button" size="lg" onClick={() => setIsDialogOpen(true)} data-testid={tab === "sf" ? "open-sf-intake" : "open-consignment-dialog"} className="h-12 font-bold">
          {active.cta}
        </Button>
      }
    >
      <div role="tablist" aria-label="ประเภท" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            data-testid={`consignments-tab-${t.key}`}
            onClick={() => { setTab(t.key); setIsDialogOpen(false); }}
            className={`h-11 shrink-0 rounded-full px-5 text-sm font-semibold ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
