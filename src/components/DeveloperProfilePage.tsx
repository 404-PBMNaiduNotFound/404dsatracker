"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  claimUsername,
  isUsernameAvailable,
  normalizeUsername,
  USERNAME_REGEX,
  type CodingProfiles,
  type CustomLink,
  type CompletedProblemSnapshot,
} from "@/lib/db";
import { ALL_PROBLEMS } from "@/lib/problems";
import { SubmissionHeatmap } from "@/components/SubmissionHeatmap";
import { BadgesGrid } from "@/components/BadgesGrid";
import { computeBadges, currentStreak } from "@/lib/gamification";
import { CodeModal } from "@/components/CodeModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Camera,
  Check,
  CheckCircle2,
  Code2,
  ExternalLink,
  Flame,
  Globe,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Platform metadata ────────────────────────────────────────────────────────
const PLATFORMS: {
  key: Exclude<keyof CodingProfiles, "customLinks">;
  label: string;
  placeholder: string;
  color: string;
  bgColor: string;
}[] = [
  { key: "leetcode",   label: "LeetCode",      placeholder: "https://leetcode.com/yourname",                    color: "#FFA116", bgColor: "rgba(255,161,22,0.12)" },
  { key: "codeforces", label: "Codeforces",     placeholder: "https://codeforces.com/profile/yourname",          color: "#1F8ACB", bgColor: "rgba(31,138,203,0.12)" },
  { key: "codechef",   label: "CodeChef",       placeholder: "https://www.codechef.com/users/yourname",          color: "#5B4638", bgColor: "rgba(91,70,56,0.12)" },
  { key: "atcoder",    label: "AtCoder",        placeholder: "https://atcoder.jp/users/yourname",                color: "#8BC4E8", bgColor: "rgba(139,196,232,0.12)" },
  { key: "hackerrank", label: "HackerRank",     placeholder: "https://www.hackerrank.com/profile/yourname",     color: "#00EA64", bgColor: "rgba(0,234,100,0.12)" },
  { key: "gfg",        label: "GeeksforGeeks",  placeholder: "https://www.geeksforgeeks.org/user/yourname",     color: "#2F8D46", bgColor: "rgba(47,141,70,0.12)" },
  { key: "github",     label: "GitHub",         placeholder: "https://github.com/yourname",                     color: "#6E7681", bgColor: "rgba(110,118,129,0.12)" },
];

// ── Image helpers ────────────────────────────────────────────────────────────
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
        canvas.width = maxPx; canvas.height = maxPx;
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

async function compressBannerToDataUrl(file: File, width = 1200, height = 360, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        // Cover-fit: preserve aspect ratio
        const scale = Math.max(width / img.width, height / img.height);
        const sw = width / scale, sh = height / scale;
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load banner"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

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

// ── Main Component ───────────────────────────────────────────────────────────
export function DeveloperProfilePage() {
  const { user } = useAuth();
  const { days, loading } = usePlan();
  const { completed: pbCompleted, submissions } = useProblemCompletions();

  // — Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // — Profile state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [username, setUsername] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [photoURL, setPhotoURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [codingProfiles, setCodingProfiles] = useState<CodingProfiles>({});
  const [editingProfiles, setEditingProfiles] = useState(false);
  const [draftProfiles, setDraftProfiles] = useState<CodingProfiles>({});
  const [draftCustomLinks, setDraftCustomLinks] = useState<CustomLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [selectedProblemForModal, setSelectedProblemForModal] = useState<string | null>(null);

  // — Load profile
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
        setUsernameDraft(p.username ?? "");
        // Auto-fill from the Google account photo the first time there's no
        // avatar saved yet (no Firestore photoURL and nothing cached
        // locally/uploaded above) — never overrides a photo the user chose.
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

  // — Live username availability check as the user edits their handle.
  // Idle whenever the draft matches what's already saved — no need to
  // re-check a username you already own.
  useEffect(() => {
    const raw = usernameDraft.trim();
    if (!raw || normalizeUsername(raw) === username) {
      setUsernameStatus("idle");
      return;
    }
    const u = normalizeUsername(raw);
    if (!USERNAME_REGEX.test(u)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(u);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [usernameDraft, username]);

  const saveUsername = useCallback(async () => {
    if (!user) return;
    const u = normalizeUsername(usernameDraft);
    if (u === username) return;
    if (!USERNAME_REGEX.test(u)) {
      setUsernameStatus("invalid");
      toast.error("Invalid handle format", { description: "3-20 characters: lowercase letters, numbers, - or _ only." });
      return;
    }
    setUsernameSaving(true);
    try {
      await claimUsername(user.uid, u);
      setUsername(u);
      setUsernameDraft(u);
      setUsernameStatus("idle");
      toast.success("Username updated!", { description: `Your public profile is live at /profile/${u}` });
    } catch (err) {
      if (err instanceof Error && err.message === "USERNAME_TAKEN") {
        setUsernameStatus("taken");
        toast.error("That username is already taken — try another.");
      } else if (err instanceof Error && err.message === "USERNAME_INVALID") {
        setUsernameStatus("invalid");
        toast.error("Invalid handle format", { description: "3-20 characters: lowercase letters, numbers, - or _ only." });
      } else {
        // Do NOT silently write `username` onto the profile doc here — that
        // was the actual cause of the /profile/{username} 404 bug: it made
        // the profile claim a username without ever creating the
        // usernames/{username} -> uid index doc that public URL resolution
        // depends on. Surface the failure instead so the user can retry.
        toast.error("Couldn't claim username", {
          description: (err as Error).message || "Please try again — your public link wasn't updated.",
        });
      }
    } finally {
      setUsernameSaving(false);
    }
  }, [user, usernameDraft, username]);

  // — Computed stats
  const streakCount = useMemo(() => currentStreak(days), [days]);
  const badges = useMemo(() => computeBadges(days), [days]);

  const completedProblems = useMemo<CompletedProblemSnapshot[]>(() => {
    const seen = new Set<string>();
    const list: CompletedProblemSnapshot[] = [];
    for (const day of days) {
      for (const p of day.problems) {
        if (p.done && !seen.has(p.name)) {
          seen.add(p.name);
          const sub = submissions[p.name];
          list.push({ name: p.name, platform: p.platform || "DSA", difficulty: p.difficulty || "Medium", link: p.link || "", ...(sub ? { code: sub.code, submissionLink: sub.link } : {}) });
        }
      }
    }
    for (const fp of ALL_PROBLEMS) {
      if (pbCompleted.has(fp.name) && !seen.has(fp.name)) {
        seen.add(fp.name);
        const sub = submissions[fp.name];
        list.push({ name: fp.name, platform: fp.platform || "DSA", difficulty: fp.difficulty || "Medium", link: fp.link || "", ...(sub ? { code: sub.code, submissionLink: sub.link } : {}) });
      }
    }
    return list;
  }, [days, pbCompleted, submissions]);

  const stats = useMemo(() => {
    const byPlatform: Record<string, number> = {};
    for (const p of completedProblems) byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    return { total: completedProblems.length, byPlatform };
  }, [completedProblems]);

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
        if (!existing.some((p) => p.name === probName))
          dateMap.set(dateStr, [...existing, { name: probName, done: true, platform: "Problems Tab" }]);
      }
    }
    const hData: { date: string; solved: number }[] = [];
    const dMap: Record<string, any[]> = {};
    dateMap.forEach((probs, dateStr) => { hData.push({ date: dateStr, solved: probs.length }); dMap[dateStr] = probs; });
    for (const day of days) {
      if (!day.skipped && !dateMap.has(day.date)) hData.push({ date: day.date, solved: 0 });
    }
    return { heatmapData: hData, detailMap: dMap };
  }, [days, submissions]);

  // — Handlers
  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setPhotoURL(dataUrl);
      if (typeof window !== "undefined" && user?.uid) localStorage.setItem(`local_avatar_url_${user.uid}`, dataUrl);
      if (user) await saveAvatarBase64(user.uid, dataUrl).catch(() => {});
      toast.success("Profile picture updated!");
    } catch (err) { toast.error("Upload failed", { description: (err as Error).message }); }
    finally { setUploadingAvatar(false); e.target.value = ""; }
  }, [user]);

  const handleBannerChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingBanner(true);
    try {
      const dataUrl = await compressBannerToDataUrl(file);
      setBannerURL(dataUrl);
      if (typeof window !== "undefined" && user?.uid) localStorage.setItem(`local_banner_url_${user.uid}`, dataUrl);
      if (user) await saveBannerBase64(user.uid, dataUrl).catch(() => {});
      toast.success("Banner updated!");
    } catch (err) { toast.error("Banner upload failed", { description: (err as Error).message }); }
    finally { setUploadingBanner(false); e.target.value = ""; }
  }, [user]);

  const saveBasicInfo = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      let finalUsername = username;
      const normDraft = normalizeUsername(usernameDraft);
      if (normDraft && normDraft !== username) {
        if (!USERNAME_REGEX.test(normDraft)) {
          toast.error("Invalid username handle", { description: "Must be 3-20 characters: lowercase letters, numbers, - or _ only." });
          setSaving(false);
          return;
        }
        try {
          await claimUsername(user.uid, normDraft);
          finalUsername = normDraft;
          setUsername(normDraft);
          setUsernameDraft(normDraft);
          setUsernameStatus("idle");
        } catch (uErr) {
          if (uErr instanceof Error && uErr.message === "USERNAME_TAKEN") {
            setUsernameStatus("taken");
            toast.error("Username already taken", { description: "Please choose a different handle." });
            setSaving(false);
            return;
          } else {
            // Do NOT silently write the username onto the profile doc here.
            // That skips creating the usernames/{username} -> uid index doc
            // that public URL resolution depends on, which is exactly what
            // caused /profile/{username} links to 404 while looking
            // "saved". Stop the whole save and surface the real error.
            toast.error("Couldn't claim username", {
              description: (uErr as Error).message || "Please try again — nothing was saved.",
            });
            setSaving(false);
            return;
          }
        }
      }

      await updateProfile(auth.currentUser!, { displayName });
      await saveUserProfile(user.uid, {
        displayName,
        bio,
        aboutMe,
        username: finalUsername,
        publicStats: { totalSolved: stats.total, byPlatform: stats.byPlatform, lastUpdated: new Date().toISOString() },
        completedProblems,
      });
      toast.success("Profile saved!");
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }, [user, displayName, bio, aboutMe, usernameDraft, username, stats, completedProblems]);

  const saveCodingProfiles = useCallback(async () => {
    if (!user) return; setSaving(true);
    try {
      const merged: CodingProfiles = { ...draftProfiles, customLinks: draftCustomLinks };
      await saveUserProfile(user.uid, { codingProfiles: merged });
      setCodingProfiles(merged); setEditingProfiles(false);
      toast.success("Coding profiles saved!");
    } catch (err) { toast.error("Save failed", { description: (err as Error).message }); }
    finally { setSaving(false); }
  }, [user, draftProfiles, draftCustomLinks]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/${username || user?.uid}` : "";
  const copyShareLink = useCallback(async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); toast.success("Link copied!"); }
    catch { toast.error("Could not copy link"); }
  }, [shareUrl]);

  const userNameDisplay = displayName || user?.displayName || user?.email?.split("@")[0] || "Developer";
  const initials = userNameDisplay[0]?.toUpperCase() ?? "D";

  if (loading || loadingProfile) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
      <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />

      {/* ── Banner + Avatar Hero Card ── */}
      <section className="rounded-3xl border border-white/15 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Banner */}
        <div
          onClick={() => bannerInputRef.current?.click()}
          className="h-44 sm:h-56 w-full relative overflow-hidden cursor-pointer group"
          title="Click to change banner"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-purple-600/30 to-emerald-500/30" />
          {bannerURL && <img src={bannerURL} alt="banner" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold gap-2 backdrop-blur-[2px] z-10">
            <Camera className="size-5" />
            <span>Change Banner</span>
          </div>
        </div>

        {/* Avatar + Info Row */}
        <div className="px-4 sm:px-6 pb-6 pt-0 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end justify-between gap-4 relative">
          {/* Avatar */}
          <div className="flex items-end gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="-mt-12 sm:-mt-16 flex size-20 sm:size-32 shrink-0 overflow-hidden rounded-full border-[4px] sm:border-[5px] border-card bg-card shadow-2xl items-center justify-center z-10 cursor-pointer group relative"
              title="Click to change avatar"
            >
              {photoURL
                ? <img src={photoURL} alt="avatar" className="size-full object-cover" />
                : <span className="text-2xl sm:text-4xl font-extrabold text-primary">{initials}</span>
              }
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-full">
                <Camera className="size-5" />
              </div>
            </div>

            <div className="pb-1 min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate">{userNameDisplay}</h1>
              {username && <p className="text-xs font-medium text-primary truncate">@{username}</p>}
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">{bio || "SDE Aspirant · DSA Prep Tracker"}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-400">
                  <Flame className="size-3.5 animate-pulse" /> {streakCount} Day Streak
                </span>
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> {stats.total} Solved
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pb-1 w-full sm:w-auto">
            <ThemedTooltip hint="Copy shareable public profile link">
              <Button variant="outline" size="sm" className="h-8 text-xs px-3 gap-1.5 rounded-xl border-white/10 w-full sm:w-auto" onClick={copyShareLink}>
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5 text-primary" />}
                <span>{copied ? "Copied!" : "Share Profile"}</span>
              </Button>
            </ThemedTooltip>
          </div>
        </div>
      </section>

      {/* ── Edit Info & Upload Controls ── */}
      <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <UserCircle2 className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Edit Profile Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Avatar upload */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-background/40 p-4">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Camera className="size-3.5 text-primary" /> Profile Photo
            </Label>
            <div className="flex items-center gap-3">
              <div className="size-12 overflow-hidden rounded-full border border-primary/40 bg-muted shrink-0 flex items-center justify-center">
                {photoURL ? <img src={photoURL} alt="avatar" className="size-full object-cover" /> : <span className="font-bold text-primary">{initials}</span>}
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? "Uploading…" : "Upload Photo"}
              </Button>
            </div>
          </div>

          {/* Banner upload */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-background/40 p-4">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-primary" /> Cover Banner
            </Label>
            <div className="flex items-center gap-3">
              <div className="h-14 w-28 overflow-hidden rounded-xl border border-white/10 bg-muted shrink-0 relative cursor-pointer" onClick={() => bannerInputRef.current?.click()}>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-purple-600/30" />
                {bannerURL && <img src={bannerURL} alt="banner" className="absolute inset-0 w-full h-full object-cover" />}
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
                {uploadingBanner ? "Uploading…" : "Upload Banner"}
              </Button>
            </div>
          </div>
        </div>

        {/* Name & Bio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="prof-name" className="text-xs font-semibold text-muted-foreground">Display Name</Label>
            <Input id="prof-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" className="bg-background/40 border-white/10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-bio" className="text-xs font-semibold text-muted-foreground">Bio / Target Goal</Label>
            <Input id="prof-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="SDE Aspirant · Target SDE 1 role..." className="bg-background/40 border-white/10 rounded-xl text-sm" />
          </div>
        </div>

        {/* About Me — private notes only, intentionally never rendered on the public profile card/page */}
        <div className="space-y-1.5">
          <Label htmlFor="prof-about-me" className="text-xs font-semibold text-muted-foreground">
            About Me <span className="font-normal text-muted-foreground/70">— private, not shown on your public profile</span>
          </Label>
          <Textarea
            id="prof-about-me"
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            placeholder="Personal notes to yourself — goals, context, reminders. Only you can see this."
            rows={4}
            className="bg-background/40 border-white/10 rounded-xl text-sm resize-none"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <Label htmlFor="prof-username" className="text-xs font-semibold text-muted-foreground">
            Username <span className="font-normal text-muted-foreground/70">— your public profile URL</span>
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                id="prof-username"
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value)}
                placeholder="e.g. alex-turner"
                disabled={usernameSaving}
                className={cn(
                  "bg-background/40 border-white/10 rounded-xl text-sm pr-9",
                  (usernameStatus === "taken" || usernameStatus === "invalid") && "border-red-500 focus-visible:ring-red-500",
                  usernameStatus === "available" && "border-emerald-500 focus-visible:ring-emerald-500",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && usernameStatus === "available" && !usernameSaving) saveUsername();
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}
                {usernameStatus === "available" && <Check className="size-3.5 text-emerald-500" />}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && <X className="size-3.5 text-red-500" />}
              </span>
            </div>
            <Button
              size="sm"
              className={cn(
                "gap-2 rounded-xl shrink-0 font-semibold transition-all shadow-sm",
                normalizeUsername(usernameDraft) !== username && USERNAME_REGEX.test(normalizeUsername(usernameDraft)) && usernameStatus !== "taken"
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 ring-2 ring-primary/40"
                  : "bg-muted text-muted-foreground opacity-60"
              )}
              disabled={
                normalizeUsername(usernameDraft) === username ||
                !USERNAME_REGEX.test(normalizeUsername(usernameDraft)) ||
                usernameStatus === "taken" ||
                usernameSaving
              }
              onClick={saveUsername}
            >
              {usernameSaving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Handle
            </Button>
          </div>
          {usernameStatus === "taken" && (
            <p className="text-xs text-red-500">That username is already taken — choose another.</p>
          )}
          {usernameStatus === "invalid" && (
            <p className="text-xs text-red-500">3-20 characters: lowercase letters, numbers, - or _ only.</p>
          )}
          {usernameStatus === "available" && (
            <p className="text-xs text-emerald-500">Available!</p>
          )}
          {username && usernameStatus === "idle" && (
            <p className="text-xs text-muted-foreground">Your profile: /profile/{username}</p>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" className="gap-2 rounded-xl" onClick={saveBasicInfo} disabled={saving}>
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save Profile Details
          </Button>
        </div>
      </section>

      {/* ── Coding Profiles & Handles ── */}
      <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Coding Profiles & Links</h2>
          </div>
          {!editingProfiles ? (
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/10"
              onClick={() => { setDraftProfiles({ ...codingProfiles }); setDraftCustomLinks(codingProfiles.customLinks ?? []); setEditingProfiles(true); }}>
              <Pencil className="size-3.5" /> Edit Handles
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingProfiles(false)}><X className="size-4" /></Button>
              <Button size="sm" className="gap-2 rounded-xl" onClick={saveCodingProfiles} disabled={saving}>
                <Check className="size-4" /> Save Handles
              </Button>
            </div>
          )}
        </div>

        {editingProfiles ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLATFORMS.map((p) => (
                <div key={p.key} className="space-y-1">
                  <Label htmlFor={`cp-${p.key}`} style={{ color: p.color }} className="text-xs font-semibold">{p.label}</Label>
                  <Input id={`cp-${p.key}`} value={draftProfiles[p.key] ?? ""} onChange={(e) => setDraftProfiles((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder={p.placeholder} className="bg-background/40 border-white/10 rounded-xl text-sm" />
                </div>
              ))}
            </div>
            {/* Custom Links */}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">Custom Links</span>
                <button type="button" onClick={() => setDraftCustomLinks((prev) => [...prev, { label: "", url: "" }])}
                  className="flex items-center gap-1 rounded-md border border-dashed border-primary/60 px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors">
                  <Plus className="size-3.5" /> Add link
                </button>
              </div>
              <div className="space-y-2">
                {draftCustomLinks.map((cl, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input value={cl.label} onChange={(e) => setDraftCustomLinks((prev) => { const n = [...prev]; n[idx] = { ...n[idx], label: e.target.value }; return n; })}
                      placeholder="Label (e.g. Portfolio)" className="w-full sm:w-36 shrink-0 bg-background/40 border-white/10 text-sm" />
                    <div className="flex items-center gap-2">
                      <Input value={cl.url} onChange={(e) => setDraftCustomLinks((prev) => { const n = [...prev]; n[idx] = { ...n[idx], url: e.target.value }; return n; })}
                        placeholder="https://..." className="min-w-0 flex-1 bg-background/40 border-white/10 text-sm" />
                      <button type="button" onClick={() => setDraftCustomLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10 transition-colors">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLATFORMS.map((p) => {
              const url = codingProfiles[p.key];
              return (
                <div key={p.key} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 backdrop-blur-md transition-all hover:border-primary/50"
                  style={{ background: url ? p.bgColor : "rgba(255,255,255,0.02)" }}>
                  <span className="text-xs font-bold w-24 shrink-0" style={{ color: p.color }}>{p.label}</span>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline truncate">
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">Not linked</span>
                  )}
                </div>
              );
            })}
            {(codingProfiles.customLinks ?? []).map((cl, i) => cl.url ? (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 backdrop-blur-md hover:border-primary/50 transition-all" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-xs font-bold w-24 shrink-0 text-primary">{cl.label || "Link"}</span>
                <a href={cl.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline truncate">
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{cl.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                </a>
              </div>
            ) : null)}
          </div>
        )}
      </section>

      {/* ── Platform Stats ── */}
      <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Platform Problem Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(stats.byPlatform).map(([platform, count]) => (
            <div key={platform} className="rounded-2xl border border-white/10 bg-background/40 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{platform}</p>
              <p className="mt-1 font-extrabold text-2xl tabular-nums text-primary">{count}</p>
            </div>
          ))}
          {Object.keys(stats.byPlatform).length === 0 && (
            <p className="col-span-full text-xs text-muted-foreground italic">No problems completed yet. Mark problems done on your daily workspace to build your stats!</p>
          )}
        </div>
      </section>

      {/* ── Badges & Achievements ── */}
      <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl">
        <BadgesGrid badges={badges} />
      </section>

      {/* ── Solved Days Heatmap ── */}
      <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Flame className="size-5 text-emerald-400" />
            Solved Days Activity Heatmap
          </h2>
          <p className="text-xs text-muted-foreground">Days with solved problems are highlighted in green.</p>
        </div>
        <SubmissionHeatmap data={heatmapData} detailMap={detailMap} />
      </section>

      {/* ── Solved Problems Archive ── */}
      <section className="rounded-3xl border border-white/10 bg-card/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-foreground">All Solved Problems Archive</h2>
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
              <div key={`${p.name}-${idx}`} className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">{p.platform}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{p.difficulty}</span>
                </div>
                <h4 className="text-xs font-bold text-foreground line-clamp-2">{p.name}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs gap-2">
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                      <ExternalLink className="size-3" /> Problem
                    </a>
                  )}
                  {p.code ? (
                    <button onClick={() => setSelectedProblemForModal(p.name)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 text-[11px] font-bold transition-colors ml-auto">
                      <Code2 className="size-3.5" /> View Code
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground ml-auto">Marked Done</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Code Modal */}
      <CodeModal
        open={!!selectedProblemForModal}
        onOpenChange={(open) => !open && setSelectedProblemForModal(null)}
        problemName={selectedProblemForModal ?? ""}
        existingSubmission={selectedProblemForModal ? submissions[selectedProblemForModal] : undefined}
        onSave={async () => {}}
        readOnly={true}
      />
    </div>
  );
}
