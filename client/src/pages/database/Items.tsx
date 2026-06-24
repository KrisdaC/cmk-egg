import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getItems, getItemById, upsertItem, deleteItem } from "@/lib/api/items";

interface Item {
  id: number;
  sku: string | null;
  name: string;
  description: string | null;
  partnerId: number | null;
  partnerName: string | null;
  partnerCode: string | null;
  itemNumber: string | null;
  barcodeLabel: string | null;
  itemType: string | null;
  partners?: {
    partnerId: number;
    partnerCode: string | null;
    partnerName: string | null;
  }[];
  itemRole: string | null;
  sellingUnit: string | null;
  baseUnit: string | null;
  packUnit: string | null;
  paletteUnit: string | null;
  basketUnit: string | null;
  basketSku: string | null;
  storageUnit: string | null;
  basePerStorage: number | null;
  eggsPerBasket: number | null;
  eggsPerPack: number | null;
  eggsPerPalette: number | null;
  packPerBasket: number | null;
  basketPerPalette: number | null;
  isEgg: boolean | null;
  primarySize: string | null;
  secondarySize: string | null;
  minPrimary: number | null;
  isActive: string | null;
  isSellable: boolean | null;
  isProducable: boolean | null;
  isConsumable: boolean | null;
  packagingProfile: string | null;
  additionalMaterials: string | null;
  createdAt: string;
}

// Maps stored egg_content_type → friendly UI input type
function _contentTypeToInputType(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  if (code === "UNGRADED_EGG") return "raw";
  if (code === "UNDERGRADE") return "under";
  if (code === "GRADED_SINGLE" || code === "GRADED_MIX") return "graded";
  return undefined;
}

// Maps UI input type + is_mixed → canonical egg_content_type
function _inputTypeToContentType(inputType: string | undefined, isMixed: boolean): string | null {
  if (!inputType) return null;
  if (inputType === "raw") return "UNGRADED_EGG";
  if (inputType === "under") return "UNDERGRADE";
  if (inputType === "graded") return isMixed ? "GRADED_MIX" : "GRADED_SINGLE";
  return null;
}

// Packaging profile slot definitions matching handover _BOM_PACKAGING_SLOTS
const PKG_SLOTS = [
  { role: "pack_base",             en: "Base Pack",               allowed_types: ["tray"]            },
  { role: "cover",                 en: "Cover",                   allowed_types: ["cover"]           },
  { role: "barcode_sku_label",     en: "SKU barcode label",       allowed_types: ["label"]           },
  { role: "product_label_sticker", en: "Product label / sticker", allowed_types: ["sticker", "label"]},
  { role: "closer_1",              en: "Closer 1",                allowed_types: []                  },
  { role: "closer_2",              en: "Closer 2",                allowed_types: []                  },
  { role: "bulk_barcode_label",    en: "Bulk barcode label",      allowed_types: ["label"]           },
  { role: "other",                 en: "Others",                  allowed_types: ["other"]           },
] as const;

type PkgSlotData = { enabled: boolean; item_type: string; component_sku: string; qty_per_pack: number };
type PackagingProfile = Record<string, PkgSlotData>;

const PKG_ITEM_TYPES = ["tray", "cover", "pack", "label", "sticker", "basket", "other"];

function emptyPkgProfile(): PackagingProfile {
  const p: PackagingProfile = {};
  for (const s of PKG_SLOTS) {
    p[s.role] = { enabled: false, item_type: s.allowed_types[0] ?? "", component_sku: "", qty_per_pack: 1 };
  }
  return p;
}

// Role behavior defaults matching handover _ROLE_BEHAVIOR_DEFAULTS
const ROLE_BEHAVIOR_DEFAULTS: Record<string, { sellable: boolean; producable: boolean; consumable: boolean }> = {
  FG:        { sellable: true,  producable: true,  consumable: false },
  WIP:       { sellable: false, producable: true,  consumable: false },
  RM:        { sellable: false, producable: false, consumable: true  },
  PACKAGING: { sellable: false, producable: false, consumable: true  },
  SUPPLY:    { sellable: false, producable: false, consumable: true  },
  DEFECT:    { sellable: true,  producable: false, consumable: false },
};

// Item type options matching handover getItemTypeOptionsForRole
const ITEM_TYPES_BY_ROLE: Record<string, { value: string; label: string }[]> = {
  FG:        [{ value: "packed_egg",     label: "ไข่แพ็ค · Packed egg" }, { value: "packed_egg_OEM", label: "ไข่แพ็ค OEM · Packed egg (OEM)" }],
  RM:        [{ value: "raw_egg",        label: "ไข่ดิบ · Raw egg" }],
  WIP:       [{ value: "graded_egg",     label: "ไข่คัดแล้ว · Graded egg" }, { value: "semi_finished_pack", label: "แพ็คกึ่งสำเร็จรูป · Semi-finished pack" }],
  PACKAGING: [{ value: "tray",           label: "ถาด · Tray" }, { value: "cover", label: "ฝาครอบ · Cover" }, { value: "pack", label: "แพ็ค · Pack" }, { value: "label", label: "ฉลาก · Label" }, { value: "sticker", label: "สติกเกอร์ · Sticker" }, { value: "basket", label: "ตะกร้า · Basket" }],
  SUPPLY:    [{ value: "consumable",     label: "วัสดุสิ้นเปลือง · Consumable" }],
  DEFECT:    [{ value: "dirty_egg",      label: "ไข่สกปรก · Dirty egg" }, { value: "cracked_egg", label: "ไข่ร้าว · Cracked egg" }, { value: "thin_shell", label: "ไข่เปลือกบาง · Thin shell" }, { value: "unusable", label: "ใช้ไม่ได้ · Unusable" }],
};

const itemFormSchema = z.object({
  sku: z.string().min(1, "กรุณากรอก SKU"),
  name: z.string().min(1, "กรุณากรอกชื่อสินค้า"),
  item_role: z.string().optional(),
  item_type: z.string().optional(),
  is_active: z.string().default("active"),
  // Behavior
  is_sellable: z.boolean().default(false),
  is_producable: z.boolean().default(false),
  is_consumable: z.boolean().default(false),
  // Counting & Units
  base_unit: z.string().optional(),
  pack_unit: z.string().optional(),
  eggs_per_pack: z.number().int().positive().nullable().optional(),
  storage_unit: z.string().optional(),
  base_per_storage: z.number().int().positive().nullable().optional(),
  // Basket (conditional)
  has_basket: z.boolean().default(false),
  basket_sku: z.string().nullable().optional(),
  basket_unit: z.string().nullable().optional(),
  eggs_per_basket: z.number().int().positive().nullable().optional(),
  // Selling unit (conditional)
  selling_unit: z.string().optional(),
  // BOM / Egg inputs
  is_egg: z.boolean().default(false),
  egg_input_type: z.string().optional(),   // UI: raw | under | graded  → maps to egg_content_type on save
  egg_is_mixed: z.boolean().default(false),
  primary_grade: z.number().int().min(0).max(6).nullable().optional(),
  secondary_grade: z.number().int().min(0).max(6).nullable().optional(),
  min_primary_grade: z.number().min(0).max(100).nullable().optional(),
  // kept for backward-compat with older items
  primary_size: z.string().optional(),
  secondary_size: z.string().optional(),
  min_primary: z.number().int().min(0).max(100).nullable().optional(),
  // Packaging Profile (per-slot BOM data)
  packaging_profile: z.record(z.object({
    enabled: z.boolean().default(false),
    item_type: z.string().default(""),
    component_sku: z.string().default(""),
    qty_per_pack: z.number().min(0).default(1),
  })).default({}),
  // Additional materials (open-ended manual rows)
  additional_materials: z.array(z.object({
    component_sku: z.string().default(""),
    item_type: z.string().default(""),
    qty_per_pack: z.number().min(0).default(1),
    notes: z.string().optional(),
  })).default([]),
  // External references
  partner_ids: z.array(z.number()).default([]),
  item_number: z.string().optional(),
  barcode_label: z.string().optional(),
  description: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

type SortField = 'sku' | 'name' | 'customer' | 'role' | 'type' | 'status';
type SortDirection = 'asc' | 'desc' | null;

const CUST_HEX: [string, string][] = [
  ['makro', '#A32D2D'], ['bigc', '#3B6D11'], ['big c', '#3B6D11'],
  ['thaifood', '#185FA5'], ['thai food', '#185FA5'], ['cj', '#993556'],
  ['tt', '#854F0B'], ['lotus', '#0A6E56'],
];
const getCustColor = (n: string) =>
  CUST_HEX.find(([k]) => n.toLowerCase().includes(k))?.[1] ?? '#5F5E5A';

const ROW_CLS =
  '[&>td]:bg-white [&>td]:border-y [&>td]:border-[#d6d8dc] [&>td:first-child]:border-l [&>td:first-child]:rounded-l-lg [&>td:last-child]:border-r [&>td:last-child]:rounded-r-lg [&:hover>td]:bg-[#fafbfc] hover:!bg-transparent';

const SIZE_PILL_CLS: Record<string, string> = {
  '0': 'bg-[#FCEBEB] text-[#791F1F]',
  '1': 'bg-[#FAEEDA] text-[#633806]',
  '2': 'bg-[#EAF3DE] text-[#27500A]',
  '3': 'bg-[#E1F5EE] text-[#085041]',
  '4': 'bg-[#E6F1FB] text-[#0C447C]',
  '5': 'bg-[#EEEDFE] text-[#3C3489]',
  '6': 'bg-[#F1EFE8] text-[#444441]',
};

function EggSizePill({ item }: { item: Item }) {
  if (!item.isEgg || !item.primarySize) return null;
  const cls = SIZE_PILL_CLS[item.primarySize] ?? 'bg-[#F1EFE8] text-[#888780]';
  const label = item.secondarySize
    ? `${item.primarySize}-${item.secondarySize}`
    : `เบอร์ ${item.primarySize}`;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// Behavior chip component
function BehaviorChips({ sellable, producable, material }: { sellable: boolean; producable: boolean; material: boolean }) {
  const chip = (label: string, on: boolean) => (
    <span key={label} className={cn(
      "inline-block text-[10px] px-2 py-0.5 rounded-full border",
      on ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" : "bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]"
    )}>
      {label}: {on ? "Yes" : "No"}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="text-[10px] text-neutral-500 mr-0.5">Behavior (from role):</span>
      {chip("Sellable", sellable)}
      {chip("Producable", producable)}
      {chip("Material", material)}
    </div>
  );
}

export default function Items() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [extRefsOpen, setExtRefsOpen] = useState(false);
  const [additionalMatOpen, setAdditionalMatOpen] = useState(false);

  const { data: itemsList, isLoading } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: getItems,
  });

  const { data: basketItems = [] } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: getItems,
    select: (all) => all.filter((i) => i.itemType === "basket" && i.isActive === "active"),
  });

  const { data: businessPartners = [] } = useQuery<
    { id: number; code: string; nickname: string; name: string | null }[]
  >({
    queryKey: ["business-partners"],
    queryFn: async () => {
      const res = await fetch("/api/business-partners");
      if (!res.ok) throw new Error("Failed to fetch business partners");
      return res.json();
    },
  });

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

  const filteredAndSortedItems = useMemo(() => {
    let items = (itemsList ?? []).filter((item) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        item.sku?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.itemNumber?.toLowerCase().includes(q)
      );
    });

    if (sortField && sortDirection) {
      items = [...items].sort((a, b) => {
        let aVal = '';
        let bVal = '';
        switch (sortField) {
          case 'sku': aVal = a.sku ?? ''; bVal = b.sku ?? ''; break;
          case 'name': aVal = a.name ?? ''; bVal = b.name ?? ''; break;
          case 'customer': {
            const aBp = businessPartners.find((bp) => bp.id === a.partners?.[0]?.partnerId);
            const bBp = businessPartners.find((bp) => bp.id === b.partners?.[0]?.partnerId);
            aVal = aBp?.nickname ?? '';
            bVal = bBp?.nickname ?? '';
            break;
          }
          case 'role': aVal = a.itemRole ?? ''; bVal = b.itemRole ?? ''; break;
          case 'type': aVal = a.itemType ?? ''; bVal = b.itemType ?? ''; break;
          case 'status': aVal = a.isActive ?? ''; bVal = b.isActive ?? ''; break;
        }
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return items;
  }, [itemsList, search, sortField, sortDirection, businessPartners]);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: newItemDefaults(),
  });

  function newItemDefaults(): ItemFormValues {
    return {
      sku: "",
      name: "",
      item_role: "FG",
      item_type: undefined,
      is_active: "active",
      is_sellable: true,
      is_producable: false,
      is_consumable: false,
      base_unit: "ฟอง",
      pack_unit: "แพ็ค",
      eggs_per_pack: 30,
      storage_unit: undefined,
      base_per_storage: null,
      has_basket: false,
      basket_sku: null,
      basket_unit: null,
      eggs_per_basket: null,
      selling_unit: "แพ็ค",
      is_egg: true,
      egg_input_type: undefined,
      egg_is_mixed: false,
      primary_grade: null,
      secondary_grade: null,
      min_primary_grade: null,
      primary_size: undefined,
      secondary_size: undefined,
      min_primary: null,
      packaging_profile: emptyPkgProfile(),
      additional_materials: [],
      partner_ids: [],
      item_number: "",
      barcode_label: "",
      description: "",
    };
  }

  const { data: editingItemData } = useQuery({
    queryKey: ["item", editingItem?.id],
    queryFn: () => getItemById(editingItem!.id),
    enabled: !!editingItem?.id,
  });

  useEffect(() => {
    if (!editingItemData) return;
    form.reset({
      sku: editingItemData.sku ?? "",
      name: editingItemData.name ?? "",
      item_role: editingItemData.itemRole ?? undefined,
      item_type: editingItemData.itemType ?? undefined,
      is_active: editingItemData.isActive ?? "active",
      is_sellable: editingItemData.isSellable ?? false,
      is_producable: editingItemData.isProducable ?? false,
      is_consumable: editingItemData.isConsumable ?? false,
      base_unit: editingItemData.baseUnit ?? undefined,
      pack_unit: editingItemData.packUnit ?? undefined,
      eggs_per_pack: editingItemData.eggsPerPack ?? null,
      storage_unit: editingItemData.storageUnit ?? undefined,
      base_per_storage: editingItemData.basePerStorage ?? null,
      has_basket: Boolean(editingItemData.basketUnit || editingItemData.basketSku),
      basket_sku: editingItemData.basketSku ?? null,
      basket_unit: editingItemData.basketUnit ?? null,
      eggs_per_basket: editingItemData.eggsPerBasket ?? null,
      selling_unit: editingItemData.sellingUnit ?? undefined,
      is_egg: editingItemData.isEgg ?? editingItemData.isEggItem ?? false,
      egg_input_type: _contentTypeToInputType(editingItemData.eggContentType),
      egg_is_mixed: editingItemData.eggContentType === "GRADED_MIX",
      primary_grade: editingItemData.primaryGrade ?? null,
      secondary_grade: editingItemData.secondaryGrade ?? null,
      min_primary_grade: editingItemData.minPrimaryGrade ? Number(editingItemData.minPrimaryGrade) : null,
      primary_size: editingItemData.primarySize ?? undefined,
      secondary_size: editingItemData.secondarySize ?? undefined,
      min_primary: editingItemData.minPrimary ?? null,
      packaging_profile: (() => {
        const base = emptyPkgProfile();
        const raw = editingItemData.packagingProfile;
        if (!raw) return base;
        try {
          const stored = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (stored && typeof stored === "object") return { ...base, ...stored };
        } catch {}
        return base;
      })(),
      additional_materials: (() => {
        const raw = editingItemData.additionalMaterials;
        if (!raw) return [];
        try {
          const stored = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (Array.isArray(stored)) return stored;
        } catch {}
        return [];
      })(),
      partner_ids: (editingItemData.partners ?? []).map((p: any) => p.partnerId),
      item_number: editingItemData.itemNumber ?? "",
      barcode_label: editingItemData.barcodeLabel ?? "",
      description: editingItemData.description ?? "",
    });
  }, [editingItemData, form]);

  const watchRole = form.watch("item_role");
  const watchSellable = form.watch("is_sellable");
  const watchProducable = form.watch("is_producable");
  const watchConsumable = form.watch("is_consumable");
  const watchHasBasket = form.watch("has_basket");
  const watchBaseUnit = form.watch("base_unit");
  const watchPackUnit = form.watch("pack_unit");
  const watchEggsPerPack = form.watch("eggs_per_pack");
  const watchBasketUnit = form.watch("basket_unit");
  const watchSellingUnit = form.watch("selling_unit");
  const watchEggsPerBasket = form.watch("eggs_per_basket");
  const watchIsEgg = form.watch("is_egg");
  const watchEggInputType = form.watch("egg_input_type");
  const watchEggIsMixed = form.watch("egg_is_mixed");
  const watchPrimaryGrade = form.watch("primary_grade");

  // Basket qty per selling unit (mirrors handover calculateBasketRequirementFromItem logic)
  const basketQtyPerSellingUnit = useMemo(() => {
    const epb = watchEggsPerBasket ?? 0;
    if (!watchHasBasket || !watchBasketUnit || !(epb > 0)) return null;
    let baseFactor: number | null = null;
    if (watchSellingUnit && watchSellingUnit === watchBaseUnit) baseFactor = 1;
    else if (watchSellingUnit && watchSellingUnit === watchPackUnit && (watchEggsPerPack ?? 0) > 0) baseFactor = watchEggsPerPack ?? null;
    else if (watchSellingUnit && watchSellingUnit === watchBasketUnit) baseFactor = epb;
    if (baseFactor == null) return null;
    return baseFactor / epb;
  }, [watchHasBasket, watchBasketUnit, watchEggsPerBasket, watchSellingUnit, watchBaseUnit, watchPackUnit, watchEggsPerPack]);

  const availableTypes = ITEM_TYPES_BY_ROLE[watchRole?.toUpperCase() ?? ""] ?? [];
  // Basket block shown when Producable is checked OR item already has a basket_unit value

  const showSellingBlock = watchRole?.toUpperCase() === "FG" || watchSellable;
  // BOM section visible for FG / producable / sellable / egg items
  const showBomSection = watchRole?.toUpperCase() === "FG" || watchProducable || watchSellable || watchIsEgg;

  // BOM readiness checks (matching handover _bomItemReadiness logic)
  const bomReadiness = useMemo(() => {
    const checks = [
      {
        label: "หน่วยขาย + การแปลงหน่วยฐาน · Selling unit & base conversion",
        pass: !!watchSellingUnit && !!watchEggsPerPack && watchEggsPerPack > 0,
      },
      {
        label: "มีรายการ BOM อย่างน้อย 1 รายการ · BOM has at least one line",
        pass: watchIsEgg || false,
      },
      {
        label: "ทุกบรรทัดข้อมูลครบถ้วน · All component lines complete",
        pass: !watchIsEgg || (!!watchEggInputType && (watchEggInputType !== "graded" || !!watchPrimaryGrade)),
        hint: watchIsEgg && !watchEggInputType
          ? "เลือก Egg input type ก่อน — ดู ⚠ ในส่วน Egg inputs"
          : (watchEggInputType === "graded" && !watchPrimaryGrade ? "ระบุ Primary grade" : undefined),
      },
    ];
    const failCount = checks.filter((c) => !c.pass).length;
    return { checks, ok: failCount === 0, failCount };
  }, [watchSellingUnit, watchEggsPerPack, watchIsEgg, watchEggInputType, watchPrimaryGrade]);

  // Auto-apply role behavior defaults when role changes
  useEffect(() => {
    if (!watchRole) return;
    const def = ROLE_BEHAVIOR_DEFAULTS[watchRole.toUpperCase()];
    if (!def) return;
    form.setValue("is_sellable", def.sellable);
    form.setValue("is_producable", def.producable);
    form.setValue("is_consumable", def.consumable);
    // Reset item_type if not valid for new role
    const current = form.getValues("item_type");
    const validValues = (ITEM_TYPES_BY_ROLE[watchRole.toUpperCase()] ?? []).map((t) => t.value);
    if (current && !validValues.includes(current)) {
      form.setValue("item_type", undefined);
    }
  }, [watchRole]);

  // Selling unit options: only from this item's defined units
  const sellingUnitChoices = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (watchBaseUnit) opts.push({ value: watchBaseUnit, label: `${watchBaseUnit} (ฐาน · base)` });
    if (watchPackUnit) opts.push({ value: watchPackUnit, label: `${watchPackUnit} (แพ็ค · pack)` });
    if (watchBasketUnit) opts.push({ value: watchBasketUnit, label: `${watchBasketUnit} (ตะกร้า · basket)` });
    return opts;
  }, [watchBaseUnit, watchPackUnit, watchHasBasket, watchBasketUnit]);

  // Conversion preview
  const conversionPreviews = useMemo(() => {
    const parts: string[] = [];
    if (watchPackUnit && watchEggsPerPack && watchEggsPerPack > 0) {
      parts.push(`1 ${watchPackUnit} = ${watchEggsPerPack} ${watchBaseUnit || 'ฟอง'}`);
    }
    return parts;
  }, [watchPackUnit, watchEggsPerPack, watchBaseUnit]);

  const queryClient = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: upsertItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      if (editingItem?.id) {
        queryClient.invalidateQueries({ queryKey: ["item", editingItem.id] });
      }
      closeDialog();
    },
    onError: async (error: any) => {
      let message = "Failed to save";
      try {
        const res = await error.response?.json?.();
        message = res?.message ?? message;
      } catch {}
      form.setError("sku", { type: "server", message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setDeleteItemId(null);
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setAdvancedOpen(false);
    setExtRefsOpen(false);
    setAdditionalMatOpen(false);
  };

  const { fields: additionalMaterialFields, append: appendAdditionalMat, remove: removeAdditionalMat } = useFieldArray({
    control: form.control,
    name: "additional_materials",
  });

  const onSubmit = (values: ItemFormValues) => {
    upsertMutation.mutate({
      id: editingItem?.id,
      ...values,
      basket_sku: values.basket_sku ?? null,
      eggs_per_basket: values.basket_unit ? values.eggs_per_basket : null,
      egg_content_type: _inputTypeToContentType(values.egg_input_type, values.egg_is_mixed ?? false),
      is_egg_item: values.is_egg,
      packaging_profile: values.packaging_profile,
      additional_materials: values.additional_materials,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">สินค้า</h2>
          <p className="text-sm text-neutral-500">
            รายการสินค้าทั้งหมด ({filteredAndSortedItems.length} รายการ)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingItem(null);
            form.reset(newItemDefaults());
            setAdvancedOpen(false);
            setExtRefsOpen(false);
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU, name, or item number..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table className="border-separate border-spacing-y-1.5">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" onClick={() => handleSort('sku')} className="flex items-center hover:text-foreground transition-colors">
                      SKU {getSortIcon('sku')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort('name')} className="flex items-center hover:text-foreground transition-colors">
                      ชื่อสินค้า {getSortIcon('name')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort('customer')} className="flex items-center hover:text-foreground transition-colors">
                      ลูกค้า {getSortIcon('customer')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort('role')} className="flex items-center hover:text-foreground transition-colors">
                      Role {getSortIcon('role')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort('type')} className="flex items-center hover:text-foreground transition-colors">
                      ประเภท {getSortIcon('type')}
                    </button>
                  </TableHead>
                  <TableHead>ขนาด</TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort('status')} className="flex items-center hover:text-foreground transition-colors">
                      สถานะ {getSortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedItems.map((item) => (
                  <TableRow key={item.id} className={ROW_CLS}>
                    <TableCell className="font-mono text-sm">
                      {item.sku || "-"}
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px]">
                      <div className="truncate" title={item.name}>
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.partners && item.partners.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.partners.map((p: any) => {
                            const bp = businessPartners.find((b) => b.id === p.partnerId);
                            const label = bp?.nickname ?? p.partnerCode ?? String(p.partnerId);
                            return (
                              <span
                                key={p.partnerId}
                                className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full text-white whitespace-nowrap"
                                style={{ background: getCustColor(label) }}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{item.itemRole || "-"}</TableCell>
                    <TableCell className="text-sm">{item.itemType || "-"}</TableCell>
                    <TableCell><EggSizePill item={item} /></TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${item.isActive === 'active' ? 'bg-[#EAF3DE] text-[#27500A] border-[#97C459]' : 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]'}`}>
                        {item.isActive === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteItemId(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "แก้ไขสินค้า · Edit Item" : "เพิ่มสินค้าใหม่ · Add Item"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

              {/* ── 🟢 IDENTITY ── */}
              <div className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">IDENTITY</span>
                </div>

                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU <span className="text-red-600 font-bold">*</span></FormLabel>
                    <FormControl><Input placeholder="เช่น 30001" {...field} /></FormControl>
                    <p className="text-[11px] text-neutral-500 -mt-1">Primary item code used in Order, Planning, and BOM</p>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item name <span className="text-red-600 font-bold">*</span></FormLabel>
                    <FormControl><Input placeholder="เช่น ไข่ไก่เบอร์ 2 แพ็ค 30 ฟอง" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="item_role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item role <span className="text-red-600 font-bold">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="เลือก role" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FG">FG</SelectItem>
                          <SelectItem value="WIP">WIP</SelectItem>
                          <SelectItem value="RM">RM</SelectItem>
                          <SelectItem value="PACKAGING">PACKAGING</SelectItem>
                          <SelectItem value="SUPPLY">SUPPLY</SelectItem>
                          <SelectItem value="DEFECT">DEFECT</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="item_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item type (subtype of role)</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={availableTypes.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={availableTypes.length === 0 ? "—" : "เลือกประเภท"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <p className="text-[11px] text-neutral-500 -mt-1">Pick the role first — the subtype list filters to match it. Role is the main classification.</p>

                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={field.value === "active"}
                        onCheckedChange={(checked) => field.onChange(checked ? "active" : "inactive")}
                      />
                      <FormLabel className="font-normal cursor-pointer">Active</FormLabel>
                    </div>
                  </FormItem>
                )} />

                <BehaviorChips sellable={watchSellable} producable={watchProducable} material={watchConsumable} />

                {/* Advanced behavior override */}
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700 select-none mt-1"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  ⚙ Advanced behavior override
                </button>

                {advancedOpen && (
                  <div className="pl-4 space-y-2 border-l-2 border-neutral-200">
                    <p className="text-[11px] text-neutral-500">Behavior is normally implied by the role — override here only for special cases.</p>
                    <FormField control={form.control} name="is_sellable" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <FormLabel className="font-normal cursor-pointer text-sm">Sellable</FormLabel>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="is_producable" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <FormLabel className="font-normal cursor-pointer text-sm">Producable (FG / semi-finished)</FormLabel>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="is_consumable" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <FormLabel className="font-normal cursor-pointer text-sm">Material / consumable</FormLabel>
                        </div>
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              {/* ── 📐 COUNTING & UNITS ── */}
              <div className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">📐</span>
                  <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">COUNTING & UNITS</span>
                </div>

                {/* Conversion preview chips */}
                {conversionPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {conversionPreviews.map((p) => (
                      <span key={p} className="inline-block text-[11px] px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#166534] border border-[#86EFAC]">
                        📐 {p}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-neutral-500 bg-[#F0F9FF] border border-[#BAE6FD] rounded-md px-3 py-2">
                  ℹ Unit ladder: base → pack/FG → storage → basket → selling.
                </div>

                {/* Base unit + Base factor */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="base_unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base unit <span className="text-red-600 font-bold">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="หน่วยฐาน" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ฟอง">ฟอง</SelectItem>
                          <SelectItem value="ใบ">ใบ</SelectItem>
                          <SelectItem value="ดวง">ดวง</SelectItem>
                          <SelectItem value="ม้วน">ม้วน</SelectItem>
                          <SelectItem value="ชิ้น">ชิ้น</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>Base factor</FormLabel>
                    <div className="flex items-center h-9 rounded-md border bg-neutral-100 px-3 text-sm text-neutral-500">1</div>
                  </FormItem>
                </div>
                <p className="text-[11px] text-neutral-500 -mt-1">
                  Base unit is the smallest counting unit. For PACKAGING / SUPPLY items, this is the BOM consumption unit (e.g. tray = ใบ, label = ดวง).
                </p>

                {/* Pack unit + Base per pack */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="pack_unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pack unit</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="เลือกหน่วยแพ็ค" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ถาด">ถาด</SelectItem>
                          <SelectItem value="แพ็ค">แพ็ค</SelectItem>
                          <SelectItem value="แพ็ค4">แพ็ค 4</SelectItem>
                          <SelectItem value="แพ็ค10">แพ็ค 10</SelectItem>
                          <SelectItem value="แพ็ค12">แพ็ค 12</SelectItem>
                          <SelectItem value="แพ็ค15">แพ็ค 15</SelectItem>
                          <SelectItem value="มัด4">มัด 4</SelectItem>
                          <SelectItem value="มัด5">มัด 5</SelectItem>
                          {field.value && !["ถาด","แพ็ค","แพ็ค4","แพ็ค10","แพ็ค12","แพ็ค15","มัด4","มัด5"].includes(field.value) && (
                            <SelectItem value={field.value}>{field.value} (legacy)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="eggs_per_pack" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base per pack</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="เช่น 30"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <p className="text-[11px] text-neutral-500 -mt-1">e.g. 1 ถาด = 30 ฟอง · required when a pack unit is set.</p>

                {/* Storage unit + Base per storage */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="storage_unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage unit</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="เลือกหน่วยจัดเก็บ" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="พาเลท">พาเลท</SelectItem>
                          <SelectItem value="ลัง">ลัง</SelectItem>
                          <SelectItem value="กล่อง">กล่อง</SelectItem>
                          <SelectItem value="ถาด">ถาด</SelectItem>
                          <SelectItem value="ตะกร้า">ตะกร้า</SelectItem>
                          {field.value && !["พาเลท","ลัง","กล่อง","ถาด","ตะกร้า"].includes(field.value) && (
                            <SelectItem value={field.value}>{field.value} (legacy)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="base_per_storage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base per storage</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="เช่น 5400"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <p className="text-[11px] text-neutral-500 -mt-1">Warehouse/storage only, e.g. pallet, crate — not used in BOM consumption math.</p>

                {/* Basket summary (read-only link to BOM section below) */}
                {watchBasketUnit && (
                  <div className="border-t border-dashed border-neutral-200 pt-3">
                    <div className="text-[11px] text-[#047857] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md px-3 py-2">
                      🧺 ตะกร้า · Basket: 1 {watchBasketUnit} = {form.watch("eggs_per_basket") ?? "?"} {watchBaseUnit || "ฟอง"} — configure in <span className="underline">BOM section below</span>
                    </div>
                  </div>
                )}

                {/* Selling unit (conditional) */}
                {showSellingBlock && (
                  <div className="border-t border-dashed border-neutral-200 pt-3">
                    <FormField control={form.control} name="selling_unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling unit <span className="text-red-600 font-bold">*</span></FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="เลือกหน่วยขาย" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sellingUnitChoices.length === 0 && (
                              <SelectItem value="__empty__" disabled>— กรอก Base/Pack unit ก่อน —</SelectItem>
                            )}
                            {sellingUnitChoices.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-neutral-500">Choose from base / pack / basket only — for sellable items.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              {/* ── 🧪 BOM / PRODUCTION FORMULA ── */}
              {showBomSection && (
                <div className="rounded-lg border bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧪</span>
                    <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">BOM / Production Formula</span>
                  </div>
                  <div className="text-[11px] text-neutral-600 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md px-3 py-2">
                    ℹ BOM defines all inputs needed to produce one output unit. Egg, basket, and packaging are sub-sections of the same BOM setup.
                  </div>

                  {/* BOM Status */}
                  <div className={`rounded-lg border p-3 space-y-2 ${
                    bomReadiness.ok
                      ? "bg-[#F0FDF4] border-[#BBF7D0]"
                      : "bg-[#FFFBEB] border-[#FDE68A]"
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-[11.5px] ${bomReadiness.ok ? "text-[#166534]" : "text-[#92400E]"}`}>
                        สถานะ BOM · BOM status
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        className="text-[10.5px] px-2 py-0.5 border border-neutral-300 rounded bg-white hover:bg-neutral-50"
                        onClick={() => form.trigger()}
                      >
                        ↻ ตรวจสอบใหม่ · Re-check
                      </button>
                    </div>
                    <div className={`text-[10.5px] ${bomReadiness.ok ? "text-[#166534]" : "text-[#92400E]"}`}>
                      {bomReadiness.ok
                        ? "☑ ข้อมูลครบแล้ว — ข้อมูลพร้อมใช้งาน · Data verified"
                        : `⛔ ยังเปิดใช้ไม่ได้ — แก้ ${bomReadiness.failCount} รายการก่อน · Cannot enable — fix ${bomReadiness.failCount} item(s) first`}
                    </div>
                    <div className="space-y-0.5">
                      {bomReadiness.checks.map((c, i) => (
                        <div key={i} className={`text-[10px] ${c.pass ? "text-neutral-600" : "text-[#B45309]"}`}>
                          <span className={c.pass ? "text-green-700 font-bold" : "text-red-600 font-bold"}>
                            {c.pass ? "✓" : "✗"}
                          </span>{" "}
                          {c.label}
                          {!c.pass && c.hint && (
                            <span className="text-neutral-400"> — {c.hint}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 🥚 Egg Inputs sub-card */}
                  <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2">
                    <div className="font-bold text-[11px] text-[#92400E]">🥚 Egg inputs · วัตถุดิบไข่</div>
                    <div className="text-[9.5px] text-[#A16207]">
                      Choose the egg input type first. If it is a mixed graded egg, tick Mixed grade and set the ratio.
                    </div>

                    <FormField control={form.control} name="is_egg" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          <FormLabel className="font-normal cursor-pointer text-sm">Is egg item</FormLabel>
                        </div>
                        <p className="text-[10.5px] text-neutral-500 pl-6">Classifies graded / mixed / packed eggs.</p>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="egg_input_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Egg input type · ประเภทวัตถุดิบไข่</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={(v) => {
                          field.onChange(v);
                          if (v !== "graded") {
                            form.setValue("egg_is_mixed", false);
                            form.setValue("secondary_grade", null);
                            form.setValue("min_primary_grade", null);
                          }
                        }}>
                          <FormControl>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="— pick one —" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="raw">Raw egg · ไข่ดิบ</SelectItem>
                            <SelectItem value="under">Under-grade · ไข่ตกเกรด</SelectItem>
                            <SelectItem value="graded">Graded egg · ไข่เบอร์</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    {watchEggInputType === "graded" && (
                      <div className="space-y-2 pt-1">
                        <FormField control={form.control} name="egg_is_mixed" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              <FormLabel className="font-normal cursor-pointer text-sm">Mixed grade · เป็นไข่ผสมเบอร์</FormLabel>
                            </div>
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-3 gap-2">
                          <FormField control={form.control} name="primary_grade" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px]">Primary grade · เบอร์หลัก</FormLabel>
                              <Select
                                value={field.value != null ? String(field.value) : ""}
                                onValueChange={(v) => field.onChange(v === "" ? null : Number(v))}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="เบอร์" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {[0,1,2,3,4,5,6].map((n) => (
                                    <SelectItem key={n} value={String(n)}>เบอร์ {n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          {watchEggIsMixed && (
                            <>
                              <FormField control={form.control} name="secondary_grade" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px]">Secondary grade · เบอร์รอง</FormLabel>
                                  <Select
                                    value={field.value != null ? String(field.value) : ""}
                                    onValueChange={(v) => field.onChange(v === "" ? null : Number(v))}
                                  >
                                    <FormControl>
                                      <SelectTrigger><SelectValue placeholder="เบอร์" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {[0,1,2,3,4,5,6].map((n) => (
                                        <SelectItem key={n} value={String(n)}>เบอร์ {n}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="min_primary_grade" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px]">Min primary (%)</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input type="number" min={0} max={100} placeholder="เช่น 90"
                                        value={field.value ?? ""}
                                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                        className="pr-7"
                                      />
                                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 🧺 Basket / Handling Unit sub-card */}
                  <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 space-y-3">
                    <div className="font-bold text-[11px] text-[#065F46]">🧺 Basket / Handling Unit · ข้อมูลตะกร้า</div>
                    <div className="text-[9.5px] text-[#047857]">
                      ตะกร้าเป็นหน่วยบรรจุ/หน่วยขาย — ไม่ใช่หน่วยฐาน · Basket is a handling / selling container — not the production-pack basis.
                    </div>

                    <FormField control={form.control} name="has_basket" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={field.value} onCheckedChange={(v) => {
                            field.onChange(v);
                            if (!v) {
                              form.setValue("basket_unit", null);
                              form.setValue("eggs_per_basket", null);
                            }
                          }} />
                          <FormLabel className="font-normal cursor-pointer text-sm">ใช้ตะกร้า · Uses basket</FormLabel>
                        </div>
                      </FormItem>
                    )} />

                    {watchHasBasket && (
                      <div className="space-y-3">
                        {/* Basket SKU dropdown */}
                        <FormField control={form.control} name="basket_sku" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px]">SKU ตะกร้าจริง · Actual basket SKU</FormLabel>
                            {basketItems.length === 0 && (
                              <div className="text-[10px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded px-2.5 py-1.5">
                                ⚠ ไม่พบสินค้าประเภทตะกร้า · No basket items found — add a PACKAGING/basket item first.
                              </div>
                            )}
                            <Select
                              value={field.value ?? ""}
                              onValueChange={(sku) => {
                                field.onChange(sku);
                                const chosen = basketItems.find((i) => i.sku === sku);
                                if (chosen) {
                                  form.setValue("basket_unit", chosen.baseUnit ?? "ตะกร้า");
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="— เลือก SKU ตะกร้า · choose a basket SKU —" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {basketItems.filter((b) => !!b.sku).map((b) => (
                                  <SelectItem key={b.sku!} value={b.sku!}>
                                    {b.sku} — {b.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />

                        {/* Basket conversion */}
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name="basket_unit" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px]">ชื่อหน่วยตะกร้า · Basket unit</FormLabel>
                              <FormControl>
                                <Input placeholder="เช่น ตะกร้า" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                              </FormControl>
                              <p className="text-[9.5px] text-neutral-400">Auto-filled from basket SKU's base unit</p>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="eggs_per_basket" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px]">ฐานต่อตะกร้า · Base per basket</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    min={1}
                                    placeholder="เช่น 360"
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                    className="pr-16"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                    {watchBaseUnit || "ฟอง"}
                                  </span>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    )}

                    {watchHasBasket && watchBasketUnit && watchEggsPerBasket && (
                      <div className="space-y-1">
                        <div className="text-[10.5px] text-[#047857] bg-white border border-[#BBF7D0] rounded px-2.5 py-1.5">
                          ✓ 1 {watchBasketUnit} = {watchEggsPerBasket} {watchBaseUnit || "ฟอง"}
                          {form.watch("basket_sku") && (() => {
                            const b = basketItems.find((i) => i.sku === form.watch("basket_sku"));
                            return b ? <span className="text-neutral-500 ml-2">· {b.name}</span> : null;
                          })()}
                        </div>
                        <div className={`text-[10.5px] rounded px-2.5 py-1.5 border ${
                          basketQtyPerSellingUnit != null
                            ? "bg-white border-[#BBF7D0] text-[#047857]"
                            : "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
                        }`}>
                          คำนวณ · Calculated — จำนวนตะกร้าต่อ 1 หน่วยขาย · Basket qty per selling unit:{" "}
                          {basketQtyPerSellingUnit != null ? (
                            <>
                              <span className="font-mono font-bold">
                                {Number.isInteger(basketQtyPerSellingUnit)
                                  ? basketQtyPerSellingUnit
                                  : basketQtyPerSellingUnit.toFixed(4)}
                              </span>{" "}
                              {watchBasketUnit}
                              {watchSellingUnit ? <span className="text-neutral-400"> (ต่อ 1 {watchSellingUnit})</span> : null}
                              {!Number.isInteger(basketQtyPerSellingUnit) && (
                                <span className="text-[#B45309] ml-2">⚠ ไม่ลงตัว · not a whole basket</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[#B45309]">— ตั้งหน่วยขายก่อน · set selling unit first</span>
                          )}
                          <span className="text-neutral-400 ml-2">— อ่านอย่างเดียว · read-only</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 📦 Packaging Profile */}
                  <div className="rounded-lg border border-[#E0E7FF] bg-[#EEF2FF] p-3 space-y-2">
                    <div className="font-bold text-[11px] text-[#3730A3]">📦 Packaging Profile · รูปแบบบรรจุภัณฑ์</div>
                    <div className="text-[9.5px] text-[#4338CA]">
                      ช่องบรรจุภัณฑ์มาตรฐานของ FG — ทุก slot เปิดใช้งานได้ · Standard packaging slots for an FG — every slot is now activatable with its own item type and SKU.
                    </div>
                    <div className="text-[10px] text-[#0C4A6E] bg-[#F0F9FF] border border-[#BAE6FD] rounded px-2.5 py-2">
                      ℹ Sequence: <strong>Slot → Item type → Component SKU → quantity</strong>. Component SKU choices include any PACKAGING or SUPPLY master item matching the selected item_type. Change item_type any time.
                    </div>

                    {/* Slot table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10.5px]">
                        <thead>
                          <tr className="border-b border-[#C7D2FE]">
                            <th className="py-1.5 px-1 text-center font-semibold text-neutral-600 w-10">Active</th>
                            <th className="py-1.5 px-2 text-left font-semibold text-neutral-600">Slot</th>
                            <th className="py-1.5 px-1 text-left font-semibold text-neutral-600 w-28">Item type</th>
                            <th className="py-1.5 px-1 text-left font-semibold text-neutral-600">Component SKU</th>
                            <th className="py-1.5 px-1 text-right font-semibold text-neutral-600 w-20">Qty / pack</th>
                            <th className="py-1.5 px-1 text-right font-semibold text-neutral-600 w-24">Qty / selling unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PKG_SLOTS.map((slot) => {
                            const fieldBase = `packaging_profile.${slot.role}` as const;
                            const slotData: PkgSlotData = form.watch(`packaging_profile.${slot.role}` as any) ?? { enabled: false, item_type: slot.allowed_types[0] ?? "", component_sku: "", qty_per_pack: 1 };
                            const active = slotData.enabled;
                            const itemType = slotData.item_type ?? "";
                            const qtyPerPack = slotData.qty_per_pack ?? 1;

                            // Filter PACKAGING or SUPPLY items by item_type
                            const candidates = (itemsList ?? []).filter(
                              (i) => (i.itemRole === "PACKAGING" || i.itemRole === "SUPPLY") &&
                                     (itemType === "" || i.itemType === itemType) &&
                                     i.isActive === "active"
                            );

                            // Qty / selling unit = qtyPerPack × (sellingFactor / packFactor)
                            const packFactor = watchEggsPerPack ?? 0;
                            const sellFactor = (() => {
                              if (!watchSellingUnit) return null;
                              if (watchSellingUnit === watchBaseUnit) return 1;
                              if (watchSellingUnit === watchPackUnit && packFactor > 0) return packFactor;
                              if (watchSellingUnit === watchBasketUnit && (watchEggsPerBasket ?? 0) > 0) return watchEggsPerBasket ?? null;
                              return null;
                            })();
                            const qtyPerSelling = (active && sellFactor != null && packFactor > 0)
                              ? qtyPerPack * (sellFactor / packFactor)
                              : null;

                            return (
                              <tr key={slot.role} className={cn("border-b border-[#E0E7FF]", active ? "" : "opacity-60")}>
                                <td className="py-1.5 px-1 text-center">
                                  <Checkbox
                                    checked={active}
                                    onCheckedChange={(v) => form.setValue(`packaging_profile.${slot.role}.enabled` as any, !!v)}
                                  />
                                </td>
                                <td className={cn("py-1.5 px-2 font-medium", active ? "text-neutral-800" : "text-neutral-400")}>
                                  {slot.en}
                                </td>
                                <td className="py-1 px-1">
                                  <Select
                                    value={itemType}
                                    onValueChange={(v) => {
                                      form.setValue(`packaging_profile.${slot.role}.item_type` as any, v);
                                      form.setValue(`packaging_profile.${slot.role}.component_sku` as any, "");
                                    }}
                                    disabled={!active}
                                  >
                                    <SelectTrigger className="h-7 text-[10.5px] px-2">
                                      <SelectValue placeholder="— เลือก · choose —" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PKG_ITEM_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="py-1 px-1">
                                  <Select
                                    value={slotData.component_sku ?? ""}
                                    onValueChange={(v) => form.setValue(`packaging_profile.${slot.role}.component_sku` as any, v)}
                                    disabled={!active}
                                  >
                                    <SelectTrigger className="h-7 text-[10.5px] px-2 max-w-[200px]">
                                      <SelectValue placeholder="— เลือก SKU · choose —" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const storedSku = slotData.component_sku ?? "";
                                        const filteredCands = candidates.filter((c) => !!c.sku);
                                        const storedInList = filteredCands.some((c) => c.sku === storedSku);
                                        return (
                                          <>
                                            {storedSku && !storedInList && (
                                              <SelectItem value={storedSku}>
                                                {storedSku} <span className="text-neutral-400">(ไม่อยู่ในรายการ · not in filter)</span>
                                              </SelectItem>
                                            )}
                                            {filteredCands.map((c) => (
                                              <SelectItem key={c.sku!} value={c.sku!}>
                                                {c.sku} — {c.name}
                                              </SelectItem>
                                            ))}
                                            {filteredCands.length === 0 && !storedSku && itemType && (
                                              <SelectItem value="__no_match__" disabled>ไม่พบ {itemType} items</SelectItem>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="py-1 px-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={qtyPerPack}
                                    disabled={!active}
                                    onChange={(e) => form.setValue(`packaging_profile.${slot.role}.qty_per_pack` as any, e.target.value === "" ? 1 : Number(e.target.value))}
                                    className="h-7 text-[10.5px] text-right w-16"
                                  />
                                </td>
                                <td className="py-1 px-1 text-right text-neutral-500">
                                  {!active ? (
                                    <span className="text-[#CBD5E1]">—</span>
                                  ) : qtyPerSelling != null ? (
                                    <span className="font-mono font-semibold text-[#475569]">
                                      {Number.isInteger(qtyPerSelling) ? qtyPerSelling : qtyPerSelling.toFixed(3)}
                                      {watchSellingUnit && <span className="text-neutral-400 font-normal ml-1 text-[9.5px]">/ 1 {watchSellingUnit}</span>}
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] text-neutral-400">selling unit basis</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer notes */}
                    <div className="text-[9.5px] text-neutral-400 space-y-0.5">
                      <div>ℹ Qty is in the selected component SKU base unit (not the storage unit) — read as base units per 1 production pack.</div>
                      <div>ℹ The &quot;Qty / selling unit&quot; column is auto-computed from the selling-unit ÷ production-pack ratio. Read-only.</div>
                      <div>ℹ Qty and unit conversion are temporary setup fields; full conversion logic will be developed separately.</div>
                    </div>

                    {/* Additional materials */}
                    <div className="mt-2">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-left bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg hover:bg-neutral-100"
                        onClick={() => setAdditionalMatOpen((v) => !v)}
                      >
                        <span className="text-[11px] font-bold text-neutral-700">
                          {additionalMatOpen ? "▾" : "▸"} Additional materials
                        </span>
                        <span className="text-[9.5px] text-neutral-400 font-normal">— manual, outside the Packaging Profile</span>
                      </button>
                      {additionalMatOpen && (
                        <div className="border border-t-0 border-[#E5E7EB] rounded-b-lg p-3 space-y-2 bg-white">
                          {additionalMaterialFields.map((field, idx) => (
                            <div key={field.id} className="grid grid-cols-[1fr_1fr_16_auto] gap-2 items-end">
                              <div>
                                <div className="text-[10px] text-neutral-500 mb-0.5">SKU</div>
                                <Select
                                  value={form.watch(`additional_materials.${idx}.component_sku` as any) ?? ""}
                                  onValueChange={(v) => form.setValue(`additional_materials.${idx}.component_sku` as any, v)}
                                >
                                  <SelectTrigger className="h-7 text-[10.5px]"><SelectValue placeholder="— เลือก SKU —" /></SelectTrigger>
                                  <SelectContent>
                                    {(itemsList ?? [])
                                      .filter((i) => (i.itemRole === "PACKAGING" || i.itemRole === "SUPPLY") && i.isActive === "active" && !!i.sku)
                                      .map((i) => (
                                        <SelectItem key={i.sku!} value={i.sku!}>{i.sku} — {i.name}</SelectItem>
                                      ))
                                    }
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className="text-[10px] text-neutral-500 mb-0.5">Item type</div>
                                <Select
                                  value={form.watch(`additional_materials.${idx}.item_type` as any) ?? ""}
                                  onValueChange={(v) => form.setValue(`additional_materials.${idx}.item_type` as any, v)}
                                >
                                  <SelectTrigger className="h-7 text-[10.5px]"><SelectValue placeholder="type" /></SelectTrigger>
                                  <SelectContent>
                                    {PKG_ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-16">
                                <div className="text-[10px] text-neutral-500 mb-0.5">Qty / pack</div>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={form.watch(`additional_materials.${idx}.qty_per_pack` as any) ?? 1}
                                  onChange={(e) => form.setValue(`additional_materials.${idx}.qty_per_pack` as any, e.target.value === "" ? 1 : Number(e.target.value))}
                                  className="h-7 text-[10.5px] text-right"
                                />
                              </div>
                              <button type="button" onClick={() => removeAdditionalMat(idx)} className="text-red-400 hover:text-red-600 pb-0.5">✕</button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="text-[10.5px] text-[#4338CA] hover:underline"
                            onClick={() => appendAdditionalMat({ component_sku: "", item_type: "", qty_per_pack: 1 })}
                          >
                            + Add row
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 🔗 External References (collapsible) ── */}
              <div className="rounded-lg border bg-white">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setExtRefsOpen((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔗</span>
                    <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">External References</span>
                  </div>
                  {extRefsOpen ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                </button>
                {extRefsOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t pt-3">
                    <FormItem>
                      <FormLabel>ลูกค้า (Partners)</FormLabel>
                      <div className="flex flex-wrap gap-1.5 min-h-9 rounded-md border bg-background px-3 py-2 text-sm">
                        {businessPartners.map((bp) => {
                          const selected = (form.watch("partner_ids") ?? []).includes(bp.id);
                          return (
                            <button
                              key={bp.id}
                              type="button"
                              onClick={() => {
                                const current = form.getValues("partner_ids") ?? [];
                                form.setValue("partner_ids", selected ? current.filter((id) => id !== bp.id) : [...current, bp.id]);
                              }}
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 text-xs rounded-full border cursor-pointer",
                                selected ? "bg-primary/10 text-primary border-primary/30" : "bg-neutral-100 text-neutral-500 border-neutral-200"
                              )}
                            >
                              {bp.code} — {bp.nickname}
                            </button>
                          );
                        })}
                      </div>
                    </FormItem>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="item_number" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Item Number</FormLabel>
                          <FormControl><Input placeholder="IN-001" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="barcode_label" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Barcode</FormLabel>
                          <FormControl><Input placeholder="8850000000000" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Description</FormLabel>
                        <FormControl><Input placeholder="รายละเอียดเพิ่มเติม" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>ยกเลิก · Cancel</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingItem ? "บันทึก · Save" : "สร้าง · Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสินค้า</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemId && deleteMutation.mutate(deleteItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
