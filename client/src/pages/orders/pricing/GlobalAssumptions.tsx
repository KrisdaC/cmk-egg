import { useState, useEffect, useCallback } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight,
  RefreshCw,
  Unlock,
  Check,
  UserPlus,
  X,
} from "lucide-react";
import {
  ASSUMPTION_COMPONENTS,
  StatusBadge,
  PricingStepNav,
  type Partner,
  type PricingWeek,
} from "./_shared";

// assumptionValues: partnerId → component → { value, unit }
type PartnerAssumptions = Record<string, { value: string; unit: string }>;

export default function GlobalAssumptionsPage() {
  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<PricingWeek | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // "partnerId:component"
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [assumptionValues, setAssumptionValues] = useState<Record<number, PartnerAssumptions>>({});

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

  useEffect(() => { fetchWeeks(); fetchPartners(); }, [fetchWeeks, fetchPartners]);

  useEffect(() => {
    if (selectedWeekId) fetchWeekDetail(selectedWeekId);
    else setWeekDetail(null);
  }, [selectedWeekId, fetchWeekDetail]);

  // Rebuild assumptionValues from weekDetail
  useEffect(() => {
    if (!weekDetail?.assumptions) return;
    const vals: Record<number, PartnerAssumptions> = {};
    for (const a of weekDetail.assumptions) {
      if (!a.partnerId) continue;
      if (!vals[a.partnerId]) vals[a.partnerId] = {};
      vals[a.partnerId][a.component] = { value: a.value, unit: a.unit ?? "" };
    }
    setAssumptionValues(vals);

    // Auto-select first partner tab if none selected
    const partnerIds = Array.from(new Set(weekDetail.assumptions.map((a) => a.partnerId).filter(Boolean))) as number[];
    if (partnerIds.length > 0 && (selectedPartnerId === null || !partnerIds.includes(selectedPartnerId))) {
      setSelectedPartnerId(partnerIds[0]);
    }
  }, [weekDetail]);

  // Reset selected partner when week changes
  useEffect(() => { setSelectedPartnerId(null); }, [selectedWeekId]);

  const saveAssumption = async (partnerId: number, component: string) => {
    if (!selectedWeekId) return;
    const val = assumptionValues[partnerId]?.[component];
    if (!val?.value) return;
    const key = `${partnerId}:${component}`;
    setSaving(key);
    try {
      await fetch(`/api/pricing/weeks/${selectedWeekId}/assumptions/${component}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: parseFloat(val.value), unit: val.unit, partnerId }),
      });
      fetchWeekDetail(selectedWeekId);
    } finally {
      setSaving(null);
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

  // Unique partners that have at least one assumption recorded
  const configuredPartnerIds = Array.from(new Set(assumptions.map((a) => a.partnerId).filter(Boolean))) as number[];
  const configuredPartners = configuredPartnerIds
    .map((pid) => partners.find((p) => p.id === pid))
    .filter(Boolean) as Partner[];

  // Completeness check: every configured partner must have all 5 components
  const isPartnerComplete = (partnerId: number) => {
    const components = assumptions.filter((a) => a.partnerId === partnerId).map((a) => a.component);
    return ASSUMPTION_COMPONENTS.every((c) => components.includes(c.key));
  };
  const allComplete = configuredPartners.length > 0 && configuredPartners.every((p) => isPartnerComplete(p.id));

  // Partners not yet configured in this week
  const unconfiguredPartners = partners.filter((p) => !configuredPartnerIds.includes(p.id));

  const handleAddCustomer = async (partnerId: number) => {
    // Initialize empty assumption values for this partner
    setAssumptionValues((prev) => ({
      ...prev,
      [partnerId]: prev[partnerId] ?? Object.fromEntries(
        ASSUMPTION_COMPONENTS.map((c) => [c.key, { value: "", unit: c.defaultUnit }])
      ),
    }));
    setSelectedPartnerId(partnerId);
    setAddCustomerOpen(false);
  };

  const currentPartnerAssumptions = selectedPartnerId ? (assumptionValues[selectedPartnerId] ?? {}) : {};
  const isEditable = weekDetail?.status === "draft";

  return (
    <div className="space-y-6">
      <div>
        <PricingStepNav />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Global Assumptions</h1>
          <p className="text-muted-foreground">Set weekly cost components per customer — labor, logistics, DC cost, TTA, and packaging.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Week List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pricing Weeks</CardTitle>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New Week
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No pricing weeks yet.</p>
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

        {/* Week Detail */}
        <Card className="lg:col-span-2">
          {!weekDetail ? (
            <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
              Select a pricing week to view or edit assumptions.
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
                        <> · Benchmark: {weekDetail.benchmarkPartner.nickname}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={weekDetail.status ?? "draft"} />
                    {weekDetail.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!allComplete}
                        onClick={() => changeWeekStatus("approved")}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    {weekDetail.status === "approved" && (
                      <Button size="sm" onClick={() => changeWeekStatus("active")}>
                        <Unlock className="w-4 h-4 mr-1" />
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
                {weekDetail.status === "draft" && !allComplete && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded-md px-3 py-2 mt-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {configuredPartners.length === 0
                      ? "Add at least one customer and complete all 5 components before approving."
                      : "Complete all 5 components for every customer before approving."}
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Customer Tabs */}
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
                        {complete ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-yellow-400" />
                        )}
                        {p.nickname}
                      </button>
                    );
                  })}
                  {/* Also show tab for partner being newly added (not yet saved) */}
                  {selectedPartnerId !== null &&
                    !configuredPartnerIds.includes(selectedPartnerId) && (() => {
                      const p = partners.find((x) => x.id === selectedPartnerId);
                      return p ? (
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-primary text-primary-foreground border-primary"
                        >
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-yellow-400 border-opacity-70" />
                          {p.nickname}
                          <X
                            className="w-3 h-3 ml-0.5 opacity-70 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setSelectedPartnerId(null); }}
                          />
                        </button>
                      ) : null;
                    })()
                  }
                  {isEditable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8 px-3 text-xs"
                      onClick={() => setAddCustomerOpen(true)}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Add Customer
                    </Button>
                  )}
                </div>

                {/* Assumption Rows */}
                {selectedPartnerId === null ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {configuredPartners.length === 0
                      ? "Add a customer to start entering assumptions."
                      : "Select a customer tab above to view or edit their assumptions."}
                  </p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1 mb-2">
                        <div className="col-span-4">Component</div>
                        <div className="col-span-3">Value</div>
                        <div className="col-span-3">Unit</div>
                        <div className="col-span-2"></div>
                      </div>
                      {ASSUMPTION_COMPONENTS.map(({ key, label, defaultUnit }) => {
                        const saved = assumptions.find(
                          (a) => a.partnerId === selectedPartnerId && a.component === key
                        );
                        const current = currentPartnerAssumptions[key] ?? { value: "", unit: defaultUnit };
                        const saveKey = `${selectedPartnerId}:${key}`;
                        return (
                          <div key={key} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4 text-sm font-medium flex items-center gap-2">
                              {saved ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />
                              )}
                              {label}
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                step="0.0001"
                                value={current.value}
                                disabled={!isEditable}
                                onChange={(e) =>
                                  setAssumptionValues((prev) => ({
                                    ...prev,
                                    [selectedPartnerId]: {
                                      ...prev[selectedPartnerId],
                                      [key]: { ...current, value: e.target.value },
                                    },
                                  }))
                                }
                                className="h-8 text-sm"
                                placeholder="0.0000"
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                value={current.unit}
                                disabled={!isEditable}
                                onChange={(e) =>
                                  setAssumptionValues((prev) => ({
                                    ...prev,
                                    [selectedPartnerId]: {
                                      ...prev[selectedPartnerId],
                                      [key]: { ...current, unit: e.target.value },
                                    },
                                  }))
                                }
                                className="h-8 text-sm"
                                placeholder={defaultUnit}
                              />
                            </div>
                            <div className="col-span-2">
                              {isEditable && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-full text-xs"
                                  disabled={saving === saveKey || !current.value}
                                  onClick={() => saveAssumption(selectedPartnerId, key)}
                                >
                                  {saving === saveKey ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : "Save"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total for this partner */}
                    {(() => {
                      const partnerSaved = assumptions.filter((a) => a.partnerId === selectedPartnerId);
                      if (partnerSaved.length === 0) return null;
                      const fixedTotal = partnerSaved
                        .filter((a) => a.unit !== "%")
                        .reduce((sum, a) => sum + parseFloat(a.value || "0"), 0);
                      const disty = partnerSaved.find((a) => a.component === "disty_cost");
                      return (
                        <div className="mt-4 pt-4 border-t space-y-1">
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
    </div>
  );
}

// =============================================
// ADD CUSTOMER DIALOG
// =============================================

function AddCustomerDialog({
  open,
  partners,
  onClose,
  onAdd,
}: {
  open: boolean;
  partners: Partner[];
  onClose: () => void;
  onAdd: (partnerId: number) => void;
}) {
  const [selected, setSelected] = useState("");

  const handleAdd = () => {
    if (!selected) return;
    onAdd(Number(selected));
    setSelected("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Customer Assumptions</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <Label className="text-sm">Customer</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.nickname} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {partners.length === 0 && (
            <p className="text-sm text-muted-foreground">All customers already have assumptions configured for this week.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected || partners.length === 0}>
            <UserPlus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// CREATE WEEK DIALOG
// =============================================

function CreateWeekDialog({
  open,
  partners,
  onClose,
  onCreated,
}: {
  open: boolean;
  partners: Partner[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [weekCode, setWeekCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [benchmarkPartnerId, setBenchmarkPartnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!weekCode || !startDate || !endDate) {
      setError("Week code, start date and end date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pricing/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekCode,
          startDate,
          endDate,
          benchmarkPartnerId: benchmarkPartnerId ? Number(benchmarkPartnerId) : undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message ?? "Failed to create week");
        return;
      }
      onCreated();
      setWeekCode(""); setStartDate(""); setEndDate(""); setBenchmarkPartnerId(""); setNotes("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Pricing Week</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
          )}
          <div>
            <Label className="text-sm">Week Code <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. 2026-W18"
              value={weekCode}
              onChange={(e) => setWeekCode(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Start Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">End Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">Benchmark Customer</Label>
            <Select value={benchmarkPartnerId} onValueChange={setBenchmarkPartnerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select partner (optional)" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.nickname} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
