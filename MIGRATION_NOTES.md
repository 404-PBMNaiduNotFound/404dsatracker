# Migration Notes — Supabase → Firebase

This app's entire backend (Auth, database, scheduled reminders, push) has
been swapped from Supabase to Firebase. No business logic, UI, or feature
changed — `src/lib/plan.ts`, `src/lib/gamification.ts`,
`src/lib/verified-links.ts`, and every component's behavior are untouched.

## 1. Firebase console setup (one-time)

1. Create a Firebase project (or reuse an existing GCP project).
2. **Authentication** → Sign-in method → enable **Email/Password** and
   **Google**.
3. **Firestore Database** → create a database (production mode — the rules
   in `firestore.rules` provide access control).
4. **Cloud Messaging** → note the default config; under *Web Push
   certificates*, generate a key pair — this is `VITE_FIREBASE_VAPID_KEY`.
5. **Build → AI Logic** → enable the **Gemini Developer API**. Copy the API
   key into `GEMINI_API_KEY` in `.env`; set `GEMINI_MODEL` (default: `gemini-2.5-flash`).
6. **Project settings → General → Your apps** → add a Web app, copy the SDK
   config into `VITE_FIREBASE_*` (see `.env`).
7. **Project settings → Service accounts** → *Generate new private key* →
   use the three fields (`project_id`, `client_email`, `private_key`) for
   `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`.
8. Install the Firebase CLI (`npm i -g firebase-tools`), `firebase login`,
   then set `.firebaserc`'s `default` project to your real project ID.

## 2. Environment variables

All variables live in `.env` (see the file for the full list) —
`VITE_FIREBASE_*` (client, safe to expose), `FIREBASE_PROJECT_ID` /
`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (server-only Admin SDK
credentials — **never** commit real values or expose to the client bundle).

AI prompt generation runs server-side via Gemini ().
Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (default: `gemini-2.5-flash`)
in `.env`. The key is never sent to the browser.

**`public/firebase-messaging-sw.js` cannot read `.env`** (it's a static
asset, not processed by Vite). Open it and fill in the five
`REPLACE_WITH_VITE_FIREBASE_*` placeholders by hand with the same values as
your `VITE_FIREBASE_*` vars. These are not secret — they identify the
project, they don't authorize access to it — so this is safe to commit.

## 3. Secrets for Cloud Functions

The `sendReminders` scheduled function needs two secrets (separate from the
app's `.env` — Cloud Functions secrets are managed by Google Secret
Manager):

```bash
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set REMINDER_FROM_EMAIL
```

FCM push doesn't need a separate secret — the function authenticates with
its default service-account credentials.

## 4. Deploying

```bash
# Firestore rules + indexes
firebase deploy --only firestore

# Cloud Functions (sendReminders scheduled fn, deleteUserData account-cleanup trigger)
cd functions && npm install && cd ..
firebase deploy --only functions
```

`sendReminders` runs every 15 minutes via Cloud Scheduler (same cadence as
the old `pg_cron` job). `deleteUserData` is a `beforeUserDeleted` Auth
blocking function — it fires automatically whenever a user's Firebase Auth
account is deleted (including from the in-app "Delete my account & data"
flow in Settings), and wipes every Firestore subcollection under
`users/{uid}` before the account is gone.

## 5. Data model

```
users/{uid}                          <- profile doc (was `profiles`)
users/{uid}/days/{dayNumber}         <- one doc per day (was `days`, day_number as doc ID)
users/{uid}/meta/plan                <- single doc (was `plan_meta`)
users/{uid}/revisionEvents/{eventId} <- (was `revision_events`)
users/{uid}/settings/prefs           <- single doc (was `user_settings`)
users/{uid}/achievements/{code}      <- (was `achievements`; not written client-side today —
                                          badges are computed on the fly in gamification.ts —
                                          kept for parity/future use, write-restricted to
                                          Cloud Functions via firestore.rules)
users/{uid}/pushSubscriptions/{token}<- (was `push_subscriptions`; doc ID = FCM token)
```

Access control lives in `firestore.rules` (every subcollection is
`isOwner(uid)`-only, mirroring the old "own row only" RLS policies).
`firestore.indexes.json` includes the one collection-group index
`sendReminders` needs (`settings.paused`, collection-group scope).

## 6. Running the one-time data migration

Once Firebase is set up and both backends are reachable:

```bash
# temporarily install the two extra deps this standalone script needs
npm i -D @supabase/supabase-js

SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
FIREBASE_PROJECT_ID="..." \
FIREBASE_CLIENT_EMAIL="..." \
FIREBASE_PRIVATE_KEY="..." \
  npx tsx scripts/migrate-supabase-to-firebase.ts
```

It reads every Supabase table, creates/matches a Firebase Auth user per
`profiles` row (by email), and writes each row into the Firestore path
above, logging a read/written/failed count per collection at the end.

**Passwords cannot be migrated** — Supabase's password hashes aren't
portable to Firebase, so existing email/password users get a random
Firebase password and must use "Forgot password" on first login.
Google-linked users are unaffected (they sign in with Google as before).

Delete or archive `scripts/migrate-supabase-to-firebase.ts` (and remove the
temporary `@supabase/supabase-js` dev dependency) once the migration is
verified complete — it is not part of the production app.

## 7. What changed vs. what didn't

**Changed:** `src/integrations/firebase/*` (new, replaces
`src/integrations/supabase/*` and the Lovable OAuth helper in
`src/integrations/lovable/`), `src/lib/db.ts`, `src/lib/settings.ts`,
`src/lib/push.ts`, `src/lib/ai.functions.ts`, `src/hooks/useAuth.tsx`,
`src/routes/auth.tsx`, `src/routes/reset-password.tsx`,
`src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/settings.tsx`
(account/Google-link/delete actions only), `src/components/AppShell.tsx`
(sign-out only), `src/start.ts`, `public/firebase-messaging-sw.js` (replaces
`public/sw.js`), plus the new `functions/`, `firestore.rules`,
`firebase.json`, `firestore.indexes.json`, `.firebaserc`, and
`scripts/migrate-supabase-to-firebase.ts`.

**Unchanged:** `Day`/`Problem`/`ChecklistItem`/`AiExplainer`/`ChatMessage`
type shapes in `src/lib/types.ts`; all cascade/rebalance/pause/missed-week
logic in `src/hooks/usePlan.tsx` and `src/lib/plan.ts`; `gamification.ts`;
`verified-links.ts`; every UI component's behavior
(`DayCard`, `ProblemRow`, `DayDetail`, `AiPanel`, `ChatPanel`, dark mode,
streaks/badges, TakeUForward/platform links).

The old `src/integrations/supabase/`, `supabase/` (migrations, edge
functions, config.toml), and the `@supabase/supabase-js` /
`@lovable.dev/cloud-auth-js` dependencies have already been removed —
nothing to clean up post-migration on that front.
