import { createFileRoute } from '@tanstack/react-router'

import { usePlan } from "@/hooks/usePlan";
import { todayIso } from "@/lib/plan";
import { DayDetail } from "@/components/DayDetail";
import { TodayContestsSection } from "@/components/ContestsSection";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — DSA⁴⁰⁴" },
      {
        name: "description",
        content:
          "Your daily DSA checklist: today's topic, problems, notes and AI explanations from the Core 404 roadmap.",
      },
      { property: "og:title", content: "Today — DSA⁴⁰⁴" },
      {
        property: "og:description",
        content: "Track today's Core 404 problems, checklist and AI notes.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { days, loading } = usePlan();
  const iso = todayIso();
  const day =
    days.find((d) => d.date === iso && !d.skipped) ??
    days.find((d) => d.date >= iso && !d.skipped) ??
    days.find((d) => !d.skipped) ??
    days[0];

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
      {!loading && day && <DayDetail day={day} />}
    </>
  );
}