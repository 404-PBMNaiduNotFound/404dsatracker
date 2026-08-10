import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db as firestore } from "@/integrations/firebase/client";

export interface TopicReminder {
  id: string;
  topic: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  note?: string;
  createdAt: number;
  triggered?: boolean;
}

const LOCAL_STORAGE_KEY = "dsa:topic_reminders";

const remindersCol = (uid: string) => {
  if (!firestore) return null;
  return collection(firestore, "users", uid, "reminders");
};

export async function fetchTopicReminders(uid?: string | null): Promise<TopicReminder[]> {
  if (typeof window !== "undefined") {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localItems: TopicReminder[] = rawLocal ? JSON.parse(rawLocal) : [];

    if (!uid || !firestore) return localItems;

    try {
      const col = remindersCol(uid);
      if (!col) return localItems;
      const q = query(col, orderBy("date", "asc"));
      const snap = await getDocs(q);
      const items: TopicReminder[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TopicReminder, "id">),
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
      return items;
    } catch (e) {
      console.warn("Failed to fetch reminders from Firestore, using local storage:", e);
      return localItems;
    }
  }
  return [];
}

export async function addTopicReminder(
  uid: string | undefined | null,
  reminder: Omit<TopicReminder, "id" | "createdAt" | "triggered">
): Promise<TopicReminder> {
  const newId = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: TopicReminder = {
    ...reminder,
    id: newId,
    createdAt: Date.now(),
    triggered: false,
  };

  if (typeof window !== "undefined") {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: TopicReminder[] = rawLocal ? JSON.parse(rawLocal) : [];
    const updated = [...list, item];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }

  if (uid && firestore) {
    try {
      const ref = doc(firestore, "users", uid, "reminders", newId);
      const dataToSave: Record<string, any> = {
        ...item,
        updatedAt: serverTimestamp(),
      };
      
      // Firestore doesn't support undefined values
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
          delete dataToSave[key];
        }
      });

      await setDoc(ref, dataToSave);
    } catch (e) {
      console.warn("Failed to write reminder to Firestore:", e);
    }
  }

  return item;
}

export async function deleteTopicReminder(
  uid: string | undefined | null,
  reminderId: string
): Promise<void> {
  if (typeof window !== "undefined") {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawLocal) {
      const list: TopicReminder[] = JSON.parse(rawLocal);
      const updated = list.filter((r) => r.id !== reminderId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  }

  if (uid && firestore) {
    try {
      const ref = doc(firestore, "users", uid, "reminders", reminderId);
      await deleteDoc(ref);
    } catch (e) {
      console.warn("Failed to delete reminder from Firestore:", e);
    }
  }
}

export async function markTopicReminderTriggered(
  uid: string | undefined | null,
  reminderId: string
): Promise<void> {
  if (typeof window !== "undefined") {
    const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawLocal) {
      const list: TopicReminder[] = JSON.parse(rawLocal);
      const updated = list.map((r) => (r.id === reminderId ? { ...r, triggered: true } : r));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  }

  if (uid && firestore) {
    try {
      const ref = doc(firestore, "users", uid, "reminders", reminderId);
      await updateDoc(ref, { triggered: true });
    } catch (e) {
      console.warn("Failed to update reminder in Firestore:", e);
    }
  }
}

