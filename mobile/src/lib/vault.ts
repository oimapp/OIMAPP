// Keeps downloaded books locked on the phone.
// Each lesson or day is encrypted on its own (AES-256) with a key that lives in the
// phone's secure storage, so the book files are unreadable if copied off the phone.
// A book file also records whose account it belongs to.

import CryptoJS from "crypto-js";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

export type Block =
  | { t: "h"; x: string }
  | { t: "p"; x: string }
  | { t: "li"; x: string; ordered: boolean }
  | { t: "mv"; x: string; ref: string }
  | { t: "lab"; k: string; x: string };

export type Part = { name: string; topic: string; text: string; body: Block[] };

/** One lesson (manual, children) or one day (daily). */
export type Item = {
  key: string;          // "1".."52" for lessons, "2027-01-01" for days, "en-12" for Constitution sections
  n?: number;
  lang?: "en" | "yo";   // Constitution: each language has its own sections
  date: string;
  review?: boolean;
  sunday?: boolean;
  theme?: { en: string; yo: string };
  en: Part;
  yo: Part;
};

/** What the book list needs, without opening every lesson. */
export type IndexEntry = {
  key: string;
  n?: number;
  lang?: "en" | "yo";
  date: string;
  review?: boolean;
  sunday?: boolean;
  topic: { en: string; yo: string };
  theme?: { en: string; yo: string };
};

type BookFile = {
  owner: string;
  version: number;
  kind: string;
  index: string;               // encrypted IndexEntry[]
  items: Record<string, string>; // key -> encrypted Item
};

const KEY_NAME = "vault_key";
let keyCache: CryptoJS.lib.WordArray | null = null;
const fileCache = new Map<string, BookFile>();

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function key() {
  if (keyCache) return keyCache;
  let k = await SecureStore.getItemAsync(KEY_NAME);
  if (!k) {
    k = hex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(KEY_NAME, k);
  }
  keyCache = CryptoJS.enc.Hex.parse(k);
  return keyCache;
}

function lock(text: string, k: CryptoJS.lib.WordArray) {
  const iv = hex(Crypto.getRandomBytes(16));
  const ct = CryptoJS.AES.encrypt(text, k, { iv: CryptoJS.enc.Hex.parse(iv) }).toString();
  return `${iv}:${ct}`;
}

function unlock(packed: string, k: CryptoJS.lib.WordArray) {
  const [iv, ct] = packed.split(":");
  return CryptoJS.AES.decrypt(ct, k, { iv: CryptoJS.enc.Hex.parse(iv) }).toString(CryptoJS.enc.Utf8);
}

const fileFor = (bookId: string) => new File(Paths.document, `book-${bookId}.dat`);

/** Turn what the server sent into items with a key each. */
export function toItems(kind: string, raw: any[]): Item[] {
  return raw.map((r) => ({ ...r, key: kind === "daily" ? String(r.date) : kind === "document" ? `${r.lang}-${r.n}` : String(r.n) }));
}

/** Save a whole book, locked. Calls onProgress with 0..1 while it works. */
export async function saveBook(
  bookId: string, owner: string, version: number, kind: string, items: Item[],
  onProgress?: (p: number) => void,
) {
  const k = await key();
  const locked: Record<string, string> = {};
  const index: IndexEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    locked[it.key] = lock(JSON.stringify(it), k);
    index.push({
      key: it.key, n: it.n, lang: it.lang, date: it.date, review: it.review, sunday: it.sunday, theme: it.theme,
      topic: { en: it.en?.topic ?? "", yo: it.yo?.topic ?? "" },
    });
    // Let the screen update every few items so the phone doesn't freeze.
    if (i % 15 === 0) {
      onProgress?.(i / items.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const data: BookFile = { owner, version, kind, index: lock(JSON.stringify(index), k), items: locked };
  const f = fileFor(bookId);
  if (f.exists) f.delete();
  f.create();
  await f.write(JSON.stringify(data));
  fileCache.set(bookId, data);
  onProgress?.(1);
}

function read(bookId: string, owner: string): BookFile | null {
  let data = fileCache.get(bookId);
  if (!data) {
    const f = fileFor(bookId);
    if (!f.exists) return null;
    try {
      data = JSON.parse(f.textSync()) as BookFile;
    } catch {
      return null;
    }
    fileCache.set(bookId, data);
  }
  return data.owner === owner ? data : null;
}

/** Which version of a book is on the phone, or null if none. */
export function localVersion(bookId: string, owner: string) {
  return read(bookId, owner)?.version ?? null;
}

export async function getIndex(bookId: string, owner: string): Promise<IndexEntry[] | null> {
  const data = read(bookId, owner);
  if (!data) return null;
  return JSON.parse(unlock(data.index, await key())) as IndexEntry[];
}

export async function getItem(bookId: string, owner: string, itemKey: string): Promise<Item | null> {
  const data = read(bookId, owner);
  const packed = data?.items[itemKey];
  if (!packed) return null;
  return JSON.parse(unlock(packed, await key())) as Item;
}

/** Remove every downloaded book (used when signing out). */
export function wipe(bookIds: string[]) {
  for (const id of bookIds) {
    const f = fileFor(id);
    if (f.exists) f.delete();
    fileCache.delete(id);
  }
}

/** Remove any book file on the phone, including ones we no longer list. */
export function wipeAll() {
  fileCache.clear();
  try {
    for (const entry of Paths.document.list()) {
      if (entry instanceof File && /book-.*\.dat$/.test(entry.uri)) entry.delete();
    }
  } catch {
    // nothing to remove
  }
}
