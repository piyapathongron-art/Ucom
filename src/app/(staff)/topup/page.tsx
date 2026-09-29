"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageFrame, PageSection } from "@/app/_components/PageFrame";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { WalletFundDialog } from "./WalletFundDialog";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";

type Wallet = Tables<"v_pos_topup_wallet_balance">;
type TopupSale = Tables<"v_pos_topup_history">;

const fail = (message: string) => toast.error(message, { duration: Infinity });

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
        .range((page - 1) * 20, page * 20 - 1),
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
      const result = await supabase.rpc("rpc_create_sale", {
        payload: {
          client_uuid: clientUuid,
          sold_at: new Date().toISOString(),
          payment_method: paymentMethod,
          receiving_account: paymentMethod === "transfer" ? receivingAccount || null : null,
          bill_discount: 0,
          items: [{ kind: "topup", topup_carrier_id: selectedCarrier, unit_price: value }],
        },
      });
      saleError = result.error;
    } catch {
      fail("ยังยืนยันผลการขายไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองบิลเดิมอีกครั้ง");
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
  return (
    <PageFrame
      page="topup"
     
      title="เติมเงิน"
      description="ขายเติมเงินจากวอลเล็ตค่ายและดูรายการล่าสุด"
      actions={isOwner ? <button type="button" onClick={() => setIsFundOpen(true)} data-testid="open-wallet-fund" className="ucom-primary px-[18px] py-2.5">+ เติมเงินเข้าวอลเล็ต</button> : undefined}
    >
      {loadError && <ErrorPanel message={loadError} onRetry={() => { setLoadError(null); setIsLoading(true); loadPage().catch(() => setLoadError("โหลดข้อมูลเติมเงินไม่สำเร็จ")).finally(() => setIsLoading(false)); }} />}

      <PageSection title="ยอดวอลเล็ต" description="ยอดจริงตั้งต้น + เงินเติมหลังตั้งยอด − ต้นทุนขายหลังตั้งยอด (รายการเก่านำเข้าไม่หักซ้ำ)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {wallets.map((wallet) => (
            <div key={wallet.carrier_id} data-testid={`wallet-balance-${wallet.carrier_id}`} className="ucom-surface p-4">
              <p className="text-sm font-semibold text-ink">{wallet.name}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-ink">{wallet.is_initialized ? `฿${(wallet.balance ?? 0).toLocaleString()}` : "ยังไม่ตั้งยอด"}</p>
              <p className="mt-1 text-xs text-ink-muted">{wallet.is_initialized ? "คงเหลือพร้อมขาย" : "ให้เจ้าของร้านบันทึกยอดจริงก่อนขาย"}</p>
              {isOwner && wallet.is_initialized && <p className="mt-2 text-xs text-success">ค่าคอมวันนี้ ฿{(wallet.commission_today ?? 0).toLocaleString()}</p>}
              {isOwner && !wallet.is_initialized && wallet.carrier_id && <form onSubmit={(event) => { event.preventDefault(); void openWallet(wallet.carrier_id!); }} className="mt-3 flex gap-2">
                <input aria-label={`ยอดตั้งต้น ${wallet.name}`} className="ucom-field min-w-0 flex-1 px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="ยอดจริง ฿" value={openingAmounts[wallet.carrier_id] ?? ""} onChange={(event) => setOpeningAmounts((current) => ({ ...current, [wallet.carrier_id!]: event.target.value }))} disabled={openingCarrier !== null} />
                <button className="ucom-primary rounded-full px-3 py-2 text-xs disabled:opacity-50" disabled={openingCarrier !== null}>ตั้งยอด</button>
              </form>}
            </div>
          ))}
          {!isLoading && wallets.length === 0 && <p className="text-sm text-ink-muted">ยังไม่มีข้อมูลวอลเล็ต</p>}
        </div>
      </PageSection>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <PageSection title="เติมเงินให้ลูกค้า">
          <form onSubmit={(event) => { event.preventDefault(); void submitTopup(); }} className="ucom-surface space-y-4 rounded-2xl p-5">
            <label className="block space-y-1.5 text-sm text-ink-muted">
              <span>ค่าย</span>
              <select className="ucom-field w-full px-3 py-2.5" value={selectedCarrier} onChange={(event) => setSelectedCarrier(event.target.value)} disabled={isLoading || isSubmitting}>
                {wallets.map((wallet) => <option key={wallet.carrier_id} value={wallet.carrier_id ?? ""}>{wallet.name}</option>)}
              </select>
            </label>
            {currentWallet && <p className="text-xs text-ink-muted">{currentWallet.is_initialized ? `วอลเล็ตค่ายนี้คงเหลือ ฿${(currentWallet.balance ?? 0).toLocaleString()}` : "วอลเล็ตค่ายนี้ยังไม่ตั้งยอด"}</p>}
            <label className="block space-y-1.5 text-sm text-ink-muted">
              <span>จำนวนเงินที่ลูกค้าจ่าย</span>
              <input className="ucom-field w-full px-3 py-2.5 font-mono" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isLoading || isSubmitting} placeholder="0.00" />
            </label>
            {isOwner && amount && selectedCarrier in carrierRates && Number.isFinite(previewCost) && (
              <div className="space-y-1 border-t border-border pt-3 text-xs text-ink-muted">
                <p>หักจากวอลเล็ตโดยประมาณ ฿{previewCost.toLocaleString()}</p>
                <p className="text-success">ค่าคอมของร้านโดยประมาณ ฿{(Number(amount) - previewCost).toLocaleString()}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" className={`flex-1 rounded-full border p-2 text-sm ${paymentMethod === "cash" ? "border-accent bg-accent text-background" : "border-border text-ink-muted"}`} onClick={() => setPaymentMethod("cash")}>เงินสด</button>
              <button type="button" className={`flex-1 rounded-full border p-2 text-sm ${paymentMethod === "transfer" ? "border-accent bg-accent text-background" : "border-border text-ink-muted"}`} onClick={() => setPaymentMethod("transfer")}>โอน</button>
            </div>
            {paymentMethod === "transfer" && <input className="ucom-field w-full px-3 py-2.5 text-sm" value={receivingAccount} onChange={(event) => setReceivingAccount(event.target.value)} placeholder="บัญชีที่รับเงิน" />}
            <button type="submit" className="ucom-primary w-full rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-50" disabled={isLoading || isSubmitting || !currentWallet?.is_initialized}>{isSubmitting ? "กำลังบันทึก..." : `ยืนยันขายเติมเงิน${amount ? ` · ฿${Number(amount).toLocaleString()}` : ""}`}</button>
          </form>
        </PageSection>

        <PageSection title="รายการเติมเงินล่าสุด">
          <div className="ucom-table-wrap">
            <table className="ucom-table">
              <thead><tr><th>วันเวลา</th><th>ค่าย</th><th className="text-right">ยอดลูกค้า</th>{isOwner && <th className="text-right">ค่าคอม</th>}<th>พนักงาน</th></tr></thead>
              <tbody>
                {history.map((row) => <tr key={row.sale_item_id}><td className="text-ink-muted">{row.sold_at ? new Date(row.sold_at).toLocaleString("th-TH") : "—"}</td><td>{row.carrier_name}{row.is_imported && <span className="ml-2 text-xs text-ink-muted">นำเข้า</span>}</td><td className="text-right font-mono">฿{(row.amount ?? 0).toLocaleString()}</td>{isOwner && <td className="text-right font-mono text-success">฿{(row.commission ?? 0).toLocaleString()}</td>}<td className="text-ink-muted">{row.cashier_name ?? "—"}</td></tr>)}
              </tbody>
            </table>
            {!isLoading && history.length === 0 && <p className="p-6 text-center text-sm text-ink-muted">ยังไม่มีรายการเติมเงิน</p>}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
            <span>หน้า {historyPage} · {historyTotal} รายการ</span>
            <div className="flex gap-2"><button type="button" className="ucom-secondary rounded-full px-3 py-1.5 disabled:opacity-40" disabled={historyPage === 1} onClick={() => setHistoryPage((page) => page - 1)}>ก่อนหน้า</button><button type="button" className="ucom-secondary rounded-full px-3 py-1.5 disabled:opacity-40" disabled={historyPage * 20 >= historyTotal} onClick={() => setHistoryPage((page) => page + 1)}>ถัดไป</button></div>
          </div>
        </PageSection>
      </div>
      {isFundOpen && <WalletFundDialog wallets={wallets} onClose={() => setIsFundOpen(false)} onSaved={() => { void loadPage(); }} />}
      <ConfirmDialog
        open={pendingOpening !== null}
        title="ยืนยันตั้งยอดวอลเล็ต"
        confirmLabel="ยืนยันตั้งยอด"
        onClose={() => setPendingOpening(null)}
        onConfirm={() => void confirmOpening()}
      >
        <p className="text-sm text-ink">ยอดจริง ฿{(pendingOpening?.value ?? 0).toLocaleString("th-TH")}</p>
        <p className="text-sm text-ink-muted">ตั้งได้เพียงครั้งเดียวและแก้ผ่านหน้านี้ไม่ได้</p>
      </ConfirmDialog>
    </PageFrame>
  );
}
