import * as Application from "expo-application";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Card, H2, Notice, Pill } from "@/components/ui";
import { BookRow, useApp } from "@/lib/app";
import { bookTitle, pickCurrent, useBookIndex } from "@/lib/books";
import { getCached, setCached } from "@/lib/cache";
import { longDate, todayISO } from "@/lib/dates";
import { StringKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { C, serif } from "@/lib/theme";

type Announcement = { id: string; audience: string; body_en: string; body_yo: string; sent_at: string };

/** "1.2.0" is older than "1.10.0" */
function older(a: string, b: string) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
}

export default function Home() {
  const { t, lang, profile, settings, catalogue, online, refreshCatalogue } = useApp();
  const [messages, setMessages] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const owned = catalogue.books.filter((b) => b.owned);
  const loadMessages = useCallback(async () => {
    const cached = await getCached<Announcement[]>("messages");
    if (cached) setMessages(cached);
    const { data } = await supabase.from("announcements").select("*").order("sent_at", { ascending: false }).limit(20);
    if (data) {
      setMessages(data as Announcement[]);
      await setCached("messages", data);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshCatalogue(), loadMessages()]);
    setRefreshing(false);
  };

  const kinds = new Set(owned.map((b) => b.kind));
  const mine = messages.filter((m) =>
    m.audience === "all" ||
    (m.audience === "manual" && kinds.has("manual")) ||
    (m.audience === "daily" && kinds.has("daily")) ||
    (m.audience === "teachers" && profile?.is_teacher) ||
    (m.audience === "no_book" && owned.length === 0),
  );

  const notice = settings.home_notice?.[lang] || settings.home_notice?.en;
  const maint = settings.maintenance?.on ? settings.maintenance?.[lang] || settings.maintenance?.en : "";
  const version = Application.nativeApplicationVersion ?? "1.0.0";
  const needsUpdate = settings.min_app_version && older(version, String(settings.min_app_version));
  const firstName = (profile?.full_name ?? "").split(" ")[0];

  const card = (kind: BookRow["kind"], label: StringKey) => {
    const b = catalogue.books.find((x) => x.kind === kind);
    return b ? <TodayCard key={kind} book={b} label={t(label)} /> : null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.brand]} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image source={require("@/assets/images/logo.png")} style={{ width: 48, height: 48 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: serif, fontSize: 22, fontWeight: "700", color: C.deep }}>
              {t("greeting", { name: firstName })}
            </Text>
            <Text style={{ color: C.muted }}>{longDate(todayISO(), lang)}</Text>
          </View>
        </View>

        {!online && <Notice text={t("offlineNote")} />}
        {needsUpdate ? <Notice tone="error" text={t("updateApp")} /> : null}
        {maint ? <Notice tone="error" text={maint} /> : null}
        {notice ? <Notice text={notice} /> : null}

        {card("daily", "todayReading")}
        {card("manual", "thisSunday")}
        {card("children", "childrenSunday")}

        {catalogue.books.length === 0 && (
          <Card><Body muted>{t("noBooks")}</Body></Card>
        )}

        <H2>{t("messages")}</H2>
        {mine.length === 0 ? (
          <Body muted>{t("noMessages")}</Body>
        ) : (
          mine.map((m) => (
            <Card key={m.id}>
              <Text style={{ color: C.muted, fontSize: 13 }}>{longDate(m.sent_at.slice(0, 10), lang, false)}</Text>
              <Body>{(lang === "yo" && m.body_yo) || m.body_en}</Body>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TodayCard({ book, label }: { book: BookRow; label: string }) {
  const { t, lang } = useApp();
  const { index, reload } = useBookIndex(book.owned ? book.id : undefined);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const entry = pickCurrent(index, book.kind);

  if (!book.owned) {
    return (
      <Card onPress={() => router.push(`/book/${book.id}`)}>
        <Text style={{ color: C.red, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>{label}</Text>
        <H2>{bookTitle(book, lang)}</H2>
        <Body muted>{t("notOwnedYet")}</Body>
      </Card>
    );
  }
  if (!entry) {
    return (
      <Card onPress={() => router.push(`/book/${book.id}`)}>
        <Text style={{ color: C.red, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>{label}</Text>
        <H2>{bookTitle(book, lang)}</H2>
        <Pill text={t("download")} />
        <Body muted>{t("notDownloaded")}</Body>
      </Card>
    );
  }
  return (
    <Card
      style={{ backgroundColor: C.deep, borderColor: C.deep }}
      onPress={() => router.push(`/read/${book.id}/${entry.key}`)}
    >
      <Text style={{ color: "#F3C6CD", fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: C.white, opacity: 0.8 }}>{longDate(entry.date, lang)}</Text>
      <Text style={{ fontFamily: serif, color: C.white, fontSize: 21, fontWeight: "700" }}>
        {(lang === "yo" ? entry.topic.yo : entry.topic.en) || entry.topic.en}
      </Text>
      {entry.n ? <Text style={{ color: C.white, opacity: 0.8 }}>{t("lesson", { n: entry.n })}</Text> : null}
    </Card>
  );
}
