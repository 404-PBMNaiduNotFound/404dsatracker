"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { todayIso } from "@/lib/plan";
import { DEFAULT_DAILY_COUNTS, type DailyCounts } from "@/lib/plan";
import { isUsernameAvailable, normalizeUsername, USERNAME_REGEX } from "@/lib/db";
import { Loader2, BookOpen, Zap, Trophy, CalendarDays, Sliders, Check, X, AtSign } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onComplete: (startDate: string, counts: DailyCounts, username: string) => Promise<void>;
}

const STEPS = ["welcome", "pace", "startdate", "username", "ready"] as const;
type Step = typeof STEPS[number];

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [counts, setCounts] = useState<DailyCounts>({ ...DEFAULT_DAILY_COUNTS });
  const [startDate, setStartDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  // ── Username — required before the plan is built, so every account has a
  // unique handle from day one. Same live-check pattern used in the
  // sign-in flow and the Profile page: debounce, then isUsernameAvailable().
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  useEffect(() => {
    if (step !== "username") return;
    const raw = username.trim();
    if (!raw) { setUsernameStatus("idle"); return; }
    const u = normalizeUsername(raw);
    if (!USERNAME_REGEX.test(u)) { setUsernameStatus("invalid"); return; }
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
  }, [username, step]);

  const setCount = (key: keyof DailyCounts, val: number) =>
    setCounts((prev) => ({ ...prev, [key]: val }));

  const handleFinish = async () => {
    setBusy(true);
    try {
      await onComplete(startDate, counts, normalizeUsername(username));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg gap-0 p-0 overflow-hidden"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 pt-5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${STEPS.indexOf(step) >= i ? "bg-primary" : "bg-border"
                }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-4">
          {/* ── Step 1: Welcome ── */}
          {step === "welcome" && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Welcome to DSA⁴⁰⁴! 🚀</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  Let's set up your personalised DSA preparation plan. It only takes a minute.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl border border-border bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                  <BookOpen className="mx-auto mb-1 size-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Level 1</p>
                  <p className="text-[11px] text-muted-foreground">Foundations</p>
                </div>
                <div className="rounded-xl border border-border bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                  <Zap className="mx-auto mb-1 size-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Level 2</p>
                  <p className="text-[11px] text-muted-foreground">Intermediate</p>
                </div>
                <div className="rounded-xl border border-border bg-purple-50 dark:bg-purple-900/20 p-3 text-center">
                  <Trophy className="mx-auto mb-1 size-5 text-purple-600 dark:text-purple-400" />
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Level 3</p>
                  <p className="text-[11px] text-muted-foreground">Advanced</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                338 curated problems across 42 topics — organised in 3 levels to take you from fundamentals to advanced DSA.
              </p>

              <Button className="w-full" onClick={() => setStep("pace")}>
                Let's Get Started →
              </Button>
            </div>
          )}

          {/* ── Step 2: Daily Pace ── */}
          {step === "pace" && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Sliders className="size-5 text-primary" />
                  <DialogTitle>Set Your Daily Pace</DialogTitle>
                </div>
                <DialogDescription>
                  How many problems can you solve per day? This controls how the plan distributes your workload.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Easy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <span className="inline-block size-2 rounded-full bg-green-500" />
                      Easy problems / day
                    </Label>
                    <span className="w-6 text-center font-bold text-green-600 tabular-nums">{counts.easy}</span>
                  </div>
                  <Slider
                    min={1} max={10} step={1}
                    value={[counts.easy]}
                    onValueChange={([v]) => setCount("easy", v)}
                    className="[&>[role=slider]]:bg-green-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Max {counts.easy} Easy problems/day (~{counts.easy * 15} min at 15m/easy)</p>
                </div>

                {/* Medium */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <span className="inline-block size-2 rounded-full bg-yellow-500" />
                      Medium pace limit / day
                    </Label>
                    <span className="w-6 text-center font-bold text-yellow-600 tabular-nums">{counts.medium}</span>
                  </div>
                  <Slider
                    min={1} max={8} step={1}
                    value={[counts.medium]}
                    onValueChange={([v]) => setCount("medium", v)}
                    className="[&>[role=slider]]:bg-yellow-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Max {counts.medium} Medium problems/day (~{counts.medium * 30} min at 30m/medium)</p>
                </div>

                {/* Hard */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <span className="inline-block size-2 rounded-full bg-red-500" />
                      Hard pace limit / day
                    </Label>
                    <span className="w-6 text-center font-bold text-red-600 tabular-nums">{counts.hard}</span>
                  </div>
                  <Slider
                    min={1} max={5} step={1}
                    value={[counts.hard]}
                    onValueChange={([v]) => setCount("hard", v)}
                    className="[&>[role=slider]]:bg-red-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Max {counts.hard} Hard problems/day (~{counts.hard * 45} min at 45m/hard)</p>
                </div>
              </div>

              {/* Daily time estimate */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-primary">
                  Dynamic daily study time: ~{Math.min(counts.easy * 15, counts.medium * 30, counts.hard * 45)} to {Math.max(counts.easy * 15, counts.medium * 30, counts.hard * 45)} min / day
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daily workload is calculated dynamically from actual problem difficulties (Easy: 15m, Medium: 30m, Hard: 45m). Leftover problems overflow to next day.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("welcome")}>Back</Button>
                <Button className="flex-1" onClick={() => setStep("startdate")}>Next →</Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Start Date ── */}
          {step === "startdate" && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="size-5 text-primary" />
                  <DialogTitle>When do you start?</DialogTitle>
                </div>
                <DialogDescription>
                  Pick the date your preparation journey begins. Day 1 will be assigned to this date.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  min={todayIso()}
                  onChange={(e) => setStartDate(e.target.value || todayIso())}
                  className="text-base"
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1">
                <p className="text-sm font-medium">Your plan summary</p>
                <p className="text-xs text-muted-foreground">📅 Starting: {new Date(`${startDate}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</p>
                <p className="text-xs text-muted-foreground">⚡ Daily pace limits: {counts.easy} Easy · {counts.medium} Medium · {counts.hard} Hard</p>
                <p className="text-xs text-muted-foreground">⏱ Dynamic study time: ~{Math.min(counts.easy * 15, counts.medium * 30, counts.hard * 45)} – {Math.max(counts.easy * 15, counts.medium * 30, counts.hard * 45)} min/day</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("pace")}>Back</Button>
                <Button className="flex-1" onClick={() => setStep("username")}>Next →</Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Username ── */}
          {step === "username" && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <AtSign className="size-5 text-primary" />
                  <DialogTitle>Choose your username</DialogTitle>
                </div>
                <DialogDescription>
                  Enter a username to continue. This is your unique handle — it powers your public profile link.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="onboarding-username">Username</Label>
                <div className="relative">
                  <Input
                    id="onboarding-username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jane_doe"
                    className="text-base pr-9"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    {usernameStatus === "available" && <Check className="size-4 text-emerald-500" />}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && <X className="size-4 text-destructive" />}
                  </span>
                </div>
                <p className={`text-[11px] ${usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "text-destructive"
                    : usernameStatus === "available"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}>
                  {usernameStatus === "taken"
                    ? "That username is already taken — try another."
                    : usernameStatus === "invalid"
                      ? "3-20 characters: lowercase letters, numbers, - or _ only."
                      : usernameStatus === "available"
                        ? "Username is available!"
                        : "3-20 characters: lowercase letters, numbers, - or _ only."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("startdate")}>Back</Button>
                <Button
                  className="flex-1"
                  disabled={usernameStatus !== "available"}
                  onClick={() => setStep("ready")}
                >
                  Continue →
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 5: Ready ── */}
          {step === "ready" && (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">You're all set! 🎉</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  Your personalised DSA plan is ready to build. Here's what we've configured:
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <AtSign className="size-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-semibold">@{normalizeUsername(username)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <CalendarDays className="size-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-semibold">
                      {new Date(`${startDate}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <Sliders className="size-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Daily Pace Limits</p>
                    <p className="text-sm font-semibold">
                      {counts.easy} Easy · {counts.medium} Medium · {counts.hard} Hard
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <span className="text-lg">⏱</span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Daily Study Time</p>
                    <p className="text-sm font-semibold">~{Math.min(counts.easy * 15, counts.medium * 30, counts.hard * 45)} to {Math.max(counts.easy * 15, counts.medium * 30, counts.hard * 45)} min / day</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You can always change your pace and schedule in Settings.
              </p>

              <Button className="w-full text-base h-11" onClick={handleFinish} disabled={busy}>
                {busy ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Building your plan…</>
                ) : (
                  "Start My DSA Journey 🚀"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}