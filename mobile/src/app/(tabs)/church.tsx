import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { getEventReminders, setEventReminder } from "@/lib/reminder";
import { coverUrl } from "@/components/Cover";
import { Body, Card, Icon, Pill, Screen, Segments, Title } from "@/components/ui";
import { useApp } from "@/lib/app";
import { getCached, setCached } from "@/lib/cache";
import { longDate, monthName } from "@/lib/dates";
import { parseRefs } from "@/lib/bibleBooks";
import { router } from "expo-router";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";
import { serif } from "@/lib/theme";

type Event = { id: string; date: string; end_date: string | null; title_en: string; title_yo: string; place: string; kind: string; texts?: string };
type Church = { id: string; district_id: string; name: string; town: string; address: string; prophet: string; phone: string; sort: number; is_hq?: boolean; map_url?: string };
type Officer = { id: string; role: string; name: string; phone: string; sort: number };
type District = { id: string; name: string; sort: number; kind?: string; admin_hq?: string; state?: string; churches: Church[]; district_officers?: Officer[] };
type Council = { id: string; post: string; name: string; sort: number };
type Baba = { id: string; name: string; years: string; photo_path: string | null; sort: number; role?: "baba" | "secretary" };

type Tab = "calendar" | "districts" | "leaders";
type Who = "council" | "babas" | "secretaries";

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
  // Older links used tab=babas; it now opens Leaders > Baba Aladura.
  const params = useLocalSearchParams<{ tab?: string; who?: Who }>();
  const fromParams = (): [Tab, Who] => {
    if (params.tab === "babas") return ["leaders", "babas"];
    if (params.tab === "secretaries") return ["leaders", "secretaries"];
    const tb = (["calendar", "districts", "leaders"] as Tab[]).find((x) => x === params.tab) ?? "calendar";
    return [tb, params.who ?? "council"];
  };
  const [tab, setTab] = useState<Tab>(fromParams()[0]);
  const [who, setWho] = useState<Who>(fromParams()[1]);
  useEffect(() => {
    if (!params.tab) return;
    const [tb, w] = fromParams();
    setTab(tb);
    setWho(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab, params.who]);
  return (
    <Screen>
      <Title>{t("tabChurch")}</Title>
      <Segments<Tab> value={tab} onChange={setTab} options={[["calendar", t("calendar")], ["districts", t("districts")], ["leaders", t("leaders")]]} />
      {tab === "calendar" && <Calendar />}
      {tab === "districts" && <Districts />}
      {tab === "leaders" && (
        <>
          <Segments<Who> value={who} onChange={setWho} options={[["council", t("councilShort")], ["babas", t("babaAladura")], ["secretaries", t("secretariesShort")]]} />
          {who === "council" && <Leaders />}
          {who === "babas" && <Babas role="baba" />}
          {who === "secretaries" && <Babas role="secretary" />}
        </>
      )}
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
            {e.texts ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {e.texts.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
                  const r = parseRefs(x)[0];
                  return (
                    <Pressable
                      key={x}
                      disabled={!r}
                      onPress={() => r && router.push(`/bible/${r.book.code}/${r.chapter}?${r.from ? `v=${r.from}&to=${r.to}&` : ""}l=${lang}`)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.soft }}
                    >
                      <Icon name="book-open-variant" size={14} />
                      <Text style={{ color: C.brand, fontWeight: "700", fontSize: 13 }}>{r ? `${lang === "yo" ? r.book.yo : r.book.en} ${r.chapter}${r.from ? `:${r.from}${r.to && r.to !== r.from ? `-${r.to}` : ""}` : ""}` : x}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
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

const mapSearch = (parts: (string | undefined)[]) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(", "))}`;

/**
 * Google Maps: the link the office saved, or a search for the church.
 * A headquarters church with no address of its own uses the district's headquarters address.
 */
function directions(c: Church, d?: District) {
  if (c.map_url) return c.map_url;
  const where = c.address || (c.is_hq ? d?.admin_hq : "");
  return mapSearch([c.name, where, c.town, d?.state, d?.kind === "annex" ? "" : "Nigeria"]);
}

/** A clear "Directions" button that opens Google Maps. */
function MapButton({ url }: { url: string }) {
  const { t } = useApp();
  const C = useColors();
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.soft, opacity: pressed ? 0.8 : 1 })}>
      <Icon name="google-maps" size={18} />
      <Text style={{ color: C.brand, fontWeight: "700" }}>{t("directions")}</Text>
    </Pressable>
  );
}

function ChurchRow({ c, hq, d }: { c: Church; hq?: boolean; d?: District }) {
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
        <MapButton url={directions(c, d)} />
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
    supabase.from("districts").select("*, churches(*), district_officers(*)").order("name"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noDistricts")}</Body>;
  const term = q.trim().toLowerCase();
  const found = term
    ? rows.flatMap((d) => (d.churches ?? []).filter((c) => `${c.name} ${c.town} ${c.address} ${c.prophet} ${d.name}`.toLowerCase().includes(term)).map((c) => ({ c, d })))
    : [];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="magnify" color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t("findChurch")} placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 46, fontSize: 16, color: C.ink }} />
      </View>
      {term ? (
        found.length ? <Card>{found.map(({ c, d }) => <ChurchRow key={c.id} c={c} hq={c.is_hq} d={d} />)}</Card> : <Body muted>{t("noResults")}</Body>
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
                {d.state ? <Text style={{ color: C.muted, fontSize: 13 }}>{d.kind === "annex" ? `${t("annex")} · ` : ""}{d.state}</Text> : null}
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
            {isOpen && d.admin_hq ? (
              <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 6, alignItems: "flex-start" }}>
                <Text style={{ color: C.ink }}>
                  <Text style={{ fontWeight: "700" }}>{t("headquarters")}: </Text>{d.admin_hq}
                </Text>
                <MapButton url={hq?.map_url || mapSearch([d.admin_hq, d.state, d.kind === "annex" ? "" : "Nigeria"])} />
              </View>
            ) : null}
            {isOpen && (d.district_officers?.length ?? 0) > 0 ? <Officers list={d.district_officers!} /> : null}
            {isOpen && churches.map((c) => <ChurchRow key={c.id} c={c} hq={c.is_hq} d={d} />)}
          </Card>
        );
      })}
    </View>
  );
}

function Officers({ list }: { list: Officer[] }) {
  const { t } = useApp();
  const C = useColors();
  const [show, setShow] = useState(false);
  const sorted = [...list].sort((a, b) => a.sort - b.sort);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 6 }}>
      <Pressable onPress={() => setShow(!show)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="account-tie" size={20} />
        <Text style={{ flex: 1, color: C.brand, fontWeight: "700" }}>{t("officers")} ({sorted.length})</Text>
        <Icon name={show ? "chevron-up" : "chevron-down"} color={C.muted} />
      </Pressable>
      {show && sorted.map((o) => (
        <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>{o.role}</Text>
            <Text style={{ color: C.ink, fontWeight: "600" }}>{o.name || "-"}</Text>
          </View>
          {o.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${o.phone.split(",")[0].replace(/\s/g, "")}`)} hitSlop={8} style={{ padding: 6 }}>
              <Icon name="phone" size={20} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Leaders() {
  const { t } = useApp();
  const C = useColors();
  const rows = useList<Council>("council", () => supabase.from("council_members").select("*").order("sort"));
  if (!rows) return <Body muted>{t("loading")}</Body>;
  if (!rows.length) return <Body muted>{t("noBabas")}</Body>;
  return (
    <Card>
      <Text style={{ fontFamily: serif, fontSize: 18, fontWeight: "700", color: C.deep }}>{t("council")}</Text>
      {rows.map((r, i) => (
        <View key={r.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.line, paddingVertical: 8 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>{r.post}</Text>
          <Text style={{ color: C.ink, fontWeight: "600", fontSize: 15 }}>{r.name || "-"}</Text>
        </View>
      ))}
    </Card>
  );
}

function Babas({ role }: { role: "baba" | "secretary" }) {
  const { t } = useApp();
  const C = useColors();
  const all = useList<Baba>("babas", () => supabase.from("baba_aladura").select("*").order("sort"));
  if (!all) return <Body muted>{t("loading")}</Body>;
  const rows = all.filter((b) => (b.role ?? "baba") === role);
  if (!rows.length) return <Body muted>{t("noBabas")}</Body>;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: serif, fontSize: 18, fontWeight: "700", color: C.deep }}>{role === "baba" ? t("babaAladura") : t("secretaries")}</Text>
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
