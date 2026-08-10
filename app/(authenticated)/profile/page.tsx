"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useProblemCompletions } from "@/hooks/useProblemCompletions";
import {
  loadUserProfile,
  saveUserProfile,
  saveAvatarBase64,
  saveBannerBase64,
  type CodingProfiles,
  type CustomLink,
  type CompletedProblemSnapshot,
} from "@/lib/db";
import { ALL_PROBLEMS } from "@/lib/problems";
import { CodeModal } from "@/components/CodeModal";
import { SubmissionHeatmap } from "@/components/SubmissionHeatmap";
import { BadgesGrid } from "@/components/BadgesGrid";
import { computeBadges, currentStreak } from "@/lib/gamification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Camera,
  Check,
  Code2,
  ExternalLink,
  Flame,
  Globe,
  Image as ImageIcon,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";

// ─── Platform meta ────────────────────────────────────────────────────────────

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
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function compressBannerToDataUrl(file: File, width = 800, height = 240, quality = 0.55): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function BadgePill({ label, color, bgColor }: { label: string; color: string; bgColor: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color, background: bgColor }}
    >
      {label}
    </span>
  );
}

const diffColor: Record<string, string> = {
  Easy: "#22c55e",
  Medium: "#f97316",
  Hard: "#ef4444",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { days } = usePlan();
  const { completed: pbCompleted, submissions } = useProblemCompletions();

  // ── local state ──
  const [selectedProb, setSelectedProb] = useState<CompletedProblemSnapshot | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [codingProfiles, setCodingProfiles] = useState<CodingProfiles>({});
  const [editingProfiles, setEditingProfiles] = useState(false);
  const [draftProfiles, setDraftProfiles] = useState<CodingProfiles>({});
  const [draftCustomLinks, setDraftCustomLinks] = useState<CustomLink[]>([]);

  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ── Load profile ──
  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    loadUserProfile(user.uid)
      .then((p) => {
        setDisplayName(p.displayName ?? user.displayName ?? "");
        setBio(p.bio ?? "");
        setPhotoURL(p.photoURL ?? user.photoURL ?? "");
        setBannerURL(p.bannerURL ?? "");
        setCodingProfiles(p.codingProfiles ?? {});
        setDraftCustomLinks(p.codingProfiles?.customLinks ?? []);
      })
      .finally(() => setLoadingProfile(false));
  }, [user]);

  // ── Completed problems (plan days + problems tab) ──
  const completedProblems = useMemo<CompletedProblemSnapshot[]>(() => {
    const seen = new Set<string>();
    const list: CompletedProblemSnapshot[] = [];

    // From plan days
    for (const day of days) {
      for (const p of day.problems) {
        if (p.done && p.link && p.link.trim() !== "" && !seen.has(p.name)) {
          seen.add(p.name);
          const sub = submissions[p.name];
          list.push({
            name: p.name,
            platform: p.platform,
            difficulty: p.difficulty,
            link: p.link,
            ...(sub ? { code: sub.code, submissionLink: sub.link } : {}),
          });
        }
      }
    }

    // From problems tab completions
    for (const fp of ALL_PROBLEMS) {
      if (pbCompleted.has(fp.name) && fp.link && fp.link.trim() !== "" && !seen.has(fp.name)) {
        seen.add(fp.name);
        const sub = submissions[fp.name];
        list.push({
          name: fp.name,
          platform: fp.platform,
          difficulty: fp.difficulty,
          link: fp.link,
          ...(sub ? { code: sub.code, submissionLink: sub.link } : {}),
        });
      }
    }

    return list;
  }, [days, pbCompleted, submissions]);

  // ── Platform breakdown stats ──
  const stats = useMemo(() => {
    const byPlatform: Record<string, number> = {};
    for (const p of completedProblems) {
      byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    }
    return { total: completedProblems.length, byPlatform };
  }, [completedProblems]);

  // ── Badges ──
  const badges = useMemo(() => computeBadges(days), [days]);

  // ── Streak ──
  const streakCount = useMemo(() => currentStreak(days), [days]);

  // ── Submission Heatmap Data (automatically updated based on plan days & submissions) ──
  const { heatmapData, detailMap } = useMemo(() => {
    const dateMap = new Map<string, any[]>();

    for (const day of days) {
      const doneProbs = day.problems.filter((p) => p.done);
      if (doneProbs.length > 0) {
        const existing = dateMap.get(day.date) ?? [];
        dateMap.set(day.date, [...existing, ...doneProbs]);
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

  // ── Avatar upload ──
  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      setUploadingAvatar(true);
      try {
        const dataUrl = await compressImageToDataUrl(file);
        await saveAvatarBase64(user.uid, dataUrl);
        setPhotoURL(dataUrl);
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

  // ── Banner upload ──
  const handleBannerChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      setUploadingBanner(true);
      try {
        const dataUrl = await compressBannerToDataUrl(file);
        await saveBannerBase64(user.uid, dataUrl);
        setBannerURL(dataUrl);
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

  // ── Save basic info ──
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
        publicStats,
        completedProblems,
      });
      toast.success("Profile saved!");
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }, [user, displayName, bio, stats, completedProblems]);

  // ── Save coding profiles ──
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

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/${user?.uid}` : "";
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

  const initials = (displayName || user?.email || "?")[0]?.toUpperCase() ?? "?";

  if (loadingProfile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-xs text-muted-foreground">Manage your developer identity, public stats & progress heatmap</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={copyShareLink}
          >
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied ? "Copied!" : "Share Profile"}
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={saveBasicInfo}
            disabled={saving}
          >
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* ── GitHub / LeetCode Style User Details Hero Section ── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-fade-in-up">
        {/* Cover Accent Banner with Custom Uploaded Banner Image */}
        <div className="h-32 w-full bg-gradient-to-r from-primary/30 via-primary/10 to-accent/20 border-b border-border/40 relative overflow-hidden">
          {bannerURL && (
            <img src={bannerURL} alt="Profile banner" className="absolute inset-0 size-full object-cover" />
          )}

          {/* Change Banner Button */}
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute left-4 top-3 flex items-center gap-1.5 rounded-lg bg-background/85 backdrop-blur px-2.5 py-1 text-xs font-medium text-foreground border border-border/60 shadow-sm hover:bg-background transition-all hover:scale-105 z-10 disabled:opacity-60"
          >
            {uploadingBanner ? (
              <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <ImageIcon className="size-3.5 text-muted-foreground" />
            )}
            <span>{bannerURL ? "Change Banner" : "Add Banner"}</span>
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleBannerChange}
            aria-hidden="true"
          />

          <div className="absolute right-4 top-3 flex items-center gap-2 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-3 py-1 text-xs font-semibold text-foreground border border-border/50 shadow-sm">
              <Flame className="size-3.5 text-orange-500" />
              {streakCount} Day Streak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-3 py-1 text-xs font-semibold text-primary border border-border/50 shadow-sm">
              <Sparkles className="size-3.5" />
              {stats.total} Solved
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0">
          <div className="flex flex-wrap items-end gap-5 -mt-12 mb-4">
            {/* Avatar with level ring & camera button */}
            <div className="relative shrink-0 z-10">
              <div className="size-24 overflow-hidden rounded-full border-4 border-card bg-muted shadow-lg flex items-center justify-center">
                {photoURL ? (
                  <img src={photoURL} alt="avatar" className="size-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-primary">{initials}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile picture"
                className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary transition-all hover:scale-110 disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="size-4 text-muted-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                aria-hidden="true"
              />
            </div>

            {/* Quick Name & Info */}
            <div className="flex-1 min-w-0 pt-2">
              <h2 className="text-xl font-bold tracking-tight">{displayName || "Developer"}</h2>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Form details */}
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs font-semibold">Display Name</Label>
                <Input
                  id="profile-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-xs font-semibold">Email (Read only)</Label>
                <Input
                  id="profile-email"
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-bio" className="text-xs font-semibold">Bio & Goals</Label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short bio — target companies, college, or current DSA goals..."
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Public Link Bar */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
              <Link2 className="size-4 shrink-0 text-primary" />
              <span className="truncate font-mono">{shareUrl}</span>
              <button
                onClick={copyShareLink}
                className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Submission Heatmap Section (GitHub / LeetCode Style) ── */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
        <h2 className="mb-4 font-display text-lg font-semibold flex items-center gap-2">
          <Flame className="size-5 text-orange-500" />
          Submission Activity Heatmap
        </h2>
        <SubmissionHeatmap data={heatmapData} detailMap={detailMap} />
      </section>

      {/* ── Badges & Achievements Section ── */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
        <BadgesGrid badges={badges} />
      </section>

      {/* ── Coding Profiles Section ── */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="size-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Coding Profiles</h2>
          </div>
          {!editingProfiles ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
            setDraftProfiles({ ...codingProfiles });
            setDraftCustomLinks(codingProfiles.customLinks ?? []);
            setEditingProfiles(true);
          }}
            >
              <Pencil className="size-3.5" /> Edit Links
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingProfiles(false)}>
                <X className="size-4" />
              </Button>
              <Button size="sm" className="gap-2" onClick={saveCodingProfiles} disabled={saving}>
                <Check className="size-4" /> Save Profiles
              </Button>
            </div>
          )}
        </div>

        {editingProfiles ? (
          <div className="space-y-3">
            {PLATFORMS.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label htmlFor={`cp-${p.key}`} style={{ color: p.color }}>{p.label}</Label>
                <Input
                  id={`cp-${p.key}`}
                  value={draftProfiles[p.key] ?? ""}
                  onChange={(e) => setDraftProfiles((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  placeholder={p.placeholder}
                />
              </div>
            ))}

            {/* ── Custom Links ── */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">Custom Links</span>
                <button
                  type="button"
                  onClick={() => setDraftCustomLinks((prev) => [...prev, { label: "", url: "" }])}
                  className="flex items-center gap-1 rounded-md border border-dashed border-primary/60 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="size-3.5" /> Add link
                </button>
              </div>
              {draftCustomLinks.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No custom links yet. Click "Add link" to add one.</p>
              )}
              <div className="space-y-2">
                {draftCustomLinks.map((cl, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={cl.label}
                      onChange={(e) => setDraftCustomLinks((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], label: e.target.value };
                        return next;
                      })}
                      placeholder="Label (e.g. Portfolio, Resume)"
                      className="w-36 shrink-0"
                    />
                    <Input
                      value={cl.url}
                      onChange={(e) => setDraftCustomLinks((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], url: e.target.value };
                        return next;
                      })}
                      placeholder="https://..."
                    />
                    <button
                      type="button"
                      onClick={() => setDraftCustomLinks((prev) => prev.filter((_, i) => i !== idx))}
                      className="shrink-0 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Remove link"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const url = codingProfiles[p.key];
                return (
                  <div
                    key={p.key}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-all hover:border-primary/40"
                    style={{ background: url ? p.bgColor : undefined }}
                  >
                    <span className="text-xs font-semibold w-28 shrink-0" style={{ color: p.color }}>
                      {p.label}
                    </span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                      >
                        <ExternalLink className="size-3 shrink-0" />
                        <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not linked</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Custom links display */}
            {(codingProfiles.customLinks ?? []).length > 0 && (
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
          </div>
        )}
      </section>

      {/* ── Statistics Breakdown Section ── */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Platform Breakdown</h2>
        </div>

        <div className="mb-4 flex items-end gap-2">
          <span className="font-display text-5xl font-bold tabular-nums text-primary">
            {stats.total}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">total problems solved</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(stats.byPlatform)
            .sort((a, b) => b[1] - a[1])
            .map(([platform, count]) => (
              <div
                key={platform}
                className="rounded-xl border border-border bg-background p-3"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{platform}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{count}</p>
              </div>
            ))}
          {Object.keys(stats.byPlatform).length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No problems solved yet. Start ticking problems off your plan!
            </p>
          )}
        </div>
      </section>

      {/* ── Completed Problems Section ── */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">
              Completed Problems
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredCompleted.length})
              </span>
            </h2>
          </div>

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

        {filteredCompleted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {platformFilter === "All"
              ? "No problems completed yet."
              : `No completed problems on ${platformFilter}.`}
          </p>
        ) : (
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
                <BadgePill
                  label={p.platform}
                  color="#6366f1"
                  bgColor="rgba(99,102,241,0.1)"
                />
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
        )}
      </section>

      {selectedProb && (
        <CodeModal
          open={Boolean(selectedProb)}
          onOpenChange={(v) => { if (!v) setSelectedProb(null); }}
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
    </>
  );
}
