import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Body, Card, Pill, Screen, Title } from "@/components/ui";
import { BookRow, useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { C, serif } from "@/lib/theme";
import { localVersion } from "@/lib/vault";

export default function Books() {
  const { t, lang, catalogue, userId, refreshCatalogue } = useApp();
  const [, setTick] = useState(0);
  useFocusEffect(useCallback(() => { void refreshCatalogue(); setTick((n) => n + 1); }, [refreshCatalogue]));

  return (
    <Screen>
      <Title>{t("myBooks")}</Title>
      {catalogue.books.length === 0 && <Card><Body muted>{t("noBooks")}</Body></Card>}
      {catalogue.books.map((b) => (
        <BookCard key={b.id} book={b} lang={lang} onDevice={!!userId && localVersion(b.id, userId) !== null} />
      ))}
    </Screen>
  );

  function BookCard({ book, onDevice }: { book: BookRow; lang: string; onDevice: boolean }) {
    return (
      <Card onPress={() => router.push(`/book/${book.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 56, height: 74, borderRadius: 8, backgroundColor: book.kind === "children" ? C.red : C.deep, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={book.kind === "daily" ? "calendar-today" : "book-open-variant"} size={26} color={C.white} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: serif, fontSize: 18, fontWeight: "700", color: C.deep }}>{bookTitle(book, lang as "en" | "yo")}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill text={book.owned ? t("owned") : t("notOwned")} tone={book.owned ? "brand" : "muted"} />
            {onDevice && <Pill text={t("downloaded")} tone="green" />}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={26} color={C.muted} />
      </Card>
    );
  }
}
