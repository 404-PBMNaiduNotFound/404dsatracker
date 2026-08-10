"use client";

import React, { useState, useEffect } from "react";
import {
  Palette, X, RotateCcw, ChevronDown, ChevronUp,
  Sun, Moon, Type, Monitor, Smartphone,
} from "lucide-react";
import {
  useThemeCustomizer, PRESETS,
  type ColorMode, type ThemeColors,
} from "./theme-customizer-context";

// ─── Font options ──────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: "Inter (Default)", value: "'Inter', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Outfit", value: "'Outfit', sans-serif" },
  { label: "DM Sans", value: "'DM Sans', sans-serif" },
  { label: "Geist", value: "'Geist', sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Fira Code (Mono)", value: "'Fira Code', monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
];

const SIZE_OPTIONS = [
  { label: "XS (12px)", value: "12px" },
  { label: "SM (13px)", value: "13px" },
  { label: "MD (14px — Default)", value: "14px" },
  { label: "LG (15px)", value: "15px" },
  { label: "XL (16px)", value: "16px" },
  { label: "2XL (18px)", value: "18px" },
];

const FONT_STORAGE_KEY = "dsa-tracker-font";
const SIZE_STORAGE_KEY = "dsa-tracker-font-size";
const VIEW_STORAGE_KEY = "dsa-tracker-force-view";

type ForceView = "auto" | "desktop" | "mobile";

// ─── Color labels ──────────────────────────────────────────────────────────────

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  background: "Background",
  foreground: "Text",
  primary: "Accent / Brand",
  card: "Card Surface",
  muted: "Muted / Hover",
  border: "Border",
};
const COLOR_KEYS = Object.keys(COLOR_LABELS) as (keyof ThemeColors)[];

// ─── Components ────────────────────────────────────────────────────────────────

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <label className="relative cursor-pointer shrink-0">
        <span className="block w-7 h-7 rounded-md border border-border shadow-sm" style={{ background: value }} />
        <input type="color" value={value} aria-label={`${label} color picker`}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
      </label>
      <span className="text-sm text-foreground/80 flex-1 truncate">{label}</span>
      <span className="text-xs font-mono text-muted-foreground">{value}</span>
    </div>
  );
}

function SectionHeader({
  label, expanded, onToggle, icon,
}: { label: string; expanded: boolean; onToggle: () => void; icon: React.ReactNode }) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 text-sm font-medium hover:bg-muted/70 transition-colors"
      onClick={onToggle}
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      {expanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
    </button>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function ThemeCustomizerPanel() {
  const { colors, activePreset, applyPreset, updateColor, resetToDefault, panelOpen, closePanel } = useThemeCustomizer();
  const [advancedMode, setAdvancedMode] = useState<ColorMode | null>(null);
  const [fontOpen, setFontOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0].value);
  const [selectedSize, setSelectedSize] = useState("14px");
  const [forceView, setForceView] = useState<ForceView>("auto");

  // Load persisted font + size + view on mount
  useEffect(() => {
    try {
      const f = localStorage.getItem(FONT_STORAGE_KEY);
      const s = localStorage.getItem(SIZE_STORAGE_KEY);
      const v = localStorage.getItem(VIEW_STORAGE_KEY) as ForceView | null;
      if (f) { setSelectedFont(f); applyFont(f); }
      if (s) { setSelectedSize(s); applySize(s); }
      if (v) { setForceView(v); applyViewMode(v); }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFont(font: string) {
    document.documentElement.style.setProperty("--font-sans", font);
    // Also inject a Google Fonts link if not already there
    const name = font.split("'")[1];
    if (name && name !== "Inter" && name !== "Geist") {
      const id = `gf-${name.replace(/\s/g, "")}`;
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;500;600;700;900&display=swap`;
        document.head.appendChild(link);
      }
    }
    document.documentElement.style.fontFamily = font;
  }

  function applySize(size: string) {
    document.documentElement.style.fontSize = size;
  }

  function applyViewMode(mode: ForceView) {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (mode === "desktop") {
      if (meta) meta.content = "width=1280";
    } else if (mode === "mobile") {
      if (meta) meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
    } else {
      if (meta) meta.content = "width=device-width, initial-scale=1";
    }
  }

  function handleFont(font: string) {
    setSelectedFont(font);
    applyFont(font);
    try { localStorage.setItem(FONT_STORAGE_KEY, font); } catch {}
  }

  function handleSize(size: string) {
    setSelectedSize(size);
    applySize(size);
    try { localStorage.setItem(SIZE_STORAGE_KEY, size); } catch {}
  }

  function handleView(mode: ForceView) {
    setForceView(mode);
    applyViewMode(mode);
    try { localStorage.setItem(VIEW_STORAGE_KEY, mode); } catch {}
  }

  function handleReset() {
    resetToDefault();
    handleFont(FONT_OPTIONS[0].value);
    handleSize("14px");
    handleView("auto");
  }

  return (
    <>
      {/* Backdrop */}
      {panelOpen && <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={closePanel} />}

      {/* Panel */}
      <div
        className={`fixed bottom-0 right-0 z-50 w-full sm:w-[360px] max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:bottom-6 sm:right-6 bg-card border border-border shadow-2xl transition-all duration-300 ease-out ${
          panelOpen
            ? "opacity-100 translate-y-0 sm:scale-100"
            : "opacity-0 translate-y-full sm:translate-y-0 sm:scale-95 pointer-events-none"
        }`}
        style={{ boxShadow: "0 8px 48px oklch(0 0 0 / 0.22)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <span className="font-semibold text-sm">Theme & Display</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleReset} title="Reset all" aria-label="Reset all"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RotateCcw className="size-3.5" />
            </button>
            <button onClick={closePanel} title="Close" aria-label="Close panel"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">

          {/* ── Color Presets ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Color Presets</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button key={key} onClick={() => applyPreset(key)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all duration-150 hover:scale-105 active:scale-95 ${
                    activePreset === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="flex gap-0.5 mb-0.5">
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: preset.colors.light.background }} />
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: preset.colors.light.primary }} />
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: preset.colors.dark.background }} />
                  </div>
                  <span className="text-[10px] text-center leading-tight">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── Fine-tune colors ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Fine-tune Colors</p>
            <div className="rounded-xl border border-border overflow-hidden mb-2">
              <SectionHeader
                label="Light Mode Colors" expanded={advancedMode === "light"}
                onToggle={() => setAdvancedMode(advancedMode === "light" ? null : "light")}
                icon={<Sun className="size-3.5 text-amber-500" />}
              />
              {advancedMode === "light" && (
                <div className="px-3 py-3 space-y-3">
                  {COLOR_KEYS.map((key) => (
                    <ColorRow key={key} label={COLOR_LABELS[key]} value={colors.light[key]}
                      onChange={(v) => updateColor("light", key, v)} />
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <SectionHeader
                label="Dark Mode Colors" expanded={advancedMode === "dark"}
                onToggle={() => setAdvancedMode(advancedMode === "dark" ? null : "dark")}
                icon={<Moon className="size-3.5 text-indigo-400" />}
              />
              {advancedMode === "dark" && (
                <div className="px-3 py-3 space-y-3">
                  {COLOR_KEYS.map((key) => (
                    <ColorRow key={key} label={COLOR_LABELS[key]} value={colors.dark[key]}
                      onChange={(v) => updateColor("dark", key, v)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── Font & Size ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Typography</p>
            <div className="rounded-xl border border-border overflow-hidden mb-2">
              <SectionHeader
                label="Font Family" expanded={fontOpen}
                onToggle={() => setFontOpen((v) => !v)}
                icon={<Type className="size-3.5 text-primary" />}
              />
              {fontOpen && (
                <div className="px-3 py-3 space-y-1.5">
                  {FONT_OPTIONS.map((f) => (
                    <button key={f.value} onClick={() => handleFont(f.value)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
                        selectedFont === f.value
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted"
                      }`}
                      style={{ fontFamily: f.value }}
                    >
                      <span>{f.label}</span>
                      {selectedFont === f.value && <span className="size-2 rounded-full bg-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Font Size */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2.5 bg-muted/40 flex items-center gap-2 text-sm font-medium">
                <Type className="size-3.5 text-primary" />
                <span>Display Size</span>
              </div>
              <div className="px-3 py-3 grid grid-cols-2 gap-2">
                {SIZE_OPTIONS.map((s) => (
                  <button key={s.value} onClick={() => handleSize(s.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
                      selectedSize === s.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/50"
                    }`}
                    style={{ fontSize: s.value }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── View Mode ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">View Mode</p>
            <div className="rounded-xl border border-border overflow-hidden">
              <SectionHeader
                label="Force Layout" expanded={viewOpen}
                onToggle={() => setViewOpen((v) => !v)}
                icon={<Monitor className="size-3.5 text-primary" />}
              />
              {viewOpen && (
                <div className="px-3 py-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      { mode: "auto" as ForceView, label: "Auto", icon: <Monitor className="size-4" /> },
                      { mode: "desktop" as ForceView, label: "Desktop", icon: <Monitor className="size-4" /> },
                      { mode: "mobile" as ForceView, label: "Mobile", icon: <Smartphone className="size-4" /> },
                    ] as const
                  ).map(({ mode, label, icon }) => (
                    <button key={mode} onClick={() => handleView(mode)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
                        forceView === mode
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:border-primary/50"
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              "Desktop" forces a 1280px viewport width on mobile browsers.
            </p>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            All settings are saved to your browser automatically.
          </p>
        </div>
      </div>
    </>
  );
}
