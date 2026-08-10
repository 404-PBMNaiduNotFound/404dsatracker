/**
 * Port of supabase/functions/send-reminders/index.ts to a Firebase Cloud
 * Function, plus the Firestore cascade-delete that used to be implicit via
 * Postgres `ON DELETE CASCADE` (Firestore has no equivalent, so it's done
 * explicitly here, triggered right before the Auth user is removed).
 *
 * Required secrets (set with `firebase functions:secrets:set NAME`):
 *   RESEND_API_KEY        - resend.com API key, for email delivery
 *   REMINDER_FROM_EMAIL   - e.g. "DSA⁴⁰⁴ <reminders@yourdomain.com>"
 * FCM push uses the Admin SDK's default service-account credentials — no
 * separate secret needed (unlike the old raw VAPID web-push keys).
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { beforeUserDeleted, AuthBlockingEvent } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/v2";
import { sendEmail } from "../../src/lib/email"; // Nodemailer utility

initializeApp();
const db = getFirestore();

// Resend secrets removed – using Gmail SMTP via Nodemailer

interface UserSettingsRow {
  uid: string;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  timezone?: string;
  lastReminderSentOn?: string;
  reminderTime?: string;
  paused?: boolean;
}

interface ProblemLike {
  done: boolean;
}
interface ChecklistLike {
  done: boolean;
}

function nowMinutesInTz(timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  } catch {
    const d = new Date();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

function todayIsoInTz(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Runs every 15 minutes (same cadence as the old pg_cron job). For each user
 * whose local reminder time has just passed today, who hasn't been reminded
 * yet today, who isn't paused, and who still has incomplete problems/
 * checklist items for today's Day: send an email (Resend) and/or FCM push,
 * then stamp lastReminderSentOn so they aren't reminded twice.
 */
export const sendReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    secrets: [RESEND_API_KEY, REMINDER_FROM_EMAIL],
  },
  async () => {
    const settingsSnap = await db
      .collectionGroup("settings")
      .where("paused", "==", false)
      .get();

    const candidates: UserSettingsRow[] = settingsSnap.docs
      .filter((d) => d.id === "prefs")
      .map((d) => ({ uid: d.ref.parent.parent!.id, ...d.data() } as UserSettingsRow))
      .filter((row) => row.pushEnabled || row.emailEnabled);

    const due = candidates.filter((row) => {
      const tz = row.timezone || "UTC";
      const today = todayIsoInTz(tz);
      if (row.lastReminderSentOn === today) return false;
      const [h, m] = String(row.reminderTime ?? "19:00").split(":").map(Number);
      const targetMinutes = (h || 0) * 60 + (m || 0);
      return nowMinutesInTz(tz) >= targetMinutes;
    });

    let sent = 0;
    const errors: string[] = [];
    // No Resend API key needed

    for (const row of due) {
      const uid = row.uid;
      try {
        const tz = row.timezone || "UTC";
        const today = todayIsoInTz(tz);
        const settingsRef = db.doc(`users/${uid}/settings/prefs`);

        const daySnap = await db
          .collection(`users/${uid}/days`)
          .where("date", "==", today)
          .limit(1)
          .get();
        if (daySnap.empty) continue;
        const day = daySnap.docs[0].data();

        const problems = (day.problems ?? []) as ProblemLike[];
        const checklist = (day.checklist ?? []) as ChecklistLike[];
        const total = problems.length;
        const done = problems.filter((p) => p.done).length;
        const allChecked = checklist.length > 0 && checklist.every((c) => c.done);

        // Fully done already — nothing to remind about, but still stamp so
        // we don't re-check this user again today.
        if (total > 0 && done >= total && allChecked) {
          await settingsRef.set({ lastReminderSentOn: today }, { merge: true });
          continue;
        }

        const remaining = Math.max(total - done, 0);
        const subject = `Daily DSA Reminder: ${day.topic}`;
        const body = `You have not solved the daily problem yet, please login and complete it.`;

        if (row.emailEnabled) {
          const profileSnap = await db.doc(`users/${uid}`).get();
          const email = profileSnap.data()?.email as string | undefined;
          if (email) {
            await sendEmail(email, subject, body);
          }
        }

        if (row.pushEnabled) {
          const subsSnap = await db.collection(`users/${uid}/pushSubscriptions`).get();
          const tokens = subsSnap.docs.map((d) => (d.data().token as string) ?? d.id).filter(Boolean);
          if (tokens.length > 0) {
            const result = await getMessaging().sendEachForMulticast({
              tokens,
              notification: { title: "Today's DSA plan is waiting", body },
              webpush: { fcmOptions: { link: "/today" } },
            });
            // Prune tokens Firebase reports as dead so we stop retrying them.
            await Promise.all(
              result.responses.map((r, i) => {
                if (r.success) return Promise.resolve();
                const code = r.error?.code ?? "";
                if (
                  code === "messaging/registration-token-not-registered" ||
                  code === "messaging/invalid-registration-token"
                ) {
                  return db.doc(`users/${uid}/pushSubscriptions/${tokens[i]}`).delete().catch(() => {});
                }
                return Promise.resolve();
              }),
            );
          }
        }

        await settingsRef.set({ lastReminderSentOn: today }, { merge: true });
        sent += 1;
      } catch (e) {
        errors.push(`${uid}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Contest Reminders (30 mins before start) ───────────────────────────
    try {
      const contestRes = await fetch("https://competeapi.vercel.app/contests").catch(() => null);
      if (contestRes && contestRes.ok) {
        const contests: any[] = await contestRes.json();
        const nowMs = Date.now();
        const thirtyMinMs = 30 * 60 * 1000;

        // Find contests starting in 25-35 minutes from now
        const upcomingContests = contests.filter((c: any) => {
          const startMs = new Date(c.startTime || c.start_time).getTime();
          const diff = startMs - nowMs;
          return diff > 0 && diff <= thirtyMinMs && diff >= (20 * 60 * 1000);
        });

        if (upcomingContests.length > 0) {
          const emailUsersSnap = await db
            .collectionGroup("settings")
            .where("emailEnabled", "==", true)
            .get();

          for (const docSnap of emailUsersSnap.docs) {
            if (docSnap.id !== "prefs") continue;
            const uid = docSnap.ref.parent.parent?.id;
            if (!uid) continue;

            const profileSnap = await db.doc(`users/${uid}`).get();
            const email = profileSnap.data()?.email as string | undefined;
            if (!email) continue;

            for (const contest of upcomingContests) {
              const title = contest.title || contest.name || "Coding Contest";
              const platform = contest.site || contest.platform || "Platform";
              const url = contest.url || contest.link || "#";

              await sendEmail(
                email,
                `Contest Alert: ${title} starts in 30 minutes!`,
                `remind as contest is in 30 min make sure to attend\n\nJoin here: ${url}`
              ).catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      logger.error("Contest reminder check failed", e);
    }

    logger.info(`sendReminders: checked=${due.length} sent=${sent} errors=${errors.length}`, {
      errors,
    });
  },
);

/**
 * Firestore doesn't cascade-delete, so wipe everything under users/{uid}
 * right before the Auth user record is removed.
 */
export const deleteUserData = beforeUserDeleted(async (event: AuthBlockingEvent) => {
  const uid = event.data.uid;
  const subcollections = [
    "days",
    "meta",
    "revisionEvents",
    "settings",
    "achievements",
    "pushSubscriptions",
  ];

  for (const name of subcollections) {
    const snap = await db.collection(`users/${uid}/${name}`).get();
    const batchSize = 400;
    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const batch = db.batch();
      snap.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await db.doc(`users/${uid}`).delete().catch(() => {});
  logger.info(`deleteUserData: wiped Firestore data for uid=${uid}`);
});

export { FieldValue };
