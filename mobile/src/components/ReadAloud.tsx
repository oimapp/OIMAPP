// "Listen" bar for lessons, daily readings, Bible chapters and hymns.
// 1. If the office has uploaded a recorded reading (admin > lesson > Audio), that plays.
// 2. Otherwise the phone's own reading voice reads the text aloud (English always;
//    Yoruba only if the phone has a Yoruba voice installed).

import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "@/lib/app";
import type { Lang } from "@/lib/i18n";
import { useColors } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";
import { Icon } from "./ui";

const RATES = [0.8, 1, 1.2];
const LANG_CODE: Record<Lang, string> = { en: "en-GB", yo: "yo-NG" };

let yorubaVoice: string | null | undefined;
async function findYorubaVoice() {
  if (yorubaVoice !== undefined) return yorubaVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    yorubaVoice = voices.find((v) => v.language?.toLowerCase().startsWith("yo"))?.identifier ?? null;
  } catch {
    yorubaVoice = null;
  }
  return yorubaVoice;
}

/** Split long text into pieces the phone's voice can read (Android has a size limit). */
function pieces(parts: string[]) {
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (p.length < 3000) { out.push(p); continue; }
    let rest = p;
    while (rest.length > 3000) {
      const cut = Math.max(rest.lastIndexOf(". ", 3000), 1000);
      out.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    out.push(rest);
  }
  return out;
}

export function ReadAloud({ parts, lang, recorded }: {
  parts: string[];                      // the text, in reading order
  lang: Lang;
  recorded?: { bookId: string; key: string }; // look for an uploaded recording
}) {
  const { t, online } = useApp();
  const C = useColors();
  const [state, setState] = useState<"idle" | "speaking">("idle");
  const [rate, setRate] = useState(1);
  const [noVoice, setNoVoice] = useState(false);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const index = useRef(0);
  const list = useRef<string[]>([]);
  const alive = useRef(true);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Find a recorded reading for this lesson/day in this language.
  useEffect(() => {
    setTrackUrl(null);
    if (!recorded || !online) return;
    let stop = false;
    void (async () => {
      const { data } = await supabase.from("audio_tracks").select("path")
        .eq("book_id", recorded.bookId).eq("item_key", recorded.key).eq("lang", lang).maybeSingle();
      if (!data?.path || stop) return;
      const { data: signed } = await supabase.storage.from("audio").createSignedUrl(data.path, 60 * 60 * 3);
      if (signed?.signedUrl && !stop) setTrackUrl(signed.signedUrl);
    })().catch(() => undefined);
    return () => { stop = true; };
  }, [recorded?.bookId, recorded?.key, lang, online]);

  useEffect(() => {
    if (trackUrl) player.replace({ uri: trackUrl });
  }, [trackUrl, player]);

  // Stop talking when leaving the page or changing language.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; void Speech.stop(); };
  }, []);
  useEffect(() => { void Speech.stop(); setState("idle"); setNoVoice(false); }, [lang, parts.join("|").length]);

  const speakFrom = async (i: number, r = rate) => {
    const voice = lang === "yo" ? await findYorubaVoice() : undefined;
    if (lang === "yo" && !voice) { setNoVoice(true); return; }
    list.current = pieces(parts);
    index.current = i;
    const next = () => {
      if (!alive.current) return;
      if (index.current >= list.current.length) { setState("idle"); index.current = 0; return; }
      Speech.speak(list.current[index.current], {
        language: LANG_CODE[lang], voice: voice ?? undefined, rate: r,
        onDone: () => { index.current += 1; next(); },
        onStopped: () => setState("idle"),
        onError: () => setState("idle"),
      });
    };
    setState("speaking");
    next();
  };

  const stopSpeaking = async () => { await Speech.stop(); setState("idle"); };

  const changeRate = async () => {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(r);
    if (trackUrl) player.setPlaybackRate(r);
    else if (state === "speaking") { await Speech.stop(); void speakFrom(index.current, r); }
  };

  const recordedMode = !!trackUrl;
  const playing = recordedMode ? status.playing : state === "speaking";
  const toggle = () => {
    if (recordedMode) {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.5)) void player.seekTo(0);
        player.play();
      }
    } else if (playing) void stopSpeaking();
    else void speakFrom(index.current);
  };

  const mins = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <View style={{ backgroundColor: C.soft, borderRadius: 14, padding: 10, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={toggle} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
          <Icon name={playing ? (recordedMode ? "pause" : "stop") : "play"} size={26} color={C.onBrand} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.deep, fontWeight: "700" }}>{playing ? t("listening") : t("listen")}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {recordedMode ? `${t("recordedReading")} · ${mins(status.currentTime)} / ${mins(status.duration || 0)}` : t("phoneVoice")}
          </Text>
        </View>
        <Pressable onPress={changeRate} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.card }}>
          <Text style={{ color: C.brand, fontWeight: "800" }}>{rate}×</Text>
        </Pressable>
        {!recordedMode && index.current > 0 && !playing ? (
          <Pressable onPress={() => { index.current = 0; }} hitSlop={8} style={{ padding: 6 }}>
            <Icon name="restart" size={22} />
          </Pressable>
        ) : null}
      </View>
      {noVoice ? <Text style={{ color: C.red, fontSize: 13 }}>{t("noYorubaVoice")}</Text> : null}
    </View>
  );
}
