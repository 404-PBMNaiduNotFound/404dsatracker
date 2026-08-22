/* FCM background service worker for dsatracker background push notifications */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB4hcNj9lISsWG5s-F3JKNfBbM669SY4eI", // Replace with your actual dsatracker web API key
  authDomain: "dsatracker-67ece.firebaseapp.com",
  projectId: "dsatracker-67ece",
  storageBucket: "dsatracker-67ece.firebasestorage.app",
  messagingSenderId: "865216700488", // Correct project number for dsatracker
  appId: "1:865216700488:web:f7e7fd9b0c0ab5524ab87d", // Replace with your dsatracker Web App ID
});

const messaging = firebase.messaging();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? payload.data?.title ?? "DSA Tracker";
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

