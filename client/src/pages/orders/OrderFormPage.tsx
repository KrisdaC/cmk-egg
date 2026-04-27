import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react"; // add this import at the top
import { z } from "zod";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";

export const orderSchema = z.object({
  orderNumber: z.string().optional(),

  barcode: z.string().optional(),

  partnerId: z.number({
    required_error: "กรุณาเลือกลูกค้า",
  }),

  deliverySiteId: z.number({
    required_error: "กรุณาเลือกสถานที่จัดส่ง",
  }),

  deliveryDate: z.string().min(1, "กรุณาเลือกวันที่จัดส่ง"),

  notes: z.string().optional(),

  products: z
    .array(
      z.object({
        itemId: z
          .union([z.string(), z.number()])
          .refine(
            (val) => val !== "" && val !== null && val !== undefined,
            "กรุณาเลือกสินค้า",
          ),
        sellingUnits: z.string(),
        price: z
          .number({ invalid_type_error: "ราคาต้องเป็นตัวเลข" })
          .min(0, "ราคาต้องมากกว่าหรือเท่ากับ 0"),
        quantity: z
          .number({ invalid_type_error: "จำนวนต้องเป็นตัวเลข" })
          .min(1, "จำนวนต้องไม่น้อยกว่า 1"),
      }),
    )
    .min(1, "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ"),
  status: z.string().min(1, "กรุณาเลือกสถานะ"),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export default function OrderFormPage() {
  const [, setLocation] = useLocation();

  //Detect Mode
  const [createMatch] = useRoute("/orders/new");
  const [editMatch, editParams] = useRoute("/orders/:orderNumber/edit");
  const [viewMatch, viewParams] = useRoute("/orders/:orderNumber");

  let mode: "create" | "edit" | "view" = "create";
  let orderNumber: string | undefined;

  if (createMatch) {
    mode = "create";
  } else if (editMatch) {
    mode = "edit";
    orderNumber = editParams?.orderNumber;
  } else if (viewMatch) {
    mode = "view";
    orderNumber = viewParams?.orderNumber;
  }

  const isReadOnly = mode === "view";
  const isEdit = mode === "edit";

  const STATUS_FLOW = [
    "pending",
    "confirmed",
    "in_production",
    "ready",
    "delivered",
    "cancelled",
  ] as const;

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      orderNumber: "",
      barcode: "",
      partnerId: undefined,
      deliverySiteId: undefined,
      deliveryDate: "",
      notes: "",
      status: "pending",
      products: [{ itemId: "", price: 0, quantity: 1, sellingUnits: "" }],
    },
  });

  const currentStatus = form.watch("status");
  const watchedProducts = form.watch("products");

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<
    {
      id: number;
      businessName: string;
      deliverySites: {
        id: number;
        displayName: string;
        siteCode: string;
      }[];
    }[]
  >([]);
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const selectedPartnerId = form.watch("partnerId");
  const selectedCustomer = customers.find((c) => c.id === selectedPartnerId);
  const deliverySites = selectedCustomer?.deliverySites ?? [];

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  //load order
  useEffect(() => {
    if (!orderNumber) return;

    async function loadOrder() {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderNumber}`);
      const data = await res.json();

      form.reset({
        orderNumber: data.orderNumber,
        barcode: data.barcode ?? "",
        partnerId: data.partnerId,
        deliverySiteId: data.deliverySiteId,
        deliveryDate: data.deliveryDate?.slice(0, 10),
        notes: data.notes,
        products: data.items.map((item: any) => ({
          itemId: item.itemId,
          price: Number(item.unitPrice),
          quantity: item.quantity,
          sellingUnits: item.sellingUnits ?? "",
        })),
        status: data.status || "pending",
      });

      setLoading(false);
    }

    loadOrder();
  }, [orderNumber]);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch("/api/customer-accounts");
        if (!res.ok) throw new Error("Failed to fetch customers");
        const data = await res.json();
        setCustomers(data);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    }

    fetchCustomers();
  }, []);

  useEffect(() => {
    async function fetchItems() {
      try {
        const res = await fetch("/api/items");
        if (!res.ok) throw new Error("Failed to fetch items");
        const data: any[] = await res.json();
        setProductOptions(data.filter((i) => i.isSellable));
      } catch (error) {
        console.error("Error fetching items:", error);
      }
    }

    fetchItems();
  }, []);

  const onSubmit = async (values: OrderFormValues) => {
    try {
      setLoading(true);

      const payload = {
        ...values,
        partnerId: Number(values.partnerId),
        deliverySiteId: Number(values.deliverySiteId),
        products: values.products.map((p) => ({
          itemId: Number(p.itemId),
          unitPrice: Number(p.price),
          quantity: Number(p.quantity),
        })),
      };

      if (isEdit && orderNumber) {
        // UPDATE
        const res = await fetch(`/api/orders/${orderNumber}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to update order");
        }

        const result = await res.json();
        setLocation(`/orders/${result.orderNumber}`);
      } else {
        // CREATE
        const res = await fetch(`/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create order");
        }
        const result = await res.json();
        setLocation(`/orders/${result.orderNumber}`);
      }
    } catch (error: any) {
      console.error("Error submitting order:", error);

      if (error?.field) {
        form.setError(error.field, { message: error.message });
      } else {
        alert(error.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="space-y-6 py-8 px-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? "แก้ไขใบสั่งขาย" : "สร้างใบสั่งขาย"}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? "อัปเดตข้อมูลใบสั่งขายลูกค้า" : "สร้างใบสั่งขายใหม่"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/orders/input")}
          >
            ยกเลิก
          </Button>
        </div>

        <Card className="w-full">
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                noValidate
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {orderNumber && (
                    <div className="inline-flex flex-col w-[200px]">
                      <FormField
                        control={form.control}
                        name="orderNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>เลขที่ใบสั่งขาย *</FormLabel>
                            <FormControl>
                              <Input
                                className="bg-white"
                                placeholder="ORD-001"
                                disabled={true}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="inline-flex flex-col w-[200px]">
                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>บาร์โค้ด</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="สแกนหรือกรอกบาร์โค้ด"
                              disabled={isReadOnly}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="inline-flex flex-col w-[200px]">
                    <FormField
                      control={form.control}
                      name="deliveryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>วันที่จัดส่ง *</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              type="date"
                              disabled={isReadOnly}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {mode !== "create" && (
                    <div className="inline-flex flex-col w-[200px]">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>สถานะ *</FormLabel>
                            <FormControl>
                              <Select
                                disabled={isReadOnly}
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="เลือกสถานะ" />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_FLOW.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {status
                                        .replace(/_/g, " ")
                                        .replace(/\b\w/g, (c) =>
                                          c.toUpperCase(),
                                        )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-start gap-4">
                  <div className="inline-flex flex-col w-[300px]">
                    <FormField
                      control={form.control}
                      name="partnerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ลูกค้า *</FormLabel>
                          <FormControl>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between bg-white border border-input !border-input"
                                  disabled={isReadOnly}
                                >
                                  {field.value
                                    ? customers.find(
                                        (c) => c.id === field.value,
                                      )?.businessName
                                    : "เลือกลูกค้า"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>

                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <CommandInput placeholder="ค้นหาลูกค้า..." />
                                  <CommandEmpty>ไม่พบลูกค้า</CommandEmpty>
                                  <CommandGroup>
                                    {customers.map((customer) => (
                                      <CommandItem
                                        key={customer.id}
                                        value={customer.businessName}
                                        onSelect={() => {
                                          field.onChange(customer.id);
                                          form.setValue(
                                            "deliverySiteId",
                                            undefined,
                                          );
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === customer.id
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {customer.businessName}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="inline-flex flex-col w-[300px]">
                    <FormField
                      control={form.control}
                      name="deliverySiteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>สถานที่จัดส่ง *</FormLabel>
                          <FormControl>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  disabled={!selectedPartnerId || isReadOnly}
                                  className="w-full justify-between bg-white border border-input !border-input"
                                >
                                  {field.value
                                    ? deliverySites.find(
                                        (s) => s.id === field.value,
                                      )?.displayName
                                    : selectedPartnerId
                                      ? "เลือกสถานที่จัดส่ง"
                                      : "กรุณาเลือกลูกค้าก่อน"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>

                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <CommandInput placeholder="ค้นหาสถานที่จัดส่ง..." />
                                  <CommandEmpty>
                                    ไม่พบสถานที่จัดส่ง
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {deliverySites.map((site) => (
                                      <CommandItem
                                        key={site.id}
                                        value={site.displayName}
                                        onSelect={() => field.onChange(site.id)}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === site.id
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {site.displayName} ({site.siteCode})
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <hr></hr>
                {/* Products Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">รายการสินค้า</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          itemId: "",
                          price: 0,
                          quantity: 1,
                          sellingUnits: "",
                        })
                      }
                      disabled={isReadOnly || currentStatus !== "pending"}
                    >
                      เพิ่มสินค้า
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-background px-4 py-3 text-sm font-medium">
                      <div className="col-span-5">สินค้า</div>
                      <div className="col-span-2">หน่วยขาย</div>
                      <div className="col-span-2">ราคา</div>
                      <div className="col-span-2">จำนวน</div>
                      {isReadOnly === false && currentStatus === "pending" && (
                        <div className="col-span-1 text-right">จัดการ</div>
                      )}
                    </div>

                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 items-center gap-x-4 px-4 py-3 border-t"
                      >
                        <div className="col-span-5">
                          <FormField
                            control={form.control}
                            name={`products.${index}.itemId`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between bg-white border border-input !border-input"
                                        disabled={
                                          isReadOnly ||
                                          currentStatus !== "pending"
                                        }
                                      >
                                        {field.value
                                          ? productOptions.find(
                                              (p: any) => p.id === field.value,
                                            )?.name || "เลือกสินค้า"
                                          : "เลือกสินค้า"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                      <Command>
                                        <CommandInput placeholder="ค้นหาสินค้า..." />
                                        <CommandEmpty>ไม่พบสินค้า</CommandEmpty>
                                        <CommandGroup>
                                          {productOptions.map(
                                            (product: any) => (
                                              <CommandItem
                                                key={product.id}
                                                value={product.name}
                                                onSelect={() => {
                                                  field.onChange(product.id);
                                                  form.setValue(
                                                    `products.${index}.sellingUnits`,
                                                    product.baseUnit || "",
                                                    { shouldValidate: false },
                                                  );
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    field.value === product.id
                                                      ? "opacity-100"
                                                      : "opacity-0",
                                                  )}
                                                />
                                                {product.name}
                                              </CommandItem>
                                            ),
                                          )}
                                        </CommandGroup>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`products.${index}.sellingUnits`}
                            render={({ field }) => {
                              const currentItemId =
                                watchedProducts[index]?.itemId;
                              const selectedItem = productOptions.find(
                                (p: any) => p.id === Number(currentItemId),
                              );
                              const unitOptions = [
                                selectedItem?.baseUnit,
                                selectedItem?.packUnit,
                                selectedItem?.paletteUnit,
                              ].filter(Boolean) as string[];

                              return (
                                <FormItem className="space-y-1">
                                  <FormControl>
                                    <Select
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      disabled={
                                        isReadOnly ||
                                        currentStatus !== "pending" ||
                                        unitOptions.length === 0
                                      }
                                    >
                                      <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="เลือกหน่วย" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {unitOptions.map((unit) => (
                                          <SelectItem key={unit} value={unit}>
                                            {unit}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>

                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`products.${index}.price`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    className="bg-white"
                                    type="number"
                                    disabled={
                                      isReadOnly || currentStatus !== "pending"
                                    }
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(Number(e.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`products.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormControl>
                                  <Input
                                    className="bg-white"
                                    type="number"
                                    disabled={
                                      isReadOnly || currentStatus !== "pending"
                                    }
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(Number(e.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-1 flex justify-end">
                          {!isReadOnly && currentStatus === "pending" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <hr></hr>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>หมายเหตุ</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="กรอกหมายเหตุ..."
                          rows={4}
                          className="bg-white resize-none"
                          disabled={isReadOnly}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4 pt-4">
                  {!isReadOnly && (
                    <Button type="submit" disabled={loading}>
                      {isEdit ? "อัปเดตใบสั่งขาย" : "สร้างใบสั่งขาย"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
