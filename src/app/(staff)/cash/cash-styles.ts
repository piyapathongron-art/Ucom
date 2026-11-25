import type { CashHandover } from "@/lib/cash/types";

// ADR 0033 classes shared by the cash cards, so the owner page, the staff page and /liff/deposit match.
export const CARD = "rounded-xl bg-card p-5 shadow-card";
export const SUMMARY = "flex min-h-10 cursor-pointer items-center font-semibold";
export const TEXT_LINK = "inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-2 disabled:opacity-50";
export const SELECT = "ucom-field h-12 w-full min-w-0 px-4 text-base font-normal";
export const FIELD_LABEL = "flex flex-col gap-1.5 text-sm font-semibold";
export const FILE_INPUT = "mt-1.5 block w-full text-sm font-normal file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-4 file:font-semibold file:text-accent-foreground";
export const NOTE = "rounded-xl bg-muted px-4 py-3 text-sm";
export const ALERT = "rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger";

export const HANDOVER_CHIP: Record<CashHandover["state"], string> = {
  handed_over: "bg-warning-bg text-warning",
  reported: "bg-accent text-accent-foreground",
  confirmed: "bg-success-bg text-success",
  disputed: "bg-danger-bg text-danger",
  returned: "bg-muted text-muted-foreground",
};

export const chip = (tone: string) => `inline-flex shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${tone}`;
