import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const {
  signIn,
  signUp,
  signOut,
  getSession,
  useSession,
} = authClient;

// Password reset methods - use type assertions due to Better Auth typing limitations
export const forgetPassword = (authClient as any).forgetPassword as (options: { email: string; redirectTo: string }) => Promise<{ data: any; error: any }>;
export const resetPassword = (authClient as any).resetPassword as (options: { newPassword: string; token: string }) => Promise<{ data: any; error: any }>;
