import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { dayProgress, todayIso } from "@/lib/plan";
import { DayCard } from "@/components/DayCard";
import { DayDetail } from "@/components/DayDetail";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Ban, Undo2, ArrowLeft } from "lucide-react";
import type { Day } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/topics")({
  head: () => ({
    meta: [
      { title: "Topic View — DSA⁴⁰⁴" },
      {
        name: "description",
        content:
          "Browse all 42 Core 404 topics, see per-topic progress and jump into any study day.",
      },
      { property: "og:title", content: "Topic View — DSA⁴⁰⁴" },
      { property: "og:description", content: "All 18 A2Z sections with progress at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TopicsPage,
});

function TopicsPage() {
  const { days, loading, skipSection, skipTopic } = usePlan();
  const todayDate = todayIso();
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);

  const sections = useMemo(() => {
    const map = new Map<string, Day[]>();
    days.forEach((d) => map.set(d.section, [...(map.get(d.section) ?? []), d]));
    return [...map.entries()].map(([section, allDays]) => {
      const active = allDays.filter((d) => !d.skipped);
      const done = active.reduce((a, d) => a + dayProgress(d).done, 0);
      const total = active.reduce((a, d) => a + dayProgress(d).total, 0);
      const allSkipped = allDays.every((d) => d.skipped);
      return {
        section,
        list: active,
        done,
        total,
        pct: total ? Math.round((done / total) * 100) : 0,
        allSkipped,
      };
    });
  }, [days]);

  const skippedDays = useMemo(
    () => days.filter((d) => d.skipped).sort((a, b) => a.dayNumber - b.dayNumber),
    [days],
  );

  if (loading) return <Skeleton className="h-96 w-full" />;

  // If a day is selected, show its problems inline (read-only for non-today days)
  if (selectedDay) {
    const isToday = selectedDay.date === todayDate;
    return (
      <>
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            onClick={() => setSelectedDay(null)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Topic View
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Day {selectedDay.dayNumber}</h1>
        </div>
        {!isToday && (
          <p className="mb-4 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            View only — only today's problems can be checked off or rescheduled.
          </p>
        )}
        <DayDetail day={selectedDay} readOnly={!isToday} />
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Topic View</h1>
      <Accordion type="multiple" className="space-y-2">
        {sections.map((s) => (
          <AccordionItem
            key={s.section}
            value={s.section}
            className="rounded-xl border border-border bg-card px-4"
          >
            <div className="flex w-full items-center gap-2 pt-1">
              <div className="min-w-0 flex-1">
                <AccordionTrigger className="hover:no-underline">
                  <span className="truncate font-display font-semibold">{s.section}</span>
                </AccordionTrigger>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {s.done}/{s.total} · {s.list.length} day{s.list.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void skipSection(s.section, !s.allSkipped);
                }}
              >
                {s.allSkipped ? (
                  <>
                    <Undo2 className="size-3" aria-hidden="true" /> Un-skip
                  </>
                ) : (
                  <>
                    <Ban className="size-3" aria-hidden="true" /> Skip Section
                  </>
                )}
              </button>
            </div>
            <div className="pb-3 pt-2">
              <Progress value={s.pct} className="h-1.5" />
            </div>
            <AccordionContent>
              {s.list.length === 0 ? (
                <p className="pb-4 text-sm text-muted-foreground">
                  Every day in this section is skipped — see the Skipped section below.
                </p>
              ) : (
                <div className="grid gap-3 pb-2 sm:grid-cols-2">
                  {s.list.map((d) => (
                    <div
                      key={d.dayNumber}
                      className="relative cursor-pointer"
                      onClick={() => setSelectedDay(d)}
                    >
                      <DayCard key={d.dayNumber} day={d} showSkipAction />
                      <span className="absolute inset-0 z-10" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}

        {skippedDays.length > 0 && (
          <AccordionItem
            value="__skipped__"
            className="rounded-xl border border-dashed border-border bg-card/60 px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-baseline justify-between gap-3 text-left">
                <span className="font-display font-semibold text-muted-foreground">
                  Skipped
                </span>
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
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {d.section}
                          </p>
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
