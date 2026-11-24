import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  X,
  Printer,
  Download,
  Send,
} from "lucide-react";
import {
  SIZE_PILL,
  ASSUMPTION_COMPONENTS,
  PricingStepNav,
  type Partner,
  type PricingWeek,
  type SiteGroup,
} from "./_shared";
import QuotationModal from "./QuotationModal";

import { todayBkk, firstOfMonthISO as firstOfMonthBkk } from "@shared/date";
// ─── Types ────────────────────────────────────────────────────────────────────

interface EggItem {
  id: number;
  sku: string | null;
  name: string;
  primary_size: string | null;
  eggs_per_pack: number;
}

interface CostSize {
  primarySize: string;
  eggRawCostPerEgg: number;
  materialCostPerEgg: number;
}

interface CostAnalysis {
  fixedCostPerEgg: number;
  distyCostPct: number;
  sizes: CostSize[];
}

interface ActivePrice {
  itemId: number | null;
  siteGroupId: number | null;
  scopeType: string;
  price: string;
  status: string;
}

type QtyMap = Record<number, Record<string, number>>;

interface ScopeRow {
  key: string;
  siteGroupId: number | null;
  label: string;
  sublabel: string;
  quantity: number;
  currentPrice: number | null;
}

interface SimItem {
  item: EggItem;
  recPrice: number | null;
  costPrice: number | null;
  scopes: ScopeRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deltaColor(d: number): string {
  if (d > 0.001) return "text-green-600";
  if (d < -0.001) return "text-red-600";
  return "text-muted-foreground";
}

const SIZE_LABEL: Record<string, string> = {
  "0": "เบอร์ 0", "1": "เบอร์ 1", "2": "เบอร์ 2",
  "3": "เบอร์ 3", "4": "เบอร์ 4", "5": "เบอร์ 5",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const todayISO = todayBkk;
const firstOfMonthISO = () => firstOfMonthBkk();

const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fmtWeekRange(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [, em, ed] = endDate.split("-").map(Number);
  if (sm === em) return `${sd}–${ed} ${THAI_MONTHS_SHORT[sm - 1]} ${sy}`;
  return `${sd} ${THAI_MONTHS_SHORT[sm - 1]} – ${ed} ${THAI_MONTHS_SHORT[em - 1]} ${sy}`;
}

// ─── Scope assumption lookup ─────────────────────────────────────────────────

function getScopeVals(
  weekDetail: PricingWeek | null,
  partnerId: number,
  siteGroupId: number | null,
): Record<string, number> {
  const all = weekDetail?.assumptions ?? [];
  const result: Record<string, number> = {};
  for (const a of all) {
    if (a.partnerId === partnerId && a.siteGroupId == null)
      result[a.component] = parseFloat(a.value || "0");
  }
  if (siteGroupId != null) {
    for (const a of all) {
      if (a.partnerId === partnerId && a.siteGroupId === siteGroupId)
        result[a.component] = parseFloat(a.value || "0");
    }
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PriceSimulation() {
  // URL params captured once on mount via refs — stable across re-renders
  const urlWeekId = useRef((() => { const v = new URLSearchParams(window.location.search).get("weekId"); return v ? Number(v) : null; })());
  const urlPartnerId = useRef((() => { const v = new URLSearchParams(window.location.search).get("partnerId"); return v ? Number(v) : null; })());
  const urlProposalId = useRef((() => { const v = new URLSearchParams(window.location.search).get("fromProposal"); return v ? Number(v) : null; })());

  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(urlWeekId.current);
  const [weekDetail, setWeekDetail] = useState<PricingWeek | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(urlPartnerId.current);

  // Custom date range for quantity lookup (defaults to 1st of month → today)
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonthISO());
  const [dateTo, setDateTo] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis | null>(null);
  const [eggItems, setEggItems] = useState<EggItem[]>([]);
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);
  const [activePriceList, setActivePriceList] = useState<ActivePrice[]>([]);
  const [qtyMap, setQtyMap] = useState<QtyMap>({});

  const [lastPriceMap, setLastPriceMap] = useState<Record<number, number>>({});

  // ── Reference strip state (อ้างอิงจาก) ──────────────────────────────────────
  const [refPartnerId, setRefPartnerId] = useState<number | null>(null);
  const [refDateFrom, setRefDateFrom] = useState<string>(firstOfMonthISO());
  const [refDateTo, setRefDateTo] = useState<string>(todayISO());
  const [refCostAnalysis, setRefCostAnalysis] = useState<CostAnalysis | null>(null);

  const [detailPanel, setDetailPanel] = useState<{ row: SimItem; scope: ScopeRow } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [effectiveDate, setEffectiveDate] = useState<string>(todayISO());
  const [effectiveDateTo, setEffectiveDateTo] = useState<string>("");
  const [showQuotation, setShowQuotation] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filterSize, setFilterSize] = useState("ALL");
  const [viewMode, setViewMode] = useState<"sku" | "group">("sku");

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchWeeks = useCallback(async () => {
    const r = await fetch("/api/pricing/weeks");
    if (r.ok) setWeeks(await r.json());
  }, []);

  const fetchAllPartners = useCallback(async () => {
    const r = await fetch("/api/business-partners");
    if (r.ok) setAllPartners(await r.json());
  }, []);

  const fetchWeekDetail = useCallback(async (id: number) => {
    const r = await fetch(`/api/pricing/weeks/${id}`);
    if (r.ok) setWeekDetail(await r.json());
  }, []);

  useEffect(() => { fetchWeeks(); fetchAllPartners(); }, [fetchWeeks, fetchAllPartners]);

  // Track whether this is the initial mount so we don't reset the URL-seeded partner
  const isFirstWeekLoad = useRef(true);
  useEffect(() => {
    if (selectedWeekId) fetchWeekDetail(selectedWeekId);
    else setWeekDetail(null);
    if (isFirstWeekLoad.current) {
      isFirstWeekLoad.current = false;
    } else {
      setSelectedPartnerId(null);
    }
    setCostAnalysis(null);
  }, [selectedWeekId, fetchWeekDetail]);

  // Fetch all data when week, partner, or date range change
  useEffect(() => {
    if (!selectedWeekId || !selectedPartnerId || !dateFrom) return;
    setLoading(true);
    const effectiveDateTo = dateTo || todayISO();
    const qtysUrl = `/api/pricing/weeks/${selectedWeekId}/quantities?partnerId=${selectedPartnerId}&startDate=${dateFrom}&endDate=${effectiveDateTo}`;
    Promise.all([
      fetch(`/api/pricing/weeks/${selectedWeekId}/cost-analysis?partnerId=${selectedPartnerId}`)
        .then(r => r.ok ? r.json() : null),
      fetch("/api/pricing/egg-items").then(r => r.ok ? r.json() : []),
      fetch(`/api/pricing/site-groups?partnerId=${selectedPartnerId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/pricing/active-prices?partnerId=${selectedPartnerId}`).then(r => r.ok ? r.json() : []),
      fetch(qtysUrl).then(r => r.ok ? r.json() : {}),
      fetch(`/api/pricing/last-prices?partnerId=${selectedPartnerId}`).then(r => r.ok ? r.json() : {}),
    ]).then(([ca, items, sgs, prices, qtys, lastPrices]) => {
      setCostAnalysis(ca);
      setEggItems(items);
      setSiteGroups(sgs);
      setActivePriceList(prices);
      setQtyMap(qtys);
      setLastPriceMap(lastPrices);
    }).finally(() => setLoading(false));
  }, [selectedWeekId, selectedPartnerId, dateFrom, dateTo]);

  // ── Pre-fill from proposal (when navigated from Proposals page) ──────────────
  const [proposalPrefilled, setProposalPrefilled] = useState(false);

  // ── Partners for chips: group all "ทั่วไป" into one ลูกค้าทั่วไป entry ────────

  const generalPartnerIds = useMemo(
    () => new Set(allPartners.filter(p => p.nickname === "ทั่วไป").map(p => p.id)),
    [allPartners],
  );

  // Representative ID for the ลูกค้าทั่วไป group (used for all API calls)
  const generalRepId = useMemo(
    () => allPartners.find(p => p.nickname === "ทั่วไป")?.id ?? null,
    [allPartners],
  );

  const partners = useMemo<Partner[]>(() => {
    const named = allPartners.filter(p => !generalPartnerIds.has(p.id));
    if (generalRepId != null) {
      named.push({ id: generalRepId, nickname: "ลูกค้าทั่วไป", code: "" });
    }
    return named;
  }, [allPartners, generalPartnerIds, generalRepId]);

  // Auto-select first partner that has assumptions in this week
  useEffect(() => {
    if (!weekDetail?.assumptions || partners.length === 0) return;
    const assumptionPartnerIds = new Set(
      weekDetail.assumptions.filter(a => a.siteGroupId == null).map(a => a.partnerId).filter(Boolean)
    );
    const first = partners.find(p =>
      assumptionPartnerIds.has(p.id) ||
      (p.id === generalRepId && Array.from(generalPartnerIds).some(id => assumptionPartnerIds.has(id)))
    );
    if (first && !selectedPartnerId) setSelectedPartnerId(first.id);
  }, [weekDetail, partners]);

  const partnerStatus = useMemo<Record<number, "พร้อม" | "รอต้นทุน">>(() => {
    const map: Record<number, "พร้อม" | "รอต้นทุน"> = {};
    for (const p of partners) {
      // For the general group, check all ทั่วไป IDs
      const idsToCheck = p.id === generalRepId
        ? Array.from(generalPartnerIds)
        : [p.id];
      const hasCost = (weekDetail?.assumptions ?? []).some(
        a => idsToCheck.includes(a.partnerId!) && a.siteGroupId == null && a.unit !== "%" && parseFloat(a.value || "0") > 0
      );
      map[p.id] = hasCost ? "พร้อม" : "รอต้นทุน";
    }
    return map;
  }, [partners, generalRepId, generalPartnerIds, weekDetail]);

  // Seed refPartnerId to selectedPartnerId the first time a partner is chosen
  useEffect(() => {
    if (selectedPartnerId != null && refPartnerId == null) {
      setRefPartnerId(selectedPartnerId);
    }
  }, [selectedPartnerId]);

  // Fetch reference cost analysis whenever ref params change
  useEffect(() => {
    if (!selectedWeekId || !refPartnerId) { setRefCostAnalysis(null); return; }
    const url = `/api/pricing/weeks/${selectedWeekId}/cost-analysis?partnerId=${refPartnerId}&startDate=${refDateFrom}&endDate=${refDateTo}`;
    fetch(url).then(r => r.ok ? r.json() : null).then(setRefCostAnalysis);
  }, [selectedWeekId, refPartnerId, refDateFrom, refDateTo]);

  // ── Local cost figures from assumptions (no order-history dependency) ──────

  const localFixedCostPerEgg = useMemo(() => {
    if (!weekDetail?.assumptions || selectedPartnerId == null) return null;
    const sum = weekDetail.assumptions
      .filter(a => a.partnerId === selectedPartnerId && a.siteGroupId == null && a.unit !== "%")
      .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
    return sum;
  }, [weekDetail, selectedPartnerId]);

  const localDistyCostPct = useMemo(() => {
    if (!weekDetail?.assumptions || selectedPartnerId == null) return null;
    const d = weekDetail.assumptions.find(
      a => a.partnerId === selectedPartnerId && a.siteGroupId == null && a.component === "disty_cost"
    );
    return d ? parseFloat(d.value || "0") / 100 : null;
  }, [weekDetail, selectedPartnerId]);

  // ── Price lookup ──────────────────────────────────────────────────────────

  const lookupPrice = useCallback((itemId: number, siteGroupId: number | null): number | null => {
    if (siteGroupId != null) {
      const p = activePriceList.find(
        p => p.itemId === itemId && p.siteGroupId === siteGroupId && p.status === "active"
      );
      if (p) return parseFloat(p.price);
    }
    const p = activePriceList.find(
      p => p.itemId === itemId && p.siteGroupId == null && p.status === "active"
    );
    if (p) return parseFloat(p.price);
    // Fall back to last invoiced price from order history
    return lastPriceMap[itemId] ?? null;
  }, [activePriceList, lastPriceMap]);

  // ── Build SimItems ────────────────────────────────────────────────────────

  const simItems = useMemo<SimItem[]>(() => {
    if (!eggItems.length) return [];

    // Use cost-analysis API for per-size egg raw cost; fall back to local assumption values
    const fixedCost = costAnalysis?.fixedCostPerEgg ?? localFixedCostPerEgg ?? 0;
    const distyPct = costAnalysis?.distyCostPct ?? localDistyCostPct ?? 0;

    const partnerItemIds = new Set([
      ...Object.keys(lastPriceMap).map(Number),
      ...activePriceList.filter(p => p.itemId != null && p.status === "active").map(p => p.itemId!),
    ]);

    return eggItems
      .filter(item => item.primary_size != null && partnerItemIds.has(item.id))
      .map(item => {
        const size = costAnalysis?.sizes.find(s => s.primarySize === item.primary_size);
        const refSize = refCostAnalysis?.sizes.find(s => s.primarySize === item.primary_size);
        const eggsPerPack = item.eggs_per_pack;
        let recPrice: number | null = null;
        let costPrice: number | null = null;

        const materialCost = size?.materialCostPerEgg ?? 0;
        const eggRawCost = refSize?.eggRawCostPerEgg ?? null;

        if (eggRawCost != null && (localFixedCostPerEgg != null || costAnalysis) && distyPct < 1) {
          const preCost = eggRawCost + fixedCost + materialCost;
          costPrice = preCost * eggsPerPack;
          recPrice = (preCost / (1 - distyPct)) * eggsPerPack;
        }

        const itemQtys = qtyMap[item.id] ?? {};
        const scopes: ScopeRow[] = [
          {
            key: "default",
            siteGroupId: null,
            label: "ค่าเริ่มต้น",
            sublabel: "จุดส่งที่ยังไม่จัดกลุ่ม",
            quantity: itemQtys["default"] ?? 0,
            currentPrice: lookupPrice(item.id, null),
          },
          ...siteGroups.map(sg => ({
            key: String(sg.id),
            siteGroupId: sg.id,
            label: sg.name,
            sublabel: sg.members?.length
              ? "สาขา " + sg.members.map(m => m.deliverySite?.siteCode ?? "").filter(Boolean).join(", ")
              : "",
            quantity: itemQtys[String(sg.id)] ?? 0,
            currentPrice: lookupPrice(item.id, sg.id),
          })),
        ];

        return { item, recPrice, costPrice, scopes };
      })
      .sort((a, b) => {
        const sa = parseInt(a.item.primary_size ?? "99");
        const sb = parseInt(b.item.primary_size ?? "99");
        return sa !== sb ? sa - sb : (a.item.sku ?? "").localeCompare(b.item.sku ?? "");
      });
  }, [eggItems, costAnalysis, refCostAnalysis, localFixedCostPerEgg, localDistyCostPct, siteGroups, activePriceList, lastPriceMap, qtyMap, lookupPrice]);

  // Pre-fill prices from proposal once simItems are ready
  useEffect(() => {
    if (!urlProposalId.current || proposalPrefilled || simItems.length === 0) return;
    fetch(`/api/pricing/proposals/${urlProposalId.current}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (!p?.lines) return;
        const patch: Record<string, string> = {};
        for (const line of p.lines) {
          const id = line.item?.id ?? line.itemId;
          if (!id) continue;
          if (line.basePrice) patch[`${id}:default`] = parseFloat(line.basePrice).toFixed(2);
          for (const ex of line.exceptions ?? []) {
            patch[`${id}:${ex.siteGroupId}`] = parseFloat(ex.price).toFixed(2);
          }
        }
        setProposed(prev => ({ ...prev, ...patch }));
        if (p.effectiveDate) { setEffectiveDate(p.effectiveDate); setDateFrom(p.effectiveDate); }
        if (p.effectiveDateTo) { setEffectiveDateTo(p.effectiveDateTo); setDateTo(p.effectiveDateTo); }
        setProposalPrefilled(true);
      });
  }, [simItems.length, proposalPrefilled]);

  // ── Proposal helpers ──────────────────────────────────────────────────────

  const pKey = (itemId: number, scopeKey: string) => `${itemId}:${scopeKey}`;

  const getVal = (itemId: number, scopeKey: string, fallback: number | null): string => {
    const k = pKey(itemId, scopeKey);
    return k in proposed ? proposed[k] : (fallback != null ? fallback.toFixed(2) : "");
  };

  const setVal = (itemId: number, scopeKey: string, v: string) =>
    setProposed(p => ({ ...p, [pKey(itemId, scopeKey)]: v }));

  const applyToAll = (row: SimItem, val: string) => {
    const patch: Record<string, string> = {};
    for (const s of row.scopes) patch[pKey(row.item.id, s.key)] = val;
    setProposed(p => ({ ...p, ...patch }));
  };

  const fillRecommended = () => {
    const patch: Record<string, string> = {};
    for (const row of simItems) {
      if (!row.recPrice) continue;
      for (const s of row.scopes) patch[pKey(row.item.id, s.key)] = row.recPrice.toFixed(2);
    }
    setProposed(p => ({ ...p, ...patch }));
  };

  const exportXlsx = () => {
    const sgCols = siteGroups.map(sg => sg.name);
    const headers = [
      "รหัส", "รายการ", "เบอร์", "บรรจุ (ฟอง)",
      "ราคาเดิม", "ราคาเสนอ", "เปลี่ยน", "ราคา/ฟอง", "ต้นทุน",
      ...sgCols,
      "หมายเหตุ",
    ];

    const dataRows = simItems.map(row => {
      const defScope = row.scopes.find(s => s.key === "default");
      const defCurrent = defScope?.currentPrice ?? null;
      const defPropVal = getVal(row.item.id, "default", defCurrent);
      const defPropNum = defPropVal !== "" ? parseFloat(defPropVal) : null;
      const delta = defPropNum != null && defCurrent != null ? defPropNum - defCurrent : null;
      const perEgg = defPropNum != null ? defPropNum / row.item.eggs_per_pack : null;
      const sgPrices = siteGroups.map(sg => {
        const sgScope = row.scopes.find(s => s.siteGroupId === sg.id);
        const v = getVal(row.item.id, String(sg.id), sgScope?.currentPrice ?? null);
        return v !== "" ? parseFloat(v) : null;
      });
      const note = notes[pKey(row.item.id, "default")] ?? "";

      return [
        row.item.sku ?? "",
        row.item.name,
        row.item.primary_size != null ? `เบอร์ ${row.item.primary_size}` : "",
        row.item.eggs_per_pack,
        defCurrent,
        defPropNum,
        delta,
        perEgg != null ? parseFloat(perEgg.toFixed(2)) : null,
        row.costPrice != null ? parseFloat(row.costPrice.toFixed(2)) : null,
        ...sgPrices,
        note,
      ];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Column widths
    ws["!cols"] = [
      { wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 12 },
      { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      ...siteGroups.map(() => ({ wch: 12 })),
      { wch: 30 },
    ];

    const partnerName = partners.find(p => p.id === selectedPartnerId)?.nickname ?? "export";
    XLSX.utils.book_append_sheet(wb, ws, "ราคาเสนอ");
    XLSX.writeFile(wb, `price_simulation_${partnerName}_${dateFrom}.xlsx`);
  };

  const submitProposal = async () => {
    if (!selectedWeekId || !selectedPartnerId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const lines = simItems.map(row => {
        const defScope = row.scopes.find(s => s.key === "default");
        const defVal = getVal(row.item.id, "default", defScope?.currentPrice ?? null);
        const basePrice = defVal !== "" ? parseFloat(defVal) : undefined;
        const exceptions = siteGroups
          .map(sg => {
            const sgScope = row.scopes.find(s => s.siteGroupId === sg.id);
            const v = getVal(row.item.id, String(sg.id), sgScope?.currentPrice ?? null);
            return v !== "" ? { siteGroupId: sg.id, price: parseFloat(v) } : null;
          })
          .filter(Boolean) as { siteGroupId: number; price: number }[];
        const note = notes[pKey(row.item.id, "default")] || undefined;
        return { itemId: row.item.id, basePrice, exceptions: exceptions.length ? exceptions : undefined, notes: note };
      });

      const existingId = urlProposalId.current;
      const res = existingId
        ? await fetch(`/api/pricing/proposals/${existingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ effectiveDate: dateFrom || effectiveDate || undefined, effectiveDateTo: effectiveDateTo || undefined, lines }),
          })
        : await fetch("/api/pricing/proposals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pricingWeekId: selectedWeekId, partnerId: selectedPartnerId, effectiveDate: effectiveDate || undefined, effectiveDateTo: effectiveDateTo || undefined, lines }),
          });

      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.message ?? "Failed to submit proposal");
        return;
      }

      setShowSubmitDialog(false);
      // Navigate to proposals page
      window.location.href = "/orders/pricing/proposals";
    } finally {
      setSubmitting(false);
    }
  };

  // ── Expand ────────────────────────────────────────────────────────────────

  const toggle = (id: number) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll = () => setExpanded(new Set(simItems.map(r => r.item.id)));
  const collapseAll = () => setExpanded(new Set());

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() =>
    filterSize === "ALL" ? simItems : simItems.filter(r => r.item.primary_size === filterSize),
    [simItems, filterSize]);

  const availableSizes = useMemo(() =>
    Array.from(new Set(simItems.map(r => r.item.primary_size).filter(Boolean))).sort() as string[],
    [simItems]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <PricingStepNav />

      {/* ── Week + Partner selectors ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedWeekId?.toString() ?? ""}
          onValueChange={v => setSelectedWeekId(Number(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="เลือกสัปดาห์" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map(w => (
              <SelectItem key={w.id} value={w.id.toString()}>
                {w.weekCode} ({w.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {partners.map(p => {
          const status = partnerStatus[p.id] ?? "รอต้นทุน";
          const isSelected = selectedPartnerId === p.id;
          const chipCls = isSelected
            ? status === "พร้อม"
              ? "bg-green-600 text-white"
              : "bg-slate-600 text-white"
            : status === "พร้อม"
              ? "bg-green-50 text-green-800 hover:bg-green-100 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700";
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPartnerId(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${chipCls}`}
            >
              {p.nickname}
              <span className={`text-xs font-normal ${isSelected ? "opacity-75" : "opacity-60"}`}>
                · {status}
              </span>
            </button>
          );
        })}
      </div>

      {!selectedWeekId && (
        <p className="text-sm text-muted-foreground">เลือกสัปดาห์เพื่อเริ่มต้น</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          กำลังโหลดข้อมูล…
        </div>
      )}

      {!loading && selectedWeekId && selectedPartnerId && (
        <>
          {/* ── ราคาอ้างอิง strip ── */}
          {localFixedCostPerEgg != null ? (
            <div className="bg-white dark:bg-background border border-border rounded-lg shadow-sm">
              <div className="flex items-center gap-3 flex-wrap px-3.5 py-2.5">
                {/* อ้างอิงจาก */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">อ้างอิงจาก</span>
                  <select
                    value={refPartnerId ?? ""}
                    onChange={e => setRefPartnerId(Number(e.target.value))}
                    className="h-8 px-2 border border-border rounded-md bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.nickname}</option>
                    ))}
                  </select>
                </div>

                {/* รอบอิงทุน */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">รอบอิงทุน</span>
                  <input
                    type="date"
                    value={refDateFrom}
                    onChange={e => setRefDateFrom(e.target.value)}
                    className="h-8 px-2 border border-border rounded-md bg-background text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <input
                    type="date"
                    value={refDateTo}
                    onChange={e => setRefDateTo(e.target.value)}
                    className="h-8 px-2 border border-border rounded-md bg-background text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* divider */}
                <div className="w-px h-6 bg-border shrink-0" />

                {/* label */}
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  ค่าไข่อ้างอิง · ถ่วงน้ำหนักปริมาณขาย
                </span>

                {/* size pills */}
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  {refCostAnalysis?.sizes.map(s => (
                    <div key={s.primarySize} className="flex items-center gap-1.5 bg-muted/20 border border-border/60 rounded-md px-2.5 py-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SIZE_PILL[s.primarySize] ?? "bg-muted text-muted-foreground"}`}>
                        {SIZE_LABEL[s.primarySize] ?? `เบอร์ ${s.primarySize}`}
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        ฿{s.eggRawCostPerEgg.toFixed(4)}
                      </span>
                    </div>
                  ))}
                  {!refCostAnalysis?.sizes.length && (
                    <span className="text-xs text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              ยังไม่มีข้อมูลต้นทุน — ตรวจสอบ ต้นทุนรวม สำหรับสัปดาห์นี้
            </div>
          )}

          {/* ── Effective date range ── */}
          <div className="flex items-center gap-2.5 bg-white dark:bg-background border border-border rounded-lg px-3.5 py-2 shadow-sm w-fit">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">วันที่มีผล</span>
            <div className="w-px h-5 bg-border shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-7 text-sm tabular-nums bg-transparent border-0 outline-none p-0 focus:ring-0 text-foreground"
            />
            <span className="text-muted-foreground text-sm select-none">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-7 text-sm tabular-nums bg-transparent border-0 outline-none p-0 focus:ring-0 text-foreground"
            />
            {dateTo && (
              <button
                type="button"
                onClick={() => setDateTo("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="ล้างวันสิ้นสุด"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-md overflow-hidden h-8">
              <button
                onClick={() => setViewMode("sku")}
                className={`px-3 h-full text-sm font-medium transition-colors ${viewMode === "sku" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                ราย SKU
              </button>
              <button
                onClick={() => setViewMode("group")}
                className={`px-3 h-full text-sm font-medium transition-colors border-l border-border ${viewMode === "group" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                รายกลุ่มจุดส่ง
              </button>
            </div>

            <Select value={filterSize} onValueChange={setFilterSize}>
              <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกเบอร์</SelectItem>
                {availableSizes.map(s => (
                  <SelectItem key={s} value={s}>{SIZE_LABEL[s] ?? `เบอร์ ${s}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {viewMode === "sku" && (
              <>
                <Button size="sm" variant="outline" className="gap-1" onClick={expandAll}>
                  <ChevronsUpDown className="w-3.5 h-3.5" />เปิดทั้งหมด
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={collapseAll}>
                  <ChevronsDownUp className="w-3.5 h-3.5" />ย่อทั้งหมด
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportXlsx}>
              <Download className="w-3.5 h-3.5" />ส่งออก XLSX
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuotation(true)}>
              <Printer className="w-3.5 h-3.5" />พิมพ์ใบเสนอราคา
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setSubmitError(null); if (urlProposalId.current) { submitProposal(); } else { setShowSubmitDialog(true); } }}>
              <Send className="w-3.5 h-3.5" />บันทึกใบเสนอราคา
            </Button>
          </div>

          {/* ── Table ── */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                ไม่พบสินค้าไข่
              </CardContent>
            </Card>
          ) : viewMode === "sku" ? (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-8" />
                      <TableHead className="min-w-[200px]">SKU / กลุ่มจุดส่ง</TableHead>
                      <TableHead className="w-32">เบอร์ · บรรจุ</TableHead>
                      <TableHead className="text-right w-20">ปริมาณ</TableHead>
                      <TableHead className="text-right w-24">ราคาเดิม</TableHead>
                      <TableHead className="text-right w-24">ต้นทุน</TableHead>
                      <TableHead className="text-right w-36">ราคาเสนอ</TableHead>
                      <TableHead className="text-right w-20">Δ เดิม</TableHead>
                      <TableHead className="w-28">คำเตือน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.flatMap(row => {
                      const isExpanded = expanded.has(row.item.id);
                      const totalQty = row.scopes.reduce((s, sc) => s + sc.quantity, 0);
                      const prices = row.scopes.map(s => s.currentPrice).filter((p): p is number => p != null);
                      const avgCurrent = prices.length
                        ? prices.reduce((a, b) => a + b, 0) / prices.length
                        : null;
                      const sizePill = row.item.primary_size
                        ? (SIZE_PILL[row.item.primary_size] ?? "bg-muted text-muted-foreground")
                        : "bg-muted text-muted-foreground";

                      const scopeProps = row.scopes.map(s => ({
                        qty: s.quantity,
                        val: (() => { const v = getVal(row.item.id, s.key, s.currentPrice); return v !== "" ? parseFloat(v) : null; })(),
                      }));
                      const weightedNum = scopeProps.filter(s => s.val != null);
                      let avgProposed: number | null = null;
                      if (weightedNum.length > 0) {
                        const totalW = weightedNum.reduce((s, x) => s + x.qty, 0);
                        avgProposed = totalW > 0
                          ? weightedNum.reduce((s, x) => s + x.val! * x.qty, 0) / totalW
                          : weightedNum.reduce((s, x) => s + x.val!, 0) / weightedNum.length;
                      }
                      const avgDelta = avgProposed != null && avgCurrent != null ? avgProposed - avgCurrent : null;

                      const headerRow = (
                        <TableRow
                          key={`hdr-${row.item.id}`}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => toggle(row.item.id)}
                        >
                          <TableCell className="pr-0 pl-3">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs text-muted-foreground">{row.item.sku ?? "—"}</span>
                              <span className="text-sm font-medium">{row.item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {row.item.primary_size && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sizePill}`}>
                                  {SIZE_LABEL[row.item.primary_size] ?? `เบอร์ ${row.item.primary_size}`}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">×{row.item.eggs_per_pack}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {totalQty > 0 ? totalQty.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {fmt2(avgCurrent)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {fmt2(row.costPrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            {fmt2(avgProposed)}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-sm font-medium ${avgDelta != null ? deltaColor(avgDelta) : ""}`}>
                            {avgDelta != null ? (avgDelta >= 0 ? "+" : "") + fmt2(avgDelta) : "—"}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );

                      if (!isExpanded) return [headerRow];

                      const scopeRows = row.scopes.map(scope => {
                        const propVal = getVal(row.item.id, scope.key, scope.currentPrice);
                        const propNum = propVal !== "" ? parseFloat(propVal) : null;
                        const dOld = propNum != null && scope.currentPrice != null ? propNum - scope.currentPrice : null;
                        const belowCost = row.costPrice != null && propNum != null && propNum < row.costPrice;
                        const isDefault = scope.key === "default";

                        return (
                          <TableRow
                            key={`scope-${row.item.id}-${scope.key}`}
                            className={`cursor-pointer ${isDefault
                              ? "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30"
                              : "bg-muted/20 hover:bg-muted/40"}`}
                            onClick={e => {
                              if ((e.target as HTMLElement).closest("input,button")) return;
                              setDetailPanel({ row, scope });
                            }}
                          >
                            <TableCell />
                            <TableCell className="pl-8">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium flex items-center gap-1.5">
                                    {scope.label}
                                    {isDefault && (
                                      <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                                        ค่าเริ่มต้น
                                      </span>
                                    )}
                                  </span>
                                  {scope.sublabel && (
                                    <span className="text-[11px] text-muted-foreground">{scope.sublabel}</span>
                                  )}
                                </div>
                                {isDefault && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs gap-1 whitespace-nowrap shrink-0"
                                    title="คัดลอกราคานี้ไปทุกกลุ่ม"
                                    onClick={() => { if (propVal !== "") applyToAll(row, propVal); }}
                                  >
                                    <Copy className="w-3 h-3" />
                                    ทุกกลุ่ม
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right tabular-nums text-sm">
                              {scope.quantity > 0
                                ? scope.quantity.toLocaleString()
                                : <span className="text-muted-foreground/40">0</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {fmt2(scope.currentPrice)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {fmt2(row.costPrice)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={propVal}
                                onChange={e => setVal(row.item.id, scope.key, e.target.value)}
                                className={`h-8 w-24 text-sm text-right tabular-nums font-medium ${
                                  belowCost
                                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30"
                                    : "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20"
                                }`}
                              />
                            </TableCell>
                            <TableCell className={`text-right tabular-nums text-sm ${dOld != null ? deltaColor(dOld) : ""}`}>
                              {dOld != null ? (dOld >= 0 ? "+" : "") + fmt2(dOld) : "—"}
                            </TableCell>
                            <TableCell>
                              {belowCost && (
                                <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  ต่ำกว่าต้นทุน
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      });

                      return [headerRow, ...scopeRows];
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            /* ── Group view ── */
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="min-w-[260px]">กลุ่มจุดส่ง / SKU</TableHead>
                      <TableHead className="w-32">เบอร์ · บรรจุ</TableHead>
                      <TableHead className="text-right w-20">ปริมาณ</TableHead>
                      <TableHead className="text-right w-24">ราคาเดิม</TableHead>
                      <TableHead className="text-right w-24">ต้นทุน</TableHead>
                      <TableHead className="text-right w-36">ราคาเสนอ</TableHead>
                      <TableHead className="text-right w-20">Δ เดิม</TableHead>
                      <TableHead className="w-28">คำเตือน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* default scope first, then each site group */}
                    {[
                      { key: "default", label: "ค่าเริ่มต้น", sublabel: "จุดส่งที่ยังไม่จัดกลุ่ม", totalQty: filtered.reduce((s, r) => s + (r.scopes.find(sc => sc.key === "default")?.quantity ?? 0), 0) },
                      ...siteGroups.map(sg => ({
                        key: String(sg.id),
                        label: sg.name,
                        sublabel: sg.members?.length ? "สาขา " + sg.members.map(m => m.deliverySite?.siteCode ?? "").filter(Boolean).join(", ") : "",
                        totalQty: filtered.reduce((s, r) => s + (r.scopes.find(sc => sc.key === String(sg.id))?.quantity ?? 0), 0),
                      })),
                    ].flatMap(group => {
                      const groupHeader = (
                        <TableRow key={`grp-${group.key}`} className="bg-muted/30 dark:bg-muted/20">
                          <TableCell colSpan={8} className="py-2 px-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold">{group.label}</span>
                              {group.sublabel && (
                                <span className="text-[11px] text-muted-foreground">{group.sublabel}</span>
                              )}
                              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                                {group.totalQty > 0 ? group.totalQty.toLocaleString() : "0"} แพ็ค
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );

                      const itemRows = filtered.map(row => {
                        const scope = row.scopes.find(s => s.key === group.key);
                        if (!scope) return null;
                        const propVal = getVal(row.item.id, scope.key, scope.currentPrice);
                        const propNum = propVal !== "" ? parseFloat(propVal) : null;
                        const dOld = propNum != null && scope.currentPrice != null ? propNum - scope.currentPrice : null;
                        const belowCost = row.costPrice != null && propNum != null && propNum < row.costPrice;
                        const sizePill = row.item.primary_size
                          ? (SIZE_PILL[row.item.primary_size] ?? "bg-muted text-muted-foreground")
                          : "bg-muted text-muted-foreground";

                        return (
                          <TableRow
                            key={`grp-${group.key}-item-${row.item.id}`}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={e => {
                              if ((e.target as HTMLElement).closest("input,button")) return;
                              setDetailPanel({ row, scope });
                            }}
                          >
                            <TableCell className="pl-8">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono text-xs text-muted-foreground">{row.item.sku ?? "—"}</span>
                                <span className="text-sm font-medium">{row.item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {row.item.primary_size && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sizePill}`}>
                                    {SIZE_LABEL[row.item.primary_size] ?? `เบอร์ ${row.item.primary_size}`}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">×{row.item.eggs_per_pack}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {scope.quantity > 0
                                ? scope.quantity.toLocaleString()
                                : <span className="text-muted-foreground/40">0</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {fmt2(scope.currentPrice)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {fmt2(row.costPrice)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={propVal}
                                onChange={e => setVal(row.item.id, scope.key, e.target.value)}
                                className={`h-8 w-24 text-sm text-right tabular-nums font-medium ${
                                  belowCost
                                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30"
                                    : "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20"
                                }`}
                              />
                            </TableCell>
                            <TableCell className={`text-right tabular-nums text-sm ${dOld != null ? deltaColor(dOld) : ""}`}>
                              {dOld != null ? (dOld >= 0 ? "+" : "") + fmt2(dOld) : "—"}
                            </TableCell>
                            <TableCell>
                              {belowCost && (
                                <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  ต่ำกว่าต้นทุน
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }).filter(Boolean);

                      return [groupHeader, ...itemRows];
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Quotation Modal ── */}
      {/* ── Submit Proposal Dialog ── */}
      <Dialog open={showSubmitDialog} onOpenChange={o => { if (!o) setShowSubmitDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{urlProposalId.current ? "อัปเดตใบเสนอราคา" : "บันทึกใบเสนอราคา"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {urlProposalId.current ? "อัปเดตใบเสนอราคาสำหรับ" : "สร้างใบเสนอราคาสำหรับ"}{" "}
              <span className="font-semibold text-foreground">
                {partners.find(p => p.id === selectedPartnerId)?.nickname}
              </span>{" "}
              จำนวน <span className="font-semibold text-foreground">{simItems.length} รายการ</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">ช่วงวันที่มีผล <span className="text-destructive">*</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring flex-1"
                />
                <span className="text-muted-foreground text-sm shrink-0">ถึง</span>
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={effectiveDateTo}
                    onChange={e => setEffectiveDateTo(e.target.value)}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring w-full"
                    placeholder="ไม่มีกำหนด"
                  />
                  {effectiveDateTo && (
                    <button
                      type="button"
                      onClick={() => setEffectiveDateTo("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">วันสิ้นสุดเป็นตัวเลือก — ไม่ระบุหมายถึงไม่มีกำหนดสิ้นสุด</p>
            </div>
            {submitError && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-sm">{submitError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={submitting}>
              ยกเลิก
            </Button>
            <Button onClick={submitProposal} disabled={submitting || !effectiveDate}>
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />กำลังบันทึก…</>
                : urlProposalId.current
                  ? <><Send className="w-4 h-4 mr-1.5" />ยืนยันอัปเดต</>
                  : <><Send className="w-4 h-4 mr-1.5" />บันทึกใบเสนอราคา</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showQuotation && selectedPartnerId && (
        <QuotationModal
          simItems={simItems}
          siteGroups={siteGroups}
          partnerId={selectedPartnerId}
          dateFrom={dateFrom}
          proposed={proposed}
          notes={notes}
          pKey={pKey}
          getVal={getVal}
          onClose={() => setShowQuotation(false)}
        />
      )}

      {/* ── Detail Panel ── */}
      {detailPanel && selectedPartnerId && (() => {
        const { row, scope } = detailPanel;
        const sv = getScopeVals(weekDetail, selectedPartnerId, scope.siteGroupId);
        const distyPct = (sv["disty_cost"] ?? 0) / 100;
        const transportOut = sv["transport_out"] ?? 0;
        const factoryCost = ["transport_in", "operations", "labor", "maintenance", "egg_loss"]
          .reduce((s, k) => s + (sv[k] ?? 0), 0);
        const totalFixedPerEgg = transportOut + factoryCost;
        const materialCostPerEgg = costAnalysis?.sizes.find(s => s.primarySize === row.item.primary_size)?.materialCostPerEgg ?? 0;
        const eggsPerPack = row.item.eggs_per_pack;

        const propVal = getVal(row.item.id, scope.key, scope.currentPrice);
        const propNum = propVal !== "" ? parseFloat(propVal) : null;
        const proposedPerEgg = propNum != null ? propNum / eggsPerPack : null;
        const eggRawCostDerived = proposedPerEgg != null
          ? proposedPerEgg * (1 - distyPct) - totalFixedPerEgg - materialCostPerEgg
          : null;
        const dOld = propNum != null && scope.currentPrice != null ? propNum - scope.currentPrice : null;
        const belowCost = row.costPrice != null && propNum != null && propNum < row.costPrice;

        return (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDetailPanel(null)} />
            {/* Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-[400px] bg-background border-l shadow-2xl flex flex-col">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">ราคาตกลง → ค่าไข่อ้างอิง</p>
                    <h2 className="text-base font-semibold mt-0.5 leading-snug">{row.item.name}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {scope.label} / {scope.sublabel || "จุดส่งที่ยังไม่จัดกลุ่ม"}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailPanel(null)}
                    className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Step breadcrumb */}
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <span>ราคาที่ตกลง</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>พักต้นทุน</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-foreground font-medium">ค่าไข่อ้างอิง</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Cost breakdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">แปลงราคาที่ตกลงเป็นค่าไข่</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ราคาที่ตกลง / pack</span>
                      <span className="tabular-nums font-medium">
                        {propNum != null ? `฿${propNum.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disty cost (กลุ่มนี้)</span>
                      <span className="tabular-nums">{(distyPct * 100).toFixed(2)}%</span>
                    </div>
                    {ASSUMPTION_COMPONENTS.filter(c => c.key !== "disty_cost").map(c => (
                      <div key={c.key} className="flex justify-between">
                        <span className="text-muted-foreground">{c.label} (กลุ่มนี้) / ฟอง</span>
                        <span className="tabular-nums">฿{(sv[c.key] ?? 0).toFixed(4)}</span>
                      </div>
                    ))}
                    {materialCostPerEgg > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ต้นทุนวัสดุ / ฟอง</span>
                        <span className="tabular-nums">฿{materialCostPerEgg.toFixed(4)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2 space-y-2">
                      <div className="flex justify-between font-medium">
                        <span>ค่าไข่อ้างอิง (กลุ่มนี้) / ฟอง</span>
                        <span className="tabular-nums">
                          {eggRawCostDerived != null ? `฿${eggRawCostDerived.toFixed(4)}` : "—"}
                        </span>
                      </div>
                      {costAnalysis?.sizes.find(s => s.primarySize === row.item.primary_size) && (
                        <div className="flex justify-between text-muted-foreground text-xs">
                          <span>ค่าไข่จากประวัติ เบอร์ {row.item.primary_size} / ฟอง</span>
                          <span className="tabular-nums">
                            ฿{costAnalysis!.sizes.find(s => s.primarySize === row.item.primary_size)!.eggRawCostPerEgg.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editable price */}
                <div className="border rounded-lg p-4 space-y-3 bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">ราคาเสนอ (แก้ไขได้)</p>
                  {belowCost && (
                    <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      ราคาเสนอต่ำกว่าต้นทุน
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={propVal}
                      onChange={e => setVal(row.item.id, scope.key, e.target.value)}
                      className={`text-right tabular-nums font-medium text-base flex-1 ${
                        belowCost
                          ? "border-red-400 dark:border-red-600"
                          : "border-amber-400 dark:border-amber-600"
                      }`}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">บาท/แพ็ค</span>
                  </div>
                  <div className="space-y-1.5 text-sm pt-1 border-t border-amber-200 dark:border-amber-800">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ส่วนต่างจากราคาเดิม</span>
                      <span className={`tabular-nums font-medium ${dOld != null ? deltaColor(dOld) : ""}`}>
                        {dOld != null ? (dOld >= 0 ? "+" : "") + dOld.toFixed(2) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ราคาเสนอ / ฟอง</span>
                      <span className="tabular-nums font-medium">
                        {proposedPerEgg != null ? `฿${proposedPerEgg.toFixed(2)}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">เหตุผล / หมายเหตุ</label>
                  <textarea
                    value={notes[pKey(row.item.id, scope.key)] ?? ""}
                    onChange={e => setNotes(n => ({ ...n, [pKey(row.item.id, scope.key)]: e.target.value }))}
                    placeholder="ระบุเหตุผลเมื่อราคาต่างจากที่แนะนำ"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
