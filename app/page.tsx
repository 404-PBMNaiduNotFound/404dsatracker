"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeCustomizerPanel } from "./theme-customizer-panel";
import { useThemeCustomizer } from "./theme-customizer-context";
import {
  CalendarDays,
  ListTodo,
  BarChart3,
  CalendarRange,
  LayoutGrid,
  BookmarkCheck,
  Settings,
  Sparkles,
  Cloud,
  RefreshCw,
  Trophy,
  Code2,
  Palette,
  ShieldAlert,
  ExternalLink,
  Mail,
  MessageSquare,
} from "lucide-react";
import { CORE_SECTIONS } from "@/lib/master-problems";
import { ALL_PROBLEMS } from "@/lib/problems";
import { seedDays, TOTAL_PROBLEMS } from "@/lib/plan";

/* ─── real, derived homepage stats (single source of truth) ─── */
const REAL_SECTIONS_COUNT = CORE_SECTIONS.length; // 42
const REAL_TOTAL_PROBLEMS = TOTAL_PROBLEMS; // 338
const REAL_ALL_PROBLEMS_COUNT = ALL_PROBLEMS.length; // 904 (338 Core 404 + 566 DSA 500 Practice)
const REAL_EXTRA_PROBLEMS_COUNT = REAL_ALL_PROBLEMS_COUNT - REAL_TOTAL_PROBLEMS; // 566
const REAL_DAY_1 = seedDays()[0];
const REAL_DAY_1_DIFFICULTY_COUNTS = REAL_DAY_1.problems.reduce((acc, p) => {
  acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);
const REAL_DAY_1_EST_MIN = REAL_DAY_1.problems.reduce((a, p) => a + p.estTime, 0);
function platformCounts(sheet: "Core 404" | "DSA 500 Practice", platform: string) {
  return ALL_PROBLEMS.filter((p) => p.sheet === sheet && p.platform === platform).length;
}
const REAL_LC_CORE = platformCounts("Core 404", "LeetCode");
const REAL_LC_EXTRA = platformCounts("DSA 500 Practice", "LeetCode");
const REAL_GFG_CORE = platformCounts("Core 404", "GFG");
const REAL_GFG_EXTRA = platformCounts("DSA 500 Practice", "GFG");
const REAL_HR_EXTRA = platformCounts("DSA 500 Practice", "HackerRank");

/* ─── animation hook ─────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute("data-visible", "true");
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

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
          el!.textContent = Math.round(eased * target).toString();
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

/* ═══════════════════════════════════════════════════════════
   LANDING HEADER NAV — auth-aware
═══════════════════════════════════════════════════════════ */
function LandingHeaderNav() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) return null; // loading — show nothing to avoid flash

  if (user) {
    // Logged-in user
    return (
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="font-mono text-xs hidden sm:inline-flex">
          <Link href="/today">Go to App</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-xs"
          onClick={async () => {
            await signOut(auth);
            router.refresh();
          }}
        >
          Log out
        </Button>
      </div>
    );
  }

  // Not logged in
  return (
    <div className="flex items-center gap-3">
      <Button asChild variant="ghost" size="sm" className="font-mono text-xs hidden sm:inline-flex">
        <Link href="/auth">Sign In</Link>
      </Button>
      <Button asChild size="sm" className="font-mono text-xs">
        <Link href="/auth">Start</Link>
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* subtle grid bg */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4">
        <div className="mb-8 flex flex-col items-start gap-4">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="size-16 sm:size-20 rounded-full overflow-hidden shadow-2xl border-2 sm:border-4 border-background/50 ring-2 ring-primary/20 bg-background">
              <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
            </div>
            <div className="font-display font-black tracking-tighter text-[48px] sm:text-[64px] leading-none flex items-baseline select-none">
              <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-md">DSA</span>
              <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-md ml-[2px]">⁴⁰⁴</span>
            </div>
          </div>
        {/* DSA 404 Motto Badge */}
        <div className="mt-4 mb-2 inline-flex flex-col rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3 text-left backdrop-blur-md shadow-md">
          <span className="font-mono text-xs sm:text-sm font-black tracking-wider text-primary uppercase">
            DSA 404
          </span>
          <div className="mt-1.5 font-mono text-xs sm:text-sm font-semibold text-foreground/90 space-y-0.5">
            <p><span className="text-muted-foreground">Problem not found?</span> <span className="text-primary font-bold">Find it.</span></p>
            <p><span className="text-muted-foreground">Problem found?</span> <span className="text-amber-400 font-bold">Solve it.</span></p>
            <p><span className="text-muted-foreground">Problem solved?</span> <span className="text-emerald-400 font-bold">Master it.</span></p>
          </div>
        </div>
        </div>

        <h1 className="hero-headline font-display text-4xl font-bold tracking-tight sm:text-6xl leading-tight max-w-3xl">
          Track DSA your way.<br />
          <span className="text-primary">Set your pace, stay consistent.</span>
        </h1>

        <p className="hero-sub mt-6 max-w-2xl text-base text-muted-foreground leading-relaxed">
          A daily problem checklist built from the Core 404 DSA roadmap — tuned to fit <em>your</em> life.
          Pick how many Easy, Medium and Hard problems you want each day. The plan builds itself around that number,
          and you can raise or lower it any time from Settings — the remaining problems instantly redistribute.
          Every day has a topic, difficulty-tagged problems, a 12-step checklist, and an AI explainer.
          Life happens — postpone, skip, or insert revision days and the entire plan rebalances automatically.
        </p>

        <div className="hero-cta mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button asChild size="lg" className="font-mono w-full sm:w-auto justify-center text-center">
            <Link href="/auth?next=/today">
              Start your DSA plan
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-mono w-full sm:w-auto justify-center text-center">
            <a href="#explore">See how it works</a>
          </Button>
        </div>

        {/* Terminal window */}
        <div className="hero-terminal mt-14 max-w-lg rounded-xl border border-border bg-card shadow-lg overflow-hidden">
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
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATS BAR
═══════════════════════════════════════════════════════════ */
function StatsBar() {
  const c474 = useCountUp(REAL_TOTAL_PROBLEMS);
  const c18 = useCountUp(REAL_SECTIONS_COUNT);
  const c775 = useCountUp(REAL_ALL_PROBLEMS_COUNT);
  const c5 = useCountUp(2);
  const c2 = useCountUp(2);

  const stats = [
    {
      ref: c474,
      value: REAL_TOTAL_PROBLEMS,
      label: "Problems",
      sub: "From the Core 404 DSA roadmap",
      prefix: "",
      icon: Code2,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/10",
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
      ref: c775,
      value: REAL_ALL_PROBLEMS_COUNT,
      label: "Problems across platforms",
      sub: "LeetCode · GFG · HackerRank",
      prefix: "",
      icon: BarChart3,
      iconColor: "text-cyan-600 dark:text-cyan-400",
      iconBg: "bg-cyan-500/10",
    },
    {
      ref: c5,
      value: 2,
      label: "Curated sheets + contests",
      sub: "Core 404 · DSA 500 Practice · CP rounds",
      prefix: "",
      icon: Trophy,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10",
    },
    {
      ref: c2,
      value: 2,
      label: "AI & search built in",
      sub: "ChatGPT explain · Google search",
      prefix: "",
      icon: Sparkles,
      iconColor: "text-green-600 dark:text-green-400",
      iconBg: "bg-green-500/10",
    },
  ];

  return (
    <div className="border-y border-border bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl bg-card border border-border p-4">
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOW IT WORKS
═══════════════════════════════════════════════════════════ */
function HowItWorks() {
  const ref = useReveal();
  const steps = [
    {
      icon: CalendarDays,
      title: "Sign up & get your plan",
      body: "Sign up and pick a unique username — that's your shareable public profile URL. The moment you're in, your personalized schedule is generated from the Core 404 DSA roadmap. All 338 problems are distributed across 42 topics in study order, starting from the day you join.",
      step: "01",
    },
    {
      icon: ListTodo,
      title: "Work day by day",
      body: "Every day shows you: the topic, all problems with difficulty tags, a 12-step study checklist (Watch video → Submit → Push to GitHub), your personal notes, and an AI explainer for that day's patterns.",
      step: "02",
    },
    {
      icon: BarChart3,
      title: "Track, adapt, finish",
      body: "Set your daily problem count in Settings — Easy, Medium and Hard separately. Raise it when you're on a roll, lower it when life is busy. The remaining problems instantly redistribute, so your finish date always stays realistic.",
      step: "03",
    },
  ];

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          How your personalised plan works
        </h2>

        <div
          ref={ref}
          className="mt-12 grid gap-6 sm:grid-cols-3 how-steps"
        >
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="step-card relative rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <span className="font-mono text-5xl font-bold text-primary/10 absolute top-4 right-4 leading-none select-none">
                  {s.step}
                </span>
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="font-display text-base font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE EXPLORER — horizontal clickable cards, one detail panel
   (replaces the old "What's New" strip + the long feature list,
   so the homepage stays short and every detail lives one tap away)
═══════════════════════════════════════════════════════════ */

function WeekMock() {
  return (
    <div className="mt-4 space-y-3 font-mono text-xs">
      {[
        { week: "Week 2", done: 18, total: 28, days: ["Mon ✓", "Tue ✓", "Wed →"] },
        { week: "Week 3", done: 4, total: 30, days: ["Mon ✓", "Tue ⬜", "Wed ⬜"] },
      ].map((w) => (
        <div key={w.week} className="rounded-lg border border-border bg-muted p-3">
          <div className="flex justify-between mb-1">
            <span className="font-semibold text-foreground">{w.week}</span>
            <span className="text-muted-foreground">{w.done}/{w.total} problems</span>
          </div>
          <Progress value={(w.done / w.total) * 100} className="h-1.5 mb-2" />
          <div className="flex gap-2">
            {w.days.map((d) => (
              <span key={d} className="rounded px-2 py-0.5 bg-card border border-border text-muted-foreground text-[10px]">
                {d}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressMock() {
  return (
    <div className="mt-4 font-mono text-xs">
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { v: "42", l: "problems done", c: "text-primary" },
          { v: "8🔥", l: "day streak", c: "text-orange-500" },
          { v: "67%", l: "Easy", c: "text-green-500" },
          { v: "4 Nov", l: "projected finish", c: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-muted p-2.5 text-center">
            <p className={`font-bold text-lg ${s.c}`}>{s.v}</p>
            <p className="text-muted-foreground text-[10px]">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-muted-foreground mb-2">Problems / week</p>
        <div className="flex items-end gap-1.5 h-12">
          {[30, 55, 40, 70, 60, 80, 65].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-primary/40" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BacklogMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      {["Day 9 · Sorting", "Day 11 · Arrays"].map((d) => (
        <div key={d} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
          <span className="text-foreground">{d}</span>
          <span className="rounded px-1.5 py-0.5 bg-red-500/15 text-red-500 text-[10px]">Past due</span>
        </div>
      ))}
      <button className="w-full rounded-lg border border-primary/30 bg-primary/5 text-primary py-2 text-[10px] mt-1">
        + Insert a Revision Day
      </button>
    </div>
  );
}

function TopicMock() {
  const sections = [
    { name: "Arrays", done: 23, total: 40 },
    { name: "Binary Search", done: 12, total: 28 },
    { name: "Linked Lists", done: 0, total: 31 },
  ];
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      {sections.map((s) => (
        <div key={s.name} className="rounded-lg border border-border bg-muted p-2.5">
          <div className="flex justify-between mb-1">
            <span className="font-semibold text-foreground">{s.name}</span>
            <span className="text-muted-foreground">{s.done}/{s.total}</span>
          </div>
          <Progress value={(s.done / s.total) * 100} className="h-1" />
        </div>
      ))}
    </div>
  );
}

function ReviewMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px]">
            <span>🔔</span>
            <span>Topic Reminder: Dynamic Programming</span>
          </div>
          <span className="text-[9px] rounded-full bg-primary/20 text-primary px-1.5 py-0.5">Today · 19:00</span>
        </div>
        <p className="text-[10px] text-muted-foreground italic mb-1 shrink-0">"Revise Hard DP problems & 0/1 Knapsack pattern"</p>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="text-green-500 font-semibold">✓ Browser Alert</span>
          <span>·</span>
          <span className="text-blue-400 font-semibold">✓ Email Sent</span>
        </div>
      </div>
      {[
        { day: "Day 7 · Recursion", prob: "Subsets with Duplicates" },
        { day: "Day 12 · Arrays", prob: "Trapping Rain Water" },
      ].map((r) => (
        <div key={r.prob} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5">
          <p className="text-yellow-500/80 text-[10px] mb-0.5">{r.day}</p>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">🔖</span>
            <span className="text-foreground">{r.prob}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContestMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      {[
        { platform: "LeetCode", title: "Weekly Contest 513", time: "Today · 08:00 IST", dur: "90 min", live: true },
        { platform: "Codeforces", title: "CF Round 1113 (Div. 2)", time: "Today · 20:05 IST", dur: "150 min", live: false },
        { platform: "CodeChef", title: "Starters 250", time: "Aug 5 · 20:00 IST", dur: "120 min", live: false },
      ].map((c) => (
        <div key={c.title} className="rounded-lg border border-border bg-muted p-2.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-muted-foreground">{c.platform}</span>
            {c.live ? (
              <span className="text-[9px] rounded-full bg-green-500/15 text-green-500 px-1.5 py-0.5 font-semibold">● LIVE</span>
            ) : (
              <span className="text-[9px] text-blue-400 font-medium">✉ 30m Email Alert</span>
            )}
          </div>
          <p className="text-foreground font-semibold truncate">{c.title}</p>
          <div className="flex gap-3 mt-1 text-muted-foreground text-[10px]">
            <span>🕐 {c.time}</span>
            <span>⏱ {c.dur}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProblemsMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      <div className="grid grid-cols-2 gap-2 mb-1">
        {[
          { label: "Total", val: String(REAL_ALL_PROBLEMS_COUNT), color: "text-primary" },
          { label: "Verified links", val: `${REAL_TOTAL_PROBLEMS}+`, color: "text-green-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-muted p-2.5 text-center">
            <p className={`font-bold text-base ${s.color}`}>{s.val}</p>
            <p className="text-muted-foreground text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>
      {[
        { name: "LeetCode", a2z: REAL_LC_CORE, extra: REAL_LC_EXTRA, color: "bg-[#FFA116]" },
        { name: "GeeksforGeeks", a2z: REAL_GFG_CORE, extra: REAL_GFG_EXTRA, color: "bg-[#2F8D46]" },
        { name: "HackerRank", a2z: 0, extra: REAL_HR_EXTRA, color: "bg-[#1BA94C]" },
      ].map((p) => (
        <div key={p.name} className="rounded-lg border border-border bg-muted p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`size-2 rounded-full ${p.color}`} />
            <span className="text-foreground font-semibold">{p.name}</span>
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>A2Z: <span className="text-foreground">{p.a2z}</span></span>
            <span>Extra sheets: <span className="text-foreground">{p.extra}</span></span>
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-border bg-muted p-2 text-[10px] text-muted-foreground">
        Sheets: Core 404 Roadmap · DSA 500 Practice Set
      </div>
    </div>
  );
}

function ProfileMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      <div className="relative rounded-lg border border-border bg-muted overflow-hidden">
        <div className="h-10 bg-gradient-to-r from-primary/40 via-purple-500/30 to-blue-500/40 p-2 flex justify-between items-start">
          <span className="text-[9px] text-primary-foreground/90 font-bold uppercase tracking-wider">Custom Banner</span>
        </div>
        <div className="p-2.5 -mt-5 flex items-end justify-between">
          <div className="flex items-end gap-2">
            <div className="size-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center border-2 border-background text-xs">
              DSA
            </div>
            <div>
              <p className="text-foreground font-bold text-xs">Alex Turner</p>
              <p className="text-[10px] text-muted-foreground">/profile/alex-turner</p>
            </div>
          </div>
          <span className="text-[9px] rounded bg-primary/15 text-primary px-1.5 py-0.5 font-semibold">Share Profile</span>
        </div>
      </div>
    </div>
  );
}

function HeatmapMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      <div className="rounded-lg border border-border bg-muted p-2.5">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>Submission Heatmap</span>
          <span className="text-green-500 font-bold">142 submissions this year</span>
        </div>
        <div className="grid grid-cols-12 gap-1">
          {[2, 4, 1, 0, 3, 5, 2, 4, 1, 3, 0, 5, 2, 3, 4, 1, 5, 2, 0, 3, 4, 2, 5, 1].map((lvl, i) => (
            <div
              key={i}
              className={`h-3 rounded-sm ${lvl === 0
                ? "bg-muted-foreground/10"
                : lvl === 1
                  ? "bg-green-500/30"
                  : lvl === 2
                    ? "bg-green-500/50"
                    : lvl === 3
                      ? "bg-green-500/75"
                      : "bg-green-500"
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsMock() {
  return (
    <div className="mt-4 font-mono text-xs space-y-2">
      <div className="rounded-lg border border-border bg-muted p-2.5">
        <p className="text-muted-foreground mb-2">Daily pace</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "55%" }} />
          </div>
          <span className="text-foreground">~4 problems</span>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted p-2.5 flex items-center justify-between">
        <span className="text-foreground">Email & Browser Reminders</span>
        <div className="w-8 h-4 rounded-full bg-primary relative">
          <div className="absolute right-0.5 top-0.5 size-3 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

// Each entry = one page of the app. "new" bullets (folded in from the old
// What's New strip) are tagged so they get a small "New" chip in the list.
const EXPLORER_PAGES = [
  {
    key: "today",
    icon: ListTodo,
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    title: "Today's Workspace",
    tagline: "Your daily command centre",
    bullets: [
      { text: 'See today\'s topic and section, e.g. "Binary Search › BS on 1D Arrays"' },
      { text: "Check off each problem — Easy (15 min), Medium (30 min), Hard (45 min) estimates shown" },
      { text: "12-step checklist: Watch video → Brute force → Optimise → Code → Submit → Push to GitHub" },
      { text: "Write personal notes that sync to the cloud" },
      { text: "Today's Workspace live & upcoming contests show right here — no tab switching" },
      { text: "One-click ChatGPT explain button, pre-filled for the day's topic" },
      { text: "Google Search button on every problem for instant tutorials" },
      { text: "Global Cmd/Ctrl+K search jumps to any problem, page, or setting instantly", isNew: true },
      { text: "New resizable desktop sidebar and swipeable mobile drawer", isNew: true },
    ],
    mock: null,
  },
  {
    key: "week",
    icon: CalendarRange,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "Week View",
    tagline: "Your weeks roadmap at a glance",
    bullets: [
      { text: "See all days grouped into weeks" },
      { text: "Each week shows a progress bar: X / Y problems done" },
      { text: "Jump directly into any day by clicking its card" },
      { text: "Skip future days you know you'll miss — schedule adjusts cleanly" },
      { text: "Colour-coded statuses: pending / in progress / completed / postponed / merged / revision / skipped" },
    ],
    mock: <WeekMock />,
  },
  {
    key: "progress",
    icon: BarChart3,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    title: "Progress",
    tagline: "Stats that tell the truth",
    bullets: [
      { text: "Overall completion: X / 338 problems done" },
      { text: "Current streak and longest streak" },
      { text: "Difficulty split: Easy / Medium / Hard breakdown" },
      { text: "Weekly solved-problems trend, shown as a bar chart" },
      { text: "Badges earned and a full event log with timestamps" },
    ],
    mock: <ProgressMock />,
  },
  {
    key: "backlog",
    icon: CalendarDays,
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
    title: "Backlog",
    tagline: "Nothing falls through the cracks",
    bullets: [
      { text: "Shows every past day you haven't fully completed" },
      { text: 'One-click "Insert a Revision Day" schedules extra catch-up time' },
      { text: "Schedule ripples forward automatically — no days are lost" },
      { text: "Backlog clears itself as you catch up" },
    ],
    mock: <BacklogMock />,
  },
  {
    key: "topics",
    icon: LayoutGrid,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    title: "Topic View",
    tagline: "All 42 topics at once",
    bullets: [
      { text: "Accordion of all 42 Core 404 topics in study order" },
      { text: "Each section shows X / Y problems done with a mini progress bar" },
      { text: "Expand any section to see all its study days and jump in" },
      { text: "Skip a whole section or a single topic — schedule adjusts" },
      { text: "Restore skipped sections any time" },
    ],
    mock: <TopicMock />,
  },
  {
    key: "review",
    icon: BookmarkCheck,
    color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    title: "Review",
    tagline: "Bookmarks & topic reminders",
    bullets: [
      { text: "Bookmark any problem in Today's Workspace with one tap" },
      { text: "Set custom date & time reminders to revise specific DSA topics" },
      { text: "Real-time browser notifications and email alerts at the scheduled time" },
      { text: "All bookmarks appear here, sorted by day" },
    ],
    mock: <ReviewMock />,
  },
  {
    key: "contests",
    icon: Trophy,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    title: "Contests",
    tagline: "Never miss a CP round",
    bullets: [
      { text: "Live, upcoming, and missed contests from LeetCode, Codeforces, CodeChef, HackerRank, HackerEarth & ICPC" },
      { text: "Automatic 30-minute email reminder before any contest starts" },
      { text: "Sorted by start time — live contests float to the top with a green indicator" },
      { text: "Duration shown for every contest so you can plan around it" },
      { text: "A mini contest strip on Today's Workspace keeps live & upcoming rounds one glance away" },
    ],
    mock: <ContestMock />,
  },
  {
    key: "problems",
    icon: Code2,
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    title: "Problems",
    tagline: `${REAL_ALL_PROBLEMS_COUNT}+ problems, 2 curated sets`,
    bullets: [
      { text: `${REAL_TOTAL_PROBLEMS} Core 404 problems + ${REAL_EXTRA_PROBLEMS_COUNT} DSA 500 practice problems, one searchable table` },
      { text: `GeeksforGeeks: ${REAL_GFG_CORE} core + ${REAL_GFG_EXTRA} extra · LeetCode: ${REAL_LC_CORE} core + ${REAL_LC_EXTRA} extra · HackerRank: ${REAL_HR_EXTRA} extra` },
      { text: "Filter by platform, difficulty, or sheet, with fast paginated results", isNew: true },
      { text: "Sheets: Core 404 Roadmap · DSA 500 Practice Set" },
      { text: "Verified direct links — every Core 404 problem carries a confirmed link" },
      { text: "Mark problems done and track completions across both sheets independently" },
    ],
    mock: <ProblemsMock />,
  },
  {
    key: "profile",
    icon: Trophy,
    color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    title: "Profile",
    tagline: "Your public link & badges",
    bullets: [
      { text: "Customisable profile with your avatar and a premium cover banner" },
      { text: "Pick a unique username at signup — instantly your shareable public URL", isNew: true },
      { text: "Shareable public URL (e.g. /profile/alex-turner) to show off to recruiters" },
      { text: "Add your own custom links — Codeforces, GitHub, and more — to your public profile", isNew: true },
      { text: "Earn and display gamified achievement badges as you progress" },
    ],
    mock: <ProfileMock />,
  },
  {
    key: "heatmap",
    icon: Sparkles,
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    title: "Heatmap",
    tagline: "Verify your work is real",
    bullets: [
      { text: "GitHub/LeetCode-style submission heatmap (12-month on desktop, 3-month on mobile)" },
      { text: "Paste your code or submission link to mark a problem as done" },
      { text: "No fake checkmarks — a heatmap that keeps an honest record" },
    ],
    mock: <HeatmapMock />,
  },
  {
    key: "settings",
    icon: Settings,
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    title: "Settings",
    tagline: "Your plan, your pace",
    bullets: [
      { text: "Account: update name, change password, link Google account" },
      { text: "Daily pace: adjust problems/day — end date auto-updates" },
      { text: "Reminders: set daily reminder time, manage email/browser notifications" },
      { text: "Schedule shift: move all remaining days forward by N days" },
      { text: "Pause the plan and resume later — no days lost" },
      { text: "Theme: Dark/Light/System, plus a full colour palette and font customizer, with a Desktop-layout toggle", isNew: true },
    ],
    mock: <SettingsMock />,
  },
];

function PageExplorer() {
  const ref = useReveal();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  return (
    <section id="explore" className="py-20 sm:py-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs text-primary font-mono">
          <Sparkles className="size-3" />
          Flip a card, see the page
        </div>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">Peek inside before you sign up</h2>
        <p className="mt-2 text-muted-foreground">
          Eleven features, eleven cards. Flip one open and see it working — no tour, no guesswork, just the real thing.
        </p>

        {/* horizontal, scrollable row of flip-cards */}
        <div
          ref={ref}
          className="explorer-row explorer-scrollbar mt-8 flex items-start gap-4 overflow-x-auto overflow-y-visible pt-7 pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory"
        >
          {EXPLORER_PAGES.map((p, i) => {
            const Icon = p.icon;
            const isActive = p.key === activeKey;
            return (
              <div
                key={p.key}
                className={`flip-card snap-start shrink-0 transition-all duration-500 ease-out
                  ${isActive ? "w-[240px] sm:w-[260px] h-[380px] sm:h-[400px]" : "w-[150px] sm:w-[162px] h-[168px]"}`}
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setActiveKey(isActive ? null : p.key)}
                  aria-pressed={isActive}
                  aria-label={`${isActive ? "Close" : "Open"} ${p.title} details`}
                  className={`flip-card-inner explorer-card w-full h-full text-left ${isActive ? "is-flipped" : ""}`}
                >
                  {/* FRONT FACE */}
                  <div className="flip-face flip-front rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:-translate-y-1 hover:shadow-sm transition-all duration-300">
                    <div className={`inline-flex size-9 items-center justify-center rounded-lg ${p.color} mb-3`}>
                      <Icon className="size-4" />
                    </div>
                    <p className="font-display text-sm font-semibold text-foreground">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{p.tagline}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-mono text-primary/70">
                      flip card ↻
                    </span>
                  </div>

                  {/* BACK FACE */}
                  <div className="flip-face flip-back rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/10 to-card p-4 shadow-lg shadow-primary/10 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`inline-flex size-8 items-center justify-center rounded-lg ${p.color}`}>
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold leading-tight text-foreground">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">{p.tagline}</p>
                      </div>
                      <span className="ml-auto text-[9px] font-mono text-primary/70">✕ close</span>
                    </div>
                    <ul className="space-y-1.5">
                      {p.bullets.map((b) => (
                        <li key={b.text} className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
                          <span className="text-primary mt-0.5 shrink-0">›</span>
                          <span>
                            {b.text}
                            {b.isNew && (
                              <span className="ml-1.5 align-middle rounded-full bg-primary/15 text-primary text-[8px] font-mono font-semibold px-1 py-0.5">
                                New
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI SECTION — Integrations: YouTube, ChatGPT, Google
═══════════════════════════════════════════════════════════ */
function AISection() {
  const ref = useReveal();
  return (
    <section className="py-20 sm:py-24 relative overflow-hidden border-t border-border">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-4">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs text-primary font-mono mb-4">
            <Sparkles className="size-3" />
            Built-in Integrations
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Every tool you need, one click away
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Each problem on the Today tab and Problems page comes with direct links to YouTube, ChatGPT, and Google — no copy-pasting, no switching tabs manually.
          </p>
        </div>
        <div ref={ref} className="ai-col grid gap-6 sm:grid-cols-3">
          {/* YouTube Card */}
          <div className="rounded-2xl border border-red-500/20 bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
              <svg className="size-5 text-red-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <h3 className="font-display text-base font-semibold mb-2 text-foreground">YouTube</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Every problem has a YouTube button that searches for video solutions — brute force, optimal approach, and full walkthroughs from top DSA creators.
            </p>
            <ul className="space-y-1.5">
              {[
                "Searches by problem name + DSA keywords",
                "Finds TUF, NeetCode, and more",
                "Available on Today tab and Problems page",
              ].map((b) => (
                <li key={b} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-red-500 mt-0.5 shrink-0">›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-500">
              ▶ Two Sum — brute force optimal explained
            </div>
          </div>

          {/* ChatGPT Card */}
          <div className="rounded-2xl border border-green-500/20 bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
              <Sparkles className="size-5 text-green-500" />
            </div>
            <h3 className="font-display text-base font-semibold mb-2 text-foreground">ChatGPT</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              One click opens ChatGPT with a detailed prompt pre-filled — asking for brute force, better approach, optimal solution, TC, SC, and intuition for that exact problem.
            </p>
            <ul className="space-y-1.5">
              {[
                "Prompt covers brute, better & optimal",
                "Includes TC, SC and intuition",
                "Works on every problem in the app",
              ].map((b) => (
                <li key={b} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-green-500 mt-0.5 shrink-0">›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 font-mono text-[10px] text-green-600 dark:text-green-400">
              ✦ Explain "Two Sum": brute force → optimal, TC & SC...
            </div>
          </div>

          {/* Google Card */}
          <div className="rounded-2xl border border-blue-500/20 bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
              <svg className="size-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <h3 className="font-display text-base font-semibold mb-2 text-foreground">Google Search</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              A targeted Google search opens instantly — pre-queried with the problem name, LeetCode, GeeksforGeeks, TakeUForward, and YouTube to surface the best editorials and tutorials.
            </p>
            <ul className="space-y-1.5">
              {[
                "Finds editorials, articles, and videos",
                "Pre-built query — no typing needed",
                "Available on every problem row",
              ].map((b) => (
                <li key={b} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-blue-500 mt-0.5 shrink-0">›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 font-mono text-[10px] text-blue-500">
              🔍 Two Sum DSA LeetCode TUF GeeksforGeeks...
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLOUD & SCHEDULE
═══════════════════════════════════════════════════════════ */
function CloudAndSchedule() {
  const ref = useReveal();
  return (
    <section className="py-20 sm:py-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-4">
        <div ref={ref} className="grid gap-8 sm:grid-cols-2 cloud-cols">
          {[
            {
              icon: Cloud,
              heading: "Progress follows you everywhere",
              body: "Sign in with email or Google. Every tick, note, and schedule change is written to Firestore in real time. Open the app on your phone during a commute and pick up exactly where your laptop left off.",
            },
            {
              icon: RefreshCw,
              heading: "Life happens. The plan adapts.",
              body: "Postpone a day → it moves to tomorrow. Skip a day → it's removed cleanly. Insert a revision day → everything shifts right. The overall structure always stays intact — you just keep moving forward.",
            },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={c.heading}
                className="cloud-col rounded-xl border border-border bg-card p-7 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{c.heading}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   BADGES
═══════════════════════════════════════════════════════════ */
function BadgesSection() {
  const ref = useReveal();
  const badges = [
    { label: "🔥 3-Day Streak", earned: true },
    { label: "🔥 7-Day Streak", earned: true },
    { label: "🔥 30-Day Streak", earned: false },
    { label: "✅ First 10", earned: true },
    { label: "✅ First 50", earned: false },
    { label: "💯 100 Problems", earned: false },
    { label: "🏁 Halfway There", earned: false },
    { label: "🏆 Sheet Complete", earned: false },
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="font-display text-3xl font-bold tracking-tight">Earn badges as you go</h2>
        <p className="mt-2 text-sm text-muted-foreground">Small wins add up across your personalized plan.</p>

        <div ref={ref} className="mt-8 flex flex-wrap gap-3 badges-row">
          {badges.map((b, i) => (
            <div
              key={b.label}
              className={`badge-chip rounded-full border px-4 py-2 text-sm font-mono transition-all
                ${b.earned
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "opacity-40 grayscale bg-muted border-border text-muted-foreground"
                }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {b.label}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground font-mono">
          Showing example progress — earned badges glow, unearned ones fade until you hit the milestone.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FINAL CTA
═══════════════════════════════════════════════════════════ */
function FinalCTA() {
  const ref = useReveal();
  return (
    <section className="py-24 border-t border-border">
      <div ref={ref} className="mx-auto max-w-5xl px-4 text-center cta-inner">
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
          Ready to build your DSA habit?
        </h2>
        <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
          Set your pace, pick your start date, and get a personalised plan instantly. Adjust any time — no pressure, no fixed deadline.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3">
          <Button asChild size="lg" className="font-mono text-base px-6 w-full sm:w-auto justify-center text-center">
            <Link href="/auth?next=/today">
              Start the plan — it's free
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-mono w-full sm:w-auto justify-center text-center">
            <Link href="/today">Open my tracker</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground font-mono">
          ✓ Free forever&nbsp; · &nbsp;✓ Syncs across devices&nbsp; · &nbsp;✓ Built on the Core 404 DSA roadmap
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FLOATING THEME FAB
═══════════════════════════════════════════════════════════ */
function LandingThemeFAB() {
  const { openPanel } = useThemeCustomizer();
  return (
    <button
      onClick={openPanel}
      title="Customize Theme"
      aria-label="Customize Theme"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all duration-150"
      style={{ boxShadow: "0 4px 24px oklch(0 0 0 / 0.18)" }}
    >
      <Palette className="size-4 shrink-0" />
      <span>Customize</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   CREDITS & DISCLAIMER FOOTER SECTION
═══════════════════════════════════════════════════════════ */
function CreditsAndDisclaimer() {
  return (
    <footer className="border-t border-border bg-card/40 py-12 px-4 sm:px-6 lg:px-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Contact Details Card */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8 shadow-sm backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Mail className="size-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
              Contact &amp; Support
            </h3>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Have questions, feedback, bug reports, or feature requests? Feel free to reach out directly.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-sm">
                <Mail className="size-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-mono">Direct Email</span>
                  <a
                    href="mailto:bhanupolimera.6@gmail.com"
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    404dsatracker@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-sm">
                <MessageSquare className="size-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-mono">Developer</span>
                  <span className="font-medium text-foreground">Bhanu Prakash</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Credits & Disclaimer Card */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8 shadow-sm backdrop-blur-sm space-y-6">
          {/* Section Header */}
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
              Credits &amp; Learning Resources
            </h3>
          </div>

          {/* Main Description */}
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              DSA⁴⁰⁴ is an independent learning and progress-tracking platform designed to help students stay consistent with Data Structures &amp; Algorithms preparation.
            </p>
            <p>
              The problem roadmaps available on this website, including publicly available DSA learning sheets and roadmaps, are used only as learning references to organize daily practice schedules, topic-wise tracking, progress visualization, and revision planning.
            </p>
            <p>
              This platform does not claim ownership of these roadmaps or their educational content. All credit belongs to their respective authors and communities.
            </p>
          </div>

          {/* Redirection Notice */}
          <div className="rounded-xl border border-border/40 bg-muted/40 p-4 space-y-2 text-xs sm:text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">
              For every problem, users are redirected to the original learning resources whenever available:
            </p>
            <ul className="space-y-1.5 pl-2">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><strong className="text-foreground">YouTube button</strong> → Original creator's video</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><strong className="text-foreground">Solve button</strong> → Original coding platform (LeetCode, GeeksforGeeks, CodeStudio, HackerRank, etc.)</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            DSA⁴⁰⁴ does not host or reproduce original articles, videos, or solution explanations. It simply provides an organized interface for planning daily practice, tracking progress, maintaining streaks, scheduling revisions, and managing interview preparation.
          </p>

          {/* Useful Links */}
          <div className="pt-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
              Useful Links
            </h4>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 text-sm">
              <a
                href="https://github.com/404-PBMNaiduNotFound/tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-background/50 px-3.5 py-2 text-xs font-mono font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all sm:w-auto"
              >
                <span>GitHub Repository</span>
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
              <a
                href="https://dsa404.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-background/50 px-3.5 py-2 text-xs font-mono font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all sm:w-auto"
              >
                <span>Live Website</span>
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
            </div>
          </div>

          {/* Legal Disclaimer Note */}
          <div className="pt-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground/80 leading-relaxed italic">
              "All trademarks, logos, problem sheets, educational content, and external resources belong to their respective owners. This project is an independent educational tracker created for learning purposes and is not affiliated with or endorsed by LeetCode, GeeksforGeeks, HackerRank, CodeStudio, or any other organization."
            </p>
          </div>
        </div>

        {/* Footer Bottom / Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 text-center sm:text-left text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} DSA⁴⁰⁴. All rights reserved.</p>
          <p className="flex items-center gap-1 font-medium">
            Made with <span className="text-red-500 animate-pulse">❤️</span> for the DSA Community.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   FAQ SECTION
═══════════════════════════════════════════════════════════ */
function FAQSection() {
  const ref = useReveal();

  const faqs = [
    {
      q: "Why did my remaining problems redistribute but my completed days stay the same?",
      a: "Your completed days and notes are preserved as your permanent history. When you change your Daily Problem Pace or miss days, the platform only redistributes the remaining problems forward to keep your schedule realistic without altering your past achievements."
    },
    {
      q: "How do I combine two study days if I have extra time to study?",
      a: "You can click the 'Merge Tomorrow' button on your current day's view. This absorbs tomorrow's topics and problems into today's list, allowing you to advance your plan seamlessly without breaking the sequence."
    },
    {
      q: "What is the exact difference between Skipping a day and Postponing a day?",
      a: "Skipping a day removes it entirely from your schedule, moving all future days forward by one. Postponing pushes a specific day to a new date, shifting your entire calendar back while keeping the sequence intact."
    },
    {
      q: "How does the system help me revise topics I completed weeks ago?",
      a: "You can insert a 'Revision Day' at any time. The platform will automatically select 6 problems from your previously completed topics using spaced repetition principles and create a dedicated recap day without disrupting your main plan."
    },
    {
      q: "I checked off a problem, why does it still show as incomplete in my progress?",
      a: "To fully mark a problem as completed, you must use the 'Submit' button to paste your solution code. This ensures you maintain a reviewable record of your approaches and maintains the integrity of your progress tracking."
    },
    {
      q: "Why aren't my browser push notifications working reliably on my phone?",
      a: "Browser push notifications require specific OS permissions and often need the web app to be open or installed as a PWA. For reliable offline alerts, we highly recommend enabling Email Notifications in your Settings instead."
    }
  ];

  return (
    <section className="py-20 sm:py-24 border-t border-border bg-muted/10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Answers to the most complex and advanced features of the platform.
          </p>
        </div>

        <div ref={ref} className="space-y-4 ai-col">
          {faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between font-display text-base font-semibold outline-none">
                <span className="pr-4 text-foreground/90">{faq.q}</span>
                <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  <span className="absolute h-[2px] w-4 bg-current transition-transform duration-300 group-open:rotate-180" />
                  <span className="absolute h-4 w-[2px] bg-current transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
                </span>
              </summary>
              <div className="mt-4 text-sm text-muted-foreground leading-relaxed animate-in slide-in-from-top-2 fade-in-50 duration-300">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════ */
export default function Home() {

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes heroText {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .terminal-cursor {
          animation: blink 1s step-end infinite;
        }

        /* hero animations */
        .hero-headline {
          animation: heroText 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        .hero-sub {
          animation: heroText 0.6s 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }
        .hero-cta {
          animation: heroText 0.6s 0.45s cubic-bezier(0.16,1,0.3,1) both;
        }
        .hero-terminal {
          animation: heroText 0.7s 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }

        /* scroll-reveal: children animate when parent gets data-visible */
        [data-visible="true"] .step-card {
          animation: slideInLeft 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        [data-visible="true"] .ai-col {
          animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        [data-visible="true"] .cloud-col {
          animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        [data-visible="true"] .badge-chip {
          animation: slideInRight 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        [data-visible="true"] .cta-inner {
          animation: fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        [data-visible="true"] .explorer-row {
          animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .explorer-detail {
          animation: fadeInUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }

        /* 3D flip cards in the page explorer */
        .flip-card {
          perspective: 1400px;
        }
        .flip-card-inner {
          position: relative;
          display: block;
          transform-style: preserve-3d;
          transition: transform 0.65s cubic-bezier(0.34, 1.28, 0.4, 1);
        }
        .flip-card-inner.is-flipped {
          transform: rotateY(180deg);
        }
        .flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flip-front {
          transform: rotateY(0deg);
        }
        .flip-back {
          transform: rotateY(180deg);
        }
        @media (prefers-reduced-motion: reduce) {
          .flip-card-inner { transition: none; }
        }
        .explorer-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: var(--primary) color-mix(in oklch, var(--border) 60%, transparent);
        }
        .explorer-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .explorer-scrollbar::-webkit-scrollbar-track {
          background: color-mix(in oklch, var(--border) 60%, transparent);
          border-radius: 999px;
          margin: 0 4px;
        }
        .explorer-scrollbar::-webkit-scrollbar-thumb {
          background: color-mix(in oklch, var(--primary) 55%, transparent);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .explorer-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
          background-clip: content-box;
        }

        [data-visible="true"] .flip-card {
          animation: fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground">
        {/* Landing Page Branded Header */}
        <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="font-display font-black tracking-tighter text-[24px] leading-none flex items-baseline select-none">
                <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-sm">DSA</span>
                <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-sm ml-[1px]">⁴⁰⁴</span>
              </div>
            </div>
            <LandingHeaderNav />
          </div>
        </header>

        <main>
          <HeroSection />
          <StatsBar />
          <HowItWorks />
          <PageExplorer />
          <AISection />
          <CloudAndSchedule />
          <BadgesSection />
          <FAQSection />
          <FinalCTA />
        </main>
        <CreditsAndDisclaimer />

        {/* Floating Theme Customizer Button */}
        <LandingThemeFAB />
        <ThemeCustomizerPanel />
      </div>
    </>
  );
}