"use client";

/**
 * DemoShell — a fully static, fake-data preview of the interior app.
 *
 * IMPORTANT: This component is intentionally self-contained. It does NOT
 * import any real hooks (usePlan, useSettings, useAuth, Firestore, etc.)
 * and does NOT touch any of the real authenticated pages under
 * app/(authenticated)/*. It only *looks* like the real interior so a
 * signed-out visitor can understand what the product does before they
 * register. Nothing here reads or writes the database.
 */

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Code2,
  LayoutGrid,
  CalendarRange,
  Flame,
  BookmarkCheck,
  CalendarDays,
  Trophy,
  UserCircle2,
  Settings,
  Menu,
  X,
  CheckCircle2,
  Circle,
  Bookmark,
  ExternalLink,
  Bell,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SubmissionHeatmap } from "@/components/SubmissionHeatmap";

const DEMO_NAV = [
  { key: "today", label: "Today's Workspace", icon: Sparkles },
  { key: "problems", label: "Problems", icon: Code2 },
  { key: "topics", label: "Topic View", icon: LayoutGrid },
  { key: "weeks", label: "Week View", icon: CalendarRange },
  { key: "progress", label: "Progress", icon: Flame },
  { key: "review", label: "Review", icon: BookmarkCheck },
  { key: "backlog", label: "Backlog", icon: CalendarDays },
  { key: "contests", label: "Contests", icon: Trophy },
  { key: "profile", label: "Developer Profile", icon: UserCircle2 },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

type DemoTab = (typeof DEMO_NAV)[number]["key"];

/* ── fake data (display-only, never persisted) ───────────────────────── */
const FAKE_USER = {
  name: "Aditi Sharma",
  initials: "AS",
  streak: 14,
  day: 23,
  totalDays: 119,
  solved: 187,
  total: 904,
};

const FAKE_TODAY_PROBLEMS = [
  { title: "Reverse Linked List", difficulty: "Easy", done: true, platform: "LeetCode" },
  { title: "Detect Cycle in Linked List", difficulty: "Easy", done: true, platform: "LeetCode" },
  { title: "Merge Two Sorted Lists", difficulty: "Easy", done: false, platform: "GFG" },
  { title: "Add Two Numbers (Linked List)", difficulty: "Medium", done: false, platform: "LeetCode" },
  { title: "Flatten a Multilevel DLL", difficulty: "Hard", done: false, platform: "LeetCode" },
];

const FAKE_TOPICS = [
  { name: "Arrays", solved: 22, total: 24 },
  { name: "Binary Search", solved: 14, total: 18 },
  { name: "Linked List", solved: 9, total: 20 },
  { name: "Stacks & Queues", solved: 6, total: 16 },
  { name: "Trees", solved: 3, total: 28 },
  { name: "Graphs", solved: 0, total: 22 },
];

const FAKE_WEEKS = Array.from({ length: 8 }, (_, i) => ({
  week: i + 1,
  status: i < 3 ? "done" : i === 3 ? "active" : "upcoming",
}));

const FAKE_REVIEW = [
  { title: "Kth Largest Element", day: 12, note: "Revisit heap approach" },
  { title: "LRU Cache", day: 19, note: "Re-derive doubly linked list + map" },
  { title: "Word Break", day: 21, note: "DP transition unclear" },
];

const FAKE_BACKLOG = [
  { day: 15, missed: 2 },
  { day: 18, missed: 1 },
];

const FAKE_CONTESTS = [
  { name: "LeetCode Weekly 421", platform: "LeetCode", time: "Sun · 8:00 AM", status: "upcoming" },
  { name: "Codeforces Div 3 #967", platform: "Codeforces", time: "Fri · 8:00 PM", status: "upcoming" },
  { name: "CodeChef Starters 155", platform: "CodeChef", time: "Wed · 8:00 PM", status: "live" },
];

function DifficultyBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    Hard: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  };
  return <Badge variant="outline" className={cn("font-mono text-[10px]", styles[level])}>{level}</Badge>;
}

function DemoCTA({ label = "Sign up free to save this" }: { label?: string }) {
  return (
    <Link
      href="/auth"
      className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline"
    >
      <Lock className="size-3" /> {label}
    </Link>
  );
}

/* ── panels ────────────────────────────────────────────────────────── */

function TodayPanel() {
  const { heatmapData, detailMap } = React.useMemo(() => {
    const data: { date: string; solved: number }[] = [];
    const detailMap: Record<string, any[]> = {};
    const today = new Date();

    for (let i = 180; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      
      const rand = Math.sin(i * 3.7 + 1.2) * 10000;
      const pseudoRandom = Math.abs(rand - Math.floor(rand));
      
      let solved = 0;
      if (pseudoRandom > 0.45) {
        solved = Math.floor(pseudoRandom * 4) + 1;
      }

      if (solved > 0) {
        data.push({ date: dateStr, solved });
        detailMap[dateStr] = Array.from({ length: solved }, (_, idx) => ({
          name: idx === 0 ? "Reverse Linked List" : idx === 1 ? "Middle of Linked List" : idx === 2 ? "Merge Two Sorted Lists" : "Linked List Cycle",
          done: true,
          platform: idx % 2 === 0 ? "LeetCode" : "GeeksforGeeks",
        }));
      }
    }
    return { heatmapData: data, detailMap };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-mono text-muted-foreground">Day {FAKE_USER.day} of {FAKE_USER.totalDays} · Linked List</p>
            <h3 className="font-display text-lg font-bold">Today's Topic: Linked List Basics</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-mono text-orange-600">
            <Flame className="size-3.5" /> {FAKE_USER.streak}-day streak
          </div>
        </div>
        <div className="space-y-2">
          {FAKE_TODAY_PROBLEMS.map((p) => (
            <div key={p.title} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {p.done ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn("text-sm truncate", p.done && "line-through text-muted-foreground")}>{p.title}</span>
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground">{p.platform}</span>
              </div>
              <DifficultyBadge level={p.difficulty} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h4 className="font-display font-semibold mb-3 text-sm">Solved Days Activity Heatmap</h4>
        <SubmissionHeatmap data={heatmapData} detailMap={detailMap} />
      </div>
    </div>
  );
}

function ProblemsPanel() {
  const platforms = ["All", "LeetCode", "GFG", "CodeChef", "HackerRank"];
  const [active, setActive] = useState("All");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono border transition-colors",
              active === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {FAKE_TODAY_PROBLEMS.concat([
          { title: "Course Schedule (Topo Sort)", difficulty: "Medium", done: false, platform: "LeetCode" },
          { title: "Number of Islands", difficulty: "Medium", done: true, platform: "LeetCode" },
        ]).map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {p.done ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <Circle className="size-4 text-muted-foreground shrink-0" />}
              <span className="text-sm truncate">{p.title}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">{p.platform}</span>
              <DifficultyBadge level={p.difficulty} />
              <Bookmark className="size-3.5 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Showing a small sample — the real Problems tab has 904 problems across two curated sheets. <DemoCTA label="Register to unlock the full set" /></p>
    </div>
  );
}

function TopicsPanel() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {FAKE_TOPICS.map((t) => (
        <div key={t.name} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-semibold text-sm">{t.name}</span>
            <span className="text-xs font-mono text-muted-foreground">{t.solved}/{t.total}</span>
          </div>
          <Progress value={(t.solved / t.total) * 100} className="h-2" />
        </div>
      ))}
    </div>
  );
}

function WeeksPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {FAKE_WEEKS.map((w) => (
          <div
            key={w.week}
            className={cn(
              "aspect-square rounded-xl border flex flex-col items-center justify-center text-xs font-mono",
              w.status === "done" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
              w.status === "active" && "bg-primary/10 border-primary/40 text-primary",
              w.status === "upcoming" && "bg-muted/40 border-border text-muted-foreground"
            )}
          >
            <span className="font-bold">W{w.week}</span>
            <span className="text-[10px]">{w.status}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">The real Week View spans your full 17-week roadmap with per-day drill-down.</p>
    </div>
  );
}

function ProgressPanel() {
  const pct = Math.round((FAKE_USER.solved / FAKE_USER.total) * 100);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display font-semibold text-sm">Overall progress</span>
          <span className="text-xs font-mono text-muted-foreground">{FAKE_USER.solved}/{FAKE_USER.total}</span>
        </div>
        <Progress value={pct} className="h-2.5" />
        <p className="mt-2 text-xs text-muted-foreground">{pct}% complete · sample data</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Current streak", value: `${FAKE_USER.streak} days` },
          { label: "Longest streak", value: "31 days" },
          { label: "Badges earned", value: "6" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-display font-black">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel() {
  return (
    <div className="space-y-3">
      {FAKE_REVIEW.map((r) => (
        <div key={r.title} className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{r.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Day {r.day} · {r.note}</p>
          </div>
          <Bookmark className="size-4 text-primary shrink-0" />
        </div>
      ))}
    </div>
  );
}

function BacklogPanel() {
  return (
    <div className="space-y-3">
      {FAKE_BACKLOG.map((b) => (
        <div key={b.day} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Day {b.day}</p>
            <p className="text-xs text-muted-foreground">{b.missed} problem{b.missed > 1 ? "s" : ""} left unfinished</p>
          </div>
          <Button size="sm" variant="outline" className="font-mono text-xs" disabled>
            Insert revision day
          </Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Backlog auto-tracks any day you didn't fully complete, so nothing slips through.</p>
    </div>
  );
}

function ContestsPanel() {
  return (
    <div className="space-y-3">
      {FAKE_CONTESTS.map((c) => (
        <div key={c.name} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.platform} · {c.time}</p>
          </div>
          <Badge variant={c.status === "live" ? "default" : "outline"} className="font-mono text-[10px] shrink-0">
            {c.status === "live" ? "LIVE" : "Upcoming"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function ProfilePanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <div className="mx-auto size-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xl font-display font-bold text-primary mb-3">
        {FAKE_USER.initials}
      </div>
      <p className="font-display font-bold">{FAKE_USER.name}</p>
      <p className="text-xs text-muted-foreground mt-1">@aditi.codes · Joined this preparation 23 days ago</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["LeetCode", "Codeforces", "GitHub", "LinkedIn"].map((p) => (
          <span key={p} className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-border text-muted-foreground">{p}</span>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Public profiles get a shareable URL once you register. <DemoCTA label="Claim your username" /></p>
    </div>
  );
}

function SettingsPanel() {
  const rows = [
    { label: "Daily problem pace", value: "5 problems/day" },
    { label: "Start date", value: "1 Aug 2026" },
    { label: "Email reminders", value: "Enabled" },
    { label: "Theme", value: "System default" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">{r.label}</span>
          <span className="text-sm font-mono">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const PANELS: Record<DemoTab, () => React.ReactElement> = {
  today: TodayPanel,
  problems: ProblemsPanel,
  topics: TopicsPanel,
  weeks: WeeksPanel,
  progress: ProgressPanel,
  review: ReviewPanel,
  backlog: BacklogPanel,
  contests: ContestsPanel,
  profile: ProfilePanel,
  settings: SettingsPanel,
};

/* ── shell ─────────────────────────────────────────────────────────── */

export function DemoShell() {
  const [tab, setTab] = useState<DemoTab>("today");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ActivePanel = PANELS[tab];
  const activeMeta = DEMO_NAV.find((n) => n.key === tab)!;

  return (
    <div className="relative rounded-2xl border border-border bg-background/60 overflow-hidden shadow-lg">
      {/* preview banner */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-2.5">
        <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 truncate">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span className="truncate">Live preview with sample data — test drive any tab below</span>
        </p>
        <Button asChild size="sm" className="font-mono text-xs shrink-0">
          <Link href="/auth">Sign up free</Link>
        </Button>
      </div>

      {/* mobile horizontal scrollable tab strip */}
      <div className="md:hidden border-b border-border bg-card/80 backdrop-blur px-3 py-2.5 overflow-x-auto flex items-center gap-2 scrollbar-none shrink-0">
        {DEMO_NAV.map((n) => {
          const Icon = n.icon;
          const isActive = n.key === tab;
          return (
            <button
              key={n.key}
              onClick={() => {
                setTab(n.key);
                setMobileNavOpen(false);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-3.5" />
              <span>{n.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex">
        {/* desktop sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card/60 p-3 gap-1">
          {DEMO_NAV.map((n) => {
            const Icon = n.icon;
            const isActive = n.key === tab;
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors",
                  isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </button>
            );
          })}
        </aside>

        {/* content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Preview</p>
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <activeMeta.icon className="size-4 text-primary" />
                {activeMeta.label}
              </h3>
            </div>
            <Bell className="size-4 text-muted-foreground hidden sm:block" />
          </div>
          <ActivePanel />
        </main>
      </div>
    </div>
  );
}
