import * as Application from "expo-application";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { openWhatsApp } from "@/components/Gate";
import { Body, Button, Card, Group, H2, Notice, Row, Screen, Segments, Title, Toggle } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getCached, setCached } from "@/lib/cache";
import { longDate } from "@/lib/dates";
import { Lang } from "@/lib/i18n";
import { Appearance, TEXT_SIZES, usePrefs } from "@/lib/prefs";
import { allowNotifications } from "@/lib/reminder";
import { rpc } from "@/lib/supabase";
import { serif } from "@/lib/theme";

const TIMES = ["05:00", "05:30", "06:00", "06:30", "07:00", "08:00", "12:00", "18:00", "20:00", "21:00"];
type PhoneInfo = { model: string | null; linked_at: string | null; moves_used: number; moves_limit: number };

export default function More() {
  const { t, lang, setLang, profile, email, settings, online, signOut } = useApp();
  const { prefs, setPref, C } = usePrefs();
  const [phone, setPhone] = useState<PhoneInfo | null>(null);
  const [notifErr, setNotifErr] = useState(false);

  useFocusEffect(useCallback(() => {
    void getCached<PhoneInfo>("phone_info").then((p) => p && setPhone(p));
    if (online) {
      void rpc<PhoneInfo>("app_phone_info").then((p) => { setPhone(p); void setCached("phone_info", p); }).catch(() => undefined);
    }
  }, [online]));

  const confirmSignOut = () =>
    Alert.alert(t("signOut"), t("signOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("signOut"), style: "destructive", onPress: () => void signOut() },
    ]);

  const toggleReminder = async (on: boolean) => {
    setNotifErr(false);
    if (on && !(await allowNotifications())) {
      setNotifErr(true);
      return;
    }
    setPref("reminderOn", on);
  };

  const Info = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <View style={{ paddingVertical: 6 }}>
        <Text style={{ color: C.muted, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: C.ink, fontSize: 16 }}>{value}</Text>
      </View>
    ) : null;

  return (
    <Screen>
      <Title>{t("tabMore")}</Title>

      <Card>
        <H2>{t("account")}</H2>
        <Info label={t("fullName")} value={profile?.full_name} />
        <Info label={t("phone")} value={profile?.phone} />
        <Info label={t("email")} value={email} />
        <Info label={t("parish")} value={profile?.parish} />
      </Card>

      <H2>{t("settings")}</H2>
      <Card>
        <Text style={{ color: C.ink, fontWeight: "700" }}>{t("appLanguage")}</Text>
        <Segments<Lang> value={lang} onChange={(l) => void setLang(l)} options={[["yo", t("yoruba")], ["en", t("english")]]} />
        <Text style={{ color: C.ink, fontWeight: "700", marginTop: 8 }}>{t("appearance")}</Text>
        <Segments<Appearance>
          value={prefs.appearance}
          onChange={(v) => setPref("appearance", v)}
          options={[["system", t("appearanceSystem")], ["light", t("light")], ["dark", t("dark")]]}
        />
        <Text style={{ color: C.ink, fontWeight: "700", marginTop: 8 }}>{t("textSize")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <SizeButton label="A−" onPress={() => setPref("textSize", Math.max(0, prefs.textSize - 1))} />
          <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
            {TEXT_SIZES.map((_, i) => (
              <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i <= prefs.textSize ? C.brand : C.line }} />
            ))}
          </View>
          <SizeButton label="A+" onPress={() => setPref("textSize", Math.min(TEXT_SIZES.length - 1, prefs.textSize + 1))} />
        </View>
        <View style={{ backgroundColor: C.paper, borderRadius: 12, padding: 14 }}>
          <Text style={{ fontFamily: serif, color: C.ink, fontSize: 17 * TEXT_SIZES[prefs.textSize], lineHeight: 26 * TEXT_SIZES[prefs.textSize] }}>
            {t("sampleText")}
          </Text>
        </View>
      </Card>

      <Group>
        <Row icon="hand-wave-outline" title={t("welcomeOnOpen")} right={<Toggle value={prefs.welcomeOnOpen} onChange={(v) => setPref("welcomeOnOpen", v)} />} />
        <Row icon="bell-ring-outline" title={t("reminder")} hint={t("reminderHint")} right={<Toggle value={prefs.reminderOn} onChange={(v) => void toggleReminder(v)} />} />
      </Group>
      {notifErr && <Notice tone="error" text={t("notifOff")} />}
      {prefs.reminderOn && (
        <Card>
          <Text style={{ color: C.ink, fontWeight: "700" }}>{t("remindAt")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TIMES.map((tm) => (
              <Pressable
                key={tm}
                onPress={() => setPref("reminderTime", tm)}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: prefs.reminderTime === tm ? C.brand : C.line, backgroundColor: prefs.reminderTime === tm ? C.soft : C.card }}
              >
                <Text style={{ color: prefs.reminderTime === tm ? C.brand : C.ink, fontWeight: "700" }}>{tm}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {phone?.model ? (
        <Group>
          <Row icon="cellphone" title={phone.model} hint={phone.linked_at ? t("linkedSince", { date: longDate(phone.linked_at.slice(0, 10), lang, false) }) : undefined} />
          <Row icon="swap-horizontal" title={t("movesLeft", { n: Math.max(0, phone.moves_limit - phone.moves_used), m: phone.moves_limit })} />
        </Group>
      ) : null}

      <Group>
        <Row icon="whatsapp" title={t("help")} hint={t("helpHint")} onPress={() => openWhatsApp(settings.support_whatsapp)} iconBg={C.greenSoft} iconColor={C.green} />
        <Row icon="information-outline" title={t("aboutChurch")} onPress={() => router.push("/about")} />
      </Group>

      <Button kind="outline" title={t("signOut")} onPress={confirmSignOut} />
      <Body muted center>{t("version", { v: Application.nativeApplicationVersion ?? "1.0.0" })}</Body>
    </Screen>
  );

  function SizeButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} style={{ width: 52, height: 44, borderRadius: 10, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.brand, fontWeight: "800", fontSize: 16 }}>{label}</Text>
      </Pressable>
    );
  }
}
