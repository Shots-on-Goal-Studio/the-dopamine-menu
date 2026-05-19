import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/roles.functions";

export function useIsAdmin() {
  const fetchRoles = useServerFn(getMyRoles);
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles(),
    staleTime: 5 * 60 * 1000,
  });
  return {
    isAdmin: (data?.roles ?? []).includes("admin"),
    isLoading,
  };
}
