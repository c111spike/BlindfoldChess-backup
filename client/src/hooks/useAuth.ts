import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { useSession } from "@/lib/auth-client";

export function useAuth() {
  // Use better-auth's built-in useSession hook
  const { data: sessionData, isPending: isSessionLoading, error: sessionError } = useSession();
  
  // Include session user's email in query key to force refetch when session changes
  const sessionEmail = sessionData?.user?.email;
  
  const { data: user, isLoading: isUserLoading, isError } = useQuery<User | null>({
    queryKey: ["/api/user", sessionEmail],
    // Custom queryFn with cache-busting to bypass any CDN/browser caching
    queryFn: async () => {
      const cacheBuster = Date.now();
      const res = await fetch(`/api/user?_cb=${cacheBuster}`, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return await res.json();
    },
    retry: false,
    enabled: !!sessionData?.user,
    staleTime: 0, // Always refetch to get fresh user data
    gcTime: 0, // Don't keep stale data in cache
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
