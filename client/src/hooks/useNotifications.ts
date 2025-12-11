import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const NOTIFICATIONS_STORAGE_KEY = "simulchess-notifications-enabled";

export function useNotifications() {
  const { toast: originalToast, ...rest } = useToast();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(notificationsEnabled));
  }, [notificationsEnabled]);

  const toast = useCallback(
    (props: Parameters<typeof originalToast>[0]) => {
      if (!notificationsEnabled) {
        return { id: "", dismiss: () => {}, update: () => {} };
      }
      return originalToast(props);
    },
    [notificationsEnabled, originalToast]
  );

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev) => !prev);
  }, []);

  return {
    ...rest,
    toast,
    notificationsEnabled,
    setNotificationsEnabled,
    toggleNotifications,
  };
}

export function getNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("notifications-changed", { detail: enabled }));
}
