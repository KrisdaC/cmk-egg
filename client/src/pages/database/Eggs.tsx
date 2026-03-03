import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Loader2, Egg, Scale, Info, Upload, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

interface EggGradeRule {
  id: number;
  gradeCode: string;
  gradeName: string;
  minWeightG: string | null;
  maxWeightG: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Partner {
  id: number;
  code: string;
  nickname: string;
  businessName: string;
}

interface PackType {
  id: number;
  code: string;
  name: string;
  thaiName: string;
  eggsPerPack: number;
  sortOrder: number;
  isActive: boolean;
}

interface FgPackSpecGrade {
  id: number;
  specId: number;
  gradeCode: string;
  percentage: string;
  sequence: number;
}

interface FgPackSpec {
  id: number;
  specCode: string;
  specName: string;
  packTypeId: number;
  minTotalWeightG: string | null;
  allowBelowGradeEggs: number | null;
  isActive: boolean;
  grades: FgPackSpecGrade[];
  packType?: PackType;
}

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
  partner?: Partner | null;
}

const eggTypes = [
  { value: 'UNGR', label: 'ไข่ดิบ', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  { value: 'GRADED', label: 'ไข่คัดขนาด', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'UNDER', label: 'ไข่ตกเกรด', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'FG', label: 'สินค้าสำเร็จรูป', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
];

const gradeCodes = ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'UNDER'];

interface BulkItem {
  itemCode: string;
  itemName: string;
  eggType: string;
  gradeCode: string | null;
  isValid: boolean;
  error?: string;
}

interface BulkSpec {
  specCode: string;
  specName: string;
  packTypeId: number;
  packTypeName: string;
  grades: { gradeCode: string; percentage: string }[];
  isValid: boolean;
  error?: string;
}

export default function Eggs() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parsedItems, setParsedItems] = useState<BulkItem[]>([]);
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<FgPackSpec | null>(null);
  const [deleteSpecId, setDeleteSpecId] = useState<number | null>(null);
  const [bulkSpecDialogOpen, setBulkSpecDialogOpen] = useState(false);
  const [bulkSpecText, setBulkSpecText] = useState("");
  const [parsedSpecs, setParsedSpecs] = useState<BulkSpec[]>([]);
  const [specFormData, setSpecFormData] = useState({
    specCode: "",
    specName: "",
    packTypeId: 0,
    minTotalWeightG: "",
    allowBelowGradeEggs: 0,
    isActive: true,
    grades: [{ gradeCode: "B3", percentage: "100" }] as { gradeCode: string; percentage: string }[],
  });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    itemCode: "",
    itemName: "",
    eggType: "UNGR" as string,
    gradeCode: null as string | null,
    lotTracked: true,
    isSellable: false,
    partnerId: null as number | null,
    isActive: true,
  });

  const { data: gradeRules, isLoading: gradeLoading } = useQuery<EggGradeRule[]>({
    queryKey: ['/api/egg-grade-rules']
  });

  const { data: items, isLoading: itemsLoading } = useQuery<ItemMaster[]>({
    queryKey: ['/api/item-master'],
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ['/api/customer-accounts']
  });

  const { data: packTypes, isLoading: packTypesLoading } = useQuery<PackType[]>({
    queryKey: ['/api/pack-types']
  });

  const { data: packSpecs, isLoading: specsLoading } = useQuery<FgPackSpec[]>({
    queryKey: ['/api/fg-pack-specs']
  });

  const eggItems = items?.filter(i => i.itemCategory === 'EGG') || [];

  const filteredItems = eggItems.filter(item => {
    const matchesSearch = !search || 
      item.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      (item.gradeCode ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (item.partner?.nickname ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || item.eggType === filterType;
    return matchesSearch && matchesType;
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('POST', '/api/item-master', {
        ...data,
        itemCategory: 'EGG',
        baseUom: 'EGG',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/item-master'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "สำเร็จ", description: "เพิ่มรายการไข่แล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: number }) => {
      return await apiRequest('PATCH', `/api/item-master/${data.id}`, {
        itemCode: data.itemCode,
        itemName: data.itemName,
        eggType: data.eggType,
        gradeCode: data.gradeCode,
        lotTracked: data.lotTracked,
        isSellable: data.isSellable,
        partnerId: data.partnerId,
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/item-master'] });
      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
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

  const createSpecMutation = useMutation({
    mutationFn: async (data: typeof specFormData) => {
      return await apiRequest('POST', '/api/fg-pack-specs', {
        specCode: data.specCode,
        specName: data.specName,
        packTypeId: data.packTypeId,
        minTotalWeightG: data.minTotalWeightG || null,
        allowBelowGradeEggs: data.allowBelowGradeEggs,
        isActive: data.isActive,
        grades: data.grades,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fg-pack-specs'] });
      setSpecDialogOpen(false);
      resetSpecForm();
      toast({ title: "สำเร็จ", description: "เพิ่ม Pack Spec แล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const updateSpecMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof specFormData }) => {
      return await apiRequest('PATCH', `/api/fg-pack-specs/${id}`, {
        specCode: data.specCode,
        specName: data.specName,
        packTypeId: data.packTypeId,
        minTotalWeightG: data.minTotalWeightG || null,
        allowBelowGradeEggs: data.allowBelowGradeEggs,
        isActive: data.isActive,
        grades: data.grades,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fg-pack-specs'] });
      setSpecDialogOpen(false);
      setEditingSpec(null);
      resetSpecForm();
      toast({ title: "สำเร็จ", description: "อัปเดต Pack Spec แล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const deleteSpecMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/fg-pack-specs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fg-pack-specs'] });
      toast({ title: "สำเร็จ", description: "ลบ Pack Spec แล้ว" });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const bulkSpecCreateMutation = useMutation({
    mutationFn: async (specs: BulkSpec[]) => {
      const validSpecs = specs.filter(s => s.isValid);
      const results = await Promise.allSettled(
        validSpecs.map(spec => 
          apiRequest('POST', '/api/fg-pack-specs', {
            specCode: spec.specCode,
            specName: spec.specName,
            packTypeId: spec.packTypeId,
            minTotalWeightG: null,
            allowBelowGradeEggs: 0,
            isActive: true,
            grades: spec.grades,
          })
        )
      );
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      return { successCount, failCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/fg-pack-specs'] });
      setBulkSpecDialogOpen(false);
      setBulkSpecText("");
      setParsedSpecs([]);
      toast({ 
        title: "สำเร็จ", 
        description: `เพิ่มแล้ว ${result.successCount} รายการ${result.failCount > 0 ? `, ล้มเหลว ${result.failCount} รายการ` : ''}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (items: BulkItem[]) => {
      const validItems = items.filter(i => i.isValid);
      const results = await Promise.allSettled(
        validItems.map(item => 
          apiRequest('POST', '/api/item-master', {
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemCategory: 'EGG',
            eggType: item.eggType,
            gradeCode: item.gradeCode,
            baseUom: 'EGG',
            lotTracked: true,
            isSellable: item.eggType === 'FG',
            isActive: true,
          })
        )
      );
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      return { successCount, failCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/item-master'] });
      setBulkDialogOpen(false);
      setBulkText("");
      setParsedItems([]);
      toast({ 
        title: "สำเร็จ", 
        description: `เพิ่มแล้ว ${result.successCount} รายการ${result.failCount > 0 ? `, ล้มเหลว ${result.failCount} รายการ` : ''}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" });
    }
  });

  const parseBulkText = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const existingCodes = new Set(eggItems.map(i => i.itemCode.toUpperCase()));
    
    const parsed: BulkItem[] = lines.map(line => {
      const parts = line.split('\t');
      const itemCode = parts[0]?.trim() || '';
      const itemName = parts[1]?.trim() || '';
      const eggType = parts[2]?.trim().toUpperCase() || 'UNGR';
      const gradeCodeRaw = parts[3]?.trim().toUpperCase() || '';

      const gradeCode = gradeCodeRaw && gradeCodes.includes(gradeCodeRaw) ? gradeCodeRaw : null;

      let isValid = true;
      let error: string | undefined;

      if (!itemCode) {
        isValid = false;
        error = 'ไม่มีรหัส';
      } else if (!itemName) {
        isValid = false;
        error = 'ไม่มีชื่อ';
      } else if (!['UNGR', 'GRADED', 'UNDER', 'FG'].includes(eggType)) {
        isValid = false;
        error = 'ประเภทไม่ถูกต้อง';
      } else if (existingCodes.has(itemCode.toUpperCase())) {
        isValid = false;
        error = 'รหัสซ้ำ';
      } else if (eggType === 'GRADED' && !gradeCode) {
        isValid = false;
        error = 'ต้องระบุเบอร์สำหรับไข่คัดขนาด';
      }

      return {
        itemCode,
        itemName,
        eggType,
        gradeCode,
        isValid,
        error,
      };
    });

    setParsedItems(parsed);
  };

  const detectPackTypeFromName = (specName: string): { packTypeId: number; packTypeName: string } | null => {
    if (!packTypes || packTypes.length === 0) return null;
    
    const normalizedSpec = specName.toLowerCase().replace(/\s+/g, ' ').trim();
    
    for (const pt of packTypes) {
      const patterns = [
        pt.thaiName.toLowerCase(),
        pt.name.toLowerCase(),
        pt.code.toLowerCase(),
      ];
      
      for (const pattern of patterns) {
        const normalizedPattern = pattern.replace(/\s+/g, ' ').trim();
        if (normalizedSpec.includes(normalizedPattern)) {
          return { packTypeId: pt.id, packTypeName: pt.thaiName };
        }
      }
      
      if (pt.thaiName.includes('Pack')) {
        const packNum = pt.thaiName.match(/Pack\s*(\d+)/i)?.[1];
        if (packNum && new RegExp(`pack\\s*${packNum}\\b`, 'i').test(specName)) {
          return { packTypeId: pt.id, packTypeName: pt.thaiName };
        }
      }
      
      if (pt.thaiName.includes('มัด')) {
        const bundleNum = pt.thaiName.match(/มัด\s*(\d+)/)?.[1];
        if (bundleNum && new RegExp(`มัด\\s*${bundleNum}\\b`).test(specName)) {
          return { packTypeId: pt.id, packTypeName: pt.thaiName };
        }
      }
      
      if ((pt.code === 'TRAY' || pt.thaiName.includes('ถาด')) && /ถาด/.test(specName)) {
        return { packTypeId: pt.id, packTypeName: pt.thaiName };
      }
    }
    return null;
  };

  const parseBulkSpecText = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const existingNames = new Set(packSpecs?.map(s => s.specName.toLowerCase()) || []);
    const batchNames = new Set<string>();
    let specCounter = (packSpecs?.length || 0) + 1;
    
    const parsed: BulkSpec[] = lines.map((line, idx) => {
      const parts = line.split('\t');
      const specName = parts[0]?.trim() || '';
      const gradeCodeA = parts[3]?.trim().toUpperCase() || '';
      const percentA = parts[4]?.trim() || '';
      const gradeCodeB = parts[6]?.trim().toUpperCase() || '';
      
      const packTypeInfo = detectPackTypeFromName(specName);
      
      const grades: { gradeCode: string; percentage: string }[] = [];
      
      if (gradeCodeA && gradeCodeA !== 'NELL' && gradeCodes.includes(gradeCodeA)) {
        const pctA = parseFloat(percentA) || 100;
        grades.push({ gradeCode: gradeCodeA, percentage: pctA.toString() });
        
        if (gradeCodeB && gradeCodeB !== 'NELL' && gradeCodes.includes(gradeCodeB)) {
          const pctB = 100 - pctA;
          if (pctB > 0) {
            grades.push({ gradeCode: gradeCodeB, percentage: pctB.toString() });
          }
        }
      }
      
      const specCode = `SPEC-${String(specCounter + idx).padStart(4, '0')}`;
      
      let isValid = true;
      let error: string | undefined;
      const specNameLower = specName.toLowerCase();
      
      if (!specName) {
        isValid = false;
        error = 'ไม่มีชื่อ';
      } else if (existingNames.has(specNameLower)) {
        isValid = false;
        error = 'ชื่อซ้ำในระบบ';
      } else if (batchNames.has(specNameLower)) {
        isValid = false;
        error = 'ชื่อซ้ำในรายการนี้';
      } else if (!packTypeInfo) {
        isValid = false;
        error = 'ไม่พบประเภทบรรจุ (ลองใส่ Pack/ถาด/มัด)';
      } else if (grades.length === 0) {
        isValid = false;
        error = 'ไม่มีเบอร์ไข่ที่ถูกต้อง';
      }
      
      if (specName) {
        batchNames.add(specNameLower);
      }
      
      return {
        specCode,
        specName,
        packTypeId: packTypeInfo?.packTypeId || 0,
        packTypeName: packTypeInfo?.packTypeName || '-',
        grades,
        isValid,
        error,
      };
    });
    
    setParsedSpecs(parsed);
  };

  const resetForm = () => {
    setFormData({
      itemCode: "",
      itemName: "",
      eggType: "UNGR",
      gradeCode: null,
      lotTracked: true,
      isSellable: false,
      partnerId: null,
      isActive: true,
    });
  };

  const resetSpecForm = () => {
    setSpecFormData({
      specCode: "",
      specName: "",
      packTypeId: 0,
      minTotalWeightG: "",
      allowBelowGradeEggs: 0,
      isActive: true,
      grades: [{ gradeCode: "B3", percentage: "100" }],
    });
  };

  const openAddSpecDialog = () => {
    setEditingSpec(null);
    resetSpecForm();
    setSpecDialogOpen(true);
  };

  const openEditSpecDialog = (spec: FgPackSpec) => {
    setEditingSpec(spec);
    setSpecFormData({
      specCode: spec.specCode,
      specName: spec.specName,
      packTypeId: spec.packTypeId,
      minTotalWeightG: spec.minTotalWeightG || "",
      allowBelowGradeEggs: spec.allowBelowGradeEggs ?? 0,
      isActive: spec.isActive,
      grades: spec.grades.map(g => ({ gradeCode: g.gradeCode, percentage: g.percentage })),
    });
    setSpecDialogOpen(true);
  };

  const handleSpecSubmit = () => {
    let hasNaN = false;
    const totalPercentage = specFormData.grades.reduce((sum, g) => {
      const pct = parseFloat(g.percentage || "0");
      if (isNaN(pct)) hasNaN = true;
      return sum + (isNaN(pct) ? 0 : pct);
    }, 0);
    if (hasNaN) {
      toast({ title: "ข้อผิดพลาด", description: "กรุณากรอกเปอร์เซ็นต์ให้ถูกต้อง", variant: "destructive" });
      return;
    }
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({ title: "ข้อผิดพลาด", description: "ผลรวมเปอร์เซ็นต์ต้องเท่ากับ 100%", variant: "destructive" });
      return;
    }
    if (editingSpec) {
      updateSpecMutation.mutate({ id: editingSpec.id, data: specFormData });
    } else {
      createSpecMutation.mutate(specFormData);
    }
  };

  const addGradeLine = () => {
    setSpecFormData(prev => ({
      ...prev,
      grades: [...prev.grades, { gradeCode: "B3", percentage: "0" }],
    }));
  };

  const removeGradeLine = (index: number) => {
    setSpecFormData(prev => ({
      ...prev,
      grades: prev.grades.filter((_, i) => i !== index),
    }));
  };

  const updateGradeLine = (index: number, field: 'gradeCode' | 'percentage', value: string) => {
    setSpecFormData(prev => ({
      ...prev,
      grades: prev.grades.map((g, i) => i === index ? { ...g, [field]: value } : g),
    }));
  };

  const totalPercentage = specFormData.grades.reduce((sum, g) => {
    const pct = parseFloat(g.percentage || "0");
    return sum + (isNaN(pct) ? 0 : pct);
  }, 0);

  const openAddDialog = () => {
    setEditingItem(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: ItemMaster) => {
    setEditingItem(item);
    setFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      eggType: item.eggType || "UNGR",
      gradeCode: item.gradeCode,
      lotTracked: item.lotTracked,
      isSellable: item.isSellable,
      partnerId: item.partnerId,
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ ...formData, id: editingItem.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTypeBadge = (type: string | null) => {
    const found = eggTypes.find(t => t.value === type);
    if (!found) return <Badge variant="outline">-</Badge>;
    return <Badge className={found.color}>{found.label}</Badge>;
  };

  const formatWeight = (weight: string | null) => {
    if (!weight) return '-';
    return `${parseFloat(weight).toFixed(1)}g`;
  };

  const isGraded = formData.eggType === 'GRADED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Eggs Master Data</h1>
          <p className="text-muted-foreground">
            รายการมาสเตอร์ไข่ทั้งหมด - ไข่ดิบ, ไข่คัดขนาด, ไข่ตกเกรด, สินค้าสำเร็จรูป
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)} data-testid="button-bulk-add">
            <Upload className="w-4 h-4 mr-2" />
            นำเข้าหลายรายการ
          </Button>
          <Button onClick={openAddDialog} data-testid="button-add-egg">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มรายการ
          </Button>
        </div>
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList data-testid="tabs-eggs">
          <TabsTrigger value="items" data-testid="tab-items">
            <Egg className="w-4 h-4 mr-2" />
            Egg Master ({eggItems.length})
          </TabsTrigger>
          <TabsTrigger value="specs" data-testid="tab-specs">
            <FileText className="w-4 h-4 mr-2" />
            Pack Specs ({packSpecs?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="grades" data-testid="tab-grades">
            <Scale className="w-4 h-4 mr-2" />
            Grade Rules ({gradeRules?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="ค้นหาด้วยรหัส, ชื่อ หรือลูกค้า..." 
                    className="pl-9" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant={filterType === null ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setFilterType(null)}
                    data-testid="button-filter-all"
                  >
                    All
                  </Button>
                  {eggTypes.map(t => (
                    <Button 
                      key={t.value}
                      variant={filterType === t.value ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setFilterType(t.value)}
                      data-testid={`button-filter-${t.value}`}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
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
                      <TableHead className="w-32">ประเภท</TableHead>
                      <TableHead className="w-32">เบอร์/ไซส์</TableHead>
                      <TableHead className="w-32">ลูกค้า</TableHead>
                      <TableHead className="w-24">สถานะ</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                        <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{getTypeBadge(item.eggType)}</TableCell>
                        <TableCell>
                          {item.gradeCode ? (
                            <Badge variant="outline">{item.gradeCode}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.partner ? (
                            <Badge variant="secondary" className="text-xs">
                              {item.partner.nickname}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isActive ? "secondary" : "outline"}>
                            {item.isActive ? "ใช้งาน" : "ปิด"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => openEditDialog(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => setDeleteId(item.id)}
                              data-testid={`button-delete-${item.id}`}
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
        </TabsContent>

        <TabsContent value="specs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    ข้อกำหนดบรรจุภัณฑ์ (Pack Specs)
                  </CardTitle>
                  <CardDescription>
                    ตารางกฎหมายกำหนด spec ของบรรจุภัณฑ์สำเร็จรูป - FG Item จะอ้างอิงมาที่นี่
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setBulkSpecDialogOpen(true)} data-testid="button-bulk-import-spec">
                    <Upload className="w-4 h-4 mr-2" />
                    นำเข้าจาก Excel
                  </Button>
                  <Button onClick={openAddSpecDialog} data-testid="button-add-spec">
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่ม Spec
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {specsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : packSpecs?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีข้อกำหนดบรรจุภัณฑ์</p>
                  <p className="text-sm">กดปุ่ม "เพิ่ม Spec" เพื่อเพิ่มข้อกำหนดใหม่</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">รหัส Spec</TableHead>
                      <TableHead>ชื่อ Spec</TableHead>
                      <TableHead className="w-32">ประเภทบรรจุ</TableHead>
                      <TableHead className="w-28 text-right">น้ำหนักขั้นต่ำ</TableHead>
                      <TableHead>สัดส่วนเบอร์</TableHead>
                      <TableHead className="w-24">สถานะ</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packSpecs?.map((spec) => {
                      const packType = packTypes?.find(p => p.id === spec.packTypeId);
                      return (
                        <TableRow key={spec.id} data-testid={`row-spec-${spec.id}`}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{spec.specCode}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{spec.specName}</TableCell>
                          <TableCell>
                            {packType ? (
                              <Badge variant="secondary">{packType.thaiName} ({packType.eggsPerPack}ฟอง)</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {spec.minTotalWeightG ? `${parseFloat(spec.minTotalWeightG).toLocaleString()}g` : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {spec.grades?.map((g: { gradeCode: string; percentage: string }, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {g.gradeCode}: {g.percentage}%
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={spec.isActive ? "secondary" : "outline"}>
                              {spec.isActive ? "ใช้งาน" : "ปิด"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => openEditSpecDialog(spec)}
                                data-testid={`button-edit-spec-${spec.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => setDeleteSpecId(spec.id)}
                                data-testid={`button-delete-spec-${spec.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                กฎการคัดขนาดไข่ (Grade Rules)
              </CardTitle>
              <CardDescription>
                ตารางกฎหมายกำหนดน้ำหนักไข่แต่ละเบอร์ - ข้อมูลนี้เป็นข้อมูลอ้างอิงเท่านั้น ไม่สามารถแก้ไขได้
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gradeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">รหัสเบอร์</TableHead>
                      <TableHead>ชื่อเบอร์</TableHead>
                      <TableHead className="w-32 text-right">น้ำหนักต่ำสุด</TableHead>
                      <TableHead className="w-32 text-right">น้ำหนักสูงสุด</TableHead>
                      <TableHead className="w-24">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeRules?.map((rule) => (
                      <TableRow key={rule.id} data-testid={`row-grade-${rule.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{rule.gradeCode}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{rule.gradeName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatWeight(rule.minWeightG)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatWeight(rule.maxWeightG)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? "secondary" : "outline"}>
                            {rule.isActive ? "ใช้งาน" : "ปิด"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "แก้ไขรายการไข่" : "เพิ่มรายการไข่"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "แก้ไขข้อมูลรายการไข่" : "เพิ่มรายการไข่ใหม่เข้าสู่ระบบ"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemCode">รหัสสินค้า</Label>
                <Input
                  id="itemCode"
                  value={formData.itemCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemCode: e.target.value }))}
                  placeholder="EGG-UNGR-001"
                  data-testid="input-item-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eggType">ประเภทไข่</Label>
                <Select
                  value={formData.eggType}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    eggType: value,
                    gradeCode: value === 'GRADED' ? prev.gradeCode : null,
                    isSellable: value === 'FG',
                  }))}
                >
                  <SelectTrigger data-testid="select-egg-type">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent>
                    {eggTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemName">ชื่อสินค้า</Label>
              <Input
                id="itemName"
                value={formData.itemName}
                onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
                placeholder="ไข่ไก่ดิบ ล็อตรับ"
                data-testid="input-item-name"
              />
            </div>

            {isGraded && (
              <div className="space-y-2">
                <Label htmlFor="gradeCode">เบอร์ไข่</Label>
                <Select
                  value={formData.gradeCode || ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gradeCode: value }))}
                >
                  <SelectTrigger data-testid="select-grade-code">
                    <SelectValue placeholder="เลือกเบอร์" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeCodes.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}


            <div className="space-y-2">
              <Label>ลูกค้าเฉพาะ (ถ้ามี)</Label>
              <Select
                value={formData.partnerId?.toString() || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  partnerId: value === "none" ? null : parseInt(value) 
                }))}
              >
                <SelectTrigger data-testid="select-partner">
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">- ไม่ระบุ (ใช้ทั่วไป) -</SelectItem>
                  {partners?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nickname} - {p.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="lotTracked"
                  checked={formData.lotTracked}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, lotTracked: checked }))}
                  data-testid="switch-lot-tracked"
                />
                <Label htmlFor="lotTracked">ติดตามล็อต</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isSellable"
                  checked={formData.isSellable}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isSellable: checked }))}
                  data-testid="switch-sellable"
                />
                <Label htmlFor="isSellable">ขายได้</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  data-testid="switch-active"
                />
                <Label htmlFor="isActive">ใช้งาน</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingItem ? "บันทึก" : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบรายการนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">
              ยกเลิก
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { 
        setBulkDialogOpen(open); 
        if (!open) { setBulkText(""); setParsedItems([]); }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นำเข้าหลายรายการ</DialogTitle>
            <DialogDescription>
              วางข้อมูลจาก Excel แบบ Tab-separated: รหัส | ชื่อ | ประเภท | เบอร์ | จำนวน/แพ็ค | น้ำหนักขั้นต่ำ | ยอมให้ต่ำกว่า | เบอร์อนุญาต (คั่นด้วย ,)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>วางข้อมูลจาก Excel (Tab-separated)</Label>
              <Textarea
                placeholder="EGG-NEW-001&#9;ไข่ดิบใหม่&#9;UNGR&#9;&#9;&#9;&#9;&#10;FG-NEW-B1-10&#9;ไข่เบอร์ 1 แพ็ค 10 ฟอง&#9;FG&#9;B1&#9;10&#9;650&#9;0"
                className="min-h-[120px] font-mono text-sm"
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  parseBulkText(e.target.value);
                }}
                data-testid="textarea-bulk-input"
              />
            </div>

            {parsedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ตัวอย่างข้อมูล ({parsedItems.filter(i => i.isValid).length} รายการพร้อมนำเข้า)</Label>
                  {parsedItems.some(i => !i.isValid) && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {parsedItems.filter(i => !i.isValid).length} ข้อผิดพลาด
                    </Badge>
                  )}
                </div>
                <div className="border rounded-md overflow-auto max-h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-28">รหัส</TableHead>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead className="w-20">ประเภท</TableHead>
                        <TableHead className="w-16">เบอร์</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedItems.map((item, idx) => (
                        <TableRow key={idx} className={!item.isValid ? "bg-destructive/10" : ""}>
                          <TableCell>
                            {item.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="w-4 h-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>{item.error}</TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.itemCode || '-'}</TableCell>
                          <TableCell className="text-sm">{item.itemName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{item.eggType}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{item.gradeCode || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkDialogOpen(false); setBulkText(""); setParsedItems([]); }} data-testid="button-cancel-bulk">
              ยกเลิก
            </Button>
            <Button 
              onClick={() => bulkCreateMutation.mutate(parsedItems)}
              disabled={bulkCreateMutation.isPending || parsedItems.filter(i => i.isValid).length === 0}
              data-testid="button-import-bulk"
            >
              {bulkCreateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              นำเข้า {parsedItems.filter(i => i.isValid).length} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSpec ? "แก้ไข Pack Spec" : "เพิ่ม Pack Spec"}</DialogTitle>
            <DialogDescription>
              {editingSpec ? "แก้ไขข้อกำหนดบรรจุภัณฑ์" : "เพิ่มข้อกำหนดบรรจุภัณฑ์ใหม่"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specCode">รหัส Spec</Label>
                <Input
                  id="specCode"
                  value={specFormData.specCode}
                  onChange={(e) => setSpecFormData(prev => ({ ...prev, specCode: e.target.value }))}
                  placeholder="SPEC-0001"
                  data-testid="input-spec-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specName">ชื่อ Spec</Label>
                <Input
                  id="specName"
                  value={specFormData.specName}
                  onChange={(e) => setSpecFormData(prev => ({ ...prev, specName: e.target.value }))}
                  placeholder="ไข่เบอร์ 3 แพ็ค 10 ฟอง"
                  data-testid="input-spec-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packType">ประเภทบรรจุ</Label>
                <Select
                  value={specFormData.packTypeId?.toString() || ""}
                  onValueChange={(value) => setSpecFormData(prev => ({ ...prev, packTypeId: parseInt(value) }))}
                >
                  <SelectTrigger data-testid="select-pack-type">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent>
                    {packTypes?.map(pt => (
                      <SelectItem key={pt.id} value={pt.id.toString()}>
                        {pt.thaiName} ({pt.eggsPerPack}ฟอง)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minWeight">น้ำหนักขั้นต่ำ (g)</Label>
                <Input
                  id="minWeight"
                  value={specFormData.minTotalWeightG}
                  onChange={(e) => setSpecFormData(prev => ({ ...prev, minTotalWeightG: e.target.value }))}
                  placeholder="650"
                  data-testid="input-min-weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="belowGrade">ยอมไข่ต่ำกว่า</Label>
                <Input
                  id="belowGrade"
                  type="number"
                  value={specFormData.allowBelowGradeEggs}
                  onChange={(e) => setSpecFormData(prev => ({ ...prev, allowBelowGradeEggs: parseInt(e.target.value) || 0 }))}
                  data-testid="input-below-grade"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>สัดส่วนเบอร์ (รวม 100%)</Label>
                <Badge variant={Math.abs(totalPercentage - 100) <= 0.01 ? "secondary" : "destructive"}>
                  รวม: {totalPercentage}%
                </Badge>
              </div>
              <div className="space-y-2">
                {specFormData.grades.map((grade, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select
                      value={grade.gradeCode}
                      onValueChange={(value) => updateGradeLine(idx, 'gradeCode', value)}
                    >
                      <SelectTrigger className="w-24" data-testid={`select-grade-code-${idx}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeCodes.map(gc => (
                          <SelectItem key={gc} value={gc}>{gc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-20"
                      value={grade.percentage}
                      onChange={(e) => updateGradeLine(idx, 'percentage', e.target.value)}
                      data-testid={`input-percentage-${idx}`}
                    />
                    <span className="text-muted-foreground">%</span>
                    {specFormData.grades.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeGradeLine(idx)}
                        data-testid={`button-remove-grade-${idx}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addGradeLine}
                  data-testid="button-add-grade-line"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มเบอร์
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="specActive"
                checked={specFormData.isActive}
                onCheckedChange={(checked) => setSpecFormData(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-spec-active"
              />
              <Label htmlFor="specActive">ใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecDialogOpen(false)} data-testid="button-cancel-spec">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSpecSubmit} 
              disabled={createSpecMutation.isPending || updateSpecMutation.isPending || Math.abs(totalPercentage - 100) > 0.01}
              data-testid="button-save-spec"
            >
              {(createSpecMutation.isPending || updateSpecMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingSpec ? "บันทึก" : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteSpecId !== null} onOpenChange={() => setDeleteSpecId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ Pack Spec</DialogTitle>
            <DialogDescription>
              คุณต้องการลบข้อกำหนดบรรจุภัณฑ์นี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSpecId(null)} data-testid="button-cancel-delete-spec">
              ยกเลิก
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteSpecId && deleteSpecMutation.mutate(deleteSpecId)}
              disabled={deleteSpecMutation.isPending}
              data-testid="button-confirm-delete-spec"
            >
              {deleteSpecMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkSpecDialogOpen} onOpenChange={(open) => {
        setBulkSpecDialogOpen(open);
        if (!open) {
          setBulkSpecText("");
          setParsedSpecs([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>นำเข้า Pack Specs จาก Excel</DialogTitle>
            <DialogDescription>
              วางข้อมูลจาก Excel (7 คอลัมน์: ชื่อ Spec | col2 | col3 | เบอร์ A | % A | col6 | เบอร์ B)
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            <Textarea
              placeholder={`ตัวอย่าง:\nPack 4 B3\t-\t-\tB3\t100\t-\tNell\nPack 4 คละ B3/B4\t-\t-\tB3\t40\t-\tB4`}
              value={bulkSpecText}
              onChange={(e) => {
                setBulkSpecText(e.target.value);
                if (e.target.value.trim()) {
                  parseBulkSpecText(e.target.value);
                } else {
                  setParsedSpecs([]);
                }
              }}
              className="min-h-[120px] font-mono text-xs"
              data-testid="textarea-bulk-spec"
            />
            
            {parsedSpecs.length > 0 && (
              <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-28">รหัส Spec</TableHead>
                      <TableHead>ชื่อ Spec</TableHead>
                      <TableHead className="w-28">ประเภทบรรจุ</TableHead>
                      <TableHead>เบอร์/สัดส่วน</TableHead>
                      <TableHead className="w-24">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedSpecs.map((spec, idx) => (
                      <TableRow key={idx} className={spec.isValid ? "" : "bg-destructive/10"}>
                        <TableCell>
                          {spec.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{spec.specCode}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{spec.specName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{spec.packTypeName}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {spec.grades.map((g, gIdx) => (
                              <Badge key={gIdx} variant="secondary" className="text-xs">
                                {g.gradeCode}: {g.percentage}%
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {spec.isValid ? (
                            <Badge variant="secondary">พร้อมนำเข้า</Badge>
                          ) : (
                            <Badge variant="destructive">{spec.error}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {parsedSpecs.length > 0 && (
              <div className="text-sm text-muted-foreground">
                พร้อมนำเข้า: {parsedSpecs.filter(s => s.isValid).length} / {parsedSpecs.length} รายการ
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSpecDialogOpen(false)} data-testid="button-cancel-bulk-spec">
              ยกเลิก
            </Button>
            <Button
              onClick={() => bulkSpecCreateMutation.mutate(parsedSpecs)}
              disabled={bulkSpecCreateMutation.isPending || parsedSpecs.filter(s => s.isValid).length === 0}
              data-testid="button-submit-bulk-spec"
            >
              {bulkSpecCreateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              นำเข้า {parsedSpecs.filter(s => s.isValid).length} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
