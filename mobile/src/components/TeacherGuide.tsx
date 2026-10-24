// The teaching guide for a lesson. Only teacher accounts (switched on by the admin) can load it.
// It never contains answers to the lesson questions.

import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "@/lib/app";
import { getCached, setCached } from "@/lib/cache";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";
import { Body, Card, Kicker } from "./ui";

type Guide = { aim: string; discussion: string };

export function TeacherGuide({ bookId, n }: { bookId: string; n: number }) {
  const { t, online } = useApp();
  const C = useColors();
  const [g, setG] = useState<Guide | null | undefined>(undefined);

  useEffect(() => {
    const key = `guide:${bookId}:${n}`;
    void getCached<Guide>(key).then((c) => { if (c) setG(c); });
    if (!online) return;
    void supabase.from("teacher_guides").select("aim, discussion").eq("book_id", bookId).eq("n", n).maybeSingle().then(({ data }) => {
      setG((data as Guide) ?? null);
      if (data) void setCached(key, data);
    });
  }, [bookId, n, online]);

  if (g === undefined) return <Body muted>{t("loading")}</Body>;
  if (!g || (!g.aim && !g.discussion)) return <Card><Body muted>{t("noGuide")}</Body></Card>;
  return (
    <View style={{ gap: 12 }}>
      {g.aim ? (
        <Card>
          <Kicker>{t("guideAim")}</Kicker>
          <Body>{g.aim}</Body>
        </Card>
      ) : null}
      {g.discussion ? (
        <Card>
          <Kicker>{t("guidePoints")}</Kicker>
          {g.discussion.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ color: C.brand, fontWeight: "800", fontSize: 16 }}>{i + 1}.</Text>
              <Body style={{ flex: 1 }}>{l.replace(/^[-•]\s*/, "")}</Body>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
