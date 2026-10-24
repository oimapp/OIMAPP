import React, { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Body, Button, Card, Notice, Pill, Segments, SubScreen, Toggle } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getCached, setCached } from "@/lib/cache";
import { longDate } from "@/lib/dates";
import { StringKey } from "@/lib/i18n";
import { useColors } from "@/lib/prefs";
import { errorCode, supabase } from "@/lib/supabase";
import { serif } from "@/lib/theme";

type Req = { id: string; user_id: string; kind: "prayer" | "testimony"; body: string; display_name: string; status: string; created_at: string };
type Tab = "send" | "testimonies";

const STATUS: Record<string, StringKey> = { new: "statusNew", prayed: "statusPrayed", approved: "statusApproved", hidden: "statusHidden" };

export default function Prayer() {
  const { t, lang, userId, profile } = useApp();
  const C = useColors();
  const [tab, setTab] = useState<Tab>("send");
  const [kind, setKind] = useState<"prayer" | "testimony">("prayer");
  const [body, setBody] = useState("");
  const [showName, setShowName] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [rows, setRows] = useState<Req[]>([]);

  const load = useCallback(async () => {
    const cached = await getCached<Req[]>("prayer_rows");
    if (cached) setRows(cached);
    const { data } = await supabase.from("prayer_requests").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) {
      setRows(data as Req[]);
      await setCached("prayer_rows", data);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    setMsg(null);
    if (body.trim().length < 3 || !userId) return;
    setBusy(true);
    const firstName = (profile?.full_name ?? "").trim();
    const { error } = await supabase.from("prayer_requests").insert({
      user_id: userId, kind, body: body.trim(),
      display_name: kind === "testimony" && showName ? firstName : "",
    });
    setBusy(false);
    if (error) return setMsg({ text: errorCode(error) === "offline" ? t("offline") : t("somethingWrong"), tone: "error" });
    setBody("");
    setMsg({ text: t("sent"), tone: "ok" });
    void load();
  };

  const mine = rows.filter((r) => r.user_id === userId);
  const shared = rows.filter((r) => r.kind === "testimony" && r.status === "approved");

  return (
    <SubScreen title={t("prayerTitle")}>
      <Segments<Tab> value={tab} onChange={setTab} options={[["send", t("send")], ["testimonies", t("testimonies")]]} />
      {tab === "send" ? (
        <>
          <Segments<"prayer" | "testimony"> value={kind} onChange={setKind} options={[["prayer", t("prayerRequest")], ["testimony", t("testimony")]]} />
          <Body muted>{kind === "prayer" ? t("prayerHint") : t("testimonyHint")}</Body>
          {msg && <Notice text={msg.text} tone={msg.tone} />}
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            placeholder={t("writeHere")}
            placeholderTextColor={C.muted}
            textAlignVertical="top"
            style={{ minHeight: 140, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 23, color: C.ink, backgroundColor: C.card }}
          />
          {kind === "testimony" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ flex: 1, color: C.ink }}>{t("showMyName")}</Text>
              <Toggle value={showName} onChange={setShowName} />
            </View>
          )}
          <Button title={t("send")} onPress={send} busy={busy} disabled={body.trim().length < 3} />
          {mine.length > 0 && <Text style={{ fontWeight: "700", color: C.ink, fontSize: 17, marginTop: 8 }}>{t("mySubmissions")}</Text>}
          {mine.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Text style={{ color: C.red, fontWeight: "700", fontSize: 13, flex: 1 }}>
                  {r.kind === "prayer" ? t("prayerRequest") : t("testimony")} · {longDate(r.created_at.slice(0, 10), lang, false)}
                </Text>
                <Pill text={t(STATUS[r.status] ?? "statusNew")} tone={r.status === "approved" || r.status === "prayed" ? "green" : "muted"} />
              </View>
              <Body>{r.body}</Body>
            </Card>
          ))}
        </>
      ) : shared.length === 0 ? (
        <Card><Body muted>{t("noTestimonies")}</Body></Card>
      ) : (
        shared.map((r) => (
          <Card key={r.id}>
            <Text style={{ color: C.muted, fontSize: 13 }}>{r.display_name || t("aMember")} · {longDate(r.created_at.slice(0, 10), lang, false)}</Text>
            <Text style={{ fontFamily: serif, color: C.ink, fontSize: 17, lineHeight: 26 }}>{r.body}</Text>
          </Card>
        ))
      )}
    </SubScreen>
  );
}
