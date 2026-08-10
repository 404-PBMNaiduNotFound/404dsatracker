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
import { pushState, requestPushPermission, subscribeDevice } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PasswordInput } from "@/components/PasswordInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Bell, CalendarDays, Palette, PauseCircle, PlayCircle, Sliders, UserCog, HelpCircle } from "lucide-react";
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
      }
      // Failure is fine — local notifications already work.
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

  async function deleteAccount() {
    try {
      // Best-effort client-side cleanup while still authenticated. The
      // deleteUserData Cloud Function (functions/src/index.ts) is the
      // authoritative cascade delete and also runs server-side right before
      // the Auth user record itself is removed, so nothing is left behind
      // even if a step here fails partway.
      await deleteAccountData(userId);
      const user = auth.currentUser;
      if (user) await deleteUser(user);
      await qc.cancelQueries();
      qc.clear();
      toast.success("Your data has been deleted.");
      router.push("/auth?next=/today");
    } catch (e) {
      const needsReauth = e instanceof FirebaseError && e.code === "auth/requires-recent-login";
      toast.error("Could not delete your account", {
        description: needsReauth
          ? "For security, please sign out and sign back in, then try deleting your account again."
          : e instanceof Error
            ? e.message
            : "Please try again.",
      });
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
        description="How many problems of each difficulty you want per day. Enter any custom pace (Minimum required: Easy: 2, Medium: 1, Hard: 1)."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(["easy", "medium", "hard"] as const).map((k) => {
            const min = minPace[k];
            const currentVal = counts[k];
            const isInvalid = currentVal === undefined || currentVal < min;

            return (
              <div key={k}>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`count-${k}`} className="capitalize font-medium">
                    {k} per day
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Min {min}</span>
                </div>
                <Input
                  id={`count-${k}`}
                  type="number"
                  min={min}
                  max={50}
                  value={counts[k] === 0 ? "" : (counts[k] ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = parseInt(raw, 10);
                    setCounts((c) => ({
                      ...c,
                      [k]: isNaN(parsed) ? 0 : parsed,
                    }));
                    setCountsDirty(true);
                  }}
                  className={cn("mt-1.5", isInvalid && "border-destructive focus-visible:ring-destructive")}
                />
                {isInvalid && (
                  <p className="mt-1 text-[11px] text-destructive font-medium">
                    Must be at least {min}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {!isCountsValid && (
          <p className="mt-3.5 text-xs text-destructive font-medium">
            ⚠️ Invalid pace configuration. Please set Easy to at least 2, Medium to at least 1, and Hard to at least 1.
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {preview.remaining} problems left → about <strong>{preview.need}</strong> more days.
          Completed days are never touched.
        </p>
        <Button className="mt-4" disabled={!countsDirty || busy || !isCountsValid} onClick={() => void applyCounts()}>
          Apply &amp; redistribute
        </Button>
      </Section>

      <Section
        icon={CalendarDays}
        title="Plan start date"
        description="The date your DSA plan begins. Changing this reseeds all days from scratch — your progress marks will be lost."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-start-date">Start date</Label>
            <input
              id="plan-start-date"
              type="date"
              value={planStartDate}
              onChange={(e) => {
                setPlanStartDate(e.target.value);
                setStartDirty(true);
              }}
              className="mt-1.5 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <ConfirmDialog
            trigger={
              <Button disabled={!startDirty || startBusy}>
                Apply new start date
              </Button>
            }
            title="Reset plan to new start date?"
            description={`This reseeds all ${preview.need} days from the new date. Your existing progress (done problems, notes) will be lost. This cannot be undone.`}
            confirmLabel="Yes, reset plan"
            destructive
            onConfirm={applyStartDate}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Current start date: <strong>{formatDate(startDate)}</strong>
        </p>
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="push" className="font-semibold text-base">Browser notifications</Label>
              <p className="text-xs text-muted-foreground">
                {pushPerm === "unsupported"
                  ? "Not supported in this browser."
                  : pushPerm === "denied"
                    ? "Blocked — open browser site settings and allow notifications."
                    : pushPerm === "granted"
                      ? "✓ Permission granted — browser notifications are active when tab is open."
                      : "Master toggle for all local browser alerts."}
              </p>
            </div>
            <Switch
              id="push"
              checked={settings.pushEnabled}
              disabled={pushPerm === "unsupported" || pushPerm === "denied"}
              onCheckedChange={(v) => void togglePush(v)}
            />
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
        description="Change your display name or password, connect Google, or delete everything."
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

        <Separator className="my-5" />

        <ConfirmDialog
          title="Delete your account data?"
          description="This permanently removes your entire plan, notes, AI caches, achievements and chat history. This cannot be undone."
          confirmWord="DELETE"
          confirmLabel="Delete everything"
          onConfirm={deleteAccount}
          trigger={
            <Button variant="outline" className="text-destructive">
              Delete my account &amp; data
            </Button>
          }
        />
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
