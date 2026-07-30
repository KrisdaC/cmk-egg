import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Search,
  RefreshCw,
  Plus,
  ChevronRight,
  Settings2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  PricingStepNav,
  type Partner,
  type PricingWeek,
  type SiteGroup,
} from "./_shared";
import { SiteGroupManagerDialog } from "./SiteGroupManager";

// =============================================
// TYPES
// =============================================

interface PartnerItem {
  id: number;
  sku: string | null;
  name: string;
  primary_size: string | null;
  secondary_size: string | null;
  min_primary: number | null;
  eggs_per_pack: number | null;
  selling_unit: string | null;
  item_number: string | null;
  customer_item_number: string | null;
  barcode_label: string | null;
}

type SortKey = "name" | "sku" | "item_number" | "barcode";

interface LineState {
  checked: boolean;
  referencePrice: string;
  basePrice: string;
  exceptions: Record<number, string>; // siteGroupId → price string
}

interface CostAnalysisData {
  fixedCostPerEgg: number;
  distyCostPct: number;
  sizes: { primarySize: string; eggRawCostPerEgg: number }[];
}

const MAKRO_PARTNER_ID = 4;

// =============================================
// SIZE PILL
// =============================================

const SIZE_PILL: Record<string, string> = {
  "0": "bg-[#FCEBEB] text-[#791F1F]",
  "1": "bg-[#FAEEDA] text-[#633806]",
  "2": "bg-[#EAF3DE] text-[#27500A]",
  "3": "bg-[#E1F5EE] text-[#085041]",
  "4": "bg-[#E6F1FB] text-[#0C447C]",
  "5": "bg-[#EEEDFE] text-[#3C3489]",
};

function SizePill({ item }: { item: PartnerItem }) {
  if (!item.primary_size || ["S", "M", "L", "mixed"].includes(item.primary_size)) return null;
  const cls = SIZE_PILL[item.primary_size] ?? "bg-[#F1EFE8] text-[#888780]";
  const label = item.secondary_size
    ? `${item.primary_size}-${item.secondary_size}`
    : `เบอร์ ${item.primary_size}`;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// =============================================
// SORT HEADER
// =============================================

function SortTh({
  label,
  sortK,
  current,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortK: SortKey;
  current: SortKey | null;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortK;
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(sortK)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="w-3 h-3 text-foreground" />
          ) : (
            <ChevronDown className="w-3 h-3 text-foreground" />
          )
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// =============================================
// PAGE
// =============================================

export default function NewProposalPage() {
  const [, navigate] = useLocation();

  const [weekId, setWeekId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [notes, setNotes] = useState("");

  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerItems, setPartnerItems] = useState<PartnerItem[]>([]);
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // lineId → state
  const [lines, setLines] = useState<Record<number, LineState>>({});

  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refPriceLoading, setRefPriceLoading] = useState(false);
  const [siteGroupManagerOpen, setSiteGroupManagerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── fetch helpers ──────────────────────────────────────────────────────────

  const fetchWeeks = useCallback(async () => {
    const r = await fetch("/api/pricing/weeks");
    if (r.ok) setWeeks(await r.json());
  }, []);

  const fetchPartners = useCallback(async () => {
    const r = await fetch("/api/business-partners");
    if (r.ok) setPartners(await r.json());
  }, []);

  const fetchSiteGroups = useCallback(async () => {
    const r = await fetch("/api/pricing/site-groups");
    if (r.ok) setSiteGroups(await r.json());
  }, []);

  useEffect(() => {
    fetchWeeks();
    fetchPartners();
    fetchSiteGroups();
  }, [fetchWeeks, fetchPartners, fetchSiteGroups]);

  const loadPartnerItems = useCallback(async () => {
    if (!partnerId) return;
    setLoadingItems(true);
    try {
      const r = await fetch(`/api/pricing/partner-items?partnerId=${partnerId}`);
      if (r.ok) {
        const data: PartnerItem[] = await r.json();
        setPartnerItems(data);
        const initial: Record<number, LineState> = {};
        data.forEach((i) => {
          initial[i.id] = { checked: true, referencePrice: "", basePrice: "", exceptions: {} };
        });
        setLines(initial);
      }
    } finally {
      setLoadingItems(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (partnerId) {
      setPartnerItems([]);
      setLines({});
      loadPartnerItems();
    } else {
      setPartnerItems([]);
      setLines({});
    }
  }, [partnerId, loadPartnerItems]);

  // ── reference price auto-computation ──────────────────────────────────────

  const computeRefPrices = useCallback(async (
    wId: string,
    pId: string,
    currentItems: PartnerItem[],
  ) => {
    if (!wId || !pId || currentItems.length === 0) return;
    setRefPriceLoading(true);
    try {
      const [makroRes, customerRes] = await Promise.all([
        fetch(`/api/pricing/weeks/${wId}/cost-analysis?partnerId=${MAKRO_PARTNER_ID}`),
        fetch(`/api/pricing/weeks/${wId}/cost-analysis?partnerId=${pId}`),
      ]);
      if (!makroRes.ok || !customerRes.ok) return;
      const [makroData, customerData]: [CostAnalysisData, CostAnalysisData] = await Promise.all([
        makroRes.json(),
        customerRes.json(),
      ]);

      const makroRaw: Record<string, number> = {};
      for (const s of makroData.sizes) makroRaw[s.primarySize] = s.eggRawCostPerEgg;

      const customerFixed = customerData.fixedCostPerEgg;
      const customerDisty = customerData.distyCostPct;

      setLines((prev) => {
        const next = { ...prev };
        for (const item of currentItems) {
          if (!item.eggs_per_pack || !item.primary_size) continue;
          const line = next[item.id];
          if (!line?.checked) continue;

          let baseEgg: number;
          if (item.secondary_size && item.min_primary != null) {
            const primaryRatio = item.min_primary / 100;
            baseEgg =
              (makroRaw[item.primary_size] ?? 0) * primaryRatio +
              (makroRaw[item.secondary_size] ?? 0) * (1 - primaryRatio);
          } else {
            baseEgg = makroRaw[item.primary_size] ?? 0;
          }
          if (baseEgg <= 0) continue;

          const refPricePerEgg = (baseEgg + customerFixed) / (1 - customerDisty);
          const refPrice = refPricePerEgg * item.eggs_per_pack;
          next[item.id] = { ...line, referencePrice: refPrice.toFixed(2) };
        }
        return next;
      });
    } catch {
      // silently fail
    } finally {
      setRefPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (weekId && partnerId && partnerItems.length > 0) {
      computeRefPrices(weekId, partnerId, partnerItems);
    }
  }, [weekId, partnerId, partnerItems, computeRefPrices]);

  // ── derived ───────────────────────────────────────────────────────────────

  const approvedWeeks = weeks.filter(
    (w) => w.status === "approved" || w.status === "active" || w.status === "draft",
  );

  const partnerSiteGroups = useMemo(
    () => siteGroups.filter((g) => partnerId && g.partner?.id === Number(partnerId)),
    [siteGroups, partnerId],
  );

  const sortVal = (item: PartnerItem, key: SortKey): string => {
    if (key === "name") return item.name.toLowerCase();
    if (key === "sku") return (item.sku ?? "").toLowerCase();
    if (key === "item_number") return (item.customer_item_number ?? item.item_number ?? "").toLowerCase();
    if (key === "barcode") return (item.barcode_label ?? "").toLowerCase();
    return "";
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    let result = partnerItems.filter(
      (i) => !q || i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q)
        || (i.customer_item_number ?? "").toLowerCase().includes(q)
        || (i.barcode_label ?? "").toLowerCase().includes(q),
    );
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const va = sortVal(a, sortKey);
        const vb = sortVal(b, sortKey);
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [partnerItems, search, sortKey, sortDir]);

  const checkedCount = Object.values(lines).filter((l) => l.checked).length;

  // ── line helpers ──────────────────────────────────────────────────────────

  const toggleItem = (id: number) => {
    setLines((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { checked: false, referencePrice: "", basePrice: "", exceptions: {} }),
        checked: !prev[id]?.checked,
      },
    }));
  };

  const setBasePrice = (id: number, value: string) => {
    setLines((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { checked: true, referencePrice: "", basePrice: "", exceptions: {} }), basePrice: value },
    }));
  };

  const setException = (itemId: number, siteGroupId: number, value: string) => {
    setLines((prev) => {
      const line = prev[itemId] ?? { checked: true, referencePrice: "", basePrice: "", exceptions: {} };
      return {
        ...prev,
        [itemId]: {
          ...line,
          exceptions: { ...line.exceptions, [siteGroupId]: value },
        },
      };
    });
  };

  const toggleAll = () => {
    const allChecked = filteredItems.every((i) => lines[i.id]?.checked);
    setLines((prev) => {
      const next = { ...prev };
      filteredItems.forEach((i) => {
        next[i.id] = {
          ...(next[i.id] ?? { checked: false, referencePrice: "", basePrice: "", exceptions: {} }),
          checked: !allChecked,
        };
      });
      return next;
    });
  };

  // ── submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!weekId || !partnerId) {
      setError("กรุณาเลือก Pricing Week และ Partner");
      return;
    }

    const selectedLines = partnerItems
      .filter((i) => lines[i.id]?.checked)
      .map((i) => {
        const l = lines[i.id];
        const exceptions = Object.entries(l.exceptions ?? {})
          .filter(([, v]) => v !== "")
          .map(([sgId, v]) => ({ siteGroupId: Number(sgId), price: parseFloat(v) }));
        return {
          itemId: i.id,
          referencePrice: l.referencePrice ? parseFloat(l.referencePrice) : undefined,
          basePrice: l.basePrice ? parseFloat(l.basePrice) : undefined,
          exceptions,
        };
      });

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pricing/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingWeekId: Number(weekId),
          partnerId: Number(partnerId),
          notes: notes || undefined,
          lines: selectedLines,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.message ?? "Failed to create proposal");
        return;
      }

      navigate("/orders/pricing/proposals");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-24">
      <div>
        <PricingStepNav />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/orders/pricing/proposals")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Proposals
        </button>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">New Proposal</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">New Price Proposal</h1>
        <p className="text-muted-foreground text-sm">
          เลือก week และ customer จากนั้นกรอกราคาฐาน และราคาพิเศษตามกลุ่มสาขา
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Header fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">รายละเอียด Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">
                Pricing Week <span className="text-destructive">*</span>
              </Label>
              {approvedWeeks.length === 0 ? (
                <div className="flex items-center gap-1.5 text-sm text-yellow-700">
                  <AlertTriangle className="w-4 h-4" />
                  ไม่มี week ที่พร้อมใช้งาน
                </div>
              ) : (
                <Select value={weekId} onValueChange={setWeekId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก week…" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedWeeks.map((w) => (
                      <SelectItem key={w.id} value={w.id.toString()}>
                        {w.weekCode}
                        <span className="ml-2 text-xs text-muted-foreground">({w.status})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                Partner <span className="text-destructive">*</span>
              </Label>
              <Select
                value={partnerId}
                onValueChange={(v) => { setPartnerId(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือก customer…" />
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">หมายเหตุ</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="หมายเหตุ (ถ้ามี)…"
              rows={2}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* SKU Lines */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">
                ราคาต่อ SKU
                {checkedCount > 0 && (
                  <Badge variant="outline" className="ml-2 tabular-nums">
                    {checkedCount} รายการ
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                กรอกราคาฐาน (ทุกสาขา) และราคาพิเศษสำหรับกลุ่มสาขาที่ต้องการ
              </p>
            </div>
            {partnerId && (
              <Button size="sm" variant="outline" onClick={loadPartnerItems} disabled={loadingItems}>
                {loadingItems
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                โหลดใหม่
              </Button>
            )}
          </div>
          {partnerItems.length > 0 && (
            <div className="mt-3 relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา SKU หรือชื่อ…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!partnerId ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              เลือก partner เพื่อโหลดรายการ SKU
            </div>
          ) : loadingItems ? (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังโหลด SKU…
            </div>
          ) : partnerItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ไม่พบ order ของ partner นี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-10 px-3 py-2.5 text-left sticky left-0 bg-muted/40 z-10">
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && filteredItems.every((i) => lines[i.id]?.checked)}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <SortTh label="ชื่อสินค้า" sortK="name" current={sortKey} dir={sortDir} onSort={toggleSort} className="min-w-[180px]" />
                    <SortTh label="SKU" sortK="sku" current={sortKey} dir={sortDir} onSort={toggleSort} className="min-w-[90px]" />
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">
                      ขนาด
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-14">
                      ฟอง
                    </th>
                    {/* External columns */}
                    <th className="px-0 border-l border-muted" colSpan={2}>
                      <div className="px-3 pt-1.5 pb-0 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest">External</div>
                      <div className="flex">
                        <SortTh label="Item #" sortK="item_number" current={sortKey} dir={sortDir} onSort={toggleSort} className="min-w-[90px] border-0" />
                        <SortTh label="Barcode" sortK="barcode" current={sortKey} dir={sortDir} onSort={toggleSort} className="min-w-[110px] border-0" />
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">
                      <span className="flex items-center justify-end gap-1">
                        {refPriceLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        ราคาอ้างอิง ฿
                      </span>
                    </th>
                    {/* Base price — always customer scope */}
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-foreground uppercase tracking-wide w-32 bg-amber-50 border-l border-amber-200">
                      ราคาฐาน (ทุกสาขา) ฿
                    </th>
                    {/* Exception columns per site group */}
                    {partnerSiteGroups.map((g) => (
                      <th
                        key={g.id}
                        className="px-3 py-2.5 text-right text-xs font-medium text-blue-700 uppercase tracking-wide w-32 bg-blue-50 border-l border-blue-100"
                      >
                        {g.name} ฿
                      </th>
                    ))}
                    {/* Add column button */}
                    {partnerId && (
                      <th className="px-2 py-2.5 bg-muted/20 border-l border-dashed border-muted-foreground/20">
                        <button
                          type="button"
                          onClick={() => setSiteGroupManagerOpen(true)}
                          className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground whitespace-nowrap transition-colors"
                          title="จัดการกลุ่มสาขา"
                        >
                          <Settings2 className="w-3 h-3" />
                          {partnerSiteGroups.length === 0 ? "เพิ่มกลุ่มสาขา" : "จัดการ"}
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => {
                    const line = lines[item.id] ?? { checked: false, referencePrice: "", basePrice: "", exceptions: {} };
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          line.checked ? "hover:bg-muted/20" : "bg-muted/10 opacity-50"
                        }`}
                      >
                        <td className="px-3 py-2 sticky left-0 bg-white z-10">
                          <input
                            type="checkbox"
                            checked={line.checked}
                            onChange={() => toggleItem(item.id)}
                            className="rounded"
                          />
                        </td>
                        {/* Name */}
                        <td className="px-3 py-2">
                          <div className="font-medium leading-snug text-sm">{item.name}</div>
                        </td>
                        {/* SKU Code */}
                        <td className="px-3 py-2">
                          <div className="text-xs text-muted-foreground font-mono">{item.sku ?? "—"}</div>
                        </td>
                        {/* Size */}
                        <td className="px-3 py-2">
                          <SizePill item={item} />
                        </td>
                        {/* Eggs */}
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground text-xs">
                          {item.eggs_per_pack ?? "—"}
                        </td>
                        {/* External: Item # */}
                        <td className="px-3 py-2 border-l border-muted">
                          <div className="text-xs font-mono text-muted-foreground">
                            {item.customer_item_number ?? item.item_number ?? <span className="opacity-30">—</span>}
                          </div>
                        </td>
                        {/* External: Barcode */}
                        <td className="px-3 py-2">
                          <div className="text-xs font-mono text-muted-foreground">
                            {item.barcode_label ?? <span className="opacity-30">—</span>}
                          </div>
                        </td>
                        {/* Reference price (read-only) */}
                        <td className="px-3 py-2 text-right">
                          {line.referencePrice ? (
                            <div>
                              <div className="tabular-nums text-sm text-muted-foreground">{parseFloat(line.referencePrice).toFixed(2)}</div>
                              {item.eggs_per_pack && (
                                <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                                  {(parseFloat(line.referencePrice) / item.eggs_per_pack).toFixed(2)}/ฟอง
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        {/* Base price input */}
                        <td className="px-3 py-2 bg-amber-50/50 border-l border-amber-100">
                          <Input
                            type="number"
                            step="0.01"
                            disabled={!line.checked}
                            value={line.basePrice}
                            onChange={(e) => setBasePrice(item.id, e.target.value)}
                            placeholder="0.00"
                            className="h-7 text-sm text-right tabular-nums w-full font-medium"
                          />
                          {line.basePrice && item.eggs_per_pack ? (
                            <div className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">
                              {(parseFloat(line.basePrice) / item.eggs_per_pack).toFixed(2)}/ฟอง
                            </div>
                          ) : null}
                        </td>
                        {/* Exception inputs per site group */}
                        {partnerSiteGroups.map((g) => (
                          <td key={g.id} className="px-3 py-2 bg-blue-50/30 border-l border-blue-50">
                            <Input
                              type="number"
                              step="0.01"
                              disabled={!line.checked}
                              value={line.exceptions[g.id] ?? ""}
                              onChange={(e) => setException(item.id, g.id, e.target.value)}
                              placeholder={line.basePrice || "0.00"}
                              className="h-7 text-sm text-right tabular-nums w-full"
                            />
                            {(line.exceptions[g.id] ?? "") && item.eggs_per_pack ? (
                              <div className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">
                                {(parseFloat(line.exceptions[g.id]) / item.eggs_per_pack).toFixed(2)}/ฟอง
                              </div>
                            ) : null}
                          </td>
                        ))}
                        {partnerId && <td className="bg-muted/10 border-l border-dashed border-muted-foreground/20" />}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SiteGroupManagerDialog
        open={siteGroupManagerOpen}
        siteGroups={partnerSiteGroups}
        partners={partners}
        defaultPartnerId={partnerId ? Number(partnerId) : undefined}
        onClose={() => setSiteGroupManagerOpen(false)}
        onRefresh={async () => {
          await fetchSiteGroups();
          setSiteGroupManagerOpen(false);
        }}
      />

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#d6d8dc] px-6 py-3 flex items-center justify-between gap-4 z-10">
        <div className="text-sm text-muted-foreground">
          {checkedCount > 0 ? (
            <span>
              <span className="font-medium text-foreground">{checkedCount}</span> SKU เลือกไว้
            </span>
          ) : (
            "ยังไม่ได้เลือก SKU"
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/orders/pricing/proposals")}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !weekId || !partnerId}
            className="min-w-[130px]"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            สร้าง Proposal
          </Button>
        </div>
      </div>
    </div>
  );
}
