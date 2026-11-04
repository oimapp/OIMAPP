import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReadAloud } from "@/components/ReadAloud";
import { Icon, IconName, Loading, Segments } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getFavourites, hymnId, hymnLabel, toggleFavourite, useHymns, verses } from "@/lib/hymns";
import { Lang, translate } from "@/lib/i18n";
import { TEXT_SIZES, usePrefs } from "@/lib/prefs";
import { serif } from "@/lib/theme";

export default function HymnPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang } = useApp();
  const { prefs, setPref, C } = usePrefs();
  const hymns = useHymns();
  const [hl, setHl] = useState<Lang>(lang);
  const [fav, setFav] = useState(false);
  // Older links used just the number for the main hymns.
  const key = /^\d+$/.test(id ?? "") ? `main-${id}` : id ?? "";
  useEffect(() => { void getFavourites().then((s) => setFav(s.has(key))); }, [key]);

  const h = hymns?.find((x) => hymnId(x) === key);
  if (!h) return <Loading />;
  const hasYo = !!h.text_yo.trim(), hasEn = !!h.text_en.trim();
  const use: Lang = hl === "yo" && hasYo ? "yo" : hl === "en" && hasEn ? "en" : hasYo ? "yo" : "en";
  const title = (use === "yo" ? h.title_yo : h.title_en) || h.title_yo || h.title_en;
  const vs = verses(use === "yo" ? h.text_yo : h.text_en);
  const size = TEXT_SIZES[prefs.textSize];
  const same = hymns!.filter((x) => x.series === h.series);
  const idx = same.findIndex((x) => x.number === h.number);
  const prev = same[idx - 1], next = same[idx + 1];
  let n = 0;

  const TopIcon = ({ name, onPress, color }: { name: IconName; onPress: () => void; color?: string }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ padding: 7 }}><Icon name={name} size={24} color={color ?? C.deep} /></Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <TopIcon name="arrow-left" onPress={() => router.back()} />
        <Text style={{ flex: 1, fontWeight: "700", color: C.deep, fontSize: 16 }}>
          {h.series === "main" ? translate(use, "hymn", { n: h.number }) : `${h.series === "akunleko" ? "Akúnlẹ̀kọ" : "Ìsọjí"} ${hymnLabel(h)}`}
        </Text>
        <TopIcon name="format-font-size-decrease" onPress={() => setPref("textSize", Math.max(0, prefs.textSize - 1))} />
        <TopIcon name="format-font-size-increase" onPress={() => setPref("textSize", Math.min(TEXT_SIZES.length - 1, prefs.textSize + 1))} />
        <TopIcon name={fav ? "heart" : "heart-outline"} color={fav ? C.red : C.deep} onPress={() => void toggleFavourite(key).then((s) => setFav(s.has(key)))} />
      </View>
      <ScrollView key={`${key}-${use}`} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        {hasYo && hasEn ? <Segments<Lang> value={use} onChange={setHl} options={[["yo", "Yorùbá"], ["en", "English"]]} /> : null}
        <ReadAloud parts={[title, ...vs]} lang={use} />
        {h.category ? <Text style={{ color: C.red, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>{h.category}</Text> : null}
        <Text style={{ fontFamily: serif, fontSize: 24 * size, fontWeight: "700", color: C.deep }}>{title}</Text>
        {h.scripture ? <Text style={{ fontFamily: serif, fontStyle: "italic", color: C.muted, fontSize: 15 * size, lineHeight: 22 * size }}>{h.scripture}</Text> : null}
        {vs.map((v, i) => {
          const chorus = /^(chorus|ègbè|egbe|refrain)/i.test(v);
          if (!chorus) n += 1;
          return (
            <View key={i} style={{ flexDirection: "row", gap: 12, paddingLeft: chorus ? 22 * size : 0 }}>
              {!chorus ? <Text style={{ color: C.red, fontWeight: "800", fontSize: 15 * size, width: 22 * size }}>{n}</Text> : null}
              <Text style={{ flex: 1, fontFamily: serif, fontSize: 18 * size, lineHeight: 29 * size, color: C.ink, fontStyle: chorus ? "italic" : "normal" }}>{v}</Text>
            </View>
          );
        })}
        {h.tune ? <Text style={{ color: C.muted, fontSize: 12 }}>{h.tune}</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
        <Nav label={prev ? hymnLabel(prev) : ""} icon="chevron-left" disabled={!prev} onPress={() => prev && router.replace(`/hymns/${hymnId(prev)}`)} />
        <View style={{ width: 1, backgroundColor: C.line }} />
        <Nav label={next ? hymnLabel(next) : ""} icon="chevron-right" right disabled={!next} onPress={() => next && router.replace(`/hymns/${hymnId(next)}`)} />
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
