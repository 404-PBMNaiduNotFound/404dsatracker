"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  loadUserProfile,
  loadPublicDays,
  resolveProfileIdentifier,
  type CodingProfiles,
  type CompletedProblemSnapshot,
  type PublicStats,
} from "@/lib/db";
import { ExternalLink, Globe, Code2, Flame, Sparkles } from "lucide-react";
import { SubmissionHeatmap } from "@/components/SubmissionHeatmap";
import { BadgesGrid } from "@/components/BadgesGrid";
import { computeBadges, currentStreak } from "@/lib/gamification";
import { CodeModal } from "@/components/CodeModal";
import { QuoteLoader } from "@/components/QuoteLoader";
import type { Day } from "@/lib/types";


// Difficulty color mapping for public profile UI
const diffColor: Record<string, string> = {
  Easy: "#22c55e",
  Medium: "#f97316",
  Hard: "#ef4444",
};

const CODING_PLATFORM_META: Record<
  Exclude<keyof CodingProfiles, "customLinks">,
  { label: string; color: string; bgColor: string }
> = {
  leetcode: { label: "LeetCode", color: "#FFA116", bgColor: "rgba(255,161,22,0.12)" },
  codeforces: { label: "Codeforces", color: "#1F8ACB", bgColor: "rgba(31,138,203,0.12)" },
  codechef: { label: "CodeChef", color: "#5B4638", bgColor: "rgba(91,70,56,0.12)" },
  atcoder: { label: "AtCoder", color: "#8BC4E8", bgColor: "rgba(139,196,232,0.12)" },
  hackerrank: { label: "HackerRank", color: "#00EA64", bgColor: "rgba(0,234,100,0.12)" },
  gfg: { label: "GeeksforGeeks", color: "#2F8D46", bgColor: "rgba(47,141,70,0.12)" },
  github: { label: "GitHub", color: "#6E7681", bgColor: "rgba(110,118,129,0.12)" },
};

interface ExtendedCompletedSnapshot extends CompletedProblemSnapshot {
  code?: string;
  submissionLink?: string;
}

export default function PublicProfilePage() {
  const params = useParams<{ uid: string }>();
  // Route folder is still named [uid] to avoid a broad rename, but the value
  // can now be either a chosen username (new links) or a raw Firebase uid
  // (links shared before usernames existed) — resolved below.
  const identifier = params?.uid ?? "";

  const [notFound, setNotFound] = useState(false);
  const [selectedProb, setSelectedProb] = useState<ExtendedCompletedSnapshot | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [bio, setBio] = useState("");
  const [codingProfiles, setCodingProfiles] = useState<CodingProfiles>({});
  const [publicStats, setPublicStats] = useState<PublicStats>({
    totalSolved: 0,
    byPlatform: {},
    lastUpdated: "",
  });
  const [completedProblems, setCompletedProblems] = useState<ExtendedCompletedSnapshot[]>([]);
  const [platformFilter, setPlatformFilter] = useState("All");
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identifier) return;
    setLoading(true);

    resolveProfileIdentifier(identifier)
      .then((uid) => {
        if (!uid) {
          setNotFound(true);
          return;
        }
        return Promise.all([loadUserProfile(uid), loadPublicDays(uid)]).then(([p, loadedDays]) => {
        if (!p.displayName && !p.bio && !p.photoURL && loadedDays.length === 0) {
          setNotFound(true);
          return;
        }
        setDisplayName(p.displayName ?? "");
        setUsername(p.username ?? "");
        setPhotoURL(p.photoURL ?? "");
        setBannerURL(p.bannerURL ?? "");
        setBio(p.bio ?? "");
        setCodingProfiles(p.codingProfiles ?? {});
        setPublicStats(
          p.publicStats ?? { totalSolved: 0, byPlatform: {}, lastUpdated: "" }
        );
        setCompletedProblems((p.completedProblems as ExtendedCompletedSnapshot[]) ?? []);
        setDays(loadedDays);
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [identifier]);

  const platformOptions = useMemo(
    () => ["All", ...Array.from(new Set(completedProblems.map((p) => p.platform))).sort()],
    [completedProblems]
  );

  const filteredCompleted = useMemo(
    () =>
      platformFilter === "All"
        ? completedProblems
        : completedProblems.filter((p) => p.platform === platformFilter),
    [completedProblems, platformFilter]
  );

  const initials = (displayName || "?")[0]?.toUpperCase() ?? "?";

  // Badges & streak calculation from public days
  const badges = useMemo(() => computeBadges(days), [days]);
  const streakCount = useMemo(() => currentStreak(days), [days]);

  // Heatmap calculations — grouped by the date each problem was actually
  // marked done (not the day it was originally assigned to), so a backlog
  // problem solved today shows up on today's square. Falls back to the
  // day's own date for rows completed before this field existed.
  const { heatmapData, detailMap } = useMemo(() => {
    const dateMap = new Map<string, any[]>();
    for (const day of days ?? []) {
      const doneProbs = day.problems.filter((p) => p.done);
      for (const p of doneProbs) {
        const dateStr = p.completedAt || day.date;
        const existing = dateMap.get(dateStr) ?? [];
        dateMap.set(dateStr, [...existing, p]);
      }
    }
    const hData: { date: string; solved: number }[] = [];
    const dMap: Record<string, any[]> = {};
    dateMap.forEach((probs, dateStr) => {
      hData.push({ date: dateStr, solved: probs.length });
      dMap[dateStr] = probs;
    });
    for (const day of days ?? []) {
      if (!day.skipped && !dateMap.has(day.date)) {
        hData.push({ date: day.date, solved: 0 });
      }
    }
    return { heatmapData: hData, detailMap: dMap };
  }, [days]);

  if (loading) {
    return <QuoteLoader fullScreen />;
  }



  // ── 404 state ──
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Globe className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Profile not found</h1>
        <p className="text-muted-foreground">This profile doesn&apos;t exist or hasn&apos;t been set up yet.</p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <div className="size-5 rounded-full overflow-hidden border border-border shadow-sm ring-1 ring-primary/20 bg-background shrink-0">
            <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
          </div>
          <span>Go to</span>
          <div className="font-display font-black tracking-tighter text-sm leading-none inline-flex items-baseline select-none">
            <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">DSA</span>
            <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent ml-[0.5px]">⁴⁰⁴</span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Branded top bar ── */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="size-7 rounded-full overflow-hidden border border-border/80 shadow-sm ring-1 ring-primary/20 bg-background shrink-0">
              <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
            </div>
            <div className="font-display font-black tracking-tighter text-[20px] leading-none flex items-baseline select-none">
              <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent drop-shadow-sm">DSA</span>
              <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent drop-shadow-sm ml-[1px]">⁴⁰⁴</span>
            </div>
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">Public Profile</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* ── GitHub / LeetCode Style Profile Hero Card ── */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="h-24 sm:h-32 w-full bg-gradient-to-r from-primary/30 via-primary/10 to-accent/20 border-b border-border/40 relative overflow-hidden">
            {bannerURL && (
              <img src={bannerURL} alt="Profile cover banner" className="absolute inset-0 size-full object-cover" />
            )}
            <div className="absolute right-2 top-2 sm:right-4 sm:top-3 flex flex-wrap justify-end items-center gap-1.5 sm:gap-2 z-10 max-w-[85%]">
              <span className="inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-foreground border border-border/50 shadow-sm">
                <Flame className="size-3.5 text-orange-500" />
                {streakCount} Day Streak
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-primary border border-border/50 shadow-sm">
                <Sparkles className="size-3.5" />
                {publicStats.totalSolved} Solved
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-4 sm:gap-5 -mt-10 sm:-mt-12 mb-3">
              <div className="size-20 sm:size-24 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted shadow-lg flex items-center justify-center z-10">
                {photoURL ? (
                  <img src={photoURL} alt={`${displayName} avatar`} className="size-full object-cover" />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold text-primary">{initials}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1 sm:pt-2">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{displayName || "Anonymous Coder"}</h1>
                {username && <p className="text-xs font-mono font-medium text-primary mt-0.5 truncate">@{username}</p>}
                {bio && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bio}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* ── Coding Profiles ── */}
        {(Object.entries(codingProfiles).some(([k, v]) => k !== "customLinks" && Boolean(v)) ||
          (codingProfiles.customLinks ?? []).some((cl) => cl.url)) && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-semibold">Coding Profiles</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(CODING_PLATFORM_META) as Array<Exclude<keyof CodingProfiles, "customLinks">>).map((key) => {
                const url = codingProfiles[key];
                if (!url) return null;
                const meta = CODING_PLATFORM_META[key];
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 min-w-0"
                    style={{ background: meta.bgColor }}
                  >
                    <span className="text-xs font-semibold w-20 sm:w-28 shrink-0 truncate" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-primary truncate min-w-0">
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    </span>
                  </a>
                );
              })}
            </div>
            {/* Custom links */}
            {(codingProfiles.customLinks ?? []).some((cl) => cl.url) && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Links</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(codingProfiles.customLinks ?? []).map((cl, idx) =>
                    cl.url ? (
                      <a
                        key={idx}
                        href={cl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 bg-primary/5 hover:border-primary/50 transition-all"
                      >
                        <Globe className="size-4 shrink-0 text-primary" />
                        <span className="text-xs font-semibold truncate">{cl.label || "Custom Link"}</span>
                        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <ExternalLink className="size-3 shrink-0" />
                          <span className="truncate">{cl.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        </span>
                      </a>
                    ) : null
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Submission Heatmap ── */}
        {days.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-semibold flex items-center gap-2">
              <Flame className="size-5 text-orange-500" />
              Submission Heatmap
            </h2>
            <SubmissionHeatmap data={heatmapData} detailMap={detailMap} />
          </section>
        )}

        {/* ── Badges & Achievements Section ── */}
        {days.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <BadgesGrid badges={badges} />
          </section>
        )}

        {/* ── Statistics ── */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold">Statistics</h2>

          <div className="mb-4 flex items-end gap-2">
            <span className="font-display text-5xl font-bold tabular-nums text-primary">
              {publicStats.totalSolved}
            </span>
            <span className="mb-1 text-sm text-muted-foreground">problems solved</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(publicStats.byPlatform)
              .sort((a, b) => b[1] - a[1])
              .map(([platform, count]) => (
                <div key={platform} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{platform}</p>
                  <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{count}</p>
                </div>
              ))}
            {Object.keys(publicStats.byPlatform).length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No solved problems recorded yet.
              </p>
            )}
          </div>

          {publicStats.lastUpdated && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Last updated {new Date(publicStats.lastUpdated).toLocaleDateString()}
            </p>
          )}
        </section>

        {/* ── Completed Problems ── */}
        {completedProblems.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">
                Completed Problems
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredCompleted.length})
                </span>
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {platformOptions.map((pl) => (
                  <button
                    key={pl}
                    onClick={() => setPlatformFilter(pl)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      platformFilter === pl
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {pl}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-border">
              {filteredCompleted.map((p) => (
                <div
                  key={`${p.name}|${p.link}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/30 px-2 rounded-lg cursor-pointer transition-colors"
                  onClick={() => setSelectedProb(p)}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium hover:text-primary line-clamp-1">
                      {p.name}
                    </span>
                    {p.code && (
                      <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <Code2 className="size-3" /> Code
                      </span>
                    )}
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ color: "#6366f1", background: "rgba(99,102,241,0.1)" }}
                  >
                    {p.platform}
                  </span>
                  <span
                    className="shrink-0 text-xs font-medium"
                    style={{ color: diffColor[p.difficulty] ?? "#6366f1" }}
                  >
                    {p.difficulty}
                  </span>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Open ${p.name}`}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {selectedProb && (
          <CodeModal
            open={Boolean(selectedProb)}
            onOpenChange={(v) => {
              if (!v) setSelectedProb(null);
            }}
            problemName={selectedProb.name}
            existingSubmission={
              selectedProb.code
                ? { code: selectedProb.code, link: selectedProb.submissionLink ?? "", submittedAt: "" }
                : undefined
            }
            readOnly={true}
            onSave={async () => {}}
          />
        )}

        {/* ── Footer ── */}
        <footer className="pb-8 text-center text-xs text-muted-foreground">
          Built with{" "}
          <Link href="/" className="inline-flex items-center gap-1.5 align-middle hover:opacity-90 transition-opacity">
            <div className="size-4 rounded-full overflow-hidden border border-border shadow-sm ring-1 ring-primary/20 bg-background shrink-0">
              <img src="/logo.jpg" alt="DSA404 Logo" className="size-full object-cover" />
            </div>
            <span className="font-display font-black tracking-tighter text-xs leading-none flex items-baseline select-none">
              <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">DSA</span>
              <span className="bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent ml-[0.5px]">⁴⁰⁴</span>
            </span>
          </Link>
          {" "}— Track your DSA journey.
        </footer>
      </main>
    </div>
  );
}
