/**
 * NEW FILE — Upgrade 4: streaks, badges and weekly stats.
 * Everything is derived from the existing Day/Problem data using the same
 * `isDayComplete` / `dayProgress` primitives already in plan.ts.
 */
import { dayProgress, diffDays, isDayComplete, todayIso, TOTAL_PROBLEMS } from "./plan";
import type { Day } from "./types";

/** A day "counts" for the streak when at least one problem or checklist item is ticked. */
export const dayTouched = (d: Day) =>
  d.problems.some((p) => p.done) || d.checklist.some((c) => c.done);

export function currentStreak(days: Day[], today = todayIso()): number {
  const past = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if (dayTouched(past[i])) streak += 1;
    else if (i === past.length - 1 && past[i].date === today) continue; // today still open
    else break;
  }
  return streak;
}

export function longestStreak(days: Day[]): number {
  let best = 0;
  let run = 0;
  [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((d) => {
      if (dayTouched(d)) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    });
  return best;
}

export interface Badge {
  code: string;
  label: string;
  description: string;
  earned: boolean;
}

export function computeBadges(days: Day[]): Badge[] {
  const counted = days.filter((d) => !d.skipped);
  const solved = counted.reduce((a, d) => a + dayProgress(d).done, 0);
  const streak = Math.max(currentStreak(days), longestStreak(days));
  const total = counted.reduce((a, d) => a + dayProgress(d).total, 0) || TOTAL_PROBLEMS;

  const sectionDone = new Map<string, { done: number; total: number }>();
  counted.forEach((d) => {
    const cur = sectionDone.get(d.section) ?? { done: 0, total: 0 };
    const p = dayProgress(d);
    sectionDone.set(d.section, { done: cur.done + p.done, total: cur.total + p.total });
  });

  const badges: Badge[] = [
    { code: "streak_3", label: "3-day streak", description: "Three days in a row", earned: streak >= 3 },
    { code: "streak_7", label: "7-day streak", description: "A full week without missing", earned: streak >= 7 },
    { code: "streak_30", label: "30-day streak", description: "A month of consistency", earned: streak >= 30 },
    { code: "first_10", label: "First 10 problems", description: "You are off the mark", earned: solved >= 10 },
    { code: "first_50", label: "First 50 problems", description: "Momentum secured", earned: solved >= 50 },
    { code: "first_100", label: "100 problems", description: "Triple digits", earned: solved >= 100 },
    {
      code: "halfway",
      label: `Halfway there — ${solved}/${total}`,
      description: "Half the sheet is behind you",
      earned: solved >= Math.floor(total / 2),
    },
    {
      code: "finisher",
      label: "Sheet complete",
      description: "Every problem ticked",
      earned: total > 0 && solved >= total,
    },
    {
      code: "day_perfect_10",
      label: "10 perfect days",
      description: "Ten fully completed days",
      earned: counted.filter(isDayComplete).length >= 10,
    },
  ];

  [...sectionDone.entries()]
    .filter(([, v]) => v.total > 0 && v.done === v.total)
    .forEach(([section]) =>
      badges.push({
        code: `section_${section}`,
        label: `Section complete: ${section}`,
        description: "Every problem in this section is done",
        earned: true,
      }),
    );

  return badges;
}

export interface WeeklyStats {
  problemsSolved: number;
  minutesSpent: number;
  sectionsTouched: string[];
  daysActive: number;
}

/** Stats for the trailing 7 calendar days (inclusive of today). */
export function weeklyStats(days: Day[], today = todayIso()): WeeklyStats {
  const inWindow = days.filter((d) => {
    const delta = diffDays(d.date, today);
    return delta >= 0 && delta < 7;
  });
  const solvedProblems = inWindow.flatMap((d) => d.problems.filter((p) => p.done));
  return {
    problemsSolved: solvedProblems.length,
    minutesSpent: solvedProblems.reduce((a, p) => a + p.estTime, 0),
    sectionsTouched: Array.from(new Set(inWindow.filter(dayTouched).map((d) => d.section))),
    daysActive: inWindow.filter(dayTouched).length,
  };
}

/** Problems-solved-per-day trend for the chart on the Progress page. */
export function solvedTrend(days: Day[], limit = 30, today = todayIso()) {
  return days
    .filter((d) => d.date <= today)
    .slice(-limit)
    .map((d) => ({
      day: `D${d.dayNumber}`,
      date: d.date,
      solved: dayProgress(d).done,
      planned: dayProgress(d).total,
    }));
}

export function difficultySplit(days: Day[]) {
  const base: Record<string, { done: number; total: number }> = {
    Easy: { done: 0, total: 0 },
    Medium: { done: 0, total: 0 },
    Hard: { done: 0, total: 0 },
  };
  days
    .filter((d) => !d.skipped)
    .forEach((d) =>
      d.problems.forEach((p) => {
        if (base[p.difficulty]) {
          base[p.difficulty].total += 1;
          if (p.done) base[p.difficulty].done += 1;
        }
      }),
    );
  return (Object.keys(base) as ("Easy" | "Medium" | "Hard")[]).map((k) => ({
    difficulty: k,
    done: base[k].done,
    remaining: base[k].total - base[k].done,
  }));
}
