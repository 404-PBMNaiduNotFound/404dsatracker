"use client";

/** NEW FILE — Upgrade 2/5: settings context (theme, pace, reminders, pause). */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type UserSettings,
} from "@/lib/settings";

interface SettingsCtx {
  settings: UserSettings;
  loading: boolean;
  update: (patch: Partial<UserSettings>) => Promise<void>;
  userId: string;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadSettings(userId)
      .then((s) => {
        if (alive) setSettings(s);
      })
      .catch(() => {
        /* fall back to defaults — settings must never block the app */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      try {
        await saveSettings(userId, patch);
      } catch (e) {
        toast.error("Could not save your settings", {
          description: e instanceof Error ? e.message : "Please try again.",
        });
      }
    },
    [userId],
  );

  // Apply the theme to <html> as soon as it is known (and on every change).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const prefersLight =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    const light = settings.theme === "light" || (settings.theme === "system" && prefersLight);
    root.classList.toggle("light", light);
    root.classList.toggle("dark", !light);
    root.style.colorScheme = light ? "light" : "dark";
  }, [settings.theme]);

  const value = useMemo(
    () => ({ settings, loading, update, userId }),
    [settings, loading, update, userId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
};
