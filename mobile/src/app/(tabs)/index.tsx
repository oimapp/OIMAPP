import * as Application from "expo-application";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cover } from "@/components/Cover";
import { Body, Card, H2, Icon, IconName, Kicker, Notice, Pill } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { getCached, setCached } from "@/lib/cache";
import { longDate, todayISO } from "@/lib/dates";
import { StringKey } from "@/lib/i18n";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";
import { serif } from "@/lib/theme";
import { localVersion } from "@/lib/vault";

type Announcement = { id: string; audience: string; body_en: string; body_yo: string; sent_at: string };
export type LastRead = { book: string; key: string; date: string; topic: { en: string; yo: string }; n?: number };

/** "1.2.0" is older than "1.10.0" */
function older(a: string, b: string) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
}

export default function Home() {
  const { t, lang, profile, settings, catalogue, online, userId, refreshCatalogue } = useApp();
  const C = useColors();
  const [messages, setMessages] = useState<Announcement[]>([]);
  const [last, setLast] = useState<LastRead | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadMessages = useCallback(async () => {
    const cached = await getCached<Announcement[]>("messages");
    if (cached) setMessages(cached);
    const { data } = await supabase.from("announcements").select("*").order("sent_at", { ascending: false }).limit(20);
    if (data) {
      setMessages(data as Announcement[]);
      await setCached("messages", data);
    }
  }, []);

  useEffect(() => { void loadMessages(); }, [loadMessages]);
  useFocusEffect(useCallback(() => { void getCached<LastRead>("last_read").then(setLast); }, []));

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshCatalogue(), loadMessages()]);
    setRefreshing(false);
  };

  const owned = catalogue.books.filter((b) => b.owned);
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
  const lastBook = last ? catalogue.books.find((b) => b.id === last.book && b.owned) : null;

  const quick: [IconName, StringKey, () => void][] = [
    ["calendar-month", "calendar", () => router.navigate("/church?tab=calendar")],
    ["map-marker-radius", "districts", () => router.navigate("/church?tab=districts")],
    ["account-group", "babaAladura", () => router.navigate("/church?tab=babas")],
    ["information-outline", "aboutChurch", () => router.push("/about")],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ paddingVertical: 18, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.brand]} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF", overflow: "hidden" }}>
            <Image source={require("@/assets/images/logo.png")} style={{ width: 48, height: 48 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: serif, fontSize: 22, fontWeight: "700", color: C.deep }} numberOfLines={1}>
              {t("greeting", { name: firstName })}
            </Text>
            <Text style={{ color: C.muted }}>{longDate(todayISO(), lang)}</Text>
          </View>
          <Pressable onPress={() => router.push("/search")} hitSlop={10} style={{ padding: 8 }}>
            <Icon name="magnify" size={26} color={C.deep} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 18, gap: 10 }}>
          {!online && <Notice text={t("offlineNote")} />}
          {needsUpdate ? <Notice tone="error" text={t("updateApp")} /> : null}
          {maint ? <Notice tone="error" text={maint} /> : null}
          {notice ? <Notice text={notice} /> : null}
        </View>

        {/* The books, shown by their covers */}
        <View style={{ paddingHorizontal: 18 }}><H2>{t("myBooks")}</H2></View>
        {catalogue.books.length === 0 ? (
          <View style={{ paddingHorizontal: 18 }}><Card><Body muted>{t("noBooks")}</Body></Card></View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}>
            {catalogue.books.map((b) => {
              const onPhone = !!userId && localVersion(b.id, userId) !== null;
              return (
                <Pressable key={b.id} onPress={() => router.push(`/book/${b.id}`)} style={({ pressed }) => ({ width: 150, gap: 8, opacity: pressed ? 0.85 : 1 })}>
                  <Cover book={b} lang={lang} width={150} />
                  <Text style={{ color: C.ink, fontWeight: "700", fontSize: 14 }} numberOfLines={2}>{bookTitle(b, lang)}</Text>
                  <Pill
                    text={!b.owned ? t("notOwned") : onPhone ? t("downloaded") : t("download")}
                    tone={!b.owned ? "muted" : onPhone ? "green" : "brand"}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={{ paddingHorizontal: 18, gap: 14 }}>
          {last && lastBook ? (
            <Card style={{ backgroundColor: C.hero, borderColor: C.hero }} onPress={() => router.push(`/read/${last.book}/${last.key}`)}>
              <Kicker color="#F3C6CD">{t("continueReading")}</Kicker>
              <Text style={{ color: C.heroText, opacity: 0.8 }}>{bookTitle(lastBook, lang)} · {longDate(last.date, lang, false)}</Text>
              <Text style={{ fontFamily: serif, color: C.heroText, fontSize: 20, fontWeight: "700" }}>
                {(lang === "yo" ? last.topic.yo : last.topic.en) || last.topic.en}
              </Text>
            </Card>
          ) : null}

          <H2>{t("freePages")}</H2>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {quick.map(([ic, label, go]) => (
              <Pressable
                key={label}
                onPress={go}
                style={({ pressed }) => ({ width: "48%", flexGrow: 1, minHeight: 84, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 14, justifyContent: "space-between", opacity: pressed ? 0.85 : 1 })}
              >
                <Icon name={ic} size={26} />
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 15 }}>{t(label)}</Text>
              </Pressable>
            ))}
          </View>

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
