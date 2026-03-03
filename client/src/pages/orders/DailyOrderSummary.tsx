import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const summarByProduct = [
  { sku: "EGG-L-30", name: "Large Eggs 30pc", orders: 15, totalQty: 450, confirmed: 380, pending: 70 },
  { sku: "EGG-M-30", name: "Medium Eggs 30pc", orders: 12, totalQty: 320, confirmed: 280, pending: 40 },
  { sku: "EGG-S-30", name: "Small Eggs 30pc", orders: 8, totalQty: 180, confirmed: 180, pending: 0 },
  { sku: "EGG-XL-12", name: "Extra Large Eggs 12pc", orders: 5, totalQty: 60, confirmed: 40, pending: 20 },
  { sku: "EGG-L-360", name: "Large Eggs Bulk", orders: 3, totalQty: 15, confirmed: 15, pending: 0 },
];

const summaryByCustomer = [
  { customer: "Fresh Mart Supermarket", orders: 3, skus: 5, totalQty: 150, value: 15000 },
  { customer: "City Hotel Chain", orders: 2, skus: 8, totalQty: 300, value: 28500 },
  { customer: "Green Valley Restaurant", orders: 1, skus: 3, totalQty: 90, value: 8700 },
  { customer: "Sunrise Bakery", orders: 1, skus: 2, totalQty: 60, value: 5800 },
];

export default function DailyOrderSummary() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Daily Order Summary</h1>
          <p className="text-muted-foreground">Consolidated view of daily orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" data-testid="button-prev-day">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input type="date" defaultValue="2026-01-02" className="border-0 p-0 h-auto w-[130px]" data-testid="input-date" />
              </div>
              <Button variant="outline" size="icon" data-testid="button-next-day">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-4 text-sm">
              <div><span className="text-muted-foreground">Total Orders:</span> <strong>28</strong></div>
              <div><span className="text-muted-foreground">Total Qty:</span> <strong>1,025 trays</strong></div>
              <div><span className="text-muted-foreground">Est. Value:</span> <strong>58,000</strong></div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summarByProduct.map((item) => (
                  <TableRow key={item.sku} data-testid={`row-product-${item.sku}`}>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.orders}</TableCell>
                    <TableCell className="text-right">{item.totalQty}</TableCell>
                    <TableCell className="text-right text-green-600">{item.confirmed}</TableCell>
                    <TableCell className="text-right">
                      {item.pending > 0 ? (
                        <Badge variant="outline">{item.pending}</Badge>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary by Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">SKUs</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByCustomer.map((item, idx) => (
                  <TableRow key={idx} data-testid={`row-customer-${idx}`}>
                    <TableCell className="font-medium">{item.customer}</TableCell>
                    <TableCell className="text-right">{item.orders}</TableCell>
                    <TableCell className="text-right">{item.skus}</TableCell>
                    <TableCell className="text-right">{item.totalQty}</TableCell>
                    <TableCell className="text-right">{item.value.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
