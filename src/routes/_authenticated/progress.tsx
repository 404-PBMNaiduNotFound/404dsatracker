import { createFileRoute } from '@tanstack/react-router'

import { useEffect, useMemo, useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";
import { dayProgress, isDayComplete, todayIso, formatDate } from "@/lib/plan";
import { listEvents } from "@/lib/db";
import { EXTRA_PROBLEMS } from "@/lib/extra-problems-data";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { isToday } from "@/components/ContestsSection";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeBadges,
  currentStreak,
  difficultySplit,
  longestStreak,
  solvedTrend,
  weeklyStats,
} from "@/lib/gamification";
import { useContests } from "@/hooks/useContests";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress — DSA⁴⁰⁴" },
      {
        name: "description",
        content:
          "Overall completion, streaks, per-section stats and the log of every schedule change.",
      },
      { property: "og:title", content: "Progress — DSA⁴⁰⁴" },
      { property: "og:description", content: "Stats and history for your 120-day DSA plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

type EventRow = { id: string; kind: string; detail: string; created_at: string };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ProgressPage() {
  const { days, loading, userId, resetAll } = usePlan();
  const { completed: pbCompleted } = useProblemCompletions();
  const [events, setEvents] = useState<EventRow[]>([]);
  const { contests, loading: contestsLoading } = useContests();

  useEffect(() => {
    if (!userId) return;
    void listEvents(userId).then((rows) => setEvents(rows as EventRow[]));
  }, [userId, days]);

  const stats = useMemo(() => {
    const counted = days.filter((d) => !d.skipped);
    const total = counted.reduce((a, d) => a + dayProgress(d).total, 0);
    const done = counted.reduce((a, d) => a + dayProgress(d).done, 0);
    const completedDays = counted.filter(isDayComplete).length;
    const iso = todayIso();
    let streak = 0;
    for (const d of [...counted].filter((d) => d.date <= iso).reverse()) {
      if (isDayComplete(d)) streak += 1;
      else break;
    }
    const finish = days.length ? days[days.length - 1].date : "";
    // Practice / Extra Problems Tab (566)
    const pbTotal = EXTRA_PROBLEMS.length;
    const pbDone = EXTRA_PROBLEMS.filter((p) => pbCompleted.has(p.name)).length;

    // Combined All Problems (337 Core Plan + 566 Practice Problems = 903 Total)
    const combinedTotal = total + pbTotal;
    const combinedDone = done + pbDone;

    return {
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0,
      completedDays,
      countedDays: counted.length,
      streak,
      finish,
      pbDone,
      pbTotal,
      combinedDone,
      combinedTotal,
      combinedPct: combinedTotal ? Math.round((combinedDone / combinedTotal) * 100) : 0,
    };
  }, [days, pbCompleted]);

  const sections = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    days
      .filter((d) => !d.skipped)
      .forEach((d) => {
        const cur = map.get(d.section) ?? { done: 0, total: 0 };
        const p = dayProgress(d);
        map.set(d.section, { done: cur.done + p.done, total: cur.total + p.total });
      });
    return [...map.entries()];
  }, [days]);

  const streaks = useMemo(
    () => ({ current: currentStreak(days), longest: longestStreak(days) }),
    [days],
  );
  const week = useMemo(() => weeklyStats(days), [days]);
  const trend = useMemo(() => {
    const pbDoneTotal = EXTRA_PROBLEMS.filter((p) => pbCompleted.has(p.name)).length;
    const pbTotalCount = EXTRA_PROBLEMS.length;
    return solvedTrend(days).map((row) => ({
      ...row,
      pbCompleted: pbDoneTotal,
      pbTotal: pbTotalCount,
    }));
  }, [days, pbCompleted]);
  const split = useMemo(() => {
    // Start from plan-days split
    const base = difficultySplit(days);
    // Add problems-tab completions on top (from EXTRA_PROBLEMS only)
    const pbByDiff: Record<string, { done: number; remaining: number }> = {};
    EXTRA_PROBLEMS.forEach((p) => {
      if (!pbByDiff[p.difficulty]) pbByDiff[p.difficulty] = { done: 0, remaining: 0 };
      if (pbCompleted.has(p.name)) pbByDiff[p.difficulty].done += 1;
      else pbByDiff[p.difficulty].remaining += 1;
    });
    return base.map((row) => ({
      difficulty: row.difficulty,
      done: row.done + (pbByDiff[row.difficulty]?.done ?? 0),
      remaining: row.remaining + (pbByDiff[row.difficulty]?.remaining ?? 0),
    }));
  }, [days, pbCompleted]);
  const badges = useMemo(() => computeBadges(days), [days]);
  const earned = badges.filter((b) => b.earned);

  // Contest stats
  const contestsAttended = useMemo(
    () => contests.filter((c) => c.mark === "attended").length,
    [contests],
  );

  // Today's contests: live now OR starting/ending today (system date)
  const todayContests = useMemo(() => {
    return contests.filter((c) => {
      if (c.status === "live") return true;
      const endMs = c.startMs + c.durationMs;
      return isToday(c.startMs) || isToday(endMs);
    });
  }, [contests]);

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Progress</h1>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display font-semibold">Overall (Plan + Problems tab)</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {stats.combinedDone}/{stats.combinedTotal} problems · {stats.combinedPct}%
          </span>
        </div>
        <Progress value={stats.combinedPct} className="h-2" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Core Plan (Today) Solved" value={`${stats.done}/${stats.total}`} />
        <Stat label="Problems Tab Solved" value={`${stats.pbDone}/${stats.pbTotal}`} />
        <Stat label="Total Problems Left" value={String(stats.combinedTotal - stats.combinedDone)} />
        <Stat label="Days Completed" value={`${stats.completedDays}/${stats.countedDays}`} />
      </div>

      {/* Upgrade 4 — weekly snapshot + charts */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="This week solved" value={String(week.problemsSolved + stats.pbDone)} />
        <Stat label="Time invested (7d)" value={`${Math.round(week.minutesSpent / 60)}h`} />
        <Stat label="Active days (7d)" value={`${week.daysActive}/7`} />
        <Stat label="Longest streak" value={`${streaks.longest} days`} />
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Solving trend</h2>
      <div className="mb-8 h-64 rounded-xl border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="solvedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="pbFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <RTooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-popover-foreground)",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                if (name === "Plan solved") return [`${value} problems`, "Plan (day)"];
                if (name === "Problems tab") return [`${value} / ${trend[0]?.pbTotal ?? 0} total`, "Problems tab (all-time)"];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="solved"
              name="Plan solved"
              stroke="var(--color-primary)"
              fill="url(#solvedFill)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="pbCompleted"
              name="Problems tab"
              stroke="#22c55e"
              fill="url(#pbFill)"
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Difficulty split</h2>
      <div className="mb-8 h-64 rounded-xl border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={split} margin={{ left: -20, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="difficulty" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <RTooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-popover-foreground)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="done" name="Done" stackId="a" fill="var(--color-success)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="remaining" name="Remaining" stackId="a" fill="var(--color-muted)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">
        Badges <span className="text-sm font-normal text-muted-foreground">({earned.length}/{badges.length})</span>
      </h2>
      <ul className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((b, i) => (
          <li
            key={b.code}
            style={{ "--i": i } as React.CSSProperties}
            className={
              b.earned
                ? "stagger-item rounded-lg border border-primary/40 bg-primary/10 p-3"
                : "stagger-item rounded-lg border border-border bg-card p-3 opacity-60"
            }
          >
            <p className="text-sm font-semibold">{b.label}</p>
            <p className="text-xs text-muted-foreground">{b.description}</p>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 font-display text-lg font-semibold">By section</h2>
      <div className="mb-8 space-y-3">
        {sections.map(([section, s]) => (
          <div key={section} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{section}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {s.done}/{s.total}
              </span>
            </div>
            <Progress
              value={s.total ? Math.round((s.done / s.total) * 100) : 0}
              className="h-1.5"
            />
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Today's Contests</h2>
      {contestsLoading ? (
        <p className="mb-8 text-sm text-muted-foreground">Loading contests…</p>
      ) : todayContests.length === 0 ? (
        <p className="mb-8 text-sm text-muted-foreground">No contests live or scheduled for today.</p>
      ) : (
        <ul className="mb-8 space-y-2">
          {todayContests.map((c) => {
            const isLive = c.status === "live";
            const startLabel = isLive
              ? "Live now"
              : new Date(c.startMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const durationH = Math.floor(c.durationMs / 3600000);
            const durationM = Math.round((c.durationMs % 3600000) / 60000);
            const durationLabel = durationH > 0
              ? `${durationH}h${durationM > 0 ? ` ${durationM}m` : ""}`
              : `${durationM}m`;
            return (
              <li
                key={c.id}
                className={`rounded-lg border p-3 text-sm ${
                  isLive
                    ? "border-green-500/40 bg-green-500/8"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/20 px-1.5 py-0.5 text-xs font-medium text-green-600">
                        <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {c.platform}
                    </span>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{startLabel}</span>
                    <span>{durationLabel}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-3 font-display text-lg font-semibold">Schedule history</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedule changes yet.</p>
      ) : (
        <ul className="mb-8 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                {e.kind}
              </span>
              {e.detail}
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        title="Reset all progress?"
        description="This regenerates the full 120-day plan from scratch. Every tick, note, AI explainer and chat message is deleted."
        confirmWord="RESET"
        confirmLabel="Reset everything"
        onConfirm={resetAll}
        trigger={<Button variant="outline" className="text-destructive">Reset all progress</Button>}
      />
    </>
  );
}