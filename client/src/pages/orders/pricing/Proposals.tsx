import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Settings2,
  BarChart2,
  Printer,
} from "lucide-react";
import QuotationModal from "./QuotationModal";
import {
  StatusBadge,
  PricingStepNav,
  fmt,
  type Partner,
  type PricingWeek,
  type ProposalRow,
  type SiteGroup,
} from "./_shared";
import { SiteGroupManagerDialog } from "./SiteGroupManager";

import { todayBkk } from "@shared/date";
export default function ProposalsPage() {
  const [, navigate] = useLocation();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [weeks, setWeeks] = useState<PricingWeek[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalRow | null>(null);
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

  const fetchSiteGroups = useCallback(async () => {
    const res = await fetch("/api/pricing/site-groups");
    if (res.ok) setSiteGroups(await res.json());
  }, []);

  useEffect(() => {
    fetchProposals();
    fetchWeeks();
    fetchPartners();
    fetchSiteGroups();
  }, [fetchProposals, fetchWeeks, fetchPartners, fetchSiteGroups]);

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
        <h1 className="text-2xl font-bold">ข้อเสนอราคา</h1>
        <p className="text-muted-foreground">สร้างและเจรจาข้อเสนอราคากับลูกค้า</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">ทะเบียนข้อเสนอ</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="ทุกสัปดาห์" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสัปดาห์</SelectItem>
                  {weeks.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.weekCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="draft">ร่าง</SelectItem>
                  <SelectItem value="reviewed">ผ่านตรวจสอบ</SelectItem>
                  <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setSiteGroupManagerOpen(true)}>
                <Settings2 className="w-4 h-4 mr-1" />
                กลุ่มสาขา
              </Button>
              <Button size="sm" onClick={() => navigate("/orders/pricing/proposals/new")}>
                <Plus className="w-4 h-4 mr-1" />
                สร้างข้อเสนอ
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีข้อเสนอ</p>
          ) : (
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_160px_100px_120px_100px_32px] gap-x-4 px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <span>เลขที่ข้อเสนอ</span>
                <span>สัปดาห์</span>
                <span>ลูกค้า</span>
                <span>สถานะ</span>
                <span>ผู้ส่ง</span>
                <span>วันที่สร้าง</span>
                <span />
              </div>
              {filtered.map((p, i) => {
                const rowBg = i % 2 === 0
                  ? "bg-white dark:bg-background"
                  : "bg-slate-50/60 dark:bg-slate-900/30";
                const weekColors: Record<string, string> = {
                  "2026W19": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
                  "2026W18": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                  "2026W17": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
                };
                const wc = p.week?.weekCode?.replace("-", "") ?? "";
                const weekCls = weekColors[wc] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_auto_160px_100px_120px_100px_32px] gap-x-4 items-center px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors ${rowBg}`}
                    onClick={() => openProposalDrawer(p)}
                  >
                    <span className="font-mono text-xs font-semibold text-foreground tracking-tight">{p.proposalNumber}</span>
                    <span>
                      {p.week?.weekCode ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${weekCls}`}>
                          {p.week.weekCode}
                        </span>
                      ) : "—"}
                    </span>
                    <span className="text-xs font-medium text-foreground truncate">{p.partner?.nickname ?? <span className="text-muted-foreground">—</span>}</span>
                    <span><StatusBadge status={p.status} /></span>
                    <span className="text-xs text-muted-foreground truncate">{p.submittedBy ?? "—"}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(p.createdAt).toLocaleDateString("th-TH")}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ProposalDetailSheet
        open={drawerOpen}
        proposal={selectedProposal}
        siteGroups={siteGroups}
        onClose={() => setDrawerOpen(false)}
        onRefresh={async () => {
          await fetchProposals();
          if (selectedProposal) {
            const res = await fetch(`/api/pricing/proposals/${selectedProposal.id}`);
            if (res.ok) setSelectedProposal(await res.json());
          }
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
  siteGroups,
  onClose,
  onRefresh,
}: {
  open: boolean;
  proposal: ProposalRow | null;
  siteGroups: SiteGroup[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [, navigate] = useLocation();
  const [activateOpen, setActivateOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(todayBkk());
  const [submitting, setSubmitting] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);

  const lines = proposal?.lines ?? [];
  const isEditable = proposal?.status === "draft";
  const missingBasePrice = lines.filter((l) => !l.basePrice).length;

  // Which site groups appear in this proposal's exceptions
  const usedGroupIds = new Set(lines.flatMap((l) => (l.exceptions ?? []).map((e) => e.siteGroupId)));
  const exceptionGroups = siteGroups.filter((g) => usedGroupIds.has(g.id));

  const changeStatus = async (status: string) => {
    if (!proposal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pricing/proposals/${proposal.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approvedBy: "Manager" }),
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

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {!proposal ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">กำลังโหลด…</div>
          ) : (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono">{proposal.proposalNumber}</span>
                  <StatusBadge status={proposal.status} />
                </SheetTitle>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>ลูกค้า: <span className="font-medium text-foreground">{proposal.partner?.nickname ?? "—"}</span></div>
                  <div>สัปดาห์: <span className="font-medium text-foreground">{proposal.week?.weekCode ?? "—"}</span></div>
                  {proposal.effectiveDate && (
                    <div>
                      ช่วงวันที่มีผล:{" "}
                      <span className="font-medium text-foreground">
                        {proposal.effectiveDate}
                        {proposal.effectiveDateTo ? ` – ${proposal.effectiveDateTo}` : " เป็นต้นไป"}
                      </span>
                    </div>
                  )}
                  {proposal.approvedByUser && (
                    <div>อนุมัติโดย: <span className="font-medium text-foreground">
                      {[proposal.approvedByUser.firstName, proposal.approvedByUser.lastName].filter(Boolean).join(" ") || proposal.approvedByUser.email}
                    </span></div>
                  )}
                </div>
              </SheetHeader>

              {isEditable && missingBasePrice > 0 && (
                <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-md px-3 py-2 mb-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{missingBasePrice} SKU(s) ยังไม่มีราคาฐาน — ต้องใส่ก่อน approve</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={() => { onClose(); setShowQuotation(true); }}>
                  <Printer className="w-4 h-4 mr-1" />
                  พิมพ์
                </Button>
                {proposal.status === "draft" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        navigate(
                          `/orders/pricing/simulation?weekId=${proposal.week?.id}&partnerId=${proposal.partner?.id}&fromProposal=${proposal.id}`
                        );
                      }}
                    >
                      <BarChart2 className="w-4 h-4 mr-1" />
                      แก้ไขใน Simulation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={submitting || missingBasePrice > 0}
                      onClick={() => changeStatus("reviewed")}
                    >
                      <Lock className="w-4 h-4 mr-1" />
                      ส่งตรวจสอบ
                    </Button>
                  </>
                )}
                {proposal.status === "reviewed" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => changeStatus("draft")}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      ส่งกลับร่าง
                    </Button>
                    <Button
                      size="sm"
                      disabled={submitting}
                      onClick={() => changeStatus("approved")}
                    >
                      <Lock className="w-4 h-4 mr-1" />
                      อนุมัติ
                    </Button>
                  </>
                )}
                {proposal.status === "approved" && (
                  <Button size="sm" onClick={() => setActivateOpen(true)} disabled={submitting}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    เปิดใช้งานราคา
                  </Button>
                )}
              </div>

              <Separator className="mb-4" />

              <div className="mb-2 text-sm font-medium">
                ราคาต่อ SKU ({lines.length} รายการ)
              </div>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีรายการราคา</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>รายการ</TableHead>
                        <TableHead className="text-right text-xs">ราคาอ้างอิง ฿</TableHead>
                        <TableHead className="text-right font-semibold bg-amber-50">ราคาฐาน ฿</TableHead>
                        {exceptionGroups.map((g) => (
                          <TableHead key={g.id} className="text-right text-xs text-blue-700 bg-blue-50">
                            {g.name} ฿
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{line.item?.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{line.item?.sku ?? "—"}</div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {line.referencePrice ? `฿${fmt(line.referencePrice)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold bg-amber-50/50">
                            {line.basePrice ? `฿${fmt(line.basePrice)}` : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          {exceptionGroups.map((g) => {
                            const ex = (line.exceptions ?? []).find((e) => e.siteGroupId === g.id);
                            return (
                              <TableCell key={g.id} className="text-right tabular-nums text-blue-700 bg-blue-50/30">
                                {ex ? `฿${fmt(ex.price)}` : <span className="text-muted-foreground/40 text-xs">—</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {proposal.notes && (
                <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                  <span className="font-medium">หมายเหตุ: </span>
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
            <DialogTitle>เปิดใช้งานราคา</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              จะเปิดใช้งานราคาฐาน {lines.filter((l) => l.basePrice).length} รายการ
              {(exceptionGroups.length > 0) && ` พร้อมราคาพิเศษสำหรับ ${exceptionGroups.length} กลุ่มสาขา`} สำหรับ{" "}
              <strong>{proposal?.partner?.nickname}</strong>
            </p>
            <div>
              <Label className="text-sm">วันที่มีผล</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>ยกเลิก</Button>
            <Button onClick={activatePrices} disabled={submitting}>
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              เปิดใช้งาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showQuotation && proposal && proposal.partner && (
        <QuotationModal
          partnerId={proposal.partner.id}
          dateFrom={proposal.effectiveDate ?? todayBkk()}
          siteGroups={exceptionGroups}
          simItems={lines
            .filter((l) => l.item != null)
            .map((l) => ({
              item: {
                id: l.item!.id,
                sku: l.item!.sku,
                name: l.item!.name,
                primary_size: l.item!.primarySize,
                eggs_per_pack: l.item!.eggsPerPack ?? 1,
              },
              costPrice: null,
              scopes: [
                {
                  key: "default",
                  siteGroupId: null,
                  label: "default",
                  quantity: 0,
                  currentPrice: l.referencePrice ? parseFloat(l.referencePrice) : null,
                },
              ],
            }))}
          proposed={Object.fromEntries([
            ...lines
              .filter((l) => l.item != null && l.basePrice != null)
              .map((l) => [`${l.item!.id}:default`, l.basePrice!]),
            ...lines
              .filter((l) => l.item != null)
              .flatMap((l) =>
                (l.exceptions ?? []).map((ex) => [`${l.item!.id}:${ex.siteGroupId}`, ex.price])
              ),
          ])}
          notes={{}}
          pKey={(itemId, scopeKey) => `${itemId}:${scopeKey}`}
          getVal={(itemId, scopeKey, fallback) => {
            const k = `${itemId}:${scopeKey}`;
            const proposed: Record<string, string> = Object.fromEntries([
              ...lines
                .filter((l) => l.item != null && l.basePrice != null)
                .map((l) => [`${l.item!.id}:default`, l.basePrice!]),
              ...lines
                .filter((l) => l.item != null)
                .flatMap((l) =>
                  (l.exceptions ?? []).map((ex) => [`${l.item!.id}:${ex.siteGroupId}`, ex.price])
                ),
            ]);
            return k in proposed ? proposed[k] : (fallback != null ? fallback.toFixed(2) : "");
          }}
          makerName={
            [proposal.reviewedByUser?.firstName, proposal.reviewedByUser?.lastName].filter(Boolean).join(" ") || proposal.reviewedByUser?.email || null
          }
          approverName={
            [proposal.approvedByUser?.firstName, proposal.approvedByUser?.lastName].filter(Boolean).join(" ") || proposal.approvedByUser?.email || null
          }
          status={proposal.status}
          onClose={() => { setShowQuotation(false); }}
        />
      )}
    </>
  );
}

