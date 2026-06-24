import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlanLine {
  lineId: number;
  itemId: number;
  sku: string;
  itemName: string;
  sellingUnit: string;
  eggsPerPack: number;
  primarySize: string | null;
  secondarySize: string | null;
  poQty: number;
  orderQty: number;
  planningQty: number | null;
}

interface PlanOrder {
  id: number;
  orderNumber: string;
  poNumber: string | null;
  deliveryDate: string;
  status: string;
  productionRound: number | null;
  tripId: number | null;
  stopOrder: number | null;
  deliverySiteId: number;
  deliverySiteName: string;
  lines: PlanLine[];
}

interface PlanPartner {
  partnerId: number;
  partnerName: string;
  partnerCode: string;
  orders: PlanOrder[];
}

interface PlanTrip {
  id: number;
  deliveryDate: string;
  productionRound: number | null;
  tripNumber: number;
  name: string | null;
  notes: string | null;
  vehicleId: number | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverId: number | null;
  driverName: string | null;
}

interface VehicleOption { id: number; plateNumber: string; vehicleType: string; }
interface DriverOption  { id: number; name: string; }

interface RoundState { closed: boolean; closedAt: string | null; }

interface DailyData {
  date: string;
  kpi: { orders: number; partners: number; sites: number; eggs: number };
  roundStates: Record<number, RoundState>;
  partners: PlanPartner[];
  trips: PlanTrip[];
}

type SubTab = "demand" | "bom" | "trip";
type Round = 1 | 2 | 3 | 4;

// ── Colour maps ────────────────────────────────────────────────────────────────

const CUST_COLOR: Record<string, string> = {
  Makro: "#A32D2D", BigC: "#3B6D11", "Big C": "#3B6D11",
  Thaifood: "#185FA5", CJ: "#993556", "CJ Express": "#993556",
  TT: "#854F0B", Lotuss: "#0A6E56", "Lotus's": "#0A6E56",
};
const CUST_BG: Record<string, string> = {
  Makro: "#FCEBEB", BigC: "#EAF3DE", "Big C": "#EAF3DE",
  Thaifood: "#E6F1FB", CJ: "#FBEAF0", "CJ Express": "#FBEAF0",
  TT: "#FAEEDA", Lotuss: "#E1F5EE", "Lotus's": "#E1F5EE",
};
const SIZE_PILL_CLS: Record<string, string> = {
  "0": "bg-[#FCEBEB] text-[#791F1F]",
  "1": "bg-[#FAEEDA] text-[#633806]",
  "2": "bg-[#EAF3DE] text-[#27500A]",
  "3": "bg-[#E1F5EE] text-[#085041]",
  "4": "bg-[#E6F1FB] text-[#0C447C]",
  "5": "bg-[#EEEDFE] text-[#3C3489]",
};

function custColor(n: string) { return CUST_COLOR[n] ?? "#5F5E5A"; }
function custBg(n: string) { return CUST_BG[n] ?? "#f6f7f9"; }
function fmtNum(n: number) { return Math.round(n).toLocaleString("th-TH"); }
function todayISO() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }))
    .toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CustPill({ name }: { name: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-bold tracking-wide whitespace-nowrap"
      style={{ background: custColor(name) }}
    >
      {name}
    </span>
  );
}

function SizePill({ primary, secondary }: { primary: string | null; secondary: string | null }) {
  if (!primary) return null;
  const cls = SIZE_PILL_CLS[primary] ?? "bg-[#F1EFE8] text-[#5F5E5A]";
  const label = secondary ? `เบอร์ ${primary}-${secondary}` : `เบอร์ ${primary}`;
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${cls}`}>{label}</span>;
}

function orderEggs(o: PlanOrder) {
  return o.lines.reduce((s, l) => s + l.orderQty * l.eggsPerPack, 0);
}

// ── Round status banner ────────────────────────────────────────────────────────

function RoundStatusBanner({
  date,
  round,
  state,
  onChanged,
}: {
  date: string;
  round: Round;
  state: RoundState | undefined;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const toggle = async (closed: boolean) => {
    setLoading(true);
    try {
      await fetch("/api/orders/round-states", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, round, closed }),
      });
      onChanged();
    } finally {
      setLoading(false);
    }
  };

  const isClosed = state?.closed ?? false;

  if (isClosed) {
    return (
      <div className="flex items-center gap-3 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl px-4 py-3">
        <span className="text-green-600 text-[16px]">🔒</span>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-green-700">รอบ R{round} ปิดรับออเดอร์แล้ว</div>
          <div className="text-[11px] text-green-600 mt-0.5">
            ไม่รับออเดอร์ใหม่เข้ารอบนี้แล้ว ·{" "}
            <button
              onClick={() => toggle(false)}
              disabled={loading}
              className="underline hover:no-underline font-medium"
            >
              เปิดรอบอีกครั้ง
            </button>
          </div>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-green-600" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3">
      <span className="text-[16px]">🔓</span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-[#1E40AF]">รอบ R{round} ยังรับออเดอร์ใหม่ได้</div>
        <div className="text-[11px] text-[#3B82F6] mt-0.5">
          ปิดเฉพาะการรับออเดอร์ใหม่เข้ารอบนี้ — ไม่ได้ส่ง Trip ทั้งหมดไปขั้นตอนถัดไป
          <br />
          การส่ง Trip ทำที่ Trip Manager:{" "}
          <span className="font-semibold underline cursor-pointer">ส่ง Trip ที่เลือกไปขั้นตอนถัดไป</span>
        </div>
      </div>
      <button
        onClick={() => toggle(true)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] bg-white text-[#333] hover:bg-[#f5f5f5] disabled:opacity-50 whitespace-nowrap shrink-0"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        ปิดรับออเดอร์รอบ R{round}
      </button>
    </div>
  );
}

// ── Planning grid — pivot table (SKU rows × order columns) ────────────────────

function PackPill({ unit }: { unit: string }) {
  const label = unit.toLowerCase();
  const cls =
    label === "ถาด" ? "bg-[#F1EFE8] text-[#5F5E5A]" :
    label === "นัด" ? "bg-[#EEEDFE] text-[#3C3489]" :
    label === "คะกัด" ? "bg-[#FEF3C7] text-[#92400E]" :
    "bg-[#F1EFE8] text-[#5F5E5A]";
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${cls}`}>{unit}</span>;
}

// Sticky left column pixel offsets
const COL_SKU_W  = 72;
const COL_ITEM_W = 176;
const COL_PACK_W = 58;
const COL_SIZE_W = 74;
const COL_TOT_W  = 82;
const COL_ITEM_L = COL_SKU_W;
const COL_PACK_L = COL_ITEM_L + COL_ITEM_W;
const COL_SIZE_L = COL_PACK_L + COL_PACK_W;
const COL_TOT_L  = COL_SIZE_L + COL_SIZE_W;

function PlanningGrid({
  partners,
  activeRound,
  roundClosed,
  roundStates,
  trips,
  onRefresh,
}: {
  partners: PlanPartner[];
  activeRound: Round | "ALL";
  roundClosed: boolean;
  roundStates: Record<number, RoundState>;
  trips: PlanTrip[];
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState<Record<number, string>>({});
  const [savingLine, setSavingLine] = useState<Record<number, boolean>>({});
  const [switchingRound, setSwitchingRound] = useState<Record<number, boolean>>({});
  const [custFilter, setCustFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"eggs" | "pack">("eggs");
  const [showZeroSku, setShowZeroSku] = useState(false);
  const [editingCell, setEditingCell] = useState<number | null>(null);

  useEffect(() => { setPending({}); setEditingCell(null); }, [partners]);

  const switchRound = async (orderId: number, round: Round) => {
    setSwitchingRound(p => ({ ...p, [orderId]: true }));
    try {
      await fetch("/api/orders/assign-round", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId], round }),
      });
      onRefresh();
    } finally {
      setSwitchingRound(p => ({ ...p, [orderId]: false }));
    }
  };

  const saveLineQty = async (lineId: number, eggValue: string, eggsPerPack: number) => {
    const eggs = eggValue === "" ? null : parseInt(eggValue, 10);
    const planningQty = eggs != null && !isNaN(eggs) && eggsPerPack > 0
      ? Math.round(eggs / eggsPerPack)
      : null;
    setSavingLine(p => ({ ...p, [lineId]: true }));
    try {
      await fetch("/api/orders/planning-lines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ orderItemId: lineId, planningQty }] }),
      });
    } finally {
      setSavingLine(p => ({ ...p, [lineId]: false }));
    }
  };

  const allOrders = useMemo(() =>
    partners.flatMap(p => p.orders.map(o => ({ ...o, partnerName: p.partnerName }))),
    [partners]);

  const custNames = useMemo(() =>
    Array.from(new Set(allOrders.map(o => o.partnerName))),
    [allOrders]);

  const filteredOrders = useMemo(() =>
    custFilter === "ALL" ? allOrders : allOrders.filter(o => o.partnerName === custFilter),
    [allOrders, custFilter]);

  // lineId lookup: orderId → sku → PlanLine
  const lineByOrderSku = useMemo(() => {
    const m: Record<number, Record<string, PlanLine>> = {};
    for (const o of filteredOrders) {
      m[o.id] = {};
      for (const l of o.lines) m[o.id][l.sku] = l;
    }
    return m;
  }, [filteredOrders]);

  // Unique SKU rows sorted by SKU code
  const skuRows = useMemo(() => {
    const map = new Map<string, {
      sku: string; itemName: string; sellingUnit: string; eggsPerPack: number;
      primarySize: string | null; secondarySize: string | null;
    }>();
    for (const o of filteredOrders)
      for (const l of o.lines)
        if (!map.has(l.sku))
          map.set(l.sku, { sku: l.sku, itemName: l.itemName, sellingUnit: l.sellingUnit,
            eggsPerPack: l.eggsPerPack, primarySize: l.primarySize, secondarySize: l.secondarySize });
    return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  }, [filteredOrders]);

  // pending stores egg values; cellValue converts to the selected viewMode
  const cellValue = useCallback((line: PlanLine): number => {
    const ep = pending[line.lineId];
    const planEggs = ep !== undefined
      ? (parseInt(ep, 10) || 0)
      : (line.planningQty ?? line.orderQty) * line.eggsPerPack;
    return viewMode === "eggs" ? planEggs : Math.round(planEggs / line.eggsPerPack);
  }, [pending, viewMode]);

  // Per-order header totals (always in eggs)
  const orderTotals = useMemo(() =>
    Object.fromEntries(filteredOrders.map(o => {
      const confEggs = o.lines.reduce((s, l) => s + l.orderQty * l.eggsPerPack, 0);
      const planEggs = o.lines.reduce((s, l) => {
        const ep = pending[l.lineId];
        if (ep !== undefined) return s + (parseInt(ep, 10) || 0);
        return s + (l.planningQty ?? l.orderQty) * l.eggsPerPack;
      }, 0);
      return [o.id, { confEggs, planEggs }];
    })),
    [filteredOrders, pending]);

  // Per-SKU row totals in the selected viewMode
  const skuTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const row of skuRows)
      m[row.sku] = filteredOrders.reduce((s, o) => {
        const line = lineByOrderSku[o.id]?.[row.sku];
        return s + (line ? cellValue(line) : 0);
      }, 0);
    return m;
  }, [skuRows, filteredOrders, lineByOrderSku, cellValue]);

  const activeSkuRows = showZeroSku ? skuRows : skuRows.filter(r => (skuTotals[r.sku] ?? 0) > 0);
  const roundLabel = typeof activeRound === "number" ? `R${activeRound}` : "ALL";
  const unit = viewMode === "eggs" ? "ฟอง" : "Pack";

  // Group filtered orders into trip columns: each group = { label, trip|null, orders[] }
  const tripGroups = useMemo(() => {
    const tripMap = new Map<number, PlanTrip>(trips.map(t => [t.id, t]));
    const groups: { label: string; trip: PlanTrip | null; orders: (PlanOrder & { partnerName: string })[] }[] = [];
    // Build ordered list: existing trips first (in trip number order), then unassigned
    const seenTrips = new Set<number>();
    for (const trip of trips) {
      const tripOrders = filteredOrders.filter(o => o.tripId === trip.id);
      if (tripOrders.length > 0) {
        groups.push({ label: trip.name ?? `Trip ${trip.tripNumber}`, trip, orders: tripOrders });
        seenTrips.add(trip.id);
      }
    }
    const unassigned = filteredOrders.filter(o => o.tripId == null);
    if (unassigned.length > 0) {
      groups.push({ label: "ยังไม่ assign trip", trip: null, orders: unassigned });
    }
    // Any orders whose trip isn't in the trips list (shouldn't happen normally)
    const orphaned = filteredOrders.filter(o => o.tripId != null && !tripMap.has(o.tripId));
    if (orphaned.length > 0) {
      groups.push({ label: "ยังไม่ assign trip", trip: null, orders: orphaned });
    }
    return groups;
  }, [filteredOrders, trips]);

  if (!allOrders.length) {
    return (
      <div className="py-16 text-center text-[#bbb] text-sm bg-white rounded-xl border border-[#E1E5EA]">
        ไม่มีออเดอร์ในรอบนี้
      </div>
    );
  }

  // Sticky cell bg helper (must match row stripe + hover handled via group)
  const stickyBg = (ri: number) => ri % 2 === 0 ? "bg-white" : "bg-[#fafbfc]";

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-[#E1E5EA] px-4 py-2.5">
        <span className="text-[11px] text-[#888]">ลูกค้า:</span>
        <button
          onClick={() => setCustFilter("ALL")}
          className={`px-2.5 py-0.5 text-[11px] rounded-full border font-medium transition-colors ${
            custFilter === "ALL" ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:border-[#999]"
          }`}
        >
          ทั้งหมด
        </button>
        {custNames.map(c => (
          <button
            key={c}
            onClick={() => setCustFilter(c === custFilter ? "ALL" : c)}
            className="px-2.5 py-0.5 text-[11px] rounded-full border font-medium transition-colors"
            style={custFilter === c
              ? { background: custBg(c), color: custColor(c), borderColor: custColor(c) }
              : { borderColor: "#d6d8dc", color: "#555" }}
          >
            {c}
          </button>
        ))}

        <div className="w-px h-4 bg-[#e3e5e8] mx-1" />

        <span className="text-[11px] text-[#888]">ตาราง:</span>
        {(["eggs", "pack"] as const).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-2 py-0.5 text-[11px] rounded border font-medium transition-colors ${
              viewMode === m ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:border-[#999]"
            }`}
          >
            {m === "eggs" ? "ฟอง" : "Pack"}
          </button>
        ))}

        <div className="w-px h-4 bg-[#e3e5e8] mx-1" />

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showZeroSku}
            onChange={e => setShowZeroSku(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#1E40AF]"
          />
          <span className="text-[11px] text-[#555]">แสดง SKU=0</span>
        </label>
      </div>

      {/* Pivot table */}
      {filteredOrders.length === 0 ? (
        <div className="py-8 text-center text-[#bbb] text-sm bg-white rounded-xl border border-[#E1E5EA]">
          ไม่มีออเดอร์ตรงกับตัวกรองนี้
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse text-[12px]" style={{ minWidth: "max-content" }}>
              <thead>
                {/* Trip group header row */}
                <tr className="bg-[#fafbfc]">
                  <th
                    colSpan={5}
                    className="sticky left-0 z-20 bg-[#fafbfc] border-b border-r border-[#e5e7eb]"
                    style={{ minWidth: COL_SKU_W + COL_ITEM_W + COL_PACK_W + COL_SIZE_W + COL_TOT_W }}
                  />
                  {tripGroups.map(group => (
                    <th
                      key={group.label + (group.trip?.id ?? "unassigned")}
                      colSpan={group.orders.length}
                      className={`text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5 text-center border-b border-l border-[#e5e7eb] ${
                        group.trip ? "text-[#1E40AF] bg-[#EFF6FF]" : "text-[#888] bg-[#fafbfc]"
                      }`}
                    >
                      {group.trip ? (
                        <span className="flex items-center justify-center gap-1.5">
                          🚛 {group.label}
                          {group.trip.vehiclePlate && <span className="font-mono">{group.trip.vehiclePlate}</span>}
                          {group.trip.driverName && <span className="font-normal normal-case">· {group.trip.driverName}</span>}
                        </span>
                      ) : group.label}
                    </th>
                  ))}
                </tr>
                {/* Column headers */}
                <tr>
                  <th className="sticky left-0 z-20 bg-[#fafbfc] text-left text-[10px] font-semibold uppercase tracking-wide text-[#888] px-3 py-2 border-b border-r border-[#e5e7eb]"
                    style={{ minWidth: COL_SKU_W }}>SKU</th>
                  <th className="sticky z-20 bg-[#fafbfc] text-left text-[10px] font-semibold uppercase tracking-wide text-[#888] px-3 py-2 border-b border-r border-[#e5e7eb]"
                    style={{ left: COL_ITEM_L, minWidth: COL_ITEM_W }}>รายการ</th>
                  <th className="sticky z-20 bg-[#fafbfc] text-center text-[10px] font-semibold uppercase tracking-wide text-[#888] px-2 py-2 border-b border-r border-[#e5e7eb]"
                    style={{ left: COL_PACK_L, minWidth: COL_PACK_W }}>Pack</th>
                  <th className="sticky z-20 bg-[#fafbfc] text-center text-[10px] font-semibold uppercase tracking-wide text-[#888] px-2 py-2 border-b border-r border-[#e5e7eb]"
                    style={{ left: COL_SIZE_L, minWidth: COL_SIZE_W }}>เบอร์</th>
                  <th className="sticky z-20 bg-[#fafbfc] text-right text-[10px] font-semibold uppercase tracking-wide text-[#888] px-3 py-2 border-b border-r border-[#e5e7eb]"
                    style={{ left: COL_TOT_L, minWidth: COL_TOT_W }}>รวม ({unit})</th>
                  {tripGroups.flatMap(group => group.orders.map(o => {
                    const tot = orderTotals[o.id] ?? { confEggs: 0, planEggs: 0 };
                    const isInTrip = o.tripId != null;
                    return (
                      <th
                        key={o.id}
                        className={`border-b border-l border-[#e5e7eb] px-2 py-2 align-top ${isInTrip ? "bg-[#F8FAFF]" : "bg-white"}`}
                        style={{ minWidth: 116 }}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <div className="flex items-center gap-1 w-full">
                            <CustPill name={o.partnerName} />
                            <div className="flex items-center gap-0 ml-auto">
                              {switchingRound[o.id]
                                ? <Loader2 className="w-3 h-3 animate-spin text-[#aaa]" />
                                : ([1, 2, 3, 4] as Round[]).map(r => {
                                  const isCurrent = o.productionRound === r;
                                  const targetClosed = roundStates[r]?.closed ?? false;
                                  const disabled = roundClosed || targetClosed;
                                  return (
                                    <button
                                      key={r}
                                      disabled={disabled || isCurrent}
                                      onClick={() => !isCurrent && !disabled && switchRound(o.id, r)}
                                      title={targetClosed ? `R${r} ปิดรอบแล้ว` : `ย้ายไป R${r}`}
                                      className={`px-0.5 py-0 text-[9px] font-bold rounded transition-colors ${
                                        isCurrent ? "bg-[#1a1a1a] text-white" :
                                        disabled ? "text-[#ccc] cursor-not-allowed" :
                                        "text-[#bbb] hover:text-[#333] hover:bg-[#f0f0f0]"
                                      }`}
                                    >R{r}</button>
                                  );
                                })
                              }
                            </div>
                          </div>
                          <div className="text-[10px] font-medium text-[#555] leading-tight truncate w-full" title={o.deliverySiteName}>
                            {o.deliverySiteName}
                          </div>
                          {o.poNumber && (
                            <code className="text-[9px] font-mono text-[#0C447C] bg-[#E6F1FB] px-1 rounded truncate w-full block">
                              {o.poNumber}
                            </code>
                          )}
                          <div className="text-[9px] text-[#888] mt-0.5 flex items-center gap-1">
                            <span>Confirmed 🔒</span>
                            <span className="tabular-nums font-medium">{fmtNum(tot.confEggs)}</span>
                          </div>
                          <div className="text-[10px] font-bold leading-tight flex items-center gap-1" style={{ color: custColor(o.partnerName) }}>
                            <span>Plan {roundLabel}</span>
                            <span className="tabular-nums">{fmtNum(tot.planEggs)}</span>
                          </div>
                          {tot.planEggs !== tot.confEggs && (
                            <div className={`text-[10px] font-bold tabular-nums ${tot.planEggs > tot.confEggs ? "text-green-600" : "text-red-600"}`}>
                              Δ Plan {tot.planEggs > tot.confEggs ? `+${fmtNum(tot.planEggs - tot.confEggs)}` : fmtNum(tot.planEggs - tot.confEggs)}
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  }))}
                </tr>
              </thead>
              <tbody>
                {activeSkuRows.map((row, ri) => {
                  const rowTotal = skuTotals[row.sku] ?? 0;
                  const bg = stickyBg(ri);
                  return (
                    <tr key={row.sku} className="group hover:bg-[#F0F6FF] transition-colors">
                      <td className={`sticky left-0 z-10 ${bg} group-hover:bg-[#F0F6FF] px-3 py-1.5 border-b border-r border-[#f0f0f0] font-mono text-[11px] text-[#0C447C] whitespace-nowrap`}
                        style={{ minWidth: COL_SKU_W }}>
                        {row.sku}
                      </td>
                      <td className={`sticky z-10 ${bg} group-hover:bg-[#F0F6FF] px-3 py-1.5 border-b border-r border-[#f0f0f0] font-medium text-[#1a1a1a] leading-tight`}
                        style={{ left: COL_ITEM_L, minWidth: COL_ITEM_W }}>
                        {row.itemName}
                      </td>
                      <td className={`sticky z-10 ${bg} group-hover:bg-[#F0F6FF] px-2 py-1.5 border-b border-r border-[#f0f0f0] text-center`}
                        style={{ left: COL_PACK_L, minWidth: COL_PACK_W }}>
                        <PackPill unit={row.sellingUnit} />
                      </td>
                      <td className={`sticky z-10 ${bg} group-hover:bg-[#F0F6FF] px-2 py-1.5 border-b border-r border-[#f0f0f0] text-center`}
                        style={{ left: COL_SIZE_L, minWidth: COL_SIZE_W }}>
                        <SizePill primary={row.primarySize} secondary={row.secondarySize} />
                      </td>
                      <td className={`sticky z-10 ${bg} group-hover:bg-[#F0F6FF] px-3 py-1.5 border-b border-r border-[#f0f0f0] text-right tabular-nums font-bold text-[#1a1a1a]`}
                        style={{ left: COL_TOT_L, minWidth: COL_TOT_W }}>
                        {rowTotal > 0 ? fmtNum(rowTotal) : "—"}
                      </td>
                      {tripGroups.flatMap(group => group.orders).map(o => {
                        const line = lineByOrderSku[o.id]?.[row.sku];
                        if (!line) {
                          return (
                            <td key={o.id} className="px-2 py-1.5 border-b border-l border-[#f0f0f0] text-center text-[12px] text-[#ddd]">
                              —
                            </td>
                          );
                        }
                        const val = cellValue(line);
                        const isEditing = editingCell === line.lineId;
                        const isSaving = savingLine[line.lineId];
                        const hasPending = pending[line.lineId] !== undefined;

                        return (
                          <td
                            key={o.id}
                            className={`px-1 py-1 border-b border-l border-[#f0f0f0] ${
                              isEditing ? "bg-[#EFF6FF]" : hasPending ? "bg-[#FEFCE8]" : ""
                            }`}
                            style={{ minWidth: 116 }}
                          >
                            {roundClosed ? (
                              <div className="text-right px-2 py-1 text-[12px] tabular-nums text-[#555]">
                                {val > 0 ? fmtNum(val) : "—"}
                              </div>
                            ) : isEditing ? (
                              <div className="flex items-center justify-end gap-0.5 pr-1">
                                <input
                                  type="number"
                                  min={0}
                                  autoFocus
                                  defaultValue={val || ""}
                                  onBlur={e => {
                                    setEditingCell(null);
                                    const inputNum = parseInt(e.target.value, 10);
                                    if (isNaN(inputNum)) return;
                                    const eggs = viewMode === "pack"
                                      ? inputNum * line.eggsPerPack
                                      : inputNum;
                                    const eggStr = String(eggs);
                                    setPending(p => ({ ...p, [line.lineId]: eggStr }));
                                    saveLineQty(line.lineId, eggStr, line.eggsPerPack);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                    if (e.key === "Escape") {
                                      setPending(p => { const n = { ...p }; delete n[line.lineId]; return n; });
                                      setEditingCell(null);
                                    }
                                  }}
                                  className="w-20 text-right text-[12px] border border-[#2563EB] rounded px-1.5 py-0.5 bg-white focus:outline-none"
                                />
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-[#aaa] shrink-0" />}
                              </div>
                            ) : (
                              <button
                                className={`w-full text-right px-2 py-1 rounded hover:bg-[#DBEAFE] transition-colors text-[12px] tabular-nums ${
                                  hasPending ? "text-[#1E40AF] font-bold" : val > 0 ? "text-[#333]" : "text-[#ccc]"
                                }`}
                                onClick={() => setEditingCell(line.lineId)}
                              >
                                {val > 0 ? fmtNum(val) : "—"}
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-[#aaa] inline ml-1" />}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trip Manager ──────────────────────────────────────────────────────────────

function TripManager({
  date,
  trips,
  partners,
  onRefresh,
}: {
  date: string;
  trips: PlanTrip[];
  partners: PlanPartner[];
  onRefresh: () => void;
}) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [driverList, setDriverList] = useState<DriverOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", vehicleId: "", driverId: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", vehicleId: "", driverId: "" });
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/vehicles").then(r => r.json()).then((data: any[]) =>
      setVehicles(data.map(v => ({ id: v.id, plateNumber: v.plateNumber || v.plate_number, vehicleType: v.vehicleType || v.vehicle_type })))
    ).catch(() => {});
    fetch("/api/drivers").then(r => r.json()).then((data: any[]) =>
      setDriverList(data.map(d => ({ id: d.id, name: d.name })))
    ).catch(() => {});
  }, []);

  // All confirmed orders for this date (with partner info flat)
  const allOrders = useMemo(() =>
    partners.flatMap(p => p.orders
      .filter(o => o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")
      .map(o => ({ ...o, partnerName: p.partnerName }))
    ), [partners]);

  const unassigned = useMemo(() => allOrders.filter(o => o.tripId === null), [allOrders]);

  // orders grouped by tripId for quick lookup
  const ordersByTrip = useMemo(() => {
    const m: Record<number, (PlanOrder & { partnerName: string })[]> = {};
    for (const o of allOrders) {
      if (o.tripId != null) {
        if (!m[o.tripId]) m[o.tripId] = [];
        m[o.tripId].push(o);
      }
    }
    for (const tid in m) {
      m[tid].sort((a, b) => (a.stopOrder ?? 999) - (b.stopOrder ?? 999));
    }
    return m;
  }, [allOrders]);

  const createTrip = async () => {
    setSaving(true);
    try {
      await fetch("/api/orders/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: date,
          name: createForm.name || undefined,
          vehicleId: createForm.vehicleId ? parseInt(createForm.vehicleId) : null,
          driverId: createForm.driverId ? parseInt(createForm.driverId) : null,
        }),
      });
      setCreating(false);
      setCreateForm({ name: "", vehicleId: "", driverId: "" });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (tripId: number) => {
    setSaving(true);
    try {
      await fetch(`/api/orders/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name || null,
          vehicleId: editForm.vehicleId ? parseInt(editForm.vehicleId) : null,
          driverId: editForm.driverId ? parseInt(editForm.driverId) : null,
        }),
      });
      setEditingId(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const deleteTrip = async (tripId: number) => {
    if (!confirm("ลบ Trip นี้? ออเดอร์ที่อยู่ใน Trip จะถูกย้ายกลับไปที่ยังไม่ assign")) return;
    await fetch(`/api/orders/trips/${tripId}`, { method: "DELETE" });
    onRefresh();
  };

  const assignToTrip = async (orderIds: number[], tripId: number | null) => {
    const key = tripId ?? -1;
    setAssigning(p => ({ ...p, [key]: true }));
    try {
      await fetch("/api/orders/assign-trip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, tripId }),
      });
      onRefresh();
    } finally {
      setAssigning(p => ({ ...p, [key]: false }));
    }
  };

  const moveStop = async (trip: PlanTrip, orderId: number, dir: -1 | 1) => {
    const stops = ordersByTrip[trip.id] ?? [];
    const idx = stops.findIndex(o => o.id === orderId);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= stops.length) return;
    const reordered = [...stops];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    await fetch("/api/orders/reorder-stops", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: trip.id, orderedIds: reordered.map(o => o.id) }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Create trip button */}
      <div className="flex items-center gap-3">
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl border-2 border-dashed border-[#d6d8dc] text-[#888] hover:border-[#1E40AF] hover:text-[#1E40AF] transition-colors bg-white"
          >
            + สร้าง Trip ใหม่
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white border border-[#1E40AF] rounded-xl px-4 py-2.5 shadow-sm">
            <input
              type="text"
              placeholder="ชื่อ Trip (ไม่บังคับ)"
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="text-[13px] border border-[#e5e7eb] rounded px-2 py-1 w-36 focus:outline-none focus:border-[#1E40AF]"
            />
            <select
              value={createForm.vehicleId}
              onChange={e => setCreateForm(f => ({ ...f, vehicleId: e.target.value }))}
              className="text-[12px] border border-[#e5e7eb] rounded px-2 py-1 focus:outline-none"
            >
              <option value="">— ยานพาหนะ —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plateNumber} ({v.vehicleType})</option>
              ))}
            </select>
            <select
              value={createForm.driverId}
              onChange={e => setCreateForm(f => ({ ...f, driverId: e.target.value }))}
              className="text-[12px] border border-[#e5e7eb] rounded px-2 py-1 focus:outline-none"
            >
              <option value="">— พนักงานขับรถ —</option>
              {driverList.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={createTrip}
              disabled={saving}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50 flex items-center gap-1"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              สร้าง
            </button>
            <button onClick={() => setCreating(false)} className="px-2 py-1.5 text-[12px] text-[#888] hover:text-[#333]">
              ยกเลิก
            </button>
          </div>
        )}
        <span className="text-[11px] text-[#aaa]">{trips.length} trip{trips.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Trip cards */}
      {trips.length === 0 && !creating && (
        <div className="py-10 text-center text-[#bbb] text-[13px] bg-white rounded-xl border border-dashed border-[#e3e5e8]">
          ยังไม่มี Trip — กด "+ สร้าง Trip ใหม่" เพื่อเริ่มจัดกลุ่มออเดอร์
        </div>
      )}

      {trips.map(trip => {
        const stops = ordersByTrip[trip.id] ?? [];
        const tripEggs = stops.reduce((s, o) =>
          s + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0);
        const isEditing = editingId === trip.id;

        return (
          <div key={trip.id} className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            {/* Trip header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E1E5EA] bg-[#F8FAFF]">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[11px] font-bold text-white bg-[#1E40AF] rounded px-2 py-0.5 shrink-0">
                  Trip {trip.tripNumber}
                </span>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="ชื่อ Trip"
                      className="text-[12px] border border-[#e5e7eb] rounded px-2 py-0.5 w-32 focus:outline-none focus:border-[#1E40AF]"
                    />
                    <select
                      value={editForm.vehicleId}
                      onChange={e => setEditForm(f => ({ ...f, vehicleId: e.target.value }))}
                      className="text-[11px] border border-[#e5e7eb] rounded px-1.5 py-0.5 focus:outline-none"
                    >
                      <option value="">— ยานพาหนะ —</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plateNumber}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.driverId}
                      onChange={e => setEditForm(f => ({ ...f, driverId: e.target.value }))}
                      className="text-[11px] border border-[#e5e7eb] rounded px-1.5 py-0.5 focus:outline-none"
                    >
                      <option value="">— พนักงานขับรถ —</option>
                      {driverList.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveEdit(trip.id)}
                      disabled={saving}
                      className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                      บันทึก
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-[11px] text-[#888]">ยกเลิก</button>
                  </>
                ) : (
                  <>
                    {trip.name && <span className="text-[13px] font-semibold text-[#1a1a1a] truncate">{trip.name}</span>}
                    {trip.vehiclePlate && (
                      <span className="text-[11px] text-[#555] bg-[#f0f0f0] px-1.5 py-0.5 rounded font-mono shrink-0">
                        🚛 {trip.vehiclePlate}
                      </span>
                    )}
                    {trip.driverName && (
                      <span className="text-[11px] text-[#555] shrink-0">👤 {trip.driverName}</span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#888] tabular-nums">{stops.length} stops · {fmtNum(tripEggs)} ฟอง</span>
                {!isEditing && (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(trip.id);
                        setEditForm({
                          name: trip.name ?? "",
                          vehicleId: trip.vehicleId ? String(trip.vehicleId) : "",
                          driverId: trip.driverId ? String(trip.driverId) : "",
                        });
                      }}
                      className="px-2 py-1 text-[11px] rounded border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => deleteTrip(trip.id)}
                      className="px-2 py-1 text-[11px] rounded border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]"
                    >
                      ลบ
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stops list */}
            {stops.length === 0 ? (
              <div className="px-4 py-3 text-[12px] text-[#bbb] italic">ยังไม่มีออเดอร์ใน Trip นี้</div>
            ) : (
              <div className="divide-y divide-[#f5f5f5]">
                {stops.map((o, idx) => {
                  const eggs = o.lines.reduce((s, l) => s + l.orderQty * l.eggsPerPack, 0);
                  return (
                    <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafcff]">
                      <span className="text-[10px] font-bold text-[#888] w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5 flex-col shrink-0">
                        <button
                          onClick={() => moveStop(trip, o.id, -1)}
                          disabled={idx === 0}
                          className="w-5 h-4 flex items-center justify-center text-[10px] text-[#aaa] hover:text-[#333] disabled:opacity-30"
                        >▲</button>
                        <button
                          onClick={() => moveStop(trip, o.id, 1)}
                          disabled={idx === stops.length - 1}
                          className="w-5 h-4 flex items-center justify-center text-[10px] text-[#aaa] hover:text-[#333] disabled:opacity-30"
                        >▼</button>
                      </div>
                      <CustPill name={o.partnerName} />
                      {o.poNumber && (
                        <code className="text-[10px] font-mono text-[#0C447C] bg-[#E6F1FB] px-1.5 py-0.5 rounded shrink-0">
                          {o.poNumber}
                        </code>
                      )}
                      <span className="text-[12px] text-[#555] truncate">{o.deliverySiteName}</span>
                      <span className="ml-auto text-[12px] font-bold tabular-nums text-[#1a1a1a] shrink-0">
                        {fmtNum(eggs)} ฟอง
                      </span>
                      <button
                        onClick={() => assignToTrip([o.id], null)}
                        className="text-[10px] text-[#aaa] hover:text-[#DC2626] px-1.5 py-0.5 rounded hover:bg-[#FEF2F2] shrink-0"
                        title="ย้ายออกจาก Trip"
                      >
                        × ย้ายออก
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned orders pool */}
      {unassigned.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#FCD34D] flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#92400E]">🔔 ออเดอร์ยังไม่ assign Trip</span>
            <span className="bg-[#F59E0B] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {unassigned.length}
            </span>
          </div>
          <div className="divide-y divide-[#FEF3C7]">
            {unassigned.map(o => {
              const eggs = o.lines.reduce((s, l) => s + l.orderQty * l.eggsPerPack, 0);
              return (
                <div key={o.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FEF9EC]">
                  <CustPill name={o.partnerName} />
                  {o.poNumber && (
                    <code className="text-[10px] font-mono text-[#0C447C] bg-[#E6F1FB] px-1.5 py-0.5 rounded">
                      {o.poNumber}
                    </code>
                  )}
                  <span className="text-[12px] text-[#555] truncate">{o.deliverySiteName}</span>
                  <span className="ml-auto text-[12px] font-bold tabular-nums text-[#1a1a1a] shrink-0">
                    {fmtNum(eggs)} ฟอง
                  </span>
                  {/* Assign buttons — one per trip */}
                  <div className="flex items-center gap-1 shrink-0">
                    {trips.map(t => (
                      <button
                        key={t.id}
                        onClick={() => assignToTrip([o.id], t.id)}
                        disabled={assigning[t.id]}
                        className="px-2 py-1 text-[11px] font-semibold rounded border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] hover:bg-[#DBEAFE] disabled:opacity-50 flex items-center gap-1 shrink-0"
                      >
                        {assigning[t.id] && <Loader2 className="w-3 h-3 animate-spin" />}
                        + Trip {t.tripNumber}
                      </button>
                    ))}
                    {trips.length === 0 && (
                      <span className="text-[11px] text-[#aaa] italic">สร้าง Trip ก่อน</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BOM view ───────────────────────────────────────────────────────────────────

function BomView({ partners }: { partners: PlanPartner[] }) {
  const fgMap = useMemo(() => {
    const m: Record<string, { name: string; unit: string; custQtys: Record<string, number>; total: number }> = {};
    for (const p of partners) for (const o of p.orders) for (const l of o.lines) {
      if (!m[l.sku]) m[l.sku] = { name: l.itemName, unit: l.sellingUnit, custQtys: {}, total: 0 };
      m[l.sku].custQtys[p.partnerName] = (m[l.sku].custQtys[p.partnerName] ?? 0) + l.orderQty;
      m[l.sku].total += l.orderQty;
    }
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [partners]);

  const eggsBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of partners) for (const o of p.orders) for (const l of o.lines) {
      const k = l.secondarySize ? `${l.primarySize}-${l.secondarySize}` : (l.primarySize ?? "?");
      m[k] = (m[k] ?? 0) + l.orderQty * l.eggsPerPack;
    }
    return Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => a[0].localeCompare(b[0]));
  }, [partners]);

  const totalEggs = eggsBySize.reduce((s, [, v]) => s + v, 0);
  const custNames = Array.from(new Set(partners.map(p => p.partnerName)));

  if (!partners.length) return (
    <div className="py-16 text-center text-[#bbb] text-sm bg-white rounded-xl border border-[#E1E5EA]">
      ไม่มีออเดอร์ในรอบนี้
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#E1E5EA] bg-[#fafbfc] text-[11px] font-bold uppercase tracking-wider text-[#444]">
          Finished Goods Required
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#fafbfc]">
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">SKU</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#888] uppercase">Item</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#888] uppercase">Unit</th>
                {custNames.map(c => (
                  <th key={c} className="text-right px-3 py-2 text-[10px] font-semibold uppercase" style={{ color: custColor(c) }}>{c}</th>
                ))}
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {fgMap.map(([sku, row]) => (
                <tr key={sku} className="border-b border-[#f5f5f5] hover:bg-[#fafcff]">
                  <td className="px-4 py-2 font-mono text-[#0C447C]">{sku}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-[#888]">{row.unit || "—"}</td>
                  {custNames.map(c => (
                    <td key={c} className="px-3 py-2 text-right tabular-nums text-[#555]">
                      {row.custQtys[c] ? fmtNum(row.custQtys[c]) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtNum(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#E1E5EA] bg-[#fafbfc] text-[11px] font-bold uppercase tracking-wider text-[#444]">
          Raw Egg Requirements
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#fafbfc]">
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">Size</th>
              <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">ฟอง</th>
              <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">ถาด (30)</th>
              <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">% ของทั้งหมด</th>
            </tr>
          </thead>
          <tbody>
            {eggsBySize.map(([size, eggs]) => {
              const cls = SIZE_PILL_CLS[size.split("-")[0]] ?? "bg-[#F1EFE8] text-[#5F5E5A]";
              return (
                <tr key={size} className="border-b border-[#f5f5f5]">
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>เบอร์ {size}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtNum(eggs)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[#555]">{fmtNum(Math.ceil(eggs / 30))}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[#888]">
                    {totalEggs > 0 ? ((eggs / totalEggs) * 100).toFixed(1) + "%" : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-[#e5e7eb] bg-[#fafbfc] font-bold">
              <td className="px-4 py-2 text-[11px] uppercase text-[#555]">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtNum(totalEggs)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-[#555]">{fmtNum(Math.ceil(totalEggs / 30))}</td>
              <td className="px-4 py-2 text-right text-[#888]">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Planning workflow section ──────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  "1. Confirmed orders",
  "2. Planning qty",
  "3. Trip plan",
  "4. Confirm dispatch qty",
  "5. Picklist",
] as const;

function PlanningWorkflow({
  partners,
  activeRound,
}: {
  partners: PlanPartner[];
  activeRound: Round | "ALL";
}) {
  const poQty = useMemo(() =>
    partners.reduce((s, p) => s + p.orders.reduce((os, o) =>
      os + o.lines.reduce((ls, l) => ls + l.poQty * l.eggsPerPack, 0), 0), 0),
    [partners]);

  const confirmedQty = useMemo(() =>
    partners.reduce((s, p) => s + p.orders.reduce((os, o) =>
      os + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0), 0),
    [partners]);

  const planningQty = useMemo(() =>
    partners.reduce((s, p) => s + p.orders.reduce((os, o) =>
      os + o.lines.reduce((ls, l) => ls + (l.planningQty ?? l.orderQty) * l.eggsPerPack, 0), 0), 0),
    [partners]);

  const poCount = partners.reduce((s, p) => s + p.orders.length, 0);

  if (poCount === 0) return null;

  const roundLabel = activeRound === "ALL" ? "ALL" : `R${activeRound}`;

  const metrics = [
    {
      label: "PO QTY",
      value: fmtNum(poQty),
      sub: `ฟอง · ${poCount} PO`,
      locked: true,
      active: false,
    },
    {
      label: "CONFIRMED QTY",
      value: fmtNum(confirmedQty),
      sub: "ฟอง",
      locked: true,
      active: false,
    },
    {
      label: `PLANNING QTY ${roundLabel}`,
      value: fmtNum(planningQty),
      sub: "ปรับยอด · เลือกประเภทรถ",
      locked: false,
      active: true,
    },
    {
      label: "DISPATCH QTY",
      value: "—",
      sub: "รอยืนยันส่งจริง",
      locked: false,
      active: false,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e3e5e8] overflow-hidden">
      {/* Metric boxes */}
      <div className="flex items-stretch">
        {metrics.map((m, i) => (
          <div key={m.label} className="flex items-stretch flex-1 min-w-0">
            <div className={`flex-1 px-5 py-4 ${m.active ? "bg-[#EFF6FF] border-t-2 border-t-[#2563EB]" : ""}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
                m.active ? "text-[#1E40AF]" : "text-[#888]"
              }`}>
                {m.label}
              </div>
              <div className={`text-[22px] font-bold tabular-nums leading-tight flex items-baseline gap-1 ${
                m.active ? "text-[#1E40AF]" : m.value === "—" ? "text-[#ccc]" : "text-[#1a1a1a]"
              }`}>
                {m.locked && <span className="text-[13px]">🔒</span>}
                {m.value}
              </div>
              <div className={`text-[11px] mt-0.5 ${m.active ? "text-[#3B82F6]" : "text-[#aaa]"}`}>
                {m.sub}
              </div>
            </div>
            {i < metrics.length - 1 && (
              <div className="flex items-center px-1 text-[#ccc] text-[18px] shrink-0 border-l border-[#f0f0f0]">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Unassigned orders section ──────────────────────────────────────────────────

function UnassignedSection({
  orders,
  activeRound,
  roundClosed,
  onAssigned,
}: {
  orders: (PlanOrder & { partnerName: string })[];
  activeRound: Round;
  roundClosed: boolean;
  onAssigned: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { setSelected(new Set()); }, [orders]);

  if (orders.length === 0) return null;

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const assign = async (ids: number[]) => {
    if (!ids.length) return;
    setAssigning(true);
    try {
      await fetch("/api/orders/assign-round", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids, round: activeRound }),
      });
      onAssigned();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#FCD34D]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#92400E]">🔔 ออเดอร์ที่รอรับเข้ารอบ</span>
          <span className="bg-[#F59E0B] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            {orders.length} ออเดอร์
          </span>
        </div>
        <div className="flex items-center gap-2">
          {roundClosed && (
            <span className="text-[11px] text-[#92400E] font-medium">🔒 R{activeRound} ปิดรอบแล้ว — ไม่รับออเดอร์ใหม่</span>
          )}
          {selected.size > 0 && selected.size < orders.length && (
            <button
              onClick={() => assign(Array.from(selected))}
              disabled={assigning || roundClosed}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50 flex items-center gap-1.5"
            >
              {assigning && <Loader2 className="w-3 h-3 animate-spin" />}
              รับรายการที่เลือกเข้ารอบ R{activeRound}
            </button>
          )}
          <button
            onClick={() => assign(orders.map(o => o.id))}
            disabled={assigning || roundClosed}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-1.5"
          >
            {assigning && <Loader2 className="w-3 h-3 animate-spin" />}
            รับทั้งหมดเข้ารอบ R{activeRound}
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-[11px] text-[#92400E] border-b border-[#FEF3C7]">
        ออเดอร์ที่ยืนยันแล้วจะต้องถูกรับเข้ารอบโดยผู้วางแผนก่อนจึงจะใช้ยืนยันจำนวนวางแผนได้
      </div>

      <div className="divide-y divide-[#FEF3C7]">
        {orders.map(o => {
          const eggs = orderEggs(o);
          const isChecked = selected.has(o.id);
          return (
            <div
              key={o.id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FEF9EC] transition-colors ${isChecked ? "bg-[#FEF3C7]" : ""}`}
              onClick={() => toggle(o.id)}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(o.id)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 rounded accent-[#1E40AF] cursor-pointer"
              />
              <CustPill name={o.partnerName} />
              {o.poNumber && (
                <code className="font-mono text-[11px] text-[#0C447C] bg-[#E6F1FB] px-1.5 py-0.5 rounded">
                  {o.poNumber}
                </code>
              )}
              <span className="text-[12px] text-[#555]">{o.deliverySiteName}</span>
              <span className="ml-auto text-[13px] font-bold tabular-nums text-[#1a1a1a]">
                {fmtNum(eggs)} ฟอง
              </span>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="px-4 py-2 text-[11px] text-[#92400E] border-t border-[#FCD34D] bg-[#FEF9EC]">
          เลือกแล้ว {selected.size} รายการ ·{" "}
          <button onClick={() => setSelected(new Set())} className="underline hover:no-underline">
            ล้างการเลือก
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DailyPlan() {
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  const [date, setDate] = useState(today);
  const [activeRound, setActiveRound] = useState<Round | "ALL">(1 as Round);
  const [subtab, setSubtab] = useState<SubTab>("demand");
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/orders/daily?date=${date}`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allConfirmedOrders = useMemo((): (PlanOrder & { partnerName: string })[] => {
    if (!data) return [];
    return data.partners.flatMap(p =>
      p.orders
        .filter(o => o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")
        .map(o => ({ ...o, partnerName: p.partnerName }))
    );
  }, [data]);

  const unassignedOrders = useMemo(() =>
    allConfirmedOrders.filter(o => o.productionRound === null),
    [allConfirmedOrders]);

  const roundCounts: Record<number, number> = useMemo(() => {
    const m: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const o of allConfirmedOrders) {
      if (o.productionRound != null) m[o.productionRound] = (m[o.productionRound] ?? 0) + 1;
    }
    return m;
  }, [allConfirmedOrders]);

  const filteredPartners = useMemo((): PlanPartner[] => {
    if (!data) return [];
    return data.partners
      .map(p => ({
        ...p,
        orders: p.orders.filter(o => {
          const isConfirmed = o.status === "confirmed" || o.status === "in_production" || o.status === "delivered";
          if (!isConfirmed) return false;
          if (activeRound === "ALL") return o.productionRound !== null;
          return o.productionRound === (activeRound as unknown as number);
        }),
      }))
      .filter(p => p.orders.length > 0);
  }, [data, activeRound]);

  const totalEggsInView = useMemo(() =>
    filteredPartners.reduce((s, p) => s + p.orders.reduce((os, o) => os + orderEggs(o), 0), 0),
    [filteredPartners]);

  const dateLabel = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const label = d.toLocaleDateString("th-TH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    if (date === today) return label + " — วันนี้";
    if (date === tomorrow) return label + " — พรุ่งนี้";
    return label;
  }, [date, today, tomorrow]);

  const activeRoundNum: Round = (typeof activeRound === "number" ? activeRound : 1) as Round;

  return (
    <div className="min-h-screen bg-[#F6F7F8]">
      <div className="max-w-[1400px] mx-auto px-6 py-5 space-y-4">

        {/* Date header bar */}
        <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
              วันที่ Load-in
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setDate(d => addDays(d, -1))}
                className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">‹</button>
              <input
                type="date"
                value={date}
                onChange={e => e.target.value && setDate(e.target.value)}
                className="h-8 px-2 text-[13px] border border-[#e3e5e8] rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
              />
              <button onClick={() => setDate(d => addDays(d, 1))}
                className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">›</button>
            </div>
            <button onClick={() => setDate(today)}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${date === today ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"}`}>
              วันนี้
            </button>
            <button onClick={() => setDate(tomorrow)}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${date === tomorrow ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"}`}>
              พรุ่งนี้
            </button>
            <span className="text-[13px] font-medium text-[#1a1a1a] ml-1">{dateLabel}</span>
            <span className="ml-auto text-[12px] text-[#888] tabular-nums">
              {allConfirmedOrders.length} ออเดอร์ · {fmtNum(allConfirmedOrders.reduce((s, o) => s + orderEggs(o), 0))} ฟอง
            </span>
            <button onClick={fetchData} disabled={loading} className="p-1.5 rounded hover:bg-[#ebebeb]">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#888]" /> : <RefreshCw className="w-3.5 h-3.5 text-[#888]" />}
            </button>
          </div>
        </div>

        {/* Round tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mr-2">รอบวางแผน:</span>
          {([1, 2, 3, 4] as Round[]).map(r => {
            const active = activeRound === r;
            const count = roundCounts[r] ?? 0;
            const isClosed = data?.roundStates?.[r]?.closed ?? false;
            return (
              <button
                key={r}
                onClick={() => setActiveRound(r)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-all ${
                  active
                    ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                    : isClosed
                      ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC] hover:border-green-500"
                      : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
                }`}
              >
                {isClosed ? <span className="text-[10px]">🔒</span> : active ? <span className="text-[10px]">▶</span> : null}
                R{r}
                <span className={`text-[11px] font-bold tabular-nums ${active ? "text-white/70" : isClosed ? "text-green-600" : "text-[#bbb]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setActiveRound("ALL" as any)}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-all ${
              activeRound === ("ALL" as any)
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
            }`}
          >
            ALL
          </button>
        </div>

        {/* Round status banner — only for specific rounds */}
        {typeof activeRound === "number" && (
          <RoundStatusBanner
            date={date}
            round={activeRound}
            state={data?.roundStates?.[activeRound]}
            onChanged={fetchData}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-[#e3e5e8]">
            <Loader2 className="w-5 h-5 animate-spin text-[#aaa]" />
          </div>
        ) : (
          <>
            <UnassignedSection
              orders={unassignedOrders}
              activeRound={activeRoundNum}
              roundClosed={data?.roundStates?.[activeRoundNum]?.closed ?? false}
              onAssigned={fetchData}
            />

            {/* Sub-tabs */}
            <div className="flex items-end gap-0 border-b border-[#e3e5e8]">
              {([
                { key: "demand", label: "📊 Demand" },
                { key: "bom",    label: "🥚 BOM" },
                { key: "trip",    label: "🚛 แผน Trip" },
                { key: "picking", label: "📋 ใบน้อย" },
              ] as const).map(({ key, label }) => {
                const disabled = key === "picking";
                return (
                  <button
                    key={key}
                    onClick={() => !disabled && setSubtab(key as SubTab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      subtab === key
                        ? "border-[#1a1a1a] text-[#1a1a1a]"
                        : disabled
                          ? "border-transparent text-[#bbb] cursor-not-allowed"
                          : "border-transparent text-[#888] hover:text-[#555]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}

              <div className="ml-auto self-center text-[12px] font-medium text-[#555] tabular-nums pb-2">
                {filteredPartners.reduce((s, p) => s + p.orders.length, 0)} ออเดอร์ · {fmtNum(totalEggsInView)} ฟอง
              </div>
            </div>

            {/* Qty metrics */}
            <PlanningWorkflow partners={filteredPartners} activeRound={activeRound} />

            {/* Round content */}
            {subtab === "demand" ? (
              <PlanningGrid
                partners={filteredPartners}
                activeRound={activeRound}
                roundClosed={typeof activeRound === "number" ? (data?.roundStates?.[activeRound]?.closed ?? false) : false}
                roundStates={data?.roundStates ?? {}}
                trips={data?.trips ?? []}
                onRefresh={fetchData}
              />
            ) : subtab === "trip" ? (
              <TripManager
                date={date}
                trips={data?.trips ?? []}
                partners={filteredPartners.length > 0 ? filteredPartners : (data?.partners ?? [])}
                onRefresh={fetchData}
              />
            ) : (
              <BomView partners={filteredPartners} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
