import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Box, Edit, Trash2 } from "lucide-react";

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
          <h1 className="text-2xl font-bold" data-testid="text-page-title">วัตถุดิบ</h1>
          <p className="text-muted-foreground">รายการวัตถุดิบและบรรจุภัณฑ์ทั้งหมด</p>
        </div>
        <Button data-testid="button-add-material">
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มวัตถุดิบ
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาวัตถุดิบ..."
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-filter-category">ทุกหมวดหมู่</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-md border overflow-hidden">
            <div className="grid items-center px-3 py-2.5 bg-muted/30" style={{gridTemplateColumns: "130px 1fr 130px 70px 110px 90px 80px"}}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">รหัส</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ชื่อวัตถุดิบ</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">หมวดหมู่</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">หน่วย</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">สต็อกขั้นต่ำ</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">สถานะ</div>
              <div />
            </div>
            {sampleMaterials.map((material, idx) => (
              <div
                key={material.id}
                className={`grid items-center px-3 py-2.5 hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-slate-50/60 dark:bg-slate-900/30'}`}
                style={{gridTemplateColumns: "130px 1fr 130px 70px 110px 90px 80px"}}
                data-testid={`row-material-${material.id}`}
              >
                <div className="text-xs font-mono">{material.code}</div>
                <div className="text-xs font-medium">{material.name}</div>
                <div className="text-xs">{material.category}</div>
                <div className="text-xs">{material.unit}</div>
                <div className="text-xs">{material.minStock.toLocaleString()}</div>
                <div>
                  <Badge variant="secondary" className="capitalize text-[10px]">{material.status}</Badge>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-edit-${material.id}`}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-delete-${material.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
