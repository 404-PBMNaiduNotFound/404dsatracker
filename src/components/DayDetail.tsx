"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import type { Day, DayStatus } from "@/lib/types";
import { addDays, formatDate, todayIso } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProblemCardHorizontal } from "@/components/ProblemCardHorizontal";
import { TodayContestsSection } from "@/components/ContestsSection";
import {
  AlertTriangle,
  Sparkles,
  ListTodo,
  CheckCircle2,
  CalendarDays,
  Merge,
  Download,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_META: Record<
  DayStatus,
  { label: string; icon: string; className: string }
> = {
  pending: { label: "Pending", icon: "🟢", className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  in_progress: { label: "In Progress", icon: "⚡", className: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  completed: { label: "Completed", icon: "✅", className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  postponed: { label: "Postponed", icon: "⏳", className: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  merged: { label: "Merged", icon: "🔀", className: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  revision: { label: "Revision", icon: "🔁", className: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  skipped: { label: "Skipped", icon: "⏭️", className: "text-muted-foreground border-white/10 bg-white/5" },
};

function HoverHint({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DayDetail({
  day,
  readOnly = false,
  lateMode = false,
  headerOnly = false,
  hideHeader = false,
}: {
  day: Day;
  readOnly?: boolean;
  lateMode?: boolean;
  headerOnly?: boolean;
  hideHeader?: boolean;
}) {
  const {
    days,
    updateDay,
    toggleReview,
    postpone,
    mergeTomorrow,
    unmerge,
    borrowFromNext,
    deleteDay,
    deleteProblem,
    skipTopic,
    restoreDay,
  } = usePlan();

  const [newDate, setNewDate] = useState(() => addDays(day.date, 1));

  const total = day.problems.length;
  const done = day.problems.filter((p) => p.done).length;
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);

  const checklistTotal = day.checklist.length;
  const checklistDone = day.checklist.filter((c) => c.done).length;
  const checklistPct = checklistTotal === 0 ? 100 : Math.round((checklistDone / checklistTotal) * 100);

  const activeDays = days.filter((d) => !d.skipped);
  const tomorrow = activeDays.find((d) => d.dayNumber === day.dayNumber + 1);
  const anyDone = day.problems.some((p) => p.done);
  const status: DayStatus = day.skipped ? "skipped" : done === total && total > 0 ? "completed" : day.status;

  const locked = readOnly && !lateMode;
  const schedulingLocked = locked || day.skipped;

  const hasActionToRestore =
    day.skipped ||
    status === "postponed" ||
    status === "merged" ||
    Boolean(day.mergeSnapshot) ||
    Boolean(day.skippedProblems && day.skippedProblems.length > 0) ||
    day.problems.some((p) => Boolean(p.borrowedFromDay) || Boolean(p.carriedFromDay));

  const remaining = activeDays.filter((d) => d.dayNumber >= day.dayNumber).length;
  const gap = Math.max(
    1,
    Math.round((new Date(newDate).getTime() - new Date(day.date).getTime()) / (1000 * 60 * 60 * 24))
  );
  const lastActiveDay = activeDays.at(-1);

  const headerCard = (
    <header className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-xl p-4 sm:p-5 shadow-xl space-y-3">
      {/* Top Meta & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Day {day.dayNumber} · Week {Math.ceil(day.dayNumber / 7)} · {formatDate(day.date)}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_META[status].className}`}>
            {STATUS_META[status].icon} {STATUS_META[status].label}
          </span>
        </div>

        {/* Schedule Action Buttons (Flex-wrap rowwise on mobile screens) */}
        {!schedulingLocked && (
          <div className="flex flex-wrap items-center gap-1.5 py-0.5 max-w-full">
            {/* Postpone */}
            {anyDone ? (
              <HoverHint hint="Postpone is locked because at least one problem is done">
                <Button variant="secondary" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg font-semibold shrink-0 whitespace-nowrap" disabled>
                  <CalendarDays className="size-3 mr-1 text-muted-foreground" />
                  <span>Postpone</span>
                </Button>
              </HoverHint>
            ) : (
              <HoverHint hint="Push this day's date forward — topic order stays intact">
                <div className="inline-block shrink-0">
                  <ConfirmDialog
                    trigger={
                      <Button variant="secondary" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg font-semibold shrink-0 whitespace-nowrap">
                        <CalendarDays className="size-3 mr-1 text-sky-400" />
                        <span>Postpone</span>
                      </Button>
                    }
                    title="Postpone this day"
                    description="The topic order stays intact — only the calendar moves."
                    confirmLabel="Postpone"
                    preview={
                      <div className="space-y-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="new-date">New date</Label>
                          <Input
                            id="new-date"
                            type="date"
                            value={newDate}
                            min={addDays(day.date, 1)}
                            onChange={(e) => setNewDate(e.target.value)}
                          />
                        </div>
                        <p>
                          Pushes {remaining} remaining day{remaining === 1 ? "" : "s"} forward by {gap} day{gap === 1 ? "" : "s"}.
                        </p>
                      </div>
                    }
                    onConfirm={() => postpone(day.dayNumber, newDate)}
                  />
                </div>
              </HoverHint>
            )}

            {/* Merge Tomorrow */}
            {tomorrow ? (
              <HoverHint hint="Pull tomorrow's topic & problems into today — shortens schedule by 1 day">
                <div className="inline-block shrink-0">
                  <ConfirmDialog
                    trigger={
                      <Button variant="secondary" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg font-semibold shrink-0 whitespace-nowrap">
                        <Merge className="size-3 mr-1 text-purple-400" />
                        <span>Merge Tomorrow</span>
                      </Button>
                    }
                    title="Pull tomorrow's topic into today"
                    confirmLabel="Merge"
                    preview={
                      <p>
                        "{tomorrow.topic}" ({tomorrow.problems.length} problems) is merged into day {day.dayNumber}.
                      </p>
                    }
                    onConfirm={() => mergeTomorrow(day.dayNumber)}
                  />
                </div>
              </HoverHint>
            ) : day.status === "merged" && day.mergeSnapshot ? (
              <HoverHint hint={`Split day back into "${day.mergeSnapshot.baseTopic}" and "${day.mergeSnapshot.absorbedTopic}"`}>
                <div className="inline-block shrink-0">
                  <ConfirmDialog
                    trigger={
                      <Button variant="secondary" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg font-semibold shrink-0 whitespace-nowrap">
                        <RotateCcw className="size-3 mr-1 text-amber-400" />
                        <span>Unmerge</span>
                      </Button>
                    }
                    title="Unmerge this day"
                    confirmLabel="Unmerge"
                    preview={<p>Splits today back into two separate days.</p>}
                    onConfirm={() => unmerge(day.dayNumber)}
                  />
                </div>
              </HoverHint>
            ) : null}

            {/* Borrow Problem */}
            {(() => {
              const nextActive = activeDays.find((d) => d.dayNumber === day.dayNumber + 1);
              const nextHasUndone = nextActive?.problems.some((p) => !p.done) ?? false;
              if (!nextActive || !nextHasUndone) return null;
              const borrowedProblem = nextActive.problems.find((p) => !p.done);
              return (
                <HoverHint hint={`Borrow "${borrowedProblem?.name}" from tomorrow into today`}>
                  <div className="inline-block shrink-0">
                    <ConfirmDialog
                      trigger={
                        <Button variant="secondary" size="sm" className="h-7 text-[11px] px-2.5 rounded-lg font-semibold shrink-0 whitespace-nowrap">
                          <Download className="size-3 mr-1 text-emerald-400" />
                          <span>Borrow Problem</span>
                        </Button>
                      }
                      title="Borrow a problem from tomorrow"
                      confirmLabel="Borrow"
                      preview={
                        <p>Moves <strong>"{borrowedProblem?.name}"</strong> into today.</p>
                      }
                      onConfirm={() => borrowFromNext(day.dayNumber)}
                    />
                  </div>
                </HoverHint>
              );
            })()}

            {/* Delete Day */}
            {anyDone ? (
              <HoverHint hint="Delete is locked because a problem is done">
                <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-destructive rounded-lg shrink-0 whitespace-nowrap" disabled>
                  <Trash2 className="size-3 mr-1" />
                  <span>Delete</span>
                </Button>
              </HoverHint>
            ) : (
              <HoverHint hint="Removes this day entirely and shifts later days back by 1 day">
                <div className="inline-block shrink-0">
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-destructive rounded-lg hover:bg-rose-500/10 shrink-0 whitespace-nowrap">
                        <Trash2 className="size-3 mr-1" />
                        <span>Delete</span>
                      </Button>
                    }
                    title="Delete this day"
                    confirmLabel="Shrink schedule by 1 day"
                    destructive
                    preview={
                      <p>Removes day {day.dayNumber} and shifts later days forward. Want it back later? Go to the Topic section and unskip it.</p>
                    }
                    onConfirm={() => deleteDay(day.dayNumber, "shrink")}
                  />
                </div>
              </HoverHint>
            )}

            {/* Restore / Revert Button — Appears ONLY when an operation (merge/postpone/skip/borrow/delete) was performed */}
            {hasActionToRestore && !locked && (
              <HoverHint hint="Restore / Revert performed action on this day — restores merged or skipped topics, or returns borrowed/deleted problems">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5 rounded-lg font-semibold shrink-0 whitespace-nowrap border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1 bg-emerald-500/5 shadow-sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await restoreDay(day.dayNumber);
                  }}
                >
                  <RotateCcw className="size-3.5 text-emerald-400" />
                  <span>Restore</span>
                </Button>
              </HoverHint>
            )}
          </div>
        )}
      </div>

      {/* Topic Title & Subtopics Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{day.topic}</h2>
          <p className="text-xs font-medium text-muted-foreground">{day.section}</p>
        </div>

        {day.subtopics.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {day.subtopics.map((s, i) => (
              <li key={`${s}-${i}`} className="rounded-full border border-white/10 bg-secondary/80 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-muted-foreground">Topic Progress</span>
          <span className="text-primary">{done}/{total} done ({pct}%)</span>
        </div>
        <Progress value={pct} aria-label={`${pct}% of today's problems complete`} />
      </div>
    </header>
  );

  if (headerOnly) {
    return headerCard;
  }

  return (
    <article aria-label={`Details for Day ${day.dayNumber}`} className="space-y-5">
      {lateMode && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 shadow-md">
          <AlertTriangle className="size-4 shrink-0 text-amber-400" />
          <span>This is a past uncompleted day. Submitting code or checking items here will update your stats.</span>
        </div>
      )}

      {!hideHeader && headerCard}

      {/* ── Today's Core Problems ── */}
      <section aria-label="Problems" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span>Today's Core Problems</span>
            <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
              {total}
            </span>
          </h3>
        </div>
        {day.isRevisionDay ? (
          <div className="space-y-2.5 pt-1">
            {(!day.revisionDayNumbers || day.revisionDayNumbers.length === 0) ? (
              <p className="rounded-2xl border border-dashed border-white/15 p-4 text-xs text-muted-foreground">
                No study days from this week yet — check back once you've solved a few!
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Sunday is set aside for revision — revisit this week's topics and re-solve the problems from scratch to lock in the patterns.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {day.revisionDayNumbers.map((n) => {
                    const wd = days.find((x) => x.dayNumber === n);
                    if (!wd) return null;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { window.location.href = `/day/${wd.dayNumber}`; }}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-secondary/60 hover:bg-secondary px-4 py-3 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">Day {wd.dayNumber} · {wd.topic}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{wd.problems.length} problem{wd.problems.length === 1 ? "" : "s"}</p>
                        </div>
                        <RotateCcw className="size-3.5 text-primary shrink-0 rotate-45" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : total === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-4 text-xs text-muted-foreground">
            No problems on this day — it is a buffer date.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {day.problems.map((p, i) => (
              <ProblemCardHorizontal
                key={`${p.name}-${i}`}
                problem={p}
                readOnly={locked}
                onToggle={() =>
                  void updateDay(day.dayNumber, (d) => ({
                    ...d,
                    problems: d.problems.map((x) =>
                      x.name === p.name
                        ? { ...x, done: !x.done, completedAt: !x.done ? todayIso() : undefined }
                        : x
                    ),
                  }))
                }
                onToggleReview={
                  locked ? undefined : () => void toggleReview(day.dayNumber, p.name, !p.forReview)
                }
                onSkip={
                  locked ? undefined : () => void deleteProblem(day.dayNumber, p.name)
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Today's Live & Upcoming Contests Section (Above Checklist) ── */}
      <TodayContestsSection />

      {/* ── Reduced Height Completion Checklist UI ── */}
      <section aria-label="Daily checklist" className="rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl p-3.5 shadow-md space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListTodo className="size-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Completion Checklist</h3>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            {checklistDone} / {checklistTotal} ({checklistPct}%)
          </span>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {day.checklist.map((c, i) => (
            <li
              key={`${c.label}-${i}`}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-all ${
                c.done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold"
                  : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
              }`}
            >
              <Checkbox
                id={`c-${day.dayNumber}-${i}`}
                checked={c.done}
                disabled={locked}
                className="size-4 rounded-md border-border text-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                onCheckedChange={(v) =>
                  void updateDay(day.dayNumber, (d) => ({
                    ...d,
                    checklist: d.checklist.map((x, xi) =>
                      xi === i ? { ...x, done: Boolean(v) } : x,
                    ),
                  }))
                }
              />
              <Label
                htmlFor={`c-${day.dayNumber}-${i}`}
                className={`cursor-pointer text-xs leading-snug flex-1 select-none ${
                  c.done && "line-through text-emerald-400/80"
                }`}
              >
                {c.label}
              </Label>
              {c.done && <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Daily Notes & Revision Reminders ── */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl p-3.5 shadow-md">
          <Label htmlFor={`notes-${day.dayNumber}`} className="text-xs font-bold text-foreground">Topic Notes & Takeaways</Label>
          <Textarea
            id={`notes-${day.dayNumber}`}
            rows={3}
            defaultValue={day.notes}
            placeholder="Write key code snippets or intuition..."
            disabled={locked}
            className="bg-background/40 border-white/10 rounded-xl text-xs"
            onBlur={(e) => void updateDay(day.dayNumber, (d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl p-3.5 shadow-md">
          <Label htmlFor={`rev-${day.dayNumber}`} className="text-xs font-bold text-foreground">Revision Reminders</Label>
          <Textarea
            id={`rev-${day.dayNumber}`}
            rows={3}
            defaultValue={day.revisionNotes}
            placeholder="Important formulas or complexities to re-read..."
            disabled={locked}
            className="bg-background/40 border-white/10 rounded-xl text-xs"
            onBlur={(e) =>
              void updateDay(day.dayNumber, (d) => ({ ...d, revisionNotes: e.target.value }))
            }
          />
        </div>

      </div>
    </article>
  );
}
