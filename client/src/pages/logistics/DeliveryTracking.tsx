import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Truck, MapPin, Clock, Check, Phone, RefreshCw } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const activeDeliveries = [
  { id: "DEL-001", driver: "Somchai W.", vehicle: "1กก-1234", customer: "Fresh Mart", zone: "Central", departTime: "08:15", status: "in_transit", eta: "09:00", progress: 65 },
  { id: "DEL-002", driver: "Prasert C.", vehicle: "2ขข-5678", customer: "Green Valley", zone: "North", departTime: "09:10", status: "in_transit", eta: "10:15", progress: 30 },
  { id: "DEL-003", driver: "Wichai S.", vehicle: "3คค-9012", customer: "City Hotel", zone: "Central", departTime: "08:30", status: "delivered", eta: "-", progress: 100 },
];

const deliveryHistory = [
  { id: "DEL-20260101-001", driver: "Somchai W.", customer: "Fresh Mart", departTime: "08:00", arriveTime: "08:45", status: "completed" },
  { id: "DEL-20260101-002", driver: "Prasert C.", customer: "City Hotel", departTime: "09:00", arriveTime: "09:50", status: "completed" },
  { id: "DEL-20260101-003", driver: "Wichai S.", customer: "Green Valley", departTime: "10:00", arriveTime: "11:15", status: "completed" },
  { id: "DEL-20260101-004", driver: "Thaworn D.", customer: "Sunrise Bakery", departTime: "11:00", arriveTime: "11:40", status: "partial" },
];

export default function DeliveryTracking() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Delivery Tracking</h1>
          <p className="text-muted-foreground">Track active deliveries in real-time</p>
        </div>
        <Button variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-active">5</div>
                <p className="text-sm text-muted-foreground">Active Deliveries</p>
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
                <div className="text-2xl font-bold" data-testid="text-completed">18</div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-delayed">1</div>
                <p className="text-sm text-muted-foreground">Delayed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-avg-time">42 min</div>
                <p className="text-sm text-muted-foreground">Avg Delivery Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 animate-pulse text-blue-600" />
            Active Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeDeliveries.map((del) => (
              <div key={del.id} className="p-4 border rounded-md" data-testid={`card-active-${del.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="font-mono font-medium">{del.id}</div>
                    <Badge 
                      variant={del.status === "delivered" ? "secondary" : "default"}
                      className="capitalize text-xs"
                    >
                      {del.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {del.status === "in_transit" && (
                      <span className="text-sm text-muted-foreground">ETA: {del.eta}</span>
                    )}
                    <Button variant="ghost" size="icon" data-testid={`button-call-${del.id}`}>
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">Driver:</span> {del.driver}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vehicle:</span> {del.vehicle}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span> {del.customer}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zone:</span> {del.zone}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${del.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${del.progress}%` }}
                    />
                  </div>
                  <span className="text-xs w-10">{del.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Delivery History</CardTitle>
            <div className="relative w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search history..." className="pl-9" data-testid="input-search" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery ID</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Depart</TableHead>
                <TableHead>Arrive</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryHistory.map((del) => (
                <TableRow key={del.id} data-testid={`row-history-${del.id}`}>
                  <TableCell className="font-mono">{del.id}</TableCell>
                  <TableCell>{del.driver}</TableCell>
                  <TableCell>{del.customer}</TableCell>
                  <TableCell>{del.departTime}</TableCell>
                  <TableCell>{del.arriveTime}</TableCell>
                  <TableCell>45 min</TableCell>
                  <TableCell>
                    <Badge variant={del.status === "completed" ? "secondary" : "outline"} className="capitalize text-xs">
                      {del.status}
                    </Badge>
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
