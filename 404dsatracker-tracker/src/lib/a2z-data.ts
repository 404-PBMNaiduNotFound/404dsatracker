/**
 * Compatibility shim — the actual roadmap data now lives in `master-problems.ts`,
 * generated from 404sheet.xlsx (single source of truth). This file just adapts
 * that shape to the older `SECTIONS`/`SeedProblem` interface so the rest of the
 * app (plan.ts, problems.ts, etc.) doesn't need to change.
 *
 * Do NOT add problems here directly — edit the source spreadsheet and
 * regenerate `master-problems.ts` instead.
 */
import type { Difficulty } from "./types";
import { CORE_SECTIONS } from "./master-problems";

export interface SeedProblem {
  /** name */ n: string;
  /** difficulty */ d: Difficulty;
  /** platform */ p: string;
  /** verified direct link to the canonical problem page */ l?: string;
  /** true when `l` is a confirmed direct link (not a search fallback) */ linkVerified?: boolean;
}

export interface Section {
  section: string;
  title: string;
  subtopics: string[];
  problems: SeedProblem[];
  /** Dominant roadmap level for this section, e.g. "Level 1" */
  level: string;
}

/** Returns the most common level among the problems in a section. */
function dominantLevel(problems: { level: string }[]): string {
  const counts: Record<string, number> = {};
  problems.forEach((p) => { counts[p.level] = (counts[p.level] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Level 1";
}

/** The 338-problem core roadmap (from 404sheet.xlsx), grouped by topic. */
export const SECTIONS: Section[] = CORE_SECTIONS.map((sec) => ({
  section: sec.topic,
  title: sec.topic,
  subtopics: sec.subtopics,
  level: dominantLevel(sec.problems),
  problems: sec.problems.map((p) => ({
    n: p.name,
    d: p.difficulty,
    p: p.platform,
    l: p.link,
    linkVerified: true,
  })),
}));
