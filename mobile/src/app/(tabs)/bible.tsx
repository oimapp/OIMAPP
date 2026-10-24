import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Body, Card, Icon, Kicker, Screen, Segments, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { BIBLE_CREDIT } from "@/lib/bible";
import { BIBLE_BOOKS, BookInfo, NEW_TESTAMENT, OLD_TESTAMENT } from "@/lib/bibleBooks";
import { getCached, setCached } from "@/lib/cache";
import { Lang } from "@/lib/i18n";
import { useColors } from "@/lib/prefs";
import { serif } from "@/lib/theme";

export type BibleLast = { code: string; chapter: number };

export async function getBibleLang(fallback: Lang) {
  return (await getCached<Lang>("bible_lang")) ?? fallback;
}

export default function BibleTab() {
  const { t, lang } = useApp();
  const C = useColors();
  const [bl, setBl] = useState<Lang>(lang);
  const [part, setPart] = useState<"ot" | "nt">("ot");
  const [open, setOpen] = useState<string | null>(null);
  const [last, setLast] = useState<BibleLast | null>(null);

  useEffect(() => { void getBibleLang(lang).then(setBl); }, [lang]);
  useFocusEffect(useCallback(() => { void getCached<BibleLast>("bible_last").then(setLast); }, []));

  const changeLang = (l: Lang) => { setBl(l); void setCached("bible_lang", l); };
  const name = (b: BookInfo) => (bl === "yo" ? b.yo : b.en);
  const lastBook = last ? BIBLE_BOOKS.find((b) => b.code === last.code) : null;
  const list = part === "ot" ? OLD_TESTAMENT : NEW_TESTAMENT;

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}><Title>{t("tabBible")}</Title></View>
        <Pressable onPress={() => router.push("/bible/search")} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="magnify" size={26} color={C.deep} />
        </Pressable>
      </View>
      <Segments<Lang> value={bl} onChange={changeLang} options={[["yo", "Yorùbá"], ["en", "English (KJV)"]]} />

      {last && lastBook ? (
        <Card style={{ backgroundColor: C.hero, borderColor: C.hero }} onPress={() => router.push(`/bible/${last.code}/${last.chapter}`)}>
          <Kicker color="#F3C6CD">{t("continueReading")}</Kicker>
          <Text style={{ fontFamily: serif, color: C.heroText, fontSize: 20, fontWeight: "700" }}>{name(lastBook)} {last.chapter}</Text>
        </Card>
      ) : null}

      <Segments<"ot" | "nt"> value={part} onChange={setPart} options={[["ot", t("oldTestament")], ["nt", t("newTestament")]]} />

      <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line }}>
        {list.map((b, i) => (
          <View key={b.code} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : undefined}>
            <Pressable onPress={() => setOpen(open === b.code ? null : b.code)} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text style={{ flex: 1, fontSize: 16, color: C.ink, fontWeight: "600" }}>{name(b)}</Text>
              <Text style={{ color: C.muted, marginRight: 6 }}>{b.chapters}</Text>
              <Icon name={open === b.code ? "chevron-up" : "chevron-down"} color={C.muted} />
            </Pressable>
            {open === b.code && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
                {Array.from({ length: b.chapters }, (_, c) => (
                  <Pressable
                    key={c}
                    onPress={() => router.push(`/bible/${b.code}/${c + 1}`)}
                    style={{ width: 48, height: 44, borderRadius: 10, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: C.brand, fontWeight: "700" }}>{c + 1}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
      <Body muted style={{ fontSize: 12, lineHeight: 17 }}>{BIBLE_CREDIT.en} {BIBLE_CREDIT.yo}</Body>
    </Screen>
  );
}
