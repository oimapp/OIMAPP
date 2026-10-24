// Draws a lesson or a day's reading from the book content.

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { parseRefs } from "@/lib/bibleBooks";
import { useColors } from "@/lib/prefs";
import type { Block, Part } from "@/lib/vault";
import { Colors, serif } from "@/lib/theme";

export function PartView({ part, size, labels, lang }: { part: Part; size: number; labels: { memory: string; text: string; open?: string }; lang?: string }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const s = (n: number) => Math.round(n * size);
  let count = 0;
  return (
    <View style={{ gap: s(12) }}>
      {part.name ? <Text style={[styles.kicker, { fontSize: s(13) }]}>{part.name}</Text> : null}
      <Text style={[styles.topic, { fontSize: s(25), lineHeight: s(32) }]}>{part.topic}</Text>
      {part.text ? (
        <View style={styles.textBox}>
          <Text style={[styles.textLabel, { fontSize: s(12) }]}>{labels.text}</Text>
          <Text style={[styles.textRef, { fontSize: s(16) }]}>{part.text}</Text>
          {labels.open ? parseRefs(part.text).map((r, i) => (
            <Pressable
              key={i}
              onPress={() => router.push(`/bible/${r.book.code}/${r.chapter}?${r.from ? `v=${r.from}&to=${r.to}&` : ""}l=${lang ?? ""}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}
            >
              <Text style={{ color: C.brand, fontWeight: "700", textDecorationLine: "underline", fontSize: s(14) }}>
                {labels.open} · {lang === "yo" ? r.book.yo : r.book.en} {r.chapter}{r.from ? `:${r.from}${r.to && r.to !== r.from ? `-${r.to}` : ""}` : ""}
              </Text>
            </Pressable>
          )) : null}
        </View>
      ) : null}
      {part.body.map((b, i) => {
        if (b.t === "li" && b.ordered) count += 1;
        else if (b.t !== "li") count = 0;
        return <BlockView key={i} b={b} s={s} n={count} memoryLabel={labels.memory} styles={styles} C={C} />;
      })}
    </View>
  );
}

function BlockView({ b, s, n, memoryLabel, styles, C }: { b: Block; s: (n: number) => number; n: number; memoryLabel: string; styles: ReturnType<typeof makeStyles>; C: Colors }) {
  const body = { fontSize: s(17), lineHeight: s(27) };
  switch (b.t) {
    case "h":
      return <Text style={[styles.h, { fontSize: s(18), lineHeight: s(24) }]}>{b.x}</Text>;
    case "p":
      return <Text style={[styles.p, body]}>{b.x}</Text>;
    case "li":
      return (
        <View style={{ flexDirection: "row", gap: 10, paddingLeft: 4 }}>
          <Text style={[styles.p, body, { color: C.brand, fontWeight: "700", minWidth: s(20) }]}>{b.ordered ? `${n}.` : "•"}</Text>
          <Text style={[styles.p, body, { flex: 1 }]}>{b.x}</Text>
        </View>
      );
    case "mv":
      return (
        <View style={styles.verse}>
          <Text style={[styles.verseLabel, { fontSize: s(12) }]}>{memoryLabel}</Text>
          <Text style={[styles.verseText, { fontSize: s(18), lineHeight: s(27) }]}>{b.x}</Text>
          {b.ref ? <Text style={[styles.verseRef, { fontSize: s(14) }]}>{b.ref}</Text> : null}
        </View>
      );
    case "lab":
      return (
        <Text style={[styles.p, body]}>
          <Text style={{ fontWeight: "700", color: C.deep }}>{b.k}: </Text>
          {b.x}
        </Text>
      );
    default:
      return null;
  }
}

const makeStyles = (C: Colors) => StyleSheet.create({
  kicker: { color: C.red, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  topic: { fontFamily: serif, fontWeight: "700", color: C.deep },
  textBox: { backgroundColor: C.soft, borderRadius: 12, padding: 12, gap: 2 },
  textLabel: { color: C.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  textRef: { color: C.deep, fontWeight: "700" },
  h: { color: C.deep, fontWeight: "800", marginTop: 6 },
  p: { color: C.ink },
  verse: { borderLeftWidth: 4, borderLeftColor: C.red, backgroundColor: C.redSoft, borderRadius: 10, padding: 14, gap: 6 },
  verseLabel: { color: C.red, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  verseText: { fontFamily: serif, fontStyle: "italic", color: C.ink },
  verseRef: { color: C.red, fontWeight: "700" },
});
