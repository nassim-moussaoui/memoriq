import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import i18n from "@/lib/i18n";
import { countDue } from "@/lib/srs/db";
import { useAppStore, type ReviewMoment } from "@/lib/store";

/**
 * Daily local reminder at the user's review moment, plus the app icon badge.
 * The reminder is rescheduled after every completed session so its copy
 * matches what will actually be waiting when it fires.
 */

export const DEFAULT_REMINDER_TIMES: Record<ReviewMoment, string> = {
  morning: "07:30",
  afterPrayer: "14:00",
  evening: "21:00",
};

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? Math.min(Math.max(h, 0), 23) : 21,
    minute: Number.isFinite(m) ? Math.min(Math.max(m, 0), 59) : 0,
  };
}

/** "21:00" + 30 => "21:30", wrapping around midnight. */
export function addMinutesToTime(hhmm: string, delta: number): string {
  const { hour, minute } = parseTime(hhmm);
  const total = (((hour * 60 + minute + delta) % 1440) + 1440) % 1440;
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** Next occurrence of the daily reminder time. */
function nextFireDate(time: string, now = new Date()): Date {
  const { hour, minute } = parseTime(time);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** (Re)schedules the single daily reminder, with copy for the next firing. */
export async function scheduleDailyReminder(time: string): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const dueAtFire = countDue(nextFireDate(time).getTime());
  const body =
    dueAtFire > 0 ? i18n.t("notif.bodyDue", { count: dueAtFire }) : i18n.t("notif.bodyFresh");
  const { hour, minute } = parseTime(time);
  await Notifications.scheduleNotificationAsync({
    content: { title: i18n.t("notif.title"), body, data: { url: "/session" } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: "reminders",
    },
  });
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Re-applies the reminder from the current settings (call after sessions). */
export async function refreshReminder(): Promise<void> {
  const { remindersEnabled, reminderTime, reviewMoment } = useAppStore.getState();
  if (!remindersEnabled) {
    await cancelReminders();
    return;
  }
  await scheduleDailyReminder(reminderTime ?? DEFAULT_REMINDER_TIMES[reviewMoment]);
}

/** Mirrors the number of due reviews on the app icon badge. */
export async function syncAppBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(countDue());
  } catch {
    // Badge permission may be denied; the in-app tab badge still works.
  }
}
