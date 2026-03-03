import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, BarChart3, TrendingUp, Package, Clock, ShoppingCart, Factory, Warehouse, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const salesByProduct = [
  { sku: "EGG-L-30", name: "Large Eggs 30pc", qty: 1250, value: 150000, growth: 12 },
  { sku: "EGG-M-30", name: "Medium Eggs 30pc", qty: 980, value: 98000, growth: 8 },
  { sku: "EGG-S-30", name: "Small Eggs 30pc", qty: 650, value: 52000, growth: -3 },
  { sku: "EGG-XL-12", name: "Extra Large Eggs 12pc", qty: 320, value: 38400, growth: 15 },
];

const salesByCustomer = [
  { customer: "Fresh Mart Supermarket", orders: 45, value: 125000, percentage: 28 },
  { customer: "City Hotel Chain", orders: 32, value: 98000, percentage: 22 },
  { customer: "Green Valley Restaurant", orders: 28, value: 72000, percentage: 16 },
  { customer: "Sunrise Bakery", orders: 25, value: 58000, percentage: 13 },
];

const inventoryAging = [
  { category: "0-1 days", qty: 45000, percentage: 65 },
  { category: "1-2 days", qty: 18000, percentage: 26 },
  { category: "2+ days", qty: 6000, percentage: 9 },
];

export default function ReportsDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Reports & Dashboard</h1>
          <p className="text-muted-foreground">Business intelligence and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" defaultValue="2026-01-01" className="w-[140px]" data-testid="input-date-from" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" defaultValue="2026-01-31" className="w-[140px]" data-testid="input-date-to" />
          <Button variant="outline" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <ShoppingCart className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-orders">342</div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-revenue">450K</div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
                <Factory className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-production">285K</div>
                <p className="text-sm text-muted-foreground">Eggs Processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-fulfillment">96%</div>
                <p className="text-sm text-muted-foreground">Order Fulfillment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList>
          <TabsTrigger value="sales" data-testid="tab-sales">Sales Report</TabsTrigger>
          <TabsTrigger value="production" data-testid="tab-production">Production Report</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory Report</TabsTrigger>
          <TabsTrigger value="fulfillment" data-testid="tab-fulfillment">Order Fulfillment</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales by Product</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesByProduct.map((item) => (
                      <TableRow key={item.sku} data-testid={`row-product-${item.sku}`}>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{item.qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{item.value.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${item.growth >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {item.growth >= 0 ? "+" : ""}{item.growth}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales by Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesByCustomer.map((item, idx) => (
                    <div key={idx} data-testid={`row-customer-${idx}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{item.customer}</span>
                        <span className="text-sm">{item.value.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={item.percentage} className="h-2 flex-1" />
                        <span className="text-xs w-10">{item.percentage}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{item.orders} orders</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="production" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                <Factory className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Production analytics and efficiency reports</p>
                <p className="text-sm">Grading efficiency, packing output, workstation productivity</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Inventory Aging
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventoryAging.map((item, idx) => (
                    <div key={idx} data-testid={`row-aging-${idx}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{item.category}</span>
                        <span>{item.qty.toLocaleString()} pcs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={item.percentage} 
                          className={`h-3 flex-1 ${idx === 2 ? '[&>div]:bg-red-500' : ''}`} 
                        />
                        <span className="text-sm w-10">{item.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="text-sm">
                    <strong>FIFO Compliance:</strong> 98.5%
                    <p className="text-muted-foreground text-xs mt-1">
                      Oldest inventory is being used first
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock Turnover</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <Warehouse className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Stock turnover and movement analysis</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Order fulfillment rates and delivery performance</p>
                <p className="text-sm">On-time delivery, order accuracy, customer satisfaction</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
