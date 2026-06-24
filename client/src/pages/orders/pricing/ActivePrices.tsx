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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import {
  StatusBadge,
  ScopeBadge,
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
        <h1 className="text-2xl font-bold">Active Prices</h1>
        <p className="text-muted-foreground">The current live price list — prices activated from approved proposals.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Active Price List</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="replaced">Replaced</SelectItem>
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
            <p className="text-sm text-muted-foreground py-4 text-center">No prices found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.item?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.item?.sku ?? "—"}</TableCell>
                    <TableCell>{p.partner?.nickname ?? "—"}</TableCell>
                    <TableCell><ScopeBadge scopeType={p.scopeType} /></TableCell>
                    <TableCell className="text-right font-medium">฿{fmt(p.price)}</TableCell>
                    <TableCell className="text-sm">{p.effectiveDate}</TableCell>
                    <TableCell className="text-sm">{p.expiryDate ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.approvedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
