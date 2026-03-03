import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Check, QrCode, Truck, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const pickingTasks = [
  { id: "PICK-001", order: "ORD-20260102-001", customer: "Fresh Mart Supermarket", items: 5, pickedItems: 3, totalQty: 150, pickedQty: 90, priority: "high", status: "in_progress" },
  { id: "PICK-002", order: "ORD-20260102-002", customer: "City Hotel Chain", items: 8, pickedItems: 8, totalQty: 300, pickedQty: 300, priority: "high", status: "completed" },
  { id: "PICK-003", order: "ORD-20260102-003", customer: "Green Valley Restaurant", items: 3, pickedItems: 0, totalQty: 90, pickedQty: 0, priority: "medium", status: "pending" },
  { id: "PICK-004", order: "ORD-20260102-004", customer: "Sunrise Bakery", items: 2, pickedItems: 0, totalQty: 60, pickedQty: 0, priority: "low", status: "pending" },
];

const priorityColors: Record<string, string> = {
  high: "destructive",
  medium: "default",
  low: "outline",
};

export default function OrderPicking() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Order Picking</h1>
          <p className="text-muted-foreground">Pick finished goods for customer orders</p>
        </div>
        <Button variant="outline" data-testid="button-scan-qr">
          <QrCode className="w-4 h-4 mr-2" />
          Scan to Pick
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-pending">8</div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-in-progress">3</div>
                <p className="text-sm text-muted-foreground">In Progress</p>
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
                <div className="text-2xl font-bold" data-testid="text-completed">15</div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-ready">12</div>
                <p className="text-sm text-muted-foreground">Ready to Ship</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search orders..." className="pl-9" data-testid="input-search" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-filter-status">All Status</Button>
              <Button variant="outline" size="sm" data-testid="button-filter-priority">All Priority</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pick ID</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickingTasks.map((task) => (
                <TableRow key={task.id} data-testid={`row-pick-${task.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      {task.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{task.order}</TableCell>
                  <TableCell>{task.customer}</TableCell>
                  <TableCell>{task.pickedItems}/{task.items} items</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={(task.pickedQty / task.totalQty) * 100} className="h-2 flex-1" />
                      <span className="text-xs w-16">{task.pickedQty}/{task.totalQty}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityColors[task.priority] as any} className="capitalize text-xs">
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={task.status === "completed" ? "secondary" : task.status === "in_progress" ? "default" : "outline"}
                      className="capitalize text-xs"
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {task.status !== "completed" && (
                        <Button size="sm" data-testid={`button-pick-${task.id}`}>
                          Start Pick
                        </Button>
                      )}
                      {task.status === "completed" && (
                        <Button size="sm" variant="outline" data-testid={`button-view-${task.id}`}>
                          View
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
