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
  MapPin,
  Search,
  RefreshCw,
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  PricingStepNav,
  type Partner,
  type PricingWeek,
  type DeliverySite,
  type SiteGroup,
} from "./_shared";

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
}

interface LineState {
  checked: boolean;
  referencePrice: string;
  proposalPrice: string;
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
// PAGE
// =============================================

export default function NewProposalPage() {
  const [, navigate] = useLocation();

  // Form state
  const [weekId, setWeekId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [scopeType, setScopeType] = useState<"customer" | "site_group" | "delivery_site">("customer");
  const [siteGroupId, setSiteGroupId] = useState("");
  const [deliverySiteId, setDeliverySiteId] = useState("");
  const [notes, setNotes] = useState("");

  // Remote data
  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerItems, setPartnerItems] = useState<PartnerItem[]>([]);
  const [deliverySites, setDeliverySites] = useState<DeliverySite[]>([]);
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // SKU line states: itemId → { checked, referencePrice, proposalPrice }
  const [lines, setLines] = useState<Record<number, LineState>>({});

  // UI state
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refPriceLoading, setRefPriceLoading] = useState(false);

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

  useEffect(() => {
    if (!partnerId) {
      setDeliverySites([]);
      setPartnerItems([]);
      setLines({});
      return;
    }
    fetch(`/api/pricing/delivery-sites?partnerId=${partnerId}`)
      .then((r) => r.json())
      .then((d) => setDeliverySites(Array.isArray(d) ? d : []))
      .catch(() => setDeliverySites([]));
  }, [partnerId]);

  const loadPartnerItems = useCallback(async () => {
    if (!partnerId) return;
    setLoadingItems(true);
    try {
      const r = await fetch(`/api/pricing/partner-items?partnerId=${partnerId}`);
      if (r.ok) {
        const data: PartnerItem[] = await r.json();
        setPartnerItems(data);
        // Pre-check all items and clear prices
        const initial: Record<number, LineState> = {};
        data.forEach((i) => { initial[i.id] = { checked: true, referencePrice: "", proposalPrice: "" }; });
        setLines(initial);
      }
    } finally {
      setLoadingItems(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (partnerId) loadPartnerItems();
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
      for (const s of makroData.sizes) {
        makroRaw[s.primarySize] = s.eggRawCostPerEgg;
      }

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
            const primaryRaw = makroRaw[item.primary_size] ?? 0;
            const secondaryRaw = makroRaw[item.secondary_size] ?? 0;
            baseEgg = primaryRaw * primaryRatio + secondaryRaw * (1 - primaryRatio);
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
      // silently fail — user can enter manually
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

  const approvedWeeks = weeks.filter((w) => w.status === "approved" || w.status === "active" || w.status === "draft");
  const partnerSiteGroups = siteGroups.filter((g) => partnerId && g.partner?.id === Number(partnerId));

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return partnerItems.filter(
      (i) => !q || i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q),
    );
  }, [partnerItems, search]);

  const checkedCount = Object.values(lines).filter((l) => l.checked).length;

  // ── line helpers ──────────────────────────────────────────────────────────

  const toggleItem = (id: number) => {
    setLines((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { checked: false, referencePrice: "", proposalPrice: "" }), checked: !prev[id]?.checked },
    }));
  };

  const updateLinePrice = (id: number, field: "referencePrice" | "proposalPrice", value: string) => {
    setLines((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { checked: true, referencePrice: "", proposalPrice: "" }), [field]: value },
    }));
  };

  const toggleAll = () => {
    const allChecked = filteredItems.every((i) => lines[i.id]?.checked);
    setLines((prev) => {
      const next = { ...prev };
      filteredItems.forEach((i) => {
        next[i.id] = { ...(next[i.id] ?? { checked: false, referencePrice: "", proposalPrice: "" }), checked: !allChecked };
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
    if (scopeType === "site_group" && !siteGroupId) {
      setError("กรุณาเลือก Site Group");
      return;
    }
    if (scopeType === "delivery_site" && !deliverySiteId) {
      setError("กรุณาเลือก Delivery Site");
      return;
    }

    const selectedLines = partnerItems
      .filter((i) => lines[i.id]?.checked)
      .map((i) => {
        const l = lines[i.id];
        return {
          itemId: i.id,
          referencePrice: l.referencePrice ? parseFloat(l.referencePrice) : undefined,
          proposalPrice: l.proposalPrice ? parseFloat(l.proposalPrice) : undefined,
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
          scopeType,
          siteGroupId: scopeType === "site_group" && siteGroupId ? Number(siteGroupId) : undefined,
          deliverySiteId: scopeType === "delivery_site" && deliverySiteId ? Number(deliverySiteId) : undefined,
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

      {/* Page header */}
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
          เลือก week, customer, และกรอกราคาสำหรับแต่ละ SKU
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Section 1: Header fields ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">รายละเอียด Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Week */}
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

            {/* Partner */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Partner <span className="text-destructive">*</span>
              </Label>
              <Select value={partnerId} onValueChange={(v) => { setPartnerId(v); setScopeType("customer"); setSiteGroupId(""); setDeliverySiteId(""); }}>
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

          {/* Scope */}
          <div className="space-y-2">
            <Label className="text-sm">ขอบเขตราคา</Label>
            <div className="grid grid-cols-3 gap-2 max-w-sm">
              {[
                { value: "customer", label: "ทุกสาขา" },
                { value: "site_group", label: "Site Group" },
                { value: "delivery_site", label: "สาขาเดียว" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setScopeType(opt.value as typeof scopeType); setSiteGroupId(""); setDeliverySiteId(""); }}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    scopeType === opt.value
                      ? "border-[#1a1a1a] bg-[#1a1a1a] text-white font-medium"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scopeType === "site_group" && (
              <div className="max-w-xs">
                {!partnerId ? (
                  <p className="text-xs text-muted-foreground">เลือก partner ก่อน</p>
                ) : partnerSiteGroups.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-yellow-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    ไม่มี site group สำหรับ partner นี้
                  </div>
                ) : (
                  <Select value={siteGroupId} onValueChange={setSiteGroupId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="เลือก site group…" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerSiteGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {scopeType === "delivery_site" && (
              <div className="max-w-xs">
                {!partnerId ? (
                  <p className="text-xs text-muted-foreground">เลือก partner ก่อน</p>
                ) : deliverySites.length === 0 ? (
                  <p className="text-xs text-muted-foreground">ไม่มีสาขาสำหรับ partner นี้</p>
                ) : (
                  <Select value={deliverySiteId} onValueChange={setDeliverySiteId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="เลือกสาขา…" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverySites.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {s.displayName}
                            {s.province ? ` (${s.province})` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
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

      {/* ── Section 2: SKU Lines ── */}
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
                รายการ SKU ที่เคย order — เลือกรายการที่ต้องการใส่ proposal
              </p>
            </div>
            <div className="flex items-center gap-2">
              {partnerId && (
                <Button size="sm" variant="outline" onClick={loadPartnerItems} disabled={loadingItems}>
                  {loadingItems
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                  โหลดใหม่
                </Button>
              )}
            </div>
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
              ไม่พบ order ของ partner นี้ — ไม่มีข้อมูล SKU
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-10 px-3 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && filteredItems.every((i) => lines[i.id]?.checked)}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      SKU / ชื่อสินค้า
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">
                      ขนาด
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">
                      ฟอง/unit
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-36">
                      <span className="flex items-center justify-end gap-1.5">
                        {refPriceLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        ราคาอ้างอิง ฿
                      </span>
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide w-36">
                      ราคาที่เสนอ ฿
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => {
                    const line = lines[item.id] ?? { checked: false, referencePrice: "", proposalPrice: "" };
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          line.checked ? "bg-white hover:bg-[#fafbfc]" : "bg-muted/20 opacity-50"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={line.checked}
                            onChange={() => toggleItem(item.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium leading-snug">{item.name}</div>
                          {item.sku && (
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <SizePill item={item} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {item.eggs_per_pack ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            type="number"
                            step="0.01"
                            disabled={!line.checked}
                            value={line.referencePrice}
                            onChange={(e) => updateLinePrice(item.id, "referencePrice", e.target.value)}
                            placeholder="0.00"
                            className="h-7 text-sm text-right tabular-nums w-full"
                          />
                          {line.referencePrice && item.eggs_per_pack ? (
                            <div className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">
                              {(parseFloat(line.referencePrice) / item.eggs_per_pack).toFixed(2)} ฿/ฟอง
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            type="number"
                            step="0.01"
                            disabled={!line.checked}
                            value={line.proposalPrice}
                            onChange={(e) => updateLinePrice(item.id, "proposalPrice", e.target.value)}
                            placeholder="0.00"
                            className="h-7 text-sm text-right tabular-nums w-full font-medium"
                          />
                          {line.proposalPrice && item.eggs_per_pack ? (
                            <div className="text-[10px] text-muted-foreground text-right mt-0.5 tabular-nums">
                              {(parseFloat(line.proposalPrice) / item.eggs_per_pack).toFixed(2)} ฿/ฟอง
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sticky footer ── */}
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
