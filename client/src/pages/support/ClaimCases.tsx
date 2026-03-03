import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertCircle, Eye, MessageSquare, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const claimCases = [
  { id: "CLM-20260102-001", order: "ORD-20260101-005", customer: "Fresh Mart", type: "Damaged Product", qty: 10, value: 1200, createdAt: "2026-01-02 09:15", status: "open", priority: "high" },
  { id: "CLM-20260102-002", order: "ORD-20260101-008", customer: "City Hotel", type: "Wrong Delivery", qty: 5, value: 600, createdAt: "2026-01-02 10:30", status: "investigating", priority: "medium" },
  { id: "CLM-20260101-003", order: "ORD-20251231-012", customer: "Green Valley", type: "Quality Issue", qty: 15, value: 1800, createdAt: "2026-01-01 14:20", status: "resolved", priority: "high" },
  { id: "CLM-20260101-004", order: "ORD-20251230-025", customer: "Sunrise Bakery", type: "Short Delivery", qty: 3, value: 360, createdAt: "2026-01-01 11:45", status: "closed", priority: "low" },
];

const statusColors: Record<string, string> = {
  open: "destructive",
  investigating: "default",
  resolved: "secondary",
  closed: "outline",
};

const priorityColors: Record<string, string> = {
  high: "destructive",
  medium: "default",
  low: "outline",
};

export default function ClaimCases() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Claim Cases</h1>
          <p className="text-muted-foreground">Manage customer complaints and claims</p>
        </div>
        <Button data-testid="button-new-claim">
          <Plus className="w-4 h-4 mr-2" />
          New Claim
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600" data-testid="text-open">5</div>
                <p className="text-sm text-muted-foreground">Open Cases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900">
                <Search className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-investigating">3</div>
                <p className="text-sm text-muted-foreground">Investigating</p>
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
                <div className="text-2xl font-bold" data-testid="text-resolved">12</div>
                <p className="text-sm text-muted-foreground">Resolved This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-value">8,500</div>
            <p className="text-sm text-muted-foreground">Total Claim Value</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search claims..." className="pl-9" data-testid="input-search" />
            </div>
            <Select>
              <SelectTrigger className="w-[140px]" data-testid="select-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[130px]" data-testid="select-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="damaged">Damaged Product</SelectItem>
                <SelectItem value="wrong">Wrong Delivery</SelectItem>
                <SelectItem value="quality">Quality Issue</SelectItem>
                <SelectItem value="short">Short Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claimCases.map((claim) => (
                <TableRow key={claim.id} data-testid={`row-claim-${claim.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      {claim.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{claim.order}</TableCell>
                  <TableCell>{claim.customer}</TableCell>
                  <TableCell className="text-sm">{claim.type}</TableCell>
                  <TableCell className="text-right">{claim.qty}</TableCell>
                  <TableCell className="text-right font-medium">{claim.value.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{claim.createdAt}</TableCell>
                  <TableCell>
                    <Badge variant={priorityColors[claim.priority] as any} className="capitalize text-xs">
                      {claim.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[claim.status] as any} className="capitalize text-xs">
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${claim.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-comment-${claim.id}`}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
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
