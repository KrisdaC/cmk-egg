import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Egg, Package, Box, AlertTriangle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ungradedStock = [
  { batch: "BATCH-A001", supplier: "Happy Farm", receiveDate: "2026-01-02", qty: 5000, location: "RAW-01", age: 0 },
  { batch: "BATCH-A002", supplier: "Golden Hen", receiveDate: "2026-01-02", qty: 8000, location: "RAW-02", age: 0 },
  { batch: "BATCH-20260101-A", supplier: "Happy Farm", receiveDate: "2026-01-01", qty: 3500, location: "RAW-01", age: 1 },
];

const gradedStock = [
  { sku: "Graded Large", qty: 12500, location: "GRAD-01", age: 0 },
  { sku: "Graded Medium", qty: 9800, location: "GRAD-01", age: 0 },
  { sku: "Graded Small", qty: 6200, location: "GRAD-01", age: 0 },
];

const undergradedStock = [
  { batch: "UG-20260102-A", qty: 1450, source: "Grading A", location: "UG-01", age: 0, disposition: "Pending" },
  { batch: "UG-20260101-B", qty: 980, source: "Grading B", location: "UG-01", age: 1, disposition: "Reprocess" },
];

const packagingStock = [
  { code: "RM-TRAY-30", name: "Egg Tray 30-cell", qty: 2000, minStock: 500, location: "PKG-01", status: "ok" },
  { code: "RM-LID-30", name: "Tray Lid 30-cell", qty: 1800, minStock: 500, location: "PKG-01", status: "ok" },
  { code: "RM-LABEL", name: "Product Label Roll", qty: 8, minStock: 50, location: "PKG-01", status: "low" },
  { code: "RM-STICKER", name: "Lot Number Sticker", qty: 25, minStock: 30, location: "PKG-01", status: "low" },
  { code: "RM-CRATE", name: "Plastic Crate", qty: 120, minStock: 100, location: "PKG-02", status: "ok" },
];

export default function StockByCategory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Stock by Category</h1>
        <p className="text-muted-foreground">View stock levels by product category</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Egg className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-ungraded">16,500</div>
                <p className="text-sm text-muted-foreground">Ungraded Eggs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-graded">28,500</div>
                <p className="text-sm text-muted-foreground">Graded Eggs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-undergraded">2,430</div>
                <p className="text-sm text-muted-foreground">Undergraded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
                <Box className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-packaging">5</div>
                <p className="text-sm text-muted-foreground">Packaging Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ungraded" className="w-full">
        <TabsList>
          <TabsTrigger value="ungraded" data-testid="tab-ungraded">Ungraded Eggs</TabsTrigger>
          <TabsTrigger value="graded" data-testid="tab-graded">Graded Eggs</TabsTrigger>
          <TabsTrigger value="undergraded" data-testid="tab-undergraded">Undergraded</TabsTrigger>
          <TabsTrigger value="packaging" data-testid="tab-packaging">Packaging</TabsTrigger>
        </TabsList>

        <TabsContent value="ungraded" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ungraded Eggs Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Receive Date</TableHead>
                    <TableHead className="text-right">Qty (pcs)</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Age (days)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ungradedStock.map((item, idx) => (
                    <TableRow key={idx} data-testid={`row-ungraded-${idx}`}>
                      <TableCell className="font-mono">{item.batch}</TableCell>
                      <TableCell>{item.supplier}</TableCell>
                      <TableCell>{item.receiveDate}</TableCell>
                      <TableCell className="text-right font-medium">{item.qty.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{item.location}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={item.age === 0 ? "secondary" : item.age === 1 ? "default" : "destructive"}>
                          {item.age}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graded" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Graded Eggs Inventory (Buffer)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty (pcs)</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Age (days)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradedStock.map((item, idx) => (
                    <TableRow key={idx} data-testid={`row-graded-${idx}`}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell className="text-right font-medium">{item.qty.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{item.location}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.age}d</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="undergraded" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Undergraded Eggs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Qty (pcs)</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Age (days)</TableHead>
                    <TableHead>Disposition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {undergradedStock.map((item, idx) => (
                    <TableRow key={idx} data-testid={`row-undergraded-${idx}`}>
                      <TableCell className="font-mono">{item.batch}</TableCell>
                      <TableCell className="text-right font-medium">{item.qty.toLocaleString()}</TableCell>
                      <TableCell>{item.source}</TableCell>
                      <TableCell><Badge variant="outline">{item.location}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={item.age === 0 ? "secondary" : "default"}>{item.age}d</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.disposition === "Pending" ? "outline" : "secondary"}>
                          {item.disposition}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Packaging Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packagingStock.map((item, idx) => (
                    <TableRow key={idx} data-testid={`row-packaging-${idx}`}>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right font-medium">{item.qty.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.minStock}</TableCell>
                      <TableCell><Badge variant="outline">{item.location}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={item.status === "ok" ? "secondary" : "destructive"} className="uppercase text-xs">
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
