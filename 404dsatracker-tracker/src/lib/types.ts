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
  /** Day number from which this problem was borrowed. */
  borrowedFromDay?: number;
  /** Day number from which this problem was deleted/carried. */
  carriedFromDay?: number;
  /**
   * The actual date (YYYY-MM-DD, local) the problem was marked done — set the
   * moment `done` flips to true, cleared if unchecked. This is what the
   * submission heatmap groups by, so a backlog problem solved today shows up
   * on today's square instead of its originally assigned day. Absent on rows
   * completed before this field existed; the heatmap falls back to the day's
   * own date for those.
   */
  completedAt?: string;
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
  /** Problems that were skipped or deleted from this day and carried over. */
  skippedProblems?: Problem[];
  /** Present only on the weekly revision day generated in place of every
   *  Sunday — lets the UI render "revisit this day" links back to the past
   *  week's study days instead of new problems. */
  isRevisionDay?: boolean;
  /** dayNumbers of the past week's study days this revision day covers. */
  revisionDayNumbers?: number[];
}

// Bumped whenever the master problem database (src/lib/master-problems.ts /
// practice-problems.ts) changes shape or content in a way that requires every
// user's stored plan to be regenerated. See `loadPlan` in db.ts, which
// auto-reseeds any plan whose stored schemaVersion is behind this one.
export const SCHEMA_VERSION = 5;

export const weekNumber = (dayNumber: number) => Math.ceil(dayNumber / 7);