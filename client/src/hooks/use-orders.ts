import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertOrder, type InsertOrderItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Composite input type for order creation
const createOrderInput = api.orders.create.input;
type CreateOrderInput = z.infer<typeof createOrderInput>;

export function useOrders() {
  return useQuery({
    queryKey: [api.orders.list.path],
    queryFn: async () => {
      const res = await fetch(api.orders.list.path);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return api.orders.list.responses[200].parse(await res.json());
    },
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: [api.orders.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.orders.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch order");
      return api.orders.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOrderInput) => {
      const validated = createOrderInput.parse(data);
      const res = await fetch(api.orders.create.path, {
        method: api.orders.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to create order");
      return api.orders.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
      // Invalidate production requests too as creating an order might trigger one
      queryClient.invalidateQueries({ queryKey: ["/api/production-requests"] });
      toast({ title: "Success", description: "Order created successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create order", 
        variant: "destructive" 
      });
    },
  });
}
