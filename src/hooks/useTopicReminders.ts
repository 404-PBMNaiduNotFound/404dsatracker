"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  TopicReminder,
  fetchTopicReminders,
  addTopicReminder,
  deleteTopicReminder,
  markTopicReminderTriggered,
} from "@/lib/reminders";

export function useTopicReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<TopicReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTopicReminders(user?.uid);
      setReminders(data);
    } catch (err) {
      console.error("Failed to load reminders:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addReminder = async (item: Omit<TopicReminder, "id" | "createdAt" | "triggered">) => {
    const created = await addTopicReminder(user?.uid, item);
    setReminders((prev) => [...prev, created]);
    return created;
  };

  const removeReminder = async (id: string) => {
    await deleteTopicReminder(user?.uid, id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const markTriggered = async (id: string) => {
    await markTopicReminderTriggered(user?.uid, id);
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, triggered: true } : r)));
  };

  return {
    reminders,
    loading,
    addReminder,
    removeReminder,
    markTriggered,
    reload,
  };
}
