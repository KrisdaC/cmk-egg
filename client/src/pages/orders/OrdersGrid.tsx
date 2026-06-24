import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ChevronDown, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { parseFile, detectSiteFromPO, FORMAT_ACCEPT, type POFormat, type DeliverySite } from "@/lib/po-parsers";
import type { UploadReviewData } from "./POUploadReview";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderLine {
  line_id: number;
  item_id: number;
  sku: string;
  name: string;
  selling_unit: string;
  po_qty: number;
  accepted_qty: number | null;   // null = not yet set by operator
  eggs_per_pack: number;
  primary_size: string | null;
  secondary_size: string | null;
}

interface OrderRow {
  id: number;
  order_number: string;
  po_number: string | null;
  order_date: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  created_at: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  adjustment_approved: boolean;
  partner_id: number;
  partner_name: string;
  partner_code: string;
  delivery_site_id: number;
  delivery_site_name: string;
  province: string | null;
  total_eggs: number;
  accepted_eggs: number;
  lines: OrderLine[] | null;
}

type DateMode = "all" | "single" | "range";
type StatusFilter = "all" | "drafting" | "open" | "confirmed";
type SpeedFilter = "all" | "fast" | "normal";
type GroupFilter = "all" | "g1" | "g2" | "none";
type TypeFilter = "all" | "direct" | "dc";

// ── Colour maps (exact from handover _custColor / _custBg) ────────────────────

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
const PACK_PILL: Record<string, string> = {
  tray:   "bg-[#EAF3DE] text-[#27500A]",
  mat:    "bg-[#E6F1FB] text-[#0C447C]",
  pack:   "bg-[#FAEEDA] text-[#854F0B]",
  basket: "bg-[#FBEAF0] text-[#993556]",
  egg:    "bg-[#F1EFE8] text-[#5F5E5A]",
  other:  "bg-[#EEEDFE] text-[#3C3489]",
};

function custColor(nick: string) { return CUST_COLOR[nick] ?? "#5F5E5A"; }
function custBg(nick: string) { return CUST_BG[nick] ?? "#f6f7f9"; }

// ── Pack mix helpers (mirrors handover _packKey / _packPillFamily) ─────────────

function packKey(su: string): string {
  const s = (su || "").trim();
  if (!s) return "?";
  if (/^ถาด/i.test(s)) return "ถาด";
  if (/^มัด/i.test(s)) return s.replace(/\s+/g, " ");
  if (/^แพ็?ค\s*\d+/i.test(s)) { const m = s.match(/(\d+)/); return m ? "แพ็ค " + m[1] : s; }
  if (/^ตะกร้า/i.test(s)) return "ตะกร้า";
  if (/^ฟอง$/i.test(s)) return "ฟอง";
  return s;
}

function packFamily(label: string): keyof typeof PACK_PILL {
  const s = (label || "").toLowerCase();
  if (s.includes("ถาด")) return "tray";
  if (s.includes("มัด")) return "mat";
  if (s.includes("แพ็ค") || s.includes("pack")) return "pack";
  if (s.includes("ตะกร้า")) return "basket";
  if (s.includes("ฟอง")) return "egg";
  return "other";
}

function getPackMix(lines: OrderLine[] | null) {
  if (!lines) return [];
  const g: Record<string, number> = {};
  for (const l of lines) {
    const k = packKey(l.selling_unit);
    g[k] = (g[k] ?? 0) + l.po_qty;
  }
  return Object.entries(g)
    .filter(([, q]) => q > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, qty]) => ({ key, qty, family: packFamily(key) }));
}

// ── Ticket status computation (mirrors handover Drafting / Open / Confirmed) ──

function ticketStatus(o: OrderRow): StatusFilter {
  if (o.status === "confirmed" || o.status === "in_production" || o.status === "delivered") return "confirmed";
  // pending with PO upload and no accepted qty set → drafting
  if (o.status === "pending" && o.source === "upload") {
    const lines = o.lines ?? [];
    const hasMissing = lines.length === 0 || lines.some(l => l.accepted_qty == null || l.accepted_qty === 0);
    if (hasMissing) return "drafting";
  }
  return "open";
}

function needsAttention(o: OrderRow): string | null {
  if (o.status === "confirmed" || o.status === "delivered") return null;
  const lines = o.lines ?? [];
  if (lines.length === 0) return "No items";
  // accepted_qty is null = Store Order not yet set by operator
  if (lines.some(l => l.accepted_qty === null)) return "Store Order not filled";
  return null;
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDateDow(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
  }).replace(/\//g, "-");
}
function fmtDateShort(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtNum(n: number) { return Math.round(n).toLocaleString("th-TH"); }

// ── Small reusable components ──────────────────────────────────────────────────

function CustPill({ name }: { name: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold tracking-wide whitespace-nowrap"
      style={{ background: custColor(name) }}
    >
      {name}
    </span>
  );
}

function PackMixCell({ lines }: { lines: OrderLine[] | null }) {
  const mix = getPackMix(lines);
  if (mix.length === 0) return <span className="text-[#bbb]">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {mix.map(({ key, qty, family }) => (
        <span key={key} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${PACK_PILL[family]}`}>
          <code className="font-bold">{fmtNum(qty)}</code> {key}
        </span>
      ))}
    </div>
  );
}

function StatusPill({ order }: { order: OrderRow }) {
  const st = ticketStatus(order);
  if (st === "confirmed") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-green-400 text-green-700 bg-green-50">
      Confirmed
    </span>
  );
  if (st === "drafting") return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-amber-400 text-amber-700 bg-amber-50">
      Drafting
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-blue-400 text-blue-700 bg-blue-50">
      Open
    </span>
  );
}

function AttentionChip({ order }: { order: OrderRow }) {
  const attn = needsAttention(order);
  if (!attn) return null;
  const lines = order.lines ?? [];
  const allNull = lines.length > 0 && lines.every(l => l.accepted_qty === null);
  const label = allNull ? "Store Order not filled" : attn;
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-orange-300 text-orange-700 bg-orange-50 whitespace-nowrap">
      ⚠ {label}
    </span>
  );
}

function QtyBadge({ basis }: { basis: "PO" | "ORD" }) {
  return basis === "PO"
    ? <span className="ml-1 inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-[#EEEDFE] text-[#3C3489]">PO</span>
    : <span className="ml-1 inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-[#E2F0D9] text-[#27500A]">ORD</span>;
}

// ── Chip button (filter pill) ──────────────────────────────────────────────────

function Chip({ active, onClick, children, color }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
  if (color && active) {
    return (
      <button
        onClick={onClick}
        className="px-3 py-1 rounded-full text-[11px] font-semibold border text-white cursor-pointer"
        style={{ background: color, borderColor: color }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-all ${
        active
          ? "bg-[#EFF6FF] text-[#1E40AF] border-[#1E40AF] font-semibold"
          : "bg-white text-[#555] border-[#d6d8dc] hover:border-[#999] hover:bg-[#f5f5f5]"
      }`}
    >
      {children}
    </button>
  );
}

// ── Size badge (mirrors handover _eggSizePillHtml) ────────────────────────────

const SIZE_PILL_CLS: Record<string, string> = {
  "0": "bg-[#FCEBEB] text-[#791F1F]",
  "1": "bg-[#FAEEDA] text-[#633806]",
  "2": "bg-[#EAF3DE] text-[#27500A]",
  "3": "bg-[#E1F5EE] text-[#085041]",
  "4": "bg-[#E6F1FB] text-[#0C447C]",
  "5": "bg-[#EEEDFE] text-[#3C3489]",
};

function SizePill({ primary, secondary }: { primary: string | null; secondary: string | null }) {
  if (!primary) return null;
  const cls = SIZE_PILL_CLS[primary] ?? "bg-[#F1EFE8] text-[#5F5E5A]";
  const label = secondary ? `เบอร์ ${primary}-${secondary}` : `เบอร์ ${primary}`;
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${cls}`}>{label}</span>;
}

function PackPill({ sellingUnit }: { sellingUnit: string }) {
  const key = packKey(sellingUnit);
  const fam = packFamily(key);
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${PACK_PILL[fam]}`}>{key}</span>;
}

// ── Section card wrapper ───────────────────────────────────────────────────────

function SectionCard({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E1E5EA] bg-[#fafbfc]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444]">{title}</span>
        {hint && <span className="text-[10px] text-[#888]">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Expanded inline card — exact match to handover screenshot ─────────────────

function ExpandedCard({ order, onCollapse, onDelete, onRefresh }: {
  order: OrderRow;
  onCollapse: () => void;
  onDelete: (id: number) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const st = ticketStatus(order);
  const attn = needsAttention(order);
  const isFromUpload = order.source === "upload" || order.source === "po_upload";

  // line_id → "string value being edited" (empty string = not set yet)
  const initEdits = () => {
    const m: Record<number, string> = {};
    (order.lines ?? []).forEach(l => {
      m[l.line_id] = l.accepted_qty != null ? String(l.accepted_qty) : "";
    });
    return m;
  };
  const [lineEdits, setLineEdits] = useState<Record<number, string>>(initEdits);
  const [savingLine, setSavingLine] = useState<Record<number, boolean>>({});
  const [delivDate, setDelivDate] = useState(order.delivery_date?.slice(0, 10) ?? "");
  const [delivTime, setDelivTime] = useState(order.delivery_time ?? "");
  const [pickupDate, setPickupDate] = useState(
    order.pickup_date?.slice(0, 10) ??
    (order.delivery_date ? addDays(order.delivery_date.slice(0, 10), -1) : "")
  );
  const [pickupTime, setPickupTime] = useState(order.pickup_time ?? "");

  // Sync state when order prop refreshes from server
  useEffect(() => {
    setDelivDate(order.delivery_date?.slice(0, 10) ?? "");
    setDelivTime(order.delivery_time ?? "");
    setPickupDate(
      order.pickup_date?.slice(0, 10) ??
      (order.delivery_date ? addDays(order.delivery_date.slice(0, 10), -1) : "")
    );
    setPickupTime(order.pickup_time ?? "");
  }, [order.id, order.delivery_date, order.delivery_time, order.pickup_date, order.pickup_time]);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const lines = order.lines ?? [];
  const hasPoQty = lines.some(l => l.po_qty > 0);
  // True when all accepted_qty are null but PO qty exists — auto-fill on confirm
  const allNullButHasPo = lines.length > 0 && lines.every(l => l.accepted_qty === null) && hasPoQty;
  const canConfirm = st !== "confirmed" && (st === "open" || allNullButHasPo);

  const saveDetails = async () => {
    setDetailsSaving(true);
    setDetailsSaved(false);
    try {
      await fetch(`/api/orders/${order.id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: delivDate || null,
          deliveryTime: delivTime || null,
          pickupDate: pickupDate || null,
          pickupTime: pickupTime || null,
        }),
      });
      setDetailsSaved(true);
      onRefresh();
      setTimeout(() => setDetailsSaved(false), 2500);
    } finally {
      setDetailsSaving(false);
    }
  };

  const saveLineQty = async (lineId: number, val: string) => {
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty < 0) return;
    setSavingLine(p => ({ ...p, [lineId]: true }));
    try {
      await fetch(`/api/orders/${order.id}/intake-line/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedQty: qty }),
      });
      onRefresh();
    } finally {
      setSavingLine(p => ({ ...p, [lineId]: false }));
    }
  };

  const setAllOrderEqPo = async () => {
    const updates = lines.filter(l => l.po_qty > 0).map(l =>
      fetch(`/api/orders/${order.id}/intake-line/${l.line_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedQty: l.po_qty }),
      }),
    );
    await Promise.all(updates);
    const next: Record<number, string> = {};
    lines.forEach(l => { next[l.line_id] = l.po_qty > 0 ? String(l.po_qty) : ""; });
    setLineEdits(next);
    onRefresh();
  };

  const confirmOrder = async () => {
    setConfirming(true);
    try {
      // Auto-fill any null accepted_qty with po_qty before confirming
      // (operator chose to accept PO quantities as-is)
      const nullLines = lines.filter(l => l.accepted_qty === null && l.po_qty > 0);
      if (nullLines.length > 0) {
        await Promise.all(nullLines.map(l =>
          fetch(`/api/orders/${order.id}/intake-line/${l.line_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ acceptedQty: l.po_qty }),
          })
        ));
      }

      const r = await fetch(`/api/orders/${order.id}/confirm`, { method: "POST" });
      if (r.ok) {
        toast({
          title: "Order confirmed ✓",
          description: `${order.order_number}${order.po_number ? ` · PO ${order.po_number}` : ""} is now confirmed.`,
        });
        onRefresh();
      } else {
        const err = await r.json();
        toast({
          title: "Cannot confirm",
          description: err.message ?? "กรุณาตรวจสอบข้อมูลก่อนยืนยัน",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  // PO mode: which radio is active
  const poMode = isFromUpload ? "upload" : order.po_number ? "manual" : "no-po";

  // Upload date: use created_at if available
  const uploadedDate = order.created_at
    ? order.created_at.slice(0, 10)
    : order.order_date?.slice(0, 10) ?? "";

  return (
    <div
      className="overflow-hidden"
      style={{ background: "#F0F2F5" }}
      onClick={e => e.stopPropagation()}
    >
      {/* ── Banner (handover tk-edit-banner) ── */}
      <div className="sticky top-0 z-10 flex items-center gap-2 flex-wrap px-4 py-2.5 bg-white border-b border-[#E1E5EA] shadow-sm text-[13px]">
        <StatusPill order={order} />
        {attn && <AttentionChip order={order} />}
        <CustPill name={order.partner_name} />
        {order.po_number && (
          <code className="font-mono text-[13px] bg-white border border-[#ddd] px-2 py-0.5 rounded text-[#0C447C]">
            {order.po_number}
          </code>
        )}
        {order.delivery_date && (
          <span className="text-[12px] text-[#666]">deliv {fmtDateShort(order.delivery_date)}</span>
        )}
        <span className="text-[#166534] text-[11px] font-medium ml-1">✓ Saved</span>

        <div className="ml-auto flex items-center gap-1.5">
          {st === "confirmed" ? (
            <span className="text-[11px] text-[#166534] bg-[#F0FDF4] border border-[#86efac] px-3 py-1.5 rounded-lg font-semibold">
              🔒 Confirmed
            </span>
          ) : canConfirm ? (
            <button onClick={confirmOrder} disabled={confirming}
              className="px-4 py-1.5 rounded-lg bg-[#185FA5] text-white text-[12px] font-semibold hover:bg-[#1450A0]">
              {confirming ? "…" : "✓ Confirm Order"}
            </button>
          ) : (
            <button disabled title={attn ?? "Cannot confirm"}
              className="px-4 py-1.5 rounded-lg bg-[#FEF3C7] text-[#854F0B] border border-[#F0B400] text-[12px] font-semibold cursor-not-allowed">
              Cannot confirm
            </button>
          )}
          <button onClick={onCollapse}
            className="px-3 py-1.5 rounded-lg border border-[#d6d8dc] text-[#444] text-[12px] font-medium bg-white hover:bg-[#f5f5f5]">
            Collapse
          </button>
          <button onClick={() => onDelete(order.id)}
            className="px-3 py-1.5 rounded-lg border border-[#FCA5A5] text-[#991B1B] text-[12px] font-medium bg-white hover:bg-[#FEF2F2]">
            Delete order
          </button>
        </div>
      </div>

      {/* Attention warning strip */}
      {attn && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FFFBEB] border-b border-[#FCD34D] text-[#854F0B] text-[12px] font-medium">
          ⚠{" "}
          {allNullButHasPo
            ? "Store Order quantities are not filled — clicking Confirm Order will accept PO quantities as-is"
            : `Fix before confirming: ${attn}`}
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="grid gap-3 p-3" style={{ gridTemplateColumns: "300px 1fr" }}>

        {/* ── Left sidebar ── */}
        <div className="space-y-2.5">

          {/* CUSTOMER & SITE */}
          <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#E1E5EA]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#555]">Customer &amp; Site</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                st === "confirmed"
                  ? "border-green-400 text-green-700"
                  : "border-[#1E40AF] text-[#1E40AF]"
              }`}>
                {st === "confirmed" ? "CONFIRMED" : "OPEN"}
              </span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">Customer</label>
                <div className="flex items-center justify-between border border-[#d6d8dc] rounded-lg px-3 py-2 bg-[#f9fafb] text-sm text-[#555]">
                  <span>{order.partner_name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#aaa]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">Site</label>
                <div className="flex items-center justify-between border border-[#d6d8dc] rounded-lg px-3 py-2 bg-[#f9fafb] text-sm text-[#555]">
                  <span>[{order.delivery_site_id}] {order.delivery_site_name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#aaa]" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-[#ecedf0] text-[#555] text-[10px] font-medium">direct</span>
                {isFromUpload && (
                  <span className="text-[11px] text-[#854F0B]">locked from PO upload</span>
                )}
              </div>
            </div>
          </div>

          {/* More details / ประวัติ */}
          <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] text-[#555] hover:bg-[#fafbfc] text-left"
            >
              <span className={`text-[9px] text-[#888] transition-transform ${moreOpen ? "rotate-90" : ""}`}>▶</span>
              <span>🗒️ More details / ประวัติ</span>
            </button>
            {moreOpen && (
              <div className="border-t border-[#e5e7eb] px-4 py-3 text-[11px] text-[#888] space-y-1">
                <div><b>Order #:</b> {order.order_number}</div>
                <div><b>Source:</b> {order.source ?? "manual"}</div>
              </div>
            )}
          </div>

          {/* PO */}
          <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#E1E5EA]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#555]">PO</span>
              {isFromUpload && (
                <span className="text-[9px] text-[#888] uppercase tracking-wide">(Locked from upload)</span>
              )}
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {/* Radio buttons */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { val: "no-po", label: "No PO" },
                  { val: "manual", label: "Type PO #" },
                  { val: "upload", label: "Upload PO file" },
                ] as const).map(({ val, label }) => {
                  const active = val === poMode;
                  return (
                    <label key={val}
                      className="flex items-center gap-1.5 text-[11px] text-[#444] cursor-pointer select-none">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        active ? "border-[#1E40AF]" : "border-[#bbb]"
                      }`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#1E40AF]" />}
                      </span>
                      {label}
                    </label>
                  );
                })}
              </div>

              {poMode === "upload" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button className="flex items-center gap-1 px-3 py-1.5 border border-[#d6d8dc] rounded-lg text-[11px] font-medium text-[#333] bg-white hover:bg-[#f5f5f5]">
                      ⬆ Choose {order.partner_name} xlsx
                    </button>
                    {order.po_number && (
                      <span className="text-[12px] text-[#555]">
                        PO #:{" "}
                        <code className="font-mono text-[#0C447C] font-semibold">{order.po_number}</code>
                      </span>
                    )}
                  </div>
                  {uploadedDate && (
                    <span className="text-[11px] text-[#888]">(uploaded {uploadedDate})</span>
                  )}
                </div>
              )}
              {poMode === "manual" && order.po_number && (
                <input readOnly value={order.po_number}
                  className="w-full border border-[#d6d8dc] rounded-lg px-3 py-1.5 text-sm font-mono text-[#0C447C] bg-[#f9fafb]" />
              )}
              {poMode === "no-po" && (
                <span className="text-[11px] text-[#888] italic">No PO — manual order only.</span>
              )}
            </div>
          </div>

          {/* DATES & TIMING */}
          <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#E1E5EA]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#555]">Dates &amp; Timing</span>
              <div className="flex items-center gap-2">
                {detailsSaved && (
                  <span className="text-[#166534] text-[11px] font-medium">✓ Saved</span>
                )}
                <button
                  onClick={saveDetails}
                  disabled={detailsSaving}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-[#1A35A0] disabled:opacity-50"
                >
                  {detailsSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {order.order_date && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#666]">
                      Order date
                      {isFromUpload && <span className="ml-1 text-[10px] text-[#aaa]">(from PO)</span>}
                    </label>
                    <input type="text" readOnly
                      value={order.order_date.slice(0, 10)}
                      className="w-full border border-[#d6d8dc] rounded-lg px-3 py-2 text-[12px] bg-[#f9fafb] text-[#666] cursor-not-allowed" />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] text-[#666]">Delivery date</label>
                  <input type="date" value={delivDate}
                    onChange={e => setDelivDate(e.target.value)}
                    className="w-full border border-[#d6d8dc] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-[#1E40AF]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">Delivery time</label>
                <input type="time" value={delivTime}
                  onChange={e => setDelivTime(e.target.value)}
                  className="w-full border border-[#d6d8dc] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-[#1E40AF]" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#666]">Pickup date</label>
                  <input type="date" value={pickupDate}
                    onChange={e => setPickupDate(e.target.value)}
                    className="w-full border border-[#d6d8dc] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-[#1E40AF]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#666]">Pickup time</label>
                  <input type="time" value={pickupTime}
                    onChange={e => setPickupTime(e.target.value)}
                    className="w-full border border-[#d6d8dc] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-[#1E40AF]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel: Items ── */}
        <div className="bg-white rounded-xl border border-[#E1E5EA] overflow-hidden self-start">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E1E5EA]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#555]">Items</span>
            <span className="text-[10px] text-[#888]">(PO + Order qty; Δ live)</span>
          </div>
          <div className="p-4 space-y-3">

            {/* Warning */}
            {hasPoQty && (
              <div className="bg-[#FFFBEB] border border-[#FCD34D] text-[#854F0B] text-[12px] px-3 py-2.5 rounded-lg">
                ⚠ ทุกรายการต้องมี <b>จำนวนสั่ง</b> — ใช้ <b>0</b> ถ้าสาขาไม่ต้องการสินค้านั้น
              </div>
            )}

            {/* จาก PO info */}
            {isFromUpload && (
              <div className="flex items-center gap-2 text-[11px] text-[#737373]">
                <span className="bg-[#F0F4F8] text-[#1E40AF] px-2 py-0.5 rounded border border-[#C8D6E5] font-semibold text-[10px]">
                  🔒 จาก PO
                </span>
                <span>PO qty อ่านอย่างเดียว · แก้ไดเฉพาะ จำนวนสั่ง</span>
              </div>
            )}

            {/* Set all = PO */}
            {hasPoQty && (
              <div className="flex items-center gap-3">
                <button onClick={setAllOrderEqPo}
                  className="px-3 py-1 text-[12px] border border-[#d6d8dc] rounded-md bg-white text-[#333] hover:bg-[#f5f5f5] font-medium">
                  ↓ Set all Order = PO
                </button>
                <span className="text-[11px] text-[#888]">copies PO qty into Order qty for every line</span>
              </div>
            )}

            {/* Items table */}
            {lines.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#aaa] italic">No lines yet</div>
            ) : (
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    <th className="text-left py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wide text-[#888]" style={{ width: 220, maxWidth: 220 }}>Item</th>
                    <th className="py-1.5 px-1" style={{ width: 110 }}></th>
                    <th className="text-right py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#888]" style={{ width: 80 }}>PO Qty</th>
                    <th className="py-1.5 px-1" style={{ width: 36 }}></th>
                    <th className="text-right py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#888]" style={{ width: 90 }}>
                      Store<br />Order
                    </th>
                    <th className="text-right py-1.5 pl-2 text-[10px] font-semibold uppercase tracking-wide text-[#888]" style={{ width: 68 }}>ต่างจาก PO</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => {
                    const editVal = lineEdits[l.line_id] ?? "";
                    const editedQty = editVal === "" ? null : parseInt(editVal, 10);
                    const delta = editedQty != null && !isNaN(editedQty) ? editedQty - l.po_qty : null;
                    const isSaving = savingLine[l.line_id];

                    return (
                      <tr key={l.line_id} className="border-b border-[#f5f5f5] hover:bg-[#fafcff]">
                        {/* Item */}
                        <td className="py-2.5 pr-2" style={{ width: 220, maxWidth: 220 }}>
                          <div className="font-medium leading-snug truncate">{l.name}</div>
                          <div className="text-[10px] text-[#aaa] font-mono">{l.sku}</div>
                        </td>

                        {/* Badges */}
                        <td className="py-2.5 px-1" style={{ width: 110 }}>
                          <div className="flex items-center gap-1 flex-nowrap">
                            <SizePill primary={l.primary_size} secondary={l.secondary_size} />
                            {l.selling_unit && <PackPill sellingUnit={l.selling_unit} />}
                          </div>
                        </td>

                        {/* PO Qty — locked */}
                        <td className="py-2.5 px-2">
                          <div className="relative flex items-center justify-end">
                            <span className="absolute left-1.5 text-[9px] text-[#92400E]">🔒</span>
                            <input type="number" readOnly disabled value={l.po_qty}
                              className="w-[72px] text-right text-[13px] border border-[#e5e7eb] rounded px-2 py-1 pl-5 bg-[#f9fafb] text-[#555] cursor-not-allowed tabular-nums" />
                          </div>
                        </td>

                        {/* =PO button */}
                        <td className="py-2.5 px-1 text-center">
                          {l.po_qty > 0 && (
                            <button
                              onClick={() => {
                                setLineEdits(p => ({ ...p, [l.line_id]: String(l.po_qty) }));
                                saveLineQty(l.line_id, String(l.po_qty));
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-[#86efac] bg-[#f0fdf4] text-[#166534] font-semibold hover:bg-[#dcfce7] whitespace-nowrap"
                            >
                              =PO
                            </button>
                          )}
                        </td>

                        {/* Store Order — editable */}
                        <td className="py-2.5 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" min={0}
                              value={editVal}
                              placeholder=""
                              onChange={e => setLineEdits(p => ({ ...p, [l.line_id]: e.target.value }))}
                              onBlur={() => {
                                const prev = l.accepted_qty != null ? String(l.accepted_qty) : "";
                                if (editVal !== prev) saveLineQty(l.line_id, editVal);
                              }}
                              className="w-[72px] text-right text-[13px] border border-[#d6d8dc] rounded px-2 py-1 tabular-nums focus:outline-none focus:border-[#1E40AF]"
                            />
                            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-[#aaa] shrink-0" />}
                          </div>
                        </td>

                        {/* Δ from PO */}
                        <td className={`py-2.5 pl-2 text-right tabular-nums text-[13px] font-medium ${
                          delta == null ? "text-[#ccc]"
                          : delta < 0 ? "text-red-600"
                          : delta > 0 ? "text-green-600"
                          : "text-[#ccc]"
                        }`}>
                          {delta == null || delta === 0 ? "—"
                            : delta > 0 ? `+${fmtNum(delta)}`
                            : fmtNum(delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Upload result modal (mirrors handover _showMakroUploadResult) ─────────────

function UploadResultModal({ result, onClose, onCommit }: {
  result: NonNullable<ReturnType<typeof useState<any>>[0]>;
  onClose: () => void;
  onCommit: (siteId: number, siteName: string, deliveryDate: string, poSiteIds?: Record<string, number | null>) => Promise<void>;
}) {
  const [delivDate, setDelivDate] = useState(result.deliveryDate ?? "");
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(result.selectedSiteId);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");

  // Per-PO site overrides for ThaiFood (keyed by poNumber)
  const isThaiFood = result.format === "thaifood";
  const [poSiteIds, setPoSiteIds] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    for (const po of result.reviewBase.pos) {
      init[po.poNumber] = po.deliverySiteId ?? null;
    }
    return init;
  });

  const lines = result.reviewBase.pos.flatMap((po: any) => po.lines);
  const matched = lines.filter((l: any) => l.mapped);
  const unmatched = lines.filter((l: any) => !l.mapped);

  const selectedSite = result.sites.find((s: DeliverySite) => s.id === selectedSiteId);

  // For ThaiFood: can commit if every PO has a siteId (detected or manually picked)
  const allPosSiteAssigned = isThaiFood
    ? result.reviewBase.pos.every((po: any) => (poSiteIds[po.poNumber] ?? null) !== null)
    : (selectedSiteId !== null);

  const handleCommit = async () => {
    if (!allPosSiteAssigned) return;
    setCommitError("");
    setCommitting(true);
    try {
      const fallbackSiteId = selectedSiteId ?? result.sites[0]?.id ?? 0;
      const fallbackSite = result.sites.find((s: DeliverySite) => s.id === fallbackSiteId);
      await onCommit(fallbackSiteId, fallbackSite?.displayName ?? "", delivDate, isThaiFood ? poSiteIds : undefined);
    } catch (err: any) {
      setCommitError(err.message ?? "Failed to create ticket");
    } finally {
      setCommitting(false);
    }
  };

  const formatLabel: Record<string, string> = {
    makro: "Makro", bigc: "BigC", thaifood: "Thaifood",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[17px] font-semibold text-[#1a1a1a]">
            {formatLabel[result.format] ?? result.format} PO upload result
          </h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* PO info row — mirrors handover 4-column header */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "PO #", value: result.poNumber || "(none)", mono: true },
              { label: "Order date", value: result.orderDate ? fmtDateLong(result.orderDate) : "—" },
              { label: "Delivery date", value: result.deliveryDate ? fmtDateLong(result.deliveryDate) : "—" },
              { label: "Branch suffix", value: result.branchCode || "(none)" },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#888] mb-1">{label}</div>
                <div className={`text-[14px] font-medium text-[#1a1a1a] ${mono ? "font-mono" : ""}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Ship-to */}
          {result.shipTo && (
            <div className="border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-[13px]">
              <b>Ship-to:</b> {result.shipTo}
            </div>
          )}

          {/* Site match — ThaiFood shows per-PO table; others show single picker */}
          {isThaiFood ? (
            <div className="border border-[#e5e7eb] rounded-lg overflow-hidden text-[13px]">
              <div className="bg-[#f6f7f9] px-4 py-2 font-semibold text-[#555] text-[12px] uppercase tracking-wide">
                สาขา / Plant — {result.reviewBase.pos.length} POs
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#ecedf0] bg-[#fafbfc]">
                    <th className="text-left px-3 py-1.5 font-medium text-[#888]">PO #</th>
                    <th className="text-left px-3 py-1.5 font-medium text-[#888]">Plant</th>
                    <th className="text-left px-3 py-1.5 font-medium text-[#888]">สาขา</th>
                    <th className="text-right px-3 py-1.5 font-medium text-[#888]">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {result.reviewBase.pos.map((po: any) => {
                    const detectedSite = result.sites.find((s: DeliverySite) => s.id === poSiteIds[po.poNumber]);
                    return (
                      <tr key={po.poNumber}>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-[#555]">{po.poNumber}</td>
                        <td className="px-3 py-1.5 text-[#888]">{po.branchCode ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          {detectedSite ? (
                            <span className="text-green-700 font-medium">{detectedSite.displayName}</span>
                          ) : (
                            <select
                              value={poSiteIds[po.poNumber] ?? ""}
                              onChange={e => setPoSiteIds(prev => ({ ...prev, [po.poNumber]: Number(e.target.value) || null }))}
                              className="border border-amber-300 bg-amber-50 rounded px-2 py-0.5 text-[11px] text-amber-800 focus:outline-none focus:border-[#1E40AF]"
                            >
                              <option value="">— เลือกสาขา —</option>
                              {result.sites.map((s: DeliverySite) => (
                                <option key={s.id} value={s.id}>{s.displayName}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-[#888]">
                          {po.lines.filter((l: any) => l.mapped).length}/{po.lines.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : selectedSite ? (
            <div className="border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-[13px]">
              <b>Site match:</b> [{selectedSite.id}] {selectedSite.displayName}
            </div>
          ) : (
            <div className="border border-amber-300 bg-amber-50 rounded-lg px-4 py-2.5 text-[13px] text-amber-800">
              <b>Site match:</b> none — branch and ship-to did not match any site. Pick manually:
              <select
                value={selectedSiteId ?? ""}
                onChange={e => setSelectedSiteId(Number(e.target.value) || null)}
                className="ml-3 border border-[#d6d8dc] rounded px-2 py-1 text-[12px] text-[#333] focus:outline-none focus:border-[#1E40AF]"
              >
                <option value="">— เลือกสาขา —</option>
                {result.sites.map((s: DeliverySite) => (
                  <option key={s.id} value={s.id}>[{s.id}] {s.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Delivery date picker */}
          <div className="border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-[13px] flex items-center gap-3">
            <b>Delivery date for this ticket:</b>
            <input
              type="date"
              value={delivDate}
              onChange={e => setDelivDate(e.target.value)}
              className="border border-[#d6d8dc] rounded px-2 py-1 text-[12px] focus:outline-none focus:border-[#1E40AF]"
            />
          </div>

          {/* Lines summary */}
          <div className="text-[13px] font-semibold text-[#1a1a1a]">
            Lines: {matched.length} matched · {unmatched.length} unmatched
          </div>

          {/* Matched lines table */}
          {matched.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f6f7f9]">
                    <th className="text-left px-3 py-2 border-b border-[#ecedf0] font-semibold text-[#555]">
                      {result.format === "makro" ? "Makro code" : result.format === "bigc" ? "EAN / Item code" : "Item code"}
                    </th>
                    <th className="text-left px-3 py-2 border-b border-[#ecedf0] font-semibold text-[#555]">SKU / Item</th>
                    <th className="text-right px-3 py-2 border-b border-[#ecedf0] font-semibold text-[#555]">PO qty</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((l: any, i: number) => (
                    <tr key={i} className="border-b border-[#ecedf0] last:border-0 hover:bg-[#fafbfc]">
                      <td className="px-3 py-2 font-mono text-[#555]">{l.customerItemCode}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] text-[#888] mr-1.5">{l.internalSku}</span>
                        {l.internalName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(l.poQty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unmatched lines */}
          {unmatched.length > 0 && (
            <div className="space-y-2">
              <div className="text-[13px] font-semibold text-amber-700">
                Unmatched lines (codes not in master data):
              </div>
              <div className="overflow-x-auto rounded-lg border border-amber-200">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-amber-50">
                      <th className="text-left px-3 py-2 border-b border-amber-200 font-semibold text-amber-800">Code</th>
                      <th className="text-left px-3 py-2 border-b border-amber-200 font-semibold text-amber-800">Item name from file</th>
                      <th className="text-right px-3 py-2 border-b border-amber-200 font-semibold text-amber-800">PO qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatched.map((l: any, i: number) => (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-amber-700">{l.customerItemCode}</td>
                        <td className="px-3 py-2 text-[#555]">{l.itemNameFromFile}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(l.poQty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#888]">
                Unmatched lines will be skipped — add them to Items master data to include next time.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5e7eb] bg-[#fafbfc]">
          {commitError && (
            <div className="px-6 py-2 text-[12px] text-red-600 bg-red-50 border-b border-red-100">
              ⚠ {commitError}
            </div>
          )}
          <div className="flex justify-end gap-2 px-6 py-4">
            <button
              onClick={onClose}
              disabled={committing}
              className="px-4 py-2 text-sm border border-[#d6d8dc] rounded-lg text-[#333] hover:bg-[#f5f5f5] font-medium disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleCommit}
              disabled={!allPosSiteAssigned || committing || matched.length === 0}
              className="px-5 py-2 text-sm bg-[#185FA5] text-white rounded-lg font-semibold hover:bg-[#1450A0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {committing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {committing ? "Creating…" : "Create ticket"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDateLong(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OrdersGrid() {
  const [, navigate] = useLocation();

  // Data
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Date filter
  const [dateMode, setDateMode] = useState<DateMode>("all");
  const [date, setDate] = useState(todayISO);
  const [dateTo, setDateTo] = useState(() => addDays(todayISO(), 6));

  // Other filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [custFilter, setCustFilter] = useState<number | "all">("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [speedFilter, setSpeedFilter] = useState<SpeedFilter>("all");

  // Expand
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Subtab (orders only for now)
  const [subtab] = useState<"orders" | "planning" | "invoice">("orders");

  // Upload PO
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const uploadRef = useRef<HTMLDivElement>(null);
  const makroRef = useRef<HTMLInputElement>(null);
  const bigcRef  = useRef<HTMLInputElement>(null);
  const thaiRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [partners, setPartners] = useState<{ id: number; nickname: string; code: string }[]>([]);
  // Upload result modal (shown after file is parsed — mirrors handover _showMakroUploadResult)
  const [uploadResult, setUploadResult] = useState<{
    format: POFormat;
    partnerName: string;
    poNumber: string;
    orderDate: string;
    deliveryDate: string;
    branchCode: string;
    shipTo: string;
    autoSite: DeliverySite | null;
    sites: DeliverySite[];
    selectedSiteId: number | null;
    reviewBase: Omit<UploadReviewData, "deliverySiteId" | "deliverySiteName">;
  } | null>(null);

  // Site picker modal (shown when auto-detection finds no site match)
  const [sitePicker, setSitePicker] = useState<{
    partnerId: number; partnerName: string;
    sites: DeliverySite[];
    reviewData: Omit<UploadReviewData, "deliverySiteId" | "deliverySiteName">;
  } | null>(null);

  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateMode === "single") params.set("date", date);
      const r = await fetch(`/api/orders/list-view?${params}`);
      if (r.ok) setOrders(await r.json());
    } finally {
      setLoading(false);
    }
  }, [dateMode, date]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Fetch partners for upload flow
  useEffect(() => {
    fetch("/api/business-partners")
      .then(r => r.json())
      .then(d => setPartners(Array.isArray(d) ? d : []));
  }, []);

  // ── Upload PO handler (mirrors handover: click format → file picker → parse → review) ──

  const handleUploadFile = useCallback(async (format: POFormat, file: File) => {
    setUploadError("");
    setUploading(true);
    try {
      const parsedPOs = await parseFile(format, file);
      if (parsedPOs.length === 0) {
        setUploadError("No PO lines found in file.");
        return;
      }

      // Auto-detect partner from format name
      const nameMatch: Record<POFormat, RegExp> = {
        makro:    /makro/i,
        bigc:     /big.?c/i,
        thaifood: /thaifood/i,
      };
      const partner = partners.find(p => nameMatch[format].test(p.nickname));
      if (!partner) {
        setUploadError(`ไม่พบลูกค้า ${format} ใน master data — กรุณาเพิ่มใน Customers ก่อน`);
        return;
      }

      // Lookup customer item codes → internal SKUs
      const allCodes = Array.from(new Set(
        parsedPOs.flatMap(po => po.lines.map(l => l.customerItemCode)).filter(Boolean),
      ));
      let lookupMap: Record<string, any> = {};
      if (allCodes.length > 0) {
        const r = await fetch("/api/items/lookup-customer-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId: partner.id, codes: allCodes }),
        });
        if (r.ok) lookupMap = await r.json();
      }

      const reviewBase: Omit<UploadReviewData, "deliverySiteId" | "deliverySiteName"> = {
        partnerId: partner.id,
        partnerName: partner.nickname,
        pos: parsedPOs.map(po => ({
          poNumber: po.poNumber,
          orderDate: po.orderDate,
          deliveryDate: po.deliveryDate,
          lines: po.lines.map(l => {
            const match = lookupMap[l.customerItemCode] ?? null;
            return {
              customerItemCode: l.customerItemCode,
              itemNameFromFile: l.itemName,
              poQty: l.poQty,
              poPrice: l.poPrice,
              itemId:       match ? Number(match.id) : null,
              internalSku:  match?.sku ?? null,
              internalName: match?.name ?? null,
              primarySize:  match?.primary_size ?? null,
              secondarySize: match?.secondary_size ?? null,
              eggsPerPack:  match?.eggs_per_pack ? Number(match.eggs_per_pack) : null,
              sellingUnit:  match?.selling_unit ?? null,
              mapped: match !== null,
            };
          }),
        })),
      };

      // Fetch delivery sites for this partner (includes partnerBranchCode + province for auto-detection)
      const sitesRes = await fetch(`/api/pricing/delivery-sites?partnerId=${partner.id}`);
      const sites: DeliverySite[] = sitesRes.ok ? await sitesRes.json() : [];

      // For ThaiFood: detect site per-PO from its Plant code, then embed into pos entries
      if (format === "thaifood") {
        const perPoSites = parsedPOs.map(po => detectSiteFromPO(format, [po], sites));
        reviewBase.pos = reviewBase.pos.map((po, i) => ({
          ...po,
          deliverySiteId: perPoSites[i]?.id ?? null,
          branchCode: parsedPOs[i]._branchCode ?? "",
        }));
      }

      // Auto-detect site from PO file content (branch code from PO#, ship-to address, EAN)
      const autoSite = detectSiteFromPO(format, parsedPOs, sites);
      const firstPO = parsedPOs[0];

      // Check for duplicate PO numbers before showing the modal
      for (const po of parsedPOs) {
        if (!po.poNumber) continue;
        const check = await fetch(
          `/api/orders/po-exists?poNumber=${encodeURIComponent(po.poNumber)}&partnerId=${partner.id}`
        );
        if (check.ok) {
          const { exists, orderNumber } = await check.json();
          if (exists) {
            setUploadError(
              `PO ${po.poNumber} already exists (order ${orderNumber}). No order was created.`
            );
            return;
          }
        }
      }

      // Always show the upload result modal (mirrors handover _showMakroUploadResult)
      setUploadResult({
        format,
        partnerName: partner.nickname,
        poNumber: firstPO.poNumber ?? "",
        orderDate: firstPO.orderDate ?? "",
        deliveryDate: firstPO.deliveryDate ?? "",
        branchCode: firstPO._branchCode ?? "",
        shipTo: firstPO._shipTo ?? "",
        autoSite: autoSite ?? (sites.length === 1 ? sites[0] : null),
        sites,
        selectedSiteId: autoSite?.id ?? (sites.length === 1 ? sites[0].id : null),
        reviewBase,
      });
    } catch (err: any) {
      setUploadError(err.message ?? "Parse failed");
    } finally {
      setUploading(false);
    }
  }, [partners, navigate]);

  const handleFileChange = useCallback((format: POFormat) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be re-selected
    if (!file) return;
    setShowUploadMenu(false);
    await handleUploadFile(format, file);
  }, [handleUploadFile]);

  const handleSiteConfirm = useCallback(async (siteId: number) => {
    if (!sitePicker) return;
    setSitePicker(null);
    // Reuse the same direct-create logic via uploadResult
    // Store as uploadResult so the modal can handle it
    setUploadResult(prev => prev
      ? { ...prev, selectedSiteId: siteId, autoSite: prev.sites.find(s => s.id === siteId) ?? null }
      : null
    );
  }, [sitePicker]);

  const handleUploadCommit = useCallback(async (siteId: number, _siteName: string, deliveryDate: string, poSiteIds?: Record<string, number | null>) => {
    if (!uploadResult) return;
    for (const po of uploadResult.reviewBase.pos as UploadReviewData["pos"]) {
      const mappedLines = po.lines
        .filter(l => l.mapped && l.itemId)
        .map(l => ({
          itemId: Number(l.itemId),
          unitPrice: Number(l.poPrice) || 0,
          quantity: Number(l.poQty),
        }))
        .filter(l => l.quantity > 0);
      if (!mappedLines.length) continue;
      const thisSiteId = poSiteIds?.[po.poNumber] ?? (po as any).deliverySiteId ?? siteId;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: uploadResult.reviewBase.partnerId,
          deliverySiteId: thisSiteId,
          orderDate: po.orderDate,
          deliveryDate: deliveryDate || po.deliveryDate,
          status: "pending",
          source: "upload",
          poNumber: po.poNumber,
          totalAmount: mappedLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
          notes: `PO: ${po.poNumber}`,
          products: mappedLines,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? `Failed to create PO ${po.poNumber}`);
      }
    }
    setUploadResult(null);
    fetchOrders();
  }, [uploadResult, fetchOrders]);

  // Close upload dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (uploadRef.current && !uploadRef.current.contains(e.target as Node)) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = orders;

    // Search across PO#, site, customer
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.po_number ?? "").toLowerCase().includes(q) ||
        (o.delivery_site_name ?? "").toLowerCase().includes(q) ||
        (o.partner_name ?? "").toLowerCase().includes(q) ||
        (o.order_number ?? "").toLowerCase().includes(q),
      );
    }

    // Customer filter
    if (custFilter !== "all") list = list.filter(o => o.partner_id === custFilter);

    // Status filter
    if (statusFilter !== "all") list = list.filter(o => ticketStatus(o) === statusFilter);

    return list;
  }, [orders, search, custFilter, statusFilter]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpi = useMemo(() => {
    let drafting = 0, open = 0, confirmed = 0, totalEggs = 0;
    const siteSet = new Set<number>();
    const custEggs: Record<string, number> = {};

    for (const o of filtered) {
      const st = ticketStatus(o);
      if (st === "drafting") drafting++;
      else if (st === "open") open++;
      else confirmed++;
      totalEggs += Number(o.total_eggs) || 0;
      siteSet.add(o.delivery_site_id);
      custEggs[o.partner_name] = (custEggs[o.partner_name] ?? 0) + (Number(o.total_eggs) || 0);
    }

    // Top customers by eggs
    const topCusts = Object.entries(custEggs)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Sites per customer
    const custSites: Record<string, Set<number>> = {};
    for (const o of filtered) {
      if (!custSites[o.partner_name]) custSites[o.partner_name] = new Set();
      custSites[o.partner_name].add(o.delivery_site_id);
    }

    return { drafting, open, confirmed, totalEggs, sites: siteSet.size, topCusts, custSites };
  }, [filtered]);

  // Top 5 partners for customer filter chips
  const topPartners = useMemo(() => {
    const m: Record<number, { name: string; eggs: number }> = {};
    for (const o of orders) {
      if (!m[o.partner_id]) m[o.partner_id] = { name: o.partner_name, eggs: 0 };
      m[o.partner_id].eggs += Number(o.total_eggs) || 0;
    }
    return Object.entries(m)
      .map(([id, v]) => ({ id: Number(id), ...v }))
      .sort((a, b) => b.eggs - a.eggs)
      .slice(0, 5);
  }, [orders]);

  // Date label
  const dateLabel = useMemo(() => {
    if (dateMode === "all") return "All dates";
    if (dateMode === "range") return `${date} → ${dateTo}`;
    const suffix = date === today ? " · today" : date === tomorrow ? " · tomorrow" : date === yesterday ? " · yesterday" : "";
    return fmtDateDow(date) + suffix;
  }, [dateMode, date, dateTo, today, tomorrow, yesterday]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const allVisibleSelected = filtered.length > 0 && filtered.every(o => selectedIds.has(o.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(o => o.id)));
  };

  // ── Delete order ───────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this order?")) return;
    await fetch(`/api/orders/${id}`, { method: "DELETE" });
    setExpandedId(null);
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const bulkConfirm = async () => {
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        fetch(`/api/orders/${id}/confirm`, { method: "POST" }),
      ));
      setSelectedIds(new Set());
      fetchOrders();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkCopyPOQty = async () => {
    setBulkBusy(true);
    try {
      const selectedOrders = filtered.filter(o => selectedIds.has(o.id));
      for (const order of selectedOrders) {
        const lines = (order.lines ?? []).filter(l => l.po_qty > 0);
        await Promise.all(lines.map(l =>
          fetch(`/api/orders/${order.id}/intake-line/${l.line_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ acceptedQty: l.po_qty }),
          }),
        ));
      }
      setSelectedIds(new Set());
      fetchOrders();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} order${count > 1 ? "s" : ""}?`)) return;
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        fetch(`/api/orders/${id}`, { method: "DELETE" }),
      ));
      setExpandedId(null);
      setSelectedIds(new Set());
      fetchOrders();
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasOrders = filtered.length > 0;

  return (
    <div className="min-h-screen bg-[#F6F7F8]">
      <div className="max-w-[1600px] mx-auto px-6 py-5 space-y-4">

        {/* Page header */}
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-bold text-[#1a1a1a]">Orders</h1>
          <span className="text-[14px] text-[#888]">{dateLabel}</span>
          <button onClick={fetchOrders} disabled={loading} className="ml-auto p-1.5 rounded hover:bg-[#ebebeb]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#888]" /> : <RefreshCw className="w-3.5 h-3.5 text-[#888]" />}
          </button>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-4 gap-3">
          {/* Tickets by status */}
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2">Tickets by status</div>
            <div className="flex flex-col gap-0.5">
              {kpi.drafting > 0 && <div className="text-sm"><b className="text-[#854F0B]">{kpi.drafting}</b> <span className="text-[#888]">Drafting</span></div>}
              {kpi.open > 0 && <div className="text-sm"><b className="text-[#1E40AF]">{kpi.open}</b> <span className="text-[#888]">Open</span></div>}
              {kpi.confirmed > 0 && <div className="text-sm"><b className="text-[#166534]">{kpi.confirmed}</b> <span className="text-[#888]">Confirmed</span></div>}
              {kpi.drafting === 0 && kpi.open === 0 && kpi.confirmed === 0 && <div className="text-sm text-[#bbb]">0 tickets</div>}
            </div>
          </div>

          {/* Total eggs */}
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1">Total eggs</div>
            <div className="text-[28px] font-bold tabular-nums text-[#1a1a1a] leading-tight">
              {fmtNum(kpi.totalEggs)}
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {kpi.topCusts.map(([name, eggs]) => (
                <span key={name}
                  className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: custBg(name), color: custColor(name) }}
                >
                  {name} {fmtNum(eggs)}
                </span>
              ))}
              {kpi.topCusts.length === 0 && <span className="text-[#bbb] text-xs">no orders yet</span>}
            </div>
          </div>

          {/* Delivery sites */}
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1">Delivery sites</div>
            <div className="text-[28px] font-bold tabular-nums text-[#1a1a1a] leading-tight">{kpi.sites}</div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(kpi.custSites).map(([name, sites]) => (
                <span key={name} className="text-[10px] text-[#666]">
                  <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1"
                    style={{ background: custBg(name), color: custColor(name) }}>{name}</span>
                  {sites.size} Direct
                </span>
              ))}
              {Object.keys(kpi.custSites).length === 0 && <span className="text-[#bbb] text-xs">no sites yet</span>}
            </div>
          </div>

          {/* Fast-track */}
          <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-4 shadow-sm">
            <div className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1">Fast-track</div>
            <div className="text-[28px] font-bold tabular-nums text-[#1a1a1a] leading-tight">0</div>
            <div className="text-[11px] text-[#888] mt-1">same-day orders</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-[#e3e5e8] px-5 py-4 shadow-sm space-y-3">
          {/* Search */}
          <div className="flex items-center gap-2 border border-[#e3e5e8] rounded-lg px-3 py-2 bg-[#fafbfc] focus-within:border-[#9ca3af] focus-within:bg-white">
            <span className="text-[#aaa]">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by PO, site, customer name..."
              className="flex-1 bg-transparent text-sm outline-none text-[#333] placeholder-[#aaa]"
            />
            {search && <button onClick={() => setSearch("")} className="text-[#aaa] hover:text-[#555]"><X className="w-3.5 h-3.5" /></button>}
          </div>

          {/* Filter grid */}
          <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: "auto auto auto auto auto" }}>
            {/* DATE */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Date</span>
              <div className="flex gap-1">
                <Chip active={dateMode === "all"} onClick={() => setDateMode("all")}>All</Chip>
                <Chip active={dateMode === "single"} onClick={() => setDateMode("single")}>Single</Chip>
                <Chip active={dateMode === "range"} onClick={() => setDateMode("range")}>Range</Chip>
              </div>
              {dateMode === "single" && (
                <div className="flex items-center gap-1 mt-1">
                  <Chip active={date === yesterday} onClick={() => setDate(yesterday)}>Yest</Chip>
                  <Chip active={date === today} onClick={() => setDate(today)}>Today</Chip>
                  <Chip active={date === tomorrow} onClick={() => setDate(tomorrow)}>Tom</Chip>
                  <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
                    className="h-7 px-2 text-xs border border-[#e3e5e8] rounded-md bg-white focus:outline-none" />
                  <span className="inline-flex gap-0.5">
                    <button onClick={() => setDate(d => addDays(d, -1))} className="w-6 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5] text-xs">‹</button>
                    <button onClick={() => setDate(d => addDays(d, 1))} className="w-6 h-7 flex items-center justify-center border border-[#e3e5e8] rounded text-[#555] hover:bg-[#f5f5f5] text-xs">›</button>
                  </span>
                </div>
              )}
              {dateMode === "range" && (
                <div className="flex items-center gap-1 mt-1">
                  <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
                    className="h-7 px-2 text-xs border border-[#e3e5e8] rounded-md bg-white focus:outline-none" />
                  <span className="text-xs text-[#888]">to</span>
                  <input type="date" value={dateTo} onChange={e => e.target.value && setDateTo(e.target.value)}
                    className="h-7 px-2 text-xs border border-[#e3e5e8] rounded-md bg-white focus:outline-none" />
                </div>
              )}
            </div>

            {/* CUSTOMER */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">
                Customer <span className="font-normal normal-case text-[#ccc]">(top 5 by eggs)</span>
              </span>
              <div className="flex gap-1 flex-wrap">
                <Chip active={custFilter === "all"} onClick={() => setCustFilter("all")}>All</Chip>
                {topPartners.map(p => (
                  <Chip
                    key={p.id}
                    active={custFilter === p.id}
                    onClick={() => setCustFilter(custFilter === p.id ? "all" : p.id)}
                    color={custColor(p.name)}
                  >
                    {p.name}
                  </Chip>
                ))}
              </div>
            </div>

            {/* GROUP / TYPE */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Group / Type</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#aaa] w-10">Group</span>
                {(["all", "g1", "g2", "none"] as GroupFilter[]).map(v => (
                  <Chip key={v} active={groupFilter === v} onClick={() => setGroupFilter(v)}>
                    {v === "all" ? "All" : v === "none" ? "—" : v.toUpperCase()}
                  </Chip>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#aaa] w-10">Type</span>
                {(["all", "direct", "dc"] as TypeFilter[]).map(v => (
                  <Chip key={v} active={typeFilter === v} onClick={() => setTypeFilter(v)}>
                    {v === "all" ? "All" : v === "direct" ? "Direct" : "DC"}
                  </Chip>
                ))}
              </div>
            </div>

            {/* SPEED */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Speed</span>
              <div className="flex gap-1">
                <Chip active={speedFilter === "all"} onClick={() => setSpeedFilter("all")}>All</Chip>
                <Chip active={speedFilter === "fast"} onClick={() => setSpeedFilter("fast")}>⚡ Fast</Chip>
                <Chip active={speedFilter === "normal"} onClick={() => setSpeedFilter("normal")}>Normal</Chip>
              </div>
            </div>

            {/* STATUS */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Status</span>
              <div className="flex gap-1">
                <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</Chip>
                <Chip active={statusFilter === "drafting"} onClick={() => setStatusFilter("drafting")}>Drafting</Chip>
                <Chip active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Open</Chip>
                <Chip active={statusFilter === "confirmed"} onClick={() => setStatusFilter("confirmed")}>Confirmed</Chip>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-end gap-0 border-b border-[#e3e5e8]">
          {(["orders", "planning", "invoice"] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                subtab === tab
                  ? "border-[#1a1a1a] text-[#1a1a1a]"
                  : "border-transparent text-[#888] cursor-not-allowed opacity-60"
              }`}
            >
              {tab === "orders" ? "Orders" : tab === "planning" ? "Planning" : "Invoice"}
              {tab === "orders" && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#e5e7eb] text-[10px] font-bold text-[#555]">
                  {filtered.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          {/* Hidden file inputs — one per format, matching the handover */}
          <input ref={makroRef} type="file" accept={FORMAT_ACCEPT.makro}    className="hidden" onChange={handleFileChange("makro")} />
          <input ref={bigcRef}  type="file" accept={FORMAT_ACCEPT.bigc}     className="hidden" onChange={handleFileChange("bigc")} />
          <input ref={thaiRef}  type="file" accept={FORMAT_ACCEPT.thaifood} className="hidden" onChange={handleFileChange("thaifood")} />

          <div className="flex items-center gap-2">
            {/* Upload PO dropdown */}
            <div className="relative" ref={uploadRef}>
              <button
                onClick={() => setShowUploadMenu(v => !v)}
                disabled={uploading}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded border border-[#d6d8dc] bg-white text-[12px] font-medium text-[#333] hover:bg-[#f1f3f5] select-none disabled:opacity-60"
              >
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> กำลังประมวลผล…</>
                  : <>⬆ Upload PO <span className="text-[#aaa] ml-0.5">▾</span></>
                }
              </button>

              {showUploadMenu && (
                <div className="absolute top-[calc(100%+4px)] left-0 min-w-[180px] bg-white border border-[#d6d8dc] rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
                  {([
                    { format: "makro" as POFormat,    ref: makroRef, label: "Makro · xlsx" },
                    { format: "bigc"  as POFormat,    ref: bigcRef,  label: "BigC · csv or xlsx" },
                    { format: "thaifood" as POFormat, ref: thaiRef,  label: "Thaifood · xlsx" },
                  ]).map(({ format, ref, label }) => (
                    <button
                      key={format}
                      onClick={() => { setShowUploadMenu(false); ref.current?.click(); }}
                      className="block w-full text-left px-3.5 py-2 text-[12px] text-[#333] hover:bg-[#E6F1FB] border-none bg-transparent cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    disabled
                    title="Format not yet configured — share a sample file"
                    className="block w-full text-left px-3.5 py-2 text-[12px] text-[#aaa] cursor-not-allowed opacity-55 bg-transparent border-none"
                  >
                    CJ · <em>not configured</em>
                  </button>
                </div>
              )}
            </div>

            {uploadError && (
              <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-md">
                {uploadError}
              </span>
            )}
          </div>

          <button
            onClick={() => navigate(`/orders/new`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333]"
          >
            <Plus className="w-4 h-4" />
            Order
          </button>
        </div>

        {/* Upload result modal — mirrors handover _showMakroUploadResult */}
        {uploadResult && (
          <UploadResultModal
            result={uploadResult}
            onClose={() => setUploadResult(null)}
            onCommit={handleUploadCommit}
          />
        )}

        {/* Site picker modal — appears when partner has multiple delivery sites */}
        {sitePicker && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
              <div className="px-5 pt-5 pb-3 border-b border-[#e5e7eb] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">เลือก Delivery Site</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sitePicker.partnerName} · {sitePicker.sites.length} สาขา</div>
                </div>
                <button onClick={() => setSitePicker(null)} className="text-[#aaa] hover:text-[#555]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 py-2 max-h-72 overflow-y-auto divide-y divide-[#f0f0f0]">
                {sitePicker.sites.map(site => (
                  <button
                    key={site.id}
                    onClick={() => handleSiteConfirm(site.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#E6F1FB] rounded-md transition-colors"
                  >
                    {site.displayName}
                  </button>
                ))}
              </div>
              <div className="px-5 pb-4 pt-2 text-right">
                <button onClick={() => setSitePicker(null)} className="text-sm text-muted-foreground hover:text-foreground">
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-[#e3e5e8]">
            <Loader2 className="w-5 h-5 animate-spin text-[#aaa]" />
          </div>
        ) : !hasOrders ? (
          <div className="bg-white rounded-xl border border-[#e3e5e8] py-16 text-center">
            <div className="text-[#bbb] text-sm">
              No tickets for {dateLabel}.
              <br />
              <span className="text-[11px]">
                {search ? "Try clearing the search." : "Click + Order or use ⬆ Upload PO to add."}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#e3e5e8] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb]" style={{ background: "#fafbfc" }}>
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="w-5"></th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide">Customer ↕</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide">PO # ↕</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide">Site ↕</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide">Vehicle ↕</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#888] uppercase tracking-wide">Eggs ↕</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide">Pack mix</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#888] uppercase tracking-wide">Status ↕</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => {
                    const isExpanded = expandedId === order.id;
                    const st = ticketStatus(order);
                    const eggs = Number(order.total_eggs) || 0;

                    return (
                      <>
                        <tr
                          key={order.id}
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          className={`cursor-pointer border-b transition-colors ${
                            isExpanded
                              ? "bg-[#fafbfc] border-[#d6d8dc]"
                              : "border-[#f0f0f0] hover:bg-[#fafbfc]"
                          }`}
                        >
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggleSelect(order.id)}
                            />
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`text-[#aaa] text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}>›</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <CustPill name={order.partner_name} />
                          </td>
                          <td className="px-3 py-2.5">
                            {order.po_number
                              ? <code className="font-mono text-xs text-[#0C447C]">{order.po_number}</code>
                              : <span className="text-[11px] text-[#aaa] bg-[#f1f3f5] px-1.5 py-0.5 rounded">no PO</span>
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-sm text-[#333]">{order.delivery_site_name}</div>
                            {order.province && <div className="text-[11px] text-[#aaa]">{order.province}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-[#aaa]">—</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            {fmtNum(eggs)}
                            <QtyBadge basis={st === "confirmed" ? "ORD" : "PO"} />
                          </td>
                          <td className="px-3 py-2.5">
                            <PackMixCell lines={order.lines} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              <StatusPill order={order} />
                              <AttentionChip order={order} />
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${order.id}-exp`} className="border-b border-[#d6d8dc]">
                            <td colSpan={9} className="p-0 bg-[#fafbfc] border-l border-r border-[#d6d8dc]">
                              <div className="px-3 py-3">
                                <ExpandedCard
                                  order={order}
                                  onCollapse={() => setExpandedId(null)}
                                  onDelete={handleDelete}
                                  onRefresh={fetchOrders}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-6 py-3 bg-[#FFFBEB] border-t border-[#FCD34D] shadow-lg">
          <span className="text-sm font-semibold text-[#854F0B]">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-[#FCD34D]" />
          <button
            onClick={bulkConfirm}
            disabled={bulkBusy}
            className="px-4 py-1.5 rounded-lg bg-[#185FA5] text-white text-[12px] font-semibold hover:bg-[#1450A0] disabled:opacity-50"
          >
            Confirm order
          </button>
          <button
            onClick={bulkCopyPOQty}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-lg border border-[#d6d8dc] text-[#333] text-[12px] font-medium bg-white hover:bg-[#f5f5f5] disabled:opacity-50"
          >
            ↓ Copy PO qty
          </button>
          <button
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-lg border border-[#FCA5A5] text-[#991B1B] text-[12px] font-medium bg-white hover:bg-[#FEF2F2] disabled:opacity-50"
          >
            Delete order
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-[12px] text-[#888] hover:text-[#333]"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
