"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "@/integrations/firebase/client";
import { getCountFromServer, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { QuoteLoader } from "@/components/QuoteLoader";
import { DemoShell } from "@/components/demo/DemoShell";
import { CORE_SECTIONS } from "@/lib/master-problems";
import { ALL_PROBLEMS } from "@/lib/problems";
import { seedDays, TOTAL_PROBLEMS } from "@/lib/plan";
import { getChatGPTAiPromptUrl } from "@/lib/aiTutorPrompt";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Code2,
  LayoutGrid,
  Sparkles,
  Trophy,
  Users,
  Search,
  ExternalLink,
  Zap,
  ArrowRight,
  Bot,
} from "lucide-react";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/* ─── real, derived homepage stats (single source of truth) ─── */
const REAL_SECTIONS_COUNT = CORE_SECTIONS.length; // 42
const REAL_TOTAL_PROBLEMS = TOTAL_PROBLEMS; // 338
const REAL_ALL_PROBLEMS_COUNT = ALL_PROBLEMS.length; // 924
const REAL_PRACTICE_PROBLEMS_COUNT = ALL_PROBLEMS.length - TOTAL_PROBLEMS; // 586
const REAL_DAY_1 = seedDays()[0];
const REAL_DAY_1_DIFFICULTY_COUNTS = REAL_DAY_1.problems.reduce((acc, p) => {
  acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);
const REAL_DAY_1_EST_MIN = REAL_DAY_1.problems.reduce((a, p) => a + p.estTime, 0);

/* ─── count-up hook ──────────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        function tick(now: number) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          if (el) el.textContent = Math.round(eased * target).toString();
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return ref;
}

/* ─── live user count, read from Firestore (users collection count) ─── */
function useLiveUserCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getCountFromServer(collection(db, "users"));
        if (!cancelled) setCount(snap.data().count);
      } catch {
        if (!cancelled) setCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

/* ═══════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative overflow-hidden py-8 sm:py-12">
      {/* subtle grid bg */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Branding, Motto, Headline, Copy, CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start">
            <div className="flex items-center gap-4 sm:gap-5 mb-4">
              <div className="size-14 sm:size-16 rounded-full overflow-hidden shadow-xl border-2 sm:border-4 border-background/50 ring-2 ring-primary/20 bg-background shrink-0">
                <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
              </div>
              <div className="font-display font-black tracking-tighter text-[42px] sm:text-[56px] leading-none flex items-baseline select-none">
                <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-md">DSA</span>
                <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-md ml-[2px]">⁴⁰⁴</span>
              </div>
            </div>

            {/* DSA 404 Motto Badge */}
            <div className="mb-4 inline-flex flex-col rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-left backdrop-blur-md shadow-sm">
              <span className="font-mono text-xs font-black tracking-wider text-primary uppercase">
                DSA 404
              </span>
              <div className="mt-1 font-mono text-xs font-semibold text-foreground/90 space-y-0.5">
                <p><span className="text-muted-foreground">Problem not found?</span> <span className="text-primary font-bold">Find it.</span></p>
                <p><span className="text-muted-foreground">Problem found?</span> <span className="text-amber-400 font-bold">Solve it.</span></p>
                <p><span className="text-muted-foreground">Problem solved?</span> <span className="text-emerald-400 font-bold">Master it.</span></p>
              </div>
            </div>

            <h1 className="hero-headline font-display text-3xl sm:text-5xl font-bold tracking-tight leading-tight max-w-2xl">
              Track DSA your way.<br />
              <span className="text-primary">Set your pace, stay consistent.</span>
            </h1>

            <p className="hero-sub mt-4 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
              A daily problem checklist built from the Core 404 DSA roadmap — tuned to fit <em>your</em> life.
              Pick how many Easy, Medium and Hard problems you want each day. The plan builds itself around that number,
              and you can raise or lower it any time from Settings — the remaining problems instantly redistribute.
              Every day features topic-focused problems, a 12-step checklist, and built-in ChatGPT integration that explains
              problem statements and provides step-by-step logic hints to guide you to the solution—without giving away the code.
              Life happens — postpone, skip, or insert revision days and the entire plan rebalances automatically.
            </p>

            <div className="hero-cta mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Button asChild size="lg" className="font-mono justify-center text-center">
                <Link href="/auth?next=/today">
                  Start your DSA plan
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="font-mono justify-center text-center">
                <a href="#explore">See how it works</a>
              </Button>
            </div>
          </div>

          {/* Right Column: Terminal window */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="hero-terminal w-full max-w-md rounded-xl border border-border bg-card shadow-xl overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-2.5">
                <span className="size-3 rounded-full bg-red-500/70" />
                <span className="size-3 rounded-full bg-yellow-500/70" />
                <span className="size-3 rounded-full bg-green-500/70" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">dsa-tracker — zsh</span>
              </div>
              <div className="p-5 font-mono text-sm leading-7">
                <p className="text-primary">&gt; Loading plan...</p>
                <p>
                  <span className="text-muted-foreground">  Day     </span>
                  <span className="text-foreground font-semibold">Day {REAL_DAY_1.dayNumber}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">  Section </span>
                  <span className="text-foreground">{REAL_DAY_1.section}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">  Topic   </span>
                  <span className="text-foreground">{REAL_DAY_1.topic}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">  Problems</span>
                  <span className="text-foreground"> {REAL_DAY_1.problems.length} </span>
                  <span className="text-green-500 text-xs">
                    ({Object.entries(REAL_DAY_1_DIFFICULTY_COUNTS).map(([d, n]) => `${d} ×${n}`).join(", ")})
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">  Est time</span>
                  <span className="text-foreground"> {Math.floor(REAL_DAY_1_EST_MIN / 60)}h {REAL_DAY_1_EST_MIN % 60}m</span>
                </p>
                <p>
                  <span className="text-muted-foreground">  Status  </span>
                  <span className="text-yellow-400">⬜ pending</span>
                  <span className="terminal-cursor text-primary font-bold"> _</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATS BAR
═══════════════════════════════════════════════════════════ */
function StatsBar() {
  const liveUserCount = useLiveUserCount();
  const c474 = useCountUp(REAL_TOTAL_PROBLEMS);
  const c586 = useCountUp(REAL_PRACTICE_PROBLEMS_COUNT);
  const c18 = useCountUp(REAL_SECTIONS_COUNT);
  const cUsers = useCountUp(liveUserCount ?? 0);
  const c5 = useCountUp(2);
  const c4 = useCountUp(4);

  const stats = [
    ...(liveUserCount !== null
      ? [
          {
            ref: cUsers,
            value: liveUserCount,
            label: "Learners tracking progress",
            sub: "Live count, synced from database",
            prefix: "",
            icon: Users,
            iconColor: "text-rose-600 dark:text-rose-400",
            iconBg: "bg-rose-500/10",
          },
        ]
      : []),
    {
      ref: c474,
      value: REAL_TOTAL_PROBLEMS,
      label: "Core 404 Roadmap",
      sub: "Daily problems covering all key patterns",
      prefix: "",
      icon: Code2,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/10",
    },
    {
      ref: c586,
      value: REAL_PRACTICE_PROBLEMS_COUNT,
      label: "Practice 404 Sheet",
      sub: "Alt practice problems for Core 404",
      prefix: "",
      icon: BarChart3,
      iconColor: "text-cyan-600 dark:text-cyan-400",
      iconBg: "bg-cyan-500/10",
    },
    {
      ref: c18,
      value: REAL_SECTIONS_COUNT,
      label: "Sections",
      sub: "Arrays to graphs & DP",
      prefix: "",
      icon: LayoutGrid,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-500/10",
    },
    {
      ref: c5,
      value: 2,
      label: "Curated sheets + contests",
      sub: "Core 404 · Practice 404 Sheet · CP rounds",
      prefix: "",
      icon: Trophy,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10",
    },
    {
      ref: c4,
      value: 4,
      label: "Built-in Integrations",
      sub: "Solve AI · YouTube · ChatGPT · Google",
      prefix: "",
      icon: Sparkles,
      iconColor: "text-green-600 dark:text-green-400",
      iconBg: "bg-green-500/10",
    },
  ];

  return (
    <div className="my-8 rounded-2xl border border-border bg-muted/30 p-4 sm:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl bg-card border border-border p-4 shadow-sm">
              <div className={`inline-flex size-8 items-center justify-center rounded-lg ${s.iconBg} mb-3`}>
                <Icon className={`size-4 ${s.iconColor}`} />
              </div>
              <p className="font-mono text-3xl font-bold text-foreground tabular-nums">
                {s.prefix}
                <span ref={s.ref}>0</span>
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{s.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BUILT-IN INTEGRATIONS FEATURE WALKTHROUGH
═══════════════════════════════════════════════════════════ */
function BuiltInIntegrationsSection() {
  const [selectedIntegration, setSelectedIntegration] = useState<
    "solve" | "youtube" | "chatgpt" | "google" | null
  >(null);

  const toggleIntegration = (type: "solve" | "youtube" | "chatgpt" | "google") => {
    setSelectedIntegration((prev) => (prev === type ? null : type));
  };

  return (
    <div className="mt-8 sm:mt-12 rounded-2xl sm:rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-4 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-mono font-semibold mb-3 shadow-sm">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span>Built-in Integrations</span>
        </div>
        <h3 className="font-display text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground break-words">
          Every tool you need, one click away
        </h3>
        <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Each problem on the Today tab and Problems page comes with direct links to Socratic AI Tutor, YouTube, ChatGPT, and Google — no copy-pasting, no switching tabs manually.
        </p>
      </div>

      {/* Sample Problem Row showing problem name + all 4 integration buttons */}
      <div className="mb-6 sm:mb-8 rounded-xl sm:rounded-2xl border border-border/80 bg-background/80 p-3.5 sm:p-5 shadow-lg backdrop-blur-md">
        <div className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex flex-wrap items-center justify-between gap-2">
          <span>Live Problem Row Action Bar (Interactive Demo):</span>
          <span className="text-primary font-bold">
            {selectedIntegration ? "Click active button to hide details ↑" : "Click any button below to view details ↓"}
          </span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 rounded-xl border border-border/60 bg-card p-3 sm:p-4 shadow-sm">
          {/* Problem Meta (ID, Name, Badges) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="size-4 rounded border border-primary/50 bg-primary/20 flex items-center justify-center shrink-0">
              <span className="size-1.5 rounded-full bg-primary" />
            </div>
            <span className="font-mono text-xs font-bold text-muted-foreground">#1</span>
            <span className="font-display font-bold text-sm sm:text-base text-foreground">Two Sum</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Core 404</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">Easy</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">LeetCode</span>
          </div>

          {/* All 4 Integration Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => toggleIntegration("youtube")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer select-none",
                selectedIntegration === "youtube"
                  ? "border-red-500/60 bg-red-500/20 text-red-500 ring-2 ring-red-500/30 scale-105"
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              )}
            >
              <YoutubeIcon className="size-3.5 fill-red-500/20 shrink-0" />
              <span>▶ YouTube</span>
            </button>

            <button
              type="button"
              onClick={() => toggleIntegration("chatgpt")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer select-none",
                selectedIntegration === "chatgpt"
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-500 ring-2 ring-emerald-500/30 scale-105"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              )}
            >
              <Bot className="size-3.5 shrink-0" />
              <span>✦ ChatGPT</span>
            </button>

            <button
              type="button"
              onClick={() => toggleIntegration("solve")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer select-none",
                selectedIntegration === "solve"
                  ? "border-amber-500/60 bg-amber-500/20 text-amber-500 ring-2 ring-amber-500/30 scale-105"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              )}
            >
              <Zap className="size-3.5 fill-amber-500/20 shrink-0" />
              <span>⚡ Solve</span>
            </button>

            <button
              type="button"
              onClick={() => toggleIntegration("google")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer select-none",
                selectedIntegration === "google"
                  ? "border-sky-500/60 bg-sky-500/20 text-sky-500 ring-2 ring-sky-500/30 scale-105"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
              )}
            >
              <Search className="size-3.5 shrink-0" />
              <span>🔍 Google</span>
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDED FEATURE WALKTHROUGH CARD BELOW */}
      {selectedIntegration && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden transition-all animate-in fade-in duration-300">
          {selectedIntegration === "solve" && (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Zap className="size-5 fill-amber-500/20" />
                  </div>
                  <div>
                    <h4 className="font-display text-base sm:text-lg font-bold text-foreground">
                      Solve Button Integration (Interactive ChatGPT Socratic AI Tutor)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Redirects to ChatGPT with a pre-loaded Socratic prompt — problem statement & hints ONLY, zero code spoilers
                    </p>
                  </div>
                </div>
                <a
                  href={getChatGPTAiPromptUrl("Two Sum")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-mono font-semibold transition-colors shadow-md w-full sm:w-auto shrink-0"
                >
                  <span>Try Solve (AI Tutor) Demo</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </div>

              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                Clicking the <strong>⚡ Solve</strong> button present on every problem row opens ChatGPT with a pre-filled Socratic tutor prompt. It presents the problem statement and guides you with hints step-by-step — giving zero code spoilers until requested, saving time when you get stuck!
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <ul className="space-y-2 text-xs text-muted-foreground font-medium">
                    <li className="flex items-start gap-2.5">
                      <span className="text-amber-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Shows Problem Statement & Examples First:</strong> Clearly states the problem goal, constraints, input/output formats, and sample test cases.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-amber-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Gives Hints ONLY (NO Code Spoilers):</strong> Strictly refrains from dumping code or final answers, keeping your focus on building real problem-solving logic.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-amber-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Reduces Time Waste When Stuck:</strong> Delivers progressive hints (Hint 1 → Hint 2 → Edge Cases) whenever you hit a wall, so you never get permanently blocked.</span>
                    </li>
                  </ul>

                  <div>
                    <span className="text-xs font-mono text-muted-foreground font-semibold">Live Button Graphic Preview:</span>
                    <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400 flex items-center justify-between gap-2 shadow-sm font-mono text-xs">
                      <span className="font-bold truncate">⚡ Solve with Interactive ChatGPT DSA AI Tutor</span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 sm:p-4 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-amber-500 font-bold uppercase tracking-wider text-[10px]">
                    <span>Socratic Tutor Prompt System:</span>
                    <span>Hints Only</span>
                  </div>
                  <pre className="p-3 rounded-lg bg-background/90 border border-border text-foreground text-[11px] leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto break-words break-all">
{`# DSA AI Editor & Tutor
Problem Name: Two Sum

## STRICT RULE: DO NOT GIVE THE SOLUTION
Your primary goal is to make the user think and discover the solution themselves.
Do NOT provide complete solution code or the optimal algorithm immediately.

# STEP 1 — Introduce the Problem
1. Explain the problem statement & requirements in simple language.
2. Provide input/output formats, constraints, and test case examples.
3. End with: "Now try to think of your own approach. I won't give you the solution directly; I'll guide you with hints."`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {selectedIntegration === "youtube" && (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
                    <YoutubeIcon className="size-5 fill-red-500/20" />
                  </div>
                  <div>
                    <h4 className="font-display text-base sm:text-lg font-bold text-foreground">
                      YouTube Video Solutions & Walkthroughs
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Direct video search tuned for DSA creators, brute force, and optimal approach explanations
                    </p>
                  </div>
                </div>
                <a
                  href="https://www.youtube.com/results?search_query=Two+Sum+solution+intuition+explained+NeetCode+OR+Striver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 text-xs font-mono font-semibold transition-colors shadow-md w-full sm:w-auto shrink-0"
                >
                  <span>Try YouTube Demo</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <ul className="space-y-2 text-xs text-muted-foreground font-medium">
                    <li className="flex items-start gap-2.5">
                      <span className="text-red-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Searches by problem name + DSA keywords:</strong> Automatically constructs exact queries to bypass fluff and find real implementations.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-red-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Finds TUF (Striver), NeetCode, and more:</strong> Prioritizes top-tier competitive programming and DSA educators.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-red-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Available on Today tab and Problems page:</strong> Access video explanations instantly anywhere in the workspace.</span>
                    </li>
                  </ul>
                </div>

                <div className="lg:col-span-6 flex items-center justify-center">
                  <div className="w-full rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center font-mono text-xs space-y-2">
                    <span className="text-muted-foreground font-semibold">Live Button Action Preview:</span>
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-red-500 flex items-center justify-center gap-2 font-bold shadow-sm">
                      <YoutubeIcon className="size-4 shrink-0 fill-red-500/20" />
                      <span className="truncate">▶ Two Sum — brute force optimal explained</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedIntegration === "chatgpt" && (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Bot className="size-5 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-display text-base sm:text-lg font-bold text-foreground">
                      ChatGPT Pre-filled AI Explanation Prompt
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      One click opens ChatGPT with a pre-filled prompt asking for full breakdown, TC & SC
                    </p>
                  </div>
                </div>
                <a
                  href="https://chatgpt.com/?q=Explain%20the%20problem%20%22Two%20Sum%22%20in%20detail.%20Cover%3A%201.%20Problem%20intuition%202.%20Brute%20force%203.%20Better%204.%20Optimal%20solution"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-mono font-semibold transition-colors shadow-md w-full sm:w-auto shrink-0"
                >
                  <span>Try ChatGPT Explain Demo</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <ul className="space-y-2 text-xs text-muted-foreground font-medium">
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Prompt covers brute, better & optimal:</strong> Get a structured breakdown from naive loops to hash maps or two pointers.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Includes TC, SC and intuition:</strong> Rigorous Big-O analysis and spatial complexity for every approach.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Works on every problem in the app:</strong> 1-click prompt generator available across all Core 404 & Practice 404 problems.</span>
                    </li>
                  </ul>
                </div>

                <div className="lg:col-span-6 flex items-center justify-center">
                  <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center font-mono text-xs space-y-2">
                    <span className="text-muted-foreground font-semibold">Live Button Action Preview:</span>
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-500 flex items-center justify-center gap-2 font-bold shadow-sm">
                      <Bot className="size-4 shrink-0" />
                      <span className="truncate">✦ Explain "Two Sum": brute force → optimal, TC & SC...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedIntegration === "google" && (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                    <Search className="size-5 text-sky-500" />
                  </div>
                  <div>
                    <h4 className="font-display text-base sm:text-lg font-bold text-foreground">
                      Google Search — Targeted Multi-Platform Search
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Pre-queried Google search across LeetCode, GeeksforGeeks, TakeUForward & YouTube
                    </p>
                  </div>
                </div>
                <a
                  href="https://www.google.com/search?q=Two+Sum+DSA+solution+explanation+site%3Aleetcode.com+OR+site%3Ageeksforgeeks.org+OR+site%3Atakeuforward.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-mono font-semibold transition-colors shadow-md w-full sm:w-auto shrink-0"
                >
                  <span>Try Google Search Demo</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <ul className="space-y-2 text-xs text-muted-foreground font-medium">
                    <li className="flex items-start gap-2.5">
                      <span className="text-sky-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Finds editorials, articles, and videos:</strong> Aggregates top editorial writeups across all major DSA platforms.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-sky-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Pre-built query — no typing needed:</strong> Saves repetitive typing by scoping queries automatically.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-sky-500 font-bold font-mono text-sm leading-none shrink-0">›</span>
                      <span className="break-words"><strong>Available on every problem row:</strong> Directly integrated into problem cards and rows.</span>
                    </li>
                  </ul>
                </div>

                <div className="lg:col-span-6 flex items-center justify-center">
                  <div className="w-full rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-center font-mono text-xs space-y-2">
                    <span className="text-muted-foreground font-semibold">Live Button Action Preview:</span>
                    <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-sky-500 flex items-center justify-center gap-2 font-bold shadow-sm">
                      <Search className="size-4 shrink-0" />
                      <span className="truncate">🔍 Two Sum DSA LeetCode TUF GeeksforGeeks...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Home ("/") — Logged-in users are bounced straight to /today.
 * Signed-out / new visitors see the hero section, motto badge, zsh terminal card,
 * dynamic stats cards, built-in integrations feature section, and an interactive demo shell.
 */
export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = checking

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        router.replace("/today");
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, [router]);

  // Still checking auth state, or a logged-in user is mid-redirect —
  // avoid flashing the UI in either case.
  if (user === undefined) {
    return <QuoteLoader fullScreen />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full overflow-hidden border border-border/80 shadow-sm ring-1 ring-primary/20 bg-background shrink-0">
              <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
            </div>
            <div className="font-display font-black tracking-tighter text-[22px] leading-none flex items-baseline select-none">
              <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">DSA</span>
              <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent ml-[1px]">⁴⁰⁴</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="font-mono text-xs hidden sm:inline-flex">
              <Link href="/auth">Login</Link>
            </Button>
            <Button asChild size="sm" className="font-mono text-xs">
              <Link href="/auth">Register</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <HeroSection />
        <StatsBar />
        <BuiltInIntegrationsSection />

        <div id="explore" className="mt-14 pt-8 border-t border-border/50">
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs text-primary font-mono mb-3">
              <Sparkles className="size-3" />
              Interactive Demo
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Explore the full workspace with live sample data
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Test drive all 924 problems, 17 weeks of roadmap, daily checklists, and progress tracking below.
            </p>
          </div>

          <DemoShell />
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm text-muted-foreground mb-3">Ready to track your own progress?</p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild size="lg" className="font-mono">
              <Link href="/auth">Create free account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-mono">
              <Link href="/auth">I already have an account</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 mt-12">
        <p className="text-center text-xs text-muted-foreground font-mono">
          DSA⁴⁰⁴ · Built for structured, consistent DSA practice
        </p>
      </footer>
    </div>
  );
}
