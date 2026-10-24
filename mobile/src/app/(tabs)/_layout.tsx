import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Notifications from "expo-notifications";
import { router, Tabs } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { getCached, setCached } from "@/lib/cache";
import { syncMarks } from "@/lib/notes";
import { usePrefs } from "@/lib/prefs";
import { allowNotifications, registerPush, scheduleDaily } from "@/lib/reminder";
import { onReadDay, readDays } from "@/lib/streak";
import { todayISO } from "@/lib/dates";
import { getIndex } from "@/lib/vault";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const icon = (name: IconName) => ({ color, size }: { color: unknown; size: number }) => (
  <MaterialCommunityIcons name={name} color={color as string} size={size} />
);

export default function TabsLayout() {
  const { t, lang, userId, catalogue, online } = useApp();
  const { prefs, C } = usePrefs();

  // Notes and bookmarks: send and fetch when the app opens with internet.
  useEffect(() => {
    if (userId && online) void syncMarks(userId).catch(() => undefined);
  }, [userId, online]);

  // The first time, ask to allow notifications (daily reminder and church messages).
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const asked = await getCached<boolean>("notif_asked");
      if (!asked && prefs.reminderOn) {
        await setCached("notif_asked", true);
        await allowNotifications();
      }
      if (online) await registerPush(userId);
    })().catch(() => undefined);
  }, [userId, online, prefs.reminderOn]);

  // Keep two weeks of daily reminders ready. Skip today if the member has already read today.
  const reschedule = useCallback(async () => {
    if (!userId) return;
    const daily = catalogue.books.find((b) => b.kind === "daily" && b.owned);
    const index = daily ? await getIndex(daily.id, userId) : null;
    const readToday = (await readDays()).has(todayISO());
    await scheduleDaily({
      on: prefs.reminderOn, time: prefs.reminderTime, lang, readToday,
      daily: daily ? { bookId: daily.id, title: bookTitle(daily, lang), index } : undefined,
    });
  }, [userId, catalogue, prefs.reminderOn, prefs.reminderTime, lang]);

  useEffect(() => {
    void reschedule().catch(() => undefined);
    return onReadDay(() => { void reschedule().catch(() => undefined); });
  }, [reschedule]);

  // Tapping a notification opens the right page.
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === "string" && url !== "/") {
        Notifications.clearLastNotificationResponse();
        router.push(url as never);
      }
    };
    try {
      open(Notifications.getLastNotificationResponse());
      const sub = Notifications.addNotificationResponseReceivedListener(open);
      return () => sub.remove();
    } catch {
      return undefined;
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabHome"), tabBarIcon: icon("home-variant") }} />
      <Tabs.Screen name="books" options={{ title: t("tabBooks"), tabBarIcon: icon("book-open-page-variant") }} />
      <Tabs.Screen name="bible" options={{ title: t("tabBible"), tabBarIcon: icon("book-cross") }} />
      <Tabs.Screen name="church" options={{ title: t("tabChurch"), tabBarIcon: icon("church") }} />
      <Tabs.Screen name="more" options={{ title: t("tabMore"), tabBarIcon: icon("dots-horizontal-circle-outline") }} />
    </Tabs>
  );
}
