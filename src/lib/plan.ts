import { SECTIONS, type SeedProblem } from "./a2z-data";
import type { ChecklistItem, Day, Difficulty, Problem } from "./types";

export const START_DATE = "2026-08-01";
export const BASE_DAYS = 120;

export const CHECKLIST_TEMPLATE = [
  "Watch video",
  "Read notes",
  "Understand brute force",
  "Derive better approach",
  "Code it",
  "Optimize",
  "Dry run",
  "Submit",
  "Read editorial",
  "Revise yesterday",
  "Push to GitHub",
  "Update notes",
];

export const newChecklist = (): ChecklistItem[] =>
  CHECKLIST_TEMPLATE.map((label) => ({ label, done: false }));

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  );
}

export const todayIso = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * Upgrade 1: prefer the verified direct problem page. Only fall back to the
 * old search URL when we could not confirm a canonical link.
 */
function platformLink(p: SeedProblem): string {
  if (p.l) return p.l;
  const q = encodeURIComponent(p.n);
  if (p.p === "LeetCode") return `https://leetcode.com/problemset/?search=${q}`;
  if (p.p === "GFG") return `https://www.geeksforgeeks.org/search/?gq=${q}`;
  return `https://www.naukri.com/code360/search?q=${q}`;
}

const estFor = (d: Difficulty) => (d === "Easy" ? 15 : d === "Medium" ? 30 : 45);

function toProblem(p: SeedProblem): Problem {
  return {
    name: p.n,
    difficulty: p.d,
    platform: p.p,
    link: platformLink(p),
    linkVerified: Boolean(p.l),
    // No hardcoded TUF metadata in the problem database — the Google search
    // link (see ProblemRow.tsx) already includes takeuforward.org in its query.
    takeUForwardLink: null,
    estTime: estFor(p.d),
    done: false,
    isHard: p.d === "Hard",
  };
}


export const TOTAL_PROBLEMS = SECTIONS.reduce((a, s) => a + s.problems.length, 0);

/** Distribute the topic sections across BASE_DAYS days, preserving order. */
function dayAllocation(): number[] {
  const counts = SECTIONS.map((s) => s.problems.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const raw = counts.map((c) => (c / total) * BASE_DAYS);
  const alloc = raw.map((r) => Math.max(1, Math.floor(r)));
  let remaining = BASE_DAYS - alloc.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (remaining > 0) {
    alloc[order[k % order.length].i] += 1;
    remaining -= 1;
    k += 1;
  }
  while (remaining < 0) {
    const idx = alloc.findIndex((v, i) => v > 1 && counts[i] / v < 3);
    alloc[idx === -1 ? alloc.indexOf(Math.max(...alloc)) : idx] -= 1;
    remaining += 1;
  }
  return alloc;
}

/**
 * Teacher/student rhythm: Monday–Saturday cover new topics, and every Sunday
 * (relative to the plan's own start date) is set aside as a Weekly Revision
 * day listing that week's study days so the student can revisit and
 * re-solve everything before moving on.
 *
 * This is factored out of `seedDays` so `rebalanceRemaining` can re-run the
 * exact same interleaving after it rebuilds the tail of a plan — otherwise a
 * rebalance (which flattens every remaining problem and repacks days purely
 * by pace) would silently drop every Sunday revision day it touches.
 *
 * `startPosition` is the count of *active* (non-skipped) days that will sit
 * ahead of `contentDays` in the final sequence once merged back in. Every
 * entry — content or revision — consumes exactly one calendar day and one
 * dayNumber, in lockstep, so `startPosition` doubles as both the Sunday/weekday
 * offset and the base dayNumber to keep `revisionDayNumbers` correct; the
 * caller's later `renumber()` call re-derives the same numbers as long as
 * order is preserved, so this only needs to be self-consistent, not final.
 */
function interleaveWeeklyRevision(
  contentDays: Day[],
  startDate: string,
  startPosition = 0,
): Day[] {
  const startDow = new Date(`${startDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const days: Day[] = [];
  let contentIdx = 0;
  let weekDayNumbers: number[] = [];
  let position = startPosition;
  let dayNumber = startPosition;

  while (contentIdx < contentDays.length) {
    const isSunday = (startDow + position) % 7 === 0;
    dayNumber += 1;
    if (isSunday) {
      days.push({
        id: `revision-week-${Math.ceil(dayNumber / 7)}`,
        dayNumber: 0,
        date: startDate,
        section: "Revision",
        topic: "Weekly Revision",
        subtopics: [],
        problems: [],
        checklist: [],
        status: "pending",
        notes: "",
        revisionNotes: "",
        skipped: false,
        isRevisionDay: true,
        revisionDayNumbers: weekDayNumbers,
      });
      weekDayNumbers = [];
    } else {
      const c = contentDays[contentIdx];
      contentIdx += 1;
      days.push(c);
      weekDayNumbers.push(dayNumber);
    }
    position += 1;
  }

  return days;
}

export function seedDays(startDate = START_DATE): Day[] {
  const alloc = dayAllocation();
  const contentDays: Omit<Day, "dayNumber" | "date">[] = [];

  SECTIONS.forEach((section, si) => {
    const nDays = alloc[si];
    const problems = section.problems;
    const per = Math.ceil(problems.length / nDays);
    for (let i = 0; i < nDays; i++) {
      const chunk = problems.slice(i * per, (i + 1) * per);
      const subCount = Math.max(1, Math.ceil(section.subtopics.length / nDays));
      const subs = section.subtopics.slice(i * subCount, (i + 1) * subCount);
      contentDays.push({
        id: `${slug(section.section)}-${i + 1}`,
        section: section.section,
        topic: nDays > 1 ? `${section.section} — Part ${i + 1}` : section.section,
        subtopics: subs.length ? subs : section.subtopics.slice(0, 2),
        problems: chunk.map(toProblem),
        checklist: newChecklist(),
        status: "pending",
        notes: "",
        revisionNotes: "",
        skipped: false,
        level: section.level,
      });
    }
  });

  const placeholder: Day[] = contentDays.map((c) => ({ ...c, dayNumber: 0, date: startDate }));
  const interleaved = interleaveWeeklyRevision(placeholder, startDate, 0);
  const days: Day[] = interleaved.map((d, i) => ({
    ...d,
    dayNumber: i + 1,
    date: addDays(startDate, i),
  }));

  return renumber(days, startDate);
}

/**
 * Re-derive dayNumber + date from array order. Sequence is the source of truth.
 * `offset` keeps any calendar shift already applied by postpone / pause so a
 * later merge or delete does not silently undo it.
 *
 * Skipped days do NOT consume a slot in the sequence: every active day is
 * renumbered 1..N back-to-back, which is what makes "Day 3" become "Day 1"
 * once Days 1 and 2 are skipped. Skipped days are parked on a distinct
 * negative dayNumber band (-1, -2, ...) instead of keeping their old number —
 * leaving their old number in place would eventually collide with an active
 * day that gets renumbered into that same slot, which could make actions
 * like postpone/merge silently grab the wrong day.
 */
export function renumber(days: Day[], startDate = START_DATE, offset = 0): Day[] {
  let seq = 0;
  let skippedSeq = 0;
  return days.map((d) => {
    if (d.skipped) {
      skippedSeq += 1;
      return { ...d, dayNumber: -skippedSeq };
    }
    seq += 1;
    return { ...d, dayNumber: seq, date: addDays(startDate, seq - 1 + offset) };
  });
}

/**
 * Current calendar offset of a plan versus its pure start-date schedule.
 *
 * Anchors on the first *active* (non-skipped) day rather than literally
 * `days[0]`. Skipped days don't get their date refreshed by `renumber` (it's
 * irrelevant to them), so if a skipped day happened to sit first in the
 * array, its stale date would get read as the offset here and that wrong
 * offset would then get baked into every future renumber — which is exactly
 * what caused "today" to keep drifting to a later and later date after a
 * few skips. Comparing an active day's actual date against its own expected
 * date (from its current dayNumber) sidesteps that regardless of position.
 */
export const planOffset = (days: Day[], startDate = START_DATE) => {
  const anchor = days.find((d) => !d.skipped);
  if (!anchor) return 0;
  const expected = addDays(startDate, anchor.dayNumber - 1);
  return diffDays(expected, anchor.date);
};


export const dayProgress = (d: Day) => {
  const total = d.problems.length;
  const done = d.problems.filter((p) => p.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
};

export function deriveStatus(d: Day): Day["status"] {
  if (d.skipped) return "skipped";
  if (d.status === "postponed" || d.status === "merged" || d.status === "revision") return d.status;
  const { done, total } = dayProgress(d);
  const checks = d.checklist.filter((c) => c.done).length;
  if (total > 0 && done === total) return "completed";
  if (done > 0 || checks > 0) return "in_progress";
  return "pending";
}

export const isDayComplete = (d: Day) =>
  d.problems.length > 0 && d.problems.every((p) => p.done);

export const STATUS_META: Record<Day["status"], { icon: string; label: string; className: string }> =
{
  pending: { icon: "⏳", label: "Pending", className: "text-muted-foreground" },
  in_progress: { icon: "◐", label: "In progress", className: "text-warning" },
  completed: { icon: "✅", label: "Completed", className: "text-success" },
  postponed: { icon: "⏸", label: "Postponed", className: "text-warning" },
  merged: { icon: "🔀", label: "Merged", className: "text-accent-foreground" },
  revision: { icon: "🔁", label: "Revision", className: "text-primary" },
  skipped: { icon: "⛔", label: "Skipped", className: "text-muted-foreground" },
};
/* ------------------------------------------------------------------ */
/* Upgrade 5b: per-difficulty daily problem counts                      */
/* ------------------------------------------------------------------ */

export interface DailyCounts {
  easy: number;
  medium: number;
  hard: number;
}

export const DEFAULT_DAILY_COUNTS: DailyCounts = { easy: 4, medium: 3, hard: 2 };

/**
 * Cost of one problem as a fraction of a day. 4 easy/day => each easy costs
 * 0.25 of a day; 2 hard/day => each hard costs 0.5. Mixed days therefore stay
 * honest: an easy-heavy topic gets more problems, a hard topic gets fewer.
 */
export const problemCost = (d: Difficulty, counts: DailyCounts) => {
  const per = d === "Easy" ? counts.easy : d === "Medium" ? counts.medium : counts.hard;
  return 1 / Math.max(1, per);
};

/** How many days a bag of problems needs at the given pace. */
export const daysNeeded = (problems: Problem[], counts: DailyCounts) =>
  Math.max(1, Math.ceil(problems.reduce((a, p) => a + problemCost(p.difficulty, counts), 0)));

/**
 * Redistribute every *not yet completed* problem across freshly-sized days,
 * using the per-difficulty pace. Completed days are never touched, so history
 * is preserved. Section/topic order is preserved — the sequence stays the
 * source of truth and dates are re-derived by `renumber()` afterwards.
 */
export function rebalanceRemaining(
  days: Day[],
  counts: DailyCounts,
  startDate = START_DATE,
  offset = 0,
): Day[] {
  const firstOpen = days.findIndex((d) => !isDayComplete(d) && d.status !== "merged" && !d.skipped);
  if (firstOpen === -1) return days;

  const keep = days.slice(0, firstOpen);
  const rest = days.slice(firstOpen);

  // Skipped days are never redistributed and never contribute to the pending
  // bag — they're preserved as-is, just pulled out of the reshuffle.
  const skippedRest = rest.filter((d) => d.skipped);
  // Old revision days in the touched range are dropped too — they carry no
  // problems of their own, and fresh ones get re-interleaved below once the
  // rebuilt content days are known, keeping the Sunday rhythm intact instead
  // of silently losing every revision day the rebalance touches.
  const activeRest = rest.filter((d) => !d.skipped && !d.isRevisionDay);

  // Flatten remaining work, keeping syllabus order. Anything already ticked in
  // a partially-done day stays with that problem so nothing is lost.
  const pending: { problem: Problem; section: string; subtopics: string[]; level?: string }[] = [];
  activeRest.forEach((d) => {
    d.problems.forEach((p) => {
      if (!p.done) pending.push({ problem: p, section: d.section, subtopics: d.subtopics, level: d.level });
    });
  });
  if (pending.length === 0) return days;

  const carriedDone = activeRest.flatMap((d) => d.problems.filter((p) => p.done));

  const rebuilt: Day[] = [];
  let bucket: typeof pending = [];
  let dayBudget = 0;
  let currentSection = pending[0].section;
  let partIndex = 1;

  const flush = () => {
    if (bucket.length === 0) return;
    const section = bucket[0].section;
    const subs = Array.from(new Set(bucket.flatMap((b) => b.subtopics))).slice(0, 4);
    const sameSection = rebuilt.filter((d) => d.section === section).length;
    rebuilt.push({
      id: `${slug(section)}-r${rebuilt.length + 1}`,
      dayNumber: 0,
      date: startDate,
      section,
      topic: sameSection > 0 ? `${section} — Part ${sameSection + 1}` : section,
      subtopics: subs.length ? subs : [section],
      problems: bucket.map((b) => b.problem),
      checklist: newChecklist(),
      status: "pending",
      notes: "",
      revisionNotes: "",
      skipped: false,
      level: bucket[0]?.level,
    });
    bucket = [];
    dayBudget = 0;
    partIndex += 1;
  };

  pending.forEach((item) => {
    const cost = problemCost(item.problem.difficulty, counts);

    // Flush day ONLY when cumulative workload budget + cost exceeds 1 full day capacity (1.0001)
    if (dayBudget > 0 && dayBudget + cost > 1.0001) {
      flush();
    }

    bucket.push(item);
    dayBudget += cost;
  });
  flush();

  // Park the already-solved problems from the reshuffled tail on the first new
  // day so the history and the totals both stay intact.
  if (carriedDone.length && rebuilt.length) {
    rebuilt[0] = { ...rebuilt[0], problems: [...carriedDone, ...rebuilt[0].problems] };
  }

  // Re-interleave Sunday Weekly Revision days into the freshly rebuilt tail,
  // continuing the same Mon–Sat rhythm from wherever `keep`'s active days
  // left off (skipped days don't consume a calendar slot, so they're
  // excluded from the count).
  const startPosition = keep.filter((d) => !d.skipped).length;
  const interleaved = interleaveWeeklyRevision(rebuilt, startDate, startPosition);

  return renumber([...keep, ...skippedRest, ...interleaved], startDate, offset);
}

/* ------------------------------------------------------------------ */
/* Skip Day / Skip Topic / Skip Section                                 */
/* ------------------------------------------------------------------ */

/**
 * Marks the given day(s) — pass a single dayNumber or an array — as skipped
 * or active again, then re-derives the sequence with `renumber`.
 *
 * Deliberately does NOT touch `problems`: a skipped day keeps every one of
 * its problems exactly as they were (done or not), it's simply excluded
 * from the active 1..N day-number sequence, which is what makes every later
 * day shift forward to fill the gap. Un-skipping just puts it back in that
 * sequence — since nothing was ever moved off the day, everything reappears
 * exactly as it was. (An earlier version cascaded problems onto other days
 * when skipping, which meant un-skipping couldn't get them back — that
 * cascade has been removed for exactly that reason.)
 *
 * All requested days are applied together in one pass so day numbers stay
 * consistent throughout, whether this is one day (Skip Day / Skip Topic) or
 * a whole section's worth (Skip Section).
 */
export function setSkipped(
  days: Day[],
  dayNumbers: number | number[],
  skipped: boolean,
  startDate = START_DATE,
): Day[] {
  const set = new Set(Array.isArray(dayNumbers) ? dayNumbers : [dayNumbers]);
  if (set.size === 0) return days;

  const result = days.map((d) =>
    set.has(d.dayNumber)
      ? { ...d, skipped, status: skipped ? ("skipped" as const) : ("pending" as const) }
      : d,
  );

  return renumber(result, startDate);
}

/**
 * Same as setSkipped but matches by `day.id` instead of `dayNumber`.
 * Used when a day may already have a negative dayNumber (i.e. it is currently
 * skipped) and we still need to act on it — matching by the stable `id` field
 * avoids the negative-number collision problem.
 */
export function setSkippedById(
  days: Day[],
  ids: string | string[],
  skipped: boolean,
  startDate = START_DATE,
): Day[] {
  const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
  if (idSet.size === 0) return days;

  const result = days.map((d) =>
    idSet.has(d.id)
      ? { ...d, skipped, status: skipped ? ("skipped" as const) : ("pending" as const) }
      : d,
  );

  return renumber(result, startDate);
}



export interface PauseWindow {
  from: string;
  to: string;
}

/** Shift the calendar (not the sequence) of every day from `fromDayNumber` on. */
export const shiftFrom = (days: Day[], fromDayNumber: number, byDays: number): Day[] =>
  days.map((d) => (d.dayNumber >= fromDayNumber ? { ...d, date: addDays(d.date, byDays) } : d));

export const isWithinPause = (iso: string, pause: PauseWindow | null) =>
  Boolean(pause && iso >= pause.from && iso < pause.to);

/* ------------------------------------------------------------------ */
/* Per-difficulty daily problem allocation for Topics view             */
/* ------------------------------------------------------------------ */

/**
 * Given a list of problems (e.g. all problems in a topic's single day),
 * returns which problems the user CAN solve today given their daily limits.
 *
 * Logic:
 * - User sets 4 Easy / 3 Medium / 2 Hard per day.
 * - A topic day has e.g. 2 Easy + 2 Medium + 1 Hard → all fit (under limits).
 * - A topic day has 6 Easy + 4 Medium + 3 Hard → only first 4E/3M/2H are shown.
 * - If this topic exhausts the daily capacity, leftover capacity from other
 *   difficulties is NOT reallocated to compensate — the limits are per-type.
 *
 * Returns problems that fit within today's per-difficulty quota.
 */
export function problemsWithinDailyLimit(
  problems: Problem[],
  counts: DailyCounts,
): Problem[] {
  let easy = 0, medium = 0, hard = 0;
  const result: Problem[] = [];
  for (const p of problems) {
    if (p.difficulty === "Easy" && easy < counts.easy) {
      result.push(p);
      easy++;
    } else if (p.difficulty === "Medium" && medium < counts.medium) {
      result.push(p);
      medium++;
    } else if (p.difficulty === "Hard" && hard < counts.hard) {
      result.push(p);
      hard++;
    }
  }
  return result;
}

/**
 * How much daily capacity remains after allocating problems from `problems`
 * against `counts`. Returns the leftover slots per difficulty.
 * Used to pull overflow problems from the next topic.
 */
export function remainingCapacity(
  problems: Problem[],
  counts: DailyCounts,
): DailyCounts {
  const used = { easy: 0, medium: 0, hard: 0 };
  problems.forEach((p) => {
    if (p.difficulty === "Easy") used.easy = Math.min(used.easy + 1, counts.easy);
    else if (p.difficulty === "Medium") used.medium = Math.min(used.medium + 1, counts.medium);
    else used.hard = Math.min(used.hard + 1, counts.hard);
  });
  return {
    easy: Math.max(0, counts.easy - used.easy),
    medium: Math.max(0, counts.medium - used.medium),
    hard: Math.max(0, counts.hard - used.hard),
  };
}