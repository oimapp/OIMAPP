import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Body, Button, Card, Field, Notice, SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";
import { longDate, nextSunday, todayISO } from "@/lib/dates";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";

type Student = { id: string; name: string; phone: string; active: boolean };
type Mark = { student_id: string; date: string; present: boolean };

/** The Sunday on or before today, and the five before it. */
function recentSundays() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() - i * 7);
    return todayISO(x);
  });
}

export default function ClassPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useApp();
  const C = useColors();
  const [name, setName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [newName, setNewName] = useState("");
  const sundays = useMemo(() => {
    const s = recentSundays();
    const up = nextSunday(todayISO());
    return s.includes(up) ? s : [up, ...s];
  }, []);
  const [date, setDate] = useState(sundays[0]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: a }] = await Promise.all([
      supabase.from("classes").select("name").eq("id", id).maybeSingle(),
      supabase.from("class_students").select("id, name, phone, active").eq("class_id", id).eq("active", true).order("name"),
      supabase.from("attendance").select("student_id, date, present").eq("class_id", id),
    ]);
    setName(c?.name ?? "");
    setStudents((s as Student[]) ?? []);
    setMarks((a as Mark[]) ?? []);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const d: Record<string, boolean> = {};
    for (const m of marks.filter((x) => x.date === date)) d[m.student_id] = m.present;
    setDraft(d);
    setMsg("");
  }, [date, marks]);

  const addStudent = async () => {
    if (!newName.trim()) return;
    await supabase.from("class_students").insert({ class_id: id, name: newName.trim() });
    setNewName("");
    void load();
  };

  const remove = (s: Student) =>
    Alert.alert(t("removeStudent"), s.name, [
      { text: t("cancel"), style: "cancel" },
      { text: t("removeStudent"), style: "destructive", onPress: () => void supabase.from("class_students").update({ active: false }).eq("id", s.id).then(() => load()) },
    ]);

  const save = async () => {
    const rows = students.map((s) => ({ class_id: id, student_id: s.id, date, present: !!draft[s.id] }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    setMsg(error ? t("somethingWrong") : t("registerSaved"));
    if (!error) void load();
  };

  const presentCount = students.filter((s) => draft[s.id]).length;
  const totalFor = (sid: string) => marks.filter((m) => m.student_id === sid && m.present).length;

  return (
    <SubScreen title={name || t("register")}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: C.ink }}>{t("register")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {sundays.map((d) => (
          <Pressable key={d} onPress={() => setDate(d)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: date === d ? C.brand : C.line, backgroundColor: date === d ? C.soft : C.card }}>
            <Text style={{ color: date === d ? C.brand : C.ink, fontWeight: "700" }}>{longDate(d, lang, false)}</Text>
          </Pressable>
        ))}
      </View>
      {msg ? <Notice tone={msg === t("registerSaved") ? "ok" : "error"} text={msg} /> : null}
      {students.length === 0 ? <Card><Body muted>{t("noStudents")}</Body></Card> : (
        <Card>
          <Text style={{ color: C.muted }}>{t("attendanceCount", { p: presentCount, t: students.length })}</Text>
          {students.map((s) => (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <Pressable onLongPress={() => remove(s)} style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: C.ink, fontWeight: "600" }}>{s.name}</Text>
                <Text style={{ fontSize: 12, color: C.muted }}>{t("present")}: {totalFor(s.id)}</Text>
              </Pressable>
              {([true, false] as const).map((v) => (
                <Pressable
                  key={String(v)}
                  onPress={() => setDraft({ ...draft, [s.id]: v })}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: draft[s.id] === v ? (v ? C.green : C.red) : C.paper }}
                >
                  <Text style={{ color: draft[s.id] === v ? "#FFFFFF" : C.muted, fontWeight: "700" }}>{v ? t("present") : t("absent")}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Button title={t("saveRegister")} onPress={save} />
        </Card>
      )}
      <Card>
        <Text style={{ fontWeight: "700", color: C.ink }}>{t("addStudent")}</Text>
        <Field label="" placeholder={t("studentName")} value={newName} onChangeText={setNewName} />
        <Button kind="outline" title={t("addStudent")} onPress={addStudent} disabled={!newName.trim()} />
      </Card>
    </SubScreen>
  );
}
