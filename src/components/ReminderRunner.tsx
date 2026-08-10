"use client";

/**
 * Upgrade 3: fires a local in-tab reminder when the user's chosen time
 * passes while the app is open (instant, no network round-trip). The
 * real background delivery for closed tabs — actual email (Resend) and
 * push (FCM) — is handled by the `sendReminders` Firebase Cloud Function,
 * scheduled every 15 minutes via Cloud Scheduler (see
 * functions/src/index.ts). This component is just the fast local nudge
 * on top of that.
 */
import { useEffect, useRef } from "react";
import { auth } from "@/integrations/firebase/client";
import { usePlan } from "@/hooks/usePlan";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useContests } from "@/hooks/useContests";
import { todayIso } from "@/lib/plan";
import { showLocalReminder, timeToMinutes } from "@/lib/push";
import { fetchTopicReminders, markTopicReminderTriggered } from "@/lib/reminders";

const STORAGE_KEY_EVENING = "dsa:last-local-reminder";
const STORAGE_KEY_MORNING = "dsa:last-morning-reminder";
const STORAGE_KEY_CONTEST = "dsa:last-contest-reminder";
const STORAGE_KEY_QUOTE = "dsa:last-quote";

const MOTIVATIONAL_QUOTES = [
  "Consistency is what transforms average into excellence. Keep coding!",
  "A bug is just a puzzle waiting to be solved. Don't give up!",
  "The expert in anything was once a beginner. Keep pushing forward.",
  "Your streak is a reflection of your discipline. Maintain it!",
  "Every problem you solve today makes you a better developer tomorrow.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "DSA is hard, but so are you. Keep grinding!",
  "Don't practice until you get it right. Practice until you can't get it wrong."
];

export function ReminderRunner() {
  const { settings } = useSettings();
  const { days } = usePlan();
  const { user } = useAuth();
  const { contests } = useContests();
  const daysRef = useRef(days);
  daysRef.current = days;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = async () => {
      const now = new Date();
      const nowMs = now.getTime();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const today = todayIso();

      // --- 1. Check Revision Tab Topic Reminders (Email & Browser) ---
      try {
        const topicReminders = await fetchTopicReminders(user?.uid);
        const targetEmail = user?.email || auth.currentUser?.email || null;

        for (const rem of topicReminders) {
          if (rem.triggered) continue;

          const remTimeMinutes = timeToMinutes(rem.time);
          const isDue = rem.date < today || (rem.date === today && nowMinutes >= remTimeMinutes);

          if (isDue) {
            void showLocalReminder(
              `🔔 Revision Reminder: ${rem.topic}`,
              rem.note ? rem.note : `Time to revise your scheduled topic: ${rem.topic}`
            );

            if (targetEmail && settings.emailEnabled) {
              try {
                await fetch("/api/send-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: targetEmail,
                    subject: `🔔 DSA Topic Revision Reminder: ${rem.topic}`,
                    message: `Hello!\n\nThis is your scheduled reminder to revise the topic "${rem.topic}".\n${
                      rem.note ? `Note: ${rem.note}\n\n` : ""
                    }Log in to DSA⁴⁰⁴ to complete your practice!\n\n- DSA⁴⁰⁴ Team`,
                  }),
                });
              } catch (err) {
                console.error("Failed to send topic reminder email:", err);
              }
            }

            await markTopicReminderTriggered(user?.uid, rem.id);
          }
        }
      } catch (err) {
        console.error("Error processing topic reminders:", err);
      }

      if (!settings.pushEnabled || settings.paused) return;

      // --- 2. Morning Browser Notification (Topic & Problems) ---
      if (settings.morningReminderEnabled) {
        if (nowMinutes >= timeToMinutes(settings.morningReminderTime)) {
          const morningStorageVal = `${today}-${settings.morningReminderTime}`;
          if (window.localStorage.getItem(STORAGE_KEY_MORNING) !== morningStorageVal) {
            const todayPlanDay = daysRef.current.find((d) => d.date === today && !d.skipped);
            const topicName = todayPlanDay?.topic || "Today's Topic";
            const pendingCount = todayPlanDay
              ? todayPlanDay.problems.filter((p) => !p.done).length
              : 0;

            window.localStorage.getItem(STORAGE_KEY_MORNING);
            window.localStorage.setItem(STORAGE_KEY_MORNING, morningStorageVal);

            void showLocalReminder(
              `☀️ Morning DSA Reminder: ${topicName}`,
              pendingCount > 0
                ? `Good morning! You have ${pendingCount} problem${pendingCount !== 1 ? "s" : ""} scheduled today in ${topicName}.`
                : `Good morning! Time to start practicing ${topicName}.`
            );
          }
        }
      }

      // --- 3. Contest Starts in 1 Hour Browser Notification ---
      if (settings.contestReminderEnabled && contests && contests.length > 0) {
        for (const contest of contests) {
          const diffMs = contest.startMs - nowMs;
          // Check if contest is starting between 50 and 70 minutes from now (~1 hour)
          if (diffMs > 50 * 60 * 1000 && diffMs <= 70 * 60 * 1000) {
            const contestStorageKey = `${STORAGE_KEY_CONTEST}:${contest.id}`;
            if (!window.localStorage.getItem(contestStorageKey)) {
              window.localStorage.setItem(contestStorageKey, "true");
              void showLocalReminder(
                `🏆 Contest Starting Soon!`,
                `"${contest.title}" on ${contest.platform} starts in 1 hour!`
              );
            }
          }
          // Check if contest is starting between 5 and 15 minutes from now (~10 mins)
          if (diffMs > 5 * 60 * 1000 && diffMs <= 15 * 60 * 1000) {
            const contestStorageKey10 = `${STORAGE_KEY_CONTEST}_10m:${contest.id}`;
            if (!window.localStorage.getItem(contestStorageKey10)) {
              window.localStorage.setItem(contestStorageKey10, "true");
              void showLocalReminder(
                `🏆 Contest in 10 mins!`,
                `"${contest.title}" on ${contest.platform} is starting soon. Don't miss it!`
              );
            }
          }
        }
      }

      // --- 4. Daily Motivational Quote ---
      if (window.localStorage.getItem(STORAGE_KEY_QUOTE) !== today) {
        window.localStorage.setItem(STORAGE_KEY_QUOTE, today);
        const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        // Add a slight delay so it doesn't fire exactly on page load jarringly
        setTimeout(() => {
          void showLocalReminder("Daily Motivation 💡", randomQuote);
        }, 3000);
      }

      // --- 5. Evening Daily Backlog Nudge ---
      if (nowMinutes < timeToMinutes(settings.reminderTime)) return;

      const storageVal = `${today}-${settings.reminderTime}`;
      if (window.localStorage.getItem(STORAGE_KEY_EVENING) === storageVal) return;

      const pastAndToday = daysRef.current.filter((d) => d.date <= today && !d.skipped);
      let pendingCount = 0;
      let pendingToday = 0;
      
      for (const d of pastAndToday) {
        const pCount = d.problems.filter((p) => !p.done).length;
        pendingCount += pCount;
        if (d.date === today) {
          pendingToday += pCount;
        }
      }

      if (pendingCount === 0) return;

      window.localStorage.setItem(STORAGE_KEY_EVENING, storageVal);
      void showLocalReminder(
        "DSA⁴⁰⁴ Reminder",
        pendingToday > 0 
          ? `You have ${pendingToday} problem${pendingToday !== 1 ? "s" : ""} left today. Complete them to save your streak!`
          : `You have ${pendingCount} problem${pendingCount !== 1 ? "s" : ""} waiting to be completed in your backlog.`
      );
    };

    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => window.clearInterval(id);
  }, [
    settings.pushEnabled,
    settings.paused,
    settings.reminderTime,
    settings.morningReminderEnabled,
    settings.morningReminderTime,
    settings.contestReminderEnabled,
    settings.emailEnabled,
    user?.uid,
    user?.email,
    user,
    contests,
  ]);

  return null;
}

