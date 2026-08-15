"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import * as db from "@/lib/db";
import {
  addDays,
  deriveStatus,
  diffDays,
  isDayComplete,
  newChecklist,
  planOffset,
  rebalanceRemaining,
  renumber,
  setSkipped,
  setSkippedById,
  shiftFrom,
  todayIso,
  type DailyCounts,
} from "@/lib/plan";
import type { Day } from "@/lib/types";

interface PlanCtx {
  days: Day[];
  loading: boolean;
  error: string | null;
  lastSynced: string | null;
  startDate: string;
  reload: () => void;
  updateDay: (dayNumber: number, patch: (d: Day) => Day) => Promise<void>;
  postpone: (dayNumber: number, newDate: string) => Promise<void>;
  mergeTomorrow: (dayNumber: number) => Promise<void>;
  /** Split a merged day back into its two original days, inserting the absorbed day after and extending the plan by 1. */
  unmerge: (dayNumber: number) => Promise<void>;
  deleteProblem: (dayNumber: number, problemName: string) => Promise<void>;
  deleteDay: (dayNumber: number, mode: "shrink" | "placeholder") => Promise<void>;
  /** Flags/unflags a problem for the Review tab. */
  toggleReview: (dayNumber: number, problemName: string, flag: boolean) => Promise<void>;
  skipTopic: (dayNumber: number, skip: boolean) => Promise<void>;
  /** Marks a single future day as skipped and cascades its problems forward. */
  skipDay: (dayNumber: number) => Promise<void>;
  /** Marks all days in a section as skipped and cascades their problems forward. */
  skipSection: (section: string, skip: boolean) => Promise<void>;
  resetAll: () => Promise<void>;
  insertRevisionDay: (afterDayNumber: number) => Promise<void>;
  /** Upgrade 5: redistribute all unfinished problems at a new daily pace. */
  rebalance: (counts: DailyCounts) => Promise<{ before: number; after: number; finish: string }>;
  /** Upgrade 5: push every upcoming day forward by `days` calendar days. */
  shiftSchedule: (fromDate: string, days: number) => Promise<string>;
  /** Pull the first undone problem from the next active day into today, keeping both days' counts balanced. */
  borrowFromNext: (dayNumber: number) => Promise<void>;
  /** Restores a day — unmerges merged topics, un-skips skipped days, or resets status/problems back to pending. */
  restoreDay: (dayNumber: number) => Promise<void>;
  userId: string | null;
}

const Ctx = createContext<PlanCtx | null>(null);

export function PlanProvider({
  userId,
  paused = false,
  children,
}: {
  userId: string;
  /** Upgrade 5c: while paused, missed-week detection is suspended. */
  paused?: boolean;
  children: ReactNode;
}) {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const checkedGap = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { days: d, meta } = await db.loadPlan(userId);
      setDays(d);
      setStartDate(meta.startDate);
      setLastSynced(meta.lastSyncedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your progress.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markSynced = () => setLastSynced(new Date().toISOString());

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : "Sync failed";
    toast.error("Could not sync to the cloud", {
      description: msg,
      action: { label: "Retry", onClick: () => void load() },
    });
  };

  /** Optimistic single-day update, confirmed to the cloud in the background. */
  const updateDay = useCallback(
    async (dayNumber: number, patch: (d: Day) => Day) => {
      let next: Day | undefined;
      setDays((prev) =>
        prev.map((d) => {
          if (d.dayNumber !== dayNumber) return d;
          next = patch(d);
          return next;
        }),
      );
      if (!next) return;
      try {
        await db.saveDay(userId, next);
        markSynced();
      } catch (e) {
        fail(e);
      }
    },
    [userId, load],
  );

  const commitSequence = useCallback(
    async (next: Day[], eventKind?: string, detail?: string) => {
      // Preserve any calendar shift already applied by postpone / pause.
      const sequenced = renumber(next, startDate, planOffset(days, startDate));
      setDays(sequenced);
      try {
        await db.saveSequence(userId, sequenced);
        if (eventKind) await db.logEvent(userId, eventKind, detail ?? "");
        markSynced();
      } catch (e) {
        fail(e);
      }
    },
    [userId, startDate, days, load],
  );

  const postpone = useCallback(
    async (dayNumber: number, newDate: string) => {
      const day = days.find((d) => d.dayNumber === dayNumber);
      if (!day) return;
      const gap = Math.max(1, diffDays(day.date, newDate));
      const next = days.map((d) =>
        d.dayNumber === dayNumber ? { ...d, status: "postponed" as const } : d,
      );
      // Sequence stays intact; only the calendar shifts, so we push the start date forward
      // for this day and everything after it by inserting `gap` placeholder-free offset.
      const shifted = next.map((d) =>
        d.dayNumber >= dayNumber ? { ...d, date: addDays(d.date, gap) } : d,
      );
      setDays(shifted);
      try {
        await db.saveSequence(userId, shifted);
        await db.logEvent(
          userId,
          "postpone",
          `Day ${dayNumber} postponed by ${gap} day(s) — plan now ends ${shifted[shifted.length - 1].date}`,
        );
        markSynced();
      } catch (e) {
        fail(e);
      }
    },
    [days, userId, load],
  );

  const mergeTomorrow = useCallback(
    async (dayNumber: number) => {
      const idx = days.findIndex((d) => d.dayNumber === dayNumber);
      if (idx === -1 || idx + 1 >= days.length) return;
      const today = days[idx];
      const tomorrow = days[idx + 1];
      const merged: Day = {
        ...today,
        topic: `${today.topic} + ${tomorrow.topic}`,
        section: today.section,
        subtopics: [...today.subtopics, ...tomorrow.subtopics],
        problems: [...today.problems, ...tomorrow.problems],
        checklist: today.checklist,
        status: "merged",
        notes: [today.notes, tomorrow.notes].filter(Boolean).join("\n"),
        mergeSnapshot: {
          originalProblemCount: today.problems.length,
          absorbedTopic: tomorrow.topic,
          absorbedSection: tomorrow.section,
          absorbedSubtopics: tomorrow.subtopics,
          baseTopic: today.topic,
        },
      };
      const next = [...days.slice(0, idx), merged, ...days.slice(idx + 2)];
      await commitSequence(
        next,
        "merge",
        `Merged "${tomorrow.topic}" into day ${dayNumber}; plan shortened by 1 day`,
      );
    },
    [days, commitSequence],
  );

  const unmerge = useCallback(
    async (dayNumber: number) => {
      const idx = days.findIndex((d) => d.dayNumber === dayNumber);
      if (idx === -1) return;
      const day = days[idx];
      if (day.status !== "merged" || !day.mergeSnapshot) return;
      const { originalProblemCount, absorbedTopic, absorbedSection, absorbedSubtopics, baseTopic } =
        day.mergeSnapshot;
      const baseProblems = day.problems.slice(0, originalProblemCount);
      const absorbedProblems = day.problems.slice(originalProblemCount);
      const restoredBase: Day = {
        ...day,
        topic: baseTopic,
        subtopics: day.subtopics.slice(0, day.subtopics.length - absorbedSubtopics.length),
        problems: baseProblems,
        status: "pending",
        mergeSnapshot: undefined,
      };
      const restoredAbsorbed: Day = {
        id: `${day.id}-unmerge-${Date.now()}`,
        dayNumber: day.dayNumber + 1,
        date: addDays(day.date, 1),
        section: absorbedSection,
        topic: absorbedTopic,
        subtopics: absorbedSubtopics,
        problems: absorbedProblems,
        checklist: newChecklist(),
        status: "pending",
        notes: "",
        revisionNotes: "",
        skipped: false,
      };
      const next = [
        ...days.slice(0, idx),
        restoredBase,
        restoredAbsorbed,
        ...days.slice(idx + 1),
      ];
      await commitSequence(
        next,
        "unmerge",
        `Unmerged day ${dayNumber} — "${absorbedTopic}" restored as a separate day; plan extended by 1 day`,
      );
    },
    [days, commitSequence],
  );

  const toggleReview = useCallback(
    async (dayNumber: number, problemName: string, flag: boolean) => {
      await updateDay(dayNumber, (d) => ({
        ...d,
        problems: d.problems.map((p) =>
          p.name === problemName ? { ...p, forReview: flag } : p,
        ),
      }));
    },
    [updateDay],
  );

  const deleteProblem = useCallback(
    async (dayNumber: number, problemName: string) => {
      const idx = days.findIndex((d) => d.dayNumber === dayNumber);
      if (idx === -1) return;
      const day = days[idx];
      const problem = day.problems.find((p) => p.name === problemName);
      if (!problem) return;
      const carried = { ...problem, done: false, carriedFromDay: dayNumber };

      const trimmedDay: Day = {
        ...day,
        problems: day.problems.filter((p) => p.name !== problemName),
        skippedProblems: [...(day.skippedProblems || []), carried],
      };

      // Find the next *active* (non-skipped) day after this one.
      const nextIdx = days.findIndex((d, i) => i > idx && !d.skipped);

      let next: Day[];
      let targetDayNumber: number;
      if (nextIdx !== -1) {
        const tomorrow = days[nextIdx];
        targetDayNumber = tomorrow.dayNumber;
        const updatedTomorrow: Day = { ...tomorrow, problems: [carried, ...tomorrow.problems] };
        next = days.map((d, i) => {
          if (i === idx) return trimmedDay;
          if (i === nextIdx) return updatedTomorrow;
          return d;
        });
      } else {
        // No active day after this one — append a brand new day to hold it.
        targetDayNumber = dayNumber + 1;
        const newDay: Day = {
          id: `${day.id}-carry-${Date.now()}`,
          dayNumber: targetDayNumber,
          date: addDays(day.date, 1),
          section: day.section,
          topic: day.topic,
          subtopics: day.subtopics,
          problems: [carried],
          checklist: newChecklist(),
          status: "pending",
          notes: "",
          revisionNotes: "",
          skipped: false,
        };
        next = [...days.slice(0, idx), trimmedDay, ...days.slice(idx + 1), newDay];
      }

      await commitSequence(
        next,
        "delete_problem",
        `Moved '${problemName}' from Day ${dayNumber} to Day ${targetDayNumber}`,
      );
    },
    [days, commitSequence],
  );

  const deleteDay = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (dayNumber: number, _mode: "shrink" | "placeholder" = "shrink") => {
      const day = days.find((d) => d.dayNumber === dayNumber);
      if (!day) return;
      const next = setSkippedById(days, day.id, true, startDate);
      await commitSequence(
        next,
        "delete_day",
        `Deleted day ${dayNumber} ("${day.topic}") and shifted schedule forward`,
      );
      toast.info(`Deleted day ${dayNumber} ("${day.topic}")`, {
        description: "Schedule shifted forward. Want it back? Go to the Topic section and unskip it.",
      });
    },
    [days, startDate, commitSequence],
  );

  const skipTopic = useCallback(
    async (dayNumber: number, skip: boolean) => {
      // When a day is already skipped its dayNumber is negative, but it still
      // uniquely identifies it — find it as normal, then act on it by id.
      const day = days.find((d) => d.dayNumber === dayNumber);
      if (!day) return;
      const next = setSkippedById(days, day.id, skip, startDate);
      await commitSequence(
        next,
        skip ? "skip_topic" : "unskip_topic",
        skip ? `Skipped topic '${day.topic}'` : `Un-skipped topic '${day.topic}'`,
      );
      toast.info(skip ? "Topic skipped" : "Topic un-skipped", {
        description: skip
          ? "Hidden from your plan — every later day shifted forward to fill the gap."
          : "It's back, with every problem restored exactly as it was.",
      });
    },
    [days, startDate, commitSequence],
  );

  const skipDay = useCallback(
    async (dayNumber: number) => {
      const day = days.find((d) => d.dayNumber === dayNumber);
      if (!day) return;
      const next = setSkipped(days, dayNumber, true, startDate);
      await commitSequence(next, "skip_day", `Day ${dayNumber} ("${day.topic}") skipped`);
      toast.info(`Day ${dayNumber} skipped`, {
        description:
          "Every later day shifted forward to fill the gap. Find it under Topics → Skipped to bring it back.",
      });
    },
    [days, startDate, commitSequence],
  );

  const skipSection = useCallback(
    async (section: string, skip: boolean) => {
      const sectionDayNumbers = days
        .filter((d) =>
          d.section === section &&
          (skip ? !d.skipped && deriveStatus(d) !== "completed" : d.skipped),
        )
        .map((d) => d.dayNumber);

      if (sectionDayNumbers.length === 0) {
        toast.error(
          skip ? "No pending days in this section to skip." : "No skipped days in this section to restore.",
        );
        return;
      }

      const next = setSkipped(days, sectionDayNumbers, skip, startDate);
      await commitSequence(
        next,
        skip ? "skip_section" : "unskip_section",
        skip ? `Section "${section}" skipped` : `Section "${section}" un-skipped`,
      );
      toast.info(skip ? "Section skipped" : "Section un-skipped", {
        description: skip
          ? `"${section}" is hidden and every later day shifted forward to fill the gap.`
          : `"${section}" is back, with every problem restored exactly as it was.`,
      });
    },
    [days, startDate, commitSequence],
  );

  const resetAll = useCallback(async () => {
    setLoading(true);
    try {
      const { days: d, meta } = await db.seedPlan(userId);
      setDays(d);
      setStartDate(meta.startDate);
      markSynced();
      await db.logEvent(userId, "reset", "All progress reset");
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const insertRevisionDay = useCallback(
    async (afterDayNumber: number) => {
      const idx = days.findIndex((d) => d.dayNumber === afterDayNumber);
      if (idx === -1) return;
      const completedSections = Array.from(
        new Set(
          days
            .slice(0, idx + 1)
            .filter((d) => d.problems.some((p) => p.done))
            .map((d) => d.section),
        ),
      );
      const pool = days.slice(0, idx + 1);
      const picks = completedSections.flatMap((section) => {
        const problems = pool
          .filter((d) => d.section === section)
          .flatMap((d) => d.problems)
          .sort((a, b) => Number(b.isHard) - Number(a.isHard));
        // Deduplicate by name (a problem may appear on multiple days after borrow/delete cascades)
        const seen = new Set<string>();
        const unique = problems.filter((p) => {
          if (seen.has(p.name)) return false;
          seen.add(p.name);
          return true;
        });
        return unique.slice(0, 2).map((p) => ({ ...p, done: false }));
      });
      const revision: Day = {
        id: `revision-${Date.now()}`,
        dayNumber: afterDayNumber + 1,
        date: addDays(days[idx].date, 1),
        section: "Revision",
        topic: "Revision Day — recap of completed sections",
        subtopics: completedSections.length ? completedSections : ["Nothing completed yet"],
        problems: picks.slice(0, 6),
        checklist: newChecklist(),
        status: "revision",
        notes: "",
        revisionNotes: "",
        skipped: false,
      };
      const next = [...days.slice(0, idx + 1), revision, ...days.slice(idx + 1)];
      const sequenced = renumber(next, startDate);
      await commitSequence(
        next,
        "revision_day",
        `Revision Day inserted on ${sequenced[idx + 1].date}; remaining days pushed forward by 1. New finish date: ${sequenced[sequenced.length - 1].date}`,
      );
      toast.info("Revision Day added", {
        description: `Inserted on ${sequenced[idx + 1].date}. Remaining days pushed forward by 1 — new finish date ${sequenced[sequenced.length - 1].date}.`,
      });
    },
    [days, commitSequence, startDate],
  );

  // A10: auto-detect a missed week on load.
  useEffect(() => {
    if (loading || paused || checkedGap.current || days.length === 0) return;
    checkedGap.current = true;
    const today = todayIso();
    const past = days.filter((d) => d.date < today);
    const pending = past.filter((d) => !isDayComplete(d) && d.status !== "revision" && !d.skipped);
    let streak = 0;
    for (let i = past.length - 1; i >= 0; i--) {
      if (!isDayComplete(past[i]) && past[i].status !== "revision" && !past[i].skipped) streak += 1;
      else if (past[i].skipped) continue;
      else break;
    }
    const alreadyHasRecent =
      days[past.length]?.status === "revision" || past[past.length - 1]?.status === "revision";
    if ((streak >= 7 || pending.length >= 7) && past.length > 0 && !alreadyHasRecent) {
      void insertRevisionDay(past[past.length - 1].dayNumber);
    }
  }, [loading, paused, days, insertRevisionDay]);

  /**
   * Upgrade 5: the user changed how many problems they want per day.
   * Completed days are untouched; every remaining problem is re-packed into
   * newly sized days and the calendar is re-derived from the sequence.
   */
  const rebalance = useCallback(
    async (counts: DailyCounts) => {
      const before = days.length;
      const next = rebalanceRemaining(days, counts, startDate, planOffset(days, startDate));
      setDays(next);
      const finish = next[next.length - 1]?.date ?? startDate;
      try {
        await db.saveSequence(userId, next);
        await db.logEvent(
          userId,
          "rebalance",
          `Daily pace set to ${counts.easy} easy / ${counts.medium} medium / ${counts.hard} hard — plan is now ${next.length} days (was ${before}), finishing ${finish}`,
        );
        markSynced();
      } catch (e) {
        fail(e);
      }
      return { before, after: next.length, finish };
    },
    [days, startDate, userId],
  );

  /** Upgrade 5c: pause / resume simply slides the calendar, never the sequence. */
  const shiftSchedule = useCallback(
    async (fromDate: string, byDays: number) => {
      const first = days.find((d) => d.date >= fromDate);
      if (!first || byDays === 0) return days[days.length - 1]?.date ?? fromDate;
      const next = shiftFrom(days, first.dayNumber, byDays);
      setDays(next);
      const finish = next[next.length - 1].date;
      try {
        await db.saveSequence(userId, next);
        await db.logEvent(
          userId,
          byDays > 0 ? "pause" : "resume",
          `Schedule shifted by ${byDays} day(s) from ${fromDate} — new finish date ${finish}`,
        );
        markSynced();
      } catch (e) {
        fail(e);
      }
      return finish;
    },
    [days, userId],
  );

  const borrowFromNext = useCallback(
    async (dayNumber: number) => {
      const idx = days.findIndex((d) => d.dayNumber === dayNumber);
      if (idx === -1) return;
      // Find the next active (non-skipped) day.
      const nextIdx = days.findIndex((d, i) => i > idx && !d.skipped);
      if (nextIdx === -1) return;
      const nextDay = days[nextIdx];
      // Pick the first undone problem from the next day.
      const borrowedIdx = nextDay.problems.findIndex((p) => !p.done);
      if (borrowedIdx === -1) return;
      const borrowed = { ...nextDay.problems[borrowedIdx], borrowedFromDay: nextDay.dayNumber };
      // Add it to today, remove it from next day.
      const updatedToday: Day = {
        ...days[idx],
        problems: [...days[idx].problems, { ...borrowed }],
      };
      const updatedNext: Day = {
        ...nextDay,
        problems: nextDay.problems.filter((_, i) => i !== borrowedIdx),
      };
      const next = days.map((d, i) => {
        if (i === idx) return updatedToday;
        if (i === nextIdx) return updatedNext;
        return d;
      });
      await commitSequence(
        next,
        "borrow_problem",
        `Borrowed '${borrowed.name}' from Day ${nextDay.dayNumber} into Day ${dayNumber}`,
      );
    },
    [days, commitSequence],
  );

  const restoreDay = useCallback(
    async (dayNumber: number) => {
      const day = days.find((d) => d.dayNumber === dayNumber || (d.skipped && Math.abs(d.dayNumber) === Math.abs(dayNumber)));
      if (!day) return;

      if (day.status === "merged" || day.mergeSnapshot) {
        await unmerge(day.dayNumber);
        toast.success(`Restored merged topic "${day.topic}" into separate days!`);
      } else if (day.skipped) {
        await skipTopic(day.dayNumber, false);
        toast.success(`Restored skipped topic "${day.topic}"!`);
      } else if (day.status === "postponed") {
        await updateDay(day.dayNumber, (d) => ({
          ...d,
          status: "pending" as const,
        }));
        toast.success(`Restored postponed status on Day ${day.dayNumber}!`);
      } else if (day.skippedProblems && day.skippedProblems.length > 0) {
        // Return skipped/deleted problem back to this day!
        const probToRestore = day.skippedProblems[day.skippedProblems.length - 1];
        const currentIdx = days.findIndex((d) => d.dayNumber === day.dayNumber);
        
        if (currentIdx !== -1) {
          const cleanProb = { ...probToRestore, carriedFromDay: undefined };
          const updatedCurrent: Day = {
            ...day,
            problems: [...day.problems, cleanProb],
            skippedProblems: day.skippedProblems.filter((p) => p.name !== probToRestore.name),
          };
          const next = days.map((d, i) => {
            if (i === currentIdx) return updatedCurrent;
            return {
              ...d,
              problems: d.problems.filter((p) => p.name !== probToRestore.name),
            };
          });
          await commitSequence(
            next,
            "restore_problem",
            `Restored problem '${probToRestore.name}' back to Day ${day.dayNumber}`,
          );
          toast.success(`Restored "${probToRestore.name}" back to Day ${day.dayNumber}!`);
        }
      }
    },
    [days, unmerge, skipTopic, updateDay, commitSequence],
  );

  const value = useMemo<PlanCtx>(
    () => ({
      days,
      loading,
      error,
      lastSynced,
      startDate,
      reload: () => void load(),
      updateDay,
      postpone,
      mergeTomorrow,
      unmerge,
      deleteProblem,
      deleteDay,
      toggleReview,
      skipTopic,
      skipDay,
      skipSection,
      resetAll,
      insertRevisionDay,
      rebalance,
      shiftSchedule,
      borrowFromNext,
      restoreDay,
      userId,
    }),
    [
      days,
      loading,
      error,
      lastSynced,
      startDate,
      load,
      updateDay,
      postpone,
      mergeTomorrow,
      unmerge,
      deleteProblem,
      deleteDay,
      toggleReview,
      skipTopic,
      skipDay,
      skipSection,
      resetAll,
      insertRevisionDay,
      rebalance,
      shiftSchedule,
      borrowFromNext,
      restoreDay,
      userId,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePlan = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlan must be used inside PlanProvider");
  return ctx;
};