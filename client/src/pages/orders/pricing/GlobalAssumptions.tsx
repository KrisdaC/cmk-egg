import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight,
  RefreshCw,
  Unlock,
  Check,
  UserPlus,
  X,
  MapPin,
  Trash2,
  Upload,
  Download,
  Search,
  Loader2,
  Package,
  Copy,
} from "lucide-react";
import {
  ASSUMPTION_COMPONENTS,
  StatusBadge,
  PricingStepNav,
  type Partner,
  type PricingWeek,
  type SiteGroup,
} from "./_shared";

// assumptionValues: (partnerId, siteGroupId|"customer") → component → { id?, value, unit }
type AssumptionEntry = { id?: number; value: string; unit: string };
type ScopeKey = string; // `${partnerId}:customer` or `${partnerId}:${siteGroupId}`

function scopeKey(partnerId: number, siteGroupId: number | null): ScopeKey {
  return siteGroupId == null ? `${partnerId}:customer` : `${partnerId}:${siteGroupId}`;
}

export default function GlobalAssumptionsPage() {
  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<PricingWeek | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Selected customer tab
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  // Selected sub-tab: null = customer-level; number = siteGroupId
  const [selectedSiteGroupId, setSelectedSiteGroupId] = useState<number | null>(null);
  // Site groups for the selected customer
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);

  // assumption values keyed by scopeKey → component → entry
  const [assumptionValues, setAssumptionValues] = useState<Record<ScopeKey, Record<string, AssumptionEntry>>>({});

  const fetchWeeks = useCallback(async () => {
    const res = await fetch("/api/pricing/weeks");
    if (res.ok) setWeeks(await res.json());
  }, []);

  const fetchPartners = useCallback(async () => {
    const res = await fetch("/api/business-partners");
    if (res.ok) setPartners(await res.json());
  }, []);

  const fetchWeekDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/pricing/weeks/${id}`);
    if (res.ok) setWeekDetail(await res.json());
  }, []);

  const fetchSiteGroups = useCallback(async (partnerId: number) => {
    const res = await fetch(`/api/pricing/site-groups?partnerId=${partnerId}`);
    if (res.ok) setSiteGroups(await res.json());
    else setSiteGroups([]);
  }, []);

  useEffect(() => { fetchWeeks(); fetchPartners(); }, [fetchWeeks, fetchPartners]);

  useEffect(() => {
    if (selectedWeekId) fetchWeekDetail(selectedWeekId);
    else setWeekDetail(null);
  }, [selectedWeekId, fetchWeekDetail]);

  useEffect(() => {
    if (selectedPartnerId) fetchSiteGroups(selectedPartnerId);
    else setSiteGroups([]);
    setSelectedSiteGroupId(null);
  }, [selectedPartnerId, fetchSiteGroups]);

  // Rebuild assumptionValues from weekDetail
  useEffect(() => {
    if (!weekDetail?.assumptions) return;
    const vals: Record<ScopeKey, Record<string, AssumptionEntry>> = {};
    for (const a of weekDetail.assumptions) {
      if (!a.partnerId) continue;
      const key = scopeKey(a.partnerId, a.siteGroupId ?? null);
      if (!vals[key]) vals[key] = {};
      vals[key][a.component] = { id: a.id, value: a.value, unit: a.unit ?? "" };
    }
    setAssumptionValues(vals);

    // Auto-select first partner tab if none selected
    const partnerIds = Array.from(
      new Set(weekDetail.assumptions.map((a) => a.partnerId).filter(Boolean))
    ) as number[];
    if (partnerIds.length > 0 && (selectedPartnerId === null || !partnerIds.includes(selectedPartnerId))) {
      setSelectedPartnerId(partnerIds[0]);
    }
  }, [weekDetail]);

  useEffect(() => { setSelectedPartnerId(null); }, [selectedWeekId]);

  // Pre-fill site group form state with customer-level values for components with no override
  useEffect(() => {
    if (selectedSiteGroupId === null || selectedPartnerId === null) return;
    const sgKey = scopeKey(selectedPartnerId, selectedSiteGroupId);
    const custKey = scopeKey(selectedPartnerId, null);
    setAssumptionValues((prev) => {
      const custVals = prev[custKey] ?? {};
      const existing = prev[sgKey] ?? {};
      const merged: Record<string, AssumptionEntry> = { ...existing };
      for (const { key, defaultUnit } of ASSUMPTION_COMPONENTS) {
        if (!merged[key]) {
          merged[key] = { value: custVals[key]?.value ?? "", unit: custVals[key]?.unit ?? defaultUnit };
        }
      }
      return { ...prev, [sgKey]: merged };
    });
  }, [selectedSiteGroupId, selectedPartnerId]);

  const saveAllAssumptions = async () => {
    if (!selectedWeekId || !selectedPartnerId) return;
    setSaving(true);
    try {
      await Promise.all(
        ASSUMPTION_COMPONENTS
          .map(({ key }) => {
            const val = currentAssumptions[key];
            if (!val?.value) return null;
            return fetch(`/api/pricing/weeks/${selectedWeekId}/assumptions/${key}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                value: parseFloat(val.value),
                unit: val.unit,
                partnerId: selectedPartnerId,
                siteGroupId: selectedSiteGroupId ?? undefined,
              }),
            });
          })
          .filter(Boolean)
      );
      fetchWeekDetail(selectedWeekId);
    } finally {
      setSaving(false);
    }
  };

  const deleteAssumption = async (id: number) => {
    setDeleting(id);
    try {
      await fetch(`/api/pricing/assumptions/${id}`, { method: "DELETE" });
      fetchWeekDetail(selectedWeekId!);
    } finally {
      setDeleting(null);
    }
  };

  const copyFromWeek = async (sourceWeekId: number) => {
    if (!selectedWeekId) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/pricing/weeks/${sourceWeekId}`);
      if (!res.ok) return;
      const sourceWeek: PricingWeek = await res.json();
      const sourceAssumptions = sourceWeek.assumptions ?? [];
      await Promise.all(
        sourceAssumptions.map((a) =>
          fetch(`/api/pricing/weeks/${selectedWeekId}/assumptions/${a.component}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              value: parseFloat(a.value),
              unit: a.unit,
              partnerId: a.partnerId,
              siteGroupId: a.siteGroupId ?? undefined,
            }),
          })
        )
      );
      await fetchWeekDetail(selectedWeekId);
      setCopyFromOpen(false);
    } finally {
      setCopying(false);
    }
  };

  const changeWeekStatus = async (status: string) => {
    if (!selectedWeekId) return;
    const res = await fetch(`/api/pricing/weeks/${selectedWeekId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message);
      return;
    }
    fetchWeeks();
    fetchWeekDetail(selectedWeekId);
  };

  const assumptions = weekDetail?.assumptions ?? [];
  const configuredPartnerIds = Array.from(
    new Set(assumptions.filter((a) => a.siteGroupId == null).map((a) => a.partnerId).filter(Boolean))
  ) as number[];
  const configuredPartners = configuredPartnerIds
    .map((pid) => partners.find((p) => p.id === pid))
    .filter(Boolean) as Partner[];

  const isPartnerComplete = (partnerId: number) => {
    const components = assumptions
      .filter((a) => a.partnerId === partnerId && a.siteGroupId == null)
      .map((a) => a.component);
    return ASSUMPTION_COMPONENTS.every((c) => components.includes(c.key));
  };
  const allComplete = configuredPartners.length > 0 && configuredPartners.every((p) => isPartnerComplete(p.id));
  const unconfiguredPartners = partners.filter((p) => !configuredPartnerIds.includes(p.id));

  const handleAddCustomer = (partnerId: number) => {
    const key = scopeKey(partnerId, null);
    setAssumptionValues((prev) => ({
      ...prev,
      [key]: prev[key] ?? Object.fromEntries(
        ASSUMPTION_COMPONENTS.map((c) => [c.key, { value: "", unit: c.defaultUnit }])
      ),
    }));
    setSelectedPartnerId(partnerId);
    setAddCustomerOpen(false);
  };

  const isEditable = weekDetail?.status === "draft";

  // Current scope for editing
  const currentScopeKey = selectedPartnerId
    ? scopeKey(selectedPartnerId, selectedSiteGroupId)
    : null;
  const currentAssumptions = currentScopeKey ? (assumptionValues[currentScopeKey] ?? {}) : {};

  // Customer-level values (for showing "inherited" placeholders in site group view)
  const customerScopeKey = selectedPartnerId ? scopeKey(selectedPartnerId, null) : null;
  const customerAssumptions = customerScopeKey ? (assumptionValues[customerScopeKey] ?? {}) : {};

  const isViewingSiteGroup = selectedSiteGroupId !== null;

  return (
    <div className="space-y-6">
      <div>
        <PricingStepNav />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">ต้นทุนรวม</h1>
          <p className="text-muted-foreground">กำหนดส่วนประกอบต้นทุนรายสัปดาห์ต่อลูกค้า — ค่าแรง โลจิสติกส์ DC Cost และบรรจุภัณฑ์</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Week List */}
        <Card className="lg:col-span-1 lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">สัปดาห์ราคา</CardTitle>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                สัปดาห์ใหม่
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">ยังไม่มีสัปดาห์ราคา</p>
            ) : (
              <div className="divide-y">
                {weeks.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWeekId(w.id === selectedWeekId ? null : w.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors ${
                      w.id === selectedWeekId ? "bg-muted" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm">{w.weekCode}</div>
                      <div className="text-xs text-muted-foreground">
                        {w.startDate} – {w.endDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.status ?? "draft"} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column — both sections controlled by week selection */}
        <div className="lg:col-span-2 space-y-4">

        {/* Week Detail — Assumptions */}
        <Card>
          {!weekDetail ? (
            <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
              เลือกสัปดาห์เพื่อดูหรือแก้ไขต้นทุน
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">{weekDetail.weekCode}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {weekDetail.startDate} – {weekDetail.endDate}
                      {weekDetail.benchmarkPartner && (
                        <> · อ้างอิง: {weekDetail.benchmarkPartner.nickname}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={weekDetail.status ?? "draft"} />
                    {weekDetail.status === "draft" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setCopyFromOpen(true)}>
                          <Copy className="w-4 h-4 mr-1" />
                          คัดลอกจากสัปดาห์อื่น
                        </Button>
                        <Button size="sm" disabled={!allComplete} onClick={() => changeWeekStatus("approved")}>
                          <Check className="w-4 h-4 mr-1" />
                          อนุมัติ
                        </Button>
                      </>
                    )}
                    {weekDetail.status === "approved" && (
                      <Button size="sm" onClick={() => changeWeekStatus("active")}>
                        <Unlock className="w-4 h-4 mr-1" />
                        เปิดใช้งาน
                      </Button>
                    )}
                  </div>
                </div>
                {weekDetail.status === "draft" && !allComplete && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded-md px-3 py-2 mt-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {configuredPartners.length === 0
                      ? "เพิ่มลูกค้าอย่างน้อย 1 รายและกรอกข้อมูลให้ครบก่อนอนุมัติ"
                      : "กรอกต้นทุนให้ครบทุกรายการสำหรับทุกลูกค้าก่อนอนุมัติ"}
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* ── Customer Tabs ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  {configuredPartners.map((p) => {
                    const complete = isPartnerComplete(p.id);
                    const isSelected = selectedPartnerId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPartnerId(p.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted"
                        }`}
                      >
                        {complete
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          : <div className="w-3.5 h-3.5 rounded-full border-2 border-yellow-400" />}
                        {p.nickname}
                      </button>
                    );
                  })}
                  {/* Newly-added partner not yet saved */}
                  {selectedPartnerId !== null && !configuredPartnerIds.includes(selectedPartnerId) && (() => {
                    const p = partners.find((x) => x.id === selectedPartnerId);
                    return p ? (
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-primary text-primary-foreground border-primary">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-yellow-400/70" />
                        {p.nickname}
                        <X
                          className="w-3 h-3 ml-0.5 opacity-70 hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setSelectedPartnerId(null); }}
                        />
                      </button>
                    ) : null;
                  })()}
                  {isEditable && (
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3 text-xs" onClick={() => setAddCustomerOpen(true)}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      เพิ่มลูกค้า
                    </Button>
                  )}
                </div>

                {selectedPartnerId === null ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {configuredPartners.length === 0
                      ? "เพิ่มลูกค้าเพื่อเริ่มกรอกต้นทุน"
                      : "เลือกแท็บลูกค้าด้านบนเพื่อดูหรือแก้ไขต้นทุน"}
                  </p>
                ) : (
                  <>
                    {/* ── Site Group Sub-tabs ── */}
                    <div className="flex items-center gap-2 flex-wrap border-b pb-3">
                      {/* Customer-level tab */}
                      <button
                        onClick={() => setSelectedSiteGroupId(null)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          !isViewingSiteGroup
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
                        ค่าเริ่มต้น (ลูกค้า)
                      </button>
                      {/* Site group tabs */}
                      {siteGroups.map((g) => {
                        const hasOverrides = assumptions.some(
                          (a) => a.partnerId === selectedPartnerId && a.siteGroupId === g.id
                        );
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedSiteGroupId(g.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              selectedSiteGroupId === g.id
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            }`}
                          >
                            <MapPin className="w-3 h-3" />
                            {g.name}
                            {hasOverrides && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                      {siteGroups.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">
                          ยังไม่มีกลุ่มสาขา — จัดการได้ใน Price Proposals
                        </span>
                      )}
                    </div>


                    {/* ── Assumption Rows ── */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1 mb-2">
                        <div className="col-span-5 pl-[22px]">รายการต้นทุน</div>
                        <div className="col-span-4">ค่า</div>
                        <div className="col-span-3">หน่วย</div>
                      </div>

                      {ASSUMPTION_COMPONENTS.map(({ key, label, defaultUnit }) => {
                        const customerSaved = assumptions.find(
                          (a) => a.partnerId === selectedPartnerId && a.siteGroupId == null && a.component === key
                        );
                        const groupSaved = isViewingSiteGroup
                          ? assumptions.find(
                              (a) => a.partnerId === selectedPartnerId && a.siteGroupId === selectedSiteGroupId && a.component === key
                            )
                          : undefined;

                        const saved = isViewingSiteGroup ? groupSaved : customerSaved;
                        const current = currentAssumptions[key] ?? { value: "", unit: defaultUnit };
                        const hasOverride = !!groupSaved;

                        return (
                          <div key={key} className="grid grid-cols-12 gap-2 items-center rounded-md px-1 py-0.5">
                            <div className="col-span-5 text-sm flex items-center gap-2">
                              {saved
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />
                              }
                              {label}
                            </div>

                            <div className="col-span-4">
                              <Input
                                type="number"
                                step="0.0001"
                                value={current.value}
                                disabled={!isEditable}
                                placeholder="0.0000"
                                onChange={(e) =>
                                  setAssumptionValues((prev) => ({
                                    ...prev,
                                    [currentScopeKey!]: {
                                      ...prev[currentScopeKey!],
                                      [key]: { ...current, value: e.target.value },
                                    },
                                  }))
                                }
                                className="h-8 text-sm"
                              />
                            </div>

                            <div className="col-span-3 flex items-center gap-1">
                              <Input
                                value={current.unit}
                                disabled={!isEditable}
                                placeholder={
                                  isViewingSiteGroup && !hasOverride
                                    ? customerAssumptions[key]?.unit || defaultUnit
                                    : defaultUnit
                                }
                                onChange={(e) =>
                                  setAssumptionValues((prev) => ({
                                    ...prev,
                                    [currentScopeKey!]: {
                                      ...prev[currentScopeKey!],
                                      [key]: { ...current, unit: e.target.value },
                                    },
                                  }))
                                }
                                className="h-8 text-sm"
                              />
                              {/* Clear override button — only shown for site group overrides */}
                              {isEditable && isViewingSiteGroup && hasOverride && saved?.id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 shrink-0 text-muted-foreground hover:text-destructive"
                                  disabled={deleting === saved.id}
                                  title="ลบ override — ใช้ค่าเริ่มต้นของลูกค้า"
                                  onClick={() => deleteAssumption(saved.id!)}
                                >
                                  {deleting === saved.id
                                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                                    : <Trash2 className="w-3 h-3" />}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Save All button ── */}
                    {isEditable && (
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={saveAllAssumptions}
                        >
                          {saving
                            ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />กำลังบันทึก…</>
                            : <><Check className="w-3.5 h-3.5 mr-1.5" />บันทึกทั้งหมด</>}
                        </Button>
                      </div>
                    )}

                    {/* ── Totals ── */}
                    {(() => {
                      const relevantAssumptions = isViewingSiteGroup
                        ? ASSUMPTION_COMPONENTS.map(({ key, defaultUnit }) => {
                            const override = assumptions.find(
                              (a) => a.partnerId === selectedPartnerId && a.siteGroupId === selectedSiteGroupId && a.component === key
                            );
                            const fallback = assumptions.find(
                              (a) => a.partnerId === selectedPartnerId && a.siteGroupId == null && a.component === key
                            );
                            return override ?? fallback;
                          }).filter(Boolean)
                        : assumptions.filter((a) => a.partnerId === selectedPartnerId && a.siteGroupId == null);

                      if (relevantAssumptions.length === 0) return null;
                      const fixedTotal = (relevantAssumptions as typeof assumptions)
                        .filter((a) => a.unit !== "%")
                        .reduce((sum, a) => sum + parseFloat(a!.value || "0"), 0);
                      const disty = (relevantAssumptions as typeof assumptions).find((a) => a!.component === "disty_cost");
                      return (
                        <div className="mt-4 pt-4 border-t space-y-1">
                          {isViewingSiteGroup && (
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                              รวมสำหรับกลุ่มนี้ (รวม inherited)
                            </p>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">ต้นทุนคงที่ / ฟอง</span>
                            <span className="font-bold">฿{fixedTotal.toFixed(4)}</span>
                          </div>
                          {disty && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Disty cost (% ของราคาขาย)</span>
                              <span className="text-muted-foreground">{parseFloat(disty.value).toFixed(2)}%</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Material Costs — same week context */}
        <MaterialCostsSection partners={partners} weekDetail={weekDetail} />

        </div>{/* end right column */}
      </div>

      <CreateWeekDialog
        open={createOpen}
        partners={partners}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); fetchWeeks(); }}
      />

      <AddCustomerDialog
        open={addCustomerOpen}
        partners={unconfiguredPartners}
        onClose={() => setAddCustomerOpen(false)}
        onAdd={handleAddCustomer}
      />

      <CopyFromWeekDialog
        open={copyFromOpen}
        weeks={weeks.filter((w) => w.id !== selectedWeekId)}
        copying={copying}
        onClose={() => setCopyFromOpen(false)}
        onCopy={copyFromWeek}
      />
    </div>
  );
}

// ─── Material Costs Section ────────────────────────────────────────────────────

const TIER_KEYS_MC = ["5000000","1000000","500000","400000","300000","200000","100000","80000","70000","50000","40000","30000","20000","10000","5000"];
const CSV_TIER_COLS_MC = TIER_KEYS_MC.map((k) => `จำนวน ${k}`);

const PARTNER_COLORS_MC: Record<string, string> = {
  ALL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Makro: "bg-blue-100 text-blue-700",
  "Big C": "bg-amber-100 text-amber-700",
  "Big-c": "bg-amber-100 text-amber-700",
  "Lotus's": "bg-green-100 text-green-700",
  Lotus: "bg-green-100 text-green-700",
  "CJ Express": "bg-purple-100 text-purple-700",
  "CJ MORE": "bg-purple-100 text-purple-700",
};

interface MatRate {
  id: number;
  sku: string | null;
  effectiveDate: string;
  supplierName: string;
  partner: string;
  itemDescription: string | null;
  tieredPrices: Record<string, number | null>;
  notes: string | null;
  isCurrent: boolean;
  uploadedAt: string;
  itemType: string | null;
  itemName: string | null;
}

function bestPriceMC(tiers: Record<string, number | null>): number | null {
  for (const k of [...TIER_KEYS_MC].reverse()) {
    if (tiers[k] != null) return tiers[k];
  }
  return null;
}

function parseCSVLineMC(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur.trim()); cur = "";
    } else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseThaiDateMC(d: string): string {
  const parts = d.split("/");
  if (parts.length !== 3) return d;
  const [dd, mm, by] = parts;
  return `${parseInt(by) - 543}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

interface ParsedMatRow { sku: string; effectiveDate: string; supplierName: string; partner: string; itemDescription: string; tieredPrices: Record<string, number | null>; notes: string; }

function parseMatCSV(text: string): ParsedMatRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  const header = parseCSVLineMC(lines[0]).map((h) => h.replace(/﻿/g, "").trim());
  const col = (name: string) => header.findIndex((h) => h === name);
  const skuIdx = col("sku"), dateIdx = col("วันที่เริ่มต้นกำหนด"), supplierIdx = col("Suppliers"),
    partnerIdx = col("ผู้ค้า"), descIdx = col("รายการ"), notesIdx = col("ยกเลิก");
  const tierIdxs = CSV_TIER_COLS_MC.map((c) => col(c));
  const rows: ParsedMatRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCSVLineMC(line);
    const sku = cells[skuIdx]?.trim();
    if (!sku) continue;
    const tieredPrices: Record<string, number | null> = {};
    tierIdxs.forEach((idx, pos) => {
      const val = cells[idx]?.trim();
      const num = val ? parseFloat(val) : NaN;
      tieredPrices[TIER_KEYS_MC[pos]] = val && !isNaN(num) ? num : null;
    });
    rows.push({ sku, effectiveDate: parseThaiDateMC(cells[dateIdx]?.trim() ?? ""), supplierName: cells[supplierIdx]?.trim() ?? "", partner: cells[partnerIdx]?.trim() || "ALL", itemDescription: cells[descIdx]?.trim() ?? "", tieredPrices, notes: cells[notesIdx]?.trim() ?? "" });
  }
  return rows;
}

function MaterialCostsSection({ partners, weekDetail }: { partners: Partner[]; weekDetail: PricingWeek | null }) {
  const [rates, setRates] = useState<MatRate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPartner, setFilterPartner] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchRates = useCallback(async () => {
    const res = await fetch("/api/material-costs");
    if (res.ok) setRates(await res.json());
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const current = rates.filter((r) => r.isCurrent);
  const lastUpload = current.length > 0
    ? current.reduce((a, b) => (a.uploadedAt > b.uploadedAt ? a : b)).uploadedAt
    : null;

  const itemTypes = Array.from(new Set(current.map((r) => r.itemType).filter(Boolean))) as string[];

  const visible = current.filter((r) => {
    if (filterPartner !== "ALL" && r.partner !== filterPartner) return false;
    if (filterType !== "ALL" && r.itemType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.sku ?? "").toLowerCase().includes(q) || (r.itemName ?? r.itemDescription ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = parseMatCSV(text);
    if (!parsed.length) return;
    setUploading(true);
    try {
      const res = await fetch("/api/material-costs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed }),
      });
      if (res.ok) fetchRates();
    } finally {
      setUploading(false);
    }
  }

  const partnerOptions = Array.from(new Set(current.map((r) => r.partner)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" />
              ต้นทุนบรรจุภัณฑ์
              {weekDetail && (
                <span className="text-sm font-normal text-muted-foreground">· {weekDetail.weekCode}</span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              ต้นทุนบรรจุภัณฑ์ที่ต่อหน่วย · ราคาซื้อล่าสุดจากผู้ขาย · อัปเดตด้วยการอัปโหลดไฟล์
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/import/material-costs-test.csv" download>
                <Download className="w-4 h-4 mr-1" />
                ดาวน์โหลดไฟล์ตัวอย่าง
              </a>
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              อัปโหลดไฟล์
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>
        </div>

        {/* Filters — only shown when a week is selected */}
        {weekDetail && <div className="flex items-center gap-2 flex-wrap pt-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหา SKU / ชื่อรายการ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={filterPartner} onValueChange={setFilterPartner}>
            <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกลูกค้า</SelectItem>
              {partnerOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกหมวด</SelectItem>
              {itemTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {visible.length} รายการ
            {lastUpload && (
              <> · อัปโหลดล่าสุด: <span className="font-medium">{new Date(lastUpload).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span></>
            )}
          </span>
        </div>}
      </CardHeader>

      <CardContent className="p-0">
        {!weekDetail ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            เลือกสัปดาห์ราคาทางซ้ายเพื่อดูต้นทุนบรรจุภัณฑ์
          </div>
        ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-4 pl-4" />
                <TableHead className="w-32">SKU</TableHead>
                <TableHead>รายการ</TableHead>
                <TableHead className="w-28">หมวด</TableHead>
                <TableHead className="w-28">วันที่ล่าสุด</TableHead>
                <TableHead className="w-28">ลูกค้า</TableHead>
                <TableHead>SUPPLIER</TableHead>
                <TableHead className="text-right w-32">ต้นทุน / หน่วย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                    {rates.length === 0
                      ? "ยังไม่มีข้อมูลต้นทุน — อัปโหลดไฟล์ CSV เพื่อเริ่มต้น"
                      : "ไม่พบรายการที่ตรงกับตัวกรอง"}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const cost = bestPriceMC(r.tieredPrices);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 pr-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-primary">{r.sku ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate" title={r.itemName ?? r.itemDescription ?? ""}>
                        {r.itemName ?? r.itemDescription ?? <span className="text-muted-foreground italic">ไม่มีชื่อ</span>}
                      </TableCell>
                      <TableCell>
                        {r.itemType ? (
                          <Badge variant="outline" className="text-xs">{r.itemType}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{r.effectiveDate}</TableCell>
                      <TableCell>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PARTNER_COLORS_MC[r.partner] ?? "bg-slate-100 text-slate-700"}`}>
                          {r.partner}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate" title={r.supplierName}>
                        {r.supplierName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {cost != null ? `฿${cost.toFixed(2)}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Copy From Week Dialog ────────────────────────────────────────────────────

function CopyFromWeekDialog({
  open, weeks, copying, onClose, onCopy,
}: {
  open: boolean;
  weeks: PricingWeek[];
  copying: boolean;
  onClose: () => void;
  onCopy: (sourceWeekId: number) => void;
}) {
  const [selected, setSelected] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>คัดลอกต้นทุนจากสัปดาห์อื่น</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            ต้นทุนทั้งหมด (ทุกลูกค้า ทุกกลุ่มสาขา) จากสัปดาห์ที่เลือกจะถูกคัดลอกมายังสัปดาห์นี้
            ข้อมูลที่มีอยู่เดิมจะถูกเขียนทับ
          </p>
          <div>
            <Label className="text-sm">สัปดาห์ต้นทาง</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="เลือกสัปดาห์…" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.id} value={w.id.toString()}>
                    {w.weekCode} · {w.startDate} – {w.endDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {weeks.length === 0 && (
            <p className="text-sm text-muted-foreground italic">ไม่มีสัปดาห์อื่นให้คัดลอก</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={copying}>ยกเลิก</Button>
          <Button onClick={() => onCopy(Number(selected))} disabled={!selected || copying || weeks.length === 0}>
            {copying
              ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" />กำลังคัดลอก…</>
              : <><Copy className="w-4 h-4 mr-1" />คัดลอก</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Customer Dialog ───────────────────────────────────────────────────────

function AddCustomerDialog({
  open, partners, onClose, onAdd,
}: {
  open: boolean; partners: Partner[]; onClose: () => void; onAdd: (partnerId: number) => void;
}) {
  const [selected, setSelected] = useState("");
  const handleAdd = () => { if (!selected) return; onAdd(Number(selected)); setSelected(""); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มลูกค้า</DialogTitle></DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <Label className="text-sm">ลูกค้า</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกลูกค้า…" /></SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.nickname} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {partners.length === 0 && (
            <p className="text-sm text-muted-foreground">ลูกค้าทุกรายมีต้นทุนครบแล้วสำหรับสัปดาห์นี้</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleAdd} disabled={!selected || partners.length === 0}>
            <UserPlus className="w-4 h-4 mr-1" />เพิ่ม
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Week Dialog ────────────────────────────────────────────────────────

function CreateWeekDialog({
  open, partners, onClose, onCreated,
}: {
  open: boolean; partners: Partner[]; onClose: () => void; onCreated: () => void;
}) {
  const [weekCode, setWeekCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [benchmarkPartnerId, setBenchmarkPartnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!weekCode || !startDate || !endDate) { setError("กรุณากรอกรหัสสัปดาห์ วันเริ่มต้น และวันสิ้นสุด"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/pricing/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekCode, startDate, endDate, benchmarkPartnerId: benchmarkPartnerId ? Number(benchmarkPartnerId) : undefined, notes: notes || undefined }),
      });
      if (!res.ok) { const err = await res.json(); setError(err.message ?? "สร้างสัปดาห์ไม่สำเร็จ"); return; }
      onCreated();
      setWeekCode(""); setStartDate(""); setEndDate(""); setBenchmarkPartnerId(""); setNotes("");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>สร้างสัปดาห์ราคาใหม่</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>}
          <div>
            <Label className="text-sm">รหัสสัปดาห์ <span className="text-destructive">*</span></Label>
            <Input placeholder="เช่น 2026-W18" value={weekCode} onChange={(e) => setWeekCode(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">วันเริ่มต้น <span className="text-destructive">*</span></Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">วันสิ้นสุด <span className="text-destructive">*</span></Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">ลูกค้าอ้างอิง</Label>
            <Select value={benchmarkPartnerId} onValueChange={setBenchmarkPartnerId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกลูกค้า (ไม่บังคับ)" /></SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.nickname} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">หมายเหตุ</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            สร้าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
