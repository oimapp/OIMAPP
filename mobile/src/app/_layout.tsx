import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DeviceScreen, EnvScreen, LanguageScreen, MessageScreen, ProfileScreen, SignInScreen } from "@/components/Gate";
import { Loading } from "@/components/ui";
import { AppProvider, useApp } from "@/lib/app";
import { missingEnv } from "@/lib/env";
import { C } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { stage, t } = useApp();

  useEffect(() => {
    if (stage !== "loading") SplashScreen.hideAsync().catch(() => undefined);
  }, [stage]);

  switch (stage) {
    case "loading": return <Loading />;
    case "env": return <EnvScreen missing={missingEnv} />;
    case "language": return <LanguageScreen />;
    case "signin": return <SignInScreen />;
    case "profile": return <ProfileScreen />;
    case "device": return <DeviceScreen />;
    case "frozen": return <MessageScreen title={t("frozenTitle")} body={t("frozenBody")} />;
    case "offline_block": return <MessageScreen title={t("offline")} body={t("offlineTooLong")} retry />;
    default:
      return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper } }} />;
  }
}
