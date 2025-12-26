import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { useSession } from "@/lib/auth-client";

export function useAuth() {
  // Use better-auth's built-in useSession hook
  const { data: sessionData, isPending: isSessionLoading } = useSession();
  
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
