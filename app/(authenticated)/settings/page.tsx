"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  deleteUser,
  GoogleAuthProvider,
  linkWithPopup,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/integrations/firebase/client";
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { changeStartDate, deleteAccountData, updateUserProfile } from "@/lib/db";
import { addDays, daysNeeded, diffDays, formatDate, todayIso } from "@/lib/plan";
import { pushState, requestPushPermission, subscribeDevice, showLocalReminder, registerReminderWorker } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { PasswordInput } from "@/components/PasswordInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Bell, CalendarDays, Palette, PauseCircle, PlayCircle, Sliders, UserCog, HelpCircle, Trash2, AlertTriangle } from "lucide-react";
import { useThemeCustomizer } from "../../../app/theme-customizer-context";
import { cn } from "@/lib/utils";


function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-hover mb-6 rounded-xl border border-border bg-card p-5 animate-fade-in-up">
      <div className="mb-4 flex items-start gap-3">
        <Icon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { settings, loading, update, userId } = useSettings();
  const { days, loading: planLoading, rebalance, shiftSchedule, startDate, reload } = usePlan();
  const qc = useQueryClient();
  const { openPanel } = useThemeCustomizer();

  const [name, setName] = useState(() => auth.currentUser?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState(settings.counts);
  const [countsDirty, setCountsDirty] = useState(false);
  const [planStartDate, setPlanStartDate] = useState(() => startDate);
  const [startDirty, setStartDirty] = useState(false);
  const [startBusy, setStartBusy] = useState(false);

  // Sync counts when settings load from Firestore
  useEffect(() => {
    if (settings?.counts) {
      setCounts(settings.counts);
    }
  }, [settings.counts]);

  const minPace: Record<"easy" | "medium" | "hard", number> = {
    easy: 2,
    medium: 1,
    hard: 1,
  };

  const isCountsValid =
    (counts.easy ?? 0) >= minPace.easy &&
    (counts.medium ?? 0) >= minPace.medium &&
    (counts.hard ?? 0) >= minPace.hard;

  // Live preview of what the new pace does to the finish date.
  const preview = useMemo(() => {
    const validCounts = {
      easy: Math.max(minPace.easy, counts.easy || 0),
      medium: Math.max(minPace.medium, counts.medium || 0),
      hard: Math.max(minPace.hard, counts.hard || 0),
    };
    const remaining = days.flatMap((d) => d.problems.filter((p) => !p.done));
    const need = daysNeeded(remaining, validCounts);
    const doneDays = days.filter((d) => d.problems.length > 0 && d.problems.every((p) => p.done))
      .length;
    return { remaining: remaining.length, need, finish: addDays(todayIso(), need), doneDays };
  }, [days, counts]);

  async function saveAccount() {
    setBusy(true);
    try {
      if (password || confirm) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== confirm) throw new Error("The two passwords do not match.");
      }
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");
      if (!name.trim() && !password) throw new Error("Nothing to update.");
      if (name.trim()) {
        await updateProfile(user, { displayName: name.trim() });
        await updateUserProfile(userId, { displayName: name.trim() });
      }
      if (password) await updatePassword(user, password);
      setPassword("");
      setConfirm("");
      toast.success("Account updated");
    } catch (e) {
      const needsReauth = e instanceof FirebaseError && e.code === "auth/requires-recent-login";
      toast.error("Could not update your account", {
        description: needsReauth
          ? "For security, please sign out and sign back in before changing your password."
          : e instanceof Error
            ? e.message
            : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function linkGoogle() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");
      await linkWithPopup(user, new GoogleAuthProvider());
      toast.success("Google account connected");
    } catch (e) {
      const already = e instanceof FirebaseError && e.code === "auth/credential-already-in-use";
      toast.error(already ? "That Google account is already linked elsewhere" : "Google sign-in failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function applyStartDate() {
    if (!startDirty || !planStartDate) return;
    setStartBusy(true);
    try {
      await changeStartDate(userId, planStartDate);
      reload();
      setStartDirty(false);
      toast.success("Plan start date updated", {
        description: `Your plan now starts on ${formatDate(planStartDate)}. All days have been reset.`,
      });
    } catch (e) {
      toast.error("Could not update start date. Please try again.");
    } finally {
      setStartBusy(false);
    }
  }

  async function applyCounts() {
    if (!isCountsValid) {
      toast.error("Invalid daily pace values", {
        description: "Minimum required: Easy (min 2), Medium (min 1), Hard (min 1).",
      });
      return;
    }
    setBusy(true);
    try {
      await update({ counts });
      const res = await rebalance(counts);
      setCountsDirty(false);
      toast.success("Daily pace updated", {
        description: `Remaining problems redistributed — plan is now ${res.after} days (was ${res.before}), finishing ${formatDate(res.finish)}.`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function togglePush(on: boolean) {
    if (!on) {
      await update({ pushEnabled: false });
      return;
    }

    // Step 1: request browser permission
    const state = await requestPushPermission();
    if (state !== "granted") {
      toast.error(
        state === "unsupported"
          ? "This browser does not support notifications"
          : "Notification permission was blocked",
        { description: "Open your browser site settings and allow notifications, then try again." },
      );
      return;
    }

    // Step 2: enable local notifications immediately (no FCM needed)
    await update({ pushEnabled: true });
    toast.success("Browser reminders on", {
      description: "You'll get a nudge at your reminder time when problems are left.",
    });

    // Step 3: attempt FCM background push subscription (best-effort, non-blocking)
    subscribeDevice(userId).then((ok) => {
      if (ok) {
        console.info("[push] FCM background subscription active.");
      } else {
        toast.info("Tip for closed-app notifications", {
          description: "In-tab notifications are active! For reliable alerts when the app is completely closed, enable Email Notifications below.",
        });
      }
    }).catch(() => { /* silent */ });
  }

  async function pause() {
    const from = todayIso();
    await update({ paused: true, pausedFrom: from, pausedDays: 0 });
    toast.info("Preparation paused", {
      description: "Your schedule stops sliding when you resume. Missed-week checks are off.",
    });
  }

  async function resume() {
    const from = settings.pausedFrom ?? todayIso();
    const gap = Math.max(0, diffDays(from, todayIso()));
    const finish = gap > 0 ? await shiftSchedule(from, gap) : days[days.length - 1]?.date;
    await update({
      paused: false,
      pausedFrom: null,
      pausedDays: settings.pausedDays + gap,
      resumeDate: todayIso(),
    });
    toast.success("Welcome back", {
      description:
        gap > 0
          ? `Everything shifted forward by ${gap} day(s). New finish date ${formatDate(finish ?? "")}.`
          : "Nothing to shift — you resumed the same day.",
    });
  }

  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No active user session.");

      // 1. Delete Firestore data FIRST, while the user is still authenticated.
      // Firestore's security rules key off request.auth.uid — once the Auth
      // account is deleted below, request.auth becomes null and every
      // isOwner(uid) check fails, silently skipping the entire cleanup
      // (it was previously swallowed by a .catch(console.warn)). Doing this
      // step first guarantees the DB is actually wiped.
      if (userId) {
        await deleteAccountData(userId);
      }

      // 2. Delete user from Firebase Auth
      try {
        await deleteUser(user);
      } catch (e: any) {
        if (e?.code === "auth/requires-recent-login") {
          const providerData = user.providerData;
          const isGoogle = providerData.some((p) => p.providerId === "google.com");
          if (isGoogle) {
            toast.info("Re-authenticating with Google to confirm deletion...");
            const provider = new GoogleAuthProvider();
            await linkWithPopup(user, provider);
            await deleteUser(user);
          } else {
            toast.error("Security timeout: Please sign out and sign back in to delete your account.");
            setDeleting(false);
            return;
          }
        } else {
          throw e;
        }
      }

      // 3. Clear local caches
      await qc.cancelQueries();
      qc.clear();
      if (typeof window !== "undefined") {
        window.localStorage.clear();
      }

      toast.success("Your account and all associated data have been permanently deleted.");
      router.push("/auth?next=/today");
    } catch (e: any) {
      toast.error("Could not delete your account", {
        description: e?.message || "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading || planLoading) return <Skeleton className="h-96 w-full" />;

  const pushPerm = pushState();

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Account, pace, reminders and pause controls.
      </p>

      <Section
        icon={Sliders}
        title="Daily problem pace"
        description="Configure maximum problems you want to solve each day by difficulty. The schedule redistributes your remaining problems according to these caps."
      >
        <div className="space-y-5 max-w-lg">
          {/* Easy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 font-medium">
                <span className="inline-block size-2 rounded-full bg-green-500" />
                Easy problems / day
              </Label>
              <span className="w-6 text-center font-bold text-green-600 tabular-nums">{counts.easy}</span>
            </div>
            <Slider
              min={1} max={10} step={1}
              value={[counts.easy]}
              onValueChange={([v]) => {
                setCounts((c) => ({ ...c, easy: v }));
                setCountsDirty(true);
              }}
              className="[&>[role=slider]]:bg-green-500"
            />
            <p className="text-[11px] text-muted-foreground">Max {counts.easy} Easy problems/day (~{counts.easy * 15} min at 15m/easy)</p>
          </div>

          {/* Medium */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 font-medium">
                <span className="inline-block size-2 rounded-full bg-yellow-500" />
                Medium pace limit / day
              </Label>
              <span className="w-6 text-center font-bold text-yellow-600 tabular-nums">{counts.medium}</span>
            </div>
            <Slider
              min={1} max={8} step={1}
              value={[counts.medium]}
              onValueChange={([v]) => {
                setCounts((c) => ({ ...c, medium: v }));
                setCountsDirty(true);
              }}
              className="[&>[role=slider]]:bg-yellow-500"
            />
            <p className="text-[11px] text-muted-foreground">Max {counts.medium} Medium problems/day (~{counts.medium * 30} min at 30m/medium)</p>
          </div>

          {/* Hard */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 font-medium">
                <span className="inline-block size-2 rounded-full bg-red-500" />
                Hard pace limit / day
              </Label>
              <span className="w-6 text-center font-bold text-red-600 tabular-nums">{counts.hard}</span>
            </div>
            <Slider
              min={1} max={5} step={1}
              value={[counts.hard]}
              onValueChange={([v]) => {
                setCounts((c) => ({ ...c, hard: v }));
                setCountsDirty(true);
              }}
              className="[&>[role=slider]]:bg-red-500"
            />
            <p className="text-[11px] text-muted-foreground">Max {counts.hard} Hard problems/day (~{counts.hard * 45} min at 45m/hard)</p>
          </div>
        </div>

        {/* Pace Summary Box */}
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 max-w-lg">
          <p className="text-sm font-medium text-primary">
            Dynamic daily study time: ~{Math.min(counts.easy * 15, counts.medium * 30, counts.hard * 45)} to {Math.max(counts.easy * 15, counts.medium * 30, counts.hard * 45)} min / day
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {preview.remaining} problems left → about <strong>{preview.need}</strong> more days. Workload is dynamically calculated per day from actual problem types (Easy: 15m, Medium: 30m, Hard: 45m). Leftover problems overflow to next day.
          </p>
        </div>

        <Button className="mt-4" disabled={!countsDirty || busy || !isCountsValid} onClick={() => void applyCounts()}>
          Apply &amp; redistribute
        </Button>
      </Section>

      <Section
        icon={CalendarDays}
        title="Plan start date"
        description="Pick the date your preparation journey begins. Changing this reseeds all days from scratch."
      >
        <div className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label htmlFor="plan-start-date">Start Date</Label>
            <Input
              id="plan-start-date"
              type="date"
              value={planStartDate}
              onChange={(e) => {
                setPlanStartDate(e.target.value);
                setStartDirty(true);
              }}
              className="text-sm max-w-xs"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-foreground">Selected Start Date Summary</p>
            <p className="text-xs text-muted-foreground">
              📅 Starting: {new Date(`${planStartDate}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
            </p>
            <p className="text-xs text-muted-foreground">
              Current active start date: <strong>{formatDate(startDate)}</strong>
            </p>
          </div>

          <ConfirmDialog
            trigger={
              <Button disabled={!startDirty || startBusy}>
                Apply new start date
              </Button>
            }
            title="Reset plan to new start date?"
            description={`This reseeds all ${preview.need} days from the new date (${planStartDate}). Your existing progress marks will be reset. This cannot be undone.`}
            confirmLabel="Yes, reset plan"
            destructive
            onConfirm={applyStartDate}
          />
        </div>
      </Section>

      <Section
        icon={settings.paused ? PlayCircle : PauseCircle}
        title="Pause preparation"
        description="Taking exams or a holiday? Pausing freezes your schedule — when you resume, every upcoming day slides forward by the time you were away, and missed-week detection stays off in the meantime."
      >
        {settings.paused ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Paused since <strong>{formatDate(settings.pausedFrom ?? "")}</strong> —{" "}
              {Math.max(0, diffDays(settings.pausedFrom ?? todayIso(), todayIso()))} day(s) so far.
            </p>
            <Button onClick={() => void resume()} className="ml-auto">
              Resume preparation
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => void pause()}>
            Pause my preparation
          </Button>
        )}
        {settings.pausedDays > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Total time paused so far: {settings.pausedDays} day(s).
          </p>
        )}
      </Section>

      <Section
        icon={Bell}
        title="Reminders"
        description="Configure browser notifications for morning topics, upcoming contests, and daily backlog, as well as email notifications for revision topics."
      >
        <div className="space-y-5">
          {/* Master Browser Notification Switch */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Label htmlFor="push" className="font-semibold text-base">Browser notifications</Label>
              <p className="text-xs text-muted-foreground">
                {pushPerm === "unsupported"
                  ? "Not supported in this browser."
                  : pushPerm === "denied"
                    ? "Blocked — open browser site settings and allow notifications."
                    : pushPerm === "granted"
                      ? "✓ Permission granted — browser notifications active."
                      : "Master toggle for all local browser alerts."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pushPerm === "granted" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await registerReminderWorker();
                    await showLocalReminder(
                      "🔔 Test Notification — DSA404",
                      "Browser notifications are working perfectly on your device!"
                    );
                    toast.success("Test notification sent!", {
                      description: "If you didn't see a popup, check your OS Notification & Focus/Do Not Disturb settings.",
                    });
                  }}
                  className="text-xs h-8"
                >
                  Test Notification 🔔
                </Button>
              )}
              <Switch
                id="push"
                checked={settings.pushEnabled}
                disabled={pushPerm === "unsupported" || pushPerm === "denied"}
                onCheckedChange={(v) => void togglePush(v)}
              />
            </div>
          </div>

          {/* Sub-options for Browser Notifications */}
          {settings.pushEnabled && (
            <div className="ml-4 space-y-4 border-l-2 border-primary/20 pl-4 pt-1">
              {/* Morning Topic Reminder */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label htmlFor="morning-push">Morning Topic Reminder</Label>
                  <p className="text-xs text-muted-foreground">
                    Reminds you in the morning about today's scheduled DSA topic and problems.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="morning-time"
                    type="time"
                    value={settings.morningReminderTime}
                    disabled={!settings.morningReminderEnabled}
                    onChange={(e) => void update({ morningReminderTime: e.target.value })}
                    className="h-8 w-32 text-xs"
                  />
                  <Switch
                    id="morning-push"
                    checked={settings.morningReminderEnabled}
                    onCheckedChange={(v) => void update({ morningReminderEnabled: v })}
                  />
                </div>
              </div>

              {/* Contest 1-Hour Reminder */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="contest-push">Contest Alert (1 hour before)</Label>
                  <p className="text-xs text-muted-foreground">
                    Alerts you 1 hour before any live coding contest (LeetCode, Codeforces, CodeChef, etc.) starts.
                  </p>
                </div>
                <Switch
                  id="contest-push"
                  checked={settings.contestReminderEnabled}
                  onCheckedChange={(v) => void update({ contestReminderEnabled: v })}
                />
              </div>

              {/* Evening Backlog Reminder */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label htmlFor="time">Evening Backlog Nudge</Label>
                  <p className="text-xs text-muted-foreground">
                    Reminds you at your specified evening time if you still have unsolved problems today.
                  </p>
                </div>
                <Input
                  id="time"
                  type="time"
                  value={settings.reminderTime}
                  onChange={(e) => void update({ reminderTime: e.target.value })}
                  className="h-8 w-32 text-xs"
                />
              </div>
            </div>
          )}

          {/* Email Notification Switch */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
            <div>
              <Label htmlFor="email" className="font-semibold text-base">Email notifications</Label>
              <p className="text-xs text-muted-foreground">
                Sends email reminders exclusively for scheduled topics in your <strong>Revision tab</strong>.
              </p>
            </div>
            <Switch
              id="email"
              checked={settings.emailEnabled}
              onCheckedChange={(v) => {
                void update({ emailEnabled: v });
                toast.success(v ? "Email notifications enabled for Revision topics" : "Email notifications disabled");
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            Timezone: {settings.timezone}
          </p>
        </div>
      </Section>


      <Section
        icon={UserCog}
        title="Account"
        description="Change your display name or password, or connect Google."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              placeholder="Your name"
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pw">New password</Label>
            <PasswordInput
              id="pw"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pw2">Confirm new password</Label>
            <PasswordInput
              id="pw2"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void saveAccount()}>
            Save changes
          </Button>
          <Button variant="outline" onClick={() => void linkGoogle()}>
            Continue with Google
          </Button>
        </div>
      </Section>

      {/* ── Color Customizer ── */}
      <Section
        icon={Palette}
        title="Theme Colors"
        description="Pick from preset palettes or fine-tune every color for both light and dark modes."
      >
        <p className="text-sm text-muted-foreground mb-4">
          Personalise the accent, background, card surface, borders and more. Changes are saved to your browser and apply immediately.
        </p>
        <Button onClick={openPanel} className="gap-2">
          <Palette className="size-4" />
          Open Color Customizer
        </Button>
      </Section>

      {/* ── Danger Zone ── */}
      <section className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-5 animate-fade-in-up">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and remove all stored progress, notes, submission code, and settings.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-destructive/20 pt-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete Account</p>
            <p className="text-xs text-muted-foreground">This action cannot be undone. All your progress will be wiped immediately.</p>
          </div>
        </div>

        <ConfirmDialog
          trigger={
            <Button variant="destructive" disabled={deleting} className="gap-2">
              <Trash2 className="size-4" />
              {deleting ? "Deleting..." : "Delete Account"}
            </Button>
          }
          title="Delete your account permanently?"
          description="Are you absolutely sure? This will permanently delete your user profile, solved problem history, code submissions, reminders, and custom settings. This action CANNOT be undone."
          confirmLabel="Yes, delete my account"
          destructive
          onConfirm={deleteAccount}
        />
      </section>

      {/* ── FAQ Section ── */}
      <Section
        icon={HelpCircle}
        title="Frequently Asked Questions"
        description="Answers to the most complex and advanced features of the platform."
      >
        <div className="space-y-3">
          {[
            {
              q: "Why did my remaining problems redistribute but my completed days stay the same?",
              a: "Your completed days and notes are preserved as your permanent history. When you change your Daily Problem Pace or miss days, the platform only redistributes the remaining problems forward to keep your schedule realistic without altering your past achievements."
            },
            {
              q: "How do I combine two study days if I have extra time to study?",
              a: "You can click the 'Merge Tomorrow' button on your current day's view. This absorbs tomorrow's topics and problems into today's list, allowing you to advance your plan seamlessly without breaking the sequence."
            },
            {
              q: "What is the exact difference between Skipping a day and Postponing a day?",
              a: "Skipping a day removes it entirely from your schedule, moving all future days forward by one. Postponing pushes a specific day to a new date, shifting your entire calendar back while keeping the sequence intact."
            },
            {
              q: "How does the system help me revise topics I completed weeks ago?",
              a: "You can insert a 'Revision Day' at any time. The platform will automatically select 6 problems from your previously completed topics using spaced repetition principles and create a dedicated recap day without disrupting your main plan."
            },
            {
              q: "I checked off a problem, why does it still show as incomplete in my progress?",
              a: "To fully mark a problem as completed, you must use the 'Submit' button to paste your solution code. This ensures you maintain a reviewable record of your approaches and maintains the integrity of your progress tracking."
            },
            {
              q: "Why aren't my browser push notifications working reliably on my phone?",
              a: "Browser push notifications require specific OS permissions and often need the web app to be open or installed as a PWA. For reliable offline alerts, we highly recommend enabling Email Notifications in your Settings instead."
            }
          ].map((faq, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between font-medium outline-none">
                <span className="pr-4 text-foreground/90">{faq.q}</span>
                <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  <span className="absolute h-[2px] w-4 bg-current transition-transform duration-300 group-open:rotate-180" />
                  <span className="absolute h-4 w-[2px] bg-current transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
                </span>
              </summary>
              <div className="mt-3 text-sm text-muted-foreground leading-relaxed animate-in slide-in-from-top-2 fade-in-50 duration-300">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
