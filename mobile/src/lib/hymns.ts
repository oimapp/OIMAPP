// The C&S Hymn Book, fetched from the server and kept on the phone for offline use.

import { useCallback, useEffect, useState } from "react";
import { getCached, setCached } from "./cache";
import { supabase } from "./supabase";

export type Hymn = { number: number; title_en: string; title_yo: string; text_en: string; text_yo: string; category: string };

export function useHymns() {
  const [hymns, setHymns] = useState<Hymn[] | null>(null);
  const load = useCallback(async () => {
    const cached = await getCached<Hymn[]>("hymns");
    if (cached) setHymns(cached);
    const { data, error } = await supabase.from("hymns").select("number, title_en, title_yo, text_en, text_yo, category").order("number");
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
  return new Set((await getCached<number[]>("hymn_favs")) ?? []);
}

export async function toggleFavourite(n: number) {
  const s = await getFavourites();
  if (s.has(n)) s.delete(n); else s.add(n);
  await setCached("hymn_favs", [...s]);
  return s;
}

/** Verses are separated by an empty line. */
export function verses(text: string) {
  return text.split(/\n\s*\n/).map((v) => v.trim()).filter(Boolean);
}
