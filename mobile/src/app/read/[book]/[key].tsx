import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PartView } from "@/components/Blocks";
import { Loading, Segments } from "@/components/ui";
import { Watermark } from "@/components/Watermark";
import { useApp } from "@/lib/app";
import { bookTitle, useBookIndex } from "@/lib/books";
import { getCached, setCached } from "@/lib/cache";
import { longDate } from "@/lib/dates";
import { Lang, translate } from "@/lib/i18n";
import { C } from "@/lib/theme";
import { getItem, Item } from "@/lib/vault";

const SIZES = [0.85, 1, 1.15, 1.3, 1.5];

export default function Reader() {
  const { book: bookId, key } = useLocalSearchParams<{ book: string; key: string }>();
  const { t, lang, userId, profile, settings, catalogue } = useApp();
  const book = catalogue.books.find((b) => b.id === bookId);
  const { index } = useBookIndex(bookId);
  const [item, setItem] = useState<Item | null>(null);
  const [missing, setMissing] = useState(false);
  const [readLang, setReadLang] = useState<Lang>(lang);
  const [sizeIx, setSizeIx] = useState(1);

  // Block screenshots and screen recording while a book page is open (Android).
  useEffect(() => {
    if (settings.block_screenshots === false) return;
    ScreenCapture.preventScreenCaptureAsync("reader").catch(() => undefined);
    return () => { ScreenCapture.allowScreenCaptureAsync("reader").catch(() => undefined); };
  }, [settings.block_screenshots]);

  useEffect(() => {
    void getCached<number>("text_size").then((v) => { if (v !== null) setSizeIx(v); });
  }, []);

  useEffect(() => {
    if (!userId || !bookId || !key) return;
    setItem(null);
    setMissing(false);
    void getItem(bookId, userId, key).then((it) => {
      if (it) setItem(it);
      else setMissing(true);
    });
  }, [bookId, key, userId]);

  const changeSize = (d: number) => {
    const n = Math.min(SIZES.length - 1, Math.max(0, sizeIx + d));
    setSizeIx(n);
    void setCached("text_size", n);
  };

  const pos = index?.findIndex((e) => e.key === key) ?? -1;
  const prev = pos > 0 ? index![pos - 1] : null;
  const next = index && pos >= 0 && pos < index.length - 1 ? index[pos + 1] : null;
  const go = (k: string) => router.replace(`/read/${bookId}/${k}`);

  if (missing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper, padding: 18 }}>
        <Text style={{ color: C.ink, fontSize: 16 }}>{t("notDownloaded")}</Text>
      </SafeAreaView>
    );
  }
  if (!item) return <Loading />;

  const part = item[readLang]?.topic ? item[readLang] : item.en;
  const kicker = [
    item.n ? translate(readLang, "lesson", { n: item.n }) : "",
    item.review ? translate(readLang, "review") : "",
  ].filter(Boolean).join(" · ");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={C.deep} />
        </Pressable>
        <Text style={{ flex: 1, fontWeight: "700", color: C.deep }} numberOfLines={1}>
          {book ? bookTitle(book, lang) : ""}
        </Text>
        <Pressable onPress={() => changeSize(-1)} hitSlop={8} style={{ padding: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: C.brand }}>A−</Text>
        </Pressable>
        <Pressable onPress={() => changeSize(1)} hitSlop={8} style={{ padding: 6 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.brand }}>A+</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView key={key} contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 16 }}>
          <Segments<Lang> value={readLang} onChange={setReadLang} options={[["yo", "Yorùbá"], ["en", "English"]]} />
          <Text style={{ color: C.muted, fontSize: 14 }}>
            {longDate(item.date, readLang)}{kicker ? `  ·  ${kicker}` : ""}
          </Text>
          {item.theme ? (
            <Text style={{ color: C.red, fontWeight: "700" }}>{item.theme[readLang] || item.theme.en}</Text>
          ) : null}
          <PartView
            part={{ ...part, name: "" }}
            size={SIZES[sizeIx]}
            labels={{ memory: translate(readLang, "memoryVerse"), text: translate(readLang, "text") }}
          />
        </ScrollView>
        {settings.watermark !== false && <Watermark text={profile?.phone ?? ""} />}
      </View>

      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
        <NavButton label={t("previous")} icon="chevron-left" disabled={!prev} onPress={() => prev && go(prev.key)} />
        <View style={{ width: 1, backgroundColor: C.line }} />
        <NavButton label={t("next")} icon="chevron-right" right disabled={!next} onPress={() => next && go(next.key)} />
      </View>
    </SafeAreaView>
  );
}

function NavButton({ label, icon, right, disabled, onPress }: {
  label: string; icon: "chevron-left" | "chevron-right"; right?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{ flex: 1, flexDirection: right ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, opacity: disabled ? 0.35 : 1 }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={C.brand} />
      <Text style={{ color: C.brand, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
