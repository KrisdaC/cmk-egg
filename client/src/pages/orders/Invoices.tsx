import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Download, Printer, Eye, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const sampleInvoices = [
  { id: "INV-20260102-001", order: "ORD-20260102-001", customer: "Fresh Mart Supermarket", date: "2026-01-02", amount: 15000, dueDate: "2026-02-01", status: "pending" },
  { id: "INV-20260102-002", order: "ORD-20260102-002", customer: "City Hotel Chain", date: "2026-01-02", amount: 28500, dueDate: "2026-02-01", status: "sent" },
  { id: "INV-20260101-003", order: "ORD-20260101-003", customer: "Green Valley Restaurant", date: "2026-01-01", amount: 8700, dueDate: "2026-01-16", status: "paid" },
  { id: "INV-20260101-004", order: "ORD-20260101-004", customer: "Sunrise Bakery", date: "2026-01-01", amount: 5800, dueDate: "2026-01-08", status: "overdue" },
];

const statusColors: Record<string, string> = {
  pending: "outline",
  sent: "secondary",
  paid: "default",
  overdue: "destructive",
};

export default function Invoices() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Invoices</h1>
          <p className="text-muted-foreground">Generate and manage customer invoices</p>
        </div>
        <Button data-testid="button-generate-invoice">
          <FileText className="w-4 h-4 mr-2" />
          Generate Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-pending-count">8</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-sent-count">15</div>
            <p className="text-sm text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600" data-testid="text-paid-amount">125,000</div>
            <p className="text-sm text-muted-foreground">Paid This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600" data-testid="text-overdue-amount">18,500</div>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." className="pl-9" data-testid="input-search" />
            </div>
            <Input type="date" className="w-[160px]" data-testid="input-date-from" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" className="w-[160px]" data-testid="input-date-to" />
            <Select>
              <SelectTrigger className="w-[130px]" data-testid="select-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleInvoices.map((invoice) => (
                <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {invoice.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{invoice.order}</TableCell>
                  <TableCell>{invoice.customer}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell className="text-right font-medium">{invoice.amount.toLocaleString()}</TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[invoice.status] as any} className="capitalize">
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${invoice.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-download-${invoice.id}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-send-${invoice.id}`}>
                        <Send className="w-4 h-4" />
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
