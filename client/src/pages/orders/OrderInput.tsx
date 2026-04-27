import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShoppingCart, Eye, Edit, Printer } from "lucide-react";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

const statusColors: Record<string, string> = {
  pending: "outline",
  confirmed: "secondary",
  in_production: "default",
  ready: "secondary",
  delivered: "outline",
};

export default function OrderInput() {
  const [, setLocation] = useLocation();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch orders", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      order.partner?.businessName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    const matchesDate =
      !dateFilter ||
      (order.deliveryDate && order.deliveryDate.startsWith(dateFilter));

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            บันทึกใบสั่งขาย
          </h1>
          <p className="text-muted-foreground">สร้างและจัดการใบสั่งขายลูกค้า</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            data-testid="button-upload-order"
            variant="outline"
            onClick={() => setLocation("/orders/upload")}
          >
            อัปโหลดใบสั่งขาย
          </Button>
          <Button
            data-testid="button-new-order"
            onClick={() => setLocation("/orders/new")}
          >
            สร้างใบสั่งขาย
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div
              className="text-2xl font-bold"
              data-testid="text-pending-count"
            >
              12
            </div>
            <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-today-count">
              28
            </div>
            <p className="text-sm text-muted-foreground">ออเดอร์วันนี้</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div
              className="text-2xl font-bold"
              data-testid="text-production-count"
            >
              8
            </div>
            <p className="text-sm text-muted-foreground">กำลังผลิต</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-ready-count">
              15
            </div>
            <p className="text-sm text-muted-foreground">พร้อมจัดส่ง</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาใบสั่งขาย..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="relative w-[160px]">
              <Input
                type="date"
                className="pr-8"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                data-testid="input-date-filter"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status">
                <SelectValue placeholder="ทุกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="confirmed">ยืนยันแล้ว</SelectItem>
                <SelectItem value="in_production">กำลังผลิต</SelectItem>
                <SelectItem value="ready">พร้อมจัดส่ง</SelectItem>
                <SelectItem value="delivered">จัดส่งแล้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่ใบสั่งขาย</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>วันที่จัดส่ง</TableHead>
                <TableHead>จำนวนรายการ</TableHead>
                <TableHead>จำนวนรวม (ฟอง)</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="w-[120px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    ไม่พบข้อมูลใบสั่งขาย
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.orderNumber}
                    data-testid={`row-order-${order.orderNumber}`}
                  >
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                        {order.orderNumber}
                      </div>
                    </TableCell>
                    <TableCell>{order.partner?.businessName || "-"}</TableCell>
                    <TableCell>{order.deliveryDate}</TableCell>
                    <TableCell>{order.items?.length || 0} รายการ</TableCell>
                    <TableCell>
                      {order.items?.reduce(
                        (sum: number, item: any) =>
                          sum + Number(item.quantity || 0),
                        0,
                      ) || 0}{" "}
                      ถาด
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusColors[order.status] as any}
                        className="capitalize"
                      >
                        {order.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setLocation(`/orders/${order.orderNumber}`)
                          }
                          data-testid={`button-view-${order.orderNumber}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setLocation(`/orders/${order.orderNumber}/edit`)
                          }
                          data-testid={`button-edit-${order.orderNumber}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-print-${order.orderNumber}`}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
