import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Body, Icon, Loading, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { longDate } from "@/lib/dates";
import { useColors } from "@/lib/prefs";
import { getIndex, getItem, Item, Part } from "@/lib/vault";

type Hit = { book: string; key: string; date: string; topic: string; where: string; snippet: string };
type Doc = { book: string; item: Item };

/** Flatten a part into plain text for searching. */
const textOf = (p?: Part) =>
  p ? [p.topic, p.text, ...p.body.map((b) => ("k" in b ? `${b.k} ${b.x}` : b.x))].join("\n") : "";

/** Remove tone marks so "ọlọrun" matches "Ọlọ́run". */
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** The plain text plus, for each of its letters, where it was in the original. */
function flatten(s: string) {
  let flat = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const ch of plain(s[i])) {
      flat += ch;
      map.push(i);
    }
  }
  return { flat, map };
}

export default function Search() {
  const { t, lang, userId, catalogue } = useApp();
  const C = useColors();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [q, setQ] = useState("");

  // Open every downloaded book once, then search in memory.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const out: Doc[] = [];
      for (const b of catalogue.books.filter((x) => x.owned)) {
        const ix = await getIndex(b.id, userId);
        if (!ix) continue;
        for (const e of ix) {
          const item = await getItem(b.id, userId, e.key);
          if (item) out.push({ book: b.id, item });
        }
      }
      setDocs(out);
    })();
  }, [userId, catalogue]);

  const hits = useMemo<Hit[]>(() => {
    const term = plain(q.trim());
    if (!docs || term.length < 3) return [];
    const res: Hit[] = [];
    for (const d of docs) {
      for (const l of [lang, lang === "yo" ? "en" : "yo"] as const) {
        const full = textOf(d.item[l]);
        const { flat, map } = flatten(full);
        const found = flat.indexOf(term);
        if (found < 0) continue;
        const at = map[found];
        const book = catalogue.books.find((b) => b.id === d.book);
        const start = Math.max(0, at - 50);
        res.push({
          book: d.book, key: d.item.key, date: d.item.date,
          topic: d.item[l]?.topic || d.item.en.topic,
          where: `${book ? bookTitle(book, lang) : d.book} · ${longDate(d.item.date, lang, false)}`,
          snippet: `${start > 0 ? "…" : ""}${full.slice(start, at + term.length + 80).replace(/\n/g, " ")}…`,
        });
        break;
      }
      if (res.length >= 60) break;
    }
    return res;
  }, [docs, q, lang, catalogue]);

  return (
    <SubScreen title={t("searchBooks")} scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder={t("searchHint")}
          placeholderTextColor={C.muted}
          style={{ flex: 1, minHeight: 48, fontSize: 17, color: C.ink }}
          returnKeyType="search"
        />
      </View>
      {!docs ? (
        <Loading text={t("loading")} />
      ) : docs.length === 0 ? (
        <Body muted>{t("searchNeedsDownload")}</Body>
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(h) => `${h.book}|${h.key}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={q.trim().length >= 3 ? <Body muted>{t("noResults")}</Body> : undefined}
          renderItem={({ item: h }) => (
            <Pressable onPress={() => router.push(`/read/${h.book}/${h.key}`)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 3 }}>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: 13 }}>{h.where}</Text>
              <Text style={{ color: C.ink, fontWeight: "700", fontSize: 16 }}>{h.topic}</Text>
              <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{h.snippet}</Text>
            </Pressable>
          )}
        />
      )}
    </SubScreen>
  );
}
