// Downloading books and reading their lists from the phone.

import { useCallback, useEffect, useState } from "react";
import { useApp, BookRow } from "./app";
import { todayISO } from "./dates";
import type { Lang } from "./i18n";
import { getCached, setCached } from "./cache";
import { rpc } from "./supabase";
import { getIndex, IndexEntry, localVersion, saveBook, toItems } from "./vault";

export function bookTitle(b: Pick<BookRow, "title_en" | "title_yo" | "year"> & { kind?: string }, lang: Lang) {
  const name = lang === "yo" ? b.title_yo : b.title_en;
  return b.kind === "document" ? name : `${name} ${b.year}`;
}

/** Fetch a whole book from the server and lock it on the phone. */
export async function downloadBook(bookId: string, owner: string, installId: string, onProgress: (p: number) => void) {
  const res = await rpc<{ id: string; kind: string; version: number; items: any[] }>("app_get_book", {
    p_book: bookId, p_install_id: installId,
  });
  await saveBook(bookId, owner, res.version, res.kind, toItems(res.kind, res.items), onProgress);
}

/** The list of lessons or days of a book on this phone. */
export function useBookIndex(bookId: string | undefined) {
  const { userId } = useApp();
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!bookId || !userId) return;
    setVersion(localVersion(bookId, userId));
    setIndex(await getIndex(bookId, userId));
    setReady(true);
  }, [bookId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { index, version, ready, reload };
}

/** Today's entry (daily) or this coming Sunday's lesson, or the first one if the year has not started. */
export function pickCurrent(index: IndexEntry[] | null, kind: string) {
  if (!index?.length) return null;
  if (kind === "document") return null;
  const today = todayISO();
  if (kind === "daily") return index.find((e) => e.date === today) ?? (today < index[0].date ? index[0] : index[index.length - 1]);
  return index.find((e) => e.date >= today) ?? index[index.length - 1];
}

/** Which lessons or days of a book this member has opened on this phone. */
export async function readKeys(userId: string, bookId: string) {
  return new Set((await getCached<string[]>(`read:${userId}:${bookId}`)) ?? []);
}

export async function markRead(userId: string, bookId: string, key: string) {
  const s = await readKeys(userId, bookId);
  if (s.has(key)) return;
  s.add(key);
  await setCached(`read:${userId}:${bookId}`, [...s]);
}
