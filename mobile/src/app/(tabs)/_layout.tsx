import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import React from "react";
import { useApp } from "@/lib/app";
import { C } from "@/lib/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const icon = (name: IconName) => ({ color, size }: { color: unknown; size: number }) => (
  <MaterialCommunityIcons name={name} color={color as string} size={size} />
);

export default function TabsLayout() {
  const { t } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabHome"), tabBarIcon: icon("home-variant") }} />
      <Tabs.Screen name="books" options={{ title: t("tabBooks"), tabBarIcon: icon("book-open-page-variant") }} />
      <Tabs.Screen name="church" options={{ title: t("tabChurch"), tabBarIcon: icon("church") }} />
      <Tabs.Screen name="me" options={{ title: t("tabMe"), tabBarIcon: icon("account-circle") }} />
    </Tabs>
  );
}
