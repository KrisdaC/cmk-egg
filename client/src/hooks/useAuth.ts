import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { login } from "@/lib/api/auth";

export async function getMe() {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false, // don’t retry on 401
    staleTime: 0, // always reflect latest session state
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
