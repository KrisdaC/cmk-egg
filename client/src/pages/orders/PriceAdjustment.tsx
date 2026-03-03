import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Check, X, Clock, AlertTriangle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const pendingAdjustments = [
  { id: 1, order: "ORD-20260102-001", customer: "Fresh Mart Supermarket", sku: "EGG-L-30", originalPrice: 120, requestedPrice: 115, reason: "Bulk discount", requestedBy: "Sales Rep A", status: "pending" },
  { id: 2, order: "ORD-20260102-002", customer: "City Hotel Chain", sku: "EGG-M-30", originalPrice: 100, requestedPrice: 95, reason: "Long-term customer", requestedBy: "Sales Rep B", status: "pending" },
  { id: 3, order: "ORD-20260102-003", customer: "Green Valley Restaurant", sku: "EGG-XL-12", originalPrice: 85, requestedPrice: 80, reason: "Competitive pricing", requestedBy: "Sales Rep A", status: "pending" },
];

const historyAdjustments = [
  { id: 4, order: "ORD-20260101-010", customer: "Sunrise Bakery", sku: "EGG-L-30", originalPrice: 120, adjustedPrice: 118, approvedBy: "Manager A", status: "approved" },
  { id: 5, order: "ORD-20260101-011", customer: "Quick Bite Cafe", sku: "EGG-S-30", originalPrice: 80, adjustedPrice: 75, approvedBy: "-", status: "rejected" },
];

export default function PriceAdjustment() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Price Adjustment</h1>
          <p className="text-muted-foreground">Review and approve price change requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-pending-count">3</div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-approved-count">24</div>
                <p className="text-sm text-muted-foreground">Approved This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-rejected-count">5</div>
                <p className="text-sm text-muted-foreground">Rejected This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Pending Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingAdjustments.map((adj) => (
                <TableRow key={adj.id} data-testid={`row-pending-${adj.id}`}>
                  <TableCell className="font-mono">{adj.order}</TableCell>
                  <TableCell>{adj.customer}</TableCell>
                  <TableCell className="font-mono text-xs">{adj.sku}</TableCell>
                  <TableCell className="text-right">{adj.originalPrice}</TableCell>
                  <TableCell className="text-right font-medium">{adj.requestedPrice}</TableCell>
                  <TableCell className="text-right text-red-600">
                    -{((adj.originalPrice - adj.requestedPrice) / adj.originalPrice * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{adj.reason}</TableCell>
                  <TableCell>{adj.requestedBy}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" data-testid={`button-approve-${adj.id}`}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`button-reject-${adj.id}`}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Recent History</CardTitle>
            <div className="relative w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search history..." className="pl-9" data-testid="input-search-history" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Adjusted</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyAdjustments.map((adj) => (
                <TableRow key={adj.id} data-testid={`row-history-${adj.id}`}>
                  <TableCell className="font-mono">{adj.order}</TableCell>
                  <TableCell>{adj.customer}</TableCell>
                  <TableCell className="font-mono text-xs">{adj.sku}</TableCell>
                  <TableCell className="text-right">{adj.originalPrice}</TableCell>
                  <TableCell className="text-right">{adj.adjustedPrice}</TableCell>
                  <TableCell>{adj.approvedBy}</TableCell>
                  <TableCell>
                    <Badge variant={adj.status === "approved" ? "secondary" : "outline"} className="capitalize">
                      {adj.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
