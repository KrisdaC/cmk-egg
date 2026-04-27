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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Loader2, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
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
  partners?: { partnerId: number; partnerCode: string | null; partnerName: string | null }[];
  itemRole: string | null;
  sellingUnit: string | null;
  baseUnit: string | null;
  packUnit: string | null;
  paletteUnit: string | null;
  basketUnit: string | null;
  eggsPerBasket: number | null;
  eggsPerPack: number | null;
  eggsPerPalette: number | null;
  isActive: string | null;
  isSellable: boolean | null;
  createdAt: string;
}

const itemFormSchema = z.object({
  sku: z.string().min(1, "กรุณากรอก SKU"),
  name: z.string().min(1, "กรุณากรอกชื่อสินค้า"),
  description: z.string().optional(),
  partner_id: z.number().nullable().optional(),
  item_number: z.string().optional(),
  barcode_label: z.string().optional(),
  item_type: z.string().optional(),
  item_role: z.string().optional(),
  selling_unit: z.string().optional(),
  base_unit: z.string().optional(),
  pack_unit: z.string().optional(),
  palette_unit: z.string().optional(),
  has_basket: z.boolean().default(false),
  basket_unit: z.string().nullable().optional(),
  eggs_per_basket: z.number().int().positive().nullable().optional(),
  eggs_per_pack: z.number().int().positive().nullable().optional(),
  eggs_per_palette: z.number().int().positive().nullable().optional(),
  is_active: z.string().default("active"),
  is_sellable: z.boolean().default(false),
  partner_ids: z.array(z.number()).default([]),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

const ITEM_TYPES_BY_ROLE: Record<string, { value: string; label: string }[]> = {
  raw: [
    { value: "ungrade_egg", label: "Ungrade Egg" },
    { value: "label", label: "Label" },
    { value: "packaging", label: "Packaging" },
    { value: "basket", label: "Basket" },
  ],
  wip: [
    { value: "grade_egg", label: "Grade Egg" },
    { value: "ready_to_pack", label: "Ready to Pack" },
  ],
  fg: [{ value: "packed_egg", label: "Packed Egg" }],
  defect: [
    { value: "defect_egg", label: "Defect Egg" },
    { value: "defect_packaging", label: "Defect Packaging" },
  ],
};

export default function Items() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [linkedCustomersOpen, setLinkedCustomersOpen] = useState(false);

  const { data: itemsList, isLoading } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: getItems,
  });

  const { data: businessPartners = [] } = useQuery<
    {
      id: number;
      code: string;
      businessName: string | null;
      nickname: string;
    }[]
  >({
    queryKey: ["business-partners"],
    queryFn: async () => {
      const res = await fetch("/api/business-partners");
      if (!res.ok) throw new Error("Failed to fetch business partners");
      return res.json();
    },
  });

  const filteredItems =
    itemsList?.filter((item) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        item.sku?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.itemNumber?.toLowerCase().includes(q)
      );
    }) || [];

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      partner_id: null,
      item_number: "",
      barcode_label: "",
      item_type: undefined,
      item_role: undefined,
      selling_unit: undefined,
      base_unit: undefined,
      pack_unit: undefined,
      palette_unit: undefined,
      has_basket: false,
      basket_unit: null,
      eggs_per_basket: null,
      eggs_per_pack: null,
      eggs_per_palette: null,
      is_active: "active",
      is_sellable: false,
      partner_ids: [],
    },
  });

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
      description: editingItemData.description ?? "",
      partner_id: editingItemData.partnerId ?? null,
      item_number: editingItemData.itemNumber ?? "",
      barcode_label: editingItemData.barcodeLabel ?? "",
      item_type: editingItemData.itemType ?? undefined,
      item_role: editingItemData.itemRole ?? undefined,
      selling_unit: editingItemData.sellingUnit ?? undefined,
      base_unit: editingItemData.baseUnit ?? undefined,
      pack_unit: editingItemData.packUnit ?? undefined,
      palette_unit: editingItemData.paletteUnit ?? undefined,
      has_basket: Boolean(editingItemData.basketUnit),
      basket_unit: editingItemData.basketUnit ?? null,
      eggs_per_basket: editingItemData.eggsPerBasket ?? null,
      eggs_per_pack: editingItemData.eggsPerPack ?? null,
      eggs_per_palette: editingItemData.eggsPerPalette ?? null,
      is_active: editingItemData.isActive ?? "active",
      is_sellable: editingItemData.isSellable ?? false,
      partner_ids: (editingItemData.partners ?? []).map((p: any) => p.partnerId),
    });
  }, [editingItemData, form]);

  const selectedRole = form.watch("item_role");
  const isSellable = form.watch("is_sellable");
  const hasBasket = form.watch("has_basket");
  const availableTypes = ITEM_TYPES_BY_ROLE[selectedRole ?? ""] ?? [];

  useEffect(() => {
    const current = form.getValues("item_type");
    const validValues = availableTypes.map((t) => t.value);
    if (current && !validValues.includes(current)) {
      form.setValue("item_type", undefined);
    }
  }, [selectedRole]);

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
  };

  const onSubmit = (values: ItemFormValues) => {
    upsertMutation.mutate({
      id: editingItem?.id,
      ...values,
      basket_unit: values.has_basket ? values.basket_unit : null,
      eggs_per_basket: values.has_basket ? values.eggs_per_basket : null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Items</h1>
          <p className="text-muted-foreground">
            Master list of all items ({filteredItems.length} items)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingItem(null);
            form.reset({
              sku: "",
              name: "",
              description: "",
              partner_id: null,
              item_number: "",
              barcode_label: "",
              item_type: undefined,
              item_role: undefined,
              selling_unit: undefined,
              base_unit: undefined,
              pack_unit: undefined,
              palette_unit: undefined,
              eggs_per_pack: null,
              eggs_per_palette: null,
              is_active: "active",
              is_sellable: false,
              partner_ids: [],
            });
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>Item No.</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>หน่วยฐาน</TableHead>
                  <TableHead>ขายได้</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.sku || "-"}
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px]">
                      <div className="truncate" title={item.name}>
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.itemNumber || "-"}
                    </TableCell>
                    <TableCell>
                      {(item.partners && item.partners.length > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {item.partners.map((p: any) => (
                            <Badge key={p.partnerId} variant="outline" className="text-xs">
                              {p.partner?.code ?? p.partnerId}
                            </Badge>
                          ))}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.itemType || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.itemRole || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.baseUnit || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.isSellable ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {item.isSellable ? "ใช่" : "ไม่"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.isActive === "active" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {item.isActive === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingItem(item);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteItemId(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-8 text-muted-foreground"
                    >
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "แก้ไข Item" : "เพิ่ม Item"}
            </DialogTitle>
            <DialogDescription>กรอกข้อมูล Item</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU *</FormLabel>
                      <FormControl>
                        <Input placeholder="ITM-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="item_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Number</FormLabel>
                      <FormControl>
                        <Input placeholder="IN-001" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="8850000000000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อสินค้า *</FormLabel>
                    <FormControl>
                      <Input placeholder="ไข่ไก่ เบอร์ 2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รายละเอียด</FormLabel>
                    <FormControl>
                      <Input placeholder="รายละเอียดเพิ่มเติม" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Linked Customers — single Popover field */}
              <FormItem>
                <FormLabel>ลูกค้า</FormLabel>
                <Popover open={linkedCustomersOpen} onOpenChange={setLinkedCustomersOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      )}
                    >
                      {(form.watch("partner_ids") ?? []).length === 0 ? (
                        <span className="text-muted-foreground">เลือกลูกค้า...</span>
                      ) : (
                        (form.watch("partner_ids") ?? []).map((pid) => {
                          const bp = businessPartners.find((b) => b.id === pid);
                          if (!bp) return null;
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {bp.code} — {bp.businessName ?? bp.nickname}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  form.setValue(
                                    "partner_ids",
                                    (form.getValues("partner_ids") ?? []).filter((id) => id !== pid),
                                  );
                                }}
                                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}
                                className="cursor-pointer hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </span>
                            </span>
                          );
                        })
                      )}
                      <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ค้นหาลูกค้า..." />
                      <CommandEmpty>ไม่พบลูกค้า</CommandEmpty>
                      <CommandGroup>
                        {businessPartners.map((bp) => {
                          const selected = (form.watch("partner_ids") ?? []).includes(bp.id);
                          return (
                            <CommandItem
                              key={bp.id}
                              value={bp.code + " " + (bp.businessName ?? bp.nickname)}
                              onSelect={() => {
                                const current = form.getValues("partner_ids") ?? [];
                                form.setValue(
                                  "partner_ids",
                                  selected
                                    ? current.filter((id) => id !== bp.id)
                                    : [...current, bp.id],
                                );
                              }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")}
                              />
                              {bp.code} — {bp.businessName ?? bp.nickname}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormItem>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="item_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Role</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือก role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="raw">Raw Material</SelectItem>
                          <SelectItem value="wip">Work in Progress</SelectItem>
                          <SelectItem value="fg">Finished Good</SelectItem>
                          <SelectItem value="defect">Defect</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="item_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={availableTypes.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                availableTypes.length === 0
                                  ? "เลือก Role ก่อน"
                                  : "เลือกประเภท"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="is_sellable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ขายได้ (Sellable)</FormLabel>
                      <div className="flex items-center h-10">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>สถานะ (Active)</FormLabel>
                      <div className="flex items-center h-10">
                        <FormControl>
                          <Switch
                            checked={field.value === "active"}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? "active" : "inactive")
                            }
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {isSellable && (
                <>
                <FormField
                  control={form.control}
                  name="selling_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หน่วยขาย (Selling Unit)</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกหน่วย" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ฟอง">ฟอง</SelectItem>
                          <SelectItem value="แพ็ค">แพ็ค</SelectItem>
                          <SelectItem value="ถาด">ถาด</SelectItem>
                          <SelectItem value="ตะกร้า">ตะกร้า</SelectItem>
                          <SelectItem value="มัด">มัด</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <div className={`grid gap-4 ${hasBasket ? "grid-cols-4" : "grid-cols-3"}`}>
                  {/* Col 1 — Base Unit */}
                  <FormField
                    control={form.control}
                    name="base_unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>หน่วยฐาน (Base Unit)</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกหน่วย" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ฟอง">ฟอง</SelectItem>
                            <SelectItem value="แพ็ค">แพ็ค</SelectItem>
                            <SelectItem value="ถาด">ถาด</SelectItem>
                            <SelectItem value="ตะกร้า">ตะกร้า</SelectItem>
                            <SelectItem value="มัด">มัด</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Col 2 — Pack Unit + Eggs/Pack + Basket switch */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="pack_unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>หน่วยแพ็ค (Pack Unit)</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="เลือกหน่วย" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ถาด">ถาด</SelectItem>
                              <SelectItem value="แพ็ค4">แพ็ค 4</SelectItem>
                              <SelectItem value="แพ็ค10">แพ็ค 10</SelectItem>
                              <SelectItem value="แพ็ค12">แพ็ค 12</SelectItem>
                              <SelectItem value="แพ็ค15">แพ็ค 15</SelectItem>
                              <SelectItem value="มัด4">มัด 4</SelectItem>
                              <SelectItem value="มัด5">มัด 5</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="eggs_per_pack"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ไข่ต่อแพ็ค (Eggs / Pack)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="เช่น 10"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="has_basket"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>มีตะกร้า (Basket)</FormLabel>
                          <div className="flex items-center h-10">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (!checked)
                                    form.setValue("basket_unit", null);
                                }}
                              />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Col 3 — Basket size + Eggs/Basket (only when toggled on) */}
                  {hasBasket && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="basket_unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ขนาดตะกร้า</FormLabel>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกขนาด" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="S">S</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="L">L</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="eggs_per_basket"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ไข่ต่อตะกร้า (Eggs / Basket)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                placeholder="เช่น 360"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Col 3/4 — Palette Unit + Eggs/Palette */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="palette_unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>หน่วย Palette</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="เลือกหน่วย" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="แพ็ค4">แพ็ค4</SelectItem>
                              <SelectItem value="ถาด">ถาด</SelectItem>
                              <SelectItem value="ถาด/ครอบ">ถาด/ครอบ</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="eggs_per_palette"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ไข่ต่อ Palette (Eggs / Palette)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="เช่น 3600"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                </>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingItem ? "บันทึก" : "สร้าง"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteItemId !== null}
        onOpenChange={() => setDeleteItemId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Item</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ item นี้?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteItemId && deleteMutation.mutate(deleteItemId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
