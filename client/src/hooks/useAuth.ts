import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { useSession } from "@/lib/auth-client";

export function useAuth() {
  // Use better-auth's built-in useSession hook
  const { data: sessionData, isPending: isSessionLoading, error: sessionError } = useSession();
  
  const { data: user, isLoading: isUserLoading, isError } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    enabled: !!sessionData?.user,
  });

  const isSuspended = user?.suspendedUntil ? new Date(user.suspendedUntil) > new Date() : false;
  const suspendedUntil = user?.suspendedUntil ? new Date(user.suspendedUntil) : null;

  // isLoading: Only wait for session to resolve. This allows the app shell to render immediately.
  // isUserLoading: Additional flag for components that need user profile data (suspension, etc.)
  const isLoading = isSessionLoading && !sessionError;

  return {
    user,
    session: sessionData,
    isLoading,
    isUserLoading: isUserLoading && !isError,
    isAuthenticated: !!sessionData?.user,
    isSuspended,
    suspendedUntil,
  };
}
