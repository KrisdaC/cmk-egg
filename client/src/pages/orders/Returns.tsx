import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, RotateCcw, Eye, Check, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const sampleReturns = [
  { id: "RET-20260102-001", order: "ORD-20260101-003", customer: "Green Valley Restaurant", date: "2026-01-02", reason: "Damaged in transit", qty: 5, sku: "EGG-L-30", status: "pending" },
  { id: "RET-20260102-002", order: "ORD-20260101-004", customer: "City Hotel Chain", date: "2026-01-02", reason: "Wrong product delivered", qty: 10, sku: "EGG-M-30", status: "approved" },
  { id: "RET-20260101-003", order: "ORD-20251231-008", customer: "Sunrise Bakery", date: "2026-01-01", reason: "Quality issue", qty: 3, sku: "EGG-S-30", status: "completed" },
  { id: "RET-20260101-004", order: "ORD-20251230-012", customer: "Quick Bite Cafe", date: "2026-01-01", reason: "Over-ordered", qty: 8, sku: "EGG-L-30", status: "rejected" },
];

const statusColors: Record<string, string> = {
  pending: "outline",
  approved: "secondary",
  completed: "default",
  rejected: "destructive",
};

export default function Returns() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Returns</h1>
          <p className="text-muted-foreground">Manage product returns and refunds</p>
        </div>
        <Button data-testid="button-new-return">
          <Plus className="w-4 h-4 mr-2" />
          New Return
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-pending-count">5</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-approved-count">3</div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-month-returns">42</div>
            <p className="text-sm text-muted-foreground">Returns This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600" data-testid="text-return-value">8,500</div>
            <p className="text-sm text-muted-foreground">Return Value</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search returns..." className="pl-9" data-testid="input-search" />
            </div>
            <Select>
              <SelectTrigger className="w-[130px]" data-testid="select-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[150px]" data-testid="select-reason">
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="wrong">Wrong Product</SelectItem>
                <SelectItem value="quality">Quality Issue</SelectItem>
                <SelectItem value="overorder">Over-ordered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return ID</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleReturns.map((ret) => (
                <TableRow key={ret.id} data-testid={`row-return-${ret.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-muted-foreground" />
                      {ret.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{ret.order}</TableCell>
                  <TableCell>{ret.customer}</TableCell>
                  <TableCell>{ret.date}</TableCell>
                  <TableCell className="font-mono text-xs">{ret.sku}</TableCell>
                  <TableCell className="text-right">{ret.qty} trays</TableCell>
                  <TableCell className="text-sm">{ret.reason}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[ret.status] as any} className="capitalize">
                      {ret.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${ret.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {ret.status === "pending" && (
                        <Button variant="ghost" size="icon" data-testid={`button-approve-${ret.id}`}>
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
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
