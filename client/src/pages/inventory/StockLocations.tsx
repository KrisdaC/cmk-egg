import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Box, Plus, Eye } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const stockLocations = [
  { id: "RAW-01", name: "Raw Storage 1", area: "Receiving", type: "Cold Storage", capacity: 50000, used: 35000, items: 8 },
  { id: "RAW-02", name: "Raw Storage 2", area: "Receiving", type: "Cold Storage", capacity: 50000, used: 42000, items: 10 },
  { id: "GRAD-01", name: "Grading Buffer", area: "Production", type: "Cold Storage", capacity: 20000, used: 12000, items: 4 },
  { id: "PACK-01", name: "Packing Area", area: "Production", type: "Ambient", capacity: 10000, used: 5500, items: 12 },
  { id: "FG-01", name: "Finished Goods 1", area: "Warehouse", type: "Cold Storage", capacity: 30000, used: 18000, items: 25 },
  { id: "FG-02", name: "Finished Goods 2", area: "Warehouse", type: "Cold Storage", capacity: 30000, used: 22000, items: 30 },
  { id: "PKG-01", name: "Packaging Storage", area: "Warehouse", type: "Ambient", capacity: 5000, used: 3200, items: 15 },
  { id: "SHIP-01", name: "Shipping Dock", area: "Dispatch", type: "Ambient", capacity: 10000, used: 4500, items: 8 },
];

const locationAreas = [
  { name: "Receiving", locations: 2, totalCapacity: 100000, used: 77000 },
  { name: "Production", locations: 2, totalCapacity: 30000, used: 17500 },
  { name: "Warehouse", locations: 3, totalCapacity: 65000, used: 43200 },
  { name: "Dispatch", locations: 1, totalCapacity: 10000, used: 4500 },
];

export default function StockLocations() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Stock Locations</h1>
          <p className="text-muted-foreground">Manage warehouse locations and capacity</p>
        </div>
        <Button data-testid="button-add-location">
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {locationAreas.map((area) => (
          <Card key={area.name}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{area.name}</span>
                <Badge variant="outline">{area.locations} loc</Badge>
              </div>
              <div className="text-2xl font-bold">{Math.round((area.used / area.totalCapacity) * 100)}%</div>
              <p className="text-sm text-muted-foreground">
                {area.used.toLocaleString()} / {area.totalCapacity.toLocaleString()}
              </p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full" 
                  style={{ width: `${(area.used / area.totalCapacity) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search locations..." className="pl-9" data-testid="input-search" />
            </div>
            <Button variant="outline" size="sm" data-testid="button-filter-area">All Areas</Button>
            <Button variant="outline" size="sm" data-testid="button-filter-type">All Types</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockLocations.map((loc) => (
                <TableRow key={loc.id} data-testid={`row-loc-${loc.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {loc.id}
                    </div>
                  </TableCell>
                  <TableCell>{loc.name}</TableCell>
                  <TableCell>{loc.area}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{loc.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{loc.capacity.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{loc.used.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${(loc.used / loc.capacity) > 0.9 ? 'bg-red-500' : 'bg-primary'}`}
                          style={{ width: `${(loc.used / loc.capacity) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs">{Math.round((loc.used / loc.capacity) * 100)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{loc.items}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" data-testid={`button-view-${loc.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
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
