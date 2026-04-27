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
import { Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  deleteFinishedGood,
  getFinishedGoodById,
  getFinishedGoods,
  upsertFinishedGood,
} from "@/lib/api/finishedGoods";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { ConsoleLogWriter } from "drizzle-orm";
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

interface Product {
  id: number;
  sku: string;
  name: string;
  barcode: string;
  description?: string;
  vendorId?: number;
  sellingUnits?: string;
  packingUnits?: string;
  paletteUnits?: string;
  basketUnits?: string;
  eggsPerPack?: number;
  eggsPerSellingUnit?: number;
  eggSizeA?: string;
  eggSizeB?: string;
  percentageA?: number;
  skuSizeCategory?: string;
  crateSize?: string;
  type?: string;
  isActive?: boolean;
  vendor?: { id: number; code: string; name: string };
  businessPartnerNames?: string;
}

export default function FinishedGoods() {
  const [search, setSearch] = useState("");
  const [filterVendor, setFilterVendor] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [deleteFGId, setDeleteFGId] = useState<number | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["finished-goods"],
    queryFn: getFinishedGoods,
  });

  const { data: vendors } = useQuery<
    { id: number; code: string; name: string }[]
  >({
    queryKey: ["/api/vendors"],
  });

  const filteredProducts =
    products?.filter((p) => {
      const matchesSearch =
        !search ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.name?.toLowerCase().includes(search.toLowerCase());
      const matchesVendor = !filterVendor || p.vendor?.code === filterVendor;
      return matchesSearch && matchesVendor;
    }) || [];

  const formatSizeDisplay = (p: Product) => {
    if (p.eggSizeB) {
      const pctA = p.percentageA ?? 50;
      return `${p.eggSizeA}-${p.eggSizeB} (${pctA}%/${100 - pctA}%)`;
    }
    return p.eggSizeA || "-";
  };

  const finishedGoodFormSchema = z.object({
    sku: z.string().min(1, "กรุณากรอก SKU"),
    name: z.string().min(1, "กรุณากรอกชื่อสินค้า"),
    description: z.string().optional(),
    barcode: z.string().optional(),

    selling_units: z.string().optional(),
    packing_units: z.string().optional(),
    palette_units: z.string().optional(),
    basket_units: z.string().optional(),

    eggs_per_selling_unit: z.number().min(1).optional(),
    eggs_per_pack: z.number().min(1).optional(),
    packs_per_basket: z.number().min(1).optional(),
    baskets_per_palette: z.number().min(1).optional(),

    sku_size_category: z.string().optional(),
    pack_base: z.string().optional(),
    lid_cover: z.string().optional(),
    barcode_label: z.string().optional(),
    sticker_label: z.string().optional(),

    business_partner_ids: z.array(z.number()).optional(),
    is_active: z.boolean().default(true),
    type: z.string(),
  });

  type FinishedGoodFormValues = z.infer<typeof finishedGoodFormSchema>;

  const finishedGoodForm = useForm<z.infer<typeof finishedGoodFormSchema>>({
    resolver: zodResolver(finishedGoodFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      barcode: "",
      selling_units: undefined,
      packing_units: undefined,
      palette_units: undefined,
      basket_units: undefined,
      eggs_per_selling_unit: 1,
      eggs_per_pack: 1,
      packs_per_basket: 1,
      baskets_per_palette: 1,
      sku_size_category: "",
      pack_base: "",
      lid_cover: "",
      barcode_label: "",
      sticker_label: "",
      business_partner_ids: [],

      is_active: true,
      type: undefined,
    },
  });

  const { data: editingFinishedGood } = useQuery({
    queryKey: ["finished-good", editingItem?.id],
    queryFn: () => getFinishedGoodById(editingItem!.id),
    enabled: !!editingItem?.id,
  });

  const { data: businessPartners = [] } = useQuery<
    { id: number; code: string; name: string }[]
  >({
    queryKey: ["business-partners"],
    queryFn: async () => {
      const res = await fetch("/api/business-partners");
      if (!res.ok) throw new Error("Failed to fetch business partners");
      return res.json();
    },
  });

  useEffect(() => {
    if (!editingFinishedGood) return;

    finishedGoodForm.reset({
      sku: editingFinishedGood.sku,
      name: editingFinishedGood.name,
      description: editingFinishedGood.description ?? "",
      barcode: editingFinishedGood.barcodeLabel ?? "",

      selling_units: editingFinishedGood.sellingUnits ?? undefined,
      packing_units: editingFinishedGood.packingUnits ?? undefined,
      palette_units: editingFinishedGood.paletteUnits ?? undefined,
      basket_units: editingFinishedGood.basket_units ?? undefined,

      eggs_per_selling_unit:
        Number(editingFinishedGood.eggs_per_selling_unit) ?? undefined,
      eggs_per_pack: Number(editingFinishedGood.eggsPerPack) ?? undefined,
      packs_per_basket: Number(editingFinishedGood.packsPerBasket) ?? undefined,

      baskets_per_palette: editingFinishedGood.basketsPerPalette ?? undefined,

      sku_size_category: editingFinishedGood.skuSizeCategory ?? "",
      pack_base: editingFinishedGood.packBase ?? "",
      lid_cover: editingFinishedGood.lidCover ?? "",
      barcode_label: editingFinishedGood.barcodeLabel ?? "",
      sticker_label: editingFinishedGood.stickerLabel ?? "",

      business_partner_ids: editingFinishedGood.business_partner_ids ?? [],

      is_active: editingFinishedGood.isActive ?? true,
      type: editingFinishedGood.type ?? "",
    });
  }, [editingFinishedGood, finishedGoodForm]);

  const onSubmitFinishedGood = (values: FinishedGoodFormValues) => {
    upsertMutation.mutate({
      id: editingItem?.id,
      ...values, // ✅ includes business_partner_ids
    });
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const queryClient = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: upsertFinishedGood,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finished-goods"] });

      if (editingItem?.id) {
        queryClient.invalidateQueries({
          queryKey: ["finished-good", editingItem.id],
        });
      }

      closeDialog();
    },
    onError: async (error: any) => {
      // fetch throws on non-2xx
      let message = "Failed to save";

      try {
        const res = await error.response?.json?.();
        console.log(error.response);
        message = res?.message ?? message;
      } catch {}

      // Attach error to SKU field
      finishedGoodForm.setError("sku", {
        type: "server",
        message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFinishedGood,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finished-goods"] });
      setDeleteFGId(null); // close dialog
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Finished Goods
          </h1>
          <p className="text-muted-foreground">
            Master list of all finished products ({filteredProducts.length}{" "}
            items)
          </p>
        </div>
        <Button
          data-testid="button-add-product"
          onClick={() => {
            setEditingItem(null);
            finishedGoodForm.reset({
              sku: "",
              name: "",
              description: "",
              selling_units: undefined,
              packing_units: undefined,
              palette_units: undefined,
              packs_per_basket: 1,
              baskets_per_palette: 1,
              sku_size_category: "",
              pack_base: "",
              lid_cover: "",
              barcode_label: "",
              sticker_label: "",
              business_partner_ids: [], // ✅ REQUIRED
              is_active: true,
              type: "",
            });
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by SKU or product name..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterVendor === null ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterVendor(null)}
                data-testid="button-filter-all"
              >
                All
              </Button>
              {vendors?.map((v) => (
                <Button
                  key={v.id}
                  variant={filterVendor === v.code ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterVendor(v.code)}
                  data-testid={`button-filter-${v.code}`}
                >
                  {v.code}
                </Button>
              ))}
            </div>
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
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>หน่วยขาย</TableHead>
                  <TableHead>หน่วยแพ๊ค</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    data-testid={`row-product-${product.id}`}
                  >
                    <TableCell className="font-mono text-sm">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px]">
                      <div className="truncate" title={product.name}>
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {product.businessPartnerNames || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.sellingUnits || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.packingUnits || "-"}
                    </TableCell>
                    <TableCell>{product.type || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-edit-${product.id}`}
                          onClick={() => {
                            console.log(product);
                            setEditingItem(product);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-delete-${product.id}`}
                          onClick={() => setDeleteFGId(product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No products found
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
              {editingItem ? "แก้ไข Finished Goods" : "เพิ่ม Finished Goods"}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลสินค้า Finished Goods
            </DialogDescription>
          </DialogHeader>

          <Form {...finishedGoodForm}>
            <form
              onSubmit={finishedGoodForm.handleSubmit(onSubmitFinishedGood)}
              className="space-y-4"
            >
              {/* SKU + Name */}
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={finishedGoodForm.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU *</FormLabel>
                      <FormControl>
                        <Input placeholder="FG-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={finishedGoodForm.control}
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
                  control={finishedGoodForm.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>บาร์โค้ด</FormLabel>
                      <FormControl>
                        <Input placeholder="8858878500304" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={finishedGoodForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รายละเอียดสินค้า</FormLabel>
                    <FormControl>
                      <Input placeholder="รายละเอียดเพิ่มเติม" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Units */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={finishedGoodForm.control}
                  name="selling_units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หน่วยขาย</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกหน่วยขาย" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* ["ฟอง", "ถาด", "ตะกร้า", "แพ็ค", "มัด"] */}
                          <SelectItem value="ฟอง">ฟอง</SelectItem>
                          <SelectItem value="แพ็ค">แพ็ค</SelectItem>
                          <SelectItem value="ถาด">ถาด/ตะกร้า/มัด</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={finishedGoodForm.control}
                  name="eggs_per_selling_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนไข่ต่อหน่วยขาย</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
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
                  control={finishedGoodForm.control}
                  name="packing_units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หน่วยแพ๊ค</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);

                          const PACKING_EGGS_MAP: Record<string, number> = {
                            แพ็ค4: 4,
                            แพ็ค10: 10,
                            แพ็ค12: 12,
                            แพ็ค15: 15,
                            มัด4: 4,
                            มัด5: 5,
                            ถาด: 30,
                            "ถาด/ครอบ": 30,
                          };

                          const eggs = PACKING_EGGS_MAP[val];
                          if (eggs) {
                            finishedGoodForm.setValue("eggs_per_pack", eggs);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกหน่วยแพ๊ค" />
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
                          <SelectItem value="ถาด/ครอบ">ถาด/ครอบ</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={finishedGoodForm.control}
                  name="eggs_per_pack"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนไข่ต่อแพ๊ค</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? "1"}
                          readOnly
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={finishedGoodForm.control}
                  name="basket_units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หน่วยตะกร้า</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกหน่วยตะกร้า" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* ["แพ็ค 4", "ถาด", "ถาด/ครอบ"] */}
                          <SelectItem value="S">S</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="A">A</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={finishedGoodForm.control}
                  name="packs_per_basket"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนแพ๊คต่อตะกร้า</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
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
                  control={finishedGoodForm.control}
                  name="palette_units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หน่วย palette</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกหน่วย palette" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* ["แพ็ค 4", "ถาด", "ถาด/ครอบ"] */}
                          <SelectItem value="แพ็ค4">แพ็ค4</SelectItem>
                          <SelectItem value="ถาด">ถาด</SelectItem>
                          <SelectItem value="ถาด/ครอบ">ถาด/ครอบ</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={finishedGoodForm.control}
                  name="baskets_per_palette"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนตะกร้าต่อ palette</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
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

              {/* Packaging info */}
              {/* <div className="grid grid-cols-2 gap-4">
                <FormField
                  name="sku_size_category"
                  control={finishedGoodForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU Size Category</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="pack_base"
                  control={finishedGoodForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pack Base</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  name="lid_cover"
                  control={finishedGoodForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lid / Cover</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="barcode_label"
                  control={finishedGoodForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                name="sticker_label"
                control={finishedGoodForm.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sticker Label</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              /> */}

              {/* Customers */}
              <FormField
                control={finishedGoodForm.control}
                name="business_partner_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customers</FormLabel>

                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between border-input !border-input"
                          >
                            {field.value && field.value.length > 0
                              ? businessPartners
                                  .filter((bp) => field.value?.includes(bp.id))
                                  .map((bp) => bp.name)
                                  .join(", ")
                              : "Select customers"}
                            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>

                      <PopoverContent className="w-full p-2 max-h-64 overflow-y-auto">
                        <div className="space-y-1">
                          {businessPartners.map((partner) => {
                            const checked = field.value?.includes(partner.id);

                            return (
                              <div
                                key={partner.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted"
                              >
                                <Checkbox
                                  checked={field.value?.includes(partner.id)}
                                  onCheckedChange={() => {
                                    const checked = field.value?.includes(
                                      partner.id,
                                    );

                                    const next = checked
                                      ? field.value?.filter(
                                          (id) => id !== partner.id,
                                        )
                                      : [...(field.value ?? []), partner.id];

                                    field.onChange(next);
                                  }}
                                />
                                <span className="text-sm">
                                  {partner.code} — {partner.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Flags */}
              <div className="flex gap-6 pt-2">
                <FormField
                  control={finishedGoodForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ประเภท</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="เลือกประเภท" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grade">Grade</SelectItem>
                            <SelectItem value="OEM">OEM</SelectItem>
                            <SelectItem value="undergrade">
                              Undergrade
                            </SelectItem>
                            <SelectItem value="own">Own Brand</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={finishedGoodForm.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>สถานะ</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? "active" : "inactive"}
                          onValueChange={(val) =>
                            field.onChange(val === "active")
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">ใช้งาน</SelectItem>
                            <SelectItem value="inactive">ไม่ใช้งาน</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  ยกเลิก
                </Button>
                <Button type="submit">
                  {editingItem ? "บันทึก" : "สร้าง"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteFGId !== null}
        onOpenChange={() => setDeleteFGId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสินค้า</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => deleteFGId && deleteMutation.mutate(deleteFGId)}
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
    </div>
  );
}
