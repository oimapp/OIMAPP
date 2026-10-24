// The Bible inside the app: King James Version (public domain) and the
// Yoruba Contemporary Bible by Biblica (CC BY-SA 4.0). Free for every member, works offline.

import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { Lang } from "./i18n";

export type Verse = { v: number; t: string };
type Text = Map<string, Verse[][]>; // book code -> chapters -> verses

const FILES: Record<Lang, number> = {
  en: require("../../assets/bible/kjv.txt"),
  yo: require("../../assets/bible/yor.txt"),
};

export const BIBLE_CREDIT: Record<Lang, string> = {
  en: "King James Version (public domain).",
  yo: "Bíbélì Mímọ́ ní Èdè Yorùbá Òde-Òní. Copyright © 2017 Biblica, Inc. Used under the Creative Commons Attribution-ShareAlike 4.0 licence. The original work by Biblica, Inc. is available for free at www.biblica.com and open.bible.",
};

export const BIBLE_NAME: Record<Lang, string> = { en: "KJV", yo: "Bíbélì Yorùbá" };

const loaded: Partial<Record<Lang, Text>> = {};
const loading: Partial<Record<Lang, Promise<Text>>> = {};

async function readAsset(lang: Lang) {
  const asset = Asset.fromModule(FILES[lang]);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri.startsWith("file:")) return (await fetch(uri)).text(); // web preview only
  return new File(uri).text();
}

export function loadBible(lang: Lang): Promise<Text> {
  if (loaded[lang]) return Promise.resolve(loaded[lang]!);
  if (!loading[lang]) {
    loading[lang] = readAsset(lang).then((raw) => {
      const text: Text = new Map();
      for (const line of raw.split("\n")) {
        const tab = line.indexOf("\t");
        if (tab < 0) continue;
        const [code, cv] = line.slice(0, tab).split(" ");
        const [c, v] = cv.split(":").map(Number);
        let book = text.get(code);
        if (!book) text.set(code, (book = []));
        (book[c - 1] ??= []).push({ v, t: line.slice(tab + 1) });
      }
      loaded[lang] = text;
      return text;
    });
  }
  return loading[lang]!;
}

export async function getChapter(lang: Lang, code: string, chapter: number): Promise<Verse[]> {
  const text = await loadBible(lang);
  return text.get(code)?.[chapter - 1] ?? [];
}

export function chapterCount(text: Text, code: string) {
  return text.get(code)?.length ?? 0;
}
