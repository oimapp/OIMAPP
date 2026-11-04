import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { BuyOptions } from "@/components/BuyOptions";
import { Cover } from "@/components/Cover";
import { Body, Button, Card, Icon, Notice, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle, downloadBook, pickCurrent, readKeys, useBookIndex } from "@/lib/books";
import { monthName, shortDate } from "@/lib/dates";
import { useColors } from "@/lib/prefs";
import { errorCode } from "@/lib/supabase";
import { serif } from "@/lib/theme";
import type { IndexEntry } from "@/lib/vault";

export default function BookPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, catalogue, userId, installId, refreshCatalogue } = useApp();
  const C = useColors();
  const book = catalogue.books.find((b) => b.id === id);
  const { index, version, ready, reload } = useBookIndex(book?.owned ? id : undefined);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    if (userId && id) void readKeys(userId, id).then(setDone);
  }, [userId, id]));

  const list = useMemo(() => {
    if (!index) return [];
    const s = q.trim().toLowerCase();
    if (!s) return index;
    return index.filter((e) => `${e.topic.en} ${e.topic.yo} ${e.n ?? ""} ${e.date}`.toLowerCase().includes(s));
  }, [index, q]);

  if (!book) {
    return <SubScreen title=""><Body muted>{t("noBooks")}</Body></SubScreen>;
  }

  const title = bookTitle(book, lang);
  const count = book.kind === "daily" ? t("daysCount", { n: index?.length ?? 365 }) : t("lessonsCount", { n: index?.length ?? 52 });

  const download = async () => {
    if (!userId) return;
    setErr("");
    setProgress(0);
    try {
      await downloadBook(book.id, userId, installId, setProgress);
      await reload();
      await refreshCatalogue();
    } catch (e) {
      setErr(errorCode(e) === "wrong_phone" ? t("wrongPhone") : t("downloadFailed"));
    } finally {
      setProgress(null);
    }
  };

  const header = (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-end", marginBottom: 4 }}>
      <Cover book={book} lang={lang} width={96} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: serif, fontSize: 20, fontWeight: "700", color: C.deep }}>{title}</Text>
        <Text style={{ color: C.muted }}>{count}</Text>
      </View>
    </View>
  );

  if (!book.owned) {
    return (
      <SubScreen title={title}>
        {header}
        <BuyOptions bookId={book.id} />
      </SubScreen>
    );
  }

  if (progress !== null || (ready && !index)) {
    return (
      <SubScreen title={title}>
        {header}
        {err ? <Notice tone="error" text={err} /> : null}
        <Card>
          <Body>{t("notDownloaded")}</Body>
          {progress !== null && (
            <>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: C.soft, overflow: "hidden" }}>
                <View style={{ width: `${Math.max(5, progress * 100)}%`, height: "100%", backgroundColor: C.brand }} />
              </View>
              <Body muted>{progress === 0 ? t("downloading") : t("savingSafely")}</Body>
            </>
          )}
          <Button title={t("download")} onPress={download} busy={progress !== null} icon="download" />
        </Card>
      </SubScreen>
    );
  }

  const current = pickCurrent(index, book.kind);
  const hasUpdate = version !== null && book.version > version;

  return (
    <SubScreen title={title} scroll={false}>
      {err ? <Notice tone="error" text={err} /> : null}
      {hasUpdate && (
        <Card style={{ backgroundColor: C.soft, borderColor: C.soft }}>
          <Body>{t("updateAvailable")}</Body>
          <Button title={t("updateBook")} onPress={download} />
        </Card>
      )}
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t("search")}
        placeholderTextColor={C.muted}
        style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: C.ink }}
      />
      <FlatList
        data={list}
        keyExtractor={(e) => e.key}
        contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
        ListHeaderComponent={q ? undefined : header}
        renderItem={({ item, index: i }) => (
          <>
            {(i === 0 || list[i - 1].date.slice(0, 7) !== item.date.slice(0, 7)) && (
              <Text style={{ marginTop: i ? 12 : 4, fontWeight: "800", color: C.red, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 }}>
                {item.theme ? `${monthName(item.date, lang)} · ${item.theme[lang] || item.theme.en}` : monthName(item.date, lang)}
              </Text>
            )}
            <Row e={item} current={current?.key === item.key} read={done.has(item.key)} onPress={() => router.push(`/read/${book.id}/${item.key}`)} />
          </>
        )}
      />
    </SubScreen>
  );

  function Row({ e, current, read, onPress }: { e: IndexEntry; current: boolean; read: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        style={{ backgroundColor: current ? C.soft : C.card, borderWidth: 1, borderColor: current ? C.brand : C.line, borderRadius: 12, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}
      >
        <View style={{ width: 54 }}>
          <Text style={{ fontWeight: "800", color: C.brand }}>{e.n ? `${e.n}` : shortDate(e.date, lang)}</Text>
          <Text style={{ fontSize: 12, color: C.muted }}>{e.n ? shortDate(e.date, lang) : ""}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: C.ink, fontWeight: "600" }} numberOfLines={2}>
            {(lang === "yo" ? e.topic.yo : e.topic.en) || e.topic.en}
          </Text>
          {e.review ? <Text style={{ fontSize: 12, color: C.red, fontWeight: "700" }}>{t("review")}</Text> : null}
        </View>
        {read ? <Icon name="check-circle" size={20} color={C.green} /> : null}
      </Pressable>
    );
  }
}
