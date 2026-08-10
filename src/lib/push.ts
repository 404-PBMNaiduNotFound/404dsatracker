/**
 * Browser notification helpers.
 *
 * Two layers:
 *  1. LOCAL — plain Web Notifications API. Works whenever the user grants
 *     permission. No VAPID / FCM / service-worker required. Used by
 *     ReminderRunner when the tab is open.
 *  2. BACKGROUND (optional) — FCM via firebase-messaging-sw.js. Only
 *     attempted if NEXT_PUBLIC_FIREBASE_VAPID_KEY is set in env. Failing
 *     to subscribe to FCM does NOT prevent local notifications from working.
 */

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator;

export type PushState = "unsupported" | "default" | "granted" | "denied";

export function pushState(): PushState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

/** Register the firebase messaging service worker (best-effort). */
export async function registerReminderWorker() {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch {
    return null;
  }
}

/**
 * Request notification permission from the browser.
 * Returns the new permission state.
 */
export async function requestPushPermission(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  return result as PushState;
}

/**
 * Attempt to subscribe this device to FCM background push.
 * This is OPTIONAL — it only works when NEXT_PUBLIC_FIREBASE_VAPID_KEY
 * is set. If it fails for any reason, local notifications still work.
 *
 * @returns true if FCM subscription succeeded, false otherwise (non-fatal).
 */
export async function subscribeDevice(userId: string): Promise<boolean> {
  // Next.js env var (must be prefixed with NEXT_PUBLIC_ to reach the browser)
  const vapidKey =
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string | undefined;

  if (!vapidKey) {
    // No VAPID key configured — FCM background push unavailable.
    // Local (in-tab) notifications will still work fine.
    console.info(
      "[push] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — FCM background push disabled. " +
        "Local tab notifications are still active."
    );
    return false;
  }

  try {
    const reg = await registerReminderWorker();
    if (!reg) return false;

    const { getMessagingIfSupported } = await import(
      "@/integrations/firebase/client"
    );
    const messaging = await getMessagingIfSupported();
    if (!messaging) return false;

    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    if (!token) return false;

    // Save token to Firestore so Cloud Functions can reach it
    const { doc, setDoc } = await import("firebase/firestore");
    const { pushSubscriptionsCol } = await import("@/lib/db");
    await setDoc(doc(pushSubscriptionsCol(userId), token), {
      token,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    console.warn("[push] FCM subscription failed (non-fatal):", e);
    return false;
  }
}

/**
 * Show a local browser notification.
 * Uses Service Worker showNotification if available (survives tab hidden),
 * falls back to plain new Notification().
 */
export async function showLocalReminder(title: string, body: string) {
  if (!pushSupported()) return;
  if (Notification.permission !== "granted") return;

  // 1. Try plain Notification first (best for foreground tabs on Desktop)
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "dsa-reminder" });
    // If it didn't throw, we're good.
    return;
  } catch (e) {
    // Usually throws on mobile (Android Chrome requires ServiceWorker for notifications)
  }

  // 2. Fallback to ServiceWorker-based notification
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "dsa-reminder",
      });
    }
  } catch (e) {
    console.warn("[push] showLocalReminder failed entirely:", e);
  }
}

/** "19:00" → minutes since midnight */
export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
