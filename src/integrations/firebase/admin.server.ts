// Server-side Firebase Admin SDK — bypasses Firestore Security Rules and can
// verify ID tokens / manage Auth users. Equivalent of the old
// src/integrations/supabase/client.server.ts `supabaseAdmin`.
//
// SECURITY: only import this from *.server.ts modules, TanStack server
// functions, or Cloud Functions — never ship it to the client bundle.
// Top-level import is safe only in other .server.ts modules; route files and
// *.functions.ts ship to the client bundle, so load it lazily there:
//   const { getAdminDb } = await import("@/integrations/firebase/admin.server");
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Service-account private keys are stored with literal `\n` in most secret
  // managers (incl. `firebase functions:secrets:set` / .env files) — un-escape them.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      ...(!projectId ? ["FIREBASE_PROJECT_ID"] : []),
      ...(!clientEmail ? ["FIREBASE_CLIENT_EMAIL"] : []),
      ...(!privateKey ? ["FIREBASE_PRIVATE_KEY"] : []),
    ];
    const message = `Missing Firebase Admin service-account env var(s): ${missing.join(", ")}. See MIGRATION_NOTES.md.`;
    console.error(`[Firebase Admin] ${message}`);
    throw new Error(message);
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

let _adminAuth: Auth | undefined;
let _adminDb: Firestore | undefined;

export function getAdminAuth(): Auth {
  if (!_adminAuth) _adminAuth = getAuth(createAdminApp());
  return _adminAuth;
}

export function getAdminDb(): Firestore {
  if (!_adminDb) _adminDb = getFirestore(createAdminApp());
  return _adminDb;
}

/** Verifies a Firebase ID token and returns the decoded claims (throws if invalid/expired). */
export async function verifyIdToken(idToken: string) {
  return getAdminAuth().verifyIdToken(idToken);
}

/**
 * Wipes every document under `users/{uid}` (all subcollections), used by the
 * "Delete my account & data" flow. Firestore does not cascade-delete, so this
 * walks each known subcollection explicitly. Mirrors deleteAccountData() in
 * src/lib/db.ts but runs with Admin privileges so it works even after the
 * client's ID token has been invalidated by account deletion.
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  const adminDb = getAdminDb();
  const subcollections = ["days", "meta", "revisionEvents", "settings", "achievements", "pushSubscriptions"];
  for (const name of subcollections) {
    const snap = await adminDb.collection("users").doc(uid).collection(name).get();
    const batchSize = 400;
    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const batch = adminDb.batch();
      snap.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await adminDb.collection("users").doc(uid).delete().catch(() => {});
}
