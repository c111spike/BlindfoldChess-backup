import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const isSuspended = user?.suspendedUntil ? new Date(user.suspendedUntil) > new Date() : false;
  const suspendedUntil = user?.suspendedUntil ? new Date(user.suspendedUntil) : null;

  return {
    user,
    isLoading: isLoading && !isError,
    isAuthenticated: !!user,
    isSuspended,
    suspendedUntil,
  };
}
