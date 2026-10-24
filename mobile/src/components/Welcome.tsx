// The page members see each time the app opens, before the books.
// Its message, Bible verse and picture are set in the admin (Settings > Welcome page).

import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/lib/app";
import { longDate, todayISO } from "@/lib/dates";
import { useColors } from "@/lib/prefs";
import { serif } from "@/lib/theme";
import { coverUrl } from "./Cover";
import { Logo } from "./ui";

export function Welcome({ onEnter, onAbout }: { onEnter: () => void; onAbout: () => void }) {
  const { t, lang, profile, settings } = useApp();
  const C = useColors();
  const w = settings.welcome ?? {};
  const message: string = (lang === "yo" ? w.yo : w.en) || w.en || "";
  const verse: string = (lang === "yo" ? w.verse_yo : w.verse_en) || w.verse_en || "";
  const photo = coverUrl(w.photo_path || null);
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.hero }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 18, justifyContent: "center" }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: 150, height: 190, borderRadius: 18, alignSelf: "center", backgroundColor: "#FFFFFF22" }} />
        ) : (
          <Logo size={130} />
        )}
        <View style={{ gap: 6 }}>
          <Text style={{ color: "#F3C6CD", fontWeight: "800", textAlign: "center", letterSpacing: 1, textTransform: "uppercase" }}>
            {t("welcomeTitle")}{firstName ? `, ${firstName}` : ""}
          </Text>
          <Text style={{ fontFamily: serif, color: "#FFFFFF", fontSize: 30, fontWeight: "700", textAlign: "center" }}>Ona Iwa Mimo</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", textAlign: "center", fontSize: 15 }}>{t("churchName")}</Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 13 }}>{longDate(todayISO(), lang)}</Text>
        </View>

        {message ? (
          <Text style={{ color: "#FFFFFF", fontSize: 17, lineHeight: 26, textAlign: "center" }}>{message}</Text>
        ) : null}

        {verse ? (
          <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 18, gap: 8, borderLeftWidth: 4, borderLeftColor: "#E0263F" }}>
            <Text style={{ color: "#F3C6CD", fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>{t("wordForYou")}</Text>
            <Text style={{ fontFamily: serif, fontStyle: "italic", color: "#FFFFFF", fontSize: 18, lineHeight: 27 }}>“{verse}”</Text>
            {w.verse_ref ? <Text style={{ color: "#F3C6CD", fontWeight: "700" }}>{w.verse_ref}</Text> : null}
          </View>
        ) : null}

        <View style={{ gap: 6, marginTop: 6 }}>
          <Pressable
            onPress={onEnter}
            style={({ pressed }) => ({ minHeight: 54, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ color: "#0B145E", fontWeight: "800", fontSize: 17 }}>{t("enter")}</Text>
          </Pressable>
          <Pressable onPress={onAbout} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "700", textDecorationLine: "underline" }}>{t("aboutChurch")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
