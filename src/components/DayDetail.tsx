"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { addDays, dayProgress, deriveStatus, formatDate, STATUS_META, todayIso } from "@/lib/plan";
import type { Day } from "@/lib/types";
import { weekNumber } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ProblemRow } from "@/components/ProblemRow";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HoverHint } from "@/components/HoverHint";

/** Builds a single prompt covering today's topic and every problem on it, for a one-click ChatGPT explanation. */
function buildChatGptPrompt(day: Day): string {
  const problemLines = day.problems.map(
    (p, i) => `${i + 1}. ${p.name} — ${p.difficulty} (${p.platform})`,
  );
  const prompt = [
    `I'm working through "${day.topic}" (${day.section}) in a DSA prep plan.`,
    day.subtopics.length ? `Subtopics: ${day.subtopics.join(", ")}.` : null,
    problemLines.length ? "Here are today's problems:" : null,
    ...problemLines,
    "",
    "For each problem, explain the core idea and method, the intuition behind that approach, and a step-by-step walkthrough of an optimal solution with its time and space complexity. Keep it clear and easy to follow.",
  ]
    .filter(Boolean)
    .join("\n");

  // Keep the encoded URL well under common length limits so it never gets
  // silently truncated or rejected — trim problem lines from the end first.
  const MAX_CHARS = 1800;
  if (prompt.length <= MAX_CHARS || problemLines.length === 0) return prompt;
  const keep = Math.max(0, problemLines.length - 1);
  return buildChatGptPrompt({ ...day, problems: day.problems.slice(0, keep) });
}

export function chatGptExplainUrl(day: Day): string {
  return `https://chatgpt.com/?q=${encodeURIComponent(buildChatGptPrompt(day))}`;
}

export function DayDetail({ day, readOnly, lateMode }: { day: Day; readOnly?: boolean; lateMode?: boolean }) {
  const { days, updateDay, postpone, mergeTomorrow, unmerge, deleteProblem, deleteDay, toggleReview, borrowFromNext } =
    usePlan();
  const { done, total, pct } = dayProgress(day);
  const status = deriveStatus(day);
  const [newDate, setNewDate] = useState(addDays(day.date, 1));
  const activeDays = days.filter((d) => !d.skipped);
  const tomorrow = activeDays.find((d) => d.dayNumber === day.dayNumber + 1);
  const remaining = activeDays.length - day.dayNumber;
  const lastActiveDay = activeDays[activeDays.length - 1];
  const gap = Math.max(
    1,
    Math.round(
      (new Date(`${newDate}T00:00:00Z`).getTime() - new Date(`${day.date}T00:00:00Z`).getTime()) /
        86400000,
    ),
  );
  const future = day.date > todayIso();
  // lateMode = past backlog day: problems/notes/checklist are interactive, scheduling actions hidden
  const locked = lateMode ? false : (readOnly ?? false);
  const schedulingLocked = lateMode ? true : (readOnly ?? false);
  // Once anything today is marked done, the schedule (postpone/delete) is locked
  // so a finished problem is never accidentally pushed around or dropped.
  const anyDone = day.problems.some((p) => p.done);
  const allDoneNow = total > 0 && done === total;

  return (
    <article className="space-y-5">
      {/* ── Late-mode banner ────────────────────────────── */}
      {lateMode && (
        allDoneNow ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-semibold text-success">Completed Late — well done!</p>
              <p className="text-xs text-muted-foreground">You finished this backlog day. It counts toward your progress.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3">
            <span className="text-xl mt-0.5">📋</span>
            <div>
              <p className="text-sm font-semibold text-warning">Backlog Day — completing late</p>
              <p className="text-xs text-muted-foreground">
                Mark problems done below. This day was missed on {formatDate(day.date)} — finishing it now still counts.
              </p>
            </div>
          </div>
        )
      )}
      <header className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Day {day.dayNumber} · Week {weekNumber(day.dayNumber)} · {formatDate(day.date)}
              {future && " · upcoming"}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{day.topic}</h2>
            <p className="text-sm text-muted-foreground">{day.section}</p>
          </div>
          <span className={`text-sm font-semibold ${STATUS_META[status].className}`}>
            {STATUS_META[status].icon} {STATUS_META[status].label}
          </span>
        </div>
        {day.subtopics.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
  {day.subtopics.map((s, i) => (
    <li key={`${s}-${i}`} className="rounded-full bg-secondary px-3 py-1 text-xs">
      {s}
    </li>
  ))}
</ul>
        )}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Problems</span>
            <span className="font-semibold">
              {done}/{total} done · {pct}%
            </span>
          </div>
          <Progress value={pct} aria-label={`${pct}% of today's problems complete`} />
        </div>
      </header>

      <section aria-label="Problems" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Problems</h3>
        </div>
        {total === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No problems on this day — it is a buffer date.
          </p>
        ) : (
          <ul className="space-y-2">
            {day.problems.map((p, i) => (
              <ProblemRow
                key={`${p.name}-${i}`}
                problem={p}
                readOnly={locked}
                lateMode={lateMode}
                onToggle={(v) =>
                  void updateDay(day.dayNumber, (d) => ({
                    ...d,
                    problems: d.problems.map((x) => (x.name === p.name ? { ...x, done: v } : x)),
                  }))
                }
                onDelete={
                  locked ? undefined : () => void deleteProblem(day.dayNumber, p.name)
                }
                onReview={
                  locked ? undefined : () => void toggleReview(day.dayNumber, p.name, !p.forReview)
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Daily checklist" className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Completion checklist</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {day.checklist.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-2">
              <Checkbox
                id={`c-${day.dayNumber}-${i}`}
                checked={c.done}
                disabled={locked}
                className="size-5"
                onCheckedChange={(v) =>
                  void updateDay(day.dayNumber, (d) => ({
                    ...d,
                    checklist: d.checklist.map((x, xi) =>
                      xi === i ? { ...x, done: Boolean(v) } : x,
                    ),
                  }))
                }
              />
              <Label htmlFor={`c-${day.dayNumber}-${i}`} className="cursor-pointer text-sm font-normal">
                {c.label}
              </Label>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`notes-${day.dayNumber}`}>Notes</Label>
          <Textarea
            id={`notes-${day.dayNumber}`}
            rows={4}
            defaultValue={day.notes}
            disabled={locked}
            onBlur={(e) => void updateDay(day.dayNumber, (d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`rev-${day.dayNumber}`}>Revision reminders</Label>
          <Textarea
            id={`rev-${day.dayNumber}`}
            rows={4}
            defaultValue={day.revisionNotes}
            disabled={locked}
            onBlur={(e) =>
              void updateDay(day.dayNumber, (d) => ({ ...d, revisionNotes: e.target.value }))
            }
          />
        </div>
      </div>

      {!schedulingLocked && (
        <section aria-label="Schedule actions" className="flex flex-wrap gap-2">
          {anyDone ? (
            <HoverHint hint="Postpone is locked because at least one problem today is already marked done">
              <Button variant="secondary" disabled>
                Postpone this day
              </Button>
            </HoverHint>
          ) : (
            <HoverHint hint="Push this day's date forward — the topic order stays the same">
              <ConfirmDialog
                trigger={<Button variant="secondary">Postpone this day</Button>}
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
                      This pushes {remaining} remaining day{remaining === 1 ? "" : "s"} forward by{" "}
                      {gap} day{gap === 1 ? "" : "s"}. New end date:{" "}
                      <strong>
                        {lastActiveDay ? formatDate(addDays(lastActiveDay.date, gap)) : "—"}
                      </strong>
                      .
                    </p>
                  </div>
                }
                onConfirm={() => postpone(day.dayNumber, newDate)}
              />
            </HoverHint>
          )}

          {tomorrow && (
            <HoverHint hint="Pulls tomorrow's topic and problems into today, then shortens the plan by one day">
              <ConfirmDialog
                trigger={<Button variant="secondary">Merge tomorrow into today</Button>}
                title="Pull tomorrow's topic into today"
                confirmLabel="Merge"
                preview={
                  <p>
                    "{tomorrow.topic}" ({tomorrow.problems.length} problems) is merged into day{" "}
                    {day.dayNumber}. Every later day collapses forward by one — the plan shortens to{" "}
                    <strong>{activeDays.length - 1} days</strong>, new end date{" "}
                    <strong>{formatDate(activeDays[activeDays.length - 2]?.date ?? day.date)}</strong>.
                  </p>
                }
                onConfirm={() => mergeTomorrow(day.dayNumber)}
              />
            </HoverHint>
          )}

          {day.status === "merged" && day.mergeSnapshot && (
            <HoverHint hint={`Split this day back into "${day.mergeSnapshot.baseTopic}" and "${day.mergeSnapshot.absorbedTopic}" — plan extends by 1 day`}>
              <ConfirmDialog
                trigger={<Button variant="secondary">Unmerge</Button>}
                title="Unmerge this day"
                confirmLabel="Unmerge"
                preview={
                  <p>
                    Splits today back into two separate days: <strong>"{day.mergeSnapshot.baseTopic}"</strong> stays
                    on {formatDate(day.date)}, and <strong>"{day.mergeSnapshot.absorbedTopic}"</strong> is restored as
                    the next day. Every later day shifts forward by 1 — plan extends by 1 day.
                  </p>
                }
                onConfirm={() => unmerge(day.dayNumber)}
              />
            </HoverHint>
          )}

          {(() => {
            const nextActive = activeDays.find((d) => d.dayNumber === day.dayNumber + 1);
            const nextHasUndone = nextActive?.problems.some((p) => !p.done) ?? false;
            if (!nextActive || !nextHasUndone) return null;
            const borrowedProblem = nextActive.problems.find((p) => !p.done);
            return (
              <HoverHint hint={`Pull "${borrowedProblem?.name}" from Day ${nextActive.dayNumber} into today — next day keeps its remaining problems`}>
                <ConfirmDialog
                  trigger={<Button variant="secondary">Borrow a problem</Button>}
                  title="Borrow a problem from tomorrow"
                  confirmLabel="Borrow"
                  preview={
                    <p>
                      Moves <strong>"{borrowedProblem?.name}"</strong> from Day {nextActive.dayNumber} into today.
                      Day {nextActive.dayNumber} will have {nextActive.problems.filter((p) => !p.done).length - 1} undone problem
                      {nextActive.problems.filter((p) => !p.done).length - 1 === 1 ? "" : "s"} remaining — no dates shift.
                    </p>
                  }
                  onConfirm={() => borrowFromNext(day.dayNumber)}
                />
              </HoverHint>
            );
          })()}

          {anyDone ? (
            <HoverHint hint="Delete is locked because at least one problem today is already marked done">
              <Button variant="ghost" className="text-destructive" disabled>
                Delete this day
              </Button>
            </HoverHint>
          ) : (
            <HoverHint hint="Removes this day and its problems entirely, then shifts every later day back by one">
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="text-destructive">
                    Delete this day
                  </Button>
                }
                title="Delete this day"
                confirmLabel="Shrink schedule by 1 day"
                destructive
                preview={
                  <p>
                    Removes day {day.dayNumber} and its {day.problems.length} problems, then shifts
                    every later day forward by one date.
                  </p>
                }
                onConfirm={() => deleteDay(day.dayNumber, "shrink")}
              />
            </HoverHint>
          )}

        </section>
      )}

    </article>
  );
}
