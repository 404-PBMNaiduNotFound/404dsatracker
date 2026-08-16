import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db as firestore, auth } from "@/integrations/firebase/client";
import type { Day } from "./types";
import { SCHEMA_VERSION } from "./types";
import { DEFAULT_DAILY_COUNTS, type DailyCounts, rebalanceRemaining, seedDays, START_DATE } from "./plan";
import { loadSettings } from "./settings";

// ---- Firestore layout (mirrors the old Postgres tables) ----
// users/{uid}                          <- profile doc (was `profiles`)
// users/{uid}/days/{dayNumber}         <- one doc per day (was `days`)
// users/{uid}/meta/plan                <- single doc  (was `plan_meta`)
// users/{uid}/revisionEvents/{eventId} <- (was `revision_events`)
// users/{uid}/settings/prefs           <- single doc  (was `user_settings`)
// users/{uid}/achievements/{code}      <- (was `achievements`; not written by the client today)
// users/{uid}/pushSubscriptions/{id}   <- (was `push_subscriptions`)

const userDoc = (uid: string) => doc(firestore, "users", uid);
// usernames/{username} -> { uid } — a top-level collection used purely as a
// uniqueness index, so we can check/claim a username without scanning all
// user docs. Kept as a separate collection (rather than a field-only lookup)
// so Firestore security rules can enforce "one username = one owner" with a
// plain existence check.
const usernameDoc = (username: string) => doc(firestore, "usernames", username);
const daysCol = (uid: string) => collection(firestore, "users", uid, "days");
// Use the stable `id` field (not dayNumber) as the Firestore document ID.
// dayNumber is reassigned by renumber() every time a topic is skipped, so
// using it as the doc ID caused old documents to linger and skipped days
// (which get negative dayNumbers) to sort before active days on reload.
const dayDocById = (uid: string, stableId: string) => doc(daysCol(uid), stableId);
const planMetaDoc = (uid: string) => doc(firestore, "users", uid, "meta", "plan");
const revisionEventsCol = (uid: string) => collection(firestore, "users", uid, "revisionEvents");
/** Private notes (e.g. `aboutMe`) live here, NOT on the world-readable
 * users/{uid} root doc — owner-only per firestore.rules. */
const privateProfileDoc = (uid: string) => doc(firestore, "users", uid, "private", "profile");


/** Cap on stored chat history per day — Firestore documents have a 1MB limit. */

/** Firestore batched writes cap at 500 mutations; stay well under it. */
const BATCH_SIZE = 400;

// seqIndex is the 0-based position of the day in the ordered days array.
// It is stored alongside the day so Firestore can sort by it on load,
// giving us a stable order that doesn't depend on dayNumber (which changes
// whenever a topic is skipped via renumber()).
/** Recursively strips `undefined` properties so Firestore setDoc never throws Unsupported field value: undefined */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date) && typeof (obj as any).toMillis !== "function") {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as T;
  }
  return obj;
}

const dayToFields = (d: Day, seqIndex: number) => {
  const fields = {
    id: d.id,
    dayNumber: d.dayNumber,
    seqIndex,
    date: d.date,
    section: d.section,
    topic: d.topic,
    subtopics: d.subtopics,
    problems: d.problems,
    checklist: d.checklist,
    status: d.status,
    notes: d.notes,
    revisionNotes: d.revisionNotes,
    skipped: d.skipped,
    level: d.level ?? null,
    ...(d.mergeSnapshot ? { mergeSnapshot: d.mergeSnapshot } : {}),
    ...(d.skippedProblems ? { skippedProblems: d.skippedProblems } : {}),
    ...(d.isRevisionDay ? { isRevisionDay: true } : {}),
    ...(d.revisionDayNumbers ? { revisionDayNumbers: d.revisionDayNumbers } : {}),
    updatedAt: serverTimestamp(),
  };
  return sanitizeForFirestore(fields);
};


const fieldsToDay = (data: Record<string, unknown>): Day => ({
  id: (data.id as string) ?? "",
  dayNumber: data.dayNumber as number,
  date: data.date as string,
  section: (data.section as string) ?? "",
  topic: (data.topic as string) ?? "",
  subtopics: (data.subtopics as string[]) ?? [],
  // No hardcoded TUF metadata is stored in the problem database — read
  // whatever was saved (normally null; Google search already covers TUF).
  problems: (data.problems as Day["problems"]) ?? [],
  checklist: (data.checklist as Day["checklist"]) ?? [],
  status: data.status as Day["status"],
  notes: (data.notes as string) ?? "",
  revisionNotes: (data.revisionNotes as string) ?? "",
  skipped: Boolean(data.skipped),
  level: (data.level as string | undefined) ?? undefined,
  mergeSnapshot: (data.mergeSnapshot as Day["mergeSnapshot"]) ?? undefined,
  isRevisionDay: (data.isRevisionDay as boolean | undefined) ?? undefined,
  revisionDayNumbers: (data.revisionDayNumbers as number[] | undefined) ?? undefined,
});

export interface PlanMeta {
  startDate: string;
  lastActiveDate: string;
  lastSyncedAt: string;
}

async function deleteAllDays(uid: string) {
  const snap = await getDocs(daysCol(uid));
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function writeAllDays(uid: string, days: Day[]) {
  for (let i = 0; i < days.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    days.slice(i, i + BATCH_SIZE).forEach((d, localIdx) => {
      const globalIdx = i + localIdx;
      // Use the stable `id` field as the document ID so renumber() reassigning
      // dayNumbers never creates duplicate or orphaned Firestore documents.
      batch.set(dayDocById(uid, d.id), dayToFields(d, globalIdx));
    });
    await batch.commit();
  }
}


/** Idempotent — equivalent of the old `handle_new_user` Postgres trigger. */
async function ensureProfile(uid: string) {
  const snap = await getDoc(userDoc(uid));
  if (snap.exists()) return;
  const user = auth.currentUser;
  await setDoc(
    userDoc(uid),
    {
      // NOTE: intentionally no `email` field here — users/{uid} is
      // world-readable (public profile page), and nothing in the app reads
      // email back from Firestore anyway (auth.currentUser.email is used
      // everywhere instead). Keeping it out avoids leaking it to anyone who
      // calls getDoc() directly from devtools.
      displayName: user?.displayName ?? user?.email?.split("@")[0] ?? "",
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Persists profile fields (display name, etc.) to the Firestore user doc.
 * `updateProfile` from firebase/auth only updates the Auth record — without
 * this, the name never actually lands in the database.
 */
export async function updateUserProfile(uid: string, patch: { displayName?: string }) {
  await setDoc(
    userDoc(uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ── User profile (public + private fields) ───────────────────────────────────
// Stored in users/{uid} (the root user doc), which is now world-readable.

export interface CustomLink {
  label: string;
  url: string;
}

export interface CodingProfiles {
  leetcode?: string;
  codeforces?: string;
  codechef?: string;
  atcoder?: string;
  hackerrank?: string;
  gfg?: string;
  github?: string;
  customLinks?: CustomLink[];
}

export interface PublicStats {
  totalSolved: number;
  byPlatform: Record<string, number>;
  lastUpdated: string;
}

export interface CompletedProblemSnapshot {
  name: string;
  platform: string;
  difficulty: string;
  link: string;
  code?: string;
  submissionLink?: string;
}

export interface UserProfile {
  displayName: string;
  photoURL: string;
  bannerURL?: string;
  bio: string;
  /** Private notes-to-self. Loaded for the owner's edit form only — the
   * public profile page intentionally never reads or renders this field. */
  aboutMe?: string;
  /** Public, unique handle chosen at signup — drives the /profile/{username} URL. */
  username?: string;
  codingProfiles: CodingProfiles;
  publicStats: PublicStats;
  completedProblems: CompletedProblemSnapshot[];
}

/** Username rules: 3-20 chars, lowercase letters/numbers/underscore/hyphen only. */
export const USERNAME_REGEX = /^[a-z0-9_-]{3,20}$/;

/** Normalizes user input the same way everywhere (case-insensitive handles). */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Reads the PUBLIC-safe subset of the user profile doc. Works for owner and
 * unauthenticated callers alike — this is what the public /profile/[uid]
 * page uses, so it deliberately never fetches `aboutMe` (private notes-to-
 * self, lives in a separate owner-only doc — see loadOwnerProfile below).
 * Not filtering this at read-time used to mean aboutMe was sent to every
 * anonymous visitor even though the UI didn't render it; now it's never
 * fetched for public callers in the first place.
 */
export async function loadUserProfile(uid: string): Promise<Partial<UserProfile>> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return {};
  const data = snap.data();
  return {
    displayName: (data.displayName as string) ?? "",
    photoURL: (data.photoURL as string) ?? "",
    bannerURL: (data.bannerURL as string) ?? "",
    bio: (data.bio as string) ?? "",
    username: (data.username as string) ?? "",
    codingProfiles: (data.codingProfiles as CodingProfiles) ?? {},
    publicStats: (data.publicStats as PublicStats) ?? { totalSolved: 0, byPlatform: {}, lastUpdated: "" },
    completedProblems: (data.completedProblems as CompletedProblemSnapshot[]) ?? [],
  };
}

/**
 * Owner-only profile read: everything loadUserProfile returns, PLUS the
 * private `aboutMe` field (pulled from users/{uid}/private/profile, which
 * Firestore rules restrict to isOwner(uid)). Use this on self-edit screens
 * (Settings, DeveloperProfilePage, MergedTodayProfile) — never on the public
 * profile route.
 */
export async function loadOwnerProfile(uid: string): Promise<Partial<UserProfile>> {
  const [pub, privSnap] = await Promise.all([
    loadUserProfile(uid),
    getDoc(privateProfileDoc(uid)),
  ]);
  return {
    ...pub,
    aboutMe: privSnap.exists() ? ((privSnap.data().aboutMe as string) ?? "") : "",
  };
}

/**
 * Merges a profile patch. Public fields (displayName, bio, photoURL, etc.)
 * go to the world-readable users/{uid} doc; `aboutMe` is routed to the
 * private users/{uid}/private/profile doc instead, so it never becomes
 * world-readable even though it travels through this one function. Both
 * writes remain owner-only (enforced by Firestore rules).
 */
export async function saveUserProfile(uid: string, patch: Partial<UserProfile>) {
  const { aboutMe, ...publicPatch } = patch;
  const writes: Promise<unknown>[] = [];
  if (Object.keys(publicPatch).length > 0) {
    writes.push(
      setDoc(userDoc(uid), { ...publicPatch, updatedAt: serverTimestamp() }, { merge: true }),
    );
  }
  if (aboutMe !== undefined) {
    writes.push(
      setDoc(privateProfileDoc(uid), { aboutMe, updatedAt: serverTimestamp() }, { merge: true }),
    );
  }
  await Promise.all(writes);
}

/**
 * Quick, non-authoritative availability check for live "as you type" feedback.
 * Not race-safe by itself (two people could pass this check for the same name
 * within the same moment) — claimUsername() below re-checks atomically inside
 * a transaction before actually reserving it, so a race here just means the
 * final claim step surfaces "already taken" instead of the live indicator.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const u = normalizeUsername(username);
  if (!USERNAME_REGEX.test(u)) return false;
  const snap = await getDoc(usernameDoc(u));
  return !snap.exists();
}

/**
 * Atomically claims `username` for `uid`:
 *  - throws "USERNAME_INVALID" if the format is wrong
 *  - throws "USERNAME_TAKEN" if it's already claimed by a different uid
 *  - safe to call again with the same uid+username (e.g. retry after a
 *    network blip) — it's a no-op if that uid already owns it.
 * Also mirrors the username onto users/{uid}.username so pages that already
 * load the profile doc (Settings, Profile, public profile) get it for free.
 */
export async function claimUsername(uid: string, username: string): Promise<void> {
  const u = normalizeUsername(username);
  if (!USERNAME_REGEX.test(u)) {
    throw new Error("USERNAME_INVALID");
  }
  await runTransaction(firestore, async (tx) => {
    const uRef = usernameDoc(u);
    const existing = await tx.get(uRef);
    if (existing.exists() && (existing.data() as { uid?: string }).uid !== uid) {
      throw new Error("USERNAME_TAKEN");
    }
    if (!existing.exists()) {
      tx.set(uRef, { uid, createdAt: serverTimestamp() });
    } else {
      tx.set(uRef, { uid, updatedAt: serverTimestamp() }, { merge: true });
    }
    tx.set(userDoc(uid), { username: u, updatedAt: serverTimestamp() }, { merge: true });
  });
}

/**
 * Resolves a /profile/{identifier} route param to a uid. Tries it as a
 * username first (new-style shareable links), then falls back to treating
 * it as a raw Firebase uid — this keeps every link shared before this
 * feature existed working exactly as before.
 */
export async function resolveProfileIdentifier(identifier: string): Promise<string | null> {
  const asUsername = normalizeUsername(identifier);
  if (USERNAME_REGEX.test(asUsername)) {
    const nameSnap = await getDoc(usernameDoc(asUsername));
    if (nameSnap.exists()) {
      return ((nameSnap.data() as { uid?: string }).uid) ?? null;
    }

    // Self-heal path: a now-fixed bug used to let saveBasicInfo()/saveUsername()
    // write `username` straight onto a profile doc without ever creating the
    // usernames/{username} index doc above (silently swallowed a claim
    // failure). Accounts that hit that bug have a working `username` field
    // but no index entry, so the lookup above finds nothing even though the
    // profile is real. Fall back to querying users by that field directly —
    // users/{uid} is already world-readable, so this needs no extra access —
    // and repair the missing index doc when we can (best-effort; only
    // succeeds if the viewer happens to be signed in, per the security
    // rules, but the resolution itself works either way).
    const usersByName = await getDocs(
      query(collection(firestore, "users"), where("username", "==", asUsername), limit(1)),
    );
    if (!usersByName.empty) {
      const match = usersByName.docs[0];
      setDoc(usernameDoc(asUsername), { uid: match.id, createdAt: serverTimestamp() }).catch(() => {});
      return match.id;
    }
  }
  const uidSnap = await getDoc(userDoc(identifier));
  return uidSnap.exists() ? identifier : null;
}

/**
 * Read-only loader for any user's day data — used by the public profile page
 * to build heatmap / stats without a PlanProvider.  No authentication required
 * (Firestore security rules must allow reads on `users/{uid}/days`).
 */
export async function loadPublicDays(uid: string): Promise<Day[]> {
  const snap = await getDocs(query(daysCol(uid), orderBy("seqIndex", "asc")));
  if (snap.empty) return [];
  return snap.docs.map((d) => fieldsToDay(d.data()));
}

export async function loadPlan(userId: string): Promise<{ days: Day[]; meta: PlanMeta }> {
  await ensureProfile(userId);

  const metaSnap = await getDoc(planMetaDoc(userId));
  if (!metaSnap.exists()) {
    const s = await loadSettings(userId);
    return seedPlan(userId, undefined, s?.counts);
  }

  // Order by seqIndex — the stable array-position field written by saveSequence.
  // This guarantees the correct order even after skips reassign dayNumbers.
  // Fall back to dayNumber for legacy documents that predate seqIndex.
  const daysSnap = await getDocs(query(daysCol(userId), orderBy("seqIndex", "asc")));
  if (daysSnap.empty) {
    const s = await loadSettings(userId);
    return seedPlan(userId, undefined, s?.counts);
  }

  const metaData = metaSnap.data();

  // Auto-migrate: whenever the master problem database changes, reseed plan with user's saved counts
  const storedSchemaVersion = (metaData.schemaVersion as number | undefined) ?? 0;
  if (storedSchemaVersion !== SCHEMA_VERSION) {
    const s = await loadSettings(userId);
    return seedPlan(userId, metaData.startDate as string, s?.counts);
  }

  return {
    days: daysSnap.docs.map((d) => fieldsToDay(d.data())),
    meta: {
      startDate: metaData.startDate as string,
      lastActiveDate: metaData.lastActiveDate as string,
      lastSyncedAt: (metaData.lastSyncedAt as string) ?? new Date().toISOString(),
    },
  };
}


export async function seedPlan(userId: string, startDate?: string, counts?: DailyCounts): Promise<{ days: Day[]; meta: PlanMeta }> {
  await ensureProfile(userId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const effectiveStartDate = startDate || today;

  let days = seedDays(effectiveStartDate);
  
  // Read user saved counts from settings if counts is omitted
  let effectiveCounts = counts;
  if (!effectiveCounts) {
    try {
      const s = await loadSettings(userId);
      if (s?.counts) effectiveCounts = s.counts;
    } catch {
      // fallback
    }
  }
  if (!effectiveCounts) effectiveCounts = DEFAULT_DAILY_COUNTS;

  // Rebalance initial days according to user daily pace limits so day 1 gets full quota (e.g. 5 Easy)
  days = rebalanceRemaining(days, effectiveCounts, effectiveStartDate);

  await deleteAllDays(userId);
  await writeAllDays(userId, days);

  await setDoc(planMetaDoc(userId), {
    schemaVersion: SCHEMA_VERSION,
    startDate: effectiveStartDate,
    lastActiveDate: today,
    lastSyncedAt: now.toISOString(),
  });

  return {
    days,
    meta: { startDate: effectiveStartDate, lastActiveDate: today, lastSyncedAt: now.toISOString() },
  };
}

/** Returns true if this user has never had a plan seeded (first login). */
export async function hasExistingPlan(userId: string): Promise<boolean> {
  const metaSnap = await getDoc(planMetaDoc(userId));
  return metaSnap.exists();
}

/** Changes the start date of an existing plan — reseeds all days from scratch. */
export async function changeStartDate(userId: string, newStartDate: string): Promise<{ days: Day[]; meta: PlanMeta }> {
  return seedPlan(userId, newStartDate);
}

export async function saveDay(userId: string, day: Day) {
  // For single-day saves we don't have the full sequence so we can't set
  // a correct seqIndex — use the dayDoc by id but preserve any existing seqIndex.
  await setDoc(dayDocById(userId, day.id), dayToFields(day, day.dayNumber), { merge: false });
  await touchSync(userId);
}


/** Rewrites the entire ordered sequence (used by postpone / merge / delete / revision insert). */
export async function saveSequence(userId: string, days: Day[]) {
  await deleteAllDays(userId);
  await writeAllDays(userId, days);
  await touchSync(userId);
}

export async function touchSync(userId: string) {
  const now = new Date();
  await setDoc(
    planMetaDoc(userId),
    { lastSyncedAt: now.toISOString(), lastActiveDate: now.toISOString().slice(0, 10) },
    { merge: true },
  );
}

export async function logEvent(userId: string, kind: string, detail: string) {
  const ref = doc(revisionEventsCol(userId));
  await setDoc(ref, { kind, detail, createdAt: serverTimestamp() });
}

export async function listEvents(userId: string) {
  const snap = await getDocs(query(revisionEventsCol(userId), orderBy("createdAt", "desc")));
  return snap.docs.slice(0, 25).map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Client-side best-effort cleanup while the user is still authenticated
 * (Security Rules only allow a user to delete their own documents). The
 * `deleteUserData` Cloud Function does the authoritative cascade delete of
 * every subcollection right before the Auth user itself is removed — see
 * functions/src/index.ts and MIGRATION_NOTES.md.
 */
export async function deleteAccountData(userId: string) {
  // 0. Release the claimed username (if any) so it can be reused, and so a
  // deleted account's old /profile/{username} link doesn't stay squatted
  // forever pointing at a uid that no longer resolves to anything.
  try {
    const profileSnap = await getDoc(userDoc(userId));
    const claimedUsername = profileSnap.exists() ? (profileSnap.data().username as string | undefined) : undefined;
    if (claimedUsername) {
      const uRef = usernameDoc(claimedUsername);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists() && (uSnap.data() as { uid?: string }).uid === userId) {
        await deleteDoc(uRef);
      }
    }
  } catch (e) {
    console.warn("Error releasing username:", e);
  }

  // 1. Delete all days documents
  await deleteAllDays(userId);

  // 2. Delete all revision events
  try {
    const eventsSnap = await getDocs(revisionEventsCol(userId));
    for (let i = 0; i < eventsSnap.docs.length; i += BATCH_SIZE) {
      const b = writeBatch(firestore);
      eventsSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  } catch (e) {
    console.warn("Error deleting revision events:", e);
  }

  // 3. Delete all push subscriptions
  try {
    const pushSnap = await getDocs(pushSubscriptionsCol(userId));
    for (let i = 0; i < pushSnap.docs.length; i += BATCH_SIZE) {
      const b = writeBatch(firestore);
      pushSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  } catch (e) {
    console.warn("Error deleting push subscriptions:", e);
  }

  // 4. Delete all topic reminders
  try {
    const remindersRef = collection(firestore, "users", userId, "reminders");
    const remSnap = await getDocs(remindersRef);
    for (let i = 0; i < remSnap.docs.length; i += BATCH_SIZE) {
      const b = writeBatch(firestore);
      remSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  } catch (e) {
    console.warn("Error deleting topic reminders:", e);
  }

  // 5. Delete all achievement docs
  try {
    const achRef = collection(firestore, "users", userId, "achievements");
    const achSnap = await getDocs(achRef);
    for (let i = 0; i < achSnap.docs.length; i += BATCH_SIZE) {
      const b = writeBatch(firestore);
      achSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  } catch (e) {
    console.warn("Error deleting achievements:", e);
  }

  // 6. Delete meta/plan, settings/prefs, settings/problemCompletions, and userDoc
  const batch = writeBatch(firestore);
  batch.delete(planMetaDoc(userId));
  batch.delete(settingsDoc(userId));
  batch.delete(problemCompletionsDoc(userId));
  batch.delete(userDoc(userId));
  await batch.commit();
}

// Re-exported so other modules (settings.ts, push.ts) build Firestore paths
// consistently without duplicating the collection layout above.
export { userDoc, daysCol, dayDocById, planMetaDoc, revisionEventsCol };
export const settingsDoc = (uid: string) => doc(firestore, "users", uid, "settings", "prefs");
export const pushSubscriptionsCol = (uid: string) =>
  collection(firestore, "users", uid, "pushSubscriptions");

// ── Problem-tab completions ──────────────────────────────────────────────────
// users/{uid}/settings/problemCompletions  →  { completed: string[], submissions: Record<string, CodeSubmission> }

export interface CodeSubmission {
  code: string;
  link: string;      // submission link (optional)
  submittedAt: string;
}

const problemCompletionsDoc = (uid: string) =>
  doc(firestore, "users", uid, "settings", "problemCompletions");

export async function loadProblemCompletions(uid: string): Promise<Set<string>> {
  try {
    const snap = await getDoc(problemCompletionsDoc(uid));
    if (!snap.exists()) return new Set();
    return new Set<string>((snap.data().completed as string[]) ?? []);
  } catch (e) {
    console.warn("Failed to fetch problem completions:", e);
    return new Set();
  }
}

export async function saveProblemCompletions(uid: string, completed: Set<string>): Promise<void> {
  await setDoc(problemCompletionsDoc(uid), { completed: [...completed] }, { merge: true });
}

/** Load the full code submission map (name → CodeSubmission). */
export async function loadCodeSubmissions(uid: string): Promise<Record<string, CodeSubmission>> {
  try {
    const snap = await getDoc(problemCompletionsDoc(uid));
    if (!snap.exists()) return {};
    return (snap.data().submissions as Record<string, CodeSubmission>) ?? {};
  } catch (e) {
    console.warn("Failed to fetch code submissions:", e);
    return {};
  }
}

/**
 * Save a code submission for a problem and simultaneously mark it complete.
 * This is the only way to mark a Problems-tab problem done — the UI gates
 * the checkbox behind this submission.
 */
export async function saveCodeSubmission(
  uid: string,
  problemName: string,
  submission: CodeSubmission,
  currentCompleted: Set<string>,
): Promise<void> {
  const next = new Set(currentCompleted);
  next.add(problemName);
  await setDoc(
    problemCompletionsDoc(uid),
    {
      completed: [...next],
      submissions: { [problemName]: submission },
    },
    { merge: true },
  );
}

/** Remove a code submission and unmark the problem. */
export async function removeCodeSubmission(
  uid: string,
  problemName: string,
  currentCompleted: Set<string>,
): Promise<void> {
  const next = new Set(currentCompleted);
  next.delete(problemName);
  // We use merge: true and set the key to deleteField equivalent by rebuilding without it.
  // Firestore doesn't support nested deleteField via setDoc+merge, so we load and rewrite.
  const snap = await getDoc(problemCompletionsDoc(uid));
  const existing: Record<string, CodeSubmission> = snap.exists()
    ? ((snap.data().submissions as Record<string, CodeSubmission>) ?? {})
    : {};
  delete existing[problemName];
  await setDoc(problemCompletionsDoc(uid), {
    completed: [...next],
    submissions: existing,
  });
}

// ── Fast avatar (base64 in Firestore, no Storage round-trip) ──────────────────
/**
 * Compresses the image client-side (canvas → 128×128 JPEG 55% quality → base64)
 * and stores it directly in users/{uid}.photoURL.
 * Total size ≈ 4–7 KB — well within Firestore's 1 MB doc limit.
 * No Firebase Storage upload = instant save.
 */
export async function saveAvatarBase64(uid: string, dataUrl: string): Promise<void> {
  await setDoc(
    userDoc(uid),
    { photoURL: dataUrl, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function saveBannerBase64(uid: string, dataUrl: string): Promise<void> {
  await setDoc(
    userDoc(uid),
    { bannerURL: dataUrl, updatedAt: serverTimestamp() },
    { merge: true },
  );
}