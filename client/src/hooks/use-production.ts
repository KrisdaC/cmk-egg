import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useProductionRequests() {
  return useQuery({
    queryKey: [api.production.listRequests.path],
    queryFn: async () => {
      const res = await fetch(api.production.listRequests.path);
      if (!res.ok) throw new Error("Failed to fetch production requests");
      return api.production.listRequests.responses[200].parse(await res.json());
    },
  });
}

export function useMaterialRequirements(productionRequestId: number | null) {
  return useQuery({
    queryKey: [api.production.getRequirements.path, productionRequestId],
    queryFn: async () => {
      if (!productionRequestId) return [];
      const url = buildUrl(api.production.getRequirements.path, { id: productionRequestId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch material requirements");
      return api.production.getRequirements.responses[200].parse(await res.json());
    },
    enabled: !!productionRequestId,
  });
}
