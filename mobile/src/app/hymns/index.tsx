import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Body, Card, Icon, Loading, Segments, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getFavourites, useHymns } from "@/lib/hymns";
import { useColors } from "@/lib/prefs";

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Hymns() {
  const { t, lang } = useApp();
  const C = useColors();
  const hymns = useHymns();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "fav">("all");
  const [favs, setFavs] = useState<Set<number>>(new Set());
  useFocusEffect(useCallback(() => { void getFavourites().then(setFavs); }, []));

  const list = useMemo(() => {
    let l = hymns ?? [];
    if (tab === "fav") l = l.filter((h) => favs.has(h.number));
    const s = plain(q.trim());
    if (!s) return l;
    if (/^\d+$/.test(s)) return l.filter((h) => String(h.number).startsWith(s));
    return l.filter((h) => plain(`${h.title_en} ${h.title_yo} ${h.text_en} ${h.text_yo}`).includes(s));
  }, [hymns, q, tab, favs]);

  return (
    <SubScreen title={t("hymnBook")} scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t("hymnSearch")} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 48, fontSize: 17, color: C.ink }} />
      </View>
      <Segments<"all" | "fav"> value={tab} onChange={setTab} options={[["all", t("allHymns")], ["fav", t("favourites")]]} />
      {!hymns ? <Loading /> : hymns.length === 0 ? (
        <Card><Body muted>{t("hymnsSoon")}</Body></Card>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(h) => String(h.number)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<Body muted>{t("noResults")}</Body>}
          renderItem={({ item: h }) => (
            <Pressable onPress={() => router.push(`/hymns/${h.number}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.brand, fontWeight: "800", fontSize: 16 }}>{h.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>{(lang === "yo" ? h.title_yo : h.title_en) || h.title_en || h.title_yo}</Text>
                <Text style={{ color: C.muted, fontSize: 13 }} numberOfLines={1}>{(lang === "yo" ? h.title_en : h.title_yo) || h.category}</Text>
              </View>
              {favs.has(h.number) ? <Icon name="heart" size={20} color={C.red} /> : null}
            </Pressable>
          )}
        />
      )}
    </SubScreen>
  );
}
