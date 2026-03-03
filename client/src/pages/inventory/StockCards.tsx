import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, ArrowUpRight, ArrowDownLeft, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const stockCardSummary = [
  { sku: "EGG-L-30", name: "Large Eggs 30pc", opening: 450, received: 200, issued: 180, closing: 470, location: "FG-01" },
  { sku: "EGG-M-30", name: "Medium Eggs 30pc", opening: 320, received: 150, issued: 120, closing: 350, location: "FG-01" },
  { sku: "EGG-S-30", name: "Small Eggs 30pc", opening: 180, received: 100, issued: 90, closing: 190, location: "FG-02" },
  { sku: "RM-EGG-UNG", name: "Ungraded Eggs", opening: 25000, received: 16000, issued: 18000, closing: 23000, location: "RAW-01" },
];

const stockMovements = [
  { id: 1, time: "08:45", type: "in", sku: "RM-EGG-UNG", batch: "BATCH-A003", qty: 3000, from: "Supplier", to: "RAW-01", ref: "GR-20260102-004" },
  { id: 2, time: "08:30", type: "out", sku: "RM-EGG-UNG", batch: "BATCH-A001", qty: 5000, from: "RAW-01", to: "Grading A", ref: "PRD-001" },
  { id: 3, time: "08:00", type: "in", sku: "RM-TRAY-30", batch: "PKG-001", qty: 500, from: "Supplier", to: "PKG-01", ref: "GR-20260102-003" },
  { id: 4, time: "07:30", type: "out", sku: "EGG-L-30", batch: "FG-20260101-005", qty: 50, from: "FG-01", to: "SHIP-01", ref: "PICK-002" },
  { id: 5, time: "07:15", type: "in", sku: "RM-EGG-UNG", batch: "BATCH-A002", qty: 8000, from: "Supplier", to: "RAW-02", ref: "GR-20260102-002" },
  { id: 6, time: "06:30", type: "in", sku: "RM-EGG-UNG", batch: "BATCH-A001", qty: 5000, from: "Supplier", to: "RAW-01", ref: "GR-20260102-001" },
];

export default function StockCards() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Stock Cards</h1>
          <p className="text-muted-foreground">Track stock movements and balances</p>
        </div>
        <Button variant="outline" data-testid="button-export">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Balance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right text-green-600">Received</TableHead>
                <TableHead className="text-right text-red-600">Issued</TableHead>
                <TableHead className="text-right font-bold">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockCardSummary.map((item) => (
                <TableRow key={item.sku} data-testid={`row-summary-${item.sku}`}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{item.location}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.opening.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">+{item.received.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-600">-{item.issued.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">{item.closing.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg">Movement History</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9" data-testid="input-search" />
              </div>
              <Select>
                <SelectTrigger className="w-[120px]" data-testid="select-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="in">Received</SelectItem>
                  <SelectItem value="out">Issued</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-[160px]" data-testid="input-date" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockMovements.map((mov) => (
                <TableRow key={mov.id} data-testid={`row-movement-${mov.id}`}>
                  <TableCell>{mov.time}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {mov.type === "in" ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-600" />
                      )}
                      <Badge variant={mov.type === "in" ? "secondary" : "outline"} className="text-xs">
                        {mov.type === "in" ? "IN" : "OUT"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{mov.sku}</TableCell>
                  <TableCell className="font-mono text-xs">{mov.batch}</TableCell>
                  <TableCell className={`text-right font-medium ${mov.type === "in" ? "text-green-600" : "text-red-600"}`}>
                    {mov.type === "in" ? "+" : "-"}{mov.qty.toLocaleString()}
                  </TableCell>
                  <TableCell>{mov.from}</TableCell>
                  <TableCell>{mov.to}</TableCell>
                  <TableCell className="font-mono text-xs">{mov.ref}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
