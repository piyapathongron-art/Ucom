"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageFrame, PageSection } from "@/app/_components/PageFrame";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { WalletFundDialog } from "./WalletFundDialog";
import { HISTORY_PAGE_SIZE, TopupHistory } from "./TopupHistory";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";
import { withReceivingIntake } from "@/lib/cash/client";
import { prepareReceipt, sendReceipt } from "@/lib/cash/receipt";

type Wallet = Tables<"v_pos_topup_wallet_balance">;
type TopupSale = Tables<"v_pos_topup_history">;

const fail = (message: string) => toast.error(message, { duration: Infinity });

const PAYMENT_METHODS = [["cash", "เงินสด"], ["transfer", "โอน"]] as const;

const payOption = (isActive: boolean) =>
  `h-11 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
  }`;

export default function TopupPage() {
  const supabase = createClient();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [history, setHistory] = useState<TopupSale[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [isOwner, setIsOwner] = useState(false);
  const [carrierRates, setCarrierRates] = useState<Record<string, number>>({});
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [amount, setAmount] = useState("");
  const [openingAmounts, setOpeningAmounts] = useState<Record<string, string>>({});
  const [openingCarrier, setOpeningCarrier] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [receivingAccount, setReceivingAccount] = useState("");
  const [clientUuid, setClientUuid] = useState(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [pendingOpening, setPendingOpening] = useState<{ carrierId: string; value: number } | null>(null);

  async function loadPage(page = historyPage) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("not authenticated");
    const [profileResult, walletResult, historyResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", auth.user.id).single(),
      supabase.from("v_pos_topup_wallet_balance").select("*").order("name"),
      supabase.from("v_pos_topup_history")
        .select("*", { count: "exact" })
        .order("sold_at", { ascending: false })
        .order("sale_item_id", { ascending: false })
        .range((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE - 1),
    ]);
    if (profileResult.error || walletResult.error || historyResult.error) {
      throw new Error("top-up data unavailable");
    }
    const nextWallets = walletResult.data ?? [];
    const owner = profileResult.data.role === "owner";
    setIsOwner(owner);
    if (owner) {
      const { data: carriers, error: carrierError } = await supabase.from("topup_carriers")
        .select("id, commission_rate");
      if (carrierError) throw new Error("top-up rates unavailable");
      setCarrierRates(Object.fromEntries((carriers ?? []).map((carrier) => [carrier.id, carrier.commission_rate])));
    }
    setWallets(nextWallets);
    setSelectedCarrier((current) => current || nextWallets[0]?.carrier_id || "");
    setHistory(historyResult.data ?? []);
    setHistoryTotal(historyResult.count ?? 0);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => loadPage(historyPage))
      .catch(() => setLoadError("โหลดข้อมูลเติมเงินไม่สำเร็จ กรุณาลองใหม่หลังเปิดใช้งานฐานข้อมูลรุ่นล่าสุด"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage]);

  async function submitTopup() {
    if (!currentWallet?.is_initialized) {
      fail("ยังไม่ตั้งยอดวอลเล็ตค่ายนี้ กรุณาให้เจ้าของร้านตั้งยอดก่อนขาย");
      return;
    }
    const value = Number(amount);
    if (!selectedCarrier || !Number.isFinite(value) || value <= 0 || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      fail("กรุณาเลือกค่ายและกรอกยอดเติมเงินมากกว่า 0 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
      return;
    }
    setIsSubmitting(true);
    let saleError: { message: string } | null;
    try {
      const result = await withReceivingIntake(async status => {
        const payload = prepareReceipt({
          client_uuid: clientUuid,
          sold_at: new Date().toISOString(),
          payment_method: paymentMethod,
          receiving_account: paymentMethod === "transfer" ? receivingAccount || null : null,
          bill_discount: 0,
          items: [{ kind: "topup", topup_carrier_id: selectedCarrier, unit_price: amount }],
        }, status);
        return sendReceipt(payload);
      });
      saleError = result.error;
    } catch (error) {
      fail(error instanceof Error ? error.message : "ยังยืนยันผลการขายไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองบิลเดิมอีกครั้ง");
      setIsSubmitting(false);
      return;
    }
    if (saleError) {
      fail(saleError.message.includes("ยังไม่ตั้งยอดวอลเล็ต")
        ? "ยังไม่ตั้งยอดวอลเล็ตค่ายนี้ กรุณาให้เจ้าของร้านตั้งยอดก่อนขาย"
        : saleError.message.includes("วอลเล็ต")
        ? "ยอดวอลเล็ตค่ายนี้ไม่พอ กรุณาให้เจ้าของร้านเติมวอลเล็ตก่อนขาย"
        : "ปิดบิลเติมเงินไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง");
      setIsSubmitting(false);
      return;
    }
    setClientUuid(crypto.randomUUID());
    setAmount("");
    toast.success("ขายเติมเงินสำเร็จ");
    try {
      setHistoryPage(1);
      await loadPage(1);
    } catch {
      fail("ขายสำเร็จแล้ว แต่โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้า");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openWallet(carrierId: string) {
    const raw = openingAmounts[carrierId]?.trim() ?? "";
    const value = Number(raw);
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(value)) {
      fail("กรุณากรอกยอดจริงตั้งต้นตั้งแต่ 0 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
      return;
    }
    setPendingOpening({ carrierId, value });
  }

  async function confirmOpening() {
    if (!pendingOpening) return;
    const { carrierId, value } = pendingOpening;
    setPendingOpening(null);
    setOpeningCarrier(carrierId);
    try {
      const { error: openError } = await supabase.rpc("rpc_open_topup_wallet", { p_carrier_id: carrierId, p_amount: value });
      if (openError) throw openError;
      setOpeningAmounts((current) => ({ ...current, [carrierId]: "" }));
      toast.success("ตั้งยอดวอลเล็ตสำเร็จ");
      await loadPage();
    } catch {
      fail("ตั้งยอดไม่สำเร็จ กรุณาตรวจว่ายอดค่ายนี้ยังไม่เคยตั้ง แล้วโหลดหน้าใหม่");
    } finally {
      setOpeningCarrier(null);
    }
  }

  const currentWallet = wallets.find((wallet) => wallet.carrier_id === selectedCarrier);
  const previewCost = Math.round(Number(amount) * (1 - (carrierRates[selectedCarrier] ?? 0)) * 100) / 100;
  const label = "mb-1.5 block text-sm font-semibold";
  return (
    <PageFrame
      page="topup"
      title="เติมเงิน"
      description="ขายเติมเงินจากวอลเล็ตค่ายและดูรายการล่าสุด"
      actions={isOwner ? <button type="button" onClick={() => setIsFundOpen(true)} data-testid="open-wallet-fund" className="ucom-secondary h-11 px-5">+ เติมเงินเข้าวอลเล็ต</button> : undefined}
    >
      {loadError && <ErrorPanel message={loadError} onRetry={() => { setLoadError(null); setIsLoading(true); loadPage().catch(() => setLoadError("โหลดข้อมูลเติมเงินไม่สำเร็จ")).finally(() => setIsLoading(false)); }} />}

      <PageSection title="ยอดวอลเล็ต" description="ยอดจริงตั้งต้น + เงินเติมหลังตั้งยอด − ต้นทุนขายหลังตั้งยอด (รายการเก่านำเข้าไม่หักซ้ำ)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {wallets.map((wallet) => (
            <div key={wallet.carrier_id} data-testid={`wallet-balance-${wallet.carrier_id}`} className={wallet.is_initialized ? "rounded-xl bg-card p-5 shadow-card" : "rounded-xl border border-dashed border-border-strong bg-card p-5"}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">{wallet.name}</p>
                {isOwner && wallet.is_initialized && <p className="text-sm text-success tabular-nums">ค่าคอมวันนี้ ฿{(wallet.commission_today ?? 0).toLocaleString("th-TH")}</p>}
              </div>
              {wallet.is_initialized ? <>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">฿{(wallet.balance ?? 0).toLocaleString("th-TH")}</p>
                <p className="text-sm text-muted-foreground">คงเหลือพร้อมขาย</p>
              </> : <>
                <p className="mt-1.5 text-sm text-muted-foreground">ยังไม่ตั้งยอด{isOwner ? "" : " · ให้เจ้าของร้านบันทึกยอดจริงก่อนขาย"}</p>
                {isOwner && wallet.carrier_id && <>
                  <form onSubmit={(event) => { event.preventDefault(); void openWallet(wallet.carrier_id!); }} className="mt-3 flex gap-2">
                    <input aria-label={`ยอดตั้งต้น ${wallet.name}`} className="ucom-field min-w-0 flex-1 px-3 text-sm tabular-nums" type="number" inputMode="decimal" min="0" step="0.01" placeholder="ยอดจริง (บาท)" value={openingAmounts[wallet.carrier_id] ?? ""} onChange={(event) => setOpeningAmounts((current) => ({ ...current, [wallet.carrier_id!]: event.target.value }))} disabled={openingCarrier !== null} />
                    <button className="ucom-primary px-4" disabled={openingCarrier !== null}>ตั้งยอด</button>
                  </form>
                  <p className="mt-2 text-sm text-muted-foreground">ตั้งได้ครั้งเดียว แก้ภายหลังผ่านหน้านี้ไม่ได้</p>
                </>}
              </>}
            </div>
          ))}
          {!isLoading && wallets.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลวอลเล็ต</p>}
        </div>
      </PageSection>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <form onSubmit={(event) => { event.preventDefault(); void submitTopup(); }} className="space-y-4 rounded-xl bg-card p-5 shadow-card">
          <h2 className="text-lg font-bold">เติมเงินให้ลูกค้า</h2>
          <label className="block">
            <span className={label}>ค่าย</span>
            <select className="ucom-field h-12 w-full px-4 text-base" value={selectedCarrier} onChange={(event) => setSelectedCarrier(event.target.value)} disabled={isLoading || isSubmitting}>
              {wallets.map((wallet) => <option key={wallet.carrier_id} value={wallet.carrier_id ?? ""}>{wallet.name}</option>)}
            </select>
            {currentWallet && <span className="mt-1.5 block text-sm text-muted-foreground tabular-nums">{currentWallet.is_initialized ? `วอลเล็ตค่ายนี้คงเหลือ ฿${(currentWallet.balance ?? 0).toLocaleString("th-TH")}` : "วอลเล็ตค่ายนี้ยังไม่ตั้งยอด"}</span>}
          </label>
          <label className="block">
            <span className={label}>จำนวนเงินที่ลูกค้าจ่าย</span>
            <input className="ucom-field h-13 w-full px-4 text-lg font-bold tabular-nums" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isLoading || isSubmitting} placeholder="0.00" />
          </label>
          {isOwner && amount && selectedCarrier in carrierRates && Number.isFinite(previewCost) && (
            <div className="space-y-1 rounded-xl bg-muted px-4 py-3 text-sm tabular-nums">
              <p className="flex justify-between gap-3"><span className="text-muted-foreground">หักจากวอลเล็ตโดยประมาณ</span><span>฿{previewCost.toLocaleString("th-TH")}</span></p>
              <p className="flex justify-between gap-3"><span className="text-muted-foreground">ค่าคอมของร้านโดยประมาณ</span><span className="font-semibold text-success">฿{(Number(amount) - previewCost).toLocaleString("th-TH")}</span></p>
            </div>
          )}
          <div role="radiogroup" aria-label="วิธีชำระเงิน" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {PAYMENT_METHODS.map(([value, text]) => (
              <button key={value} type="button" role="radio" aria-checked={paymentMethod === value} onClick={() => setPaymentMethod(value)} className={payOption(paymentMethod === value)}>{text}</button>
            ))}
          </div>
          {paymentMethod === "transfer" && <input aria-label="บัญชีที่รับเงิน" className="ucom-field h-12 w-full px-4 text-base" value={receivingAccount} onChange={(event) => setReceivingAccount(event.target.value)} placeholder="บัญชีที่รับเงิน" />}
          <button type="submit" className="ucom-primary h-14 w-full px-4 text-base" disabled={isLoading || isSubmitting || !currentWallet?.is_initialized}>{isSubmitting ? "กำลังบันทึก..." : `ยืนยันขายเติมเงิน${amount ? ` · ฿${Number(amount).toLocaleString("th-TH")}` : ""}`}</button>
        </form>

        <TopupHistory rows={history} total={historyTotal} page={historyPage} isOwner={isOwner} isLoading={isLoading} onPageChange={setHistoryPage} />
      </div>
      {isFundOpen && <WalletFundDialog wallets={wallets} onClose={() => setIsFundOpen(false)} onSaved={() => { void loadPage(); }} />}
      <ConfirmDialog
        open={pendingOpening !== null}
        title="ยืนยันตั้งยอดวอลเล็ต"
        confirmLabel="ยืนยันตั้งยอด"
        onClose={() => setPendingOpening(null)}
        onConfirm={() => void confirmOpening()}
      >
        <p className="font-semibold tabular-nums">ยอดจริง ฿{(pendingOpening?.value ?? 0).toLocaleString("th-TH")}</p>
        <p className="text-sm text-muted-foreground">ตั้งได้เพียงครั้งเดียวและแก้ผ่านหน้านี้ไม่ได้</p>
      </ConfirmDialog>
    </PageFrame>
  );
}
