import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Building2,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteSupplier,
  getSuppliers,
  upsertSupplier,
} from "@/lib/api/suppliers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription } from "@radix-ui/react-dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSupplierSchema } from "@shared/schema";
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

export default function Suppliers() {
  const {
    data: suppliers,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["suppliers"],
    queryFn: getSuppliers,
  });

  const queryClient = useQueryClient();
  type Supplier = typeof suppliers.$inferSelect;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [deleteSupplierId, setDeleteSupplierId] = useState<number | null>(null);

  type SupplierFormValues = z.infer<typeof insertSupplierSchema>;

  const supplierForm = useForm<SupplierFormValues>({
    resolver: zodResolver(insertSupplierSchema),
    defaultValues: {
      code: "",
      name: "",
      contactPerson: "",
      phone: "",
      supplierType: "eggs",
      isActive: true,
    },
  });

  const mutation = useMutation({
    mutationFn: upsertSupplier,
    onError: (error: any) => {
      if (error.field) {
        supplierForm.setError(error.field, {
          type: "manual",
          message: error.message,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  function onSubmit(values: SupplierFormValues) {
    if (editingItem) {
      // EDIT
      mutation.mutate({
        id: editingItem.id,
        ...values,
      });
    } else {
      // ADD
      mutation.mutate(values);
    }
  }

  function onEdit(supplier: Supplier) {
    setEditingItem(supplier);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!editingItem) {
      // ADD mode → clean form
      supplierForm.reset({
        code: "",
        name: "",
        contactPerson: "",
        phone: "",
        supplierType: "eggs",
        isActive: true,
      });
      return;
    }

    // EDIT mode → populate form
    supplierForm.reset({
      code: editingItem.code ?? "",
      name: editingItem.name ?? "",
      contactPerson: editingItem.contactPerson ?? "",
      phone: editingItem.phone ?? "",
      supplierType: editingItem.supplierType ?? "eggs",
      isActive: editingItem.isActive ?? true,
    });
  }, [editingItem, supplierForm]);

  if (isLoading) return null;
  if (isError) return <div>Failed to load suppliers.</div>;

  const filteredSuppliers = suppliers.filter((supplier) => {
    const q = search.toLowerCase();

    return (
      supplier.code?.toLowerCase().includes(q) ||
      supplier.name?.toLowerCase().includes(q) ||
      supplier.contactPerson?.toLowerCase().includes(q) ||
      supplier.phone?.toLowerCase().includes(q) ||
      supplier.supplierType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            ซัพพลายเออร์
          </h1>
          <p className="text-muted-foreground">
            จัดการฟาร์มไข่และซัพพลายเออร์
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingItem(null);
            supplierForm.reset();
            setDialogOpen(true);
          }}
        >
          เพิ่มซัพพลายเออร์
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
              {editingItem ? "แก้ไขซัพพลายเออร์" : "เพิ่มซัพพลายเออร์"}
            </DialogTitle>

            <DialogDescription>กรอกข้อมูลซัพพลายเออร์</DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form
              onSubmit={supplierForm.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัส *</FormLabel>
                      <FormControl>
                        <Input placeholder="SUP-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อซัพพลายเออร์ *</FormLabel>
                      <FormControl>
                        <Input placeholder="ฟาร์มสดใหม่" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ผู้ติดต่อ</FormLabel>
                      <FormControl>
                        <Input placeholder="ชื่อผู้ติดต่อ" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
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

              <FormField
                control={supplierForm.control}
                name="supplierType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ประเภทซัพพลายเออร์ *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eggs">ไข่</SelectItem>
                          <SelectItem value="packaging">บรรจุภัณฑ์</SelectItem>
                          <SelectItem value="labels">สติ๊กเกอร์</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supplierForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
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
        open={deleteSupplierId !== null}
        onOpenChange={() => setDeleteSupplierId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบซัพพลายเออร์</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบซัพพลายเออร์นี้?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() =>
                deleteSupplierId && deleteMutation.mutate(deleteSupplierId)
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
                placeholder="ค้นหาซัพพลายเออร์..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-md border overflow-hidden">
            <div className="grid items-center px-3 py-2.5 bg-muted/30" style={{gridTemplateColumns: "90px 1fr 160px 130px 90px 70px 90px 80px"}}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">รหัส</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ชื่อซัพพลายเออร์</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ผู้ติดต่อ</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">เบอร์โทร</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ประเภท</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ปริมาณเฉลี่ย</div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">สถานะ</div>
              <div />
            </div>
            {filteredSuppliers.map((supplier, idx) => (
              <div
                key={supplier.id}
                className={`grid items-center px-3 py-2.5 hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-slate-50/60 dark:bg-slate-900/30'}`}
                style={{gridTemplateColumns: "90px 1fr 160px 130px 90px 70px 90px 80px"}}
                data-testid={`row-supplier-${supplier.id}`}
              >
                <div className="text-xs font-mono">{supplier.code}</div>
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {supplier.name}
                </div>
                <div className="text-xs">{supplier.contactPerson}</div>
                <div className="text-xs flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  {supplier.phone}
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px]">{supplier.supplierType}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">-</div>
                <div>
                  <Badge variant={supplier.isActive ? "secondary" : "outline"} className="capitalize text-[10px]">
                    {supplier.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                  </Badge>
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-testid={`button-edit-${supplier.id}`}
                    onClick={() => onEdit(supplier)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-testid={`button-delete-${supplier.id}`}
                    onClick={() => setDeleteSupplierId(supplier.id)}
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
