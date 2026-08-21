/**
 * Compatibility shim — extra/alternative practice problems now live in
 * `practice-problems.ts`, generated from the DSA_500 workbook (PRACTICE_500 tab),
 * the single source of truth. This file adapts that shape to the older
 * `EXTRA_PROBLEMS`/`Sheet` interface so the rest of the app doesn't need to change.
 *
 * Do NOT add problems here directly — edit the source spreadsheet and
 * regenerate `practice-problems.ts` instead.
 */
import type { Difficulty } from "./types";
import { PRACTICE_PROBLEMS } from "./practice-problems";

export type Sheet = "Practice 404 Sheet";

export interface ExtraProblem {
  name: string;
  difficulty: Difficulty;
  platform: "LeetCode" | "GFG" | "HackerRank" | "CodeStudio";
  link: string;
  sheet: Sheet;
  topic: string;
}

const canonicalPlatform = (p: string): ExtraProblem["platform"] => {
  if (p === "GeeksforGeeks" || p === "GFG") return "GFG";
  if (p === "HackerRank") return "HackerRank";
  if (p === "CodeStudio") return "CodeStudio";
  return "LeetCode";
};

export const EXTRA_PROBLEMS: ExtraProblem[] = PRACTICE_PROBLEMS.map((p) => ({
  name: p.name,
  difficulty: p.difficulty,
  platform: canonicalPlatform(p.platform),
  link: p.link,
  sheet: "Practice 404 Sheet" as Sheet,
  topic: p.topic,
}));
