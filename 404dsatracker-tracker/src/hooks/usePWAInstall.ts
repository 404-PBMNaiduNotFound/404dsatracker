"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

// Global cached prompt event so navigation across pages retains the install trigger
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    listeners.forEach((fn) => fn());
    toast.success("DSA404 App Installed!", {
      description: "App shortcut added to your homescreen & app drawer.",
    });
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed & opened as PWA/WebAPK)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");

      setIsStandalone(Boolean(isStandaloneMode));
      if (isStandaloneMode) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    const handleUpdate = () => {
      setDeferredPrompt(globalDeferredPrompt);
      checkStandalone();
    };

    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const triggerApkDownload = () => {
    try {
      const link = document.createElement("a");
      link.href = "/api/download-apk";
      link.download = "DSA404-Chrome-App.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Downloading Chrome APK Installer", {
        description: "Package downloaded! Open the downloaded file to complete installation.",
      });
    } catch (err) {
      toast.error("Download failed. Please check browser permissions.");
    }
  };

  const promptInstall = async () => {
    if (isStandalone) {
      toast.info("DSA404 is already installed!", {
        description: "You are currently running the installed DSA404 App.",
      });
      return;
    }

    const currentPrompt = deferredPrompt || globalDeferredPrompt;

    if (currentPrompt) {
      try {
        setIsInstalling(true);
        await currentPrompt.prompt();
        const choiceResult = await currentPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          toast.success("Installing DSA404 App...", {
            description: "Chrome WebAPK is installing onto your device.",
          });
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
        } else {
          toast.info("Installation skipped", {
            description: "You can install anytime using the Download APK / Install button.",
          });
        }
      } catch (err) {
        console.error("Install prompt error:", err);
        setShowModal(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Browser didn't trigger standard prompt (e.g. Chrome desktop before trigger, iOS Safari, Firefox, or unsupported context)
      // Show interactive installation step guide modal AND offer direct APK download option
      setShowModal(true);
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isStandalone,
    isInstalling,
    promptInstall,
    triggerApkDownload,
    showModal,
    setShowModal,
  };
}
