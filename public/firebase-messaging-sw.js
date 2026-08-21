/* FCM background service worker for DSA404 background push notifications */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA5IQxOyoqWUTHWF0UCZPHyYJ9Giv1_-8Q",
  authDomain: "tracker-3751e.firebaseapp.com",
  projectId: "tracker-3751e",
  storageBucket: "tracker-3751e.firebasestorage.app",
  messagingSenderId: "662558145403",
  appId: "1:662558145403:web:b624b59a5a0997560d1bde",
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
  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: "dsa-reminder",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/today"));
});
