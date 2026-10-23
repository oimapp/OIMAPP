import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Button, Card, Notice } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle, downloadBook, pickCurrent, useBookIndex } from "@/lib/books";
import { monthName, shortDate } from "@/lib/dates";
import { errorCode } from "@/lib/supabase";
import { C, serif } from "@/lib/theme";
import type { IndexEntry } from "@/lib/vault";

export default function BookPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, catalogue, userId, installId, refreshCatalogue } = useApp();
  const book = catalogue.books.find((b) => b.id === id);
  const { index, version, ready, reload } = useBookIndex(book?.owned ? id : undefined);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    if (!index) return [];
    const s = q.trim().toLowerCase();
    if (!s) return index;
    return index.filter((e) =>
      `${e.topic.en} ${e.topic.yo} ${e.n ?? ""} ${e.date}`.toLowerCase().includes(s));
  }, [index, q]);

  if (!book) {
    return <Shell title=""><Body muted>{t("noBooks")}</Body></Shell>;
  }

  const download = async () => {
    if (!userId) return;
    setErr("");
    setProgress(0);
    try {
      await downloadBook(book.id, userId, installId, setProgress);
      await reload();
      await refreshCatalogue();
    } catch (e) {
      const code = errorCode(e);
      setErr(code === "wrong_phone" ? t("wrongPhone") : t("downloadFailed"));
    } finally {
      setProgress(null);
    }
  };

  const title = bookTitle(book, lang);

  if (!book.owned) {
    return (
      <Shell title={title}>
        <Card>
          <Text style={{ fontWeight: "700", fontSize: 17, color: C.ink }}>{t("buyTitle")}</Text>
          <Body>{t("buySoon")}</Body>
        </Card>
      </Shell>
    );
  }

  if (progress !== null || (ready && !index)) {
    return (
      <Shell title={title}>
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
          <Button title={t("download")} onPress={download} busy={progress !== null} />
        </Card>
      </Shell>
    );
  }

  const current = pickCurrent(index, book.kind);
  const hasUpdate = version !== null && book.version > version;

  return (
    <Shell title={title}>
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
        placeholderTextColor="#9AA0B8"
        style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: C.ink }}
      />
      <FlatList
        data={list}
        keyExtractor={(e) => e.key}
        contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
        renderItem={({ item, index: i }) => (
          <>
            {(i === 0 || list[i - 1].date.slice(0, 7) !== item.date.slice(0, 7)) && (
              <Text style={{ marginTop: i ? 12 : 0, fontWeight: "800", color: C.red, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.5 }}>
                {item.theme ? `${monthName(item.date, lang)} · ${item.theme[lang] || item.theme.en}` : monthName(item.date, lang)}
              </Text>
            )}
            <Row e={item} current={current?.key === item.key} onPress={() => router.push(`/read/${book.id}/${item.key}`)} />
          </>
        )}
      />
    </Shell>
  );

  function Row({ e, current, onPress }: { e: IndexEntry; current: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        style={{ backgroundColor: current ? C.soft : C.white, borderWidth: 1, borderColor: current ? C.brand : C.line, borderRadius: 12, padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }}
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
      </Pressable>
    );
  }
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={["top", "left", "right"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={C.deep} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: serif, fontSize: 20, fontWeight: "700", color: C.deep }} numberOfLines={1}>{title}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 18, gap: 12 }}>{children}</View>
    </SafeAreaView>
  );
}

