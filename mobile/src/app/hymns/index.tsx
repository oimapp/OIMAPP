import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Body, Card, Icon, Loading, Segments, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getFavourites, hymnId, hymnLabel, Series, useHymns } from "@/lib/hymns";
import { useColors } from "@/lib/prefs";

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Tab = Series | "fav";

export default function Hymns() {
  const { t, lang } = useApp();
  const C = useColors();
  const hymns = useHymns();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("main");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  useFocusEffect(useCallback(() => { void getFavourites().then(setFavs); }, []));

  const list = useMemo(() => {
    let l = hymns ?? [];
    l = tab === "fav" ? l.filter((h) => favs.has(hymnId(h))) : l.filter((h) => h.series === tab);
    const s = plain(q.trim());
    if (!s) return l;
    if (/^\d+$/.test(s)) return l.filter((h) => String(h.number).startsWith(s));
    if (/^[ivxl]+$/.test(s) && tab === "akunleko") return l.filter((h) => h.label === s);
    return l.filter((h) => plain(`${h.title_en} ${h.title_yo} ${h.text_en} ${h.text_yo} ${h.category}`).includes(s));
  }, [hymns, q, tab, favs]);

  const has = (s: Series) => (hymns ?? []).some((h) => h.series === s);
  const tabs: [Tab, string][] = [["main", t("allHymns")]];
  if (has("akunleko")) tabs.push(["akunleko", "Akúnlẹ̀kọ"]);
  if (has("isoji")) tabs.push(["isoji", "Ìsọjí"]);
  tabs.push(["fav", t("favourites")]);

  return (
    <SubScreen title={t("hymnBook")} scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t("hymnSearch")} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 48, fontSize: 17, color: C.ink }} />
      </View>
      <Segments<Tab> value={tab} onChange={setTab} options={tabs} />
      {!hymns ? <Loading /> : hymns.length === 0 ? (
        <Card><Body muted>{t("hymnsSoon")}</Body></Card>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(h) => hymnId(h)}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<Body muted>{t("noResults")}</Body>}
          renderItem={({ item: h, index }) => (
            <>
              {tab === "main" && !q && (index === 0 || list[index - 1].category !== h.category) && h.category ? (
                <Text style={{ marginTop: index ? 10 : 0, fontWeight: "800", color: C.red, textTransform: "uppercase", fontSize: 12 }}>{h.category}</Text>
              ) : null}
              <Pressable onPress={() => router.push(`/hymns/${hymnId(h)}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
                <View style={{ minWidth: 46, height: 46, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.brand, fontWeight: "800", fontSize: 15 }}>{hymnLabel(h)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>{(lang === "en" && h.title_en) || h.title_yo || h.title_en}</Text>
                  {tab === "fav" || q ? <Text style={{ color: C.muted, fontSize: 13 }} numberOfLines={1}>{h.category}</Text> : null}
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
