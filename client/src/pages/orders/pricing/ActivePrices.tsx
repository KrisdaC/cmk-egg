import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import {
  StatusBadge,
  PricingStepNav,
  fmt,
  type ActivePriceRow,
} from "./_shared";

export default function ActivePricesPage() {
  const [activePrices, setActivePrices] = useState<ActivePriceRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");

  const fetchActivePrices = useCallback(async () => {
    const res = await fetch("/api/pricing/active-prices");
    if (res.ok) setActivePrices(await res.json());
  }, []);

  useEffect(() => {
    fetchActivePrices();
  }, [fetchActivePrices]);

  const filtered = activePrices.filter(
    (p) => statusFilter === "all" || p.status === statusFilter,
  );

  return (
    <div className="space-y-6">
      <div>
        <PricingStepNav />
      </div>

      <div>
        <h1 className="text-2xl font-bold">ราคาที่ใช้งาน</h1>
        <p className="text-muted-foreground">รายการราคาปัจจุบัน — ราคาที่เปิดใช้งานจากข้อเสนอที่อนุมัติแล้ว</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">รายการราคาที่ใช้งาน</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">ใช้งาน</SelectItem>
                  <SelectItem value="draft">ร่าง</SelectItem>
                  <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="replaced">ถูกแทนที่</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={fetchActivePrices}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีราคา</p>
          ) : (
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-[1fr_100px_140px_100px_110px_110px_100px_120px] gap-x-4 px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <span>รายการ</span>
                <span>SKU</span>
                <span>ลูกค้า</span>
                <span className="text-right">ราคา</span>
                <span>วันที่มีผล</span>
                <span>วันหมดอายุ</span>
                <span>สถานะ</span>
                <span>อนุมัติโดย</span>
              </div>
              {filtered.map((p, i) => {
                const rowBg = i % 2 === 0
                  ? "bg-white dark:bg-background"
                  : "bg-slate-50/60 dark:bg-slate-900/30";
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_100px_140px_100px_110px_110px_100px_120px] gap-x-4 items-center px-4 py-3 ${rowBg}`}
                  >
                    <span className="text-xs font-medium text-foreground truncate">{p.item?.name ?? "—"}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.item?.sku ?? "—"}</span>
                    <span className="text-xs text-foreground truncate">{p.partner?.nickname ?? <span className="text-muted-foreground">—</span>}</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums text-right">฿{fmt(p.price)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.effectiveDate}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.expiryDate ?? "—"}</span>
                    <span><StatusBadge status={p.status} /></span>
                    <span className="text-xs text-muted-foreground truncate">{p.approvedBy ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
