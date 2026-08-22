"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { ChromeInstallModal } from "@/components/ChromeInstallModal";
import { Button } from "@/components/ui/button";
import {
  Download,
  Smartphone,
  Zap,
  WifiOff,
  Bell,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export function InstallApkSection() {
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
    <section className="my-14 relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-card via-card/90 to-background p-6 sm:p-10 shadow-xl">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header Tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-mono text-primary font-medium">
            <Sparkles className="size-3.5 animate-pulse" />
            Chrome Web APK &amp; PWA
          </div>
          {isStandalone || isInstalled ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="size-3.5" />
              App Installed &amp; Active
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground">
              <Smartphone className="size-3.5 text-primary" />
              Chrome Android &amp; Desktop Ready
            </div>
          )}
        </div>

        {/* Content & CTA Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-foreground">
              Install <span className="bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">DSA⁴⁰⁴ App</span> directly from Chrome
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Transform your browser into a full-featured native desktop or mobile app. Enjoy 1-click home screen launching, fast performance, and real-time push reminders without needing an app store.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={promptInstall}
                disabled={isInstalling}
                size="lg"
                className="font-mono text-sm gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
              >
                {isInstalling ? (
                  <>
                    <Sparkles className="size-4 animate-spin" /> Installing...
                  </>
                ) : isStandalone || isInstalled ? (
                  <>
                    <CheckCircle2 className="size-4" /> App Already Installed
                  </>
                ) : (
                  <>
                    <Smartphone className="size-4" /> Install App from Chrome
                  </>
                )}
              </Button>

              <Button
                onClick={triggerApkDownload}
                variant="outline"
                size="lg"
                className="font-mono text-sm gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 px-5"
              >
                <Download className="size-4 text-primary" />
                Download APK
              </Button>
            </div>
          </div>

          {/* Features Checklist Grid */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="rounded-xl border border-border/80 bg-background/80 backdrop-blur p-3.5 flex items-start gap-3 shadow-sm">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Zap className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-foreground">Instant Chrome Web APK</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  1-click installation via Google Chrome with native home screen icon.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 backdrop-blur p-3.5 flex items-start gap-3 shadow-sm">
              <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-foreground">Standalone App Launcher</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Launch DSA404 in its own dedicated window without browser tabs.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 backdrop-blur p-3.5 flex items-start gap-3 shadow-sm">
              <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Bell className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-foreground">Native Daily Reminders</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Receive daily study nudges directly on your mobile device or desktop.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChromeInstallModal
        open={showModal}
        onOpenChange={setShowModal}
        onDownloadApk={triggerApkDownload}
      />
    </section>
  );
}
