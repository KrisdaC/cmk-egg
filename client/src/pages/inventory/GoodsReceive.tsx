import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, QrCode, Printer, Eye, Trash2, Loader2, Egg, AlertCircle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EggReceivingLot {
  id: number;
  lotNumber: string;
  receiveDate: string;
  supplierId: number;
  totalEggs: number;
  totalTrays: number;
  status: string;
  locationId: number | null;
  notes: string | null;
  receivedBy: string | null;
  createdAt: string;
  supplier?: { id: number; code: string; nickname: string } | null;
  location?: { id: number; code: string; name: string } | null;
}

interface Supplier {
  id: number;
  code: string;
  nickname: string;
  partnerType: string;
}

interface StockLocation {
  id: number;
  code: string;
  name: string;
}

const FIXED_EGGS_PER_LOT = 3000;
const FIXED_TRAYS_PER_LOT = 10;

const formSchema = z.object({
  supplierId: z.number({ required_error: "กรุณาเลือกซัพพลายเออร์" }),
  receiveDate: z.string().min(1, "กรุณาระบุวันที่รับ"),
  locationId: z.number().nullable().optional(),
  notes: z.string().optional(),
  receivedBy: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GoodsReceive() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [lotNumber, setLotNumber] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: undefined,
      receiveDate: format(new Date(), 'yyyy-MM-dd'),
      locationId: null,
      notes: "",
      receivedBy: "",
    }
  });

  const { data: lots, isLoading } = useQuery<EggReceivingLot[]>({
    queryKey: ['/api/egg-receiving-lots']
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['/api/customer-accounts']
  });

  const { data: locations } = useQuery<StockLocation[]>({
    queryKey: ['/api/stock-locations']
  });

  const supplierPartners = suppliers?.filter(s => 
    s.partnerType === 'supplier' || s.partnerType === 'both'
  ) || [];

  const filteredLots = lots?.filter(lot => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return lot.lotNumber.toLowerCase().includes(searchLower) ||
      (lot.supplier?.nickname ?? '').toLowerCase().includes(searchLower) ||
      (lot.location?.name ?? '').toLowerCase().includes(searchLower);
  }) || [];

  const todayLots = lots?.filter(lot => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return lot.receiveDate.startsWith(today);
  }) || [];

  const todayTotalEggs = todayLots.reduce((sum, lot) => sum + lot.totalEggs, 0);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest('POST', '/api/egg-receiving-lots', {
        ...data,
        lotNumber,
        totalEggs: FIXED_EGGS_PER_LOT,
        totalTrays: FIXED_TRAYS_PER_LOT,
        status: 'received',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/egg-receiving-lots'] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "สำเร็จ", description: "บันทึกการรับไข่แล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/egg-receiving-lots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/egg-receiving-lots'] });
      setDeleteId(null);
      toast({ title: "สำเร็จ", description: "ลบรายการแล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const fetchNextLotNumber = async () => {
    try {
      const response = await fetch('/api/egg-receiving-lots/next-number');
      const data = await response.json();
      setLotNumber(data.lotNumber);
    } catch (error) {
      console.error('Failed to fetch lot number', error);
    }
  };

  const openAddDialog = () => {
    fetchNextLotNumber();
    form.reset({
      supplierId: undefined,
      receiveDate: format(new Date(), 'yyyy-MM-dd'),
      locationId: null,
      notes: "",
      receivedBy: "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-green-100 text-green-800">รับแล้ว</Badge>;
      case 'grading':
        return <Badge className="bg-blue-100 text-blue-800">กำลังคัด</Badge>;
      case 'graded':
        return <Badge className="bg-purple-100 text-purple-800">คัดแล้ว</Badge>;
      case 'consumed':
        return <Badge variant="outline">ใช้หมด</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">รับไข่ดิบ (Good Receive)</h1>
          <p className="text-muted-foreground">บันทึกการรับไข่ดิบจากซัพพลายเออร์ - ล็อตละ 3,000 ฟอง (10 ถาด)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddDialog} data-testid="button-new-receive">
            <Plus className="w-4 h-4 mr-2" />
            รับไข่ใหม่
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-today-lots">{todayLots.length}</div>
            <p className="text-sm text-muted-foreground">ล็อตรับวันนี้</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-today-eggs">{todayTotalEggs.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">ไข่รับวันนี้ (ฟอง)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="text-total-lots">{lots?.length ?? 0}</div>
            <p className="text-sm text-muted-foreground">ล็อตทั้งหมด</p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Egg className="h-4 w-4" />
        <AlertTitle>ระบบล็อตคงที่</AlertTitle>
        <AlertDescription>
          การรับไข่ดิบกำหนดเป็นล็อตคงที่ 3,000 ฟอง (10 ถาด x 30 ฟอง/ถาด) ต่อล็อต
          เพื่อความถูกต้องในการติดตามสต็อกและการคัดไข่
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="ค้นหาด้วยเลขล็อต, ซัพพลายเออร์..." 
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
          ) : filteredLots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ไม่พบรายการรับไข่
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขล็อต</TableHead>
                  <TableHead>ซัพพลายเออร์</TableHead>
                  <TableHead>วันที่รับ</TableHead>
                  <TableHead className="text-right">จำนวน (ฟอง)</TableHead>
                  <TableHead className="text-right">ถาด</TableHead>
                  <TableHead>ที่เก็บ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLots.map((lot) => (
                  <TableRow key={lot.id} data-testid={`row-lot-${lot.id}`}>
                    <TableCell className="font-mono font-medium">{lot.lotNumber}</TableCell>
                    <TableCell>{lot.supplier?.nickname ?? '-'}</TableCell>
                    <TableCell>{format(new Date(lot.receiveDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right font-mono">{lot.totalEggs.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{lot.totalTrays}</TableCell>
                    <TableCell>{lot.location?.name ?? '-'}</TableCell>
                    <TableCell>{getStatusBadge(lot.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setDeleteId(lot.id)}
                          data-testid={`button-delete-${lot.id}`}
                        >
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>รับไข่ดิบใหม่</DialogTitle>
            <DialogDescription>
              บันทึกการรับไข่ดิบจากซัพพลายเออร์ - ล็อตละ 3,000 ฟอง
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-muted p-4 mb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">เลขล็อต</p>
                <p className="font-mono font-bold">{lotNumber || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">จำนวนไข่</p>
                <p className="font-mono font-bold">{FIXED_EGGS_PER_LOT.toLocaleString()} ฟอง</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">จำนวนถาด</p>
                <p className="font-mono font-bold">{FIXED_TRAYS_PER_LOT} ถาด</p>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ซัพพลายเออร์ *</FormLabel>
                    <Select 
                      value={field.value?.toString() ?? ""} 
                      onValueChange={(v) => field.onChange(parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-supplier">
                          <SelectValue placeholder="เลือกซัพพลายเออร์" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {supplierPartners.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.nickname}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันที่รับ *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-receiveDate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ที่เก็บ</FormLabel>
                    <Select 
                      value={field.value?.toString() ?? "none"} 
                      onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-location">
                          <SelectValue placeholder="เลือกที่เก็บ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">ไม่ระบุ</SelectItem>
                        {locations?.map(l => (
                          <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>หมายเหตุ</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  บันทึกการรับ
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
              คุณต้องการลบรายการรับไข่นี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
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
