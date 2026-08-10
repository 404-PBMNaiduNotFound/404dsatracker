"use client";

import { useMemo, useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { dayProgress, todayIso, formatDate } from "@/lib/plan";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, CheckCircle2, CalendarPlus } from "lucide-react";
import type { Day } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

function isDayComplete(d: Day): boolean {
  return dayProgress(d).done === d.problems.length;
}

// ─── Add Revision Day button with hover tooltip ───────────────────────────────

function AddRevisionDayButton({ onAdd }: { onAdd: () => void }) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="relative mt-4 w-full">
      {/* Tooltip */}
      {showTip && (
        <div
          role="tooltip"
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-72 rounded-xl border border-border bg-popover shadow-xl px-4 py-3 text-sm text-popover-foreground animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <p className="font-semibold text-primary mb-1 flex items-center gap-1.5">
            <CalendarPlus className="size-4" />
            Add Revision Day
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Inserts an <strong>extra revision/buffer day</strong> after your
            last pending backlog day. Your entire remaining schedule shifts
            forward by 1 day, giving you breathing room to catch up without
            skipping any topics.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc list-inside">
            <li>Protects your schedule from burnout</li>
            <li>Keeps all future days intact — nothing is dropped</li>
            <li>Use it whenever you need one more day to finish a topic</li>
          </ul>
          {/* Arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 size-0 border-x-8 border-x-transparent border-t-8 border-t-border" />
        </div>
      )}

      <Button
        variant="secondary"
        onClick={onAdd}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        className="w-full gap-2 border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/70 transition-all"
      >
        <CalendarPlus className="size-4 shrink-0" />
        Add Revision Day
      </Button>
    </div>
  );
}

// ─── Backlog day card ─────────────────────────────────────────────────────────

function BacklogDayCard({ day }: { day: Day }) {
  const { done, total, pct } = dayProgress(day);
  const allDone = isDayComplete(day);
  const remaining = total - done;

  return (
    <Link
      href={`/day/${day.dayNumber}`}
      className={cn(
        "group block rounded-xl border bg-card p-4 transition-all duration-200 hover:border-primary/60 hover:shadow-md",
        allDone
          ? "border-success/40 bg-success/5"
          : "border-border hover:bg-accent/30"
      )}
    >
      {/* Top row: day label + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Day {day.dayNumber} · {formatDate(day.date)}
            </span>
            {allDone ? (
              <Badge className="text-[10px] px-1.5 py-0 bg-success/15 text-success border-success/30 gap-1">
                <CheckCircle2 className="size-2.5" />
                Completed Late
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-warning/10 text-warning border-warning/20">
                <Clock className="size-2.5" />
                {remaining} problem{remaining !== 1 ? "s" : ""} remaining
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-base leading-snug">{day.topic}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {day.subtopics.join(" · ") || day.section}
          </p>
        </div>

        {/* Arrow CTA */}
        <div className={cn(
          "shrink-0 flex items-center gap-1 text-xs font-medium mt-1 transition-colors",
          allDone ? "text-success" : "text-primary group-hover:translate-x-0.5 transition-transform"
        )}>
          {allDone ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <>
              <span className="hidden sm:inline">Complete now</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <Progress
          value={pct}
          className={cn("h-1.5 flex-1", allDone && "[&>div]:bg-success")}
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      {/* Subtle hint for incomplete */}
      {!allDone && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tap to open and mark problems done — they count toward your progress even if late.
        </p>
      )}
    </Link>
  );
}

export default function BacklogPage() {
  const { days, loading, insertRevisionDay } = usePlan();
  const iso = todayIso();

  const { pending, lateCompleted } = useMemo(() => {
    const past = days.filter(
      (d) =>
        d.date < iso &&
        d.status !== "revision" &&
        !d.skipped,
    );
    return {
      pending: past.filter((d) => !isDayComplete(d)),
      lateCompleted: past.filter((d) => isDayComplete(d)),
    };
  }, [days, iso]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  const hasPending = pending.length > 0;
  const hasLateCompleted = lateCompleted.length > 0;

  if (!hasPending && !hasLateCompleted) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">
        No pending days — you&apos;re all caught up!
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending backlog */}
      {hasPending && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">
              Incomplete Days
            </h2>
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {pending.length}
            </Badge>
          </div>
          <div className="grid gap-3">
            {pending.map((d) => (
              <BacklogDayCard key={d.date} day={d} />
            ))}
          </div>
          <AddRevisionDayButton
            onAdd={() => {
              const lastPending = pending[pending.length - 1];
              if (lastPending) insertRevisionDay(lastPending.dayNumber);
            }}
          />
        </section>
      )}

      {/* Late completed days */}
      {hasLateCompleted && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-success" />
            <h2 className="text-sm font-semibold text-foreground">
              Completed Late
            </h2>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-success/15 text-success border-success/20">
              {lateCompleted.length}
            </Badge>
          </div>
          <div className="grid gap-3">
            {lateCompleted.map((d) => (
              <BacklogDayCard key={d.date} day={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
