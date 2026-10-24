import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReadAloud } from "@/components/ReadAloud";
import { Icon, IconName, Loading, Segments } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getChapter, Verse } from "@/lib/bible";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { getCached, setCached } from "@/lib/cache";
import { Lang, translate } from "@/lib/i18n";
import { TEXT_SIZES, usePrefs } from "@/lib/prefs";
import { recordReadToday } from "@/lib/streak";
import { serif } from "@/lib/theme";

export default function Chapter() {
  const p = useLocalSearchParams<{ book: string; chapter: string; v?: string; to?: string; l?: string }>();
  const { t, lang } = useApp();
  const { prefs, setPref, C } = usePrefs();
  const book = BIBLE_BOOKS.find((b) => b.code === p.book);
  const chapter = Number(p.chapter) || 1;
  const from = p.v ? Number(p.v) : undefined;
  const to = p.to ? Number(p.to) : from;
  const [bl, setBl] = useState<Lang | null>(null);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (p.l === "en" || p.l === "yo") setBl(p.l);
    else void getCached<Lang>("bible_lang").then((l) => setBl(l ?? lang));
  }, [lang, p.l]);

  useEffect(() => {
    if (!book || !bl) return;
    setVerses(null);
    void getChapter(bl, book.code, chapter).then((v) => {
      setVerses(v);
      void setCached("bible_last", { code: book.code, chapter });
      void recordReadToday();
    });
  }, [book, chapter, bl]);

  const size = TEXT_SIZES[prefs.textSize];
  const parts = useMemo(() => (verses ?? []).map((v) => v.t), [verses]);

  if (!book) return <Loading />;
  const name = bl === "yo" ? book.yo : book.en;
  const go = (c: number) => router.replace(`/bible/${book.code}/${c}`);
  const changeLang = (l: Lang) => { setBl(l); void setCached("bible_lang", l); };

  const TopIcon = ({ name: n, onPress }: { name: IconName; onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ padding: 7 }}><Icon name={n} size={24} color={C.deep} /></Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <TopIcon name="arrow-left" onPress={() => router.back()} />
        <Text style={{ flex: 1, fontWeight: "700", color: C.deep, fontSize: 16 }} numberOfLines={1}>{name} {chapter}</Text>
        <TopIcon name="format-font-size-decrease" onPress={() => setPref("textSize", Math.max(0, prefs.textSize - 1))} />
        <TopIcon name="format-font-size-increase" onPress={() => setPref("textSize", Math.min(TEXT_SIZES.length - 1, prefs.textSize + 1))} />
      </View>
      {!verses || !bl ? <Loading text={t("bibleLoading")} /> : (
        <ScrollView ref={scroll} key={`${book.code}-${chapter}-${bl}`} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
          <Segments<Lang> value={bl} onChange={changeLang} options={[["yo", "Yorùbá"], ["en", "English (KJV)"]]} />
          <ReadAloud parts={[`${name} ${translate(bl, "chapter", { n: chapter })}`, ...parts]} lang={bl} />
          <Text style={{ fontFamily: serif, fontSize: 26 * size, fontWeight: "700", color: C.deep }}>
            {name} {chapter}
          </Text>
          <View style={{ gap: 6 }}>
            {verses.map((v) => {
              const hl = from !== undefined && v.v >= from && v.v <= (to ?? from);
              return (
                <Text
                  key={v.v}
                  onLayout={v.v === from ? (e) => { const y = e.nativeEvent.layout.y; setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y + 120), animated: true }), 50); } : undefined}
                  style={[{ fontFamily: serif, fontSize: 18 * size, lineHeight: 29 * size, color: C.ink, borderRadius: 6 }, hl && { backgroundColor: C.dark ? "#4A3B00" : "#FFF1B8" }]}
                >
                  <Text style={{ fontSize: 12 * size, fontWeight: "800", color: C.red }}>{v.v}  </Text>
                  {v.t}
                </Text>
              );
            })}
          </View>
        </ScrollView>
      )}
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
        <Nav label={t("previous")} icon="chevron-left" disabled={chapter <= 1} onPress={() => go(chapter - 1)} />
        <View style={{ width: 1, backgroundColor: C.line }} />
        <Nav label={t("next")} icon="chevron-right" right disabled={chapter >= book.chapters} onPress={() => go(chapter + 1)} />
      </View>
    </SafeAreaView>
  );

  function Nav({ label, icon, right, disabled, onPress }: { label: string; icon: IconName; right?: boolean; disabled?: boolean; onPress: () => void }) {
    return (
      <Pressable onPress={disabled ? undefined : onPress} style={{ flex: 1, flexDirection: right ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, opacity: disabled ? 0.35 : 1 }}>
        <Icon name={icon} size={22} />
        <Text style={{ color: C.brand, fontWeight: "700", fontSize: 15 }}>{label}</Text>
      </Pressable>
    );
  }
}
