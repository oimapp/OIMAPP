import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Body, Icon, Loading, Segments, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { loadBible } from "@/lib/bible";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { getCached, setCached } from "@/lib/cache";
import { Lang } from "@/lib/i18n";
import { useColors } from "@/lib/prefs";

type Hit = { code: string; c: number; v: number; text: string };
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A plain (no tone marks) copy of each verse, made once per language.
const flatCache: Partial<Record<Lang, { code: string; c: number; v: number; t: string; p: string }[]>> = {};

export default function BibleSearch() {
  const { t, lang } = useApp();
  const C = useColors();
  const [bl, setBl] = useState<Lang>(lang);
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => { void getCached<Lang>("bible_lang").then((l) => l && setBl(l)); }, []);

  useEffect(() => {
    setReady(false);
    void loadBible(bl).then((text) => {
      if (!flatCache[bl]) {
        const rows: { code: string; c: number; v: number; t: string; p: string }[] = [];
        for (const b of BIBLE_BOOKS) {
          (text.get(b.code) ?? []).forEach((ch, ci) => ch?.forEach((vs) => rows.push({ code: b.code, c: ci + 1, v: vs.v, t: vs.t, p: plain(vs.t) })));
        }
        flatCache[bl] = rows;
      }
      setReady(true);
    });
  }, [bl]);

  useEffect(() => {
    const term = plain(q.trim());
    if (!ready || term.length < 3) { setHits([]); return; }
    const timer = setTimeout(() => {
      const out: Hit[] = [];
      for (const r of flatCache[bl] ?? []) {
        if (r.p.includes(term)) out.push({ code: r.code, c: r.c, v: r.v, text: r.t });
        if (out.length >= 150) break;
      }
      setHits(out);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, ready, bl]);

  const name = (code: string) => {
    const b = BIBLE_BOOKS.find((x) => x.code === code)!;
    return bl === "yo" ? b.yo : b.en;
  };

  return (
    <SubScreen title={t("bibleSearch")} scroll={false}>
      <Segments<Lang> value={bl} onChange={(l) => { setBl(l); void setCached("bible_lang", l); }} options={[["yo", "Yorùbá"], ["en", "English (KJV)"]]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput autoFocus value={q} onChangeText={setQ} placeholder={t("searchHint")} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 48, fontSize: 17, color: C.ink }} />
      </View>
      {!ready ? <Loading text={t("bibleLoading")} /> : (
        <FlatList
          data={hits}
          keyExtractor={(h) => `${h.code}${h.c}:${h.v}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={q.trim().length >= 3 ? <Body muted>{t("noResults")}</Body> : undefined}
          renderItem={({ item: h }) => (
            <Pressable onPress={() => router.push(`/bible/${h.code}/${h.c}?v=${h.v}`)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 3 }}>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: 13 }}>{name(h.code)} {h.c}:{h.v}</Text>
              <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21 }} numberOfLines={3}>{h.text}</Text>
            </Pressable>
          )}
        />
      )}
    </SubScreen>
  );
}
