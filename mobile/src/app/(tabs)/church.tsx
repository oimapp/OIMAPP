import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { Body, Card, Screen, Segments, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getCached, setCached } from "@/lib/cache";
import { longDate, monthName } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import { C, serif } from "@/lib/theme";

type Event = { id: string; date: string; end_date: string | null; title_en: string; title_yo: string; place: string; kind: string };
type Church = { id: string; district_id: string; name: string; town: string; address: string; prophet: string; phone: string; sort: number };
type District = { id: string; name: string; sort: number; churches: Church[] };
type Baba = { id: string; name: string; years: string; photo_path: string | null; sort: number };

type Tab = "calendar" | "districts" | "babas";

/** Read a free list from the server, falling back to the copy saved on the phone. */
function useList<T>(name: string, load: () => PromiseLike<{ data: T[] | null }>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const refresh = useCallback(async () => {
    const cached = await getCached<T[]>(name);
    if (cached) setRows(cached);
    try {
      const { data } = await load();
      if (data) {
        setRows(data);
        await setCached(name, data);
      }
    } catch {
      // offline: keep the saved copy
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  useEffect(() => { void refresh(); }, [refresh]);
  return rows;
}

export default function ChurchTab() {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>("calendar");
  return (
    <Screen>
      <Title>{t("tabChurch")}</Title>
      <Segments<Tab> value={tab} onChange={setTab} options={[["calendar", t("calendar")], ["districts", t("districts")], ["babas", t("babaAladura")]]} />
      {tab === "calendar" && <Calendar />}
      {tab === "districts" && <Districts />}
      {tab === "babas" && <Babas />}
    </Screen>
  );
}

function Calendar() {
  const { t, lang } = useApp();
  const rows = useList<Event>("events", () => supabase.from("events").select("*").order("date"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noEvents")}</Body>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((e, i) => (
        <View key={e.id} style={{ gap: 8 }}>
          {(i === 0 || rows[i - 1].date.slice(0, 7) !== e.date.slice(0, 7)) && (
            <Text style={{ marginTop: i ? 10 : 0, fontWeight: "800", color: C.red, textTransform: "uppercase", fontSize: 12 }}>
              {monthName(e.date, lang)}
            </Text>
          )}
          <Card>
            <Text style={{ color: C.brand, fontWeight: "700" }}>
              {longDate(e.date, lang)}{e.end_date && e.end_date !== e.date ? ` – ${longDate(e.end_date, lang)}` : ""}
            </Text>
            <Text style={{ fontFamily: serif, fontSize: 18, fontWeight: "700", color: C.deep }}>
              {(lang === "yo" && e.title_yo) || e.title_en}
            </Text>
            {e.place ? <Body muted>{e.place}</Body> : null}
          </Card>
        </View>
      ))}
    </View>
  );
}

function Districts() {
  const { t } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const rows = useList<District>("districts", () =>
    supabase.from("districts").select("*, churches(*)").order("sort").order("name"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noDistricts")}</Body>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((d) => {
        const churches = [...(d.churches ?? [])].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
        const isOpen = open === d.id;
        return (
          <Card key={d.id}>
            <Pressable onPress={() => setOpen(isOpen ? null : d.id)} style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: C.deep }}>{d.name}</Text>
                <Text style={{ color: C.muted }}>{t("churches", { n: churches.length })}</Text>
              </View>
              <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={26} color={C.muted} />
            </Pressable>
            {isOpen && churches.map((c) => (
              <View key={c.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 3 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink }}>{c.name}</Text>
                {(c.address || c.town) ? <Text style={{ color: C.muted }}>{[c.address, c.town].filter(Boolean).join(", ")}</Text> : null}
                {c.prophet ? <Text style={{ color: C.ink }}>{t("prophet")}: {c.prophet}</Text> : null}
                {c.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s/g, "")}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <MaterialCommunityIcons name="phone" size={18} color={C.brand} />
                    <Text style={{ color: C.brand, fontWeight: "700" }}>{t("call")} {c.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

function Babas() {
  const { t } = useApp();
  const rows = useList<Baba>("babas", () => supabase.from("baba_aladura").select("*").order("sort"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noBabas")}</Body>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((b) => {
        const uri = b.photo_path ? supabase.storage.from("public").getPublicUrl(b.photo_path).data.publicUrl : null;
        return (
          <Card key={b.id} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            {uri ? (
              <Image source={{ uri }} style={{ width: 64, height: 84, borderRadius: 8, backgroundColor: C.soft }} />
            ) : (
              <View style={{ width: 64, height: 84, borderRadius: 8, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="account" size={34} color={C.brand} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: serif, fontSize: 17, fontWeight: "700", color: C.deep }}>{b.name}</Text>
              {b.years ? <Text style={{ color: C.muted }}>{b.years}</Text> : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
