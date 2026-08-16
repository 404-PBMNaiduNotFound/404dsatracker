"use client";

import { useMemo } from "react";
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { dayProgress, DEFAULT_DAILY_COUNTS } from "@/lib/plan";
import { DayCard } from "@/components/DayCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Ban, Undo2, BookOpen, Zap, Trophy } from "lucide-react";
import type { Day } from "@/lib/types";

const LEVEL_META: Record<string, { label: string; icon: typeof BookOpen; color: string; badge: string }> = {
  "Level 1": { label: "Level 1 — Foundations", icon: BookOpen, color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  "Level 2": { label: "Level 2 — Intermediate", icon: Zap, color: "text-blue-600", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  "Level 3": { label: "Level 3 — Advanced", icon: Trophy, color: "text-purple-600", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" },
};

/** How many problems of each difficulty appear in a day */
function diffCounts(day: Day) {
  const easy = day.problems.filter((p) => p.difficulty === "Easy").length;
  const medium = day.problems.filter((p) => p.difficulty === "Medium").length;
  const hard = day.problems.filter((p) => p.difficulty === "Hard").length;
  return { easy, medium, hard };
}

/** Whether a day's problems fit within user's daily limits */
function fitsInOneDay(day: Day, counts: { easy: number; medium: number; hard: number }) {
  const dc = diffCounts(day);
  return dc.easy <= counts.easy && dc.medium <= counts.medium && dc.hard <= counts.hard;
}

/** How many "days" this topic needs given the user's daily preference */
function daysRequired(days: Day[], counts: { easy: number; medium: number; hard: number }) {
  let totalEasy = 0, totalMed = 0, totalHard = 0;
  days.forEach((d) => {
    const dc = diffCounts(d);
    totalEasy += dc.easy;
    totalMed += dc.medium;
    totalHard += dc.hard;
  });
  const easyDays = counts.easy > 0 ? Math.ceil(totalEasy / counts.easy) : (totalEasy > 0 ? Infinity : 0);
  const medDays = counts.medium > 0 ? Math.ceil(totalMed / counts.medium) : (totalMed > 0 ? Infinity : 0);
  const hardDays = counts.hard > 0 ? Math.ceil(totalHard / counts.hard) : (totalHard > 0 ? Infinity : 0);
  return Math.max(easyDays, medDays, hardDays, 1);
}

export default function TopicsPage() {
  const { days, loading, skipSection, skipTopic } = usePlan();
  const { settings } = useSettings();
  const counts = settings?.counts ?? DEFAULT_DAILY_COUNTS;

  // Group days by level → section → day
  const levels = useMemo(() => {
    // Build section map — exclude revision days so "Revision" never
    // appears as a pseudo-section in the topic accordion.
    const sectionMap = new Map<string, { days: Day[]; level: string }>();
    days.filter((d) => !d.isRevisionDay).forEach((d) => {
      const existing = sectionMap.get(d.section);
      if (existing) {
        existing.days.push(d);
      } else {
        sectionMap.set(d.section, { days: [d], level: d.level ?? "Level 1" });
      }
    });

    // Build section summaries
    const sections = [...sectionMap.entries()].map(([section, { days: allDays, level }]) => {
      const active = allDays.filter((d) => !d.skipped);
      const done = active.reduce((a, d) => a + dayProgress(d).done, 0);
      const total = active.reduce((a, d) => a + dayProgress(d).total, 0);
      const allSkipped = allDays.every((d) => d.skipped);
      const needed = daysRequired(active, counts);
      const dc = active.reduce((acc, d) => {
        const c = diffCounts(d);
        return { easy: acc.easy + c.easy, medium: acc.medium + c.medium, hard: acc.hard + c.hard };
      }, { easy: 0, medium: 0, hard: 0 });

      return { section, level, list: active, done, total, pct: total ? Math.round((done / total) * 100) : 0, allSkipped, daysNeeded: needed, diffCounts: dc };
    });

    // Group by level — fully-skipped sections are excluded here and only
    // shown in the dedicated Skipped accordion below, so they never occupy
    // a slot in the level display or get counted in level totals.
    const levelMap = new Map<string, typeof sections>();
    sections
      .filter((s) => !s.allSkipped)
      .forEach((s) => {
      const existing = levelMap.get(s.level) ?? [];
      existing.push(s);
      levelMap.set(s.level, existing);
    });

    return ["Level 1", "Level 2", "Level 3"].map((lvl) => ({
      level: lvl,
      sections: levelMap.get(lvl) ?? [],
      meta: LEVEL_META[lvl],
    })).filter((l) => l.sections.length > 0);
  }, [days, counts]);

  const skippedDays = useMemo(
    () => days.filter((d) => d.skipped).sort((a, b) => a.dayNumber - b.dayNumber),
    [days],
  );

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Topic View</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Showing your plan grouped by level. Daily capacity: <span className="font-medium text-foreground">{counts.easy}E · {counts.medium}M · {counts.hard}H</span>
      </p>

      {/* 3-Level outer accordion */}
      <Accordion type="multiple" defaultValue={["Level 1", "Level 2", "Level 3"]} className="space-y-3">
        {levels.map(({ level, sections, meta }) => {
          const Icon = meta.icon;
          const totalDone = sections.reduce((a, s) => a + s.done, 0);
          const totalProblems = sections.reduce((a, s) => a + s.total, 0);
          const totalPct = totalProblems ? Math.round((totalDone / totalProblems) * 100) : 0;

          return (
            <AccordionItem
              key={level}
              value={level}
              className="rounded-2xl border-2 border-border bg-card/50 px-4 overflow-hidden"
            >
              {/* Level header */}
              <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                <Icon className={`size-5 shrink-0 ${meta.color}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <span className="font-display text-base sm:text-lg font-bold truncate">{meta.label}</span>
                  </AccordionTrigger>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground pl-8 sm:pl-0">
                  {totalDone}/{totalProblems} · {sections.length} topic{sections.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="pb-3 pt-0">
                <Progress value={totalPct} className="h-2" />
              </div>

              <AccordionContent>
                {/* Section-level accordion (Level 2 nesting) */}
                <Accordion type="multiple" className="space-y-2 pb-3">
                  {sections.map((s) => (
                    <AccordionItem
                      key={s.section}
                      value={s.section}
                      className="rounded-xl border border-border bg-background px-3"
                    >
                      <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                          <AccordionTrigger className="hover:no-underline py-2">
                            <span className="truncate font-display font-semibold text-sm">{s.section}</span>
                          </AccordionTrigger>
                        </div>

                        {/* Difficulty breakdown badges */}
                        <div className="flex shrink-0 flex-wrap items-center gap-1 pl-0 sm:pl-0">
                          {s.diffCounts.easy > 0 && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 tabular-nums">
                              {s.diffCounts.easy}E
                            </span>
                          )}
                          {s.diffCounts.medium > 0 && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 tabular-nums">
                              {s.diffCounts.medium}M
                            </span>
                          )}
                          {s.diffCounts.hard > 0 && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 tabular-nums">
                              {s.diffCounts.hard}H
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                            {s.done}/{s.total}
                          </span>
                          <button
                            type="button"
                            className="ml-1 flex shrink-0 items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void skipSection(s.section, !s.allSkipped);
                            }}
                          >
                            {s.allSkipped ? (
                              <><Undo2 className="size-3" aria-hidden="true" /> Un-skip</>
                            ) : (
                              <><Ban className="size-3" aria-hidden="true" /> Skip</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="pb-2 pt-1">
                        <Progress value={s.pct} className="h-1" />
                      </div>

                      <AccordionContent>
                        {s.list.length === 0 ? (
                          <p className="pb-4 text-sm text-muted-foreground">
                            Every day in this section is skipped.
                          </p>
                        ) : (
                          <>
                            {/* Per-day capacity hint */}
                            <div className="mb-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Daily limit:</span>{" "}
                                {counts.easy} easy · {counts.medium} medium · {counts.hard} hard
                                {" · "}<span className="font-medium text-foreground">Est. {s.daysNeeded} day{s.daysNeeded === 1 ? "" : "s"}</span> for this topic
                              </p>
                            </div>

                            {/* Day cards — level 3 nesting */}
                            <div className="grid gap-3 pb-2 sm:grid-cols-2">
                              {s.list.map((d) => {
                                const dc = diffCounts(d);
                                const fits = fitsInOneDay(d, counts);
                                return (
                                  <div key={d.dayNumber} className="relative">
                                    {!fits && (
                                      <div className="absolute -top-1 -right-1 z-10">
                                        <span className="rounded-full bg-warning/90 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                                          Exceeds limit
                                        </span>
                                      </div>
                                    )}
                                    <DayCard day={d} showSkipAction />
                                    {/* Per-day difficulty breakdown */}
                                    <div className="mt-1 flex gap-1.5 px-1">
                                      {dc.easy > 0 && (
                                        <span className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums ${dc.easy > counts.easy ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                                          {dc.easy}/{counts.easy} E
                                        </span>
                                      )}
                                      {dc.medium > 0 && (
                                        <span className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums ${dc.medium > counts.medium ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                                          {dc.medium}/{counts.medium} M
                                        </span>
                                      )}
                                      {dc.hard > 0 && (
                                        <span className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums ${dc.hard > counts.hard ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300"}`}>
                                          {dc.hard}/{counts.hard} H
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Skipped days */}
        {skippedDays.length > 0 && (
          <AccordionItem
            value="__skipped__"
            className="rounded-xl border border-dashed border-border bg-card/60 px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-baseline justify-between gap-3 text-left">
                <span className="font-display font-semibold text-muted-foreground">Skipped</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {skippedDays.length} day{skippedDays.length === 1 ? "" : "s"}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 pb-2 sm:grid-cols-2">
                {skippedDays.map((d) => {
                  const { done, total } = dayProgress(d);
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
                        <Undo2 className="mr-1 size-3" aria-hidden="true" /> Un-skip
                      </Button>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </>
  );
}
