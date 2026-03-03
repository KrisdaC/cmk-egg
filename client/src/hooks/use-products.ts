import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertProduct, type InsertPriceAdjustment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useProducts() {
  return useQuery({
    queryKey: [api.products.list.path],
    queryFn: async () => {
      const res = await fetch(api.products.list.path);
      if (!res.ok) throw new Error("Failed to fetch products");
      return api.products.list.responses[200].parse(await res.json());
    },
  });
}

export function usePendingPriceAdjustments() {
  return useQuery({
    queryKey: [api.priceAdjustments.listPending.path],
    queryFn: async () => {
      const res = await fetch(api.priceAdjustments.listPending.path);
      if (!res.ok) throw new Error("Failed to fetch price adjustments");
      return api.priceAdjustments.listPending.responses[200].parse(await res.json());
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertProduct) => {
      const validated = api.products.create.input.parse(data);
      const res = await fetch(api.products.create.path, {
        method: api.products.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create product");
      return api.products.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Success", description: "Product created successfully" });
    },
  });
}

export function useRequestPriceAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ productId, ...data }: Omit<InsertPriceAdjustment, 'approvedBy' | 'status'> & { productId: number }) => {
      const url = buildUrl(api.products.updatePrice.path, { id: productId });
      // Clean data before validation/sending
      const payload = {
        productId,
        newPrice: data.newPrice,
        effectiveDate: data.effectiveDate,
        requestedBy: data.requestedBy
      };
      
      const res = await fetch(url, {
        method: api.products.updatePrice.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to request price adjustment");
      return api.products.updatePrice.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.priceAdjustments.listPending.path] });
      toast({ title: "Success", description: "Price adjustment requested" });
    },
  });
}

export function useApprovePriceAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, approvedBy }: { id: number; approvedBy: number }) => {
      const url = buildUrl(api.priceAdjustments.approve.path, { id });
      const res = await fetch(url, {
        method: api.priceAdjustments.approve.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBy }),
      });
      if (!res.ok) throw new Error("Failed to approve price adjustment");
      return api.priceAdjustments.approve.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.priceAdjustments.listPending.path] });
      toast({ title: "Approved", description: "Price update approved and applied" });
    },
  });
}
