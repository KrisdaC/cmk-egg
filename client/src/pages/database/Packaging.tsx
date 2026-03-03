import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Loader2, Package } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface ItemMaster {
  id: number;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  eggType: string | null;
  gradeCode: string | null;
  baseUom: string;
  lotTracked: boolean;
  isSellable: boolean;
  partnerId: number | null;
  isActive: boolean;
  partner?: { id: number; code: string; nickname: string } | null;
}

interface Partner {
  id: number;
  code: string;
  nickname: string;
}

const formSchema = z.object({
  itemCode: z.string().min(1, "กรุณากรอกรหัส"),
  itemName: z.string().min(1, "กรุณากรอกชื่อ"),
  baseUom: z.string().default("PCS"),
  lotTracked: z.boolean().default(false),
  partnerId: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function Packaging() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemCode: "",
      itemName: "",
      baseUom: "PCS",
      lotTracked: false,
      partnerId: null,
      isActive: true,
    }
  });

  const { data: items, isLoading } = useQuery<ItemMaster[]>({
    queryKey: ['/api/item-master'],
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ['/api/customer-accounts']
  });

  const packagingItems = items?.filter(i => i.itemCategory === 'PACKAGING') || [];

  const filteredItems = packagingItems.filter(item => {
    return !search || 
      item.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      (item.partner?.nickname ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest('POST', '/api/item-master', {
        ...data,
        itemCategory: 'PACKAGING',
        eggType: null,
        gradeCode: null,
        isSellable: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/item-master'] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "สำเร็จ", description: "เพิ่มวัสดุบรรจุภัณฑ์แล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues & { id: number }) => {
      return await apiRequest('PATCH', `/api/item-master/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/item-master'] });
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
      toast({ title: "สำเร็จ", description: "อัปเดตข้อมูลแล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/item-master/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/item-master'] });
      setDeleteId(null);
      toast({ title: "สำเร็จ", description: "ลบรายการแล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const openAddDialog = () => {
    setEditingItem(null);
    form.reset({
      itemCode: "",
      itemName: "",
      baseUom: "PCS",
      lotTracked: false,
      partnerId: null,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: ItemMaster) => {
    setEditingItem(item);
    form.reset({
      itemCode: item.itemCode,
      itemName: item.itemName,
      baseUom: item.baseUom,
      lotTracked: item.lotTracked,
      partnerId: item.partnerId,
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: FormValues) => {
    if (editingItem) {
      updateMutation.mutate({ ...data, id: editingItem.id });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Packaging Goods</h1>
          <p className="text-muted-foreground">
            วัสดุบรรจุภัณฑ์ - ถาด, ฝาครอบ, สติกเกอร์, เทปกาว ({filteredItems.length} รายการ)
          </p>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-packaging">
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มวัสดุบรรจุภัณฑ์
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="ค้นหาด้วยรหัส, ชื่อ, หรือลูกค้า..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ไม่พบรายการ
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">รหัส</TableHead>
                  <TableHead>ชื่อรายการ</TableHead>
                  <TableHead className="w-24">หน่วย</TableHead>
                  <TableHead className="w-40">ลูกค้าเฉพาะ</TableHead>
                  <TableHead className="w-24">Track Lot</TableHead>
                  <TableHead className="w-24">สถานะ</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-packaging-${item.id}`}>
                    <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>{item.baseUom}</TableCell>
                    <TableCell>
                      {item.partner ? (
                        <Badge variant="outline">{item.partner.nickname}</Badge>
                      ) : (
                        <span className="text-muted-foreground">ใช้ร่วม</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.lotTracked ? (
                        <Badge className="bg-blue-100 text-blue-800">Track</Badge>
                      ) : (
                        <Badge variant="outline">ไม่ Track</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "secondary" : "outline"}>
                        {item.isActive ? "ใช้งาน" : "ปิด"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} data-testid={`button-edit-${item.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} data-testid={`button-delete-${item.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "แก้ไขวัสดุบรรจุภัณฑ์" : "เพิ่มวัสดุบรรจุภัณฑ์"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "แก้ไขข้อมูลวัสดุบรรจุภัณฑ์" : "กรอกข้อมูลวัสดุบรรจุภัณฑ์ใหม่"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="itemCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัส *</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น PKG-TRAY30" {...field} data-testid="input-itemCode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseUom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หน่วย</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-baseUom">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PCS">PCS (ชิ้น)</SelectItem>
                          <SelectItem value="ROLL">ROLL (ม้วน)</SelectItem>
                          <SelectItem value="BOX">BOX (กล่อง)</SelectItem>
                          <SelectItem value="PACK">PACK (แพ็ค)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อรายการ *</FormLabel>
                    <FormControl>
                      <Input placeholder="เช่น ถาดไข่ 30 ฟอง" {...field} data-testid="input-itemName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ลูกค้าเฉพาะ (ถ้ามี)</FormLabel>
                    <Select 
                      value={field.value?.toString() ?? "shared"} 
                      onValueChange={(v) => field.onChange(v === "shared" ? null : parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-partnerId">
                          <SelectValue placeholder="เลือกลูกค้า" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="shared">ใช้ร่วม (Shared)</SelectItem>
                        {partners?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.nickname}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-6">
                <FormField
                  control={form.control}
                  name="lotTracked"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-lotTracked" />
                      </FormControl>
                      <FormLabel className="!mt-0">Track Lot</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-isActive" />
                      </FormControl>
                      <FormLabel className="!mt-0">ใช้งาน</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingItem ? "บันทึก" : "เพิ่ม"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบรายการนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
