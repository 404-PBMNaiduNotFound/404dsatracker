import { createFileRoute } from '@tanstack/react-router'

import { usePlan } from "@/hooks/usePlan";
import { todayIso } from "@/lib/plan";
import { DayDetail } from "@/components/DayDetail";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/day/$dayNumber")({
  head: () => ({
    meta: [
      { title: "Day detail — DSA⁴⁰⁴" },
      {
        name: "description",
        content: "Problems, checklist, notes, AI explainer and doubt chat for a single study day.",
      },
      { property: "og:title", content: "Day detail — DSA⁴⁰⁴" },
      { property: "og:description", content: "Open one day of your 120-day DSA plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayPage,
});

function DayPage() {
  const { dayNumber } = Route.useParams();
  const { days, loading } = usePlan();
  const day = days.find((d) => d.dayNumber === Number(dayNumber));

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!day)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">That day is not part of your plan.</p>
        <Link to="/today" className="text-sm font-medium text-primary underline">
          Back to Today
        </Link>
      </div>
    );

  const isToday = day.date === todayIso();

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Day {day.dayNumber}</h1>
      {!isToday && (
        <p className="mb-4 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          View only — only today's problems can be checked off or rescheduled. Head to the{" "}
          <Link to="/today" className="font-medium text-primary underline">
            Today
          </Link>{" "}
          tab to make changes.
        </p>
      )}
      <DayDetail day={day} readOnly={!isToday} />
    </>
  );
}