/** Upgrade 2/3/5: per-user settings persisted in Firestore. */
import { getDoc, setDoc } from "firebase/firestore";
import { settingsDoc } from "./db";
import { DEFAULT_DAILY_COUNTS, type DailyCounts } from "./plan";

export type ThemeMode = "light" | "dark" | "system";

export interface UserSettings {
  theme: ThemeMode;
  counts: DailyCounts;
  pushEnabled: boolean;
  emailEnabled: boolean;
  reminderTime: string; // HH:MM (Evening)
  morningReminderEnabled: boolean;
  morningReminderTime: string; // HH:MM
  contestReminderEnabled: boolean;
  timezone: string;
  paused: boolean;
  pausedFrom: string | null;
  pausedDays: number;
  resumeDate: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "light",
  counts: DEFAULT_DAILY_COUNTS,
  pushEnabled: false,
  emailEnabled: false,
  reminderTime: "19:00",
  morningReminderEnabled: false,
  morningReminderTime: "08:00",
  contestReminderEnabled: false,
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  paused: false,
  pausedFrom: null,
  pausedDays: 0,
  resumeDate: null,
};

type Fields = {
  theme?: string;
  easyPerDay?: number;
  mediumPerDay?: number;
  hardPerDay?: number;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  reminderTime?: string;
  morningReminderEnabled?: boolean;
  morningReminderTime?: string;
  contestReminderEnabled?: boolean;
  timezone?: string;
  paused?: boolean;
  pausedFrom?: string | null;
  pausedDays?: number;
  resumeDate?: string | null;
};

const fieldsToSettings = (f: Fields): UserSettings => ({
  theme: (f.theme as ThemeMode) ?? "light",
  counts: {
    easy: f.easyPerDay ?? DEFAULT_DAILY_COUNTS.easy,
    medium: f.mediumPerDay ?? DEFAULT_DAILY_COUNTS.medium,
    hard: f.hardPerDay ?? DEFAULT_DAILY_COUNTS.hard,
  },
  pushEnabled: Boolean(f.pushEnabled),
  emailEnabled: Boolean(f.emailEnabled),
  reminderTime: (f.reminderTime ?? "19:00").slice(0, 5),
  morningReminderEnabled: Boolean(f.morningReminderEnabled),
  morningReminderTime: (f.morningReminderTime ?? "08:00").slice(0, 5),
  contestReminderEnabled: Boolean(f.contestReminderEnabled),
  timezone: f.timezone || DEFAULT_SETTINGS.timezone,
  paused: Boolean(f.paused),
  pausedFrom: f.pausedFrom ?? null,
  pausedDays: f.pausedDays ?? 0,
  resumeDate: f.resumeDate ?? null,
});

const settingsToFields = (s: Partial<UserSettings>): Fields => {
  const fields: Fields = {};
  if (s.theme !== undefined) fields.theme = s.theme;
  if (s.counts !== undefined) {
    fields.easyPerDay = s.counts.easy;
    fields.mediumPerDay = s.counts.medium;
    fields.hardPerDay = s.counts.hard;
  }
  if (s.pushEnabled !== undefined) fields.pushEnabled = s.pushEnabled;
  if (s.emailEnabled !== undefined) fields.emailEnabled = s.emailEnabled;
  if (s.reminderTime !== undefined) fields.reminderTime = s.reminderTime;
  if (s.morningReminderEnabled !== undefined) fields.morningReminderEnabled = s.morningReminderEnabled;
  if (s.morningReminderTime !== undefined) fields.morningReminderTime = s.morningReminderTime;
  if (s.contestReminderEnabled !== undefined) fields.contestReminderEnabled = s.contestReminderEnabled;
  if (s.timezone !== undefined) fields.timezone = s.timezone;
  if (s.paused !== undefined) fields.paused = s.paused;
  if (s.pausedFrom !== undefined) fields.pausedFrom = s.pausedFrom;
  if (s.pausedDays !== undefined) fields.pausedDays = s.pausedDays;
  if (s.resumeDate !== undefined) fields.resumeDate = s.resumeDate;
  return fields;
};

export async function loadSettings(userId: string): Promise<UserSettings> {
  const ref = settingsDoc(userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const seeded = { ...DEFAULT_SETTINGS };
    await setDoc(ref, { ...settingsToFields(seeded), updatedAt: new Date().toISOString() });
    return seeded;
  }
  return fieldsToSettings(snap.data() as Fields);
}

export async function saveSettings(userId: string, patch: Partial<UserSettings>) {
  const ref = settingsDoc(userId);
  await setDoc(
    ref,
    { ...settingsToFields(patch), updatedAt: new Date().toISOString() },
    { merge: true },
  );
}