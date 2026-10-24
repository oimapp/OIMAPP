// The daily reminder. It is set up on the phone itself, so it works without internet.
// When the Daily Divine Bread is downloaded, each reminder shows that day's topic
// and opens that day's reading when tapped.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { todayISO } from "./dates";
import { Lang, translate } from "./i18n";
import type { IndexEntry } from "./vault";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

const CHANNEL = "daily-reading";
const DAYS_AHEAD = 14;

/** Ask for permission. Returns false if the member said no. */
export async function allowNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Daily reading",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Replace all reminders. Call it when the setting changes and each time the app opens,
 * so there are always two weeks of reminders ahead.
 */
export async function scheduleReminders(opts: {
  on: boolean; time: string; lang: Lang; daily?: { bookId: string; title: string; index: IndexEntry[] | null };
}) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!opts.on) return;
  const [h, m] = opts.time.split(":").map(Number);

  // Without the book on the phone, one plain reminder that repeats every day.
  if (!opts.daily?.index?.length) {
    await Notifications.scheduleNotificationAsync({
      content: { title: translate(opts.lang, "reminderTitle"), body: translate(opts.lang, "reminderBody") },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m, channelId: CHANNEL },
    });
    return;
  }

  const byDate = new Map(opts.daily.index.map((e) => [e.date, e]));
  const start = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, h, m);
    if (at.getTime() <= Date.now()) continue;
    const entry = byDate.get(todayISO(at));
    const topic = entry ? (opts.lang === "yo" ? entry.topic.yo : entry.topic.en) || entry.topic.en : "";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${translate(opts.lang, "reminderTitle")} · ${opts.daily.title}`,
        body: topic || translate(opts.lang, "reminderBody"),
        data: entry ? { url: `/read/${opts.daily.bookId}/${entry.key}` } : {},
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}
