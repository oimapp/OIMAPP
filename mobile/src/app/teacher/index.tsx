import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Body, Button, Card, Field, Icon, Notice, Segments, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { bookTitle } from "@/lib/books";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";

type Klass = { id: string; name: string; book_id: string | null; class_students: { count: number }[] };

export default function TeacherArea() {
  const { t, lang, userId, catalogue, profile } = useApp();
  const C = useColors();
  const [classes, setClasses] = useState<Klass[] | null>(null);
  const [name, setName] = useState("");
  const manuals = catalogue.books.filter((b) => b.kind === "manual" || b.kind === "children");
  const [book, setBook] = useState<string>(manuals[0]?.id ?? "");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("classes").select("id, name, book_id, class_students(count)").order("created_at");
    if (error) setErr(t("offline"));
    else setClasses(data as Klass[]);
  }, [t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!profile?.is_teacher) {
    return <SubScreen title={t("teacherArea")}><Card><Body muted>{t("noGuide")}</Body></Card></SubScreen>;
  }

  const add = async () => {
    if (!name.trim() || !userId) return;
    const { error } = await supabase.from("classes").insert({ teacher_id: userId, name: name.trim(), book_id: book || null });
    if (error) return setErr(t("somethingWrong"));
    setName("");
    void load();
  };

  return (
    <SubScreen title={t("teacherArea")}>
      {err ? <Notice tone="error" text={err} /> : null}
      <Text style={{ fontSize: 18, fontWeight: "700", color: C.ink }}>{t("myClasses")}</Text>
      {classes && classes.length === 0 && <Card><Body muted>{t("noClasses")}</Body></Card>}
      {(classes ?? []).map((c) => {
        const b = catalogue.books.find((x) => x.id === c.book_id);
        return (
          <Card key={c.id} onPress={() => router.push(`/teacher/${c.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name="account-group" size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: C.ink }}>{c.name}</Text>
              <Text style={{ color: C.muted }}>{b ? bookTitle(b, lang) : ""} · {c.class_students?.[0]?.count ?? 0} {t("students").toLowerCase()}</Text>
            </View>
            <Icon name="chevron-right" color={C.muted} />
          </Card>
        );
      })}
      <Card>
        <Text style={{ fontWeight: "700", color: C.ink }}>{t("newClass")}</Text>
        <Field label="" placeholder={t("className")} value={name} onChangeText={setName} />
        {manuals.length > 1 && (
          <Segments<string> value={book} onChange={setBook} options={manuals.map((m) => [m.id, bookTitle(m, lang).replace(/ \d{4}$/, "")] as [string, string])} />
        )}
        <Button title={t("addClass")} onPress={add} disabled={!name.trim()} />
      </Card>
    </SubScreen>
  );
}
