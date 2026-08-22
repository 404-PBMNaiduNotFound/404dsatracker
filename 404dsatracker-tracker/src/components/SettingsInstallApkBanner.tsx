"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { ChromeInstallModal } from "@/components/ChromeInstallModal";
import { Button } from "@/components/ui/button";
import {
  Download,
  Smartphone,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

export function SettingsInstallApkBanner() {
  const {
    isInstallable,
    isInstalled,
    isStandalone,
    isInstalling,
    promptInstall,
    triggerApkDownload,
    showModal,
    setShowModal,
  } = usePWAInstall();

  return (
    <div className="mb-8 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-background p-4 sm:p-5 shadow-md relative overflow-hidden animate-fade-in-up">
      {/* Decorative ambient background */}
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-2xl" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <Smartphone className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-semibold text-base sm:text-lg text-foreground flex items-center gap-2">
                Install App from Chrome
              </h2>
              {isStandalone || isInstalled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" /> App Installed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-mono font-medium text-primary">
                  <Sparkles className="size-3" /> Chrome APK Ready
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {isStandalone || isInstalled
                ? "DSA404 is active on your device. Click below to re-download the APK installer package anytime."
                : "Install DSA404 directly from Google Chrome to get home screen access, fast launching, and push notifications."}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
          <Button
            onClick={promptInstall}
            disabled={isInstalling}
            size="sm"
            className="font-mono text-xs gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex-1 sm:flex-none"
          >
            {isInstalling ? (
              <>
                <Sparkles className="size-3.5 animate-spin" /> Installing...
              </>
            ) : isStandalone || isInstalled ? (
              <>
                <CheckCircle2 className="size-3.5" /> Installed
              </>
            ) : (
              <>
                <Smartphone className="size-3.5" /> Install Chrome App
              </>
            )}
          </Button>

          <Button
            onClick={triggerApkDownload}
            variant="outline"
            size="sm"
            className="font-mono text-xs gap-1.5 border-primary/30 hover:border-primary/60 hover:bg-primary/5 flex-1 sm:flex-none"
          >
            <Download className="size-3.5 text-primary" /> Download APK
          </Button>
        </div>
      </div>

      <ChromeInstallModal
        open={showModal}
        onOpenChange={setShowModal}
        onDownloadApk={triggerApkDownload}
      />
    </div>
  );
}
