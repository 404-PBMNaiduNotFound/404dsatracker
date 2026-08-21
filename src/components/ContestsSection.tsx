"use client";

import { useState } from "react";
import {
  ExternalLink,
  Trophy,
  Clock,
  Timer,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useContests,
  type ContestWithStatus,
  type UserMark,
} from "@/hooks/useContests";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(msLeft: number): string {
  if (msLeft <= 0) return "00:00:00";
  const totalSec = Math.floor(msLeft / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(m)}m ${pad(s)}s`;
}

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtDateIST(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " IST";
}

export function isToday(ms: number): boolean {
  if (!ms || isNaN(ms)) return false;
  const dateObj = new Date(ms);
  const nowObj = new Date(); // Takes current system time

  // Local browser date check (system time)
  const isLocalToday =
    nowObj.getFullYear() === dateObj.getFullYear() &&
    nowObj.getMonth() === dateObj.getMonth() &&
    nowObj.getDate() === dateObj.getDate();

  if (isLocalToday) return true;

  // IST date check fallback
  try {
    const istNow = new Date(nowObj.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const istStart = new Date(dateObj.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return (
      istNow.getFullYear() === istStart.getFullYear() &&
      istNow.getMonth() === istStart.getMonth() &&
      istNow.getDate() === istStart.getDate()
    );
  } catch {
    return false;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<string, string> = {
  LeetCode:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Codeforces:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CodeChef:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  HackerRank:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  HackerEarth:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
};

const STATUS_STYLES = {
  live: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse",
  upcoming:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  missed:
    "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
} as const;

// ─── Countdown display ────────────────────────────────────────────────────────

function Countdown({
  targetMs,
  label,
  now,
}: {
  targetMs: number;
  label: string;
  now: number;
}) {
  const left = targetMs - now;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums",
        left < 60_000 && left > 0 && "text-red-500 dark:text-red-400"
      )}
    >
      <Timer className="size-3 shrink-0" aria-hidden="true" />
      {label}: {fmtCountdown(left)}
    </span>
  );
}

// ─── Mark bar ────────────────────────────────────────────────────────────────

function MarkBar({
  contestId,
  mark,
  status,
  onMark,
}: {
  contestId: string;
  mark: UserMark;
  status: ContestWithStatus["status"];
  onMark: (id: string, m: UserMark) => void;
}) {
  // Only show mark bar for live or missed (after end)
  if (status === "upcoming") return null;

  if (mark === "attended") {
    return (
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3" />
          Attended ✓
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            onMark(contestId, null);
          }}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Undo
        </button>
      </div>
    );
  }

  if (mark === "missed_intentional") {
    return (
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
          <XCircle className="size-3" />
          Marked missed
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            onMark(contestId, null);
          }}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      className="mt-2 flex items-center gap-2"
      onClick={(e) => e.preventDefault()}
    >
      <span className="text-[11px] text-muted-foreground">Did you attend?</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          onMark(contestId, "attended");
        }}
        className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-800/60"
      >
        <CheckCircle2 className="size-3" />
        Attended
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          onMark(contestId, "missed_intentional");
        }}
        className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:hover:bg-gray-700/60"
      >
        <XCircle className="size-3" />
        Missed
      </button>
    </div>
  );
}

// ─── Contest card ─────────────────────────────────────────────────────────────

function ContestCard({
  c,
  now,
  onMark,
}: {
  c: ContestWithStatus;
  now: number;
  onMark: (id: string, m: UserMark) => void;
}) {
  const attended = c.mark === "attended";

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors",
        c.status === "missed" && !attended && "opacity-60",
        attended && "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-900/10"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            PLATFORM_STYLES[c.platform] ??
              "bg-muted text-muted-foreground"
          )}
        >
          {c.platform}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            STATUS_STYLES[c.status]
          )}
        >
          {c.status === "live" ? "🔴 Live" : c.status === "upcoming" ? "Upcoming" : "Ended"}
        </span>
      </div>

      {/* Title + link */}
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start justify-between gap-1 text-sm font-medium leading-snug text-foreground hover:text-primary"
      >
        {c.title}
        <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-50 group-hover:opacity-100" />
      </a>

      {/* Time info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {fmtDateIST(c.startMs)}
        </span>
        <span className="flex items-center gap-1">
          <Timer className="size-3" />
          {fmtDuration(c.durationMs)}
        </span>
      </div>

      {/* Live countdown */}
      {c.status === "live" && (
        <Countdown targetMs={c.endMs} label="Ends in" now={now} />
      )}

      {/* Upcoming countdown — show for all upcoming contests within 7 days */}
      {c.status === "upcoming" && c.startMs - now <= 7 * 24 * 60 * 60 * 1000 && (
        <Countdown targetMs={c.startMs} label="Starts in" now={now} />
      )}

      {/* Practice mode note for ended */}
      {c.status === "missed" && (
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-[11px] text-blue-500 underline underline-offset-2 hover:text-blue-700"
          onClick={(e) => e.stopPropagation()}
        >
          Practice in virtual/upsolve mode →
        </a>
      )}

      {/* Mark bar */}
      <MarkBar
        contestId={c.id}
        mark={c.mark}
        status={c.status}
        onMark={onMark}
      />
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  icon,
  onRefresh,
  isRefreshing,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon ?? <Trophy className="size-4 text-primary" />}
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {count}
        </span>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Refresh contest list"
        >
          <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
          <span>Refresh</span>
        </button>
      )}
    </div>
  );
}

// ─── Progress section ─────────────────────────────────────────────────────────

export function ContestProgress({ contests }: { contests: ContestWithStatus[] }) {
  const allEnded = contests.filter((c) => c.status === "missed");
  const attended = allEnded.filter((c) => c.mark === "attended");
  const missedMark = allEnded.filter((c) => c.mark === "missed_intentional");
  const unmarked = allEnded.filter((c) => c.mark === null);
  const total = allEnded.length;
  const pct = total === 0 ? 0 : Math.round((attended.length / total) * 100);

  // Platform breakdown
  const platforms = ["Codeforces", "CodeChef", "LeetCode", "HackerRank", "HackerEarth"] as const;
  const platformStats = platforms.map((p) => {
    const pEnded = allEnded.filter((c) => c.platform === p);
    const pAttended = pEnded.filter((c) => c.mark === "attended");
    return {
      platform: p,
      total: pEnded.length,
      attended: pAttended.length,
    };
  }).filter((s) => s.total > 0);

  if (total === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Contest Attendance & Upsolve Progress</h2>
        </div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {attended.length} / {total} Completed ({pct}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-12 text-right font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
          {pct}%
        </span>
      </div>

      {/* Summary stats */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          {attended.length} Completed / Attended
        </span>
        <span className="flex items-center gap-1 font-medium text-gray-500">
          <XCircle className="size-3.5" />
          {missedMark.length} Marked Missed
        </span>
        {unmarked.length > 0 && (
          <span className="flex items-center gap-1 font-medium text-amber-500">
            <AlertCircle className="size-3.5" />
            {unmarked.length} Unmarked (Upsolve Available)
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {total} Total Past Contests
        </span>
      </div>

      {/* Platform breakdown badges */}
      {platformStats.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Platform Breakdown
          </p>
          <div className="flex flex-wrap gap-2">
            {platformStats.map((s) => (
              <div
                key={s.platform}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[11px]"
              >
                <span className="font-semibold text-foreground">{s.platform}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {s.attended}/{s.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-lg border border-border bg-muted"
        />
      ))}
    </div>
  );
}

// ─── Source footer ────────────────────────────────────────────────────────────

function SourceFooter() {
  return (
    <p className="mt-4 text-right text-[11px] text-muted-foreground">
      Sources: Codeforces · CodeChef · LeetCode · HackerRank · HackerEarth · All times in IST (UTC +5:30)
    </p>
  );
}

// ─── Today contests (shown in Today tab) ─────────────────────────────────────

export function TodayContestsSection() {
  const { contests, loading, error, now, markContest, refetch } = useContests();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <section className="mt-6">
        <SectionHeader title="Today's Contests" count={0} />
        <LoadingGrid />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 underline"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const todaysContests = contests.filter((c) => {
    if (c.status === "live") return true;
    if (c.status === "upcoming" && (isToday(c.startMs) || isToday(c.endMs))) return true;
    // also show ended contests that started or ended today
    if (c.status === "missed" && (isToday(c.startMs) || isToday(c.endMs))) return true;
    return false;
  });

  if (todaysContests.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="size-4" />
            No contests today — great day for problems!
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            Refresh Contests
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <SectionHeader
        title="Today's Contests"
        count={todaysContests.length}
        icon={<Zap className="size-4 text-yellow-500" />}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {todaysContests.map((c) => (
          <ContestCard key={c.id} c={c} now={now} onMark={markContest} />
        ))}
      </div>
      <SourceFooter />
    </section>
  );
}

const PRACTICE_HUB_LINKS = [
  {
    platform: "Codeforces",
    url: "https://codeforces.com/contests",
    label: "Contest Archive & Upsolve",
    bg: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20",
  },
  {
    platform: "LeetCode",
    url: "https://leetcode.com/contest/",
    label: "Past Contests & Virtual Rounds",
    bg: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/20",
  },
  {
    platform: "CodeChef",
    url: "https://www.codechef.com/contests",
    label: "Past Contests & Practice",
    bg: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:bg-orange-500/20",
  },
  {
    platform: "HackerRank",
    url: "https://www.hackerrank.com/contests",
    label: "Contest Archives",
    bg: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
  },
  {
    platform: "HackerEarth",
    url: "https://www.hackerearth.com/challenges/",
    label: "Past Challenges & Hackathons",
    bg: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20",
  },
];

// ─── Full contests page ───────────────────────────────────────────────────────

export function ContestsPageSection() {
  const { contests, loading, error, now, markContest, refetch } = useContests();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-xl border border-border bg-muted" />
        <LoadingGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Live data comes from Codeforces, LeetCode, CodeChef, HackerRank, and HackerEarth. Check
          your internet connection or try refreshing.
        </p>
      </div>
    );
  }

  const LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // Only last 3 days missed contests

  const live = contests.filter((c) => c.status === "live");
  const upcoming = contests.filter((c) => c.status === "upcoming" && c.startMs - now <= LOOKAHEAD_MS);
  
  // Sort missed contests DESCENDING (newest first)
  const missed = contests
    .filter((c) => c.status === "missed")
    .sort((a, b) => b.startMs - a.startMs);

  // ONLY show missed contests from the LAST 3 DAYS
  const recentMissed = missed.filter(
    (c) => c.mark !== "missed_intentional" && c.mark !== "attended" && (now - c.endMs <= THREE_DAYS_MS)
  );
  const markedMissed = missed.filter(
    (c) => c.mark === "missed_intentional" && (now - c.endMs <= THREE_DAYS_MS)
  );
  const attendedMissed = missed.filter((c) => c.mark === "attended");

  return (
    <div className="space-y-10">
      {/* Progress bar */}
      <ContestProgress contests={contests} />

      {/* Live */}
      {live.length > 0 && (
        <section>
          <SectionHeader
            title="Live Now"
            count={live.length}
            icon={<span className="size-4 text-base leading-none">🔴</span>}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((c) => (
              <ContestCard key={c.id} c={c} now={now} onMark={markContest} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <SectionHeader
            title="Upcoming Contests"
            count={upcoming.length}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((c) => (
              <ContestCard key={c.id} c={c} now={now} onMark={markContest} />
            ))}
          </div>
        </section>
      )}

      {/* Attended (marked) */}
      {attendedMissed.length > 0 && (
        <section>
          <SectionHeader
            title="Attended Contests"
            count={attendedMissed.length}
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attendedMissed.map((c) => (
              <ContestCard key={c.id} c={c} now={now} onMark={markContest} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Missed Contests (Last 3 Days Only) */}
      <section>
        <SectionHeader
          title="Missed Contests (Last 3 Days)"
          count={recentMissed.length}
          icon={<XCircle className="size-4 text-orange-400" />}
        />
        <p className="mb-3 text-xs text-muted-foreground">
          Displaying missed contests from the last 3 days. Mark completed ones or practice them!
        </p>
        {recentMissed.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentMissed.map((c) => (
              <ContestCard key={c.id} c={c} now={now} onMark={markContest} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            No missed contests in the last 3 days! Great job staying on track.
          </p>
        )}
      </section>

      {/* Skipped / Marked Missed (Last 3 Days) */}
      {markedMissed.length > 0 && (
        <section>
          <SectionHeader
            title="Skipped (Marked Missed — Last 3 Days)"
            count={markedMissed.length}
            icon={<AlertCircle className="size-4 text-gray-400" />}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markedMissed.map((c) => (
              <ContestCard key={c.id} c={c} now={now} onMark={markContest} />
            ))}
          </div>
        </section>
      )}

      {/* Older Contests & Platform Practice Hub */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Older Contests & Platform Practice Hub</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Official Archives
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Want to practice older contests from past weeks or months? Use the official contest archives below:
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PRACTICE_HUB_LINKS.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center justify-between rounded-lg border p-3 text-xs font-medium transition-all hover:scale-[1.01]",
                link.bg
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{link.platform}</span>
                <span className="text-[11px] opacity-80">{link.label}</span>
              </div>
              <ExternalLink className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </section>

      {contests.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No contests fetched. Check your connection.
        </p>
      )}

      <SourceFooter />
    </div>
  );
}