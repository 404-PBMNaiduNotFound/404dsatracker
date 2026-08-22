"use client";

import Link from "next/link";
import { dayProgress, deriveStatus, formatDate, STATUS_META } from "@/lib/plan";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HoverHint } from "@/components/HoverHint";
import { Ban, Undo2 } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";
import type { Day } from "@/lib/types";

export function DayCard({ day, showSkipAction }: { day: Day; showSkipAction?: boolean }) {
  const { skipTopic } = usePlan();
  const { done, total, pct } = dayProgress(day);
  const status = deriveStatus(day);
  const meta = STATUS_META[status];
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 min-w-0 overflow-hidden max-w-full w-full",
        day.skipped && "opacity-60",
      )}
    >
      <Link
        href={`/day/${day.dayNumber}`}
        className="block w-full"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground truncate">
            Day {day.dayNumber} · {formatDate(day.date)}
          </span>
          <span className={`text-xs font-medium ${meta.className} truncate`} title={meta.label}>{meta.icon} {meta.label}</span>
        </div>
        <h3 className="mt-1 font-display text-base font-semibold truncate" title={day.topic}>{day.topic}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {day.subtopics.join(" · ") || "No subtopics"}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={pct} className="h-1.5" />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
        </div>
      </Link>

      {showSkipAction && (
        <div className="mt-3 border-t border-border pt-2">
          {day.skipped ? (
            <HoverHint hint="Restores this topic and its problems back into your plan">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  void skipTopic(day.dayNumber, false);
                }}
              >
                <Undo2 className="mr-1 size-3" aria-hidden="true" /> Un-skip
              </Button>
            </HoverHint>
          ) : (
            <HoverHint hint="Permanently excludes this topic's problems from your plan">
              <ConfirmDialog
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Ban className="mr-1 size-3" aria-hidden="true" /> Skip
                  </Button>
                }
                title="Skip this topic?"
                description="This topic's problems will be permanently excluded from your preparation and won't count toward your remaining totals. You can only do this because you're confident you don't need it."
                confirmLabel="Skip topic"
                destructive
                onConfirm={() => skipTopic(day.dayNumber, true)}
              />
            </HoverHint>
          )}
        </div>
      )}
    </div>
  );
}
