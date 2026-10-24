import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Body, Card, Screen, Segments, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { longDate } from "@/lib/dates";
import { Mark, syncMarks, useMarks } from "@/lib/notes";
import { useColors } from "@/lib/prefs";
import { getIndex, IndexEntry } from "@/lib/vault";

type Tab = "bookmark" | "note";

export default function Mine() {
  const { t, lang, userId, catalogue, online } = useApp();
  const C = useColors();
  const [tab, setTab] = useState<Tab>("bookmark");
  const marks = useMarks(userId);
  const [indexes, setIndexes] = useState<Record<string, IndexEntry[]>>({});

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    if (online) void syncMarks(userId).catch(() => undefined);
    void (async () => {
      const out: Record<string, IndexEntry[]> = {};
      for (const b of catalogue.books) {
        const ix = await getIndex(b.id, userId);
        if (ix) out[b.id] = ix;
      }
      setIndexes(out);
    })();
  }, [userId, online, catalogue]));

  const list = marks.filter((m) => m.kind === tab).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const describe = (m: Mark) => {
    const book = catalogue.books.find((b) => b.id === m.book_id);
    const e = indexes[m.book_id]?.find((x) => x.key === m.item_key);
    const where = [book ? bookTitle(book, lang) : m.book_id, e ? longDate(e.date, lang, false) : ""].filter(Boolean).join(" · ");
    const topic = e ? (lang === "yo" ? e.topic.yo : e.topic.en) || e.topic.en : m.item_key;
    return { where, topic };
  };

  return (
    <Screen>
      <Title>{t("tabMine")}</Title>
      <Segments<Tab> value={tab} onChange={setTab} options={[["bookmark", t("bookmarks")], ["note", t("notes")]]} />
      {list.length === 0 ? (
        <Card><Body muted>{tab === "bookmark" ? t("noBookmarks") : t("noNotes")}</Body></Card>
      ) : (
        list.map((m) => {
          const d = describe(m);
          return (
            <Pressable key={`${m.book_id}|${m.item_key}|${m.kind}`} onPress={() => router.push(`/read/${m.book_id}/${m.item_key}`)}>
              <Card>
                <Text style={{ color: C.red, fontWeight: "700", fontSize: 13 }}>{d.where}</Text>
                <Text style={{ color: C.ink, fontWeight: "700", fontSize: 17 }}>{d.topic}</Text>
                {m.kind === "note" ? <Text style={{ color: C.muted, fontSize: 15, lineHeight: 22 }} numberOfLines={4}>{m.body}</Text> : null}
              </Card>
            </Pressable>
          );
        })
      )}
      {tab === "note" && <View><Body muted center style={{ fontSize: 13 }}>{t("notePrivate")}</Body></View>}
    </Screen>
  );
}
