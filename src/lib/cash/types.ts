import type { DigestData } from "@/lib/line/digestFlex";

export type CashFund = "drawer" | "pending";
export type CashPaymentFund = CashFund | "transfer";
export type CashSnapshot = {
  id: string; date?: string; revision?: number; event?: string; asOf: string; version: number;
  drawer: string; pending: string; reserved: string; available: string;
  drawerCount?: string; pendingCount?: string; drawerVariance?: string; pendingVariance?: string;
  daily?: DigestData | null;
  deposit?: { bank: string; drawer: string; returned: string; custodian: string; depositedAt: string };
};
export type CashHandover = {
  id: string; amount: string; custodian: string;
  state: "handed_over" | "reported" | "confirmed" | "disputed" | "returned";
  createdAt: string; bank: string | null; drawer: string | null; returned: string | null;
  depositedAt: string | null; evidencePath: string | null; reviewNote: string | null;
  snapshot: CashSnapshot | null;
};
export type CashMovement = {
  id: string; operationId: string; fund: CashFund; amount: string;
  sourceOperationId?: string | null;
  kind: string; reason: string | null; createdAt: string;
};
export type CashSource = { id: string; table: "sales" | "expenses" | "shop_income" | "repair_jobs" | "consignments"; operationId: string; label: string; amount: string; fund: CashPaymentFund; movedAt: string };
export type CashStatus = {
  epoch: string | null; version: number; drawer: string; pending: string;
  reserved: string; available: string; asOf: string; isOwner: boolean;
  receivingDevice: string | null; ackVersion: number | null;
  ackAt: string | null;
  isReceivingPaused: boolean;
  activationReady: boolean;
  openedAt: string | null;
  reminder?: { enabled: boolean; weekday: number; time: string; minimum: string; overdueHours: number };
  handovers: CashHandover[]; closings: CashSnapshot[]; movements: CashMovement[];
  sources?: CashSource[];
};
export type CashExecuteResult = { id: string; snapshot?: CashSnapshot | null };
