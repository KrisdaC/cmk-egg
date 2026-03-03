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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            Suppliers
          </h1>
          <p className="text-muted-foreground">
            Manage egg farms and material suppliers
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingItem(null);
            supplierForm.reset();
            setDialogOpen(true);
          }}
        >
          Add Supplier
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
              {editingItem ? "แก้ไข Supplier" : "เพิ่ม Supplier"}
            </DialogTitle>

            <DialogDescription>กรอกข้อมูล Suppliers</DialogDescription>
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
                      <FormLabel>Code*</FormLabel>
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
                      <FormLabel>Supplier Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Fresh Farm" {...field} />
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
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Marie Antoinette" {...field} />
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
                      <FormLabel>Phone</FormLabel>
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
                    <FormLabel>Supplier Type*</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eggs">Eggs</SelectItem>
                          <SelectItem value="packaging">Packaging</SelectItem>
                          <SelectItem value="labels">Labels</SelectItem>
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
                    <FormLabel className="font-normal">Active</FormLabel>
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
            <AlertDialogTitle>ลบ Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ Supplier นี้?
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
                placeholder="Search suppliers..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Avg Daily Supply</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  data-testid={`row-supplier-${supplier.id}`}
                >
                  <TableCell className="font-mono">{supplier.id}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {supplier.name}
                    </div>
                  </TableCell>
                  <TableCell>{supplier.contactPerson}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {supplier.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{supplier.supplierType}</Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <Badge
                      variant={supplier.isActive ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {supplier.isActive ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-edit-${supplier.id}`}
                        onClick={() => onEdit(supplier)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-${supplier.id}`}
                        onClick={() => setDeleteSupplierId(supplier.id)}
                      >
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
