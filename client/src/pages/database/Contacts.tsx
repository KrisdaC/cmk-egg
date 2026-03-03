import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Phone, Mail, Loader2, ArrowUpDown, ArrowUp, ArrowDown, User } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CustomerContact, CustomerAccount, DeliverySite } from "@shared/schema";
import { insertCustomerContactSchema } from "@shared/schema";

type AccountWithSites = CustomerAccount & {
  deliverySites?: DeliverySite[];
};
import { z } from "zod";
import { Link } from "wouter";

const ROLE_OPTIONS = [
  { value: "owner", label: "เจ้าของกิจการ" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "purchasing", label: "ฝ่ายจัดซื้อ" },
  { value: "receiving", label: "ฝ่ายรับสินค้า" },
  { value: "billing", label: "ฝ่ายบัญชี" },
  { value: "general", label: "ผู้ติดต่อทั่วไป" },
] as const;

const getRoleLabel = (role: string | null | undefined): string => {
  if (!role) return "";
  const found = ROLE_OPTIONS.find(r => r.value === role);
  return found ? found.label : role;
};

type ContactWithAccount = CustomerContact & {
  account?: CustomerAccount;
};

type SortField = 'fullName' | 'account' | 'role' | 'isPrimary';
type SortDirection = 'asc' | 'desc' | null;

const formSchema = insertCustomerContactSchema.extend({
  fullName: z.string().min(1, "กรุณากรอกชื่อผู้ติดต่อ"),
  partnerId: z.number().min(1, "กรุณาเลือกบัญชีลูกค้า"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Contacts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithAccount | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const { data: contacts, isLoading } = useQuery<ContactWithAccount[]>({
    queryKey: ['/api/customer-contacts']
  });

  const { data: accounts } = useQuery<AccountWithSites[]>({
    queryKey: ['/api/customer-accounts']
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      partnerId: 0,
      deliverySiteId: null,
      fullName: "",
      role: "",
      department: "",
      phone: "",
      mobile: "",
      email: "",
      lineId: "",
      isPrimary: false,
      isActive: true,
    },
  });

  // Watch partnerId to show delivery site selector
  const selectedPartnerId = form.watch("partnerId");

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest('POST', '/api/customer-contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "เพิ่มผู้ติดต่อสำเร็จ", description: "สร้างผู้ติดต่อใหม่เรียบร้อยแล้ว" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues & { id: number }) => 
      apiRequest('PATCH', `/api/customer-contacts/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "อัปเดตผู้ติดต่อสำเร็จ", description: "บันทึกข้อมูลผู้ติดต่อเรียบร้อยแล้ว" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/customer-contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "ลบผู้ติดต่อสำเร็จ", description: "ลบผู้ติดต่อเรียบร้อยแล้ว" });
      setDeleteContactId(null);
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const openAddDialog = () => {
    setEditingContact(null);
    form.reset({
      partnerId: 0,
      deliverySiteId: null,
      fullName: "",
      role: "",
      department: "",
      phone: "",
      mobile: "",
      email: "",
      lineId: "",
      isPrimary: false,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (contact: ContactWithAccount) => {
    setEditingContact(contact);
    form.reset({
      partnerId: contact.partnerId,
      deliverySiteId: contact.deliverySiteId ?? null,
      fullName: contact.fullName,
      role: contact.role ?? "",
      department: contact.department ?? "",
      phone: contact.phone ?? "",
      mobile: contact.mobile ?? "",
      email: contact.email ?? "",
      lineId: contact.lineId ?? "",
      isPrimary: contact.isPrimary ?? false,
      isActive: contact.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingContact(null);
    form.reset();
  };

  const onSubmit = (data: FormValues) => {
    if (editingContact) {
      updateMutation.mutate({ ...data, id: editingContact.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3 h-3 ml-1" />;
    return <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filteredAndSortedContacts = useMemo(() => {
    let result = contacts?.filter(c => {
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        c.fullName.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.phone?.toLowerCase().includes(searchLower) ||
        c.mobile?.toLowerCase().includes(searchLower) ||
        c.account?.nickname?.toLowerCase().includes(searchLower) ||
        c.account?.businessName?.toLowerCase().includes(searchLower);
      return matchesSearch;
    }) || [];

    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        
        switch (sortField) {
          case 'fullName':
            aVal = a.fullName;
            bVal = b.fullName;
            break;
          case 'account':
            aVal = a.account?.nickname ?? '';
            bVal = b.account?.nickname ?? '';
            break;
          case 'role':
            aVal = a.role ?? '';
            bVal = b.role ?? '';
            break;
          case 'isPrimary':
            aVal = a.isPrimary ? 1 : 0;
            bVal = b.isPrimary ? 1 : 0;
            break;
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [contacts, search, sortField, sortDirection]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contacts</h1>
          <p className="text-muted-foreground">จัดการผู้ติดต่อลูกค้า</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddDialog} data-testid="button-add-contact">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มผู้ติดต่อ
          </Button>
          <Link href="/database/customers">
            <Button variant="outline" data-testid="button-back-customers">
              กลับไปหน้าลูกค้า
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="ค้นหาชื่อ, อีเมล, โทรศัพท์, ลูกค้า..." 
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
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAndSortedContacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ไม่พบผู้ติดต่อ</p>
              <p className="text-sm">เพิ่มผู้ติดต่อเพื่อเริ่มต้นใช้งาน</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('fullName')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-name"
                    >
                      ชื่อ {getSortIcon('fullName')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('account')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-account"
                    >
                      ลูกค้า {getSortIcon('account')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('role')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-role"
                    >
                      ตำแหน่ง {getSortIcon('role')}
                    </button>
                  </TableHead>
                  <TableHead>โทรศัพท์</TableHead>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>ไลน์ไอดี</TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('isPrimary')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-primary"
                    >
                      หลัก {getSortIcon('isPrimary')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedContacts.map((contact) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    <TableCell className="font-medium">{contact.fullName}</TableCell>
                    <TableCell>
                      {contact.account ? (
                        <Badge variant="secondary">{contact.account.nickname}</Badge>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {contact.role ? (
                        <span>{getRoleLabel(contact.role)}</span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {(contact.mobile || contact.phone) ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {contact.mobile || contact.phone}
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{contact.email}</span>
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {contact.lineId || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {contact.isPrimary && (
                        <Badge variant="default" className="bg-primary/90">หลัก</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(contact)}
                          data-testid={`button-edit-${contact.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setDeleteContactId(contact.id)}
                          data-testid={`button-delete-${contact.id}`}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อ"}</DialogTitle>
            <DialogDescription>
              {editingContact ? "แก้ไขข้อมูลผู้ติดต่อด้านล่าง" : "กรอกข้อมูลเพื่อสร้างผู้ติดต่อใหม่"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>บัญชีลูกค้า *</FormLabel>
                    <Select 
                      value={field.value ? String(field.value) : ""} 
                      onValueChange={(val) => field.onChange(Number(val))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-account">
                          <SelectValue placeholder="เลือกลูกค้า" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts?.map((acc) => (
                          <SelectItem key={acc.id} value={String(acc.id)}>{acc.nickname}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Site Selection - only show if account has delivery sites */}
              {selectedPartnerId && (accounts?.find(a => a.id === selectedPartnerId)?.deliverySites?.length ?? 0) > 0 && (
                <FormField
                  control={form.control}
                  name="deliverySiteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>สาขา (ถ้ามี)</FormLabel>
                      <Select 
                        value={field.value ? String(field.value) : "none"} 
                        onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-site">
                            <SelectValue placeholder="ผู้ติดต่อระดับบัญชี (ทุกสาขา)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">ผู้ติดต่อระดับบัญชี (ทุกสาขา)</SelectItem>
                          {accounts?.find(a => a.id === selectedPartnerId)?.deliverySites?.map(site => (
                            <SelectItem key={site.id} value={String(site.id)}>
                              {site.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อ-นามสกุล *</FormLabel>
                    <FormControl>
                      <Input placeholder="ชื่อผู้ติดต่อ" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ตำแหน่ง</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="เลือกตำแหน่ง" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>แผนก</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น ฝ่ายจัดซื้อ" {...field} value={field.value ?? ""} data-testid="input-department" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>โทรศัพท์</FormLabel>
                      <FormControl>
                        <Input placeholder="02-xxx-xxxx" {...field} value={field.value ?? ""} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>มือถือ</FormLabel>
                      <FormControl>
                        <Input placeholder="08x-xxx-xxxx" {...field} value={field.value ?? ""} data-testid="input-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>อีเมล</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@company.com" {...field} value={field.value ?? ""} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ไลน์ไอดี</FormLabel>
                      <FormControl>
                        <Input placeholder="ชื่อผู้ใช้ LINE" {...field} value={field.value ?? ""} data-testid="input-line" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-primary"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">ผู้ติดต่อหลัก</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel">
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-save">
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingContact ? "บันทึก" : "เพิ่มผู้ติดต่อ"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteContactId !== null} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบผู้ติดต่อ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบผู้ติดต่อนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContactId && deleteMutation.mutate(deleteContactId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
