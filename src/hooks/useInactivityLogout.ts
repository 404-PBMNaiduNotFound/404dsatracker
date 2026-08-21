"use client";

import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";

const LAST_ACTIVE_KEY = "dsa404-last-active-at";
const MAX_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Keeps a "last active" timestamp in localStorage. Firebase Auth already
 * persists the session indefinitely (no logout on tab close / refresh) —
 * this hook adds the one extra rule that was requested: if the user hasn't
 * opened the app for 7+ days, sign them out automatically. Any active visit
 * refreshes the timestamp, so normal usage never triggers it.
 */
export function useInactivityLogout(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const lastActive = Number(window.localStorage.getItem(LAST_ACTIVE_KEY) || 0);
    const now = Date.now();

    if (lastActive && now - lastActive > MAX_INACTIVITY_MS) {
      signOut(auth).catch(() => {});
      window.localStorage.removeItem(LAST_ACTIVE_KEY);
      return;
    }

    window.localStorage.setItem(LAST_ACTIVE_KEY, String(now));

    const refresh = () => window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [enabled]);
}
