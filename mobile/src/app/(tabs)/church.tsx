import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { getEventReminders, setEventReminder } from "@/lib/reminder";
import { coverUrl } from "@/components/Cover";
import { Body, Card, Icon, Pill, Screen, Segments, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getCached, setCached } from "@/lib/cache";
import { longDate, monthName } from "@/lib/dates";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";
import { serif } from "@/lib/theme";

type Event = { id: string; date: string; end_date: string | null; title_en: string; title_yo: string; place: string; kind: string };
type Church = { id: string; district_id: string; name: string; town: string; address: string; prophet: string; phone: string; sort: number; is_hq?: boolean; map_url?: string };
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
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? "calendar");
  useEffect(() => { if (params.tab) setTab(params.tab); }, [params.tab]);
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
  const C = useColors();
  const rows = useList<Event>("events", () => supabase.from("events").select("*").order("date"));
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  useEffect(() => { void getEventReminders().then(setReminded); }, []);
  const toggle = async (e: Event) => {
    const on = !reminded.has(e.id);
    const ok = await setEventReminder({ id: e.id, date: e.date, title: (lang === "yo" && e.title_yo) || e.title_en }, on, lang);
    if (ok) setReminded(await getEventReminders());
  };
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
            {e.date >= new Date().toISOString().slice(0, 10) ? (
              <Pressable onPress={() => void toggle(e)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: reminded.has(e.id) ? C.greenSoft : C.paper }}>
                <Icon name={reminded.has(e.id) ? "bell-check" : "bell-outline"} size={18} color={reminded.has(e.id) ? C.green : C.brand} />
                <Text style={{ color: reminded.has(e.id) ? C.green : C.brand, fontWeight: "700" }}>{reminded.has(e.id) ? t("reminderSet") : t("remindMe")}</Text>
              </Pressable>
            ) : null}
          </Card>
        </View>
      ))}
    </View>
  );
}

/** Google Maps: the link the office saved, or a search for the church's name and address. */
function directions(c: Church) {
  if (c.map_url) return c.map_url;
  const q = [c.name, c.address, c.town, "Nigeria"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function ChurchRow({ c, hq }: { c: Church; hq?: boolean }) {
  const { t } = useApp();
  const C = useColors();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink, flexShrink: 1 }}>{c.name}</Text>
        {hq ? <Pill text={t("hq")} tone="red" /> : null}
      </View>
      {(c.address || c.town) ? <Text style={{ color: C.muted }}>{[c.address, c.town].filter(Boolean).join(", ")}</Text> : null}
      {c.prophet ? <Text style={{ color: C.ink }}>{t("prophet")}: {c.prophet}</Text> : null}
      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
        {c.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s/g, "")}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="phone" size={18} />
            <Text style={{ color: C.brand, fontWeight: "700" }}>{t("call")} {c.phone}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => Linking.openURL(directions(c))} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="map-marker-path" size={18} />
          <Text style={{ color: C.brand, fontWeight: "700" }}>{t("directions")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Districts() {
  const { t } = useApp();
  const C = useColors();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows = useList<District>("districts", () =>
    supabase.from("districts").select("*, churches(*)").order("sort").order("name"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noDistricts")}</Body>;
  const term = q.trim().toLowerCase();
  const found = term
    ? rows.flatMap((d) => (d.churches ?? []).filter((c) => `${c.name} ${c.town} ${c.address} ${c.prophet} ${d.name}`.toLowerCase().includes(term)))
    : [];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t("findChurch")} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 46, fontSize: 16, color: C.ink }} />
      </View>
      {term ? (
        found.length ? <Card>{found.map((c) => <ChurchRow key={c.id} c={c} hq={c.is_hq} />)}</Card> : <Body muted>{t("noResults")}</Body>
      ) : rows.map((d) => {
        // The headquarters church comes first, then the rest in order.
        const churches = [...(d.churches ?? [])].sort((a, b) =>
          Number(!!b.is_hq) - Number(!!a.is_hq) || a.sort - b.sort || a.name.localeCompare(b.name));
        const hq = churches.find((c) => c.is_hq);
        const isOpen = open === d.id;
        return (
          <Card key={d.id}>
            <Pressable onPress={() => setOpen(isOpen ? null : d.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: C.deep }}>{d.name}</Text>
                {hq ? (
                  <Text style={{ color: C.ink }}>
                    <Text style={{ color: C.red, fontWeight: "700" }}>{t("headquarters")}: </Text>
                    {hq.name}{hq.town ? `, ${hq.town}` : ""}
                  </Text>
                ) : null}
                <Text style={{ color: C.muted, fontSize: 13 }}>{t("churches", { n: churches.length })}</Text>
              </View>
              <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={26} color={C.muted} />
            </Pressable>
            {isOpen && churches.map((c) => <ChurchRow key={c.id} c={c} hq={c.is_hq} />)}
          </Card>
        );
      })}
    </View>
  );
}

function Babas() {
  const { t } = useApp();
  const C = useColors();
  const rows = useList<Baba>("babas", () => supabase.from("baba_aladura").select("*").order("sort"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noBabas")}</Body>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((b) => {
        const uri = coverUrl(b.photo_path);
        return (
          <Card key={b.id} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            {uri ? (
              <Image source={{ uri }} style={{ width: 64, height: 84, borderRadius: 8, backgroundColor: C.soft }} />
            ) : (
              <View style={{ width: 64, height: 84, borderRadius: 8, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}>
                <Icon name="account" size={34} />
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
