import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface Contest {
  id: string;
  platform: "Codeforces" | "CodeChef" | "LeetCode" | "HackerRank" | "HackerEarth";
  title: string;
  startMs: number;
  durationMs: number;
  url: string;
}

// Codeforces should only surface real DSA / competitive-programming rounds —
// exclude training camps, onsite practice sessions, and other non-CP listings
// that occasionally show up in the public contest list.
const CF_NON_CP_REGEX = /training|marathon|onsite|hiring\s*test|welcome\s*round/i;

// ─── CodeChef Fetcher ──────────────────────────────────────────────────────────
async function fetchCodeChef(): Promise<Contest[]> {
  try {
    const res = await fetch("https://www.codechef.com/api/list/contests/all", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return [];
    const json = await res.json();
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
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.code === 23) {
      console.warn("CodeChef API timed out (8s limit reached), skipping CodeChef contests fetch.");
    } else {
      console.warn("CodeChef fetch warning:", e?.message ?? e);
    }
    return [];
  }
}

// ─── Codeforces Fetcher ────────────────────────────────────────────────────────
async function fetchCodeforces(): Promise<Contest[]> {
  try {
    const res = await fetch("https://codeforces.com/api/contest.list?gym=false", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const json = await res.json();
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
  } catch (e) {
    console.error("Codeforces fetch error:", e);
    return [];
  }
}

function generateCalculatedLeetCodeContests(): Contest[] {
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
      platform: "LeetCode",
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
      platform: "LeetCode",
      title: `Biweekly Contest ${num}`,
      startMs,
      durationMs: 5400 * 1000,
      url: `https://leetcode.com/contest/biweekly-contest-${num}`,
    });
  }

  return contests;
}

// ─── LeetCode Fetcher (Weekly / Biweekly) ──────────────────────────────────────
async function fetchLeetCode(): Promise<Contest[]> {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
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
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return generateCalculatedLeetCodeContests();
    const json = await res.json();
    const upcoming: any[] = json?.data?.topTwoContests ?? [];
    const past: any[] = json?.data?.pastContests?.data ?? [];
    const all = [...upcoming, ...past];

    if (!all.length) return generateCalculatedLeetCodeContests();

    return all.map((c: any) => ({
      id: `lc-${c.titleSlug}`,
      platform: "LeetCode",
      title: c.title,
      startMs: c.startTime * 1000,
      durationMs: (c.duration || 5400) * 1000,
      url: `https://leetcode.com/contest/${c.titleSlug}`,
    }));
  } catch {
    return generateCalculatedLeetCodeContests();
  }
}

// ─── HackerRank Fetcher ────────────────────────────────────────────────────────
async function fetchHackerRank(): Promise<Contest[]> {
  try {
    const res = await fetch("https://www.hackerrank.com/rest/contests/upcoming?offset=0&limit=20", {
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const json = await res.json();
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
  } catch (e) {
    console.error("HackerRank fetch error:", e);
    return [];
  }
}

// ─── HackerEarth Fetcher ───────────────────────────────────────────────────────
async function fetchHackerEarth(): Promise<Contest[]> {
  try {
    const res = await fetch("https://www.hackerearth.com/chrome-extension/events/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const json = await res.json();
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
  } catch (e) {
    console.error("HackerEarth fetch error:", e);
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

let cachedResponse: { data: Contest[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export async function GET() {
  const now = Date.now();
  if (cachedResponse && now - cachedResponse.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse.data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
      },
    });
  }

  const results = await Promise.allSettled([
    fetchCodeChef(),
    fetchCodeforces(),
    fetchLeetCode(),
    fetchHackerRank(),
    fetchHackerEarth(),
  ]);

  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const sorted = dedup(all).sort((a, b) => a.startMs - b.startMs);

  if (sorted.length > 0) {
    cachedResponse = { data: sorted, timestamp: now };
  }

  return NextResponse.json(sorted, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
    },
  });
}

