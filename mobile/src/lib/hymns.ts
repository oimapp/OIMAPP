// The C&S Hymn Book, fetched from the server and kept on the phone for offline use.

import { useCallback, useEffect, useState } from "react";
import { getCached, setCached } from "./cache";
import { supabase } from "./supabase";

export type Series = "main" | "akunleko" | "isoji";
export type Hymn = {
  series: Series; number: number; label: string; title_en: string; title_yo: string;
  text_en: string; text_yo: string; category: string; scripture: string; tune: string;
};

/** "main-12" identifies a hymn across the three numbered lists. */
export const hymnId = (h: Pick<Hymn, "series" | "number">) => `${h.series}-${h.number}`;
export const hymnLabel = (h: Pick<Hymn, "series" | "number" | "label">) => h.label || String(h.number);

export function useHymns() {
  const [hymns, setHymns] = useState<Hymn[] | null>(null);
  const load = useCallback(async () => {
    const cached = await getCached<Hymn[]>("hymns");
    if (cached) setHymns(cached);
    const { data, error } = await supabase.from("hymns").select("series, number, label, title_en, title_yo, text_en, text_yo, category, scripture, tune").order("series").order("number");
    if (!error && data) {
      setHymns(data as Hymn[]);
      await setCached("hymns", data);
    } else if (!cached) {
      setHymns([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return hymns;
}

export async function getFavourites() {
  // Older versions saved plain numbers for the main hymns.
  const raw = (await getCached<(number | string)[]>("hymn_favs")) ?? [];
  return new Set(raw.map((x) => (typeof x === "number" ? `main-${x}` : x)));
}

export async function toggleFavourite(id: string) {
  const s = await getFavourites();
  if (s.has(id)) s.delete(id); else s.add(id);
  await setCached("hymn_favs", [...s]);
  return s;
}

/** Verses are separated by an empty line. */
export function verses(text: string) {
  return text.split(/\n\s*\n/).map((v) => v.trim()).filter(Boolean);
}
