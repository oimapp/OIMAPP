import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Application from "expo-application";
import React from "react";
import { Alert, Text, View } from "react-native";
import { openWhatsApp } from "@/components/Gate";
import { Body, Button, Card, H2, Screen, Segments, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { Lang } from "@/lib/i18n";
import { C } from "@/lib/theme";

export default function Me() {
  const { t, lang, setLang, profile, email, settings, model, signOut } = useApp();

  const confirmSignOut = () =>
    Alert.alert(t("signOut"), t("signOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("signOut"), style: "destructive", onPress: () => void signOut() },
    ]);

  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <View style={{ paddingVertical: 6 }}>
        <Text style={{ color: C.muted, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: C.ink, fontSize: 16 }}>{value}</Text>
      </View>
    ) : null;

  return (
    <Screen>
      <Title>{t("tabMe")}</Title>
      <Card>
        <H2>{t("account")}</H2>
        <Row label={t("fullName")} value={profile?.full_name} />
        <Row label={t("phone")} value={profile?.phone} />
        <Row label={t("email")} value={email} />
        <Row label={t("parish")} value={profile?.parish} />
        <Row label={t("thisPhone")} value={model} />
      </Card>

      <Card>
        <H2>{t("appLanguage")}</H2>
        <Segments<Lang> value={lang} onChange={(l) => void setLang(l)} options={[["yo", t("yoruba")], ["en", t("english")]]} />
      </Card>

      <Card onPress={() => openWhatsApp(settings.support_whatsapp)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <MaterialCommunityIcons name="whatsapp" size={30} color={C.green} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink }}>{t("help")}</Text>
          <Body muted>{t("helpHint")}</Body>
        </View>
      </Card>

      <Button kind="outline" title={t("signOut")} onPress={confirmSignOut} />
      <Body muted center>{t("version", { v: Application.nativeApplicationVersion ?? "1.0.0" })}</Body>
    </Screen>
  );
}
