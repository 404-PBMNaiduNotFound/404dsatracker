"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Monitor, CheckCircle2, ArrowRight, Share } from "lucide-react";

interface ChromeInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadApk: () => void;
}

export function ChromeInstallModal({
  open,
  onOpenChange,
  onDownloadApk,
}: ChromeInstallModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-2xl p-6 bg-card border-border shadow-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Download className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-display">
                Install DSA404 via Chrome / Download APK
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Get native app performance, homescreen icon &amp; fast launching.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 text-sm">
          {/* Quick Direct Download Button */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="font-semibold text-xs text-primary flex items-center gap-1.5 justify-center sm:justify-start">
                <Smartphone className="size-3.5" /> Direct Chrome Web APK Download
              </p>
              <p className="text-[11px] text-muted-foreground">
                Download the standalone app package directly to your device.
              </p>
            </div>
            <Button
              onClick={() => {
                onDownloadApk();
                onOpenChange(false);
              }}
              size="sm"
              className="font-mono text-xs gap-1.5 shrink-0 w-full sm:w-auto"
            >
              <Download className="size-3.5" /> Download APK
            </Button>
          </div>

          {/* Chrome Mobile Guide */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-primary" /> Chrome on Android (Web APK)
            </h4>
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                <p>Tap the <strong>Chrome Menu (⋮)</strong> icon in the top-right corner.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                <p>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                <p>Tap <strong>Install</strong>. Chrome automatically builds and installs the Web APK.</p>
              </div>
            </div>
          </div>

          {/* Chrome Desktop Guide */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Monitor className="size-3.5 text-primary" /> Chrome on Desktop / Laptop
            </h4>
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                <p>Click the <strong>Install icon (⊕)</strong> on the right side of the address bar.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                <p>Or click <strong>Menu (⋮) &rarr; Save and Share &rarr; Install DSA404...</strong></p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="font-mono text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
