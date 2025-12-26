import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { getSession } from "@/lib/auth-client";

export function useAuth() {
  // Fetch session from Better Auth
  const { data: sessionData, isLoading: isSessionLoading } = useQuery({
    queryKey: ["/api/auth/get-session"],
    queryFn: async () => {
      const result = await getSession();
      return result.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const { data: user, isLoading: isUserLoading, isError } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    enabled: !!sessionData?.user,
  });

  const isSuspended = user?.suspendedUntil ? new Date(user.suspendedUntil) > new Date() : false;
  const suspendedUntil = user?.suspendedUntil ? new Date(user.suspendedUntil) : null;

  return {
    user,
    session: sessionData,
    isLoading: isSessionLoading || (isUserLoading && !isError),
    isAuthenticated: !!sessionData?.user,
    isSuspended,
    suspendedUntil,
  };
}
