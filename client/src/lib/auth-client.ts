import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const {
  signIn,
  signUp,
  signOut,
  getSession,
} = authClient;
