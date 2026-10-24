// Notifications set up on the phone itself (they work without internet):
// - the daily reading reminder, ON for everyone by default (the conference asked for this).
//   If the member has already opened today's reading, today's reminder is skipped.
// - reminders for church calendar events the member chose.
// Plus the push token so messages from the church office arrive as notifications.

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getCached, setCached } from "./cache";
import { todayISO } from "./dates";
import { Lang, translate } from "./i18n";
import { supabase } from "./supabase";
import type { IndexEntry } from "./vault";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const DAILY = "daily-reading";
const EVENTS = "church-events";
const DAYS_AHEAD = 14;

async function channels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DAILY, { name: "Daily reading", importance: Notifications.AndroidImportance.HIGH });
  await Notifications.setNotificationChannelAsync(EVENTS, { name: "Church events", importance: Notifications.AndroidImportance.DEFAULT });
  await Notifications.setNotificationChannelAsync("default", { name: "Messages from the church", importance: Notifications.AndroidImportance.HIGH });
}

/** Ask for permission. Returns false if the member said no. */
export async function allowNotifications() {
  await channels();
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function cancelWhere(prefix: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/**
 * Replace the daily reminders with the next two weeks. Called when the app opens,
 * when settings change, and after the member reads today's portion.
 */
export async function scheduleDaily(opts: {
  on: boolean; time: string; lang: Lang; readToday: boolean;
  daily?: { bookId: string; title: string; index: IndexEntry[] | null };
}) {
  await cancelWhere("daily-");
  if (!opts.on) return;
  await channels();
  const [h, m] = opts.time.split(":").map(Number);
  const byDate = new Map((opts.daily?.index ?? []).map((e) => [e.date, e]));
  const start = new Date();

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, h, m);
    if (at.getTime() <= Date.now()) continue;
    if (i === 0 && opts.readToday) continue;
    const iso = todayISO(at);
    const entry = byDate.get(iso);
    const topic = entry ? (opts.lang === "yo" ? entry.topic.yo : entry.topic.en) || entry.topic.en : "";
    await Notifications.scheduleNotificationAsync({
      identifier: `daily-${iso}`,
      content: {
        title: entry && opts.daily ? `${translate(opts.lang, "reminderTitle")} · ${opts.daily.title}` : translate(opts.lang, "dailyNudgeTitle"),
        body: topic || translate(opts.lang, "dailyNudgeBody"),
        data: entry && opts.daily ? { url: `/read/${opts.daily.bookId}/${entry.key}` } : { url: "/" },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: DAILY },
    });
  }
}

/** Church events the member asked to be reminded about: the evening before and that morning. */
export async function getEventReminders() {
  return new Set((await getCached<string[]>("event_reminders")) ?? []);
}

export async function setEventReminder(ev: { id: string; date: string; title: string }, on: boolean, lang: Lang) {
  const set = await getEventReminders();
  await cancelWhere(`event-${ev.id}`);
  if (on) {
    if (!(await allowNotifications())) return false;
    const [y, mo, d] = ev.date.split("-").map(Number);
    const times = [
      { at: new Date(y, mo - 1, d - 1, 18, 0), body: translate(lang, "eventSoon", { title: ev.title }), n: 1 },
      { at: new Date(y, mo - 1, d, 7, 0), body: translate(lang, "eventToday", { title: ev.title }), n: 2 },
    ];
    for (const x of times) {
      if (x.at.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `event-${ev.id}-${x.n}`,
        content: { title: "Ona Iwa Mimo", body: x.body, data: { url: "/church?tab=calendar" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: x.at, channelId: EVENTS },
      });
    }
    set.add(ev.id);
  } else {
    set.delete(ev.id);
  }
  await setCached("event_reminders", [...set]);
  return true;
}

/** Save this phone's push address so messages from the church office reach it. */
export async function registerPush(userId: string) {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from("push_tokens").upsert(
      { token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  } catch {
    // Push needs Firebase set up in the build. Until then, local reminders still work.
  }
}
