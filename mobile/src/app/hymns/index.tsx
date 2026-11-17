import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Body, Card, Icon, Loading, Segments, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getFavourites, Hymn, hymnCategory, hymnId, hymnLabel, searchable, Series, useHymns } from "@/lib/hymns";
import { useColors } from "@/lib/prefs";

type Tab = Series | "fav";
type Found = { h: Hymn; line: string; score: number };

/** Every hymn ready for searching: title and words in both languages, without marks. */
function useIndex(hymns: Hymn[] | null) {
  return useMemo(() => (hymns ?? []).map((h) => ({
    h,
    title: searchable(`${h.title_en} ${h.title_yo}`),
    words: searchable(`${h.text_en}\n${h.text_yo}`),
    lines: `${h.text_en}\n${h.text_yo}`.split("\n").map((l) => l.trim()).filter(Boolean),
  })), [hymns]);
}

export default function Hymns() {
  const { t, lang } = useApp();
  const C = useColors();
  const hymns = useHymns();
  const index = useIndex(hymns);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("main");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  useFocusEffect(useCallback(() => { void getFavourites().then(setFavs); }, []));

  const term = searchable(q);
  const list = useMemo<Found[]>(() => {
    const inTab = (h: Hymn) => (tab === "fav" ? favs.has(hymnId(h)) : h.series === tab);
    if (!term) return index.filter((x) => inTab(x.h)).map((x) => ({ h: x.h, line: "", score: 0 }));

    // A number: that hymn in the list on screen.
    if (/^\d+$/.test(term)) {
      return index.filter((x) => inTab(x.h) && String(x.h.number).startsWith(term))
        .map((x) => ({ h: x.h, line: "", score: 0 }));
    }
    // A Roman number in the Kneeling Songs: I, II, XIV...
    if (tab === "akunleko" && /^[ivxl]+$/.test(term)) {
      return index.filter((x) => x.h.series === "akunleko" && x.h.label.toLowerCase() === term).map((x) => ({ h: x.h, line: "", score: 0 }));
    }
    // Words: search every hymn, in both languages. All the words must be there, in any order.
    const words = term.split(" ").filter((w) => w.length > 1 || term.length === 1);
    const out: Found[] = [];
    for (const x of index) {
      if (tab === "fav" && !favs.has(hymnId(x.h))) continue;
      const hay = `${x.title} ${x.words}`;
      if (!words.every((w) => hay.includes(w))) continue;
      const inTitle = words.every((w) => x.title.includes(w));
      const phrase = x.words.includes(term);
      const line = inTitle ? "" : x.lines.find((l) => searchable(l).includes(phrase ? term : words[0])) ?? "";
      out.push({ h: x.h, line, score: (inTitle ? 0 : phrase ? 1 : 2) * 10 + (x.h.series === "main" ? 0 : 1) });
    }
    // Hymns with the exact words together come first, then hymns that have all the words somewhere.
    return out.sort((a, b) => a.score - b.score || a.h.number - b.h.number).slice(0, 200);
  }, [index, term, tab, favs]);

  const has = (s: Series) => (hymns ?? []).some((h) => h.series === s);
  const tabs: [Tab, string][] = [["main", t("hymnsWord")]];
  if (has("akunleko")) tabs.push(["akunleko", lang === "yo" ? "Akúnlẹ̀kọ" : "Kneeling"]);
  if (has("isoji")) tabs.push(["isoji", "Ìsọjí"]);
  tabs.push(["fav", t("favourites")]);
  const searchingWords = !!term && !/^\d+$/.test(term);

  return (
    <SubScreen title={t("hymnBook")} scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t("hymnSearch")} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 48, fontSize: 17, color: C.ink }} />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={10}><Icon name="close-circle" color={C.muted} /></Pressable>
        ) : null}
      </View>
      <Segments<Tab> value={tab} onChange={setTab} options={tabs} />
      {!hymns ? <Loading /> : hymns.length === 0 ? (
        <Card><Body muted>{t("hymnsSoon")}</Body></Card>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(x) => hymnId(x.h)}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<Body muted>{t("noResults")}</Body>}
          renderItem={({ item: { h, line }, index: i }) => (
            <>
              {tab !== "fav" && !term && (i === 0 || hymnCategory(list[i - 1].h, lang) !== hymnCategory(h, lang)) && hymnCategory(h, lang) ? (
                <Text style={{ marginTop: i ? 10 : 0, fontWeight: "800", color: C.red, textTransform: "uppercase", fontSize: 12 }}>{hymnCategory(h, lang)}</Text>
              ) : null}
              <Pressable onPress={() => router.push(`/hymns/${hymnId(h)}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
                <View style={{ minWidth: 46, height: 46, paddingHorizontal: 6, borderRadius: 10, backgroundColor: h.series === "main" ? C.soft : C.redSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: h.series === "main" ? C.brand : C.red, fontWeight: "800", fontSize: 15 }}>{hymnLabel(h)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>{(lang === "en" && h.title_en) || h.title_yo || h.title_en}</Text>
                  {line ? (
                    <Text style={{ color: C.muted, fontSize: 13, fontStyle: "italic" }} numberOfLines={1}>“{line}”</Text>
                  ) : tab === "fav" || searchingWords ? (
                    <Text style={{ color: C.muted, fontSize: 13 }} numberOfLines={1}>
                      {h.series === "akunleko" ? t("kneelingSongs") : h.series === "isoji" ? "Ìsọjí" : hymnCategory(h, lang)}
                    </Text>
                  ) : null}
                </View>
                {favs.has(hymnId(h)) ? <Icon name="heart" size={20} color={C.red} /> : null}
              </Pressable>
            </>
          )}
        />
      )}
    </SubScreen>
  );
}
