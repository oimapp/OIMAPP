import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AboutContent } from "@/components/About";
import { DeviceScreen, EnvScreen, LanguageScreen, MessageScreen, ProfileScreen, SignInScreen } from "@/components/Gate";
import { Loading, SubScreen } from "@/components/ui";
import { Welcome } from "@/components/Welcome";
import { AppProvider, useApp } from "@/lib/app";
import { missingEnv } from "@/lib/env";
import { PrefsProvider, usePrefs } from "@/lib/prefs";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AppProvider>
          <Gate />
        </AppProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { stage, t, settings } = useApp();
  const { prefs, ready, C } = usePrefs();
  // The welcome page shows once each time the app is opened.
  const [entered, setEntered] = useState(false);
  const [about, setAbout] = useState(false);

  useEffect(() => {
    if (stage !== "loading" && ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [stage, ready]);

  const bar = <StatusBar style={C.dark ? "light" : "dark"} />;
  if (!ready) return <Loading />;

  switch (stage) {
    case "loading": return <Loading />;
    case "env": return <EnvScreen missing={missingEnv} />;
    case "language": return <>{bar}<LanguageScreen /></>;
    case "signin": return <>{bar}<SignInScreen /></>;
    case "profile": return <>{bar}<ProfileScreen /></>;
    case "device": return <>{bar}<DeviceScreen /></>;
    case "frozen": return <>{bar}<MessageScreen title={t("frozenTitle")} body={t("frozenBody")} /></>;
    case "offline_block": return <>{bar}<MessageScreen title={t("offline")} body={t("offlineTooLong")} retry /></>;
    case "test_ended": return <>{bar}<MessageScreen title={t("testEndedTitle")} body={t("testEndedBody")} link={{ title: t("openPlay"), url: String(settings.play_url || "https://play.google.com/store/apps/details?id=com.onaiwamimo.app") }} /></>;
  }

  if (about && !entered) {
    return <>{bar}<AboutBack onBack={() => setAbout(false)} /></>;
  }
  if (prefs.welcomeOnOpen && !entered) {
    return <><StatusBar style="light" /><Welcome onEnter={() => setEntered(true)} onAbout={() => setAbout(true)} /></>;
  }
  return (
    <>
      {bar}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper } }} />
    </>
  );
}

function AboutBack({ onBack }: { onBack: () => void }) {
  const { t } = useApp();
  return (
    <SubScreen title={t("about")} onBack={onBack}>
      <AboutContent />
    </SubScreen>
  );
}
