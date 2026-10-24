import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Cover } from "@/components/Cover";
import { Body, Card, Icon, Pill, Screen, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { useColors } from "@/lib/prefs";
import { localVersion } from "@/lib/vault";

export default function Books() {
  const { t, lang, catalogue, userId, refreshCatalogue } = useApp();
  const C = useColors();
  const { width } = useWindowDimensions();
  const [, setTick] = useState(0);
  useFocusEffect(useCallback(() => { void refreshCatalogue(); setTick((n) => n + 1); }, [refreshCatalogue]));
  const coverW = Math.floor((width - 18 * 2 - 14) / 2);

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}><Title>{t("myBooks")}</Title></View>
        <Pressable onPress={() => router.push("/search")} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="magnify" size={26} color={C.deep} />
        </Pressable>
      </View>
      {catalogue.books.length === 0 && <Card><Body muted>{t("noBooks")}</Body></Card>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {catalogue.books.map((b) => {
          const onPhone = !!userId && localVersion(b.id, userId) !== null;
          return (
            <Pressable key={b.id} onPress={() => router.push(`/book/${b.id}`)} style={({ pressed }) => ({ width: coverW, gap: 8, opacity: pressed ? 0.85 : 1 })}>
              <Cover book={b} lang={lang} width={coverW} />
              <Text style={{ color: C.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={2}>{bookTitle(b, lang)}</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Pill text={b.owned ? t("owned") : t("notOwned")} tone={b.owned ? "brand" : "muted"} />
                {onPhone && <Pill text={t("downloaded")} tone="green" />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
