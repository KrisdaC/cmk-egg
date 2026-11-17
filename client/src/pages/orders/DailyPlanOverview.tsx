import { useMemo, type ReactNode } from "react";
import {
  fmtNum,
  orderEggs,
  type DailyData,
  type PlanOrder,
  type PlanTrip,
  type Round,
  type RoundState,
  type SubTab,
} from "./DailyPlan";

// ── Day convergence summary ───────────────────────────────────────────────────────
// Note: the design reference (prototype) also shows PQ version/timestamp, a
// "Grading" status, and an "Exceptions" count — none of that data exists in the
// real backend yet (no grading↔order linkage, no PQ versioning, no exception
// tracking), so those are intentionally omitted rather than faked. Everything
// below is derived from data the app already has.

function Pill({
  tone,
  children,
}: {
  tone: "amber" | "blue" | "green" | "neutral";
  children: ReactNode;
}) {
  const cls = {
    amber: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
    blue: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
    green: "bg-[#F0FDF4] text-green-700 border-[#86EFAC]",
    neutral: "bg-[#F1F2F4] text-[#5F5E5A] border-[#e3e5e8]",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

function DayConvergenceSummary({
  date,
  rounds,
  roundStates,
  allConfirmedOrders,
  unassignedCount,
}: {
  date: string;
  rounds: Round[];
  roundStates: Record<number, RoundState>;
  allConfirmedOrders: (PlanOrder & { partnerName: string })[];
  unassignedCount: number;
}) {
  const closedCount = rounds.filter(r => roundStates?.[r]?.closed).length;
  const workingRound = rounds.find(r => !(roundStates?.[r]?.closed)) ?? null;
  const allClosed = rounds.length > 0 && workingRound == null;

  const pqEggs = useMemo(
    () =>
      allConfirmedOrders.reduce(
        (s, o) => s + o.lines.reduce((ls, l) => ls + (l.planningQty ?? l.orderQty) * l.eggsPerPack, 0),
        0,
      ),
    [allConfirmedOrders],
  );

  const unallocatedToTrip = useMemo(
    () => allConfirmedOrders.filter(o => o.tripId == null).length,
    [allConfirmedOrders],
  );

  const narrative = [
    allClosed ? "PQ ปิดครบทุกรอบแล้ว" : `PQ ยังไม่ปิด — กำลังทำงานรอบ R${workingRound}`,
    `${unassignedCount} ออเดอร์ยังไม่เข้ารอบวางแผน`,
    `Logistics มี ${unallocatedToTrip} ออเดอร์ยังไม่ถูกจัดเข้า Trip`,
  ].join(" · ");

  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-bold text-[#1a1a1a]">สรุปภาพรวมวันนี้</span>
          <span className="bg-[#F1F2F4] text-[#5F5E5A] text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {date}
          </span>
        </div>
        <div className="text-[11px] text-[#999]">
          อ่านอย่างเดียว — การตัดสินใจทำในหน้าทำงานแต่ละหน้า
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <Pill tone={allClosed ? "green" : "amber"}>
          {allClosed ? "PQ ปิดแล้ว" : "PQ ยังไม่ปิด · ปรับได้อยู่"}
        </Pill>
        <Pill tone="neutral">
          {closedCount}/{rounds.length} รอบปิดแล้ว
          {workingRound != null && ` · กำลังทำงาน R${workingRound}`}
        </Pill>
        <Pill tone="blue">PQ {fmtNum(pqEggs)} ฟอง</Pill>
        {unassignedCount > 0 && <Pill tone="amber">ยังไม่เข้ารอบ {unassignedCount}</Pill>}
        {unallocatedToTrip > 0 && <Pill tone="amber">ยังไม่มี Trip {unallocatedToTrip}</Pill>}
        {workingRound != null && <Pill tone="neutral">ถัดไป: ปิด R{workingRound}</Pill>}
      </div>
      <div className="px-4 py-2.5 bg-[#fafbfc] border-t border-[#f0f0f0] text-[12px] text-[#555]">
        {narrative}
      </div>
    </div>
  );
}

// ── Close the planning day (design preview — NOT a working gate system) ────────────
// None of these gates have real backend support yet (no PQ publish action, no
// grading/packing/picklist/driver release tracking, no exception or execution-actuals
// tracking). This renders the prototype's layout for design reference only — every
// row is uniformly marked "not wired up" and there are no Complete/Defer/Accept
// buttons, so it can't be mistaken for something that actually closes the day.

type GateRow = { gate: string; tone: "green" | "amber" | "neutral"; state: string; detail: string };

const NOT_APPLICABLE = { tone: "neutral" as const, state: "Not applicable today", detail: "ยังไม่รองรับข้อมูลจริง" };

const LAYER_2_GATES: GateRow[] = [
  { gate: "DQ confirmed for dispatched trips", ...NOT_APPLICABLE },
  { gate: "Grading executed", ...NOT_APPLICABLE },
  { gate: "Packing executed", ...NOT_APPLICABLE },
  { gate: "Picking executed", ...NOT_APPLICABLE },
];

function GateTable({ title, gates }: { title: string; gates: GateRow[] }) {
  return (
    <div>
      <div className="text-[12px] font-bold text-[#1a1a1a] mb-2">{title}</div>
      <div className="border border-[#E1E5EA] rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2 bg-[#fafbfc] border-b border-[#E1E5EA] text-[10px] font-bold uppercase tracking-wider text-[#888]">
          <span className="flex-1 min-w-[180px]">Gate</span>
          <span className="w-[170px] shrink-0">State</span>
          <span className="flex-1">Detail</span>
          <span className="w-[170px] shrink-0">Decision</span>
        </div>
        <div>
          {gates.map((g, i) => (
            <div
              key={g.gate}
              className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#f0f0f0] last:border-b-0 ${
                i % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"
              }`}
            >
              <span className="flex-1 min-w-[180px] text-[12px] font-medium text-[#1a1a1a]">
                {g.gate}
              </span>
              <span className="w-[170px] shrink-0">
                <Pill tone={g.tone}>{g.state}</Pill>
              </span>
              <span className="flex-1 text-[12px] text-[#888]">{g.detail}</span>
              <span className="w-[170px] shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClosePlanningDayPreview({
  rounds,
  roundStates,
}: {
  rounds: Round[];
  roundStates: Record<number, RoundState>;
}) {
  const closedCount = rounds.filter(r => roundStates?.[r]?.closed).length;
  const workingRound = rounds.find(r => !(roundStates?.[r]?.closed)) ?? null;
  const allClosed = rounds.length > 0 && workingRound == null;

  const layer1Gates: GateRow[] = [
    allClosed
      ? {
          gate: "Latest PQ published",
          tone: "green",
          state: "Complete",
          detail: `ปิดครบ ${closedCount}/${rounds.length} รอบ`,
        }
      : {
          gate: "Latest PQ published",
          tone: "amber",
          state: "Open",
          detail: workingRound != null ? `กำลังทำงานรอบ R${workingRound} — ยังไม่ปิด` : "ยังไม่มีรอบวางแผน",
        },
    { gate: "Grading work released", ...NOT_APPLICABLE },
    { gate: "Packing work released", ...NOT_APPLICABLE },
    { gate: "Picklists released", ...NOT_APPLICABLE },
    { gate: "Driver work released", ...NOT_APPLICABLE },
    { gate: "Exceptions resolved", ...NOT_APPLICABLE },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f0f0f0]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-bold text-[#1a1a1a]">ปิดวันวางแผน (Close the planning day)</span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#888]">
            <span className="w-2 h-2 rounded-full bg-[#bbb]" />
            พรีวิว
          </span>
        </div>
        <div className="text-[11px] text-[#999]">
          Layer 1: ความพร้อมของแผนและการปล่อยงาน · Layer 2: ผลการทำงานจริง — การพิมพ์/ปล่อยงานไม่ใช่หลักฐานว่าทำเสร็จแล้ว
        </div>
      </div>

      <div className="p-4 space-y-4">
        <GateTable title="Layer 1 — plan & work-release readiness" gates={layer1Gates} />
        <GateTable title="Layer 2 — execution completion" gates={LAYER_2_GATES} />
      </div>

      <div className="px-4 py-2.5 border-t border-[#f0f0f0] flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] font-semibold text-[#92400E]">
          พรีวิวการออกแบบ — ส่วนใหญ่ยังไม่เชื่อมต่อข้อมูลจริง ไม่สามารถใช้ปิดวันวางแผนจริงได้
        </span>
        <span className="text-[11px] text-[#aaa]">closing performs no hidden downstream actions</span>
      </div>
    </div>
  );
}

// ── Day KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({ kpi }: { kpi: DailyData["kpi"] }) {
  const tiles = [
    { label: "ออเดอร์", value: fmtNum(kpi.orders), sub: "รายการ" },
    { label: "ลูกค้า", value: fmtNum(kpi.partners), sub: "ราย" },
    { label: "จุดส่ง", value: fmtNum(kpi.sites), sub: "แห่ง" },
    { label: "ไข่รวม", value: fmtNum(kpi.eggs), sub: "ฟอง" },
  ];
  return (
    <div className="bg-white rounded-xl border border-[#e3e5e8] overflow-hidden">
      <div className="flex items-stretch">
        {tiles.map((t, i) => (
          <div key={t.label} className="flex items-stretch flex-1 min-w-0">
            <div className="flex-1 px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-[#888]">
                {t.label}
              </div>
              <div className="text-[22px] font-bold tabular-nums leading-tight text-[#1a1a1a]">
                {t.value}
              </div>
              <div className="text-[11px] mt-0.5 text-[#aaa]">{t.sub}</div>
            </div>
            {i < tiles.length - 1 && <div className="border-l border-[#f0f0f0]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Needs-attention banner ────────────────────────────────────────────────────────

function AttentionBanner({
  unassignedCount,
  onGoToDemand,
}: {
  unassignedCount: number;
  onGoToDemand: () => void;
}) {
  if (unassignedCount === 0) return null;
  return (
    <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#92400E]">🔔 ต้องดำเนินการ</span>
          <span className="bg-[#F59E0B] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            {unassignedCount} ออเดอร์
          </span>
        </div>
        <button
          onClick={onGoToDemand}
          className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0]"
        >
          ไปที่ Demand
        </button>
      </div>
      <div className="px-4 py-2 text-[11px] text-[#92400E] border-t border-[#FEF3C7]">
        ออเดอร์ที่ยืนยันแล้วแต่ยังไม่ถูกรับเข้ารอบวางแผน
      </div>
    </div>
  );
}

// ── Dispatch readiness gate ────────────────────────────────────────────────────────
// Steps 1 (PQ) and 2 (Trip) are real, derived the same way as the convergence
// summary. Steps 3-5 (DQ / Picklist / Dispatch) stay honest placeholders — there's
// no DQ, picklist-release, or dispatch-capture tracking in the backend today (the
// design reference itself already flags step 5 as "not implemented").

function DispatchReadinessGate({
  rounds,
  roundStates,
  allConfirmedOrders,
  onGoToRound,
}: {
  rounds: Round[];
  roundStates: Record<number, RoundState>;
  allConfirmedOrders: (PlanOrder & { partnerName: string })[];
  onGoToRound: (round: Round | null, subtab: SubTab) => void;
}) {
  const workingRound = rounds.find(r => !(roundStates?.[r]?.closed)) ?? null;
  const allClosed = rounds.length > 0 && workingRound == null;

  const pqEggs = useMemo(
    () =>
      allConfirmedOrders.reduce(
        (s, o) => s + o.lines.reduce((ls, l) => ls + (l.planningQty ?? l.orderQty) * l.eggsPerPack, 0),
        0,
      ),
    [allConfirmedOrders],
  );

  const allocatedEggs = useMemo(
    () => allConfirmedOrders.filter(o => o.tripId != null).reduce((s, o) => s + orderEggs(o), 0),
    [allConfirmedOrders],
  );
  const unallocatedEggs = Math.max(0, pqEggs - allocatedEggs);
  const allocationComplete = pqEggs > 0 && unallocatedEggs === 0;

  const steps: { n: number; label: string; value: string; sub: string; placeholder?: boolean }[] = [
    { n: 1, label: "PQ", value: `${fmtNum(pqEggs)} eggs`, sub: allClosed ? "ปิดแล้ว" : "provisional" },
    { n: 2, label: "TRIP", value: `${fmtNum(allocatedEggs)} eggs`, sub: `unallocated ${fmtNum(unallocatedEggs)}` },
    { n: 3, label: "DQ", value: "—", sub: "no confirmed DQ yet", placeholder: true },
    { n: 4, label: "PICKLIST", value: "—", sub: "ready after DQ confirmation", placeholder: true },
    { n: 5, label: "DISPATCH", value: "—", sub: "actual dispatch capture not implemented", placeholder: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e3e5e8] overflow-hidden">
      <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-bold text-[#1a1a1a]">Dispatch readiness gate</span>
        <Pill tone={allocationComplete ? "green" : "amber"}>
          {allocationComplete ? "Trip allocation complete" : "Trip allocation incomplete"}
        </Pill>
      </div>
      <div className="px-4 pt-0.5 pb-3 text-[11px] text-[#999]">
        PQ → Trip → DQ → Picklist → Dispatch · แยกจาก planning convergence — คลังสามารถเตรียมจัดส่งได้อย่างปลอดภัยหรือไม่?
      </div>

      <div className="flex items-stretch border-t border-[#f0f0f0]">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-stretch flex-1 min-w-0">
            <div className="flex-1 px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-[#888]">
                {s.n} · {s.label}
              </div>
              <div
                className={`text-[22px] font-bold tabular-nums leading-tight ${
                  s.placeholder ? "text-[#ccc]" : "text-[#1a1a1a]"
                }`}
              >
                {s.value}
              </div>
              <div className="text-[11px] mt-0.5 text-[#aaa]">{s.sub}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center px-1 text-[#ccc] text-[18px] shrink-0 border-l border-[#f0f0f0]">
                →
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t border-[#f0f0f0] flex items-center gap-2 flex-wrap">
        <Pill tone="neutral">DQ per Order×SKU×Trip: capture not implemented — Trip-level confirmation only</Pill>
        <Pill tone="neutral">Picklists come from confirmed DQ — never from preliminary Order-Planning trips</Pill>
        <button
          onClick={() => onGoToRound(null, "trip")}
          className="ml-auto text-[11px] font-semibold text-[#1E40AF] hover:underline whitespace-nowrap"
        >
          → ไปที่ แผน Trip
        </button>
      </div>
    </div>
  );
}

// ── Feedback to the next order round ───────────────────────────────────────────────
// The design reference also lists Grading-availability shortages/surpluses (per egg
// size) and Master-data unmapped-size rows here — both need data this backend
// doesn't track (no grading-availability snapshot, no size-mapping validation), so
// they're intentionally left out rather than shown with invented quantities. Only
// exception types this app can actually compute (unassigned orders, unallocated
// trips) are listed as rows.

function FeedbackToNextRound({
  allConfirmedOrders,
  unassignedCount,
  onGoToRound,
}: {
  allConfirmedOrders: (PlanOrder & { partnerName: string })[];
  unassignedCount: number;
  onGoToRound: (round: Round | null, subtab: SubTab) => void;
}) {
  const unassignedEggs = useMemo(
    () =>
      allConfirmedOrders
        .filter(o => o.productionRound == null)
        .reduce((s, o) => s + orderEggs(o), 0),
    [allConfirmedOrders],
  );

  const unallocatedToTrip = useMemo(
    () => allConfirmedOrders.filter(o => o.tripId == null),
    [allConfirmedOrders],
  );
  const unallocatedEggs = useMemo(
    () => unallocatedToTrip.reduce((s, o) => s + orderEggs(o), 0),
    [unallocatedToTrip],
  );

  const rows: {
    process: string;
    item: string;
    qty: string;
    status: string;
    tone: "amber" | "green" | "neutral";
    decision: string;
    goto: SubTab;
  }[] = [];

  if (unassignedCount > 0) {
    rows.push({
      process: "Orders",
      item: `${unassignedCount} orders`,
      qty: `${fmtNum(unassignedEggs)} eggs ยังไม่เข้ารอบ`,
      status: "Open",
      tone: "amber",
      decision: "รับเข้ารอบวางแผน หรือเลื่อนไปวันถัดไป",
      goto: "demand",
    });
  }
  if (unallocatedToTrip.length > 0) {
    rows.push({
      process: "Logistics",
      item: `${unallocatedToTrip.length} orders`,
      qty: `${fmtNum(unallocatedEggs)} eggs unallocated`,
      status: "Open",
      tone: "amber",
      decision: "จัดสรรเข้า Trip หรือเลื่อนไปรอบถัดไป",
      goto: "trip",
    });
  }

  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f0f0f0]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-bold text-[#1a1a1a]">ข้อมูลสำหรับรอบวางแผนถัดไป</span>
          <span className="bg-[#F1F2F4] text-[#5F5E5A] text-[11px] font-bold px-2 py-0.5 rounded-full">
            {rows.length}
          </span>
        </div>
        <div className="text-[11px] text-[#999]">
          อ่านอย่างเดียว — รวบรวมจากข้อมูลที่มีอยู่แล้ว ไม่มีระบบตรวจจับข้อยกเว้นใหม่
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-[#bbb] text-sm">ไม่มีรายการที่ต้องติดตามในขณะนี้</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#E1E5EA] text-[10px] font-bold uppercase tracking-wider text-[#888]">
                <th className="text-left px-3 py-2 whitespace-nowrap">Source process</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Affected item</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Quantity</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Recommended decision</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Destination</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-[#f0f0f0] last:border-b-0 ${
                    i % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-2.5 font-medium text-[#1a1a1a] whitespace-nowrap">{r.process}</td>
                  <td className="px-3 py-2.5 text-[#555] whitespace-nowrap">{r.item}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#555] whitespace-nowrap">{r.qty}</td>
                  <td className="px-3 py-2.5">
                    <Pill tone={r.tone}>{r.status}</Pill>
                  </td>
                  <td className="px-3 py-2.5 text-[#555]">{r.decision}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => onGoToRound(null, r.goto)}
                      className="text-[11px] font-semibold text-[#1E40AF] hover:underline whitespace-nowrap"
                    >
                      รอบถัดไป
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-[#f0f0f0] text-[11px] text-[#999]">
        ยังไม่รองรับการตรวจจับ Grading availability (ขาด/เกินตามเบอร์ไข่) และ Master data (เบอร์ไข่ที่ไม่ map) เนื่องจากไม่มีข้อมูลจริงเชื่อมโยงในระบบ
      </div>
    </div>
  );
}

// ── Round status board ─────────────────────────────────────────────────────────────

function RoundBoard({
  rounds,
  roundStates,
  roundCounts,
  allConfirmedOrders,
  onGoToRound,
}: {
  rounds: Round[];
  roundStates: Record<number, RoundState>;
  roundCounts: Record<number, number>;
  allConfirmedOrders: (PlanOrder & { partnerName: string })[];
  onGoToRound: (round: Round | null, subtab: SubTab) => void;
}) {
  const eggsByRound = useMemo(() => {
    const m: Record<number, number> = {};
    for (const o of allConfirmedOrders) {
      if (o.productionRound != null) {
        m[o.productionRound] = (m[o.productionRound] ?? 0) + orderEggs(o);
      }
    }
    return m;
  }, [allConfirmedOrders]);

  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E1E5EA] bg-[#fafbfc] text-[11px] font-bold uppercase tracking-wider text-[#444]">
        สถานะรอบวางแผน
      </div>
      {rounds.length === 0 ? (
        <div className="py-10 text-center text-[#bbb] text-sm">ไม่มีรอบวางแผน</div>
      ) : (
        <div className="divide-y divide-[#f0f0f0]">
          {rounds.map(r => {
            const closed = roundStates?.[r]?.closed ?? false;
            const count = roundCounts[r] ?? 0;
            const eggs = eggsByRound[r] ?? 0;
            return (
              <button
                key={r}
                onClick={() => onGoToRound(r, "demand")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5] transition-colors text-left"
              >
                <span
                  className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-lg border ${
                    closed
                      ? "bg-[#F0FDF4] text-green-700 border-[#86EFAC]"
                      : "bg-white text-[#555] border-[#d6d8dc]"
                  }`}
                >
                  {closed ? "🔒" : "▶"} R{r}
                </span>
                <span className="text-[12px] text-[#555]">
                  {closed ? "ปิดรอบแล้ว" : "เปิดรับออเดอร์"}
                </span>
                <span className="ml-auto text-[13px] font-bold tabular-nums text-[#1a1a1a]">
                  {count} ออเดอร์
                </span>
                <span className="text-[12px] tabular-nums text-[#888] w-28 text-right">
                  {fmtNum(eggs)} ฟอง
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Trips / logistics glance ───────────────────────────────────────────────────────

function TripsGlance({
  trips,
  allConfirmedOrders,
  rounds,
  onGoToRound,
}: {
  trips: PlanTrip[];
  allConfirmedOrders: (PlanOrder & { partnerName: string })[];
  rounds: Round[];
  onGoToRound: (round: Round | null, subtab: SubTab) => void;
}) {
  const eggsByTrip = useMemo(() => {
    const m: Record<number, number> = {};
    for (const o of allConfirmedOrders) {
      if (o.tripId != null) m[o.tripId] = (m[o.tripId] ?? 0) + orderEggs(o);
    }
    return m;
  }, [allConfirmedOrders]);

  const tripsByRound = useMemo(() => {
    const m: Record<number, PlanTrip[]> = {};
    for (const t of trips) {
      const r = t.productionRound ?? 0;
      if (!m[r]) m[r] = [];
      m[r].push(t);
    }
    return m;
  }, [trips]);

  const roundsWithOrdersButNoTrips = rounds.filter(
    r =>
      allConfirmedOrders.some(o => o.productionRound === r) &&
      !(tripsByRound[r]?.length),
  );

  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E1E5EA] bg-[#fafbfc] text-[11px] font-bold uppercase tracking-wider text-[#444]">
        ภาพรวมการจัดส่ง (Trip)
      </div>

      {roundsWithOrdersButNoTrips.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-[#92400E] bg-[#FFFBEB] border-b border-[#FCD34D]">
          ⚠️ รอบ {roundsWithOrdersButNoTrips.map(r => `R${r}`).join(", ")} มีออเดอร์แต่ยังไม่มี Trip
        </div>
      )}

      {trips.length === 0 ? (
        <div className="py-10 text-center text-[#bbb] text-sm">ยังไม่มี Trip สำหรับวันนี้</div>
      ) : (
        <div className="divide-y divide-[#f0f0f0]">
          {trips.map(t => {
            const eggs = eggsByTrip[t.id] ?? 0;
            const pct =
              t.vehicleCapacityEggs != null && t.vehicleCapacityEggs > 0
                ? Math.round((eggs / t.vehicleCapacityEggs) * 100)
                : null;
            const pctColor =
              pct == null
                ? "text-[#aaa]"
                : pct > 90
                  ? "text-red-500"
                  : pct > 75
                    ? "text-amber-500"
                    : "text-green-600";
            return (
              <button
                key={t.id}
                onClick={() => onGoToRound(t.productionRound, "trip")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5] transition-colors text-left"
              >
                <span className="text-[11px] font-semibold text-[#888] w-8 shrink-0">
                  {t.productionRound != null ? `R${t.productionRound}` : "—"}
                </span>
                <span className="text-[12px] text-[#1a1a1a] font-medium whitespace-nowrap">
                  {t.name || `Trip ${t.tripNumber}`}
                </span>
                <span className="text-[11px] text-[#888] whitespace-nowrap">
                  {t.vehiclePlate ?? "ไม่ระบุรถ"}
                </span>
                <span className="text-[11px] text-[#888] whitespace-nowrap">
                  {t.driverName ?? "ไม่ระบุคนขับ"}
                </span>
                <span className="ml-auto text-[12px] tabular-nums text-[#555] whitespace-nowrap">
                  {fmtNum(eggs)}
                  {t.vehicleCapacityEggs != null && <> / {fmtNum(t.vehicleCapacityEggs)}</>} ฟอง
                </span>
                {pct != null && (
                  <span className={`text-[12px] font-bold tabular-nums w-12 text-right ${pctColor}`}>
                    {pct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Overview tab ────────────────────────────────────────────────────────────────────

export function OverviewTab({
  data,
  rounds,
  roundCounts,
  allConfirmedOrders,
  unassignedCount,
  onGoToRound,
}: {
  data: DailyData | null;
  rounds: Round[];
  roundCounts: Record<number, number>;
  allConfirmedOrders: (PlanOrder & { partnerName: string })[];
  unassignedCount: number;
  onGoToRound: (round: Round | null, subtab: SubTab) => void;
}) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <DayConvergenceSummary
        date={data.date}
        rounds={rounds}
        roundStates={data.roundStates}
        allConfirmedOrders={allConfirmedOrders}
        unassignedCount={unassignedCount}
      />
      <ClosePlanningDayPreview rounds={rounds} roundStates={data.roundStates} />
      <DispatchReadinessGate
        rounds={rounds}
        roundStates={data.roundStates}
        allConfirmedOrders={allConfirmedOrders}
        onGoToRound={onGoToRound}
      />
      <FeedbackToNextRound
        allConfirmedOrders={allConfirmedOrders}
        unassignedCount={unassignedCount}
        onGoToRound={onGoToRound}
      />
      <AttentionBanner
        unassignedCount={unassignedCount}
        onGoToDemand={() => onGoToRound(null, "demand")}
      />
    </div>
  );
}
