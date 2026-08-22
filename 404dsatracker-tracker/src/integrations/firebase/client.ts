// Client-side Firebase SDK init. One import, everywhere — mirrors how
// src/integrations/supabase/client.ts used to expose a single `supabase`
// client. Import `auth`, `db`, or `getMessagingIfSupported()` from here;
// never call `initializeApp` anywhere else.
//
// NOTE: unlike the old Supabase client, these are NOT wrapped in a lazy
// Proxy. The Firebase Auth/Firestore SDKs use branded class internals that
// break when methods/getters (e.g. `auth.currentUser`, `auth.onAuthStateChanged`)
// are invoked through a Proxy receiver, so `auth`/`db` are real instances,
// initialized once on first import.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth as getAuthFromFirebase, connectAuthEmulator } from "firebase/auth";
import { getFirestore as getFirestoreFromFirebase, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { isSupported, type Messaging } from "firebase/messaging";

// Suppress known Firebase Auth / Firestore IndexedDB internal closing warnings in browser
if (typeof window !== "undefined") {
  const isClosingOrHiddenError = (reason: any): boolean => {
    if (!reason) return false;
    const msg = typeof reason === "string" ? reason : reason?.message || reason?.name || String(reason);
    return (
      msg.includes("Database is closing") ||
      msg.includes("Database is closing/hidden") ||
      msg.includes("BloomFilter") ||
      msg.includes("indexedDB")
    );
  };

  window.addEventListener("unhandledrejection", (e) => {
    if (isClosingOrHiddenError(e.reason)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  window.addEventListener("error", (e) => {
    if (isClosingOrHiddenError(e.error || e.message)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

function readFirebaseConfig() {
  // Next.js public environment variables (NEXT_PUBLIC_*)
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemo",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abc123",
  };

  // Check if using real config or defaults (for emulator mode)
  const isUsingDefaults = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (isUsingDefaults && typeof window !== "undefined") {
    console.log("[Firebase] Using emulator mode - connect to http://localhost:4000");
  }

  return cfg;
}

function ensureApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(readFirebaseConfig());
}

const app = ensureApp();

export const auth = getAuthFromFirebase(app);
export const db = getFirestoreFromFirebase(app);
export const storage = getStorage(app);

// Connect to emulators if running locally (client-side only) - synchronous
if (typeof window !== "undefined" && app && auth && db) {
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  
  const useEmulators = isLocalhost && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (useEmulators) {
    try {
      if (!auth.emulatorConfig) {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      }
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      console.log("[Firebase] Connected to local emulators");
    } catch (error) {
      console.log("[Firebase] Emulator connection:", (error as any).message);
    }
  }
}

export function getFirebaseApp(): FirebaseApp {
  return app;
}

/**
 * Resolves once with the current user after Firebase Auth's initial state
 * check (reading the persisted session) completes.
 */
export function waitForAuthUser() {
  return new Promise<import("firebase/auth").User | null>((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }
    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

/** Firebase Messaging only works in the browser and only where the API is supported. */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    if (!(await isSupported())) return null;
    const { getMessaging } = await import("firebase/messaging");
    return getMessaging(app);
  } catch {
    return null;
  }
}
