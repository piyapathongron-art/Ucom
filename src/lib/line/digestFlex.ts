export type DigestData = {
  date: string;
  closedBy: string;
  closedAt: string;
  createdAt: string;
  countedCash: number;
  salesTotal: number;
  toSend: number;
  salesLines: { name: string; amount: number; isRepair: boolean }[];
  devices: { model: string; imeiLast4: string; amount: number }[];
  sims: { carrier: string; sold: number; free: number; stockLeft: number; amount: number }[];
  topups: { carrier: string; sold: number; walletBalance: number | null; entered: number; amount: number }[];
  receipts: { cash: number; transfer: number; thaiChuaiThai: number };
  cashOutLines: { label: string; amount: number }[];
  repairsClosed: number;
  sfReleased: number;
};

type Line = { label: string; amount: number };

const money = (amount: number) => amount.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const line = (label: string, amount: number) => ({
  type: "box", layout: "horizontal", contents: [
    { type: "text", text: label, size: "sm", color: "#334155", flex: 4, wrap: true },
    { type: "text", text: money(amount), size: "sm", color: "#0F172A", weight: "bold", align: "end", flex: 2 },
  ],
});

function section(title: string, entries: Line[], total?: number) {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, "th"));
  const rest = sorted.slice(10);
  return {
    type: "box", layout: "vertical", margin: "lg", spacing: "sm",
    contents: [
      { type: "text", text: `${title}${total === undefined ? "" : ` · ${money(total)}`}`, size: "sm", weight: "bold", color: "#0F172A" },
      ...sorted.slice(0, 10).map(({ label, amount }) => line(label, amount)),
      ...(rest.length ? [{ type: "text", text: `+ อีก ${rest.length} รายการ ฿${money(rest.reduce((sum, item) => sum + item.amount, 0))}`, size: "xs", color: "#64748B" }] : []),
    ],
  };
}

function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const monthName = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][month - 1];
  return { full: `${weekday} ${day} ${monthName} ${String(year + 543).slice(-2)}`, short: `${day} ${monthName}` };
}

export function digestFlex(data: DigestData, appUrl: string, isResend = false) {
  const date = dateLabel(data.date);
  const closeTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(data.closedAt));
  const difference = data.countedCash - data.toSend;
  const differenceText = difference === 0 ? "ตรง" : `${difference < 0 ? "ขาด" : "เกิน"} ฿${money(Math.abs(difference))}`;
  const differenceColor = difference < 0 ? "#DC2626" : difference > 0 ? "#B45309" : "#15803D";
  const badge = isResend ? "ส่งซ้ำ" : new Date(data.closedAt).getTime() > new Date(data.createdAt).getTime() ? "แก้ไข" : null;
  const url = new URL("/close-day", appUrl);
  url.searchParams.set("date", data.date);

  const sections = [
    section("รายการขาย", data.salesLines.map(item => ({ label: `${item.name}${item.isRepair ? " · ซ่อม" : ""}`, amount: item.amount })), data.salesLines.reduce((sum, item) => sum + item.amount, 0)),
    section("เครื่อง", data.devices.map(item => ({ label: `${item.model} ···${item.imeiLast4}`, amount: item.amount })), data.devices.reduce((sum, item) => sum + item.amount, 0)),
    section("ซิม · ขาย / แถม / เหลือ", data.sims.map(item => ({ label: `${item.carrier} ${item.sold} / ${item.free} / ${item.stockLeft}`, amount: item.amount })), data.sims.reduce((sum, item) => sum + item.amount, 0)),
    section("เติมเงิน · ขาย / วอลเล็ตเหลือ", data.topups.map(item => ({ label: `${item.carrier} · เหลือ ${item.walletBalance === null ? "—" : money(item.walletBalance)}${item.entered ? ` · เติมเข้า +${money(item.entered)}` : ""}`, amount: item.amount })), data.topups.reduce((sum, item) => sum + item.amount, 0)),
    section("รับเงินทาง", data.receipts.cash || data.receipts.transfer || data.receipts.thaiChuaiThai ? [
      { label: "เงินสด", amount: data.receipts.cash },
      { label: "โอน", amount: data.receipts.transfer },
      { label: "ไทยช่วยไทย", amount: data.receipts.thaiChuaiThai },
    ] : []),
    section("เงินออกจากลิ้นชัก", data.cashOutLines),
  ].filter(item => item !== null);

  return {
    altText: `ปิดร้าน ${date.short} · ขาย ฿${money(data.salesTotal)} · ส่ง ฿${money(data.toSend)} · ${differenceText}`,
    contents: {
      type: "bubble", size: "mega",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: `ปิดร้าน ${date.full}`, size: "lg", weight: "bold", color: "#0F172A" },
          { type: "text", text: `ปิดโดย ${data.closedBy} · ${closeTime}${badge ? ` · ${badge}` : ""}`, size: "xs", color: "#64748B" },
          { type: "box", layout: "vertical", margin: "lg", paddingAll: "md", cornerRadius: "md", backgroundColor: "#F1F5F9", spacing: "sm", contents: [
            line("ยอดขายรวม (ทุกบิล)", data.salesTotal),
            line("ยอดที่ต้องส่ง (เงินสด)", data.toSend),
            line("นับได้จริง", data.countedCash),
            { type: "text", text: `เงินเกิน/ขาด · ${differenceText}`, size: "sm", weight: "bold", color: differenceColor },
          ] },
          ...sections,
          { type: "text", text: `งานซ่อมเสร็จ ${data.repairsClosed} งาน · ปล่อย SF+ ${data.sfReleased} เครื่อง`, size: "xs", color: "#64748B", margin: "lg" },
          { type: "button", style: "link", height: "sm", action: { type: "uri", label: "เปิดหน้าปิดร้าน", uri: url.toString() } },
        ],
      },
    },
  };
}
