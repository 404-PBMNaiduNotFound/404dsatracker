export type Difficulty = "Easy" | "Medium" | "Hard" | "Advanced" | "Expert" | "Multiple Choice" | (string & {});
export type DayStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "postponed"
  | "merged"
  | "revision"
  | "skipped";

export interface Problem {
  name: string;
  difficulty: Difficulty;
  platform: string;
  link: string;
  /** false when `link` is only a site search fallback, not a confirmed problem page */
  linkVerified: boolean;
  takeUForwardLink: string | null;
  estTime: number;
  done: boolean;
  isHard: boolean;
  /** Flagged from Today for a later look — shows up in the Review tab. */
  forReview?: boolean;
}


export interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Snapshot stored on a merged day so it can be cleanly split back. */
export interface MergeSnapshot {
  /** Number of problems that belonged to the original (first) day before merging. */
  originalProblemCount: number;
  /** Topic of the day that was absorbed (tomorrow). */
  absorbedTopic: string;
  /** Section of the absorbed day. */
  absorbedSection: string;
  /** Subtopics of the absorbed day. */
  absorbedSubtopics: string[];
  /** Original topic of the base day before merging. */
  baseTopic: string;
}

export interface Day {
  id: string;
  dayNumber: number;
  date: string; // yyyy-mm-dd
  section: string;
  topic: string;
  subtopics: string[];
  problems: Problem[];
  checklist: ChecklistItem[];
  status: DayStatus;
  notes: string;
  revisionNotes: string;
  skipped: boolean;
  /** Roadmap level: "Level 1" (Basics), "Level 2" (Intermediate), "Level 3" (Advanced) */
  level?: string;
  /** Present only on days with status "merged" — used to restore the original two days. */
  mergeSnapshot?: MergeSnapshot;
}

// Bumped whenever the master problem database (src/lib/master-problems.ts /
// practice-problems.ts) changes shape or content in a way that requires every
// user's stored plan to be regenerated. See `loadPlan` in db.ts, which
// auto-reseeds any plan whose stored schemaVersion is behind this one.
export const SCHEMA_VERSION = 2;

export const weekNumber = (dayNumber: number) => Math.ceil(dayNumber / 7);
