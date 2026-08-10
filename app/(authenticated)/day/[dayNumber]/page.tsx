"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePlan } from "@/hooks/usePlan";
import { todayIso } from "@/lib/plan";
import { DayDetail } from "@/components/DayDetail";
import { Skeleton } from "@/components/ui/skeleton";

export default function DayPage() {
  const params = useParams();
  const dayNumber = params.dayNumber as string;
  const { days, loading } = usePlan();
  const day = days.find((d) => d.dayNumber === Number(dayNumber));

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!day)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">That day is not part of your plan.</p>
        <Link href="/today" className="text-sm font-medium text-primary underline">
          Back to Today
        </Link>
      </div>
    );

  const iso = todayIso();
  const isToday = day.date === iso;
  // Past day (backlog): fully interactive so student can complete missed problems,
  // but scheduling actions (postpone/delete/merge) are hidden since the date already passed.
  const isPast = day.date < iso;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Day {day.dayNumber}</h1>
      {!isToday && !isPast && (
        <p className="mb-4 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          View only — only today&apos;s problems can be checked off or rescheduled. Head to the{" "}
          <Link href="/today" className="font-medium text-primary underline">
            Today
          </Link>{" "}
          tab to make changes.
        </p>
      )}
      <DayDetail day={day} readOnly={!isToday && !isPast} lateMode={isPast} />
    </>
  );
}
