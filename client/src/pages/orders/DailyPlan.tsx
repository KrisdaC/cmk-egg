import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useLocation } from "wouter";
import { Loader2, RefreshCw, Pencil, Printer } from "lucide-react";
import { OverviewTab } from "./DailyPlanOverview";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlanLine {
  lineId: number;
  itemId: number;
  sku: string;
  itemName: string;
  sellingUnit: string;
  packUnit: string;
  eggsPerPack: number;
  eggsPerSellingUnit?: number;
  primarySize: string | null;
  secondarySize: string | null;
  // null/"FG" = a normal finished good; "DEFECT"/"WIP"/"PACKAGING"/"RM" lines
  // are real sales too but aren't production demand — every PQ aggregation
  // that feeds Packing/BOM must exclude them (direct_wip-style routing, see
  // /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md).
  itemRole: string | null;
  poQty: number;
  orderQty: number;
  planningQty: number | null;
}

// A real finished-good order line eligible for production-demand (PQ)
// aggregation — matches server/routes/bom.ts's own `(item_role IS NULL OR
// item_role = 'FG')` filter exactly, so Packing and BOM never disagree.
function isFgLine(l: { itemRole: string | null }): boolean {
  return l.itemRole == null || l.itemRole === "FG";
}

export interface PlanOrder {
  id: number;
  orderNumber: string;
  poNumber: string | null;
  deliveryDate: string;
  orderDate?: string | null;
  deliveryTime?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  deliveryRegion?: string | null;
  deliveryProvince?: string | null;
  deliveryDistrict?: string | null;
  status: string;
  productionRound: number | null;
  deferredFromRound?: number | null;
  tripId: number | null;
  stopOrder: number | null;
  deliverySiteId: number;
  deliverySiteName: string;
  lines: PlanLine[];
}

export interface PlanPartner {
  partnerId: number;
  partnerName: string;
  partnerCode: string;
  orders: PlanOrder[];
}

export interface PlanTrip {
  id: number;
  deliveryDate: string;
  productionRound: number | null;
  tripNumber: number;
  name: string | null;
  notes: string | null;
  vehicleId: number | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  vehicleCapacityEggs: number | null;
  driverId: number | null;
  driverName: string | null;
  confirmedAt: string | null;
  vehicleConfirmedAt: string | null;
  departedAt: string | null;
}

interface VehicleOption { id: number; plateNumber: string; vehicleType: string; capacityEggs?: number | null; }
interface DriverOption  { id: number; name: string; }

export interface RoundState { closed: boolean; closedAt: string | null; }

export interface DailyData {
  date: string;
  kpi: { orders: number; partners: number; sites: number; eggs: number };
  roundStates: Record<number, RoundState>;
  partners: PlanPartner[];
  trips: PlanTrip[];
}

export type SubTab = "demand" | "bom" | "trip" | "overview" | "checkout" | "fgstock";
export type Round = number;

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
export function fmtNum(n: number) { return Math.round(n).toLocaleString("th-TH"); }
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

export function orderEggs(o: PlanOrder) {
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

// ── Orders in round & preliminary plans ─────────────────────────────────────────
// "Preliminary shipment plans" are explicitly feasibility-only in the design
// reference — they never publish anything — so keeping them as session-local
// React state (not persisted to the server) is faithful to that intent, not a
// simplification. "Defer to next round" is real: it reuses the same
// /api/orders/assign-round endpoint the rest of this file already calls. There's
// no "delivery area"/region field in the schema, so grouping uses delivery site +
// date instead of a fabricated region, and there's no delivery-time field either,
// so no "time missing" indicator is shown.

// ── Preliminary plan timing modal ────────────────────────────────────────────────
// "basketed/loose/types" and a "max stops" capacity shown in the design reference
// aren't included — there's no basket-capacity or per-vehicle stop-limit data
// anywhere in the schema, so those numbers would have to be invented. Everything
// shown here (eggs, stops, requested date, load-in/deliver-plan fields) is real or
// session-local user input.

// Autosaves — each date/time change calls onSave immediately (matches the
// design reference: no separate Save button, just Close). Disabled once the
// round is closed, since a closed round's plans are meant to be frozen —
// that's a real, enforced state here (not just descriptive text), unlike
// the "required before round closes" idea from the reference, which isn't
// actually gated anywhere yet, so it's deliberately not claimed below.
function PlanTimingModal({
  plan,
  requestedDate,
  eggs,
  stops,
  vehicleLabel,
  complete,
  roundClosed,
  onSave,
  onClose,
}: {
  plan: { label: string; loadInDate: string; loadInTime: string; deliverPlanDate: string; deliverPlanTime: string };
  requestedDate: string;
  eggs: number;
  stops: number;
  vehicleLabel: string;
  complete: boolean;
  roundClosed: boolean;
  onSave: (fields: { loadInDate: string; loadInTime: string; deliverPlanDate: string; deliverPlanTime: string }) => void;
  onClose: () => void;
}) {
  const [loadInDate, setLoadInDate] = useState(plan.loadInDate);
  const [loadInTime, setLoadInTime] = useState(plan.loadInTime);
  const [deliverPlanDate, setDeliverPlanDate] = useState(plan.deliverPlanDate);
  const [deliverPlanTime, setDeliverPlanTime] = useState(plan.deliverPlanTime);

  const update = (fields: Partial<{ loadInDate: string; loadInTime: string; deliverPlanDate: string; deliverPlanTime: string }>) => {
    const next = {
      loadInDate: fields.loadInDate ?? loadInDate,
      loadInTime: fields.loadInTime ?? loadInTime,
      deliverPlanDate: fields.deliverPlanDate ?? deliverPlanDate,
      deliverPlanTime: fields.deliverPlanTime ?? deliverPlanTime,
    };
    setLoadInDate(next.loadInDate);
    setLoadInTime(next.loadInTime);
    setDeliverPlanDate(next.deliverPlanDate);
    setDeliverPlanTime(next.deliverPlanTime);
    onSave(next);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div>
            <div className="text-[16px] font-bold text-[#1a1a1a]">Plan {plan.label}</div>
            <div className="text-[12px] text-[#999]">Preliminary plan timing</div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#555] text-[18px] leading-none">
            ×
          </button>
        </div>

        <div className="px-5 py-3 bg-[#fafbfc] border-b border-[#f0f0f0] flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[13px] font-bold text-[#1a1a1a]">Plan {plan.label}</span>
            <span className="text-[12px] font-medium text-[#92400E] ml-2">{vehicleLabel}</span>
            <div className="text-[12px] text-[#888] mt-0.5">
              {fmtNum(eggs)} eggs · {stops} stops
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              complete
                ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC]"
                : "bg-[#F1F2F4] text-[#5F5E5A] border-[#e3e5e8]"
            }`}
          >
            {complete ? "Ready" : "Incomplete"}
          </span>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[12px] text-[#888]">Requested</span>
            <span className="text-[13px] text-[#1a1a1a]">{requestedDate}</span>
            <span className="text-[11px] text-[#aaa]">(read-only source fact)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[12px] text-[#888]">Load-in</span>
            <input
              type="date"
              value={loadInDate}
              disabled={roundClosed}
              onChange={e => update({ loadInDate: e.target.value })}
              className="px-2 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg disabled:bg-[#f5f5f5] disabled:text-[#aaa]"
            />
            <input
              type="time"
              value={loadInTime}
              disabled={roundClosed}
              onChange={e => update({ loadInTime: e.target.value })}
              className="w-24 px-2 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg disabled:bg-[#f5f5f5] disabled:text-[#aaa]"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[12px] text-[#888]">Deliver (plan)</span>
            <input
              type="date"
              value={deliverPlanDate}
              disabled={roundClosed}
              onChange={e => update({ deliverPlanDate: e.target.value })}
              className="px-2 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg disabled:bg-[#f5f5f5] disabled:text-[#aaa]"
            />
            <input
              type="time"
              value={deliverPlanTime}
              disabled={roundClosed}
              onChange={e => update({ deliverPlanTime: e.target.value })}
              className="w-24 px-2 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg disabled:bg-[#f5f5f5] disabled:text-[#aaa]"
            />
          </div>
          <div className="text-[11px] text-[#aaa]">
            plan-level only — never edits the customer request · times are optional
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#f0f0f0] flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-[#aaa]">
            {roundClosed ? "round closed — timing is frozen" : "autosaved"}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type PrelimPlanRow = {
  id: number;
  label: string;
  groupLabel: string;
  orderIds: number[];
  vehicleId: string;
  loadInDate: string;
  loadInTime: string;
  deliverPlanDate: string;
  deliverPlanTime: string;
};

// ── Plan orders modal — "N orders" on a preliminary plan card opens this
// instead of expanding inline, with a per-order action menu. ─────────────────
// "basketed/loose" and the per-row "Issue" column are honest placeholders —
// there's no basket-vs-loose packaging data or automated per-order issue
// detection in this app, so they always read "basketed 0 · loose {eggs}" and
// "—" rather than inventing numbers. "Needs review" reuses the same
// complete/incomplete signal the plan card itself already shows.
function PlanOrdersModal({
  plan,
  orders,
  vehicle,
  eggs,
  stops,
  complete,
  otherPlans,
  activeRound,
  onClose,
  onRemove,
  onMove,
  onDefer,
}: {
  plan: PrelimPlanRow;
  orders: (PlanOrder & { partnerName: string })[];
  vehicle: VehicleOption | undefined;
  eggs: number;
  stops: number;
  complete: boolean;
  otherPlans: PrelimPlanRow[];
  activeRound: Round | "ALL";
  onClose: () => void;
  onRemove: (orderId: number) => void;
  onMove: (toPlanId: number, orderId: number) => void;
  onDefer: (orderId: number) => void;
}) {
  // Fixed-position, computed from the trigger's own rect (same pattern as
  // MachineJobBoard's "เอกสารหน้างาน" menu) — not `absolute`, which the modal's
  // `overflow-y-auto` was clipping whenever the menu fell near the bottom edge.
  const [rowMenu, setRowMenu] = useState<{ id: number; top: number; right: number } | null>(null);
  const [moveSubmenu, setMoveSubmenu] = useState<{ id: number; top: number; right: number } | null>(null);
  const [detailOrder, setDetailOrder] = useState<(PlanOrder & { partnerName: string }) | null>(null);
  const pct = vehicle?.capacityEggs ? Math.round((eggs / vehicle.capacityEggs) * 100) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">Plan {plan.label}</h2>
            <div className="text-[12px] text-[#888] mt-0.5">Orders in plan · {orders.length}</div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-3 bg-[#fafbfc] border-b border-[#f0f0f0] flex-wrap">
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <span className="font-bold text-[#1a1a1a]">Plan {plan.label}</span>
            <span className="text-[#555]">{vehicle ? vehicle.vehicleType : "no vehicle"}</span>
            <span className="text-[#555] tabular-nums">
              {fmtNum(eggs)}{vehicle?.capacityEggs ? ` / ${fmtNum(vehicle.capacityEggs)} · ${pct}%` : ""}
            </span>
            <span className="text-[#555]">{stops} stops</span>
            <span className="text-[#555]" title="ยังไม่รองรับข้อมูลการแพ็กลงตะกร้าจริง — เป็นค่า default">
              basketed 0 · loose {fmtNum(eggs)}
            </span>
          </div>
          {!complete && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D] whitespace-nowrap">
              ⚠ Needs review
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                <th className="text-left px-4 py-2">Customer / Site</th>
                <th className="text-left px-3 py-2">Area</th>
                <th className="text-left px-3 py-2">Requested</th>
                <th className="text-right px-3 py-2">Eggs</th>
                <th className="text-left px-3 py-2">Issue</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-[#f0f0f0]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <CustPill name={o.partnerName} />
                      <span className="font-semibold text-[#1a1a1a]">{o.deliverySiteName}</span>
                    </div>
                    {o.poNumber && <div className="font-mono text-[10.5px] text-[#999] mt-0.5">PO {o.poNumber}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-[#555]">{o.deliveryRegion || NO_AREA}</td>
                  <td className="px-3 py-2.5 text-[#555] tabular-nums">{fmtDayMonth(o.orderDate ?? o.deliveryDate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1a1a1a]">{fmtNum(orderEggs(o))}</td>
                  <td className="px-3 py-2.5 text-[#ccc]">—</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setRowMenu(rowMenu?.id === o.id ? null : { id: o.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                        setMoveSubmenu(null);
                      }}
                      className="w-6 h-6 rounded border border-[#d6d8dc] text-[#888] hover:bg-[#f5f5f5]"
                    >
                      ⋯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-[#f0f0f0] text-[11px] text-[#999]">
          Remove returns the order to unassigned in the same round · moving to another plan applies immediately (no separate preview step yet)
        </div>
      </div>

      {rowMenu && (() => {
        const o = orders.find(x => x.id === rowMenu.id);
        if (!o) return null;
        return (
          <>
            <div
              className="fixed inset-0 z-[65]"
              onClick={e => { e.stopPropagation(); setRowMenu(null); setMoveSubmenu(null); }}
            />
            <div
              className="fixed z-[70] bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-56 text-left"
              style={{ top: rowMenu.top, right: rowMenu.right }}
            >
              <button
                onClick={() => { setDetailOrder(o); setRowMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
              >
                Order detail
              </button>
              <button
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setMoveSubmenu(
                    moveSubmenu?.id === o.id ? null : { id: o.id, top: r.top, right: window.innerWidth - r.left + 4 },
                  );
                }}
                disabled={otherPlans.length === 0}
                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <span>Move to another plan...</span>
                {otherPlans.length > 0 && <span className="text-[10px] text-[#888]">▸</span>}
              </button>
              <button
                onClick={() => { onRemove(o.id); setRowMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
              >
                Remove — back to unassigned
              </button>
              {typeof activeRound === "number" && (
                <button
                  onClick={() => { onDefer(o.id); setRowMenu(null); }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-[#92400E] hover:bg-[#f5f5f5]"
                >
                  → Defer to O-R{activeRound + 1}
                </button>
              )}
            </div>
            {moveSubmenu && moveSubmenu.id === o.id && otherPlans.length > 0 && (
              <div
                className="fixed z-[75] bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-44 text-left"
                style={{ top: moveSubmenu.top, right: moveSubmenu.right }}
              >
                {otherPlans.map(p2 => (
                  <button
                    key={p2.id}
                    onClick={() => { onMove(p2.id, o.id); setMoveSubmenu(null); setRowMenu(null); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
                  >
                    Plan {p2.label}
                  </button>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {detailOrder && <OrderDetailPopover order={detailOrder} onClose={() => setDetailOrder(null)} />}
    </div>
  );
}

// Minimal real order-detail view (header fields + line items) — there's no
// dedicated order-detail page/modal elsewhere in the app to reuse, so this
// is a lightweight read-only popover built from data the plan modal already
// has in memory, not a fetch of anything new.
function OrderDetailPopover({
  order,
  onClose,
}: {
  order: PlanOrder & { partnerName: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="text-[16px] font-bold text-[#1a1a1a]">{order.orderNumber}</h2>
            <div className="text-[12px] text-[#888] mt-0.5 flex items-center gap-1.5">
              <CustPill name={order.partnerName} /> {order.deliverySiteName}
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-3 text-[12.5px]">
          <div className="grid grid-cols-2 gap-2 text-[#555]">
            {order.poNumber && <div>PO <span className="font-mono text-[#1a1a1a]">{order.poNumber}</span></div>}
            <div>Delivery <span className="text-[#1a1a1a]">{fmtDayMonth(order.deliveryDate)} {order.deliveryTime ?? ""}</span></div>
            <div>Area <span className="text-[#1a1a1a]">{order.deliveryRegion || NO_AREA}</span></div>
            <div>Status <span className="text-[#1a1a1a]">{order.status}</span></div>
          </div>
          <div className="border-t border-[#f0f0f0] pt-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] font-bold text-[#888] uppercase">
                  <th className="text-left py-1">SKU · Item</th>
                  <th className="text-right py-1">Qty</th>
                  <th className="text-right py-1">Eggs</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map(l => (
                  <tr key={l.lineId} className="border-t border-[#f0f0f0]">
                    <td className="py-1.5 pr-2">
                      <div className="font-mono text-[10.5px] text-[#888]">{l.sku}</div>
                      <div className="text-[#1a1a1a]">{l.itemName}</div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#555]">
                      {fmtNum(l.planningQty ?? l.orderQty)} {l.sellingUnit}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-[#1a1a1a]">
                      {fmtNum((l.planningQty ?? l.orderQty) * l.eggsPerPack)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


// dd/mm from an ISO-ish date string
function fmtDayMonth(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}` : d;
}

const NO_AREA = "ไม่ระบุพื้นที่";

// Mixed-egg calculation basis — master-data split for a mixed pair (e.g. "2-3").
type MixRatio = { pair: string; primary: string; secondary: string; minPrimary: number | null };
const MIX_SPLIT_KEY = "dailyplan.mixSplit";
const REF_COLS_KEY = "dailyplan.refCols";

// Balance = available − demand, worded like the reference design.
function balanceLabel(balance: number, hasAny: boolean): { text: string; cls: string } {
  if (!hasAny) return { text: "—", cls: "text-[#ccc]" };
  if (balance > 0) return { text: `Surplus ${fmtNum(balance)}`, cls: "text-[#1F7A3E]" };
  if (balance < 0) return { text: `Short ${fmtNum(-balance)}`, cls: "text-[#B42318]" };
  return { text: "Exact", cls: "text-[#555]" };
}

// Splits qty of a mixed pair into its two sizes by the master-data min-primary %.
// Primary gets its minimum share, the secondary size takes the balance.
function splitMixedQty(qty: number, r: MixRatio): [number, number] {
  const a = Math.round((qty * (r.minPrimary ?? 0)) / 100);
  return [a, qty - a];
}

// Group identity for an order in the "awaiting plan" list.
// Area · time → delivery region + deliver date + time slot; Customer → partner.
function orderGroupInfo(
  o: { partnerName: string; deliveryDate: string; deliveryTime?: string | null; deliveryRegion?: string | null },
  groupBy: "area" | "customer",
): { label: string; area: string | null; date: string | null; time: string | null } {
  if (groupBy === "customer") return { label: o.partnerName, area: null, date: null, time: null };
  const area = o.deliveryRegion || NO_AREA;
  const date = o.deliveryDate ? o.deliveryDate.slice(0, 10) : null;
  const time = o.deliveryTime || null;
  return { label: `${area} · ${fmtDayMonth(date)}${time ? ` ${time}` : ""}`, area, date, time };
}

// ── AQ reference dialog ───────────────────────────────────────────────────────
// AQ is the whole-day forecast used as a REFERENCE only — computed server-side
// (/api/orders/aq-reference) from past orders; it never changes OQ/PQ.

type AqMethod = "all" | "weekday" | "weekday_month";
type AqConfig = { method: AqMethod; nonWorking: number[]; holidays: string[]; days: number; excluded: number[] };
type AqData = {
  productionDays: number;
  dataDays: number;
  insufficient: boolean;
  weekBand: number;
  avgPerDaySize: Record<string, number>;
  skus: { sku: string; name: string; size: string; avgEggs: number }[];
  customers: { partnerId: number; name: string; eggs: number; orderDays: number; likelyOneTime: boolean; excluded: boolean }[];
  rows: { size: string; sku: string; name: string; partnerId: number; partnerName: string; avgEggs: number }[];
};
type AqSnapshot = {
  id: number;
  planningDate: string;
  version: number;
  method: AqMethod;
  windowDays: number;
  nonWorking: number[];
  holidays: string[];
  excludedPartnerIds: number[];
  totalEggs: number;
  productionDays: number;
  dataDays: number;
  avgPerDaySize: Record<string, number>;
  state: "active" | "superseded";
  createdBy: string | null;
  createdAt: string | null;
};
const AQ_METHOD_LABEL: Record<AqMethod, string> = {
  all: "working-day average",
  weekday: "same-weekday average",
  weekday_month: "same weekday + month period average",
};
const AQ_CONFIG_KEY = "dailyplan.aqConfig";
const DEFAULT_AQ_CONFIG: AqConfig = { method: "all", nonWorking: [0], holidays: [], days: 30, excluded: [] };

function aqQuery(date: string, c: AqConfig): string {
  const q = new URLSearchParams({
    date,
    days: String(c.days),
    method: c.method,
    nonWorking: c.nonWorking.join(","),
    holidays: c.holidays.join(","),
    exclude: c.excluded.join(","),
  });
  return q.toString();
}

const AQ_METHODS: { id: AqMethod; title: string; desc: (band: number) => string }[] = [
  { id: "all", title: "Every working day", desc: () => "total sales every day ÷ production days (per non-working days below)" },
  { id: "weekday", title: "Same weekday", desc: () => "only past days on the same weekday" },
  { id: "weekday_month", title: "Same weekday + month period", desc: b => `week band ${b} of the month` },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AqReferenceDialog({
  date,
  config,
  data,
  loading,
  onChange,
  onClose,
  initialTab = "date",
}: {
  date: string;
  config: AqConfig;
  data: AqData | null;
  loading: boolean;
  onChange: (c: AqConfig) => void;
  onClose: () => void;
  initialTab?: "date" | "history";
}) {
  const [tab, setTab] = useState<"date" | "history">(initialTab);
  const [view, setView] = useState<"sku" | "size">("sku");
  const [holidayDraft, setHolidayDraft] = useState("");
  const [custom, setCustom] = useState(![30, 60, 90].includes(config.days));
  const [custSearch, setCustSearch] = useState("");
  const [custFilter, setCustFilter] = useState<"all" | "included" | "excluded" | "onetime">("all");
  const [snapshots, setSnapshots] = useState<AqSnapshot[]>([]);
  const [histSearch, setHistSearch] = useState("");
  const [histState, setHistState] = useState<"all" | "active" | "superseded">("all");
  const [expandedSnap, setExpandedSnap] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    try {
      const r = await fetch("/api/orders/aq-snapshots");
      if (r.ok) setSnapshots(await r.json());
    } catch (err) {
      console.error(err);
    }
  }, []);
  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const activeForDate = snapshots.find(sn => sn.planningDate === date && sn.state === "active") ?? null;
  const nextVersion = Math.max(0, ...snapshots.filter(sn => sn.planningDate === date).map(sn => sn.version)) + 1;
  const saveSnapshot = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch("/api/orders/aq-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          days: config.days,
          method: config.method,
          nonWorking: config.nonWorking,
          holidays: config.holidays,
          excluded: config.excluded,
        }),
      });
      if (r.ok) {
        const { version } = await r.json();
        setSaveMsg(`Saved as AQ v${version}`);
        await loadSnapshots();
      } else {
        const e = await r.json().catch(() => null);
        setSaveMsg(e?.message ?? "Could not save");
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch: Partial<AqConfig>) => onChange({ ...config, ...patch });
  const customers = data?.customers ?? [];
  const includedN = customers.filter(c => !c.excluded).length;
  const excludedN = customers.filter(c => c.excluded).length;
  const oneTimeN = customers.filter(c => c.likelyOneTime).length;
  const shownCustomers = customers.filter(c => {
    if (custSearch && !c.name.toLowerCase().includes(custSearch.toLowerCase())) return false;
    if (custFilter === "included") return !c.excluded;
    if (custFilter === "excluded") return c.excluded;
    if (custFilter === "onetime") return c.likelyOneTime;
    return true;
  });
  const sizeRows = Object.entries(data?.avgPerDaySize ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const seg = (active: boolean, first: boolean) =>
    `px-3.5 py-2 text-[13px] ${first ? "" : "border-l border-[#d6d8dc]"} ${
      active ? "bg-[#1E4F9C] text-white font-bold" : "bg-white text-[#444] hover:bg-[#f5f5f5]"
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-[#F6F7F8] flex flex-col" role="dialog" aria-label="AQ reference">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#e3e5e8] flex-wrap">
        <span className="text-[24px] font-bold text-[#1a1a1a]">AQ reference</span>
        <span className="px-2.5 py-0.5 rounded-full bg-[#E6EEF8] text-[#1E4F9C] text-[12px] font-bold">date {dm(date)}</span>
        {activeForDate && (
          <span className="px-2.5 py-0.5 rounded-full bg-[#E4F3E8] text-[#1F7A3E] text-[12px] font-bold">
            AQ v{activeForDate.version} · active
          </span>
        )}
        <span className="px-2.5 py-0.5 rounded-full bg-[#eef0f3] text-[#555] text-[12px] font-semibold">
          settings saved on this browser
        </span>
        {saveMsg && <span role="status" className="text-[12px] font-semibold text-[#1E4F9C]">{saveMsg}</span>}
        <button
          onClick={saveSnapshot}
          disabled={saving || !data || data.insufficient}
          title={data?.insufficient ? "Insufficient history — nothing to save" : "Save the AQ shown here as a read-only version"}
          className="ml-auto px-4 py-2 text-[14px] font-semibold rounded-lg bg-[#1E4F9C] text-white hover:bg-[#1A4488] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : `Save as AQ v${nextVersion}`}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-[14px] font-medium border border-[#d6d8dc] rounded-lg bg-white hover:bg-[#f5f5f5]"
        >
          ✕ Close
        </button>
      </div>
      <div className="px-4 py-2.5 bg-[#FFF8E6] border-b border-[#F3DFA2] text-[13px] text-[#5b4a12]">
        AQ is the whole-day forecast used as reference — not an order, plan, or production instruction, and does not change OQ/PQ.
      </div>
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-[#e3e5e8]">
        <button
          onClick={() => setTab("date")}
          className={`px-5 py-2.5 rounded-xl text-[15px] font-bold ${tab === "date" ? "bg-[#E6EEF8] text-[#1E4F9C]" : "text-[#555] hover:bg-[#f5f5f5]"}`}
        >
          AQ for this date
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2.5 rounded-xl text-[15px] ${tab === "history" ? "bg-[#E6EEF8] text-[#1E4F9C] font-bold" : "text-[#555] hover:bg-[#f5f5f5]"}`}
        >
          AQ history <span className="ml-1 px-2 py-0.5 rounded-full bg-[#eef0f3] text-[10px] font-bold tracking-wide text-[#6B7A90]">READ-ONLY</span>
        </button>
      </div>

      {tab === "history" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[22px] font-bold text-[#1a1a1a]">AQ history</div>
          <div className="text-[13px] text-[#6B7A90] mb-3">View the snapshots actually used, newest first</div>
          <div className="flex gap-2 mb-3">
            <input
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
              placeholder="Search date… (dd/mm)"
              className="w-full max-w-[420px] px-3 py-2 text-[14px] border border-[#d6d8dc] rounded-lg bg-white"
            />
            <select
              value={histState}
              onChange={e => setHistState(e.target.value as typeof histState)}
              className="px-3 py-2 text-[14px] border border-[#d6d8dc] rounded-lg bg-white"
            >
              <option value="all">All states</option>
              <option value="active">Active</option>
              <option value="superseded">Superseded</option>
            </select>
          </div>
          {(() => {
            const rows = snapshots.filter(sn => {
              if (histState !== "all" && sn.state !== histState) return false;
              const q = histSearch.trim();
              return !q || dm(sn.planningDate).includes(q) || sn.planningDate.includes(q);
            });
            if (rows.length === 0) {
              return <div className="py-10 text-center text-[13px] text-[#94a3b8]">No saved AQ snapshots yet — use “Save as AQ v{nextVersion}” on the AQ for this date tab.</div>;
            }
            return (
              <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="text-left text-[13px] font-semibold text-[#6B7A90] border-b border-[#e5e7eb]">
                      <th className="px-4 py-3">Planning date</th>
                      <th className="px-4 py-3">Snapshot</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Scope</th>
                      <th className="px-4 py-3 text-right">Total (eggs)</th>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">By</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(sn => {
                      const open = expandedSnap === sn.id;
                      const sizes = Object.entries(sn.avgPerDaySize).sort((a, b) => a[0].localeCompare(b[0]));
                      return (
                        <Fragment key={sn.id}>
                          <tr className="border-b border-[#f0f0f0] hover:bg-[#fafafa] cursor-pointer" onClick={() => setExpandedSnap(open ? null : sn.id)}>
                            <td className="px-4 py-3 font-bold text-[#1a1a1a]">{dm(sn.planningDate)}</td>
                            <td className="px-4 py-3">AQ v{sn.version}</td>
                            <td className="px-4 py-3 text-[#333]">{sn.windowDays}-day {AQ_METHOD_LABEL[sn.method]} · {sn.windowDays}d</td>
                            <td className="px-4 py-3">{sn.excludedPartnerIds.length ? `${sn.excludedPartnerIds.length} excluded` : "all"}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-[#1a1a1a]">{fmtNum(sn.totalEggs)}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${
                                  sn.state === "active" ? "bg-[#E4F3E8] text-[#1F7A3E]" : "bg-[#eef0f3] text-[#6B7A90]"
                                }`}
                              >
                                {sn.state}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#6B7A90]">
                              {sn.createdBy ?? "—"}
                              {sn.createdAt && (
                                <div className="text-[12px]">
                                  {new Date(sn.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </td>
                            <td className="px-2 text-[#1E4F9C]">{open ? "▾" : "▸"}</td>
                          </tr>
                          {open && (
                            <tr className="bg-[#fafbfc] border-b border-[#f0f0f0]">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="text-[12px] text-[#6B7A90] mb-2">
                                  {sn.productionDays} production days · {sn.dataDays} days with sales · average eggs per production day
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {sizes.map(([size, v]) => (
                                    <span key={size} className="px-2.5 py-1 rounded-lg bg-white border border-[#e3e5e8] text-[13px]">
                                      {size === "mixed" ? "คละ" : `เบอร์ ${size}`}{" "}
                                      <b className="tabular-nums">{fmtNum(v)}</b>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
          <div className="mt-4 text-[13px] text-[#6B7A90]">History is read-only evidence — no back-dated edits</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(340px,400px)_1fr] items-start">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#E1E5EA] p-4">
                <div className="text-[16px] font-bold text-[#1a1a1a] mb-2">Historical method</div>
                <div className="space-y-2">
                  {AQ_METHODS.map(m => {
                    const on = config.method === m.id;
                    return (
                      <label
                        key={m.id}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer ${
                          on ? "border-[#1E4F9C] border-2 bg-white" : "border-[#e3e5e8] hover:bg-[#fafafa]"
                        }`}
                      >
                        <input type="radio" name="aq-method" checked={on} onChange={() => set({ method: m.id })} className="mt-1 accent-[#1E4F9C]" />
                        <span>
                          <span className="block text-[14px] font-bold text-[#1a1a1a]">{m.title}</span>
                          <span className="block text-[12px] text-[#6B7A90]">{m.desc(data?.weekBand ?? Math.ceil(Number(date.slice(8, 10)) / 7))}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="text-[13px] font-semibold text-[#555] mt-4 mb-2">Weekly non-working days</div>
                <div className="inline-flex rounded-xl overflow-hidden border border-[#d6d8dc]">
                  {WEEKDAYS.map((w, i) => {
                    const on = config.nonWorking.includes(i);
                    return (
                      <button
                        key={w}
                        onClick={() => set({ nonWorking: on ? config.nonWorking.filter(x => x !== i) : [...config.nonWorking, i].sort() })}
                        className={seg(on, i === 0)}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[12px] text-[#6B7A90] mt-2">multi-select · sales count every day, AQ divides by production days</div>

                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#555]">Extra holidays</span>
                  <input
                    type="date"
                    value={holidayDraft}
                    onChange={e => setHolidayDraft(e.target.value)}
                    className="px-3 py-2 text-[13px] border border-[#d6d8dc] rounded-lg bg-white"
                  />
                  <button
                    disabled={!holidayDraft || config.holidays.includes(holidayDraft)}
                    onClick={() => { set({ holidays: [...config.holidays, holidayDraft].sort() }); setHolidayDraft(""); }}
                    className="px-3 py-2 text-[13px] font-semibold border border-[#d6d8dc] rounded-lg bg-white hover:bg-[#f5f5f5] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
                {config.holidays.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {config.holidays.map(h => (
                      <span key={h} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eef0f3] text-[12px] text-[#444]">
                        {h.split("-").reverse().join("/")}
                        <button onClick={() => set({ holidays: config.holidays.filter(x => x !== h) })} className="text-[#888] hover:text-[#333]">✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[12px] text-[#6B7A90] mt-2">e.g. public holidays — not counted as production days</div>

                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#555]">History window</span>
                  <div className="inline-flex rounded-xl overflow-hidden border border-[#d6d8dc]">
                    {[30, 60, 90].map((d, i) => (
                      <button key={d} onClick={() => { setCustom(false); set({ days: d }); }} className={seg(!custom && config.days === d, i === 0)}>
                        {d} d
                      </button>
                    ))}
                    <button onClick={() => setCustom(true)} className={seg(custom, false)}>Custom</button>
                  </div>
                  {custom && (
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={config.days}
                      onChange={e => set({ days: Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                      className="w-20 px-2 py-2 text-[13px] border border-[#d6d8dc] rounded-lg"
                    />
                  )}
                </div>
                {data?.insufficient && (
                  <div className="text-[13px] font-semibold text-[#8A5A00] mt-3">⚠ Insufficient history within {config.days} days</div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#E1E5EA] p-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-[16px] font-bold text-[#1a1a1a]">Customer scope</span>
                  <span className="text-[12px] text-[#6B7A90]">
                    included {includedN} · excluded {excludedN} · likely one-time {oneTimeN}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    placeholder="Search customer…"
                    className="flex-1 min-w-0 px-3 py-2 text-[13px] border border-[#d6d8dc] rounded-lg"
                  />
                  <select
                    value={custFilter}
                    onChange={e => setCustFilter(e.target.value as typeof custFilter)}
                    className="px-2 py-2 text-[13px] border border-[#d6d8dc] rounded-lg bg-white"
                  >
                    <option value="all">All</option>
                    <option value="included">Included</option>
                    <option value="excluded">Excluded</option>
                    <option value="onetime">Likely one-time</option>
                  </select>
                </div>
                <div className="mt-2 max-h-[260px] overflow-y-auto">
                  {shownCustomers.length === 0 ? (
                    <div className="py-5 text-center text-[12px] text-[#bbb]">No customers match</div>
                  ) : (
                    shownCustomers.map(c => (
                      <label key={c.partnerId} className="flex items-center gap-2.5 py-2 border-t border-[#f0f0f0] text-[13px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!c.excluded}
                          onChange={() =>
                            set({ excluded: c.excluded ? config.excluded.filter(x => x !== c.partnerId) : [...config.excluded, c.partnerId] })
                          }
                          className="w-4 h-4 accent-[#1E4F9C]"
                        />
                        <span className="text-[#1a1a1a]">{c.name}</span>
                        {c.likelyOneTime && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-semibold">likely one-time</span>
                        )}
                        <span className="ml-auto tabular-nums text-[12px] text-[#6B7A90]">
                          {fmtNum(c.eggs)} eggs · {c.orderDays} d
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E1E5EA] p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[18px] font-bold text-[#1a1a1a]">AQ actually used</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#eef0f3] text-[#555] text-[12px] font-semibold">read-only</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#E6EEF8] text-[#1E4F9C] text-[12px] font-bold">from system Orders</span>
                <div className="ml-auto inline-flex rounded-xl overflow-hidden bg-[#F1F3F6] p-1 gap-1">
                  {([["sku", "By SKU"], ["size", "By egg size"]] as const).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setView(k)}
                      className={`px-4 py-1.5 rounded-lg text-[14px] ${view === k ? "bg-white text-[#1E4F9C] font-bold shadow-sm" : "text-[#555]"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {loading && !data ? (
                <div className="py-10 text-center text-[#aaa]"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
              ) : !data || data.insufficient ? (
                <div className="py-8 text-center text-[15px] font-semibold text-[#8A5A00]">
                  ⚠ Insufficient history within {config.days} days
                  {data && (
                    <div className="mt-1 text-[12px] font-normal text-[#6B7A90]">
                      {data.dataDays} day(s) with sales · {data.productionDays} production day(s) in the window — need at least 3 days with sales
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-[12px] text-[#6B7A90] mt-3 mb-2">
                    average eggs per production day · {data.productionDays} production days · {data.dataDays} days with sales
                  </div>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] text-[11px] uppercase tracking-wide text-[#888]">
                        {view === "sku" ? (
                          <>
                            <th className="text-left py-2">SKU</th>
                            <th className="text-left py-2">Item</th>
                            <th className="text-left py-2">Size</th>
                          </>
                        ) : (
                          <th className="text-left py-2">Size</th>
                        )}
                        <th className="text-right py-2">AQ / day (eggs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view === "sku"
                        ? data.skus.map(r => (
                            <tr key={r.sku + r.name} className="border-b border-[#f5f5f5]">
                              <td className="py-2 font-mono text-[12px] text-[#0C447C]">{r.sku}</td>
                              <td className="py-2 text-[#1a1a1a]">{r.name}</td>
                              <td className="py-2 text-[#555]">{r.size}</td>
                              <td className="py-2 text-right tabular-nums font-bold">{fmtNum(r.avgEggs)}</td>
                            </tr>
                          ))
                        : sizeRows.map(([size, v]) => (
                            <tr key={size} className="border-b border-[#f5f5f5]">
                              <td className="py-2 text-[#1a1a1a]">{size === "mixed" ? "คละ" : `เบอร์ ${size}`}</td>
                              <td className="py-2 text-right tabular-nums font-bold">{fmtNum(v)}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "AQ Sales Reference" tab under Orders: the official AQ for a date (the active
// saved version) next to the sales history it is calculated from. The full AQ
// configuration / history lives in the AqReferenceDialog opened from here.
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const AQ_METHOD_TH: Record<AqMethod, string> = {
  all: "ทุกวันทำงาน",
  weekday: "วันเดียวกันของสัปดาห์",
  weekday_month: "วันเดียวกัน + ช่วงเดือน",
};
type AqNode = { key: string; label: string; sub?: string; eggs: number; children: AqNode[] };

function AqSalesReferenceTab({ date: pageDate }: { date: string }) {
  const [aqDate, setAqDate] = useState(pageDate);
  const [config, setConfig] = useState<AqConfig>(() => {
    try { return { ...DEFAULT_AQ_CONFIG, ...(JSON.parse(localStorage.getItem(AQ_CONFIG_KEY) ?? "{}") ?? {}) }; }
    catch { return DEFAULT_AQ_CONFIG; }
  });
  const change = (c: AqConfig) => {
    setConfig(c);
    try { localStorage.setItem(AQ_CONFIG_KEY, JSON.stringify(c)); } catch { /* per-view convenience only */ }
  };
  const [data, setData] = useState<AqData | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<AqSnapshot[]>([]);
  const [dialog, setDialog] = useState<null | "date" | "history">(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [view, setView] = useState<"size" | "customer">("size");
  const [filter, setFilter] = useState("all");
  const [showZero, setShowZero] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const key = aqQuery(aqDate, config);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/orders/aq-reference?${key}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: AqData | null) => { if (!cancelled && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  const loadSnapshots = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders/aq-snapshots?date=${aqDate}`);
      if (r.ok) setSnapshots(await r.json());
    } catch (err) {
      console.error(err);
    }
  }, [aqDate]);
  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);
  const official = snapshots.find(sn => sn.state === "active") ?? null;

  const [y, m, d] = aqDate.split("-").map(Number);
  const dateTh = `${d} ${TH_MONTHS[m - 1]}`;
  const sameAsOfficial =
    !!official &&
    official.method === config.method &&
    official.windowDays === config.days &&
    JSON.stringify(official.nonWorking) === JSON.stringify([...config.nonWorking].sort()) &&
    JSON.stringify(official.holidays) === JSON.stringify([...config.holidays].sort()) &&
    JSON.stringify([...official.excludedPartnerIds].sort()) === JSON.stringify([...config.excluded].sort());

  // Working days per week, and in this date's month (weekly non-working days and holidays removed)
  const workPerWeek = 7 - config.nonWorking.length;
  const workPerMonth = useMemo(() => {
    let n = 0;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let day = 1; day <= last; day++) {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!config.nonWorking.includes(new Date(Date.UTC(y, m - 1, day)).getUTCDay()) && !config.holidays.includes(iso)) n++;
    }
    return n;
  }, [y, m, config.nonWorking, config.holidays]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (filter === "all") return all;
    if (filter.startsWith("c:")) return all.filter(r => String(r.partnerId) === filter.slice(2));
    return all.filter(r => r.size === filter.slice(2));
  }, [data, filter]);
  const total = rows.reduce((sum, r) => sum + r.avgEggs, 0);

  const sizeLabel = (sz: string) => (sz === "mixed" ? "คละ" : `เบอร์ ${sz}`);
  const { tree, hiddenZero } = useMemo(() => {
    const groupBy = <T,>(items: T[], k: (t: T) => string) => {
      const mp = new Map<string, T[]>();
      for (const it of items) { const kk = k(it); if (!mp.has(kk)) mp.set(kk, []); mp.get(kk)!.push(it); }
      return mp;
    };
    const sum = (rs: typeof rows) => rs.reduce((a, r) => a + r.avgEggs, 0);
    const skuNodes = (rs: typeof rows, prefix: string): AqNode[] =>
      rs.map(r => ({ key: `${prefix}|${r.partnerId}|${r.sku}`, label: r.sku || r.name, sub: r.name, eggs: r.avgEggs, children: [] }))
        .sort((a, b) => b.eggs - a.eggs);
    let top: AqNode[];
    if (view === "size") {
      const bySize = groupBy(rows, r => r.size);
      for (const sz of ["0", "1", "2", "3", "4", "5", "6"]) if (!bySize.has(sz)) bySize.set(sz, []);
      top = Array.from(bySize.entries()).map(([sz, rs]) => ({
        key: `s${sz}`,
        label: sizeLabel(sz),
        eggs: sum(rs),
        children: Array.from(groupBy(rs, r => String(r.partnerId)).entries())
          .map(([pid, crs]) => ({ key: `s${sz}|c${pid}`, label: crs[0].partnerName, eggs: sum(crs), children: skuNodes(crs, `s${sz}|c${pid}`) }))
          .sort((a, b) => b.eggs - a.eggs),
      }));
      top.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    } else {
      top = Array.from(groupBy(rows, r => String(r.partnerId)).entries()).map(([pid, crs]) => ({
        key: `c${pid}`,
        label: crs[0].partnerName,
        eggs: sum(crs),
        children: Array.from(groupBy(crs, r => r.size).entries())
          .map(([sz, srs]) => ({ key: `c${pid}|s${sz}`, label: sizeLabel(sz), eggs: sum(srs), children: skuNodes(srs, `c${pid}|s${sz}`) }))
          .sort((a, b) => b.eggs - a.eggs),
      }));
      top.sort((a, b) => b.eggs - a.eggs);
    }
    const hidden = top.filter(n => Math.round(n.eggs) === 0).length;
    return { tree: showZero ? top : top.filter(n => Math.round(n.eggs) > 0), hiddenZero: hidden };
  }, [rows, view, showZero]);

  const customerOptions = data?.customers ?? [];
  const sizeOptions = Array.from(new Set((data?.rows ?? []).map(r => r.size))).sort();

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["เบอร์ไข่", "ลูกค้า", "SKU", "รายการ", "AQ/วันทำงาน", "AQ/สัปดาห์", "AQ/เดือน", "สัดส่วน %"].map(esc).join(",")];
    for (const r of [...rows].sort((a, b) => a.size.localeCompare(b.size) || b.avgEggs - a.avgEggs)) {
      lines.push([
        r.size, r.partnerName, r.sku, r.name,
        Math.round(r.avgEggs), Math.round(r.avgEggs * workPerWeek), Math.round(r.avgEggs * workPerMonth),
        total > 0 ? ((r.avgEggs / total) * 100).toFixed(1) : "0.0",
      ].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aq-sales-reference-${aqDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pill = "inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-[#444] bg-white border border-[#d6d8dc] rounded-xl";
  const renderNode = (n: AqNode, depth: number): React.ReactNode => {
    const open = expanded.has(n.key);
    const has = n.children.length > 0;
    const zero = Math.round(n.eggs) === 0;
    return (
      <Fragment key={n.key}>
        <tr
          className={`border-b border-[#f0f0f0] ${has ? "cursor-pointer hover:bg-[#fafafa]" : ""} ${zero ? "text-[#bbb]" : ""}`}
          onClick={() => has && setExpanded(prev => { const nx = new Set(prev); nx.has(n.key) ? nx.delete(n.key) : nx.add(n.key); return nx; })}
        >
          <td className="py-3 pr-4" style={{ paddingLeft: 24 + depth * 26 }}>
            <span className={`inline-block w-4 text-[#1E4F9C] ${has ? "" : "opacity-0"}`}>{open ? "▾" : "▸"}</span>
            <span className={depth === 0 ? "font-bold text-[#1a1a1a]" : depth === 1 ? "font-semibold" : "font-mono text-[11px]"}>{n.label}</span>
            {n.sub && <span className="ml-2 text-[10px] text-[#888]">{n.sub}</span>}
          </td>
          <td className="py-3 px-4 text-right tabular-nums font-bold">{fmtNum(n.eggs)}</td>
          <td className="py-3 px-4 text-right tabular-nums">{fmtNum(n.eggs * workPerWeek)}</td>
          <td className="py-3 px-4 text-right tabular-nums">{fmtNum(n.eggs * workPerMonth)}</td>
          <td className="py-3 px-4 text-right tabular-nums text-[#555]">{total > 0 ? `${((n.eggs / total) * 100).toFixed(1)}%` : "—"}</td>
        </tr>
        {open && n.children.map(c => renderNode(c, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* AQ date + official state */}
      <div className="bg-white rounded-2xl border border-[#E1E5EA] px-6 py-4 flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">AQ date</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAqDate(addDays(aqDate, -1))} className="px-3.5 py-2.5 border border-[#d6d8dc] rounded-xl bg-white hover:bg-[#f5f5f5]">←</button>
            <input
              type="date"
              value={aqDate}
              onChange={e => e.target.value && setAqDate(e.target.value)}
              className="px-3 py-2.5 text-[13px] border border-[#d6d8dc] rounded-xl bg-white"
            />
            <button onClick={() => setAqDate(addDays(aqDate, 1))} className="px-3.5 py-2.5 border border-[#d6d8dc] rounded-xl bg-white hover:bg-[#f5f5f5]">→</button>
            <button onClick={() => setAqDate(todayISO())} className="px-4 py-2.5 text-[13px] border border-[#d6d8dc] rounded-xl bg-white hover:bg-[#f5f5f5]">Today</button>
          </div>
        </div>
        <div className="w-px self-stretch bg-[#e3e5e8]" />
        <div className="flex-1 min-w-[260px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">AQ state for this date</div>
          {official ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-[#E4F3E8] text-[#1F7A3E] text-[11px] font-bold">AQ v{official.version} · active</span>
              <span>
                <b className="text-[18px] text-[#1a1a1a] tabular-nums">{fmtNum(official.totalEggs)}</b>{" "}
                <span className="text-[12px] text-[#6B7A90]">eggs/working day (official)</span>
              </span>
              {official.createdAt && (
                <span className="text-[11px] text-[#6B7A90]">
                  published {new Date(official.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {official.createdBy ? ` · ${official.createdBy}` : ""}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-[#8A5A00]">No official AQ saved for this date yet — open the configuration to save one.</div>
          )}
        </div>
        <div className="relative inline-flex rounded-xl overflow-hidden">
          <button
            onClick={() => setDialog("date")}
            className="px-6 py-3 text-[13px] font-semibold text-white bg-[#1E4FD8] hover:bg-[#1A44BC]"
          >
            View AQ configuration
          </button>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More AQ options"
            className="px-3 text-white bg-[#1E4FD8] hover:bg-[#1A44BC] border-l border-white/30"
          >
            ▾
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-40 w-48 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 text-[11px]">
                <button onClick={() => { setMenuOpen(false); setDialog("date"); }} className="w-full text-left px-3 py-2 hover:bg-[#f5f5f5]">AQ configuration</button>
                <button onClick={() => { setMenuOpen(false); setDialog("history"); }} className="w-full text-left px-3 py-2 hover:bg-[#f5f5f5]">AQ history</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E1E5EA] px-6 py-5">
        <div className="flex items-center gap-3 flex-wrap mb-3 text-[12px]">
          <b className="text-[#1a1a1a]">AQ ทางการ · วันที่ AQ {dateTh}</b>
          {official && (
            <span className="px-3 py-0.5 rounded-full bg-[#E4F3E8] text-[#1F7A3E] text-[11px] font-semibold">
              AQ v{official.version} · ใช้งานอยู่ · {fmtNum(official.totalEggs)} ฟอง/วันทำงาน
            </span>
          )}
          <span className="text-[#6B7A90]">
            {!official
              ? "ยังไม่มีค่าทางการสำหรับวันนี้ — ตารางด้านล่างเป็นการคำนวณจากประวัติยอดขาย"
              : sameAsOfficial
                ? "คำนวณจากประวัติยอดขายชุดเดียวกับตารางด้านล่าง — ค่าทางการกับตารางจึงตรงกัน"
                : "ตารางด้านล่างเป็นการทดลองคำนวณ — อาจต่างจากค่าทางการ"}
          </span>
        </div>

        <div className="border border-[#E1E5EA] rounded-2xl">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#eef0f3]">
            <span className="text-[16px] font-bold text-[#1a1a1a]">ข้อมูลยอดขายอ้างอิง</span>
            <span className="px-3 py-1 rounded-full bg-[#eef0f3] text-[#6B7A90] text-[11px]">อ่านอย่างเดียว</span>
          </div>
          <div className="flex items-center gap-4 px-6 py-3.5 border-b border-[#eef0f3] text-[13px] flex-wrap">
            <span>วันเทียบเคียง <b>{data?.dataDays ?? 0}</b> วัน</span>
            <span className="w-px h-5 bg-[#e3e5e8]" />
            <span>ค่าเฉลี่ยจากข้อมูลอ้างอิง <b>{fmtNum(total)}</b> ฟอง/วันทำงาน</span>
            {data?.insufficient && <span className="text-[#8A5A00] font-semibold">⚠ ประวัติไม่เพียงพอภายใน {config.days} วัน</span>}
          </div>
          <div className="relative flex items-center gap-3 px-6 py-4 flex-wrap">
            <label className={pill}>
              มุมมอง:
              <select value={view} onChange={e => setView(e.target.value as "size" | "customer")} className="font-bold bg-transparent focus:outline-none">
                <option value="size">เบอร์ไข่ / ลูกค้า · ฟอง</option>
                <option value="customer">ลูกค้า / เบอร์ไข่ · ฟอง</option>
              </select>
            </label>
            <label className={pill}>
              กรองข้อมูล:
              <select value={filter} onChange={e => setFilter(e.target.value)} className="font-bold bg-transparent focus:outline-none">
                <option value="all">ทั้งหมด</option>
                <optgroup label="ลูกค้า">
                  {customerOptions.map(c => <option key={c.partnerId} value={`c:${c.partnerId}`}>{c.name}</option>)}
                </optgroup>
                <optgroup label="เบอร์ไข่">
                  {sizeOptions.map(sz => <option key={sz} value={`s:${sz}`}>{sizeLabel(sz)}</option>)}
                </optgroup>
              </select>
            </label>
            <button onClick={() => setTrialOpen(o => !o)} className={pill}>
              ทดลองคำนวณ: <b>{AQ_METHOD_TH[config.method]} · {config.days} วัน</b> <span className="text-[9px]">▾</span>
            </button>
            {trialOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setTrialOpen(false)} />
                <div className="absolute left-[420px] top-full mt-1 z-40 w-[340px] bg-white border border-[#e3e5e8] rounded-xl shadow-lg p-4 text-[11px]">
                  <div className="font-bold text-[#1a1a1a] mb-2">ทดลองคำนวณ</div>
                  <div className="space-y-1.5 mb-3">
                    {(Object.keys(AQ_METHOD_TH) as AqMethod[]).map(k => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="trial-method" checked={config.method === k} onChange={() => change({ ...config, method: k })} className="accent-[#1E4F9C]" />
                        {AQ_METHOD_TH[k]}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    ช่วงประวัติ
                    <select value={config.days} onChange={e => change({ ...config, days: Number(e.target.value) })} className="px-2 py-1 border border-[#d6d8dc] rounded-lg">
                      {[30, 60, 90].map(dd => <option key={dd} value={dd}>{dd} วัน</option>)}
                      {![30, 60, 90].includes(config.days) && <option value={config.days}>{config.days} วัน</option>}
                    </select>
                  </div>
                  <div className="text-[10px] text-[#6B7A90]">ทดลองเท่านั้น — ไม่เปลี่ยนค่าทางการจนกว่าจะบันทึกเวอร์ชันใหม่ใน View AQ configuration</div>
                </div>
              </>
            )}
            <button onClick={exportCsv} disabled={rows.length === 0} className={`${pill} font-semibold disabled:opacity-40`}>⬇ CSV</button>
          </div>
        </div>

        <div className="border border-[#E1E5EA] rounded-2xl mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[12px] font-semibold text-[#444] border-b-2 border-[#dfe3e8]">
                <th className="text-left py-4 px-6">{view === "size" ? "เบอร์ไข่ / ลูกค้า / SKU" : "ลูกค้า / เบอร์ไข่ / SKU"}</th>
                <th className="text-right py-4 px-4 text-[#1E4F9C]">AQ/วันทำงาน (ฟอง) ▾</th>
                <th className="text-right py-4 px-4">AQ/สัปดาห์ (ฟอง)</th>
                <th className="text-right py-4 px-4">AQ/เดือน (ฟอง)</th>
                <th className="text-right py-4 px-4">สัดส่วน</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={5} className="py-8 text-center text-[#aaa]"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : (
                tree.map(n => renderNode(n, 0))
              )}
            </tbody>
          </table>
          <div className="px-6 py-3 text-[11px] text-[#888] border-t border-[#eef0f3]">
            {hiddenZero > 0 && !showZero ? (
              <>ซ่อน {hiddenZero} แถวที่ AQ = 0 · <button onClick={() => setShowZero(true)} className="text-[#1E4F9C] underline">แสดงทั้งหมด</button> · </>
            ) : showZero ? (
              <><button onClick={() => setShowZero(false)} className="text-[#1E4F9C] underline">ซ่อนแถวที่ AQ = 0</button> · </>
            ) : null}
            มีผลเฉพาะมุมมองนี้ ไม่กระทบยอดสรุป
          </div>
        </div>
      </div>

      {dialog && (
        <AqReferenceDialog
          date={aqDate}
          config={config}
          data={data}
          loading={loading}
          onChange={change}
          onClose={() => { setDialog(null); loadSnapshots(); }}
          initialTab={dialog}
        />
      )}
    </div>
  );
}

function OrdersRoundPlansSection({
  date,
  partners,
  activeRound,
  roundClosed,
  onRefresh,
  onPlansChange,
}: {
  date: string;
  partners: PlanPartner[];
  activeRound: Round | "ALL";
  roundClosed: boolean;
  onRefresh: () => void;
  onPlansChange?: (plans: PrelimPlanRow[], vehicles: VehicleOption[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"area" | "customer">("area");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mixRatios, setMixRatios] = useState<MixRatio[]>([]);
  const [mixPopOpen, setMixPopOpen] = useState(false);
  // pair → split into sizes (default) or keep as its own mixed row. View only.
  const [mixSplit, setMixSplit] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(MIX_SPLIT_KEY) ?? "{}") ?? {}; } catch { return {}; }
  });
  const setPairSplit = (pair: string, split: boolean) =>
    setMixSplit(prev => {
      const next = { ...prev, [pair]: split };
      try { localStorage.setItem(MIX_SPLIT_KEY, JSON.stringify(next)); } catch { /* per-view convenience only */ }
      return next;
    });
  useEffect(() => {
    fetch("/api/orders/mixed-ratios")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: MixRatio[]) => setMixRatios(rows))
      .catch(() => {});
  }, []);
  // Optional reference columns next to "PQ through this round" (which is required).
  const [refCols, setRefCols] = useState<{ ad: boolean; latest: boolean }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(REF_COLS_KEY) ?? "{}") ?? {};
      return { ad: !!v.ad, latest: !!v.latest };
    } catch { return { ad: false, latest: false }; }
  });
  const [colPopOpen, setColPopOpen] = useState(false);
  const toggleRefCol = (k: "ad" | "latest") =>
    setRefCols(prev => {
      const next = { ...prev, [k]: !prev[k] };
      try { localStorage.setItem(REF_COLS_KEY, JSON.stringify(next)); } catch { /* per-view convenience only */ }
      return next;
    });
  // AQ reference — average daily demand from past orders, per the saved AQ config.
  const [aqConfig, setAqConfig] = useState<AqConfig>(() => {
    try { return { ...DEFAULT_AQ_CONFIG, ...(JSON.parse(localStorage.getItem(AQ_CONFIG_KEY) ?? "{}") ?? {}) }; }
    catch { return DEFAULT_AQ_CONFIG; }
  });
  const changeAqConfig = (c: AqConfig) => {
    setAqConfig(c);
    try { localStorage.setItem(AQ_CONFIG_KEY, JSON.stringify(c)); } catch { /* per-view convenience only */ }
  };
  const [aqOpen, setAqOpen] = useState(false);
  const [aqData, setAqData] = useState<AqData | null>(null);
  const [aqLoading, setAqLoading] = useState(false);
  const aqKey = aqQuery(date, aqConfig);
  useEffect(() => {
    if (!refCols.ad && !aqOpen) return;
    let cancelled = false;
    setAqLoading(true);
    fetch(`/api/orders/aq-reference?${aqKey}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: AqData | null) => { if (!cancelled && d) setAqData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAqLoading(false); });
    return () => { cancelled = true; };
  }, [refCols.ad, aqOpen, aqKey]);
  const adRaw = aqData && !aqData.insufficient ? aqData.avgPerDaySize : {};
  const mixRatioByPair = useMemo(() => new Map(mixRatios.map(r => [r.pair, r])), [mixRatios]);
  // The ratio to split a pair by, or null when kept as its own row / no usable ratio.
  const splitRatioFor = useCallback((pair: string): MixRatio | null => {
    const r = mixRatioByPair.get(pair);
    if (!r || r.minPrimary == null || r.minPrimary < 0 || r.minPrimary > 100) return null;
    return (mixSplit[pair] ?? true) ? r : null;
  }, [mixRatioByPair, mixSplit]);
  const splitSupply = useCallback((m: Record<string, number>) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) {
      const r = k !== "mixed" && k.includes("-") ? splitRatioFor(k) : null;
      if (!r) { out[k] = (out[k] ?? 0) + v; continue; }
      const [a, b] = splitMixedQty(v, r);
      out[r.primary] = (out[r.primary] ?? 0) + a;
      out[r.secondary] = (out[r.secondary] ?? 0) + b;
    }
    return out;
  }, [splitRatioFor]);
  const [plans, setPlans] = useState<PrelimPlanRow[]>([]);
  const [deferring, setDeferring] = useState(false);
  const [deferModalIds, setDeferModalIds] = useState<number[] | null>(null);
  const [addPlanMenu, setAddPlanMenu] = useState<{ orderIds: number[]; anchor: { top: number; right: number } } | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [planMenuOpen, setPlanMenuOpen] = useState<number | null>(null);
  const [loadInEditing, setLoadInEditing] = useState<number | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  useEffect(() => { onPlansChange?.(plans, vehicles); }, [plans, vehicles, onPlansChange]);

  useEffect(() => {
    fetch("/api/vehicles")
      .then(r => r.json())
      .then((data: any[]) =>
        setVehicles(
          data.map(v => ({
            id: v.id,
            plateNumber: v.plateNumber || v.plate_number,
            vehicleType: v.vehicleType || v.vehicle_type,
            capacityEggs: (v.capacityEggs ?? v.capacity_eggs) != null ? Number(v.capacityEggs ?? v.capacity_eggs) : null,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const [plansLoading, setPlansLoading] = useState(false);
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const r = await fetch(`/api/orders/preliminary-plans?date=${date}`);
      if (r.ok) {
        const rows: any[] = await r.json();
        setPlans(
          rows.map(row => ({
            id: row.id,
            label: row.label,
            groupLabel: row.groupLabel ?? "",
            orderIds: row.orderIds ?? [],
            vehicleId: row.vehicleId != null ? String(row.vehicleId) : "",
            loadInDate: row.loadInDate ?? "",
            loadInTime: row.loadInTime ?? "",
            deliverPlanDate: row.deliverPlanDate ?? "",
            deliverPlanTime: row.deliverPlanTime ?? "",
          })),
        );
      }
    } finally {
      setPlansLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const allOrders = useMemo(
    () => partners.flatMap(p => p.orders.map(o => ({ ...o, partnerName: p.partnerName }))),
    [partners],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOrders;
    return allOrders.filter(
      o =>
        o.partnerName.toLowerCase().includes(q) ||
        o.deliverySiteName.toLowerCase().includes(q) ||
        (o.poNumber ?? "").toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q),
    );
  }, [allOrders, search]);

  const plannedOrderIds = useMemo(() => new Set(plans.flatMap(p => p.orderIds)), [plans]);
  const awaitingPlan = useMemo(
    () => filtered.filter(o => !plannedOrderIds.has(o.id)),
    [filtered, plannedOrderIds],
  );

  const groups = useMemo(() => {
    const m = new Map<string, {
      label: string; area: string | null; date: string | null; time: string | null;
      orders: typeof awaitingPlan;
    }>();
    for (const o of awaitingPlan) {
      const g = orderGroupInfo(o, groupBy);
      const key = `${g.area ?? g.label}|${g.date ?? ""}|${g.time ?? ""}`;
      if (!m.has(key)) m.set(key, { ...g, orders: [] });
      m.get(key)!.orders.push(o);
    }
    // Area · time groups: by area, then delivery date, then time (missing last)
    return Array.from(m.values()).sort((a, b) =>
      groupBy === "customer"
        ? 0
        : (a.area ?? "").localeCompare(b.area ?? "", "th") ||
          (a.date ?? "").localeCompare(b.date ?? "") ||
          (a.time ?? "~").localeCompare(b.time ?? "~"),
    );
  }, [awaitingPlan, groupBy]);

  // PQ demand by egg size, for this round.
  const pqBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of allOrders) {
      for (const l of o.lines) {
        const eggs = (l.planningQty ?? l.orderQty) * l.eggsPerPack;
        const k = l.secondarySize ? `${l.primarySize}-${l.secondarySize}` : (l.primarySize ?? "?");
        const r = l.secondarySize ? splitRatioFor(k) : null;
        if (r) {
          const [a, b] = splitMixedQty(eggs, r);
          m[r.primary] = (m[r.primary] ?? 0) + a;
          m[r.secondary] = (m[r.secondary] ?? 0) + b;
        } else {
          m[k] = (m[k] ?? 0) + eggs;
        }
      }
    }
    return Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allOrders, splitRatioFor]);
  const pqBySizeTotal = pqBySize.reduce((s, [, v]) => s + v, 0);

  // "Expected available eggs" for this date — same sources as Grading > Plan
  // today's grading: Confirmed = the manually entered opening stock by size,
  // From grading = today's jobs (real recorded results where they exist, else
  // the yield-model forecast). Available = the two summed.
  const [openingStock, setOpeningStock] = useState<Record<string, number>>({});
  const [gradingLots, setGradingLots] = useState<GradingLot[]>([]);
  const [gradingJobs, setGradingJobs] = useState<GradingJob[]>([]);
  const [gradingResults, setGradingResults] = useState<GradingJobResult[]>([]);
  const [yieldModels, setYieldModels] = useState<YieldModel[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async <T,>(url: string, apply: (data: T) => void) => {
      try {
        const r = await fetch(url);
        if (r.ok && !cancelled) apply(await r.json());
      } catch (err) {
        console.error(err);
      }
    };
    load<{ size: string; qty: number }[]>(`/api/grading/opening-stock?date=${date}`, rows => {
      const m: Record<string, number> = {};
      for (const row of rows) m[row.size] = row.qty;
      setOpeningStock(m);
    });
    load<GradingLot[]>("/api/grading/receiving-lots", setGradingLots);
    load<GradingJob[]>("/api/grading/jobs", setGradingJobs);
    load<GradingJobResult[]>("/api/grading/job-results", setGradingResults);
    load<YieldModel[]>("/api/grading/yield-models", setYieldModels);
    return () => { cancelled = true; };
  }, [date]);

  const fromGradingBySize = useMemo(() => {
    const resultByJobId: Record<number, GradingJobResult> = {};
    for (const r of gradingResults) resultByJobId[r.jobId] = r;
    const activeModel = yieldModels.find(m => m.active) ?? null;
    return computeGradingFromJobs(activeModel, gradingLots, gradingJobs, resultByJobId, date).fromJobsBySize;
  }, [gradingLots, gradingJobs, gradingResults, yieldModels, date]);

  // Rows: every size with PQ demand, plus any size that has eggs available
  // but no demand (so supply isn't hidden just because nothing asks for it).
  const sizeRows = useMemo(() => {
    const demand = new Map(pqBySize);
    const keys = new Set<string>(demand.keys());
    const opening = splitSupply(openingStock);
    const graded = splitSupply(fromGradingBySize);
    for (const [k, v] of Object.entries(opening)) if (v > 0 && k !== "6") keys.add(k);
    for (const [k, v] of Object.entries(graded)) if (v > 0 && k !== "6") keys.add(k);
    const ad = refCols.ad ? splitSupply(adRaw) : {};
    for (const [k, v] of Object.entries(ad)) if (Math.round(v) > 0 && k !== "6") keys.add(k);
    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map(size => {
        const confirmed = opening[size] ?? 0;
        const fromGrading = graded[size] ?? 0;
        const available = confirmed + fromGrading;
        const eggs = demand.get(size) ?? 0;
        const adEggs = Math.round(ad[size] ?? 0);
        return { size, confirmed, fromGrading, available, eggs, balance: available - eggs, adEggs, adBalance: available - adEggs };
      });
  }, [pqBySize, openingStock, fromGradingBySize, splitSupply, refCols.ad, adRaw]);
  const adTotal = sizeRows.reduce((sum, r) => sum + r.adEggs, 0);
  const availTotals = sizeRows.reduce(
    (a, r) => ({
      confirmed: a.confirmed + r.confirmed,
      fromGrading: a.fromGrading + r.fromGrading,
      available: a.available + r.available,
      balance: a.balance + r.balance,
    }),
    { confirmed: 0, fromGrading: 0, available: 0, balance: 0 },
  );

  const [pqByCustomer, setPqByCustomer] = useState(false);
  const pqCustomerNames = useMemo(
    () => Array.from(new Set(allOrders.map(o => o.partnerName))).sort(),
    [allOrders],
  );
  const pqBySizeByCustomer = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const o of allOrders) {
      for (const l of o.lines) {
        const eggs = (l.planningQty ?? l.orderQty) * l.eggsPerPack;
        if (eggs <= 0) continue;
        const k = l.secondarySize ? `${l.primarySize}-${l.secondarySize}` : (l.primarySize ?? "?");
        const r = l.secondarySize ? splitRatioFor(k) : null;
        const parts: [string, number][] = r
          ? (() => { const [a, b] = splitMixedQty(eggs, r); return [[r.primary, a], [r.secondary, b]] as [string, number][]; })()
          : [[k, eggs]];
        for (const [key, qty] of parts) {
          if (!m[key]) m[key] = {};
          m[key][o.partnerName] = (m[key][o.partnerName] ?? 0) + qty;
        }
      }
    }
    return m;
  }, [allOrders, splitRatioFor]);

  // Pairs shown in the calculation-basis popover: every pair in master data,
  // plus any pair present in today's demand/supply.
  const mixPairs = useMemo(() => {
    const set = new Set<string>(mixRatios.map(r => r.pair));
    for (const o of allOrders) for (const l of o.lines) if (l.secondarySize) set.add(`${l.primarySize}-${l.secondarySize}`);
    for (const k of [...Object.keys(openingStock), ...Object.keys(fromGradingBySize)])
      if (k !== "mixed" && k.includes("-")) set.add(k);
    return Array.from(set).sort();
  }, [mixRatios, allOrders, openingStock, fromGradingBySize]);

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Takes an explicit order-id list (defaulting to the current selection)
  // rather than only ever reading `selected` — a caller that just called
  // setSelected(...) can't rely on `selected` reflecting that yet (state
  // updates aren't synchronous), so the row menu's "single order" shortcut
  // needs to pass its own id directly instead of racing the selection state.
  const createPlan = async (orderIds?: number[]) => {
    const ids = orderIds ?? Array.from(selected);
    if (ids.length === 0) return;
    const selectedOrders = allOrders.filter(o => ids.includes(o.id));
    const keyOf = (o: (typeof allOrders)[number]) => orderGroupInfo(o, groupBy).label;
    const labels = new Set(selectedOrders.map(keyOf));
    const groupLabel = labels.size === 1 ? Array.from(labels)[0] : `${labels.size} groups`;
    const roundLabel = typeof activeRound === "number" ? `R${activeRound}` : "P";
    const letter = String.fromCharCode(65 + plans.length);
    const label = `${roundLabel}-${letter}`;
    setSelected(new Set());
    try {
      await fetch("/api/orders/preliminary-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: date,
          productionRound: typeof activeRound === "number" ? activeRound : null,
          label,
          groupLabel,
          orderIds: ids,
        }),
      });
      await fetchPlans();
    } catch (err) {
      console.error(err);
    }
  };

  const updatePlan = async (
    id: number,
    fields: Partial<{
      vehicleId: string;
      loadInDate: string;
      loadInTime: string;
      deliverPlanDate: string;
      deliverPlanTime: string;
    }>,
  ) => {
    setPlans(prev => prev.map(x => (x.id === id ? { ...x, ...fields } : x)));
    try {
      await fetch(`/api/orders/preliminary-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deletePlan = async (id: number) => {
    setPlans(prev => prev.filter(x => x.id !== id));
    try {
      await fetch(`/api/orders/preliminary-plans/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  // Reason is required (matches the design reference's "Defer planning to
  // O-R{n}" dialog) and recorded on the orders — forward-only (round + 1
  // only, no "undo defer" action anywhere), OQ untouched.
  const deferToNextRound = async (orderIds: number[], reason: string, reasonNote: string) => {
    if (typeof activeRound !== "number" || orderIds.length === 0) return;
    setDeferring(true);
    try {
      await fetch("/api/orders/assign-round", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds,
          round: activeRound + 1,
          deferReason: reason,
          deferReasonNote: reasonNote || null,
          deferredFromRound: activeRound,
        }),
      });
      setSelected(new Set());
      setDeferModalIds(null);
      onRefresh();
    } finally {
      setDeferring(false);
      setOpenMenu(null);
    }
  };

  const addToExistingPlan = async (planId: number, orderIds: number[]) => {
    setAddPlanMenu(null);
    setSelected(new Set());
    setOpenMenu(null);
    try {
      await fetch(`/api/orders/preliminary-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOrderIds: orderIds }),
      });
      await fetchPlans();
    } catch (err) {
      console.error(err);
    }
  };

  // Removes one order from a plan (back to unassigned-in-round — it stays in
  // this round, just no longer attached to a vehicle/timing plan).
  const removeFromPlan = async (planId: number, orderId: number) => {
    try {
      await fetch(`/api/orders/preliminary-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeOrderIds: [orderId] }),
      });
      await fetchPlans();
    } catch (err) {
      console.error(err);
    }
  };

  // "Move to another plan" = remove from the source, add to the target — two
  // real calls, no single move endpoint exists (or needs to — a plan's
  // orderIds are its only link to its orders).
  const moveOrderToPlan = async (fromPlanId: number, toPlanId: number, orderId: number) => {
    try {
      await fetch(`/api/orders/preliminary-plans/${fromPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeOrderIds: [orderId] }),
      });
      await fetch(`/api/orders/preliminary-plans/${toPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOrderIds: [orderId] }),
      });
      await fetchPlans();
    } catch (err) {
      console.error(err);
    }
  };

  const roundLabel = typeof activeRound === "number" ? `R${activeRound}` : "ทั้งหมด";

  return (
    <div id="daily-plan-section-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px] font-bold text-[#1a1a1a]">1. Orders in round &amp; preliminary plans</span>
        {typeof activeRound === "number" && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              roundClosed
                ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC]"
                : "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]"
            }`}
          >
            ● {roundLabel} · {roundClosed ? "Closed" : "Working"}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E1E5EA]">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f0f0] flex-wrap text-[12px]">
          <span className="text-[#555]">
            Orders <b className="text-[#1a1a1a]">{awaitingPlan.length}</b> · to group{" "}
            <b className="text-[#1a1a1a]">{awaitingPlan.length}</b>
          </span>
          <span className="text-[#e3e5e8]">|</span>
          <span className="text-[#555]">
            Plans <b className="text-[#1a1a1a]">{plans.length}</b>
          </span>
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#1E3A5F] text-white">
            Awaiting plan {awaitingPlan.length}
          </span>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer / site / PO"
            className="ml-auto w-56 px-2.5 py-1 text-[12px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
          />
          <span className="text-[11px] text-[#888]">Organize by:</span>
          <div className="inline-flex items-center gap-1.5">
            {([["area", "Area · time"], ["customer", "Customer"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setGroupBy(key)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
                  groupBy === key
                    ? "bg-[#1E3A5F] text-white border-[#1E3A5F]"
                    : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {selected.size > 0 && (() => {
          const selectedIds = Array.from(selected);
          const selectedOrders = allOrders.filter(o => selectedIds.includes(o.id));
          const selectedEggs = selectedOrders.reduce((s, o) => s + orderEggs(o), 0);
          return (
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f0f0] bg-[#EFF6FF] flex-wrap">
              <span className="text-[12px] font-semibold text-[#1a1a1a]">
                Selected {selectedIds.length} orders · {fmtNum(selectedEggs)} eggs
              </span>
              <button
                onClick={() => createPlan()}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
              >
                Create plan
              </button>
              <button
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setAddPlanMenu(
                    addPlanMenu ? null : { orderIds: selectedIds, anchor: { top: r.bottom + 4, right: window.innerWidth - r.right } },
                  );
                }}
                disabled={plans.length === 0}
                title={plans.length === 0 ? "No existing plans yet — create one first" : undefined}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] bg-white text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to existing plan...
              </button>
              {typeof activeRound === "number" && (
                <button
                  onClick={() => setDeferModalIds(selectedIds)}
                  className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]"
                >
                  → Defer to O-R{activeRound + 1}
                </button>
              )}
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto text-[12px] font-semibold text-[#1E40AF] hover:underline"
              >
                Clear
              </button>
            </div>
          );
        })()}

        <div className="px-4 pt-3 pb-1 text-[14px] font-bold text-[#1a1a1a]">
          Awaiting shipment plan ({awaitingPlan.length})
        </div>
        {groups.length === 0 ? (
          <div className="py-10 text-center text-[#bbb] text-sm">ไม่มีออเดอร์ที่ต้องจัดกลุ่ม</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#fafbfc] border-y border-[#f0f0f0] text-[10px] font-bold uppercase tracking-wider text-[#888]">
                <th className="w-8 px-4 py-2" />
                <th className="text-left px-3 py-2">Order / destination</th>
                <th className="text-left px-3 py-2">Delivery area</th>
                <th className="text-left px-3 py-2">Deliver</th>
                <th className="text-right px-3 py-2">OQ · Working PQ (eggs)</th>
                <th className="w-14 px-3 py-2" />
              </tr>
            </thead>
            {groups.map(g => {
              const groupIds = g.orders.map(o => o.id);
              const allSelected = groupIds.every(id => selected.has(id));
              const groupEggs = g.orders.reduce((sum, o) => sum + orderEggs(o), 0);
              return (
                <tbody key={g.label}>
                  <tr className="bg-[#fafbfc] border-b border-[#f0f0f0]">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(prev => {
                            const next = new Set(prev);
                            groupIds.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
                            return next;
                          })
                        }
                        className="w-4 h-4 rounded accent-[#1E40AF] cursor-pointer"
                      />
                    </td>
                    <td colSpan={3} className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {g.area != null ? (
                          <>
                            <span className="font-bold text-[#1a1a1a]">{g.area}</span>
                            <span className="text-[#92400E]">
                              · deliver {fmtDayMonth(g.date)}
                              {g.time ? ` ${g.time}` : " · time missing"}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-[#1a1a1a]">{g.label}</span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-[#eef0f3] text-[11px] font-medium text-[#555]">
                          {g.orders.length} orders
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#555]">
                      <b className="text-[#1a1a1a]">{fmtNum(groupEggs)}</b> eggs
                    </td>
                    <td />
                  </tr>
                  {g.orders.map(o => {
                    const eggs = orderEggs(o);
                    const sameDay = !!o.orderDate && o.orderDate.slice(0, 10) === o.deliveryDate.slice(0, 10);
                    const subArea = [o.deliveryDistrict, o.deliveryProvince].filter(Boolean).join(" · ");
                    return (
                      <tr key={o.id} data-order-row={o.id} className="border-b border-[#f0f0f0] hover:bg-[#f5f5f5] transition-shadow">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(o.id)}
                            onChange={() => toggle(o.id)}
                            className="w-4 h-4 rounded accent-[#1E40AF] cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <CustPill name={o.partnerName} />
                            <span className="text-[#1a1a1a]">{o.deliverySiteName}</span>
                          </div>
                          {o.poNumber && (
                            <code className="font-mono text-[10px] text-[#666] mt-0.5 inline-block">
                              PO {o.poNumber}
                            </code>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[#555]">
                          <div>{o.deliveryRegion || NO_AREA}</div>
                          {subArea && <div className="text-[11px] text-[#999]">{subArea}</div>}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-[#555]">
                          <div>
                            {sameDay && <span className="text-[#D97706] mr-1">⚡</span>}
                            {fmtDayMonth(o.deliveryDate)}
                            {o.deliveryTime ? ` ${o.deliveryTime}` : ""}
                          </div>
                          {!o.deliveryTime && <div className="text-[11px] text-[#92400E]">time missing</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-[#1a1a1a]">
                          {fmtNum(eggs)}
                        </td>
                        <td className="px-3 py-2 text-right relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === o.id ? null : o.id)}
                            className="w-6 h-6 rounded border border-[#d6d8dc] text-[#888] hover:bg-[#f5f5f5]"
                          >
                            ⋯
                          </button>
                          {openMenu === o.id && (
                            <div className="absolute right-3 top-8 z-20 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-48 text-left">
                              <button
                                onClick={() => { createPlan([o.id]); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
                              >
                                Create plan
                              </button>
                              <button
                                onClick={e => {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setAddPlanMenu({ orderIds: [o.id], anchor: { top: r.bottom + 4, right: window.innerWidth - r.right } });
                                  setOpenMenu(null);
                                }}
                                disabled={plans.length === 0}
                                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add to existing plan...
                              </button>
                              {typeof activeRound === "number" && (
                                <button
                                  onClick={() => { setDeferModalIds([o.id]); setOpenMenu(null); }}
                                  className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
                                >
                                  → Defer to O-R{activeRound + 1}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[12px] font-semibold text-[#1a1a1a]">
          Preliminary shipment plans ({plans.length})
        </span>
      </div>
      {plans.length === 0 ? (
        <div className="mt-1 py-6 text-center text-[#bbb] text-[12px] bg-white rounded-xl border border-dashed border-[#e3e5e8]">
          No active plans — select orders above, then "Create plan"
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {plans.map(p => {
            const pOrders = allOrders.filter(o => p.orderIds.includes(o.id));
            const eggs = pOrders.reduce((s, o) => s + orderEggs(o), 0);
            const stops = new Set(pOrders.map(o => o.deliverySiteName)).size;
            const requestedDate = pOrders[0]?.deliveryDate ?? "—";
            const vehicle = vehicles.find(v => String(v.id) === p.vehicleId);
            const complete = !!p.vehicleId && !!p.loadInDate && !!p.deliverPlanDate;

            return (
              <div
                key={p.id}
                data-plan-card={p.id}
                className={`bg-white rounded-xl border-2 transition-shadow ${
                  complete ? "border-[#86EFAC]" : "border-[#2563EB]"
                }`}
              >
                <div className="flex items-center justify-between px-4 pt-3.5">
                  <span className="text-[15px] font-bold text-[#1a1a1a]">Plan {p.label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        complete
                          ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC]"
                          : "bg-[#F1F2F4] text-[#5F5E5A] border-[#e3e5e8]"
                      }`}
                    >
                      {complete ? "Ready" : "Incomplete"}
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => setPlanMenuOpen(planMenuOpen === p.id ? null : p.id)}
                        className="w-6 h-6 rounded border border-[#d6d8dc] text-[#888] hover:bg-[#f5f5f5]"
                      >
                        ⋯
                      </button>
                      {planMenuOpen === p.id && (
                        <div className="absolute right-0 top-8 z-20 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-36 text-left">
                          <button
                            onClick={() => {
                              deletePlan(p.id);
                              setPlanMenuOpen(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-[#c0392b] hover:bg-[#f5f5f5]"
                          >
                            ลบแผน (Delete)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-4 pt-0.5 pb-3 text-[12px] text-[#999]">{p.groupLabel}</div>

                <div className="border-t border-[#f0f0f0] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <select
                    value={p.vehicleId}
                    onChange={e => updatePlan(p.id, { vehicleId: e.target.value })}
                    className="px-2.5 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg bg-white min-w-[160px]"
                  >
                    <option value="">— vehicle —</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} · {v.vehicleType}
                        {v.capacityEggs ? ` · ${fmtNum(v.capacityEggs)}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="text-right">
                    <span className="text-[20px] font-bold tabular-nums text-[#1a1a1a]">{fmtNum(eggs)}</span>
                    <span className="text-[12px] text-[#888]"> eggs</span>
                    {vehicle?.capacityEggs ? (
                      <span className="text-[12px] text-[#888]">
                        {" "}
                        · used {Math.round((eggs / vehicle.capacityEggs) * 100)}%
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-[#92400E]">
                        {" "}
                        · {vehicle ? vehicle.plateNumber : "no vehicle"}
                      </span>
                    )}
                    {vehicle?.capacityEggs ? (
                      eggs <= vehicle.capacityEggs ? (
                        <div className="text-[13px] font-medium text-[#555]">Within vehicle capacity</div>
                      ) : (
                        <div className="text-[13px] font-semibold text-[#c0392b]">
                          Over capacity by {fmtNum(eggs - vehicle.capacityEggs)} eggs
                        </div>
                      )
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-[#f0f0f0] px-4 py-2.5 flex items-center gap-4 text-[12px] text-[#555]">
                  <span>🕐 requested {requestedDate}</span>
                  <span>⇄ {stops} stops</span>
                </div>

                <div className="border-t border-[#f0f0f0] px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    {p.loadInDate ? (
                      <span className="text-[12px] text-[#555]">
                        Load-in {p.loadInDate} {p.loadInTime}
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-[#92400E]">Load-in not set</span>
                    )}
                    {p.deliverPlanDate ? (
                      <span className="text-[12px] text-[#555]">
                        Deliver (plan) {p.deliverPlanDate} {p.deliverPlanTime}
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-[#92400E]">Delivery plan not set</span>
                    )}
                  </div>
                  <button
                    onClick={() => setLoadInEditing(p.id)}
                    disabled={roundClosed}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border-2 border-[#1E40AF] text-[#1E40AF] hover:bg-[#EFF6FF] disabled:opacity-50 disabled:cursor-not-allowed disabled:border-[#d6d8dc] disabled:text-[#888] disabled:hover:bg-transparent"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit timing
                  </button>
                </div>

                {loadInEditing === p.id && (
                  <PlanTimingModal
                    plan={p}
                    requestedDate={requestedDate}
                    eggs={eggs}
                    stops={stops}
                    vehicleLabel={vehicle ? vehicle.plateNumber : "no vehicle"}
                    complete={complete}
                    roundClosed={roundClosed}
                    onSave={fields => updatePlan(p.id, fields)}
                    onClose={() => setLoadInEditing(null)}
                  />
                )}

                <div className="border-t border-[#f0f0f0] px-4 py-2.5">
                  <button
                    onClick={() => setExpandedPlan(p.id)}
                    className="text-[12px] font-semibold text-[#1E40AF] hover:underline"
                  >
                    {pOrders.length} orders ﹀
                  </button>
                  {expandedPlan === p.id && (
                    <PlanOrdersModal
                      plan={p}
                      orders={pOrders}
                      vehicle={vehicle}
                      eggs={eggs}
                      stops={stops}
                      complete={complete}
                      otherPlans={plans.filter(x => x.id !== p.id)}
                      activeRound={activeRound}
                      onClose={() => setExpandedPlan(null)}
                      onRemove={orderId => removeFromPlan(p.id, orderId)}
                      onMove={(toPlanId, orderId) => moveOrderToPlan(p.id, toPlanId, orderId)}
                      onDefer={orderId => { setDeferModalIds([orderId]); setExpandedPlan(null); }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 mb-2">
        <span className="text-[14px] font-bold text-[#1a1a1a]">2. AQ &amp; projected available eggs by size</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-[#F1F2F4] text-[#5F5E5A] border-[#e3e5e8]">
          read-only
        </span>
      </div>
      <div className="bg-white rounded-xl border border-[#E1E5EA]">
        <div className="px-4 py-2.5 rounded-t-xl border-b border-[#f0f0f0] text-[11px] text-[#999]">
          Confirmed = opening stock entered in Grading. From grading = today's grading jobs (recorded results
          where available, otherwise the yield-model forecast). Balance = Available − PQ demand.
        </div>
        {(() => {
          const first = mixRatioByPair.get(mixPairs[0]);
          const dash = (p: string | undefined) => (p ?? "").replace("-", "–");
          const basisTxt =
            first && first.minPrimary != null
              ? `mixed basis: min-primary % from Master Data · คละ ${dash(first.pair)} → size ${first.primary}: ${first.minPrimary}% · size ${first.secondary}: ${100 - first.minPrimary}%`
              : `no usable ratio to split · คละ ${dash(mixPairs[0])}`;
          return (
            <div className="relative flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f0f0] bg-[#fafbfc] flex-wrap text-[12px]">
              {mixPairs.length > 0 && (
              <>
              <span className="text-[#888]">Calculation basis:</span>
              <button
                onClick={() => setMixPopOpen(o => !o)}
                aria-haspopup="dialog"
                aria-expanded={mixPopOpen}
                className="px-3 py-1 text-[12px] font-semibold text-[#1a1a1a] bg-white border border-[#d6d8dc] rounded-lg hover:border-[#999]"
              >
                Mixed-egg calculation method
              </button>
              <span className="text-[11px] text-[#6B7A90] max-w-[420px] truncate" title={basisTxt}>
                {basisTxt}
                {mixPairs.length > 1 && <span className="opacity-70"> +{mixPairs.length - 1}</span>}
              </span>
              <span className="w-px h-4 bg-[#e3e5e8]" />
              </>
              )}

              <span className="text-[#888]">Quantity columns:</span>
              <b className="text-[#1a1a1a]">
                {[refCols.ad && "AQ", refCols.latest && "Latest confirmed PQ", "PQ through round"].filter(Boolean).join(" · ")}
              </b>
              <button
                onClick={() => setColPopOpen(o => !o)}
                aria-haspopup="dialog"
                aria-expanded={colPopOpen}
                className="text-[12px] text-[#1E40AF] underline hover:no-underline"
              >
                Adjust columns
              </button>

              {colPopOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setColPopOpen(false)} />
                  <div
                    role="dialog"
                    aria-label="Reference columns"
                    className="absolute right-4 top-full mt-1 z-40 w-[300px] bg-white border border-[#e3e5e8] rounded-xl shadow-lg p-4"
                  >
                    <div className="text-[13px] font-bold text-[#1a1a1a] mb-1">Reference columns</div>
                    <label className="flex items-center gap-2.5 py-2 text-[12px] text-[#253044] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={refCols.ad}
                        onChange={() => toggleRefCol("ad")}
                        className="w-4 h-4 accent-[#1E40AF]"
                      />
                      AQ reference
                    </label>
                    <label className="flex items-center gap-2.5 py-2 text-[12px] text-[#253044] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={refCols.latest}
                        onChange={() => toggleRefCol("latest")}
                        className="w-4 h-4 accent-[#1E40AF]"
                      />
                      <span>Latest confirmed PQ</span>
                      <span className="text-[10px] font-semibold text-[#A96B04]">⚠ no previously confirmed PQ</span>
                    </label>
                    <label className="flex items-center gap-2.5 py-2 text-[12px] text-[#253044]">
                      <input type="checkbox" checked disabled className="w-4 h-4" />
                      <span>PQ through this round</span>
                      <span className="text-[10px] text-[#94a3b8] ml-auto">required · active position</span>
                    </label>
                    <div className="flex justify-end border-t border-[#EEF0F3] pt-2 mt-1">
                      <button
                        onClick={() => setColPopOpen(false)}
                        className="px-3 py-1 text-[12px] font-semibold border border-[#d6d8dc] rounded-lg hover:bg-[#f5f5f5]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}

              {mixPopOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMixPopOpen(false)} />
                  <div
                    role="dialog"
                    aria-label="Mixed-demand basis"
                    className="absolute left-4 top-full mt-1 z-40 w-[360px] bg-white border border-[#e3e5e8] rounded-xl shadow-lg p-4"
                  >
                    <div className="text-[13px] font-bold text-[#1a1a1a]">Mixed-demand basis</div>
                    <div className="text-[11px] text-[#6B7A90] mt-0.5 mb-2">
                      ratios come from Master Data (min-primary %) · choose whether to view it split into sizes or
                      kept as its own mixed row — your view only, never affects PQ
                    </div>
                    {mixPairs.map(pair => {
                      const r = mixRatioByPair.get(pair);
                      const usable = !!r && r.minPrimary != null && r.minPrimary >= 0 && r.minPrimary <= 100;
                      const on = usable && (mixSplit[pair] ?? true);
                      return (
                        <div key={pair} className="py-2 border-t border-[#EEF0F3]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-bold text-[#253044] min-w-[62px]">คละ {dash(pair)}</span>
                            <span className="inline-flex rounded-md overflow-hidden border border-[#d6d8dc]">
                              {([[true, "Split into sizes"], [false, "Own mixed row"]] as const).map(([split, label]) => {
                                const act = split ? on : !on;
                                return (
                                  <button
                                    key={label}
                                    disabled={!usable}
                                    onClick={() => setPairSplit(pair, split)}
                                    className={`px-2.5 py-1 text-[11px] ${
                                      act ? "bg-[#185FA5] text-white font-bold" : "bg-white text-[#444] disabled:text-[#9CA3AF]"
                                    } ${split ? "" : "border-l border-[#d6d8dc]"} disabled:cursor-not-allowed`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-[#6B7A90] mt-1">
                            {usable ? (
                              <>
                                {!on && <b className="text-[#525252]">shown as its own mixed row · </b>}
                                size {r!.primary} minimum {r!.minPrimary}% · size {r!.secondary} balance {100 - r!.minPrimary!}%
                              </>
                            ) : (
                              <span className="text-[#A96B04] font-semibold">⚠ no usable ratio in Master Data</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 border-t border-[#EEF0F3] pt-2 mt-1">
                      <span className="text-[10px] text-[#94a3b8]">saved on this browser</span>
                      <span className="flex-1" />
                      <button
                        onClick={() => setMixPopOpen(false)}
                        className="px-3 py-1 text-[12px] font-semibold border border-[#d6d8dc] rounded-lg hover:bg-[#f5f5f5]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
        {sizeRows.length === 0 ? (
          <div className="py-10 text-center text-[#bbb] text-sm">ไม่มีข้อมูล</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#fafbfc]">
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#888] uppercase" rowSpan={2}>
                    Size
                  </th>
                  <th
                    colSpan={3}
                    className="text-left px-4 py-1.5 text-[11px] font-bold text-[#555] border-l-2 border-[#d6d8dc]"
                  >
                    Expected available eggs
                  </th>
                  {refCols.ad && (
                    <th colSpan={2} className="text-left px-4 py-1.5 text-[11px] font-bold text-[#92400E] border-l-2 border-[#FCD34D] bg-[#FFFBEB]">
                      AQ reference <span className="font-normal text-[10px] opacity-80">· {aqConfig.days}-day avg</span>{" "}
                      <button onClick={() => setAqOpen(true)} className="text-[10px] font-semibold text-[#1E40AF] underline hover:no-underline">
                        Open AQ
                      </button>
                      {aqData?.insufficient && (
                        <div className="text-[10px] font-semibold text-[#A96B04]">⚠ insufficient history</div>
                      )}
                    </th>
                  )}
                  {refCols.latest && (
                    <th colSpan={2} className="text-left px-4 py-1.5 text-[11px] font-bold text-[#555] border-l-2 border-[#d6d8dc] bg-[#f6f7f9]">
                      Latest confirmed PQ
                      <div className="text-[10px] font-semibold text-[#A96B04]">⚠ none confirmed yet</div>
                    </th>
                  )}
                  <th
                    colSpan={pqByCustomer ? pqCustomerNames.length + 2 : 2}
                    className="text-left px-4 py-1.5 text-[11px] font-bold text-[#1E40AF] border-l-2 border-[#BFDBFE] bg-[#EFF6FF]"
                  >
                    PQ through this round
                    {pqByCustomer ? (
                      <>
                        {" "}
                        · by customer ·{" "}
                        <button
                          onClick={() => setPqByCustomer(false)}
                          className="underline hover:no-underline font-semibold"
                        >
                          Back to total
                        </button>
                      </>
                    ) : (
                      <>
                        {" "}
                        <button
                          onClick={() => setPqByCustomer(true)}
                          className="underline hover:no-underline font-semibold"
                        >
                          By customer
                        </button>
                      </>
                    )}
                  </th>
                </tr>
                <tr className="border-b border-[#e5e7eb] bg-[#fafbfc]">
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase border-l-2 border-[#d6d8dc]">
                    Confirmed
                  </th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">
                    From grading
                  </th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase">
                    Available
                  </th>
                  {refCols.ad && (
                    <>
                      <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase border-l-2 border-[#FCD34D] bg-[#FFFBEB]">Demand</th>
                      <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#FFFBEB]">Balance</th>
                    </>
                  )}
                  {refCols.latest && (
                    <>
                      <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase border-l-2 border-[#d6d8dc] bg-[#f6f7f9]">Demand</th>
                      <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#f6f7f9]">Balance</th>
                    </>
                  )}
                  {pqByCustomer ? (
                    <>
                      {pqCustomerNames.map((c, i) => (
                        <th
                          key={c}
                          className={`text-right px-4 py-2 text-[10px] font-semibold uppercase bg-[#EFF6FF] ${
                            i === 0 ? "border-l-2 border-[#BFDBFE]" : ""
                          }`}
                          style={{ color: custColor(c) }}
                        >
                          {c}
                        </th>
                      ))}
                      <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#EFF6FF]">
                        Total
                      </th>
                    </>
                  ) : (
                    <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase border-l-2 border-[#BFDBFE] bg-[#EFF6FF]">
                      Demand
                    </th>
                  )}
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#EFF6FF]">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {sizeRows.map(({ size, confirmed, fromGrading, available, eggs, balance, adEggs, adBalance }) => {
                  const cls = SIZE_PILL_CLS[size.split("-")[0]] ?? "bg-[#F1EFE8] text-[#5F5E5A]";
                  const byCust = pqBySizeByCustomer[size] ?? {};
                  return (
                    <tr key={size} className="border-b border-[#f5f5f5]">
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>
                          {size === "mixed" ? "คละ" : `เบอร์ ${size}`}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums border-l-2 border-[#f0f0f0] ${confirmed ? "text-[#1a1a1a]" : "text-[#ccc]"}`}>
                        {confirmed ? fmtNum(confirmed) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums ${fromGrading ? "text-[#1a1a1a]" : "text-[#ccc]"}`}>
                        {fromGrading ? fmtNum(fromGrading) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums ${available ? "font-bold text-[#1a1a1a]" : "text-[#ccc]"}`}>
                        {available ? fmtNum(available) : "—"}
                      </td>
                      {refCols.ad && (() => {
                        const b = balanceLabel(adBalance, !!(available || adEggs));
                        return (
                          <>
                            <td className={`px-4 py-2 text-right tabular-nums border-l-2 border-[#FDE68A] bg-[#FFFDF5] ${adEggs ? "text-[#1a1a1a]" : "text-[#ccc]"}`}>
                              {fmtNum(adEggs)}
                            </td>
                            <td className={`px-4 py-2 text-right tabular-nums font-semibold bg-[#FFFDF5] ${b.cls}`}>{b.text}</td>
                          </>
                        );
                      })()}
                      {refCols.latest && (
                        <>
                          <td className="px-4 py-2 text-right text-[#ccc] border-l-2 border-[#f0f0f0] bg-[#fafafa]">—</td>
                          <td className="px-4 py-2 text-right text-[#ccc] bg-[#fafafa]">—</td>
                        </>
                      )}
                      {pqByCustomer ? (
                        <>
                          {pqCustomerNames.map((c, i) => (
                            <td
                              key={c}
                              className={`px-4 py-2 text-right tabular-nums text-[#1a1a1a] bg-[#F7FAFF] ${
                                i === 0 ? "border-l-2 border-[#EFF6FF]" : ""
                              }`}
                            >
                              {byCust[c] ? fmtNum(byCust[c]) : "—"}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] bg-[#F7FAFF]">
                            {fmtNum(eggs)}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] border-l-2 border-[#EFF6FF] bg-[#F7FAFF]">
                          {fmtNum(eggs)}
                        </td>
                      )}
                      {(() => {
                        const b = balanceLabel(balance, !!(available || eggs));
                        return (
                          <td className={`px-4 py-2 text-right tabular-nums font-semibold bg-[#F7FAFF] ${b.cls}`}>{b.text}</td>
                        );
                      })()}
                    </tr>
                  );
                })}
                <tr>
                  <td className="px-4 py-2 font-bold text-[#1a1a1a]">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] border-l-2 border-[#f0f0f0]">
                    {fmtNum(availTotals.confirmed)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a]">
                    {fmtNum(availTotals.fromGrading)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a]">
                    {fmtNum(availTotals.available)}
                  </td>
                  {refCols.ad && (() => {
                    const b = balanceLabel(availTotals.available - adTotal, !!(availTotals.available || adTotal));
                    return (
                      <>
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] border-l-2 border-[#FDE68A] bg-[#FFFDF5]">
                          {fmtNum(adTotal)}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums font-bold bg-[#FFFDF5] ${b.cls}`}>{b.text}</td>
                      </>
                    );
                  })()}
                  {refCols.latest && (
                    <>
                      <td className="px-4 py-2 text-right text-[#ccc] border-l-2 border-[#f0f0f0] bg-[#fafafa]">—</td>
                      <td className="px-4 py-2 text-right text-[#ccc] bg-[#fafafa]">—</td>
                    </>
                  )}
                  {pqByCustomer ? (
                    <>
                      {pqCustomerNames.map((c, i) => {
                        const custTotal = pqBySize.reduce((s, [size]) => s + (pqBySizeByCustomer[size]?.[c] ?? 0), 0);
                        return (
                          <td
                            key={c}
                            className={`px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] bg-[#F7FAFF] ${
                              i === 0 ? "border-l-2 border-[#EFF6FF]" : ""
                            }`}
                          >
                            {fmtNum(custTotal)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] bg-[#F7FAFF]">
                        {fmtNum(pqBySizeTotal)}
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-[#1a1a1a] border-l-2 border-[#EFF6FF] bg-[#F7FAFF]">
                      {fmtNum(pqBySizeTotal)}
                    </td>
                  )}
                  {(() => {
                    const b = balanceLabel(availTotals.balance, !!(availTotals.available || pqBySizeTotal));
                    return (
                      <td className={`px-4 py-2 text-right tabular-nums font-bold bg-[#F7FAFF] ${b.cls}`}>{b.text}</td>
                    );
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {aqOpen && (
        <AqReferenceDialog
          date={date}
          config={aqConfig}
          data={aqData}
          loading={aqLoading}
          onChange={changeAqConfig}
          onClose={() => setAqOpen(false)}
        />
      )}

      {addPlanMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAddPlanMenu(null)} />
          <div
            className="fixed z-40 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-64 text-left"
            style={{ top: addPlanMenu.anchor.top, right: addPlanMenu.anchor.right }}
          >
            {plans.map(p => (
              <button
                key={p.id}
                onClick={() => addToExistingPlan(p.id, addPlanMenu.orderIds)}
                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
              >
                <span className="font-semibold">Plan {p.label}</span>{" "}
                <span className="text-[#888]">· {p.groupLabel} · {p.orderIds.length} orders</span>
              </button>
            ))}
          </div>
        </>
      )}

      {deferModalIds && (
        <DeferToNextRoundModal
          orderIds={deferModalIds}
          eggs={allOrders.filter(o => deferModalIds.includes(o.id)).reduce((s, o) => s + orderEggs(o), 0)}
          nextRound={typeof activeRound === "number" ? activeRound + 1 : 0}
          submitting={deferring}
          onCancel={() => setDeferModalIds(null)}
          onConfirm={(reason, note) => deferToNextRound(deferModalIds, reason, note)}
        />
      )}
    </div>
  );
}

// Reason is required (design reference: "Defer planning to O-R{n}" dialog) —
// pushes the selected orders' round forward by exactly one (forward-only, no
// "undo defer" anywhere) without touching their Order Quantity.
function DeferToNextRoundModal({
  orderIds,
  eggs,
  nextRound,
  submitting,
  onCancel,
  onConfirm,
}: {
  orderIds: number[];
  eggs: number;
  nextRound: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const REASONS = [
    { id: "trip", label: "Awaiting trip assignment" },
    { id: "vehicle", label: "Vehicle or capacity not ready" },
    { id: "delivery_time", label: "Awaiting a firm delivery date/time" },
    { id: "product", label: "Product constraint" },
    { id: "other", label: "Other" },
  ];
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const noteRequired = reason === "other";
  const canSubmit = !!reason && (!noteRequired || note.trim() !== "");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5">
          <div className="text-[16px] font-bold text-[#1a1a1a]">Defer planning to O-R{nextRound}</div>
          <div className="text-[12px] text-[#888] mt-0.5">
            {orderIds.length} orders · {fmtNum(eggs)} eggs · OQ unchanged · forward-only, no undo
          </div>

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#888]">Reason (required)</div>
          <div className="mt-2 space-y-2">
            {REASONS.map(r => (
              <label key={r.id} className="flex items-center gap-2 text-[13px] text-[#1a1a1a] cursor-pointer">
                <input
                  type="radio"
                  name="defer-reason"
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="accent-[#1E40AF]"
                />
                {r.label}
              </label>
            ))}
          </div>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Describe..."
            className="mt-3 w-full px-3 py-2 text-[12.5px] border border-[#d6d8dc] rounded-lg bg-[#fafbfc] focus:outline-none focus:border-[#1E40AF]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason, note)}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
          >
            {submitting ? "Deferring..." : `→ Defer to O-R${nextRound}`}
          </button>
        </div>
      </div>
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

// Quantity with up to 1 decimal (selling-unit mode can be fractional)
function fmtQty(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 1 });
}

// Eggs per one selling unit (may differ from the pack unit)
function sellFactor(line: { eggsPerSellingUnit?: number; eggsPerPack: number }): number {
  return line.eggsPerSellingUnit && line.eggsPerSellingUnit > 0 ? line.eggsPerSellingUnit : line.eggsPerPack;
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

// ── Customer sheet (print) ─────────────────────────────────────────────────────
// One customer's planning reference for the round: every SKU on their catalogue
// (item_business_partners) plus anything they've actually ordered, zero rows
// greyed. Qty is the order quantity in the selling unit; "PQ draft" is the
// working planning quantity in eggs (unsaved edits from the grid included).
function CustomerSheetModal({
  customerName,
  partnerId,
  roundLabel,
  loadInDate,
  orders,
  pending,
  onClose,
}: {
  customerName: string;
  partnerId: number;
  roundLabel: string;
  loadInDate: string;
  orders: PlanOrder[];
  pending: Record<number, string>;
  onClose: () => void;
}) {
  const [catalogue, setCatalogue] = useState<
    { sku: string; itemName: string; sellingUnit: string; eggsPerPack: number; primarySize: string | null; secondarySize: string | null }[] | null
  >(null);

  useEffect(() => {
    fetch("/api/items")
      .then(r => (r.ok ? r.json() : []))
      .then((items: any[]) =>
        setCatalogue(
          items
            .filter(i => i.isSellable && i.eggsPerPack && (i.partners ?? []).some((p: any) => p.partnerId === partnerId))
            .map(i => ({
              sku: i.sku ?? "",
              itemName: i.name,
              sellingUnit: i.sellingUnit ?? "",
              eggsPerPack: i.eggsPerPack,
              primarySize: i.primarySize ?? null,
              secondarySize: i.secondarySize ?? null,
            })),
        ),
      )
      .catch(() => setCatalogue([]));
  }, [partnerId]);

  const rows = useMemo(() => {
    const m = new Map<string, {
      sku: string; itemName: string; sellingUnit: string; eggsPerPack: number;
      primarySize: string | null; secondarySize: string | null; qty: number; eggs: number; pqEggs: number;
    }>();
    for (const c of catalogue ?? []) m.set(c.sku, { ...c, qty: 0, eggs: 0, pqEggs: 0 });
    for (const o of orders)
      for (const l of o.lines) {
        const r = m.get(l.sku) ?? {
          sku: l.sku, itemName: l.itemName, sellingUnit: l.sellingUnit, eggsPerPack: l.eggsPerPack,
          primarySize: l.primarySize, secondarySize: l.secondarySize, qty: 0, eggs: 0, pqEggs: 0,
        };
        const ep = pending[l.lineId];
        r.qty += l.orderQty;
        r.eggs += l.orderQty * l.eggsPerPack;
        r.pqEggs += ep !== undefined ? parseInt(ep, 10) || 0 : (l.planningQty ?? l.orderQty) * l.eggsPerPack;
        m.set(l.sku, r);
      }
    return Array.from(m.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  }, [catalogue, orders, pending]);

  const totalEggs = rows.reduce((s, r) => s + r.eggs, 0);
  const totalPq = rows.reduce((s, r) => s + r.pqEggs, 0);
  const printedAt = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  // Opens straight into the print dialog once the catalogue has loaded.
  useEffect(() => {
    if (catalogue === null) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [catalogue]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #cust-sheet-print, #cust-sheet-print * { visibility: visible; }
          #cust-sheet-print {
            position: absolute; top: 0; left: 0; width: 100% !important; max-width: none !important;
            box-shadow: none !important; border-radius: 0 !important; background: #fff !important;
          }
          #cust-sheet-print .csm-chrome { display: none !important; }
          #cust-sheet-print table { border-collapse: collapse !important; width: 100% !important; }
          #cust-sheet-print th, #cust-sheet-print td {
            border: 1px solid #999 !important; padding: 3px 6px !important; font-size: 10pt !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>
      <div
        id="cust-sheet-print"
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="csm-chrome flex items-center justify-end gap-2 px-5 py-3 border-b border-[#e5e7eb]">
          <button
            onClick={() => window.print()}
            disabled={catalogue === null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            Close
          </button>
        </div>

        <div className="px-6 pt-5 pb-3 border-b-2 border-[#1a1a1a] flex items-center gap-3 flex-wrap">
          <span
            className="px-3 py-1 rounded-full text-white text-[15px] font-bold"
            style={{ background: custColor(customerName), WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
          >
            {customerName}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#1E293B] text-white text-[12px] font-bold" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            Round {roundLabel}
          </span>
          <span className="text-[13px] text-[#1a1a1a]">Customer sheet</span>
          <span className="ml-auto text-[12px] text-[#333]">
            Load-in date {loadInDate} · {orders.length} orders · printed {printedAt}
          </span>
        </div>

        <div className="px-6 py-4">
          {catalogue === null ? (
            <div className="py-10 text-center text-[#aaa] text-sm">Loading...</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[12px] font-bold text-[#1a1a1a] border-b border-[#999]">
                  <th className="px-2 py-1.5">SKU</th>
                  <th className="px-2 py-1.5">Item</th>
                  <th className="px-2 py-1.5">Pack</th>
                  <th className="px-2 py-1.5">Size</th>
                  <th className="px-2 py-1.5 text-right">Qty</th>
                  <th className="px-2 py-1.5">Unit</th>
                  <th className="px-2 py-1.5 text-right">Eggs</th>
                  <th className="px-2 py-1.5 text-right">PQ draft (eggs)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const zero = r.qty === 0 && r.pqEggs === 0;
                  return (
                    <tr key={r.sku} className={`border-b border-[#ddd] ${zero ? "text-[#aaa]" : "text-[#1a1a1a]"}`}>
                      <td className="px-2 py-1.5 font-mono font-bold text-[11px]">{r.sku}</td>
                      <td className="px-2 py-1.5">{r.itemName}</td>
                      <td className="px-2 py-1.5">{r.sellingUnit} {r.eggsPerPack}</td>
                      <td className="px-2 py-1.5">
                        <SizePill primary={r.primarySize} secondary={r.secondarySize} />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(r.qty)}</td>
                      <td className="px-2 py-1.5">{r.sellingUnit}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(r.eggs)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtNum(r.pqEggs)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold text-[#1a1a1a]">
                  <td colSpan={6} className="px-2 py-1.5 text-right">Total — {customerName} · {roundLabel}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(totalEggs)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(totalPq)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <div className="mt-3 text-[11px] text-[#777]">Planning reference — actual pick quantities follow the picklist</div>
        </div>
      </div>
    </div>
  );
}

function PlanningGrid({
  date,
  partners,
  activeRound,
  roundClosed,
  roundStates,
  trips,
  rounds,
  roundEggTotals,
  onRefresh,
  onRoundPlansChange,
}: {
  date: string;
  partners: PlanPartner[];
  activeRound: Round | "ALL";
  roundClosed: boolean;
  roundStates: Record<number, RoundState>;
  trips: PlanTrip[];
  rounds: Round[];
  roundEggTotals: Record<number, number>;
  onRefresh: () => void;
  // Bubbles the preliminary-plan draft (built in section 1, below) up to
  // DailyPlan() so "Send O-R{n}" can check every round order is covered
  // before actually closing the round. Real, but session-only — these plans
  // are local UI state, never persisted, so this check only "remembers"
  // plans built since the page was last loaded.
  onRoundPlansChange?: (plans: PrelimPlanRow[]) => void;
}) {
  const [pending, setPending] = useState<Record<number, string>>({});
  const [savingLine, setSavingLine] = useState<Record<number, boolean>>({});
  const [switchingRound, setSwitchingRound] = useState<Record<number, boolean>>({});
  const [custFilter, setCustFilter] = useState("ALL");
  const [printCust, setPrintCust] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"eggs" | "pack" | "sell">("eggs");
  const [showZeroSku, setShowZeroSku] = useState(false);
  const [editingCell, setEditingCell] = useState<number | null>(null);
  const [focusPlanId, setFocusPlanId] = useState<number | "ALL" | "NONE">("ALL");
  const [focusPlans, setFocusPlans] = useState<PrelimPlanRow[]>([]);
  const [focusVehicles, setFocusVehicles] = useState<VehicleOption[]>([]);
  const handlePlansChange = useCallback((plans: PrelimPlanRow[], vehicles: VehicleOption[]) => {
    setFocusPlans(plans);
    setFocusVehicles(vehicles);
  }, []);
  useEffect(() => { onRoundPlansChange?.(focusPlans); }, [focusPlans, onRoundPlansChange]);

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

  const focusedPlan = focusPlanId === "ALL" || focusPlanId === "NONE" ? null : focusPlans.find(p => p.id === focusPlanId) ?? null;

  const filteredOrders = useMemo(() => {
    let rows = custFilter === "ALL" ? allOrders : allOrders.filter(o => o.partnerName === custFilter);
    if (focusedPlan) rows = rows.filter(o => focusedPlan.orderIds.includes(o.id));
    if (focusPlanId === "NONE") rows = rows.filter(o => !focusPlans.some(p => p.orderIds.includes(o.id)));
    return rows;
  }, [allOrders, custFilter, focusedPlan, focusPlanId, focusPlans]);

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
    if (viewMode === "eggs") return planEggs;
    if (viewMode === "sell") return Math.round((planEggs / sellFactor(line)) * 10) / 10;
    return Math.round(planEggs / line.eggsPerPack);
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
  const unit = viewMode === "eggs" ? "ฟอง" : viewMode === "pack" ? "Pack" : "หน่วยขาย";

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

  // Consecutive-run grouping of the SAME column order tripGroups renders, by
  // which preliminary plan (if any) each order belongs to — so the plan header
  // spans exactly the columns it applies to.
  const orderedColumnOrders = useMemo(() => tripGroups.flatMap(g => g.orders), [tripGroups]);
  const planGroups = useMemo(() => {
    const result: { plan: PrelimPlanRow | null; orders: typeof orderedColumnOrders }[] = [];
    for (const o of orderedColumnOrders) {
      const plan = focusPlans.find(p => p.orderIds.includes(o.id)) ?? null;
      const last = result[result.length - 1];
      if (last && (last.plan?.id ?? null) === (plan?.id ?? null)) {
        last.orders.push(o);
      } else {
        result.push({ plan, orders: [o] });
      }
    }
    return result;
  }, [orderedColumnOrders, focusPlans]);

  // Current-round draft PQ total — still used by the "3. Adjust & submit PQ"
  // summary line below. The old "PQ draft summary" card (current/previous
  // round/next-round/published-versions) that used to sit above that section
  // was removed — it's now redundant with the Order command bar's KPI band
  // (ทั้งวัน/รอบนี้ cards) at the top of the page, which covers the same
  // numbers with real data instead of this card's honest-but-static
  // placeholders for the two it couldn't back.
  const currentRoundEggs = useMemo(
    () =>
      partners.reduce(
        (s, p) =>
          s +
          p.orders.reduce(
            (os, o) => os + o.lines.reduce((ls, l) => ls + (l.planningQty ?? l.orderQty) * l.eggsPerPack, 0),
            0,
          ),
        0,
      ),
    [partners],
  );

  const oqTotal = useMemo(
    () =>
      partners.reduce(
        (s, p) => s + p.orders.reduce((os, o) => os + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0),
        0,
      ),
    [partners],
  );
  const orderCount = useMemo(() => partners.reduce((s, p) => s + p.orders.length, 0), [partners]);

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
      <OrdersRoundPlansSection
        date={date}
        partners={partners}
        activeRound={activeRound}
        roundClosed={roundClosed}
        onRefresh={onRefresh}
        onPlansChange={handlePlansChange}
      />

      <div className="flex items-center gap-2 mt-4 mb-2 flex-wrap">
        <span className="text-[14px] font-bold text-[#1a1a1a]">3. Adjust &amp; submit PQ</span>
        {typeof activeRound === "number" && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              roundClosed
                ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC]"
                : "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]"
            }`}
          >
            ● R{activeRound} · {roundClosed ? "Closed" : "Working"}
          </span>
        )}
        <span className="text-[11px] text-[#888]">
          {orderCount} orders · OQ {fmtNum(oqTotal)} · PQ draft {fmtNum(currentRoundEggs)}
        </span>
      </div>

      {focusPlans.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Focus plan:</span>
          <button
            onClick={() => setFocusPlanId("ALL")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
              focusPlanId === "ALL"
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
            }`}
          >
            All
          </button>
          {focusPlans.map(p => (
            <button
              key={p.id}
              onClick={() => setFocusPlanId(focusPlanId === p.id ? "ALL" : p.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
                focusPlanId === p.id
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                  : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
              }`}
            >
              Plan {p.label}
            </button>
          ))}
          <button
            onClick={() => setFocusPlanId(focusPlanId === "NONE" ? "ALL" : "NONE")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
              focusPlanId === "NONE"
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
            }`}
          >
            Unassigned
          </button>
          {focusedPlan && (
            <span className="text-[11px] text-[#aaa]">
              {focusedPlan.loadInDate ? `Load-in ${focusedPlan.loadInDate} ${focusedPlan.loadInTime}` : "Load-in not set"}
              {(() => {
                const v = focusVehicles.find(v => String(v.id) === focusedPlan.vehicleId);
                return v ? ` · ${v.vehicleType}` : "";
              })()}
              {" · view filter only — membership and totals unchanged"}
            </span>
          )}
        </div>
      )}

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
          <span key={c} className="inline-flex items-center gap-1">
            <button
              onClick={() => setCustFilter(c === custFilter ? "ALL" : c)}
              className="px-2.5 py-0.5 text-[11px] rounded-full border font-medium transition-colors"
              style={custFilter === c
                ? { background: custBg(c), color: custColor(c), borderColor: custColor(c) }
                : { borderColor: "#d6d8dc", color: "#555" }}
            >
              {c}
            </button>
            <button
              onClick={() => setPrintCust(c)}
              title={`Print ${c} customer sheet`}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
            >
              <Printer className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="w-px h-4 bg-[#e3e5e8] mx-1" />

        <span className="text-[11px] text-[#888]">ตาราง:</span>
        {(["eggs", "pack", "sell"] as const).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-2 py-0.5 text-[11px] rounded border font-medium transition-colors ${
              viewMode === m ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:border-[#999]"
            }`}
          >
            {m === "eggs" ? "ฟอง" : m === "pack" ? "Pack" : "หน่วยขาย"}
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

        <span className="ml-auto text-[12px] text-[#666]">
          PQ draft{" "}
          <span className="font-bold text-[#1a1a1a] tabular-nums">
            {fmtNum(filteredOrders.reduce((s, o) => s + (orderTotals[o.id]?.planEggs ?? 0), 0))} eggs
          </span>
        </span>
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
                {/* Preliminary plan group header row */}
                {(
                  <tr className="bg-[#fafbfc]">
                    <th
                      colSpan={5}
                      className="sticky left-0 z-20 bg-[#fafbfc] border-b border-r border-[#e5e7eb]"
                      style={{ minWidth: COL_SKU_W + COL_ITEM_W + COL_PACK_W + COL_SIZE_W + COL_TOT_W }}
                    />
                    {planGroups.map((group, i) => {
                      const vehicle = group.plan
                        ? focusVehicles.find(v => String(v.id) === group.plan!.vehicleId)
                        : null;
                      return (
                        <th
                          key={group.plan?.id ?? `none-${i}`}
                          colSpan={group.orders.length}
                          className={`text-[13px] leading-tight px-3 py-2.5 text-center border-b border-l border-[#e5e7eb] ${
                            group.plan ? "font-bold text-[#1E40AF] bg-[#EFF6FF]" : "font-medium text-[#888] bg-[#fafbfc]"
                          }`}
                        >
                          {group.plan ? (
                            <>
                              Plan {group.plan.label}
                              {group.plan.loadInDate && ` · Load-in ${group.plan.loadInDate} ${group.plan.loadInTime}`}
                              {vehicle && ` · ${vehicle.vehicleType}`}
                            </>
                          ) : "Not in a shipment plan yet"}
                        </th>
                      );
                    })}
                  </tr>
                )}
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
                        className={`border-b border-l border-[#e5e7eb] px-3 py-2 align-top font-normal ${isInTrip ? "bg-[#F8FAFF]" : "bg-white"}`}
                        style={{ minWidth: 150 }}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col items-center gap-1 text-center">
                            <div className="flex items-center gap-1">
                              <CustPill name={o.partnerName} />
                              {o.orderDate && o.orderDate.slice(0, 10) === o.deliveryDate.slice(0, 10) && (
                                <span
                                  title="Same-day order"
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#FAEEDA] text-[#854F0B] text-[10px] leading-none"
                                >
                                  ⚡
                                </span>
                              )}
                            </div>
                            <div className="text-[13px] font-medium text-[#1a1a1a] leading-tight" title={o.deliverySiteName}>
                              {o.deliverySiteName}
                            </div>
                            <code className="text-[10px] font-mono text-[#555] bg-[#f3f4f6] px-1.5 py-0.5 rounded max-w-full truncate">
                              {o.poNumber || "—"}
                            </code>
                            {(() => {
                              const plan = focusPlans.find(p => p.orderIds.includes(o.id));
                              return plan ? (
                                <span className="text-[10px] font-bold text-[#1E40AF] bg-[#EFF6FF] border border-[#BFDBFE] px-1.5 py-0.5 rounded">
                                  Plan {plan.label}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="border-t border-[#f0f0f0] pt-1.5 mt-1 text-[11px] font-normal normal-case">
                            <div className="flex items-center justify-between gap-3 text-[#888]">
                              <span>OQ</span>
                              <span className="tabular-nums font-bold text-[#333]">{fmtNum(tot.confEggs)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[#888]">
                              <span>PQ draft</span>
                              <span className="tabular-nums font-bold text-[#333]">{fmtNum(tot.planEggs)}</span>
                            </div>
                            {tot.planEggs !== tot.confEggs && (
                              <div className={`text-right text-[10px] font-bold tabular-nums ${tot.planEggs > tot.confEggs ? "text-green-600" : "text-red-600"}`}>
                                Δ {tot.planEggs > tot.confEggs ? `+${fmtNum(tot.planEggs - tot.confEggs)}` : fmtNum(tot.planEggs - tot.confEggs)}
                              </div>
                            )}
                          </div>
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
                        {rowTotal > 0 ? fmtQty(rowTotal) : "—"}
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
                                {val > 0 ? fmtQty(val) : "—"}
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
                                      : viewMode === "sell"
                                        ? Math.round(inputNum * sellFactor(line))
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
                                {val > 0 ? fmtQty(val) : "—"}
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
              <tfoot>
                <tr className="bg-[#fafbfc]">
                  <td
                    colSpan={5}
                    className="sticky left-0 z-10 bg-[#fafbfc] px-3 py-2 border-t-2 border-r border-[#d6dbe3] text-right text-[12px] font-bold text-[#1a1a1a]"
                    style={{ minWidth: COL_SKU_W + COL_ITEM_W + COL_PACK_W + COL_SIZE_W + COL_TOT_W }}
                  >
                    PQ total
                  </td>
                  {tripGroups.flatMap(group => group.orders).map(o => (
                    <td
                      key={o.id}
                      className="px-3 py-2 border-t-2 border-l border-[#d6dbe3] text-right text-[12px] font-bold tabular-nums text-[#1a1a1a]"
                    >
                      {fmtNum(orderTotals[o.id]?.planEggs ?? 0)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {printCust && (() => {
        const custOrders = allOrders.filter(o => o.partnerName === printCust);
        const partnerId = partners.find(p => p.partnerName === printCust)?.partnerId;
        if (partnerId == null) return null;
        const ids = new Set(custOrders.map(o => o.id));
        const loadIn = focusPlans.find(pl => pl.loadInDate && pl.orderIds.some(id => ids.has(id)))?.loadInDate;
        return (
          <CustomerSheetModal
            customerName={printCust}
            partnerId={partnerId}
            roundLabel={roundLabel}
            loadInDate={loadIn ? loadIn.split("-").reverse().join("/") : "—"}
            orders={custOrders}
            pending={pending}
            onClose={() => setPrintCust(null)}
          />
        );
      })()}
    </div>
  );
}

// ── Close readiness (gate on "ส่ง O-R{n}") ───────────────────────────────────────
// Two kinds of issue, then a confirm recap, before the round actually closes:
//  - BLOCKING: a confirmed order isn't covered by any preliminary plan at
//    all. Can't be waved through — has to be fixed (added to a plan, or
//    deferred) before Continue enables.
//  - REVIEW: a plan's orders span more than one delivery region — not
//    necessarily wrong, just needs a human to look and record why. Accepting
//    one requires a reason (required field, matches the design reference's
//    other "must record a reason" flows like Defer).
// Both are reactive — recomputed from live props each render, so fixing an
// issue (editing a plan, deferring an order) clears it immediately without
// closing and reopening this modal. "Open order"/"Go to section 1"/"Open
// Plan {label}" all dismiss the modal and scroll+highlight the relevant spot
// in section 1, since there's no separate order/plan detail route to deep-
// link to — the "..." menus built for the plan cards are what you use once
// you're there.
//
// The confirm step's PQ version is now real — see migrations/0036_pq_snapshots.sql
// and POST /api/orders/pq-snapshots. "Confirm close & publish" actually
// freezes this exact version's order/line data server-side; `nextVersion` is
// computed from the round's real version history (latest active + 1), so a
// round being sent for the first time shows v1, a re-sent round after a
// reopen shows v2, v3, etc. — not hardcoded.

function CloseReadinessModal({
  round,
  date,
  nextVersion,
  blocking,
  review,
  cumulativeTotal,
  onClose,
  onContinue,
}: {
  round: Round;
  date: string;
  nextVersion: number;
  blocking: (PlanOrder & { partnerName: string })[];
  review: { plan: PrelimPlanRow; zones: string[] }[];
  cumulativeTotal: number;
  onClose: () => void;
  onContinue: () => void;
}) {
  const [step, setStep] = useState<"review" | "confirm">("review");
  const [decisions, setDecisions] = useState<Record<number, { accepted: boolean; reason: string }>>({});

  const decisionFor = (planId: number) => decisions[planId] ?? { accepted: true, reason: "" };
  const setDecision = (planId: number, patch: Partial<{ accepted: boolean; reason: string }>) =>
    setDecisions(prev => ({ ...prev, [planId]: { ...decisionFor(planId), ...patch } }));

  const unresolvedReview = review.filter(r => {
    const d = decisionFor(r.plan.id);
    return !(d.accepted && d.reason.trim());
  });
  const totalOpen = blocking.length + unresolvedReview.length;

  const goTo = (opts: { orderId?: number; planId?: number }) => {
    onClose();
    setTimeout(() => {
      const target = opts.orderId != null
        ? document.querySelector(`[data-order-row="${opts.orderId}"]`)
        : opts.planId != null
          ? document.querySelector(`[data-plan-card="${opts.planId}"]`)
          : document.getElementById("daily-plan-section-1");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (opts.orderId != null || opts.planId != null) {
        target.classList.add("ring-2", "ring-[#991B1B]");
        setTimeout(() => target.classList.remove("ring-2", "ring-[#991B1B]"), 2000);
      }
    }, 50);
  };

  const pqVersion = `PQ-${date.replace(/-/g, "")}-v${nextVersion}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">Close readiness — O-R{round}</h2>
            <div className="text-[12px] text-[#888] mt-0.5">
              closes this O-R and publishes exactly one PQ version · every issue must be resolved or recorded
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        {step === "review" ? (
          <>
            <div className="px-6 py-5 space-y-6">
              {blocking.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#991B1B] mb-3">
                    Blocking — cannot be accepted by a single confirmation
                  </div>
                  <div className="space-y-3">
                    {blocking.map(o => (
                      <div key={o.id} className="bg-[#FEF2F2] border-l-4 border-l-[#991B1B] border border-[#FCA5A5] rounded-lg px-4 py-3">
                        <div className="font-bold text-[#1a1a1a] text-[14px]">
                          Not in any preliminary plan — {o.partnerName} · {o.deliverySiteName}
                        </div>
                        <div className="text-[12.5px] text-[#555] mt-0.5">OQ {fmtNum(orderEggs(o))} eggs</div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => goTo({ orderId: o.id })}
                            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] bg-white text-[#1a1a1a] hover:bg-[#f5f5f5]"
                          >
                            Open order
                          </button>
                          <button
                            onClick={() => goTo({})}
                            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] bg-white text-[#1a1a1a] hover:bg-[#f5f5f5]"
                          >
                            Go to section 1
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {review.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#854F0B] mb-3">
                    Review — record the decision and reason
                  </div>
                  <div className="space-y-3">
                    {review.map(({ plan, zones }) => {
                      const d = decisionFor(plan.id);
                      return (
                        <div key={plan.id} className="bg-[#FFFBEB] border-l-4 border-l-[#92400E] border border-[#FCD34D] rounded-lg px-4 py-3">
                          <div className="font-bold text-[#1a1a1a] text-[14px]">
                            Plan {plan.label} — Multiple delivery zones
                          </div>
                          <div className="text-[12.5px] text-[#555] mt-0.5">{zones.join(" · ")}</div>
                          <button
                            onClick={() => goTo({ planId: plan.id })}
                            className="mt-2.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] bg-white text-[#1a1a1a] hover:bg-[#f5f5f5]"
                          >
                            Open Plan {plan.label}
                          </button>
                          <label className="flex items-center gap-2 mt-3 text-[13px] text-[#1a1a1a] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={d.accepted}
                              onChange={e => setDecision(plan.id, { accepted: e.target.checked })}
                              className="w-4 h-4 rounded accent-[#2563EB]"
                            />
                            Record the decision: accept this review item
                          </label>
                          <input
                            type="text"
                            value={d.reason}
                            onChange={e => setDecision(plan.id, { reason: e.target.value })}
                            disabled={!d.accepted}
                            placeholder="Reason (required)"
                            className="mt-2 w-full h-9 px-3 text-[12.5px] border border-[#d6d8dc] rounded-lg bg-white disabled:bg-[#f5f5f5] disabled:cursor-not-allowed"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e5e7eb] bg-[#fafbfc] rounded-b-2xl">
              <span className="text-[12.5px] font-semibold text-[#854F0B]">
                {totalOpen === 0 ? "all issues resolved or recorded" : `still ${totalOpen} issue${totalOpen === 1 ? "" : "s"} to resolve, defer or reject`}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]">
                  Close
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={totalOpen > 0}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4fd1] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-5">
              <div className="bg-[#F3F6FB] border border-[#DCE4F2] rounded-xl px-5 py-4 space-y-2.5 text-[14px] text-[#1a1a1a]">
                <div><span className="font-bold">Close round</span> O-R{round}</div>
                <div>Publish PQ version <span className="font-bold text-[#1E40AF]">{pqVersion}</span></div>
                <div>
                  Cumulative total <span className="font-bold">{fmtNum(cumulativeTotal)}</span> eggs
                  <span className="text-[#888]"> · {nextVersion === 1 ? "first version today" : `supersedes v${nextVersion - 1}`}</span>
                </div>
                <div>Recorded exceptions <span className="font-bold">{review.length}</span></div>
              </div>
              <div className="text-[12px] text-[#888] mt-4 leading-relaxed">
                one close = one PQ version · previous versions are never overwritten · the order day stays open · the round evidence freezes atomically
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e5e7eb] bg-[#fafbfc] rounded-b-2xl">
              <button onClick={() => setStep("review")} className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]">
                ← Back to review
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]">
                  Cancel
                </button>
                <button
                  onClick={onContinue}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
                >
                  Confirm close &amp; publish
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Trip Manager ──────────────────────────────────────────────────────────────
// Trip status is never stored — always derived live from trips.confirmedAt/
// vehicleConfirmedAt/departedAt plus real packing completeness
// (packing_target_results), same derive-don't-duplicate pattern as every
// other status in this app. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.

type TripStatusKind = "needs_confirm" | "needs_packing" | "ready" | "done";
type PackingTargetResultLite = { itemId: number; status: string | null; actualQtyEggs: number | null; targetQtyEggs: number };

// Only FG lines go through Packing's target/result flow — WIP (graded
// directly) and DEFECT (sold straight from grading) never get a packing
// target at all, so they can't block a trip's "ready" status. Same isFgLine
// guard this file already uses for Packing/BOM/PQ aggregation.
function tripPackingComplete(
  stops: (PlanOrder & { partnerName: string })[],
  resultsByRound: Record<number, PackingTargetResultLite[]>,
): boolean {
  for (const o of stops) {
    if (o.productionRound == null) continue; // not assigned to a round — nothing to check yet
    const results = resultsByRound[o.productionRound] ?? [];
    for (const l of o.lines) {
      if (!isFgLine(l)) continue;
      const match = results.find(r => r.itemId === l.itemId);
      if (!match || match.status !== "confirmed") return false;
    }
  }
  return true;
}

function tripStatus(
  trip: PlanTrip,
  stops: (PlanOrder & { partnerName: string })[],
  resultsByRound: Record<number, PackingTargetResultLite[]>,
): { kind: TripStatusKind; label: string; at: string | null } {
  if (trip.departedAt) return { kind: "done", label: "เสร็จ", at: trip.departedAt };
  if (!trip.confirmedAt) return { kind: "needs_confirm", label: "รอยืนยัน", at: null };
  if (!tripPackingComplete(stops, resultsByRound)) return { kind: "needs_packing", label: "รอแพ็ก", at: null };
  return { kind: "ready", label: "พร้อม", at: null };
}

const TRIP_STATUS_STYLE: Record<TripStatusKind, string> = {
  needs_confirm: "bg-[#F5F5F5] text-[#555] border-[#e3e5e8]",
  needs_packing: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  ready: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  done: "bg-[#F0FDF4] text-green-700 border-[#86EFAC]",
};

type SkuDetailRow = { sku: string; name: string; sizeLabel: string; packUnit: string; qty: number; eggs: number };

// One row per distinct item across a set of stops (so the row count always
// matches a trip's own "N SKU" figure) — shared by the card grid's
// expand-to-detail and the dense เที่ยว table below.
function buildSkuRows(stops: (PlanOrder & { partnerName: string })[]): SkuDetailRow[] {
  const byItem = new Map<number, SkuDetailRow>();
  for (const o of stops) {
    for (const l of o.lines) {
      const qty = l.planningQty ?? l.orderQty;
      const eggs = qty * (l.eggsPerSellingUnit ?? l.eggsPerPack);
      if (!byItem.has(l.itemId)) {
        const sizeLabel = l.secondarySize ? `เบอร์ ${l.primarySize}-${l.secondarySize}` : l.primarySize ? `เบอร์ ${l.primarySize}` : "-";
        byItem.set(l.itemId, { sku: l.sku, name: l.itemName, sizeLabel, packUnit: l.packUnit, qty: 0, eggs: 0 });
      }
      const row = byItem.get(l.itemId)!;
      row.qty += qty;
      row.eggs += eggs;
    }
  }
  return Array.from(byItem.values()).sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
}

function SkuDetailTable({ rows }: { rows: SkuDetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="px-3 py-2 border-t border-[#f0f0f0] overflow-x-auto">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-[10px] text-[#888] uppercase border-b border-[#f0f0f0]">
            <th className="text-left py-1 pr-2">SKU</th>
            <th className="text-left py-1 pr-2">เบอร์</th>
            <th className="text-left py-1 pr-2">บรรจุ</th>
            <th className="text-right py-1">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sku} className="border-b border-[#f5f5f5] last:border-b-0">
              <td className="py-1 pr-2">
                <span className="font-mono text-[10px] text-[#0C447C]">{r.sku}</span>
                <span className="text-[#555] ml-1">{r.name}</span>
              </td>
              <td className="py-1 pr-2 text-[#555]">{r.sizeLabel}</td>
              <td className="py-1 pr-2 text-[#555]">{r.packUnit}</td>
              <td className="py-1 text-right tabular-nums font-semibold text-[#1a1a1a]">
                {fmtNum(r.qty)} <span className="font-normal text-[#aaa]">({fmtNum(r.eggs)} ฟอง)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


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
  const [pickingTrip, setPickingTrip] = useState<PlanTrip | null>(null);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<TripStatusKind | "all">("all");
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [offPlanOpen, setOffPlanOpen] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Record<number, boolean>>({});
  const [expandedSites, setExpandedSites] = useState<Record<number, boolean>>({});
  const [showAllTrips, setShowAllTrips] = useState(false);

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

  // Real packing completeness, per round actually used by today's orders —
  // feeds tripStatus's "รอแพ็ก" vs "พร้อม" distinction. Same endpoint
  // Packing's own Section 3 reads (server/routes/packing.ts /target-results).
  const relevantRounds = useMemo(
    () => Array.from(new Set(allOrders.map(o => o.productionRound).filter((r): r is number => r != null))),
    [allOrders],
  );
  const [packingResultsByRound, setPackingResultsByRound] = useState<Record<number, PackingTargetResultLite[]>>({});
  useEffect(() => {
    relevantRounds.forEach(round => {
      fetch(`/api/packing/target-results?date=${date}&round=${round}`)
        .then(r => (r.ok ? r.json() : []))
        .then((rows: PackingTargetResultLite[]) => setPackingResultsByRound(prev => ({ ...prev, [round]: rows })))
        .catch(() => {});
    });
  }, [date, relevantRounds]);

  const tripsWithStatus = useMemo(
    () =>
      trips.map(trip => {
        const stops = ordersByTrip[trip.id] ?? [];
        return { trip, stops, status: tripStatus(trip, stops, packingResultsByRound) };
      }),
    [trips, ordersByTrip, packingResultsByRound],
  );
  const statusCounts = useMemo(() => {
    const c: Record<TripStatusKind, number> = { needs_confirm: 0, needs_packing: 0, ready: 0, done: 0 };
    for (const t of tripsWithStatus) c[t.status.kind]++;
    return c;
  }, [tripsWithStatus]);
  // Per-customer trip counts — a trip counts toward every customer it
  // carries at least one order for, since a trip can mix customers.
  const customerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { stops } of tripsWithStatus) {
      for (const name of Array.from(new Set(stops.map(o => o.partnerName)))) m.set(name, (m.get(name) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [tripsWithStatus]);
  const visibleTrips = tripsWithStatus.filter(
    t =>
      (statusFilter === "all" || t.status.kind === statusFilter) &&
      (customerFilter === null || t.stops.some(o => o.partnerName === customerFilter)),
  );

  const confirmTrip = async (tripId: number) => {
    setActioning(p => ({ ...p, [`confirm-${tripId}`]: true }));
    try {
      await fetch(`/api/orders/trips/${tripId}/confirm`, { method: "PATCH" });
      onRefresh();
    } finally {
      setActioning(p => ({ ...p, [`confirm-${tripId}`]: false }));
    }
  };

  const confirmVehicleForTrip = async (tripId: number) => {
    setActioning(p => ({ ...p, [`vehicle-${tripId}`]: true }));
    try {
      const r = await fetch(`/api/orders/trips/${tripId}/confirm-vehicle`, { method: "PATCH" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.message || "นัดรถไม่สำเร็จ");
        return;
      }
      onRefresh();
    } finally {
      setActioning(p => ({ ...p, [`vehicle-${tripId}`]: false }));
    }
  };

  const checkoutTrip = async (tripId: number) => {
    if (!confirm("เช็คเอาท์ Trip นี้? ออเดอร์ทั้งหมดในเที่ยวนี้จะถูกบันทึกว่าจัดส่งแล้ว")) return;
    setActioning(p => ({ ...p, [`checkout-${tripId}`]: true }));
    try {
      const r = await fetch(`/api/orders/trips/${tripId}/checkout`, { method: "PATCH" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.message || "เช็คเอาท์ไม่สำเร็จ");
        return;
      }
      onRefresh();
    } finally {
      setActioning(p => ({ ...p, [`checkout-${tripId}`]: false }));
    }
  };

  const [bulkRunning, setBulkRunning] = useState<"confirm" | "vehicle" | null>(null);
  const bulkConfirmAll = async (tripIds: number[]) => {
    setBulkRunning("confirm");
    try {
      await Promise.all(tripIds.map(id => fetch(`/api/orders/trips/${id}/confirm`, { method: "PATCH" })));
      onRefresh();
    } finally {
      setBulkRunning(null);
    }
  };
  const bulkConfirmVehicleAll = async (tripIds: number[]) => {
    setBulkRunning("vehicle");
    try {
      await Promise.all(tripIds.map(id => fetch(`/api/orders/trips/${id}/confirm-vehicle`, { method: "PATCH" })));
      onRefresh();
    } finally {
      setBulkRunning(null);
    }
  };

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

  // Visual-only stepper — highlights the furthest real step any trip today
  // has reached. "จัดก่อน" (FG-stock allocation priority queue) is inert by
  // design: no real FG stock balance exists anywhere in this app to compute
  // it honestly (same reason BOM's material-plan has no supply-sufficiency
  // check). It's shown for layout continuity with the reference only.
  const furthestStep =
    statusCounts.done > 0 || statusCounts.ready > 0
      ? 3 // ยืนยันเที่ยว done for at least one trip, counting "จัดก่อน" as passed-through
      : trips.some(t => t.confirmedAt)
        ? 1
        : 0;
  const STEPS = ["จัดออเดอร์เข้าเที่ยว", "ยืนยันเที่ยว", "จัดก่อน", "นัดรถ", "เช็คเอาท์"];

  return (
    <div className="space-y-4">
      {/* Stepper — see furthestStep comment above */}
      <div className="flex items-center gap-1.5 flex-wrap text-[12px]">
        {STEPS.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5">
            <span
              title={label === "จัดก่อน" ? "ยังไม่รองรับ — ต้องมีข้อมูลสต็อก FG จริงก่อนถึงจะคำนวณคิวจัดสรรได้อย่างถูกต้อง" : undefined}
              className={`px-2.5 py-1 rounded-full font-semibold ${
                label === "จัดก่อน"
                  ? "bg-[#f5f5f5] text-[#bbb] cursor-help"
                  : i <= furthestStep
                    ? "bg-[#1E40AF] text-white"
                    : "bg-[#f0f0f0] text-[#999]"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="text-[#ccc]">→</span>}
          </span>
        ))}
      </div>

      {/* Filter bar — ขั้นตอน (trip status) and ลูกค้า (customer), both real;
          dropped a 3rd "ประเภทการส่ง" (delivery type) row from the reference
          since no real field distinguishes "self-pickup"/"off-plan" today —
          delivery_sites.delivery_type only has direct_to_store/
          to_distribution_center, neither maps to that. */}
      <div className="bg-white rounded-xl border border-[#e3e5e8] px-3 py-2 flex items-start gap-4 flex-wrap">
        <div className="flex items-start gap-2.5">
          <div className="text-[10px] leading-tight shrink-0 pt-1 whitespace-nowrap">
            <div className="font-bold text-[#555]">ขั้นตอน</div>
            <div className="text-[#aaa]">สาขา</div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                ["needs_confirm", "รอยืนยัน", statusCounts.needs_confirm],
                ["needs_packing", "รอแพ็ก", statusCounts.needs_packing],
                ["ready", "พร้อม", statusCounts.ready],
                ["done", "เสร็จ", statusCounts.done],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(f => (f === key ? "all" : key))}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
                  statusFilter === key
                    ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                    : "bg-white text-[#555] border-[#d6d8dc] hover:bg-[#f5f5f5]"
                }`}
              >
                {label} {count}
              </button>
            ))}
          </div>
        </div>
        {customerCounts.length > 0 && (
          <div className="flex items-start gap-2.5">
            <div className="text-[10px] leading-tight shrink-0 pt-1 whitespace-nowrap">
              <div className="font-bold text-[#555]">ลูกค้า</div>
              <div className="text-[#aaa]">กรอง</div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {customerCounts.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setCustomerFilter(f => (f === name ? null : name))}
                  style={
                    customerFilter === name
                      ? { background: custColor(name), borderColor: custColor(name), color: "#fff" }
                      : { background: custBg(name), borderColor: "#e5e7eb", color: custColor(name) }
                  }
                  className="px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors"
                >
                  {name} {count}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => {
            setStatusFilter("all");
            setCustomerFilter(null);
          }}
          className={`ml-auto px-3 py-1 text-[12px] font-bold rounded-full shrink-0 ${
            statusFilter === "all" && customerFilter === null
              ? "bg-[#1a1a1a] text-white"
              : "bg-white text-[#555] border border-[#d6d8dc] hover:bg-[#f5f5f5]"
          }`}
        >
          ทั้งหมด {trips.length}
        </button>
        <button
          onClick={() => setOffPlanOpen(o => !o)}
          className="px-3 py-1.5 text-[12px] font-semibold rounded-full border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
        >
          + ออเดอร์นอกแผน
        </button>
      </div>

      {offPlanOpen && (
        <OffPlanOrderPanel date={date} onClose={() => setOffPlanOpen(false)} onCreated={onRefresh} />
      )}

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

      {/* Trip cards — 2-col grid, same compact shell as the unassigned-site
          cards above, so the whole page reads as one continuous density. */}
      {trips.length === 0 && !creating && (
        <div className="py-10 text-center text-[#bbb] text-[13px] bg-white rounded-xl border border-dashed border-[#e3e5e8]">
          ยังไม่มี Trip — กด "+ สร้าง Trip ใหม่" เพื่อเริ่มจัดกลุ่มออเดอร์
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(showAllTrips ? visibleTrips : visibleTrips.slice(0, 12)).map(({ trip, stops, status }) => {
        const tripEggs = stops.reduce((s, o) =>
          s + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0);
        const isEditing = editingId === trip.id;
        const isLocked = trip.confirmedAt != null; // ยืนยันเที่ยว lock — UI-only, see plan
        const skuCount = new Set(stops.flatMap(o => o.lines.map(l => l.sku))).size;
        const { pickupLabel, deliveryLabel } = timeWindowFor(stops);
        const uniquePartners = Array.from(new Set(stops.map(o => o.partnerName)));
        const headingText = stops.length === 1 ? stops[0].deliverySiteName : (trip.name ?? `Trip ${trip.tripNumber}`);
        // Collapsed by default so a card is exactly 2 rows, matching the
        // reference — the controls row (Trip N + action buttons) and the
        // multi-stop list only appear once the SKU/PO chevron is clicked.
        const isExpanded = expandedTrips[trip.id] ?? false;
        const accentColor = status.kind === "done" || status.kind === "ready" ? "#16A34A" : status.kind === "needs_packing" ? "#F59E0B" : "#D6D8DC";

        return (
          <div
            key={trip.id}
            className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden border-l-4"
            style={{ borderLeftColor: accentColor }}
          >
            {/* Summary row — status icon, heading + customer(s), total eggs + ครบ */}
            <div className="flex items-start gap-2.5 px-3 pt-2.5 flex-wrap">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                  status.kind === "done" || status.kind === "ready"
                    ? "bg-green-600 text-white"
                    : status.kind === "needs_packing"
                      ? "bg-[#F59E0B] text-white"
                      : "bg-[#e5e7eb] text-[#888]"
                }`}
              >
                {status.kind === "done" || status.kind === "ready" ? "✓" : "○"}
              </span>
              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                {!isEditing && (
                  <>
                    <span className="text-[15px] font-bold text-[#1a1a1a] truncate">{headingText}</span>
                    {uniquePartners.slice(0, 1).map(p => <CustPill key={p} name={p} />)}
                    {uniquePartners.length > 1 && (
                      <span className="text-[10.5px] text-[#888]">+{uniquePartners.length - 1} ลูกค้า</span>
                    )}
                  </>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[19px] font-bold tabular-nums text-[#1a1a1a] leading-none">
                  {fmtNum(tripEggs)} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>
                </div>
                {(status.kind === "ready" || status.kind === "done") && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">
                    ครบ
                  </span>
                )}
              </div>
            </div>

            {/* Second row — times, vehicle chips, SKU/PO + expand toggle */}
            <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-2 flex-wrap text-[11px]">
              {(pickupLabel || deliveryLabel) && (
                <>
                  <span className="text-[#888]">ขึ้นของ <b className="text-[#1a1a1a]">{pickupLabel ?? "ไม่ระบุ"}</b></span>
                  <span className="text-[#888]">ส่ง <b className="text-[#1a1a1a]">{deliveryLabel ?? "ไม่ระบุ"}</b></span>
                </>
              )}
              {!isEditing && trip.vehicleType && (
                <span className="px-2 py-0.5 font-semibold rounded-md bg-[#EFF6FF] text-[#1E40AF]">{trip.vehicleType}</span>
              )}
              {!isEditing && trip.vehiclePlate && (
                <span className="px-2 py-0.5 font-mono font-semibold rounded-md bg-[#EFF6FF] text-[#1E40AF]">{trip.vehiclePlate}</span>
              )}
              {!isEditing && trip.driverName && (
                <span className="px-2 py-0.5 font-semibold rounded-md bg-[#EFF6FF] text-[#1E40AF]">{trip.driverName}</span>
              )}
              {trip.vehicleCapacityEggs != null && (
                <span className={`font-semibold ${
                  tripEggs / trip.vehicleCapacityEggs > 0.9
                    ? "text-red-500"
                    : tripEggs / trip.vehicleCapacityEggs > 0.75
                      ? "text-amber-500"
                      : "text-green-600"
                }`}>
                  {Math.round((tripEggs / trip.vehicleCapacityEggs) * 100)}% ของรถ
                </span>
              )}
              <button
                onClick={() => setExpandedTrips(p => ({ ...p, [trip.id]: !isExpanded }))}
                className="ml-auto font-semibold text-[#555] flex items-center gap-1 hover:text-[#1a1a1a]"
              >
                {skuCount} SKU · {stops.length} PO
                <span className={`inline-block transition-transform ${isExpanded ? "" : "-rotate-90"}`}>▾</span>
              </button>
            </div>

            {/* Trip header controls — name/vehicle edit form + action buttons.
                Hidden until the SKU/PO chevron is clicked (isExpanded), so a
                card is exactly 2 rows by default like the reference. No
                status pill or trip name here either — both already shown in
                the summary row above (checkmark/ครบ + heading); repeating
                them here was pure visual duplication. */}
            {isExpanded && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-t border-[#f0f0f0] flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[#aaa] shrink-0">
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
                ) : null /* trip name already shown as the card's heading above — repeating it here was redundant */}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isEditing && (
                  <>
                    {trip.vehicleConfirmedAt && status.kind !== "done" && (
                      <span className="text-[10.5px] font-semibold text-[#5B4B8A]">นัดรถแล้ว</span>
                    )}
                    {status.kind === "needs_confirm" && stops.length > 0 && (
                      <button
                        onClick={() => confirmTrip(trip.id)}
                        disabled={actioning[`confirm-${trip.id}`]}
                        className="px-2 py-1 text-[11px] font-semibold rounded bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50 flex items-center gap-1"
                      >
                        {actioning[`confirm-${trip.id}`] && <Loader2 className="w-3 h-3 animate-spin" />}
                        ยืนยันเที่ยว
                      </button>
                    )}
                    {!isLocked ? (
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
                    ) : (
                      <span className="text-[10.5px] text-[#aaa]" title="ยืนยันเที่ยวแล้ว — แก้ไข/ลบ ถูกล็อกไว้">
                        🔒
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            )}

            {/* SKU breakdown — shown when the "N SKU · M PO ▾" chevron is
                expanded. See buildSkuRows/SkuDetailTable above, shared with
                the dense เที่ยว table below. */}
            {isExpanded && <SkuDetailTable rows={buildSkuRows(stops)} />}

            {/* Stops list — collapsible via the SKU/PO chevron above. Skipped
                entirely for a single-stop trip (now the common case, one
                trip per branch): that one order is already fully
                represented by the card's own heading/eggs/SKU-PO count, so
                repeating it as a nested "stop row" was pure duplication. */}
            {isExpanded && stops.length !== 1 && (stops.length === 0 ? (
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
            ))}
          </div>
        );
      })}
      </div>
      {visibleTrips.length > 12 && (
        <div className="text-center">
          <button
            onClick={() => setShowAllTrips(s => !s)}
            className="text-[12.5px] font-semibold text-[#1E40AF] hover:underline"
          >
            {showAllTrips ? "ย่อรายการ" : `แสดงทั้งหมด ${visibleTrips.length} สาขา`} ▾
          </button>
        </div>
      )}

      {/* เที่ยว table — a denser, alternate view of the same visibleTrips
          data above (added below the card grid per the user's request, not
          replacing it). Several reference pieces have no real data behind
          them and are deliberately left out rather than fabricated:
          ยกมา/จัด as 2 more status states (unclear what distinguishes them
          from the 4 this app already derives honestly), a per-SKU packing
          fraction ("15/16 SKU" — would need every trip's orders on a real
          production round with packing data, which most test trips here
          don't have), and the "รายงาน"/"รถและคนขับ" report buttons (separate
          reports, not built) and "เลือกเอง" (bulk multi-select) are shown
          for layout but inert. "รับเอง" per-row is derived honestly from
          "no vehicle assigned" — the one real signal available for that. */}
      {visibleTrips.length > 0 && (() => {
        const totalEggsAll = visibleTrips.reduce(
          (s, t) => s + t.stops.reduce((ss, o) => ss + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0),
          0,
        );
        const needsConfirmIds = visibleTrips.filter(t => t.status.kind === "needs_confirm" && t.stops.length > 0).map(t => t.trip.id);
        const needsVehicleIds = visibleTrips
          .filter(t => t.trip.confirmedAt && !t.trip.vehicleConfirmedAt && t.trip.vehicleId && t.trip.driverId && t.status.kind !== "done")
          .map(t => t.trip.id);
        const draftCount = visibleTrips.filter(t => t.status.kind === "needs_packing").length;
        const sortedTrips = [...visibleTrips].sort((a, b) => {
          const ta = a.stops[0]?.deliveryTime ?? "99:99";
          const tb = b.stops[0]?.deliveryTime ?? "99:99";
          return ta.localeCompare(tb);
        });

        return (
          <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f0f0f0] flex-wrap">
              <span className="text-[16px] font-bold text-[#1a1a1a]">
                เที่ยว {visibleTrips.length} เที่ยว · {fmtNum(totalEggsAll)} ฟอง
              </span>
              <div className="ml-auto flex items-center gap-4 text-[11.5px]">
                <span className="text-[#888]">รายงาน</span>
                <button
                  disabled
                  title="ยังไม่รองรับ — รายงานแยกต่างหาก ไม่ได้อยู่ในขอบเขตนี้"
                  className="px-3 py-1.5 font-semibold rounded-lg border border-[#d6d8dc] text-[#bbb] cursor-not-allowed"
                >
                  พิมพ์แผนจัดส่ง ▾
                </button>
                <span className="text-[#888]">รถ</span>
                <button
                  disabled
                  title="ยังไม่รองรับ — รายงานแยกต่างหาก ไม่ได้อยู่ในขอบเขตนี้"
                  className="px-3 py-1.5 font-semibold rounded-lg border border-[#d6d8dc] text-[#bbb] cursor-not-allowed"
                >
                  รถและคนขับ · {new Set(visibleTrips.filter(t => t.trip.vehicleId).map(t => t.trip.vehicleId)).size}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f0f0] flex-wrap bg-[#FAFBFC]">
              <span className="flex items-center gap-1.5 text-[12px] text-[#555]">
                <span className={`w-1.5 h-1.5 rounded-full ${draftCount === 0 ? "bg-green-600" : "bg-[#F59E0B]"}`} />
                {draftCount === 0 ? "ครบทุกขั้นแล้ว" : `อยู่ระหว่างดำเนินการ`}
                {draftCount > 0 && ` · ใบร่าง ${draftCount} เที่ยว (แพ็กยังไม่ครบ)`}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {needsConfirmIds.length > 0 && (
                  <button
                    onClick={() => bulkConfirmAll(needsConfirmIds)}
                    disabled={bulkRunning === "confirm"}
                    className="px-3 py-1.5 text-[12px] font-bold rounded-full bg-[#DB2777] text-white hover:bg-[#BE185D] disabled:opacity-50 flex items-center gap-1"
                  >
                    {bulkRunning === "confirm" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {needsConfirmIds.length} ยืนยันเที่ยว
                  </button>
                )}
                <button
                  onClick={() => setBulkPrintOpen(true)}
                  className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-[#1a1a1a] text-white hover:bg-black"
                >
                  พิมพ์ใบจัดของ {visibleTrips.length} ▾
                </button>
                {needsVehicleIds.length > 0 && (
                  <>
                    <span className="text-[11px] text-[#888]">รถ</span>
                    <button
                      onClick={() => bulkConfirmVehicleAll(needsVehicleIds)}
                      disabled={bulkRunning === "vehicle"}
                      className="px-3 py-1.5 text-[12px] font-bold rounded-full bg-[#D9C9A8] text-[#5B4B2A] hover:bg-[#CDB88F] disabled:opacity-50 flex items-center gap-1"
                    >
                      {bulkRunning === "vehicle" && <Loader2 className="w-3 h-3 animate-spin" />}
                      {needsVehicleIds.length} นัดรถ
                    </button>
                  </>
                )}
                <button
                  disabled
                  title="ยังไม่รองรับ — การเลือกหลายเที่ยวพร้อมกัน ไม่ได้อยู่ในขอบเขตนี้"
                  className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#bbb] cursor-not-allowed"
                >
                  เลือกเอง
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {sortedTrips.map(({ trip, stops, status }) => {
                const tripEggs = stops.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0);
                const skuCount = new Set(stops.flatMap(o => o.lines.map(l => l.sku))).size;
                const uniquePartners = Array.from(new Set(stops.map(o => o.partnerName)));
                const headingText = stops.length === 1 ? stops[0].deliverySiteName : (trip.name ?? `Trip ${trip.tripNumber}`);
                const isExpanded = expandedTrips[trip.id] ?? false;
                const isSelfPickup = !trip.vehicleId;
                const timeLabel = stops[0]?.deliveryTime ?? "-";

                return (
                  <div key={trip.id} className="border-b border-[#f0f0f0] md:odd:border-r">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="text-[14px] font-bold text-[#1E40AF] w-12 shrink-0 tabular-nums">{timeLabel}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-bold text-[#1a1a1a] truncate">{headingText}</span>
                          {uniquePartners.slice(0, 1).map(p => <CustPill key={p} name={p} />)}
                          {uniquePartners.length > 1 && (
                            <span className="text-[10.5px] text-[#888]">+{uniquePartners.length - 1} ลูกค้า</span>
                          )}
                          {isSelfPickup && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#FDF2F8] text-[#BE185D]">รับเอง</span>
                          )}
                          {trip.vehicleConfirmedAt && status.kind !== "done" && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#F5F2FB] text-[#5B4B8A]">นัดรถแล้ว</span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-[#555] mt-0.5">
                          {isSelfPickup ? "ลูกค้ามารับ" : `${trip.vehiclePlate ?? "-"} · ${trip.vehicleType ?? "-"} · ${trip.driverName ?? "-"}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="flex items-center gap-1 text-[11px] text-[#555]">
                            <span className={`w-1.5 h-1.5 rounded-full ${status.kind === "done" ? "bg-green-600" : status.kind === "ready" ? "bg-[#1E40AF]" : status.kind === "needs_packing" ? "bg-[#F59E0B]" : "bg-[#ccc]"}`} />
                            {status.label}
                            {status.at ? ` ${new Date(status.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                          </span>
                          <button
                            onClick={() => setPickingTrip(trip)}
                            className="px-2 py-1 text-[10.5px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                          >
                            พิมพ์ ▾
                          </button>
                        </div>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          {(status.kind === "ready" || status.kind === "done") && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">
                              ครบ
                            </span>
                          )}
                          <span className="text-[13px] font-bold tabular-nums text-[#1a1a1a]">{fmtNum(tripEggs)} ฟอง</span>
                          <button
                            onClick={() => setExpandedTrips(p => ({ ...p, [trip.id]: !isExpanded }))}
                            className="text-[11.5px] font-semibold text-[#1E40AF] hover:underline flex items-center gap-0.5"
                          >
                            {skuCount} SKU
                            <span className={`inline-block transition-transform ${isExpanded ? "" : "-rotate-90"}`}>▾</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {isExpanded && <SkuDetailTable rows={buildSkuRows(stops)} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Unassigned orders — "จัดออเดอร์เข้าเที่ยว" step: grouped by delivery
          site so a whole branch's orders get assigned to a trip in one
          action (assignToTrip already took an array; this is the one
          other place that matters), instead of one order at a time. */}
      {unassigned.length > 0 && (() => {
        const bySite = new Map<number, { siteName: string; partnerName: string; orders: (PlanOrder & { partnerName: string })[] }>();
        for (const o of unassigned) {
          if (!bySite.has(o.deliverySiteId)) bySite.set(o.deliverySiteId, { siteName: o.deliverySiteName, partnerName: o.partnerName, orders: [] });
          bySite.get(o.deliverySiteId)!.orders.push(o);
        }
        const groups = Array.from(bySite.values());
        return (
          <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#FCD34D] flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#92400E]">🔔 จัดออเดอร์เข้าเที่ยว — ยังไม่ assign</span>
              <span className="bg-[#F59E0B] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {groups.length} สาขา · {unassigned.length} ออเดอร์
              </span>
            </div>
            {/* Same rich card shell as the trip cards below (checkmark/ครบ,
                heading+customer, big eggs, times, SKU/PO) — these are
                effectively pre-trip candidates for the exact same card, not
                a visually separate concept. Always "ครบ" here since every
                order in `unassigned` is already confirmed-status by
                construction (see the allOrders filter above). */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
              {groups.map(g => {
                const eggs = g.orders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0);
                const skuCount = new Set(g.orders.flatMap(o => o.lines.map(l => l.sku))).size;
                const orderIds = g.orders.map(o => o.id);
                const { pickupLabel, deliveryLabel } = timeWindowFor(g.orders);
                const siteId = g.orders[0].deliverySiteId;
                const isSiteExpanded = expandedSites[siteId] ?? false;
                return (
                  <div key={siteId} className="bg-white rounded-xl border border-[#E1E5EA] border-l-4 overflow-hidden" style={{ borderLeftColor: "#16A34A" }}>
                    <div className="flex items-start gap-2.5 px-3 pt-2.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 bg-green-600 text-white">✓</span>
                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        <span className="text-[15px] font-bold text-[#1a1a1a] truncate">{g.siteName}</span>
                        <CustPill name={g.partnerName} />
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[19px] font-bold tabular-nums text-[#1a1a1a] leading-none">
                          {fmtNum(eggs)} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>
                        </div>
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">
                          ครบ
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-2 flex-wrap text-[11px]">
                      {(pickupLabel || deliveryLabel) && (
                        <>
                          <span className="text-[#888]">ขึ้นของ <b className="text-[#1a1a1a]">{pickupLabel ?? "ไม่ระบุ"}</b></span>
                          <span className="text-[#888]">ส่ง <b className="text-[#1a1a1a]">{deliveryLabel ?? "ไม่ระบุ"}</b></span>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedSites(p => ({ ...p, [siteId]: !isSiteExpanded }))}
                        className="ml-auto font-semibold text-[#555] flex items-center gap-1 hover:text-[#1a1a1a]"
                      >
                        {skuCount} SKU · {g.orders.length} PO
                        <span className={`inline-block transition-transform ${isSiteExpanded ? "" : "-rotate-90"}`}>▾</span>
                      </button>
                    </div>
                    {isSiteExpanded && (
                      <div className="flex items-center gap-1 flex-wrap px-3 py-1.5 border-t border-[#f0f0f0]">
                        {trips.map(t => (
                          <button
                            key={t.id}
                            onClick={() => assignToTrip(orderIds, t.id)}
                            disabled={assigning[t.id]}
                            className="px-2 py-1 text-[11px] font-semibold rounded border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] hover:bg-[#DBEAFE] disabled:opacity-50 flex items-center gap-1 shrink-0"
                          >
                            {assigning[t.id] && <Loader2 className="w-3 h-3 animate-spin" />}
                            + Trip {t.tripNumber}
                          </button>
                        ))}
                        {trips.length === 0 && <span className="text-[11px] text-[#aaa] italic">สร้าง Trip ก่อน</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {pickingTrip && (
        <PickingListModal
          trip={pickingTrip}
          orders={ordersByTrip[pickingTrip.id] ?? []}
          onClose={() => setPickingTrip(null)}
        />
      )}
      {bulkPrintOpen && (
        <PickingListModal
          // Bulk print across every visible trip at once — a synthetic
          // "trip" with no single vehicle/driver (there isn't one across
          // many real trips), combining all of their real orders. Real
          // data throughout; just no per-trip vehicle header line makes
          // sense here, same honest tradeoff as any multi-trip summary.
          trip={{
            id: -1, deliveryDate: date, productionRound: null, tripNumber: 0,
            name: "ทุกเที่ยว", notes: null, vehicleId: null, vehiclePlate: null,
            vehicleType: null, vehicleCapacityEggs: null, driverId: null, driverName: null,
            confirmedAt: null, vehicleConfirmedAt: null, departedAt: null,
          }}
          orders={visibleTrips.flatMap(t => t.stops)}
          onClose={() => setBulkPrintOpen(false)}
        />
      )}
    </div>
  );
}

// ── ออเดอร์นอกแผน (off-plan / walk-in order) ───────────────────────────────────────
// A walk-in sale paid from existing FG stock, no price, outside production
// planning — see POST /api/orders/off-plan (server/routes/orders.ts). Several
// real "ทั่วไป"-type partners in the catalog have zero delivery sites today
// and couldn't otherwise receive an order at all; this is their real entry
// point. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.

type OffPlanPartnerOption = { id: number; code: string; nickname: string; name: string | null };
type OffPlanItemOption = { id: number; sku: string | null; name: string; eggsPerPack: number | null; isSellable: boolean; itemRole: string | null };

function OffPlanOrderPanel({
  date,
  onClose,
  onCreated,
}: {
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [partners, setPartners] = useState<OffPlanPartnerOption[]>([]);
  const [itemOptions, setItemOptions] = useState<OffPlanItemOption[]>([]);
  useEffect(() => {
    fetch("/api/business-partners").then(r => (r.ok ? r.json() : [])).then(setPartners).catch(() => {});
    fetch("/api/items").then(r => (r.ok ? r.json() : [])).then(setItemOptions).catch(() => {});
  }, []);
  // Only real sellable FG — matches "จ่ายจากสต็อก FG" (paid from FG stock);
  // WIP/DEFECT already have their own direct-sale path elsewhere.
  const sellableItems = useMemo(
    () => itemOptions.filter(i => i.isSellable && (i.itemRole == null || i.itemRole === "FG")),
    [itemOptions],
  );
  const itemById = useMemo(() => {
    const m: Record<number, OffPlanItemOption> = {};
    for (const i of sellableItems) m[i.id] = i;
    return m;
  }, [sellableItems]);

  const [customerName, setCustomerName] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  type LineDraft = { itemId: number | null; query: string; qtyStr: string };
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: null, query: "", qtyStr: "" }]);
  const [activeItemRow, setActiveItemRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const customerMatches = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    const list = q
      ? partners.filter(p => (p.name ?? p.nickname).toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      : partners;
    return list.slice(0, 50);
  }, [partners, customerName]);

  const totalEggs = lines.reduce((s, l) => {
    const it = l.itemId != null ? itemById[l.itemId] : null;
    return s + (it ? (Number(l.qtyStr) || 0) * (it.eggsPerPack ?? 1) : 0);
  }, 0);

  const canSave = customerName.trim().length > 0 && lines.some(l => l.itemId != null && Number(l.qtyStr) > 0);

  const save = async () => {
    setError("");
    const validLines = lines
      .filter(l => l.itemId != null && Number(l.qtyStr) > 0)
      .map(l => ({ itemId: l.itemId!, qty: Number(l.qtyStr) }));
    if (!customerName.trim() || validLines.length === 0) return;
    setSaving(true);
    try {
      const r = await fetch("/api/orders/off-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          customerName: customerName.trim(),
          partnerId: selectedPartnerId ?? undefined,
          poNumber: poNumber.trim() || undefined,
          lines: validLines,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-bold text-[#1a1a1a]">ออเดอร์นอกแผน</span>
        <span className="text-[11.5px] text-[#92400E]">
          ลูกค้าเดินเข้ามาซื้อ / ออเดอร์ที่ไม่อยู่ในแผนผลิต · จ่ายจากสต็อก FG · ไม่มีราคา
        </span>
        <button onClick={onClose} className="ml-auto text-[#aaa] hover:text-[#333] text-[15px] leading-none">
          ×
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div>
          <div className="text-[11px] font-semibold text-[#555] mb-1">ลูกค้า</div>
          <div className="relative">
            <input
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value);
                setSelectedPartnerId(null);
                setCustomerPickerOpen(true);
              }}
              onFocus={() => setCustomerPickerOpen(true)}
              onBlur={() => setTimeout(() => setCustomerPickerOpen(false), 150)}
              placeholder="ชื่อลูกค้า · พิมพ์หรือเลือก"
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg focus:outline-none focus:border-[#1E40AF] bg-white"
            />
            {customerPickerOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-[#e3e5e8] rounded-lg shadow-lg">
                {customerMatches.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-[#aaa]">ไม่พบ — จะสร้างลูกค้าใหม่ "{customerName.trim()}"</div>
                ) : (
                  customerMatches.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setCustomerName(p.name ?? p.nickname);
                        setSelectedPartnerId(p.id);
                        setCustomerPickerOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#f5f5f5] flex items-center gap-1.5"
                    >
                      <span className="font-mono text-[10px] text-[#888] shrink-0">{p.code}</span>
                      <span className="truncate">{p.name ?? p.nickname}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <input
            value={poNumber}
            onChange={e => setPoNumber(e.target.value)}
            placeholder="เลข PO (ถ้ามี)"
            className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg focus:outline-none focus:border-[#1E40AF] bg-white mt-2"
          />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-[#555] mb-1">รายการ</div>
          <div className="space-y-2">
            {lines.map((l, idx) => {
              const q = l.query.trim().toLowerCase();
              const itemMatches = (
                q ? sellableItems.filter(it => (it.sku ?? "").toLowerCase().includes(q) || it.name.toLowerCase().includes(q)) : sellableItems
              ).slice(0, 50);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      value={l.query}
                      onChange={e => setLines(ls => ls.map((x, i) => (i === idx ? { ...x, query: e.target.value, itemId: null } : x)))}
                      onFocus={() => setActiveItemRow(idx)}
                      onBlur={() => setTimeout(() => setActiveItemRow(r => (r === idx ? null : r)), 150)}
                      placeholder="เลือก SKU"
                      className="w-full h-9 px-2 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
                    />
                    {activeItemRow === idx && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-[#e3e5e8] rounded-lg shadow-lg">
                        {itemMatches.length === 0 ? (
                          <div className="px-3 py-2 text-[12px] text-[#aaa]">ไม่พบสินค้า</div>
                        ) : (
                          itemMatches.map(it => (
                            <button
                              key={it.id}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setLines(ls => ls.map((x, i) => (i === idx ? { ...x, itemId: it.id, query: `${it.sku} · ${it.name}` } : x)));
                                setActiveItemRow(null);
                              }}
                              className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#f5f5f5] flex items-center gap-1.5"
                            >
                              <span className="font-mono text-[10px] text-[#0C447C] shrink-0">{it.sku}</span>
                              <span className="truncate">{it.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={l.qtyStr}
                    onChange={e => setLines(ls => ls.map((x, i) => (i === idx ? { ...x, qtyStr: e.target.value } : x)))}
                    placeholder="จำนวน"
                    className="w-24 h-9 px-2 text-[13px] text-right border border-[#e5e7eb] rounded-lg bg-white focus:outline-none shrink-0"
                  />
                  {lines.length > 1 && (
                    <button
                      onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))}
                      className="text-[#aaa] hover:text-[#DC2626] shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <button
              onClick={() => setLines(ls => [...ls, { itemId: null, query: "", qtyStr: "" }])}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5] bg-white"
            >
              + เพิ่มแถว
            </button>
            <span className="text-[12px] text-[#555]">
              รวม <b className="text-[#1a1a1a]">{fmtNum(totalEggs)}</b> ฟอง
            </span>
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="ml-auto px-4 py-1.5 text-[12.5px] font-bold rounded-lg bg-[#DB2777] text-white hover:bg-[#BE185D] disabled:opacity-40"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกออเดอร์นอกแผน"}
            </button>
          </div>
          {error && <div className="text-[11.5px] text-red-600 mt-1">{error}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Picking list print (ใบจัดของ) ────────────────────────────────────────────────
// Triggered from Trip Manager's new "ส่ง Trip" button — the "next step" the
// banner text above already alluded to but that didn't exist anywhere in the
// code. Pure client-side: everything needed (vehicle/driver, delivery site,
// selling unit, size, qty) is already loaded into PlanTrip/PlanOrder/PlanLine
// for Trip Manager's own use. Deliberately does NOT apply the isFgLine guard
// used everywhere else in this file (Packing/BOM/PQ) — DEFECT/WIP lines are
// real sales that still need to be physically picked and loaded, unlike
// production-round demand. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.

type PickingRow = { sizeLabel: string; unit: string; qty: number; sortKey: string };
type PickingSheet = {
  kind: "site" | "summary";
  partnerName: string;
  siteName: string | null;
  siteCount: number;
  pickupLabel: string | null;
  deliveryLabel: string | null;
  rows: PickingRow[];
  totalEggs: number;
  unitTotals: { family: string; qty: number }[];
};

// Every real (size, pack-unit) combination in the sellable FG catalog — the
// picking-list table always shows this full grid (zero rows included), not
// just whatever this sheet's own orders happen to contain, matching a
// physical pre-printed warehouse form. Built once from /api/items, not
// copied from any single reference example (different prints would
// otherwise need different fixed row sets, which isn't a real distinction).
type GridTemplateRow = { primarySize: string; secondarySize: string | null; packUnit: string };
function buildGridTemplate(
  items: { primarySize: string | null; secondarySize: string | null; packUnit: string | null; isSellable: boolean; isEgg: boolean; itemRole: string | null }[],
): GridTemplateRow[] {
  const seen = new Set<string>();
  const rows: GridTemplateRow[] = [];
  for (const it of items) {
    if (!it.isSellable || !it.isEgg || !it.packUnit) continue;
    if (it.itemRole != null && it.itemRole !== "FG") continue;
    if (!it.primarySize || it.primarySize === "6") continue;
    if (!/^\d+$/.test(it.primarySize) && it.primarySize !== "mixed") continue; // skips odd non-size codes like "L"/"M"
    const key = `${it.primarySize}|${it.secondarySize ?? ""}|${it.packUnit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ primarySize: it.primarySize, secondarySize: it.secondarySize, packUnit: it.packUnit });
  }
  return rows;
}

// Sort key: pack-unit family (แพ็ค → ถาด → มัด), then pack size ascending,
// then เบอร์ ascending (plain sizes, then "คละ"/mixed, then dual-size pairs).
const PACK_FAMILY_ORDER: Record<string, number> = { "แพ็ค": 0, "ถาด": 1, "มัด": 2 };
function templateSortKey(primarySize: string, secondarySize: string | null, packUnit: string): string {
  const m = packUnit.match(/^([ก-๙]+)(\d*)$/);
  const family = m ? m[1] : packUnit;
  const unitNum = m && m[2] ? Number(m[2]) : 0;
  const famRank = PACK_FAMILY_ORDER[family] ?? 9;
  const sizeRank = secondarySize != null ? 200 + Number(primarySize) * 10 + Number(secondarySize) : primarySize === "mixed" ? 100 : Number(primarySize);
  return `${famRank}-${String(unitNum).padStart(2, "0")}-${String(sizeRank).padStart(3, "0")}`;
}
// "ถาด" specifically is relabeled "ถาด/ครอบ" for this print only — every
// real WIP/FG item sold by the ถาด unit physically ships with a cover, so
// this is a cosmetic label choice, not a new data field.
function packUnitDisplay(unit: string): string {
  return unit === "ถาด" ? "ถาด/ครอบ" : unit;
}

// "แพ็ค10"/"แพ็ค12"/"แพ็ค15"/"แพ็ค4" → "แพ็ค"; "มัด4"/"มัด5" → "มัด"; "ถาด" → "ถาด".
// Generalizes to any future selling unit without a hardcoded list.
function sellingUnitFamily(unit: string): string {
  return unit.replace(/\d+$/, "") || unit;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
}

function fullDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

// Earliest pickup / latest delivery across a group of orders, each labeled
// with ITS OWN date (not the trip's) since pickup/delivery dates are stored
// per order and can differ from the trip's own delivery_date.
function timeWindowFor(orders: PlanOrder[]): { pickupLabel: string | null; deliveryLabel: string | null } {
  const pickups = orders
    .filter(o => o.pickupTime)
    .map(o => ({ date: o.pickupDate ?? o.deliveryDate, time: o.pickupTime! }))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const deliveries = orders
    .filter(o => o.deliveryTime)
    .map(o => ({ date: o.deliveryDate, time: o.deliveryTime! }))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  return {
    pickupLabel: pickups[0] ? `${shortDate(pickups[0].date)} ${pickups[0].time}` : null,
    deliveryLabel: deliveries[0] ? `${shortDate(deliveries[0].date)} ${deliveries[0].time}` : null,
  };
}

function buildPickingRows(
  lines: PlanLine[],
  template: GridTemplateRow[],
): { rows: PickingRow[]; totalEggs: number; unitTotals: { family: string; qty: number }[] } {
  const byKey = new Map<string, PickingRow>();
  // Seed every real catalog combo at qty 0 first, so the sheet always shows
  // the full grid — a physical form warehouse staff can read at a glance,
  // not just whatever happens to be non-zero this round.
  for (const t of template) {
    const key = `${t.primarySize}-${t.secondarySize ?? ""}|${t.packUnit}`;
    // Bare digits only ("0", "1", "3-4") — the table's own "เบอร์" column
    // header already says what they are, matching the reference's cells.
    const label = t.secondarySize ? `${t.primarySize}-${t.secondarySize}` : t.primarySize === "mixed" ? "คละ" : t.primarySize;
    byKey.set(key, { sizeLabel: label, unit: packUnitDisplay(t.packUnit), qty: 0, sortKey: templateSortKey(t.primarySize, t.secondarySize, t.packUnit) });
  }
  let totalEggs = 0;
  for (const l of lines) {
    const qty = l.planningQty ?? l.orderQty; // counted in the item's selling unit, not necessarily its pack unit
    const eggs = qty * (l.eggsPerSellingUnit ?? l.eggsPerPack);
    totalEggs += eggs;
    // "บรรจุ" is a physical pack count (how many แพ็ค10/มัด5/ถาด cartons to
    // pick) — converts through eggs so it's correct even when the selling
    // unit differs from the pack unit (e.g. sold by กะทัด, packed as แพ็ค10).
    const packQty = l.eggsPerPack > 0 ? eggs / l.eggsPerPack : qty;
    const key = `${l.primarySize ?? ""}-${l.secondarySize ?? ""}|${l.packUnit}`;
    if (!byKey.has(key)) {
      // Not in the catalog template (e.g. a non-FG line, or an odd size
      // code the template skips) — still shown, never silently dropped.
      const label = l.secondarySize ? `${l.primarySize}-${l.secondarySize}` : l.primarySize === "mixed" || l.primarySize == null ? "คละ" : l.primarySize;
      byKey.set(key, { sizeLabel: label, unit: packUnitDisplay(l.packUnit), qty: 0, sortKey: `9-${l.packUnit}-${label}` });
    }
    byKey.get(key)!.qty += packQty;
  }
  const rows = Array.from(byKey.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const familyTotals = new Map<string, number>();
  for (const r of rows) familyTotals.set(sellingUnitFamily(r.unit), (familyTotals.get(sellingUnitFamily(r.unit)) ?? 0) + r.qty);
  return { rows, totalEggs, unitTotals: Array.from(familyTotals.entries()).map(([family, qty]) => ({ family, qty })) };
}

function buildPickingSheets(
  orders: (PlanOrder & { partnerName: string })[],
  mode: "bySite" | "tripSummary" | "both",
  template: GridTemplateRow[],
): PickingSheet[] {
  const sheets: PickingSheet[] = [];

  if (mode === "bySite" || mode === "both") {
    const bySite = new Map<number, { siteName: string; partnerName: string; orders: (PlanOrder & { partnerName: string })[] }>();
    for (const o of orders) {
      if (!bySite.has(o.deliverySiteId)) bySite.set(o.deliverySiteId, { siteName: o.deliverySiteName, partnerName: o.partnerName, orders: [] });
      bySite.get(o.deliverySiteId)!.orders.push(o);
    }
    for (const { siteName, partnerName, orders: siteOrders } of Array.from(bySite.values())) {
      const { rows, totalEggs, unitTotals } = buildPickingRows(siteOrders.flatMap(o => o.lines), template);
      sheets.push({ kind: "site", partnerName, siteName, siteCount: 1, rows, totalEggs, unitTotals, ...timeWindowFor(siteOrders) });
    }
  }

  if (mode === "tripSummary" || mode === "both") {
    const byPartner = new Map<string, { orders: (PlanOrder & { partnerName: string })[]; siteIds: Set<number> }>();
    for (const o of orders) {
      if (!byPartner.has(o.partnerName)) byPartner.set(o.partnerName, { orders: [], siteIds: new Set() });
      const g = byPartner.get(o.partnerName)!;
      g.orders.push(o);
      g.siteIds.add(o.deliverySiteId);
    }
    for (const [partnerName, { orders: partnerOrders, siteIds }] of Array.from(byPartner.entries())) {
      const { rows, totalEggs, unitTotals } = buildPickingRows(partnerOrders.flatMap(o => o.lines), template);
      sheets.push({ kind: "summary", partnerName, siteName: null, siteCount: siteIds.size, rows, totalEggs, unitTotals, ...timeWindowFor(partnerOrders) });
    }
  }

  return sheets;
}

const PICKING_MODE_KEY = "pickingListLastMode";

function PickingListModal({
  trip,
  orders,
  onClose,
}: {
  trip: PlanTrip;
  orders: (PlanOrder & { partnerName: string })[];
  onClose: () => void;
}) {
  type Mode = "bySite" | "tripSummary" | "both";
  const lastUsed = (() => {
    try {
      const saved = localStorage.getItem(PICKING_MODE_KEY);
      return saved === "bySite" || saved === "tripSummary" || saved === "both" ? (saved as Mode) : null;
    } catch {
      return null; // private browsing / blocked storage — just means no "ใช้ล่าสุด" badge
    }
  })();
  const [mode, setMode] = useState<Mode>(lastUsed ?? "bySite");
  const [sheets, setSheets] = useState<PickingSheet[] | null>(null);
  const [gridTemplate, setGridTemplate] = useState<GridTemplateRow[]>([]);
  useEffect(() => {
    fetch("/api/items")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => setGridTemplate(buildGridTemplate(rows)))
      .catch(() => {});
  }, []);

  if (sheets) return <PickingListPrintView trip={trip} sheets={sheets} onClose={onClose} />;

  const OPTIONS: { id: Mode; title: string; desc: string }[] = [
    { id: "bySite", title: "แยกตามสาขา", desc: "1 ใบต่อสาขา · เบอร์ · บรรจุ · จำนวน" },
    { id: "tripSummary", title: "สรุปทั้งเที่ยว", desc: "1 ใบต่อลูกค้าต่อเที่ยว · รวมทุกสาขา" },
    { id: "both", title: "ทั้งสองแบบ", desc: "ใบสรุปตามด้วยใบแยกสาขา" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">พิมพ์ใบจัดของ</h2>
          <p className="text-[11.5px] text-[#888] mt-0.5">
            {trip.name ?? `Trip ${trip.tripNumber}`}
            {trip.vehiclePlate ? ` · ${trip.vehiclePlate}` : ""}
          </p>
        </div>
        <div className="p-3 space-y-1.5">
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors ${
                mode === opt.id ? "border-[#1E40AF] bg-[#EFF6FF]" : "border-[#e5e7eb] hover:bg-[#fafafa]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#1a1a1a]">{opt.title}</span>
                {lastUsed === opt.id && <span className="text-[10px] font-semibold text-[#1E40AF]">ใช้ล่าสุด</span>}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#e5e7eb]">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]">
            ยกเลิก
          </button>
          <button
            onClick={() => {
              try {
                localStorage.setItem(PICKING_MODE_KEY, mode);
              } catch {
                /* per-viewer convenience only — never blocks printing */
              }
              setSheets(buildPickingSheets(orders, mode, gridTemplate));
            }}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
          >
            พิมพ์
          </button>
        </div>
      </div>
    </div>
  );
}

// Same print-overlay mechanism as ReleasedWorkModal (Grading's floor
// documents) — hide everything outside #picking-list-print-area, one
// .plp-sheet per PickingSheet with page-break-after between them.
function PickingListPrintView({
  trip,
  sheets,
  onClose,
}: {
  trip: PlanTrip;
  sheets: PickingSheet[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #picking-list-print-area, #picking-list-print-area * { visibility: visible; }
          #picking-list-print-area {
            position: absolute; top: 0; left: 0;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          #picking-list-print-area .plp-chrome { display: none !important; }
          #picking-list-print-area > div { padding: 0 !important; overflow: visible !important; max-height: none !important; }
          #picking-list-print-area .plp-sheet {
            page-break-after: always;
            border: 1px solid #000 !important;
            border-radius: 0 !important;
            padding: 10mm !important;
            margin: 0 !important;
          }
          #picking-list-print-area .plp-sheet:last-child { page-break-after: auto; }
          #picking-list-print-area table { width: 100% !important; table-layout: auto !important; border-collapse: collapse !important; }
          #picking-list-print-area table th,
          #picking-list-print-area table td {
            border: 1px solid #000 !important;
            padding: 5px 8px !important;
            font-size: 11pt !important;
            color: #000 !important;
            background: #fff !important;
          }
          #picking-list-print-area table th { font-weight: 700 !important; }
          /* Everything resets to plain black-on-white for print EXCEPT the
             customer sidebar/badges, which keep their real per-customer
             color (same color used for that customer's pill everywhere
             else in the app) — the one deliberately colored element on an
             otherwise plain printed form. */
          #picking-list-print-area *:not(.plp-sidebar):not(.plp-sidebar *):not(.plp-badge):not(.plp-badge *) {
            color: #000 !important; background: transparent !important;
          }
          #picking-list-print-area .plp-sheet { display: flex !important; }
        }
      `}</style>
      <div
        id="picking-list-print-area"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="plp-chrome flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">
            ใบจัดของ · {trip.name ?? `Trip ${trip.tripNumber}`}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
            >
              พิมพ์
            </button>
            <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]">
              ปิด
            </button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {sheets.map((sheet, i) => {
            const badgeLetter = sheet.partnerName.trim().charAt(0).toUpperCase() || "?";
            const badgeColor = custColor(sheet.partnerName);
            return (
              <div key={i} className="plp-sheet border border-[#e5e7eb] rounded-xl overflow-hidden flex">
                {/* Sidebar — real per-customer color (same mapping as CustPill
                    elsewhere), badge letter top + bottom, name running down
                    the middle. The one deliberately colored element on an
                    otherwise plain black-and-white printed form. */}
                <div className="plp-sidebar w-7 shrink-0 flex flex-col items-center justify-between py-2" style={{ background: badgeColor }}>
                  <span className="plp-badge w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white border border-white/50 shrink-0">
                    {badgeLetter}
                  </span>
                  <span
                    className="plp-badge text-[10px] font-bold text-white tracking-wide whitespace-nowrap"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {sheet.partnerName}
                  </span>
                  <span className="plp-badge w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white border border-white/50 shrink-0">
                    {badgeLetter}
                  </span>
                </div>
                <div className="flex-1 min-w-0 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="plp-badge w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: badgeColor }}
                      >
                        {badgeLetter}
                      </span>
                      <div className="text-[16px] font-bold text-[#1a1a1a] truncate">
                        {[trip.vehicleType, trip.vehiclePlate].filter(Boolean).join(" ")}
                        {trip.driverName ? ` · ${trip.driverName}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="plp-badge w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: badgeColor }}
                      >
                        {badgeLetter}
                      </span>
                      <span className="text-[14px] font-bold text-[#1a1a1a]">{sheet.partnerName}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap mt-1.5">
                    <div className="text-[12px] text-[#555]">
                      ใบเบิกสินค้า {sheet.siteCount} สาขา
                      {sheet.siteName && <span className="text-[#888]"> · {sheet.siteName}</span>}
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-[#d6d8dc] text-[#555] shrink-0">
                      {sheet.kind === "site" ? "ใบจัดของ · สาขา" : "สรุปทั้งเที่ยว"}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[#555] mt-1.5">
                    ขึ้นของ {sheet.pickupLabel ?? "ไม่ระบุ"} · ส่ง {sheet.deliveryLabel ?? "ไม่ระบุ"}
                  </div>
                  <table className="w-full text-[12.5px] mt-3">
                    <thead>
                      <tr className="text-[10.5px] text-[#888] uppercase border-b border-[#e5e7eb]">
                        <th className="text-left py-1">เบอร์</th>
                        <th className="text-left py-1">บรรจุ</th>
                        <th className="text-right py-1">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-3 text-center text-[#bbb]">ไม่มีรายการ</td>
                        </tr>
                      ) : (
                        sheet.rows.map((r, j) => (
                          <tr key={j} className="border-b border-[#f5f5f5]">
                            <td className="py-1 font-semibold text-[#1a1a1a]">{r.sizeLabel}</td>
                            <td className="py-1 text-[#555]">{r.unit}</td>
                            <td className="py-1 text-right tabular-nums">
                              {r.qty > 0 ? (
                                <span className="font-semibold text-[#1a1a1a]">{fmtNum(r.qty)}</span>
                              ) : (
                                <span className="text-[#ccc]">0</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="mt-4 pt-3 border-t border-[#e5e7eb] flex items-center gap-4 flex-wrap text-[12.5px] font-bold text-[#1a1a1a]">
                    <span>รวม {fmtNum(sheet.totalEggs)} ฟอง</span>
                    {sheet.unitTotals.map(u => (
                      <span key={u.family}>
                        {fmtNum(u.qty)} {u.family}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-10 mt-6 text-[11px] text-[#555]">
                    <span>ผู้จัดของ __________</span>
                    <span>ตรวจ __________</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Checkout (เช็คเอาท์) ───────────────────────────────────────────────────────────
// A real reconciliation view, not a new data source — same trips/orders
// TripManager already uses, same tripStatus ladder, same buildSkuRows/
// buildGridTemplate/PickingListModal already built for Delivery's cards and
// picking-list print. "แพ็กแล้ว" only resolves when the trip's orders have
// a real production round AND packing_target_results for that item/round —
// most ad-hoc test orders here have no round, so it honestly shows "ไม่มี
// ข้อมูล" rather than a guess. "เบิกแล้ว" is real: the trip's own real
// dispatch (logistics_status/trips.departed_at) — since this app has no
// partial-dispatch concept, it's either the full planned qty (trip done)
// or 0 (not yet), never guessed in between. "ป้าย" (printed label count)
// has nothing real behind it and is left out rather than fabricated.
// See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.

function CheckoutTab({
  date,
  trips,
  partners,
}: {
  date: string;
  trips: PlanTrip[];
  partners: PlanPartner[];
}) {
  const allOrders = useMemo(
    () =>
      partners.flatMap(p =>
        p.orders
          .filter(o => o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")
          .map(o => ({ ...o, partnerName: p.partnerName })),
      ),
    [partners],
  );
  const ordersByTrip = useMemo(() => {
    const m: Record<number, (PlanOrder & { partnerName: string })[]> = {};
    for (const o of allOrders) {
      if (o.tripId != null) {
        if (!m[o.tripId]) m[o.tripId] = [];
        m[o.tripId].push(o);
      }
    }
    return m;
  }, [allOrders]);

  const relevantRounds = useMemo(
    () => Array.from(new Set(allOrders.map(o => o.productionRound).filter((r): r is number => r != null))),
    [allOrders],
  );
  const [packingResultsByRound, setPackingResultsByRound] = useState<Record<number, PackingTargetResultLite[]>>({});
  useEffect(() => {
    relevantRounds.forEach(round => {
      fetch(`/api/packing/target-results?date=${date}&round=${round}`)
        .then(r => (r.ok ? r.json() : []))
        .then((rows: PackingTargetResultLite[]) => setPackingResultsByRound(prev => ({ ...prev, [round]: rows })))
        .catch(() => {});
    });
  }, [date, relevantRounds]);

  const tripsWithStatus = useMemo(
    () =>
      trips
        .map(trip => {
          const stops = ordersByTrip[trip.id] ?? [];
          return { trip, stops, status: tripStatus(trip, stops, packingResultsByRound) };
        })
        .filter(t => t.stops.length > 0),
    [trips, ordersByTrip, packingResultsByRound],
  );

  const [statusFilter, setStatusFilter] = useState<TripStatusKind | "all">("all");
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const statusCounts = useMemo(() => {
    const c: Record<TripStatusKind, number> = { needs_confirm: 0, needs_packing: 0, ready: 0, done: 0 };
    for (const t of tripsWithStatus) c[t.status.kind]++;
    return c;
  }, [tripsWithStatus]);
  const customerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { stops } of tripsWithStatus) {
      for (const name of Array.from(new Set(stops.map(o => o.partnerName)))) m.set(name, (m.get(name) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [tripsWithStatus]);

  const visibleTrips = useMemo(
    () =>
      tripsWithStatus
        .filter(
          t =>
            (statusFilter === "all" || t.status.kind === statusFilter || (statusFilter === "needs_packing" && t.status.kind === "needs_confirm")) &&
            (customerFilter === null || t.stops.some(o => o.partnerName === customerFilter)),
        )
        .sort((a, b) => (a.stops[0]?.deliveryTime ?? "99:99").localeCompare(b.stops[0]?.deliveryTime ?? "99:99")),
    [tripsWithStatus, statusFilter, customerFilter],
  );

  const doneTrips = tripsWithStatus.filter(t => t.status.kind === "done");
  const doneEggs = doneTrips.reduce((s, t) => s + t.stops.reduce((ss, o) => ss + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0), 0);

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  useEffect(() => {
    if (visibleTrips.length > 0 && !visibleTrips.some(t => t.trip.id === selectedTripId)) setSelectedTripId(visibleTrips[0].trip.id);
  }, [visibleTrips, selectedTripId]);
  const selected = visibleTrips.find(t => t.trip.id === selectedTripId) ?? null;

  const [printTrip, setPrintTrip] = useState<PlanTrip | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-[16px] font-bold text-[#1a1a1a]">เช็คเอาท์</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] bg-[#f5f5f5]">รายเที่ยว</button>
          <button
            disabled
            title="ยังไม่รองรับ — รายงานแยกต่างหาก ไม่ได้อยู่ในขอบเขตนี้"
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#bbb] cursor-not-allowed"
          >
            รายงานของออก
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3 items-start">
        {/* Left — trip list */}
        <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#f0f0f0]">
            <div className="text-[13px] font-bold text-[#1a1a1a]">รถส่งวันนี้ {tripsWithStatus.length} เที่ยว</div>
          </div>
          <div className="px-3 py-2 border-b border-[#f0f0f0]">
            <div className="text-[10px] font-semibold text-[#888] mb-1">ของ · สถานะเที่ยว</div>
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  ["needs_packing", "รอแพ็ก", statusCounts.needs_packing + statusCounts.needs_confirm],
                  ["ready", "พร้อม", statusCounts.ready],
                  ["done", "เสร็จ", statusCounts.done],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(f => (f === key ? "all" : key))}
                  className={`px-2 py-1 text-[10.5px] font-semibold rounded-full border ${
                    statusFilter === key ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white text-[#555] border-[#d6d8dc] hover:bg-[#f5f5f5]"
                  }`}
                >
                  {label} {count}
                </button>
              ))}
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2 py-1 text-[10.5px] font-bold rounded-full border ${
                  statusFilter === "all" ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white text-[#555] border-[#d6d8dc] hover:bg-[#f5f5f5]"
                }`}
              >
                ทั้งหมด {tripsWithStatus.length}
              </button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-[#f0f0f0]">
            <div className="text-[10px] font-semibold text-[#888] mb-1">ลูกค้า · กรอง</div>
            <div className="flex items-center gap-1 flex-wrap">
              {customerCounts.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setCustomerFilter(f => (f === name ? null : name))}
                  style={
                    customerFilter === name
                      ? { background: custColor(name), borderColor: custColor(name), color: "#fff" }
                      : { background: custBg(name), borderColor: "#e5e7eb", color: custColor(name) }
                  }
                  className="px-2 py-1 text-[10.5px] font-bold rounded-full border"
                >
                  {name} {count}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 py-2 text-[11.5px] text-[#555] border-b border-[#f0f0f0]">
            เสร็จแล้ว {doneTrips.length} เที่ยว · {fmtNum(doneEggs)} ฟอง
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {visibleTrips.map(({ trip, stops, status }) => {
              const eggs = stops.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.orderQty * l.eggsPerPack, 0), 0);
              const skuCount = new Set(stops.flatMap(o => o.lines.map(l => l.sku))).size;
              const uniquePartners = Array.from(new Set(stops.map(o => o.partnerName)));
              const headingText = stops.length === 1 ? stops[0].deliverySiteName : trip.name ?? `Trip ${trip.tripNumber}`;
              const dispatchedEggs = status.kind === "done" ? eggs : 0;
              const isSelected = selected?.trip.id === trip.id;
              return (
                <button
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[#f5f5f5] flex items-start gap-2 hover:bg-[#fafcff] border-l-4 ${
                    isSelected ? "bg-[#EFF6FF] border-l-[#1E40AF]" : "border-l-transparent"
                  }`}
                >
                  <span className="text-[11px] font-bold text-[#1E40AF] w-10 shrink-0 pt-0.5">{stops[0]?.deliveryTime ?? "-"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[13px] font-bold text-[#1a1a1a] truncate">{headingText}</span>
                      {uniquePartners.slice(0, 1).map(p => (
                        <CustPill key={p} name={p} />
                      ))}
                      {uniquePartners.length > 1 && <span className="text-[10px] text-[#888]">+{uniquePartners.length - 1}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[10.5px] text-[#888] mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          status.kind === "done" ? "bg-green-600" : status.kind === "ready" ? "bg-[#1E40AF]" : "bg-[#ccc]"
                        }`}
                      />
                      {status.label}
                      {status.at ? ` ${new Date(status.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </div>
                    <div className="text-[11.5px] font-semibold text-[#1a1a1a] mt-0.5">
                      {fmtNum(dispatchedEggs)} / {fmtNum(eggs)} ฟอง · {skuCount} SKU
                    </div>
                  </div>
                </button>
              );
            })}
            {visibleTrips.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-[#bbb]">ไม่มีเที่ยว</div>}
          </div>
        </div>

        {/* Right — selected trip detail */}
        {selected ? (
          <CheckoutDetailPanel
            trip={selected.trip}
            stops={selected.stops}
            status={selected.status}
            packingResultsByRound={packingResultsByRound}
            onPrint={() => setPrintTrip(selected.trip)}
          />
        ) : (
          <div className="bg-white rounded-xl border border-[#E1E5EA] p-10 text-center text-[13px] text-[#bbb]">
            เลือกเที่ยวทางซ้ายเพื่อดูรายละเอียด
          </div>
        )}
      </div>

      {printTrip && (
        <CheckoutPrintView
          trip={printTrip}
          stops={ordersByTrip[printTrip.id] ?? []}
          status={tripsWithStatus.find(t => t.trip.id === printTrip.id)!.status}
          onClose={() => setPrintTrip(null)}
        />
      )}
    </div>
  );
}

function CheckoutDetailPanel({
  trip,
  stops,
  status,
  packingResultsByRound,
  onPrint,
}: {
  trip: PlanTrip;
  stops: (PlanOrder & { partnerName: string })[];
  status: { kind: TripStatusKind; label: string; at: string | null };
  packingResultsByRound: Record<number, PackingTargetResultLite[]>;
  onPrint: () => void;
}) {
  const uniquePartners = Array.from(new Set(stops.map(o => o.partnerName)));
  const headingText = stops.length === 1 ? stops[0].deliverySiteName : trip.name ?? `Trip ${trip.tripNumber}`;
  const { pickupLabel } = timeWindowFor(stops);
  const isSelfPickup = !trip.vehicleId;
  const dispatched = status.kind === "done";
  const siteCount = new Set(stops.map(o => o.deliverySiteId)).size;

  const { rows: planRows, totalEggs: planEggs, unitTotals } = buildPickingRows(stops.flatMap(o => o.lines), []);
  const planSkuRows = buildSkuRows(stops);

  const packedByItem = new Map<number, number>();
  for (const o of stops) {
    if (o.productionRound == null) continue;
    for (const r of packingResultsByRound[o.productionRound] ?? []) {
      if (r.status === "confirmed" && r.actualQtyEggs != null) {
        packedByItem.set(r.itemId, (packedByItem.get(r.itemId) ?? 0) + r.actualQtyEggs);
      }
    }
  }
  const anyRoundLinked = stops.some(o => o.productionRound != null);

  const dispatchedEggs = dispatched ? planEggs : 0;
  const matchedCount = planSkuRows.filter(r => (dispatched ? r.eggs > 0 : false)).length;

  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0] flex-wrap">
        <div className="flex items-center gap-2">
          <CustPill name={uniquePartners[0] ?? ""} />
          <span className="text-[16px] font-bold text-[#1a1a1a]">{headingText}</span>
          {uniquePartners.length > 1 && <span className="text-[11px] text-[#888]">+{uniquePartners.length - 1} ลูกค้า</span>}
        </div>
        <button onClick={onPrint} className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-[#1a1a1a] text-white hover:bg-black">
          พิมพ์ใบเบิก
        </button>
      </div>
      <div className="px-4 py-2 text-[11.5px] text-[#555] border-b border-[#f0f0f0] flex items-center gap-1.5 flex-wrap">
        {isSelfPickup ? (
          <span className="font-semibold text-[#BE185D]">ลูกค้ามารับ</span>
        ) : (
          <span>
            {[trip.vehicleType, trip.vehiclePlate].filter(Boolean).join(" ")}
            {trip.driverName ? ` · ${trip.driverName}` : ""}
          </span>
        )}
        <span>· ขึ้นของ {pickupLabel ?? "ไม่ระบุ"}</span>
        <span>· {siteCount} สาขา</span>
        <span>
          · ใบจัดของ <b className="text-[#1a1a1a]">{fmtNum(planEggs)}</b> ฟอง
          {unitTotals.length > 0 && ` = ${unitTotals.map(u => `${fmtNum(u.qty)} ${u.family}`).join(" · ")}`}
        </span>
        <span>
          · เบิกแล้ว <b className={dispatched ? "text-green-700" : "text-[#aaa]"}>{fmtNum(dispatchedEggs)}</b> ฟอง
        </span>
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#f0f0f0] bg-[#FAFBFC] flex-wrap text-[12px]">
        <span className="font-semibold text-[#555]">เทียบกับใบจัดของ</span>
        <span>
          ใบจัดของ <b>{planSkuRows.length}</b> SKU · <b>{fmtNum(planEggs)}</b> ฟอง
        </span>
        <span>
          เบิกแล้ว <b className={dispatched ? "text-green-700" : "text-[#aaa]"}>{fmtNum(dispatchedEggs)}</b> ฟอง
        </span>
        <span className="ml-auto font-bold">
          {dispatched ? (
            <span className="text-green-700">ครบ {planSkuRows.length}/{planSkuRows.length} SKU</span>
          ) : (
            <span className="text-[#aaa]">ยังไม่เช็คเอาท์ 0/{planSkuRows.length} SKU</span>
          )}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] text-[#888] uppercase border-b border-[#f0f0f0]">
              <th className="text-left py-2 px-4">SKU</th>
              <th className="text-left py-2 px-3">เบอร์</th>
              <th className="text-left py-2 px-3">หน่วย</th>
              <th className="text-right py-2 px-3">ใบจัดของ</th>
              <th className="text-right py-2 px-3">แพ็กแล้ว</th>
              <th className="text-right py-2 px-4">เบิกแล้ว</th>
            </tr>
          </thead>
          <tbody>
            {planSkuRows.map(r => {
              const itemId = stops.flatMap(o => o.lines).find(l => l.sku === r.sku)?.itemId;
              const packedEggs = itemId != null ? packedByItem.get(itemId) : null;
              return (
                <tr key={r.sku} className="border-b border-[#f5f5f5] last:border-b-0">
                  <td className="py-2 px-4">
                    <span className="font-mono text-[10.5px] text-[#0C447C]">{r.sku}</span>
                    <span className="text-[#555] ml-1.5">{r.name}</span>
                  </td>
                  <td className="py-2 px-3 text-[#555]">{r.sizeLabel}</td>
                  <td className="py-2 px-3 text-[#555]">{r.packUnit}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold text-[#1a1a1a]">{fmtNum(r.qty)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {packedEggs != null ? (
                      <span className="font-semibold text-[#1a1a1a]">{fmtNum(packedEggs)}</span>
                    ) : (
                      <span className="text-[#ccc]" title={anyRoundLinked ? "ไม่พบผลแพ็กที่ยืนยันสำหรับ SKU นี้" : "ออเดอร์นี้ไม่มีรอบผลิต — ไม่มีข้อมูลแพ็ก"}>
                        ไม่มีข้อมูล
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {dispatched ? (
                      <span className="font-semibold text-green-700">{fmtNum(r.eggs)} ✓</span>
                    ) : (
                      <span className="text-[#ccc]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ใบเบิกสินค้า FG — a real withdrawal-reconciliation slip for one trip,
// printed directly (no mode-picker popup, unlike the multi-site picking
// list). เบิกจริง/ส่วนต่าง reuse the same honest "all or nothing" dispatch
// model as CheckoutDetailPanel: this app has no partial-dispatch concept,
// so เบิกจริง is either the full planned qty (trip checked out) or 0. The
// reference screenshot's ล็อต·สถานี·จำนวน column has nothing real behind
// it yet — packing_target_results.station exists but is unpopulated — so
// it prints as "—" rather than a fabricated lot code. Per-site rows use
// each order's own real order_number (e.g. SO2611053), not the fictional
// two-PO-per-site pattern in the reference (real po_number is sparse/
// messy and never two-per-order in this DB).
function CheckoutPrintView({
  trip,
  stops,
  status,
  onClose,
}: {
  trip: PlanTrip;
  stops: (PlanOrder & { partnerName: string })[];
  status: { kind: TripStatusKind; label: string; at: string | null };
  onClose: () => void;
}) {
  const uniquePartners = Array.from(new Set(stops.map(o => o.partnerName)));
  const primaryPartner = uniquePartners[0] ?? "";
  const badgeLetter = primaryPartner.trim().charAt(0).toUpperCase() || "?";
  const badgeColor = custColor(primaryPartner);
  const { pickupLabel } = timeWindowFor(stops);
  const dispatched = status.kind === "done";

  const planSkuRows = buildSkuRows(stops);
  const { totalEggs: planEggs } = buildPickingRows(stops.flatMap(o => o.lines), []);

  const bySite = new Map<number, { siteName: string; orderNumbers: string[]; deliveryLabel: string | null }>();
  for (const o of stops) {
    if (!bySite.has(o.deliverySiteId)) bySite.set(o.deliverySiteId, { siteName: o.deliverySiteName, orderNumbers: [], deliveryLabel: o.deliveryTime ? `${shortDate(o.deliveryDate)} ${o.deliveryTime}` : null });
    bySite.get(o.deliverySiteId)!.orderNumbers.push(o.orderNumber);
  }
  const siteRows = Array.from(bySite.values());

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          body * { visibility: hidden; }
          #checkout-print-area, #checkout-print-area * { visibility: visible; }
          #checkout-print-area {
            position: absolute; top: 0; left: 0;
            width: 100% !important; max-width: none !important; max-height: none !important;
            overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; background: #fff !important;
          }
          #checkout-print-area .cpv-chrome { display: none !important; }
          #checkout-print-area > div { padding: 0 !important; overflow: visible !important; max-height: none !important; }
          #checkout-print-area table { width: 100% !important; border-collapse: collapse !important; }
          #checkout-print-area table th, #checkout-print-area table td {
            border: 1px solid #000 !important; padding: 5px 8px !important; font-size: 10.5pt !important; color: #000 !important; background: #fff !important;
          }
          #checkout-print-area table th { font-weight: 700 !important; }
          #checkout-print-area *:not(.cpv-badge):not(.cpv-badge *) { color: #000 !important; background: transparent !important; }
        }
      `}</style>
      <div id="checkout-print-area" className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="cpv-chrome flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">ใบเบิกสินค้า FG · {trip.name ?? `Trip ${trip.tripNumber}`}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]">พิมพ์</button>
            <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]">ปิด</button>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[22px] font-bold text-[#1a1a1a]">ใบเบิกสินค้า FG</div>
              <div className="text-[12px] text-[#555] mt-1">
                วันผลิต {fullDate(trip.deliveryDate)}
                {trip.vehicleType ? ` · ${trip.vehicleType}` : ""}
                {trip.vehiclePlate ? ` ${trip.vehiclePlate}` : ""}
                {trip.driverName ? ` · ${trip.driverName}` : ""}
                {" · "}ขึ้นของ {pickupLabel ?? "ไม่ระบุ"}
                {" · "}เช็คเอาท์ {dispatched && status.at ? new Date(status.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "ยังไม่เช็คเอาท์"}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="cpv-badge w-7 h-7 rounded flex items-center justify-center text-[12px] font-bold text-white" style={{ background: badgeColor }}>
                {badgeLetter}
              </span>
              <span className="text-[16px] font-bold text-[#1a1a1a]">{primaryPartner}</span>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            {siteRows.map((s, i) => (
              <div key={i} className="text-[12px] text-[#555]">
                {i + 1} {s.siteName}
                {" "}<span className="font-mono text-[11px] text-[#0C447C]">{s.orderNumbers.join(" · ")}</span>
                {s.deliveryLabel && <span> · ส่ง {s.deliveryLabel}</span>}
              </div>
            ))}
          </div>

          <div className="text-[12.5px] text-[#555] mt-4 pb-2 border-b border-[#e5e7eb]">
            สรุปทั้งหมด · รายการที่เบิก {planSkuRows.length} SKU · {siteRows.length} สาขา
          </div>

          <table className="w-full text-[12px] mt-3">
            <thead>
              <tr className="text-[10.5px] text-[#888] uppercase border-b border-[#e5e7eb]">
                <th className="text-left py-1.5">SKU</th>
                <th className="text-left py-1.5">เบอร์</th>
                <th className="text-left py-1.5">หน่วย</th>
                <th className="text-right py-1.5">ใบจัดของ</th>
                <th className="text-right py-1.5">เบิกจริง</th>
                <th className="text-left py-1.5 pl-3">ส่วนต่าง</th>
                <th className="text-left py-1.5 pl-3">ล็อต · สถานี · จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {planSkuRows.map(r => {
                const actual = dispatched ? r.eggs : 0;
                const diff = r.eggs - actual;
                return (
                  <tr key={r.sku} className="border-b border-[#f5f5f5] last:border-b-0">
                    <td className="py-1.5">
                      <span className="font-mono text-[10.5px] text-[#0C447C]">{r.sku}</span>
                      <span className="text-[#555] ml-1.5">{r.name}</span>
                    </td>
                    <td className="py-1.5 text-[#555]">{r.sizeLabel}</td>
                    <td className="py-1.5 text-[#555]">{r.packUnit}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtNum(r.eggs)}</td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-[#1a1a1a]">{fmtNum(actual)}</td>
                    <td className="py-1.5 pl-3">
                      {diff === 0 ? <span className="font-semibold text-green-700">ครบ</span> : <span className="font-semibold text-[#B45309]">ขาด {fmtNum(diff)}</span>}
                    </td>
                    <td className="py-1.5 pl-3 text-[#ccc]">—</td>
                  </tr>
                );
              })}
              <tr className="font-bold text-[#1a1a1a]">
                <td className="py-1.5" colSpan={3}>รวม</td>
                <td className="py-1.5 text-right tabular-nums">{fmtNum(planEggs)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtNum(dispatched ? planEggs : 0)}</td>
                <td className="py-1.5 pl-3">{dispatched ? <span className="text-green-700">ครบ</span> : <span className="text-[#B45309]">ขาด {fmtNum(planEggs)}</span>}</td>
                <td className="py-1.5"></td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 text-[16px] font-bold text-[#1a1a1a]">
            {fmtNum(dispatched ? planEggs : 0)} ฟอง · ใบจัดของ {fmtNum(planEggs)}
          </div>
          <div className="flex items-center gap-8 mt-6 text-[11px] text-[#555] flex-wrap">
            <span>ผู้เบิก __________</span>
            <span>ผู้จ่ายของ __________</span>
            <span>คนขับ {trip.driverName ?? "__________"}</span>
            <span>เทียบใบกำกับ __________</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FG Stock (สต็อก FG) ───────────────────────────────────────────────────────────
// A deliberately honest "today-only movement" view, NOT a real stock ledger —
// see GET /api/packing/fg-stock (server/routes/packing.ts) for exactly what's
// real vs disclosed-missing: ยกมา comes from the existing confirmed Opening
// Stock feature (grading_opening_stock, shared per size/outcome across every
// FG SKU of that size, not SKU-exact); เข้า/เบิก are this date's real
// confirmed packing + real trip-checkout dispatches; ± นับ has no physical-
// count feature behind it and is always blank. See /Users/krisdachugh/.claude/
// plans/scalable-hatching-moore.md.

type FgStockSkuRow = {
  itemId: number; sku: string; name: string; eggsPerPack: number;
  primarySize: string | null; secondarySize: string | null; packUnit: string | null; sellingUnit: string | null;
  customerName: string | null;
  openingEggs: number | null; inEggs: number; outEggs: number; netEggs: number;
};
type FgStockResponse = {
  date: string;
  totals: { openingEggs: number | null; inEggs: number; outEggs: number; netEggs: number; skuCount: number };
  skus: FgStockSkuRow[];
};

function FgStockTab({ date }: { date: string }) {
  const [data, setData] = useState<FgStockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/packing/fg-stock?date=${date}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [date]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtEggsOrDash = (v: number | null) => (v == null ? <span className="text-[#ccc]">ไม่ได้นับ</span> : fmtNum(v));

  // Only real for the OEM-branded SKUs whose prefix confidently maps to an
  // existing partner (items.partner_id set server-side for those) — every
  // other SKU has customerName: null and only shows under "ทุกลูกค้า".
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const customerCounts = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    for (const r of data.skus) if (r.customerName) m.set(r.customerName, (m.get(r.customerName) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);
  const visibleSkus = data ? (customerFilter === null ? data.skus : data.skus.filter(r => r.customerName === customerFilter)) : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-bold text-[#1a1a1a]">สต็อก FG</h2>
        <p className="text-[11px] text-[#888] mt-0.5">
          ยกมา + เข้า − เบิก = คงเหลือ · มุมมองวันนี้เท่านั้น ไม่ใช่บัญชีสต็อกจริง — ไม่มีการนับสต็อกหรือติดตามล็อตในระบบนี้
        </p>
      </div>

      {loading && <div className="text-[12px] text-[#888]">กำลังโหลด...</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(
              [
                ["ยกมา", data.totals.openingEggs, "ยอดคงเหลือที่คอนเฟิร์มล่าสุดจาก Opening Stock (ต่อเบอร์ ไม่ใช่รายสาขา)"],
                ["เข้า", data.totals.inEggs, "แพ็กจริงที่ยืนยันแล้ววันนี้"],
                ["เบิก", data.totals.outEggs, "เที่ยวที่เช็คเอาท์แล้ววันนี้"],
                ["± นับ", null, "ยังไม่มีฟีเจอร์นับสต็อกจริงในระบบนี้"],
                ["คงเหลือ", data.totals.netEggs, "ยกมา + เข้า − เบิก (ไม่ใช่ยอดคงเหลือสะสมจริง)"],
              ] as const
            ).map(([label, value, hint]) => (
              <div key={label} className="bg-white rounded-xl border border-[#E1E5EA] p-3" title={hint}>
                <div className="text-[10px] font-semibold text-[#888] uppercase">{label}</div>
                <div className="text-[19px] font-bold text-[#1a1a1a] mt-1">
                  {fmtEggsOrDash(value)} {value != null && <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Customer filter — real only for OEM-branded SKUs whose prefix
              confidently maps to an existing partner (Makro/BigC/Thaifood);
              every other SKU has no customer and only shows under
              "ทุกลูกค้า" (shown unfiltered, not hidden). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCustomerFilter(null)}
              className={`px-3 py-1.5 text-[11.5px] font-bold rounded-full border transition-colors ${
                customerFilter === null ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white text-[#555] border-[#d6d8dc] hover:bg-[#f5f5f5]"
              }`}
            >
              ทุกลูกค้า {data.skus.length}
            </button>
            {customerCounts.map(([name, count]) => (
              <button
                key={name}
                onClick={() => setCustomerFilter(f => (f === name ? null : name))}
                style={
                  customerFilter === name
                    ? { background: custColor(name), borderColor: custColor(name), color: "#fff" }
                    : { background: custBg(name), borderColor: "#e5e7eb", color: custColor(name) }
                }
                className="px-3 py-1.5 text-[11.5px] font-bold rounded-full border transition-colors"
              >
                {name} {count}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] text-[#888] uppercase border-b border-[#f0f0f0] bg-[#FAFBFC]">
                  <th className="text-left py-2 px-3">SKU</th>
                  <th className="text-left py-2 px-3">เบอร์</th>
                  <th className="text-left py-2 px-3">บรรจุ</th>
                  <th className="text-right py-2 px-3">ยกมา</th>
                  <th className="text-right py-2 px-3">เข้า</th>
                  <th className="text-right py-2 px-3">เบิก</th>
                  <th className="text-right py-2 px-3">± นับ</th>
                  <th className="text-right py-2 px-3">คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {visibleSkus.map(r => {
                  const sizeLabelTxt = r.secondarySize ? `${r.primarySize}-${r.secondarySize}` : r.primarySize ?? "-";
                  const netPack = r.eggsPerPack > 0 ? r.netEggs / r.eggsPerPack : r.netEggs;
                  return (
                    <tr key={r.itemId} className="border-b border-[#f5f5f5] last:border-b-0 hover:bg-[#fafcff]">
                      <td className="py-2 px-3">
                        {r.customerName && <CustPill name={r.customerName} />}
                        <span className="font-mono text-[10.5px] text-[#0C447C] ml-1.5">{r.sku}</span>
                        <span className="text-[#555] ml-1.5">{r.name}</span>
                      </td>
                      <td className="py-2 px-3 text-[#555]">{sizeLabelTxt}</td>
                      <td className="py-2 px-3 text-[#555]">{r.packUnit ?? "-"}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtEggsOrDash(r.openingEggs)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-green-700">
                        {r.inEggs > 0 ? fmtNum(r.inEggs) : <span className="text-[#ccc]">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-[#92400E]">
                        {r.outEggs > 0 ? fmtNum(r.outEggs) : <span className="text-[#ccc]">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#ccc]">—</td>
                      <td className="py-2 px-3 text-right">
                        <div className="font-bold tabular-nums text-[#1a1a1a]">{fmtNum(netPack)}</div>
                        <div className="text-[10px] text-[#aaa]">{fmtNum(r.netEggs)} ฟอง</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Production area (Grading / Packing / Production Requirements-BOM) ────────────
// BOM reuses the existing real BomView. Grading's first section (Receiving Lots)
// is real and persisted (see GradingReceivingLots below). Everything downstream
// of receiving (grading jobs, machine job board, actual results) doesn't exist
// yet, so Received/Planned/Sent-to-floor/Result Summary are honestly computed —
// Planned and Sent-to-floor are always 0 and Result Summary is always "No results
// yet" until a grading-job/allocation feature exists to derive them from. Packing
// stays a placeholder — there's no packing data at all yet.

type ProductionSubTab = "grading" | "packing" | "bom";

// One packing-target line (date/round/item) — see server/routes/packing.ts.
type PackingTarget = {
  id: number;
  deliveryDate: string;
  round: number;
  itemId: number;
  sku: string;
  itemName: string;
  eggsPerPack: number;
  primarySize: string | null;
  secondarySize: string | null;
  partnerId: number | null;
  partnerName: string | null;
  qtyEggs: number;
  readyBy: string | null;
  source: "aq" | "manual";
  aqSnapshotId: number | null;
  adjustReason: string | null;
  sentAt: string | null;
  createdAt: string;
};

// A merged demand+target line for one item within one egg-size group — see
// packingSubRowsBySize/packingDemandRowsBySize in ProductionArea. targetIds
// is empty for pure (un-targeted) demand, has one id for a normal row, or
// several when "สะสม" merges a target that exists in more than one round.
type PackingSubRow = {
  itemId: number; targetIds: number[]; sku: string; itemName: string; eggsPerPack: number;
  qty: number; readyBy: string | null; customerName: string | null; aq: number; pqRemaining: number;
};

// Section 3 "บันทึกผลแพ็กจริง" — one row per issued packing_targets line
// (sent_at set), joined with its real actual result if one's been entered.
// See GET /api/packing/target-results.
type PackingTargetResult = {
  targetId: number; itemId: number; sku: string; itemName: string; eggsPerPack: number; readyBy: string | null;
  targetQtyEggs: number; actualQtyEggs: number | null; station: string | null; note: string | null;
  status: "draft" | "confirmed" | null; confirmedAt: string | null;
};

// ── "+ เพิ่ม SKU จาก AQ" — add one packing_targets line ───────────────────────────
// Two steps: search/pick a sellable item (server/routes/packing.ts
// /products), then set its quantity. "AQ ทางการ" is the date's ACTIVE
// aq_snapshots version (not a live recompute) — matches "official" in the
// reference; typing a qty that differs from that pre-filled value requires a
// reason, same pattern Defer-to-next-round already uses elsewhere. Qty must
// be a whole number of packs — enforced here AND server-side.
type PackingProduct = { id: number; sku: string; name: string; eggsPerPack: number; packUnit: string | null; primarySize: string | null; secondarySize: string | null; partnerId: number | null };

function AddPackingTargetModal({
  date,
  round,
  allTargets,
  pqRemainingByItem,
  onClose,
  onSaved,
}: {
  date: string;
  round: number;
  allTargets: PackingTarget[]; // every round's targets for the date — for the 4-number reference panel
  pqRemainingByItem: Record<number, number>; // real PQ-by-item for the whole day
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"pick" | "qty">("pick");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PackingProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PackingProduct | null>(null);
  const [aqSkus, setAqSkus] = useState<{ sku: string; avgEggs: number }[]>([]);
  const [aqVersion, setAqVersion] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [readyBy, setReadyBy] = useState("00:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/orders/aq-snapshots?date=${date}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: { version: number; state: string; skus: { sku: string; avgEggs: number }[] }[]) => {
        const active = rows.find(r => r.state === "active");
        if (active) { setAqSkus(active.skus); setAqVersion(active.version); }
      })
      .catch(() => {});
  }, [date]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/packing/products?q=${encodeURIComponent(search)}`)
        .then(r => (r.ok ? r.json() : []))
        .then(rows => { if (!cancelled) setResults(rows); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const aqForSku = (sku: string) => aqSkus.find(s => s.sku === sku);

  const pickProduct = (p: PackingProduct) => {
    setSelected(p);
    const aq = aqForSku(p.sku);
    if (aq && aq.avgEggs > 0) {
      // Pre-fill from official AQ, rounded to a whole number of packs.
      const rounded = Math.round(aq.avgEggs / p.eggsPerPack) * p.eggsPerPack;
      setQty(String(rounded || p.eggsPerPack));
    } else {
      setQty("0");
    }
    setReadyBy("00:00");
    setReason("");
    setError("");
    setStep("qty");
  };

  const qtyNum = Number(qty) || 0;
  const eggsPerPack = selected?.eggsPerPack || 1;
  const divisible = qtyNum > 0 && qtyNum % eggsPerPack === 0;
  const packCount = divisible ? qtyNum / eggsPerPack : null;
  const roundedDown = Math.floor(qtyNum / eggsPerPack) * eggsPerPack;
  const roundedUp = Math.ceil(qtyNum / eggsPerPack) * eggsPerPack;
  const aqMatch = selected ? aqForSku(selected.sku) : undefined;
  const aqPrefill = aqMatch && aqMatch.avgEggs > 0 ? Math.round(aqMatch.avgEggs / eggsPerPack) * eggsPerPack : null;
  const overridesAq = aqPrefill != null && qtyNum !== aqPrefill;

  // The 4-number reference panel — real, from allTargets + pqRemainingByItem.
  const itemTargetsToday = selected ? allTargets.filter(t => t.itemId === selected.id) : [];
  const ptTotalToday = itemTargetsToday.reduce((s, t) => s + t.qtyEggs, 0);
  const sentToday = itemTargetsToday.filter(t => t.sentAt).reduce((s, t) => s + t.qtyEggs, 0);
  const ptThisRoundExisting = itemTargetsToday.filter(t => t.round === round).reduce((s, t) => s + t.qtyEggs, 0);
  const pqRemaining = selected ? pqRemainingByItem[selected.id] ?? 0 : 0;
  const remainingAfter = pqRemaining - ptTotalToday - qtyNum;

  const save = async () => {
    if (!selected) return;
    setError("");
    if (!divisible) return setError(`จำนวนต้องหาร ${eggsPerPack} ลงตัว (${eggsPerPack} ฟอง/แพ็ก)`);
    if (qtyNum < 1) return setError("ต้องไม่ต่ำกว่า 1 ฟอง");
    if (overridesAq && !reason.trim()) return setError("กรุณาระบุเหตุผลที่ปรับจาก AQ ทางการ");
    setSaving(true);
    try {
      const r = await fetch("/api/packing/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, round, itemId: selected.id, qtyEggs: qtyNum, readyBy,
          source: aqMatch && aqMatch.avgEggs > 0 ? "aq" : "manual",
          aqSnapshotId: aqMatch && aqMatch.avgEggs > 0 ? aqVersion : null,
          adjustReason: overridesAq ? reason.trim() : null,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">เพิ่ม SKU จาก AQ</h2>
            <div className="text-[12px] text-[#888] mt-0.5">ค้นหาและเลือกทีละ SKU · ไม่แสดง AQ ทั้งหมดจนกว่าจะค้นหา</div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        {step === "pick" ? (
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
              <span className="text-[13px] font-bold text-[#1a1a1a]">เลือก SKU</span>
            </div>
            <div className="ml-7">
              <label className="block text-[11px] text-[#888] mb-1">ค้นหา SKU หรือชื่อสินค้า</label>
              <div className="relative">
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="เช่น 30001 หรือ ไข่ไก่เบอร์ 0"
                  className="w-full h-10 px-3 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#333]">×</button>
                )}
              </div>
              <div className="mt-3 divide-y divide-[#f0f0f0] border-t border-[#f0f0f0]">
                {searching && <div className="py-4 text-center text-[12px] text-[#aaa]">กำลังค้นหา...</div>}
                {!searching && search.trim() && results.length === 0 && (
                  <div className="py-4 text-center text-[12px] text-[#aaa]">ไม่พบสินค้า</div>
                )}
                {results.map(p => {
                  const aq = aqForSku(p.sku);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="text-[13px]">
                          <span className="font-mono font-bold text-[#0C447C]">{p.sku}</span>{" "}
                          <span className="text-[#1a1a1a]">{p.name}</span>
                        </div>
                        <div className="text-[11.5px] text-[#888] mt-0.5">
                          {aq && aq.avgEggs > 0 ? `AQ ${fmtNum(Math.round(aq.avgEggs))} ฟอง/วัน` : "ไม่มี AQ วันนี้ · กำหนดเอง"}
                          {" · "}{fmtNum(p.eggsPerPack)} ฟอง/แพ็ก
                        </div>
                      </div>
                      <button
                        onClick={() => pickProduct(p)}
                        className="shrink-0 px-4 py-2 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
                      >
                        เลือก
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : selected && (
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              <span className="text-[13px] font-bold text-[#1a1a1a]">
                กำหนดจำนวน · <span className="font-mono text-[#0C447C]">{selected.sku}</span> {selected.name}
              </span>
            </div>
            <div className="ml-7 space-y-3">
              {error && (
                <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">{error}</div>
              )}
              <div>
                <div className="text-[11px] text-[#888] mb-1">AQ ทางการ</div>
                <div className="text-[12.5px] text-[#555]">
                  {aqMatch && aqMatch.avgEggs > 0
                    ? `AQ v${aqVersion} · ${fmtNum(Math.round(aqMatch.avgEggs))} ฟอง/วัน`
                    : "ไม่มี AQ ทางการวันนี้ · กำหนดจำนวนเองโดยผู้วางแผน (บันทึกเป็นการปรับพร้อมเหตุผล)"}
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888] mb-1">เป้าที่กำหนดเอง (ฟอง)</label>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-48 h-9 px-3 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
                {qtyNum < 1 && <div className="text-[11px] text-[#991B1B] mt-1">ต้องไม่ต่ำกว่า 1 ฟอง</div>}
                {qtyNum >= 1 && !divisible && (
                  <>
                    <div className="text-[11px] text-[#991B1B] mt-1">จำนวนต้องหาร {eggsPerPack} ลงตัว ({eggsPerPack} ฟอง/แพ็ก)</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {roundedDown > 0 && (
                        <button onClick={() => setQty(String(roundedDown))} className="px-3 py-1 text-[11.5px] font-semibold rounded-lg border border-[#d6d8dc] hover:bg-[#f5f5f5]">
                          ใช้ {fmtNum(roundedDown)} ฟอง
                        </button>
                      )}
                      <button onClick={() => setQty(String(roundedUp))} className="px-3 py-1 text-[11.5px] font-semibold rounded-lg border border-[#d6d8dc] hover:bg-[#f5f5f5]">
                        ใช้ {fmtNum(roundedUp)} ฟอง
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#888]">ฟอง/แพ็ก</span>
                <span className="text-[#1a1a1a] font-semibold">{fmtNum(eggsPerPack)}</span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#888]">จำนวนแพ็ก</span>
                <span className="text-[#1a1a1a] font-semibold">{packCount != null ? fmtNum(packCount) : "—"}</span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#888]">Ready-by</span>
                <select value={readyBy} onChange={e => setReadyBy(e.target.value)} className="h-8 px-2 text-[12.5px] border border-[#d6d8dc] rounded-lg bg-white">
                  {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#888]">AQ version</span>
                <span className="text-[#1a1a1a]">{aqMatch && aqMatch.avgEggs > 0 ? `v${aqVersion}` : "— (ไม่มี AQ · กำหนดเอง)"}</span>
              </div>

              {overridesAq && (
                <div>
                  <label className="block text-[11px] text-[#92400E] mb-1">เหตุผลที่ปรับจาก AQ ทางการ (จำเป็น)</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    placeholder="เช่น ลูกค้าสั่งเพิ่มนอกแผน, ปรับตามสต็อกจริง"
                    className="w-full px-2.5 py-2 text-[12.5px] border border-[#FCD34D] rounded-lg bg-[#FFFBEB] focus:outline-none focus:border-[#92400E]"
                  />
                </div>
              )}

              <div className="border-t border-[#f0f0f0] pt-3">
                <div className="text-[11px] font-bold text-[#888] uppercase tracking-wide mb-1.5">สี่จำนวนหลัก (หน่วย: ฟอง)</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px]">
                  <div className="flex items-center justify-between"><span className="text-[#888]">PT รวมวันนี้</span><span className="font-semibold text-[#1a1a1a]">{ptTotalToday > 0 ? fmtNum(ptTotalToday) : "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#888]">ส่งงานแล้ว</span><span className="font-semibold text-[#1a1a1a]">{fmtNum(sentToday)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#888]">PT รอบนี้</span><span className="font-semibold text-[#1a1a1a]">{ptThisRoundExisting > 0 ? fmtNum(ptThisRoundExisting) : "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[#888]">ยังเหลือหลังรอบนี้</span><span className="font-semibold text-[#1a1a1a]">{pqRemaining > 0 ? fmtNum(Math.max(remainingAfter, 0)) : "—"}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e5e7eb]">
          <button
            onClick={() => (step === "qty" ? setStep("pick") : onClose())}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]"
          >
            {step === "qty" ? "กลับไปเลือก SKU" : "ปิด"}
          </button>
          <div className="flex items-center gap-2">
            {step === "qty" && (
              <>
                <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]">
                  ปิด
                </button>
                <button
                  onClick={save}
                  disabled={saving || !divisible}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "เพิ่มในเป้าแพ็ก"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit an existing (or un-targeted-demand) packing target line ─────────────
// Opened from Section 2's expanded SKU rows (the ✎ on an existing target, or
// "+ ตั้งเป้า" on a demand row with none yet). "ที่มาของเป้า" just pre-fills
// "PT รอบนี้" from a real reference (remaining PQ / AQ / 0-to-skip); the
// actual number saved is always whatever ends up in the PT รอบนี้/เป้าสะสม
// boxes, editable either way since they're the same total two different ways.
function EditPackingTargetModal({
  date,
  round,
  row,
  prevRoundsQty,
  pqUnplanned,
  aqValue,
  onClose,
  onSaved,
}: {
  date: string;
  round: number;
  row: PackingSubRow;
  prevRoundsQty: number; // PT already committed in OTHER rounds today for this item
  pqUnplanned: number; // PQ for this item not yet covered by any round's target
  aqValue: number; // this SKU's official AQ (rounded), 0 if none
  onClose: () => void;
  onSaved: () => void;
}) {
  const eggsPerPack = row.eggsPerPack || 1;
  const roundToPack = (n: number) => Math.round(n / eggsPerPack) * eggsPerPack;
  const initialThisRound = row.qty;

  type Source = "pq" | "aq" | "skip" | "manual";
  const detectSource = (): Source => {
    if (pqUnplanned > 0 && initialThisRound === roundToPack(pqUnplanned)) return "pq";
    if (aqValue > 0 && initialThisRound === roundToPack(aqValue)) return "aq";
    if (initialThisRound === 0) return "skip";
    return "manual";
  };
  const [source, setSource] = useState<Source>(detectSource);
  const [thisRoundValue, setThisRoundValue] = useState(String(initialThisRound));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const thisRoundNum = Number(thisRoundValue) || 0;
  const cumulativeNum = prevRoundsQty + thisRoundNum;
  const dirty = thisRoundNum !== initialThisRound;
  const pct = pqUnplanned > 0 ? Math.round((thisRoundNum / pqUnplanned) * 100) : thisRoundNum > 0 ? 100 : 0;

  const pick = (src: "pq" | "aq" | "skip") => {
    setSource(src);
    const raw = src === "pq" ? pqUnplanned : src === "aq" ? aqValue : 0;
    setThisRoundValue(String(roundToPack(raw)));
  };
  const editThisRound = (v: string) => { setSource("manual"); setThisRoundValue(v); };
  const editCumulative = (v: string) => { setSource("manual"); setThisRoundValue(String((Number(v) || 0) - prevRoundsQty)); };
  const revert = () => { setSource(detectSource()); setThisRoundValue(String(initialThisRound)); };

  const save = async () => {
    setError("");
    if (thisRoundNum < 0) { setError("เป้าสะสมต้องไม่น้อยกว่า PT รอบก่อน"); return; }
    if (thisRoundNum % eggsPerPack !== 0) { setError(`จำนวนต้องหาร ${eggsPerPack} ลงตัว (${eggsPerPack} ฟอง/แพ็ก)`); return; }
    setSaving(true);
    try {
      let r: Response;
      if (thisRoundNum === 0 && row.targetIds.length === 1) {
        r = await fetch(`/api/packing/targets/${row.targetIds[0]}`, { method: "DELETE" });
      } else if (thisRoundNum === 0 && row.targetIds.length === 0) {
        onClose(); // nothing to create, nothing to remove
        return;
      } else if (row.targetIds.length === 1) {
        r = await fetch(`/api/packing/targets/${row.targetIds[0]}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qtyEggs: thisRoundNum }),
        });
      } else {
        r = await fetch("/api/packing/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, round, itemId: row.itemId, qtyEggs: thisRoundNum,
            readyBy: row.readyBy ?? null, source: source === "aq" ? "aq" : "manual", aqSnapshotId: null, adjustReason: null,
          }),
        });
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const SourceRow = ({ src, label, sub, value }: { src: "pq" | "aq" | "skip"; label: string; sub: string; value: number }) => (
    <button
      onClick={() => pick(src)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#f0f0f0] last:border-b-0 ${source === src ? "bg-[#EFF4FF]" : "hover:bg-[#fafbfc]"}`}
    >
      <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${source === src ? "border-[#1E40AF]" : "border-[#ccc]"}`}>
        {source === src && <span className="w-1.5 h-1.5 rounded-full bg-[#1E40AF]" />}
      </span>
      <span className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-[#1a1a1a]">{label}</div>
        <div className="text-[11.5px] text-[#888]">{sub}</div>
      </span>
      <span className="text-[14px] font-bold text-[#1a1a1a] tabular-nums shrink-0">{fmtNum(value)} ฟอง</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-[#1a1a1a]">{row.itemName}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold flex items-center gap-1 ${dirty ? "bg-[#FFFBEB] text-[#92400E]" : "bg-[#F0FDF4] text-green-700"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dirty ? "bg-[#F59E0B]" : "bg-green-600"}`} /> {dirty ? "มีการแก้ไข" : "บันทึกแล้ว"}
              </span>
            </div>
            <div className="text-[12px] text-[#888] mt-0.5">{row.customerName ?? "ไม่ทราบลูกค้า"} · {row.sku} · P-R{round}</div>
          </div>
          <div className="flex items-center gap-3">
            {dirty && <button onClick={revert} className="text-[12px] text-[#1E40AF] hover:underline">คืนค่าเดิม</button>}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center border border-[#d6d8dc] rounded-lg text-[#888] hover:bg-[#f5f5f5]">×</button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 px-6 py-5">
            <div className="text-[12.5px] font-bold text-[#1a1a1a] mb-2">1 · ที่มาของเป้า</div>
            <div className="rounded-xl border border-[#E1E5EA] overflow-hidden mb-5">
              <SourceRow src="pq" label="ตาม PQ" sub="PQ ล่าสุด · ยังไม่ได้วางแผน" value={pqUnplanned} />
              <SourceRow src="aq" label="ตาม AQ" sub={aqValue > 0 ? "AQ ทางการ (เฉลี่ย/วัน)" : "ไม่มี AQ ทางการสำหรับ SKU นี้"} value={aqValue} />
              <SourceRow src="skip" label="ไม่ทำรอบนี้" sub={`ไม่สร้างงานรอบนี้ · เป้าสะสมคงที่ ${fmtNum(prevRoundsQty)} ฟอง`} value={0} />
            </div>

            <div className="text-[12.5px] font-bold text-[#1a1a1a] mb-2">2 · จำนวน</div>
            {error && <div className="mb-2 px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">{error}</div>}
            <div className="rounded-xl border border-[#E1E5EA] bg-[#FAFBFF] p-4">
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-3">
                <div>
                  <div className="text-[11px] text-[#888] mb-1">PT รอบก่อน</div>
                  <div className="text-[20px] font-bold text-[#1a1a1a] tabular-nums">{fmtNum(prevRoundsQty)}</div>
                  <div className="text-[11px] text-[#aaa]">{fmtNum(prevRoundsQty / eggsPerPack)} แพ็ก</div>
                </div>
                <div className="text-[18px] text-[#ccc] pb-2">+</div>
                <div>
                  <div className="text-[11px] text-[#888] mb-1">PT รอบนี้</div>
                  <input
                    type="number"
                    value={thisRoundValue}
                    onChange={e => editThisRound(e.target.value)}
                    className="w-full h-9 px-2 text-[15px] font-bold border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                  />
                  <div className="text-[11px] text-[#aaa] mt-1">{fmtNum(thisRoundNum / eggsPerPack)} แพ็ก</div>
                </div>
                <div className="text-[18px] text-[#ccc] pb-2">=</div>
                <div>
                  <div className="text-[11px] text-[#888] mb-1">เป้าสะสม</div>
                  <input
                    type="number"
                    value={cumulativeNum}
                    onChange={e => editCumulative(e.target.value)}
                    className="w-full h-9 px-2 text-[15px] font-bold border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                  />
                  <div className="text-[11px] text-[#aaa] mt-1">{fmtNum(cumulativeNum / eggsPerPack)} แพ็ก</div>
                </div>
              </div>
              <div className="text-[11px] text-[#aaa] mt-2">ฟอง · แก้ช่องใดก็ได้ · ปัดเป็นแพ็กละ {eggsPerPack} ฟอง</div>
            </div>
          </div>

          <div className="lg:w-72 shrink-0 bg-[#fafbfc] border-t lg:border-t-0 lg:border-l border-[#e5e7eb] px-5 py-5">
            <div className="text-[12.5px] font-bold text-[#1a1a1a] mb-3">สรุปรายการนี้</div>
            <div className="flex items-center justify-between text-[12px] text-[#555] mb-1">
              <span>เทียบ PQ ที่ยังไม่ได้วางแผน {fmtNum(pqUnplanned)} ฟอง</span>
            </div>
            <div className="text-[22px] font-bold text-[#5B4B8A] mb-4">{pct}%</div>

            <div className="flex items-center justify-between text-[13px] text-[#555] py-1">
              <span>PT รอบก่อน</span><span className="tabular-nums">{fmtNum(prevRoundsQty)} ฟอง</span>
            </div>
            <div className="flex items-center justify-between text-[13px] text-[#555] py-1">
              <span>+ PT รอบนี้</span>
              <span className="text-right">
                <div className="tabular-nums">{fmtNum(thisRoundNum)} ฟอง</div>
                <div className="text-[11px] text-[#aaa]">{fmtNum(thisRoundNum / eggsPerPack)} แพ็ก</div>
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-[#e5e7eb] mt-2 pt-2">
              <span className="text-[13px] font-semibold text-[#1a1a1a]">= เป้าสะสม</span>
              <span className="text-right">
                <div className="text-[19px] font-bold text-[#1E40AF] tabular-nums">{fmtNum(cumulativeNum)} ฟอง</div>
                <div className="text-[11px] text-[#aaa]">{fmtNum(cumulativeNum / eggsPerPack)} แพ็ก</div>
              </span>
            </div>

            <div className="text-[12.5px] text-[#555] mt-4">Ready-by {row.readyBy ?? "ยังไม่ตั้ง"}</div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full mt-5 py-2.5 text-[13.5px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bulk "ตั้ง Ready-by" — applies one time to every selected SKU row at
// once. Presets are a personal convenience (localStorage), editable inline
// via "ตั้งค่าเวลาด่วน"; "ตกลง" applies immediately (no separate confirm
// step, unlike the qty stage/apply flow — this one's a single real PATCH
// per selected row with a target, nothing staged in between).
function BulkReadyByModal({
  rows,
  presets,
  onSavePresets,
  onClose,
  onApply,
  applying,
}: {
  rows: PackingSubRow[];
  presets: string[];
  onSavePresets: (presets: string[]) => void;
  onClose: () => void;
  onApply: (time: string) => void;
  applying: boolean;
}) {
  const [pick, setPick] = useState(presets[2] ?? presets[0] ?? "16:00");
  const [customMode, setCustomMode] = useState(false);
  const [editingPresets, setEditingPresets] = useState(false);
  const [presetDraft, setPresetDraft] = useState(presets);

  const applicable = rows.filter(r => r.targetIds.length === 1);
  const skipped = rows.length - applicable.length;
  const overwriteCount = applicable.filter(r => r.readyBy).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb] bg-[#1E3A8A]">
          <h2 className="text-[15px] font-bold text-white">ตั้ง Ready-by · {rows.length} รายการ</h2>
          <button onClick={onClose} className="text-blue-200 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[#555]">เวลา Ready-by</span>
            <button onClick={() => { setEditingPresets(v => !v); setPresetDraft(presets); }} className="text-[11.5px] text-[#1E40AF] hover:underline">
              ตั้งค่าเวลาด่วน
            </button>
          </div>

          {editingPresets ? (
            <div className="mb-3 p-3 rounded-lg border border-[#d6d8dc] bg-[#fafbfc]">
              <div className="grid grid-cols-2 gap-2 mb-2">
                {presetDraft.map((t, i) => (
                  <select
                    key={i}
                    value={t}
                    onChange={e => setPresetDraft(d => d.map((x, j) => (j === i ? e.target.value : x)))}
                    className="h-8 px-1.5 text-[12.5px] border border-[#d6d8dc] rounded bg-white"
                  >
                    {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(t2 => (
                      <option key={t2} value={t2}>{t2}</option>
                    ))}
                  </select>
                ))}
              </div>
              <button
                onClick={() => { onSavePresets(presetDraft); setEditingPresets(false); }}
                className="w-full py-1.5 text-[11.5px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
              >
                บันทึกเวลาด่วน
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {presets.map(t => (
                  <button
                    key={t}
                    onClick={() => { setPick(t); setCustomMode(false); }}
                    className={`py-2.5 rounded-lg border text-[15px] font-bold ${!customMode && pick === t ? "border-[#1E40AF] bg-[#EFF4FF] text-[#1E40AF]" : "border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#fafbfc]"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <button
                  onClick={() => setCustomMode(true)}
                  className={`py-2.5 rounded-lg border text-[13px] font-semibold ${customMode ? "border-[#1E40AF] bg-[#EFF4FF] text-[#1E40AF]" : "border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#fafbfc]"}`}
                >
                  กำหนดเอง
                </button>
                <select
                  value={pick}
                  disabled={!customMode}
                  onChange={e => setPick(e.target.value)}
                  className={`h-full px-2 text-[14px] rounded-lg border ${customMode ? "border-[#1E40AF] text-[#1a1a1a] bg-white" : "border-[#e3e5e8] text-[#bbb] bg-[#fafbfc]"}`}
                >
                  {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="text-[11.5px] text-[#888] mt-3">
            ใช้กับทุกรายการที่เลือก ({applicable.length}) · ทับเวลาเดิม {overwriteCount} รายการ
            {skipped > 0 && <> · ข้าม {skipped} รายการ (ยังไม่มีเป้าแพ็ก)</>}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-[#e5e7eb]">
          <button onClick={onClose} className="text-[13px] text-[#1E40AF] hover:underline">ยกเลิก</button>
          <button
            onClick={() => onApply(pick)}
            disabled={applying || applicable.length === 0}
            className="px-5 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
          >
            {applying ? "กำลังบันทึก..." : `ตกลง · ${pick}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared with DailyOperationsNav — its second tab row (under "Production")
// renders this same list, styled like Orders' Order Planning/AQ Sales
// Reference row, instead of ProductionArea owning its own separate tab bar.
const PRODUCTION_TABS: { key: ProductionSubTab; label: string }[] = [
  { key: "grading", label: "คัดไข่" },
  { key: "packing", label: "แพ็กสินค้า" },
  { key: "bom", label: "ความต้องการวัตถุดิบ/BOM" },
];

function ProductionArea({
  date,
  partners,
  onDateChange,
  activeRoundNum,
  activeRoundClosed,
  dayClosed,
  roundEggTotals,
  rounds,
  onGoOverview,
  sub,
}: {
  date: string;
  partners: PlanPartner[];
  onDateChange: (d: string) => void;
  activeRoundNum: Round;
  activeRoundClosed: boolean;
  // Every O-R round closed, not just the one selected in the round dropdown
  // — what "ปิดวันนี้ได้เมื่อ O-R ปิดวันแล้ว" below actually means and gates on.
  dayClosed: boolean;
  roundEggTotals: Record<number, number>;
  // Same round list O-R uses — Packing's own P-R selector is independent of
  // the active O-R round, but shares the same 1..numRounds range.
  rounds: Round[];
  onGoOverview: () => void;
  // Controlled from DailyOperationsNav's second tab row now (matches how
  // Orders' orderTab works) — ProductionArea no longer owns this state or
  // renders its own tab bar for it.
  sub: ProductionSubTab;
}) {
  // Unified "+ Add job" entry (toolbar between Receiving Lots and the
  // Machine/Hand jobs board, plus the board's own "+ Add machine"/"+ Machine
  // N" quick-adds) — unlike the per-lot "เพิ่มงานคัด" button on a receiving
  // lot row, this doesn't start with a lot already chosen.
  const [addJobDraft, setAddJobDraft] = useState<{ mode: "machine" | "hand"; initialMachine?: string | null } | null>(null);

  // Lifted here (not fetched separately inside GradingReceivingLots and
  // GradingPlanToday) so both stay in sync — they used to each fetch their own
  // copy, so adding a lot in one didn't refresh the other's stale copy, and the
  // yield forecast would silently miss newly-added lots.
  const [lots, setLots] = useState<GradingLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const fetchLots = useCallback(async () => {
    setLotsLoading(true);
    try {
      const r = await fetch("/api/grading/receiving-lots");
      if (r.ok) setLots(await r.json());
    } finally {
      setLotsLoading(false);
    }
  }, []);
  useEffect(() => { fetchLots(); }, [fetchLots]);

  const [jobs, setJobs] = useState<GradingJob[]>([]);
  const fetchJobs = useCallback(async () => {
    const r = await fetch("/api/grading/jobs");
    if (r.ok) setJobs(await r.json());
  }, []);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const [jobResults, setJobResults] = useState<GradingJobResult[]>([]);
  const fetchJobResults = useCallback(async () => {
    const r = await fetch("/api/grading/job-results");
    if (r.ok) setJobResults(await r.json());
  }, []);
  useEffect(() => { fetchJobResults(); }, [fetchJobResults]);

  // Active yield model — fetched here too (GradingPlanToday/MachineJobBoard
  // each fetch their own copy already) just so the command-bar "แผนคละ/คัด"
  // card below can call the same computeGradingFromJobs engine Planning
  // Balance uses, instead of a simpler/wrong stand-in (see note below).
  const [yieldModels, setYieldModels] = useState<YieldModel[]>([]);
  useEffect(() => {
    fetch("/api/grading/yield-models").then(r => (r.ok ? r.json() : [])).then(setYieldModels).catch(() => {});
  }, []);
  const activeModel = yieldModels.find(m => m.active) ?? null;
  const resultByJobId = useMemo(() => {
    const m: Record<number, GradingJobResult> = {};
    for (const r of jobResults) m[r.jobId] = r;
    return m;
  }, [jobResults]);
  const { fromJobsBySize, sourcesBySize } = useMemo(
    () => computeGradingFromJobs(activeModel, lots, jobs, resultByJobId, date),
    [activeModel, lots, jobs, resultByJobId, date],
  );

  // Opening (carried-over) sized-egg stock for the grading date — same
  // /api/grading/opening-stock data GradingPlanToday uses, fetched here too
  // just for the "สต็อกไข่เบอร์" command-bar card below.
  const [openingStock, setOpeningStock] = useState<{ size: string; qty: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/grading/opening-stock?date=${date}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: { size: string; qty: number }[]) => { if (!cancelled) setOpeningStock(rows); });
    return () => { cancelled = true; };
  }, [date]);
  const openingStockTotal = openingStock.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  // "เศษ/ตำหนิ พร้อมขาย" visibility card — both figures are real, running
  // balances across all history (not scoped to this grading date): defect
  // eggs from confirmed job-result defect counts, WIP eggs from confirmed
  // job-result fgLines graded directly into a WIP SKU (see
  // /api/grading/wip-stock) — each minus real order quantity sold. The
  // generic grading_opening_stock figure Packing reads stays untouched by
  // either (kept independent, per decision). See
  // /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
  type DefectStockCategory = { id: string; label: string; sku: string; itemName: string | null; totalProduced: number; totalSold: number; available: number };
  const [defectStock, setDefectStock] = useState<{ categories: DefectStockCategory[]; total: { totalProduced: number; totalSold: number; available: number } } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/grading/defect-stock")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setDefectStock(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  type WipStockItem = { itemId: number; sku: string; name: string; packagingProfile: unknown; totalProduced: number; totalSold: number; available: number };
  type TrayMaterialUsage = { componentSku: string; componentName: string; totalUsed: number };
  const [wipStock, setWipStock] = useState<WipStockItem[] | null>(null);
  const [trayMaterialUsage, setTrayMaterialUsage] = useState<TrayMaterialUsage[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/grading/wip-stock")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        setWipStock(d?.items ?? null);
        setTrayMaterialUsage(d?.trayMaterialUsage ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // Same classification as OrderFormPage's trayOfItem — "ถาดพิเศษ" when the
  // item's real packaging_profile has an enabled cover/plastic component.
  const wipTrayKind = (it: WipStockItem): "normal" | "special" => {
    const profile = (it.packagingProfile && typeof it.packagingProfile === "object" ? it.packagingProfile : {}) as Record<string, { enabled?: boolean; item_type?: string; component_sku?: string }>;
    return Object.values(profile).some(c => c?.enabled !== false && c?.component_sku && /plastic|cover|lid/i.test(c.item_type ?? "")) ? "special" : "normal";
  };

  // Packing command bar's "PQ" cell — real, same partners prop Orders itself
  // reads (every confirmed order for the date, any round), not scoped to a
  // packing round since no packing round exists yet.
  const packingPqTotal = partners.reduce(
    (s, p) =>
      s +
      p.orders
        .filter(o => o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")
        .reduce((os, o) => os + o.lines.filter(isFgLine).reduce((ls, l) => ls + (l.planningQty ?? l.orderQty) * l.eggsPerPack, 0), 0),
    0,
  );

  // ── Packing round lifecycle + targets (real — see migrations/0037_packing_targets.sql
  // and server/routes/packing.ts) — P-R is its own round selector, independent
  // of the O-R one above, sharing the same 1..numRounds range. ────────────────
  const [packingRound, setPackingRound] = useState<Round>(1 as Round);
  const [packingRoundStates, setPackingRoundStates] = useState<
    Record<number, { round: number; targetConfirmedAt: string | null; materialPlanConfirmedAt: string | null; workOrderSentAt: string | null; closedAt: string | null }>
  >({});
  const fetchPackingRoundStates = useCallback(async () => {
    const r = await fetch(`/api/packing/round-states?date=${date}`);
    if (r.ok) setPackingRoundStates(await r.json());
  }, [date]);
  useEffect(() => { fetchPackingRoundStates(); }, [fetchPackingRoundStates]);

  const [packingTargets, setPackingTargets] = useState<PackingTarget[]>([]);
  const fetchPackingTargets = useCallback(async () => {
    const r = await fetch(`/api/packing/targets?date=${date}`);
    if (r.ok) setPackingTargets(await r.json());
  }, [date]);
  useEffect(() => { fetchPackingTargets(); }, [fetchPackingTargets]);

  // "②แผนวัตถุดิบ" — real BOM-completeness check for this round's targets
  // (not a material-supply check — no inventory data exists to compute
  // that honestly). Drives whether step ②'s confirm button is actually
  // clickable. See GET /api/packing/material-plan and
  // /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
  const [materialPlan, setMaterialPlan] = useState<{
    lines: { targetId: number; itemId: number; sku: string; itemName: string; status: "ready" | "needs_setup"; issues: string[] }[];
    materials: { componentSku: string; componentName: string | null; itemType: string | null; totalQtyNeeded: number; status: "ready" | "needs_setup"; usedByTargetLines: { sku: string; name: string; qtyNeeded: number }[] }[];
    blocking: boolean;
  } | null>(null);
  const fetchMaterialPlan = useCallback(async () => {
    const r = await fetch(`/api/packing/material-plan?date=${date}&round=${packingRound}`);
    if (r.ok) setMaterialPlan(await r.json());
  }, [date, packingRound]);
  // Re-check whenever this round's targets change too (add/edit a target,
  // or its item's BOM gets fixed elsewhere) — not just on date/round change.
  useEffect(() => { fetchMaterialPlan(); }, [fetchMaterialPlan, packingTargets]);

  // Section 3 "บันทึกผลแพ็กจริง" — real actual-vs-plan. Only populated once
  // the round's work order is sent (packing_targets.sent_at set server-side
  // — see GET /api/packing/target-results); empty before that, matching the
  // same gate the top workflow buttons already enforce. See
  // /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
  const [packingResults, setPackingResults] = useState<PackingTargetResult[]>([]);
  const fetchPackingResults = useCallback(async () => {
    const r = await fetch(`/api/packing/target-results?date=${date}&round=${packingRound}`);
    if (r.ok) setPackingResults(await r.json());
  }, [date, packingRound]);
  useEffect(() => { fetchPackingResults(); }, [fetchPackingResults]);

  const [resultInputs, setResultInputs] = useState<Record<number, string>>({});
  const [savingPackingResult, setSavingPackingResult] = useState<number | null>(null);
  const savePackingResult = async (targetId: number, actualQtyEggs: number, status: "draft" | "confirmed") => {
    setSavingPackingResult(targetId);
    try {
      const r = await fetch(`/api/packing/target-results/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualQtyEggs, status }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      await fetchPackingResults();
    } finally {
      setSavingPackingResult(null);
    }
  };
  const [confirmingAllResults, setConfirmingAllResults] = useState(false);
  const confirmAllPackingResults = async () => {
    const toConfirm = packingResults.filter(r => r.actualQtyEggs != null && r.status !== "confirmed");
    if (toConfirm.length === 0) return;
    setConfirmingAllResults(true);
    try {
      await Promise.all(toConfirm.map(r => savePackingResult(r.targetId, r.actualQtyEggs!, "confirmed")));
    } finally {
      setConfirmingAllResults(false);
    }
  };

  const packingRoundTotal = (r: number) => packingTargets.filter(t => t.round === r).reduce((s, t) => s + t.qtyEggs, 0);
  const packingState = packingRoundStates[packingRound];
  // Only rounds whose target step is actually confirmed count toward Accum —
  // an untouched/draft round hasn't committed anything yet.
  const packingAccumPT = rounds
    .filter(r => r !== packingRound && packingRoundStates[r]?.targetConfirmedAt)
    .reduce((s, r) => s + packingRoundTotal(r), 0);
  const packingThisRoundTotal = packingRoundTotal(packingRound);
  // No adjustment/defer mechanism for packing targets yet (see plan) — PT
  // เริ่มต้น and PT สุดท้าย are the same real number until one exists.
  const packingFinalTotal = packingAccumPT + packingThisRoundTotal;
  const packingSentCount = packingTargets.filter(t => t.round === packingRound && t.sentAt).length;
  const packingStepLocked = (step: "materialPlan" | "workOrder") =>
    step === "materialPlan" ? !packingState?.targetConfirmedAt : !packingState?.materialPlanConfirmedAt;
  // Real gate (not just a timestamp toggle) — can't confirm แผนวัตถุดิบ while
  // any target line in this round has an unresolved BOM. See
  // GET /api/packing/material-plan and
  // /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
  const materialPlanBlocked = !packingState?.materialPlanConfirmedAt && !!materialPlan?.blocking;
  const [packingToggling, setPackingToggling] = useState(false);
  const togglePackingStep = async (step: "target" | "materialPlan" | "workOrder", value: boolean) => {
    setPackingToggling(true);
    try {
      const r = await fetch("/api/packing/round-states", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, round: packingRound, step, value }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.message || "ทำรายการไม่สำเร็จ");
        return;
      }
      await fetchPackingRoundStates();
      if (step === "workOrder" && value) await fetchPackingTargets();
    } finally {
      setPackingToggling(false);
    }
  };

  // Section 1 "สรุปงานแพ็ก" — per ordering-customer, for P-R{packingRound}:
  // PQ demand (real, same confirmed-order lines Orders itself reads) next to
  // PT committed so far (real, packing_targets summed over items that
  // customer actually ordered this round — matched by itemId, since a
  // packing target has no customer field of its own, just an item).
  const packingCustomerSummary = useMemo(() => {
    const rows: { partnerName: string; siteNames: string; orderCount: number; pqEggs: number; ptEggs: number }[] = [];
    for (const p of partners) {
      const roundOrders = p.orders.filter(
        o => o.productionRound === packingRound && (o.status === "confirmed" || o.status === "in_production" || o.status === "delivered"),
      );
      if (roundOrders.length === 0) continue;
      const itemIds = new Set<number>();
      let pqEggs = 0;
      for (const o of roundOrders) {
        for (const l of o.lines.filter(isFgLine)) {
          pqEggs += (l.planningQty ?? l.orderQty) * l.eggsPerPack;
          itemIds.add(l.itemId);
        }
      }
      const ptEggs = packingTargets
        .filter(t => t.round === packingRound && itemIds.has(t.itemId))
        .reduce((s, t) => s + t.qtyEggs, 0);
      const siteNames = Array.from(new Set(roundOrders.map(o => o.deliverySiteName))).join(" · ");
      rows.push({ partnerName: p.partnerName, siteNames, orderCount: roundOrders.length, pqEggs, ptEggs });
    }
    return rows.sort((a, b) => b.pqEggs - a.pqEggs);
  }, [partners, packingRound, packingTargets]);

  // Section 2 "การวางแผนและส่งงาน" — demand/supply by egg size, P-R{packingRound}.
  // "AQ ทั้งวัน" reuses the live /api/orders/aq-reference endpoint with the
  // same shared config (AQ_CONFIG_KEY) Orders' AQ tab reads/writes — no
  // second AQ system. ─────────────────────────────────────────────────────────
  const [packingAqData, setPackingAqData] = useState<AqData | null>(null);
  useEffect(() => {
    let cancelled = false;
    let cfg: AqConfig = DEFAULT_AQ_CONFIG;
    try { cfg = { ...DEFAULT_AQ_CONFIG, ...(JSON.parse(localStorage.getItem(AQ_CONFIG_KEY) ?? "{}") ?? {}) }; } catch { /* use default */ }
    fetch(`/api/orders/aq-reference?${aqQuery(date, cfg)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: AqData | null) => { if (!cancelled) setPackingAqData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date]);
  const packingAqBySize = packingAqData && !packingAqData.insufficient ? packingAqData.avgPerDaySize : {};

  // PQ by item, whole day (every round) — the per-item "ยังเหลือ" reference
  // the add-SKU modal's 4-number panel reads.
  const pqByItemToday = useMemo(() => {
    const m: Record<number, number> = {};
    for (const p of partners) {
      for (const o of p.orders) {
        if (!(o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")) continue;
        for (const l of o.lines.filter(isFgLine)) m[l.itemId] = (m[l.itemId] ?? 0) + (l.planningQty ?? l.orderQty) * l.eggsPerPack;
      }
    }
    return m;
  }, [partners]);

  // Same PQ, split by egg size instead of item — for the demand/supply table.
  const pqBySizeToday = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of partners) {
      for (const o of p.orders) {
        if (!(o.status === "confirmed" || o.status === "in_production" || o.status === "delivered")) continue;
        for (const l of o.lines.filter(isFgLine)) {
          const size = l.primarySize || "mixed";
          m[size] = (m[size] ?? 0) + (l.planningQty ?? l.orderQty) * l.eggsPerPack;
        }
      }
    }
    return m;
  }, [partners]);

  // PT by size — whole day/every round (the "หักใช้ไป" reservation against
  // supply, and what's already spoken-for out of PQ) vs this round only
  // (เป้าเพิ่มรอบนี้ / ready-by).
  const ptBySizeAllRounds = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of packingTargets) { const size = t.primarySize || "mixed"; m[size] = (m[size] ?? 0) + t.qtyEggs; }
    return m;
  }, [packingTargets]);
  const ptBySizeThisRound = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of packingTargets.filter(x => x.round === packingRound)) { const size = t.primarySize || "mixed"; m[size] = (m[size] ?? 0) + t.qtyEggs; }
    return m;
  }, [packingTargets, packingRound]);
  const readyBySizeThisRound = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of packingTargets.filter(x => x.round === packingRound && x.readyBy)) {
      const size = t.primarySize || "mixed";
      if (!m[size] || t.readyBy! < m[size]) m[size] = t.readyBy!;
    }
    return m;
  }, [packingTargets, packingRound]);

  // ซัพพลาย: reuses Grading's own real engine — opening stock + this date's
  // actual/forecast graded output (fromJobsBySize/openingStock, already
  // fetched above for the Grading command-bar cards), by size.
  const openingStockBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of openingStock) m[r.size] = (m[r.size] ?? 0) + (Number(r.qty) || 0);
    return m;
  }, [openingStock]);
  const supplyBySize = useMemo(() => {
    const m: Record<string, number> = { ...openingStockBySize };
    for (const [k, v] of Object.entries(fromJobsBySize)) m[k] = (m[k] ?? 0) + v;
    return m;
  }, [openingStockBySize, fromJobsBySize]);

  const packingSizeRows = useMemo(() => {
    const sizeSet = new Set<string>([
      ...Object.keys(packingAqBySize), ...Object.keys(pqBySizeToday),
      ...Object.keys(supplyBySize), ...Object.keys(ptBySizeAllRounds),
    ]);
    const order = [...EGG_SIZES, "mixed"];
    const sizes = Array.from(sizeSet).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return sizes
      .map(size => {
        const ptAllRounds = ptBySizeAllRounds[size] ?? 0;
        const supply = supplyBySize[size] ?? 0;
        return {
          size,
          aq: packingAqBySize[size] ?? 0,
          pqRemaining: (pqBySizeToday[size] ?? 0) - ptAllRounds,
          ptThisRound: ptBySizeThisRound[size] ?? 0,
          supply,
          supplyRemaining: supply - ptAllRounds,
          readyBy: readyBySizeThisRound[size] ?? null,
        };
      })
      .filter(r => r.aq > 0 || r.pqRemaining !== 0 || r.ptThisRound > 0 || r.supply > 0);
  }, [packingAqBySize, pqBySizeToday, supplyBySize, ptBySizeAllRounds, ptBySizeThisRound, readyBySizeThisRound]);

  // ── Search + "มุมมอง" (view) controls for the table above — personal
  // display preferences only (persisted to localStorage, like aqConfig),
  // never touching the underlying plan data. ───────────────────────────────────
  type PackingGroupBy = "size" | "packSize" | "readyBy";
  type PackingUnit = "eggs" | "packs";
  const PACKING_VIEW_KEY = "dailyplan.packingView";
  const [packingSearch, setPackingSearch] = useState("");
  const [packingCumulative, setPackingCumulative] = useState(false); // false = "รอบนี้", true = "สะสม"
  const [packingViewOpen, setPackingViewOpen] = useState(false);
  const [packingGroupBy, setPackingGroupByState] = useState<PackingGroupBy>(() => {
    try { return JSON.parse(localStorage.getItem(PACKING_VIEW_KEY) ?? "{}")?.groupBy ?? "size"; } catch { return "size"; }
  });
  const [packingUnit, setPackingUnitState] = useState<PackingUnit>(() => {
    try { return JSON.parse(localStorage.getItem(PACKING_VIEW_KEY) ?? "{}")?.unit ?? "eggs"; } catch { return "eggs"; }
  });
  const savePackingView = (groupBy: PackingGroupBy, unit: PackingUnit) => {
    try { localStorage.setItem(PACKING_VIEW_KEY, JSON.stringify({ groupBy, unit })); } catch { /* per-viewer convenience only */ }
  };
  const setPackingGroupBy = (g: PackingGroupBy) => { setPackingGroupByState(g); savePackingView(g, packingUnit); };
  const setPackingUnit = (u: PackingUnit) => { setPackingUnitState(u); savePackingView(packingGroupBy, u); };
  const PACKING_GROUP_LABEL: Record<PackingGroupBy, string> = { size: "เบอร์ไข่", packSize: "ขนาดแพ็ก", readyBy: "Ready-by" };
  const PACKING_UNIT_LABEL: Record<PackingUnit, string> = { eggs: "ฟอง", packs: "แพ็ก" };

  // Targets in the scope the "รอบนี้ / สะสม" toggle selects — a live working
  // total across every round entered so far today, distinct from the command
  // bar's "Accum PT" KPI above (which only counts rounds whose target step
  // was actually confirmed).
  const packingTargetsInScope = useMemo(
    () => (packingCumulative ? packingTargets : packingTargets.filter(t => t.round === packingRound)),
    [packingTargets, packingCumulative, packingRound],
  );

  const packingSearchQ = packingSearch.trim().toLowerCase();
  const matchesPackingSearch = (label: string, skus?: Set<string>, names?: Set<string>, customers?: Set<string>) => {
    if (!packingSearchQ) return true;
    if (label.toLowerCase().includes(packingSearchQ)) return true;
    if (Array.from(skus ?? []).some(s => s.toLowerCase().includes(packingSearchQ))) return true;
    if (Array.from(names ?? []).some(n => n.toLowerCase().includes(packingSearchQ))) return true;
    if (Array.from(customers ?? []).some(c => c.toLowerCase().includes(packingSearchQ))) return true;
    return false;
  };

  // Search corpus for the "เบอร์ไข่" grouping — which SKUs/customers fall
  // under each size, so searching "BigC" or a SKU surfaces the right size
  // row even though the row itself is an aggregate, not a SKU line.
  const skuInfoBySize = useMemo(() => {
    const m: Record<string, { skus: Set<string>; names: Set<string> }> = {};
    for (const t of packingTargets) {
      const size = t.primarySize || "mixed";
      if (!m[size]) m[size] = { skus: new Set(), names: new Set() };
      m[size].skus.add(t.sku);
      m[size].names.add(t.itemName);
    }
    return m;
  }, [packingTargets]);
  const customersBySizeThisRound = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const p of partners) {
      const roundOrders = p.orders.filter(o => o.productionRound === packingRound && (o.status === "confirmed" || o.status === "in_production" || o.status === "delivered"));
      for (const o of roundOrders) {
        for (const l of o.lines.filter(isFgLine)) {
          const size = l.primarySize || "mixed";
          if (!m[size]) m[size] = new Set();
          m[size].add(p.partnerName);
        }
      }
    }
    return m;
  }, [partners, packingRound]);
  const eggsPerPackBySize = useMemo(() => {
    const m: Record<string, Set<number>> = {};
    for (const t of packingTargetsInScope) {
      const size = t.primarySize || "mixed";
      if (!m[size]) m[size] = new Set();
      m[size].add(t.eggsPerPack);
    }
    return m;
  }, [packingTargetsInScope]);

  // Filtered + search-matched size rows actually rendered (reuses
  // packingSizeRows' real numbers; search only narrows which rows show).
  const packingSizeRowsFiltered = useMemo(
    () =>
      packingSizeRows
        .map(r => {
          const uniformEpp = eggsPerPackBySize[r.size]?.size === 1 ? Array.from(eggsPerPackBySize[r.size])[0] : null;
          return { ...r, uniformEpp };
        })
        .filter(r => matchesPackingSearch(r.size, skuInfoBySize[r.size]?.skus, skuInfoBySize[r.size]?.names, customersBySizeThisRound[r.size])),
    [packingSizeRows, eggsPerPackBySize, skuInfoBySize, customersBySizeThisRound, packingSearchQ],
  );

  // ── Row expansion: "เบอร์ X" → per (customer × FG SKU) lines ────────────────
  // AQ per SKU reuses the same aq-reference payload's skus[] breakdown (not a
  // second fetch); PQ คงเหลือ per item reuses pqByItemToday minus that item's
  // total PT across every round (not just this one — PT already committed in
  // another round still counts against PQ). Customer: items.partner_id when
  // the SKU is private-label, else whichever partner(s) ordered that item
  // this round (same resolution packingCustomerSummary uses).
  const [expandedSizes, setExpandedSizes] = useState<Set<string>>(new Set());
  const toggleSizeExpanded = (size: string) =>
    setExpandedSizes(prev => { const n = new Set(prev); n.has(size) ? n.delete(size) : n.add(size); return n; });

  const aqBySku = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of packingAqData?.skus ?? []) m[s.sku] = (m[s.sku] ?? 0) + s.avgEggs;
    return m;
  }, [packingAqData]);
  const ptAllRoundsByItem = useMemo(() => {
    const m: Record<number, number> = {};
    for (const t of packingTargets) m[t.itemId] = (m[t.itemId] ?? 0) + t.qtyEggs;
    return m;
  }, [packingTargets]);
  const customersByItemThisRound = useMemo(() => {
    const m: Record<number, Set<string>> = {};
    for (const p of partners) {
      const roundOrders = p.orders.filter(o => o.productionRound === packingRound && (o.status === "confirmed" || o.status === "in_production" || o.status === "delivered"));
      for (const o of roundOrders) {
        for (const l of o.lines.filter(isFgLine)) {
          if (!m[l.itemId]) m[l.itemId] = new Set();
          m[l.itemId].add(p.partnerName);
        }
      }
    }
    return m;
  }, [partners, packingRound]);

  const packingSubRowsBySize = useMemo(() => {
    const grouped: Record<string, Record<number, { ids: number[]; sku: string; itemName: string; eggsPerPack: number; qty: number; readyBy: string | null; partnerName: string | null }>> = {};
    for (const t of packingTargetsInScope) {
      const size = t.primarySize || "mixed";
      if (!grouped[size]) grouped[size] = {};
      if (!grouped[size][t.itemId]) {
        grouped[size][t.itemId] = { ids: [], sku: t.sku, itemName: t.itemName, eggsPerPack: t.eggsPerPack, qty: 0, readyBy: null, partnerName: t.partnerName };
      }
      const g = grouped[size][t.itemId];
      g.ids.push(t.id);
      g.qty += t.qtyEggs;
      if (t.readyBy && (!g.readyBy || t.readyBy < g.readyBy)) g.readyBy = t.readyBy;
    }
    const bySize: Record<string, PackingSubRow[]> = {};
    for (const [size, items] of Object.entries(grouped)) {
      bySize[size] = Object.entries(items)
        .map(([itemId, g]) => {
          const id = Number(itemId);
          const customerName = g.partnerName ?? (customersByItemThisRound[id] ? Array.from(customersByItemThisRound[id]).join(" / ") : null);
          return {
            itemId: id,
            targetIds: g.ids,
            sku: g.sku,
            itemName: g.itemName,
            eggsPerPack: g.eggsPerPack,
            qty: g.qty,
            readyBy: g.readyBy,
            customerName,
            aq: aqBySku[g.sku] ?? 0,
            pqRemaining: (pqByItemToday[id] ?? 0) - (ptAllRoundsByItem[id] ?? 0),
          };
        })
        .sort((a, b) => b.qty - a.qty);
    }
    return bySize;
  }, [packingTargetsInScope, customersByItemThisRound, aqBySku, pqByItemToday, ptAllRoundsByItem]);
  const needsFixCountBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [size, rows] of Object.entries(packingSubRowsBySize)) m[size] = rows.filter(r => !r.readyBy).length;
    return m;
  }, [packingSubRowsBySize]);

  // "รวมทั้งวัน" footer row — real aggregates across every size shown.
  // Supply isn't summed (different sizes' eggs aren't interchangeable for
  // packing) — "หลายเบอร์" names that honestly instead of a misleading total.
  // Ready-by: the earliest time any existing target still needs, the qty due
  // by then, and how many distinct times are in play today.
  const totalNeedsFix = useMemo(() => Object.values(needsFixCountBySize).reduce((s, n) => s + n, 0), [needsFixCountBySize]);
  const allSubRowsFlat = useMemo(() => Object.values(packingSubRowsBySize).flat(), [packingSubRowsBySize]);
  const readyByTotals = useMemo(() => {
    const times = Array.from(new Set(allSubRowsFlat.filter(r => r.readyBy).map(r => r.readyBy!))).sort();
    const nearest = times[0] ?? null;
    const qtyAtNearest = nearest ? allSubRowsFlat.filter(r => r.readyBy === nearest).reduce((s, r) => s + r.qty, 0) : 0;
    return { nearest, latest: times[times.length - 1] ?? null, pointCount: times.length, qtyAtNearest };
  }, [allSubRowsFlat]);
  const aqIncomplete = useMemo(
    () =>
      packingSizeRowsFiltered.some(r => {
        const ptDisplay = packingCumulative ? ptBySizeAllRounds[r.size] ?? 0 : r.ptThisRound;
        return r.aq === 0 && (r.pqRemaining !== 0 || ptDisplay > 0);
      }),
    [packingSizeRowsFiltered, packingCumulative, ptBySizeAllRounds],
  );
  const totalPqRemaining = useMemo(() => packingSizeRowsFiltered.reduce((s, r) => s + r.pqRemaining, 0), [packingSizeRowsFiltered]);
  const totalPtDisplay = useMemo(
    () => packingSizeRowsFiltered.reduce((s, r) => s + (packingCumulative ? ptBySizeAllRounds[r.size] ?? 0 : r.ptThisRound), 0),
    [packingSizeRowsFiltered, packingCumulative, ptBySizeAllRounds],
  );
  const [totalsExpanded, setTotalsExpanded] = useState(false);
  const toggleAllExpanded = () => {
    setTotalsExpanded(v => !v);
    setExpandedSizes(totalsExpanded ? new Set() : new Set(packingSizeRowsFiltered.map(r => r.size)));
  };
  const packingTableRef = useRef<HTMLDivElement>(null);

  // Merge in demand (real PQ, from this round's confirmed order lines) for
  // items that have no packing_targets row yet — otherwise a size with
  // plenty of PQ but zero PT so far would wrongly look like there's nothing
  // to expand/plan. qty: 0 / targetIds: [] marks an un-targeted demand row
  // (rendered as "+ ตั้งเป้า" instead of an editable number).
  const packingDemandRowsBySize = useMemo(() => {
    const demandByItem: Record<string, Record<number, { sku: string; itemName: string; eggsPerPack: number; customers: Set<string> }>> = {};
    for (const p of partners) {
      const roundOrders = p.orders.filter(o => o.productionRound === packingRound && (o.status === "confirmed" || o.status === "in_production" || o.status === "delivered"));
      for (const o of roundOrders) {
        for (const l of o.lines.filter(isFgLine)) {
          const size = l.primarySize || "mixed";
          if (!demandByItem[size]) demandByItem[size] = {};
          if (!demandByItem[size][l.itemId]) demandByItem[size][l.itemId] = { sku: l.sku, itemName: l.itemName, eggsPerPack: l.eggsPerPack, customers: new Set() };
          demandByItem[size][l.itemId].customers.add(p.partnerName);
        }
      }
    }
    const bySize: Record<string, PackingSubRow[]> = {};
    const sizes = Array.from(new Set([...Object.keys(demandByItem), ...Object.keys(packingSubRowsBySize)]));
    for (const size of sizes) {
      const existing = packingSubRowsBySize[size] ?? [];
      const existingItemIds = new Set(existing.map(r => r.itemId));
      const rows: PackingSubRow[] = [...existing];
      for (const [itemIdStr, d] of Object.entries(demandByItem[size] ?? {})) {
        const itemId = Number(itemIdStr);
        if (existingItemIds.has(itemId)) continue; // already shown via its target row
        const pqRemaining = (pqByItemToday[itemId] ?? 0) - (ptAllRoundsByItem[itemId] ?? 0);
        if (pqRemaining <= 0) continue; // fully targeted already — nothing left to prompt for
        rows.push({
          itemId, targetIds: [], sku: d.sku, itemName: d.itemName, eggsPerPack: d.eggsPerPack,
          qty: 0, readyBy: null, customerName: Array.from(d.customers).join(" / ") || null,
          aq: aqBySku[d.sku] ?? 0, pqRemaining,
        });
      }
      bySize[size] = rows.sort((a, b) => b.pqRemaining - a.pqRemaining || b.qty - a.qty);
    }
    return bySize;
  }, [packingSubRowsBySize, partners, packingRound, pqByItemToday, ptAllRoundsByItem, aqBySku]);

  // Ready-by stays a quick inline edit (unchanged). PT qty now opens the
  // fuller EditPackingTargetModal below instead of an inline number box —
  // same POST-when-untargeted/PATCH-when-existing split as before, just
  // inside the modal's own save handler.
  const [editingReadyByItemId, setEditingReadyByItemId] = useState<number | null>(null);
  const [editReadyByValue, setEditReadyByValue] = useState("00:00");
  const [savingTargetEdit, setSavingTargetEdit] = useState(false);
  const [editTargetRow, setEditTargetRow] = useState<PackingSubRow | null>(null);

  const saveTargetReadyBy = async (row: PackingSubRow) => {
    setSavingTargetEdit(true);
    try {
      const r = await fetch(`/api/packing/targets/${row.targetIds[0]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readyBy: editReadyByValue }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      await fetchPackingTargets();
      setEditingReadyByItemId(null);
    } finally {
      setSavingTargetEdit(false);
    }
  };

  // ── Bulk select (checkboxes on expanded SKU rows) — a two-step stage →
  // "ผ่านที่เลือก" apply, so a misclick on a quick-fill button never silently
  // writes to the server; it only previews a value until confirmed. Each
  // quick action is a real, derivable number (sr.aq/sr.pqRemaining, both
  // already computed above), never a fabricated one. Ready-by is its own
  // separate one-shot modal (pick a time → ตกลง applies immediately), not
  // part of this stage/apply cycle. ──────────────────────────────────────────
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [stagedQtyByItem, setStagedQtyByItem] = useState<Record<number, number>>({});
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkReadyByRows, setBulkReadyByRows] = useState<PackingSubRow[] | null>(null);

  const toggleSelectItem = (itemId: number) =>
    setSelectedItemIds(prev => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  const clearBulkSelection = () => {
    setSelectedItemIds(new Set());
    setStagedQtyByItem({});
  };

  const stageBulkQty = (rows: PackingSubRow[], valueFor: (sr: PackingSubRow) => number) => {
    setStagedQtyByItem(prev => {
      const next = { ...prev };
      for (const sr of rows) {
        if (!selectedItemIds.has(sr.itemId)) continue;
        const epp = sr.eggsPerPack || 1;
        next[sr.itemId] = Math.max(0, Math.round(valueFor(sr) / epp) * epp);
      }
      return next;
    });
  };

  const applyBulk = async (rows: PackingSubRow[]) => {
    setBulkApplying(true);
    try {
      const selected = rows.filter(sr => selectedItemIds.has(sr.itemId));
      await Promise.all(
        selected.map(async sr => {
          const qty = stagedQtyByItem[sr.itemId];
          if (qty == null) return;
          if (qty === 0 && sr.targetIds.length === 1) {
            await fetch(`/api/packing/targets/${sr.targetIds[0]}`, { method: "DELETE" });
          } else if (qty === 0) {
            return; // untargeted and staged to 0 — nothing to create
          } else if (sr.targetIds.length === 1) {
            await fetch(`/api/packing/targets/${sr.targetIds[0]}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ qtyEggs: qty }),
            });
          } else if (sr.targetIds.length === 0) {
            await fetch("/api/packing/targets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, round: packingRound, itemId: sr.itemId, qtyEggs: qty, source: "manual" }),
            });
          }
        }),
      );
      await fetchPackingTargets();
      clearBulkSelection();
    } finally {
      setBulkApplying(false);
    }
  };

  // Quick-time presets for the "ตั้ง Ready-by" modal — a personal convenience
  // (localStorage), editable via "ตั้งค่าเวลาด่วน" in the modal itself.
  const READY_BY_PRESETS_KEY = "dailyplan.packingReadyByPresets";
  const [readyByPresets, setReadyByPresets] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(READY_BY_PRESETS_KEY) ?? "null");
      if (Array.isArray(saved) && saved.length === 4) return saved;
    } catch { /* use default */ }
    return ["11:00", "14:00", "16:00", "18:00"];
  });
  const saveReadyByPresets = (presets: string[]) => {
    setReadyByPresets(presets);
    try { localStorage.setItem(READY_BY_PRESETS_KEY, JSON.stringify(presets)); } catch { /* per-viewer convenience only */ }
  };

  const applyBulkReadyBy = async (rows: PackingSubRow[], time: string) => {
    setBulkApplying(true);
    try {
      await Promise.all(
        rows
          .filter(sr => sr.targetIds.length === 1) // untargeted/multi rows: nothing to attach a ready-by to
          .map(sr =>
            fetch(`/api/packing/targets/${sr.targetIds[0]}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ readyBy: time }),
            }),
          ),
      );
      await fetchPackingTargets();
      setBulkReadyByRows(null);
      clearBulkSelection();
    } finally {
      setBulkApplying(false);
    }
  };

  // "ขนาดแพ็ก" grouping — pack count is exact here (the group key IS the
  // pack size), unlike the "เบอร์ไข่" view where a size mixes pack sizes.
  // No AQ/PQ/supply columns — those are tracked by egg size, not pack size.
  const packingRowsByPackSize = useMemo(() => {
    const m: Record<number, { eggs: number; skus: Set<string>; names: Set<string>; readyBys: string[] }> = {};
    for (const t of packingTargetsInScope) {
      if (!m[t.eggsPerPack]) m[t.eggsPerPack] = { eggs: 0, skus: new Set(), names: new Set(), readyBys: [] };
      m[t.eggsPerPack].eggs += t.qtyEggs;
      m[t.eggsPerPack].skus.add(t.sku);
      m[t.eggsPerPack].names.add(t.itemName);
      if (t.readyBy) m[t.eggsPerPack].readyBys.push(t.readyBy);
    }
    return Object.entries(m)
      .map(([epp, v]) => ({
        key: `${epp} ฟอง/แพ็ก`,
        eggsPerPack: Number(epp),
        eggs: v.eggs,
        packs: v.eggs / Number(epp),
        skuCount: v.skus.size,
        readyBy: v.readyBys.length ? v.readyBys.sort()[0] : null,
        skus: v.skus,
        names: v.names,
      }))
      .filter(r => matchesPackingSearch(r.key, r.skus, r.names))
      .sort((a, b) => a.eggsPerPack - b.eggsPerPack);
  }, [packingTargetsInScope, packingSearchQ]);

  // "Ready-by" grouping — same PT numbers, bucketed by the planner's own
  // ready-by time instead of egg size.
  const packingRowsByReadyBy = useMemo(() => {
    const m: Record<string, { eggs: number; skus: Set<string>; names: Set<string>; eppSet: Set<number> }> = {};
    for (const t of packingTargetsInScope) {
      const key = t.readyBy || "ไม่ระบุเวลา";
      if (!m[key]) m[key] = { eggs: 0, skus: new Set(), names: new Set(), eppSet: new Set() };
      m[key].eggs += t.qtyEggs;
      m[key].skus.add(t.sku);
      m[key].names.add(t.itemName);
      m[key].eppSet.add(t.eggsPerPack);
    }
    return Object.entries(m)
      .map(([key, v]) => ({
        key,
        eggs: v.eggs,
        skuCount: v.skus.size,
        uniformEpp: v.eppSet.size === 1 ? Array.from(v.eppSet)[0] : null,
        skus: v.skus,
        names: v.names,
      }))
      .filter(r => matchesPackingSearch(r.key, r.skus, r.names))
      .sort((a, b) => (a.key === "ไม่ระบุเวลา" ? 1 : b.key === "ไม่ระบุเวลา" ? -1 : a.key.localeCompare(b.key)));
  }, [packingTargetsInScope, packingSearchQ]);

  const [addTargetOpen, setAddTargetOpen] = useState(false);

  // ── Grading command-bar data (real, derived from lots/jobs/results — no
  // grading-day-close concept exists yet, so "ปิดวันนี้" below is a preview
  // link to Overview, same as the existing Orders "Close today" button) ──────
  const dateJobs = useMemo(() => jobs.filter(j => j.productionDate === date), [jobs, date]);
  const plannedJobs = useMemo(() => dateJobs.filter(j => j.status === "planned"), [dateJobs]);
  const sentJobs = useMemo(() => dateJobs.filter(j => j.status === "sent_to_floor"), [dateJobs]);
  // "คัดไข่" (graded into a single size, e.g. เบอร์ 0-6) vs "คละไข่" (a mixed
  // pair like 2-3, or the generic "mixed" bucket) — this used to be read off
  // job.mixedEggLane, but that's a MACHINE LANE setting (defaults to true on
  // every job, per the schema), not what the job actually outputs. Real
  // output classification only exists per OUTCOME SIZE, in fromJobsBySize
  // (same actual+forecast engine Planning Balance uses) — a base size (in
  // EGG_SIZES) is "คัดไข่", anything else (a pair, or "mixed") is "คละไข่".
  const sizeKeysToday = Object.keys(fromJobsBySize);
  const gradeSizeKeys = sizeKeysToday.filter(k => EGG_SIZES.includes(k));
  const mixSizeKeys = sizeKeysToday.filter(k => !EGG_SIZES.includes(k));
  const sumSizes = (keys: string[]) => keys.reduce((s, k) => s + (fromJobsBySize[k] ?? 0), 0);
  const sumByUse = (keys: string[], uses: "actual" | "forecast") =>
    keys.reduce((s, k) => s + (sourcesBySize[k] ?? []).filter(x => x.uses === uses).reduce((a, x) => a + x.effect, 0), 0);
  const gradeQtyToday = sumSizes(gradeSizeKeys);
  const mixQtyToday = sumSizes(mixSizeKeys);
  const gradeActual = sumByUse(gradeSizeKeys, "actual");
  const gradeForecast = sumByUse(gradeSizeKeys, "forecast");
  const mixActual = sumByUse(mixSizeKeys, "actual");
  const mixForecast = sumByUse(mixSizeKeys, "forecast");

  // Outstanding raw stock = received raw lots minus qty already put on a job
  // (any status) — same "received - alreadyPlanned" math AddGradingJobModal
  // uses per-lot, summed across all raw lots (not date-scoped — it's running
  // inventory, not today's activity).
  const rawOutstanding = useMemo(() => {
    return lots
      .filter(l => l.material === "raw" && l.status === "received")
      .reduce((sum, l) => {
        const received = lotReceived(l);
        const planned = jobs.filter(j => j.lotId === l.id).reduce((s, j) => s + j.qty, 0);
        return sum + Math.max(received - planned, 0);
      }, 0);
  }, [lots, jobs]);

  const gradedOutputToday = useMemo(() => {
    const idsToday = new Set(dateJobs.map(j => j.id));
    return jobResults
      .filter(r => idsToday.has(r.jobId))
      .reduce((s, r) => s + Object.values(r.output ?? {}).reduce((a, b) => a + (Number(b) || 0), 0), 0);
  }, [jobResults, dateJobs]);

  const [sendingToFloor, setSendingToFloor] = useState(false);
  const sendAllToFloor = async () => {
    if (!plannedJobs.length) return;
    setSendingToFloor(true);
    try {
      await Promise.all(plannedJobs.map(j => fetch(`/api/grading/jobs/${j.id}/send-to-floor`, { method: "PATCH" })));
      await fetchJobs();
    } finally {
      setSendingToFloor(false);
    }
  };

  return (
    <div className="space-y-4">
      {sub === "bom" ? (
        <BomView date={date} round={activeRoundNum} onDateChange={onDateChange} />
      ) : sub === "grading" ? (
        <div className="space-y-6">
          {/* Grading command bar — date nav + plan/work status + close-day action.
              "ส่ง G-P" is real (sends every "planned" job for this date to the
              floor); "ปิดวันนี้" is a preview link to Overview, same as the
              existing Orders "Close today" button — there's no grading-day-close
              concept in the schema yet. */}
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-3.5 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
                Grading date
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onDateChange(addDays(date, -1))}
                  className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">‹</button>
                <input
                  type="date"
                  value={date}
                  onChange={e => e.target.value && onDateChange(e.target.value)}
                  className="h-8 px-2 text-[13px] border border-[#e3e5e8] rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
                />
                <button onClick={() => onDateChange(addDays(date, 1))}
                  className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">›</button>
              </div>
              <button onClick={() => onDateChange(todayISO())}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${date === todayISO() ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"}`}>
                Today
              </button>

              <div className="w-px h-6 bg-[#e3e5e8] mx-1" />

              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
                สถานะวางแผน
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                G-P
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#555] whitespace-nowrap">
                {plannedJobs.length === 0 && sentJobs.length === 0 ? (
                  <>○ ยังไม่เริ่ม</>
                ) : (
                  <>
                    {plannedJobs.length > 0 && <>● ร่าง {fmtNum(plannedJobs.length)} งาน</>}
                    {plannedJobs.length > 0 && sentJobs.length > 0 && <span className="text-[#ccc]">·</span>}
                    {sentJobs.length > 0 && <>✓ ส่งแล้ว {fmtNum(sentJobs.length)} งาน</>}
                  </>
                )}
              </span>

              <div className="ml-auto flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
                    สถานะงาน · ทั้งวัน
                  </div>
                  <div className="text-[10.5px] text-[#aaa] whitespace-nowrap">
                    {/* Verified against handover/261002/Daily Planning Prototype
                        v13's _gd3ActionHtml: ปิดวันนี้ needs BOTH no planned
                        (ร่าง) jobs left AND O-R closed — not just O-R, which is
                        all this used to check (real gap, since fixed below). */}
                    {plannedJobs.length > 0 ? (
                      <>ปิดวันนี้ได้เมื่อส่งงานร่างครบ{!dayClosed && " และ O-R ปิดวันแล้ว"}</>
                    ) : !dayClosed ? (
                      <>ส่ง G-P ได้เมื่อมีงานร่าง · ปิดวันนี้ได้เมื่อ O-R ปิดวันแล้ว</>
                    ) : (
                      <>ส่ง G-P ได้เมื่อมีงานร่าง</>
                    )}
                  </div>
                </div>
                <button
                  onClick={sendAllToFloor}
                  disabled={!plannedJobs.length || sendingToFloor}
                  title={!plannedJobs.length ? "ส่ง G-P ได้เมื่อมีงานร่าง" : undefined}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 ${
                    plannedJobs.length
                      ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                      : "bg-[#f0f0f0] text-[#aaa] cursor-not-allowed"
                  }`}
                >
                  {sendingToFloor && <Loader2 className="w-3 h-3 animate-spin" />}
                  ส่ง G-P ›
                </button>
                <button
                  onClick={onGoOverview}
                  disabled={plannedJobs.length > 0 || !dayClosed}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border ${
                    plannedJobs.length === 0 && dayClosed
                      ? "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                      : "border-[#e8e8e8] text-[#ccc] cursor-not-allowed"
                  }`}
                  title={
                    plannedJobs.length > 0
                      ? `ปิดวันนี้ได้เมื่อส่งงานร่างครบ${!dayClosed ? " และ O-R ปิดวันแล้ว" : ""}`
                      : !dayClosed
                        ? "ปิดวันนี้ได้เมื่อ O-R ปิดวันแล้ว"
                        : "ดูสถานะปิดวันวางแผน (พรีวิว) ที่แท็บภาพรวม"
                  }
                >
                  ปิดวันนี้
                </button>
              </div>
            </div>
          </div>

          {/* Grading command-bar KPI cards. Card 4 (สถานะวางแผน) reuses the real
              order-round close state; the P-R (packing round) row stays a static
              placeholder — packing has no real data yet (see Packing tab). */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="text-[11px] font-semibold text-[#888] mb-2">ไข่คละ</div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-[#aaa]">คงเหลือ</div>
                  <div className="text-[20px] font-bold text-[#1a1a1a] tabular-nums">{fmtNum(rawOutstanding)} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span></div>
                  <div className="text-[10px] text-[#aaa]">จริง</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#aaa]">คัดวันนี้</div>
                  <div className="text-[15px] font-bold text-[#1a1a1a] tabular-nums">{dateJobs.length ? fmtNum(gradeQtyToday + mixQtyToday) : "—"}</div>
                  <div className="text-[10px] text-[#aaa]">{dateJobs.length ? `${dateJobs.length} งาน` : ""}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="text-[11px] font-semibold text-[#888] mb-2">แผนคละ / คัด</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#aaa]">คัดไข่</div>
                  <div className={`text-[15px] font-bold tabular-nums ${gradeSizeKeys.length ? (gradeForecast > 0 ? "text-[#1E40AF]" : "text-[#1a1a1a]") : "text-[#ccc]"}`}>
                    {gradeSizeKeys.length ? fmtNum(gradeQtyToday) : "—"}
                  </div>
                  <div className="text-[10px] text-[#aaa]">
                    {gradeSizeKeys.length ? `จริง ${gradeActual > 0 ? fmtNum(gradeActual) : "—"} · คาด ${gradeForecast > 0 ? fmtNum(gradeForecast) : "—"}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#aaa]">คละไข่</div>
                  <div className={`text-[15px] font-bold tabular-nums ${mixSizeKeys.length ? (mixForecast > 0 ? "text-[#1E40AF]" : "text-[#1a1a1a]") : "text-[#ccc]"}`}>
                    {mixSizeKeys.length ? fmtNum(mixQtyToday) : "—"}
                  </div>
                  <div className="text-[10px] text-[#aaa]">
                    {mixSizeKeys.length ? `จริง ${mixActual > 0 ? fmtNum(mixActual) : "—"} · คาด ${mixForecast > 0 ? fmtNum(mixForecast) : "—"}` : ""}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="text-[11px] font-semibold text-[#888] mb-2">สต็อกไข่เบอร์</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#aaa]">ยกมา</div>
                  <div className="text-[15px] font-bold text-[#1a1a1a] tabular-nums">{openingStock.length ? fmtNum(openingStockTotal) : "—"}</div>
                  <div className="text-[9.5px] text-[#bbb]">อายุ ≥ 3 วัน · ยังไม่มีข้อมูล</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#aaa]">รวม</div>
                  <div className="text-[15px] font-bold text-[#1a1a1a] tabular-nums">{openingStock.length ? fmtNum(openingStockTotal + gradedOutputToday) : "—"}</div>
                  <div className="text-[9.5px] text-[#bbb]">สต็อก + คัดได้</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="text-[11px] font-semibold text-[#888] mb-2 flex items-center justify-between">
                <span>สถานะวางแผน</span>
                <span className="text-[10px] text-[#aaa] font-normal">สถานะงาน</span>
              </div>
              <div className="space-y-1.5">
                {activeRoundClosed ? (
                  <div className="text-[11px] font-semibold text-[#1E40AF] bg-[#EFF6FF] border border-[#BFDBFE] rounded px-2 py-1">
                    ✓ ปิดวัน O-R{activeRoundNum} {fmtNum(roundEggTotals[activeRoundNum] ?? 0)} ฟอง
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">G-P</span>
                    <span className="text-[#555] inline-flex items-center gap-1">
                      {plannedJobs.length === 0 && sentJobs.length === 0 ? (
                        "○ ยังไม่เริ่ม"
                      ) : (
                        <>
                          {plannedJobs.length > 0 && <>● ร่าง {fmtNum(plannedJobs.length)}</>}
                          {plannedJobs.length > 0 && sentJobs.length > 0 && <span className="text-[#ccc]">·</span>}
                          {sentJobs.length > 0 && <>✓ ส่งแล้ว {fmtNum(sentJobs.length)}</>}
                        </>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  {/* "P-R —" not a fabricated round number — packing has no real
                      round/status data yet (see the Packing sub-tab placeholder). */}
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FDF2F8] text-[#BE185D] border border-[#FBCFE8]">P-R —</span>
                  <span className="text-[#aaa]">ยังไม่มีข้อมูล</span>
                </div>
              </div>
            </div>
          </div>

          {/* เศษ/ตำหนิ พร้อมขาย — real "available to sell" for both: defect
              eggs (confirmed job-result defect counts minus real order qty)
              and WIP/graded eggs (confirmed job-result fgLines graded
              directly into a WIP SKU — see /api/grading/wip-stock — minus
              real order qty). A WIP SKU with zero fgLines history shows a
              real 0, not a fabricated number. The separate
              grading_opening_stock figure Packing reads is untouched by
              either (kept independent, per decision). */}
          <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
            <div className="text-[11px] font-semibold text-[#888] mb-2">เศษ/ตำหนิ พร้อมขาย</div>
            {!defectStock || !wipStock ? (
              <div className="text-[12px] text-[#bbb]">กำลังโหลด...</div>
            ) : (
              <div className="flex items-start gap-6 flex-wrap">
                <div>
                  <div className="text-[10px] text-[#aaa]">ตำหนิ (ทุกวัน) · รวม</div>
                  <div className="text-[19px] font-bold text-[#1a1a1a] tabular-nums">
                    {fmtNum(defectStock.total.available)} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {defectStock.categories.map(c => (
                      <span key={c.id} className={`text-[10.5px] px-1.5 py-0.5 rounded ${c.available > 0 ? "bg-[#FFFBEB] text-[#92400E]" : "bg-[#f5f5f5] text-[#bbb]"}`}>
                        {c.label} {fmtNum(c.available)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-px self-stretch bg-[#f0f0f0]" />
                <div>
                  <div className="text-[10px] text-[#aaa]">WIP/ไข่คัดแล้ว (ทุกวัน) · พร้อมขาย</div>
                  <div className="text-[19px] font-bold text-[#1a1a1a] tabular-nums">
                    {fmtNum(wipStock.reduce((s, i) => s + i.available, 0))} <span className="text-[11px] font-normal text-[#aaa]">ถาด</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {wipStock.filter(i => i.totalProduced > 0).map(i => (
                      <span
                        key={i.itemId}
                        className={`text-[10.5px] px-1.5 py-0.5 rounded ${i.available > 0 ? "bg-[#F5F2FB] text-[#5B4B8A]" : "bg-[#f5f5f5] text-[#bbb]"}`}
                        title={wipTrayKind(i) === "special" ? "ถาดพิเศษ" : "ถาดปกติ"}
                      >
                        {i.sku} {fmtNum(i.available)}{wipTrayKind(i) === "special" ? " ✦" : ""}
                      </span>
                    ))}
                    {wipStock.every(i => i.totalProduced === 0) && <span className="text-[10.5px] text-[#bbb]">ยังไม่มี SKU ที่คัดเข้าโดยตรง</span>}
                  </div>
                  <div className="text-[10px] text-[#aaa] mt-1">
                    คัดเข้าตรง (fgLines) − ขายแล้ว · แยกจากสต็อกต้นวัน {openingStock.length ? `(${fmtNum(openingStockTotal)} ฟอง อ้างอิง)` : ""}
                  </div>
                  {trayMaterialUsage.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-dashed border-[#e3e5e8]">
                      <div className="text-[10px] text-[#aaa] mb-0.5">วัสดุถาดพิเศษที่ใช้ไปแล้ว (รวมสะสม · ไม่มีสต็อกตั้งต้น)</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {trayMaterialUsage.map(t => (
                          <span key={t.componentSku} className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#FFFBEB] text-[#92400E]" title={t.componentSku}>
                            {t.componentName} ({t.componentSku}) ใช้ไป {fmtNum(t.totalUsed)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <GradingPlanToday date={date} partners={partners} rawLots={lots} jobs={jobs} results={jobResults} />
          <GradingReceivingLots
            date={date}
            lots={lots}
            loading={lotsLoading}
            onRefresh={fetchLots}
            jobs={jobs}
            onJobsRefresh={fetchJobs}
            results={jobResults}
          />

          {/* "+ Add job" — unified entry point, doesn't start from a specific
              lot's row like Receiving Lots' own "เพิ่มงานคัด" button does. */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-dashed border-[#d6d8dc]">
            <span className="text-[13px] font-bold text-[#1a1a1a]">+ Add job</span>
            <button
              onClick={() => setAddJobDraft({ mode: "machine" })}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#7C3AED] text-[#7C3AED] hover:bg-[#F5F3FF]"
            >
              Machine job
            </button>
            <button
              onClick={() => setAddJobDraft({ mode: "hand" })}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#7C3AED] text-[#7C3AED] hover:bg-[#F5F3FF]"
            >
              Hand job
            </button>
            <span className="text-[11px] text-[#aaa]">เลือกล็อตและกรอกรายละเอียดในหน้าต่างที่เปิดขึ้น</span>
          </div>

          <MachineJobBoard
            date={date}
            lots={lots}
            jobs={jobs}
            results={jobResults}
            onRefresh={fetchJobs}
            onResultsRefresh={async () => {
              // Confirming a result can auto-create a new receiving lot (from
              // ungraded output) — refresh lots too, not just results, so it
              // shows up in Receiving Lots without a manual page reload.
              await fetchJobResults();
              await fetchLots();
            }}
            onAddMachineJob={m => setAddJobDraft({ mode: "machine", initialMachine: m ?? null })}
          />

          {addJobDraft && (
            <AddGradingJobModal
              lot={null}
              lots={lots}
              allJobs={jobs}
              mode={addJobDraft.mode}
              initialMachine={addJobDraft.initialMachine ?? null}
              onClose={() => setAddJobDraft(null)}
              onSaved={() => { setAddJobDraft(null); fetchJobs(); }}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Packing command bar — P-R rounds, targets, and the 3-step send
              workflow are now real (migrations/0037_packing_targets.sql,
              server/routes/packing.ts). Still placeholder: actual packing
              results (ผลจริง) and the per-SKU target table itself — see
              /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md,
              Phases 2-4 for those. */}
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-3.5 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
                Packing date
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onDateChange(addDays(date, -1))}
                  className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">‹</button>
                <input
                  type="date"
                  value={date}
                  onChange={e => e.target.value && onDateChange(e.target.value)}
                  className="h-8 px-2 text-[13px] border border-[#e3e5e8] rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
                />
                <button onClick={() => onDateChange(addDays(date, 1))}
                  className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">›</button>
              </div>
              <button onClick={() => onDateChange(todayISO())}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${date === todayISO() ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"}`}>
                Today
              </button>

              <div className="w-px h-6 bg-[#e3e5e8] mx-1" />

              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
                สถานะวางแผน
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2F8] text-[#BE185D] border border-[#FBCFE8]">
                P-R{packingRound}
              </span>
              <span className="text-[12px] text-[#555]">
                {packingState?.workOrderSentAt
                  ? "✓ ส่งใบสั่งงานแล้ว"
                  : packingState?.materialPlanConfirmedAt
                    ? "● ยืนยันแผนวัตถุดิบแล้ว · รอส่ง"
                    : packingState?.targetConfirmedAt
                      ? "● ยืนยันเป้าแพ็กแล้ว · รอแผนวัตถุดิบ"
                      : "○ ยังไม่เริ่ม"}
              </span>
              <select
                value={packingRound}
                onChange={e => setPackingRound(Number(e.target.value) as Round)}
                className="h-7 px-2 text-[12px] border border-[#d6d8dc] rounded-lg bg-white"
              >
                {rounds.map(r => (
                  <option key={r} value={r}>P-R{r}</option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={onGoOverview}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                  title="ดูสถานะปิดวันวางแผน (พรีวิว) ที่แท็บภาพรวม"
                >
                  ปิดวันนี้
                </button>
              </div>
            </div>

            {/* 3-step gated workflow (เป้าแพ็ก → แผนวัตถุดิบ → ใบสั่งงาน) — real,
                each a PATCH the backend also re-validates (can't skip a
                locked step). The actual target-building UI (what step 1
                really needs) is Phase 3 — confirming step 1 now just
                commits whatever's already in packing_targets for this round
                (possibly nothing yet). */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#f0f0f0]">
              <button
                onClick={() => togglePackingStep("target", !packingState?.targetConfirmedAt)}
                disabled={packingToggling}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border flex items-center gap-1.5 disabled:opacity-50 ${
                  packingState?.targetConfirmedAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-white border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]"
                }`}
              >
                ① เป้าแพ็ก {packingState?.targetConfirmedAt ? "✓" : `(${fmtNum(packingThisRoundTotal)} ฟอง)`}
              </button>
              <span className="text-[#ccc]">→</span>
              <button
                onClick={() => togglePackingStep("materialPlan", !packingState?.materialPlanConfirmedAt)}
                disabled={packingToggling || packingStepLocked("materialPlan") || materialPlanBlocked}
                title={
                  packingStepLocked("materialPlan")
                    ? "ต้องยืนยันเป้าแพ็กก่อน"
                    : materialPlanBlocked
                      ? "มี SKU ที่ยังไม่ตั้งค่า BOM/Packaging Profile ครบ — ดูรายการด้านล่าง"
                      : undefined
                }
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  packingState?.materialPlanConfirmedAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-white border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                }`}
              >
                {(packingStepLocked("materialPlan") || materialPlanBlocked) && !packingState?.materialPlanConfirmedAt ? "🔒 " : ""}
                แผนวัตถุดิบ {packingState?.materialPlanConfirmedAt ? "✓" : ""}
              </button>
              <span className="text-[#ccc]">→</span>
              <button
                onClick={() => togglePackingStep("workOrder", !packingState?.workOrderSentAt)}
                disabled={packingToggling || packingStepLocked("workOrder")}
                title={packingStepLocked("workOrder") ? "ต้องยืนยันแผนวัตถุดิบก่อน" : "ส่งใบสั่งงาน — ปั๊มเวลาส่งให้ทุกรายการเป้าแพ็กของรอบนี้"}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  packingState?.workOrderSentAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-white border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                }`}
              >
                {packingStepLocked("workOrder") && !packingState?.workOrderSentAt ? "🔒 " : ""}
                ใบสั่งงาน {packingState?.workOrderSentAt ? `✓ ${packingSentCount} รายการ` : ""}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="text-[11px] font-semibold text-[#888] mb-2">ทั้งวัน</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-[#aaa]">PQ</div>
                  <div className="text-[19px] font-bold text-[#5B4B8A] tabular-nums">
                    {packingPqTotal > 0 ? fmtNum(packingPqTotal) : "—"} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#aaa]">Accum PT</div>
                  <div className={`text-[19px] font-bold tabular-nums ${packingAccumPT > 0 ? "text-[#1E40AF]" : "text-[#888]"}`}>
                    {packingAccumPT > 0 ? fmtNum(packingAccumPT) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#aaa]">ผลจริง</div>
                  <div className="text-[13px] font-semibold text-[#888] mt-1.5">ยังไม่มีข้อมูล</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="text-[11px] font-semibold text-[#888] mb-2">รอบนี้ · P-R{packingRound}</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-[#aaa]">PT เริ่มต้น</div>
                  <div className={`text-[15px] font-bold tabular-nums ${packingThisRoundTotal > 0 ? "text-[#1E40AF]" : "text-[#ccc]"}`}>
                    {packingThisRoundTotal > 0 ? fmtNum(packingThisRoundTotal) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#aaa]">ปรับลด</div>
                  <div className="text-[15px] font-bold text-[#ccc] tabular-nums">—</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#aaa]">PT สุดท้าย</div>
                  <div className={`text-[15px] font-bold tabular-nums ${packingThisRoundTotal > 0 ? "text-[#1E40AF]" : "text-[#ccc]"}`}>
                    {packingThisRoundTotal > 0 ? fmtNum(packingThisRoundTotal) : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#888] mb-2">
                <span>สถานะวางแผน</span>
                <span>สถานะงาน</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EEF2FF] text-[#2563EB] border border-[#C7D2FE]">
                    O-R{activeRoundNum}
                  </span>
                  <span className="text-[#555]">{activeRoundClosed ? "✓ ปิดวัน" : "● ร่าง"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                    G-P
                  </span>
                  <span className="text-[#555]">
                    {plannedJobs.length === 0 && sentJobs.length === 0
                      ? "○ ยังไม่เริ่ม"
                      : plannedJobs.length > 0
                        ? `● ร่าง ${plannedJobs.length} งาน`
                        : `✓ ส่งแล้ว ${sentJobs.length} งาน`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FDF2F8] text-[#BE185D] border border-[#FBCFE8]">
                    P-R{packingRound}
                  </span>
                  <span className="text-[#555]">
                    {packingState?.workOrderSentAt
                      ? "✓ ส่งแล้ว"
                      : packingState?.materialPlanConfirmedAt
                        ? "● แผนวัตถุดิบแล้ว"
                        : packingState?.targetConfirmedAt
                          ? "● เป้าแพ็กแล้ว"
                          : "○ ยังไม่เริ่ม"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. สรุปงานแพ็ก — real, per ordering-customer for P-R{packingRound}:
              PQ demand next to PT committed so far (see packingCustomerSummary
              above). Simplified from the reference: one grouping (by
              customer) instead of the มุมมอง/ตัวกรอง view-switcher — those are
              pure display toggles over this same data, not new numbers, and
              aren't built yet. */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[14px] font-bold text-[#1a1a1a]">1. สรุปงานแพ็ก</span>
              <span className="text-[11px] text-[#888]">P-R{packingRound} · {packingCustomerSummary.length} ลูกค้า · {packingCustomerSummary.reduce((s, r) => s + r.orderCount, 0)} ออเดอร์</span>
            </div>
            <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
              {packingCustomerSummary.length === 0 ? (
                <div className="py-10 text-center text-[#bbb] text-[13px]">ไม่มีออเดอร์ใน P-R{packingRound}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                        <th className="text-left px-4 py-2">ลูกค้า / ไซต์ส่ง</th>
                        <th className="text-right px-3 py-2">PQ รอบนี้ · ฟอง</th>
                        <th className="text-right px-3 py-2">PT (เป้าแพ็ก) · ฟอง</th>
                        <th className="text-right px-4 py-2">ส่วนต่าง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packingCustomerSummary.map(r => {
                        const diff = r.ptEggs - r.pqEggs;
                        return (
                          <tr key={r.partnerName} className="border-b border-[#f0f0f0] last:border-b-0">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <CustPill name={r.partnerName} />
                                <span className="text-[#555]">{r.orderCount} ออเดอร์</span>
                              </div>
                              <div className="text-[11px] text-[#999] mt-0.5 truncate max-w-[280px]">{r.siteNames}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#5B4B8A]">{fmtNum(r.pqEggs)}</td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.ptEggs > 0 ? "text-[#1E40AF]" : "text-[#ccc]"}`}>
                              {r.ptEggs > 0 ? fmtNum(r.ptEggs) : "—"}
                            </td>
                            <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${diff < 0 ? "text-[#92400E]" : diff > 0 ? "text-green-700" : "text-[#ccc]"}`}>
                              {diff === 0 ? "—" : diff < 0 ? `ขาด ${fmtNum(Math.abs(diff))}` : `เกิน ${fmtNum(diff)}`}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-[#fafbfc] font-bold">
                        <td className="px-4 py-2.5">รวมทั้งหมด</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#5B4B8A]">
                          {fmtNum(packingCustomerSummary.reduce((s, r) => s + r.pqEggs, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#1E40AF]">
                          {fmtNum(packingCustomerSummary.reduce((s, r) => s + r.ptEggs, 0))}
                        </td>
                        <td className="px-4 py-2.5" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 2. การวางแผนและส่งงาน — real demand/supply by egg size:
              AQ ทั้งวัน (live aq-reference), PQ คงเหลือ (PQ by size minus
              already-targeted), งานวันนี้/เป้าเพิ่มรอบนี้ (PT this round),
              ไข่พร้อมใช้ (Grading's own opening-stock + fromJobsBySize
              engine), หักใช้ไป (PT reserved against that supply, a planning
              figure — no real stock-movement ledger exists to post against).
              Ready-by is the earliest value a planner typed in for that size
              this round, not a computed ETA. */}
          <div>
            <span className="text-[14px] font-bold text-[#1a1a1a]">2. การวางแผนและส่งงาน</span>

            {/* Same round-state as the command bar's 3-step workflow above
                (packingState/packingStepLocked/togglePackingStep) — repeated
                here, pill-styled, so the step gate is visible right next to
                the table it gates, matching the reference. */}
            <div className="flex items-center gap-2 mt-2 mb-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FDF2F8] text-[#BE185D] border border-[#FBCFE8]">
                P-R{packingRound}
              </span>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#555]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    packingState?.workOrderSentAt ? "bg-green-600" : packingState?.targetConfirmedAt || packingState?.materialPlanConfirmedAt ? "bg-[#1a1a1a]" : "bg-[#ccc]"
                  }`}
                />
                {packingState?.workOrderSentAt ? "ส่งแล้ว" : packingState?.targetConfirmedAt || packingState?.materialPlanConfirmedAt ? "กำลังทำ" : "ยังไม่เริ่ม"}
              </span>
              <button
                onClick={() => togglePackingStep("target", !packingState?.targetConfirmedAt)}
                disabled={packingToggling}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 disabled:opacity-50 ${
                  packingState?.targetConfirmedAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-white border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]"
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                  packingState?.targetConfirmedAt ? "bg-green-600 text-white" : "border border-[#2563EB]"
                }`}>
                  {packingState?.targetConfirmedAt ? "✓" : "①"}
                </span>
                เป้าแพ็ก
              </button>
              <span className="text-[#ccc] text-[12px]">→</span>
              <button
                onClick={() => togglePackingStep("materialPlan", !packingState?.materialPlanConfirmedAt)}
                disabled={packingToggling || packingStepLocked("materialPlan") || materialPlanBlocked}
                title={
                  packingStepLocked("materialPlan")
                    ? "ต้องยืนยันเป้าแพ็กก่อน"
                    : materialPlanBlocked
                      ? "มี SKU ที่ยังไม่ตั้งค่า BOM/Packaging Profile ครบ — ดูรายการด้านล่าง"
                      : undefined
                }
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border disabled:cursor-not-allowed ${
                  packingState?.materialPlanConfirmedAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-[#f5f5f5] border-[#e3e5e8] text-[#aaa]"
                }`}
              >
                {(packingStepLocked("materialPlan") || materialPlanBlocked) && !packingState?.materialPlanConfirmedAt ? "🔒 " : ""}
                แผนวัตถุดิบ
              </button>
              <span className="text-[#ccc] text-[12px]">→</span>
              <button
                onClick={() => togglePackingStep("workOrder", !packingState?.workOrderSentAt)}
                disabled={packingToggling || packingStepLocked("workOrder")}
                title={packingStepLocked("workOrder") ? "ต้องยืนยันแผนวัตถุดิบก่อน" : "ส่งใบสั่งงาน"}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border disabled:cursor-not-allowed ${
                  packingState?.workOrderSentAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-[#f5f5f5] border-[#e3e5e8] text-[#aaa]"
                }`}
              >
                {packingStepLocked("workOrder") && !packingState?.workOrderSentAt ? "🔒 " : ""}
                ใบสั่งงาน
              </button>
              <button
                onClick={() => setAddTargetOpen(true)}
                className="ml-auto px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
              >
                + เพิ่ม SKU จาก AQ
              </button>
            </div>

            {/* Search + "มุมมอง" — real re-slices of the same packing_targets
                data (packingRowsByPackSize/packingRowsByReadyBy use the exact
                same source as packingSizeRows, just grouped differently); a
                personal display preference (localStorage), not a server
                query, so it never touches the plan itself. */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-[360px]">
                <input
                  value={packingSearch}
                  onChange={e => setPackingSearch(e.target.value)}
                  placeholder="ค้นหา SKU หรือชื่อลูกค้า"
                  className="w-full h-9 pl-3 pr-8 text-[12.5px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
                {packingSearch && (
                  <button onClick={() => setPackingSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-[#555]">×</button>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-[#888]">โหมดจำนวน</span>
                <div className="flex items-center rounded-lg border border-[#d6d8dc] overflow-hidden text-[11.5px] font-semibold">
                  <button onClick={() => setPackingCumulative(false)} className={`px-2.5 py-1.5 ${!packingCumulative ? "bg-[#1a1a1a] text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"}`}>
                    รอบนี้
                  </button>
                  <button onClick={() => setPackingCumulative(true)} className={`px-2.5 py-1.5 border-l border-[#d6d8dc] ${packingCumulative ? "bg-[#1a1a1a] text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"}`}>
                    สะสม
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setPackingViewOpen(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-semibold rounded-lg border border-[#d6d8dc] bg-white hover:bg-[#f5f5f5]"
                  >
                    ▦ มุมมอง: {PACKING_GROUP_LABEL[packingGroupBy]} · {PACKING_UNIT_LABEL[packingUnit]}
                  </button>
                  {packingViewOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPackingViewOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-[#E1E5EA] shadow-lg z-20 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-bold text-[#1a1a1a]">มุมมอง</span>
                          <button onClick={() => setPackingViewOpen(false)} className="text-[#aaa] hover:text-[#555]">×</button>
                        </div>
                        <div className="text-[10px] font-bold text-[#888] uppercase tracking-wide mb-1.5">จัดกลุ่ม</div>
                        <div className="space-y-1.5 mb-3">
                          {(["size", "packSize", "readyBy"] as const).map(g => (
                            <label key={g} className="flex items-center gap-2 text-[12px] text-[#333] cursor-pointer">
                              <input type="radio" checked={packingGroupBy === g} onChange={() => setPackingGroupBy(g)} />
                              {PACKING_GROUP_LABEL[g]}
                            </label>
                          ))}
                        </div>
                        <div className="text-[10px] font-bold text-[#888] uppercase tracking-wide mb-1.5">หน่วยแสดงผล</div>
                        <div className="space-y-1.5">
                          {(["eggs", "packs"] as const).map(u => (
                            <label key={u} className="flex items-center gap-2 text-[12px] text-[#333] cursor-pointer">
                              <input type="radio" checked={packingUnit === u} onChange={() => setPackingUnit(u)} />
                              {PACKING_UNIT_LABEL[u]}
                            </label>
                          ))}
                          <label className="flex items-center gap-2 text-[12px] text-[#ccc] cursor-not-allowed" title="ยังไม่รองรับ — เป้าแพ็กยังไม่มีฟิลด์หน่วยขาย">
                            <input type="radio" disabled />
                            หน่วยขาย
                          </label>
                        </div>
                        <div className="text-[10px] text-[#aaa] mt-3 pt-2 border-t border-[#f0f0f0]">การแสดงผลส่วนตัว · ไม่กระทบข้อมูลแผน</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div ref={packingTableRef} className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
              {packingGroupBy === "size" && (
                packingSizeRowsFiltered.length === 0 ? (
                  <div className="py-10 text-center text-[#bbb] text-[13px]">{packingSearchQ ? "ไม่พบที่ตรงกับการค้นหา" : "ยังไม่มีดีมานด์หรือเป้าแพ็กสำหรับวันนี้"}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                          <th rowSpan={2} className="text-left px-4 py-2 align-bottom">กลุ่ม · หน่วย ฟอง</th>
                          <th colSpan={2} className="text-center px-3 py-1.5 border-l border-[#e5e7eb]">▤ ดีมานด์</th>
                          <th colSpan={1} className="text-center px-3 py-1.5 border-l border-[#e5e7eb]">◎ งานวันนี้</th>
                          <th colSpan={1} className="text-center px-3 py-1.5 border-l border-[#e5e7eb]">⬡ ซัพพลาย</th>
                          <th rowSpan={2} className="text-right px-4 py-2 align-bottom">READY-BY</th>
                        </tr>
                        <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                          <th className="text-right px-3 py-2 border-l border-[#e5e7eb]">AQ ทั้งวัน</th>
                          <th className="text-right px-3 py-2">PQ คงเหลือ</th>
                          <th className="text-right px-3 py-2 border-l border-[#e5e7eb]">{packingCumulative ? "PT สะสมทั้งวัน" : "เป้าเพิ่มรอบนี้"}</th>
                          <th className="text-right px-3 py-2 border-l border-[#e5e7eb]">ไข่พร้อมใช้ · หักใช้ไป</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packingSizeRowsFiltered.map(r => {
                          const ptDisplay = packingCumulative ? ptBySizeAllRounds[r.size] ?? 0 : r.ptThisRound;
                          const packsNote = packingUnit === "packs" && r.uniformEpp && ptDisplay > 0 ? ` (~${fmtNum(ptDisplay / r.uniformEpp)} แพ็ก)` : "";
                          const subRows = packingDemandRowsBySize[r.size] ?? [];
                          const needsFix = needsFixCountBySize[r.size] ?? 0;
                          const expanded = expandedSizes.has(r.size);
                          return (
                            <Fragment key={r.size}>
                              <tr className={`border-b border-[#f0f0f0] last:border-b-0 ${expanded ? "bg-[#F5F7FF]" : ""}`}>
                                <td className="px-4 py-2.5 font-semibold text-[#1a1a1a]">
                                  <button
                                    onClick={() => toggleSizeExpanded(r.size)}
                                    disabled={subRows.length === 0}
                                    className="flex items-center gap-1.5 disabled:cursor-default"
                                  >
                                    <span className={`text-[10px] text-[#888] transition-transform ${expanded ? "rotate-90" : ""} ${subRows.length === 0 ? "opacity-0" : ""}`}>›</span>
                                    <span>
                                      <div>{EGG_SIZES.includes(r.size) ? `เบอร์ ${r.size}` : r.size === "mixed" ? "คละ" : r.size}</div>
                                      {needsFix > 0 && (
                                        <div className="flex items-center gap-1 text-[10.5px] font-normal text-[#991B1B] mt-0.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#991B1B]" /> ต้องแก้ {needsFix}
                                        </div>
                                      )}
                                    </span>
                                  </button>
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-[#555]">{r.aq > 0 ? fmtNum(Math.round(r.aq)) : "—"}</td>
                                <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.pqRemaining < 0 ? "text-[#92400E]" : "text-[#5B4B8A]"}`}>
                                  {r.pqRemaining !== 0 ? fmtNum(r.pqRemaining) : "—"}
                                </td>
                                <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${ptDisplay > 0 ? "text-[#1E40AF]" : "text-[#ccc]"}`}>
                                  {ptDisplay > 0 ? `${fmtNum(ptDisplay)}${packsNote}` : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">
                                  {r.supply > 0 ? (
                                    <>
                                      <span className={`font-semibold ${r.supplyRemaining < 0 ? "text-[#991B1B]" : "text-[#1a1a1a]"}`}>{fmtNum(r.supplyRemaining)}</span>
                                      <div className="text-[10.5px] text-[#aaa] font-normal normal-case" title="ไข่พร้อมใช้ก่อนหักเป้าแพ็กของวันนี้">
                                        มี {fmtNum(r.supply)} · หัก {fmtNum(r.supply - r.supplyRemaining)}
                                      </div>
                                    </>
                                  ) : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[#888]">{r.readyBy ?? "ยังไม่ตั้ง"}</td>
                              </tr>
                              {expanded && (() => {
                                const selectedInGroup = subRows.filter(sr => selectedItemIds.has(sr.itemId));
                                if (selectedInGroup.length === 0) {
                                  return (
                                    <tr className="bg-[#fafbfc] border-b border-[#f0f0f0]">
                                      <td colSpan={6} className="px-4 pt-3 pb-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-[#888] uppercase tracking-wide">
                                          <span>ลูกค้า × FG SKU</span>
                                          <button
                                            onClick={() => setPackingCumulative(v => !v)}
                                            className="text-[#1E40AF] font-semibold normal-case hover:underline"
                                          >
                                            โหมด: {packingCumulative ? "สะสม (รวมทุกรอบ)" : "รอบนี้ (เพิ่มจากรอบก่อน)"} ⇝
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }
                                const stagedTotal = selectedInGroup.reduce((s, sr) => s + (stagedQtyByItem[sr.itemId] ?? sr.qty), 0);
                                return (
                                  <tr className="bg-[#1E3A8A]">
                                    <td colSpan={6} className="px-4 py-2">
                                      <div className="flex items-center gap-2 flex-wrap text-white">
                                        <span className="text-[12px] font-semibold whitespace-nowrap">{selectedInGroup.length} SKU · รอบนี้ {fmtNum(stagedTotal)}</span>
                                        <span className="text-[10.5px] text-blue-200 ml-2">% AQ</span>
                                        {[25, 50, 75, 100].map(pct => (
                                          <button
                                            key={pct}
                                            onClick={() => stageBulkQty(subRows, sr => (sr.aq * pct) / 100)}
                                            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white/10 hover:bg-white/20"
                                          >
                                            {pct}
                                          </button>
                                        ))}
                                        <button
                                          onClick={() => stageBulkQty(subRows, sr => sr.pqRemaining)}
                                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white/10 hover:bg-white/20"
                                        >
                                          = PQ
                                        </button>
                                        <button
                                          onClick={() => stageBulkQty(subRows, () => 0)}
                                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white/10 hover:bg-white/20"
                                        >
                                          ไม่ส่งงานรอบนี้
                                        </button>
                                        <div className="ml-auto flex items-center gap-2">
                                          <button
                                            onClick={() => setBulkReadyByRows(selectedInGroup)}
                                            className="px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-white text-[#1E3A8A] whitespace-nowrap"
                                          >
                                            ตั้ง Ready-by
                                          </button>
                                          <button
                                            onClick={() => applyBulk(subRows)}
                                            disabled={bulkApplying || Object.keys(stagedQtyByItem).length === 0}
                                            className="px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-[#D9F99D] text-[#365314] disabled:opacity-50 whitespace-nowrap"
                                          >
                                            {bulkApplying ? "กำลังบันทึก..." : "ผ่านที่เลือก"}
                                          </button>
                                          <button onClick={clearBulkSelection} className="text-[11.5px] text-blue-200 hover:underline whitespace-nowrap">
                                            ยกเลิก
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })()}
                              {expanded &&
                                subRows.map(sr => {
                                  const isMulti = sr.targetIds.length > 1; // cross-round aggregate — no single row to PATCH
                                  const untargeted = sr.targetIds.length === 0; // real PQ demand, no packing_targets row yet
                                  const staged = stagedQtyByItem[sr.itemId];
                                  return (
                                    <tr key={sr.itemId} className="bg-[#fafbfc] border-b border-[#f0f0f0] last:border-b-0">
                                      <td className="pl-4 pr-4 py-2.5">
                                        <div className="flex items-start gap-2.5">
                                          <input
                                            type="checkbox"
                                            checked={selectedItemIds.has(sr.itemId)}
                                            onChange={() => toggleSelectItem(sr.itemId)}
                                            className="mt-1 shrink-0"
                                          />
                                          <div>
                                        <div className="text-[#1a1a1a]">{sr.itemName}</div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {sr.customerName ? <CustPill name={sr.customerName} /> : (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#f5f5f5] text-[#aaa] border border-[#e5e5e5]">ไม่ทราบลูกค้า</span>
                                          )}
                                          <span className="text-[11px] text-[#999]">{sr.sku} · {sr.eggsPerPack} ฟอง/แพ็ก</span>
                                        </div>
                                        {untargeted ? (
                                          <div className="flex items-center gap-1 text-[10.5px] text-[#92400E] mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" /> ยังไม่มีเป้าแพ็ก
                                          </div>
                                        ) : !sr.readyBy && (
                                          <div className="flex items-center gap-1 text-[10.5px] text-[#991B1B] mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#991B1B]" /> ตั้ง Ready-by
                                          </div>
                                        )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right tabular-nums text-[#555]">{sr.aq > 0 ? fmtNum(Math.round(sr.aq)) : "—"}</td>
                                      <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${sr.pqRemaining < 0 ? "text-[#92400E]" : "text-[#5B4B8A]"}`}>
                                        {sr.pqRemaining !== 0 ? fmtNum(sr.pqRemaining) : "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-right tabular-nums">
                                        {staged != null ? (
                                          <span className="font-bold text-[#92400E] inline-flex items-center gap-1" title="ค่าที่เลือกไว้ · ยังไม่บันทึกจนกว่าจะกด &quot;ผ่านที่เลือก&quot;">
                                            {fmtNum(staged)} <span className="text-[10px] font-normal">(รอยืนยัน)</span>
                                          </span>
                                        ) : untargeted ? (
                                          <button
                                            onClick={() => setEditTargetRow(sr)}
                                            className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]"
                                          >
                                            + ตั้งเป้า
                                          </button>
                                        ) : (
                                          <span className="font-bold text-[#1E40AF] inline-flex items-center gap-1">
                                            {fmtNum(sr.qty)}
                                            {!isMulti && (
                                              <button
                                                onClick={() => setEditTargetRow(sr)}
                                                className="text-[#aaa] hover:text-[#1E40AF]"
                                                title="แก้จำนวน"
                                              >
                                                ✎
                                              </button>
                                            )}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-[#ccc]" title="เฉพาะเบอร์ไข่รวม ไม่แยกต่อ SKU">—</td>
                                      <td className="px-4 py-2.5 text-right">
                                        {editingReadyByItemId === sr.itemId ? (
                                          <select
                                            autoFocus
                                            value={editReadyByValue}
                                            disabled={savingTargetEdit}
                                            onChange={e => setEditReadyByValue(e.target.value)}
                                            onBlur={() => saveTargetReadyBy(sr)}
                                            className="h-7 px-1.5 text-[11.5px] border border-[#1E40AF] rounded bg-white"
                                          >
                                            {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(t => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                          </select>
                                        ) : untargeted ? (
                                          <span className="text-[#ccc]" title="ตั้งเป้าแพ็กก่อนถึงจะกำหนด Ready-by ได้">—</span>
                                        ) : sr.readyBy ? (
                                          <button
                                            onClick={() => { setEditingReadyByItemId(sr.itemId); setEditReadyByValue(sr.readyBy!); }}
                                            className="text-[#888] hover:text-[#1E40AF]"
                                          >
                                            {sr.readyBy}
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => { setEditingReadyByItemId(sr.itemId); setEditReadyByValue("00:00"); }}
                                            className="text-[#991B1B] font-semibold hover:underline"
                                          >
                                            ยังไม่ตั้ง
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </Fragment>
                          );
                        })}
                        {packingSizeRowsFiltered.length > 0 && (
                          <tr className="bg-[#fafbfc] border-t-2 border-[#e5e7eb] font-bold">
                            <td className="px-4 py-2.5 text-[#1a1a1a]">
                              <button onClick={toggleAllExpanded} className="flex items-center gap-1.5">
                                <span className={`text-[10px] text-[#888] transition-transform ${totalsExpanded ? "rotate-90" : ""}`}>›</span>
                                <span>
                                  <div>รวมทั้งวัน</div>
                                  {totalNeedsFix > 0 && (
                                    <div className="flex items-center gap-1 text-[10.5px] font-normal text-[#991B1B] mt-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#991B1B]" /> ต้องแก้ {totalNeedsFix}
                                    </div>
                                  )}
                                </span>
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-right text-[#555]">{aqIncomplete ? "ไม่ครบ" : "ครบ"}</td>
                            <td className={`px-3 py-2.5 text-right tabular-nums ${totalPqRemaining < 0 ? "text-[#92400E]" : "text-[#1a1a1a]"}`}>{fmtNum(totalPqRemaining)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-[#1E40AF]">{fmtNum(totalPtDisplay)}</td>
                            <td className="px-3 py-2.5 text-right text-[#555]">หลายเบอร์</td>
                            <td className="px-4 py-2.5 text-right">
                              {readyByTotals.nearest ? (
                                <>
                                  <div>ถัดไป {readyByTotals.nearest}</div>
                                  <div className="text-[10.5px] text-[#aaa] font-normal">เพิ่ม {fmtNum(readyByTotals.qtyAtNearest)} ฟอง</div>
                                  <div className="text-[10.5px] text-[#aaa] font-normal">{readyByTotals.pointCount} จุด · ถึง {readyByTotals.latest}</div>
                                </>
                              ) : "ยังไม่ตั้ง"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {packingGroupBy === "packSize" && (
                packingRowsByPackSize.length === 0 ? (
                  <div className="py-10 text-center text-[#bbb] text-[13px]">{packingSearchQ ? "ไม่พบที่ตรงกับการค้นหา" : "ยังไม่มีเป้าแพ็กสำหรับวันนี้"}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                          <th className="text-left px-4 py-2">ขนาดแพ็ก</th>
                          <th className="text-right px-3 py-2">{packingCumulative ? "PT สะสมทั้งวัน" : "เป้าเพิ่มรอบนี้"} · ฟอง</th>
                          {packingUnit === "packs" && <th className="text-right px-3 py-2">แพ็ก</th>}
                          <th className="text-right px-3 py-2">จำนวน SKU</th>
                          <th className="text-right px-4 py-2">Ready-by (เร็วสุด)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packingRowsByPackSize.map(r => (
                          <tr key={r.key} className="border-b border-[#f0f0f0] last:border-b-0">
                            <td className="px-4 py-2.5 font-semibold text-[#1a1a1a]">{r.key}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1E40AF]">{fmtNum(r.eggs)}</td>
                            {packingUnit === "packs" && <td className="px-3 py-2.5 text-right tabular-nums text-[#555]">{fmtNum(r.packs)}</td>}
                            <td className="px-3 py-2.5 text-right tabular-nums text-[#555]">{r.skuCount}</td>
                            <td className="px-4 py-2.5 text-right text-[#888]">{r.readyBy ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {packingGroupBy === "readyBy" && (
                packingRowsByReadyBy.length === 0 ? (
                  <div className="py-10 text-center text-[#bbb] text-[13px]">{packingSearchQ ? "ไม่พบที่ตรงกับการค้นหา" : "ยังไม่มีเป้าแพ็กสำหรับวันนี้"}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                          <th className="text-left px-4 py-2">Ready-by</th>
                          <th className="text-right px-3 py-2">{packingCumulative ? "PT สะสมทั้งวัน" : "เป้าเพิ่มรอบนี้"} · ฟอง</th>
                          {packingUnit === "packs" && <th className="text-right px-3 py-2">แพ็ก</th>}
                          <th className="text-right px-4 py-2">จำนวน SKU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packingRowsByReadyBy.map(r => (
                          <tr key={r.key} className="border-b border-[#f0f0f0] last:border-b-0">
                            <td className="px-4 py-2.5 font-semibold text-[#1a1a1a]">{r.key}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1E40AF]">{fmtNum(r.eggs)}</td>
                            {packingUnit === "packs" && (
                              <td className="px-3 py-2.5 text-right tabular-nums text-[#555]">{r.uniformEpp ? fmtNum(r.eggs / r.uniformEpp) : "—"}</td>
                            )}
                            <td className="px-4 py-2.5 text-right tabular-nums text-[#555]">{r.skuCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
            <div className="text-[11px] text-[#aaa] mt-1.5">
              {packingGroupBy === "size"
                ? `"หักใช้ไป" ในคอลัมน์เหลือหลังหักเป้าเป็นตัวเลขวางแผน (จองจากไข่พร้อมใช้) ไม่ใช่การตัดสต็อกจริง — ยังไม่มีระบบบันทึกการเบิกใช้จริง`
                : `ดีมานด์ (AQ/PQ) และซัพพลาย (ไข่พร้อมใช้) ผูกกับเบอร์ไข่เท่านั้น — มุมมองนี้แสดงได้เฉพาะเป้าแพ็กที่ตั้งไว้ สลับกลับไป "เบอร์ไข่" เพื่อดูดีมานด์/ซัพพลาย`}
            </div>

            {/* Next-locked-step reminder + a compact repeat of the command
                bar's own P-R status/workflow pills, down here next to the
                table — same real packingState this whole tab already shares,
                not a second source of truth. "ทบทวนเป้าแพ็ก" expands every
                size that still has a "ต้องแก้" item and scrolls to it. */}
            {(() => {
              const nextLocked = !packingState?.targetConfirmedAt
                ? { label: "แผนวัตถุดิบ", reason: "ส่งเป้าแพ็กก่อน" }
                : !packingState?.materialPlanConfirmedAt
                  ? { label: "ใบสั่งงาน", reason: "ยืนยันแผนวัตถุดิบก่อน" }
                  : null;
              return nextLocked ? (
                <div className="flex items-center gap-2 px-4 py-2.5 mt-3 rounded-xl border border-[#E1E5EA] bg-[#fafbfc] text-[12.5px] text-[#888]">
                  <span>🔒</span>
                  <span className="font-semibold text-[#555]">{nextLocked.label}</span>
                  <span>ล็อกอยู่ — {nextLocked.reason}</span>
                </div>
              ) : null;
            })()}

            <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-[#E1E5EA] px-4 py-2.5 mt-3">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FDF2F8] text-[#BE185D] border border-[#FBCFE8]">
                P-R{packingRound}
              </span>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#555]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    packingState?.workOrderSentAt ? "bg-green-600" : packingState?.targetConfirmedAt || packingState?.materialPlanConfirmedAt ? "bg-[#1a1a1a]" : "bg-[#ccc]"
                  }`}
                />
                {packingState?.workOrderSentAt ? "ส่งแล้ว" : packingState?.targetConfirmedAt || packingState?.materialPlanConfirmedAt ? "กำลังทำ" : "ยังไม่เริ่ม"}
              </span>
              <button
                onClick={() => togglePackingStep("target", !packingState?.targetConfirmedAt)}
                disabled={packingToggling}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 disabled:opacity-50 ${
                  packingState?.targetConfirmedAt ? "bg-[#F0FDF4] border-[#86EFAC] text-green-700" : "bg-white border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                    packingState?.targetConfirmedAt ? "bg-green-600 text-white" : "border border-[#2563EB]"
                  }`}
                >
                  {packingState?.targetConfirmedAt ? "✓" : "①"}
                </span>
                เป้าแพ็ก{!packingState?.targetConfirmedAt && totalNeedsFix > 0 ? ` ข้อมูลไม่ครบ ${totalNeedsFix}` : ""}
              </button>
              <button
                onClick={() => {
                  setExpandedSizes(new Set(packingSizeRowsFiltered.filter(r => (needsFixCountBySize[r.size] ?? 0) > 0).map(r => r.size)));
                  packingTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                disabled={totalNeedsFix === 0}
                className="ml-auto px-3 py-1.5 text-[11.5px] font-semibold rounded-lg border border-[#BE185D] text-[#BE185D] hover:bg-[#FDF2F8] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                ทบทวนเป้าแพ็ก ›
              </button>
            </div>
          </div>

          {/* "แผนวัตถุดิบ" real content — found a genuine spec for this in
              handover/v14_standalone_wip_special_trays.html's "MP · ตรวจวัตถุดิบ"
              module: an auto-generated check shown as a sibling section
              beneath the Packing Target, not a manual confirm step. Scoped
              honestly here to a BOM-completeness check only (does every
              target SKU have a resolvable packaging_profile?) — NOT a
              material-supply/stock check, since no inventory data exists
              anywhere to compute that. Rendered whenever this round has
              targets, same as the reference (reviewed before confirming
              ②, not hidden behind it). See GET /api/packing/material-plan
              and /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md. */}
          {materialPlan && materialPlan.lines.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px] font-bold text-[#1a1a1a]">แผนวัตถุดิบ (ตรวจ BOM)</span>
                <span className="text-[11px] text-[#888]">P-R{packingRound}</span>
              </div>
              {materialPlan.blocking ? (
                <div className="flex items-center gap-2 px-4 py-2.5 mb-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] text-[12.5px] text-[#991B1B]">
                  <span>⚠</span> มี SKU ที่ยังไม่ตั้งค่า BOM/Packaging Profile ครบ — ยืนยัน "②แผนวัตถุดิบ" ไม่ได้จนกว่าจะแก้ไข
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 mb-2 rounded-xl border border-dashed border-[#86EFAC] bg-[#F0FDF4] text-[12.5px] text-green-700">
                  <span>✓</span> ทุก SKU ในรอบนี้มี BOM ครบ — ไม่ใช่การตรวจสต็อกวัตถุดิบจริง (ยังไม่มีระบบสต็อก)
                </div>
              )}
              <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                      <th className="text-left px-4 py-2">สินค้า</th>
                      <th className="text-left px-4 py-2">สถานะ BOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialPlan.lines.map(l => (
                      <tr key={l.targetId} className="border-b border-[#f0f0f0] last:border-b-0">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[11px] text-[#0C447C]">{l.sku}</span>{" "}
                          <span className="text-[#1a1a1a]">{l.itemName}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {l.status === "ready" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">พร้อม</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">ต้องแก้ไข BOM</span>
                              <span className="text-[11px] text-[#888]">{l.issues.join(" · ")}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {materialPlan.materials.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden mt-2">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                        <th className="text-left px-4 py-2">วัตถุดิบ/บรรจุภัณฑ์ที่ต้องใช้</th>
                        <th className="text-left px-3 py-2">ชนิด</th>
                        <th className="text-right px-4 py-2">ต้องใช้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialPlan.materials.map(m => (
                        <tr key={m.componentSku} className="border-b border-[#f0f0f0] last:border-b-0">
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[11px] text-[#0C447C]">{m.componentSku}</span>{" "}
                            <span className="text-[#1a1a1a]">{m.componentName ?? "(ไม่พบใน Master Data)"}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[#888]">{m.itemType ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmtNum(m.totalQtyNeeded)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. บันทึกผลแพ็กจริง (ผลงานเทียบแผน) — real actual-vs-plan. Found
              a real spec for this in handover/v14_standalone_wip_special_trays.html
              (the "PA module") — gated the same way as the ③ใบสั่งงาน button
              above (packingState?.workOrderSentAt), reading only "issued"
              packing_targets lines. No connection to WIP/defect stock —
              confirmed that boundary in the reference too. See
              /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md. */}
          <div>
            <span className="text-[14px] font-bold text-[#1a1a1a]">3. บันทึกผลแพ็กจริง</span>
          </div>
          {!packingState?.workOrderSentAt ? (
            <div role="note" className="flex items-center gap-2.5 text-[12px] text-[#854F0B] border border-dashed border-[#FCD34D] rounded-lg bg-[#FFFBEB] px-4 py-2.5">
              <span>🔒</span>
              <span>บันทึกผลแพ็กได้เมื่อรอบแพ็กของวันนี้ส่งงานแล้ว · ยืนยันเป้าแพ็กและแผนวัตถุดิบ แล้วกดส่งงานในส่วนที่ 2</span>
            </div>
          ) : packingResults.length === 0 ? (
            <div className="py-8 text-center text-[#bbb] text-[13px] bg-white rounded-xl border border-[#E1E5EA]">ไม่มีรายการเป้าแพ็กที่ส่งงานแล้วในรอบนี้</div>
          ) : (() => {
            const totalTarget = packingResults.reduce((s, r) => s + r.targetQtyEggs, 0);
            const enteredRows = packingResults.filter(r => r.actualQtyEggs != null);
            const totalActual = enteredRows.reduce((s, r) => s + (r.actualQtyEggs ?? 0), 0);
            const confirmedCount = packingResults.filter(r => r.status === "confirmed").length;
            const pendingConfirm = enteredRows.filter(r => r.status !== "confirmed").length;
            return (
              <div>
                <div className="flex items-center gap-6 px-4 py-3 mb-2 bg-white rounded-xl border border-[#E1E5EA] flex-wrap">
                  <div>
                    <div className="text-[10px] text-[#aaa]">เป้าแพ็กรวม</div>
                    <div className="text-[17px] font-bold text-[#1a1a1a] tabular-nums">{fmtNum(totalTarget)} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#aaa]">ผลจริงที่บันทึกแล้ว</div>
                    <div className="text-[17px] font-bold text-[#1a1a1a] tabular-nums">
                      {enteredRows.length > 0 ? fmtNum(totalActual) : "—"} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#aaa]">% ของเป้า</div>
                    <div className={`text-[17px] font-bold tabular-nums ${totalActual >= totalTarget && enteredRows.length > 0 ? "text-green-700" : "text-[#1a1a1a]"}`}>
                      {enteredRows.length > 0 && totalTarget > 0 ? `${((totalActual / totalTarget) * 100).toFixed(1)}%` : "—"}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#888]">
                    บันทึกแล้ว {enteredRows.length}/{packingResults.length} รายการ · ยืนยันแล้ว {confirmedCount}
                  </div>
                  <button
                    onClick={confirmAllPackingResults}
                    disabled={pendingConfirm === 0 || confirmingAllResults}
                    className="ml-auto px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {confirmingAllResults ? "กำลังยืนยัน..." : `ยืนยันผลแพ็กจริง${pendingConfirm > 0 ? ` (${pendingConfirm})` : ""}`}
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                        <th className="text-left px-4 py-2">สินค้า</th>
                        <th className="text-right px-3 py-2">เป้าแพ็ก · ฟอง</th>
                        <th className="text-right px-3 py-2">ผลจริง · ฟอง</th>
                        <th className="text-right px-3 py-2">ส่วนต่าง</th>
                        <th className="text-right px-4 py-2">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packingResults.map(r => {
                        const draftValue = resultInputs[r.targetId];
                        const displayValue = draftValue ?? (r.actualQtyEggs != null ? String(r.actualQtyEggs) : "");
                        const hasValue = displayValue !== "";
                        const variance = hasValue ? (Number(displayValue) || 0) - r.targetQtyEggs : 0;
                        return (
                          <tr key={r.targetId} className="border-b border-[#f0f0f0] last:border-b-0">
                            <td className="px-4 py-2.5">
                              <div className="font-mono text-[11px] text-[#0C447C]">{r.sku}</div>
                              <div className="text-[#1a1a1a]">{r.itemName}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-[#555]">{fmtNum(r.targetQtyEggs)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={displayValue}
                                placeholder="กรอกจำนวน"
                                disabled={savingPackingResult === r.targetId}
                                onChange={e => setResultInputs(prev => ({ ...prev, [r.targetId]: e.target.value }))}
                                onBlur={() => {
                                  if (resultInputs[r.targetId] == null) return; // untouched — nothing to save
                                  const raw = resultInputs[r.targetId].trim();
                                  if (raw === "") { setResultInputs(prev => { const n = { ...prev }; delete n[r.targetId]; return n; }); return; }
                                  const val = Number(raw);
                                  if (!Number.isFinite(val)) return;
                                  savePackingResult(r.targetId, val, r.status === "confirmed" ? "confirmed" : "draft").then(() => {
                                    setResultInputs(prev => { const n = { ...prev }; delete n[r.targetId]; return n; });
                                  });
                                }}
                                className="w-24 h-8 px-2 text-right text-[12.5px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                              />
                            </td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${variance < 0 ? "text-[#92400E]" : variance > 0 ? "text-green-700" : "text-[#ccc]"}`}>
                              {variance === 0 ? "—" : variance < 0 ? `ขาด ${fmtNum(Math.abs(variance))}` : `เกิน ${fmtNum(variance)}`}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {r.status === "confirmed" ? (
                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">✓ ยืนยันแล้ว</span>
                              ) : r.actualQtyEggs != null ? (
                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FFFBEB] text-[#854F0B] border border-[#FCD34D]">ร่าง</span>
                              ) : (
                                <span className="text-[10.5px] text-[#ccc]">ยังไม่บันทึก</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {addTargetOpen && (
        <AddPackingTargetModal
          date={date}
          round={packingRound}
          allTargets={packingTargets}
          pqRemainingByItem={pqByItemToday}
          onClose={() => setAddTargetOpen(false)}
          onSaved={() => { setAddTargetOpen(false); fetchPackingTargets(); }}
        />
      )}

      {editTargetRow && (() => {
        const prevRoundsQty = (ptAllRoundsByItem[editTargetRow.itemId] ?? 0) - editTargetRow.qty;
        const pqUnplanned = (pqByItemToday[editTargetRow.itemId] ?? 0) - prevRoundsQty;
        const aqValue = Math.round(aqBySku[editTargetRow.sku] ?? 0);
        return (
          <EditPackingTargetModal
            date={date}
            round={packingRound}
            row={editTargetRow}
            prevRoundsQty={prevRoundsQty}
            pqUnplanned={pqUnplanned}
            aqValue={aqValue}
            onClose={() => setEditTargetRow(null)}
            onSaved={() => { setEditTargetRow(null); fetchPackingTargets(); }}
          />
        );
      })()}

      {bulkReadyByRows && (
        <BulkReadyByModal
          rows={bulkReadyByRows}
          presets={readyByPresets}
          onSavePresets={saveReadyByPresets}
          onClose={() => setBulkReadyByRows(null)}
          applying={bulkApplying}
          onApply={time => applyBulkReadyBy(bulkReadyByRows, time)}
        />
      )}
    </div>
  );
}

// ── Grading — Receiving Lots ──────────────────────────────────────────────────
// Real, persisted (client/src/pages/orders/DailyPlan.tsx ↔ /api/grading/receiving-lots
// ↔ grading_receiving_lots table). Planned/Sent-to-floor/Result-summary are
// honestly static (0 / 0 / "No results yet") — there's no grading-job/allocation
// system yet to derive them from; once one exists, those need to be computed from
// real allocations instead of hardcoded here.

type SubLot = { ref: string; qty: number | null; w: number | null };
type GradeLine = { size: string; qty: number | null };
type GradingLot = {
  id: number;
  lotNo: string;
  recvDate: string;
  farm: string | null;
  material: "raw" | "sized";
  origin: "external" | "grading_return" | null;
  srcJobId: number | null;
  qty: number | null;
  avgWeight: string | null;
  divided: boolean;
  subs: SubLot[];
  gradeLines: GradeLine[];
  note: string | null;
  status: "received" | "rejected";
  rejectedReason: string | null;
  rejectedAt: string | null;
};

const EGG_SIZES = ["0", "1", "2", "3", "4", "5", "6"];
const SUB_REFS = ["A", "B", "C"];

function sizeLabel(s: string): string {
  return s === "mixed" ? "Mixed" : `No.${s}`;
}

// `n` on a contribution is how many real lots it represents — 1 for a single
// confirmed job, but potentially hundreds for the "seed" entry (the historical
// import bundles many real historical lots at this weight into one entry).
type YieldContribution = { qty: number; n: number; sizes: Record<string, number>; defects: Record<string, number> };
type YieldModelRow = {
  weight: number;
  sizes: Record<string, number>; // derived — the weighted blend of every contribution below, not stored directly
  defects: Record<string, number>; // "dirty" | "thin" | "dent" | "crack" | "bag" | "loss" — forecast loss %, by weight
  sum: number | null; // the source data's own declared row total (%), if provided — informational, not recomputed
  active: boolean; // per-row on/off (source data's "State" column) — inactive rows are excluded from matching
  source: "seed" | "actual"; // "seed" = has a historical-import contribution; "actual" = built purely from confirmed jobs
  n: number; // number of contributions (historical import counts as 1) backing this row's percentages
  qtyTotal: number; // total egg qty across all contributions — the % denominator
  contributions: Record<string, YieldContribution>; // key "seed" = historical import; else jobId — one confirmed job's real counts blend in per key, so re-confirming a job replaces its own entry instead of double-counting
};
type YieldModel = {
  id: number;
  name: string;
  predictorUnit: "g" | "kg";
  rows: YieldModelRow[];
  active: boolean;
  publishedAt: string;
};

// Forecast-loss categories a yield model row can carry alongside its size
// distribution. Uses the same ids as GRADING_DEFECTS (dirty/thin/dent/crack/
// bag) plus "loss" (miscellaneous/weighing loss tracked in the historical
// data but with no live entry field) — this keeps seed rows and "actual"
// rows appended by appendActualToYieldHistory (which writes GRADING_DEFECTS
// ids directly) in the same id vocabulary.
const MODEL_DEFECT_CATEGORIES: { id: string; label: string }[] = [
  { id: "dirty", label: "เปื้อน" },
  { id: "thin", label: "บาง" },
  { id: "dent", label: "บุบ" },
  { id: "crack", label: "แตก" },
  { id: "bag", label: "ไข่ถุง" },
  { id: "loss", label: "สูญเสีย" },
];

type GradingJob = {
  id: number;
  lotId: number;
  productionDate: string;
  qty: number;
  machine: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  mixedEggLane: boolean;
  note: string | null;
  status: "planned" | "sent_to_floor";
  sentToFloorAt: string | null;
  createdAt: string;
};

type GradingJobResult = {
  id: number;
  jobId: number;
  actualQty: number | null;
  actualBySub: Record<string, number> | null; // per sub-lot ref, only when the job covers a whole divided lot
  inputNote: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  output: Record<string, number>;
  fgLines: GradingJobResultFgLine[];
  mixedLines: GradingJobResultMixedLine[]; // which two adjacent sizes each part of output.mixed actually is
  ungradedQty: number | null; // eggs left unsorted — real qty, not a loss; auto-creates a new raw lot to re-grade once confirmed
  defects: Record<string, number>;
  // How many of an fgLine's already-recorded trays (for a WIP SKU) used a
  // special tray — a PARTITION of that line's qty, never added on top.
  // componentSku/componentName are the real packaging material the tray
  // count is really about (e.g. C29999P301) — real cumulative usage, not
  // more egg production. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md.
  specialTrayLines: GradingJobResultSpecialTrayLine[];
  weighingLoss: number | null;
  otherVariance: number | null;
  varianceNote: string | null;
  status: "draft" | "confirmed";
  confirmedAt: string | null;
};

type GradingJobResultFgLine = {
  itemId: number;
  sku: string;
  name: string;
  outcome: string; // "0".."5" | "mixed" — never "6", matching the No.6 rule
  qty: number | null;
  unit: string;
  factor: number; // eggs per unit
  baseEggs: number; // qty * factor (0 while qty is blank)
};

type GradingJobResultSpecialTrayLine = {
  itemId: number; sku: string; name: string;
  componentSku: string; componentName: string;
  qty: number; // trays of `itemId`'s already-recorded fgLines qty that used this component — a partition, not additional production
};

type GradingJobResultMixedLine = { range: string; qty: number };

// A Product Master item as returned by GET /api/items — only the fields the
// FG picker needs.
type FgCandidateItem = {
  id: number;
  sku: string | null;
  name: string;
  isEgg: boolean | null;
  itemRole: string | null;
  itemType: string | null;
  primarySize: string | null;
  secondarySize: string | null;
  baseUnit: string | null;
  sellingUnit: string | null;
  packUnit: string | null;
  eggsPerPack: number | null;
  basketUnit: string | null;
  eggsPerBasket: number | null;
  paletteUnit: string | null;
  eggsPerPalette: number | null;
  packagingProfile: unknown;
};

// Real selling units for an FG item, each with its real eggs-per-unit
// conversion factor from the Product Master — never fabricated. "ฟอง ×1" (a
// single egg) is always available since it's definitionally true for any
// egg-counted item. Pack/basket/palette are included only when the item
// actually has both a unit name and a positive factor for that tier.
function unitsForFgItem(item: FgCandidateItem): { unit: string; factor: number }[] {
  const units: { unit: string; factor: number }[] = [{ unit: "ฟอง", factor: 1 }];
  const packUnit = item.packUnit || item.sellingUnit;
  if (packUnit && item.eggsPerPack && item.eggsPerPack > 0 && packUnit !== "ฟอง") {
    units.push({ unit: packUnit, factor: item.eggsPerPack });
  }
  if (item.basketUnit && item.eggsPerBasket && item.eggsPerBasket > 0) {
    units.push({ unit: item.basketUnit, factor: item.eggsPerBasket });
  }
  if (item.paletteUnit && item.eggsPerPalette && item.eggsPerPalette > 0) {
    units.push({ unit: item.paletteUnit, factor: item.eggsPerPalette });
  }
  return units;
}

// Products that can plausibly come out of grading: real egg FG items with a
// known size mapping, PLUS WIP (graded-egg) items — grading into a WIP SKU
// is how a sellable WIP tray balance actually gets produced (see
// /api/grading/wip-stock). secondarySize set → "mixed" (matches the demand
// calc's own convention elsewhere). No.6 items are excluded — No.6 is never
// a real actual outcome anywhere in this app.
function fgOutcomeFor(item: FgCandidateItem): string | null {
  if (!item.isEgg || (item.itemRole !== "FG" && item.itemRole !== "WIP") || !item.primarySize) return null;
  if (item.primarySize === "6") return null;
  return item.secondarySize ? "mixed" : item.primarySize;
}

// A WIP item's own configured "special tray" slot (cover/plastic/lid) from
// its packaging_profile — the real master-data default. Grading a job can
// override which real component was actually used per job (see the "สินค้า
// FG" table's inline selector in RecordActualResultModal) without changing
// this default. Same classification rule as OrderFormPage's trayOfItem and
// MachineJobBoard's specialWipItems fetch.
function specialTraySlotFor(item: { itemRole: string | null; packagingProfile: unknown }): { componentSku: string; itemType: string } | null {
  if (item.itemRole !== "WIP") return null;
  let profile: Record<string, { enabled?: boolean; item_type?: string; component_sku?: string }> = {};
  try {
    const raw = item.packagingProfile;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    profile = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { /* no profile */ }
  const slot = Object.values(profile).find(c => c?.enabled !== false && c?.component_sku && /plastic|cover|lid/i.test(c.item_type ?? ""));
  return slot?.component_sku ? { componentSku: slot.component_sku, itemType: slot.item_type ?? "" } : null;
}

// A single lot/job's contribution to one size's "From today's jobs" total —
// powers the "Sources of No.X" breakdown in Plan Today's Grading. `jobId`/
// `machine`/`seq` are null for a lot-level forecast with no job yet
// (unallocated quantity, or a divided lot's subs before any job exists).
type ForecastSource = {
  size: string;
  lotId: number;
  lotNo: string;
  jobId: number | null;
  machine: string | null;
  seq: number | null;
  stage: string; // "Plan" | "Instruction" | "Draft result" | "Result recorded" | "Unallocated"
  effect: number;
  uses: "forecast" | "actual";
};

type PrintSnapshotRow = {
  jobId: number;
  seq: number;
  lotNo: string | null;
  farm: string | null;
  material: "raw" | "sized" | null;
  avgWeight: string | null;
  divided: boolean;
  subs: { ref: string; qty: number | null; w: number | null }[] | null; // only when divided
  machine: string | null;
  productionDate: string;
  qty: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  jobStatus: "planned" | "sent_to_floor";
  resultStatus: "draft" | "confirmed" | null;
  wiRef: string;
  yieldRef: string | null;
};

// A sentinel tab value — not a real machine name — for the Released Work
// modal's Stock Mover view.
const STOCK_MOVER_TAB = "__stock_mover__";

type StockMoverRow = {
  key: string;
  jobId: number;
  lotNo: string;
  qty: number;
  machine: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  weight: number | null; // kg/300 eggs
  farm: string | null;
};

// Regroups job rows by lot/sub-lot instead of by machine. A divided lot's
// job only has one combined qty/weight at the job level (a job doesn't track
// which sub-lot its eggs came from), but each SUB-LOT does have its own real
// qty and weight recorded at receiving — so those are used directly instead
// of splitting the job's total proportionally, which would be a guess.
function expandToStockMoverRows(rows: PrintSnapshotRow[]): StockMoverRow[] {
  const out: StockMoverRow[] = [];
  for (const r of rows) {
    if (r.divided && r.subs && r.subs.length) {
      for (const sb of r.subs) {
        out.push({
          key: `${r.jobId}-${sb.ref}`,
          jobId: r.jobId,
          lotNo: `${r.lotNo ?? "?"}-${sb.ref}`,
          qty: sb.qty ?? 0,
          machine: r.machine,
          plannedStart: r.plannedStart,
          plannedEnd: r.plannedEnd,
          weight: sb.w,
          farm: r.farm,
        });
      }
    } else {
      out.push({
        key: String(r.jobId),
        jobId: r.jobId,
        lotNo: r.lotNo ?? "—",
        qty: r.qty,
        machine: r.machine,
        plannedStart: r.plannedStart,
        plannedEnd: r.plannedEnd,
        weight: r.avgWeight != null ? Number(r.avgWeight) : null,
        farm: r.farm,
      });
    }
  }
  return out;
}

type GradingPrintEvent = {
  id: number;
  productionDate: string;
  scope: string;
  revision: number;
  jobIds: number[];
  snapshot: PrintSnapshotRow[];
  printedBy: string | null;
  printedAt: string;
};

// Real outcomes an operator can record actual output against — matches the
// design reference's rule that No.6 is legacy/unmapped and is never a valid
// new-actual outcome (it always shows as "unknown", never an entry field).
const ACTUAL_OUTPUT_SIZES = ["0", "1", "2", "3", "4", "5", "mixed"];

// The only valid "which two sizes" a mixed line can report — always two
// adjacent sizes, never a wider or non-adjacent combination.
const MIXED_RANGES = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6"];

const GRADING_DEFECTS: { id: string; label: string }[] = [
  { id: "dirty", label: "เปื้อน" },
  { id: "thin", label: "บาง" },
  { id: "dent", label: "บุบ" },
  { id: "crack", label: "แตก" },
  { id: "bag", label: "ไข่ถุง" },
];
const GRADING_MACHINES = ["Machine 1", "Machine 2", "Machine 3"];

function lotReceived(lot: GradingLot): number {
  if (lot.material === "sized") return lot.gradeLines.reduce((s, g) => s + (g.qty ?? 0), 0);
  if (lot.divided) return lot.subs.reduce((s, sb) => s + (sb.qty ?? 0), 0);
  return lot.qty ?? 0;
}

function chipCls(active: boolean) {
  return `px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
    active ? "bg-[#1E40AF] text-white border-[#1E40AF]" : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999]"
  }`;
}

// A job's position within its own machine+date group — matches the "#N" badge
// on the Machine Job Board and the Floor documents instruction reference.
// `allJobs` must be in the same order it was fetched in (desc createdAt).
function jobSeq(job: GradingJob, allJobs: GradingJob[]): number {
  const group = allJobs.filter(j => j.machine === job.machine && j.productionDate === job.productionDate);
  return group.findIndex(j => j.id === job.id) + 1;
}

// Lower-bound-step weight match against a yield model — same algorithm used
// for "From today's jobs" and the Record Actual Result forecast column.
// `weightKg` is a lot's stored avgWeight: the sample weight of 10 trays (300
// eggs), in kg — NOT a per-egg weight. It's compared directly against the
// yield model's own row thresholds, which are expected in the same 300-egg
// sample basis (converted to the model's unit, g or kg, same as before).
function matchYieldRow(activeModel: YieldModel | null, weightKg: number | null): YieldModelRow | null {
  if (!activeModel || weightKg == null) return null;
  const weightInModelUnit = activeModel.predictorUnit === "g" ? weightKg * 1000 : weightKg;
  // Inactive ("off") rows are excluded — they exist in the source data but
  // aren't validated for matching, same as the uploaded spreadsheet's own
  // State column says. `!== false` (not `r.active` truthy) so rows uploaded
  // before the State column existed — which have no `active` key at all —
  // still default to active, matching the upload flow's own default.
  const sortedRows = activeModel.rows.filter(r => r.active !== false).sort((a, b) => a.weight - b.weight);
  let match: YieldModelRow | null = null;
  for (const r of sortedRows) {
    if (r.weight <= weightInModelUnit) match = r;
    else break;
  }
  return match;
}

// Derives a single egg's average weight (grams) from the stored 300-egg
// sample weight — purely informational display, not used for matching.
function avgEggWeightG(avgWeight: string | null): number | null {
  if (avgWeight == null) return null;
  return (Number(avgWeight) * 1000) / 300;
}

// Sum of a row's sizes + defects percentages — used to derive an honest
// downgrade/loss (qty * (1 - this/100)) instead of only accounting for sizes,
// now that defect categories are also part of a row's percentage total.
function yieldRowAccountedPct(row: YieldModelRow): number {
  const sizesPct = Object.values(row.sizes ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  const defectsPct = Object.values(row.defects ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  return sizesPct + defectsPct;
}

// Forecast (sizes + defects) for a single job. For a non-divided raw lot,
// applies the lot's own weight. For a job covering a WHOLE divided lot, we
// know exactly how much came from each sub-lot (their own recorded qty), so
// blending each sub's own weight and summing is a real forecast, not a
// guess. A job covering only PART of a divided lot has no forecast — there's
// no way to know which sub(s) it drew from, so it stays honestly unavailable
// rather than picking an arbitrary weight.
function forecastForJob(
  activeModel: YieldModel | null,
  lot: GradingLot | undefined,
  jobQty: number,
): { sizes: Record<string, number>; defects: Record<string, number>; accountedTotal: number; matched: boolean } {
  const sizes: Record<string, number> = {};
  const defects: Record<string, number> = {};
  let accountedTotal = 0;
  let matched = false;
  if (!lot || lot.material !== "raw") return { sizes, defects, accountedTotal, matched };

  const applyRow = (qty: number, row: YieldModelRow | null) => {
    if (!row) return;
    matched = true;
    for (const [size, pct] of Object.entries(row.sizes)) {
      const v = qty * (pct / 100);
      sizes[size] = (sizes[size] ?? 0) + v;
      accountedTotal += v;
    }
    for (const [id, pct] of Object.entries(row.defects ?? {})) {
      const v = qty * (pct / 100);
      defects[id] = (defects[id] ?? 0) + v;
      accountedTotal += v;
    }
  };

  if (lot.divided) {
    if (lotReceived(lot) !== jobQty) return { sizes, defects, accountedTotal, matched };
    for (const sb of lot.subs) {
      if (sb.qty == null) continue;
      applyRow(sb.qty, matchYieldRow(activeModel, sb.w));
    }
    return { sizes, defects, accountedTotal, matched };
  }

  const w = lot.avgWeight != null ? Number(lot.avgWeight) : null;
  applyRow(jobQty, matchYieldRow(activeModel, w));
  return { sizes, defects, accountedTotal, matched };
}

// "From today's jobs" — only jobs whose own productionDate is `date` are in
// scope (a job scheduled for another day, or lot quantity with no job at all
// yet, is never counted — it isn't "from today's jobs"). Within that scope,
// blends real actual results with forecast: once a job has a recorded result
// (draft or confirmed), its recorded outcomes (blank = still not recorded, so
// still 0 here — never fabricated) replace the forecast for that job's slice;
// a job with no result yet falls back to the active yield model applied via
// lower-bound-step weight matching. Divided lots can't be FORECASTED per job
// (a job only points at the lot, not a sub-lot, so there's no single weight
// to apply), but a real recorded actual result is counted like any other.
// Shared by Grading > Plan today's grading and Order Planning's "Expected
// available eggs" so both always agree.
function computeGradingFromJobs(
  activeModel: YieldModel | null,
  rawLots: GradingLot[],
  jobs: GradingJob[],
  resultByJobId: Record<number, GradingJobResult>,
  date: string,
) {
  const m: Record<string, number> = {};
  const sources: Record<string, ForecastSource[]> = {};
  let outOfRange = 0;
  let missingWeight = 0;
  let weighed = 0;
  let actualEggs = 0;

  const pushSource = (size: string, effect: number, base: Omit<ForecastSource, "size" | "effect">) => {
    if (effect <= 0) return;
    (sources[size] ??= []).push({ size, effect, ...base });
  };

  const applyForecast = (qty: number | null, w: number | null, base: Omit<ForecastSource, "size" | "effect" | "uses">) => {
    if (qty == null || qty <= 0) return;
    if (!activeModel) return;
    if (w == null) { missingWeight++; return; }
    weighed++;
    const row = matchYieldRow(activeModel, w);
    if (!row) { outOfRange++; return; }
    for (const [size, pct] of Object.entries(row.sizes)) {
      const eggs = qty * (pct / 100);
      m[size] = (m[size] ?? 0) + eggs;
      pushSource(size, eggs, { ...base, uses: "forecast" });
    }
  };

  const applyActual = (result: GradingJobResult, base: Omit<ForecastSource, "size" | "effect" | "uses">) => {
    for (const size of ACTUAL_OUTPUT_SIZES) {
      if (size === "mixed") continue; // broken down by pair below, not as one generic bucket
      const v = result.output[size];
      if (v != null) {
        m[size] = (m[size] ?? 0) + v;
        actualEggs += v;
        pushSource(size, v, { ...base, uses: "actual" });
      }
    }
    // Mixed output is broken down by which two sizes it actually is
    // (result.mixedLines). Any part of output.mixed not covered by a
    // specific line — results recorded before per-pair mixed lines
    // existed — stays in the generic "mixed" bucket rather than
    // guessing which pair it was.
    let specifiedMixed = 0;
    for (const line of result.mixedLines) {
      if (line.qty > 0) {
        m[line.range] = (m[line.range] ?? 0) + line.qty;
        actualEggs += line.qty;
        specifiedMixed += line.qty;
        pushSource(line.range, line.qty, { ...base, stage: `${base.stage} · คละ ${line.range}`, uses: "actual" });
      }
    }
    const unspecifiedMixed = (result.output.mixed ?? 0) - specifiedMixed;
    if (unspecifiedMixed > 0) {
      m.mixed = (m.mixed ?? 0) + unspecifiedMixed;
      actualEggs += unspecifiedMixed;
      pushSource("mixed", unspecifiedMixed, { ...base, uses: "actual" });
    }
    // Eggs graded directly into an FG SKU are real output too — same
    // outcome-size accounting as a loose `output[size]` entry, just
    // packed instead of tallied loose.
    for (const fg of result.fgLines) {
      if (fg.baseEggs > 0) {
        m[fg.outcome] = (m[fg.outcome] ?? 0) + fg.baseEggs;
        actualEggs += fg.baseEggs;
        pushSource(fg.outcome, fg.baseEggs, { ...base, stage: `${base.stage} · FG ${fg.sku}`, uses: "actual" });
      }
    }
  };

  const stageForJob = (job: GradingJob, result: GradingJobResult | undefined) => {
    if (result?.status === "confirmed") return "บันทึกผลจริงแล้ว";
    if (result?.status === "draft") return "ผลจริง (ร่าง)";
    return job.status === "sent_to_floor" ? "ส่งหน้างานแล้ว" : "วางแผน";
  };

  for (const lot of rawLots) {
    if (lot.recvDate > date || lot.status === "rejected") continue;

    // Only jobs scheduled for THIS date are "today's jobs" — a job on
    // another day, or lot quantity with no job at all yet, isn't counted
    // here (that's what the unallocated chip on Receiving Lots is for).
    const lotJobs = jobs.filter(j => j.lotId === lot.id && j.productionDate === date);
    if (!lotJobs.length) continue;

    if (lot.material === "sized") {
      // Sized lots (e.g. a reprocess/re-grading job against already-sized
      // eggs) have no weight to forecast from — there's no yield-model
      // basis for them. Only a real recorded actual result counts here;
      // a sized-lot job with no result yet contributes nothing.
      for (const job of lotJobs) {
        const result = resultByJobId[job.id];
        if (!result) continue;
        applyActual(result, {
          lotId: lot.id,
          lotNo: lot.lotNo,
          jobId: job.id,
          machine: job.machine,
          seq: jobSeq(job, jobs),
          stage: stageForJob(job, result),
        });
      }
      continue;
    }

    if (lot.divided) {
      // A job's actual result (real, recorded output) is counted
      // regardless of which sub-lot it came from — that ambiguity only
      // blocks FORECASTING a job's slice (we can't know which sub's weight
      // to apply), it doesn't block using a real recorded result once one
      // exists. A job with no result yet contributes nothing here (neither
      // fabricated forecast nor phantom actual).
      for (const job of lotJobs) {
        const result = resultByJobId[job.id];
        if (!result) continue;
        applyActual(result, {
          lotId: lot.id,
          lotNo: lot.lotNo,
          jobId: job.id,
          machine: job.machine,
          seq: jobSeq(job, jobs),
          stage: stageForJob(job, result),
        });
      }
      continue;
    }

    const w = lot.avgWeight != null ? Number(lot.avgWeight) : null;
    for (const job of lotJobs) {
      const result = resultByJobId[job.id];
      const base = {
        lotId: lot.id,
        lotNo: lot.lotNo,
        jobId: job.id,
        machine: job.machine,
        seq: jobSeq(job, jobs),
        stage: stageForJob(job, result),
      };
      if (result) {
        applyActual(result, base);
      } else {
        applyForecast(job.qty, w, base);
      }
    }
  }

  return {
    fromJobsBySize: m,
    outOfRangeCount: outOfRange,
    missingWeightCount: missingWeight,
    weighedLotCount: weighed,
    actualEggsCount: actualEggs,
    sourcesBySize: sources,
  };
}

function GradingReceivingLots({
  date,
  lots,
  loading,
  onRefresh,
  jobs,
  onJobsRefresh,
  results,
}: {
  date: string;
  lots: GradingLot[];
  loading: boolean;
  onRefresh: () => void;
  jobs: GradingJob[];
  onJobsRefresh: () => void;
  results: GradingJobResult[];
}) {
  const [chip, setChip] = useState<"relevant" | "queue" | "partial" | "full" | "rejected" | "date">("relevant");
  const [byDate, setByDate] = useState(todayISO());
  const [modalLot, setModalLot] = useState<GradingLot | "new" | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ id: number; top: number; right: number } | null>(null);
  const [jobModalLot, setJobModalLot] = useState<GradingLot | null>(null); // "Add grading job" target
  const [viewJobsLot, setViewJobsLot] = useState<GradingLot | null>(null); // "View grading job" target
  const [detailJob, setDetailJob] = useState<GradingJob | null>(null); // "View detail" target
  const [expandedLotId, setExpandedLotId] = useState<number | null>(null); // sub-lot breakdown toggle
  const [rejectLot, setRejectLot] = useState<GradingLot | null>(null);

  const fetchLots = onRefresh;
  const fetchJobs = onJobsRefresh;

  const unrejectLot = async (id: number) => {
    await fetch(`/api/grading/receiving-lots/${id}/unreject`, { method: "PATCH" });
    fetchLots();
  };

  const lotById = useMemo(() => {
    const m: Record<number, GradingLot> = {};
    for (const l of lots) m[l.id] = l;
    return m;
  }, [lots]);

  const resultByJobId = useMemo(() => {
    const m: Record<number, GradingJobResult> = {};
    for (const r of results) m[r.jobId] = r;
    return m;
  }, [results]);

  const [yieldModels, setYieldModels] = useState<YieldModel[]>([]);
  useEffect(() => {
    fetch("/api/grading/yield-models")
      .then(r => (r.ok ? r.json() : []))
      .then(setYieldModels)
      .catch(() => {});
  }, []);
  const activeModel = yieldModels.find(m => m.active) ?? null;

  const jobsByLotId = useMemo(() => {
    const m: Record<number, GradingJob[]> = {};
    for (const j of jobs) {
      if (!m[j.lotId]) m[j.lotId] = [];
      m[j.lotId].push(j);
    }
    return m;
  }, [jobs]);

  // Scoped to the Daily Plan's selected date (not real-time "now") — matches
  // GradingPlanToday/MachineJobBoard, which are already date-scoped this way.
  const today = date;

  const rows = useMemo(
    () => lots.map(lot => {
      const received = lotReceived(lot);
      const lotJobs = jobsByLotId[lot.id] ?? [];
      // Planned = jobs created but not yet sent to the floor. Sent to floor =
      // jobs the operator has actually dispatched (real status, from the
      // Machine Job Board's "Send to floor" action) — both real now that jobs
      // carry a status.
      const planned = lotJobs.filter(j => j.status !== "sent_to_floor").reduce((s, j) => s + j.qty, 0);
      const sent = lotJobs.filter(j => j.status === "sent_to_floor").reduce((s, j) => s + j.qty, 0);
      // A rejected lot is never plannable — it's its own bucket, not "fully
      // planned" or "to plan".
      const left = lot.status === "rejected" ? 0 : received - planned - sent;
      // "เสร็จ" — real confirmed actual qty (from job results), summed across
      // every job on this lot that has one. "—" (0 here) until at least one
      // job's result is confirmed, same ผลจริง-vs-"sent" distinction used
      // throughout Grading/Packing.
      const done = lotJobs.reduce((s, j) => s + (resultByJobId[j.id]?.actualQty ?? 0), 0);
      return { lot, received, planned, sent, left, done, lotJobs };
    }),
    [lots, jobsByLotId],
  );

  // "To plan" — lots still needing a job planned, received up to today.
  const queueRows = useMemo(
    () => rows.filter(r => r.lot.status !== "rejected" && r.lot.recvDate <= today && r.left > 0),
    [rows, today],
  );
  // "Relevant today" — the default view: lots still needing planning, PLUS
  // lots that already have a job scheduled for today, even once fully
  // planned. Without the second clause a lot vanishes from this view the
  // moment its last job is created — this keeps today's grading activity
  // visible as history instead of disappearing.
  const relevantRows = useMemo(
    () =>
      rows.filter(
        r =>
          r.lot.status !== "rejected" &&
          ((r.lot.recvDate <= today && r.left > 0) ||
            (jobsByLotId[r.lot.id] ?? []).some(j => j.productionDate === today)),
      ),
    [rows, today, jobsByLotId],
  );
  const partialRows: typeof rows = []; // needs 0 < allocated < received; always empty until allocation exists
  // "Fully planned" — every lot with nothing left to plan, not date-scoped
  // (unlike "Relevant today"/"To plan"), matching the chip's own label.
  const fullRows = useMemo(
    () => rows.filter(r => r.lot.status !== "rejected" && r.received > 0 && r.left <= 0),
    [rows],
  );
  const rejectedRows = useMemo(() => rows.filter(r => r.lot.status === "rejected"), [rows]);

  const visible = useMemo(() => {
    if (chip === "date") return rows.filter(r => r.lot.recvDate === byDate);
    if (chip === "queue") return queueRows;
    if (chip === "partial") return partialRows;
    if (chip === "full") return fullRows;
    if (chip === "rejected") return rejectedRows;
    return relevantRows;
  }, [chip, byDate, rows, relevantRows, queueRows, partialRows, fullRows, rejectedRows]);

  const deleteLot = async (id: number) => {
    if (!confirm("ลบล็อตนี้?")) return;
    await fetch(`/api/grading/receiving-lots/${id}`, { method: "DELETE" });
    setMenuAnchor(null);
    fetchLots();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
          2
        </span>
        <span className="text-[15px] font-bold text-[#1a1a1a]">ล็อตที่รับเข้า</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setChip("relevant")} className={chipCls(chip === "relevant")}>
          เกี่ยวข้องวันนี้ · {relevantRows.length}
        </button>
        <button onClick={() => setChip("queue")} className={chipCls(chip === "queue")}>
          รอวางแผน · {queueRows.length}
        </button>
        <button onClick={() => setChip("partial")} className={chipCls(chip === "partial")}>
          วางแผนบางส่วน · {partialRows.length}
        </button>
        <button onClick={() => setChip("full")} className={chipCls(chip === "full")}>
          วางแผนครบแล้ว · {fullRows.length}
        </button>
        <button onClick={() => setChip("rejected")} className={chipCls(chip === "rejected")}>
          ปฏิเสธแล้ว · {rejectedRows.length}
        </button>
        <span className="text-[#e3e5e8]">|</span>
        <button
          onClick={() => setChip("date")}
          className={`text-[12px] font-medium text-[#1E40AF] ${chip === "date" ? "underline" : "hover:underline"}`}
        >
          ตามวันที่รับ
        </button>
        {chip === "date" && (
          <input
            type="date"
            value={byDate}
            onChange={e => setByDate(e.target.value)}
            className="h-7 px-2 text-[12px] border border-[#d6d8dc] rounded-lg"
          />
        )}
        <button
          onClick={() => setModalLot("new")}
          className="ml-auto px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
        >
          + รับล็อตใหม่
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E5EA]">
        {loading ? (
          <div className="py-10 text-center text-[#bbb] text-sm">กำลังโหลด...</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-[#bbb] text-sm">ไม่มีล็อตที่ตรงกับตัวกรองนี้</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#fafbfc] text-[10px] font-semibold text-[#888] uppercase tracking-wide">
                  <th colSpan={4} className="text-left px-4 py-1.5">วัตถุดิบ</th>
                  <th colSpan={4} className="text-left px-3 py-1.5 border-l border-[#e5e7eb]">จำนวน (ฟอง)</th>
                  <th colSpan={3} className="text-left px-3 py-1.5 border-l border-[#e5e7eb]">สถานะงาน · จัดการ</th>
                </tr>
                <tr className="border-b border-[#e5e7eb] bg-[#fafbfc] text-[10px] font-semibold text-[#888] uppercase tracking-wide">
                  <th className="text-left px-4 py-2">ล็อต · แหล่ง</th>
                  <th className="text-left px-3 py-2">วันที่รับ</th>
                  <th className="text-left px-3 py-2">น้ำหนัก</th>
                  <th className="text-left px-3 py-2">ชนิดไข่</th>
                  <th className="text-right px-3 py-2 border-l border-[#e5e7eb]">รับเข้า</th>
                  <th className="text-right px-3 py-2">วางแผนแล้ว</th>
                  <th className="text-right px-3 py-2">คงเหลือ</th>
                  <th className="text-right px-3 py-2">เสร็จ</th>
                  <th className="text-left px-3 py-2 border-l border-[#e5e7eb]">สถานะ · งาน</th>
                  <th className="text-left px-3 py-2">สถานี</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ lot, received, planned, sent, left, done, lotJobs }) => {
                  const hasSubs = lot.divided && lot.subs.length > 0;
                  const expanded = expandedLotId === lot.id;
                  const totalPlanned = planned + sent; // one real "วางแผนแล้ว" figure — job status is shown separately now
                  const graded = lotJobs.some(j => resultByJobId[j.id]);

                  // น้ำหนัก — per-lot avgWeight when uniform, otherwise the
                  // real sub-lot weights (which can differ); sized material
                  // has no raw weight concept of its own.
                  const weightInfo = (() => {
                    if (lot.material === "sized") return { main: "—", sub: `${lot.gradeLines.length} เบอร์` };
                    if (!lot.divided) return { main: lot.avgWeight ? `${Number(lot.avgWeight).toFixed(1)} กก.` : "—", sub: "ทั้งล็อต" };
                    const weights = Array.from(new Set(lot.subs.map(s => s.w).filter(w => w != null)));
                    return {
                      main: weights.length === 1 ? `${Number(weights[0]).toFixed(1)} กก.` : weights.length > 1 ? "หลายน้ำหนัก" : "—",
                      sub: `${lot.subs.length} ล็อตย่อย`,
                    };
                  })();

                  // สถานะ·งาน + สถานี — real, from this lot's jobs. 0/1/many jobs
                  // each get an honest summary (a multi-job lot can't show one
                  // machine/time pair, so it's named as such instead of picking one).
                  const jobInfo = (() => {
                    if (lotJobs.length === 0) return null;
                    if (lotJobs.length === 1) {
                      const j = lotJobs[0];
                      const idx = lotJobs.indexOf(j) + 1;
                      return {
                        statusWord: j.status === "sent_to_floor" ? "✓ ส่งแล้ว" : "○ วางแผนแล้ว",
                        lanePill: j.mixedEggLane ? "คละ" : "คัดเบอร์",
                        sub: j.status === "sent_to_floor" ? "ส่งแล้ว" : "ยังไม่ส่ง",
                        station: j.machine ? `${j.machine} #${idx}` : `#${idx}`,
                        time: j.plannedStart && j.plannedEnd ? `${j.plannedStart}-${j.plannedEnd}` : "—",
                      };
                    }
                    const sentCount = lotJobs.filter(j => j.status === "sent_to_floor").length;
                    return {
                      statusWord: `${lotJobs.length} งาน`,
                      lanePill: null,
                      sub: `ส่งแล้ว ${sentCount} · ยังไม่ส่ง ${lotJobs.length - sentCount}`,
                      station: "หลายเครื่อง",
                      time: `${lotJobs.length} งาน`,
                    };
                  })();

                  return (
                  <Fragment key={lot.id}>
                  <tr className="border-b border-[#f5f5f5] last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-start gap-1.5">
                        <button
                          onClick={() => setExpandedLotId(expanded ? null : lot.id)}
                          disabled={!hasSubs}
                          title={hasSubs ? "แสดงล็อตย่อย" : undefined}
                          className={`mt-0.5 text-[10px] leading-none ${hasSubs ? "text-[#888] hover:text-[#1a1a1a]" : "text-transparent"}`}
                        >
                          {expanded ? "▾" : "▸"}
                        </button>
                        <div>
                          <div className="font-semibold text-[#0C447C]">{lot.lotNo}</div>
                          <div className="text-[11px] text-[#888]">
                            {lot.origin === "grading_return" ? "คืนจากการคัด" : lot.farm || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[#555]">
                      {(() => { const [y, m, d] = lot.recvDate.split("-"); return `${d}/${m}`; })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[#1a1a1a]">{weightInfo.main}</div>
                      <div className="text-[11px] text-[#888]">{weightInfo.sub}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          lot.material === "raw" ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#EEF2FF] text-[#3730A3]"
                        }`}
                      >
                        {lot.material === "raw" ? "ไข่ดิบ" : "คัดเบอร์แล้ว"}
                      </span>
                      {lot.status === "rejected" && (
                        <span className="ml-1 inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] text-[#991B1B]">
                          ปฏิเสธแล้ว
                        </span>
                      )}
                      <div className="text-[11px] text-[#888] mt-0.5">
                        {lot.material === "raw" ? (graded ? "คัดแล้ว" : "ยังไม่คัด") : "รับเป็นเบอร์"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium border-l border-[#f5f5f5]">{fmtNum(received)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${totalPlanned > 0 ? "text-[#1E40AF] font-bold" : "text-[#ccc]"}`}>
                      {fmtNum(totalPlanned)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmtNum(left)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${done > 0 ? "text-[#1a1a1a] font-medium" : "text-[#ccc]"}`}>
                      {done > 0 ? fmtNum(done) : "—"}
                    </td>
                    <td className="px-3 py-2.5 border-l border-[#f5f5f5]">
                      {lot.status === "rejected" ? (
                        <span className="text-[11px] text-[#991B1B]">ปฏิเสธ: {lot.rejectedReason}</span>
                      ) : jobInfo ? (
                        <>
                          <div className="text-[#1a1a1a] font-medium">{jobInfo.statusWord}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {jobInfo.lanePill && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF3DE] text-[#27500A]">{jobInfo.lanePill}</span>
                            )}
                            <span className="text-[11px] text-[#888]">{jobInfo.sub}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[#ccc]">ยังไม่มีงาน</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {jobInfo ? (
                        <>
                          <div className="text-[#1a1a1a]">{jobInfo.station}</div>
                          <div className="text-[11px] text-[#888]">{jobInfo.time}</div>
                        </>
                      ) : (
                        <span className="text-[#ccc]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => jobsByLotId[lot.id]?.length && setViewJobsLot(lot)}
                          disabled={!jobsByLotId[lot.id]?.length}
                          title="ดูงานคัด"
                          className="w-6 h-6 flex items-center justify-center rounded border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          👁
                        </button>
                        <button
                          onClick={() => lot.status !== "rejected" && setJobModalLot(lot)}
                          disabled={lot.status === "rejected"}
                          title="เพิ่มงานคัด"
                          className="w-6 h-6 flex items-center justify-center rounded border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <button
                          onClick={e => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenuAnchor(
                              menuAnchor?.id === lot.id
                                ? null
                                : { id: lot.id, top: r.bottom + 4, right: window.innerWidth - r.right },
                            );
                          }}
                          title="เพิ่มเติม"
                          className="w-6 h-6 flex items-center justify-center rounded border border-[#d6d8dc] text-[#888] hover:bg-[#f5f5f5]"
                        >
                          ⋯
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded && hasSubs && (
                    <tr className="border-b border-[#f5f5f5]">
                      <td colSpan={11} className="px-4 py-3 bg-[#fafbfc]">
                        <table className="w-full max-w-2xl text-[12px]">
                          <thead>
                            <tr className="text-[10px] text-[#888] uppercase tracking-wide">
                              <th className="text-left py-1 pr-3">ล็อตย่อย</th>
                              <th className="text-right py-1 pr-3">น้ำหนักเฉลี่ย (กก./300 ฟอง)</th>
                              <th className="text-right py-1 pr-3">รับเข้า</th>
                              <th className="text-right py-1 pr-3">วางแผนแล้ว</th>
                              <th className="text-right py-1">คงเหลือ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // A job only points at a lot, not a specific sub-lot, so a
                              // sub's own "planned" is only knowable at the two clean
                              // extremes: nothing planned yet (0), or the whole lot
                              // committed to job(s) covering all of it (each sub then
                              // counts as fully planned, since 100% of the lot is
                              // committed). A partial commitment in between can't be
                              // honestly attributed to one sub over another.
                              const lotJobQty = (jobsByLotId[lot.id] ?? []).reduce((s, j) => s + j.qty, 0);
                              const fullyCommitted = lotJobQty >= received && received > 0;
                              const nothingCommitted = lotJobQty === 0;
                              return lot.subs.map(sb => {
                                const subPlanned = fullyCommitted ? (sb.qty ?? 0) : nothingCommitted ? 0 : null;
                                const subRemaining = subPlanned == null ? null : (sb.qty ?? 0) - subPlanned;
                                return (
                                  <tr key={sb.ref} className="border-t border-[#f0f0f0]">
                                    <td className="py-1.5 pr-3 font-semibold text-[#0C447C]">
                                      {lot.lotNo}-{sb.ref}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums text-[#555]">
                                      {sb.w != null ? sb.w : "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmtNum(sb.qty ?? 0)}</td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {subPlanned == null ? (
                                        <span title="ล็อตนี้ถูกวางแผนบางส่วนเท่านั้น — ไม่สามารถระบุว่าเป็นล็อตย่อยใดได้">
                                          —
                                        </span>
                                      ) : (
                                        fmtNum(subPlanned)
                                      )}
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums font-bold">
                                      {subRemaining == null ? "—" : fmtNum(subRemaining)}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {menuAnchor && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuAnchor(null)} />
          <div
            className="fixed z-40 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-56 text-left"
            style={{ top: menuAnchor.top, right: menuAnchor.right }}
          >
            <button
              onClick={() => {
                const lot = lots.find(l => l.id === menuAnchor.id);
                if (lot) setModalLot(lot);
                setMenuAnchor(null);
              }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
            >
              แก้ไขล็อต
            </button>
            {(() => {
              const lot = lots.find(l => l.id === menuAnchor.id);
              if (!lot) return null;
              if (lot.status === "rejected") {
                return (
                  <button
                    onClick={() => {
                      unrejectLot(lot.id);
                      setMenuAnchor(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-[#1E40AF] hover:bg-[#f5f5f5]"
                  >
                    ยกเลิกการปฏิเสธ
                  </button>
                );
              }
              const hasJobs = (jobsByLotId[lot.id] ?? []).length > 0;
              return hasJobs ? (
                <div className="px-3 py-1.5">
                  <div className="text-[12px] text-[#bbb] cursor-not-allowed">ปฏิเสธล็อต</div>
                  <div className="text-[10px] text-[#aaa] mt-0.5">
                    ล็อตนี้มีงานคัดอยู่แล้ว — ลบงานคัดออกก่อน
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRejectLot(lot);
                    setMenuAnchor(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-[#991B1B] hover:bg-[#f5f5f5]"
                >
                  ปฏิเสธล็อต
                </button>
              );
            })()}
            <div className="px-3 py-1.5">
              <div className="text-[12px] text-[#bbb] cursor-not-allowed">ลบล็อตที่รับเข้า</div>
              <div className="text-[10px] text-[#aaa] mt-0.5">
                ล็อตนี้รับเข้าแล้ว — ใช้การปฏิเสธแทนการลบ
              </div>
            </div>
          </div>
        </>
      )}

      {rejectLot && (
        <RejectLotModal
          lot={rejectLot}
          onClose={() => setRejectLot(null)}
          onRejected={() => {
            setRejectLot(null);
            fetchLots();
          }}
        />
      )}

      {modalLot && (
        <ReceiveLotModal
          lot={modalLot === "new" ? null : modalLot}
          onClose={() => setModalLot(null)}
          onSaved={() => {
            setModalLot(null);
            fetchLots();
          }}
        />
      )}

      {jobModalLot && (
        <AddGradingJobModal
          lot={jobModalLot}
          allJobs={jobs}
          onClose={() => setJobModalLot(null)}
          onSaved={() => {
            setJobModalLot(null);
            fetchJobs();
          }}
        />
      )}

      {viewJobsLot && (
        <ViewGradingJobsModal
          lot={viewJobsLot}
          jobs={jobsByLotId[viewJobsLot.id] ?? []}
          onClose={() => setViewJobsLot(null)}
          onAddAnother={() => {
            setJobModalLot(viewJobsLot);
            setViewJobsLot(null);
          }}
          onDeleted={fetchJobs}
          onViewDetail={j => setDetailJob(j)}
        />
      )}

      {detailJob && lotById[detailJob.lotId] && (
        <GradingBatchDetailModal
          job={detailJob}
          lot={lotById[detailJob.lotId]}
          seq={jobSeq(detailJob, jobs)}
          activeModel={activeModel}
          result={resultByJobId[detailJob.id]}
          onClose={() => setDetailJob(null)}
        />
      )}
    </div>
  );
}

// Reject a receiving lot — a real terminal status (↔ PATCH
// /api/grading/receiving-lots/:id/reject), not a delete. The server blocks
// this once the lot has any grading job, so this form only ever opens for a
// still-plannable lot.
function RejectLotModal({
  lot,
  onClose,
  onRejected,
}: {
  lot: GradingLot;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!reason.trim()) return setError("กรุณาระบุเหตุผลในการปฏิเสธล็อตนี้");
    setError("");
    setSaving(true);
    try {
      const r = await fetch(`/api/grading/receiving-lots/${lot.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "ปฏิเสธล็อตไม่สำเร็จ");
        return;
      }
      onRejected();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[17px] font-bold text-[#1a1a1a]">ปฏิเสธล็อต · {lot.lotNo}</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">
              {error}
            </div>
          )}
          <div className="text-[12px] text-[#555]">
            ไข่ {fmtNum(lotReceived(lot))} ฟองจากล็อตนี้จะวางแผนคัดไม่ได้จนกว่าจะยกเลิกการปฏิเสธ
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
              เหตุผล *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="เช่น คุณภาพไม่ผ่าน, ผิดฟาร์ม, เสียหายระหว่างขนส่ง"
              className="w-full px-2.5 py-2 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#991B1B]"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#991B1B] text-white hover:bg-[#7F1D1D] disabled:opacity-50"
          >
            {saving ? "กำลังปฏิเสธ..." : "ปฏิเสธล็อต"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grading job modals (minimal — see grading_jobs schema comment) ───────────────

function AddGradingJobModal({
  lot,
  lots,
  allJobs,
  mode = "machine",
  initialMachine = null,
  onClose,
  onSaved,
}: {
  // Opened from a specific lot's row (existing per-lot flow): `lot` is fixed,
  // no picker shown. Opened from the unified "+ Add job" toolbar (new):
  // `lot` starts null and `lots` (candidates with something left to plan)
  // is shown as a picker step first.
  lot: GradingLot | null;
  lots?: GradingLot[];
  allJobs: GradingJob[];
  // Starting point only — machine vs hand is a toggle inside step "เลือก
  // เครื่อง" itself (jobKind state below), so the per-lot flow gets the same
  // choice the toolbar's two buttons pre-select.
  mode?: "machine" | "hand";
  initialMachine?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedLotId, setSelectedLotId] = useState<number | null>(lot?.id ?? null);
  const [productionDate, setProductionDate] = useState(todayISO());
  const [partial, setPartial] = useState(false);
  const [partialQty, setPartialQty] = useState("");
  // `mode` is only the STARTING point (which entry point/button was clicked)
  // — machine vs hand is picked here, in step 2, regardless of how the
  // dialog was opened, so the per-lot "เพิ่มงานคัด" flow gets the same choice
  // the "+ Add job" toolbar's two buttons offer.
  const [jobKind, setJobKind] = useState<"machine" | "hand">(mode);
  // Hand jobs are machine-less by definition — force null, no picker shown.
  const [machine, setMachine] = useState<string | null>(mode === "hand" ? null : initialMachine);
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [mixedEggLane, setMixedEggLane] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Candidate lots for the picker — real remaining-to-plan qty > 0 only.
  // Hand jobs typically pair already-sized stock (see the "mixed 3–4 from
  // identifiable sized eggs" note in the toolbar below), but nothing stops
  // picking a raw lot here — this app doesn't model that constraint yet.
  const pickable = useMemo(() => {
    if (lot || !lots) return [];
    return lots.filter(l => l.status !== "rejected" && lotReceived(l) - allJobs.filter(j => j.lotId === l.id).reduce((s, j) => s + j.qty, 0) > 0);
  }, [lot, lots, allJobs]);

  const resolvedLot = lot ?? lots?.find(l => l.id === selectedLotId) ?? null;

  const received = resolvedLot ? lotReceived(resolvedLot) : 0;
  const alreadyPlanned = resolvedLot ? allJobs.filter(j => j.lotId === resolvedLot.id).reduce((s, j) => s + j.qty, 0) : 0;
  const remaining = received - alreadyPlanned;
  const qty = partial ? Number(partialQty) || 0 : remaining;
  let stepN = 0;

  // Real occupancy per machine, scoped to this job's production date — derived
  // from actual saved jobs, not fabricated capacity/status data.
  const machineStats = useMemo(() => {
    const m: Record<string, { jobs: number; eggs: number }> = {};
    for (const j of allJobs) {
      if (j.productionDate !== productionDate || !j.machine) continue;
      if (!m[j.machine]) m[j.machine] = { jobs: 0, eggs: 0 };
      m[j.machine].jobs++;
      m[j.machine].eggs += j.qty;
    }
    return m;
  }, [allJobs, productionDate]);

  const save = async () => {
    setError("");
    if (!resolvedLot) return setError("กรุณาเลือกล็อตก่อน");
    if (qty <= 0) return setError("จำนวนไข่ต้องมากกว่า 0");
    setSaving(true);
    try {
      const r = await fetch("/api/grading/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: resolvedLot.id,
          productionDate,
          qty,
          machine,
          plannedStart: plannedStart || null,
          plannedEnd: plannedEnd || null,
          mixedEggLane,
          note: note || null,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[17px] font-bold text-[#1a1a1a]">
              {jobKind === "hand" ? "งานมือ" : "งานคัดไข่"} · {productionDate.slice(5).split("-").reverse().join("/")}
            </h2>
            {resolvedLot && (
              <span
                className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                  resolvedLot.material === "raw" ? "bg-[#1E40AF] text-white" : "bg-[#EEF2FF] text-[#3730A3]"
                }`}
              >
                {resolvedLot.material === "raw" ? "ปกติ" : "รีโปรเซส"}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">
              {error}
            </div>
          )}

          {!lot && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{++stepN}</span>
                <span className="text-[13px] font-bold text-[#1a1a1a]">เลือกล็อต</span>
              </div>
              <div className="ml-7">
                {pickable.length === 0 ? (
                  <div className="text-[12px] text-[#aaa]">ไม่มีล็อตที่เหลือให้วางแผน</div>
                ) : (
                  <select
                    value={selectedLotId ?? ""}
                    onChange={e => setSelectedLotId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-9 px-2 text-[13px] border border-[#d6d8dc] rounded-lg bg-white"
                  >
                    <option value="">— เลือกล็อต —</option>
                    {pickable.map(l => {
                      const rem = lotReceived(l) - allJobs.filter(j => j.lotId === l.id).reduce((s, j) => s + j.qty, 0);
                      return (
                        <option key={l.id} value={l.id}>
                          ล็อต {l.lotNo} · รับ {l.recvDate}{l.farm ? ` · ${l.farm}` : ""} · เหลือ {fmtNum(rem)} ฟอง
                          {l.material === "sized" ? " · รีโปรเซส" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>
          )}

          <div className={lot ? "" : "border-t border-[#f0f0f0] pt-4"}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{++stepN}</span>
              <span className="text-[13px] font-bold text-[#1a1a1a]">{lot ? "เลือกล็อตที่จะคัด" : "จำนวน"}</span>
            </div>
            {!resolvedLot ? (
              <div className="ml-7 text-[12px] text-[#aaa]">เลือกล็อตก่อนเพื่อกำหนดจำนวน</div>
            ) : (
              <div className="ml-7 space-y-1">
                <div className="text-[13px]">
                  <span className="font-bold text-[#0C447C]">ล็อต {resolvedLot.lotNo}</span>{" "}
                  <span className="text-[#888]">· รับ {resolvedLot.recvDate}{resolvedLot.farm ? ` · ${resolvedLot.farm}` : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] flex-wrap">
                  <span className="font-semibold text-[#1a1a1a]">
                    {partial ? "คัดบางส่วน" : "คัดทั้งล็อต"}{" "}
                    <b className="tabular-nums">{fmtNum(partial ? qty : remaining)}</b> ฟอง
                  </span>
                  <button onClick={() => setPartial(p => !p)} className="text-[12px] font-semibold text-[#1E40AF] hover:underline">
                    {partial ? "คัดทั้งล็อตแทน" : "ระบุจำนวนบางส่วน"}
                  </button>
                </div>
                {partial && (
                  <input
                    type="number"
                    value={partialQty}
                    onChange={e => setPartialQty(e.target.value)}
                    placeholder={`ไม่เกิน ${fmtNum(remaining)}`}
                    className="w-40 h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg"
                  />
                )}
                <div className="text-[11px] text-[#aaa]">เหลือให้วางแผน {fmtNum(remaining)} ฟองสำหรับล็อตนี้</div>
              </div>
            )}
          </div>

          <div className="border-t border-[#f0f0f0] pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{++stepN}</span>
              <span className="text-[13px] font-bold text-[#1a1a1a]">เลือกเครื่อง</span>
            </div>
            <div className="ml-7 space-y-3">
              <div className="inline-flex rounded-lg border border-[#d6d8dc] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setJobKind("machine")}
                  className={`px-3 py-1.5 text-[12px] font-semibold ${
                    jobKind === "machine" ? "bg-[#1E40AF] text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"
                  }`}
                >
                  คัดด้วยเครื่อง
                </button>
                <button
                  type="button"
                  onClick={() => { setJobKind("hand"); setMachine(null); }}
                  className={`px-3 py-1.5 text-[12px] font-semibold border-l border-[#d6d8dc] ${
                    jobKind === "hand" ? "bg-[#1E40AF] text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"
                  }`}
                >
                  คัดด้วยมือ
                </button>
              </div>

              {jobKind === "machine" ? (
                <div className="grid grid-cols-2 gap-2">
                  {GRADING_MACHINES.map(m => {
                    const stat = machineStats[m];
                    const selected = machine === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setMachine(selected ? null : m)}
                        className={`text-left px-3 py-2.5 rounded-lg border ${
                          selected ? "border-[#1E40AF] bg-[#EFF6FF]" : "border-[#e3e5e8] hover:border-[#999]"
                        }`}
                      >
                        <div className="text-[13px] font-bold text-[#1a1a1a]">{m}</div>
                        <div className="text-[11px] text-[#888]">
                          {stat ? `${stat.jobs} งาน · ${fmtNum(stat.eggs)} ฟอง` : "ยังไม่มีงาน"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-[#aaa]">
                  งานมือไม่ผูกกับเครื่อง — จะแสดงอยู่ในหัวข้อ "Hand jobs" แทน "Machine jobs"
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#f0f0f0] pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{++stepN}</span>
              <span className="text-[13px] font-bold text-[#1a1a1a]">เวลาตามแผน</span>
            </div>
            <div className="ml-7 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-[12px] text-[#555]">
                เริ่ม
                <input
                  type="time"
                  value={plannedStart}
                  onChange={e => setPlannedStart(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg"
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#555]">
                สิ้นสุด
                <input
                  type="time"
                  value={plannedEnd}
                  onChange={e => setPlannedEnd(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg"
                />
              </label>
            </div>
            <label className="ml-7 mt-3 flex items-center gap-2 text-[13px] text-[#1a1a1a] cursor-pointer">
              <input
                type="checkbox"
                checked={mixedEggLane}
                onChange={e => setMixedEggLane(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1E40AF]"
              />
              ใช้ช่องไข่คละเบอร์
            </label>
          </div>

          <div className="border-t border-[#f0f0f0] pt-3">
            {showNote ? (
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="หมายเหตุ"
                className="w-full px-2.5 py-2 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            ) : (
              <button onClick={() => setShowNote(true)} className="text-[12px] font-semibold text-[#1E40AF] hover:underline">
                + หมายเหตุ
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving || !resolvedLot || qty <= 0}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกงานคัด"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewGradingJobsModal({
  lot,
  jobs,
  onClose,
  onAddAnother,
  onDeleted,
  onViewDetail,
}: {
  lot: GradingLot;
  jobs: GradingJob[];
  onClose: () => void;
  onAddAnother: () => void;
  onDeleted: () => void;
  onViewDetail: (job: GradingJob) => void;
}) {
  const remove = async (id: number) => {
    if (!confirm("ลบงานคัดนี้?")) return;
    await fetch(`/api/grading/jobs/${id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[17px] font-bold text-[#1a1a1a]">งานคัด — ล็อต {lot.lotNo}</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-2">
          {jobs.map(j => (
            <div key={j.id} className="flex items-start justify-between px-3 py-2.5 border border-[#e3e5e8] rounded-lg">
              <div>
                <div className="text-[13px] font-semibold text-[#1a1a1a]">
                  {j.productionDate} · <span className="tabular-nums">{fmtNum(j.qty)}</span> ฟอง
                </div>
                <div className="text-[11px] text-[#888]">
                  {j.machine || "ไม่ระบุเครื่อง"}
                  {(j.plannedStart || j.plannedEnd) && ` · ${j.plannedStart ?? "—"}–${j.plannedEnd ?? "—"}`}
                  {j.mixedEggLane && " · ช่องไข่คละเบอร์"}
                  {j.note && ` · ${j.note}`}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onViewDetail(j)}
                  className="text-[11px] font-semibold text-[#1E40AF] hover:underline"
                >
                  ดูรายละเอียด
                </button>
                <button
                  onClick={() => remove(j.id)}
                  className="text-[11px] font-semibold text-[#c0392b] hover:underline"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
          <div className="text-[11px] text-[#999] pt-1">
            "ดูรายละเอียด" แสดงข้อมูลตามแผนและผลผลิตที่คาดการณ์/จริงของงานนี้ งานยังปรากฏบน Machine Job Board
            และสามารถบันทึกผลจริงได้ที่นั่น
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e5e7eb]">
          <button onClick={onAddAnother} className="text-[12px] font-semibold text-[#1E40AF] hover:underline">
            + เพิ่มงานอีกรายการ
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grading batch detail ──────────────────────────────────────────────────────
// Reachable from Receiving Lots ("View detail" on a job) so a lot's grading
// history stays inspectable after it's fully planned, not just visible in the
// list. Shows real planned info (machine/seq/time/farm/qty) plus output: if
// this job has a recorded actual result, that's shown (labelled honestly as
// draft or confirmed); otherwise a forecast from the active yield model, same
// lower-bound-step match used everywhere else. "Downgrade/loss" for the
// forecast is genuinely derived — the gap between qty and the model's own
// size percentages, which only appears if an uploaded model's row doesn't sum
// to 100%, never fabricated. "Plan dependent Reprocess" (claiming this job's
// output into a new grading_return receiving lot) isn't built — gating it on
// "confirmed actual result" would be real, but the claim/consume workflow
// itself doesn't exist yet, so it stays honestly disabled.
const SIZE_CHIP_COLORS: Record<string, string> = {
  "0": "bg-[#FEF3E2] text-[#9A5B13]",
  "1": "bg-[#FEF9E2] text-[#8A6D0B]",
  "2": "bg-[#FBFEE2] text-[#6B7A0B]",
  "3": "bg-[#E9FBE9] text-[#22733A]",
  "4": "bg-[#E2FBEE] text-[#0F7A5C]",
  "5": "bg-[#E2F4FB] text-[#0C5F8A]",
  "6": "bg-[#EDEEFB] text-[#4442A0]",
  mixed: "bg-[#F0F0F0] text-[#555]",
};

function GradingBatchDetailModal({
  job,
  lot,
  seq,
  activeModel,
  result,
  onClose,
}: {
  job: GradingJob;
  lot: GradingLot;
  seq: number;
  activeModel: YieldModel | null;
  result: GradingJobResult | undefined;
  onClose: () => void;
}) {
  // "Sample weight" display only — a divided lot has no single weight, so
  // this stays "—" for one even though its forecast (below) can still work
  // by blending each sub's own weight.
  const weightKg = lot.material === "raw" && !lot.divided && lot.avgWeight != null ? Number(lot.avgWeight) : null;

  const { sizes: projectedBySize, defects: projectedDefects, accountedTotal: projectedTotal, matched: hasForecast } =
    forecastForJob(activeModel, lot, job.qty);
  // Loss accounts for the model's own defect categories too, not just sizes
  // — a row's sizes+defects rarely sum to exactly 100%, and the gap is the
  // model's own declared unaccounted remainder (see `sum`), not fabricated.
  const projectedLoss = hasForecast ? Math.max(0, job.qty - projectedTotal) : 0;
  const isPartialDividedLot = lot.divided && lotReceived(lot) !== job.qty;

  const hasActual = !!result;
  const actualInput = result?.actualQty ?? job.qty;
  // Eggs graded straight into an FG SKU (result.fgLines) count toward their
  // outcome size the same as a loose `output[size]` entry — merged here so
  // the chip totals and reconciliation don't silently exclude packed eggs.
  const actualFgBySize: Record<string, number> = {};
  if (hasActual) {
    for (const fg of result!.fgLines) {
      if (fg.baseEggs > 0) actualFgBySize[fg.outcome] = (actualFgBySize[fg.outcome] ?? 0) + fg.baseEggs;
    }
  }
  const actualTotal = hasActual
    ? ACTUAL_OUTPUT_SIZES.reduce((s, sz) => s + (result!.output[sz] ?? 0) + (actualFgBySize[sz] ?? 0), 0)
    : 0;
  const defectAndVarianceTotal = hasActual
    ? GRADING_DEFECTS.reduce((s, c) => s + (result!.defects[c.id] ?? 0), 0) +
      (result!.weighingLoss ?? 0) +
      (result!.otherVariance ?? 0)
    : 0;
  const actualLoss = Math.max(0, actualInput - actualTotal - defectAndVarianceTotal);

  const outputRows = ["0", "1", "2", "3", "4", "5", "6", "mixed"];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-[#1a1a1a]">รายละเอียดงานคัด · ล็อต {lot.lotNo}</h2>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                job.status === "sent_to_floor"
                  ? "bg-[#F0FDF4] text-green-700 border border-[#86EFAC]"
                  : "bg-[#EFF2F7] text-[#555]"
              }`}
            >
              {job.status === "sent_to_floor" ? "ส่งหน้างานแล้ว" : "วางแผนแล้ว"}
            </span>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-0.5">เครื่อง · ลำดับ</div>
              <div className="text-[13px] font-bold text-[#1a1a1a]">{job.machine ?? "—"} · #{seq}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-0.5">เวลาตามแผน</div>
              <div className="text-[13px] font-bold text-[#1a1a1a]">
                {job.plannedStart && job.plannedEnd ? `${job.plannedStart}–${job.plannedEnd}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-0.5">ฟาร์ม</div>
              <div className="text-[13px] font-bold text-[#1a1a1a]">{lot.farm ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-0.5">น้ำหนักตัวอย่าง</div>
              <div className="text-[13px] font-bold text-[#1a1a1a]">
                {weightKg != null
                  ? `${weightKg.toFixed(2)}kg/300 (≈${avgEggWeightG(lot.avgWeight)?.toFixed(0)}g/ฟอง)`
                  : "—"}
              </div>
            </div>
          </div>

          <div className="border-t border-[#f0f0f0] pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-0.5">จำนวนเข้าเครื่องตามแผน</div>
            <div className="text-[18px] font-bold tabular-nums text-[#1a1a1a]">{fmtNum(job.qty)} ฟอง</div>
          </div>

          <div className="border-t border-[#f0f0f0] pt-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-bold text-[#1a1a1a] uppercase tracking-wide">
                {hasActual ? `ผลผลิต${result!.status === "confirmed" ? "จริง" : "จริง (ร่าง)"}` : "ผลผลิตที่คาดการณ์"}
              </span>
              <span className="text-[12px] font-bold tabular-nums text-[#1a1a1a]">
                · รวม {fmtNum(hasActual ? actualTotal : projectedTotal)} ฟอง
              </span>
            </div>
            {!hasActual && !activeModel && (
              <div className="text-[11px] text-[#854F0B] font-semibold mb-2">ยังไม่มีประวัติผลผลิตที่ใช้งาน — ไม่สามารถคาดการณ์ได้</div>
            )}
            {!hasActual && activeModel && !hasForecast && isPartialDividedLot && (
              <div className="text-[11px] text-[#854F0B] font-semibold mb-2">
                งานนี้คัดเพียงบางส่วนของล็อตที่แบ่งย่อย — ไม่สามารถคาดการณ์ได้ (ไม่ทราบว่าใช้น้ำหนักของล็อตย่อยใด)
              </div>
            )}
            {!hasActual && activeModel && !hasForecast && !isPartialDividedLot && (
              <div className="text-[11px] text-[#854F0B] font-semibold mb-2">
                ล็อตนี้ไม่มีน้ำหนักหรือน้ำหนักอยู่นอกช่วงของโมเดล — ไม่สามารถคาดการณ์ได้
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              {outputRows.map(size => {
                const isSix = size === "6";
                const wipV = hasActual ? result!.output[size] : undefined;
                const fgV = hasActual ? actualFgBySize[size] : undefined;
                const value = hasActual
                  ? isSix
                    ? null // No.6 is never a real actual outcome — matches Record Actual Result
                    : wipV != null || fgV != null
                      ? (wipV ?? 0) + (fgV ?? 0)
                      : null
                  : (projectedBySize[size] ?? (hasForecast ? 0 : null));
                return (
                  <div key={size} className={`rounded-lg px-2.5 py-2 ${SIZE_CHIP_COLORS[size]}`}>
                    <div className="text-[10px] font-semibold uppercase">{size === "mixed" ? "คละ" : `เบอร์ ${size}`}</div>
                    <div className="text-[14px] font-bold tabular-nums">
                      {value == null ? (isSix && hasActual ? "ไม่ทราบ" : "—") : fmtNum(value)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-[#c0392b] font-semibold mt-2">
              ของเสีย/ส่วนสูญเสีย · {fmtNum(hasActual ? actualLoss : projectedLoss)} ฟอง
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {hasActual
                ? [...GRADING_DEFECTS.map(c => ({ id: c.id, label: c.label, value: result!.defects[c.id] })),
                   { id: "weigh", label: "สูญเสียจากการชั่ง", value: result!.weighingLoss ?? undefined },
                   { id: "othervar", label: "ส่วนต่างอื่น", value: result!.otherVariance ?? undefined }]
                    .filter(c => c.value != null)
                    .map(c => (
                      <div key={c.id} className="rounded-lg px-2.5 py-1.5 bg-[#FEF2F2] text-[#991B1B]">
                        <div className="text-[9px] font-semibold uppercase">{c.label}</div>
                        <div className="text-[12px] font-bold tabular-nums">{fmtNum(c.value!)}</div>
                      </div>
                    ))
                : hasForecast &&
                  MODEL_DEFECT_CATEGORIES.filter(c => projectedDefects[c.id] != null).map(c => (
                    <div key={c.id} className="rounded-lg px-2.5 py-1.5 bg-[#FEF2F2] text-[#991B1B]">
                      <div className="text-[9px] font-semibold uppercase">{c.label}</div>
                      <div className="text-[12px] font-bold tabular-nums">{fmtNum(projectedDefects[c.id])}</div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="border-t border-[#f0f0f0] pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-0.5">คำสั่งงาน</div>
            <div className="text-[12.5px] font-mono text-[#1a1a1a]">
              WI-G-{job.productionDate.replace(/-/g, "")}-{String(seq).padStart(3, "0")}
            </div>
          </div>

          <div
            className="border-t border-[#f0f0f0] pt-3"
            title="ยังไม่พร้อมใช้งาน — จะสร้างล็อตรับเข้าแบบคืนจากการคัดใหม่โดยอ้างอิงผลผลิตของงานนี้ เมื่อผลจริงถูกยืนยันแล้ว"
          >
            <button disabled className="w-full px-3 py-2 text-[12px] font-semibold rounded-lg border border-[#e3e5e8] text-[#bbb] cursor-not-allowed">
              วางแผนรีโปรเซสต่อเนื่อง
            </button>
            <div className="text-[10px] text-[#aaa] mt-1">
              นำผลผลิตของงานนี้ไปสร้างล็อตรีโปรเซส — ยังไม่พร้อมใช้งาน ต้องมีผลจริงที่ยืนยันแล้วก่อน
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-[#e5e7eb]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiveLotModal({
  lot,
  onClose,
  onSaved,
}: {
  lot: GradingLot | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = lot === null;
  const [lotNo, setLotNo] = useState(lot?.lotNo ?? "");
  const [recvDate, setRecvDate] = useState(lot?.recvDate ?? todayISO());
  const [farm, setFarm] = useState(lot?.farm ?? "");
  const [material, setMaterial] = useState<"raw" | "sized">(lot?.material ?? "raw");
  const [origin, setOrigin] = useState<"external" | "grading_return">(lot?.origin ?? "external");
  const [srcJobId, setSrcJobId] = useState<string>(lot?.srcJobId != null ? String(lot.srcJobId) : "");
  const [divided, setDivided] = useState(lot?.divided ?? false);
  const [qty, setQty] = useState(lot?.qty != null ? String(lot.qty) : "");
  const [avgWeight, setAvgWeight] = useState(lot?.avgWeight ?? "");
  const [subs, setSubs] = useState<SubLot[]>(lot?.subs?.length ? lot.subs : [{ ref: "A", qty: null, w: null }]);
  const [gradeLines, setGradeLines] = useState<GradeLine[]>(
    lot?.gradeLines?.length ? lot.gradeLines : [{ size: "3", qty: null }],
  );
  const [note, setNote] = useState(lot?.note ?? "");
  const [showRemarks, setShowRemarks] = useState(!!lot?.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subsTotal = subs.reduce((s, sb) => s + (sb.qty ?? 0), 0);
  const gradeTotal = gradeLines.reduce((s, g) => s + (g.qty ?? 0), 0);

  const addSub = () => {
    if (subs.length >= 3) return;
    const used = new Set(subs.map(s => s.ref));
    const nextRef = SUB_REFS.find(r => !used.has(r)) ?? "A";
    setSubs([...subs, { ref: nextRef, qty: null, w: null }]);
  };
  const removeSub = (idx: number) => {
    const next = subs.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ref: SUB_REFS[i] }));
    setSubs(next);
    if (next.length === 0) setDivided(false);
  };

  const addGradeLine = () => {
    const used = new Set(gradeLines.map(g => g.size));
    const nextSize = EGG_SIZES.find(s => !used.has(s)) ?? EGG_SIZES[0];
    setGradeLines([...gradeLines, { size: nextSize, qty: null }]);
  };
  const removeGradeLine = (idx: number) => {
    const next = gradeLines.filter((_, i) => i !== idx);
    setGradeLines(next.length ? next : [{ size: EGG_SIZES[0], qty: null }]);
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const body = {
        lotNo,
        recvDate,
        farm: material === "sized" && origin === "grading_return" ? null : farm,
        material,
        origin: material === "sized" ? origin : null,
        srcJobId: material === "sized" && origin === "grading_return" && srcJobId ? Number(srcJobId) : null,
        divided: material === "raw" && divided,
        qty: material === "raw" && !divided ? (qty === "" ? null : Number(qty)) : null,
        avgWeight: material === "raw" && !divided ? avgWeight || null : null,
        subs: material === "raw" && divided ? subs : [],
        gradeLines: material === "sized" ? gradeLines : [],
        note: note || null,
      };
      const url = isNew ? "/api/grading/receiving-lots" : `/api/grading/receiving-lots/${lot!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[19px] font-bold text-[#1a1a1a]">{isNew ? "รับล็อตใหม่" : `แก้ไขล็อต ${lot!.lotNo}`}</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">
              {error}
            </div>
          )}

          <div>
            <div className="text-[13px] font-bold text-[#1a1a1a] mb-2.5">ข้อมูลล็อต</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                  เลขที่ล็อต *
                </label>
                <input
                  value={lotNo}
                  onChange={e => setLotNo(e.target.value)}
                  placeholder="เช่น 7011"
                  className="w-full h-9 px-2.5 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                  วันที่รับเข้า *
                </label>
                <input
                  type="date"
                  value={recvDate}
                  onChange={e => setRecvDate(e.target.value)}
                  className="w-full h-9 px-2.5 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
              </div>
              {material === "sized" && origin === "grading_return" ? (
                <div>
                  <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                    งานคัดต้นทาง
                  </label>
                  <select
                    disabled
                    className="w-full h-9 px-2.5 text-[13px] border border-[#d6d8dc] rounded-lg bg-[#f5f5f5] text-[#aaa]"
                  >
                    <option>ยังไม่มีงานคัดให้เลือก</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                    ฟาร์ม / แหล่ง *
                  </label>
                  <input
                    value={farm}
                    onChange={e => setFarm(e.target.value)}
                    className="w-full h-9 px-2.5 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                  />
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1.5">
                ประเภทวัตถุดิบ
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                  <input
                    type="radio"
                    checked={material === "raw"}
                    onChange={() => setMaterial("raw")}
                    className="accent-[#1E40AF]"
                  />
                  ไข่ดิบ
                </label>
                <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                  <input
                    type="radio"
                    checked={material === "sized"}
                    onChange={() => setMaterial("sized")}
                    className="accent-[#1E40AF]"
                  />
                  ไข่คัดเบอร์แล้ว
                </label>
              </div>
            </div>

            {material === "sized" && (
              <div className="mt-3">
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1.5">
                  แหล่งที่มาของไข่คัดเบอร์แล้ว
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      checked={origin === "external"}
                      onChange={() => setOrigin("external")}
                      className="accent-[#1E40AF]"
                    />
                    ซื้อ / ภายนอก
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      checked={origin === "grading_return"}
                      onChange={() => setOrigin("grading_return")}
                      className="accent-[#1E40AF]"
                    />
                    คืนจากการคัด (รอรีโปรเซส)
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#f0f0f0] pt-4">
            <div className="text-[13px] font-bold text-[#1a1a1a] mb-2.5">จำนวนรับเข้า</div>

            {material === "raw" ? (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      checked={!divided}
                      onChange={() => setDivided(false)}
                      className="accent-[#1E40AF]"
                    />
                    ล็อตเดียว
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      checked={divided}
                      onChange={() => setDivided(true)}
                      className="accent-[#1E40AF]"
                    />
                    แบ่งล็อตย่อยจริง
                  </label>
                </div>

                {!divided ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                        จำนวนรับเข้า (ฟอง) *
                      </label>
                      <input
                        type="number"
                        value={qty}
                        onChange={e => setQty(e.target.value)}
                        className="w-full h-9 px-2.5 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                        น้ำหนักเฉลี่ย (กก. / 300 ฟอง)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={avgWeight}
                        onChange={e => setAvgWeight(e.target.value)}
                        className="w-full h-9 px-2.5 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                      />
                      <div className="text-[10px] text-[#aaa] mt-1">น้ำหนัก 10 ถาด (300 ฟอง) — ไม่ใช่น้ำหนักต่อฟอง</div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#e3e5e8] rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 px-3 py-1.5 bg-[#fafbfc] border-b border-[#e3e5e8] text-[10px] font-semibold text-[#888] uppercase">
                      <span>ล็อตย่อย</span>
                      <span>จำนวน (ฟอง)</span>
                      <span>น้ำหนัก (กก./300 ฟอง)</span>
                      <span />
                    </div>
                    {subs.map((sb, i) => (
                      <div
                        key={sb.ref}
                        className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 px-3 py-2 items-center border-b border-[#f0f0f0] last:border-b-0"
                      >
                        <span className="text-[13px] font-semibold">{lotNo || "—"}-{sb.ref}</span>
                        <input
                          type="number"
                          value={sb.qty ?? ""}
                          onChange={e =>
                            setSubs(
                              subs.map((s, j) =>
                                j === i ? { ...s, qty: e.target.value === "" ? null : Number(e.target.value) } : s,
                              ),
                            )
                          }
                          className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded"
                        />
                        <input
                          type="number"
                          step="0.001"
                          value={sb.w ?? ""}
                          onChange={e =>
                            setSubs(
                              subs.map((s, j) =>
                                j === i ? { ...s, w: e.target.value === "" ? null : Number(e.target.value) } : s,
                              ),
                            )
                          }
                          className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded"
                        />
                        <button
                          onClick={() => removeSub(i)}
                          className="w-7 h-7 rounded border border-[#d6d8dc] text-[#888] hover:bg-[#f5f5f5]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2">
                      <button
                        onClick={addSub}
                        disabled={subs.length >= 3}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5] disabled:opacity-50"
                      >
                        + เพิ่มล็อตย่อย
                      </button>
                      <span className="text-[12px] text-[#888]">
                        รวม <b className="text-[#1a1a1a]">{fmtNum(subsTotal)}</b> ฟอง
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="border border-[#e3e5e8] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_40px] gap-2 px-3 py-1.5 bg-[#fafbfc] border-b border-[#e3e5e8] text-[10px] font-semibold text-[#888] uppercase">
                  <span>เบอร์ไข่</span>
                  <span>จำนวน (ฟอง)</span>
                  <span />
                </div>
                {gradeLines.map((g, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_40px] gap-2 px-3 py-2 items-center border-b border-[#f0f0f0] last:border-b-0"
                  >
                    <select
                      value={g.size}
                      onChange={e =>
                        setGradeLines(gradeLines.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))
                      }
                      className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded"
                    >
                      {EGG_SIZES.map(s => (
                        <option key={s} value={s}>
                          {sizeLabel(s)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={g.qty ?? ""}
                      onChange={e =>
                        setGradeLines(
                          gradeLines.map((x, j) =>
                            j === i ? { ...x, qty: e.target.value === "" ? null : Number(e.target.value) } : x,
                          ),
                        )
                      }
                      className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded"
                    />
                    <button
                      onClick={() => removeGradeLine(i)}
                      className="w-7 h-7 rounded border border-[#d6d8dc] text-[#888] hover:bg-[#f5f5f5]"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    onClick={addGradeLine}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                  >
                    + เพิ่มรายการเบอร์
                  </button>
                  <span className="text-[12px] text-[#888]">
                    รวม <b className="text-[#1a1a1a]">{fmtNum(gradeTotal)}</b> ฟอง
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#f0f0f0] pt-3">
            {showRemarks ? (
              <div>
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-2 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowRemarks(true)}
                className="text-[12px] font-semibold text-[#1E40AF] hover:underline"
              >
                + หมายเหตุ
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1a1a1a] text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการรับเข้า"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grading — Plan today's grading (Section 2: Available eggs vs demand) ─────────
// Opening = real, manually entered per size/date (persisted). Demand = real, PO
// qty summed from confirmed orders in the active round, grouped by size (lines
// with a secondary size roll into their own "primary-secondary" row, e.g.
// "3-4", matching how order lines actually carry a specific pair — not a
// generic "Mixed" bucket). "From today's jobs" only counts jobs whose own
// productionDate is the selected date — a real recorded actual result where
// one exists, else the yield-model forecast for that job's planned qty. Lot
// quantity with no job scheduled for this date (unallocated, or jobs on other
// dates) isn't counted here — it isn't "from today's jobs."

function GradingPlanToday({
  date,
  partners,
  rawLots,
  jobs,
  results,
}: {
  date: string;
  partners: PlanPartner[];
  rawLots: GradingLot[];
  jobs: GradingJob[];
  results: GradingJobResult[];
}) {
  const [opening, setOpening] = useState<Record<string, number>>({});
  const [savingSize, setSavingSize] = useState<string | null>(null);
  const [yieldModels, setYieldModels] = useState<YieldModel[]>([]);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [yieldModalOpen, setYieldModalOpen] = useState(false);
  const [demandBasis, setDemandBasis] = useState<"pq" | "ad">("pq");
  const [adDemand, setAdDemand] = useState<Record<string, number>>({});
  const [expandedSize, setExpandedSize] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ job: GradingJob; lot: GradingLot } | null>(null);
  const [openingStockDialogOpen, setOpeningStockDialogOpen] = useState(false);

  const fetchAdDemand = useCallback(async () => {
    const r = await fetch(`/api/orders/ad-demand?date=${date}&days=30`);
    if (r.ok) {
      const data: { avgPerDaySize: Record<string, number> } = await r.json();
      setAdDemand(data.avgPerDaySize ?? {});
    }
  }, [date]);
  useEffect(() => { fetchAdDemand(); }, [fetchAdDemand]);

  const fetchOpening = useCallback(async () => {
    const r = await fetch(`/api/grading/opening-stock?date=${date}`);
    if (r.ok) {
      const rows: { size: string; qty: number }[] = await r.json();
      const m: Record<string, number> = {};
      for (const row of rows) m[row.size] = row.qty;
      setOpening(m);
    }
  }, [date]);

  const fetchYieldModels = useCallback(async () => {
    const r = await fetch("/api/grading/yield-models");
    if (r.ok) setYieldModels(await r.json());
  }, []);

  useEffect(() => { fetchOpening(); }, [fetchOpening]);
  useEffect(() => { fetchYieldModels(); }, [fetchYieldModels]);

  const saveOpening = async (size: string, qty: number) => {
    setOpening(prev => ({ ...prev, [size]: qty }));
    setSavingSize(size);
    try {
      await fetch("/api/grading/opening-stock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradingDate: date, size, qty }),
      });
    } finally {
      setSavingSize(null);
    }
  };

  // "Latest PQ" — real, from this round's working planning qty (matches "PQ
  // through this round" elsewhere in Order Planning). "AD reference" — real,
  // trailing-30-day average daily demand from confirmed orders (server-computed,
  // see /api/orders/ad-demand), independent of round/round-planning state —
  // explicitly a trend reference, not what's actually planned right now.
  const pqDemandBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of partners) for (const o of p.orders) for (const l of o.lines) {
      const key = l.secondarySize ? `${l.primarySize}-${l.secondarySize}` : (l.primarySize ?? "mixed");
      m[key] = (m[key] ?? 0) + (l.planningQty ?? l.orderQty) * l.eggsPerPack;
    }
    return m;
  }, [partners]);

  const demandBySize = demandBasis === "pq" ? pqDemandBySize : adDemand;

  const activeModel = yieldModels.find(m => m.active) ?? null;

  const resultByJobId = useMemo(() => {
    const m: Record<number, GradingJobResult> = {};
    for (const r of results) m[r.jobId] = r;
    return m;
  }, [results]);

  // "From today's jobs" — only jobs whose own productionDate is this date are
  // in scope (a job scheduled for another day, or lot quantity with no job at
  // all yet, is never counted here — it isn't "from today's jobs"). Within
  // that scope, blends real actual results with forecast: once a job has a
  // recorded result (draft or confirmed), its recorded outcomes (blank =
  // still not recorded, so still 0 here — never fabricated) replace the
  // forecast for that job's slice; a job with no result yet falls back to the
  // active yield model applied via lower-bound-step weight matching. Divided
  // lots (multiple sub-lots with different weights) can't be FORECASTED per-
  // job — a job only points at the lot, not a sub-lot, so there's no single
  // weight to apply — but once a job on a divided lot has a real recorded
  // actual result, that's counted the same as any other job; only
  // forecasting (not actuals) is blocked by the sub-attribution gap.
  const { fromJobsBySize, outOfRangeCount, missingWeightCount, weighedLotCount, actualEggsCount, sourcesBySize } =
    useMemo(
      () => computeGradingFromJobs(activeModel, rawLots, jobs, resultByJobId, date),
      [activeModel, rawLots, jobs, resultByJobId, date],
    );

  // Real mixed-pair keys (e.g. "3-4") that actually appear anywhere — opening
  // stock, today's jobs, or demand — get their own row instead of being
  // lumped into one generic "Mixed" bucket. The generic "mixed" row stays
  // (always shown, like No.6) for anything genuinely unspecified.
  const usedMixedPairs = useMemo(() => {
    const set = new Set<string>();
    const consider = (obj: Record<string, number>) => {
      for (const [k, v] of Object.entries(obj)) if (v !== 0 && k !== "mixed" && !EGG_SIZES.includes(k)) set.add(k);
    };
    consider(opening);
    consider(fromJobsBySize);
    consider(demandBySize);
    return Array.from(set).sort();
  }, [opening, fromJobsBySize, demandBySize]);
  const SIZE_ROWS = [...EGG_SIZES, ...usedMixedPairs, "mixed"];

  // "Counted" — whether this size has a saved opening-stock entry for this
  // date at all (real zero, once saved, still counts as counted) — `opening`
  // only ever holds keys the API actually returned, so presence is a genuine
  // "was this counted" signal, not a stand-in for "value is 0".
  //
  // "Sized debit" is always 0 — there's no packing-consumption feature yet
  // to debit sized stock against, so it's an honest placeholder, not real
  // data (see the tooltip on that column below).
  //
  // "Planning balance" is "unknown" (not 0) whenever the size hasn't been
  // counted — a forecast/actual total is meaningless without a real opening
  // count to add it to.
  const rows = SIZE_ROWS.map(size => {
    const counted = size in opening;
    const op = opening[size] ?? 0;
    const srcs = sourcesBySize[size] ?? [];
    const actual = srcs.filter(s => s.uses === "actual").reduce((a, s) => a + s.effect, 0);
    const forecast = srcs.filter(s => s.uses === "forecast").reduce((a, s) => a + s.effect, 0);
    const sizedDebit = 0;
    const planningBalance = counted ? op + actual + forecast - sizedDebit : null;
    const demand = demandBySize[size] ?? 0;
    const balance = planningBalance != null ? planningBalance - demand : null;
    return { size, counted, opening: op, actual, forecast, sizedDebit, planningBalance, demand, balance };
  });

  const allCounted = rows.every(r => r.counted);
  const countedN = rows.filter(r => r.counted).length;
  const totals = rows.reduce(
    (acc, r) => ({
      actual: acc.actual + r.actual,
      forecast: acc.forecast + r.forecast,
      sizedDebit: acc.sizedDebit + r.sizedDebit,
      demand: acc.demand + r.demand,
    }),
    { actual: 0, forecast: 0, sizedDebit: 0, demand: 0 },
  );
  const totalPlanningBalance = allCounted
    ? rows.reduce((s, r) => s + (r.planningBalance ?? 0), 0)
    : null;
  const totalBalance = totalPlanningBalance != null ? totalPlanningBalance - totals.demand : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
          1
        </span>
        <span className="text-[15px] font-bold text-[#1a1a1a]">วางแผนคัดวันนี้</span>
      </div>
      <div className="text-[12px] text-[#888] mb-3 ml-8">
        {date} · 0 งาน · {fmtNum(totals.actual + totals.forecast)} ฟอง (คาดการณ์) · 0 เครื่อง
      </div>

      <div className="bg-white rounded-xl border border-[#E1E5EA]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0] flex-wrap gap-2">
          <div>
            <div className="text-[15px] font-bold text-[#1a1a1a]">Planning balance</div>
            <div className="text-[11px] text-[#888]">
              สต็อกยกมา + ผลจากงานคัดวันนี้ <span className="text-[#bbb]">(ยังไม่กระทบยอดรับของจริง)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* PQ / AQ demand-basis toggle — real, same demandBasis state as before */}
            <div className="inline-flex rounded-lg border border-[#d6d8dc] overflow-hidden">
              <button
                onClick={() => setDemandBasis("pq")}
                title="PQ ล่าสุด — แผนออเดอร์ที่ประกาศแล้ว"
                className={`px-3 py-1.5 text-[11px] font-semibold ${
                  demandBasis === "pq" ? "bg-[#1E40AF] text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"
                }`}
              >
                PQ
              </button>
              <button
                onClick={() => setDemandBasis("ad")}
                title="อ้างอิง AQ — แนวโน้มเฉลี่ย/วัน ย้อนหลัง 30 วัน ไม่ใช่แผน"
                className={`px-3 py-1.5 text-[11px] font-semibold border-l border-[#d6d8dc] ${
                  demandBasis === "ad" ? "bg-[#1E40AF] text-white" : "bg-white text-[#555] hover:bg-[#f5f5f5]"
                }`}
              >
                AQ
              </button>
            </div>

            {/* Opening-count status chip — real, counts sizes with a saved entry for
                this date. Click opens the day-aged opening-stock count dialog. */}
            <button
              onClick={() => setOpeningStockDialogOpen(true)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border hover:opacity-80 ${
                countedN === 0
                  ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
                  : allCounted
                    ? "border-[#86EFAC] bg-[#F0FDF4] text-green-700"
                    : "border-[#d6d8dc] text-[#555]"
              }`}
            >
              Opening count · {countedN === 0 ? "not counted" : `${countedN}/${rows.length} counted`}
            </button>

            {/* Forecast model chip — real, names the active yield model (or "none" if there isn't one) */}
            <span className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555]">
              Forecast · {activeModel ? activeModel.name : "ไม่มี"}
            </span>

            <div className="relative">
              <button
                onClick={() => setSettingsMenuOpen(o => !o)}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
              >
                ⚏ ▾
              </button>
            {settingsMenuOpen && (
              <div className="absolute right-0 top-9 z-20 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-64 text-left">
                <button
                  disabled
                  className="w-full text-left px-3 py-1.5 text-[12px] text-[#aaa] cursor-not-allowed"
                  title="แก้ไขสต๊อกยกมาได้โดยตรงในตารางด้านล่าง"
                >
                  สต๊อกยกมา (แก้ไขในตาราง)
                </button>
                <button
                  onClick={() => { setSettingsMenuOpen(false); setYieldModalOpen(true); }}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
                >
                  ดูประวัติผลผลิตการคัด
                  {activeModel && (
                    <span className="block text-[10px] text-[#888]">
                      {activeModel.rows.length} รายการ · {activeModel.rows.filter(r => r.source === "actual").length} เรียนรู้จากงานจริง
                    </span>
                  )}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
        <div className="px-4 py-2 text-[11px] text-[#999] border-b border-[#f0f0f0]">
          {activeModel ? (
            <>
              "จากงานวันนี้" ใช้<b>ผลจริงที่บันทึกไว้</b>สำหรับงานที่มีผลลัพธ์แล้ว{" "}
              {actualEggsCount > 0 && <span className="text-[#166534]">({fmtNum(actualEggsCount)} ฟองแล้ว)</span>}
              และใช้<b>การคาดการณ์</b>จาก "{activeModel.name}" ตามน้ำหนัก สำหรับส่วนที่ยังไม่ได้คัด
              {outOfRangeCount > 0 && (
                <span className="text-[#92400E]"> {outOfRangeCount}/{weighedLotCount} น้ำหนักอยู่นอกช่วงของโมเดล จึงไม่นับรวม</span>
              )}
              {missingWeightCount > 0 && (
                <span className="text-[#92400E]">
                  {" "}
                  {missingWeightCount} ล็อต/ล็อตย่อยไม่มีน้ำหนักเฉลี่ยบันทึกไว้ — ไม่นับรวมในการคาดการณ์นี้
                  กรุณาระบุน้ำหนักในล็อตเพื่อให้นับรวม
                </span>
              )}
            </>
          ) : (
            <>
              ยังคาดการณ์ไม่ได้ — ยังไม่มีประวัติผลผลิตการคัด ระบบจะสร้างขึ้นเองอัตโนมัติเมื่อมีการยืนยันผลจริงของงานคัด
            </>
          )}{" "}
          {demandBasis === "pq"
            ? "ความต้องการคือจำนวนวางแผน (PQ) ของรอบนี้"
            : "ความต้องการคือค่าเฉลี่ยความต้องการรายวันย้อนหลัง 30 วัน (อ้างอิง AD) — เป็นแนวโน้ม ไม่ใช่แผน"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb]">
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#888] uppercase" rowSpan={2}>
                  Size
                </th>
                <th
                  colSpan={5}
                  className="text-left px-4 py-1.5 text-[11px] font-bold text-[#1E40AF] border-l-2 border-[#BFDBFE] bg-[#EFF6FF]"
                >
                  Evidence
                </th>
                <th
                  colSpan={2}
                  className="text-left px-4 py-1.5 text-[11px] font-bold text-[#92400E] border-l-2 border-[#FCD34D] bg-[#FFFBEB]"
                >
                  Demand
                </th>
              </tr>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb]">
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase border-l-2 border-[#BFDBFE] bg-[#EFF6FF]">
                  Counted
                </th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#EFF6FF]">
                  Actual
                </th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#EFF6FF]">
                  Forecast
                </th>
                <th
                  className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#EFF6FF]"
                  title="ตัดสต็อกจากการแพ็ก — ยังไม่มีข้อมูลจริง (ยังไม่มีฟีเจอร์เชื่อมโยงการแพ็ก)"
                >
                  Sized debit
                </th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#EFF6FF]">
                  Planning balance
                </th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase border-l-2 border-[#FCD34D] bg-[#FFFBEB]">
                  Demand
                </th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#888] uppercase bg-[#FFFBEB]">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cls = SIZE_PILL_CLS[r.size] ?? "bg-[#F1EFE8] text-[#5F5E5A]";
                const label = r.size === "mixed" ? "คละ" : r.size.includes("-") ? `คละ ${r.size}` : `เบอร์ ${r.size}`;
                const balanceColor = r.balance != null && r.balance < 0 ? "text-red-700" : "text-green-700";
                const balanceLabel =
                  r.balance == null
                    ? "—"
                    : r.demand === 0
                      ? "—"
                      : r.balance < 0
                        ? `ขาด ${fmtNum(Math.abs(r.balance))}`
                        : `เกิน ${fmtNum(r.balance)}`;
                const rowSources = sourcesBySize[r.size] ?? [];
                const expanded = expandedSize === r.size;
                return (
                  <Fragment key={r.size}>
                    <tr className="border-b border-[#f5f5f5] last:border-b-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedSize(expanded ? null : r.size)}
                            disabled={!rowSources.length}
                            title={rowSources.length ? "แสดงแหล่งที่มาของเบอร์นี้" : "ยังไม่มีล็อต/งานที่เกี่ยวข้อง"}
                            className={`text-[10px] leading-none ${rowSources.length ? "text-[#888] hover:text-[#1a1a1a]" : "text-[#e3e5e8] cursor-default"}`}
                          >
                            {expanded ? "▾" : "▸"}
                          </button>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right border-l-2 border-[#f0f0f0]">
                        <OpeningCell
                          value={r.opening}
                          counted={r.counted}
                          saving={savingSize === r.size}
                          onSave={qty => saveOpening(r.size, qty)}
                        />
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums ${r.actual > 0 ? "text-green-700 font-medium" : "text-[#ccc]"}`}>
                        {fmtNum(r.actual)}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums ${r.forecast > 0 ? "text-[#1a1a1a] font-medium" : "text-[#ccc]"}`}>
                        {fmtNum(r.forecast)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#ccc]" title="ยังไม่มีฟีเจอร์ตัดสต็อกจากการแพ็ก">
                        {fmtNum(r.sizedDebit)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums font-bold ${
                          r.planningBalance == null ? "text-[#92400E]" : "text-[#1a1a1a]"
                        }`}
                      >
                        {r.planningBalance == null ? "unknown" : fmtNum(r.planningBalance)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums border-l-2 border-[#FEF3C7]">
                        {r.demand > 0 ? fmtNum(r.demand) : <span className="text-[#ccc]">—</span>}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums font-bold ${
                          r.balance == null || r.demand === 0 ? "text-[#ccc]" : balanceColor
                        }`}
                      >
                        {balanceLabel}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-[#e5e7eb]">
                        <td colSpan={8} className="px-4 py-3 bg-[#fafbfc]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-bold text-[#1a1a1a]">
                              {label}{" "}
                              <span className="font-normal text-[#888]">
                                แหล่งที่มาของ{label} · {fmtNum(r.actual + r.forecast)} ฟอง
                              </span>
                            </span>
                            <button
                              onClick={() => setExpandedSize(null)}
                              className="text-[11px] font-semibold text-[#1E40AF] hover:underline"
                            >
                              × ปิด
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-[10px] text-[#888] uppercase">
                                  <th className="text-left py-1 pr-3">ล็อต / งาน</th>
                                  <th className="text-left py-1 pr-3">เครื่อง / ลำดับ</th>
                                  <th className="text-left py-1 pr-3">สถานะ</th>
                                  <th className="text-right py-1 pr-3">ผลต่อจำนวนที่มี</th>
                                  <th className="text-right py-1">ประเภท</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rowSources.map((s, i) => {
                                  const srcJob = s.jobId != null ? jobs.find(j => j.id === s.jobId) : undefined;
                                  const srcLot = rawLots.find(l => l.id === s.lotId);
                                  return (
                                    <tr key={i} className="border-t border-[#f0f0f0]">
                                      <td className="py-1.5 pr-3">
                                        {srcJob && srcLot ? (
                                          <button
                                            onClick={() => setDetailTarget({ job: srcJob, lot: srcLot })}
                                            className="font-semibold text-[#1E40AF] hover:underline"
                                          >
                                            {s.lotNo}
                                          </button>
                                        ) : (
                                          <span className="text-[#555]">{s.lotNo}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3 text-[#555]">
                                        {s.machine ? `${s.machine} #${s.seq}` : "—"}
                                      </td>
                                      <td className="py-1.5 pr-3 text-[#555]">{s.stage}</td>
                                      <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-[#1a1a1a]">
                                        +{fmtNum(s.effect)}
                                      </td>
                                      <td className="py-1.5 text-right">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                            s.uses === "actual"
                                              ? "bg-[#F0FDF4] text-green-700"
                                              : "bg-[#EFF2F7] text-[#555]"
                                          }`}
                                        >
                                          {s.uses === "actual" ? "ผลจริง" : "คาดการณ์"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="bg-[#fafbfc]">
                <td className="px-4 py-2 font-bold text-[#1a1a1a]">Total</td>
                <td className={`px-4 py-2 text-right tabular-nums font-bold border-l-2 border-[#f0f0f0] ${allCounted ? "text-[#1a1a1a]" : "text-[#92400E]"}`}>
                  {allCounted ? fmtNum(rows.reduce((s, r) => s + r.opening, 0)) : "unknown"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtNum(totals.actual)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtNum(totals.forecast)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold text-[#999]">{fmtNum(totals.sizedDebit)}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-bold ${totalPlanningBalance == null ? "text-[#92400E]" : "text-[#1a1a1a]"}`}>
                  {totalPlanningBalance == null ? "unknown" : fmtNum(totalPlanningBalance)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-bold border-l-2 border-[#FEF3C7]">
                  {fmtNum(totals.demand)}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums font-bold ${
                    totalBalance == null ? "text-[#ccc]" : totals.demand === 0 ? "text-[#1a1a1a]" : totalBalance < 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {totalBalance == null
                    ? "—"
                    : totals.demand === 0
                      ? fmtNum(totalBalance)
                      : totalBalance < 0
                        ? `ขาด ${fmtNum(Math.abs(totalBalance))}`
                        : `เกิน ${fmtNum(totalBalance)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {yieldModalOpen && <YieldModelModal models={yieldModels} onClose={() => setYieldModalOpen(false)} />}

      {openingStockDialogOpen && (
        <OpeningStockDialog
          date={date}
          onClose={() => setOpeningStockDialogOpen(false)}
          onConfirmed={() => { fetchOpening(); }}
        />
      )}

      {detailTarget && (
        <GradingBatchDetailModal
          job={detailTarget.job}
          lot={detailTarget.lot}
          seq={jobSeq(detailTarget.job, jobs)}
          activeModel={activeModel}
          result={resultByJobId[detailTarget.job.id]}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

// ── Opening stock dialog (day-aged, versioned counts behind the "Opening
// count" chip). Confirming freezes the current draft and syncs its known
// (fully-counted) outcome totals into grading_opening_stock — the table
// Planning Balance's COUNTED column actually reads — then opens a fresh
// draft with the same product rows so counting can continue. See
// server/routes/grading.ts (/opening-stock/draft|confirm|versions) for the
// "whole-blank row = unknown" rule this dialog follows. ─────────────────────

type OpeningStockLine = {
  itemId: number;
  sku: string;
  name: string;
  outcome: string;
  day1Qty: number | null;
  day2Qty: number | null;
  day3Qty: number | null;
  day4PlusQty: number | null;
  unit: string;
  unitEggs: number;
};
type OpeningStockProduct = { id: number; sku: string | null; name: string; outcome: string; units: { unit: string; eggs: number }[] };
type OpeningStockDraft = {
  id: number; version: number; state: "draft" | "confirmed"; asOfTime: string | null;
  lines: OpeningStockLine[]; createdAt: string;
  lastConfirmed: { id: number; version: number; asOfTime: string | null; confirmedAt: string } | null;
};
type OpeningStockVersion = {
  id: number; version: number; state: string; asOfTime: string | null;
  lineCount: number; unknownLines: number; knownEggs: number; createdAt: string; confirmedAt: string | null;
};

function fmtDMY(d: string): string {
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

function rowTotal(l: OpeningStockLine): number | null {
  const buckets = [l.day1Qty, l.day2Qty, l.day3Qty, l.day4PlusQty];
  if (buckets.some(b => b == null)) return null;
  return buckets.reduce<number>((a, b) => a + Number(b ?? 0), 0);
}
function rowBaseEggs(l: OpeningStockLine): number | null {
  const t = rowTotal(l);
  return t == null ? null : t * (l.unitEggs || 1);
}

function OpeningStockDialog({
  date,
  onClose,
  onConfirmed,
}: {
  date: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [products, setProducts] = useState<OpeningStockProduct[]>([]);
  const [draft, setDraft] = useState<OpeningStockDraft | null>(null);
  const [versions, setVersions] = useState<OpeningStockVersion[]>([]);
  const [lines, setLines] = useState<OpeningStockLine[]>([]);
  const [asOfTime, setAsOfTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [addingProductId, setAddingProductId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, dRes, vRes] = await Promise.all([
        fetch("/api/grading/opening-stock/products"),
        fetch(`/api/grading/opening-stock/draft?date=${date}`),
        fetch(`/api/grading/opening-stock/versions?date=${date}`),
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (dRes.ok) {
        const d: OpeningStockDraft = await dRes.json();
        setDraft(d);
        setLines(d.lines);
        setAsOfTime(d.asOfTime ?? "");
      }
      if (vRes.ok) setVersions(await vRes.json());
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const updateLine = (idx: number, patch: Partial<OpeningStockLine>) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const addProductRow = () => {
    const p = products.find(pr => String(pr.id) === addingProductId);
    if (!p) return;
    const unit = p.units[0] ?? { unit: "ฟอง", eggs: 1 };
    setLines(prev => [
      ...prev,
      { itemId: p.id, sku: p.sku ?? "", name: p.name, outcome: p.outcome, day1Qty: null, day2Qty: null, day3Qty: null, day4PlusQty: null, unit: unit.unit, unitEggs: unit.eggs },
    ]);
    setAddingProductId("");
  };

  const saveDraft = async () => {
    setError("");
    setSaving(true);
    try {
      const r = await fetch("/api/grading/opening-stock/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradingDate: date, asOfTime: asOfTime || null, lines }),
      });
      if (!r.ok) { setError("บันทึกร่างไม่สำเร็จ"); return; }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const confirmSnapshot = async () => {
    setError("");
    setConfirming(true);
    try {
      // Save whatever's currently on screen first, so confirm freezes what
      // the user actually sees, not a stale server copy.
      const saveRes = await fetch("/api/grading/opening-stock/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradingDate: date, asOfTime: asOfTime || null, lines }),
      });
      if (!saveRes.ok) { setError("บันทึกร่างไม่สำเร็จ"); return; }
      const r = await fetch("/api/grading/opening-stock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradingDate: date }),
      });
      if (!r.ok) { setError("ยืนยันไม่สำเร็จ"); return; }
      await load();
      onConfirmed();
    } finally {
      setConfirming(false);
    }
  };

  const dayHeaders = [1, 2, 3].map(n => ({ label: `${n} DAY${n > 1 ? "S" : ""}`, sub: `recv ${fmtDMY(addDays(date, -n))}` }));
  const day4Header = { label: "≥4 DAYS", sub: `by ${fmtDMY(addDays(date, -4))}` };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">Opening stock</h2>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#F1F5F9] text-[#475569] border border-[#e2e8f0]">
              {fmtDMY(date)}
            </span>
            {draft?.lastConfirmed && (
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                Master v{draft.lastConfirmed.version} · {fmtDateTime(draft.lastConfirmed.confirmedAt)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]">
            × Close
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[#aaa]" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">{error}</div>
            )}

            <div className="bg-[#FAFBFC] border border-[#E1E5EA] rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-[14px] font-bold text-[#1a1a1a]">New version (draft)</span>
                {!draft?.lastConfirmed && (
                  <span className="px-2 py-0.5 text-[10.5px] font-semibold rounded-full bg-[#F1F5F9] text-[#64748B]">
                    no confirmed version yet
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[12px] text-[#555]">As-of time</span>
                <input
                  type="time"
                  value={asOfTime}
                  onChange={e => setAsOfTime(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left py-2 pr-3 text-[10px] font-semibold text-[#888] uppercase">Product (from master)</th>
                      <th className="text-left py-2 pr-3 text-[10px] font-semibold text-[#888] uppercase">Outcome</th>
                      {dayHeaders.map(h => (
                        <th key={h.label} className="text-right py-2 px-2 text-[10px] font-semibold text-[#888] uppercase">
                          {h.label}<span className="block font-normal normal-case text-[#bbb]">{h.sub}</span>
                        </th>
                      ))}
                      <th className="text-right py-2 px-2 text-[10px] font-semibold text-[#888] uppercase">
                        {day4Header.label}<span className="block font-normal normal-case text-[#bbb]">{day4Header.sub}</span>
                      </th>
                      <th className="text-right py-2 px-2 text-[10px] font-semibold text-[#888] uppercase">Total</th>
                      <th className="text-left py-2 px-2 text-[10px] font-semibold text-[#888] uppercase">Unit</th>
                      <th className="text-right py-2 pl-2 text-[10px] font-semibold text-[#888] uppercase">Base eggs</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => {
                      const product = products.find(p => p.id === l.itemId);
                      const unitOptions = product?.units.length ? product.units : [{ unit: l.unit, eggs: l.unitEggs }];
                      const cls = SIZE_PILL_CLS[l.outcome] ?? "bg-[#F1EFE8] text-[#5F5E5A]";
                      const outcomeLabel = l.outcome === "mixed" ? "Mixed" : l.outcome.includes("-") ? l.outcome : `No.${l.outcome}`;
                      const total = rowTotal(l);
                      const baseEggs = rowBaseEggs(l);
                      const bucketInput = (key: "day1Qty" | "day2Qty" | "day3Qty" | "day4PlusQty") => (
                        <input
                          type="number"
                          value={l[key] ?? ""}
                          placeholder="—"
                          onChange={e => updateLine(idx, { [key]: e.target.value === "" ? null : Number(e.target.value) } as Partial<OpeningStockLine>)}
                          className="w-20 h-8 px-2 text-[12px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                        />
                      );
                      return (
                        <tr key={idx} className="border-b border-[#f5f5f5] last:border-b-0">
                          <td className="py-2 pr-3">
                            <select
                              value={l.itemId}
                              onChange={e => {
                                const p = products.find(pr => pr.id === Number(e.target.value));
                                if (!p) return;
                                const unit = p.units[0] ?? { unit: "ฟอง", eggs: 1 };
                                updateLine(idx, { itemId: p.id, sku: p.sku ?? "", name: p.name, outcome: p.outcome, unit: unit.unit, unitEggs: unit.eggs });
                              }}
                              className="w-full h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg bg-white max-w-[340px]"
                            >
                              <option value={l.itemId}>{l.sku} · {l.name}</option>
                              {products.filter(p => p.id !== l.itemId).map(p => (
                                <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{outcomeLabel}</span>
                          </td>
                          <td className="py-2 px-2 text-right">{bucketInput("day1Qty")}</td>
                          <td className="py-2 px-2 text-right">{bucketInput("day2Qty")}</td>
                          <td className="py-2 px-2 text-right">{bucketInput("day3Qty")}</td>
                          <td className="py-2 px-2 text-right">{bucketInput("day4PlusQty")}</td>
                          <td className={`py-2 px-2 text-right tabular-nums font-semibold ${total == null ? "text-[#92400E]" : "text-[#1a1a1a]"}`}>
                            {total == null ? "unknown" : fmtNum(total)}
                          </td>
                          <td className="py-2 px-2">
                            {/* Indexed, not by unit label — a product can have two units
                                that print the same (e.g. pack and basket both "ถาด") with
                                different egg counts, and a value-by-label select couldn't
                                tell those options apart. */}
                            <select
                              value={Math.max(0, unitOptions.findIndex(u => u.unit === l.unit && u.eggs === l.unitEggs))}
                              onChange={e => {
                                const opt = unitOptions[Number(e.target.value)];
                                if (opt) updateLine(idx, { unit: opt.unit, unitEggs: opt.eggs });
                              }}
                              className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg bg-white"
                            >
                              {unitOptions.map((u, uidx) => (
                                <option key={`${u.unit}-${u.eggs}-${uidx}`} value={uidx}>{u.unit} ×{fmtNum(u.eggs)}</option>
                              ))}
                            </select>
                          </td>
                          <td className={`py-2 pl-2 text-right tabular-nums font-semibold ${baseEggs == null ? "text-[#ccc]" : "text-[#1a1a1a]"}`}>
                            {baseEggs == null ? "unknown" : fmtNum(baseEggs)}
                          </td>
                          <td className="py-2 text-right">
                            <button onClick={() => removeLine(idx)} title="ลบแถวนี้" className="text-[#aaa] hover:text-[#991B1B] px-1">×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <select
                  value={addingProductId}
                  onChange={e => setAddingProductId(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg bg-white max-w-[300px]"
                >
                  <option value="">เลือกสินค้าเพื่อเพิ่มแถว…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                  ))}
                </select>
                <button
                  onClick={addProductRow}
                  disabled={!addingProductId}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:opacity-40"
                >
                  + Add Product row
                </button>
                <span className="text-[11px] text-[#aaa]">Whole-blank row = unknown · 0 = real zero · split by received day for FIFO</span>
              </div>
            </div>

            <div>
              <div className="text-[13px] font-bold text-[#1a1a1a] mb-2">Version history</div>
              {versions.filter(v => v.state === "confirmed").length === 0 ? (
                <div className="text-[12px] text-[#aaa]">No versions yet</div>
              ) : (
                <div className="border border-[#E1E5EA] rounded-xl overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[10px] font-semibold text-[#888] uppercase">
                        <th className="text-left px-3 py-2">Version</th>
                        <th className="text-left px-3 py-2">Confirmed</th>
                        <th className="text-left px-3 py-2">As-of</th>
                        <th className="text-right px-3 py-2">Lines</th>
                        <th className="text-right px-3 py-2">Known eggs</th>
                        <th className="text-right px-3 py-2">Unknown rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.filter(v => v.state === "confirmed").map(v => (
                        <tr key={v.id} className="border-b border-[#f5f5f5] last:border-b-0">
                          <td className="px-3 py-2 font-semibold text-[#1a1a1a]">v{v.version}</td>
                          <td className="px-3 py-2 text-[#555]">{fmtDateTime(v.confirmedAt)}</td>
                          <td className="px-3 py-2 text-[#555]">{v.asOfTime || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{v.lineCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(v.knownEggs)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${v.unknownLines ? "text-[#92400E]" : "text-[#aaa]"}`}>
                            {v.unknownLines || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e5e7eb]">
          <span className="text-[11px] text-[#aaa]">Confirmation cannot be edited</span>
          <div className="flex items-center gap-2">
            <button
              onClick={saveDraft}
              disabled={saving || confirming || loading}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5] disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save draft
            </button>
            <button
              onClick={confirmSnapshot}
              disabled={saving || confirming || loading}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50 flex items-center gap-1.5"
            >
              {confirming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm snapshot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OpeningCell({
  value,
  counted,
  saving,
  onSave,
}: {
  value: number;
  counted: boolean;
  saving: boolean;
  onSave: (qty: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  if (!editing) {
    // Not counted yet — no opening-stock entry saved for this size/date at
    // all (distinct from a real, saved zero). Clicking still opens the same
    // editor to record one.
    if (!counted) {
      return (
        <button
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          title="ยังไม่มีการนับสต็อกยกมาสำหรับเบอร์นี้ในวันนี้ — คลิกเพื่อบันทึก"
          className="text-[11px] font-medium text-[#92400E] hover:underline px-2 py-0.5 rounded whitespace-nowrap"
        >
          not counted
        </button>
      );
    }
    return (
      <button
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="tabular-nums font-medium text-[#1a1a1a] hover:bg-[#f5f5f5] px-2 py-0.5 rounded"
      >
        {fmtNum(value)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = Number(draft);
        if (!isNaN(n) && (n !== value || !counted)) onSave(n);
      }}
      onKeyDown={e => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      disabled={saving}
      className="w-24 h-7 px-2 text-[12px] text-right border border-[#1E40AF] rounded"
    />
  );
}

// ── Machine job board ─────────────────────────────────────────────────────────────

function MachineJobBoard({
  date,
  lots,
  jobs,
  results,
  onRefresh,
  onResultsRefresh,
  onAddMachineJob,
}: {
  date: string;
  lots: GradingLot[];
  jobs: GradingJob[];
  results: GradingJobResult[];
  onRefresh: () => void;
  onResultsRefresh: () => void;
  // Opens the unified "+ Add job" flow in machine mode — `machine` pre-fills
  // that machine when clicked from one of the "+ Machine N" quick-adds,
  // undefined from the plain "+ Add machine" button.
  onAddMachineJob: (machine?: string) => void;
}) {
  const lotById = useMemo(() => {
    const m: Record<number, GradingLot> = {};
    for (const l of lots) m[l.id] = l;
    return m;
  }, [lots]);

  const resultByJobId = useMemo(() => {
    const m: Record<number, GradingJobResult> = {};
    for (const r of results) m[r.jobId] = r;
    return m;
  }, [results]);

  const [resultModal, setResultModal] = useState<{ job: GradingJob; lot: GradingLot | undefined; seq: number } | null>(
    null,
  );

  // Special-tray WIP items — real, from the same packaging_profile a WIP
  // item already carries (see /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md
  // and OrderFormPage's trayOfItem). Self-fetched here so a completed job
  // can offer "+ เพิ่มถาดพิเศษ" as its own standalone action, separate from
  // the full result-edit form's general "+ เพิ่ม FG" picker.
  const [specialWipItems, setSpecialWipItems] = useState<
    { id: number; sku: string; name: string; eggsPerPack: number; primarySize: string | null; secondarySize: string | null; componentSku: string; componentName: string }[]
  >([]);
  useEffect(() => {
    fetch("/api/items")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        const bySku: Record<string, any> = {};
        for (const it of rows) if (it.sku) bySku[it.sku] = it;
        const special: typeof specialWipItems = [];
        for (const it of rows) {
          if (it.itemRole !== "WIP") continue;
          let profile: Record<string, { enabled?: boolean; item_type?: string; component_sku?: string }> = {};
          try {
            const raw = it.packagingProfile;
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            profile = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
          } catch { /* no profile */ }
          const specialSlot = Object.values(profile).find(c => c?.enabled !== false && c?.component_sku && /plastic|cover|lid/i.test(c.item_type ?? ""));
          if (!specialSlot?.component_sku) continue;
          const component = bySku[specialSlot.component_sku];
          special.push({
            id: it.id, sku: it.sku, name: it.name, eggsPerPack: it.eggsPerPack ?? 30,
            primarySize: it.primarySize, secondarySize: it.secondarySize,
            componentSku: specialSlot.component_sku, componentName: component?.name ?? specialSlot.component_sku,
          });
        }
        setSpecialWipItems(special);
      })
      .catch(() => {});
  }, []);
  const [specialTrayModal, setSpecialTrayModal] = useState<{ job: GradingJob; result: GradingJobResult | null } | null>(null);

  const todaysJobs = useMemo(() => jobs.filter(j => j.productionDate === date), [jobs, date]);

  const jobsByMachine = useMemo(() => {
    const m: Record<string, GradingJob[]> = {};
    for (const j of todaysJobs) {
      const key = j.machine ?? "ไม่ระบุเครื่อง";
      if (!m[key]) m[key] = [];
      m[key].push(j);
    }
    return m;
  }, [todaysJobs]);

  const usedMachines = [
    ...GRADING_MACHINES.filter(m => jobsByMachine[m]?.length),
    ...Object.keys(jobsByMachine).filter(m => !GRADING_MACHINES.includes(m)),
  ];

  // Machine jobs (assigned to one of the fixed grading machines) vs hand jobs
  // (no machine — e.g. manually pairing already-sized stock into a mixed
  // pair) are the same underlying jobs/print system, just grouped for
  // display into two labeled sections instead of one flat grid.
  const machineOnlyKeys = usedMachines.filter(m => GRADING_MACHINES.includes(m));
  const handKeys = usedMachines.filter(m => !GRADING_MACHINES.includes(m));
  const machineJobs = todaysJobs.filter(j => j.machine != null);
  const handJobs = todaysJobs.filter(j => j.machine == null);
  const machineInput = machineJobs.reduce((s, j) => s + j.qty, 0);
  const handInput = handJobs.reduce((s, j) => s + j.qty, 0);

  const seqByJobId = useMemo(() => {
    const m: Record<number, number> = {};
    for (const machine of usedMachines) {
      (jobsByMachine[machine] ?? []).forEach((j, i) => { m[j.id] = i + 1; });
    }
    return m;
  }, [usedMachines, jobsByMachine]);

  const removeJob = async (id: number) => {
    if (!confirm("ลบงานนี้ออกจากบอร์ด?")) return;
    const r = await fetch(`/api/grading/jobs/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data.message || "ลบงานไม่สำเร็จ");
      return;
    }
    onRefresh();
  };

  const [sendingToFloor, setSendingToFloor] = useState<number | null>(null);
  const sendToFloor = async (id: number) => {
    setSendingToFloor(id);
    try {
      await fetch(`/api/grading/jobs/${id}/send-to-floor`, { method: "PATCH" });
      onRefresh();
    } finally {
      setSendingToFloor(null);
    }
  };

  // Floor documents — real, persisted (↔ /api/grading/print-events ↔
  // grading_print_events). Self-fetches the active yield model, matching
  // RecordActualResultModal, since it's only needed while this section is
  // in use. There's no "release" workflow separate from job creation — a job
  // on the board already represents committed work, so "released" here just
  // means "exists for this date." "Stock mover sheet" isn't built — there's
  // no stock-location/movement data model in this app yet.
  const [yieldModels, setYieldModels] = useState<YieldModel[]>([]);
  useEffect(() => {
    fetch("/api/grading/yield-models")
      .then(r => (r.ok ? r.json() : []))
      .then(setYieldModels)
      .catch(() => {});
  }, []);
  const activeModel = yieldModels.find(m => m.active) ?? null;

  const [printEvents, setPrintEvents] = useState<GradingPrintEvent[]>([]);
  const fetchPrintEvents = useCallback(async () => {
    const r = await fetch(`/api/grading/print-events?date=${date}`);
    if (r.ok) setPrintEvents(await r.json());
  }, [date]);
  useEffect(() => { fetchPrintEvents(); }, [fetchPrintEvents]);

  const [docsAnchor, setDocsAnchor] = useState<{ top: number; right: number } | null>(null);
  const [releasedView, setReleasedView] = useState<
    | { mode: "live"; scope: string; highlightJobId?: number }
    | { mode: "snapshot"; event: GradingPrintEvent }
    | null
  >(null);
  const [printHistoryOpen, setPrintHistoryOpen] = useState(false);

  const buildRowsForScope = (scope: string): PrintSnapshotRow[] => {
    // Stock Mover isn't a distinct job set — it's the same "all" jobs, just
    // regrouped by lot/sub-lot for display. It still gets its own print scope
    // (and revision counter) so its print history stays separate.
    const scopedJobs = scope === "all" || scope === STOCK_MOVER_TAB ? todaysJobs : (jobsByMachine[scope] ?? []);
    const dateCompact = date.replace(/-/g, "");
    const yieldRef = activeModel ? `YF-${activeModel.id} · ${activeModel.name}` : null;
    return scopedJobs.map(j => {
      const lot = lotById[j.lotId];
      const result = resultByJobId[j.id];
      const seq = seqByJobId[j.id] ?? 0;
      return {
        jobId: j.id,
        seq,
        lotNo: lot?.lotNo ?? null,
        farm: lot?.farm ?? null,
        material: lot?.material ?? null,
        avgWeight: lot?.avgWeight ?? null,
        divided: lot?.divided ?? false,
        subs: lot?.divided ? lot.subs : null,
        machine: j.machine,
        productionDate: j.productionDate,
        qty: j.qty,
        plannedStart: j.plannedStart,
        plannedEnd: j.plannedEnd,
        jobStatus: j.status,
        resultStatus: result?.status ?? null,
        wiRef: `WI-G-${dateCompact}-${String(seq).padStart(3, "0")}`,
        yieldRef,
      };
    });
  };

  const createPrintEvent = async (scope: string): Promise<GradingPrintEvent | null> => {
    const rows = buildRowsForScope(scope);
    if (!rows.length) {
      alert("ยังไม่มีงานให้พิมพ์ในขอบเขตนี้");
      return null;
    }
    const r = await fetch("/api/grading/print-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionDate: date, scope, jobIds: rows.map(row => row.jobId) }),
    });
    if (!r.ok) {
      alert("บันทึกการพิมพ์ไม่สำเร็จ");
      return null;
    }
    const created: GradingPrintEvent = await r.json();
    fetchPrintEvents();
    return created;
  };

  const printScope = async (scope: string) => {
    setDocsAnchor(null);
    const created = await createPrintEvent(scope);
    if (!created) return;
    setReleasedView({ mode: "snapshot", event: created });
    setTimeout(() => window.print(), 250);
  };

  // One column's card list — shared by both the Machine jobs and Hand jobs
  // grids below (a "column" is either a real machine or the "ไม่ระบุเครื่อง"
  // no-machine bucket; the card body and its actions are identical either way).
  const renderColumn = (m: string) => {
    const mJobs = jobsByMachine[m] ?? [];
    const mTotal = mJobs.reduce((s, j) => s + j.qty, 0);
    return (
      <div key={m} className="bg-white rounded-xl border border-[#e3e5e8] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f0f0f0] bg-[#fafbfc]">
          <span className="text-[13px] font-bold text-[#1a1a1a]">{m}</span>{" "}
          <span className="text-[12px] text-[#888]">
            {mJobs.length} งาน · {fmtNum(mTotal)}
          </span>
        </div>
        <div className="p-3 space-y-2">
          {mJobs.map((j, i) => {
            const lot = lotById[j.lotId];
            const result = resultByJobId[j.id];
            // Real machine column vs the "ไม่ระบุเครื่อง" hand-job bucket — a few
            // display rules differ by route (queue #, weight, blank-vs-placeholder
            // time), matching the job-card spec (handover/261002/Job Card Stages).
            const isRealMachine = GRADING_MACHINES.includes(m);

            // 3-stage ladder only (แผน → ส่งแล้ว → เสร็จ) — "กำลังดำเนินการ" from
            // the spec is deliberately skipped: nothing in this app has a real
            // floor/machine signal to drive it, so it would be a fake status with
            // no data behind it. A draft (unconfirmed) result stays inside the
            // "ส่งแล้ว" stage, just flagged with a small badge below.
            const stage: "planned" | "sent" | "done" =
              j.status !== "sent_to_floor" ? "planned" : result?.status === "confirmed" ? "done" : "sent";
            const railColor = stage === "planned" ? "#C9CFD6" : stage === "sent" ? "#1E40AF" : "#16A34A";
            const stateWord = stage === "planned" ? "○ ยังไม่ส่ง" : stage === "sent" ? "✓ ส่งแล้ว" : "✓ เสร็จ";
            const stateColor = stage === "planned" ? "#5F6B7A" : stage === "sent" ? "#1E40AF" : "#15803D";

            // Work chip = activity, not status/route — mixedEggLane is the one
            // real field this maps onto; it's a single boolean, so (unlike the
            // spec's example) a job here only ever shows one chip, never both.
            const workChipCls = j.mixedEggLane ? "bg-[#F5F3FF] text-[#5B21B6]" : "bg-[#EAF3DE] text-[#27500A]";
            const workChipLabel = j.mixedEggLane ? "คละ" : "คัดเบอร์";

            const actualQty = stage === "done" ? (result?.actualQty ?? j.qty) : null;
            const qtyAdjusted = actualQty != null && actualQty !== j.qty;

            const realTime = stage === "done" && result?.actualStart && result?.actualEnd
              ? `${result.actualStart}–${result.actualEnd}`
              : null;
            const plannedTime = j.plannedStart && j.plannedEnd ? `${j.plannedStart}–${j.plannedEnd}` : null;
            // Hand jobs: unset time just prints nothing (spec: "ไม่ระบุ = ไม่พิมพ์").
            // Machine jobs: unset time still prints a placeholder, since a
            // machine job is expected to have a slot.
            const timeLabel = realTime ?? plannedTime ?? (isRealMachine ? "ยังไม่กำหนดเวลา" : "");
            const eggG = lot?.avgWeight ? avgEggWeightG(lot.avgWeight) : null;

            const primaryBtnCls = "px-2.5 py-1 text-[10px] font-semibold rounded-md bg-[#F5F3FF] text-[#5B21B6] border border-[#C4B5FD] hover:bg-[#EDE9FE] disabled:opacity-50";
            const secondaryBtnCls = "px-2.5 py-1 text-[10px] font-semibold rounded-md border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]";

            return (
              <div key={j.id} className="border border-[#e3e5e8] rounded-lg px-3 py-2.5" style={{ borderLeft: `4px solid ${railColor}` }}>
                {/* Line 1 (24px): queue # (machine, not-done only) · lot · work chip · qty */}
                <div className="flex items-center gap-1.5 min-h-[24px] leading-none">
                  {isRealMachine && stage !== "done" && (
                    <span className="font-mono font-bold text-[#0C447C] text-[12.5px]">#{i + 1}</span>
                  )}
                  <span className="font-bold text-[#1a1a1a] text-[13px]">ล็อต {lot?.lotNo ?? "?"}</span>
                  <span className="ml-auto flex items-center gap-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center h-[18px] px-2 rounded-full text-[10.5px] font-semibold ${workChipCls}`}>
                      {workChipLabel}
                    </span>
                    {qtyAdjusted && <span className="text-[11.5px] text-[#64707d]">แผน {fmtNum(j.qty)} →</span>}
                    <span className="text-[15px] font-bold leading-none">
                      {qtyAdjusted && <span className="text-[11.5px] font-semibold text-green-700 mr-0.5">เข้าจริง </span>}
                      <span className={qtyAdjusted ? "text-green-700" : "text-[#1a1a1a]"}>{fmtNum(actualQty ?? j.qty)}</span>{" "}
                      <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span>
                    </span>
                  </span>
                </div>

                {/* Line 2 (18px): time (real, green, once recorded) · farm · weight (hand jobs never show weight) */}
                <div className="flex items-center gap-1.5 text-[11.5px] text-[#5F6B7A] mt-1.5 h-[18px] overflow-hidden whitespace-nowrap">
                  {timeLabel && (
                    <>
                      <span className={realTime ? "font-semibold text-green-700" : ""}>{timeLabel}</span>
                      {(lot?.farm || (isRealMachine && lot?.avgWeight)) && <span>·</span>}
                    </>
                  )}
                  {lot?.farm && (
                    <>
                      <span className="overflow-hidden text-ellipsis">{lot.farm}</span>
                      {isRealMachine && lot?.avgWeight && <span>·</span>}
                    </>
                  )}
                  {isRealMachine && lot?.avgWeight && (
                    <span>{Number(lot.avgWeight).toFixed(2)}kg/300 (≈{eggG ? eggG.toFixed(0) : "—"}g/ฟอง)</span>
                  )}
                </div>

                {/* Bottom row (30px): status word (+ draft-result flag) · ยกเลิก (planned only) · action(s) */}
                <div className="flex items-center gap-2 mt-2.5 h-[30px]">
                  <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: stateColor }}>{stateWord}</span>
                  {result?.status === "draft" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#FFFBEB] text-[#854F0B] border border-[#FCD34D]">
                      มีร่างผลจริง
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    {stage === "planned" && (
                      <button onClick={() => removeJob(j.id)} className="text-[11px] font-semibold text-[#888] hover:text-[#c0392b]">
                        ยกเลิก
                      </button>
                    )}
                    {stage === "planned" && (
                      <button onClick={() => sendToFloor(j.id)} disabled={sendingToFloor === j.id} className={primaryBtnCls}>
                        {sendingToFloor === j.id ? "กำลังส่ง..." : "ส่งงาน"}
                      </button>
                    )}
                    {stage === "sent" && (
                      <>
                        <button
                          onClick={() => setReleasedView({ mode: "live", scope: j.machine ?? "all", highlightJobId: j.id })}
                          className={secondaryBtnCls}
                        >
                          ใบงาน
                        </button>
                        <button onClick={() => setResultModal({ job: j, lot, seq: i + 1 })} className={primaryBtnCls}>
                          บันทึก
                        </button>
                      </>
                    )}
                    {stage === "done" && (
                      <button onClick={() => setResultModal({ job: j, lot, seq: i + 1 })} className={primaryBtnCls}>
                        ผลคัด
                      </button>
                    )}
                  </span>
                </div>

                {/* ถาดพิเศษ — a standalone action for a completed job, separate
                    from the general "+ เพิ่ม FG" inside the full result-edit
                    form: record how many of this job's already-graded trays
                    (for a WIP SKU) used the real tray/cover component — a
                    PARTITION of that line's qty, never added on top of it.
                    Shows the actual component (e.g. C29999P301), not just
                    the WIP SKU. Only offered once there's at least one
                    special-tray WIP item configured. */}
                {stage === "done" && specialWipItems.length > 0 && (() => {
                  const specialLines = result?.specialTrayLines ?? [];
                  return (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-dashed border-[#e3e5e8]">
                      <span className="text-[10px] font-semibold text-[#5B4B8A] uppercase tracking-wide">ถาดพิเศษ ✦</span>
                      {specialLines.map(f => (
                        <span key={f.itemId} className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#F5F2FB] text-[#5B4B8A]" title={`${f.sku} · วัสดุ: ${f.componentSku} ${f.componentName}`}>
                          {f.sku} · {f.componentName} ({f.componentSku}) {fmtNum(f.qty ?? 0)} ถาด
                        </span>
                      ))}
                      {specialLines.length === 0 && <span className="text-[10.5px] text-[#bbb]">ยังไม่มี</span>}
                      <button
                        onClick={() => setSpecialTrayModal({ job: j, result: result ?? null })}
                        className="ml-auto text-[10.5px] font-semibold text-[#5B4B8A] hover:underline"
                      >
                        + เพิ่มถาดพิเศษ
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
          3
        </span>
        <span className="text-[15px] font-bold text-[#1a1a1a]">Machine jobs</span>
      </div>
      <div className="flex items-center justify-between mb-3 ml-8">
        <span className="text-[12px] text-[#888] flex items-center gap-1">
          {machineOnlyKeys.length} เครื่อง · {machineJobs.length} งาน · เข้าเครื่อง {fmtNum(machineInput)} ฟอง
          <span
            title="รวมเฉพาะงานที่มีการระบุเครื่อง — งานมือแยกอยู่ในหัวข้อ Hand jobs ด้านล่าง"
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[#ccc] text-[#999] text-[9px] cursor-help"
          >
            i
          </span>
          <button
            onClick={() => onAddMachineJob()}
            className="ml-2 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]"
          >
            + Add machine
          </button>
        </span>
        <button
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect();
            setDocsAnchor(docsAnchor ? null : { top: r.bottom + 4, right: window.innerWidth - r.right });
          }}
          className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
        >
          เอกสารหน้างาน ▾
        </button>
      </div>

      {docsAnchor && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setDocsAnchor(null)} />
          <div
            className="fixed z-40 bg-white border border-[#e3e5e8] rounded-lg shadow-lg py-1 w-64 text-left"
            style={{ top: docsAnchor.top, right: docsAnchor.right }}
          >
            <button
              onClick={() => { setReleasedView({ mode: "live", scope: usedMachines[0] ?? "all" }); setDocsAnchor(null); }}
              disabled={!todaysJobs.length}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:text-[#bbb] disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              ดูคำสั่งงานเครื่อง
            </button>
            <button
              onClick={() => { setReleasedView({ mode: "live", scope: STOCK_MOVER_TAB }); setDocsAnchor(null); }}
              disabled={!todaysJobs.length}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:text-[#bbb] disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              ดูใบเคลื่อนย้ายสต๊อก
            </button>
            <div className="border-t border-[#f0f0f0] my-1" />
            <button
              onClick={() => printScope("all")}
              disabled={!todaysJobs.length}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:text-[#bbb] disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              พิมพ์ทุกเครื่อง
            </button>
            {usedMachines.map(m => (
              <button
                key={m}
                onClick={() => printScope(m)}
                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
              >
                พิมพ์ {m}
              </button>
            ))}
            <button
              onClick={() => printScope(STOCK_MOVER_TAB)}
              disabled={!todaysJobs.length}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5] disabled:text-[#bbb] disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              พิมพ์ใบเคลื่อนย้ายสต๊อก
            </button>
            <div className="border-t border-[#f0f0f0] my-1" />
            <button
              onClick={() => { setPrintHistoryOpen(true); setDocsAnchor(null); }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
            >
              ประวัติการพิมพ์ · {printEvents.length}
            </button>
          </div>
        </>
      )}

      {machineOnlyKeys.length === 0 && machineJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-[#e3e5e8] py-6 px-4 flex items-center gap-2 flex-wrap">
          <span className="text-[#bbb] text-sm">No machines</span>
          {GRADING_MACHINES.map(m => (
            <button
              key={m}
              onClick={() => onAddMachineJob(m)}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1a1a1a] hover:bg-[#f5f5f5]"
            >
              + {m}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {machineOnlyKeys.map(m => renderColumn(m))}
        </div>
      )}

      {/* 4 · Hand jobs — same jobs/print system as Machine jobs above, just the
          no-machine bucket (see the machine/hand split note near jobsByMachine)
          shown as its own labeled section instead of mixed into the grid. */}
      <div className="flex items-center gap-2 mt-6 mb-1">
        <span className="w-6 h-6 rounded-full bg-[#1a1a1a] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
          4
        </span>
        <span className="text-[15px] font-bold text-[#1a1a1a]">Hand jobs</span>
      </div>
      <div className="mb-3 ml-8">
        <span className="text-[12px] text-[#888]">
          {handJobs.length} งาน · เข้างาน {fmtNum(handInput)} ฟอง · ไข่คละ 3-4 จากไข่ที่คัดเบอร์แล้ว
        </span>
      </div>
      {handKeys.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-[#e3e5e8] py-10 text-center text-[#bbb] text-sm">
          ยังไม่มีงานมือวันนี้ — เพิ่มได้จาก "+ Add job" ด้านบน
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {handKeys.map(m => renderColumn(m))}
        </div>
      )}

      {resultModal && (
        <RecordActualResultModal
          job={resultModal.job}
          lot={resultModal.lot}
          seq={resultModal.seq}
          existing={resultByJobId[resultModal.job.id]}
          onClose={() => setResultModal(null)}
          onSaved={onResultsRefresh}
        />
      )}

      {specialTrayModal && (
        <AddSpecialTrayModal
          job={specialTrayModal.job}
          result={specialTrayModal.result}
          specialWipItems={specialWipItems}
          onClose={() => setSpecialTrayModal(null)}
          onSaved={() => { setSpecialTrayModal(null); onResultsRefresh(); }}
        />
      )}

      {releasedView && (
        <ReleasedWorkModal
          date={date}
          mode={releasedView.mode}
          initialScope={releasedView.mode === "live" ? releasedView.scope : releasedView.event.scope}
          highlightJobId={releasedView.mode === "live" ? releasedView.highlightJobId : undefined}
          usedMachines={usedMachines}
          rowsForScope={buildRowsForScope}
          snapshotEvent={releasedView.mode === "snapshot" ? releasedView.event : null}
          onClose={() => setReleasedView(null)}
          onPrint={async scope => {
            const created = await createPrintEvent(scope);
            return created;
          }}
        />
      )}

      {printHistoryOpen && (
        <PrintHistoryModal
          date={date}
          events={printEvents}
          onClose={() => setPrintHistoryOpen(false)}
          onReprint={event => {
            setPrintHistoryOpen(false);
            setReleasedView({ mode: "snapshot", event });
          }}
        />
      )}
    </div>
  );
}

// ── Floor documents: released-work view / print, and print history ─────────────
// Real, persisted (↔ /api/grading/print-events ↔ grading_print_events). "Live"
// mode shows today's current job data (tabs per machine); printing a scope
// POSTs a new numbered revision that freezes a snapshot, then reopens this
// same modal in "snapshot" mode over the frozen data and triggers the
// browser's print dialog — the print CSS below hides everything outside the
// modal so only the sheet itself prints. Reprinting from Print History replays
// a stored snapshot and never creates a new revision.

function ReleasedWorkModal({
  date,
  mode,
  initialScope,
  highlightJobId,
  usedMachines,
  rowsForScope,
  snapshotEvent,
  onClose,
  onPrint,
}: {
  date: string;
  mode: "live" | "snapshot";
  initialScope: string;
  highlightJobId?: number;
  usedMachines: string[];
  rowsForScope: (scope: string) => PrintSnapshotRow[];
  snapshotEvent: GradingPrintEvent | null;
  onClose: () => void;
  onPrint: (scope: string) => Promise<GradingPrintEvent | null>;
}) {
  const [tab, setTab] = useState(initialScope);
  const [printedRev, setPrintedRev] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);

  const dateLabel = date.split("-").reverse().join("/");
  const isStockMover =
    (mode === "live" && tab === STOCK_MOVER_TAB) || (mode === "snapshot" && snapshotEvent?.scope === STOCK_MOVER_TAB);
  const rows = mode === "snapshot" && snapshotEvent ? snapshotEvent.snapshot : rowsForScope(isStockMover ? "all" : tab);
  const totalEggs = rows.reduce((s, r) => s + r.qty, 0);
  // Stock Mover regroups the same jobs by lot/sub-lot instead of by machine —
  // a divided lot's single job becomes one row per sub-lot, each carrying
  // that sub's own real qty and weight, since that's genuinely what would
  // physically move to the floor. In snapshot mode this expands the frozen
  // job rows, so a reprint shows exactly what was printed, not live data.
  const stockMoverRows = isStockMover ? expandToStockMoverRows(rows) : [];
  const stockMoverTotal = stockMoverRows.reduce((s, r) => s + r.qty, 0);

  // Printed as one table per machine (in usedMachines order — matches the
  // tab order above — plus an "unassigned" bucket last for any job with no
  // machine set), each sorted by planned start time ascending, rather than
  // one combined table with a repeated machine column.
  const rowsByMachine = useMemo(() => {
    const groups = new Map<string, PrintSnapshotRow[]>();
    for (const r of rows) {
      const key = r.machine ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    for (const list of Array.from(groups.values())) {
      list.sort((a, b) => (a.plannedStart ?? "99:99").localeCompare(b.plannedStart ?? "99:99"));
    }
    const extra = Array.from(groups.keys()).filter(k => k !== "" && !usedMachines.includes(k)).sort();
    const order = [...usedMachines, ...extra, ""];
    return order.filter(m => groups.has(m)).map(m => [m, groups.get(m)!] as const);
  }, [rows, usedMachines]);

  const handlePrint = async () => {
    if (mode === "snapshot") {
      window.print();
      return;
    }
    setPrinting(true);
    try {
      const created = await onPrint(tab);
      if (created) {
        setPrintedRev(created.revision);
        setTimeout(() => window.print(), 250);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        @media print {
          @page { size: landscape; margin: 12mm; }
          body * { visibility: hidden; }
          #released-work-print-area, #released-work-print-area * { visibility: visible; }
          #released-work-print-area {
            position: absolute; top: 0; left: 0;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
          /* "Just a table" — everything else in the modal (title, badges, banner,
             tabs, footnote) is UI chrome, not the data itself, so it's dropped
             from the printed page. */
          #released-work-print-area .rwm-chrome { display: none !important; }
          #released-work-print-area > div { padding: 0 !important; overflow: visible !important; max-height: none !important; }
          #released-work-print-area .overflow-x-auto { overflow: visible !important; }
          /* A standard printed data table: grid borders, plain black text, no
             card styling, no colored pills/badges — readable at a normal body
             size instead of the previous 14pt, which pushed columns past the
             page width. */
          #released-work-print-area table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }
          #released-work-print-area table th,
          #released-work-print-area table td {
            border: 1px solid #000 !important;
            padding: 6px 8px !important;
            font-size: 11pt !important;
            color: #000 !important;
            background: #fff !important;
          }
          #released-work-print-area table th {
            white-space: nowrap;
            font-weight: 700 !important;
          }
          #released-work-print-area table span,
          #released-work-print-area table div {
            color: #000 !important;
            background: transparent !important;
          }
          #released-work-print-area table tr { outline: none !important; }
        }
      `}</style>
      <div
        id="released-work-print-area"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="rwm-chrome flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-[#1a1a1a]">
              {mode === "snapshot" ? "งานที่ปล่อยลงหน้างาน (พิมพ์)" : "งานที่ปล่อยลงหน้างาน"} · {dateLabel}
            </h2>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#EFF2F7] text-[#555]">
              ปล่อยแล้ว {rows.length} รายการ
              {mode === "snapshot" && snapshotEvent ? ` · รอบพิมพ์ ${snapshotEvent.revision}` : ""}
              {printedRev != null ? ` · รอบพิมพ์ ${printedRev}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={printing || !rows.length}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
            >
              {printing ? "กำลังพิมพ์..." : "พิมพ์"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
            >
              ปิด
            </button>
          </div>
        </div>

        <div className="rwm-chrome px-6 py-2.5 bg-[#FFFBEB] border-b border-[#FCD34D] text-[11px] text-[#854F0B]">
          แสดงงานคัดของขอบเขตนี้ตามที่ตกลงไว้บนบอร์ด — ไม่มีขั้นตอน "ปล่อยงาน" แยกต่างหาก การพิมพ์จะบันทึกรายการปัจจุบันเป็นรอบพิมพ์ที่มีเลขกำกับและแก้ไขไม่ได้
        </div>
        {mode === "snapshot" && snapshotEvent && (
          <div className="rwm-chrome px-6 py-2 text-[11px] text-[#888] border-b border-[#f0f0f0]">
            พิมพ์เมื่อ {new Date(snapshotEvent.printedAt).toLocaleString()} · โดย {snapshotEvent.printedBy ?? "ไม่ระบุ"}
          </div>
        )}

        {mode === "live" && (
          <div className="rwm-chrome flex items-center gap-4 px-6 pt-3 border-b border-[#e3e5e8]">
            {["all", ...usedMachines].map(m => (
              <button
                key={m}
                onClick={() => setTab(m)}
                className={`pb-2.5 text-[12.5px] font-semibold border-b-2 -mb-px ${
                  tab === m ? "border-[#7C3AED] text-[#7C3AED]" : "border-transparent text-[#888] hover:text-[#555]"
                }`}
              >
                {m === "all" ? "ทั้งหมด" : m} {m === "all" ? "" : `(${rowsForScope(m).length})`}
              </button>
            ))}
            <button
              onClick={() => setTab(STOCK_MOVER_TAB)}
              className={`pb-2.5 text-[12.5px] font-semibold border-b-2 -mb-px ${
                isStockMover ? "border-[#7C3AED] text-[#7C3AED]" : "border-transparent text-[#888] hover:text-[#555]"
              }`}
            >
              ใบเคลื่อนย้ายสต๊อก ({expandToStockMoverRows(rowsForScope("all")).length})
            </button>
          </div>
        )}

        <div className="px-6 py-4">
          <div className="rwm-chrome text-[13px] font-bold text-[#1a1a1a] mb-2">
            {isStockMover
              ? "ใบเคลื่อนย้ายสต๊อก"
              : (mode === "snapshot" && snapshotEvent ? snapshotEvent.scope : tab) === "all"
                ? "ทุกเครื่อง"
                : mode === "snapshot" && snapshotEvent
                  ? snapshotEvent.scope
                  : tab}{" "}
            <span className="text-[11px] font-normal text-[#888]">
              {isStockMover
                ? `· ${dateLabel} · ${stockMoverRows.length} รายการเคลื่อนย้าย · ${fmtNum(stockMoverTotal)} ฟอง`
                : `· ${dateLabel} · ${rows.length} งาน · ${fmtNum(totalEggs)} ฟอง`}
            </span>
          </div>
          {isStockMover ? (
            stockMoverRows.length === 0 ? (
              <div className="text-center text-[12px] text-[#aaa] py-10">ไม่มีล็อตที่ต้องเคลื่อนย้ายในวันนี้</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-[10px] text-[#888] uppercase tracking-wide border-b border-[#e3e5e8]">
                      <th className="text-left py-1.5 pr-2">เลขที่ล็อต</th>
                      <th className="text-right py-1.5 pr-2">จำนวน</th>
                      <th className="text-left py-1.5 pr-2">เครื่อง</th>
                      <th className="text-left py-1.5 pr-2">เวลา</th>
                      <th className="text-right py-1.5 pr-2">น้ำหนัก</th>
                      <th className="text-left py-1.5 pr-2">ฟาร์ม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMoverRows.map(r => (
                      <tr
                        key={r.key}
                        className={`border-b border-[#f0f0f0] ${
                          r.jobId === highlightJobId ? "outline outline-2 outline-[#1E40AF] outline-offset-[-1px]" : ""
                        }`}
                      >
                        <td className="py-2 pr-2 font-semibold text-[#0C447C]">{r.lotNo}</td>
                        <td className="py-2 pr-2 text-right font-semibold tabular-nums">{fmtNum(r.qty)}</td>
                        <td className="py-2 pr-2 text-[#555]">{r.machine ?? "—"}</td>
                        <td className="py-2 pr-2 text-[#555]">
                          {r.plannedStart && r.plannedEnd ? `${r.plannedStart}–${r.plannedEnd}` : "—"}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-[#555]">
                          {r.weight != null ? `${r.weight.toFixed(2)}kg/300` : "—"}
                        </td>
                        <td className="py-2 pr-2 text-[#555]">{r.farm ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : rows.length === 0 ? (
            <div className="text-center text-[12px] text-[#aaa] py-10">ไม่มีงานในขอบเขตนี้</div>
          ) : (
            <div className="space-y-4">
              {rowsByMachine.map(([machine, machineRows]) => (
                <div key={machine || "__unassigned__"} className="overflow-x-auto">
                  <div className="text-[11.5px] font-bold text-[#1a1a1a] mb-1">{machine || "ไม่ระบุเครื่อง"}</div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-[10px] text-[#888] uppercase tracking-wide border-b border-[#e3e5e8]">
                        <th className="text-left py-1.5 pr-2">เวลา</th>
                        <th className="text-left py-1.5 pr-2">เครื่อง</th>
                        <th className="text-left py-1.5 pr-2">เลขที่ล็อต</th>
                        <th className="text-left py-1.5 pr-2">ฟาร์ม</th>
                        <th className="text-right py-1.5 pr-2">น้ำหนัก</th>
                        <th className="text-right py-1.5 pr-2">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machineRows.map(r => (
                        <tr
                          key={r.jobId}
                          className={`border-b border-[#f0f0f0] ${
                            r.jobId === highlightJobId ? "outline outline-2 outline-[#1E40AF] outline-offset-[-1px]" : ""
                          }`}
                        >
                          <td className="py-2 pr-2 text-[#555]">
                            {r.plannedStart && r.plannedEnd ? `${r.plannedStart}–${r.plannedEnd}` : "—"}
                          </td>
                          <td className="py-2 pr-2 text-[#555]">{r.machine ?? "—"}</td>
                          <td className="py-2 pr-2 font-semibold text-[#0C447C]">{r.lotNo ?? "—"}</td>
                          <td className="py-2 pr-2 text-[#555]">{r.farm ?? "—"}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-[#555]">
                            {r.avgWeight ? `${Number(r.avgWeight).toFixed(2)}kg/300` : "—"}
                          </td>
                          <td className="py-2 pr-2 text-right font-semibold tabular-nums">{fmtNum(r.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
          <div className="text-[10.5px] text-[#aaa] mt-3 print:hidden">
            {isStockMover
              ? "จัดกลุ่มตามล็อต/ล็อตย่อยจากทุกเครื่อง · ลำดับถูกล็อกไว้ตอนพิมพ์"
              : (mode === "snapshot" && snapshotEvent ? snapshotEvent.scope : tab) === "all"
                ? "ทุกเครื่อง · ลำดับถูกล็อกไว้ตอนพิมพ์"
                : "เฉพาะเครื่องนี้ · ลำดับถูกล็อกไว้ตอนพิมพ์"}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintHistoryModal({
  date,
  events,
  onClose,
  onReprint,
}: {
  date: string;
  events: GradingPrintEvent[];
  onClose: () => void;
  onReprint: (event: GradingPrintEvent) => void;
}) {
  const latestByScope = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) m[e.scope] = Math.max(m[e.scope] ?? 0, e.revision);
    return m;
  }, [events]);

  const dateLabel = date.split("-").reverse().join("/");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[17px] font-bold text-[#1a1a1a]">ประวัติการพิมพ์ · {dateLabel}</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
          >
            ปิด
          </button>
        </div>
        <div className="px-6 py-4">
          {events.length === 0 ? (
            <div className="text-center text-[12px] text-[#aaa] py-10">ยังไม่มีการพิมพ์ในวันนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] text-[#888] uppercase tracking-wide border-b border-[#e3e5e8]">
                    <th className="text-left py-1.5 pr-3">ขอบเขต</th>
                    <th className="text-left py-1.5 pr-3">รอบพิมพ์</th>
                    <th className="text-left py-1.5 pr-3">พิมพ์เมื่อ</th>
                    <th className="text-left py-1.5 pr-3">โดย</th>
                    <th className="text-right py-1.5 pr-3">คำสั่งงาน</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-b border-[#f0f0f0]">
                      <td className="py-2 pr-3 font-semibold">
                        {e.scope === "all" ? "ทั้งหมด" : e.scope === STOCK_MOVER_TAB ? "ใบเคลื่อนย้ายสต๊อก" : e.scope}
                      </td>
                      <td className="py-2 pr-3">
                        {e.revision}
                        {e.revision === latestByScope[e.scope] && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">
                            ✓ ล่าสุด
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-[#555]">{new Date(e.printedAt).toLocaleString()}</td>
                      <td className="py-2 pr-3 text-[#888]">{e.printedBy ?? "ไม่ระบุ"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{e.jobIds.length}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => onReprint(e)}
                          className="px-2.5 py-1 text-[10.5px] font-semibold rounded-md border border-[#d6d8dc] text-[#1E40AF] hover:bg-[#f5f5f5]"
                        >
                          ดู / พิมพ์ซ้ำ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-[10.5px] text-[#aaa] mt-3">
            ทุกรอบพิมพ์คือภาพนิ่งที่แก้ไขไม่ได้ — การพิมพ์ซ้ำจะไม่เขียนทับข้อมูลเดิม
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Record actual grading result ──────────────────────────────────────────────
// Real, persisted (↔ /api/grading/jobs/:jobId/result ↔ grading_job_results
// table). Forecast-per-outcome is computed here, not stored, by applying the
// active yield model to this job's qty + its lot's weight (same lower-bound-
// step match as "From today's jobs" in Section 2). No.6 is never a real actual
// outcome — no entry field, no forecast, always "unknown" — matching the design
// reference's explicit rule that No.6 is legacy/unmapped. FG/WIP product
// mapping, work-instruction linkage, and versioned corrections from the design
// reference aren't modeled — there's no Product Master or WI system in this
// app yet; editing and re-saving a confirmed result overwrites it in place.

// ── "+ เพิ่มถาดพิเศษ" — a standalone post-completion action ──────────────────
// A completed job's output already has a real confirmed result; this just
// appends one more fgLine to it (a tray count against a special-tray WIP
// SKU) without touching anything else already recorded. Reuses the exact
// same PUT /api/grading/jobs/:jobId/result the full result form uses —
// just a lighter, dedicated entry point for this one operation, per the
// user's explicit request. See /Users/krisdachugh/.claude/plans/scalable-hatching-moore.md
// A completed job's "+ เพิ่มถาดพิเศษ" — records how many of that job's
// ALREADY-graded trays (for a WIP SKU) physically used the real tray/cover
// component. This is a PARTITION of the SKU's existing production, not
// additional output: the qty entered is the real, total count of trays
// that used the special tray, defaulting to "all of what was graded"
// (editable down from there), never added on top of the fgLines qty.
function AddSpecialTrayModal({
  job,
  result,
  specialWipItems,
  onClose,
  onSaved,
}: {
  job: GradingJob;
  result: GradingJobResult | null;
  specialWipItems: { id: number; sku: string; name: string; eggsPerPack: number; primarySize: string | null; secondarySize: string | null; componentSku: string; componentName: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const fgQtyFor = (itemId: number) => result?.fgLines.find(f => f.itemId === itemId)?.qty ?? 0;
  const existingSpecialFor = (itemId: number) => result?.specialTrayLines.find(f => f.itemId === itemId)?.qty ?? null;

  const [itemId, setItemId] = useState<number | null>(specialWipItems[0]?.id ?? null);
  // Default: whatever's already recorded as special for this item, else the
  // full graded total for it (assume all-special until told otherwise).
  const [qtyStr, setQtyStr] = useState(() => {
    const first = specialWipItems[0];
    if (!first) return "";
    const existing = existingSpecialFor(first.id);
    return String(existing ?? fgQtyFor(first.id));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = specialWipItems.find(i => i.id === itemId) ?? null;
  const qty = Number(qtyStr) || 0;
  const gradedTotal = selected ? fgQtyFor(selected.id) : 0;

  const pickItem = (id: number) => {
    setItemId(id);
    const existing = existingSpecialFor(id);
    setQtyStr(String(existing ?? fgQtyFor(id)));
    setError("");
  };

  const save = async () => {
    setError("");
    if (!selected) return setError("เลือก SKU ถาดพิเศษก่อน");
    if (gradedTotal <= 0) return setError(`ยังไม่มีข้อมูล "+ เพิ่ม FG" สำหรับ ${selected.sku} ในงานนี้ — เพิ่มที่นั่นก่อน`);
    if (qty < 0 || qty > gradedTotal) return setError(`จำนวนต้องอยู่ระหว่าง 0–${fmtNum(gradedTotal)} ถาด (เท่าที่คัดได้จริงในงานนี้)`);
    setSaving(true);
    try {
      // Replace (not add to) any existing line for this item — the entered
      // qty IS the real total, not an increment.
      const existingLines = result?.specialTrayLines ?? [];
      const newLine: GradingJobResultSpecialTrayLine = {
        itemId: selected.id, sku: selected.sku, name: selected.name,
        componentSku: selected.componentSku, componentName: selected.componentName, qty,
      };
      const mergedLines = existingLines.some(f => f.itemId === selected.id)
        ? existingLines.map(f => (f.itemId === selected.id ? newLine : f))
        : [...existingLines, newLine];
      // Every other field carries over exactly as already recorded —
      // fgLines (production) is untouched, this only ever partitions it.
      const r = await fetch(`/api/grading/jobs/${job.id}/result`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualQty: result?.actualQty ?? null,
          actualBySub: result?.actualBySub ?? null,
          inputNote: result?.inputNote ?? null,
          actualStart: result?.actualStart ?? null,
          actualEnd: result?.actualEnd ?? null,
          output: result?.output ?? {},
          fgLines: result?.fgLines ?? [],
          mixedLines: result?.mixedLines ?? [],
          ungradedQty: result?.ungradedQty ?? null,
          defects: result?.defects ?? {},
          specialTrayLines: mergedLines,
          weighingLoss: result?.weighingLoss ?? null,
          otherVariance: result?.otherVariance ?? null,
          varianceNote: result?.varianceNote ?? null,
          status: "confirmed",
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">+ เพิ่มถาดพิเศษ</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-[12px] text-[#888]">ล็อต {job.lotId} · งาน #{job.id}</div>
          {error && <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">{error}</div>}
          <div>
            <label className="block text-[11px] text-[#888] mb-1">SKU ถาดพิเศษ</label>
            <select
              value={itemId ?? ""}
              onChange={e => pickItem(Number(e.target.value))}
              className="w-full h-9 px-2 text-[13px] border border-[#d6d8dc] rounded-lg bg-white"
            >
              {specialWipItems.map(i => (
                <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>
              ))}
            </select>
          </div>
          {selected && (
            <div className="px-3 py-2 rounded-lg bg-[#F5F2FB] border border-[#E3DDF0] text-[12px] text-[#5B4B8A]">
              วัสดุถาดพิเศษ: <span className="font-bold">{selected.componentSku} · {selected.componentName}</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] text-[#888] mb-1">จำนวนถาดที่ใช้ถาดพิเศษ (จากที่คัดได้ {fmtNum(gradedTotal)} ถาด)</label>
            <input
              type="number"
              autoFocus
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value)}
              placeholder="0"
              className="w-full h-9 px-2 text-[13px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
            />
            <div className="text-[11px] text-[#aaa] mt-1">
              ค่าที่กรอกคือจำนวนจริงที่ใช้ถาดพิเศษ (ไม่ใช่จำนวนที่เพิ่มขึ้น) · ไม่เพิ่มยอดผลิตของ {selected?.sku ?? "SKU"}
              {selected && qty > 0 && <> · = {fmtNum(qty * selected.eggsPerPack)} ฟอง</>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#e5e7eb]">
          <button onClick={onClose} className="text-[13px] text-[#1E40AF] hover:underline">ยกเลิก</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-[13px] font-semibold rounded-lg bg-[#5B4B8A] text-white hover:bg-[#4C3D75] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordActualResultModal({
  job,
  lot,
  seq,
  existing,
  onClose,
  onSaved,
}: {
  job: GradingJob;
  lot: GradingLot | undefined;
  seq: number;
  existing: GradingJobResult | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [yieldModels, setYieldModels] = useState<YieldModel[]>([]);
  useEffect(() => {
    fetch("/api/grading/yield-models")
      .then(r => (r.ok ? r.json() : []))
      .then(setYieldModels)
      .catch(() => {});
  }, []);
  const activeModel = yieldModels.find(m => m.active) ?? null;

  // Additional FG — real Product Master items (GET /api/items) that can be
  // graded directly into a Finished Good SKU instead of tallied loose by
  // size. Self-fetched, matching the yield-models fetch above.
  const [fgItems, setFgItems] = useState<FgCandidateItem[]>([]);
  useEffect(() => {
    fetch("/api/items")
      .then(r => (r.ok ? r.json() : []))
      .then(setFgItems)
      .catch(() => {});
  }, []);
  const fgCandidates = useMemo(
    () => fgItems.filter(i => fgOutcomeFor(i) != null),
    [fgItems],
  );
  const fgItemById = useMemo(() => {
    const m: Record<number, FgCandidateItem> = {};
    for (const i of fgItems) m[i.id] = i;
    return m;
  }, [fgItems]);

  // Real cover/plastic/lid PACKAGING catalog items — options for overriding
  // which one a WIP line actually used this job (see specialTraySlotFor).
  const coverCandidates = useMemo(
    () => fgItems.filter(i => i.itemRole === "PACKAGING" && /plastic|cover|lid/i.test(i.itemType ?? "")),
    [fgItems],
  );
  // itemId -> chosen component SKU, seeded from whatever's already recorded
  // (via this selector or the completed-card "+ เพิ่มถาดพิเศษ" action).
  const [trayChoice, setTrayChoice] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const l of existing?.specialTrayLines ?? []) m[l.itemId] = l.componentSku;
    return m;
  });

  type FgLineDraft = { itemId: number; sku: string; name: string; outcome: string; unit: string; factor: number; qtyStr: string };
  const [fgLines, setFgLines] = useState<FgLineDraft[]>(() =>
    (existing?.fgLines ?? []).map(f => ({
      itemId: f.itemId,
      sku: f.sku,
      name: f.name,
      outcome: f.outcome,
      unit: f.unit,
      factor: f.factor,
      qtyStr: f.qty != null ? String(f.qty) : "",
    })),
  );
  const [fgOpen, setFgOpen] = useState((existing?.fgLines?.length ?? 0) > 0);
  // position: fixed (not absolute) so the picker isn't clipped by this
  // modal's own scrollable body — same fix as the Receiving Lots row menu.
  const [fgPickerAnchor, setFgPickerAnchor] = useState<{ top: number; left: number } | null>(null);
  const [fgSearch, setFgSearch] = useState("");
  const fgBase = fgLines.reduce((s, f) => s + (Number(f.qtyStr) || 0) * f.factor, 0);

  // Mixed output can be several different adjacent-size pairs within one
  // job (e.g. some 3-4 mixed and some 4-5 mixed) — each is its own line, and
  // output.mixed (used everywhere else the "mixed" outcome is read: FG
  // mapping, forecasting, the yield model) is always kept equal to their sum.
  type MixedLineDraft = { range: string; qtyStr: string };
  const [mixedLines, setMixedLines] = useState<MixedLineDraft[]>(() =>
    (existing?.mixedLines ?? []).map(m => ({ range: m.range, qtyStr: m.qty != null ? String(m.qty) : "" })),
  );
  const mixedTotal = mixedLines.reduce((s, m) => s + (Number(m.qtyStr) || 0), 0);
  const addMixedLine = () => {
    const used = new Set(mixedLines.map(m => m.range));
    const nextRange = MIXED_RANGES.find(r => !used.has(r)) ?? MIXED_RANGES[0];
    setMixedLines(lines => [...lines, { range: nextRange, qtyStr: "" }]);
  };
  const removeMixedLine = (idx: number) => setMixedLines(lines => lines.filter((_, i) => i !== idx));

  const addFgLine = (item: FgCandidateItem) => {
    const outcome = fgOutcomeFor(item);
    if (!outcome) return;
    const units = unitsForFgItem(item);
    setFgLines(lines => [
      ...lines,
      { itemId: item.id, sku: item.sku ?? "", name: item.name, outcome, unit: units[0].unit, factor: units[0].factor, qtyStr: "" },
    ]);
    setFgOpen(true);
    setFgPickerAnchor(null);
  };
  const removeFgLine = (idx: number) => setFgLines(lines => lines.filter((_, i) => i !== idx));

  const [differs, setDiffers] = useState(existing?.actualQty != null && existing.actualQty !== job.qty);
  const [actualQtyStr, setActualQtyStr] = useState(existing?.actualQty != null ? String(existing.actualQty) : String(job.qty));
  // A per-sub-lot actual breakdown only makes sense when this job covers the
  // WHOLE divided lot — a job doesn't track which sub-lot its eggs came from,
  // so a partial job against a divided lot can't be honestly attributed to
  // specific subs, and falls back to the single Actual input field instead.
  const isDividedFullLot = !!lot && lot.divided && lot.subs.length > 0 && lotReceived(lot) === job.qty;
  const [subActuals, setSubActuals] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    if (existing?.actualBySub) {
      for (const [k, v] of Object.entries(existing.actualBySub)) m[k] = String(v);
    } else if (lot?.divided) {
      for (const sb of lot.subs) m[sb.ref] = String(sb.qty ?? 0);
    }
    return m;
  });
  const [inputNote, setInputNote] = useState(existing?.inputNote ?? "");
  const [actualStart, setActualStart] = useState(existing?.actualStart ?? "");
  const [actualEnd, setActualEnd] = useState(existing?.actualEnd ?? "");
  const [output, setOutput] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const s of ACTUAL_OUTPUT_SIZES) o[s] = existing?.output?.[s] != null ? String(existing.output[s]) : "";
    return o;
  });
  const [defects, setDefects] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const c of GRADING_DEFECTS) d[c.id] = existing?.defects?.[c.id] != null ? String(existing.defects[c.id]) : "";
    return d;
  });
  const [ungradedQtyStr, setUngradedQtyStr] = useState(existing?.ungradedQty != null ? String(existing.ungradedQty) : "");
  const [weighingLoss, setWeighingLoss] = useState(existing?.weighingLoss != null ? String(existing.weighingLoss) : "");
  const [otherVariance, setOtherVariance] = useState(existing?.otherVariance != null ? String(existing.otherVariance) : "");
  const [varianceNote, setVarianceNote] = useState(existing?.varianceNote ?? "");
  const [saving, setSaving] = useState<"draft" | "confirm" | null>(null);
  const [error, setError] = useState("");

  const actualQty = differs
    ? isDividedFullLot
      ? Object.values(subActuals).reduce((s, v) => s + (Number(v) || 0), 0)
      : Number(actualQtyStr) || 0
    : job.qty;

  const forecast = useMemo(() => forecastForJob(activeModel, lot, job.qty).sizes, [activeModel, lot, job.qty]);

  const wipSum = ACTUAL_OUTPUT_SIZES.reduce(
    (s, size) => s + (size === "mixed" ? mixedTotal : Number(output[size]) || 0),
    0,
  );
  const ungradedQty = Number(ungradedQtyStr) || 0;
  const outputSum = wipSum + fgBase + ungradedQty; // wipBase + fgBase + ungraded — ungraded is real, accounted-for qty, not a loss
  const defectSum =
    GRADING_DEFECTS.reduce((s, c) => s + (Number(defects[c.id]) || 0), 0) +
    (Number(weighingLoss) || 0) +
    (Number(otherVariance) || 0);
  const diff = actualQty - outputSum - defectSum;

  let recon: { cls: string; text: string };
  if (diff === 0 && outputSum + defectSum > 0) {
    recon = { cls: "text-green-700 font-bold", text: `ผลผลิต ${fmtNum(outputSum)} + สูญเสีย ${fmtNum(defectSum)} = เข้าเครื่อง ${fmtNum(actualQty)} ✓` };
  } else if (diff < 0) {
    recon = { cls: "text-red-700 font-bold", text: `เกินจำนวนเข้าเครื่องจริง ${fmtNum(-diff)} ฟอง` };
  } else if (outputSum + defectSum <= 0) {
    recon = { cls: "text-[#555]", text: `กรอกยอดรวมให้ครบ ${fmtNum(actualQty)} ฟอง` };
  } else {
    recon = { cls: "text-[#555]", text: `บันทึกแล้ว ${fmtNum(outputSum + defectSum)} · คงเหลือ ${fmtNum(diff)} ฟอง` };
  }

  const save = async (status: "draft" | "confirmed") => {
    setError("");
    if (differs && !inputNote.trim()) return setError("กรุณาระบุเหตุผล: จำนวนเข้าเครื่องจริงต่างจากแผน");
    const otherVarianceNum = otherVariance !== "" ? Number(otherVariance) : 0;
    if (otherVarianceNum !== 0 && !varianceNote.trim()) return setError("กรุณาระบุเหตุผล: คำอธิบายส่วนต่าง");
    if (status === "confirmed" && (!actualStart || !actualEnd)) return setError("กรุณากรอกเวลาเริ่มและเวลาสิ้นสุดการคัดจริง");

    setSaving(status === "confirmed" ? "confirm" : "draft");
    try {
      const r = await fetch(`/api/grading/jobs/${job.id}/result`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualQty: differs ? actualQty : null,
          actualBySub:
            differs && isDividedFullLot && lot
              ? Object.fromEntries(lot.subs.map(sb => [sb.ref, Number(subActuals[sb.ref]) || 0]))
              : null,
          inputNote: differs ? inputNote : null,
          actualStart: actualStart || null,
          actualEnd: actualEnd || null,
          output: {
            ...Object.fromEntries(
              ACTUAL_OUTPUT_SIZES.filter(s => s !== "mixed" && output[s] !== "").map(s => [s, Number(output[s])]),
            ),
            ...(mixedLines.length ? { mixed: mixedTotal } : {}),
          },
          mixedLines: mixedLines
            .filter(m => m.qtyStr !== "")
            .map(m => ({ range: m.range, qty: Number(m.qtyStr) || 0 })),
          ungradedQty: ungradedQtyStr !== "" ? ungradedQty : null,
          fgLines: fgLines.map(f => ({
            itemId: f.itemId,
            sku: f.sku,
            name: f.name,
            outcome: f.outcome,
            unit: f.unit,
            factor: f.factor,
            qty: f.qtyStr !== "" ? Number(f.qtyStr) : null,
            baseEggs: (Number(f.qtyStr) || 0) * f.factor,
          })),
          defects: Object.fromEntries(GRADING_DEFECTS.filter(c => defects[c.id] !== "").map(c => [c.id, Number(defects[c.id])])),
          // Built from each special-tray-eligible FG line's chosen component
          // (the inline selector below "สินค้า FG") — a full partition of
          // that line's qty, same convention "+ เพิ่มถาดพิเศษ" uses. Any
          // previously-recorded line for an item no longer in this job's FG
          // lines is carried over untouched (the PUT endpoint replaces the
          // whole row, so dropping it here would silently delete it).
          specialTrayLines: (() => {
            const result: { itemId: number; sku: string; name: string; componentSku: string; componentName: string; qty: number }[] = [];
            const handledItemIds = new Set<number>();
            for (const f of fgLines) {
              const fgItem = fgItemById[f.itemId];
              const slot = fgItem ? specialTraySlotFor(fgItem) : null;
              if (!slot) continue;
              handledItemIds.add(f.itemId);
              const qty = Number(f.qtyStr) || 0;
              if (qty <= 0) continue;
              const chosenSku = trayChoice[f.itemId] ?? slot.componentSku;
              const comp = coverCandidates.find(c => c.sku === chosenSku);
              result.push({ itemId: f.itemId, sku: f.sku, name: f.name, componentSku: chosenSku, componentName: comp?.name ?? chosenSku, qty });
            }
            for (const l of existing?.specialTrayLines ?? []) {
              if (!handledItemIds.has(l.itemId)) result.push(l);
            }
            return result;
          })(),
          weighingLoss: weighingLoss !== "" ? Number(weighingLoss) : null,
          otherVariance: otherVariance !== "" ? Number(otherVariance) : null,
          varianceNote: varianceNote || null,
          status,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.message || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="text-[17px] font-bold text-[#1a1a1a]">บันทึกผลลัพธ์จริง · ล็อต {lot?.lotNo ?? "?"}</h2>
            <div className="text-[11.5px] text-[#888] mt-0.5">
              {job.machine ?? "ไม่มีเครื่อง"} #{seq} · {lot?.farm ?? "—"} · แผน {fmtNum(job.qty)} ฟอง
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[12px] text-[#991B1B]">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#e3e5e8] p-4">
            <div className="flex items-center gap-3 flex-wrap justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#1a1a1a]">เข้าเครื่องจริง</span>
                {differs && !isDividedFullLot ? (
                  <input
                    type="number"
                    value={actualQtyStr}
                    onChange={e => setActualQtyStr(e.target.value)}
                    className="w-28 h-8 px-2 text-[13px] text-right border border-[#1E40AF] rounded-lg"
                  />
                ) : (
                  <span className="text-[15px] font-bold tabular-nums">{fmtNum(actualQty)}</span>
                )}
                <span className="text-[13px] text-[#555]">ฟอง</span>
                {!differs && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#EFF2F7] text-[#555]">
                    ตามแผน
                  </span>
                )}
              </div>
              <label className="flex items-center gap-2 text-[11.5px]">
                เวลาคัดจริง
                <input
                  type="time"
                  value={actualStart}
                  onChange={e => setActualStart(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg"
                />
                –
                <input
                  type="time"
                  value={actualEnd}
                  onChange={e => setActualEnd(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#d6d8dc] rounded-lg"
                />
              </label>
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-[12px] text-[#555] cursor-pointer">
              <input
                type="checkbox"
                checked={differs}
                onChange={e => {
                  setDiffers(e.target.checked);
                  if (!e.target.checked) setActualQtyStr(String(job.qty));
                }}
                className="w-4 h-4 rounded accent-[#1E40AF]"
              />
              จำนวนเข้าเครื่องจริงต่างจากแผน
            </label>
            {differs && isDividedFullLot && lot && (
              <div className="mt-2.5 max-w-xl">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-[10px] text-[#888] uppercase tracking-wide">
                      <th className="text-left py-1">แหล่งที่มา</th>
                      <th className="text-right py-1">แผน</th>
                      <th className="text-right py-1">จริง</th>
                      <th className="text-right py-1">คงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.subs.map(sb => {
                      const actual = Number(subActuals[sb.ref] ?? 0);
                      const balance = (sb.qty ?? 0) - actual;
                      return (
                        <tr key={sb.ref} className="border-t border-[#f0f0f0]">
                          <td className="py-1.5 text-[#1a1a1a]">{lot.lotNo}-{sb.ref}</td>
                          <td className="py-1.5 text-right tabular-nums text-[#555]">{fmtNum(sb.qty ?? 0)}</td>
                          <td className="py-1.5 text-right">
                            <input
                              type="number"
                              value={subActuals[sb.ref] ?? ""}
                              onChange={e => setSubActuals(s => ({ ...s, [sb.ref]: e.target.value }))}
                              className="w-24 h-7 px-2 text-[12px] text-right border border-[#d6d8dc] rounded focus:outline-none focus:border-[#1E40AF]"
                            />
                          </td>
                          <td
                            className={`py-1.5 text-right tabular-nums ${
                              balance !== 0 ? "text-[#854F0B] font-semibold" : "text-[#aaa]"
                            }`}
                          >
                            {fmtNum(balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {differs && (
              <input
                value={inputNote}
                onChange={e => setInputNote(e.target.value)}
                placeholder="เหตุผล *"
                className="mt-2 w-full max-w-md px-2.5 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <div className="bg-white rounded-xl border border-[#e3e5e8] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[13px] font-bold text-[#1a1a1a]">ผลผลิตจริงตามเบอร์</span>
                <span className="text-[11px] text-[#888]">ว่าง = ยังไม่บันทึก · 0 = ไม่มี</span>
              </div>
              {!activeModel && (
                <div className="text-[11px] font-semibold text-[#854F0B] mb-2">ไม่มีโมเดลผลผลิตที่ใช้งานอยู่ — ไม่สามารถพยากรณ์ได้</div>
              )}
              {activeModel && lot?.divided && lotReceived(lot) !== job.qty && (
                <div className="text-[11px] font-semibold text-[#854F0B] mb-2">
                  งานนี้ครอบคลุมเพียงบางส่วนของล็อตที่แบ่งไว้ — ไม่สามารถพยากรณ์ได้ (ไม่ทราบว่าจะใช้น้ำหนักของล็อตย่อยใด)
                </div>
              )}
              <div className="grid grid-cols-[minmax(70px,1fr)_130px_minmax(80px,1fr)_minmax(70px,1fr)] gap-x-2.5 gap-y-2 text-[10px] font-semibold text-[#737373]">
                <span>เบอร์</span>
                <span className="text-right">จริง</span>
                <span className="text-right">พยากรณ์</span>
                <span className="text-right">ผลต่าง</span>
              </div>
              <div className="grid grid-cols-[minmax(70px,1fr)_130px_minmax(80px,1fr)_minmax(70px,1fr)] gap-x-2.5 gap-y-2 items-center mt-1.5">
                {ACTUAL_OUTPUT_SIZES.map(size => {
                  const isMixed = size === "mixed";
                  const fc = forecast[size];
                  const actual = isMixed ? (mixedLines.length ? mixedTotal : null) : output[size] !== "" ? Number(output[size]) : null;
                  const d = actual != null && fc != null ? Math.round(actual - fc) : null;
                  return (
                    <Fragment key={size}>
                      <span className="text-[12.5px] font-semibold text-[#1a1a1a]">{sizeLabel(size)}</span>
                      {isMixed ? (
                        <span className="text-right text-[12.5px] tabular-nums text-[#1a1a1a]">
                          {mixedLines.length ? fmtNum(mixedTotal) : "—"}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={output[size]}
                          onChange={e => setOutput(o => ({ ...o, [size]: e.target.value }))}
                          placeholder="—"
                          className="w-full h-8 px-2 text-[12.5px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                        />
                      )}
                      <span className="text-right text-[12.5px] tabular-nums text-[#555]">
                        {fc != null ? fmtNum(fc) : "—"}
                      </span>
                      <span className={`text-right text-[12.5px] tabular-nums ${d == null ? "text-[#aaa]" : "font-semibold"}`}>
                        {d == null ? "—" : d === 0 ? "0" : d > 0 ? `+${fmtNum(d)}` : `−${fmtNum(-d)}`}
                      </span>
                      {isMixed &&
                        mixedLines.map((m, i) => {
                          const availableRanges = MIXED_RANGES.filter(
                            r => r === m.range || !mixedLines.some((x, j) => j !== i && x.range === r),
                          );
                          return (
                            <Fragment key={i}>
                              <select
                                value={m.range}
                                onChange={e =>
                                  setMixedLines(lines => lines.map((x, j) => (j === i ? { ...x, range: e.target.value } : x)))
                                }
                                className="h-8 pl-3 pr-1 text-[11.5px] text-[#555] border border-[#e3e5e8] rounded-lg"
                              >
                                {availableRanges.map(r => (
                                  <option key={r} value={r}>
                                    คละ {r}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={m.qtyStr}
                                onChange={e =>
                                  setMixedLines(lines => lines.map((x, j) => (j === i ? { ...x, qtyStr: e.target.value } : x)))
                                }
                                placeholder="—"
                                className="w-full h-8 px-2 text-[12.5px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                              />
                              <span className="text-right text-[11.5px] tabular-nums text-[#555]">
                                {forecast[m.range] != null ? fmtNum(forecast[m.range]) : "—"}
                              </span>
                              <button
                                onClick={() => removeMixedLine(i)}
                                title="ลบ"
                                className="text-right text-[#aaa] hover:text-[#c0392b] text-[13px] leading-none"
                              >
                                ×
                              </button>
                            </Fragment>
                          );
                        })}
                      {isMixed && mixedLines.length < MIXED_RANGES.length && (
                        <button
                          onClick={addMixedLine}
                          className="col-span-4 text-left text-[11.5px] font-semibold text-[#1E40AF] hover:underline"
                        >
                          + เพิ่มรายการคละ
                        </button>
                      )}
                    </Fragment>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#f0f0f0]">
                <span
                  className="text-[12.5px] font-semibold text-[#1a1a1a]"
                  title="เมื่อยืนยันผลแล้ว ระบบจะสร้างล็อตรับเข้าใหม่จากจำนวนนี้โดยอัตโนมัติ เพื่อนำไปวางแผนคัดใหม่อีกครั้ง"
                >
                  ไข่ยังไม่ผ่านการคัด ⓘ
                </span>
                <input
                  type="number"
                  value={ungradedQtyStr}
                  onChange={e => setUngradedQtyStr(e.target.value)}
                  placeholder="—"
                  className="w-28 h-8 px-2 text-[12.5px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
              </div>
              <div
                className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#f0f0f0]"
                title="ไม่มีช่องกรอกผลจริงสำหรับเบอร์ 6 · ไม่ใช้ค่า 0 แทนค่าที่ไม่ทราบ"
              >
                <span className="text-[12.5px] text-[#1a1a1a]">เบอร์ 6</span>
                <span className="text-[12.5px] font-semibold text-[#888]">ไม่ทราบ</span>
              </div>

              <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                <button
                  onClick={() => setFgOpen(o => !o)}
                  className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#43536B] hover:text-[#1a1a1a]"
                >
                  <span>{fgOpen ? "▾" : "▸"}</span>
                  {fgLines.length ? `FG เพิ่มเติม ${fgLines.length} รายการ · ${fmtNum(fgBase)} ฟอง ›` : "+ เพิ่ม FG"}
                </button>
                {fgOpen && (
                  <div className="mt-2">
                    {fgLines.length > 0 && (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-[10px] text-[#888] uppercase">
                              <th className="text-left py-1 pr-2">สินค้า FG</th>
                              <th className="text-left py-1 pr-2">เบอร์</th>
                              <th className="text-right py-1 pr-2">จำนวน</th>
                              <th className="text-left py-1 pr-2">หน่วย</th>
                              <th className="text-right py-1 pr-2">ฟองฐาน</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {fgLines.map((f, i) => {
                              const fgItem = fgItemById[f.itemId];
                              const units = fgItem ? unitsForFgItem(fgItem) : [{ unit: f.unit, factor: f.factor }];
                              const traySlot = fgItem ? specialTraySlotFor(fgItem) : null;
                              const chosenTraySku = traySlot ? (trayChoice[f.itemId] ?? traySlot.componentSku) : null;
                              return (
                                <tr key={i} className="border-t border-[#f0f0f0]">
                                  <td className="py-1.5 pr-2 text-[#1a1a1a] align-top">
                                    <div>{f.sku} · {f.name}</div>
                                    {traySlot && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[9.5px] text-[#5B4B8A] font-semibold shrink-0">ฝาครอบ ✦</span>
                                        <select
                                          value={chosenTraySku ?? ""}
                                          onChange={e => setTrayChoice(prev => ({ ...prev, [f.itemId]: e.target.value }))}
                                          className="h-6 px-1 text-[10.5px] border border-[#d6d8dc] rounded text-[#5B4B8A]"
                                        >
                                          {!coverCandidates.some(c => c.sku === chosenTraySku) && chosenTraySku && (
                                            <option value={chosenTraySku}>{chosenTraySku}</option>
                                          )}
                                          {coverCandidates.map(c => (
                                            <option key={c.sku} value={c.sku ?? ""}>
                                              {c.sku} · {c.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-2 align-top">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${SIZE_CHIP_COLORS[f.outcome] ?? ""}`}>
                                      {sizeLabel(f.outcome)}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-2 text-right align-top">
                                    <input
                                      type="number"
                                      value={f.qtyStr}
                                      onChange={e =>
                                        setFgLines(lines => lines.map((x, j) => (j === i ? { ...x, qtyStr: e.target.value } : x)))
                                      }
                                      placeholder="ว่าง"
                                      className="w-24 h-7 px-2 text-[12px] text-right border border-[#d6d8dc] rounded focus:outline-none focus:border-[#1E40AF]"
                                    />
                                  </td>
                                  <td className="py-1.5 pr-2 align-top">
                                    <select
                                      value={f.unit}
                                      onChange={e => {
                                        const u = units.find(uu => uu.unit === e.target.value);
                                        if (u) {
                                          setFgLines(lines =>
                                            lines.map((x, j) => (j === i ? { ...x, unit: u.unit, factor: u.factor } : x)),
                                          );
                                        }
                                      }}
                                      className="h-7 px-1.5 text-[12px] border border-[#d6d8dc] rounded"
                                    >
                                      {units.map(u => (
                                        <option key={u.unit} value={u.unit}>
                                          {u.unit} ×{u.factor}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-[#1a1a1a] align-top">
                                    {f.qtyStr !== "" ? fmtNum((Number(f.qtyStr) || 0) * f.factor) : "—"}
                                  </td>
                                  <td className="py-1.5 text-right align-top">
                                    <button
                                      onClick={() => removeFgLine(i)}
                                      title="ลบ"
                                      className="text-[#aaa] hover:text-[#c0392b] text-[13px] leading-none"
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div>
                      <button
                        onClick={e => {
                          if (fgPickerAnchor) {
                            setFgPickerAnchor(null);
                          } else {
                            const r = e.currentTarget.getBoundingClientRect();
                            setFgSearch("");
                            setFgPickerAnchor({ top: r.bottom + 4, left: r.left });
                          }
                        }}
                        className="text-[11.5px] font-semibold text-[#1E40AF] hover:underline"
                      >
                        + เลือก FG...
                      </button>
                      {fgPickerAnchor && (() => {
                        const available = fgCandidates.filter(i => !fgLines.some(f => f.itemId === i.id));
                        const q = fgSearch.trim().toLowerCase();
                        const matches = q
                          ? available.filter(i => (i.sku ?? "").toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
                          : available;
                        const shown = matches.slice(0, 50);
                        return (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setFgPickerAnchor(null)} />
                            <div
                              className="fixed z-40 w-80 max-h-72 flex flex-col bg-white border border-[#e3e5e8] rounded-lg shadow-lg"
                              style={{ top: fgPickerAnchor.top, left: fgPickerAnchor.left }}
                            >
                              <input
                                autoFocus
                                value={fgSearch}
                                onChange={e => setFgSearch(e.target.value)}
                                placeholder="ค้นหา SKU หรือชื่อสินค้า..."
                                className="w-full h-8 px-3 text-[12px] border-b border-[#e3e5e8] focus:outline-none rounded-t-lg"
                              />
                              <div className="overflow-y-auto py-1">
                                {available.length === 0 ? (
                                  <div className="px-3 py-2 text-[12px] text-[#aaa]">ไม่มีสินค้า FG เพิ่มเติมให้เลือก</div>
                                ) : matches.length === 0 ? (
                                  <div className="px-3 py-2 text-[12px] text-[#aaa]">ไม่พบรายการที่ตรงกับ "{fgSearch}"</div>
                                ) : (
                                  <>
                                    {shown.map(i => (
                                      <button
                                        key={i.id}
                                        onClick={() => addFgLine(i)}
                                        className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a1a1a] hover:bg-[#f5f5f5]"
                                      >
                                        {i.sku} · {i.name} · {sizeLabel(fgOutcomeFor(i)!)}
                                      </button>
                                    ))}
                                    {matches.length > shown.length && (
                                      <div className="px-3 py-1.5 text-[11px] text-[#aaa]">
                                        อีก {matches.length - shown.length} รายการ — ปรับคำค้นหาให้แคบลง
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e3e5e8] p-4">
              <div className="text-[13px] font-bold text-[#1a1a1a] mb-3">ตำหนิ</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                {GRADING_DEFECTS.map(c => (
                  <div key={c.id}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-1">{c.label}</label>
                    <input
                      type="number"
                      value={defects[c.id]}
                      onChange={e => setDefects(d => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="—"
                      className="w-full h-8 px-2 text-[12.5px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                    />
                  </div>
                ))}
              </div>
              <div
                className="text-[10px] font-semibold uppercase tracking-wide text-[#888] mt-4 mb-2"
                title="สำหรับกระทบยอดเท่านั้น — ไม่ใช่ตำหนิด้านคุณภาพ"
              >
                ส่วนต่าง ⓘ
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-1">สูญเสียจากการชั่ง</label>
                  <input
                    type="number"
                    value={weighingLoss}
                    onChange={e => setWeighingLoss(e.target.value)}
                    placeholder="—"
                    className="w-full h-8 px-2 text-[12.5px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#888] mb-1">ส่วนต่างอื่น</label>
                  <input
                    type="number"
                    value={otherVariance}
                    onChange={e => setOtherVariance(e.target.value)}
                    placeholder="—"
                    className="w-full h-8 px-2 text-[12.5px] text-right border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                  />
                </div>
              </div>
              {Number(otherVariance) !== 0 && otherVariance !== "" && (
                <input
                  value={varianceNote}
                  onChange={e => setVarianceNote(e.target.value)}
                  placeholder="คำอธิบายส่วนต่าง *"
                  className="mt-3 w-full px-2.5 py-1.5 text-[12px] border border-[#d6d8dc] rounded-lg focus:outline-none focus:border-[#1E40AF]"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-[#e5e7eb] flex-wrap">
          <span className={`text-[12px] tabular-nums ${recon.cls}`}>{recon.text}</span>
          <span className="flex-1" />
          <button
            onClick={() => save("draft")}
            disabled={saving != null}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5] disabled:opacity-50"
          >
            {saving === "draft" ? "กำลังบันทึก..." : "บันทึกร่าง"}
          </button>
          <button
            onClick={() => save("confirmed")}
            disabled={saving != null}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
          >
            {saving === "confirm" ? "กำลังบันทึก..." : existing?.status === "confirmed" ? "อัปเดตผลลัพธ์จริง" : "ยืนยันผลลัพธ์จริง"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Yield model upload / management modal ────────────────────────────────────────

// The yield model is no longer something a user uploads — it's one, always-
// active history the system maintains itself: seeded once from real
// historical data, then grown automatically every time a job's actual
// result is confirmed (see appendActualToYieldHistory on the server). This
// modal is read-only — there's nothing left to upload or activate, just the
// history to inspect.
function YieldModelModal({
  models,
  onClose,
}: {
  models: YieldModel[];
  onClose: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  const model = models.find(m => m.active) ?? models[0] ?? null;
  const totalLots = model?.rows.reduce((s, r) => s + (r.n ?? 1), 0) ?? 0;
  const learnedRowCount =
    model?.rows.filter(r => Object.keys(r.contributions ?? {}).some(k => k !== "seed")).length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[19px] font-bold text-[#1a1a1a]">ประวัติผลผลิตการคัด</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {viewing && model ? (
            <YieldModelRowsView model={model} onBack={() => setViewing(false)} />
          ) : !model ? (
            <div className="py-10 text-center text-[#bbb] text-sm bg-[#fafbfc] rounded-lg border border-dashed border-[#e3e5e8]">
              ยังไม่มีประวัติผลผลิต — "จากงานวันนี้" จะยังพยากรณ์ไม่ได้จนกว่าจะมีอย่างน้อยหนึ่งงานที่ยืนยันผลลัพธ์จริงแล้ว
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#86EFAC] bg-[#F0FDF4]">
              <div>
                <div className="text-[13px] font-semibold text-[#1a1a1a]">{model.name}</div>
                <div className="text-[11px] text-[#888]">
                  {model.rows.length} แถวน้ำหนัก · {fmtNum(totalLots)} ล็อตสะสม · ปรับปรุงจากงานจริงแล้ว {learnedRowCount} แถว · หน่วย{" "}
                  {model.predictorUnit}
                </div>
              </div>
              <button
                onClick={() => setViewing(true)}
                className="ml-auto px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#d6d8dc] text-[#1E40AF] hover:bg-[#f5f5f5]"
              >
                ดู
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Read-only inspection of a yield model's own uploaded rows — weight, size
// distribution, defect categories, the source's declared row Sum, and the
// per-row active/off state. Lets a user verify what a model actually
// contains (e.g. which rows are "off" and excluded from matching) without
// re-opening the original spreadsheet.
function YieldModelRowsView({ model, onBack }: { model: YieldModel; onBack: () => void }) {
  // Rows from before defects/sum/active/source existed have no such keys at
  // all — treated the same as the system's own default (missing → active,
  // missing source → "seed").
  const sortedRows = [...model.rows].sort((a, b) => a.weight - b.weight);
  const usedSizes = EGG_SIZES.filter(s => sortedRows.some(r => r.sizes[s] != null));
  const usedDefects = MODEL_DEFECT_CATEGORIES.filter(c => sortedRows.some(r => r.defects?.[c.id] != null));
  const hasSum = sortedRows.some(r => r.sum != null);
  const inactiveCount = sortedRows.filter(r => r.active === false).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[13px] font-bold text-[#1a1a1a]">{model.name}</div>
          <div className="text-[11px] text-[#888]">
            {sortedRows.length} แถว · หน่วย {model.predictorUnit}
            {inactiveCount > 0 && ` · ปิดใช้งาน ${inactiveCount} แถว (ไม่ใช้ในการจับคู่)`}
          </div>
        </div>
        <button onClick={onBack} className="text-[12px] font-semibold text-[#1E40AF] hover:underline">
          ← ย้อนกลับ
        </button>
      </div>
      <div className="border border-[#e3e5e8] rounded-lg overflow-hidden">
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#fafbfc] text-[10px] text-[#888] uppercase sticky top-0">
                <th className="text-right px-3 py-1.5">น้ำหนัก ({model.predictorUnit})</th>
                <th className="text-right px-3 py-1.5">ล็อต</th>
                {usedSizes.map(s => (
                  <th key={s} className="text-right px-3 py-1.5">
                    เบอร์{s}
                  </th>
                ))}
                {usedDefects.map(c => (
                  <th key={c.id} className="text-right px-3 py-1.5">
                    {c.label}
                  </th>
                ))}
                {hasSum && <th className="text-right px-3 py-1.5">รวม</th>}
                <th className="text-left px-3 py-1.5">ที่มา</th>
                <th className="text-right px-3 py-1.5">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => (
                <tr key={i} className={`border-t border-[#f0f0f0] ${r.active === false ? "text-[#bbb]" : ""}`}>
                  <td className="text-right px-3 py-1 tabular-nums font-semibold">{r.weight}</td>
                  <td className="text-right px-3 py-1 tabular-nums">{r.n ?? 1}</td>
                  {usedSizes.map(s => (
                    <td key={s} className="text-right px-3 py-1 tabular-nums">
                      {r.sizes[s] ?? "—"}
                    </td>
                  ))}
                  {usedDefects.map(c => (
                    <td key={c.id} className="text-right px-3 py-1 tabular-nums">
                      {r.defects?.[c.id] ?? "—"}
                    </td>
                  ))}
                  {hasSum && (
                    <td className="text-right px-3 py-1 tabular-nums">{r.sum != null ? `${r.sum}%` : "—"}</td>
                  )}
                  <td className="text-left px-3 py-1">
                    {(() => {
                      const learned = Object.keys(r.contributions ?? {}).filter(k => k !== "seed").length;
                      return r.source === "actual" ? (
                        <span className="text-[#0C447C]">เรียนรู้จากงานจริง {learned} งาน</span>
                      ) : (
                        <span className="text-[#888]">
                          ข้อมูลตั้งต้น{learned > 0 ? ` · ปรับปรุงจากงานจริง ${learned} งาน` : ""}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="text-right px-3 py-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        r.active !== false ? "bg-[#F0FDF4] text-green-700" : "bg-[#F5F5F5] text-[#999]"
                      }`}
                    >
                      {r.active !== false ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── BOM view ───────────────────────────────────────────────────────────────────

type BomComponentLine = {
  componentSku: string; componentName: string | null; itemType: string | null;
  role: string; source: "profile" | "additional"; qtyPerPack: number; qtyNeeded: number; resolved: boolean;
};
type BomFinishedGood = {
  itemId: number; sku: string; name: string; sellingUnit: string | null; packUnit: string | null; baseUnit: string | null;
  eggsPerPack: number; primarySize: string | null; secondarySize: string | null;
  totalQtyPacks: number; totalEggs: number;
  byCustomer: { partnerName: string; qtyPacks: number }[];
  components: BomComponentLine[]; status: "ready" | "needs_setup"; issueReasons: string[];
};
type BomMaterial = {
  componentSku: string; componentName: string | null; itemType: string | null; totalQtyNeeded: number;
  resolved: boolean; usedByFgLines: { sku: string; name: string; qtyNeeded: number }[]; status: "ready" | "needs_setup";
};
type BomIssueGroup = { kind: string; label: string; count: number; skus: { sku: string; name: string; detail: string }[] };
type BomRequirements = {
  date: string; round: number;
  eggDemand: { total: number; bySize: { size: string; eggs: number }[]; byCustomer: { partnerName: string; eggs: number }[] };
  finishedGoods: BomFinishedGood[];
  materials: BomMaterial[];
  issues: BomIssueGroup[];
  issueTotal: number;
};

const MATERIAL_TYPE_LABEL: Record<string, string> = {
  tray: "ถาด/กะทัด", cover: "ฝาปิด", label: "ฉลาก", sticker: "สติ๊กเกอร์",
  bag: "ถุง", bundle: "มัด/รัด", basket: "ตะกร้า", other: "อื่นๆ",
};

// ── BOM view — Production Requirements/BOM, matching the prototype's
// _bom*/_rmr*/_dpb* module. Entirely read-only/derived: reads this round's
// real PQ (same join computePqRoundData uses) against items.packagingProfile/
// additionalMaterials (already real, live BOM data — see Items.tsx's
// PKG_SLOTS), no local round of its own. See server/routes/bom.ts. ─────────
function BomView({ date, round, onDateChange }: { date: string; round: Round; onDateChange: (d: string) => void }) {
  const [data, setData] = useState<BomRequirements | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/bom/requirements?date=${date}&round=${round}`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [date, round]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // Lineage badge — the active published pq_snapshots version for this
  // date/round if one exists, else "PQ draft (unpublished)". The numbers
  // themselves are always live (computed fresh above), this badge is just
  // provenance context, same as the prototype's own read-only disclaimer.
  const [pqVersion, setPqVersion] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/pq-snapshots?date=${date}&round=${round}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: { version: number; state: string }[]) => {
        if (cancelled) return;
        const active = rows.find(r => r.state === "active");
        setPqVersion(active ? active.version : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date, round]);

  const [issuesOpen, setIssuesOpen] = useState(false);
  const [openIssueKinds, setOpenIssueKinds] = useState<Set<string>>(new Set());
  const toggleIssueKind = (k: string) => setOpenIssueKinds(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Section 2 toolbar state
  type ViewBy = "customer" | "size" | "packType";
  const [viewBy, setViewBy] = useState<ViewBy>("customer");
  const [sortBy, setSortBy] = useState<"qty" | "sku" | "size" | "packType">("qty");
  const [skuFilter, setSkuFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [packTypeFilter, setPackTypeFilter] = useState("all");
  const resetFilters = () => { setViewBy("customer"); setSortBy("qty"); setSkuFilter(""); setNameFilter(""); setSizeFilter("all"); setPackTypeFilter("all"); };

  // Section 3 toolbar state
  const [matGroupFilter, setMatGroupFilter] = useState("all");
  const [matStatusFilter, setMatStatusFilter] = useState<"all" | "ready" | "needs_setup">("all");
  const [matDetailOpen, setMatDetailOpen] = useState(false);

  const fg = data?.finishedGoods ?? [];
  const sizeOptions = useMemo(() => Array.from(new Set(fg.map(f => f.primarySize).filter(Boolean))) as string[], [fg]);
  const packTypeOptions = useMemo(() => Array.from(new Set(fg.map(f => f.packUnit).filter(Boolean))) as string[], [fg]);

  const filteredFg = useMemo(() => {
    const skuQ = skuFilter.trim().toLowerCase();
    const nameQ = nameFilter.trim().toLowerCase();
    return fg
      .filter(f => !skuQ || f.sku.toLowerCase().includes(skuQ))
      .filter(f => !nameQ || f.name.toLowerCase().includes(nameQ))
      .filter(f => sizeFilter === "all" || f.primarySize === sizeFilter)
      .filter(f => packTypeFilter === "all" || f.packUnit === packTypeFilter)
      .sort((a, b) => {
        if (sortBy === "sku") return a.sku.localeCompare(b.sku);
        if (sortBy === "size") return (a.primarySize ?? "").localeCompare(b.primarySize ?? "");
        if (sortBy === "packType") return (a.packUnit ?? "").localeCompare(b.packUnit ?? "");
        return b.totalQtyPacks - a.totalQtyPacks;
      });
  }, [fg, skuFilter, nameFilter, sizeFilter, packTypeFilter, sortBy]);

  const fgGroups = useMemo(() => {
    const groups: { key: string; label: string; rows: BomFinishedGood[] }[] = [];
    if (viewBy === "customer") {
      const byCust: Record<string, BomFinishedGood[]> = {};
      for (const row of filteredFg) {
        const names = row.byCustomer.length ? row.byCustomer.map(c => c.partnerName) : ["ไม่ทราบลูกค้า"];
        for (const name of names) (byCust[name] ??= []).push(row);
      }
      for (const [k, rows] of Object.entries(byCust)) groups.push({ key: k, label: k, rows });
    } else if (viewBy === "size") {
      const bySize: Record<string, BomFinishedGood[]> = {};
      for (const row of filteredFg) (bySize[row.primarySize ?? "ไม่ระบุ"] ??= []).push(row);
      for (const [k, rows] of Object.entries(bySize)) groups.push({ key: k, label: EGG_SIZES.includes(k) ? `เบอร์ ${k}` : k, rows });
    } else {
      const byPack: Record<string, BomFinishedGood[]> = {};
      for (const row of filteredFg) (byPack[row.packUnit || "ไม่ระบุ"] ??= []).push(row);
      for (const [k, rows] of Object.entries(byPack)) groups.push({ key: k, label: k, rows });
    }
    return groups.sort((a, b) => b.rows.reduce((s, r) => s + r.totalQtyPacks, 0) - a.rows.reduce((s, r) => s + r.totalQtyPacks, 0));
  }, [filteredFg, viewBy]);

  const materials = data?.materials ?? [];
  const materialTypeOptions = useMemo(() => Array.from(new Set(materials.map(m => m.itemType).filter(Boolean))) as string[], [materials]);
  const filteredMaterials = materials
    .filter(m => matGroupFilter === "all" || m.itemType === matGroupFilter)
    .filter(m => matStatusFilter === "all" || m.status === matStatusFilter);

  if (loading && !data) {
    return <div className="py-16 text-center text-[#bbb] text-sm bg-white rounded-xl border border-[#E1E5EA]">กำลังโหลด...</div>;
  }
  if (!data || data.finishedGoods.length === 0) {
    return (
      <div className="space-y-4">
        <BomCommandBar date={date} round={round} onDateChange={onDateChange} pqVersion={pqVersion} />
        <div className="py-16 text-center text-[#bbb] text-sm bg-white rounded-xl border border-[#E1E5EA]">ไม่มีออเดอร์ในรอบนี้</div>
      </div>
    );
  }

  // KPI cards — all real, derived from the payload above.
  const eggTop3 = data.eggDemand.byCustomer.slice(0, 3);
  const fgByCustomerCount: Record<string, number> = {};
  for (const row of fg) for (const c of row.byCustomer) fgByCustomerCount[c.partnerName] = (fgByCustomerCount[c.partnerName] ?? 0) + 1;
  const fgTop4 = Object.entries(fgByCustomerCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const formatGroups: Record<string, number> = {};
  for (const row of fg) formatGroups[row.packUnit || "ไม่ระบุ"] = (formatGroups[row.packUnit || "ไม่ระบุ"] ?? 0) + row.totalQtyPacks;
  const formatSorted = Object.entries(formatGroups).sort((a, b) => b[1] - a[1]);
  const matTypeGroups: Record<string, number> = {};
  for (const m of materials) matTypeGroups[m.itemType || "other"] = (matTypeGroups[m.itemType || "other"] ?? 0) + m.totalQtyNeeded;
  const matTypeSorted = Object.entries(matTypeGroups).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <BomCommandBar date={date} round={round} onDateChange={onDateChange} pqVersion={pqVersion} />

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
          <div className="text-[11px] text-[#888] mb-1">Egg demand</div>
          <div className="text-[19px] font-bold text-[#1a1a1a]">{fmtNum(data.eggDemand.total)} <span className="text-[11px] font-normal text-[#aaa]">ฟอง</span></div>
          <div className="text-[10.5px] text-[#aaa] mt-1 truncate">
            {eggTop3.map(c => `${c.partnerName} ${fmtNum(c.eggs)}`).join(" · ") || "—"}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
          <div className="text-[11px] text-[#888] mb-1">Finished goods</div>
          <div className="text-[19px] font-bold text-[#1a1a1a]">{fg.length} <span className="text-[11px] font-normal text-[#aaa]">SKU</span></div>
          <div className="text-[10.5px] text-[#aaa] mt-1 truncate">
            {fgTop4.map(([name, n]) => `${name} ${n}`).join(" · ") || "—"}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
          <div className="text-[11px] text-[#888] mb-1">Production format</div>
          <div className="text-[19px] font-bold text-[#1a1a1a] truncate">{formatSorted[0] ? `${formatSorted[0][0]} ${fmtNum(formatSorted[0][1])}` : "—"}</div>
          <div className="text-[10.5px] text-[#aaa] mt-1 truncate">
            {formatSorted.length <= 1 ? "single format" : formatSorted.slice(1, 5).map(([name, n]) => `${name} ${fmtNum(n)}`).join(" · ")}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E1E5EA] p-4">
          <div className="text-[11px] text-[#888] mb-1">Pack / handling materials</div>
          <div className="text-[19px] font-bold text-[#1a1a1a] truncate">
            {matTypeSorted[0] ? `${MATERIAL_TYPE_LABEL[matTypeSorted[0][0]] ?? matTypeSorted[0][0]} ${fmtNum(matTypeSorted[0][1])}` : "—"}
          </div>
          <div className="text-[10.5px] text-[#aaa] mt-1 truncate">
            {matTypeSorted.length === 0 ? "ไม่มีวัตถุดิบในแผนนี้" : matTypeSorted.length <= 1 ? "single item" : matTypeSorted.slice(1, 5).map(([t, n]) => `${MATERIAL_TYPE_LABEL[t] ?? t} ${fmtNum(n)}`).join(" · ")}
          </div>
        </div>
      </div>

      {/* Setup actions — real counts from server/routes/bom.ts's issue
          classification (missing BOM, missing component SKU/qty, unresolved
          component). Expect most SKUs here today — only 5 of 197 sellable
          items have a packaging_profile configured right now; that's the
          real state, not a bug. */}
      {data.issueTotal > 0 ? (
        <div className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] px-4 py-3">
          <button onClick={() => setIssuesOpen(v => !v)} className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <span>🔧</span>
              <span className="text-[13px] font-bold text-[#92400E]">Setup actions before this plan is reliable</span>
              <span className="text-[12px] text-[#92400E]">{data.issueTotal} issues</span>
            </div>
            <span className="text-[11px] text-[#92400E]">{issuesOpen ? "ซ่อน ▴" : "แสดง ▾"}</span>
          </button>
          {issuesOpen && (
            <div className="mt-2 space-y-1.5">
              {data.issues.map(g => (
                <div key={g.kind}>
                  <button onClick={() => toggleIssueKind(g.kind)} className="flex items-center gap-2 text-[12px] text-[#92400E]">
                    <span className={`text-[9px] transition-transform ${openIssueKinds.has(g.kind) ? "rotate-90" : ""}`}>›</span>
                    {g.label} <span className="font-semibold">{g.count}</span>
                  </button>
                  {openIssueKinds.has(g.kind) && (
                    <div className="ml-5 mt-1 flex flex-wrap gap-1.5">
                      {g.skus.map(s => (
                        <span key={s.sku} className="px-2 py-0.5 rounded text-[10.5px] bg-white border border-[#FDE68A] text-[#92400E]" title={s.detail}>
                          {s.sku} · {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#86EFAC] bg-[#F0FDF4] text-[12.5px] text-green-700">
          <span>✓</span> ข้อมูลครบ พร้อมจัดเตรียมวัสดุ
        </div>
      )}

      {/* Finished Goods Plan */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[14px] font-bold text-[#1a1a1a]">Finished Goods Plan</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF4FF] text-[#1E40AF]">O-R{round}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2 text-[11.5px]">
          <span className="text-[#888]">View by</span>
          <select value={viewBy} onChange={e => setViewBy(e.target.value as ViewBy)} className="h-7 px-1.5 border border-[#d6d8dc] rounded bg-white">
            <option value="customer">Customer</option>
            <option value="size">Egg size</option>
            <option value="packType">Pack type</option>
          </select>
          <span className="text-[#888] ml-2">Sort by</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="h-7 px-1.5 border border-[#d6d8dc] rounded bg-white">
            <option value="qty">Qty high to low</option>
            <option value="sku">SKU</option>
            <option value="size">Egg size</option>
            <option value="packType">Pack type</option>
          </select>
          <input value={skuFilter} onChange={e => setSkuFilter(e.target.value)} placeholder="SKU#" className="h-7 w-24 px-2 border border-[#d6d8dc] rounded" />
          <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Name" className="h-7 w-28 px-2 border border-[#d6d8dc] rounded" />
          <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="h-7 px-1.5 border border-[#d6d8dc] rounded bg-white">
            <option value="all">Egg size: All</option>
            {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={packTypeFilter} onChange={e => setPackTypeFilter(e.target.value)} className="h-7 px-1.5 border border-[#d6d8dc] rounded bg-white">
            <option value="all">Pack type: All</option>
            {packTypeOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={resetFilters} className="h-7 px-2 text-[#1E40AF] hover:underline">↺ Reset</button>
          <span className="text-[10.5px] text-[#bbb] ml-auto" title="ไม่มีข้อมูลงานด่วน/ปกติในระบบนี้ — ไม่แสดงตัวกรอง Speed เพื่อไม่ให้ดูเหมือนมีข้อมูลที่ไม่มีจริง">
            ไม่มีตัวกรอง "Speed" — ไม่มีฟิลด์งานด่วนในระบบ
          </span>
        </div>
        <div className="space-y-3">
          {fgGroups.map(group => (
            <div key={group.key} className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
              <div className="px-4 py-2 bg-[#fafbfc] border-b border-[#e5e7eb] text-[12px] font-bold text-[#1a1a1a]">
                {group.label} <span className="font-normal text-[#888]">· {group.rows.length} SKU · {fmtNum(group.rows.reduce((s, r) => s + r.totalQtyPacks, 0))} แพ็ก</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#f0f0f0] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                    <th className="text-left px-4 py-1.5">สินค้า/Product</th>
                    <th className="text-left px-3 py-1.5">รายละเอียด/Spec</th>
                    <th className="text-right px-3 py-1.5">จำนวนผลิต/Planned qty</th>
                    <th className="text-right px-4 py-1.5">สถานะ/Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(row => (
                    <tr key={`${group.key}-${row.itemId}`} className="border-b border-[#f5f5f5] last:border-b-0">
                      <td className="px-4 py-2">
                        <div className="font-mono text-[11px] text-[#0C447C]">{row.sku}</div>
                        <div className="text-[#1a1a1a]">{row.name}</div>
                      </td>
                      <td className="px-3 py-2 text-[#888]">
                        {EGG_SIZES.includes(row.primarySize ?? "") || row.secondarySize ? `เบอร์ ${row.primarySize}${row.secondarySize ? `-${row.secondarySize}` : ""} · ` : ""}
                        {row.packUnit || "—"} · {fmtNum(row.eggsPerPack)} ฟอง/{row.packUnit || "หน่วย"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {fmtNum(row.totalQtyPacks)} {row.packUnit || ""}
                        <div className="text-[10.5px] font-normal text-[#aaa]">{fmtNum(row.totalEggs)} ฟอง</div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {row.status === "ready" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">พร้อม</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">ต้องแก้ไข BOM</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {fgGroups.length === 0 && (
            <div className="py-10 text-center text-[#bbb] text-[13px] bg-white rounded-xl border border-[#E1E5EA]">ไม่พบที่ตรงกับตัวกรอง</div>
          )}
        </div>
      </div>

      {/* Raw Material Required — aggregated across every FG line above,
          grouped by material type. "egg" isn't a group here since eggs
          aren't a packaging_profile component — they're the Egg demand KPI
          already. */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[14px] font-bold text-[#1a1a1a]">Raw Material Required</span>
          <span className="text-[11px] text-[#888]">วัตถุดิบที่ต้องเตรียม</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2 text-[11.5px]">
          <span className="text-[#888]">Type</span>
          <select value={matGroupFilter} onChange={e => setMatGroupFilter(e.target.value)} className="h-7 px-1.5 border border-[#d6d8dc] rounded bg-white">
            <option value="all">All</option>
            {materialTypeOptions.map(t => <option key={t} value={t}>{MATERIAL_TYPE_LABEL[t] ?? t}</option>)}
          </select>
          <span className="text-[#888] ml-2">Status</span>
          <select value={matStatusFilter} onChange={e => setMatStatusFilter(e.target.value as any)} className="h-7 px-1.5 border border-[#d6d8dc] rounded bg-white">
            <option value="all">All</option>
            <option value="ready">พร้อม</option>
            <option value="needs_setup">ต้องแก้ข้อมูล</option>
          </select>
          <button onClick={() => setMatDetailOpen(v => !v)} className="h-7 px-2 border border-[#d6d8dc] rounded text-[#555] hover:bg-[#f5f5f5] ml-auto">
            {matDetailOpen ? "🔍 Hide detail" : "🔍 Show detail"}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
          {filteredMaterials.length === 0 ? (
            <div className="py-10 text-center text-[#bbb] text-[13px]">ไม่มีวัตถุดิบที่ต้องเตรียมในแผนนี้ (ยังไม่มี SKU ที่ตั้งค่า BOM สำเร็จ)</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#fafbfc] text-[10px] font-bold text-[#888] uppercase tracking-wide">
                  <th className="text-left px-4 py-2">วัตถุดิบ/Material</th>
                  <th className="text-left px-3 py-2">ชนิด/Type</th>
                  <th className="text-right px-3 py-2">ต้องใช้/Required</th>
                  <th className="text-right px-4 py-2">สถานะ/Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map(m => (
                  <Fragment key={m.componentSku}>
                    <tr className="border-b border-[#f5f5f5]">
                      <td className="px-4 py-2">
                        <div className="font-mono text-[11px] text-[#0C447C]">{m.componentSku}</div>
                        <div className="text-[#1a1a1a]">{m.componentName ?? "(ไม่พบใน Master Data)"}</div>
                      </td>
                      <td className="px-3 py-2 text-[#888]">{MATERIAL_TYPE_LABEL[m.itemType ?? ""] ?? m.itemType ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(m.totalQtyNeeded)}</td>
                      <td className="px-4 py-2 text-right">
                        {m.status === "ready" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#F0FDF4] text-green-700 border border-[#86EFAC]">พร้อม</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">ต้องแก้ข้อมูล</span>
                        )}
                      </td>
                    </tr>
                    {matDetailOpen && (
                      <tr className="border-b border-[#f5f5f5] bg-[#fafbfc]">
                        <td colSpan={4} className="px-4 py-2 text-[11px] text-[#888]">
                          ใช้โดย: {m.usedByFgLines.map(u => `${u.sku} (${fmtNum(u.qtyNeeded)})`).join(" · ")}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function BomCommandBar({ date, round, onDateChange, pqVersion }: { date: string; round: Round; onDateChange: (d: string) => void; pqVersion: number | null }) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-3.5 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">Requirement date</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onDateChange(addDays(date, -1))} className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">‹</button>
          <input type="date" value={date} onChange={e => e.target.value && onDateChange(e.target.value)} className="h-8 px-2 text-[13px] border border-[#e3e5e8] rounded-lg bg-white focus:outline-none focus:border-[#1E40AF]" />
          <button onClick={() => onDateChange(addDays(date, 1))} className="w-7 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5]">›</button>
        </div>
        <button onClick={() => onDateChange(todayISO())} className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${date === todayISO() ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"}`}>
          Today
        </button>
        <div className="ml-auto text-right">
          <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Source (lineage)</div>
          <div className="text-[11.5px] text-[#555]">
            {pqVersion != null ? `PQ v${pqVersion}` : "PQ draft (unpublished)"} · O-R R{round} + BOM — read-only · no local round (M-R) · print = report only, releases nothing
          </div>
        </div>
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

// ── Daily Operations top-level process nav ───────────────────────────────────────
// Sits above the existing round/sub-tab bar without replacing it — each tab here
// just selects the matching existing sub-tab. Production (subtab "bom") is also
// reachable directly at /orders/daily-plan/production (see DailyPlan()'s
// initial-subtab logic below), which just lands on this same tab.

const L1_TABS: { key: string; label: string; subtab: SubTab }[] = [
  { key: "overview", label: "Overview", subtab: "overview" },
  { key: "orders", label: "Orders", subtab: "demand" },
  { key: "production", label: "Production", subtab: "bom" },
  // Trip Manager (TripManager, rendered below when subtab === "trip") has
  // been fully built and wired to real data for a while, but had no nav
  // entry anywhere — not in this L1 bar, no route, nothing calls
  // setSubtab("trip") — making it genuinely unreachable in the live app.
  // Found while the user looked for the new picking-list print's entry
  // point (TripManager's "ส่ง Trip" button). Not something broken by any
  // recent edit — `git log -S` shows no prior commit ever added this tab.
  { key: "delivery", label: "Delivery", subtab: "trip" },
  { key: "checkout", label: "Checkout", subtab: "checkout" },
  { key: "fgstock", label: "FG Stock", subtab: "fgstock" },
];

function DailyOperationsNav({
  subtab,
  onSelect,
  orderTab,
  onOrderTab,
  prodTab,
  onProdTab,
}: {
  subtab: SubTab;
  onSelect: (s: SubTab) => void;
  orderTab: "planning" | "aq";
  onOrderTab: (t: "planning" | "aq") => void;
  prodTab: ProductionSubTab;
  onProdTab: (t: ProductionSubTab) => void;
}) {
  const activeKey = L1_TABS.find(t => t.subtab === subtab)?.key;
  return (
    <div className="bg-white rounded-xl border border-[#e3e5e8] overflow-hidden">
      <div className="flex items-center gap-6 px-5 pt-3.5 flex-wrap">
        <span className="text-[19px] font-bold text-[#1a1a1a] whitespace-nowrap">Daily Operations</span>
        <div className="flex items-center gap-6">
          {L1_TABS.map(t => {
            const active = t.key === activeKey;
            return (
              <button
                key={t.key}
                onClick={() => onSelect(t.subtab)}
                className={`pb-3.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-[#888] hover:text-[#555]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {subtab === "demand" && (
        <div className="flex items-center gap-6 px-5 pt-2.5 border-t border-[#e3e5e8]">
          {([["planning", "Order Planning"], ["aq", "AQ Sales Reference"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => onOrderTab(k)}
              className={`pb-2.5 text-[14px] font-medium border-b-2 transition-colors ${
                orderTab === k
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-[#888] hover:text-[#555]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {/* Same row as Orders' Order Planning/AQ Sales Reference above — moved
          here from ProductionArea's own (previously purple/bold) tab bar so
          both L1 tabs' sub-tabs look and sit the same way. */}
      {subtab === "bom" && (
        <div className="flex items-center gap-6 px-5 pt-2.5 border-t border-[#e3e5e8]">
          {PRODUCTION_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => onProdTab(t.key)}
              className={`pb-2.5 text-[14px] font-medium border-b-2 transition-colors ${
                prodTab === t.key
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-[#888] hover:text-[#555]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DailyPlan() {
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  // Production has its own sidebar entry (/orders/daily-plan/production)
  // rather than being one of the tabs above — landing on that path opens
  // straight to Production (subtab "bom"); the plain /orders/daily-plan path
  // still opens to Overview, matching before.
  const [location] = useLocation();
  const [date, setDate] = useState(today);
  const [activeRound, setActiveRound] = useState<Round | "ALL">(1 as Round);
  const [orderTab, setOrderTab] = useState<"planning" | "aq">("planning");
  const [prodTab, setProdTab] = useState<ProductionSubTab>("grading");
  const [subtab, setSubtab] = useState<SubTab>(location.endsWith("/production") ? "bom" : "overview");
  useEffect(() => {
    setSubtab(location.endsWith("/production") ? "bom" : "overview");
  }, [location]);
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [numRounds, setNumRounds] = useState(3);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : [])
      .then((rows: { key: string; value: string | null }[]) => {
        const nr = rows.find(r => r.key === "num_rounds");
        if (nr?.value) setNumRounds(Number(nr.value));
      });
  }, []);

  const rounds = useMemo<Round[]>(
    () => Array.from({ length: numRounds }, (_, i) => i + 1),
    [numRounds],
  );

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
    const m: Record<number, number> = Object.fromEntries(rounds.map(r => [r, 0]));
    for (const o of allConfirmedOrders) {
      if (o.productionRound != null) m[o.productionRound] = (m[o.productionRound] ?? 0) + 1;
    }
    return m;
  }, [allConfirmedOrders, rounds]);

  const roundEggTotals: Record<number, number> = useMemo(() => {
    const m: Record<number, number> = Object.fromEntries(rounds.map(r => [r, 0]));
    for (const o of allConfirmedOrders) {
      if (o.productionRound != null) {
        const eggs = o.lines.reduce((s, l) => s + (l.planningQty ?? l.orderQty) * l.eggsPerPack, 0);
        m[o.productionRound] = (m[o.productionRound] ?? 0) + eggs;
      }
    }
    return m;
  }, [allConfirmedOrders, rounds]);

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

  const dateLabel = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const label = d.toLocaleDateString("th-TH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    if (date === today) return label + " — วันนี้";
    if (date === tomorrow) return label + " — พรุ่งนี้";
    return label;
  }, [date, today, tomorrow]);

  const activeRoundNum: Round = (typeof activeRound === "number" ? activeRound : 1) as Round;
  const activeRoundClosed = data?.roundStates?.[activeRoundNum]?.closed ?? false;

  const [roundToggling, setRoundToggling] = useState(false);
  const toggleActiveRoundClosed = async () => {
    setRoundToggling(true);
    try {
      await fetch("/api/orders/round-states", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, round: activeRoundNum, closed: !activeRoundClosed }),
      });
      await fetchData();
    } finally {
      setRoundToggling(false);
    }
  };

  // "Closed for the day" = every round has its own closed state — not a
  // separate flag, so it can't drift from the per-round truth. "Close
  // today"/"Reopen today" closes or reopens all of them in one action
  // (round_states has no bulk endpoint, so this is just one PATCH per round).
  const dayClosed = rounds.length > 0 && rounds.every(r => data?.roundStates?.[r]?.closed ?? false);
  // "At least one round sent" — the Order command bar's "ปิดวันนี้ได้เมื่อส่ง
  // PQ แล้วอย่างน้อย 1 ฉบับ" gate is this (looser than dayClosed, which needs
  // every round). Deliberately checked against ALL rounds, not just the one
  // selected in the dropdown — closing today shouldn't depend on which round
  // happens to be showing.
  const anyRoundClosed = rounds.some(r => data?.roundStates?.[r]?.closed ?? false);

  // Preliminary shipment plans, bubbled up from PlanningGrid's section 1 (see
  // onRoundPlansChange) — real, persisted data (GET/PATCH
  // /api/orders/preliminary-plans). Used to gate "ส่ง O-R{n}": every
  // confirmed order in the round should be covered by a plan, and no plan
  // should mix delivery zones, before the round can close.
  const [roundPreliminaryPlans, setRoundPreliminaryPlans] = useState<PrelimPlanRow[]>([]);
  const [closeReadiness, setCloseReadiness] = useState<{ round: Round } | null>(null);
  const blockingOrdersForRound = (round: Round) =>
    allConfirmedOrders.filter(
      o => o.productionRound === round && !roundPreliminaryPlans.some(p => p.orderIds.includes(o.id)),
    );
  // A plan whose orders span more than one delivery region/zone — real
  // signal (deliveryRegion is already on every order), not blocking on its
  // own (a plan CAN legitimately cover multiple zones), just needs a
  // reviewer to look and record why before the round closes.
  const reviewPlansForRound = (round: Round): { plan: PrelimPlanRow; zones: string[] }[] =>
    roundPreliminaryPlans
      .map(p => {
        const planOrders = allConfirmedOrders.filter(o => p.orderIds.includes(o.id) && o.productionRound === round);
        if (planOrders.length === 0) return null;
        const zones = Array.from(new Set(planOrders.map(o => o.deliveryRegion || NO_AREA)));
        return zones.length > 1 ? { plan: p, zones } : null;
      })
      .filter((x): x is { plan: PrelimPlanRow; zones: string[] } => x !== null);
  // "Send O-R{n}" = publish the round's PQ snapshot, then close it — one
  // combined action, matching the Close Readiness confirm step's own
  // "Close round / Publish PQ version" framing. Only fires on the
  // open→closed direction; reopening (toggleActiveRoundClosed from the
  // closed state) never re-publishes on its own.
  const publishPqAndCloseRound = async (round: Round) => {
    await fetch("/api/orders/pq-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, round }),
    });
    await fetchPqSnapshots();
    await toggleActiveRoundClosed();
  };
  const requestSendRound = () => {
    const blocking = blockingOrdersForRound(activeRoundNum);
    const review = reviewPlansForRound(activeRoundNum);
    if (blocking.length > 0 || review.length > 0) {
      setCloseReadiness({ round: activeRoundNum });
    } else {
      publishPqAndCloseRound(activeRoundNum);
    }
  };

  const [dayToggling, setDayToggling] = useState(false);
  const toggleDayClosed = async () => {
    setDayToggling(true);
    try {
      await Promise.all(
        rounds.map(r =>
          fetch("/api/orders/round-states", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, round: r, closed: !dayClosed }),
          }),
        ),
      );
      await fetchData();
    } finally {
      setDayToggling(false);
    }
  };

  // Real G-P (grading plan) status for the day — same planned/sent split
  // ProductionArea computes, fetched again here so the Orders command bar's
  // "สถานะวางแผน" card can show it too, without lifting all of
  // ProductionArea's grading state up just for this one summary.
  const [gradingJobsToday, setGradingJobsToday] = useState<GradingJob[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/grading/jobs")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: GradingJob[]) => { if (!cancelled) setGradingJobsToday(rows.filter(j => j.productionDate === date)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date]);
  const gPlanned = gradingJobsToday.filter(j => j.status === "planned").length;
  const gSent = gradingJobsToday.filter(j => j.status === "sent_to_floor").length;

  // Real PQ snapshots (see migrations/0036_pq_snapshots.sql) — "Send O-R{n}"
  // publishes one of these; Accum PQ / PQ รวม / a closed round's own "PQ
  // รอบนี้" all read the frozen snapshot total, not the live order total, so
  // a number that's already been "published" doesn't silently drift if the
  // round is reopened and orders change. An open (never-sent, or reopened)
  // round still shows its live total, labeled "ร่าง · ยังไม่เผยแพร่".
  const [pqSnapshots, setPqSnapshots] = useState<{ round: number; version: number; totalEggs: number; state: string }[]>([]);
  const fetchPqSnapshots = useCallback(async () => {
    const r = await fetch(`/api/orders/pq-snapshots?date=${date}`);
    if (r.ok) setPqSnapshots(await r.json());
  }, [date]);
  useEffect(() => { fetchPqSnapshots(); }, [fetchPqSnapshots]);
  const activePqByRound = useMemo(() => {
    const m: Record<number, { version: number; totalEggs: number }> = {};
    for (const s of pqSnapshots) if (s.state === "active") m[s.round] = { version: s.version, totalEggs: s.totalEggs };
    return m;
  }, [pqSnapshots]);
  // A round's published PQ total once closed (frozen); its live order total
  // otherwise — these can legitimately differ after a reopen + edit.
  const pqValueForRound = (round: number) =>
    (data?.roundStates?.[round]?.closed ?? false) && activePqByRound[round]
      ? activePqByRound[round].totalEggs
      : roundEggTotals[round] ?? 0;

  const oqWholeDay = allConfirmedOrders.reduce((s, o) => s + orderEggs(o), 0);
  // Only OTHER rounds that are actually closed+published count toward Accum
  // — an open round (even with live orders in it) hasn't published anything
  // yet, so it contributes 0 here, not its live total.
  const accumPQ = rounds
    .filter(r => r !== activeRoundNum && (data?.roundStates?.[r]?.closed ?? false))
    .reduce((s, r) => s + pqValueForRound(r), 0);
  const pqTotal = accumPQ + (activeRoundClosed ? pqValueForRound(activeRoundNum) : 0);
  const roundOrdersEggs = roundEggTotals[activeRoundNum] ?? 0; // always live — "ออเดอร์รอบนี้"
  const roundPqValue = pqValueForRound(activeRoundNum); // frozen once published — "PQ รอบนี้"
  const deferredOutEggs = allConfirmedOrders
    .filter(o => o.deferredFromRound === activeRoundNum)
    .reduce((s, o) => s + orderEggs(o), 0);

  // Top customers (by egg qty) for the active round only — real, live data,
  // not gated on PQ being published (there's nothing dishonest about showing
  // what's actually in the round right now).
  const customerBarData = useMemo(() => {
    const byPartner = new Map<string, number>();
    for (const o of allConfirmedOrders) {
      if (o.productionRound !== activeRoundNum) continue;
      byPartner.set(o.partnerName, (byPartner.get(o.partnerName) ?? 0) + orderEggs(o));
    }
    const sorted = Array.from(byPartner.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const restTotal = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    const restCount = sorted.length - top.length;
    const colors = ["#185FA5", "#993556", "#3B6D11", "#A32D2D"];
    const parts = top.map(([name, v], i) => ({ name, v, color: colors[i] }));
    if (restCount > 0) parts.push({ name: `อื่นๆ (${restCount} ลูกค้า)`, v: restTotal, color: "#c9ccd1" });
    const total = parts.reduce((s, p) => s + p.v, 0);
    return { parts, total, customerCount: sorted.length };
  }, [allConfirmedOrders, activeRoundNum]);

  // One KPI cell (label · big number + ฟอง · optional note) — reused across
  // all three KPI cards in the Order Planning command bar below.
  const kpiCell = (lbl: string, val: number, color: string, sub?: string) => (
    <div key={lbl} className="min-w-0">
      <div className="text-[10.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color }}>{lbl}</div>
      <div className="text-[19px] font-bold whitespace-nowrap" style={{ color: val > 0 ? color : "#888" }}>
        {val > 0 ? fmtNum(val) : "—"}
        {val > 0 && <span className="ml-1 text-[11px] font-medium text-[#888]">ฟอง</span>}
      </div>
      {sub && <div className="text-[11px] text-[#6b7280] truncate">{sub}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F7F8] -mx-6 -mb-6">
      <div className="bg-white">
        <div className="max-w-[1400px] mx-auto px-6 pt-5 pb-4 space-y-4">
          <DailyOperationsNav
            subtab={subtab}
            onSelect={setSubtab}
            orderTab={orderTab}
            onOrderTab={setOrderTab}
            prodTab={prodTab}
            onProdTab={setProdTab}
          />

          {/* Date / round header bar — Order Planning gets its own richer
              command bar (below); this simpler one now only covers Prep &
              Delivery (subtab "trip"), the one other place it's still used. */}
          {subtab === "trip" && (
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
              Delivery date
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

            <div className="w-px h-6 bg-[#e3e5e8] mx-1" />

            <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">
              Order planning round (O-R)
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                activeRoundClosed
                  ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC]"
                  : "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]"
              }`}
            >
              ● O-R{activeRoundNum} · {activeRoundClosed ? "Closed" : "Working"}
            </span>
            <span className="text-[11px] text-[#888] tabular-nums">{roundCounts[activeRoundNum] ?? 0} orders</span>
            <select
              value={activeRoundNum}
              onChange={e => setActiveRound(Number(e.target.value) as Round)}
              className="h-7 px-2 text-[12px] border border-[#d6d8dc] rounded-lg bg-white"
            >
              {rounds.map(r => (
                <option key={r} value={r}>O-R{r}</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggleActiveRoundClosed}
                disabled={roundToggling}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${
                  activeRoundClosed
                    ? "border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                    : "bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
                }`}
              >
                {roundToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                {activeRoundClosed ? `Reopen O-R${activeRoundNum}` : `Close O-R${activeRoundNum}`}
              </button>
              <button
                onClick={toggleDayClosed}
                disabled={dayToggling}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${
                  dayClosed
                    ? "border border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"
                    : "bg-[#1a1a1a] text-white hover:bg-[#333]"
                }`}
                title={dayClosed ? "ทุกรอบของวันนี้ปิดแล้ว — เปิดใหม่ได้ที่นี่" : "ปิดทุกรอบของวันนี้ในครั้งเดียว"}
              >
                {dayToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                {dayClosed ? "Reopen today" : "Close today"}
              </button>
              <button onClick={fetchData} disabled={loading} className="p-1.5 rounded hover:bg-[#ebebeb]">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#888]" /> : <RefreshCw className="w-3.5 h-3.5 text-[#888]" />}
              </button>
            </div>
          </div>
          <div className="mt-1.5 text-[11px] text-[#aaa]">
            {dateLabel} · {allConfirmedOrders.length} ออเดอร์ · {fmtNum(allConfirmedOrders.reduce((s, o) => s + orderEggs(o), 0))} ฟอง
          </div>
          </div>
          )}

          {/* Order Planning's own command bar — date + plan status + KPI band +
              status-across-the-day card + PQ-by-customer bar, matching
              handover/261002/Header Stages.dc.html's "O" (order) page.
              Honesty note: that spec's numbers assume a real "PQ publish"
              concept — a round's quantities only count once a distinct
              publish action freezes them, separate from closing the round.
              This app has no such versioning, so here "published" ==
              "round closed": Accum PQ/PQ รวม only include CLOSED rounds,
              and "Send O-R{n}" below is the same real action as the old
              "Close O-R{n}" toggle, just relabeled to match. The PQ-by-
              customer bar isn't gated on that at all — it's just the active
              round's real, live order totals by customer. */}
          {subtab === "demand" && orderTab === "planning" && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-3.5 shadow-sm">
                <div className="flex items-end gap-6 flex-wrap">
                  <div className="flex-none">
                    <div className="flex items-center gap-2 h-[15px] mb-1.5">
                      <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">Date</span>
                      <div className="inline-flex h-[17px] -my-px" title="มุมมอง Load-in ยังไม่รองรับ — หน้านี้แสดงตามวันส่งเสมอ">
                        <span className="inline-flex items-center justify-center w-[58px] border border-[#cbd5e1] text-[#555] bg-white rounded-l-full text-[10.5px] cursor-not-allowed select-none">
                          Load-in
                        </span>
                        <span className="inline-flex items-center justify-center w-[58px] border border-[#1F2937] bg-[#1F2937] text-white rounded-r-full text-[10.5px] -ml-px select-none">
                          Delivery
                        </span>
                      </div>
                    </div>
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
                      <button onClick={() => setDate(today)}
                        className={`h-8 px-2.5 text-[11.5px] rounded-lg border transition-colors ${date === today ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#d6d8dc] text-[#555] hover:bg-[#f5f5f5]"}`}>
                        Today
                      </button>
                    </div>
                  </div>

                  <div className="w-px self-stretch bg-[#eef0f3]" />

                  <div className="flex-none">
                    <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1.5 h-[15px]">Plan status</div>
                    <div className="flex items-center gap-2 min-h-7">
                      <span className="inline-flex items-center justify-center min-w-[60px] h-[22px] px-2.5 rounded-full text-[12px] font-bold text-[#2563EB] border border-[#2563EB]/30 bg-[#2563EB0d]">
                        O-R{activeRoundNum}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold whitespace-nowrap" style={{ color: activeRoundClosed ? "#166534" : "#854F0B" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeRoundClosed ? "#166534" : "#854F0B" }} />
                        {activeRoundClosed ? "ส่งแล้ว" : "ร่าง"}
                      </span>
                      <span className="text-[11px] text-[#6b7280] whitespace-nowrap">{roundCounts[activeRoundNum] ?? 0} ออเดอร์</span>
                      <select
                        value={activeRoundNum}
                        onChange={e => setActiveRound(Number(e.target.value) as Round)}
                        className="h-7 px-2 text-[11.5px] border border-[#d6d8dc] rounded-lg bg-white"
                      >
                        {rounds.map(r => (
                          <option key={r} value={r}>O-R{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="ml-auto flex flex-col items-end gap-1">
                    <div className="text-[11.5px] font-semibold whitespace-nowrap text-right" style={{ color: "#854F0B" }}>
                      {!activeRoundClosed && (roundCounts[activeRoundNum] ?? 0) === 0 && `ส่ง O-R${activeRoundNum} ได้เมื่อมีออเดอร์ในรอบ`}
                      {!anyRoundClosed && !(!activeRoundClosed && (roundCounts[activeRoundNum] ?? 0) === 0) && "ปิดวันนี้ได้เมื่อส่ง PQ แล้วอย่างน้อย 1 ฉบับ"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={activeRoundClosed ? toggleActiveRoundClosed : requestSendRound}
                        disabled={roundToggling || (!activeRoundClosed && (roundCounts[activeRoundNum] ?? 0) === 0)}
                        className={`px-3.5 h-[30px] text-[12.5px] font-semibold rounded-md flex items-center gap-1.5 ${
                          activeRoundClosed
                            ? "bg-[#2563EB1a] border border-[#2563EB] text-[#2563EB]"
                            : "bg-[#2563EB] border border-[#2563EB] text-white hover:bg-[#1d4fd1]"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {roundToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                        {activeRoundClosed ? `ทบทวน O-R${activeRoundNum} ›` : `ส่ง O-R${activeRoundNum} ›`}
                      </button>
                      <button
                        onClick={toggleDayClosed}
                        disabled={dayToggling || (!anyRoundClosed && !dayClosed)}
                        className={`px-3.5 h-[30px] text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5 ${
                          dayClosed ? "border-[#c9ccd1] text-[#1a1a1a] bg-white hover:bg-[#f5f5f5]" : "border-[#e3e5e9] text-[#a3a3a3] bg-[#fafbfc]"
                        } disabled:cursor-not-allowed`}
                      >
                        {dayToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                        {dayClosed ? "Reopen today" : "Close today"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI band — ทั้งวัน · รอบนี้ · สถานะวางแผน (3 blocks, matching the spec's "16-part grid" proportions loosely) */}
              <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_3fr] gap-3 items-stretch">
                <div className="bg-white border border-[#e3e5e9] rounded-lg p-3">
                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-wide mb-2">ทั้งวัน</div>
                  <div className="grid grid-cols-3 gap-3">
                    {kpiCell("OQ", oqWholeDay, "#5B4B8A")}
                    {kpiCell("Accum PQ", accumPQ, "#0C447C")}
                    {kpiCell("PQ รวม", pqTotal, "#0C447C", pqTotal === 0 ? "ยังไม่มี PQ" : undefined)}
                  </div>
                </div>
                <div className="bg-white border border-[#e3e5e9] rounded-lg p-3">
                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-wide mb-2">รอบนี้ · O-R{activeRoundNum}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {kpiCell("ออเดอร์รอบนี้", roundOrdersEggs, "#5B4B8A")}
                    {kpiCell("เลื่อนรอบถัดไป", deferredOutEggs, "#854F0B")}
                    {kpiCell(
                      "PQ รอบนี้",
                      roundPqValue,
                      "#0C447C",
                      !activeRoundClosed && roundPqValue > 0
                        ? "ร่าง · ยังไม่เผยแพร่"
                        : activeRoundClosed && activePqByRound[activeRoundNum]
                          ? `PQ v${activePqByRound[activeRoundNum].version}`
                          : undefined,
                    )}
                  </div>
                </div>
                <div className="bg-white border border-[#e3e5e9] rounded-lg p-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#888] uppercase tracking-wide mb-2">
                    <span>สถานะวางแผน</span>
                    <span>สถานะงาน</span>
                  </div>
                  <div className="space-y-1.5">
                    {([
                      ["O-R" + activeRoundNum, "#2563EB", activeRoundClosed, "ส่งแล้ว", "ร่าง", `${roundCounts[activeRoundNum] ?? 0} ออเดอร์`, null] as const,
                      ["G-P", "#7C3AED", gPlanned === 0 && gSent === 0 ? null : gSent > 0 && gPlanned === 0, "ส่งแล้ว", "ร่าง", gPlanned + gSent === 0 ? "ยังไม่เริ่ม" : `${gPlanned + gSent} งาน`, null] as const,
                      ["P-R" + activeRoundNum, "#BE185D", null, "", "", "ยังไม่มีข้อมูล", "ยังไม่มีข้อมูล"] as const,
                    ]).map(([pill, color, done, doneWord, draftWord, detail, workOverride], i) => (
                      <div key={i} className="flex items-center gap-2 text-[11.5px]">
                        <span
                          className="inline-flex items-center justify-center w-[52px] h-[20px] rounded-full text-[10.5px] font-bold shrink-0"
                          style={{ color, border: `1.5px solid ${color}4d`, background: `${color}0d` }}
                        >
                          {pill}
                        </span>
                        {done === null ? (
                          <span className="text-[#6b7280]">{detail}</span>
                        ) : (
                          <span className="flex items-center gap-1.5 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                            <span className="inline-flex items-center gap-1 font-bold" style={{ color: done ? "#166534" : "#854F0B" }}>
                              {!done && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#854F0B" }} />}
                              {done ? `✓ ${doneWord}` : draftWord}
                            </span>
                            <span className="text-[#6b7280] truncate">{detail}</span>
                          </span>
                        )}
                        <span className="ml-auto text-[11px] font-semibold text-[#6b7280] whitespace-nowrap">{workOverride ?? "ยังไม่มีข้อมูล"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PQ by customer — real, live totals for the active round only */}
              <div className="bg-white border border-[#e3e5e9] rounded-lg px-4 py-3">
                {customerBarData.total === 0 ? (
                  <div className="text-[11.5px] text-[#6b7280]">
                    PQ ตามลูกค้า — {(roundCounts[activeRoundNum] ?? 0) === 0 ? "ยังไม่มีออเดอร์ในรอบนี้" : `ยังไม่มี PQ · O-R${activeRoundNum} ร่าง`}
                  </div>
                ) : (
                  <div className="grid gap-2" style={{ gridTemplateColumns: "max-content minmax(0,1fr) max-content" }}>
                    <span className="text-[11.5px] font-semibold text-[#444441] whitespace-nowrap self-center">
                      PQ ตามลูกค้า <span className="font-medium text-[#6b7280]">· {customerBarData.customerCount} ลูกค้า</span>
                    </span>
                    <span className="relative flex h-1.5 rounded-full bg-[#eef0f3] self-center overflow-hidden">
                      {customerBarData.parts.map((p, i) => (
                        <span key={p.name} style={{ width: `${(p.v / customerBarData.total) * 100}%`, background: p.color }} />
                      ))}
                    </span>
                    <span className="text-[11.5px] text-[#555] whitespace-nowrap self-center">
                      <b className="text-[#1a1a1a]">{fmtNum(customerBarData.total)}</b> ฟอง
                    </span>
                    <span />
                    <span className="flex items-center gap-3.5 flex-wrap text-[11px] text-[#555] py-1">
                      {customerBarData.parts.map(p => (
                        <span key={p.name} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                          {p.name} <b className="text-[#1a1a1a]">{fmtNum(p.v)}</b>
                          <span className="text-[#6b7280]">· {Math.round((p.v / customerBarData.total) * 100)}%</span>
                        </span>
                      ))}
                    </span>
                    <span />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 pb-5 space-y-4">

        {loading ? (
          <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-[#e3e5e8]">
            <Loader2 className="w-5 h-5 animate-spin text-[#aaa]" />
          </div>
        ) : (
          <>
            {/* Round content */}
            {subtab === "overview" ? (
              <OverviewTab
                data={data}
                rounds={rounds}
                roundCounts={roundCounts}
                allConfirmedOrders={allConfirmedOrders}
                unassignedCount={unassignedOrders.length}
                onGoToRound={(r, st) => { if (r != null) setActiveRound(r); setSubtab(st); }}
              />
            ) : subtab === "demand" && orderTab === "aq" ? (
              <AqSalesReferenceTab date={date} />
            ) : subtab === "demand" ? (
              <>
              {unassignedOrders.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl flex-wrap">
                  <span className="text-[12.5px] text-[#92400E]">
                    🔔 <b>{unassignedOrders.length}</b> confirmed orders ({fmtNum(unassignedOrders.reduce((s, o) => s + orderEggs(o), 0))} eggs) aren't in a round yet
                  </span>
                  <button
                    onClick={async () => {
                      await fetch("/api/orders/assign-round", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderIds: unassignedOrders.map(o => o.id), round: activeRoundNum }),
                      });
                      fetchData();
                    }}
                    disabled={activeRoundClosed}
                    title={activeRoundClosed ? `O-R${activeRoundNum} is closed` : undefined}
                    className="ml-auto px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add all to O-R{activeRoundNum}
                  </button>
                </div>
              )}
              <PlanningGrid
                date={date}
                partners={filteredPartners}
                activeRound={activeRound}
                roundClosed={typeof activeRound === "number" ? (data?.roundStates?.[activeRound]?.closed ?? false) : false}
                roundStates={data?.roundStates ?? {}}
                trips={data?.trips ?? []}
                rounds={rounds}
                roundEggTotals={roundEggTotals}
                onRefresh={fetchData}
                onRoundPlansChange={setRoundPreliminaryPlans}
              />
              </>
            ) : subtab === "trip" ? (
              <TripManager
                date={date}
                trips={data?.trips ?? []}
                // Always the full, unfiltered partner list — `filteredPartners`
                // is scoped to `activeRound` (requires productionRound to
                // match), which is a production-planning concept. Delivery/
                // trip assignment is orthogonal to that: an order with no
                // round yet (e.g. an off-plan sale, or simply not yet
                // assigned to a round) still needs to be deliverable. Using
                // filteredPartners here silently dropped every such order's
                // lines from Trip Manager — trips/cards still rendered
                // (from data.trips directly) but showed 0 SKU/PO/eggs.
                partners={data?.partners ?? []}
                onRefresh={fetchData}
              />
            ) : subtab === "checkout" ? (
              <CheckoutTab date={date} trips={data?.trips ?? []} partners={data?.partners ?? []} />
            ) : subtab === "fgstock" ? (
              <FgStockTab date={date} />
            ) : (
              <ProductionArea
                date={date}
                partners={filteredPartners}
                onDateChange={setDate}
                activeRoundNum={activeRoundNum}
                activeRoundClosed={activeRoundClosed}
                dayClosed={dayClosed}
                roundEggTotals={roundEggTotals}
                rounds={rounds}
                onGoOverview={() => setSubtab("overview")}
                sub={prodTab}
              />
            )}
          </>
        )}
      </div>

      {closeReadiness && (
        <CloseReadinessModal
          round={closeReadiness.round}
          date={date}
          nextVersion={(activePqByRound[closeReadiness.round]?.version ?? 0) + 1}
          blocking={blockingOrdersForRound(closeReadiness.round)}
          review={reviewPlansForRound(closeReadiness.round)}
          cumulativeTotal={
            rounds
              .filter(r => r !== closeReadiness.round && (data?.roundStates?.[r]?.closed ?? false))
              .reduce((s, r) => s + pqValueForRound(r), 0) + (roundEggTotals[closeReadiness.round] ?? 0)
          }
          onClose={() => setCloseReadiness(null)}
          onContinue={() => {
            setCloseReadiness(null);
            publishPqAndCloseRound(closeReadiness.round);
          }}
        />
      )}
    </div>
  );
}
