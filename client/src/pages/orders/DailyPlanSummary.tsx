import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  fmtNum,
  isFgLine,
  tripStatus,
  type DailyData,
  type PackingTargetResultLite,
  type PlanOrder,
  type PlanTrip,
  type TripStatusKind,
} from "./DailyPlan";

// ── สรุปผล (Daily Operations → last tab) ───────────────────────────────────────────
// Read-only plan-vs-actual summary for one production day. Everything is derived
// from data the app really has:
//   • แผนผลิต / แพ็กแล้ว  → packing_targets + confirmed packing_target_results
//   • ยอดออเดอร์ / ส่งจริง → /api/orders/daily orders; "ส่งจริง" = the order sits on a
//     trip with departedAt (this app has no partial dispatch), or is already delivered
//   • ยกมา                → trips of an earlier delivery date that departed today
// Not faked: per-station "ไข่เบิกเข้า" and an hourly entry log don't exist in the
// schema, so those show "—" / are derived from each result's confirmed_at stamp.
// Per-customer "แพ็กแล้ว" is allocated pro-rata from each SKU's packed total by
// that customer's share of the SKU's planned demand (packing is per SKU, not per
// customer).

// ── Types ─────────────────────────────────────────────────────────────────────────

type TargetRow = {
  targetId: number;
  round: number;
  itemId: number;
  sku: string;
  itemName: string;
  eggsPerPack: number;
  primarySize: string | null;
  secondarySize: string | null;
  packUnit: string | null;
  targetQtyEggs: number;
  sentAt: string | null;
  actualQtyEggs: number | null;
  station: string | null;
  status: string | null;
  confirmedAt: string | null;
};
type CarriedTrip = {
  id: number;
  deliveryDate: string;
  tripNumber: number;
  name: string | null;
  departedAt: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverName: string | null;
  eggs: number;
  stops: number;
};
export type SummaryApi = { targets: TargetRow[]; carriedTrips: CarriedTrip[] };
type Unit = "egg" | "pack";

type ItemAttr = {
  itemId: number;
  sku: string;
  name: string;
  eggsPerPack: number;
  size: { label: string; sort: number; color: string };
  pack: { family: string; sub: string; sort: number };
};
type Fact = { plan: number; packed: number; order: number; sent: number };
const ZERO: Fact = { plan: 0, packed: 0, order: 0, sent: 0 };

// ── Palette / labels ──────────────────────────────────────────────────────────────

const INK = "#1a1a1a";
const MUTED = "#8a8f98";
const LINE = "#E1E5EA";

const CUSTOMER_STYLE: Record<string, { color: string }> = {
  Makro: { color: "#A32D2D" },
  Others: { color: "#5F5E5A" },
  Thaifood: { color: "#185FA5" },
  CJ: { color: "#993556" },
  "BigC Direct": { color: "#3B6D11" },
};
function groupOf(partnerName: string): string {
  const n = partnerName.trim();
  if (n === "Makro") return "Makro";
  if (n === "Thaifood") return "Thaifood";
  if (n === "CJ" || n === "CJ Express") return "CJ";
  if (n === "BigC" || n === "Big C") return "BigC Direct";
  return "Others";
}
const custColor = (g: string) => CUSTOMER_STYLE[g]?.color ?? "#5F5E5A";

const STATION_COLORS = ["#1E4A8A", "#3C7568", "#5B4B93", "#8A5A1D", "#9B3D5E", "#4B7A20", "#A32D2D", "#5F5E5A", "#0E7490", "#B45309"];

const PAIR_LABEL: Record<string, string> = { "1-2": "L", "2-3": "M", "3-4": "S", "4-5": "XS" };
const SIZE_COLOR: Record<string, string> = {
  "0": "#7A2020", "1": "#6B4513", "2": "#2F5A1E", "3": "#1F4F3F", "4": "#1E3F73", "5": "#4A3A8C",
  "1-2": "#5C5416", "2-3": "#2F5A25", "3-4": "#1F4F5F", "4-5": "#3A3F8C",
};
function sizeAttr(p: string | null, s: string | null): ItemAttr["size"] {
  const pn = p != null && /^\d+$/.test(p) ? Number(p) : null;
  if (pn != null && s != null && /^\d+$/.test(s)) {
    const key = `${p}-${s}`;
    const letter = PAIR_LABEL[key];
    return { label: letter ? `${key} ${letter}` : key, sort: pn - 0.5, color: SIZE_COLOR[key] ?? "#6b7280" };
  }
  if (pn != null) return { label: `เบอร์ ${pn}`, sort: pn, color: SIZE_COLOR[String(pn)] ?? "#6b7280" };
  return { label: "คละ", sort: 99, color: "#6b7280" };
}

const FAMILY_COLOR: Record<string, string> = { ถาด: "#2E4A1A", มัด: "#1E3F73", แพ็ค: "#7A4E1D", อื่นๆ: "#5F5E5A" };
const FAMILY_ORDER: Record<string, number> = { ถาด: 0, มัด: 1, แพ็ค: 2, อื่นๆ: 3 };
function packAttr(unit: string | null, name: string): ItemAttr["pack"] {
  const u = (unit ?? "").replace("แพ็ก", "แพ็ค").trim();
  const big = name.includes("ใหญ่");
  if (u.startsWith("ถาด")) {
    const noLid = name.includes("ไม่มีฝา");
    const lid = !noLid && (name.includes("มีฝา") || name.includes("ครอบ"));
    const sub = big ? "ถาดใหญ่/ครอบ" : lid ? "ถาด/ครอบ" : "ถาด";
    return { family: "ถาด", sub, sort: big ? 2 : lid ? 0 : 1 };
  }
  const m = u.match(/^(มัด|แพ็ค)\s*(\d+)?$/);
  if (m) {
    const n = m[2] ? Number(m[2]) : 0;
    const sub = `${m[1]}${n ? ` ${n}` : ""}${big ? " - ใหญ่" : ""}`;
    return { family: m[1], sub, sort: n * 10 + (big ? 1 : 0) };
  }
  return { family: "อื่นๆ", sub: u || "อื่นๆ", sort: 0 };
}

// ── Small UI pieces ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-[#E1E5EA] ${className}`}>{children}</div>;
}
function SectionHead({ n, title, right }: { n: number; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-[#E1E5EA]">
      <span className="w-9 h-9 rounded-full bg-[#1a1a1a] text-white text-[14px] font-bold flex items-center justify-center shrink-0">{n}</span>
      <span className="text-[20px] font-bold text-[#1a1a1a]">{title}</span>
      <span className="flex-1" />
      {right}
    </div>
  );
}
function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EEF0F3]">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-colors ${
            value === k ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#6b7280] hover:text-[#1a1a1a]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function Dot({ color, round }: { color: string; round?: boolean }) {
  return <span className={`inline-block w-3 h-3 shrink-0 ${round ? "rounded-full" : "rounded-[3px]"}`} style={{ background: color }} />;
}
function Kpi({
  label,
  value,
  unit,
  sub,
  valueColor = INK,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="px-7 py-5 min-w-0">
      <div className="text-[13px] text-[#6b7280] mb-1">{label}</div>
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-[42px] leading-[1.1] font-bold tabular-nums" style={{ color: valueColor }}>{value}</span>
        {unit && <span className="text-[16px] text-[#8a8f98] font-medium">{unit}</span>}
      </div>
      {sub != null && <div className="text-[13px] text-[#3f4650] mt-0.5">{sub}</div>}
    </div>
  );
}
const B = ({ children }: { children: ReactNode }) => <b className="font-bold text-[#1a1a1a]">{children}</b>;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);
// Postgres timestamps arrive like "2026-11-12 20:24:49.330828+07" — not valid ISO
// for every browser's Date parser, so normalise before parsing.
function parseTs(v: string | null | undefined): Date | null {
  if (!v) return null;
  let s = String(v).trim().replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  s = s.replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtClock(iso: string | null): string | null {
  const d = parseTs(iso);
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function thDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function shortDate(iso: string | null) {
  if (!iso) return "";
  const [, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}`;
}

// ── Main tab ──────────────────────────────────────────────────────────────────────

export function SummaryTab({
  date,
  data,
  onGoCheckout,
}: {
  date: string;
  data: DailyData | null;
  onGoCheckout: () => void;
}) {
  const [api, setApi] = useState<SummaryApi | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setApi(null);
    setErr(false);
    fetch(`/api/packing/summary?date=${date}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((j: SummaryApi) => live && setApi(j))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [date]);

  if (err) return <div className="p-6 text-[12px] text-[#92400E]">โหลดข้อมูลสรุปผลไม่สำเร็จ</div>;
  if (!api || !data) {
    return (
      <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-[#e3e5e8]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aaa]" />
      </div>
    );
  }
  return <SummaryView date={date} data={data} api={api} onGoCheckout={onGoCheckout} />;
}

export function SummaryView({
  date,
  data,
  api,
  onGoCheckout,
}: {
  date: string;
  data: DailyData;
  api: SummaryApi;
  onGoCheckout: () => void;
}) {
  const [unit, setUnit] = useState<Unit>("egg");
  const [mxMode, setMxMode] = useState<"size" | "pack" | "both">("size");
  const [mxMetric, setMxMetric] = useState<"plan" | "packed" | "sent" | "packPct" | "sentPct">("plan");
  const [openCust, setOpenCust] = useState<string | null>(null);
  const [stationSel, setStationSel] = useState<string>("ALL");
  const [stationView, setStationView] = useState<"overview" | "sku" | "hour">("overview");
  const [expandChips, setExpandChips] = useState<Record<string, boolean>>({});

  const model = useMemo(() => buildModel(data, api), [api, data]);
  const m = model;
  const conv = (eggs: number, epp: number) => (unit === "pack" ? eggs / (epp || 1) : eggs);
  const unitLabel = unit === "pack" ? "แพ็ค" : "ฟอง";

  // sum a fact field for a list of (attr, fact) pairs in the selected unit
  const sumF = (list: { a: ItemAttr; f: Fact }[], k: keyof Fact) => list.reduce((s, x) => s + conv(x.f[k], x.a.eggsPerPack), 0);

  // ── headline numbers (always in eggs) ──
  const planEggs = m.targetPlan > 0 ? m.targetPlan : m.demandPlan;
  const packedEggs = m.packedTotal;
  const orderEggs = m.orderTotal;
  const sentEggs = m.sentToday;
  const planSkus = m.targetSkuCount > 0 ? m.targetSkuCount : m.itemList.filter(x => x.f.plan > 0).length;
  const shortSkus = m.itemList.filter(x => x.f.plan > 0 && x.f.packed < x.f.plan).length;
  const awaiting = Math.max(0, packedEggs - sentEggs);

  // ── customer rows ──
  const custRows = m.groups.map(g => {
    const list = m.custFacts.filter(c => c.group === g).map(c => ({ a: m.attrs.get(c.itemId)!, f: c.f }));
    return { g, list, plan: sumF(list, "plan"), packed: sumF(list, "packed"), order: sumF(list, "order"), sent: sumF(list, "sent") };
  });

  // ── matrix ──
  const rowKeyOf = (a: ItemAttr) =>
    mxMode === "size"
      ? { key: a.size.label, sort: a.size.sort, color: a.size.color, label: a.size.label }
      : mxMode === "pack"
        ? { key: a.pack.sub, sort: FAMILY_ORDER[a.pack.family] * 1000 + a.pack.sort, color: FAMILY_COLOR[a.pack.family], label: a.pack.sub }
        : {
            key: `${a.pack.sub}|${a.size.label}`,
            sort: FAMILY_ORDER[a.pack.family] * 100000 + a.pack.sort * 100 + a.size.sort,
            color: a.size.color,
            label: `${a.pack.sub} · ${a.size.label}`,
          };
  const mxRows = new Map<string, { label: string; color: string; sort: number; cells: Record<string, Fact> }>();
  for (const c of m.custFacts) {
    const a = m.attrs.get(c.itemId)!;
    const rk = rowKeyOf(a);
    if (!mxRows.has(rk.key)) mxRows.set(rk.key, { label: rk.label, color: rk.color, sort: rk.sort, cells: {} });
    const row = mxRows.get(rk.key)!;
    const cell = (row.cells[c.group] ??= { ...ZERO });
    for (const k of ["plan", "packed", "order", "sent"] as const) cell[k] += conv(c.f[k], a.eggsPerPack);
  }
  const mxList = Array.from(mxRows.values()).sort((a, b) => a.sort - b.sort);
  const isPctMetric = mxMetric === "packPct" || mxMetric === "sentPct";
  const cellVal = (f: Fact | undefined): number | null => {
    if (!f) return null;
    if (mxMetric === "packPct") return f.plan > 0 ? (f.packed / f.plan) * 100 : null;
    if (mxMetric === "sentPct") return f.order > 0 ? (f.sent / f.order) * 100 : null;
    return f[mxMetric] > 0 ? f[mxMetric] : null;
  };
  const sumFacts = (fs: (Fact | undefined)[]): Fact => {
    const t = { ...ZERO };
    for (const f of fs) if (f) for (const k of ["plan", "packed", "order", "sent"] as const) t[k] += f[k];
    return t;
  };
  const fmtCell = (v: number | null) => (v == null ? "—" : isPctMetric ? `${Math.round(v)}%` : fmtNum(v));

  // ── pack-type rollups (item level; targets = plan) ──
  const famMap = new Map<string, { family: string; plan: number; packed: number; order: number; sent: number; subs: Map<string, { sub: string; sort: number; plan: number; packed: number; order: number; sent: number }> }>();
  for (const x of m.itemList) {
    const fam = x.a.pack.family;
    if (!famMap.has(fam)) famMap.set(fam, { family: fam, plan: 0, packed: 0, order: 0, sent: 0, subs: new Map() });
    const F = famMap.get(fam)!;
    if (!F.subs.has(x.a.pack.sub)) F.subs.set(x.a.pack.sub, { sub: x.a.pack.sub, sort: x.a.pack.sort, plan: 0, packed: 0, order: 0, sent: 0 });
    const S = F.subs.get(x.a.pack.sub)!;
    for (const k of ["plan", "packed", "order", "sent"] as const) {
      const v = conv(x.f[k], x.a.eggsPerPack);
      F[k] += v;
      S[k] += v;
    }
  }
  const families = Array.from(famMap.values()).sort((a, b) => FAMILY_ORDER[a.family] - FAMILY_ORDER[b.family]);
  // "คืบหน้าการแพ็ก" is always in pack units, independent of the ฟอง/แพ็ค toggle
  const famPackUnits = new Map<string, { plan: number; packed: number }>();
  for (const x of m.itemList) {
    const t = famPackUnits.get(x.a.pack.family) ?? { plan: 0, packed: 0 };
    t.plan += x.f.plan / x.a.eggsPerPack;
    t.packed += x.f.packed / x.a.eggsPerPack;
    famPackUnits.set(x.a.pack.family, t);
  }

  // ── stations ──
  const stationNames = m.stations;
  const stationList = stationSel === "ALL" ? stationNames : stationNames.filter(s => s === stationSel);
  const recsOf = (s: string) => m.results.filter(r => (r.station ?? "ไม่ระบุ") === s);
  const stationStat = (names: string[]) => {
    const recs = m.results.filter(r => names.includes(r.station ?? "ไม่ระบุ"));
    const out = recs.reduce((s, r) => s + (r.actualQtyEggs ?? 0), 0);
    const times = recs.map(r => parseTs(r.confirmedAt)).filter((d): d is Date => !!d);
    const byHour = new Map<number, number>();
    for (const r of recs) {
      const d = parseTs(r.confirmedAt);
      if (!d) continue;
      byHour.set(d.getHours(), (byHour.get(d.getHours()) ?? 0) + (r.actualQtyEggs ?? 0));
    }
    let peakH: number | null = null, peakV = 0;
    byHour.forEach((v, h) => { if (v > peakV) { peakV = v; peakH = h; } });
    let span: [string, string] | null = null;
    let perHour: number | null = null;
    if (times.length > 0) {
      const ts = times.map(t => t.getTime());
      const lo = Math.min(...ts), hi = Math.max(...ts);
      span = [fmtClock(new Date(lo).toISOString())!, fmtClock(new Date(hi).toISOString())!];
      const hrs = (hi - lo) / 3600000;
      perHour = hrs >= 1 ? out / hrs : null;
    }
    return {
      out,
      recs: recs.length,
      skus: new Set(recs.map(r => r.itemId)).size,
      packTypes: new Set(recs.map(r => m.attrs.get(r.itemId)?.pack.sub)).size,
      span,
      perHour,
      peakH,
      peakV,
      byHour,
    };
  };
  const allStat = stationStat(stationNames);
  const selStat = stationStat(stationList);

  return (
    <div className="space-y-6 text-[#1a1a1a]">
      {/* Page header */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="text-[24px] font-bold">สรุปผลแพ็ก</span>
        <span className="text-[13px] text-[#8a8f98]">แผน เทียบ ผลจริง · วันผลิต {thDate(date)}</span>
        <span className="flex-1" />
        <button
          onClick={() => exportCsv(date, m)}
          className="px-5 py-2.5 rounded-xl border border-[#cfd3d9] bg-white text-[14px] font-semibold hover:bg-[#f6f7f8]"
        >
          ส่งออก CSV
        </button>
      </div>

      {/* ── 1 ภาพรวม ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead n={1} title="ภาพรวม" />
        <Card className="grid grid-cols-1 md:grid-cols-4 md:divide-x divide-[#E1E5EA] overflow-hidden">
          <Kpi
            label="แผนผลิต"
            value={fmtNum(planEggs)}
            unit="ฟอง"
            sub={<><B>{planSkus}</B> SKU · <B>{m.groups.length}</B> ลูกค้า</>}
          />
          <Kpi
            label="แพ็กแล้ว"
            value={fmtNum(packedEggs)}
            unit="ฟอง"
            sub={<><B>{pct(packedEggs, planEggs)}%</B> ของแผนผลิต · เหลือ <B>{fmtNum(Math.max(0, planEggs - packedEggs))}</B> · <B>{shortSkus}</B> SKU</>}
          />
          <Kpi
            label="ยอดออเดอร์"
            value={fmtNum(orderEggs)}
            unit="ฟอง"
            sub={<><B>{m.siteCount}</B> สาขา · <B>{m.groups.length}</B> ลูกค้า{orderEggs === planEggs && <span className="text-[#9aa0a8]"> · MVP = แผนผลิต</span>}</>}
          />
          <Kpi
            label="เช็คเอาท์แล้ว (ส่งจริง)"
            value={fmtNum(sentEggs)}
            unit="ฟอง"
            valueColor="#1E3F73"
            sub={
              <>
                <B>{pct(sentEggs, orderEggs)}%</B> ของออเดอร์ · เหลือ <B>{fmtNum(Math.max(0, orderEggs - sentEggs))}</B>
                {m.carriedEggs > 0 && <> · <b className="text-[#2F6B4F]">+{fmtNum(m.carriedEggs)} ให้เที่ยวยกมา</b></>}
              </>
            }
          />
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="text-[16px] font-bold text-[#6b7280] mb-4">เทียบเป้าวันนี้ · การผลิต · ออเดอร์</div>
            <div className="space-y-3">
              <BarLine label="การผลิต" light={0} fill={Math.min(100, pct(packedEggs, planEggs))} dark="#A3C0E4" value={packedEggs} of={planEggs} />
              <BarLine
                label="ออเดอร์"
                light={Math.min(100, pct(packedEggs, orderEggs))}
                fill={Math.min(100, pct(sentEggs, orderEggs))}
                dark="#2E5E9E"
                value={sentEggs}
                of={orderEggs}
              />
            </div>
            <div className="text-[12px] text-[#8a8f98] mt-3 leading-relaxed">
              การผลิต = แพ็กแล้ว / แผนผลิต · ออเดอร์ = เช็คเอาท์แล้ว / ยอดออเดอร์ · พื้นอ่อน = แพ็กแล้ว รอเช็คเอาท์ {fmtNum(awaiting)}
            </div>
            <div className="text-[12px] text-[#8a8f98] leading-relaxed">
              MVP: ยอดออเดอร์ = แผนผลิต (ยังไม่นับสต็อก FG ข้ามวัน) · เมื่อเริ่มนับสต็อก ฐานสองแถวนี้จะแยกตัวเลขกัน
            </div>
            <div className="border-t border-[#E1E5EA] my-4" />
            <div className="text-[16px] font-bold text-[#6b7280] mb-3">คืบหน้าการแพ็ก · ตามประเภทแพ็ก· นับเป็นหน่วยแพ็ค</div>
            <div className="space-y-3">
              {families.map(f => {
                const u = famPackUnits.get(f.family)!;
                const p = pct(u.packed, u.plan);
                return (
                  <div key={f.family} className="flex items-center gap-4">
                    <span className="flex items-center gap-2 w-[130px] shrink-0 text-[15px] font-bold">
                      <Dot color={FAMILY_COLOR[f.family]} />
                      {f.family}
                    </span>
                    <div className="flex-1 h-[20px] rounded-full bg-[#EEF0F3] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: p >= 100 ? "#356B60" : "#869A76" }} />
                    </div>
                    <span className="text-[14px] tabular-nums text-right whitespace-nowrap min-w-[190px]">
                      <b>{fmtNum(u.packed)}</b> <span className="text-[#8a8f98]">/ {fmtNum(u.plan)} ·</span>{" "}
                      <b style={{ color: p >= 100 ? "#2F6B4F" : "#8A5A1D" }}>{p}%</b>
                    </span>
                  </div>
                );
              })}
              {families.length === 0 && <div className="text-[12px] text-[#9aa0a8]">ไม่มีข้อมูล</div>}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-[16px] font-bold text-[#6b7280] mb-4">ออเดอร์วันนี้ · ตามลูกค้า</div>
            <div className="flex items-center gap-8 flex-wrap lg:flex-nowrap">
              <Donut
                parts={custRows.map(r => ({ v: m.custOrderEggs[r.g] ?? 0, color: custColor(r.g) }))}
                center={fmtNum(orderEggs)}
              />
              <div className="flex-1 min-w-[240px] space-y-3">
                {custRows
                  .map(r => ({ g: r.g, v: m.custOrderEggs[r.g] ?? 0 }))
                  .map(r => (
                    <div key={r.g} className="flex items-center gap-3 text-[15px]">
                      <Dot color={custColor(r.g)} />
                      <span className="font-semibold flex-1">{r.g}</span>
                      <b className="tabular-nums">{fmtNum(r.v)}</b>
                      <span className="text-[#8a8f98] w-[56px] text-right">· {pct(r.v, orderEggs)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Trips by drop point */}
        <Card className="p-6">
          <div className="flex items-baseline gap-3 flex-wrap mb-4">
            <span className="text-[16px] font-bold text-[#6b7280]">เที่ยวรถ · ตามจุดส่ง</span>
            <span className="text-[12px] text-[#8a8f98]">· สีชิป = สถานะเที่ยว (เทา รอ · ฟ้า กำลังเช็คเอาท์ · เขียว ออกแล้ว)</span>
            <span className="flex-1" />
            <span className="text-[13px] text-[#6b7280] font-semibold">
              ออกแล้ว {m.tripsDone} / {m.tripsTotal} เที่ยว{m.carried.length > 0 && <> · ยกมา {m.carried.length}</>}
            </span>
          </div>
          <div className="space-y-2.5">
            {m.dropRows.map(row => {
              const open = expandChips[row.group];
              const shown = open ? row.chips : row.chips.slice(0, 6);
              return (
                <div key={row.group} className="flex items-start gap-4">
                  <span className="flex items-center gap-2 w-[150px] shrink-0 pt-1.5">
                    <Dot color={custColor(row.group)} />
                    <span className="text-[15px] font-bold truncate">{row.group}</span>
                  </span>
                  <span className="w-[64px] shrink-0 pt-2 text-[12px] text-[#8a8f98]">{row.sites} สาขา</span>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {shown.map((c, i) => (
                      <span
                        key={i}
                        className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap ${
                          c.kind === "done" ? "bg-[#E6F0D8] text-[#2F4A12]" : c.kind === "ready" ? "bg-[#DCEAFB] text-[#1E4A8A]" : "bg-[#EEF0F3] text-[#4b5260]"
                        }`}
                      >
                        {c.label}
                      </span>
                    ))}
                    {row.chips.length > 6 && (
                      <button
                        onClick={() => setExpandChips(s => ({ ...s, [row.group]: !open }))}
                        className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-[#EEF0F3] text-[#4b5260] hover:bg-[#e3e6ea]"
                      >
                        {open ? "ย่อ ‹" : `+${row.chips.length - 6} สาขา ›`}
                      </button>
                    )}
                  </div>
                  <span className="shrink-0 pt-1.5 text-[15px] tabular-nums text-right min-w-[110px]">
                    <b>{row.done}</b> <span className="text-[#8a8f98]">/ {row.trips} เที่ยว</span>
                  </span>
                </div>
              );
            })}
            {m.dropRows.length === 0 && <div className="text-[12px] text-[#9aa0a8]">ยังไม่มีเที่ยวรถ</div>}
          </div>
        </Card>

        {/* Matrix */}
        <Card className="p-5">
          <div className="flex items-center gap-4 flex-wrap mb-4">
            <span className="text-[18px] font-bold">{mxMode === "size" ? "เบอร์ไข่" : mxMode === "pack" ? "ประเภทแพ็ค" : "แพ็ก × เบอร์"} × ลูกค้า</span>
            <Seg
              value={mxMode}
              onChange={setMxMode}
              options={[["size", "เบอร์ไข่"], ["pack", "ประเภทแพ็ค"], ["both", "แพ็ก × เบอร์"]]}
            />
            <span className="flex-1" />
            <Seg
              value={mxMetric}
              onChange={setMxMetric}
              options={[["plan", "แผน"], ["packed", "แพ็กแล้ว"], ["sent", "ส่งจริง"], ["packPct", "แพ็กเทียบแผน"], ["sentPct", "ส่งเทียบออเดอร์"]]}
            />
            <Seg value={unit} onChange={setUnit} options={[["egg", "ฟอง"], ["pack", "แพ็ค"]]} />
          </div>
          <div className="rounded-xl border border-[#E1E5EA] overflow-x-auto">
            <table className="w-full text-[16px]">
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-[#8a8f98] border-b border-[#E1E5EA]">
                  <th className="text-left font-semibold px-5 py-3 whitespace-nowrap normal-case">
                    {mxMode === "size" ? "เบอร์ไข่" : mxMode === "pack" ? "ประเภทแพ็ค" : "แพ็ก × เบอร์"} \ ลูกค้า
                  </th>
                  {m.groups.map(g => (
                    <th key={g} className="text-right font-semibold px-5 py-3">{g}</th>
                  ))}
                  <th className="text-right font-semibold px-5 py-3 bg-[#F6F7F8] normal-case">รวม</th>
                </tr>
              </thead>
              <tbody>
                {mxList.map(r => {
                  const tot = sumFacts(Object.values(r.cells));
                  return (
                    <tr key={r.label} className="border-b border-[#EEF0F3] last:border-b-0">
                      <td className="px-5 py-3 font-semibold whitespace-nowrap">
                        <span className="flex items-center gap-3"><Dot color={r.color} />{r.label}</span>
                      </td>
                      {m.groups.map(g => {
                        const v = cellVal(r.cells[g]);
                        return (
                          <td key={g} className={`px-5 py-3 text-right tabular-nums ${v == null ? "text-[#c3c7cd]" : "font-bold"}`}>{fmtCell(v)}</td>
                        );
                      })}
                      <td className="px-5 py-3 text-right tabular-nums font-bold bg-[#F6F7F8]">{fmtCell(cellVal(tot))}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[#E1E5EA] bg-[#F6F7F8] font-bold">
                  <td className="px-5 py-3">รวมทั้งหมด</td>
                  {m.groups.map(g => {
                    const t = sumFacts(mxList.map(r => r.cells[g]));
                    return <td key={g} className="px-5 py-3 text-right tabular-nums">{fmtCell(cellVal(t))}</td>;
                  })}
                  <td className="px-5 py-3 text-right tabular-nums">{fmtCell(cellVal(sumFacts(mxList.flatMap(r => Object.values(r.cells)))))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ── 2 ลูกค้า ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead
          n={2}
          title="ลูกค้า"
          right={
            <div className="flex items-center gap-4">
              <span className="text-[13px] text-[#8a8f98]">ออเดอร์ครบ <b className="text-[#1a1a1a] text-[16px]">{m.ordersComplete}</b> / {m.ordersCount}</span>
              <Seg value={unit} onChange={setUnit} options={[["egg", "ฟอง"], ["pack", "แพ็ค"]]} />
            </div>
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-[15px] font-bold text-[#6b7280]">ออเดอร์ เทียบ แพ็กแล้ว · รายลูกค้า</span>
              <span className="text-[12px] text-[#8a8f98]">แตะเพื่อดูรายละเอียด</span>
              <span className="flex-1" />
              <span className="text-[12px] text-[#8a8f98]">ออเดอร์</span>
            </div>
            <div className="space-y-3">
              {(() => {
                const scale = Math.max(1, ...custRows.map(r => Math.max(r.plan, r.packed, r.order)));
                return custRows.map(r => {
                  const open = openCust === r.g;
                  return (
                    <div key={r.g} className="rounded-xl border border-[#E1E5EA]">
                      <button
                        onClick={() => setOpenCust(open ? null : r.g)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left"
                      >
                        <span className="text-[10px] text-[#8a8f98] w-3">{open ? "▾" : "▸"}</span>
                        <span className="flex items-center gap-2 w-[130px] shrink-0">
                          <Dot color={custColor(r.g)} />
                          <span className="text-[17px] font-bold text-[#1E3A8A]">{r.g}</span>
                        </span>
                        <div className="relative flex-1 h-[26px] rounded-md bg-[#EEF0F3] overflow-hidden">
                          <div className="absolute inset-y-0 left-0" style={{ width: `${(r.packed / scale) * 100}%`, background: custColor(r.g), opacity: 0.45 }} />
                          <div className="absolute inset-y-0 left-0" style={{ width: `${(r.sent / scale) * 100}%`, background: custColor(r.g) }} />
                        </div>
                        <div className="text-right whitespace-nowrap min-w-[200px]">
                          <div className="text-[18px] tabular-nums">
                            <b>{fmtNum(r.sent)}</b> <span className="text-[12px] text-[#8a8f98]">ส่งจริง · {pct(r.sent, r.order)}%</span>
                          </div>
                          <div className="text-[12px] text-[#8a8f98] tabular-nums">แพ็กแล้ว {fmtNum(r.packed)} · แผน {fmtNum(r.plan)}</div>
                        </div>
                      </button>
                      {open && (
                        <div className="px-5 pb-4 overflow-x-auto">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="text-[10px] text-[#8a8f98] border-b border-[#EEF0F3]">
                                <th className="text-left py-1.5 font-semibold">SKU</th>
                                <th className="text-right py-1.5 font-semibold">แผน</th>
                                <th className="text-right py-1.5 font-semibold">แพ็กแล้ว</th>
                                <th className="text-right py-1.5 font-semibold">ส่งจริง</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...r.list]
                                .sort((a, b) => a.a.sku.localeCompare(b.a.sku, undefined, { numeric: true }))
                                .map(x => (
                                  <tr key={x.a.itemId} className="border-b border-[#F4F5F7] last:border-b-0">
                                    <td className="py-1.5 pr-2">
                                      <span className="font-mono text-[10px] text-[#0C447C]">{x.a.sku}</span>
                                      <span className="text-[#555] ml-2">{x.a.name}</span>
                                    </td>
                                    <td className="text-right tabular-nums">{fmtNum(conv(x.f.plan, x.a.eggsPerPack))}</td>
                                    <td className="text-right tabular-nums">{fmtNum(conv(x.f.packed, x.a.eggsPerPack))}</td>
                                    <td className="text-right tabular-nums">{fmtNum(conv(x.f.sent, x.a.eggsPerPack))}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div className="text-[12px] text-[#8a8f98] mt-3">แถบ: พื้นเทา = แผน · โทนอ่อน = แพ็กแล้ว · โทนเข้ม = ส่งจริง (เช็คเอาท์แล้ว)</div>
          </Card>

          <Card className="p-6">
            <div className="text-[15px] font-bold text-[#6b7280] mb-4">ประเภทแพ็ก · ทุกลูกค้า</div>
            <div className="space-y-6">
              {(() => {
                const scale = Math.max(1, ...families.flatMap(f => [f.plan, f.packed]));
                return families.map(f => (
                  <div key={f.family}>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-2 w-[90px] shrink-0 text-[17px] font-bold">
                        <Dot color={FAMILY_COLOR[f.family]} />
                        {f.family}
                      </span>
                      <div className="relative flex-1 h-[26px] rounded-md bg-[#EEF0F3] overflow-hidden">
                        <div className="absolute inset-y-0 left-0" style={{ width: `${(f.packed / scale) * 100}%`, background: FAMILY_COLOR[f.family], opacity: 0.45 }} />
                        <div className="absolute inset-y-0 left-0" style={{ width: `${(f.sent / scale) * 100}%`, background: FAMILY_COLOR[f.family] }} />
                      </div>
                      <div className="text-right whitespace-nowrap min-w-[190px]">
                        <div className="text-[18px] tabular-nums">
                          <b>{fmtNum(f.sent)}</b> <span className="text-[12px] text-[#8a8f98]">ส่งจริง · {pct(f.sent, f.order)}%</span>
                        </div>
                        <div className="text-[12px] text-[#8a8f98] tabular-nums">แพ็กแล้ว {fmtNum(f.packed)} · แผน {fmtNum(f.plan)}</div>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {Array.from(f.subs.values())
                        .sort((a, b) => a.sort - b.sort)
                        .map(s => (
                          <div key={s.sub} className="flex items-center gap-4">
                            <span className="w-[90px] shrink-0 pl-5 text-[14px] text-[#3f4650]">{s.sub}</span>
                            <div className="relative flex-1 h-[10px] rounded-full bg-[#EEF0F3] overflow-hidden">
                              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (s.packed / scale) * 100)}%`, background: FAMILY_COLOR[f.family], opacity: 0.5 }} />
                            </div>
                            <span className="text-right whitespace-nowrap min-w-[190px] text-[14px] tabular-nums">
                              <b>{fmtNum(s.packed)}</b> <span className="text-[#8a8f98]">/ {fmtNum(s.plan)} · {pct(s.packed, s.plan)}%</span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ));
              })()}
              {families.length === 0 && <div className="text-[12px] text-[#9aa0a8]">ไม่มีข้อมูล</div>}
            </div>
          </Card>
        </div>
      </section>

      {/* ── 3 สถานีแพ็ก ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead n={3} title="สถานีแพ็ก" right={<span className="text-[12px] text-[#8a8f98]">หน่วย ฟอง — แพ็คมีหลายขนาด เทียบกันไม่ได้</span>} />
        <Card className="px-5 py-4 flex items-center gap-3 flex-wrap">
          <span className="text-[12px] text-[#8a8f98] mr-1">สถานี</span>
          <button
            onClick={() => setStationSel("ALL")}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold ${stationSel === "ALL" ? "bg-[#1a1a1a] text-white" : "border border-[#cfd3d9] text-[#1a1a1a] bg-white"}`}
          >
            ทุกสถานี
          </button>
          {stationNames.map((s, i) => (
            <button
              key={s}
              onClick={() => setStationSel(s)}
              className={`px-4 py-2 rounded-full text-[14px] font-semibold flex items-center gap-2 border ${
                stationSel === s ? "border-[#1a1a1a] bg-[#f6f7f8]" : "border-[#cfd3d9] bg-white"
              }`}
            >
              <Dot color={STATION_COLORS[i % STATION_COLORS.length]} />
              {stationLabel(s)}
            </button>
          ))}
          <span className="flex-1" />
          <Seg value={stationView} onChange={setStationView} options={[["overview", "ภาพรวม"], ["sku", "ประเภทแพ็ก · SKU"], ["hour", "รายชั่วโมง"]]} />
        </Card>

        {stationNames.length === 0 ? (
          <Card className="px-6 py-8 text-[13px] text-[#8a8f98]">ยังไม่มีผลแพ็กที่ยืนยันแล้วสำหรับวันนี้</Card>
        ) : (
          <>
            <Card className="grid grid-cols-2 md:grid-cols-5 md:divide-x divide-[#E1E5EA] overflow-hidden">
              <Kpi
                label="ผลผลิต"
                value={fmtNum(selStat.out)}
                unit="ฟอง"
                sub={<><B>{pct(selStat.out, allStat.out)}%</B> ของผลรวม · <B>{pct(selStat.out, planEggs)}%</B> ของแผนรวม</>}
              />
              <Kpi label="ไข่เบิกเข้า" value="—" unit="ฟอง" sub={<span className="text-[#9aa0a8]">ยังไม่มีข้อมูลเบิกไข่เข้าสถานี</span>} />
              <Kpi
                label="เฉลี่ยต่อชั่วโมง"
                value={selStat.perHour != null ? fmtNum(selStat.perHour) : "—"}
                unit="ฟอง/ชม."
                sub={selStat.span ? <span className="text-[#8a8f98]">{selStat.span[0]} – {selStat.span[1]}</span> : <span className="text-[#9aa0a8]">—</span>}
              />
              <Kpi
                label="ชั่วโมงสูงสุด"
                value={selStat.peakH != null ? `${String(selStat.peakH).padStart(2, "0")}:00` : "—"}
                sub={selStat.peakH != null ? <><B>{fmtNum(selStat.peakV)}</B> ฟอง</> : undefined}
              />
              <Kpi
                label="SKU ที่ทำ"
                value={String(selStat.skus)}
                sub={<><B>{selStat.recs}</B> รายการบันทึก · <B>{selStat.packTypes}</B> ประเภทแพ็ก</>}
              />
            </Card>

            {stationView === "overview" && (
              <Card className="p-6">
                <div className="flex h-[28px] rounded-md overflow-hidden bg-[#EEF0F3] mb-6">
                  {stationNames.map((s, i) => {
                    const o = stationStat([s]).out;
                    return <div key={s} style={{ width: `${(o / Math.max(1, planEggs)) * 100}%`, background: STATION_COLORS[i % STATION_COLORS.length], opacity: 0.55 }} title={`${stationLabel(s)} ${fmtNum(o)}`} />;
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[15px]">
                    <thead>
                      <tr className="text-[12px] text-[#8a8f98] border-b border-[#E1E5EA]">
                        <th className="text-left font-semibold py-3 px-2">สถานี</th>
                        <th className="text-right font-semibold px-2">ผลผลิต (ฟอง)</th>
                        <th className="text-right font-semibold px-2">ไข่เบิกเข้า (ฟอง)</th>
                        <th className="text-right font-semibold px-2">ส่วนต่าง</th>
                        <th className="text-right font-semibold px-2">% ของผลรวม</th>
                        <th className="text-right font-semibold px-2">% ของแผนรวม</th>
                        <th className="text-right font-semibold px-2">เฉลี่ย/ชม. (ฟอง)</th>
                        <th className="text-right font-semibold px-2">ชั่วโมงสูงสุด</th>
                        <th className="text-right font-semibold px-2">SKU</th>
                        <th className="text-right font-semibold px-2">ประเภทแพ็ก</th>
                        <th className="text-right font-semibold px-2">รายการ</th>
                        <th className="text-right font-semibold px-2">ช่วงเวลา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationList.map(s => {
                        const st = stationStat([s]);
                        const idx = stationNames.indexOf(s);
                        return (
                          <tr key={s} className="border-b border-[#EEF0F3] last:border-b-0">
                            <td className="py-3.5 px-2 font-bold whitespace-nowrap">
                              <span className="flex items-center gap-3"><Dot color={STATION_COLORS[idx % STATION_COLORS.length]} />{stationLabel(s)}</span>
                            </td>
                            <td className="px-2 text-right tabular-nums font-bold">{fmtNum(st.out)}</td>
                            <td className="px-2 text-right text-[#c3c7cd]">—</td>
                            <td className="px-2 text-right text-[#c3c7cd]">—</td>
                            <td className="px-2 text-right tabular-nums">{pct(st.out, allStat.out)}%</td>
                            <td className="px-2 text-right tabular-nums">{pct(st.out, planEggs)}%</td>
                            <td className="px-2 text-right tabular-nums">{st.perHour != null ? fmtNum(st.perHour) : "—"}</td>
                            <td className="px-2 text-right tabular-nums">
                              {st.peakH != null ? <>{String(st.peakH).padStart(2, "0")}:00 <span className="text-[#8a8f98]">{fmtNum(st.peakV)}</span></> : "—"}
                            </td>
                            <td className="px-2 text-right tabular-nums">{st.skus}</td>
                            <td className="px-2 text-right tabular-nums">{st.packTypes}</td>
                            <td className="px-2 text-right tabular-nums">{st.recs}</td>
                            <td className="px-2 text-right tabular-nums whitespace-nowrap">{st.span ? `${st.span[0]} – ${st.span[1]}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {stationView === "sku" && (
              <Card className="p-6 overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="text-[12px] text-[#8a8f98] border-b border-[#E1E5EA]">
                      <th className="text-left font-semibold py-3 px-2">ประเภทแพ็ก · SKU</th>
                      {stationList.map(s => (
                        <th key={s} className="text-right font-semibold px-2 whitespace-nowrap">{stationLabel(s)}</th>
                      ))}
                      <th className="text-right font-semibold px-2">รวม (ฟอง)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {families.map(f => {
                      const items = m.itemList
                        .filter(x => x.a.pack.family === f.family && m.results.some(r => r.itemId === x.a.itemId && stationList.includes(r.station ?? "ไม่ระบุ")))
                        .sort((a, b) => a.a.pack.sort - b.a.pack.sort || a.a.sku.localeCompare(b.a.sku, undefined, { numeric: true }));
                      if (items.length === 0) return null;
                      return (
                        <Fragment key={f.family}>
                          <tr className="bg-[#F6F7F8]">
                            <td colSpan={stationList.length + 2} className="px-2 py-2 font-bold">
                              <span className="flex items-center gap-2"><Dot color={FAMILY_COLOR[f.family]} />{f.family}</span>
                            </td>
                          </tr>
                          {items.map(x => {
                            const per = stationList.map(s => recsOf(s).filter(r => r.itemId === x.a.itemId).reduce((t, r) => t + (r.actualQtyEggs ?? 0), 0));
                            return (
                              <tr key={x.a.itemId} className="border-b border-[#EEF0F3]">
                                <td className="px-2 py-2.5">
                                  <span className="font-mono text-[10px] text-[#0C447C]">{x.a.sku}</span>
                                  <span className="text-[#555] ml-2">{x.a.name}</span>
                                  <span className="text-[#8a8f98] ml-2 text-[11px]">{x.a.pack.sub}</span>
                                </td>
                                {per.map((v, i) => (
                                  <td key={i} className={`px-2 text-right tabular-nums ${v ? "font-bold" : "text-[#c3c7cd]"}`}>{v ? fmtNum(v) : "—"}</td>
                                ))}
                                <td className="px-2 text-right tabular-nums font-bold">{fmtNum(per.reduce((a, b) => a + b, 0))}</td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}

            {stationView === "hour" && (
              <Card className="p-6 overflow-x-auto">
                {(() => {
                  const hours = Array.from(selStat.byHour.keys()).sort((a, b) => a - b);
                  if (hours.length === 0) return <div className="text-[13px] text-[#8a8f98]">ไม่มีเวลาบันทึกผลแพ็ก</div>;
                  const lo = hours[0], hi = hours[hours.length - 1];
                  const range = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
                  const maxV = Math.max(1, ...Array.from(selStat.byHour.values()));
                  return (
                    <>
                      <div className="text-[11px] text-[#8a8f98] mb-3">เวลา = เวลาที่ยืนยันผลแพ็กของแต่ละรายการ (ยังไม่มีบันทึกรายชั่วโมงจริง)</div>
                      <table className="w-full text-[14px]">
                        <thead>
                          <tr className="text-[12px] text-[#8a8f98] border-b border-[#E1E5EA]">
                            <th className="text-left font-semibold py-3 px-2 w-[90px]">ชั่วโมง</th>
                            <th className="text-left font-semibold px-2">ผลผลิต</th>
                            <th className="text-right font-semibold px-2">ฟอง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {range.map(h => {
                            const v = selStat.byHour.get(h) ?? 0;
                            return (
                              <tr key={h} className="border-b border-[#EEF0F3]">
                                <td className="py-2.5 px-2 font-semibold tabular-nums">{String(h).padStart(2, "0")}:00</td>
                                <td className="px-2">
                                  <div className="h-[14px] rounded bg-[#EEF0F3] overflow-hidden">
                                    <div className="h-full" style={{ width: `${(v / maxV) * 100}%`, background: "#7B93B8" }} />
                                  </div>
                                </td>
                                <td className={`px-2 text-right tabular-nums ${v ? "font-bold" : "text-[#c3c7cd]"}`}>{v ? fmtNum(v) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </Card>
            )}
          </>
        )}
      </section>

      {/* ── 4 การส่ง ──────────────────────────────────────────── */}
      <section className="space-y-4 pb-8">
        <SectionHead n={4} title="การส่ง" right={<span className="text-[12px] text-[#8a8f98]">แตะแถว = ไปเที่ยวนั้นในแท็บเช็คเอาท์</span>} />
        <Card className="grid grid-cols-1 md:grid-cols-4 md:divide-x divide-[#E1E5EA] overflow-hidden">
          <Kpi
            label="เที่ยวรถ"
            value={String(m.tripsDone)}
            unit={`/ ${m.tripsTotal} ออกแล้ว`}
            sub={<>วันนี้ <B>{m.tripsToday}</B> · ยกมา <B>{m.carried.length}</B> · เหลือ <B>{Math.max(0, m.tripsTotal - m.tripsDone)}</B> เที่ยว</>}
          />
          <Kpi
            label="ใบจัดของขึ้นรถ"
            value={fmtNum(m.loadEggs)}
            unit="ฟอง"
            sub={<><B>{m.tripsTotal}</B> เที่ยว · <B>{m.stopCount}</B> จุดส่ง</>}
          />
          <Kpi
            label="ส่งจริง"
            value={fmtNum(m.loadSent)}
            unit="ฟอง"
            valueColor="#1E3F73"
            sub={<><B>{pct(m.loadSent, m.loadEggs)}%</B> ของใบจัดของ · เหลือ <B>{fmtNum(Math.max(0, m.loadEggs - m.loadSent))}</B></>}
          />
          <Kpi
            label="สาขาส่งครบ"
            value={String(m.sitesFull)}
            unit={`/ ${m.siteCount} สาขา`}
            sub={<>ส่งบางส่วน <B>{m.sitesPartial}</B> · ยังไม่ส่ง <B>{m.sitesNone}</B></>}
          />
        </Card>

        <Card className="p-6">
          <div className="text-[15px] font-bold text-[#6b7280] mb-4">
            FULFILLMENT ต่อเที่ยว<span className="font-normal"> · ส่งจริง / ใบจัดของ · เรียงเที่ยวที่ยังไม่ครบขึ้นก่อน</span>
          </div>
          <div className="space-y-1">
            {m.fulfil.map(r => {
              const p = pct(r.sent, r.load);
              const done = r.load > 0 && r.sent >= r.load;
              return (
                <button
                  key={r.key}
                  onClick={onGoCheckout}
                  className="w-full flex items-center gap-4 py-3 text-left hover:bg-[#F8F9FA] rounded-lg"
                >
                  <span className="w-[64px] shrink-0 text-[15px] font-bold tabular-nums text-[#4b5260]">{r.time ?? "—"}</span>
                  <span className="w-[270px] shrink-0 text-[15px] truncate flex items-center gap-2">
                    <span className="truncate">{r.label}</span>
                    {r.carriedFrom && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F8EBD0] text-[#7A5410] text-[12px] font-semibold whitespace-nowrap">ยกมา {r.carriedFrom}</span>
                    )}
                  </span>
                  <div className="flex-1 h-[18px] rounded-full bg-[#EEF0F3] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: done ? "#356B60" : "#7B93B8" }} />
                  </div>
                  <span className="text-[14px] tabular-nums whitespace-nowrap text-right min-w-[260px]">
                    <b>{fmtNum(r.sent)}</b> <span className="text-[#8a8f98]">/ {fmtNum(r.load)} ·</span>{" "}
                    <b style={{ color: done ? "#2F6B4F" : "#8A5A1D" }}>{p}%</b>{" "}
                    {done ? <span style={{ color: "#2F6B4F" }}>✓ เสร็จ{r.doneAt ? ` ${r.doneAt}` : ""}</span> : <span className="text-[#8a8f98]">รอ</span>}
                  </span>
                </button>
              );
            })}
            {m.fulfil.length === 0 && <div className="text-[12px] text-[#9aa0a8]">ยังไม่มีเที่ยวรถ</div>}
          </div>
        </Card>
      </section>
    </div>
  );
}

const stationLabel = (s: string) => (/^\d+$/.test(s) ? `สถานี ${s}` : s);

// ── Chart bits ────────────────────────────────────────────────────────────────────

function BarLine({
  label,
  value,
  of,
  fill,
  light,
  dark,
}: {
  label: string;
  value: number;
  of: number;
  fill: number;
  light: number;
  dark: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-[80px] shrink-0 text-[15px] font-bold">{label}</span>
      <div className="relative flex-1 h-[24px] rounded-full bg-[#EEF0F3] overflow-hidden">
        {light > 0 && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${light}%`, background: dark, opacity: 0.18 }} />}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill}%`, background: dark }} />
      </div>
      <span className="text-[14px] tabular-nums whitespace-nowrap min-w-[200px] text-right">
        <b>{fmtNum(value)}</b> <span className="text-[#8a8f98]">/ {fmtNum(of)} ·</span> <b>{pct(value, of)}%</b>
      </span>
    </div>
  );
}

function Donut({ parts, center }: { parts: { v: number; color: string }[]; center: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const R = 72, SW = 26, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg width="200" height="200" viewBox="-100 -100 200 200" className="shrink-0">
      <circle r={R} fill="none" stroke="#EEF0F3" strokeWidth={SW} />
      {parts.map((p, i) => {
        const len = (p.v / total) * C;
        const el = (
          <circle
            key={i}
            r={R}
            fill="none"
            stroke={p.color}
            strokeOpacity={0.55}
            strokeWidth={SW}
            strokeDasharray={`${Math.max(0, len)} ${C}`}
            strokeDashoffset={-acc}
            transform="rotate(-90)"
          />
        );
        acc += len;
        return el;
      })}
      <text textAnchor="middle" y="2" fontSize="22" fontWeight="700" fill="#1a1a1a">{center}</text>
      <text textAnchor="middle" y="24" fontSize="11" fill="#8a8f98">ฟอง</text>
    </svg>
  );
}

// ── Model ─────────────────────────────────────────────────────────────────────────

type OrderX = PlanOrder & { partnerName: string };

function buildModel(data: DailyData, api: SummaryApi) {
  const attrs = new Map<number, ItemAttr>();
  const ensureAttr = (id: number, sku: string, name: string, epp: number, p: string | null, s: string | null, unit: string | null) => {
    if (!attrs.has(id)) attrs.set(id, { itemId: id, sku, name, eggsPerPack: epp || 1, size: sizeAttr(p, s), pack: packAttr(unit, name) });
  };

  const orders: OrderX[] = data.partners.flatMap(p =>
    p.orders
      .filter(o => o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")
      .map(o => ({ ...o, partnerName: p.partnerName })),
  );
  const tripById = new Map<number, PlanTrip>(data.trips.map(t => [t.id, t]));
  const isSent = (o: OrderX) => {
    const t = o.tripId != null ? tripById.get(o.tripId) : undefined;
    return !!t?.departedAt || o.status === "delivered" || o.logisticsStatus === "dispatched" || o.logisticsStatus === "delivered";
  };

  // item-level facts
  const itemFacts = new Map<number, Fact>();
  const bump = (id: number, k: keyof Fact, v: number) => {
    const f = itemFacts.get(id) ?? { ...ZERO };
    f[k] += v;
    itemFacts.set(id, f);
  };
  for (const t of api.targets) {
    ensureAttr(t.itemId, t.sku, t.itemName, t.eggsPerPack, t.primarySize, t.secondarySize, t.packUnit);
  }
  // one target row per (target) — results are joined 1:1, so sum straight
  let targetPlan = 0;
  const targetItems = new Set<number>();
  for (const t of api.targets) {
    bump(t.itemId, "plan", t.targetQtyEggs);
    targetPlan += t.targetQtyEggs;
    targetItems.add(t.itemId);
    if (t.status === "confirmed") bump(t.itemId, "packed", t.actualQtyEggs ?? 0);
  }

  // customer × item facts (demand side)
  const cust = new Map<string, Fact>();
  const custOrderEggs: Record<string, number> = {};
  const groupsSeen = new Set<string>();
  const demandByItem = new Map<number, number>();
  let demandPlan = 0, orderTotal = 0, sentToday = 0;
  const sites = new Set<number>();
  for (const o of orders) {
    const g = groupOf(o.partnerName);
    sites.add(o.deliverySiteId);
    const sent = isSent(o);
    for (const l of o.lines) {
      if (!isFgLine(l)) continue;
      ensureAttr(l.itemId, l.sku, l.itemName, l.eggsPerPack, l.primarySize, l.secondarySize, l.packUnit);
      const pq = (l.planningQty ?? l.orderQty) * l.eggsPerPack;
      const ord = l.orderQty * l.eggsPerPack;
      groupsSeen.add(g);
      const key = `${g}|${l.itemId}`;
      const f = cust.get(key) ?? { ...ZERO };
      f.plan += pq;
      f.order += ord;
      if (sent) f.sent += ord;
      cust.set(key, f);
      custOrderEggs[g] = (custOrderEggs[g] ?? 0) + ord;
      demandByItem.set(l.itemId, (demandByItem.get(l.itemId) ?? 0) + pq);
      demandPlan += pq;
      orderTotal += ord;
      if (sent) sentToday += ord;
      bump(l.itemId, "order", ord);
      if (sent) bump(l.itemId, "sent", ord);
    }
  }
  // allocate each SKU's packed total across customers by planned-demand share
  const custFacts: { group: string; itemId: number; f: Fact }[] = [];
  cust.forEach((f, key) => {
    const [group, id] = key.split("|");
    const itemId = Number(id);
    const itemPacked = itemFacts.get(itemId)?.packed ?? 0;
    const dem = demandByItem.get(itemId) ?? 0;
    f.packed = dem > 0 ? (itemPacked * f.plan) / dem : 0;
    custFacts.push({ group, itemId, f });
  });
  const groups = Array.from(groupsSeen).sort((a, b) => {
    const pa = custFacts.filter(c => c.group === a).reduce((s, c) => s + c.f.plan, 0);
    const pb = custFacts.filter(c => c.group === b).reduce((s, c) => s + c.f.plan, 0);
    return pb - pa;
  });

  const itemList = Array.from(itemFacts.entries())
    .filter(([id]) => attrs.has(id))
    .map(([id, f]) => ({ a: attrs.get(id)!, f }));
  const packedTotal = itemList.reduce((s, x) => s + x.f.packed, 0);

  // orders fully covered by packing (every FG line's SKU packed >= its total planned demand)
  const fgOrders = orders.filter(o => o.lines.some(isFgLine));
  const ordersComplete = fgOrders.filter(o =>
    o.lines.filter(isFgLine).every(l => {
      const f = itemFacts.get(l.itemId);
      return !!f && f.packed >= (demandByItem.get(l.itemId) ?? 0);
    }),
  ).length;

  // ── trips ──
  const resultsByRound: Record<number, PackingTargetResultLite[]> = {};
  for (const t of api.targets) {
    (resultsByRound[t.round] ??= []).push({ itemId: t.itemId, status: t.status, actualQtyEggs: t.actualQtyEggs, targetQtyEggs: t.targetQtyEggs });
  }
  const ordersByTrip = new Map<number, OrderX[]>();
  for (const o of orders) if (o.tripId != null) (ordersByTrip.get(o.tripId) ?? ordersByTrip.set(o.tripId, []).get(o.tripId)!).push(o);
  const eggsOfOrder = (o: OrderX) => o.lines.reduce((s, l) => s + l.orderQty * l.eggsPerPack, 0);

  type TripX = { trip: PlanTrip; stops: OrderX[]; kind: TripStatusKind; load: number; sent: number; time: string | null; doneAt: string | null };
  const tripsX: TripX[] = data.trips
    .map(trip => {
      const stops = ordersByTrip.get(trip.id) ?? [];
      const st = tripStatus(trip, stops, resultsByRound);
      const load = stops.reduce((s, o) => s + eggsOfOrder(o), 0);
      const time = hhmm(stops.map(o => o.deliveryTime).filter(Boolean).sort()[0] ?? null);
      return { trip, stops, kind: st.kind, load, sent: st.kind === "done" ? load : 0, time, doneAt: fmtClock(trip.departedAt) };
    })
    .filter(t => t.stops.length > 0);

  // off-plan orders: no trip → one pseudo "เที่ยว" each (นอกแผน)
  const offPlan = orders.filter(o => o.source === "off_plan" && (o.tripId == null || !tripById.has(o.tripId)));
  const carried = api.carriedTrips;

  const fulfil: { key: string; time: string | null; label: string; load: number; sent: number; doneAt: string | null; carriedFrom: string | null }[] = [];
  for (const t of tripsX) {
    const self = !t.trip.vehicleId;
    const who = t.stops.length === 1 ? t.stops[0].deliverySiteName : t.trip.name ?? `Trip ${t.trip.tripNumber}`;
    fulfil.push({
      key: `t${t.trip.id}`,
      time: t.time,
      label: self ? `รับเอง · ${who}` : `${t.trip.vehicleType ?? "-"} ${t.trip.vehiclePlate ?? ""} · ${t.trip.driverName ?? "-"}`.replace(/\s+/g, " ").trim(),
      load: t.load,
      sent: t.sent,
      doneAt: t.doneAt,
      carriedFrom: null,
    });
  }
  for (const c of carried) {
    fulfil.push({
      key: `c${c.id}`,
      time: fmtClock(c.departedAt),
      label: `${c.vehicleType ?? "-"} ${c.vehiclePlate ?? ""} · ${c.driverName ?? "-"}`.replace(/\s+/g, " ").trim(),
      load: c.eggs,
      sent: c.eggs,
      doneAt: fmtClock(c.departedAt),
      carriedFrom: shortDate(c.deliveryDate),
    });
  }
  for (const o of offPlan) {
    const load = eggsOfOrder(o);
    const done = isSent(o);
    fulfil.push({
      key: `o${o.id}`,
      time: hhmm(o.pickupTime ?? o.deliveryTime),
      label: `นอกแผน · ${o.deliverySiteName ?? o.partnerName}`,
      load,
      sent: done ? load : 0,
      doneAt: null,
      carriedFrom: null,
    });
  }
  fulfil.sort((a, b) => {
    const ad = a.load > 0 && a.sent >= a.load ? 1 : 0, bd = b.load > 0 && b.sent >= b.load ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
  });

  const tripsToday = tripsX.length + offPlan.length;
  const tripsTotal = tripsToday + carried.length;
  const tripsDone = tripsX.filter(t => t.kind === "done").length + carried.length + offPlan.filter(isSent).length;
  const loadEggs = fulfil.reduce((s, r) => s + r.load, 0);
  const loadSent = fulfil.reduce((s, r) => s + r.sent, 0);
  const stopCount = tripsX.reduce((s, t) => s + t.stops.length, 0) + offPlan.length + carried.reduce((s, c) => s + c.stops, 0);
  const carriedEggs = carried.reduce((s, c) => s + c.eggs, 0);

  // site-level delivery completeness (today's orders)
  const siteState = new Map<number, { sent: number; total: number }>();
  for (const o of orders) {
    const s = siteState.get(o.deliverySiteId) ?? { sent: 0, total: 0 };
    s.total++;
    if (isSent(o)) s.sent++;
    siteState.set(o.deliverySiteId, s);
  }
  let sitesFull = 0, sitesPartial = 0, sitesNone = 0;
  siteState.forEach(s => {
    if (s.sent === s.total) sitesFull++;
    else if (s.sent > 0) sitesPartial++;
    else sitesNone++;
  });

  // drop-point rows: customer group → chips per site, status from its trip
  type Chip = { label: string; kind: TripStatusKind };
  const dropMap = new Map<string, { group: string; chips: Chip[]; sites: Set<number>; trips: Map<number, TripStatusKind> }>();
  const dropRow = (g: string) => {
    if (!dropMap.has(g)) dropMap.set(g, { group: g, chips: [], sites: new Set(), trips: new Map() });
    return dropMap.get(g)!;
  };
  for (const t of tripsX) {
    const self = !t.trip.vehicleId;
    for (const o of t.stops) {
      const g = self && groupOf(o.partnerName) === "Others" ? o.partnerName : groupOf(o.partnerName);
      const row = dropRow(g);
      if (row.sites.has(o.deliverySiteId) && row.chips.some(c => c.label.startsWith(`${o.deliverySiteName}`))) {
        row.trips.set(t.trip.id, t.kind);
        continue;
      }
      row.sites.add(o.deliverySiteId);
      const when = self ? "หน้าโรงงาน" : hhmm(o.deliveryTime);
      row.chips.push({ label: self ? "หน้าโรงงาน" : when ? `${o.deliverySiteName} · ${when}` : o.deliverySiteName, kind: t.kind });
      row.trips.set(t.trip.id, t.kind);
    }
  }
  for (const o of offPlan) {
    const g = groupOf(o.partnerName) === "Others" ? o.partnerName : groupOf(o.partnerName);
    const row = dropRow(g);
    row.sites.add(o.deliverySiteId);
    row.chips.push({ label: "หน้าโรงงาน", kind: isSent(o) ? "done" : "needs_confirm" });
    row.trips.set(-o.id, isSent(o) ? "done" : "needs_confirm");
  }
  const major = ["Makro", "Others", "Thaifood", "CJ", "BigC Direct"];
  const dropRows = Array.from(dropMap.values())
    .map(r => ({
      group: r.group,
      chips: r.chips,
      sites: r.sites.size,
      trips: r.trips.size,
      done: Array.from(r.trips.values()).filter(k => k === "done").length,
    }))
    .sort((a, b) => {
      const ia = major.indexOf(a.group), ib = major.indexOf(b.group);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.group.localeCompare(b.group, "th");
    });
  // "chips" keep the status colour of the trip they belong to — the `kind` of an
  // un-confirmed/needs-packing trip collapses to grey (รอ) in the UI.
  const dropRowsUi = dropRows.map(r => ({ ...r, chips: r.chips.map(c => ({ label: c.label, kind: (c.kind === "done" ? "done" : c.kind === "ready" ? "ready" : "wait") as "done" | "ready" | "wait" })) }));

  // station records (confirmed results only)
  const results = api.targets.filter(t => t.status === "confirmed" && t.actualQtyEggs != null);
  const stations = Array.from(new Set(results.map(r => r.station ?? "ไม่ระบุ"))).sort((a, b) =>
    a.localeCompare(b, "th", { numeric: true }),
  );

  return {
    attrs,
    itemList,
    custFacts,
    custOrderEggs,
    groups,
    targetPlan,
    targetSkuCount: targetItems.size,
    demandPlan,
    packedTotal,
    orderTotal,
    sentToday,
    carriedEggs,
    siteCount: sites.size,
    ordersCount: fgOrders.length,
    ordersComplete,
    results,
    stations,
    carried,
    tripsToday,
    tripsTotal,
    tripsDone,
    loadEggs,
    loadSent,
    stopCount,
    sitesFull,
    sitesPartial,
    sitesNone,
    dropRows: dropRowsUi,
    fulfil,
  };
}

// ── CSV export ────────────────────────────────────────────────────────────────────

function exportCsv(date: string, m: ReturnType<typeof buildModel>) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [["วันที่", "ลูกค้า", "SKU", "ชื่อสินค้า", "เบอร์", "ประเภทแพ็ก", "ไข่/แพ็ค", "แผน (ฟอง)", "แพ็กแล้ว (ฟอง)", "ออเดอร์ (ฟอง)", "ส่งจริง (ฟอง)"]];
  for (const c of m.custFacts) {
    const a = m.attrs.get(c.itemId)!;
    rows.push([date, c.group, a.sku, a.name, a.size.label, a.pack.sub, a.eggsPerPack, Math.round(c.f.plan), Math.round(c.f.packed), Math.round(c.f.order), Math.round(c.f.sent)]);
  }
  const csv = "﻿" + rows.map(r => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `สรุปผลแพ็ก_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
