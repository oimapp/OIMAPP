// Notes and bookmarks. They are saved on the phone straight away and copied to the
// member's account when there is internet, so a new phone gets them back.

import { useCallback, useEffect, useState } from "react";
import { getCached, setCached } from "./cache";
import { supabase } from "./supabase";

export type Mark = {
  book_id: string;
  item_key: string;
  kind: "note" | "bookmark";
  body: string;
  deleted: boolean;
  updated_at: string;
  dirty?: boolean;      // changed on the phone, not yet sent
};

const id = (m: Pick<Mark, "book_id" | "item_key" | "kind">) => `${m.book_id}|${m.item_key}|${m.kind}`;

let store: Record<string, Mark> | null = null;
let owner: string | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

async function load(userId: string) {
  if (store && owner === userId) return store;
  owner = userId;
  store = (await getCached<Record<string, Mark>>(`marks:${userId}`)) ?? {};
  return store;
}

async function persist() {
  if (owner && store) await setCached(`marks:${owner}`, store);
}

/** Send changed marks to the server, then bring down anything newer from the server. */
export async function syncMarks(userId: string) {
  const s = await load(userId);
  const dirty = Object.values(s).filter((m) => m.dirty);
  if (dirty.length) {
    const { error } = await supabase.from("member_notes").upsert(
      dirty.map(({ dirty: _d, ...m }) => ({ ...m, user_id: userId })),
      { onConflict: "user_id,book_id,item_key,kind" },
    );
    if (!error) dirty.forEach((m) => { delete s[id(m)].dirty; });
  }
  const { data, error } = await supabase.from("member_notes").select("book_id, item_key, kind, body, deleted, updated_at");
  if (!error && data) {
    for (const r of data as Mark[]) {
      const local = s[id(r)];
      if (!local || (!local.dirty && local.updated_at < r.updated_at)) s[id(r)] = r;
    }
  }
  await persist();
  changed();
}

export async function setMark(userId: string, m: Pick<Mark, "book_id" | "item_key" | "kind" | "body" | "deleted">) {
  const s = await load(userId);
  s[id(m)] = { ...m, updated_at: new Date().toISOString(), dirty: true };
  await persist();
  changed();
  void syncMarks(userId).catch(() => undefined);
}

/** All marks for this member, kept up to date. */
export function useMarks(userId: string | null) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const s = await load(userId);
    setMarks(Object.values(s).filter((m) => !m.deleted && (m.kind === "bookmark" || m.body.trim())));
  }, [userId]);
  useEffect(() => {
    void refresh();
    listeners.add(refresh);
    return () => { listeners.delete(refresh); };
  }, [refresh]);
  return marks;
}

export function findMark(marks: Mark[], bookId: string, key: string, kind: Mark["kind"]) {
  return marks.find((m) => m.book_id === bookId && m.item_key === key && m.kind === kind);
}

export function forgetMarks() {
  store = null;
  owner = null;
}
