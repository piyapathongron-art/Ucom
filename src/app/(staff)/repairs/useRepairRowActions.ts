import { useState } from "react";
import { REPAIR_STEPS, type PartPaidFrom, type RepairRow } from "./types";

export function useRepairRowActions({
  row,
  onSetStatus,
  onSetPartCost,
}: {
  row: RepairRow;
  onSetStatus: (id: string, status: string) => Promise<void>;
  onSetPartCost: (id: string, cost: number, paidFrom: PartPaidFrom) => Promise<boolean>;
}) {
  const [partCostDraft, setPartCostDraft] = useState("");
  const [partPaidFrom, setPartPaidFrom] = useState<PartPaidFrom | "">("");
  const [isEditingPartCost, setIsEditingPartCost] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [savingPartCost, setSavingPartCost] = useState(false);
  const [settingStatus, setSettingStatus] = useState(false);
  const canSavePartCost = !!partPaidFrom && /^\d+(\.\d{1,2})?$/.test(partCostDraft) && Number.isFinite(Number(partCostDraft));

  const receivedAtStr = new Date(row.received_at).toLocaleDateString("th-TH", {
    dateStyle: "short",
  });

  const currentStepIndex = (REPAIR_STEPS as readonly string[]).indexOf(row.status);
  const isInSteps = currentStepIndex !== -1;
  const nextStep =
    isInSteps && currentStepIndex < REPAIR_STEPS.length - 1
      ? REPAIR_STEPS[currentStepIndex + 1]
      : null;
  const prevStep =
    isInSteps && currentStepIndex > 0 ? REPAIR_STEPS[currentStepIndex - 1] : null;

  async function handleSetStatus(target: string) {
    setSettingStatus(true);
    await onSetStatus(row.id, target);
    setSettingStatus(false);
  }

  async function handleSavePartCost() {
    if (!canSavePartCost || !partPaidFrom) return;
    setSavingPartCost(true);
    if (await onSetPartCost(row.id, Number(partCostDraft), partPaidFrom)) {
      setPartCostDraft("");
      setPartPaidFrom("");
      setIsEditingPartCost(false);
    }
    setSavingPartCost(false);
  }

  return {
    partCostDraft,
    setPartCostDraft,
    partPaidFrom,
    setPartPaidFrom,
    isEditingPartCost,
    setIsEditingPartCost,
    showAbandonConfirm,
    setShowAbandonConfirm,
    showCloseDialog,
    setShowCloseDialog,
    savingPartCost,
    canSavePartCost,
    settingStatus,
    receivedAtStr,
    currentStepIndex,
    isInSteps,
    nextStep,
    prevStep,
    handleSetStatus,
    handleSavePartCost,
  };
}
