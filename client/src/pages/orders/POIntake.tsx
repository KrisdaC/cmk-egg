import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  type UploadReviewData,
  UPLOAD_REVIEW_KEY,
} from "./POUploadReview";
import {
  Upload, Plus, Search, X, RefreshCw, ChevronDown,
  CheckCircle2, Circle, AlertTriangle, Loader2, FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { parseFile } from "@/lib/po-parsers";

// =============================================
// TYPES
// =============================================

interface PORow {
  id: number;
  order_number: string;
  po_number: string | null;
  order_date: string | null;
  delivery_date: string | null;
  status: string;
  source: string | null;
  adjustment_reason: string | null;
  adjustment_approved: boolean;
  notes: string | null;
  partner_id: number;
  partner_name: string;
  partner_code: string;
  delivery_site_id: number;
  delivery_site_name: string;
  province: string | null;
  line_count: number;
  total_po_qty_eggs: number;
  total_accepted_qty_eggs: number;
  adjustment_eggs: number;
  price_check_status: "match" | "mismatch" | "missing" | "no_lines";
}

interface POLine {
  id: number;
  item_id: number;
  po_qty: number;
  accepted_qty: number;
  accepted_qty_raw: number | null;
  unit_price: string;
  po_price: string;
  customer_item_code: string | null;
  sku: string | null;
  name: string;
  primary_size: string | null;
  secondary_size: string | null;
  eggs_per_pack: number | null;
  selling_unit: string | null;
  active_price: string | null;
  price_status: "match" | "mismatch" | "missing";
}

interface PODetail {
  id: number;
  order_number: string;
  po_number: string | null;
  order_date: string | null;
  delivery_date: string | null;
  status: string;
  adjustment_reason: string | null;
  adjustment_approved: boolean;
  adjustment_approved_by: string | null;
  notes: string | null;
  partner_id: number;
  delivery_site_id: number;
  lines: POLine[];
}

// =============================================
// HELPERS
// =============================================

const SIZE_COLORS: Record<string, string> = {
  "0": "bg-[#FCEBEB] text-[#791F1F]",
  "1": "bg-[#FAEEDA] text-[#633806]",
  "2": "bg-[#EAF3DE] text-[#27500A]",
  "3": "bg-[#E1F5EE] text-[#085041]",
  "4": "bg-[#E6F1FB] text-[#0C447C]",
  "5": "bg-[#EEEDFE] text-[#3C3489]",
};

function SizeTag({ primary, secondary }: { primary: string | null; secondary: string | null }) {
  if (!primary || ["S", "M", "L"].includes(primary)) return null;
  const cls = SIZE_COLORS[primary] ?? "bg-[#F1EFE8] text-[#888780]";
  const label = secondary ? `${primary}-${secondary}` : `เบอร์ ${primary}`;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function PriceStatusBadge({ status }: { status: "match" | "mismatch" | "missing" | "no_lines" | undefined }) {
  if (!status || status === "no_lines") return <span className="text-xs text-muted-foreground">—</span>;
  if (status === "match") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Match</span>;
  if (status === "mismatch") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Mismatch</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Missing</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    confirmed: "bg-green-100 text-green-700",
    in_production: "bg-purple-100 text-purple-700",
    delivered: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-600",
  };
  const label: Record<string, string> = {
    pending: "Open",
    confirmed: "Confirmed",
    in_production: "In Production",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

function fmtNum(n: number | string | null | undefined, decimals = 0) {
  const v = Number(n);
  if (isNaN(v)) return "—";
  return v.toLocaleString("th-TH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return d.slice(0, 10);
}

// =============================================
// MAIN PAGE
// =============================================

export default function POIntakePage() {
  const [, navigate] = useLocation();

  // List state
  const [poList, setPoList] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Drawer state
  const [selected, setSelected] = useState<PODetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [editLines, setEditLines] = useState<Record<number, string>>({}); // lineId → acceptedQty string
  const [savingLines, setSavingLines] = useState<Record<number, boolean>>({});
  const [adjReason, setAdjReason] = useState("");
  const [approvingAdj, setApprovingAdj] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [drawerError, setDrawerError] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadCustomer, setUploadCustomer] = useState("");
  const [partners, setPartners] = useState<{ id: number; nickname: string; code: string }[]>([]);
  const [deliverySites, setDeliverySites] = useState<{ id: number; displayName: string }[]>([]);
  const [uploadSiteId, setUploadSiteId] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await fetch(`/api/orders/intake?${params}`);
      if (r.ok) setPoList(await r.json());
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    fetch("/api/business-partners").then((r) => r.json()).then((d) => setPartners(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!uploadCustomer) { setDeliverySites([]); setUploadSiteId(""); return; }
    fetch(`/api/pricing/delivery-sites?partnerId=${uploadCustomer}`)
      .then((r) => r.json()).then((d) => setDeliverySites(Array.isArray(d) ? d : [])).catch(() => setDeliverySites([]));
  }, [uploadCustomer]);

  const openDrawer = useCallback(async (orderId: number) => {
    setDrawerError("");
    setDrawerLoading(true);
    setEditLines({});
    setAdjReason("");
    try {
      const r = await fetch(`/api/orders/${orderId}/intake-detail`);
      if (r.ok) {
        const data: PODetail = await r.json();
        setSelected(data);
        setAdjReason(data.adjustment_reason ?? "");
      }
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const pending = poList.filter((p) => p.status === "pending").length;
    const readyToConfirm = poList.filter(
      (p) => p.status === "pending" && p.price_check_status === "match" && p.adjustment_eggs === 0,
    ).length;
    const needAdj = poList.filter((p) => p.status === "pending" && p.adjustment_eggs !== 0).length;
    const todayAccepted = poList
      .filter((p) => p.order_date === new Date().toISOString().slice(0, 10))
      .reduce((s, p) => s + Number(p.total_accepted_qty_eggs), 0);
    return { pending, readyToConfirm, needAdj, todayAccepted };
  }, [poList]);

  // ── filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return poList.filter((p) => {
      if (!q) return true;
      return (
        (p.order_number ?? "").toLowerCase().includes(q) ||
        (p.po_number ?? "").toLowerCase().includes(q) ||
        (p.partner_name ?? "").toLowerCase().includes(q) ||
        (p.delivery_site_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [poList, search]);

  // ── intake line update ────────────────────────────────────────────────────

  const saveAcceptedQty = async (lineId: number, val: string) => {
    if (!selected) return;
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty < 0) return;
    setSavingLines((prev) => ({ ...prev, [lineId]: true }));
    try {
      await fetch(`/api/orders/${selected.id}/intake-line/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedQty: qty }),
      });
      // Refresh drawer and list
      await openDrawer(selected.id);
      fetchList();
    } finally {
      setSavingLines((prev) => ({ ...prev, [lineId]: false }));
    }
  };

  // ── adjustment approval ───────────────────────────────────────────────────

  const approveAdjustment = async () => {
    if (!selected) return;
    setApprovingAdj(true);
    setDrawerError("");
    try {
      const r = await fetch(`/api/orders/${selected.id}/intake`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentReason: adjReason,
          adjustmentApproved: true,
          adjustmentApprovedBy: "Supervisor",
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        setDrawerError(e.message ?? "Failed");
        return;
      }
      await openDrawer(selected.id);
      fetchList();
    } finally {
      setApprovingAdj(false);
    }
  };

  // ── confirm order ─────────────────────────────────────────────────────────

  const confirmOrder = async () => {
    if (!selected) return;
    setConfirming(true);
    setDrawerError("");
    try {
      const r = await fetch(`/api/orders/${selected.id}/confirm`, { method: "POST" });
      if (!r.ok) {
        const e = await r.json();
        setDrawerError(e.message ?? "Failed to confirm");
        return;
      }
      await fetchList();
      await openDrawer(selected.id);
    } finally {
      setConfirming(false);
    }
  };

  // ── file upload ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCustomer || !uploadSiteId) return;
    setUploading(true);
    try {
      const selectedPartner = partners.find((p) => p.id === Number(uploadCustomer));
      const isMakro = selectedPartner?.code?.toLowerCase().includes("c001") ||
        selectedPartner?.nickname?.toLowerCase().includes("makro");
      const format = isMakro ? "makro" : "bigc";
      const parsedPOs = await parseFile(format, file);

      // Batch lookup all customer item codes in one request
      const allCodes = Array.from(new Set(
        parsedPOs.flatMap((po) => po.lines.map((l) => l.customerItemCode)).filter(Boolean),
      ));

      let lookupMap: Record<string, any> = {};
      if (allCodes.length > 0) {
        const r = await fetch("/api/items/lookup-customer-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId: Number(uploadCustomer), codes: allCodes }),
        });
        if (r.ok) lookupMap = await r.json();
      }

      const selectedSite = deliverySites.find((s) => s.id === Number(uploadSiteId));

      const reviewData: UploadReviewData = {
        partnerId: Number(uploadCustomer),
        partnerName: selectedPartner?.nickname ?? "",
        deliverySiteId: Number(uploadSiteId),
        deliverySiteName: selectedSite?.displayName ?? "",
        pos: parsedPOs.map((po) => ({
          poNumber: po.poNumber,
          orderDate: po.orderDate,
          deliveryDate: po.deliveryDate,
          lines: po.lines.map((l) => {
            const match = lookupMap[l.customerItemCode] ?? null;
            return {
              customerItemCode: l.customerItemCode,
              itemNameFromFile: l.itemName,
              poQty: l.poQty,
              poPrice: l.poPrice,
              itemId: match ? Number(match.id) : null,
              internalSku: match?.sku ?? null,
              internalName: match?.name ?? null,
              primarySize: match?.primary_size ?? null,
              secondarySize: match?.secondary_size ?? null,
              eggsPerPack: match?.eggs_per_pack ? Number(match.eggs_per_pack) : null,
              sellingUnit: match?.selling_unit ?? null,
              mapped: match !== null,
            };
          }),
        })),
      };

      sessionStorage.setItem(UPLOAD_REVIEW_KEY, JSON.stringify(reviewData));
      setShowUpload(false);
      setUploadCustomer("");
      setUploadSiteId("");
      if (fileRef.current) fileRef.current.value = "";
      navigate("/orders/po-intake/upload-review");
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // ── drawer computed values ────────────────────────────────────────────────

  const drawerStats = useMemo(() => {
    if (!selected) return null;
    const totalPo = selected.lines.reduce((s, l) => s + Number(l.po_qty) * (l.eggs_per_pack ?? 1), 0);
    const totalAcc = selected.lines.reduce((s, l) => {
      const aq = l.id in editLines ? parseInt(editLines[l.id], 10) || Number(l.accepted_qty) : Number(l.accepted_qty);
      return s + aq * (l.eggs_per_pack ?? 1);
    }, 0);
    const adj = totalAcc - totalPo;
    const hasAdj = adj !== 0;
    const priceOk = selected.lines.every((l) => l.price_status === "match");
    const adjOk = !hasAdj || selected.adjustment_approved;
    const allAccepted = selected.lines.every((l) => l.accepted_qty_raw !== null || l.po_qty > 0);
    const canConfirm = priceOk && adjOk && allAccepted && selected.status !== "confirmed";
    return { totalPo, totalAcc, adj, hasAdj, priceOk, adjOk, allAccepted, canConfirm };
  }, [selected, editLines]);

  // ── render ────────────────────────────────────────────────────────────────

  const hasDrawer = selected !== null;

  return (
    <div className="flex h-full min-h-0">
      {/* ── Main content ── */}
      <div className={`flex flex-col min-h-0 overflow-y-auto transition-all duration-200 ${hasDrawer ? "flex-1" : "w-full"}`}>
        <div className="space-y-5 p-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">PO Intake</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                รับ PO → ตรวจราคา → ใส่ Accepted Qty → Adjustment → Confirm Order
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
                <Upload className="w-4 h-4 mr-1.5" />
                Upload PO
              </Button>
              <Button size="sm" onClick={() => navigate("/orders/new")}
                className="bg-[#1a1a1a] text-white hover:bg-[#333]">
                <Plus className="w-4 h-4 mr-1.5" />
                Create Manual PO
              </Button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "PO รอตรวจ", value: kpis.pending, sub: "จากทั้งหมด", icon: "🔵" },
              { label: "PO พร้อมยืนยัน", value: kpis.readyToConfirm, sub: "ราคาตรง / ไม่มีการปรับ", icon: "🟢" },
              { label: "ต้องปรับยอด", value: kpis.needAdj, sub: "มี Adjustment 1", icon: "✂️" },
              { label: "Accepted Qty วันนี้", value: fmtNum(kpis.todayAccepted), sub: "ฟอง", icon: "🥚" },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-[#e5e7eb] px-4 py-4 shadow-sm">
                <div className="text-2xl mb-1">{k.icon}</div>
                <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                <div className="text-xs font-medium text-foreground mt-0.5">{k.label}</div>
                <div className="text-xs text-muted-foreground">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา PO, ลูกค้า, สาขา…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="pending">Open</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchList} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} รายการ</span>
          </div>

          {/* PO Register table */}
          <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-8"></th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">PO No.</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer / Delivery Site</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">วันที่สั่ง</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">วันที่ส่ง</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-12">Lines</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">PO Qty (ฟอง)</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">Accepted Qty</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-28">Adjustment</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">Price Check</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {loading && (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        กำลังโหลด…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                        ไม่พบ PO
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.map((po) => {
                    const isSelected = selected?.id === po.id;
                    const adj = Number(po.adjustment_eggs);
                    const nextAction = () => {
                      if (po.status === "confirmed") return null;
                      if (po.price_check_status === "missing" || po.price_check_status === "mismatch") {
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); openDrawer(po.id); }}
                            className="text-xs px-2.5 py-1 rounded-md font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                          >
                            Check Price
                          </button>
                        );
                      }
                      if (adj !== 0 && !po.adjustment_approved) {
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); openDrawer(po.id); }}
                            className="text-xs px-2.5 py-1 rounded-md font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                          >
                            Request Approval
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); openDrawer(po.id); }}
                          className="text-xs px-2.5 py-1 rounded-md font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors"
                        >
                          Confirm Order
                        </button>
                      );
                    };

                    return (
                      <tr
                        key={po.id}
                        onClick={() => openDrawer(po.id)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-[#fafbfc]"}`}
                      >
                        <td className="px-3 py-2.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${po.status === "pending" ? "bg-red-500" : "bg-green-500"}`} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-sm">{po.order_number}</div>
                          {po.po_number && (
                            <div className="text-xs text-muted-foreground font-mono">{po.po_number}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{po.partner_name}</div>
                          <div className="text-xs text-muted-foreground">{po.delivery_site_name}{po.province ? ` · ${po.province}` : ""}</div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground tabular-nums">{fmtDate(po.order_date)}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground tabular-nums">{fmtDate(po.delivery_date)}</td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums">{po.line_count}</td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums">{fmtNum(po.total_po_qty_eggs)}</td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums">{fmtNum(po.total_accepted_qty_eggs)}</td>
                        <td className={`px-3 py-2.5 text-right text-sm font-medium tabular-nums ${adj < 0 ? "text-red-600" : adj > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {adj === 0 ? "—" : adj > 0 ? `+${fmtNum(adj)}` : fmtNum(adj)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <PriceStatusBadge status={po.price_check_status} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {po.status === "confirmed"
                            ? <StatusBadge status="confirmed" />
                            : nextAction()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right drawer ── */}
      {hasDrawer && (
        <div className="w-[520px] min-w-[480px] border-l border-[#e5e7eb] bg-white overflow-y-auto flex flex-col">
          {drawerLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : selected ? (
            <>
              {/* Drawer header */}
              <div className="px-4 pt-4 pb-3 border-b border-[#e5e7eb]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base">{selected.order_number}</span>
                      <StatusBadge status={selected.status} />
                    </div>
                    {selected.po_number && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        Customer PO: {selected.po_number}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      วันที่สั่ง {fmtDate(selected.order_date)} · ส่ง {fmtDate(selected.delivery_date)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 3 KPI boxes */}
                {drawerStats && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: "PO Qty (ฟอง)", value: fmtNum(drawerStats.totalPo) },
                      { label: "Accepted Qty (ฟอง)", value: fmtNum(drawerStats.totalAcc) },
                      {
                        label: "Adjustment (+/-)",
                        value: drawerStats.adj === 0 ? "0" : drawerStats.adj > 0 ? `+${fmtNum(drawerStats.adj)}` : fmtNum(drawerStats.adj),
                        red: drawerStats.adj < 0,
                        green: drawerStats.adj > 0,
                      },
                    ].map((k) => (
                      <div key={k.label} className="bg-[#f9fafb] rounded-lg px-3 py-2 border border-[#e5e7eb]">
                        <div className={`text-base font-bold tabular-nums ${k.red ? "text-red-600" : k.green ? "text-green-600" : ""}`}>
                          {k.value}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error */}
              {drawerError && (
                <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {drawerError}
                </div>
              )}

              {/* Line review */}
              <div className="px-4 pt-4">
                <div className="text-sm font-semibold mb-2">ราคาละเอียดสินค้า (Line Review)</div>
                <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">สินค้า</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground w-14">PO Qty</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground w-20">Accepted</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground w-14">Adj</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground w-16">PO ฿</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground w-16">Active ฿</th>
                        <th className="px-2 py-2 text-center font-medium text-muted-foreground w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {selected.lines.map((line) => {
                        const editVal = editLines[line.id] ?? String(line.accepted_qty);
                        const editedQty = parseInt(editVal, 10);
                        const adj = isNaN(editedQty) ? 0 : editedQty - Number(line.po_qty);
                        const isSaving = savingLines[line.id];

                        return (
                          <tr key={line.id} className="hover:bg-[#fafbfc]">
                            <td className="px-2 py-2">
                              <div className="font-medium leading-snug truncate max-w-[140px]" title={line.name}>
                                {line.name}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {line.sku && <span className="font-mono text-muted-foreground">{line.sku}</span>}
                                <SizeTag primary={line.primary_size} secondary={line.secondary_size} />
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{fmtNum(line.po_qty)}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  min={0}
                                  value={editVal}
                                  disabled={selected.status === "confirmed"}
                                  onChange={(e) => setEditLines((prev) => ({ ...prev, [line.id]: e.target.value }))}
                                  onBlur={() => {
                                    if (editVal !== String(line.accepted_qty)) {
                                      saveAcceptedQty(line.id, editVal);
                                    }
                                  }}
                                  className="w-16 text-right text-xs border border-[#d6d8dc] rounded px-1.5 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:bg-muted"
                                />
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                              </div>
                            </td>
                            <td className={`px-2 py-2 text-right tabular-nums font-medium ${adj < 0 ? "text-red-600" : adj > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                              {adj === 0 ? "—" : adj > 0 ? `+${adj}` : adj}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{fmtNum(line.po_price, 2)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {line.active_price ? fmtNum(line.active_price, 2) : <span className="text-amber-500">—</span>}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <PriceStatusBadge status={line.price_status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Adjustment approval panel */}
              {drawerStats?.hasAdj && selected.status !== "confirmed" && (
                <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Supervisor Approval Required
                  </div>
                  <p className="text-xs text-amber-700 mb-2">
                    พบการปรับยอด ({drawerStats.adj > 0 ? "+" : ""}{fmtNum(drawerStats.adj)} ฟอง)
                  </p>
                  <div className="mb-2">
                    <label className="text-xs font-medium text-amber-800 mb-1 block">
                      หมายเหตุการปรับยอด
                    </label>
                    <Textarea
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      disabled={selected.adjustment_approved}
                      placeholder="กรุณาระบุเหตุผลการปรับยอด…"
                      rows={2}
                      className="text-xs resize-none bg-white"
                    />
                  </div>
                  {selected.adjustment_approved ? (
                    <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Approved by {selected.adjustment_approved_by}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={approveAdjustment}
                      disabled={approvingAdj || !adjReason.trim()}
                      className="w-full bg-[#cc3333] hover:bg-[#aa2222] text-white text-xs"
                    >
                      {approvingAdj ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Request Approval
                    </Button>
                  )}
                </div>
              )}

              {/* Workflow checklist */}
              <div className="mx-4 mt-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                <div className="text-xs font-semibold mb-2">Workflow & Approval</div>
                {drawerStats && [
                  { label: "SKU mapped", ok: selected.lines.every((l) => l.item_id) },
                  { label: "Price checked", ok: drawerStats.priceOk },
                  { label: "Accepted Qty entered", ok: drawerStats.allAccepted },
                  { label: "Adjustment approved", ok: drawerStats.adjOk },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-2 py-1">
                    {step.ok
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className={`text-xs ${step.ok ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Confirm button */}
              <div className="p-4 mt-auto border-t border-[#e5e7eb]">
                {selected.status === "confirmed" ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-700 font-medium py-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Order Confirmed
                  </div>
                ) : (
                  <Button
                    className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white"
                    disabled={!drawerStats?.canConfirm || confirming}
                    onClick={confirmOrder}
                  >
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Confirm Order
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Upload PO modal ── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#e5e7eb]">
              <div className="font-semibold text-base">Upload PO</div>
              <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Customer *</label>
                <Select value={uploadCustomer} onValueChange={setUploadCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกลูกค้า…" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.filter((p) => p.code !== "C005").map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.nickname}
                        <span className="ml-2 text-xs text-muted-foreground">({p.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Delivery Site *</label>
                {!uploadCustomer ? (
                  <p className="text-xs text-muted-foreground">เลือก customer ก่อน</p>
                ) : deliverySites.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่พบสาขา</p>
                ) : (
                  <Select value={uploadSiteId} onValueChange={setUploadSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขา…" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverySites.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">ไฟล์ Excel *</label>
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${uploadCustomer && uploadSiteId ? "border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600" : "border-[#d6d8dc] text-muted-foreground cursor-not-allowed"}`}>
                  <FileUp className="w-4 h-4" />
                  <span className="text-sm">เลือกไฟล์ .xlsx</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={!uploadCustomer || !uploadSiteId || uploading}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              <p className="text-xs text-muted-foreground">
                รองรับรูปแบบ Makro และ BigC · ระบบจะจับคู่ SKU อัตโนมัติจาก customer item code
              </p>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUpload(false)}>ยกเลิก</Button>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังประมวลผล…
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
