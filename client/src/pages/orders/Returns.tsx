import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, RotateCcw, Eye, Check, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const sampleReturns = [
  { id: "RET-20260102-001", order: "ORD-20260101-003", customer: "Green Valley Restaurant", date: "2026-01-02", reason: "เสียหายระหว่างขนส่ง", qty: 5, sku: "EGG-L-30", status: "pending" },
  { id: "RET-20260102-002", order: "ORD-20260101-004", customer: "City Hotel Chain", date: "2026-01-02", reason: "สินค้าผิดรายการ", qty: 10, sku: "EGG-M-30", status: "approved" },
  { id: "RET-20260101-003", order: "ORD-20251231-008", customer: "Sunrise Bakery", date: "2026-01-01", reason: "ปัญหาคุณภาพ", qty: 3, sku: "EGG-S-30", status: "completed" },
  { id: "RET-20260101-004", order: "ORD-20251230-012", customer: "Quick Bite Cafe", date: "2026-01-01", reason: "สั่งเกินความต้องการ", qty: 8, sku: "EGG-L-30", status: "rejected" },
];

const statusColors: Record<string, string> = {
  pending: "outline",
  approved: "secondary",
  completed: "default",
  rejected: "destructive",
};

const statusLabels: Record<string, string> = {
  pending: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  completed: "เสร็จสิ้น",
  rejected: "ปฏิเสธ",
};

export default function Returns() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">การคืนสินค้า</h1>
          <p className="text-muted-foreground">จัดการการคืนสินค้าและการคืนเงิน</p>
        </div>
        <Button data-testid="button-new-return">
          <Plus className="w-4 h-4 mr-2" />
          แจ้งคืนสินค้า
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-pending-count">5</div>
            <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-approved-count">3</div>
            <p className="text-sm text-muted-foreground">อนุมัติแล้ว</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-month-returns">42</div>
            <p className="text-sm text-muted-foreground">การคืนสินค้าเดือนนี้</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600" data-testid="text-return-value">8,500</div>
            <p className="text-sm text-muted-foreground">มูลค่าการคืน</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหาการคืนสินค้า..." className="pl-9" data-testid="input-search" />
            </div>
            <Select>
              <SelectTrigger className="w-[140px]" data-testid="select-status">
                <SelectValue placeholder="ทุกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="rejected">ปฏิเสธ</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[160px]" data-testid="select-reason">
                <SelectValue placeholder="ทุกเหตุผล" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเหตุผล</SelectItem>
                <SelectItem value="damaged">เสียหาย</SelectItem>
                <SelectItem value="wrong">สินค้าผิดรายการ</SelectItem>
                <SelectItem value="quality">ปัญหาคุณภาพ</SelectItem>
                <SelectItem value="overorder">สั่งเกิน</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสการคืน</TableHead>
                <TableHead>คำสั่งซื้อ</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead>เหตุผล</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="w-[100px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleReturns.map((ret) => (
                <TableRow key={ret.id} data-testid={`row-return-${ret.id}`}>
                  <TableCell className="font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-muted-foreground" />
                      {ret.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{ret.order}</TableCell>
                  <TableCell>{ret.customer}</TableCell>
                  <TableCell>{ret.date}</TableCell>
                  <TableCell className="font-mono text-xs">{ret.sku}</TableCell>
                  <TableCell className="text-right">{ret.qty} ถาด</TableCell>
                  <TableCell className="text-sm">{ret.reason}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[ret.status] as any}>
                      {statusLabels[ret.status] ?? ret.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" data-testid={`button-view-${ret.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {ret.status === "pending" && (
                        <Button variant="ghost" size="icon" data-testid={`button-approve-${ret.id}`}>
                          <Check className="w-4 h-4" />
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
