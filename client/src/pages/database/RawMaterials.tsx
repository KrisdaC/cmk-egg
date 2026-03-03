import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Box, Edit, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const sampleMaterials = [
  { id: 1, code: "RM-EGG-UNG", name: "Ungraded Eggs", category: "Raw Eggs", unit: "pcs", minStock: 10000, status: "active" },
  { id: 2, code: "RM-TRAY-30", name: "Egg Tray 30-cell", category: "Packaging", unit: "pcs", minStock: 500, status: "active" },
  { id: 3, code: "RM-LID-30", name: "Tray Lid 30-cell", category: "Packaging", unit: "pcs", minStock: 500, status: "active" },
  { id: 4, code: "RM-CRATE", name: "Plastic Crate", category: "Container", unit: "pcs", minStock: 100, status: "active" },
  { id: 5, code: "RM-LABEL", name: "Product Label Roll", category: "Packaging", unit: "rolls", minStock: 50, status: "active" },
  { id: 6, code: "RM-STICKER", name: "Lot Number Sticker", category: "Packaging", unit: "rolls", minStock: 30, status: "active" },
];

export default function RawMaterials() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Raw Materials</h1>
          <p className="text-muted-foreground">Master list of raw materials and packaging</p>
        </div>
        <Button data-testid="button-add-material">
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search materials..." 
                className="pl-9" 
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-filter-category">All Categories</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Min Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleMaterials.map((material) => (
                <TableRow key={material.id} data-testid={`row-material-${material.id}`}>
                  <TableCell className="font-mono">{material.code}</TableCell>
                  <TableCell className="font-medium">{material.name}</TableCell>
                  <TableCell>{material.category}</TableCell>
                  <TableCell>{material.unit}</TableCell>
                  <TableCell>{material.minStock.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{material.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-edit-${material.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-${material.id}`}>
                        <Trash2 className="w-4 h-4" />
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
