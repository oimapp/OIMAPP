import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Notifications from "expo-notifications";
import { router, Tabs } from "expo-router";
import React, { useEffect } from "react";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { syncMarks } from "@/lib/notes";
import { usePrefs } from "@/lib/prefs";
import { scheduleReminders } from "@/lib/reminder";
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

  // Keep two weeks of daily reminders ready, with each day's topic.
  useEffect(() => {
    if (!userId) return;
    const daily = catalogue.books.find((b) => b.kind === "daily" && b.owned);
    void (async () => {
      const index = daily ? await getIndex(daily.id, userId) : null;
      await scheduleReminders({
        on: prefs.reminderOn, time: prefs.reminderTime, lang,
        daily: daily ? { bookId: daily.id, title: bookTitle(daily, lang), index } : undefined,
      });
    })().catch(() => undefined);
  }, [userId, catalogue, prefs.reminderOn, prefs.reminderTime, lang]);

  // Tapping a reminder opens that day's reading.
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === "string") {
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
      <Tabs.Screen name="mine" options={{ title: t("tabMine"), tabBarIcon: icon("bookmark-multiple") }} />
      <Tabs.Screen name="church" options={{ title: t("tabChurch"), tabBarIcon: icon("church") }} />
      <Tabs.Screen name="more" options={{ title: t("tabMore"), tabBarIcon: icon("dots-horizontal-circle-outline") }} />
    </Tabs>
  );
}
