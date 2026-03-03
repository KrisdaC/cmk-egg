import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShoppingCart, Eye, Edit, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const sampleOrders = [
  { id: "ORD-20260102-001", customer: "Fresh Mart Supermarket", deliveryDate: "2026-01-03", items: 5, totalQty: 150, status: "pending" },
  { id: "ORD-20260102-002", customer: "Green Valley Restaurant", deliveryDate: "2026-01-03", items: 3, totalQty: 90, status: "confirmed" },
  { id: "ORD-20260102-003", customer: "Sunrise Bakery", deliveryDate: "2026-01-03", items: 2, totalQty: 60, status: "in_production" },
  { id: "ORD-20260101-004", customer: "City Hotel Chain", deliveryDate: "2026-01-02", items: 8, totalQty: 300, status: "ready" },
  { id: "ORD-20260101-005", customer: "Quick Bite Cafe", deliveryDate: "2026-01-02", items: 1, totalQty: 30, status: "delivered" },
];

const statusColors: Record<string, string> = {
  pending: "outline",
  confirmed: "secondary",
  in_production: "default",
  ready: "secondary",
  delivered: "outline",
};

export default function OrderInput() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Order Input</h1>
          <p className="text-muted-foreground">Create and manage customer orders</p>
        </div>
        <Button data-testid="button-new-order">
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-pending-count">12</div>
            <p className="text-sm text-muted-foreground">Pending Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-today-count">28</div>
            <p className="text-sm text-muted-foreground">Today's Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-production-count">8</div>
            <p className="text-sm text-muted-foreground">In Production</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-ready-count">15</div>
            <p className="text-sm text-muted-foreground">Ready for Delivery</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search orders..." 
                className="pl-9" 
                data-testid="input-search"
              />
            </div>
            <Input type="date" className="w-[160px]" data-testid="input-date-filter" />
            <Select>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_production">In Production</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleOrders.map((order) => (
                <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                      {order.id}
                    </div>
                  </TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.deliveryDate}</TableCell>
                  <TableCell>{order.items} SKUs</TableCell>
                  <TableCell>{order.totalQty} trays</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[order.status] as any} className="capitalize">
                      {order.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${order.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-edit-${order.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-print-${order.id}`}>
                        <Printer className="w-4 h-4" />
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
