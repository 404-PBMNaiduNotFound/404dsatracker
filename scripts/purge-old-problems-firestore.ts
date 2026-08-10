/**
 * scripts/purge-old-problems-firestore.ts
 *
 * One-off admin script: deletes every user's stored `days` (which embed the
 * OLD problem set) and their `meta/plan` doc across all of Firestore, so on
 * next login `loadPlan()` (src/lib/db.ts) reseeds them from the new master
 * problem database (src/lib/master-problems.ts / practice-problems.ts).
 *
 * You normally do NOT need to run this: `loadPlan()` already auto-reseeds
 * any user whose stored `schemaVersion` is behind the current one (see
 * SCHEMA_VERSION in src/lib/types.ts), the next time they open the app.
 * Run this script only if you want every user's old problem data wiped
 * immediately/in bulk (e.g. right after deploying this change), instead of
 * waiting for each user's next login to trigger the automatic reseed.
 *
 * What it deletes, per user:
 *   users/{uid}/days/*        <- old per-day docs, each embeds old problems
 *   users/{uid}/meta/plan     <- forces a full reseed on next load
 * What it does NOT touch: profile, settings, achievements, revisionEvents,
 * pushSubscriptions, or Auth accounts — only plan/problem data.
 *
 * The master problem catalog itself is never read from or written to
 * Firestore by this script (or anywhere else in the app) — it always lives
 * in the local TS files under src/lib/, per project policy.
 *
 * Usage:
 *   1. Ensure these env vars are set (same ones the app already uses, see
 *      MIGRATION_NOTES.md): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *      FIREBASE_PRIVATE_KEY.
 *   2. Dry run first (default) — lists what WOULD be deleted, deletes nothing:
 *        npx tsx scripts/purge-old-problems-firestore.ts
 *   3. Actually delete:
 *        npx tsx scripts/purge-old-problems-firestore.ts --confirm
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  const existing = getApps()[0];
  const app =
    existing ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  return getFirestore(app);
}

const BATCH_SIZE = 400;

async function deleteCollection(db: FirebaseFirestore.Firestore, ref: FirebaseFirestore.CollectionReference, dryRun: boolean) {
  const snap = await ref.get();
  if (dryRun) return snap.size;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

async function main() {
  const dryRun = !process.argv.includes("--confirm");
  const db = getAdminDb();

  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars. See MIGRATION_NOTES.md.",
    );
  }

  console.log(dryRun ? "DRY RUN — nothing will be deleted (pass --confirm to actually delete)\n" : "LIVE RUN — deleting old plan/problem data\n");

  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} user(s).`);

  let totalDayDocsDeleted = 0;
  let totalPlanMetaDeleted = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const daysRef = db.collection("users").doc(uid).collection("days");
    const daysDeleted = await deleteCollection(db, daysRef, dryRun);
    totalDayDocsDeleted += daysDeleted;

    const planMetaRef = db.collection("users").doc(uid).collection("meta").doc("plan");
    const planMetaSnap = await planMetaRef.get();
    if (planMetaSnap.exists) {
      totalPlanMetaDeleted += 1;
      if (!dryRun) await planMetaRef.delete();
    }

    console.log(
      `  user ${uid}: ${daysDeleted} day doc(s)${dryRun ? " would be" : ""} deleted, ` +
        `meta/plan ${planMetaSnap.exists ? (dryRun ? "would be deleted" : "deleted") : "absent (already clean)"}`,
    );
  }

  console.log(
    `\n${dryRun ? "Would delete" : "Deleted"}: ${totalDayDocsDeleted} day doc(s) and ${totalPlanMetaDeleted} meta/plan doc(s) across ${usersSnap.size} user(s).`,
  );
  console.log(
    dryRun
      ? "\nRe-run with --confirm to actually delete. Each user's plan will auto-reseed from the new master problem database on their next login (loadPlan() in src/lib/db.ts) — no other action needed."
      : "\nDone. Each user's plan will auto-reseed from the new master problem database on their next login.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
