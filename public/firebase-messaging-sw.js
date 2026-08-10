/* Upgrade 3 — FCM background service worker. Kept intentionally tiny.
 *
 * IMPORTANT: this file is served as a static asset from the site root (so its
 * scope covers the whole app) and — unlike the rest of the app — it cannot
 * read import.meta.env, so the Firebase config below must be filled in by
 * hand and kept in sync with src/integrations/firebase/client.ts /
 * your VITE_FIREBASE_* values. None of these values are secret; they
 * identify the Firebase project, they don't authorize access to it.
 * See MIGRATION_NOTES.md for the one-time setup step.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");



firebase.initializeApp({
  apiKey: "AIzaSyB4hcNj9lISsWG5s-F3JKNfBbM669SY4eI",
  authDomain: "dsatracker-67ece.firebaseapp.com",
  projectId: "dsatracker-67ece",
  storageBucket: "dsatracker-67ece.firebasestorage.app",
  messagingSenderId: "865216700488",
  appId: "1:865216700488:web:f7e7fd9b0c0ab5524ab87d",
});

const messaging = firebase.messaging();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? payload.data?.title ?? "DSA⁴⁰⁴";
  const body =
    payload.notification?.body ?? payload.data?.body ?? "You still have problems left for today.";
  self.registration.showNotification(title, { body, icon: "/favicon.ico", tag: "dsa-reminder" });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/today"));
});
