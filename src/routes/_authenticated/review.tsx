import { createFileRoute } from '@tanstack/react-router'

import { useMemo } from "react";
import { usePlan } from "@/hooks/usePlan";
import { formatDate, todayIso } from "@/lib/plan";
import { ProblemRow } from "@/components/ProblemRow";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Review — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "Every problem you flagged for review from Today, in one place from any day.",
      },
      { property: "og:title", content: "Review — DSA⁴⁰⁴" },
      { property: "og:description", content: "Your flagged-for-review problems, all in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { days, loading, updateDay, toggleReview } = usePlan();

  const flagged = useMemo(
    () =>
      days
        .flatMap((d) => d.problems.filter((p) => p.forReview).map((p) => ({ day: d, problem: p })))
        .sort((a, b) => a.day.dayNumber - b.day.dayNumber),
    [days],
  );

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Review</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Problems you flagged for another look, gathered here from every day. Tap the bookmark on a
        problem in Today to add or remove it.
      </p>

      {flagged.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <BookmarkCheck className="size-4 shrink-0" aria-hidden="true" />
          Nothing flagged yet — use the bookmark button on any problem in Today to send it here.
        </p>
      ) : (
        <ul className="space-y-3">
          {flagged.map(({ day, problem }) => {
            const isToday = day.date === todayIso();
            return (
              <li key={`${day.dayNumber}-${problem.name}`} className="space-y-1.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Day {day.dayNumber} · {formatDate(day.date)} · {day.topic}
                  {!isToday && " · view only"}
                </p>
                <ul>
                  <ProblemRow
                    problem={problem}
                    readOnly={!isToday}
                    onToggle={
                      isToday
                        ? (v) =>
                            void updateDay(day.dayNumber, (d) => ({
                              ...d,
                              problems: d.problems.map((x) =>
                                x.name === problem.name ? { ...x, done: v } : x,
                              ),
                            }))
                        : undefined
                    }
                    onReview={() =>
                      void toggleReview(day.dayNumber, problem.name, !problem.forReview)
                    }
                  />
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
