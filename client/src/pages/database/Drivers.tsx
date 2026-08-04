import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  UserCircle,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { deleteDriver, getDrivers } from "@/lib/api/drivers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDriverSchema } from "@shared/schema";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertDriver } from "@/lib/api/drivers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Drivers() {
  const queryClient = useQueryClient();

  const {
    data: drivers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["drivers"],
    queryFn: getDrivers,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Driver | null>(null);
  const [search, setSearch] = useState("");
  const [deleteDriverId, setDeleteDriverId] = useState<number | null>(null);

  const driverForm = useForm<DriverFormValues>({
    resolver: zodResolver(insertDriverSchema),
    defaultValues: {
      code: "",
      name: "",
      licenseNumber: "",
      phone: "",
      email: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!editingItem) {
      driverForm.reset({
        code: "",
        name: "",
        licenseNumber: "",
        phone: "",
        email: "",
        isActive: true,
      });
      return;
    }

    if (isLoading) return null;
    if (isError) return <div>Failed to load drivers.</div>;

    driverForm.reset({
      code: editingItem.code ?? "",
      name: editingItem.name ?? "",
      licenseNumber: editingItem.licenseNumber ?? "",
      phone: editingItem.phone ?? "",
      email: editingItem.email ?? "",
      isActive: editingItem.isActive ?? true,
    });
  }, [editingItem, driverForm]);

  const upsertMutation = useMutation({
    mutationFn: upsertDriver,

    onError: (error: any) => {
      // Backend sends: { message, field }
      if (error.field) {
        driverForm.setError(error.field as any, {
          type: "manual",
          message: error.message,
        });
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setDialogOpen(false);
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setDeleteDriverId(null); // close dialog
    },
  });

  function onSubmit(values: DriverFormValues) {
    if (editingItem) {
      upsertMutation.mutate({ id: editingItem.id, ...values });
    } else {
      upsertMutation.mutate(values);
    }
  }

  if (isLoading) {
    return <div className="p-6">Loading drivers…</div>;
  }

  if (isError) {
    return <div className="p-6">Failed to load drivers.</div>;
  }

  type DriverFormValues = z.infer<typeof insertDriverSchema>;
  type Driver = typeof drivers.$inferSelect;

  const filteredDrivers = drivers.filter((driver: any) => {
    const q = search.toLowerCase();
    return (
      driver.code?.toLowerCase().includes(q) ||
      driver.name?.toLowerCase().includes(q) ||
      driver.phone?.toLowerCase().includes(q) ||
      driver.licenseNumber?.toLowerCase().includes(q) ||
      driver.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            พนักงานขับรถ
          </h1>
          <p className="text-muted-foreground">จัดการพนักงานขับรถส่งสินค้า</p>
        </div>
        <Button
          data-testid="button-add-driver"
          onClick={() => {
            setEditingItem(null);
            driverForm.reset({
              code: "",
              name: "",
              licenseNumber: "",
              phone: "",
              email: "",
              isActive: true,
            });
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มพนักงานขับรถ
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingItem(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "แก้ไขพนักงานขับรถ" : "เพิ่มพนักงานขับรถ"}
            </DialogTitle>
            <DialogDescription>กรอกข้อมูลพนักงานขับรถ</DialogDescription>
          </DialogHeader>

          <Form {...driverForm}>
            <form
              onSubmit={driverForm.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {/* Code + Name */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={driverForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัส *</FormLabel>
                      <FormControl>
                        <Input placeholder="DRV-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={driverForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อพนักงาน *</FormLabel>
                      <FormControl>
                        <Input placeholder="สมชาย ใจดี" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* License + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={driverForm.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>เลขที่ใบขับขี่</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={driverForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>เบอร์โทร</FormLabel>
                      <FormControl>
                        <Input placeholder="0812345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email */}
              <FormField
                control={driverForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="driver@email.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active */}
              <FormField
                control={driverForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </FormControl>
                    <FormLabel className="font-normal">ใช้งาน</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit">
                  {editingItem ? "บันทึก" : "สร้าง"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteDriverId !== null}
        onOpenChange={() => setDeleteDriverId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบพนักงานขับรถ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานขับรถนี้?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() =>
                deleteDriverId && deleteMutation.mutate(deleteDriverId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-supplier"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาพนักงานขับรถ..."
                className="pl-9"
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-md border overflow-hidden">
            <div className="grid items-center px-3 py-2.5 bg-muted/30" style={{gridTemplateColumns: "100px 1fr 140px 160px 90px 80px"}}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">รหัส</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ชื่อพนักงาน</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">เบอร์โทร</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ใบขับขี่</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">สถานะ</div>
              <div />
            </div>
            {filteredDrivers.map((driver: any, idx: number) => (
              <div
                key={driver.id}
                className={`grid items-center px-3 py-2.5 hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-slate-50/60 dark:bg-slate-900/30'}`}
                style={{gridTemplateColumns: "100px 1fr 140px 160px 90px 80px"}}
                data-testid={`row-driver-${driver.id}`}
              >
                <div className="text-xs font-mono">{driver.code}</div>
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {driver.name}
                </div>
                <div className="text-xs flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  {driver.phone}
                </div>
                <div className="text-xs font-mono">{driver.licenseNumber}</div>
                <div>
                  <Badge variant={driver.isActive ? "secondary" : "outline"} className="capitalize text-[10px]">
                    {driver.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                  </Badge>
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-testid={`button-edit-${driver.id}`}
                    onClick={() => { setEditingItem(driver); setDialogOpen(true); }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-testid={`button-delete-${driver.id}`}
                    onClick={() => setDeleteDriverId(driver.id)}
                  >
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
