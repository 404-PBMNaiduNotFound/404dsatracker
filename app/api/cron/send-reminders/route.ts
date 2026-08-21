import { NextResponse } from "next/server";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminDb } from "@/integrations/firebase/admin.server";
import { sendEmail } from "@/lib/email";

/**
 * Runs on an EXTERNAL schedule (cron-job.org, GitHub Actions cron, etc.)
 * instead of Firebase Cloud Scheduler, because Cloud Scheduler / Functions v2
 * scheduled triggers require the Blaze plan. This route does exactly what
 * functions/src/index.ts's `sendReminders` did, using firebase-admin
 * directly against Firestore + FCM.
 *
 * Call every 15 minutes:
 *   GET https://yourapp.vercel.app/api/cron/send-reminders?secret=YOUR_CRON_SECRET
 *
 * Set CRON_SECRET in Vercel env vars. Never deploy this without the secret
 * check below — it sends real emails/pushes to every user.
 */

interface UserSettingsRow {
  uid: string;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  timezone?: string;
  lastReminderSentOn?: string;
  reminderTime?: string;
  paused?: boolean;
  morningReminderEnabled?: boolean;
  morningReminderTime?: string;
  lastMorningReminderSentOn?: string;
  contestReminderEnabled?: boolean;
}

/** Sends one push (if tokens exist) + one email (if enabled) to a user. Non-fatal on failure. */
async function notifyUser(
  db: FirebaseFirestore.Firestore,
  uid: string,
  opts: { pushEnabled?: boolean; emailEnabled?: boolean; title: string; body: string; link?: string },
  errors: string[]
) {
  if (opts.emailEnabled) {
    try {
      const profileSnap = await db.doc(`users/${uid}`).get();
      const email = profileSnap.data()?.email as string | undefined;
      if (email) await sendEmail(email, opts.title, opts.body);
    } catch (e) {
      errors.push(`${uid} email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (opts.pushEnabled) {
    try {
      const subsSnap = await db.collection(`users/${uid}/pushSubscriptions`).get();
      const tokens = subsSnap.docs.map((d) => (d.data().token as string) ?? d.id).filter(Boolean);
      if (tokens.length > 0) {
        const result = await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: opts.title, body: opts.body },
          webpush: { fcmOptions: { link: opts.link ?? "/today" } },
        });
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
          })
        );
      }
    } catch (e) {
      errors.push(`${uid} push: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const errors: string[] = [];
  let eveningSent = 0;
  let morningSent = 0;
  let contestSent = 0;
  let topicSent = 0;

  const settingsSnap = await db
    .collectionGroup("settings")
    .where("paused", "==", false)
    .get();

  const candidates: UserSettingsRow[] = settingsSnap.docs
    .filter((d) => d.id === "prefs")
    .map((d) => ({ uid: d.ref.parent.parent!.id, ...d.data() }) as UserSettingsRow)
    .filter((row) => row.pushEnabled || row.emailEnabled);

  // ── 1. Evening "problems left" reminder (once/day, at reminderTime) ──────
  const eveningDue = candidates.filter((row) => {
    const tz = row.timezone || "Asia/Kolkata";
    const today = todayIsoInTz(tz);
    if (row.lastReminderSentOn === today) return false;
    const [h, m] = String(row.reminderTime ?? "19:00").split(":").map(Number);
    return nowMinutesInTz(tz) >= (h || 0) * 60 + (m || 0);
  });

  for (const row of eveningDue) {
    const uid = row.uid;
    try {
      const tz = row.timezone || "Asia/Kolkata";
      const today = todayIsoInTz(tz);
      const settingsRef = db.doc(`users/${uid}/settings/prefs`);

      const daySnap = await db
        .collection(`users/${uid}/days`)
        .where("date", "==", today)
        .limit(1)
        .get();
      if (daySnap.empty) continue;
      const day = daySnap.docs[0].data();

      const problems = (day.problems ?? []) as { done: boolean }[];
      const checklist = (day.checklist ?? []) as { done: boolean }[];
      const total = problems.length;
      const done = problems.filter((p) => p.done).length;
      const allChecked = checklist.length > 0 && checklist.every((c) => c.done);

      if (total > 0 && done >= total && allChecked) {
        await settingsRef.set({ lastReminderSentOn: today }, { merge: true });
        continue;
      }

      const remaining = Math.max(total - done, 0);
      await notifyUser(
        db,
        uid,
        {
          pushEnabled: row.pushEnabled,
          emailEnabled: row.emailEnabled,
          title: `Daily DSA Reminder: ${day.topic}`,
          body: `You have ${remaining} problem${remaining !== 1 ? "s" : ""} left today. Log in and complete it before your streak breaks.`,
          link: "/today",
        },
        errors
      );

      await settingsRef.set({ lastReminderSentOn: today }, { merge: true });
      eveningSent += 1;
    } catch (e) {
      errors.push(`${uid} evening: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 2. Morning reminder (once/day, at morningReminderTime) ───────────────
  const morningDue = candidates.filter((row) => {
    if (!row.morningReminderEnabled) return false;
    const tz = row.timezone || "Asia/Kolkata";
    const today = todayIsoInTz(tz);
    if (row.lastMorningReminderSentOn === today) return false;
    const [h, m] = String(row.morningReminderTime ?? "08:00").split(":").map(Number);
    return nowMinutesInTz(tz) >= (h || 0) * 60 + (m || 0);
  });

  for (const row of morningDue) {
    const uid = row.uid;
    try {
      const tz = row.timezone || "Asia/Kolkata";
      const today = todayIsoInTz(tz);
      const settingsRef = db.doc(`users/${uid}/settings/prefs`);

      const daySnap = await db
        .collection(`users/${uid}/days`)
        .where("date", "==", today)
        .limit(1)
        .get();
      const day = daySnap.empty ? null : daySnap.docs[0].data();
      const topicName = day?.topic || "Today's Topic";
      const pendingCount = day
        ? ((day.problems ?? []) as { done: boolean }[]).filter((p) => !p.done).length
        : 0;

      await notifyUser(
        db,
        uid,
        {
          pushEnabled: row.pushEnabled,
          emailEnabled: row.emailEnabled,
          title: `☀️ Morning DSA Reminder: ${topicName}`,
          body:
            pendingCount > 0
              ? `Good morning! You have ${pendingCount} problem${pendingCount !== 1 ? "s" : ""} scheduled today in ${topicName}.`
              : `Good morning! Time to start practicing ${topicName}.`,
          link: "/today",
        },
        errors
      );

      await settingsRef.set({ lastMorningReminderSentOn: today }, { merge: true });
      morningSent += 1;
    } catch (e) {
      errors.push(`${uid} morning: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 3. Contest starting-soon alerts (1hr and 10min windows) ──────────────
  const contestCandidates = candidates.filter((row) => row.contestReminderEnabled);
  if (contestCandidates.length > 0 && process.env.APP_URL) {
    try {
      const contestRes = await fetch(`${process.env.APP_URL}/api/contests`, { cache: "no-store" });
      const contests: { id: string; title: string; platform: string; startMs: number }[] = contestRes.ok
        ? await contestRes.json()
        : [];
      const nowMs = Date.now();

      for (const row of contestCandidates) {
        const uid = row.uid;
        for (const contest of contests) {
          const diffMs = contest.startMs - nowMs;
          const windows: { key: string; label: string; lo: number; hi: number }[] = [
            { key: "1h", label: "1 hour", lo: 50, hi: 70 },
            { key: "10m", label: "10 mins", lo: 5, hi: 15 },
          ];
          for (const w of windows) {
            if (diffMs <= w.hi * 60 * 1000 && diffMs > w.lo * 60 * 1000) {
              const sentRef = db.doc(`users/${uid}/contestRemindersSent/${contest.id}_${w.key}`);
              const sentSnap = await sentRef.get();
              if (sentSnap.exists) continue;
              try {
                await notifyUser(
                  db,
                  uid,
                  {
                    pushEnabled: row.pushEnabled,
                    emailEnabled: row.emailEnabled,
                    title: "🏆 Contest Starting Soon!",
                    body: `"${contest.title}" on ${contest.platform} starts in ${w.label}!`,
                    link: "/contests",
                  },
                  errors
                );
                await sentRef.set({ sentAt: new Date().toISOString() });
                contestSent += 1;
              } catch (e) {
                errors.push(`${uid} contest: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }
        }
      }
    } catch (e) {
      errors.push(`contests fetch: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (contestCandidates.length > 0 && !process.env.APP_URL) {
    errors.push("APP_URL env var not set — contest reminders skipped");
  }

  // ── 4. Topic revision reminders (per-reminder, one-shot) ─────────────────
  try {
    const topicRemindersSnap = await db
      .collectionGroup("reminders")
      .where("triggered", "==", false)
      .get();

    for (const remDoc of topicRemindersSnap.docs) {
      const uid = remDoc.ref.parent.parent?.id;
      if (!uid) continue;
      const rem = remDoc.data() as { topic: string; date: string; time: string; note?: string };
      const userRow = candidates.find((c) => c.uid === uid);
      if (!userRow) continue;

      const tz = userRow.timezone || "Asia/Kolkata";
      const today = todayIsoInTz(tz);
      const [h, m] = String(rem.time ?? "09:00").split(":").map(Number);
      const remMinutes = (h || 0) * 60 + (m || 0);
      const isDue = rem.date < today || (rem.date === today && nowMinutesInTz(tz) >= remMinutes);
      if (!isDue) continue;

      try {
        await notifyUser(
          db,
          uid,
          {
            pushEnabled: userRow.pushEnabled,
            emailEnabled: userRow.emailEnabled,
            title: `🔔 Revision Reminder: ${rem.topic}`,
            body: rem.note ? rem.note : `Time to revise your scheduled topic: ${rem.topic}`,
            link: "/review",
          },
          errors
        );
        await remDoc.ref.update({ triggered: true });
        topicSent += 1;
      } catch (e) {
        errors.push(`${uid} topic: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`topic reminders query: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({
    checked: candidates.length,
    eveningSent,
    morningSent,
    contestSent,
    topicSent,
    errors,
  });
}
