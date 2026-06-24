import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight,
  RefreshCw,
  Lock,
  Send,
  X,
  Check,
  MapPin,
  Settings2,
} from "lucide-react";
import {
  StatusBadge,
  ScopeBadge,
  PricingStepNav,
  fmt,
  type Partner,
  type Item,
  type PricingWeek,
  type ProposalRow,
  type ProposalLine,
  type DeliverySite,
  type SiteGroup,
} from "./_shared";

export default function ProposalsPage() {
  const [, navigate] = useLocation();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [siteGroupManagerOpen, setSiteGroupManagerOpen] = useState(false);
  const [weekFilter, setWeekFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchProposals = useCallback(async () => {
    const res = await fetch("/api/pricing/proposals");
    if (res.ok) setProposals(await res.json());
  }, []);

  const fetchWeeks = useCallback(async () => {
    const res = await fetch("/api/pricing/weeks");
    if (res.ok) setWeeks(await res.json());
  }, []);

  const fetchPartners = useCallback(async () => {
    const res = await fetch("/api/business-partners");
    if (res.ok) setPartners(await res.json());
  }, []);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/items");
    if (res.ok) {
      const data = await res.json();
      setItems(Array.isArray(data) ? data : data.items ?? []);
    }
  }, []);

  const fetchSiteGroups = useCallback(async () => {
    const res = await fetch("/api/pricing/site-groups");
    if (res.ok) setSiteGroups(await res.json());
  }, []);

  useEffect(() => {
    fetchProposals();
    fetchWeeks();
    fetchPartners();
    fetchItems();
    fetchSiteGroups();
  }, [fetchProposals, fetchWeeks, fetchPartners, fetchItems, fetchSiteGroups]);

  const openProposalDrawer = async (proposal: ProposalRow) => {
    const res = await fetch(`/api/pricing/proposals/${proposal.id}`);
    if (res.ok) setSelectedProposal(await res.json());
    setDrawerOpen(true);
  };

  const filtered = proposals.filter((p) => {
    const matchWeek = weekFilter === "all" || p.week?.id.toString() === weekFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchWeek && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <PricingStepNav />
      </div>

      <div>
        <h1 className="text-2xl font-bold">Proposals</h1>
        <p className="text-muted-foreground">Create and negotiate price proposals with customers.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Proposal Register</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All weeks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All weeks</SelectItem>
                  {weeks.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.weekCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="counter_pending">Counter Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setSiteGroupManagerOpen(true)}>
                <Settings2 className="w-4 h-4 mr-1" />
                Site Groups
              </Button>
              <Button size="sm" onClick={() => navigate("/orders/pricing/proposals/new")}>
                <Plus className="w-4 h-4 mr-1" />
                New Proposal
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No proposals found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal #</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => openProposalDrawer(p)}>
                    <TableCell className="font-mono text-sm">{p.proposalNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {p.week?.weekCode ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.partner?.nickname ?? "—"}</TableCell>
                    <TableCell>
                      <ScopeBadge
                        scopeType={p.scopeType}
                        siteGroup={siteGroups.find((g) => g.id === p.siteGroupId)}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.submittedBy ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("th-TH")}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openProposalDrawer(p); }}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProposalDetailSheet
        open={drawerOpen}
        proposal={selectedProposal}
        onClose={() => setDrawerOpen(false)}
        onRefresh={async () => {
          await fetchProposals();
          if (selectedProposal) {
            const res = await fetch(`/api/pricing/proposals/${selectedProposal.id}`);
            if (res.ok) setSelectedProposal(await res.json());
          }
        }}
      />

      <CreateProposalDialog
        open={createOpen}
        weeks={weeks}
        partners={partners}
        items={items}
        siteGroups={siteGroups}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          fetchProposals();
        }}
      />

      <SiteGroupManagerDialog
        open={siteGroupManagerOpen}
        siteGroups={siteGroups}
        partners={partners}
        onClose={() => setSiteGroupManagerOpen(false)}
        onRefresh={fetchSiteGroups}
      />
    </div>
  );
}

// =============================================
// PROPOSAL DETAIL SHEET
// =============================================

function ProposalDetailSheet({
  open,
  proposal,
  onClose,
  onRefresh,
}: {
  open: boolean;
  proposal: ProposalRow | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activateOpen, setActivateOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [lineEdits, setLineEdits] = useState<Record<number, { counter: string; final: string }>>({});
  const [savingLine, setSavingLine] = useState<number | null>(null);

  const lines = proposal?.lines ?? [];

  useEffect(() => {
    if (!proposal?.lines) return;
    const initial: Record<number, { counter: string; final: string }> = {};
    proposal.lines.forEach((l) => {
      initial[l.id] = {
        counter: l.counterPrice ?? "",
        final: l.finalLockedPrice ?? "",
      };
    });
    setLineEdits(initial);
  }, [proposal]);

  const isEditable = proposal?.status !== "approved" && proposal?.status !== "rejected";

  const saveLine = async (lineId: number) => {
    if (!proposal) return;
    const edit = lineEdits[lineId];
    if (!edit) return;
    setSavingLine(lineId);
    try {
      const body: Record<string, number> = {};
      if (edit.counter !== "") body.counterPrice = parseFloat(edit.counter);
      if (edit.final !== "") body.finalLockedPrice = parseFloat(edit.final);
      await fetch(`/api/pricing/proposals/${proposal.id}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await onRefresh();
    } finally {
      setSavingLine(null);
    }
  };

  const changeStatus = async (status: string, extra?: Record<string, string>) => {
    if (!proposal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pricing/proposals/${proposal.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message);
        return;
      }
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  const activatePrices = async () => {
    if (!proposal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pricing/proposals/${proposal.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effectiveDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message);
        return;
      }
      setActivateOpen(false);
      await onRefresh();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const missingFinalPrice = lines.filter((l) => {
    const edit = lineEdits[l.id];
    return !l.finalLockedPrice && (!edit?.final || edit.final === "");
  }).length;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {!proposal ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div>
          ) : (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono">{proposal.proposalNumber}</span>
                  <StatusBadge status={proposal.status} />
                </SheetTitle>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Partner: <span className="font-medium text-foreground">{proposal.partner?.nickname ?? "—"}</span></div>
                  <div>Week: <span className="font-medium text-foreground">{proposal.week?.weekCode ?? "—"}</span></div>
                  <div className="flex items-center gap-2">
                    Scope: <ScopeBadge scopeType={proposal.scopeType} />
                  </div>
                  {proposal.approvedBy && (
                    <div>Approved by: <span className="font-medium text-foreground">{proposal.approvedBy}</span></div>
                  )}
                </div>
              </SheetHeader>

              {isEditable && missingFinalPrice > 0 && (
                <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 dark:bg-yellow-950 rounded-md px-3 py-2 mb-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{missingFinalPrice} SKU(s) missing final locked price — required before approval.</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {proposal.status === "draft" && (
                  <Button size="sm" variant="outline" disabled={submitting}
                    onClick={() => changeStatus("submitted", { submittedBy: "User" })}>
                    <Send className="w-4 h-4 mr-1" />
                    Submit to Customer
                  </Button>
                )}
                {proposal.status === "submitted" && (
                  <Button size="sm" variant="outline" disabled={submitting}
                    onClick={() => changeStatus("counter_pending")}>
                    Customer Countered
                  </Button>
                )}
                {(proposal.status === "submitted" || proposal.status === "counter_pending") && (
                  <Button size="sm" disabled={submitting || missingFinalPrice > 0}
                    onClick={() => changeStatus("approved", { approvedBy: "Manager" })}>
                    <Lock className="w-4 h-4 mr-1" />
                    Lock & Approve
                  </Button>
                )}
                {proposal.status === "approved" && (
                  <Button size="sm" onClick={() => setActivateOpen(true)} disabled={submitting}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Activate Prices
                  </Button>
                )}
                {(proposal.status === "draft" || proposal.status === "submitted") && (
                  <Button size="sm" variant="destructive" disabled={submitting}
                    onClick={() => changeStatus("rejected")}>
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                )}
              </div>

              <Separator className="mb-4" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">SKU Price Lines ({lines.length})</span>
                {isEditable && (
                  <span className="text-xs text-muted-foreground">
                    Enter counter &amp; final prices, then click ✓ to save each row.
                  </span>
                )}
              </div>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No SKU lines in this proposal.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU / Item</TableHead>
                        <TableHead className="text-right">Ref</TableHead>
                        <TableHead className="text-right">Proposed</TableHead>
                        <TableHead className="text-right w-[110px]">
                          <span className="text-orange-600">Counter ฿</span>
                        </TableHead>
                        <TableHead className="text-right w-[110px]">
                          <span className="flex items-center justify-end gap-1">
                            <Lock className="w-3 h-3" /> Final ฿
                          </span>
                        </TableHead>
                        {isEditable && <TableHead className="w-[40px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => {
                        const edit = lineEdits[line.id] ?? { counter: "", final: "" };
                        const dirty =
                          edit.counter !== (line.counterPrice ?? "") ||
                          edit.final !== (line.finalLockedPrice ?? "");
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{line.item?.name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground font-mono">{line.item?.sku ?? "—"}</div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {line.referencePrice ? `฿${fmt(line.referencePrice)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {line.proposalPrice ? `฿${fmt(line.proposalPrice)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditable ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={edit.counter}
                                  onChange={(e) =>
                                    setLineEdits((prev) => ({
                                      ...prev,
                                      [line.id]: { ...edit, counter: e.target.value },
                                    }))
                                  }
                                  className="h-7 text-sm text-right w-[90px] ml-auto text-orange-600"
                                  placeholder="0.00"
                                />
                              ) : (
                                <span className="text-orange-600">
                                  {line.counterPrice ? `฿${fmt(line.counterPrice)}` : "—"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditable ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={edit.final}
                                  onChange={(e) =>
                                    setLineEdits((prev) => ({
                                      ...prev,
                                      [line.id]: { ...edit, final: e.target.value },
                                    }))
                                  }
                                  className={`h-7 text-sm text-right w-[90px] ml-auto font-bold ${
                                    edit.final ? "text-green-700" : ""
                                  }`}
                                  placeholder="0.00"
                                />
                              ) : (
                                <span className={line.finalLockedPrice ? "text-green-700 font-bold" : "text-muted-foreground"}>
                                  {line.finalLockedPrice ? `฿${fmt(line.finalLockedPrice)}` : "—"}
                                </span>
                              )}
                            </TableCell>
                            {isEditable && (
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={dirty ? "default" : "ghost"}
                                  className="h-7 w-7 p-0"
                                  disabled={savingLine === line.id || !dirty}
                                  onClick={() => saveLine(line.id)}
                                >
                                  {savingLine === line.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {proposal.notes && (
                <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                  <span className="font-medium">Notes: </span>
                  {proposal.notes}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Prices</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will activate {lines.filter((l) => l.finalLockedPrice).length} prices for{" "}
              <strong>{proposal?.partner?.nickname}</strong> and replace any existing active prices for these SKUs.
            </p>
            <div>
              <Label className="text-sm">Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>Cancel</Button>
            <Button onClick={activatePrices} disabled={submitting}>
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================
// CREATE PROPOSAL DIALOG
// =============================================

function CreateProposalDialog({
  open,
  weeks,
  partners,
  items,
  siteGroups,
  onClose,
  onCreated,
}: {
  open: boolean;
  weeks: PricingWeek[];
  partners: Partner[];
  items: Item[];
  siteGroups: SiteGroup[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [weekId, setWeekId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [scopeType, setScopeType] = useState<"customer" | "site_group" | "delivery_site">("customer");
  const [siteGroupId, setSiteGroupId] = useState("");
  const [deliverySiteId, setDeliverySiteId] = useState("");
  const [deliverySites, setDeliverySites] = useState<DeliverySite[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedLines, setSelectedLines] = useState<
    { itemId: number; proposalPrice: string; referencePrice: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerId) { setDeliverySites([]); return; }
    fetch(`/api/pricing/delivery-sites?partnerId=${partnerId}`)
      .then((r) => r.json())
      .then((data) => setDeliverySites(Array.isArray(data) ? data : []))
      .catch(() => setDeliverySites([]));
  }, [partnerId]);

  const partnerSiteGroups = siteGroups.filter(
    (g) => partnerId && g.partner?.id === Number(partnerId),
  );

  const addLine = (itemId: number) => {
    if (selectedLines.find((l) => l.itemId === itemId)) return;
    setSelectedLines((prev) => [...prev, { itemId, proposalPrice: "", referencePrice: "" }]);
  };

  const removeLine = (itemId: number) => {
    setSelectedLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const updateLine = (itemId: number, field: "proposalPrice" | "referencePrice", value: string) => {
    setSelectedLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, [field]: value } : l)),
    );
  };

  const handleSubmit = async () => {
    if (!weekId || !partnerId) {
      setError("Pricing week and partner are required.");
      return;
    }
    if (scopeType === "site_group" && !siteGroupId) {
      setError("Please select a site group.");
      return;
    }
    if (scopeType === "delivery_site" && !deliverySiteId) {
      setError("Please select a delivery site.");
      return;
    }
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
          lines: selectedLines.map((l) => ({
            itemId: l.itemId,
            proposalPrice: l.proposalPrice ? parseFloat(l.proposalPrice) : undefined,
            referencePrice: l.referencePrice ? parseFloat(l.referencePrice) : undefined,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message ?? "Failed to create proposal");
        return;
      }
      onCreated();
      setWeekId(""); setPartnerId(""); setScopeType("customer");
      setSiteGroupId(""); setDeliverySiteId(""); setNotes(""); setSelectedLines([]);
    } finally {
      setSaving(false);
    }
  };

  const approvedWeeks = weeks.filter((w) => w.status === "approved" || w.status === "active");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Price Proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Pricing Week <span className="text-destructive">*</span></Label>
              {approvedWeeks.length === 0 ? (
                <div className="mt-1 text-sm text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  No approved weeks available
                </div>
              ) : (
                <Select value={weekId} onValueChange={setWeekId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedWeeks.map((w) => (
                      <SelectItem key={w.id} value={w.id.toString()}>
                        {w.weekCode} ({w.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-sm">Partner <span className="text-destructive">*</span></Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select partner" />
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
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Price Scope</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "customer", label: "All Sites", icon: "🏢" },
                { value: "site_group", label: "Site Group", icon: "📍" },
                { value: "delivery_site", label: "Single Site", icon: "🔖" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setScopeType(opt.value as typeof scopeType); setSiteGroupId(""); setDeliverySiteId(""); }}
                  className={`flex flex-col items-center gap-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    scopeType === opt.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {scopeType === "site_group" && (
              <div>
                {partnerSiteGroups.length === 0 ? (
                  <div className="text-sm text-yellow-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No site groups for this partner. Create one via the Site Groups button.
                  </div>
                ) : (
                  <Select value={siteGroupId} onValueChange={setSiteGroupId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select site group" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerSiteGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {scopeType === "delivery_site" && (
              <div>
                {!partnerId ? (
                  <p className="text-sm text-muted-foreground mt-1">Select a partner first.</p>
                ) : deliverySites.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">No delivery sites found for this partner.</p>
                ) : (
                  <Select value={deliverySiteId} onValueChange={setDeliverySiteId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select delivery site" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverySites.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.siteCode} — {s.displayName}
                          {s.province ? ` (${s.province})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} />
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">SKU Lines</Label>
              <Select onValueChange={(v) => addLine(Number(v))}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="+ Add SKU" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id.toString()}>
                      {i.name} {i.sku ? `(${i.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 border rounded-md">
                No SKUs added. Use the dropdown above to add items.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedLines.map((line) => {
                  const item = items.find((i) => i.id === line.itemId);
                  return (
                    <div key={line.itemId} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 text-sm truncate">
                        <div className="font-medium truncate">{item?.name ?? line.itemId}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item?.sku ?? ""}</div>
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ref price"
                          value={line.referencePrice}
                          onChange={(e) => updateLine(line.itemId, "referencePrice", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Proposal price"
                          value={line.proposalPrice}
                          onChange={(e) => updateLine(line.itemId, "proposalPrice", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeLine(line.itemId)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-12 gap-2 px-0 text-xs text-muted-foreground">
                  <div className="col-span-4"></div>
                  <div className="col-span-3">Reference ฿</div>
                  <div className="col-span-3">Proposal ฿</div>
                  <div className="col-span-2"></div>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !weekId || !partnerId}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Create Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// SITE GROUP MANAGER DIALOG
// =============================================

function SiteGroupManagerDialog({
  open,
  siteGroups,
  partners,
  onClose,
  onRefresh,
}: {
  open: boolean;
  siteGroups: SiteGroup[];
  partners: Partner[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [createMode, setCreateMode] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SiteGroup | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPartnerId, setNewPartnerId] = useState("");
  const [allSites, setAllSites] = useState<DeliverySite[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSitesForPartner = async (partnerId: string) => {
    if (!partnerId) { setAllSites([]); return; }
    const res = await fetch(`/api/pricing/delivery-sites?partnerId=${partnerId}`);
    if (res.ok) setAllSites(await res.json());
  };

  const openCreate = () => {
    setCreateMode(true);
    setEditingGroup(null);
    setNewName(""); setNewDescription(""); setNewPartnerId(""); setSelectedSiteIds([]);
  };

  const openEdit = async (group: SiteGroup) => {
    setEditingGroup(group);
    setCreateMode(false);
    setNewName(group.name);
    setNewDescription(group.description ?? "");
    setNewPartnerId(group.partner?.id.toString() ?? "");
    await fetchSitesForPartner(group.partner?.id.toString() ?? "");
    const res = await fetch(`/api/pricing/site-groups/${group.id}`);
    if (res.ok) {
      const detail: SiteGroup = await res.json();
      setSelectedSiteIds((detail.members ?? []).map((m) => m.deliverySite?.id ?? 0).filter(Boolean));
    }
  };

  const handleSave = async () => {
    if (!newName || (!createMode && !editingGroup)) return;
    setSaving(true);
    try {
      if (createMode) {
        await fetch("/api/pricing/site-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId: Number(newPartnerId),
            name: newName,
            description: newDescription || undefined,
            siteIds: selectedSiteIds,
          }),
        });
      } else if (editingGroup) {
        await fetch(`/api/pricing/site-groups/${editingGroup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            description: newDescription || undefined,
            siteIds: selectedSiteIds,
          }),
        });
      }
      await onRefresh();
      setCreateMode(false);
      setEditingGroup(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this site group?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/pricing/site-groups/${id}`, { method: "DELETE" });
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSite = (id: number) => {
    setSelectedSiteIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const isFormOpen = createMode || !!editingGroup;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Site Groups
          </DialogTitle>
        </DialogHeader>

        {!isFormOpen ? (
          <div className="space-y-3 py-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> New Group
              </Button>
            </div>
            {siteGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No site groups yet. Create one to scope proposals to a subset of delivery sites.
              </p>
            ) : (
              <div className="divide-y border rounded-md">
                {siteGroups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <div className="font-medium text-sm">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.partner?.nickname} · {g.description || "No description"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(g)}>
                        Edit
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={deletingId === g.id}
                        onClick={() => handleDelete(g.id)}
                      >
                        {deletingId === g.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <Button size="sm" variant="ghost" className="h-7 px-2"
                onClick={() => { setCreateMode(false); setEditingGroup(null); }}>
                ← Back
              </Button>
              <span className="text-sm font-medium">
                {createMode ? "New Site Group" : `Edit: ${editingGroup?.name}`}
              </span>
            </div>

            {createMode && (
              <div>
                <Label className="text-sm">Partner <span className="text-destructive">*</span></Label>
                <Select value={newPartnerId} onValueChange={(v) => { setNewPartnerId(v); fetchSitesForPartner(v); setSelectedSiteIds([]); }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select partner" />
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
            )}

            <div>
              <Label className="text-sm">Group Name <span className="text-destructive">*</span></Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" placeholder="e.g. Makro North Zone" />
            </div>

            <div>
              <Label className="text-sm">Description</Label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="mt-1" placeholder="Optional" />
            </div>

            <div>
              <Label className="text-sm mb-1 block">
                Delivery Sites ({selectedSiteIds.length} selected)
              </Label>
              {allSites.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {newPartnerId ? "No delivery sites for this partner." : "Select a partner first."}
                </p>
              ) : (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {allSites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                        className="rounded"
                      />
                      <div>
                        <div className="text-sm font-medium">{site.displayName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {site.siteCode}{site.province ? ` · ${site.province}` : ""}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => { setCreateMode(false); setEditingGroup(null); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !newName || (createMode && !newPartnerId)}>
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Save Group
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
