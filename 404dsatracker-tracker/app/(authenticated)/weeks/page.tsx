"use client";

import { useMemo, useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { formatDate, todayIso } from "@/lib/plan";
import type { Day } from "@/lib/types";
import { DayCard } from "@/components/DayCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, CalendarDays, LayoutGrid, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewMode = "week" | "month" | "all";

/** Group days into calendar weeks (Mon-Sun boundaries) */
function groupIntoWeeks(days: Day[]): Day[][] {
  const result: Day[][] = [];
  let currentWeek: Day[] = [];
  let currentWeekStart: string | null = null;

  for (const day of days) {
    if (!currentWeekStart) {
      currentWeekStart = day.date;
    }
    const weekIndex = Math.floor(
      (new Date(day.date).getTime() - new Date(currentWeekStart).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
    );
    if (weekIndex > 0 && currentWeek.length > 0) {
      result.push(currentWeek);
      currentWeek = [];
      currentWeekStart = day.date;
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) result.push(currentWeek);
  return result;
}

/** Group days by "YYYY-MM" */
function groupIntoMonths(days: Day[]): Record<string, Day[]> {
  const result: Record<string, Day[]> = {};
  for (const day of days) {
    const month = day.date.slice(0, 7); // e.g. "2026-08"
    if (!result[month]) result[month] = [];
    result[month].push(day);
  }
  return result;
}

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return new Date(`${year}-${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function WeeksPage() {
  const { days, loading, skipTopic } = usePlan();
  const today = todayIso();

  // Skipped days keep a frozen, stale `date` from before they were skipped
  // (renumber() intentionally never updates it — see plan.ts). Grouping them
  // in with active days breaks the week-boundary math below, which assumes
  // days arrive in roughly chronological order. Exclude them here; they get
  // their own dedicated "Skipped" section further down instead.
  const activeDays = useMemo(() => days.filter((d) => !d.skipped), [days]);
  const skippedDays = useMemo(
    () => days.filter((d) => d.skipped).sort((a, b) => a.dayNumber - b.dayNumber),
    [days],
  );

  const weeks = useMemo(() => groupIntoWeeks(activeDays), [activeDays]);
  const monthsMap = useMemo(() => groupIntoMonths(activeDays), [activeDays]);
  const monthKeys = useMemo(() => Object.keys(monthsMap).sort(), [monthsMap]);

  // Find the current week index (the week that contains today)
  const currentWeekIdx = useMemo(() => {
    const idx = weeks.findIndex((week) =>
      week.some((d) => d.date === today),
    );
    return idx >= 0 ? idx : weeks.findIndex((week) => week.some((d) => d.date >= today));
  }, [weeks, today]);

  // Find the current month key
  const currentMonthKey = today.slice(0, 7);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(currentWeekIdx);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    monthKeys.includes(currentMonthKey) ? currentMonthKey : monthKeys[0] ?? "",
  );

  const SkippedSection = () =>
    skippedDays.length > 0 ? (
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display font-semibold text-muted-foreground">Skipped</h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {skippedDays.length} day{skippedDays.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skippedDays.map((d) => {
            const total = d.problems.length;
            const done = d.problems.filter((p) => p.done).length;
            return (
              <div
                key={d.id}
                className="rounded-lg border border-dashed border-border bg-secondary/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{d.section}</p>
                    <h4 className="mt-0.5 truncate text-sm font-semibold">{d.topic}</h4>
                  </div>
                  {total > 0 && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {done}/{total}
                    </span>
                  )}
                </div>
                {d.subtopics.length > 0 && (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {d.subtopics.join(" · ")}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => void skipTopic(d.dayNumber, false)}
                >
                  Un-skip
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  // Keep selectedWeekIdx in sync after data loads
  const safeWeekIdx = weeks.length > 0 ? Math.min(selectedWeekIdx < 0 ? currentWeekIdx : selectedWeekIdx, weeks.length - 1) : 0;

  // Compute progress stats for a week
  function weekStats(week: Day[]) {
    const total = week.reduce((s, d) => s + d.problems.length, 0);
    const done = week.reduce((s, d) => s + d.problems.filter((p) => p.done).length, 0);
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  function monthStats(mDays: Day[]) {
    const total = mDays.reduce((s, d) => s + d.problems.length, 0);
    const done = mDays.reduce((s, d) => s + d.problems.filter((p) => p.done).length, 0);
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const FilterBar = () => (
    <div className="sticky top-0 z-10 -mx-1 mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
      {/* View mode pills */}
      <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
        {(
          [
            { mode: "week" as ViewMode, icon: CalendarDays, label: "Week" },
            { mode: "month" as ViewMode, icon: Calendar, label: "Month" },
            { mode: "all" as ViewMode, icon: LayoutGrid, label: "All Weeks" },
          ] as const
        ).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              viewMode === mode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Week picker (only when viewMode === "week") */}
      {viewMode === "week" && weeks.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-sm">
              <span>
                {safeWeekIdx === currentWeekIdx ? "This Week · " : ""}
                Week {safeWeekIdx + 1}{" "}
                <span className="hidden sm:inline text-muted-foreground">
                  ({formatDate(weeks[safeWeekIdx][0].date)} –{" "}
                  {formatDate(weeks[safeWeekIdx][weeks[safeWeekIdx].length - 1].date)})
                </span>
              </span>
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto min-w-[260px]">
            {weeks.map((week, idx) => {
              const stats = weekStats(week);
              const isCurrent = idx === currentWeekIdx;
              return (
                <DropdownMenuItem
                  key={idx}
                  onSelect={() => setSelectedWeekIdx(idx)}
                  className={cn(
                    "flex items-center justify-between gap-4 cursor-pointer",
                    idx === safeWeekIdx && "bg-accent",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <span className="font-medium">Week {idx + 1}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatDate(week[0].date)}
                    </span>
                  </span>
                  <span className={cn(
                    "text-xs tabular-nums shrink-0",
                    stats.pct === 100 ? "text-emerald-500" : "text-muted-foreground",
                  )}>
                    {stats.done}/{stats.total}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Month picker (only when viewMode === "month") */}
      {viewMode === "month" && monthKeys.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-sm">
              <span>{monthLabel(selectedMonthKey)}</span>
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto min-w-[200px]">
            {monthKeys.map((mk) => {
              const stats = monthStats(monthsMap[mk]);
              const isCurrent = mk === currentMonthKey;
              return (
                <DropdownMenuItem
                  key={mk}
                  onSelect={() => setSelectedMonthKey(mk)}
                  className={cn(
                    "flex items-center justify-between gap-4 cursor-pointer",
                    mk === selectedMonthKey && "bg-accent",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <span className="font-medium">{monthLabel(mk)}</span>
                  </span>
                  <span className={cn(
                    "text-xs tabular-nums shrink-0",
                    stats.pct === 100 ? "text-emerald-500" : "text-muted-foreground",
                  )}>
                    {stats.done}/{stats.total}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Summary badge */}
      <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
        {viewMode === "week" && weeks[safeWeekIdx] && (() => {
          const s = weekStats(weeks[safeWeekIdx]);
          return `${s.done}/${s.total} problems · ${s.pct}% done`;
        })()}
        {viewMode === "month" && monthsMap[selectedMonthKey] && (() => {
          const s = monthStats(monthsMap[selectedMonthKey]);
          return `${s.done}/${s.total} problems · ${s.pct}% done`;
        })()}
        {viewMode === "all" && (() => {
          const total = activeDays.reduce((s, d) => s + d.problems.length, 0);
          const done = activeDays.reduce((s, d) => s + d.problems.filter((p) => p.done).length, 0);
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return `${done}/${total} problems · ${pct}% done`;
        })()}
      </span>
    </div>
  );

  /* ────────── WEEK VIEW ────────── */
  if (viewMode === "week") {
    const week = weeks[safeWeekIdx] ?? [];
    const stats = weekStats(week);
    return (
      <div className="space-y-6">
        <FilterBar />
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Week {safeWeekIdx + 1}
              {safeWeekIdx === currentWeekIdx && (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  Current
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(week[0]?.date ?? "")} – {formatDate(week[week.length - 1]?.date ?? "")}
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-bold tabular-nums">{stats.pct}%</div>
            <div className="text-xs text-muted-foreground">{stats.done}/{stats.total} done</div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {week.map((d, i) => (
            <DayCard key={`${d.date}-${i}`} day={d} />
          ))}
        </div>
        {/* Prev / Next week navigation */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safeWeekIdx === 0}
            onClick={() => setSelectedWeekIdx(safeWeekIdx - 1)}
          >
            ← Previous week
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safeWeekIdx >= weeks.length - 1}
            onClick={() => setSelectedWeekIdx(safeWeekIdx + 1)}
          >
            Next week →
          </Button>
        </div>
        <SkippedSection />
      </div>
    );
  }

  /* ────────── MONTH VIEW ────────── */
  if (viewMode === "month") {
    const mDays = monthsMap[selectedMonthKey] ?? [];
    const monthWeeks = groupIntoWeeks(mDays);
    const stats = monthStats(mDays);
    const monthIdx = monthKeys.indexOf(selectedMonthKey);
    return (
      <div className="space-y-6">
        <FilterBar />
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {monthLabel(selectedMonthKey)}
              {selectedMonthKey === currentMonthKey && (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  Current
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">{stats.done}/{stats.total} problems completed</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-bold tabular-nums">{stats.pct}%</div>
            <div className="text-xs text-muted-foreground">completion</div>
          </div>
        </div>
        <div className="space-y-8">
          {monthWeeks.map((week, wIdx) => {
            const ws = weekStats(week);
            return (
              <div key={wIdx} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span>
                    {formatDate(week[0].date)} – {formatDate(week[week.length - 1].date)}
                  </span>
                  <span className="ml-auto text-xs tabular-nums">{ws.done}/{ws.total}</span>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {week.map((d, i) => (
                    <DayCard key={`${d.date}-${i}`} day={d} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* Prev / Next month navigation */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={monthIdx <= 0}
            onClick={() => setSelectedMonthKey(monthKeys[monthIdx - 1])}
          >
            ← Previous month
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={monthIdx >= monthKeys.length - 1}
            onClick={() => setSelectedMonthKey(monthKeys[monthIdx + 1])}
          >
            Next month →
          </Button>
        </div>
        <SkippedSection />
      </div>
    );
  }

  /* ────────── ALL WEEKS VIEW ────────── */
  return (
    <div className="space-y-6">
      <FilterBar />
      <div className="space-y-8">
        {weeks.map((week, weekIdx) => {
          const stats = weekStats(week);
          const isCurrent = weekIdx === currentWeekIdx;
          return (
            <div key={weekIdx} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Week {weekIdx + 1}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      Current
                    </span>
                  )}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {formatDate(week[0].date)} – {formatDate(week[week.length - 1].date)}
                </span>
                <span className={cn(
                  "ml-auto text-xs tabular-nums",
                  stats.pct === 100 ? "text-emerald-500 font-medium" : "text-muted-foreground",
                )}>
                  {stats.done}/{stats.total} · {stats.pct}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setSelectedWeekIdx(weekIdx);
                    setViewMode("week");
                  }}
                >
                  View →
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {week.map((d, i) => (
                  <DayCard key={`${d.date}-${i}`} day={d} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <SkippedSection />
    </div>
  );
}