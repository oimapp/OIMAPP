// About the church: text set in the admin (Settings > About the church).

import * as Application from "expo-application";
import React from "react";
import { Text, View } from "react-native";
import { useApp } from "@/lib/app";
import { useColors } from "@/lib/prefs";
import { serif } from "@/lib/theme";
import { openWhatsApp } from "./Gate";
import { Body, Button, Logo } from "./ui";

export function AboutContent() {
  const { t, lang, settings } = useApp();
  const C = useColors();
  const text: string = (lang === "yo" ? settings.about?.yo : settings.about?.en) || settings.about?.en || "";
  return (
    <View style={{ gap: 14 }}>
      <Logo size={120} />
      <Text style={{ fontFamily: serif, fontSize: 26, fontWeight: "700", color: C.deep, textAlign: "center" }}>Ona Iwa Mimo</Text>
      <Body muted center>{t("churchName")}</Body>
      {text.split(/\n\s*\n/).filter(Boolean).map((para, i) => (
        <Text key={i} style={{ fontFamily: serif, fontSize: 17, lineHeight: 27, color: C.ink }}>{para.trim()}</Text>
      ))}
      <Button kind="outline" icon="whatsapp" title={t("help")} onPress={() => openWhatsApp(settings.support_whatsapp)} />
      <Body muted center>{t("version", { v: Application.nativeApplicationVersion ?? "1.0.0" })}</Body>
    </View>
  );
}
