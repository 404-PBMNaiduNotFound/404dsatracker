import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { dayProgress, deriveStatus, todayIso } from "@/lib/plan";
import { DayCard } from "@/components/DayCard";
import { DayDetail } from "@/components/DayDetail";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Ban, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/plan";
import { type Day } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/weeks")({
  head: () => ({
    meta: [
      { title: "Week View — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "See your 120-day DSA plan grouped week by week with progress for each week.",
      },
      { property: "og:title", content: "Week View — DSA⁴⁰⁴" },
      { property: "og:description", content: "Your DSA plan, week by week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WeeksPage,
});

function WeeksPage() {
  const { days, loading, skipDay } = usePlan();
  const todayDate = todayIso();
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);

  const weeks = useMemo(() => {
    // Active (non-skipped) days in their original array order.
    // We deliberately DO NOT sort by dayNumber because renumber() reassigns
    // dayNumbers every time a topic is skipped — that shifts weekNumber() for
    // every subsequent day and breaks the week layout.
    // Instead we use the stable position in the days array to determine which
    // week a day belongs to (rank among active days, 0-indexed, chunk of 7).
    const active = days.filter((d) => !d.skipped);

    const result: { week: number; startDate: string; endDate: string; list: Day[]; done: number; total: number; pct: number }[] = [];
    for (let i = 0; i < active.length; i += 7) {
      const weekDays = active.slice(i, i + 7);
      const done = weekDays.reduce((a, d) => a + dayProgress(d).done, 0);
      const total = weekDays.reduce((a, d) => a + dayProgress(d).total, 0);
      const pct = total ? Math.round((done / total) * 100) : 0;
      result.push({
        week: Math.floor(i / 7) + 1,
        startDate: weekDays[0].date,
        endDate: weekDays[weekDays.length - 1].date,
        list: weekDays,
        done,
        total,
        pct,
      });
    }
    return result;
  }, [days]);

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
            Back to Week View
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
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Week View</h1>
      <div className="space-y-6">
        {weeks.map((w) => (
          <section key={w.week}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">
                Week {w.week}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {formatDate(w.startDate)} – {formatDate(w.endDate)}
                </span>
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {w.done}/{w.total} problems
              </span>
            </div>
            <Progress value={w.pct} className="mb-3 h-1.5" />
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 w-full">
              {w.list.map((d) => {
                if (d.isRevisionDay) {
                  const weekDays = (d.revisionDayNumbers ?? [])
                    .map((n) => days.find((x) => x.dayNumber === n))
                    .filter((x): x is Day => Boolean(x));
                  return (
                    <div
                      key={d.dayNumber}
                      className="col-span-full rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3.5 space-y-2.5"
                    >
                      <p className="text-xs font-bold text-primary">Sunday · Weekly Revision — revisit Mon–Sat</p>
                      {weekDays.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No study days from this week yet.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {weekDays.map((wd) => (
                            <button
                              key={wd.dayNumber}
                              type="button"
                              onClick={() => setSelectedDay(wd)}
                              className="rounded-xl border border-white/10 bg-secondary/60 hover:bg-secondary px-3 py-2 text-left transition-colors"
                            >
                              <p className="text-[11px] font-bold text-foreground truncate">Day {wd.dayNumber} · {wd.topic}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{wd.problems.length} problem{wd.problems.length === 1 ? "" : "s"}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                const canSkip = deriveStatus(d) !== "completed" && d.date > todayDate;
                return (
                  <div key={d.dayNumber} className="space-y-1.5">
                    <div
                      className="relative cursor-pointer"
                      onClick={() => setSelectedDay(d)}
                    >
                      <DayCard day={d} />
                      <span className="absolute inset-0 z-10" aria-hidden="true" />
                    </div>
                    {canSkip && (
                      <ConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-full px-2 text-xs text-muted-foreground hover:text-destructive"
                          >
                            <Ban className="mr-1 size-3" aria-hidden="true" /> Skip Day
                          </Button>
                        }
                        title={`Skip Day ${d.dayNumber}?`}
                        description="This day's problems will cascade forward into upcoming days, and the plan will grow by one day."
                        confirmLabel="Skip Day"
                        destructive
                        onConfirm={() => skipDay(d.dayNumber)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
