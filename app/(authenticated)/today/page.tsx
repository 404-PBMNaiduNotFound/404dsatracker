"use client";



import { usePlan } from "@/hooks/usePlan";
import { todayIso } from "@/lib/plan";
import { DayDetail } from "@/components/DayDetail";
import { TodayContestsSection } from "@/components/ContestsSection";
import { Skeleton } from "@/components/ui/skeleton";


export default function TodayPage() {
  const { days, loading } = usePlan();
  const iso = todayIso(); // always system date — never plan-relative

  // The day whose date matches today exactly — only this one is interactive.
  // If the plan hasn't reached today yet (start date is in the future),
  // show the nearest upcoming day but lock it read-only.
  const todayDay = days.find((d) => d.date === iso && !d.skipped);
  const futureFallback = days.find((d) => d.date > iso && !d.skipped);
  const pastFallback = days.filter((d) => d.date < iso && !d.skipped).at(-1);

  // Which day to display
  const day = todayDay ?? futureFallback ?? pastFallback ?? days[0];

  // Only today's exact date gets full interactive access — past and future are locked
  const isExactlyToday = day?.date === iso;
  const isPast = day ? day.date < iso : false;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Today</h1>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {!loading && !day && (
        <p className="text-sm text-muted-foreground">No plan yet — it is being generated.</p>
      )}
      {!loading && <TodayContestsSection />}
      {!loading && day && (
        <DayDetail
          day={day}
          readOnly={!isExactlyToday && !isPast}
          lateMode={isPast && !isExactlyToday}
        />
      )}
    </>
  );
}