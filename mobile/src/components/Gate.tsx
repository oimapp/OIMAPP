// The screens a member sees before the main app: language, sign in, about you,
// and the one-phone check.

import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { setCached } from "@/lib/cache";
import { useApp, Profile } from "@/lib/app";
import { longDate } from "@/lib/dates";
import { Lang, translate } from "@/lib/i18n";
import { errorCode, rpc, supabase } from "@/lib/supabase";
import { useColors } from "@/lib/prefs";
import { Body, Button, Card, Field, Logo, Notice, Screen, Title } from "./ui";

/** Open a WhatsApp chat with the church help line. */
export function openWhatsApp(number: string | undefined) {
  const digits = String(number ?? "").replace(/[^0-9]/g, "");
  if (digits) void Linking.openURL(`https://wa.me/${digits}`);
}

export function EnvScreen({ missing }: { missing: string[] }) {
  return (
    <Screen>
      <Title>App setup is not finished</Title>
      <Body>These values were missing when this APK was built:</Body>
      {missing.map((m) => <Body key={m}>• {m}</Body>)}
      <Body muted>Add them with "eas env:create" and build the APK again.</Body>
    </Screen>
  );
}

export function LanguageScreen() {
  const { boot } = useApp();
  const C = useColors();
  const [pick, setPick] = useState<Lang>("yo");
  const choose = async () => {
    await setCached("lang", pick);
    await boot();
  };
  const Option = ({ l, label }: { l: Lang; label: string }) => (
    <Pressable
      onPress={() => setPick(l)}
      style={{
        padding: 18, borderRadius: 14, borderWidth: 2, backgroundColor: C.card,
        borderColor: pick === l ? C.brand : C.line,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: pick === l ? C.brand : C.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <Screen>
      <View style={{ height: 30 }} />
      <Logo size={120} />
      <Title center>Ona Iwa Mimo</Title>
      <Body center muted>{translate(pick, "churchName")}</Body>
      <View style={{ height: 10 }} />
      <Body center>{translate(pick, "chooseLanguage")}</Body>
      <Option l="yo" label="Yorùbá" />
      <Option l="en" label="English" />
      <Body center muted>{translate(pick, "chooseLanguageHint")}</Body>
      <Button title={translate(pick, "continue")} onPress={choose} />
    </Screen>
  );
}

export function SignInScreen() {
  const { t, boot, settings } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "error" | "ok" } | null>(null);

  const go = async () => {
    setMsg(null);
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setMsg({ text: t("badEmail"), tone: "error" });
    if (password.length < 8) return setMsg({ text: t("weakPassword"), tone: "error" });
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) {
          if (errorCode(error) === "offline") return setMsg({ text: t("offline"), tone: "error" });
          return setMsg({ text: t("wrongLogin"), tone: "error" });
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password });
        if (error) {
          if (errorCode(error) === "offline") return setMsg({ text: t("offline"), tone: "error" });
          if (/registered|exists/i.test(error.message)) return setMsg({ text: t("emailTaken"), tone: "error" });
          if (/password/i.test(error.message)) return setMsg({ text: t("weakPassword"), tone: "error" });
          return setMsg({ text: error.message, tone: "error" });
        }
        if (!data.session) {
          setMode("in");
          return setMsg({ text: t("checkEmail"), tone: "ok" });
        }
      }
      await boot();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ height: 20 }} />
      <Logo size={96} />
      <Title center>{t("signInTitle")}</Title>
      <Body center muted>{mode === "in" ? t("signInHint") : t("signUpHint")}</Body>
      {msg && <Notice text={msg.text} tone={msg.tone} />}
      <Field label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label={t("password")} value={password} onChangeText={setPassword} secureTextEntry hint={mode === "up" ? t("passwordHint") : undefined} />
      <Button title={mode === "in" ? t("signIn") : t("signUp")} onPress={go} busy={busy} />
      <Button kind="link" title={mode === "in" ? t("noAccount") : t("haveAccount")} onPress={() => { setMsg(null); setMode(mode === "in" ? "up" : "in"); }} />
      {mode === "in" && (
        <Pressable onPress={() => openWhatsApp(settings.support_whatsapp)}>
          <Body muted center>{t("forgotPassword")}</Body>
        </Pressable>
      )}
    </Screen>
  );
}

export function ProfileScreen() {
  const { t, lang, profile, afterProfileSaved, signOut } = useApp();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [parish, setParish] = useState(profile?.parish ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const p = await rpc<Profile>("app_save_profile", {
        p_full_name: name, p_phone: phone, p_parish: parish, p_language: lang,
      });
      await afterProfileSaved(p);
    } catch (e) {
      const code = errorCode(e);
      const map: Record<string, Parameters<typeof t>[0]> = {
        name_needed: "nameNeeded", phone_invalid: "phoneInvalid", phone_taken: "phoneTaken",
        phone_locked: "phoneLocked", offline: "offline",
      };
      setErr(map[code] ? t(map[code]) : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t("aboutYou")}</Title>
      <Body muted>{t("aboutYouHint")}</Body>
      {err ? <Notice text={err} tone="error" /> : null}
      <Field label={t("fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint={t("phoneHint")} editable={!profile?.phone} />
      <Field label={`${t("parish")} (${t("optional")})`} value={parish} onChangeText={setParish} />
      <Button title={t("continue")} onPress={save} busy={busy} />
      <Button kind="link" title={t("signOut")} onPress={signOut} />
    </Screen>
  );
}

export function DeviceScreen() {
  const { t, lang, deviceInfo, moveHere, settings, signOut } = useApp();
  const [busy, setBusy] = useState(false);
  if (!deviceInfo) return null;
  const move = async () => {
    setBusy(true);
    try {
      await moveHere();
    } finally {
      setBusy(false);
    }
  };
  const waitDate = longDate(deviceInfo.wait_until.slice(0, 10), lang, false);
  return (
    <Screen>
      <View style={{ height: 20 }} />
      <Logo size={80} />
      <Title center>{t("otherPhoneTitle")}</Title>
      <Card>
        <Body>{t("otherPhoneBody", { model: deviceInfo.other_model || "?" })}</Body>
      </Card>
      {deviceInfo.can_move ? (
        <>
          <Notice text={t("moveWarn", { n: deviceInfo.moves_left - 1 })} />
          <Button title={t("moveHere")} onPress={move} busy={busy} />
        </>
      ) : (
        <Notice tone="error" text={deviceInfo.moves_left > 0 ? t("moveWait", { date: waitDate }) : t("noMovesLeft")} />
      )}
      <Button kind="outline" title={t("askHelp")} onPress={() => openWhatsApp(settings.support_whatsapp)} />
      <Button kind="link" title={t("signOut")} onPress={signOut} />
    </Screen>
  );
}

export function MessageScreen({ title, body, retry }: { title: string; body: string; retry?: boolean }) {
  const { t, boot, settings, signOut } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <View style={{ height: 30 }} />
      <Logo size={80} />
      <Title center>{title}</Title>
      <Body center>{body}</Body>
      {retry && (
        <Button
          title={t("tryAgain")}
          busy={busy}
          onPress={async () => { setBusy(true); await boot(); setBusy(false); }}
        />
      )}
      <Button kind="outline" title={t("askHelp")} onPress={() => openWhatsApp(settings.support_whatsapp)} />
      <Button kind="link" title={t("signOut")} onPress={signOut} />
    </Screen>
  );
}
