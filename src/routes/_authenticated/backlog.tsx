import { createFileRoute } from '@tanstack/react-router'

import { useMemo } from "react";
import { usePlan } from "@/hooks/usePlan";
import { isDayComplete, todayIso } from "@/lib/plan";
import { DayCard } from "@/components/DayCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/backlog")({
  head: () => ({
    meta: [
      { title: "Backlog — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "Every past day you have not finished yet, so nothing from the A2Z sheet slips.",
      },
      { property: "og:title", content: "Backlog — DSA⁴⁰⁴" },
      { property: "og:description", content: "Catch up on unfinished DSA study days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BacklogPage,
});

function BacklogPage() {
  const { days, loading, insertRevisionDay } = usePlan();
  const iso = todayIso();
  const pending = useMemo(
    () =>
      days.filter(
        (d) => d.date < iso && !isDayComplete(d) && d.status !== "revision" && !d.skipped,
      ),
    [days, iso],
  );

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Backlog</h1>
        {pending.length > 0 && (
          <Button
            variant="outline"
            onClick={() => void insertRevisionDay(pending[pending.length - 1].dayNumber)}
          >
            Insert a Revision Day
          </Button>
        )}
      </div>
      {pending.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nothing pending — you are fully caught up. 🎉
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {pending.length} day{pending.length > 1 ? "s" : ""} still open from before today.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((d) => (
              <DayCard key={d.dayNumber} day={d} />
            ))}
          </div>
        </>
      )}
    </>
  );
}