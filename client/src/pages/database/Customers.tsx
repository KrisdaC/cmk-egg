import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, Phone, Building, Loader2, MapPin, FileText, ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, Truck, Mail, Users } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Fragment } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CustomerAccount, DeliverySite, CustomerContact } from "@shared/schema";
import { insertCustomerAccountSchema, insertDeliverySiteSchema, insertCustomerContactSchema } from "@shared/schema";
import { z } from "zod";

const VEHICLE_TYPES = [
  { value: "4_wheel", label: "4ล้อ" },
  { value: "4_wheel_ext", label: "4 ล้อ ต่อ" },
  { value: "6_wheel", label: "6 ล้อ" },
  { value: "refrigerated", label: "ตู้ห้องเย็น" },
] as const;

const THAILAND_REGIONS = [
  { value: "bangkok", label: "กรุงเทพและปริมณฑล" },
  { value: "central", label: "ภาคกลาง" },
  { value: "north", label: "ภาคเหนือ" },
  { value: "northeast", label: "ภาคตะวันออกเฉียงเหนือ" },
  { value: "east", label: "ภาคตะวันออก" },
  { value: "west", label: "ภาคตะวันตก" },
  { value: "south", label: "ภาคใต้" },
] as const;

const BUSINESS_TYPES = [
  { value: "Individual", label: "บุคคลธรรมดา" },
  { value: "Corporation", label: "นิติบุคคล" },
] as const;

const CUSTOMER_TYPES = [
  { value: "Traditional Trade", label: "ค้าปลีกดั้งเดิม" },
  { value: "Modern Trade", label: "ค้าปลีกสมัยใหม่" },
] as const;

type AccountWithRelations = CustomerAccount & {
  deliverySites?: DeliverySite[];
  contacts?: CustomerContact[];
};

type SortField = 'nickname' | 'accountCode' | 'businessName' | 'paymentTerms' | 'sites' | 'isActive';
type SortDirection = 'asc' | 'desc' | null;

const formSchema = insertCustomerAccountSchema.extend({
  nickname: z.string().min(1, "กรุณากรอกชื่อเรียก"),
  code: z.string().min(1, "กรุณากรอกรหัสบัญชี"),
  businessName: z.string().min(1, "กรุณากรอกชื่อธุรกิจ"),
});

const PAYMENT_TERMS_OPTIONS = [
  { value: "Cash", label: "เงินสด", creditDays: 0 },
  { value: "COD", label: "เก็บเงินปลายทาง (COD)", creditDays: 0 },
  { value: "Credit 7 Days", label: "เครดิต 7 วัน", creditDays: 7 },
  { value: "Credit 15 Days", label: "เครดิต 15 วัน", creditDays: 15 },
  { value: "Credit 30 Days", label: "เครดิต 30 วัน", creditDays: 30 },
] as const;

const getCreditDaysFromPaymentTerms = (paymentTerms: string): number => {
  const option = PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms);
  return option?.creditDays ?? 0;
};

const getNicknameBadgeStyle = (nickname: string) => {
  const lower = nickname.toLowerCase();
  if (lower.includes('makro') || lower === 'mk') {
    return 'bg-red-600 text-white hover:bg-red-700';
  }
  if (lower.includes('bigc') || lower.includes('big c') || lower === 'bc') {
    return 'bg-green-600 text-white hover:bg-green-700';
  }
  if (lower.includes('cj') || lower.includes('ซีเจ')) {
    return 'bg-pink-400 text-black hover:bg-pink-500';
  }
  if (lower.includes('thaifood') || lower.includes('thai food') || lower.includes('ไทยฟู้ด')) {
    return 'bg-blue-600 text-white hover:bg-blue-700';
  }
  return 'bg-primary/90 text-primary-foreground';
};

const siteFormSchema = insertDeliverySiteSchema.extend({
  siteCode: z.string().min(1, "กรุณากรอกรหัสสถานที่"),
  displayName: z.string().min(1, "กรุณากรอกชื่อสถานที่"),
  partnerId: z.number().min(1, "กรุณาเลือกบัญชีลูกค้า"),
  acceptableVehicles: z.array(z.string()).optional(),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

const contactFormSchema = insertCustomerContactSchema.extend({
  fullName: z.string().min(1, "กรุณากรอกชื่อผู้ติดต่อ"),
  partnerId: z.number().min(1, "กรุณาเลือกบัญชีลูกค้า"),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

type FormValues = z.infer<typeof formSchema>;

export default function Customers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithRelations | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Delivery site dialog state
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<DeliverySite | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
  // Contact dialog state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  
  // Delete confirmation state
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<number | null>(null);

  const { data: accounts, isLoading } = useQuery<AccountWithRelations[]>({
    queryKey: ['/api/customer-accounts']
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: "",
      code: "",
      businessName: "",
      businessType: "",
      customerType: "",
      branchCode: "",
      branchName: "",
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      district: "",
      subDistrict: "",
      province: "",
      postalCode: "",
      country: "Thailand",
      paymentTerms: "COD",
      customerTier: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest('POST', '/api/customer-accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "เพิ่มลูกค้าสำเร็จ", description: "สร้างบัญชีลูกค้าใหม่เรียบร้อยแล้ว" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues & { id: number }) => 
      apiRequest('PATCH', `/api/customer-accounts/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "อัปเดตลูกค้าสำเร็จ", description: "บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/customer-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "ลบลูกค้าสำเร็จ", description: "ลบบัญชีลูกค้าเรียบร้อยแล้ว" });
      setDeleteAccountId(null);
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const deleteSiteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/delivery-sites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "ลบสถานที่จัดส่งสำเร็จ", description: "ลบสถานที่จัดส่งเรียบร้อยแล้ว" });
      setDeleteSiteId(null);
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  // Delivery site form and mutations
  const siteForm = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      partnerId: 0,
      siteCode: "",
      displayName: "",
      partnerBranchCode: "",
      branchName: "",
      deliveryType: "direct_to_store",
      addressLine1: "",
      addressLine2: "",
      district: "",
      subDistrict: "",
      province: "",
      postalCode: "",
      country: "Thailand",
      deliveryZone: "",
      preferredTimeSlot: "",
      accessInstructions: "",
      acceptableVehicles: [],
      googleMapsUrl: "",
      isActive: true,
    },
  });

  const createSiteMutation = useMutation({
    mutationFn: (data: SiteFormValues) => apiRequest('POST', '/api/delivery-sites', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "เพิ่มสถานที่จัดส่งสำเร็จ", description: "สร้างสถานที่จัดส่งใหม่เรียบร้อยแล้ว" });
      closeSiteDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const updateSiteMutation = useMutation({
    mutationFn: (data: SiteFormValues & { id: number }) => 
      apiRequest('PATCH', `/api/delivery-sites/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "อัปเดตสถานที่จัดส่งสำเร็จ", description: "บันทึกข้อมูลสถานที่จัดส่งเรียบร้อยแล้ว" });
      closeSiteDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const openAddSiteDialog = (accountId?: number) => {
    setEditingSite(null);
    setSelectedAccountId(accountId ?? null);
    siteForm.reset({
      partnerId: accountId ?? 0,
      siteCode: "",
      displayName: "",
      partnerBranchCode: "",
      branchName: "",
      deliveryType: "direct_to_store",
      addressLine1: "",
      addressLine2: "",
      district: "",
      subDistrict: "",
      province: "",
      postalCode: "",
      country: "Thailand",
      deliveryZone: "",
      preferredTimeSlot: "",
      accessInstructions: "",
      acceptableVehicles: [],
      googleMapsUrl: "",
      isActive: true,
    });
    setSiteDialogOpen(true);
  };

  const openEditSiteDialog = (site: DeliverySite) => {
    setEditingSite(site);
    setSelectedAccountId(site.partnerId);
    siteForm.reset({
      partnerId: site.partnerId,
      siteCode: site.siteCode,
      displayName: site.displayName,
      partnerBranchCode: site.partnerBranchCode ?? "",
      branchName: site.branchName ?? "",
      deliveryType: site.deliveryType ?? "direct_to_store",
      addressLine1: site.addressLine1 ?? "",
      addressLine2: site.addressLine2 ?? "",
      district: site.district ?? "",
      subDistrict: site.subDistrict ?? "",
      province: site.province ?? "",
      postalCode: site.postalCode ?? "",
      country: site.country ?? "Thailand",
      deliveryZone: site.deliveryZone ?? "",
      preferredTimeSlot: site.preferredTimeSlot ?? "",
      accessInstructions: site.accessInstructions ?? "",
      acceptableVehicles: (site as any).acceptableVehicles ?? [],
      googleMapsUrl: site.googleMapsUrl ?? "",
      isActive: site.isActive ?? true,
    });
    setSiteDialogOpen(true);
  };

  const closeSiteDialog = () => {
    setSiteDialogOpen(false);
    setEditingSite(null);
    setSelectedAccountId(null);
    siteForm.reset();
  };

  const onSiteSubmit = (data: SiteFormValues) => {
    if (editingSite) {
      updateSiteMutation.mutate({ ...data, id: editingSite.id });
    } else {
      createSiteMutation.mutate(data);
    }
  };

  const isSitePending = createSiteMutation.isPending || updateSiteMutation.isPending;

  // Contact form and mutations
  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
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

  const createContactMutation = useMutation({
    mutationFn: (data: ContactFormValues) => apiRequest('POST', '/api/customer-contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "เพิ่มผู้ติดต่อสำเร็จ", description: "สร้างผู้ติดต่อใหม่เรียบร้อยแล้ว" });
      closeContactDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const updateContactMutation = useMutation({
    mutationFn: (data: ContactFormValues & { id: number }) => 
      apiRequest('PATCH', `/api/customer-contacts/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-accounts'] });
      toast({ title: "อัปเดตผู้ติดต่อสำเร็จ", description: "บันทึกข้อมูลผู้ติดต่อเรียบร้อยแล้ว" });
      closeContactDialog();
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  });

  const openAddContactDialog = (accountId: number, deliverySiteId?: number) => {
    setEditingContact(null);
    setSelectedAccountId(accountId);
    contactForm.reset({
      partnerId: accountId,
      deliverySiteId: deliverySiteId ?? null,
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
    setContactDialogOpen(true);
  };

  const openEditContactDialog = (contact: CustomerContact) => {
    setEditingContact(contact);
    setSelectedAccountId(contact.partnerId);
    contactForm.reset({
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
    setContactDialogOpen(true);
  };

  const closeContactDialog = () => {
    setContactDialogOpen(false);
    setEditingContact(null);
    contactForm.reset();
  };

  const onContactSubmit = (data: ContactFormValues) => {
    if (editingContact) {
      updateContactMutation.mutate({ ...data, id: editingContact.id });
    } else {
      createContactMutation.mutate(data);
    }
  };

  const isContactPending = createContactMutation.isPending || updateContactMutation.isPending;

  const openAddDialog = () => {
    setEditingAccount(null);
    form.reset({
      nickname: "",
      code: "",
      businessName: "",
      businessType: "",
      customerType: "",
      branchCode: "",
      branchName: "",
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      district: "",
      subDistrict: "",
      province: "",
      postalCode: "",
      country: "Thailand",
      paymentTerms: "COD",
      customerTier: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (account: AccountWithRelations) => {
    setEditingAccount(account);
    form.reset({
      nickname: account.nickname,
      code: account.code,
      businessName: account.businessName ?? "",
      businessType: (account as any).businessType ?? "",
      customerType: (account as any).customerType ?? "",
      branchCode: account.branchCode ?? "",
      branchName: account.branchName ?? "",
      taxId: account.taxId ?? "",
      addressLine1: account.addressLine1 ?? "",
      addressLine2: account.addressLine2 ?? "",
      district: account.district ?? "",
      subDistrict: account.subDistrict ?? "",
      province: account.province ?? "",
      postalCode: account.postalCode ?? "",
      country: account.country ?? "Thailand",
      paymentTerms: account.paymentTerms ?? "COD",
      customerTier: account.customerTier ?? "",
      isActive: account.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    form.reset();
  };

  const onSubmit = (data: FormValues) => {
    // Derive creditDays from paymentTerms for database consistency
    const submitData = {
      ...data,
      creditDays: getCreditDaysFromPaymentTerms(data.paymentTerms ?? "COD"),
    };
    if (editingAccount) {
      updateMutation.mutate({ ...submitData, id: editingAccount.id });
    } else {
      createMutation.mutate(submitData);
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

  // Get unique regions from all delivery sites for the filter dropdown
  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    accounts?.forEach(a => {
      a.deliverySites?.forEach(site => {
        if (site.deliveryZone) regions.add(site.deliveryZone);
      });
    });
    return Array.from(regions).sort();
  }, [accounts]);

  const filteredAndSortedAccounts = useMemo(() => {
    let result = accounts?.filter(a => {
      // Region filter - check if any delivery site matches the selected region
      if (regionFilter !== "all") {
        const hasMatchingRegion = a.deliverySites?.some(site => site.deliveryZone === regionFilter);
        if (!hasMatchingRegion) return false;
      }
      
      if (!search) return true;
      
      const searchLower = search.toLowerCase().trim();
      const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 0);
      
      // Check if all search terms match (AND logic for better precision)
      const matchesAllTerms = searchTerms.every(term => {
        const matchesAccountFields = 
          (a.businessName ?? '').toLowerCase().includes(term) ||
          (a.code ?? '').toLowerCase().includes(term) ||
          (a.nickname ?? '').toLowerCase().includes(term) ||
          (a.branchName ?? '').toLowerCase().includes(term) ||
          (a.taxId ?? '').toLowerCase().includes(term);
        
        const matchesDeliverySites = a.deliverySites?.some(site =>
          (site.displayName ?? '').toLowerCase().includes(term) ||
          (site.siteCode ?? '').toLowerCase().includes(term) ||
          (site.partnerBranchCode ?? '').toLowerCase().includes(term) ||
          (site.branchName ?? '').toLowerCase().includes(term) ||
          (site.district ?? '').toLowerCase().includes(term) ||
          (site.province ?? '').toLowerCase().includes(term)
        );
        
        return matchesAccountFields || matchesDeliverySites;
      });
      
      return matchesAllTerms;
    }) || [];

    // Always sort inactive accounts to bottom first, then apply user sort
    result = [...result].sort((a, b) => {
      // Inactive always goes to bottom
      const aActive = a.isActive !== false;
      const bActive = b.isActive !== false;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      
      // Then apply user's sort criteria
      if (sortField && sortDirection) {
        let aVal: string | number = '';
        let bVal: string | number = '';
        
        switch (sortField) {
          case 'nickname':
            aVal = a.nickname ?? '';
            bVal = b.nickname ?? '';
            break;
          case 'accountCode':
            aVal = a.code ?? '';
            bVal = b.code ?? '';
            break;
          case 'businessName':
            aVal = a.businessName ?? '';
            bVal = b.businessName ?? '';
            break;
          case 'paymentTerms':
            aVal = a.paymentTerms ?? '';
            bVal = b.paymentTerms ?? '';
            break;
          case 'sites':
            aVal = a.deliverySites?.length ?? 0;
            bVal = b.deliverySites?.length ?? 0;
            break;
          case 'isActive':
            aVal = a.isActive ? 1 : 0;
            bVal = b.isActive ? 1 : 0;
            break;
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return 0;
    });

    return result;
  }, [accounts, search, regionFilter, sortField, sortDirection]);

  const toggleExpanded = (id: number) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPrimaryContact = (contacts?: CustomerContact[]) => contacts?.find(c => c.isPrimary) || contacts?.[0];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Customers</h1>
          <p className="text-muted-foreground">จัดการบัญชีลูกค้าและสถานที่จัดส่ง</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={openAddDialog} data-testid="button-add-customer">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มลูกค้า
          </Button>
          <Button variant="outline" onClick={() => openAddSiteDialog()} data-testid="button-add-site">
            <MapPin className="w-4 h-4 mr-2" />
            เพิ่มสถานที่จัดส่ง
          </Button>
          <Link href="/database/contacts">
            <Button variant="outline" data-testid="button-contacts">
              <Users className="w-4 h-4 mr-2" />
              ผู้ติดต่อ
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
                placeholder="ค้นหาชื่อ, รหัส, สาขา... (ใช้เว้นวรรคเพื่อค้นหาแม่นยำขึ้น)" 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-region-filter">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="เลือกเขต" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเขตจัดส่ง</SelectItem>
                {availableRegions.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAndSortedAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ไม่พบลูกค้า</p>
              <p className="text-sm">เพิ่มลูกค้าเพื่อเริ่มต้นใช้งาน</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('accountCode')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-account-code"
                    >
                      รหัสบัญชี {getSortIcon('accountCode')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('nickname')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-nickname"
                    >
                      ชื่อเรียก {getSortIcon('nickname')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('businessName')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-business-name"
                    >
                      ชื่อธุรกิจ {getSortIcon('businessName')}
                    </button>
                  </TableHead>
                  <TableHead>สาขา</TableHead>
                  <TableHead>ผู้ติดต่อ</TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('paymentTerms')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-payment-terms"
                    >
                      เงื่อนไขชำระ {getSortIcon('paymentTerms')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('sites')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-sites"
                    >
                      สถานที่ {getSortIcon('sites')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button 
                      type="button"
                      onClick={() => handleSort('isActive')} 
                      className="flex items-center hover:text-foreground transition-colors"
                      data-testid="sort-status"
                    >
                      สถานะ {getSortIcon('isActive')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedAccounts.map((account) => {
                  const contact = getPrimaryContact(account.contacts);
                  const siteCount = account.deliverySites?.length ?? 0;
                  const isExpanded = expandedAccounts.has(account.id);
                  
                  return (
                    <Fragment key={account.id}>
                        <TableRow data-testid={`row-account-${account.id}`}>
                          <TableCell>
                            {siteCount > 0 && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => toggleExpanded(account.id)}
                                  data-testid={`button-expand-${account.id}`}
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{account.code}</TableCell>
                          <TableCell>
                            <Badge variant="default" className={getNicknameBadgeStyle(account.nickname ?? '')}>
                              {account.nickname}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px]">
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate" title={account.businessName ?? ''}>{account.businessName}</span>
                            </div>
                            {account.taxId && (
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">{account.taxId}</div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            {account.branchName ? (
                              <div className="space-y-0.5">
                                <div className="text-sm truncate">{account.branchName}</div>
                                {account.branchCode && (
                                  <div className="text-xs text-muted-foreground font-mono">{account.branchCode}</div>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {account.contacts && account.contacts.length > 0 ? (
                                <>
                                  {account.contacts.slice(0, 2).map((c) => (
                                    <div 
                                      key={c.id} 
                                      className="flex items-center gap-1 text-sm group cursor-pointer hover:text-foreground"
                                      onClick={() => openEditContactDialog(c)}
                                      data-testid={`contact-${c.id}`}
                                    >
                                      <span className="truncate max-w-[100px]" title={c.fullName}>{c.fullName}</span>
                                      {c.isPrimary && <Badge variant="secondary" className="text-[10px] px-1">หลัก</Badge>}
                                      <Edit className="w-3 h-3 invisible group-hover:visible text-muted-foreground" />
                                    </div>
                                  ))}
                                  {account.contacts.length > 2 && (
                                    <span className="text-xs text-muted-foreground">+{account.contacts.length - 2} more</span>
                                  )}
                                </>
                              ) : null}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-xs" 
                                onClick={() => openAddContactDialog(account.id)}
                                data-testid={`button-add-contact-${account.id}`}
                              >
                                <UserPlus className="w-3 h-3 mr-1" />
                                เพิ่ม
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {account.paymentTerms ?? "เงินสด"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {siteCount} แห่ง
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.isActive ? "secondary" : "outline"}>
                              {account.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openEditDialog(account)}
                                data-testid={`button-edit-${account.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setDeleteAccountId(account.id)}
                                data-testid={`button-delete-${account.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && account.deliverySites?.filter((site) => {
                          // When no search, show all sites
                          if (!search.trim()) return true;
                          // When searching, only show sites that match search terms
                          const searchLower = search.toLowerCase().trim();
                          const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 0);
                          return searchTerms.every(term => 
                            (site.displayName ?? '').toLowerCase().includes(term) ||
                            (site.branchName ?? '').toLowerCase().includes(term) ||
                            (site.partnerBranchCode ?? '').toLowerCase().includes(term) ||
                            (site.siteCode ?? '').toLowerCase().includes(term) ||
                            (site.addressLine1 ?? '').toLowerCase().includes(term) ||
                            (site.district ?? '').toLowerCase().includes(term) ||
                            (site.subDistrict ?? '').toLowerCase().includes(term) ||
                            (site.province ?? '').toLowerCase().includes(term) ||
                            (site.deliveryZone ?? '').toLowerCase().includes(term)
                          );
                        }).map((site) => (
                              <TableRow 
                                key={site.id} 
                                className="bg-muted/30"
                                data-testid={`row-site-${site.id}`}
                              >
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {site.siteCode}
                                </TableCell>
                                <TableCell colSpan={2}>
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <div>
                                      <div className="font-medium">{site.displayName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {[site.subDistrict, site.district, site.province].filter(Boolean).join(', ')}
                                      </div>
                                      {site.postalCode && (
                                        <div className="text-xs text-muted-foreground">{site.postalCode}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {site.deliveryType === 'direct_to_store' ? 'ส่งตรง' : 'ศูนย์กระจายสินค้า'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {site.deliveryZone && (
                                    <span className="text-xs text-muted-foreground">{site.deliveryZone}</span>
                                  )}
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell>
                                  <Badge variant={site.isActive ? "secondary" : "outline"} className="text-xs">
                                    {site.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {site.googleMapsUrl && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        asChild
                                        data-testid={`button-map-${site.id}`}
                                      >
                                        <a href={site.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => openEditSiteDialog(site)} data-testid={`button-edit-site-${site.id}`}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => setDeleteSiteId(site.id)}
                                      data-testid={`button-delete-site-${site.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                        ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "แก้ไขบัญชีลูกค้า" : "เพิ่มบัญชีลูกค้า"}</DialogTitle>
            <DialogDescription>
              {editingAccount ? "แก้ไขข้อมูลบัญชีลูกค้าด้านล่าง" : "กรอกข้อมูลเพื่อสร้างบัญชีลูกค้าใหม่"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อเรียก *</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น MK - Makro" {...field} data-testid="input-nickname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสบัญชี *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., C001" {...field} data-testid="input-account-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อธุรกิจ *</FormLabel>
                    <FormControl>
                      <Input placeholder="เช่น บริษัท สยามแม็คโคร จำกัด (มหาชน)" {...field} data-testid="input-business-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ประเภทธุรกิจ</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-business-type">
                            <SelectValue placeholder="เลือกประเภท" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BUSINESS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ประเภทลูกค้า</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer-type">
                            <SelectValue placeholder="เลือกประเภท" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CUSTOMER_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="branchCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสสาขา</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น 00000" {...field} value={field.value ?? ""} data-testid="input-branch-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branchName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อสาขา</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น สำนักงานใหญ่" {...field} value={field.value ?? ""} data-testid="input-branch-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เลขประจำตัวผู้เสียภาษี</FormLabel>
                    <FormControl>
                      <Input placeholder="เช่น 0107537002231" {...field} value={field.value ?? ""} data-testid="input-tax-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-muted-foreground">ที่อยู่สำหรับออกใบกำกับภาษี</Label>
              </div>

              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ที่อยู่บรรทัด 1</FormLabel>
                    <FormControl>
                      <Input placeholder="เลขที่ ซอย ถนน" {...field} value={field.value ?? ""} data-testid="input-address1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ที่อยู่บรรทัด 2</FormLabel>
                    <FormControl>
                      <Input placeholder="ข้อมูลเพิ่มเติม" {...field} value={field.value ?? ""} data-testid="input-address2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="subDistrict"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ตำบล/แขวง</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น หัวหมาก" {...field} value={field.value ?? ""} data-testid="input-sub-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>อำเภอ/เขต</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น สวนหลวง" {...field} value={field.value ?? ""} data-testid="input-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จังหวัด</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น กรุงเทพมหานคร" {...field} value={field.value ?? ""} data-testid="input-province" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสไปรษณีย์</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น 10250" {...field} value={field.value ?? ""} data-testid="input-postal-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-muted-foreground">เงื่อนไขการชำระเงิน</Label>
              </div>

              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เงื่อนไขการชำระ</FormLabel>
                    <Select value={field.value ?? "COD"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-terms">
                          <SelectValue placeholder="เลือกเงื่อนไข" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TERMS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value ?? true}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">ใช้งาน</FormLabel>
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
                  {editingAccount ? "บันทึก" : "สร้าง"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delivery Site Dialog */}
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSite ? "แก้ไขสถานที่จัดส่ง" : "เพิ่มสถานที่จัดส่ง"}</DialogTitle>
            <DialogDescription>
              {editingSite ? "แก้ไขข้อมูลสถานที่จัดส่งด้านล่าง" : "กรอกข้อมูลเพื่อสร้างสถานที่จัดส่งใหม่"}
            </DialogDescription>
          </DialogHeader>
          <Form {...siteForm}>
            <form onSubmit={siteForm.handleSubmit(onSiteSubmit)} className="space-y-4">
              <FormField
                control={siteForm.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>บัญชีลูกค้า *</FormLabel>
                    <Select 
                      value={field.value?.toString() || ""} 
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-site-account">
                          <SelectValue placeholder="เลือกบัญชีลูกค้า" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts?.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>{a.nickname} - {a.businessName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={siteForm.control}
                  name="siteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสสถานที่ *</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น MK-SKR-001" {...field} data-testid="input-site-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={siteForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อที่แสดง *</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น Makro สมุทรสาคร" {...field} data-testid="input-site-display-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={siteForm.control}
                  name="partnerBranchCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสสาขาพาร์ทเนอร์</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น M022" {...field} value={field.value ?? ""} data-testid="input-site-partner-branch-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={siteForm.control}
                  name="branchName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อสาขา</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น สาขาสมุทรสาคร" {...field} value={field.value ?? ""} data-testid="input-site-branch-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={siteForm.control}
                name="deliveryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ประเภทการจัดส่ง</FormLabel>
                    <Select value={field.value ?? "direct_to_store"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-type">
                          <SelectValue placeholder="เลือกประเภท" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="direct_to_store">ส่งตรงที่ร้าน</SelectItem>
                        <SelectItem value="to_distribution_center">ส่งศูนย์กระจายสินค้า</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-muted-foreground">ที่อยู่สำหรับจัดส่ง</Label>
              </div>

              <FormField
                control={siteForm.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ที่อยู่บรรทัด 1</FormLabel>
                    <FormControl>
                      <Input placeholder="เลขที่ ซอย ถนน" {...field} value={field.value ?? ""} data-testid="input-site-address1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={siteForm.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ที่อยู่บรรทัด 2</FormLabel>
                    <FormControl>
                      <Input placeholder="อาคาร ชั้น ฯลฯ" {...field} value={field.value ?? ""} data-testid="input-site-address2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={siteForm.control}
                  name="subDistrict"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ตำบล/แขวง</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น ท่าจีน" {...field} value={field.value ?? ""} data-testid="input-site-subdistrict" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={siteForm.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>อำเภอ/เขต</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น เมืองสมุทรสาคร" {...field} value={field.value ?? ""} data-testid="input-site-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={siteForm.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จังหวัด</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น สมุทรสาคร" {...field} value={field.value ?? ""} data-testid="input-site-province" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={siteForm.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสไปรษณีย์</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น 74000" {...field} value={field.value ?? ""} data-testid="input-site-postal-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-muted-foreground">การตั้งค่าการจัดส่ง</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={siteForm.control}
                  name="deliveryZone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ภูมิภาค</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-delivery-region">
                            <SelectValue placeholder="เลือกภูมิภาค" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {THAILAND_REGIONS.map((region) => (
                            <SelectItem key={region.value} value={region.value}>{region.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={siteForm.control}
                  name="preferredTimeSlot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ช่วงเวลาที่ต้องการ</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-time-slot">
                            <SelectValue placeholder="เลือกช่วงเวลา" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">เช้า (6:00-12:00)</SelectItem>
                          <SelectItem value="afternoon">บ่าย (12:00-18:00)</SelectItem>
                          <SelectItem value="evening">เย็น (18:00-22:00)</SelectItem>
                          <SelectItem value="any">ตลอดเวลา</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={siteForm.control}
                name="acceptableVehicles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รถที่รับได้</FormLabel>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {VEHICLE_TYPES.map((vehicle) => {
                        const isSelected = (field.value || []).includes(vehicle.value);
                        return (
                          <label key={vehicle.value} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, vehicle.value]);
                                } else {
                                  field.onChange(current.filter((v: string) => v !== vehicle.value));
                                }
                              }}
                              data-testid={`checkbox-vehicle-${vehicle.value}`}
                            />
                            <span className="text-sm">{vehicle.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={siteForm.control}
                name="googleMapsUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ลิงก์ Google Maps</FormLabel>
                    <FormControl>
                      <Input placeholder="วางลิงก์ Google Maps..." {...field} value={field.value ?? ""} data-testid="input-site-maps-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={siteForm.control}
                name="accessInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>คำแนะนำการเข้าถึง</FormLabel>
                    <FormControl>
                      <Input placeholder="รหัสประตู, ข้อมูลท่าขนถ่าย..." {...field} value={field.value ?? ""} data-testid="input-site-access" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={siteForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value ?? true}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-site-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">ใช้งาน</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeSiteDialog} data-testid="button-site-cancel">
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isSitePending} data-testid="button-site-save">
                  {isSitePending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingSite ? "บันทึก" : "สร้าง"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อ"}</DialogTitle>
            <DialogDescription>
              {editingContact ? "แก้ไขข้อมูลผู้ติดต่อ" : "เพิ่มผู้ติดต่อใหม่"}
            </DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
              <FormField
                control={contactForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อ-นามสกุล *</FormLabel>
                    <FormControl>
                      <Input placeholder="ชื่อผู้ติดต่อ" {...field} data-testid="input-contact-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Site Selection - only show if account has delivery sites */}
              {selectedAccountId && (accounts?.find(a => a.id === selectedAccountId)?.deliverySites?.length ?? 0) > 0 && (
                <FormField
                  control={contactForm.control}
                  name="deliverySiteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>สถานที่จัดส่ง (ไม่บังคับ)</FormLabel>
                      <Select 
                        value={field.value?.toString() ?? "none"} 
                        onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-site">
                            <SelectValue placeholder="ผู้ติดต่อของบัญชี (ทั้งหมด)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">ผู้ติดต่อของบัญชี (ทั้งหมด)</SelectItem>
                          {accounts?.find(a => a.id === selectedAccountId)?.deliverySites?.map(site => (
                            <SelectItem key={site.id} value={site.id.toString()}>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ตำแหน่ง</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-role">
                            <SelectValue placeholder="เลือกตำแหน่ง" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="owner">เจ้าของกิจการ</SelectItem>
                          <SelectItem value="manager">ผู้จัดการ</SelectItem>
                          <SelectItem value="purchasing">ฝ่ายจัดซื้อ</SelectItem>
                          <SelectItem value="receiving">ฝ่ายรับสินค้า</SelectItem>
                          <SelectItem value="billing">ฝ่ายบัญชี</SelectItem>
                          <SelectItem value="general">ผู้ติดต่อทั่วไป</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>แผนก</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น ฝ่ายปฏิบัติการ" {...field} value={field.value ?? ""} data-testid="input-contact-dept" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>โทรศัพท์</FormLabel>
                      <FormControl>
                        <Input placeholder="02-xxx-xxxx" {...field} value={field.value ?? ""} data-testid="input-contact-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>มือถือ</FormLabel>
                      <FormControl>
                        <Input placeholder="08x-xxx-xxxx" {...field} value={field.value ?? ""} data-testid="input-contact-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>อีเมล</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@company.com" {...field} value={field.value ?? ""} data-testid="input-contact-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="lineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ไลน์ไอดี</FormLabel>
                      <FormControl>
                        <Input placeholder="ชื่อผู้ใช้ LINE" {...field} value={field.value ?? ""} data-testid="input-contact-line" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={contactForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-contact-primary"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">ผู้ติดต่อหลัก</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeContactDialog} data-testid="button-contact-cancel">
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={isContactPending} data-testid="button-contact-save">
                  {isContactPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingContact ? "บันทึก" : "เพิ่มผู้ติดต่อ"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAccountId !== null} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบบัญชีลูกค้า</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีลูกค้านี้? การดำเนินการนี้จะลบสถานที่จัดส่งและผู้ติดต่อทั้งหมดที่เกี่ยวข้องด้วย และไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-account">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountId && deleteAccountMutation.mutate(deleteAccountId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-account"
            >
              {deleteAccountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSiteId !== null} onOpenChange={() => setDeleteSiteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสถานที่จัดส่ง</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่จัดส่งนี้? ผู้ติดต่อที่เชื่อมโยงกับสถานที่นี้จะถูกลบด้วย การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-site">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSiteId && deleteSiteMutation.mutate(deleteSiteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-site"
            >
              {deleteSiteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
