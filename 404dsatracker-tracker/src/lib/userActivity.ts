// src/lib/userActivity.ts
import { todayIso } from "./plan";
import type { Day } from "./types";

function getLastActiveKey(uid?: string) {
  return uid ? `dsa_last_active_date_${uid}` : "dsa_last_active_date";
}

/** Record today as active in localStorage */
export function recordActivity(uid?: string): void {
  if (typeof window === "undefined") return;
  const today = todayIso();
  localStorage.setItem(getLastActiveKey(uid), today);
}

/** Get the days of inactivity since last recorded visit or last solved problem */
export function getInactivityDays(
  days: Day[],
  uid?: string
): {
  daysInactive: number;
  isLongAbsence: boolean;
  lastActiveDateStr: string | null;
} {
  const today = todayIso();
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();

  let lastActiveDateStr: string | null = null;
  if (typeof window !== "undefined") {
    lastActiveDateStr = localStorage.getItem(getLastActiveKey(uid));
  }

  // Also check days array for latest solved problem date
  for (const d of days) {
    if (d.problems.some((p) => p.done)) {
      if (!lastActiveDateStr || d.date > lastActiveDateStr) {
        lastActiveDateStr = d.date;
      }
    }
  }

  if (!lastActiveDateStr) {
    return { daysInactive: 0, isLongAbsence: false, lastActiveDateStr: null };
  }

  const lastMs = new Date(`${lastActiveDateStr}T00:00:00Z`).getTime();
  const diffDays = Math.max(0, Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24)));

  return {
    daysInactive: diffDays,
    isLongAbsence: diffDays >= 3,
    lastActiveDateStr,
  };
}

export interface MotivationalQuote {
  quote: string;
  author: string;
  category: "comeback" | "streak" | "general" | "resilience";
}

export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  {
    quote: "It doesn't matter how slowly you go as long as you do not stop.",
    author: "Confucius",
    category: "comeback",
  },
  {
    quote: "Every expert was once a beginner. Don't be afraid to restart.",
    author: "Helen Hayes",
    category: "comeback",
  },
  {
    quote: "Consistency is what transforms average into excellence.",
    author: "Anonymous",
    category: "streak",
  },
  {
    quote: "Small daily improvements over time lead to stunning results.",
    author: "Robin Sharma",
    category: "streak",
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    category: "general",
  },
  {
    quote: "Code is like humor. When you have to explain it, it's bad. Write clean DSA!",
    author: "Cory House",
    category: "general",
  },
  {
    quote: "Fall seven times, stand up eight. One problem a day builds a career.",
    author: "Japanese Proverb",
    category: "resilience",
  },
  {
    quote: "Action is the foundational key to all success.",
    author: "Pablo Picasso",
    category: "general",
  },
];

export function getRandomQuote(): MotivationalQuote {
  const index = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  return MOTIVATIONAL_QUOTES[index];
}
