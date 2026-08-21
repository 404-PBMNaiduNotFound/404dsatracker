"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";
import {
  loadOwnerProfile,
  saveUserProfile,
  saveAvatarBase64,
  saveBannerBase64,
  type CodingProfiles,
  type CustomLink,
  type CompletedProblemSnapshot,
} from "@/lib/db";
import { ALL_PROBLEMS } from "@/lib/problems";
import { SubmissionHeatmap } from "@/components/SubmissionHeatmap";
import { BadgesGrid } from "@/components/BadgesGrid";
import { computeBadges, currentStreak } from "@/lib/gamification";
import { dayProgress, todayIso, formatDate } from "@/lib/plan";
import { DayDetail } from "@/components/DayDetail";
import { LeetCodeCalendarWidget } from "@/components/LeetCodeCalendarWidget";
import { CodeModal } from "@/components/CodeModal";
import {
  getInactivityDays,
  getRandomQuote,
  recordActivity,
  type MotivationalQuote,
} from "@/lib/userActivity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  ExternalLink,
  Flame,
  Globe,
  Image as ImageIcon,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  UserCircle2,
  ListTodo,
  Calendar as CalendarIcon,
  Rocket,
  HeartHandshake,
  X,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Platform Metadata ────────────────────────────────────────────────────────
const PLATFORMS: {
  key: Exclude<keyof CodingProfiles, "customLinks">;
  label: string;
  placeholder: string;
  color: string;
  bgColor: string;
}[] = [
    {
      key: "leetcode",
      label: "LeetCode",
      placeholder: "https://leetcode.com/yourname",
      color: "#FFA116",
      bgColor: "rgba(255,161,22,0.12)",
    },
    {
      key: "codeforces",
      label: "Codeforces",
      placeholder: "https://codeforces.com/profile/yourname",
      color: "#1F8ACB",
      bgColor: "rgba(31,138,203,0.12)",
    },
    {
      key: "codechef",
      label: "CodeChef",
      placeholder: "https://www.codechef.com/users/yourname",
      color: "#5B4638",
      bgColor: "rgba(91,70,56,0.12)",
    },
    {
      key: "atcoder",
      label: "AtCoder",
      placeholder: "https://atcoder.jp/users/yourname",
      color: "#8BC4E8",
      bgColor: "rgba(139,196,232,0.12)",
    },
    {
      key: "hackerrank",
      label: "HackerRank",
      placeholder: "https://www.hackerrank.com/profile/yourname",
      color: "#00EA64",
      bgColor: "rgba(0,234,100,0.12)",
    },
    {
      key: "gfg",
      label: "GeeksforGeeks",
      placeholder: "https://www.geeksforgeeks.org/user/yourname",
      color: "#2F8D46",
      bgColor: "rgba(47,141,70,0.12)",
    },
    {
      key: "github",
      label: "GitHub",
      placeholder: "https://github.com/yourname",
      color: "#6E7681",
      bgColor: "rgba(110,118,129,0.12)",
    },
  ];

async function compressImageToDataUrl(file: File, maxPx = 128, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxPx;
        canvas.height = maxPx;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxPx, maxPx);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function compressBannerToDataUrl(file: File, width = 900, height = 300, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load banner image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ThemedTooltip({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs rounded-xl border border-white/15 bg-popover/95 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-2xl">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MergedTodayProfile() {
  const { user } = useAuth();
  const { days, loading } = usePlan();
  const { completed: pbCompleted, submissions } = useProblemCompletions();

  // Active Tab state: "today" | "profile" | "calendar"
  const [activeTab, setActiveTab] = useState<"today" | "profile" | "calendar">("today");

  // Selected date from calendar click
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Selected problem for CodeModal viewer in Solved tab
  const [selectedProblemForModal, setSelectedProblemForModal] = useState<string | null>(null);

  // Profile Drawer Edit toggle
  const [showProfileCard, setShowProfileCard] = useState(false);

  // Sync tab from URL params reactively (handles sidebar navigation)
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "profile") {
      setActiveTab("profile");
    } else if (tab === "calendar" || tab === "solved") {
      setActiveTab("calendar");
    } else if (tab === "today") {
      setActiveTab("today");
    }
  }, [searchParams]);

  // Motivational Quote State
  const [currentQuote, setCurrentQuote] = useState<MotivationalQuote>(getRandomQuote());

  // Profile local state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [username, setUsername] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [codingProfiles, setCodingProfiles] = useState<CodingProfiles>({});
  const [editingProfiles, setEditingProfiles] = useState(false);
  const [draftProfiles, setDraftProfiles] = useState<CodingProfiles>({});
  const [draftCustomLinks, setDraftCustomLinks] = useState<CustomLink[]>([]);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Record visit activity on mount
  useEffect(() => {
    if (user?.uid) recordActivity(user.uid);
  }, [user]);

  // Load user profile from DB
  useEffect(() => {
    if (!user || !user.uid) {
      setLoadingProfile(false);
      setPhotoURL("");
      setBannerURL("");
      return;
    }
    const localAvatar = localStorage.getItem(`local_avatar_url_${user.uid}`);
    const localBanner = localStorage.getItem(`local_banner_url_${user.uid}`);
    if (localAvatar) setPhotoURL(localAvatar);
    if (localBanner) setBannerURL(localBanner);

    setLoadingProfile(true);
    loadOwnerProfile(user.uid)
      .then((p) => {
        setDisplayName(p.displayName ?? user.displayName ?? "");
        setBio(p.bio ?? "");
        setAboutMe(p.aboutMe ?? "");
        setUsername(p.username ?? "");
        // Auto-fill from the Google account photo the first time there's no
        // avatar saved yet — never overrides a photo the user chose.
        if (p.photoURL) {
          setPhotoURL(p.photoURL);
        } else if (!localAvatar && user.photoURL) {
          setPhotoURL(user.photoURL);
          saveUserProfile(user.uid, { photoURL: user.photoURL }).catch(() => {});
        }
        if (p.bannerURL) setBannerURL(p.bannerURL);
        setCodingProfiles(p.codingProfiles ?? {});
        setDraftCustomLinks(p.codingProfiles?.customLinks ?? []);
      })
      .finally(() => setLoadingProfile(false));
  }, [user]);

  // Today's Day selection logic
  const iso = todayIso();
  const todayDay = days.find((d) => d.date === iso && !d.skipped);
  // When today's plan is deleted, the day that shifts forward fills its slot
  // and fully replaces it as "today" — restoring the deleted day now happens
  // from the Topic section (see the "Deleted" toast), so Today should just
  // show the day that took its place, not the deleted stub.
  const futureFallback = days.find((d) => d.date > iso && !d.skipped);
  const pastFallback = days.filter((d) => d.date < iso && !d.skipped).at(-1);
  const currentDay = todayDay ?? futureFallback ?? pastFallback ?? days[0];

  // Selected Day from Calendar click or default current day
  const displayedDay = useMemo(() => {
    if (!selectedCalendarDate) return currentDay;
    return days.find((d) => d.date === selectedCalendarDate) ?? currentDay;
  }, [days, selectedCalendarDate, currentDay]);

  const isExactlyToday = displayedDay?.date === iso;
  const isPast = displayedDay ? displayedDay.date < iso : false;

  // Calculate user inactivity gap
  const inactivityInfo = useMemo(() => getInactivityDays(days, user?.uid), [days, user]);

  // Streak — standard derived streak from active plan days
  const streakCount = useMemo(() => currentStreak(days), [days]);

  const userNameDisplay = displayName || user?.displayName || user?.email?.split("@")[0] || "Developer";

  const timeBasedGreeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return {
        greeting: `Good morning, ${userNameDisplay}! ☀️`,
        subtext: "Fresh morning start! Target: Tackle today's core problems & build your DSA momentum.",
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        greeting: `Good afternoon, ${userNameDisplay}! 🌤️`,
        subtext: "Mid-day coding boost! Target: Solve today's problems & sharpen your DSA patterns.",
      };
    } else if (hour >= 17 && hour < 21) {
      return {
        greeting: `Good evening, ${userNameDisplay}! 🌙`,
        subtext: "Evening sprint! Target: Clear today's checklist and keep your streak alive.",
      };
    } else {
      return {
        greeting: `Late night coding, ${userNameDisplay}! 🌌`,
        subtext: "Night owl mode activated! Target: Conquer today's problems before calling it a day.",
      };
    }
  }, [userNameDisplay]);

  // Solved problems snapshots
  const completedProblems = useMemo<CompletedProblemSnapshot[]>(() => {
    const seen = new Set<string>();
    const list: CompletedProblemSnapshot[] = [];

    for (const day of days) {
      for (const p of day.problems) {
        if (p.done && !seen.has(p.name)) {
          seen.add(p.name);
          const sub = submissions[p.name];
          list.push({
            name: p.name,
            platform: p.platform || "DSA",
            difficulty: p.difficulty || "Medium",
            link: p.link || "",
            ...(sub ? { code: sub.code, submissionLink: sub.link } : {}),
          });
        }
      }
    }

    for (const fp of ALL_PROBLEMS) {
      if (pbCompleted.has(fp.name) && !seen.has(fp.name)) {
        seen.add(fp.name);
        const sub = submissions[fp.name];
        list.push({
          name: fp.name,
          platform: fp.platform || "DSA",
          difficulty: fp.difficulty || "Medium",
          link: fp.link || "",
          ...(sub ? { code: sub.code, submissionLink: sub.link } : {}),
        });
      }
    }

    return list;
  }, [days, pbCompleted, submissions]);

  const stats = useMemo(() => {
    const byPlatform: Record<string, number> = {};
    for (const p of completedProblems) {
      byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    }
    return { total: completedProblems.length, byPlatform };
  }, [completedProblems]);

  const badges = useMemo(() => computeBadges(days), [days]);

  // Heatmap dataset
  const { heatmapData, detailMap } = useMemo(() => {
    const dateMap = new Map<string, any[]>();

    for (const day of days) {
      const doneProbs = day.problems.filter((p) => p.done);
      for (const p of doneProbs) {
        // Group by the date the problem was actually marked done, not the
        // day it was originally assigned to — so a backlog problem solved
        // today lands on today's heatmap square. Falls back to the day's
        // own date for rows completed before this field existed.
        const dateStr = p.completedAt || day.date;
        const existing = dateMap.get(dateStr) ?? [];
        dateMap.set(dateStr, [...existing, p]);
      }
    }

    for (const [probName, sub] of Object.entries(submissions)) {
      if (sub.submittedAt) {
        const dateStr = sub.submittedAt.slice(0, 10);
        const existing = dateMap.get(dateStr) ?? [];
        if (!existing.some((p) => p.name === probName)) {
          dateMap.set(dateStr, [...existing, { name: probName, done: true, platform: "Problems Tab" }]);
        }
      }
    }

    const hData: { date: string; solved: number }[] = [];
    const dMap: Record<string, any[]> = {};

    dateMap.forEach((probs, dateStr) => {
      hData.push({ date: dateStr, solved: probs.length });
      dMap[dateStr] = probs;
    });

    for (const day of days) {
      if (!day.skipped && !dateMap.has(day.date)) {
        hData.push({ date: day.date, solved: 0 });
      }
    }

    return { heatmapData: hData, detailMap: dMap };
  }, [days, submissions]);

  // Avatar upload
  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      try {
        const dataUrl = await compressImageToDataUrl(file);
        setPhotoURL(dataUrl);
        if (typeof window !== "undefined") {
          localStorage.setItem("local_avatar_url", dataUrl);
        }
        if (user) {
          await saveAvatarBase64(user.uid, dataUrl).catch(() => { });
        }
        toast.success("Profile picture updated!");
      } catch (err) {
        toast.error("Upload failed", { description: (err as Error).message });
      } finally {
        setUploadingAvatar(false);
        e.target.value = "";
      }
    },
    [user]
  );

  // Banner upload
  const handleBannerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingBanner(true);
      try {
        const dataUrl = await compressBannerToDataUrl(file);
        setBannerURL(dataUrl);
        if (typeof window !== "undefined") {
          localStorage.setItem("local_banner_url", dataUrl);
        }
        if (user) {
          await saveBannerBase64(user.uid, dataUrl).catch(() => { });
        }
        toast.success("Profile banner updated!");
      } catch (err) {
        toast.error("Banner upload failed", { description: (err as Error).message });
      } finally {
        setUploadingBanner(false);
        e.target.value = "";
      }
    },
    [user]
  );

  // Save basic profile info
  const saveBasicInfo = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const publicStats = {
        totalSolved: stats.total,
        byPlatform: stats.byPlatform,
        lastUpdated: new Date().toISOString(),
      };

      await updateProfile(auth.currentUser!, { displayName });
      await saveUserProfile(user.uid, {
        displayName,
        bio,
        aboutMe,
        publicStats,
        completedProblems,
      });
      toast.success("Profile saved!");
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }, [user, displayName, bio, aboutMe, stats, completedProblems]);

  // Save coding profiles handles
  const saveCodingProfiles = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const merged: CodingProfiles = { ...draftProfiles, customLinks: draftCustomLinks };
      await saveUserProfile(user.uid, { codingProfiles: merged });
      setCodingProfiles(merged);
      setEditingProfiles(false);
      toast.success("Coding profiles saved!");
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }, [user, draftProfiles, draftCustomLinks]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/${username || user?.uid}` : "";
  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Could not copy link");
    }
  }, [shareUrl]);

  const initials = userNameDisplay[0]?.toUpperCase() ?? "D";

  if (loading || loadingProfile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden File Inputs for Avatar & Cover Banner Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={handleBannerChange}
        className="hidden"
      />

      {/* ── Top Row: Greeting + Topic Header (left) | Heatmap (right) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Left (2/3): Highlighted Greeting Card + Today's Topic Description Header Card */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Greeting Card — expanded height & text to level top row perfectly */}
          <div className={cn(
            "rounded-3xl border p-5 sm:p-6 backdrop-blur-md shadow-xl flex-1 flex flex-col justify-center min-h-[135px]",
            inactivityInfo.isLongAbsence
              ? "border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/10"
              : streakCount >= 7
              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-primary/10"
              : "border-primary/30 bg-gradient-to-r from-primary/15 via-purple-500/10 to-emerald-500/10"
          )}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                {/* Dynamic icon */}
                {inactivityInfo.isLongAbsence ? (
                  <div className="rounded-2xl bg-amber-500/20 p-3 shrink-0 border border-amber-500/30">
                    <Rocket className="size-7 text-amber-400 animate-pulse" />
                  </div>
                ) : streakCount >= 7 ? (
                  <div className="rounded-2xl bg-emerald-500/20 p-3 shrink-0 border border-emerald-500/30">
                    <Flame className="size-7 text-emerald-400" />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-primary/20 p-3 shrink-0 border border-primary/30">
                    <HeartHandshake className="size-7 text-primary" />
                  </div>
                )}
                <div className="space-y-1">
                  {inactivityInfo.daysInactive >= 14 ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">
                        It's been {inactivityInfo.daysInactive} days, {userNameDisplay}! Time to reclaim your streak! 🔥
                      </h2>
                      <p className="text-sm text-amber-300/80 font-medium">Long time no see — your roadmap is waiting. Let's get back on track!</p>
                    </>
                  ) : inactivityInfo.daysInactive >= 7 ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">
                        Welcome back, {userNameDisplay}! It's been a week 👋
                      </h2>
                      <p className="text-sm text-amber-300/80 font-medium">You were away for {inactivityInfo.daysInactive} days — start fresh, solve today's problems!</p>
                    </>
                  ) : inactivityInfo.daysInactive >= 3 ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-black text-orange-300 tracking-tight">
                        Back after {inactivityInfo.daysInactive} days, {userNameDisplay}! 💪
                      </h2>
                      <p className="text-sm text-orange-300/80 font-medium">Pick up where you left off — your DSA journey continues today!</p>
                    </>
                  ) : streakCount >= 7 ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-black text-emerald-300 tracking-tight">
                        🔥 {streakCount}-day streak! {timeBasedGreeting.greeting}
                      </h2>
                      <p className="text-sm text-emerald-300/80 font-medium">{timeBasedGreeting.subtext}</p>
                    </>
                  ) : streakCount >= 3 ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                        ⚡ {streakCount} days strong! {timeBasedGreeting.greeting}
                      </h2>
                      <p className="text-sm text-muted-foreground font-medium">{timeBasedGreeting.subtext}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                        {timeBasedGreeting.greeting}
                      </h2>
                      <p className="text-sm text-muted-foreground font-medium">{timeBasedGreeting.subtext}</p>
                    </>
                  )}
                </div>
              </div>
              {/* Streak pill */}
              <div className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold shrink-0 shadow-sm",
                streakCount > 0
                  ? "border border-orange-500/30 bg-orange-500/10 text-orange-400"
                  : "border border-white/10 bg-white/5 text-muted-foreground"
              )}>
                <Flame className="size-4 text-orange-500 animate-pulse" />
                <span>{streakCount > 0 ? `${streakCount} Day Streak` : "Start your streak!"}</span>
              </div>
            </div>
          </div>

          {/* Today Topic Description Header Section (Topic info, status, Postpone/Merge/Borrow/Delete/Restore, progress bar) */}
          {(displayedDay ?? currentDay) && (
            <DayDetail
              day={displayedDay ?? currentDay!}
              readOnly={!isExactlyToday && !isPast}
              lateMode={isPast && !isExactlyToday}
              headerOnly
            />
          )}
        </div>

        {/* Right (1/3): Activity Heatmap */}
        <div className="lg:col-span-1 h-full flex flex-col">
          <div className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl shadow-xl p-4 sm:p-5 h-full flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">Activity Heatmap</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <SubmissionHeatmap data={heatmapData} detailMap={detailMap} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Full-Width Below: Today's Core Problems, Contests, Checklist, Notes ── */}
      {(displayedDay ?? currentDay) && (
        <DayDetail
          day={displayedDay ?? currentDay!}
          readOnly={!isExactlyToday && !isPast}
          lateMode={isPast && !isExactlyToday}
          hideHeader
        />
      )}


      {/* ── TAB 3: SOLVED DAYS GREEN HEATMAP CALENDAR ── */}
      {activeTab === "calendar" && (
        <div className="space-y-6 animate-fade-in-up">
          <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Flame className="size-5 text-emerald-400" />
                  <span>Solved Days Activity Heatmap</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Days with solved problems are highlighted in green. Click any square to view solved problems for that day.
                </p>
              </div>
            </div>

            {/* Submission Heatmap Grid */}
            <SubmissionHeatmap data={heatmapData} detailMap={detailMap} />
          </section>

          {/* All Completed Problems Archive */}
          <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-foreground">All Solved Problems Archive</h3>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                {completedProblems.length} Problems Solved
              </span>
            </div>

            {completedProblems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-4 text-center border border-dashed border-white/10 rounded-2xl">
                No completed problems yet. Submit code solutions on your daily workspace to build your solved archive!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {completedProblems.map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                        {p.platform}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {p.difficulty}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-foreground line-clamp-2">{p.name}</h4>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                      {p.code ? (
                        <button
                          onClick={() => setSelectedProblemForModal(p.name)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 text-[11px] font-bold transition-colors"
                          title="Click to view stored code solution"
                        >
                          <Code2 className="size-3.5 text-emerald-400" />
                          <span>View Code</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Marked Done</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Code Modal for viewing stored solutions from Solved tab */}
      <CodeModal
        open={!!selectedProblemForModal}
        onOpenChange={(open) => !open && setSelectedProblemForModal(null)}
        problemName={selectedProblemForModal ?? ""}
        existingSubmission={selectedProblemForModal ? submissions[selectedProblemForModal] : undefined}
        onSave={async () => { }}
        readOnly={true}
      />
    </div>
  );
}
