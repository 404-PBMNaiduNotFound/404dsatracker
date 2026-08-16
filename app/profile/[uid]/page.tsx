"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  loadUserProfile,
  loadPublicDays,
  loadProblemCompletions,
  loadCodeSubmissions,
  resolveProfileIdentifier,
  type CodingProfiles,
  type CompletedProblemSnapshot,
  type PublicStats,
  type CodeSubmission,
} from "@/lib/db";
import { ALL_PROBLEMS } from "@/lib/problems";
import { ExternalLink, Globe, Code2, Flame, Sparkles, BadgeCheck } from "lucide-react";
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
  const [pbCompleted, setPbCompleted] = useState<Set<string>>(new Set());
  const [codeSubmissions, setCodeSubmissions] = useState<Record<string, CodeSubmission>>({});
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
        return Promise.all([
          loadUserProfile(uid),
          loadPublicDays(uid),
          loadProblemCompletions(uid),
          loadCodeSubmissions(uid),
        ]).then(([p, loadedDays, completedSet, submissionsMap]) => {
          if (
            !p.displayName &&
            !p.bio &&
            !p.photoURL &&
            loadedDays.length === 0 &&
            completedSet.size === 0 &&
            Object.keys(submissionsMap).length === 0
          ) {
            setNotFound(true);
            return;
          }
          setDisplayName(p.displayName ?? "");
          setUsername(p.username ?? "");
          setPhotoURL(p.photoURL ?? "");
          setBannerURL(p.bannerURL ?? "");
          setBio(p.bio ?? "");
          setCodingProfiles(p.codingProfiles ?? {});
          setPublicStats(p.publicStats ?? { totalSolved: 0, byPlatform: {}, lastUpdated: "" });
          setCompletedProblems((p.completedProblems as ExtendedCompletedSnapshot[]) ?? []);
          setDays(loadedDays);
          setPbCompleted(completedSet);
          setCodeSubmissions(submissionsMap);
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [identifier]);

  // Aggregate all completed/solved problems from user profile, schedule days, and Problems tab
  const allCompletedProblems = useMemo<ExtendedCompletedSnapshot[]>(() => {
    const seen = new Set<string>();
    const list: ExtendedCompletedSnapshot[] = [];

    // 1. Explicitly stored in user profile doc
    for (const cp of completedProblems) {
      if (cp.name && !seen.has(cp.name)) {
        seen.add(cp.name);
        const sub = codeSubmissions[cp.name];
        list.push({
          ...cp,
          code: cp.code || sub?.code,
          submissionLink: cp.submissionLink || sub?.link,
        });
      }
    }

    // 2. Schedule days
    for (const day of days) {
      for (const p of day.problems) {
        if (p.done && p.name && !seen.has(p.name)) {
          seen.add(p.name);
          const sub = codeSubmissions[p.name];
          list.push({
            name: p.name,
            platform: p.platform || "DSA",
            difficulty: p.difficulty || "Medium",
            link: p.link || "",
            code: (p as any).code || sub?.code,
            submissionLink: sub?.link,
          });
        }
      }
    }

    // 3. Problems tab completions
    for (const fp of ALL_PROBLEMS) {
      if (pbCompleted.has(fp.name) && !seen.has(fp.name)) {
        seen.add(fp.name);
        const sub = codeSubmissions[fp.name];
        list.push({
          name: fp.name,
          platform: fp.platform || "DSA",
          difficulty: fp.difficulty || "Medium",
          link: fp.link || "",
          code: sub?.code,
          submissionLink: sub?.link,
        });
      }
    }

    // 4. Any other entries in codeSubmissions map
    Object.entries(codeSubmissions).forEach(([name, sub]) => {
      if (name && !seen.has(name) && sub?.code) {
        seen.add(name);
        list.push({
          name,
          platform: "DSA",
          difficulty: "Medium",
          link: sub.link || "",
          code: sub.code,
          submissionLink: sub.link,
        });
      }
    });

    return list;
  }, [completedProblems, days, pbCompleted, codeSubmissions]);

  const platformOptions = useMemo(
    () => ["All", ...Array.from(new Set(allCompletedProblems.map((p) => p.platform))).sort()],
    [allCompletedProblems]
  );

  const filteredCompleted = useMemo(
    () =>
      platformFilter === "All"
        ? allCompletedProblems
        : allCompletedProblems.filter((p) => p.platform === platformFilter),
    [allCompletedProblems, platformFilter]
  );

  const nameToDisplay =
    displayName ||
    username ||
    (identifier && !identifier.startsWith("user_") && identifier.length < 30 ? identifier : "") ||
    "Developer";

  const initials = (nameToDisplay || "?")[0]?.toUpperCase() ?? "?";
  const totalSolvedCount = Math.max(publicStats.totalSolved, allCompletedProblems.length);

  // Badges & streak calculation from public days and codeSubmissions
  const badges = useMemo(() => computeBadges(days), [days]);
  const streakCount = useMemo(() => currentStreak(days, codeSubmissions), [days, codeSubmissions]);

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
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg transition-all">
          <div className="h-28 sm:h-36 w-full bg-gradient-to-r from-primary/30 via-purple-500/15 to-emerald-500/20 border-b border-border/40 relative overflow-hidden">
            {bannerURL && (
              <img src={bannerURL} alt="Profile cover banner" className="absolute inset-0 size-full object-cover" />
            )}
            <div className="absolute right-3 top-3 sm:right-5 sm:top-4 flex flex-wrap justify-end items-center gap-2 z-10 max-w-[85%]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-3 py-1 text-xs font-bold text-foreground border border-border/60 shadow-md">
                <Flame className="size-3.5 text-orange-500 animate-pulse" />
                {streakCount} Day Streak
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-3 py-1 text-xs font-bold text-primary border border-border/60 shadow-md">
                <Sparkles className="size-3.5 text-primary" />
                {totalSolvedCount} Solved
              </span>
            </div>
          </div>

          <div className="px-5 sm:px-8 pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14 mb-2">
              <div className="size-24 sm:size-28 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted shadow-2xl ring-4 ring-primary/20 flex items-center justify-center z-10 transition-transform duration-200 hover:scale-105">
                {photoURL ? (
                  <img src={photoURL} alt={`${nameToDisplay} avatar`} className="size-full object-cover" />
                ) : (
                  <span className="text-3xl sm:text-5xl font-black text-primary drop-shadow-sm">{initials}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1 sm:pt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground truncate drop-shadow-sm">
                    {nameToDisplay}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary border border-primary/20 shadow-sm shrink-0">
                    <BadgeCheck className="size-3.5 text-primary" /> Developer Profile
                  </span>
                </div>
                {username && (
                  <div>
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20 shadow-sm">
                      @{username}
                    </span>
                  </div>
                )}
                {bio && (
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium line-clamp-2 max-w-xl">
                    {bio}
                  </p>
                )}
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
              {totalSolvedCount}
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
        {allCompletedProblems.length > 0 && (
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
              {filteredCompleted.map((p, idx) => (
                <div
                  key={`${p.name}|${idx}`}
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
                ? { code: selectedProb.code, link: "", submittedAt: "" }
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
