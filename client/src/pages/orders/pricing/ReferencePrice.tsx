import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, LayoutGrid } from "lucide-react";
import {
  ASSUMPTION_COMPONENTS,
  PricingStepNav,
  type Partner,
  type PricingWeek,
} from "./_shared";

// =============================================
// TYPES
// =============================================

interface SkuDetail {
  sku: string;
  name: string;
  avgPricePerEgg: number;
  effectiveEggsPerUnit: number;
  totalQuantity: number;
  splitQuantity: number;
  isMixed: boolean;
  materialCostPerEgg: number;
}

interface SizeRow {
  primarySize: string;
  secondarySize: string | null;
  sizeLabel: string;
  skus: SkuDetail[];
  avgSellPerEgg: number;
  fixedCostPerEgg: number;
  materialCostPerEgg: number;
  distyCostPerEgg: number;
  totalCostPerEgg: number;
  eggRawCostPerEgg: number;
  hasAssumptions: boolean;
}

interface CostAnalysis {
  weekId: number;
  partnerId: number;
  assumptions: { component: string; value: string; unit: string | null }[];
  fixedCostPerEgg: number;
  distyCostPct: number;
  sizes: SizeRow[];
}

// =============================================
// HELPERS
// =============================================

function fmtEgg(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtPct(n: number) {
  return (n * 100).toFixed(2) + "%";
}

// =============================================
// COMPONENT
// =============================================

export default function ReferencePricePage() {
  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<PricingWeek | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [allAnalyses, setAllAnalyses] = useState<CostAnalysis[] | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [expandedSizes, setExpandedSizes] = useState<Set<string>>(new Set());

  const fetchWeeks = useCallback(async () => {
    const res = await fetch("/api/pricing/weeks");
    if (res.ok) setWeeks(await res.json());
  }, []);

  const fetchWeekDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/pricing/weeks/${id}`);
    if (res.ok) {
      const data: PricingWeek = await res.json();
      setWeekDetail(data);
      const firstPartnerId = data.assumptions
        ?.find((a) => a.partnerId != null)?.partnerId ?? null;
      setSelectedPartnerId(firstPartnerId);
    }
  }, []);

  const fetchAnalysis = useCallback(async (weekId: number, partnerId: number) => {
    setLoadingAnalysis(true);
    try {
      const res = await fetch(`/api/pricing/weeks/${weekId}/cost-analysis?partnerId=${partnerId}`);
      if (res.ok) setAnalysis(await res.json());
      else setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  const fetchAllAnalyses = useCallback(async (weekId: number, partnerIds: number[]) => {
    setLoadingCompare(true);
    try {
      const results = await Promise.all(
        partnerIds.map((pid) =>
          fetch(`/api/pricing/weeks/${weekId}/cost-analysis?partnerId=${pid}`)
            .then((r) => (r.ok ? (r.json() as Promise<CostAnalysis>) : null))
            .catch(() => null)
        )
      );
      setAllAnalyses(results.filter(Boolean) as CostAnalysis[]);
    } finally {
      setLoadingCompare(false);
    }
  }, []);

  useEffect(() => { fetchWeeks(); }, [fetchWeeks]);

  useEffect(() => {
    if (selectedWeekId) {
      setAnalysis(null);
      setAllAnalyses(null);
      setExpandedSizes(new Set());
      fetchWeekDetail(selectedWeekId);
    } else {
      setWeekDetail(null);
      setAnalysis(null);
      setAllAnalyses(null);
    }
  }, [selectedWeekId, fetchWeekDetail]);

  useEffect(() => {
    if (viewMode === "single" && selectedWeekId && selectedPartnerId) {
      setAnalysis(null);
      setExpandedSizes(new Set());
      fetchAnalysis(selectedWeekId, selectedPartnerId);
    } else if (viewMode === "single") {
      setAnalysis(null);
    }
  }, [viewMode, selectedWeekId, selectedPartnerId, fetchAnalysis]);

  // Derive unique partners from week assumptions
  const partnersWithAssumptions = useMemo<Partner[]>(() => {
    const partners: Partner[] = [];
    const seenIds = new Set<number>();
    for (const a of weekDetail?.assumptions ?? []) {
      if (a.partnerId != null && a.partner && !seenIds.has(a.partnerId)) {
        seenIds.add(a.partnerId);
        partners.push(a.partner);
      }
    }
    return partners;
  }, [weekDetail]);

  useEffect(() => {
    if (viewMode === "compare" && selectedWeekId && partnersWithAssumptions.length > 0) {
      setAllAnalyses(null);
      fetchAllAnalyses(selectedWeekId, partnersWithAssumptions.map((p) => p.id));
    }
  }, [viewMode, selectedWeekId, partnersWithAssumptions, fetchAllAnalyses]);

  // Collect all unique sizes sorted by size number for comparison table
  const compareSizes = useMemo(() => {
    if (!allAnalyses) return [];
    const sizeMap = new Map<string, string>();
    for (const a of allAnalyses) {
      for (const s of a.sizes) {
        if (!sizeMap.has(s.primarySize)) sizeMap.set(s.primarySize, s.sizeLabel);
      }
    }
    return Array.from(sizeMap.entries())
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([key, label]) => ({ key, label }));
  }, [allAnalyses]);

  const toggleSize = (key: string) => {
    setExpandedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectPartner = (id: number) => {
    setViewMode("single");
    setSelectedPartnerId(id);
  };

  const handleSelectCompare = () => {
    setViewMode("compare");
  };

  return (
    <div className="space-y-6">
      <div>
        <PricingStepNav />
      </div>

      <div>
        <h1 className="text-2xl font-bold">Reference Price</h1>
        <p className="text-muted-foreground">
          Cost breakdown per egg size — selling price minus assumptions to derive raw egg cost.
        </p>
      </div>

      {/* Week + Customer selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select
          value={selectedWeekId?.toString() ?? ""}
          onValueChange={(v) => setSelectedWeekId(Number(v))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w.id} value={w.id.toString()}>
                {w.weekCode} ({w.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {weekDetail && partnersWithAssumptions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {partnersWithAssumptions.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPartner(p.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "single" && selectedPartnerId === p.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.nickname || p.code}
              </button>
            ))}

            <div className="w-px h-5 bg-border mx-1" />

            <button
              onClick={handleSelectCompare}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "compare"
                  ? "bg-[#1a1a1a] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              เปรียบเทียบ
            </button>
          </div>
        )}
      </div>

      {/* Empty states */}
      {!selectedWeekId && (
        <p className="text-muted-foreground text-sm">Select a pricing week to view cost analysis.</p>
      )}

      {selectedWeekId && weekDetail && partnersWithAssumptions.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-yellow-600">
          <AlertTriangle className="w-4 h-4" />
          No customer assumptions configured for this week. Go to Global Assumptions first.
        </div>
      )}

      {/* ── SINGLE PARTNER VIEW ── */}
      {viewMode === "single" && (
        <>
          {selectedWeekId && selectedPartnerId && loadingAnalysis && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading cost analysis…
            </div>
          )}

          {analysis && !loadingAnalysis && (
            <>
              {/* Assumptions summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cost Assumptions — {weekDetail?.weekCode}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {ASSUMPTION_COMPONENTS.map(({ key, label, defaultUnit }) => {
                      const a = analysis.assumptions.find((x) => x.component === key);
                      const isPercent = defaultUnit === "%";
                      return (
                        <div key={key} className="flex flex-col gap-0.5">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="font-medium text-sm">
                            {a
                              ? isPercent
                                ? `${parseFloat(a.value).toFixed(2)}%`
                                : `฿${parseFloat(a.value).toFixed(4)}`
                              : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ต้นทุนคงที่ / ฟอง</span>
                    <span className="font-bold">฿{fmtEgg(analysis.fixedCostPerEgg)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">ต้นทุนวัสดุบรรจุ (คำนวณจากราคาวัสดุ)</span>
                    <span className="font-medium text-amber-700">
                      {analysis.sizes.some(s => s.materialCostPerEgg > 0)
                        ? `฿${fmtEgg(analysis.sizes.find(s => s.materialCostPerEgg > 0)!.materialCostPerEgg)} – ฿${fmtEgg(Math.max(...analysis.sizes.map(s => s.materialCostPerEgg)))}`
                        : <span className="text-muted-foreground text-xs">ไม่พบข้อมูลราคาวัสดุ</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Disty cost (% ของราคาขาย)</span>
                    <span className="font-medium">{fmtPct(analysis.distyCostPct)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Per-size cost breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cost per Egg by Size</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {analysis.sizes.length === 0 ? (
                    <div className="p-6 flex items-center gap-2 text-sm text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      No order data found for this customer. Cost analysis requires historical order items.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8" />
                          <TableHead>ขนาด</TableHead>
                          <TableHead className="text-right">SKUs</TableHead>
                          <TableHead className="text-right">ราคาขาย/ฟอง</TableHead>
                          <TableHead className="text-right">ต้นทุนคงที่/ฟอง</TableHead>
                          <TableHead className="text-right">ต้นทุนวัสดุ/ฟอง</TableHead>
                          <TableHead className="text-right">Disty/ฟอง</TableHead>
                          <TableHead className="text-right">ต้นทุนรวม/ฟอง</TableHead>
                          <TableHead className="text-right font-semibold">ต้นทุนไข่/ฟอง</TableHead>
                          <TableHead className="text-right">% ต้นทุน</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.sizes.map((row) => {
                          const key = `${row.primarySize}|${row.secondarySize ?? ""}`;
                          const expanded = expandedSizes.has(key);
                          const costPct = row.avgSellPerEgg > 0
                            ? (row.totalCostPerEgg / row.avgSellPerEgg) * 100
                            : 0;
                          return (
                            <>
                              <TableRow
                                key={key}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSize(key)}
                              >
                                <TableCell className="pr-0">
                                  {expanded
                                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                </TableCell>
                                <TableCell className="font-medium">{row.sizeLabel}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="tabular-nums">
                                    {row.skus.length}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  ฿{fmtEgg(row.avgSellPerEgg)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  ฿{fmtEgg(row.fixedCostPerEgg)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {row.materialCostPerEgg > 0 ? `฿${fmtEgg(row.materialCostPerEgg)}` : <span className="text-xs text-muted-foreground/50">—</span>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  ฿{fmtEgg(row.distyCostPerEgg)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  ฿{fmtEgg(row.totalCostPerEgg)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-primary">
                                  ฿{fmtEgg(row.eggRawCostPerEgg)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {costPct.toFixed(1)}%
                                </TableCell>
                              </TableRow>

                              {expanded &&
                                row.skus.map((sku) => {
                                  const skuDisty = sku.avgPricePerEgg * analysis.distyCostPct;
                                  const skuTotal = row.fixedCostPerEgg + sku.materialCostPerEgg + skuDisty;
                                  const skuEggRaw = sku.avgPricePerEgg - skuTotal;
                                  const skuPct = sku.avgPricePerEgg > 0 ? (skuTotal / sku.avgPricePerEgg) * 100 : 0;
                                  return (
                                    <TableRow
                                      key={`${key}-${sku.sku}`}
                                      className="bg-muted/30 text-sm"
                                    >
                                      <TableCell />
                                      <TableCell className="pl-8 text-muted-foreground">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-mono text-xs">{sku.sku}</span>
                                          <span className="text-xs">{sku.name}</span>
                                          <span className="text-[10px] text-muted-foreground/60">{sku.effectiveEggsPerUnit} ฟอง/unit</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground">
                                        {sku.splitQuantity.toLocaleString()} units
                                        {sku.isMixed && (
                                          <span className="ml-1 text-yellow-600">
                                            ({Math.round((sku.splitQuantity / sku.totalQuantity) * 100)}%)
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs">
                                        ฿{fmtEgg(sku.avgPricePerEgg)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                        ฿{fmtEgg(row.fixedCostPerEgg)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs">
                                        {sku.materialCostPerEgg > 0
                                          ? <span className="text-amber-700 font-medium">฿{fmtEgg(sku.materialCostPerEgg)}</span>
                                          : <span className="text-muted-foreground/40">—</span>}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                        ฿{fmtEgg(skuDisty)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs">
                                        ฿{fmtEgg(skuTotal)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs font-semibold text-primary">
                                        ฿{fmtEgg(skuEggRaw)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                        {skuPct.toFixed(1)}%
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── COMPARE VIEW ── */}
      {viewMode === "compare" && (
        <>
          {loadingCompare && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading comparison…
            </div>
          )}

          {allAnalyses && !loadingCompare && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  เปรียบเทียบต้นทุนไข่ดิบ/ฟอง — {weekDetail?.weekCode}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ตัวเลขสีเขียว = ต้นทุนต่ำสุดในขนาดนั้น · ตัวเลขสีแดง = ต้นทุนสูงสุด
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {compareSizes.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    ไม่พบข้อมูล order สำหรับสัปดาห์นี้
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">ขนาด</TableHead>
                        {allAnalyses.map((a) => {
                          const partner = partnersWithAssumptions.find((p) => p.id === a.partnerId);
                          return (
                            <TableHead key={a.partnerId} className="text-right">
                              {partner?.nickname || partner?.code || `#${a.partnerId}`}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compareSizes.map(({ key, label }) => {
                        const values = allAnalyses.map((a) => {
                          const sizeRow = a.sizes.find((s) => s.primarySize === key);
                          return sizeRow
                            ? { raw: sizeRow.eggRawCostPerEgg, sell: sizeRow.avgSellPerEgg }
                            : null;
                        });
                        const rawValues = values
                          .map((v) => v?.raw)
                          .filter((v): v is number => v !== undefined && v !== null);
                        const minRaw = rawValues.length > 0 ? Math.min(...rawValues) : null;
                        const maxRaw = rawValues.length > 1 ? Math.max(...rawValues) : null;

                        return (
                          <TableRow key={key} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{label}</TableCell>
                            {values.map((val, i) => {
                              const isMin = val !== null && minRaw !== null && val.raw === minRaw;
                              const isMax = val !== null && maxRaw !== null && val.raw === maxRaw && val.raw !== minRaw;
                              return (
                                <TableCell
                                  key={allAnalyses[i].partnerId}
                                  className="text-right tabular-nums"
                                >
                                  {val !== null ? (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span
                                        className={`text-sm font-semibold ${
                                          isMin
                                            ? "text-emerald-700"
                                            : isMax
                                            ? "text-red-600"
                                            : "text-foreground"
                                        }`}
                                      >
                                        ฿{fmtEgg(val.raw)}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        ขาย ฿{fmtEgg(val.sell)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
