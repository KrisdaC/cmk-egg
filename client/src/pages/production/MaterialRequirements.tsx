import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Box, AlertTriangle, Check, ShoppingCart, Calendar } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const materialRequirements = [
  { id: 1, material: "Ungraded Eggs", code: "RM-EGG-UNG", required: 50000, available: 48000, shortage: 2000, unit: "pcs", status: "shortage" },
  { id: 2, material: "Egg Tray 30-cell", code: "RM-TRAY-30", required: 1500, available: 2000, shortage: 0, unit: "pcs", status: "ok" },
  { id: 3, material: "Tray Lid 30-cell", code: "RM-LID-30", required: 1500, available: 1800, shortage: 0, unit: "pcs", status: "ok" },
  { id: 4, material: "Product Label Roll", code: "RM-LABEL", required: 15, available: 8, shortage: 7, unit: "rolls", status: "shortage" },
  { id: 5, material: "Lot Number Sticker", code: "RM-STICKER", required: 10, available: 25, shortage: 0, unit: "rolls", status: "ok" },
  { id: 6, material: "Plastic Crate", code: "RM-CRATE", required: 50, available: 120, shortage: 0, unit: "pcs", status: "ok" },
];

const workstationRequirements = [
  { workstation: "Grading A", materials: [{ name: "Ungraded Eggs", qty: 15000 }], status: "ready" },
  { workstation: "Grading B", materials: [{ name: "Ungraded Eggs", qty: 12000 }], status: "ready" },
  { workstation: "Packing 1", materials: [{ name: "Tray 30-cell", qty: 500 }, { name: "Lid 30-cell", qty: 500 }], status: "ready" },
  { workstation: "Packing 2", materials: [{ name: "Tray 30-cell", qty: 400 }, { name: "Lid 30-cell", qty: 400 }], status: "ready" },
  { workstation: "Labeling", materials: [{ name: "Label Roll", qty: 8 }, { name: "Lot Sticker", qty: 5 }], status: "shortage" },
];

export default function MaterialRequirements() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Material Requirements</h1>
          <p className="text-muted-foreground">Raw material needs for today's production</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-create-po">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Create PO
          </Button>
          <Button variant="outline" data-testid="button-view-schedule">
            <Calendar className="w-4 h-4 mr-2" />
            View Schedule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-materials-ok">4</div>
                <p className="text-sm text-muted-foreground">Materials OK</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600" data-testid="text-shortages">2</div>
                <p className="text-sm text-muted-foreground">Shortages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                <Box className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-items">6</div>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Material Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialRequirements.map((mat) => (
                  <TableRow key={mat.id} data-testid={`row-material-${mat.id}`}>
                    <TableCell>
                      <div className="font-medium">{mat.material}</div>
                      <div className="text-xs text-muted-foreground font-mono">{mat.code}</div>
                    </TableCell>
                    <TableCell className="text-right">{mat.required.toLocaleString()} {mat.unit}</TableCell>
                    <TableCell className="text-right">{mat.available.toLocaleString()} {mat.unit}</TableCell>
                    <TableCell className={`text-right ${mat.shortage > 0 ? "text-red-600 font-medium" : ""}`}>
                      {mat.shortage > 0 ? `-${mat.shortage.toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mat.status === "ok" ? "secondary" : "destructive"} className="uppercase text-xs">
                        {mat.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Workstation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workstationRequirements.map((ws, idx) => (
                <div key={idx} className="p-3 border rounded-md" data-testid={`card-workstation-${idx}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{ws.workstation}</span>
                    <Badge variant={ws.status === "ready" ? "secondary" : "destructive"} className="capitalize text-xs">
                      {ws.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {ws.materials.map((m, midx) => (
                      <div key={midx} className="flex justify-between">
                        <span>{m.name}</span>
                        <span>{m.qty.toLocaleString()}</span>
                      </div>
                    ))}
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
