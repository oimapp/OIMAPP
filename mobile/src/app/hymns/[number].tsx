import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReadAloud } from "@/components/ReadAloud";
import { Icon, IconName, Loading, Segments } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getFavourites, toggleFavourite, useHymns, verses } from "@/lib/hymns";
import { Lang, translate } from "@/lib/i18n";
import { TEXT_SIZES, usePrefs } from "@/lib/prefs";
import { serif } from "@/lib/theme";

export default function HymnPage() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const { lang } = useApp();
  const { prefs, setPref, C } = usePrefs();
  const hymns = useHymns();
  const [hl, setHl] = useState<Lang>(lang);
  const [fav, setFav] = useState(false);
  const n = Number(number);
  useEffect(() => { void getFavourites().then((s) => setFav(s.has(n))); }, [n]);

  const h = hymns?.find((x) => x.number === n);
  if (!h) return <Loading />;
  const hasYo = !!h.text_yo.trim(), hasEn = !!h.text_en.trim();
  const use: Lang = hl === "yo" && hasYo ? "yo" : hl === "en" && hasEn ? "en" : hasYo ? "yo" : "en";
  const title = (use === "yo" ? h.title_yo : h.title_en) || h.title_en || h.title_yo;
  const vs = verses(use === "yo" ? h.text_yo : h.text_en);
  const size = TEXT_SIZES[prefs.textSize];
  const idx = hymns!.findIndex((x) => x.number === n);
  const prev = hymns![idx - 1], next = hymns![idx + 1];

  const TopIcon = ({ name, onPress, color }: { name: IconName; onPress: () => void; color?: string }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ padding: 7 }}><Icon name={name} size={24} color={color ?? C.deep} /></Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <TopIcon name="arrow-left" onPress={() => router.back()} />
        <Text style={{ flex: 1, fontWeight: "700", color: C.deep, fontSize: 16 }}>{translate(use, "hymn", { n })}</Text>
        <TopIcon name="format-font-size-decrease" onPress={() => setPref("textSize", Math.max(0, prefs.textSize - 1))} />
        <TopIcon name="format-font-size-increase" onPress={() => setPref("textSize", Math.min(TEXT_SIZES.length - 1, prefs.textSize + 1))} />
        <TopIcon name={fav ? "heart" : "heart-outline"} color={fav ? C.red : C.deep} onPress={() => void toggleFavourite(n).then((s) => setFav(s.has(n)))} />
      </View>
      <ScrollView key={`${n}-${use}`} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        {hasYo && hasEn ? <Segments<Lang> value={use} onChange={setHl} options={[["yo", "Yorùbá"], ["en", "English"]]} /> : null}
        <ReadAloud parts={[title, ...vs]} lang={use} />
        <Text style={{ fontFamily: serif, fontSize: 24 * size, fontWeight: "700", color: C.deep }}>{title}</Text>
        {vs.map((v, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12 }}>
            <Text style={{ color: C.red, fontWeight: "800", fontSize: 15 * size, width: 22 * size }}>{/^(chorus|ègbè|egbe|refrain)/i.test(v) ? "" : i + 1}</Text>
            <Text style={{ flex: 1, fontFamily: serif, fontSize: 18 * size, lineHeight: 29 * size, color: C.ink }}>{v}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
        <Nav label={prev ? `${prev.number}` : ""} icon="chevron-left" disabled={!prev} onPress={() => prev && router.replace(`/hymns/${prev.number}`)} />
        <View style={{ width: 1, backgroundColor: C.line }} />
        <Nav label={next ? `${next.number}` : ""} icon="chevron-right" right disabled={!next} onPress={() => next && router.replace(`/hymns/${next.number}`)} />
      </View>
    </SafeAreaView>
  );

  function Nav({ label, icon, right, disabled, onPress }: { label: string; icon: IconName; right?: boolean; disabled?: boolean; onPress: () => void }) {
    return (
      <Pressable onPress={disabled ? undefined : onPress} style={{ flex: 1, flexDirection: right ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, opacity: disabled ? 0.35 : 1 }}>
        <Icon name={icon} size={22} />
        <Text style={{ color: C.brand, fontWeight: "700", fontSize: 15 }}>{label}</Text>
      </Pressable>
    );
  }
}
