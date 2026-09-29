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

type Span = { text: string; color?: string; size?: string };
type Row = { label: Span[]; value: string; amount: number };

const INK = "#0F172A";
const MUTED = "#64748B";
const FAINT = "#94A3B8";
const MAX_ROWS = 10;

const money = (amount: number) => amount.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const sum = (items: { amount: number }[]) => items.reduce((total, item) => total + item.amount, 0);
const hint = (text: string, color = FAINT): Span => ({ text: ` ${text}`, color, size: "xs" });

function row(label: Span[] | string, value: string, { labelColor = INK, isBold = false, valueSize = "sm", valueColor = INK } = {}) {
  const spans = typeof label === "string" ? [{ text: label }] : label;
  return {
    type: "box", layout: "horizontal", contents: [
      { type: "text", contents: spans.map((span) => ({ type: "span", ...span })), size: "sm", color: labelColor, weight: isBold ? "bold" : "regular", flex: 5, wrap: true, gravity: "center" },
      { type: "text", text: value, size: valueSize, color: valueColor, weight: isBold ? "bold" : "regular", align: "end", flex: 3, gravity: "center" },
    ],
  };
}

// One card section: small muted title (+ right-hand column legend), up to MAX_ROWS rows sorted
// by amount, an overflow line, then a bold total. Empty sections disappear entirely.
function section(title: string, meta: string, rows: Row[], { hasTotal = true, isSorted = true, labelColor = INK } = {}) {
  if (rows.length === 0) return [];
  const sorted = isSorted ? [...rows].sort((a, b) => b.amount - a.amount) : rows;
  const rest = sorted.slice(MAX_ROWS);
  return [
    { type: "separator", margin: "lg" },
    {
      type: "box", layout: "vertical", margin: "lg", spacing: "xs", contents: [
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: title, size: "xs", color: FAINT, flex: 1 },
          { type: "text", text: meta || " ", size: "xs", color: FAINT, align: "end", flex: 1 },
        ] },
        ...sorted.slice(0, MAX_ROWS).map((item) => row(item.label, item.value, { labelColor })),
        ...(rest.length ? [{ type: "text", text: `+ อีก ${rest.length} รายการ ฿${money(sum(rest))}`, size: "xs", color: MUTED }] : []),
        ...(hasTotal ? [row("รวม", money(sum(rows)), { isBold: true })] : []),
      ],
    },
  ];
}

function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const monthName = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][month - 1];
  return { full: `${weekday} ${day} ${monthName} ${String(year + 543).slice(-2)}`, short: `${day} ${monthName}` };
}

function badgeBox(text: string, isEdit: boolean) {
  return {
    type: "box", layout: "vertical", flex: 0, paddingStart: "8px", paddingEnd: "8px", paddingTop: "2px", paddingBottom: "2px",
    cornerRadius: "6px", backgroundColor: isEdit ? "#FEF3C7" : "#DBEAFE", justifyContent: "center",
    contents: [{ type: "text", text, size: "xxs", color: isEdit ? "#B45309" : "#1D4ED8" }],
  };
}

export function digestFlex(data: DigestData, appUrl: string, isResend = false) {
  const date = dateLabel(data.date);
  const closeTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(data.closedAt));
  const difference = data.countedCash - data.toSend;
  const differenceText = difference === 0 ? "ตรง" : `${difference < 0 ? "ขาด" : "เกิน"} ฿${money(Math.abs(difference))}`;
  const differenceColor = difference < 0 ? "#DC2626" : difference > 0 ? "#B45309" : "#15803D";
  const isEdit = !isResend && new Date(data.closedAt).getTime() > new Date(data.createdAt).getTime();
  const badge = isResend ? "ส่งซ้ำ" : isEdit ? "แก้ไข" : null;
  const url = new URL("/close-day", appUrl);
  url.searchParams.set("date", data.date);
  const { cash, transfer, thaiChuaiThai } = data.receipts;

  const body = [
    { type: "box", layout: "horizontal", spacing: "sm", contents: [
      { type: "text", text: `ปิดร้าน ${date.full}`, size: "lg", weight: "bold", color: INK, flex: 1, wrap: true },
      ...(badge ? [badgeBox(badge, isEdit)] : []),
    ] },
    { type: "text", text: `ปิดโดย ${data.closedBy} · ${closeTime}`, size: "xs", color: MUTED },
    { type: "box", layout: "vertical", margin: "lg", paddingAll: "12px", cornerRadius: "8px", backgroundColor: "#F1F5F9", spacing: "xs", contents: [
      row("ยอดขายรวม (ทุกบิล)", `฿${money(data.salesTotal)}`, { labelColor: MUTED, valueColor: INK }),
      row("ยอดที่ต้องส่ง (เงินสด)", `฿${money(data.toSend)}`, { labelColor: MUTED, valueSize: "lg", isBold: true }),
      row("นับได้จริง", `฿${money(data.countedCash)}`, { labelColor: MUTED }),
      row("เงินเกิน/ขาด", differenceText, { labelColor: MUTED, valueColor: differenceColor }),
    ] },
    ...section("รายการขาย", `${data.salesLines.length} รายการ`, data.salesLines.map((item) => ({
      label: [{ text: item.name }, ...(item.isRepair ? [hint("ซ่อม")] : [])], value: money(item.amount), amount: item.amount,
    }))),
    ...section("เครื่อง", `${data.devices.length} เครื่อง`, data.devices.map((item) => ({
      label: [{ text: item.model }, hint(`···${item.imeiLast4}`)], value: money(item.amount), amount: item.amount,
    })), { hasTotal: data.devices.length > 1 }),
    ...section("ซิม", "ขาย · แถม · เหลือ", data.sims.map((item) => ({
      label: [{ text: item.carrier }], value: `${item.sold} · ${item.free} · ${item.stockLeft}`, amount: item.amount,
    }))),
    ...section("เติมเงิน", "ขาย · วอลเล็ตเหลือ", data.topups.map((item) => ({
      label: [{ text: item.carrier }, ...(item.entered ? [hint(`เติมเข้า +${money(item.entered)}`, "#15803D")] : [])],
      value: `${money(item.amount)} · ${item.walletBalance === null ? "—" : money(item.walletBalance)}`, amount: item.amount,
    }))),
    ...section("รับเงินทาง", "", cash || transfer || thaiChuaiThai ? [
      { label: [{ text: "เงินสด" }], value: money(cash), amount: cash },
      { label: [{ text: "โอน" }], value: money(transfer), amount: transfer },
      { label: [{ text: "ไทยช่วยไทย" }], value: money(thaiChuaiThai), amount: thaiChuaiThai },
    ] : [], { hasTotal: false, isSorted: false, labelColor: MUTED }),
    ...section("เงินออกจากลิ้นชัก", "", data.cashOutLines.map((item) => ({ label: [{ text: item.label }], value: money(item.amount), amount: item.amount }))),
    { type: "separator", margin: "lg" },
    { type: "text", text: `งานซ่อมเสร็จ ${data.repairsClosed} งาน · ปล่อย SF+ ${data.sfReleased} เครื่อง`, size: "xs", color: MUTED, margin: "lg" },
    { type: "box", layout: "vertical", margin: "lg", paddingAll: "10px", cornerRadius: "8px", borderWidth: "1px", borderColor: "#CBD5E1",
      action: { type: "uri", label: "เปิดหน้าปิดร้าน", uri: url.toString() },
      contents: [{ type: "text", text: "เปิดหน้าปิดร้าน", size: "sm", color: "#2563EB", align: "center" }] },
  ];

  return {
    altText: `ปิดร้าน ${date.short} · ขาย ฿${money(data.salesTotal)} · ส่ง ฿${money(data.toSend)} · ${differenceText}`,
    contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", contents: body } },
  };
}
