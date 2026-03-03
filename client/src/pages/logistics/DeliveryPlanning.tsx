import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Truck, MapPin, Plus, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const deliverySchedule = [
  { id: "DEL-001", orders: ["ORD-001", "ORD-002"], customer: "Fresh Mart + City Hotel", zone: "Central", driver: "Somchai W.", vehicle: "1กก-1234", time: "08:00", status: "scheduled" },
  { id: "DEL-002", orders: ["ORD-003"], customer: "Green Valley Restaurant", zone: "North", driver: "Prasert C.", vehicle: "2ขข-5678", time: "09:00", status: "scheduled" },
  { id: "DEL-003", orders: ["ORD-004", "ORD-005", "ORD-006"], customer: "Sunrise + Quick + Metro", zone: "East", driver: "Wichai S.", vehicle: "3คค-9012", time: "10:00", status: "pending" },
  { id: "DEL-004", orders: ["ORD-007"], customer: "Hotel Grand", zone: "South", driver: "Unassigned", vehicle: "Unassigned", time: "11:00", status: "unassigned" },
];

const driverAvailability = [
  { name: "Somchai W.", status: "assigned", deliveries: 1, zone: "Central" },
  { name: "Prasert C.", status: "assigned", deliveries: 1, zone: "North" },
  { name: "Wichai S.", status: "pending", deliveries: 1, zone: "East" },
  { name: "Thaworn D.", status: "available", deliveries: 0, zone: "South" },
  { name: "Manop P.", status: "off_duty", deliveries: 0, zone: "-" },
];

const vehicleStatus = [
  { plate: "1กก-1234", type: "Refrigerated", status: "assigned", driver: "Somchai W." },
  { plate: "2ขข-5678", type: "Refrigerated", status: "assigned", driver: "Prasert C." },
  { plate: "3คค-9012", type: "Pickup", status: "pending", driver: "Wichai S." },
  { plate: "4งง-3456", type: "Refrigerated", status: "maintenance", driver: "-" },
  { plate: "5จจ-7890", type: "Van", status: "available", driver: "-" },
];

export default function DeliveryPlanning() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Delivery Planning</h1>
          <p className="text-muted-foreground">Plan and schedule order deliveries</p>
        </div>
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
          <Button data-testid="button-new-delivery">
            <Plus className="w-4 h-4 mr-2" />
            New Delivery
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-total-deliveries">12</div>
            <p className="text-sm text-muted-foreground">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600" data-testid="text-scheduled">8</div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending">3</div>
            <p className="text-sm text-muted-foreground">Pending Assignment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600" data-testid="text-unassigned">1</div>
            <p className="text-sm text-muted-foreground">Unassigned</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delivery Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery ID</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Customer(s)</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverySchedule.map((del) => (
                <TableRow key={del.id} data-testid={`row-delivery-${del.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      {del.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{del.orders.join(", ")}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{del.customer}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {del.zone}
                    </div>
                  </TableCell>
                  <TableCell>{del.driver}</TableCell>
                  <TableCell className="font-mono text-xs">{del.vehicle}</TableCell>
                  <TableCell>{del.time}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={del.status === "scheduled" ? "secondary" : del.status === "pending" ? "default" : "destructive"}
                      className="capitalize text-xs"
                    >
                      {del.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" data-testid={`button-view-${del.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Driver Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {driverAvailability.map((driver, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-md" data-testid={`card-driver-${idx}`}>
                  <div>
                    <div className="font-medium">{driver.name}</div>
                    <div className="text-sm text-muted-foreground">Zone: {driver.zone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{driver.deliveries} deliveries</span>
                    <Badge 
                      variant={driver.status === "available" ? "secondary" : driver.status === "assigned" ? "default" : "outline"}
                      className="capitalize text-xs"
                    >
                      {driver.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehicle Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vehicleStatus.map((vehicle, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-md" data-testid={`card-vehicle-${idx}`}>
                  <div>
                    <div className="font-mono font-medium">{vehicle.plate}</div>
                    <div className="text-sm text-muted-foreground">{vehicle.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{vehicle.driver}</span>
                    <Badge 
                      variant={vehicle.status === "available" ? "secondary" : vehicle.status === "assigned" ? "default" : vehicle.status === "maintenance" ? "destructive" : "outline"}
                      className="capitalize text-xs"
                    >
                      {vehicle.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
