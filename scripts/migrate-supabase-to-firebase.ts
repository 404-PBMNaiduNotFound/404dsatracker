/**
 * ONE-TIME MIGRATION SCRIPT — not part of the app bundle, not imported from
 * `src/`. Run manually, once, after Firebase Auth/Firestore are set up and
 * before cutting the app over. Delete or archive this file (and the
 * `scripts/` folder) once the migration is verified complete.
 *
 * What it does:
 *   1. Reads every row from each Supabase table (via the service role key).
 *   2. Creates/looks up the matching Firebase Auth user for each Supabase
 *      auth user (matched by email; created with a random password if
 *      missing — existing users must reset their password on first login,
 *      since Supabase password hashes cannot be ported to Firebase).
 *   3. Writes each row into the corresponding Firestore path (see
 *      MIGRATION_NOTES.md / src/lib/db.ts for the schema).
 *   4. Logs a summary (rows read vs. docs written per collection) and any
 *      rows that failed to migrate, so nothing is silently dropped.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... \
 *     bun run scripts/migrate-supabase-to-firebase.ts
 *   (or: node --experimental-strip-types scripts/migrate-supabase-to-firebase.ts)
 *
 * Requires `@supabase/supabase-js` and `firebase-admin` to be installed
 * (they are NOT app dependencies post-migration — `bun add -d` them
 * temporarily, or run this before removing @supabase/supabase-js from
 * package.json).
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const FIREBASE_PROJECT_ID = requireEnv("FIREBASE_PROJECT_ID");
const FIREBASE_CLIENT_EMAIL = requireEnv("FIREBASE_CLIENT_EMAIL");
const FIREBASE_PRIVATE_KEY = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY,
  }),
});
const auth = getAuth();
const db = getFirestore();

const summary: Record<string, { read: number; written: number; failed: string[] }> = {};
function track(collection: string) {
  summary[collection] ??= { read: 0, written: 0, failed: [] };
  return summary[collection];
}

async function writeInBatches(refs: FirebaseFirestore.DocumentReference[], data: Record<string, unknown>[], firestore: Firestore) {
  const BATCH_SIZE = 400;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = firestore.batch();
    refs.slice(i, i + BATCH_SIZE).forEach((ref, j) => batch.set(ref, data[i + j]));
    await batch.commit();
  }
}

/** Maps a Supabase auth user's UUID to the newly created/matched Firebase uid. */
async function migrateUser(row: { id: string; email: string | null; display_name: string | null }) {
  const stats = track("profiles/users");
  stats.read += 1;
  try {
    let firebaseUser;
    if (row.email) {
      try {
        firebaseUser = await auth.getUserByEmail(row.email);
      } catch {
        firebaseUser = await auth.createUser({
          email: row.email,
          password: randomUUID(), // random — user resets via "Forgot password"
          displayName: row.display_name ?? undefined,
          emailVerified: false,
        });
      }
    } else {
      firebaseUser = await auth.createUser({ displayName: row.display_name ?? undefined });
    }

    await db.doc(`users/${firebaseUser.uid}`).set(
      {
        email: row.email ?? "",
        displayName: row.display_name ?? "",
        createdAt: new Date().toISOString(),
        migratedFromSupabaseId: row.id,
      },
      { merge: true },
    );
    stats.written += 1;
    return { supabaseId: row.id, firebaseUid: firebaseUser.uid };
  } catch (e) {
    stats.failed.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function migrateDays(supabaseId: string, uid: string) {
  const stats = track("days");
  const { data, error } = await supabase.from("days").select("*").eq("user_id", supabaseId);
  if (error) throw error;
  stats.read += data?.length ?? 0;
  if (!data || data.length === 0) return;

  const refs = data.map((r) => db.doc(`users/${uid}/days/${r.day_number}`));
  const docs = data.map((r) => ({
    id: r.id,
    dayNumber: r.day_number,
    date: r.date,
    section: r.section,
    topic: r.topic,
    subtopics: r.subtopics ?? [],
    problems: r.problems ?? [],
    checklist: r.checklist ?? [],
    status: r.status,
    notes: r.notes ?? "",
    revisionNotes: r.revision_notes ?? "",
    aiExplainer: r.ai_explainer ?? null,
    chatThread: (r.chat_thread ?? []).slice(-50),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  }));
  await writeInBatches(refs, docs, db);
  stats.written += refs.length;
}

async function migratePlanMeta(supabaseId: string, uid: string) {
  const stats = track("meta/plan");
  const { data, error } = await supabase
    .from("plan_meta")
    .select("*")
    .eq("user_id", supabaseId)
    .maybeSingle();
  if (error) throw error;
  stats.read += data ? 1 : 0;
  if (!data) return;
  await db.doc(`users/${uid}/meta/plan`).set({
    schemaVersion: data.schema_version,
    startDate: data.start_date,
    lastActiveDate: data.last_active_date,
    lastSyncedAt: data.last_synced_at,
  });
  stats.written += 1;
}

async function migrateSettings(supabaseId: string, uid: string) {
  const stats = track("settings/prefs");
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", supabaseId)
    .maybeSingle();
  if (error) throw error;
  stats.read += data ? 1 : 0;
  if (!data) return;
  await db.doc(`users/${uid}/settings/prefs`).set({
    theme: data.theme,
    easyPerDay: data.easy_per_day,
    mediumPerDay: data.medium_per_day,
    hardPerDay: data.hard_per_day,
    pushEnabled: false, // old web-push subscriptions don't carry over; FCM tokens are re-issued client-side
    emailEnabled: data.email_enabled,
    reminderTime: data.reminder_time,
    timezone: data.timezone,
    paused: data.paused,
    pausedFrom: data.paused_from,
    pausedDays: data.paused_days,
    resumeDate: data.resume_date,
    lastReminderSentOn: data.last_reminder_sent_on,
    updatedAt: new Date().toISOString(),
  });
  stats.written += 1;
}

async function migrateRevisionEvents(supabaseId: string, uid: string) {
  const stats = track("revisionEvents");
  const { data, error } = await supabase
    .from("revision_events")
    .select("*")
    .eq("user_id", supabaseId);
  if (error) throw error;
  stats.read += data?.length ?? 0;
  if (!data || data.length === 0) return;
  const refs = data.map(() => db.collection(`users/${uid}/revisionEvents`).doc());
  const docs = data.map((r) => ({ kind: r.kind, detail: r.detail ?? "", createdAt: r.created_at }));
  await writeInBatches(refs, docs, db);
  stats.written += refs.length;
}

async function migrateAchievements(supabaseId: string, uid: string) {
  const stats = track("achievements");
  const { data, error } = await supabase.from("achievements").select("*").eq("user_id", supabaseId);
  if (error) throw error;
  stats.read += data?.length ?? 0;
  if (!data || data.length === 0) return;
  const refs = data.map((r) => db.doc(`users/${uid}/achievements/${r.code}`));
  const docs = data.map((r) => ({ code: r.code, earnedAt: r.earned_at }));
  await writeInBatches(refs, docs, db);
  stats.written += refs.length;
}

async function main() {
  console.log("Reading Supabase profiles...");
  const { data: profiles, error } = await supabase.from("profiles").select("*");
  if (error) throw error;
  console.log(`Found ${profiles?.length ?? 0} users to migrate.`);

  for (const profile of profiles ?? []) {
    const mapped = await migrateUser(profile);
    if (!mapped) continue;
    const { supabaseId, firebaseUid } = mapped;
    console.log(`Migrating ${profile.email ?? supabaseId} -> uid ${firebaseUid}`);
    try {
      await migrateDays(supabaseId, firebaseUid);
      await migratePlanMeta(supabaseId, firebaseUid);
      await migrateSettings(supabaseId, firebaseUid);
      await migrateRevisionEvents(supabaseId, firebaseUid);
      await migrateAchievements(supabaseId, firebaseUid);
    } catch (e) {
      console.error(`  FAILED for ${supabaseId}:`, e);
    }
  }

  console.log("\n=== Migration summary ===");
  for (const [collection, s] of Object.entries(summary)) {
    console.log(`${collection}: read ${s.read}, written ${s.written}, failed ${s.failed.length}`);
    s.failed.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(
    "\nDone. Existing users must use 'Forgot password' on first login (Supabase password hashes cannot be ported to Firebase). Google-linked accounts sign in with Google as before.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
