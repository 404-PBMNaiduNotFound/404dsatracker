"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "./useAuth";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Contest {
  id: string; // unique: platform + start time / slug
  platform: "Codeforces" | "CodeChef" | "LeetCode" | "HackerRank" | "HackerEarth";
  title: string;
  startMs: number; // UTC epoch ms
  durationMs: number;
  url: string;
}

export type ContestStatus = "live" | "upcoming" | "missed";
export type UserMark = "attended" | "missed_intentional" | null;

export interface ContestWithStatus extends Contest {
  status: ContestStatus;
  endMs: number;
  mark: UserMark;
}

interface StoredData {
  marks: Record<string, UserMark>; // contestId -> mark
  lastFetchedMs: number;
  cachedContests: Contest[];
}

const LOCAL_STORAGE_KEY_CONTESTS = "ldt_cached_contests_v3";
const LOCAL_STORAGE_KEY_MARKS = "ldt_cached_marks_v3";

// Codeforces should only surface real DSA / competitive-programming rounds —
// exclude training camps, onsite practice sessions, and other non-CP listings
// that occasionally show up in the public contest list.
const CF_NON_CP_REGEX = /training|marathon|onsite|hiring\s*test|welcome\s*round/i;

// ─── Platform fetchers ────────────────────────────────────────────────────────

async function fetchCodeforces(): Promise<Contest[]> {
  try {
    const r = await fetch("https://codeforces.com/api/contest.list?gym=false", {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const json = await r.json();
    if (json.status !== "OK") return [];
    const now = Date.now();
    const windowMs = 14 * 24 * 60 * 60 * 1000;
    return (json.result as any[])
      .filter((c: any) => {
        const startMs = c.startTimeSeconds * 1000;
        const inWindow = c.phase !== "FINISHED" || (now - startMs < windowMs);
        const isCoreCp = !CF_NON_CP_REGEX.test(c.name || "");
        return inWindow && isCoreCp;
      })
      .map((c: any) => ({
        id: `cf-${c.id}`,
        platform: "Codeforces" as const,
        title: c.name,
        startMs: c.startTimeSeconds * 1000,
        durationMs: c.durationSeconds * 1000,
        url: `https://codeforces.com/contest/${c.id}`,
      }));
  } catch {
    return [];
  }
}

function generateCalculatedLeetCodeContestsHook(): Contest[] {
  const contests: Contest[] = [];
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;

  const refWeeklyNum = 435;
  const refWeeklyTime = 1738463400000;
  const weeksDiff = Math.floor((now - refWeeklyTime) / ONE_WEEK);

  for (let i = weeksDiff - 2; i <= weeksDiff + 2; i++) {
    const num = refWeeklyNum + i;
    const startMs = refWeeklyTime + i * ONE_WEEK;
    contests.push({
      id: `lc-weekly-contest-${num}`,
      platform: "LeetCode" as const,
      title: `Weekly Contest ${num}`,
      startMs,
      durationMs: 5400 * 1000,
      url: `https://leetcode.com/contest/weekly-contest-${num}`,
    });
  }

  const refBiweeklyNum = 149;
  const refBiweeklyTime = 1738420200000;
  const biweeksDiff = Math.floor((now - refBiweeklyTime) / (2 * ONE_WEEK));

  for (let i = biweeksDiff - 2; i <= biweeksDiff + 2; i++) {
    const num = refBiweeklyNum + i;
    const startMs = refBiweeklyTime + i * (2 * ONE_WEEK);
    contests.push({
      id: `lc-biweekly-contest-${num}`,
      platform: "LeetCode" as const,
      title: `Biweekly Contest ${num}`,
      startMs,
      durationMs: 5400 * 1000,
      url: `https://leetcode.com/contest/biweekly-contest-${num}`,
    });
  }

  return contests;
}

async function fetchLeetCode(): Promise<Contest[]> {
  try {
    const r = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        query: `{
          topTwoContests {
            title
            titleSlug
            startTime
            duration
          }
          pastContests(pageNo: 1, numPerPage: 12) {
            data {
              title
              titleSlug
              startTime
              duration
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return generateCalculatedLeetCodeContestsHook();
    const json = await r.json();
    const upcoming: any[] = json?.data?.topTwoContests ?? [];
    const past: any[] = json?.data?.pastContests?.data ?? [];
    const all = [...upcoming, ...past];

    if (!all.length) return generateCalculatedLeetCodeContestsHook();

    return all.map((c: any) => ({
      id: `lc-${c.titleSlug}`,
      platform: "LeetCode" as const,
      title: c.title,
      startMs: c.startTime * 1000,
      durationMs: (c.duration || 5400) * 1000,
      url: `https://leetcode.com/contest/${c.titleSlug}`,
    }));
  } catch {
    return generateCalculatedLeetCodeContestsHook();
  }
}

async function fetchCodeChef(): Promise<Contest[]> {
  try {
    const r = await fetch("https://www.codechef.com/api/list/contests/all", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const json = await r.json();
    const now = Date.now();
    const windowMs = 14 * 24 * 60 * 60 * 1000;

    const present = json.present_contests ?? [];
    const future = json.future_contests ?? [];
    const past = json.past_contests ?? [];

    const rawList = [...present, ...future, ...past];

    return rawList
      .filter((c: any) => {
        const startIso = c.contest_start_date_iso || c.contest_start_date;
        if (!startIso) return false;
        const startMs = new Date(startIso).getTime();
        if (isNaN(startMs)) return false;
        return startMs > now || (now - startMs < windowMs);
      })
      .map((c: any) => {
        const startMs = new Date(c.contest_start_date_iso || c.contest_start_date).getTime();
        const endMs = new Date(c.contest_end_date_iso || c.contest_end_date).getTime();
        const fallbackDuration = parseInt(c.contest_duration || "120", 10) * 60 * 1000;
        const durationMs = (!isNaN(endMs) && endMs > startMs) ? (endMs - startMs) : fallbackDuration;
        return {
          id: `cc-${c.contest_code || c.contest_name}`,
          platform: "CodeChef" as const,
          title: c.contest_name,
          startMs,
          durationMs,
          url: `https://www.codechef.com/${c.contest_code}`,
        };
      });
  } catch {
    return [];
  }
}

async function fetchHackerRank(): Promise<Contest[]> {
  try {
    const r = await fetch("https://www.hackerrank.com/rest/contests/upcoming?offset=0&limit=20", {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const json = await r.json();
    const models: any[] = json?.models ?? [];
    const now = Date.now();
    const windowMs = 14 * 24 * 60 * 60 * 1000;

    return models
      .filter((c: any) => {
        const startMs = (c.epoch_starttime || new Date(c.get_starttimeiso).getTime() / 1000) * 1000;
        return !isNaN(startMs) && (startMs > now || now - startMs < windowMs);
      })
      .map((c: any) => {
        const startMs = (c.epoch_starttime || new Date(c.get_starttimeiso).getTime() / 1000) * 1000;
        const endMs = (c.epoch_endtime || new Date(c.get_endtimeiso).getTime() / 1000) * 1000;
        const durationMs = (!isNaN(endMs) && endMs > startMs) ? (endMs - startMs) : 7200000;
        return {
          id: `hr-${c.slug || c.id}`,
          platform: "HackerRank" as const,
          title: c.name,
          startMs,
          durationMs,
          url: `https://www.hackerrank.com/contests/${c.slug}`,
        };
      });
  } catch {
    return [];
  }
}

async function fetchHackerEarth(): Promise<Contest[]> {
  try {
    const r = await fetch("https://www.hackerearth.com/chrome-extension/events/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const json = await r.json();
    const data: any[] = json?.response ?? (Array.isArray(json) ? json : []);
    const now = Date.now();
    const windowMs = 14 * 24 * 60 * 60 * 1000;

    return data
      .filter((c: any) => {
        const startMs = new Date(c.start_utc_tz || c.start_timestamp || c.start_time).getTime();
        return !isNaN(startMs) && (startMs > now || now - startMs < windowMs);
      })
      .map((c: any) => {
        const startMs = new Date(c.start_utc_tz || c.start_timestamp || c.start_time).getTime();
        const endMs = new Date(c.end_utc_tz || c.end_timestamp || c.end_time).getTime();
        const durationMs = (!isNaN(endMs) && endMs > startMs) ? (endMs - startMs) : 7200000;
        return {
          id: `he-${c.id || c.title}`,
          platform: "HackerEarth" as const,
          title: c.title || c.name,
          startMs,
          durationMs,
          url: c.url || c.challenge_type_url || `https://www.hackerearth.com/challenges/`,
        };
      });
  } catch {
    return [];
  }
}

function dedup(contests: Contest[]): Contest[] {
  const seen = new Set<string>();
  const titleSeen = new Set<string>();
  return contests.filter((c) => {
    const titleKey = `${c.platform}-${c.title.toLowerCase().trim()}`;
    if (seen.has(c.id) || titleSeen.has(titleKey)) return false;
    seen.add(c.id);
    titleSeen.add(titleKey);
    return true;
  });
}

async function fetchApiRoute(): Promise<Contest[]> {
  try {
    const r = await fetch("/api/contests", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

async function fetchAllContests(): Promise<Contest[]> {
  const apiContests = await fetchApiRoute();
  if (apiContests.length > 0) {
    return dedup(apiContests).sort((a, b) => a.startMs - b.startMs);
  }

  const results = await Promise.allSettled([
    fetchCodeforces(),
    fetchLeetCode(),
    fetchCodeChef(),
    fetchHackerRank(),
    fetchHackerEarth(),
  ]);

  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  return dedup(all).sort((a, b) => a.startMs - b.startMs);
}

// ─── Status classifier ────────────────────────────────────────────────────────

export function getContestStatus(c: Contest, now: number): ContestStatus {
  const end = c.startMs + c.durationMs;
  if (now >= c.startMs && now < end) return "live";
  if (now < c.startMs) return "upcoming";
  return "missed";
}

// ─── Firestore & LocalStorage helpers ─────────────────────────────────────────

function storeDoc(uid: string) {
  return doc(db!, "users", uid, "contestMeta", "tracking");
}

async function loadStored(uid: string): Promise<StoredData | null> {
  try {
    const snap = await getDoc(storeDoc(uid));
    if (!snap.exists()) return null;
    return snap.data() as StoredData;
  } catch {
    return null;
  }
}

async function saveStored(uid: string, data: Partial<StoredData>) {
  try {
    await setDoc(storeDoc(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    // non-critical
  }
}

function getLocalData(): { contests: Contest[]; marks: Record<string, UserMark>; lastFetchedMs: number } {
  if (typeof window === "undefined") return { contests: [], marks: {}, lastFetchedMs: 0 };
  try {
    const rawC = localStorage.getItem(LOCAL_STORAGE_KEY_CONTESTS);
    const rawM = localStorage.getItem(LOCAL_STORAGE_KEY_MARKS);
    const contests = rawC ? JSON.parse(rawC) : [];
    const marks = rawM ? JSON.parse(rawM) : {};
    const lastFetchedMs = parseInt(localStorage.getItem(`${LOCAL_STORAGE_KEY_CONTESTS}_ts`) || "0", 10);
    return { contests, marks, lastFetchedMs };
  } catch {
    return { contests: [], marks: {}, lastFetchedMs: 0 };
  }
}

function setLocalData(contests: Contest[], marks: Record<string, UserMark>, ts?: number) {
  if (typeof window === "undefined") return;
  try {
    if (contests.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY_CONTESTS, JSON.stringify(contests));
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_MARKS, JSON.stringify(marks));
    if (ts) {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_CONTESTS}_ts`, String(ts));
    }
  } catch {
    // ignore quota issues
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContests() {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [marks, setMarks] = useState<Record<string, UserMark>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fetchedRef = useRef(false);

  // Tick every second for live countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Listen to mark updates across components
  useEffect(() => {
    const handleMarkEvent = (e: CustomEvent<{ contestId: string; mark: UserMark }>) => {
      if (e.detail) {
        setMarks((prev) => ({ ...prev, [e.detail.contestId]: e.detail.mark }));
      }
    };
    window.addEventListener("ldt_contest_mark_updated" as any, handleMarkEvent as any);
    return () => {
      window.removeEventListener("ldt_contest_mark_updated" as any, handleMarkEvent as any);
    };
  }, []);

  // Load from local storage immediately (zero-lag), then hydrate/refresh asynchronously
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Fast initial load from localStorage
    const local = getLocalData();
    if (local.contests.length > 0) {
      setContests(local.contests);
      setMarks(local.marks);
      setLoading(false);
    }

    (async () => {
      setError(null);

      try {
        let marksData = local.marks;
        let stored: StoredData | null = null;

        if (user) {
          stored = await loadStored(user.uid);
          if (stored?.marks) {
            marksData = { ...marksData, ...stored.marks };
          }
        }

        setMarks(marksData);

        const nowMs = Date.now();
        const cachedList = stored?.cachedContests?.length ? stored.cachedContests : local.contests;

        if (cachedList.length > 0) {
          setContests(cachedList);
          setLoading(false);
        }

        // Always fetch fresh contests asynchronously to ensure latest contests (CodeChef, CF, LeetCode, etc.)
        const fresh = await fetchAllContests();
        if (fresh.length > 0) {
          setContests(fresh);
          setLocalData(fresh, marksData, nowMs);
          if (user) {
            await saveStored(user.uid, {
              cachedContests: fresh,
              lastFetchedMs: nowMs,
              marks: marksData,
            });
          }
        }
        setLoading(false);
      } catch (e) {
        if (!contests.length && !local.contests.length) {
          setError("Could not load contests. Check your connection.");
        }
        setLoading(false);
      }
    })();
  }, [user]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchAllContests();
      if (fresh.length > 0) {
        setContests(fresh);
        setLocalData(fresh, marks, Date.now());
      }
    } catch {
      setError("Failed to refresh contests.");
    } finally {
      setLoading(false);
    }
  }, [marks]);

  // Mark a contest as attended or missed-intentional
  const markContest = useCallback(
    async (contestId: string, mark: UserMark) => {
      setMarks((prev) => {
        const next = { ...prev, [contestId]: mark };
        
        // Defer side effects to next tick so they don't run during React's render phase
        setTimeout(() => {
          setLocalData(contests, next);
          if (user) {
            saveStored(user.uid, { marks: next });
          }
          // Broadcast custom event so all active components sync instantly
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("ldt_contest_mark_updated", {
                detail: { contestId, mark },
              })
            );
          }
        }, 0);
        
        return next;
      });
    },
    [user, contests]
  );

  // Derive final list with statuses
  const enriched: ContestWithStatus[] = contests.map((c) => ({
    ...c,
    endMs: c.startMs + c.durationMs,
    status: getContestStatus(c, now),
    mark: marks[c.id] ?? null,
  }));

  return { contests: enriched, loading, error, now, markContest, refetch };
}
