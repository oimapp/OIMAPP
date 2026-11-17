// Sends the hymn book to Supabase:
//   - content/out/hymns-2026.json: the 866 hymns and 45 Kneeling Songs (Akúnlẹ̀kọ)
//     in English and Yoruba, from the conference's 2026 Word files
//   - content/out/hymns-yo.json: only the 49 Ìsọjí songs are taken from it (Yoruba only,
//     from the older hymn book), because the new edition does not have them.
// Safe to run again: hymns already there are updated, not duplicated.
//
// Run:  npm run upload-hymns

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in the .env file.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const NEW_FILE = "content/out/hymns-2026.json";
const OLD_FILE = "content/out/hymns-yo.json";

type NewHymn = {
  series: string; number: number; label: string; category_en: string; category_yo: string;
  title_en: string; title_yo: string; text_en: string; text_yo: string;
  scripture_en: string; scripture_yo: string; tune: string;
};
type OldHymn = { series: string; number: number; label: string; title_yo: string; text_yo: string; scripture: string; tune: string; category: string };

async function main() {
  if (!existsSync(NEW_FILE)) {
    console.error(`${NEW_FILE} not found. Put the files from the update zip in content/out.`);
    process.exit(1);
  }
  const now = new Date().toISOString();
  const fresh = JSON.parse(readFileSync(NEW_FILE, "utf8")) as NewHymn[];
  const rows: Record<string, unknown>[] = fresh.map((h) => ({
    series: h.series, number: h.number, label: h.label,
    title_en: h.title_en, title_yo: h.title_yo, text_en: h.text_en, text_yo: h.text_yo,
    category: h.category_en, category_yo: h.category_yo,
    scripture: h.scripture_en, scripture_yo: h.scripture_yo, tune: h.tune, updated_at: now,
  }));

  if (existsSync(OLD_FILE)) {
    const old = JSON.parse(readFileSync(OLD_FILE, "utf8")) as OldHymn[];
    for (const h of old.filter((x) => x.series === "isoji")) {
      rows.push({
        series: "isoji", number: h.number, label: h.label, title_en: "", title_yo: h.title_yo, text_en: "", text_yo: h.text_yo,
        category: "Ìsọjí", category_yo: "Ìsọjí", scripture: "", scripture_yo: h.scripture, tune: h.tune, updated_at: now,
      });
    }
  }

  console.log("Sending the hymn book...");
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from("hymns").upsert(rows.slice(i, i + 100), { onConflict: "series,number" });
    if (error) throw new Error(error.message);
  }

  // Remove main hymns and Kneeling Songs that are not in the new book (for example a number that was printed twice before).
  for (const series of ["main", "akunleko"]) {
    const keep = new Set(fresh.filter((h) => h.series === series).map((h) => h.number));
    const { data } = await db.from("hymns").select("number").eq("series", series);
    const extra = (data ?? []).map((r) => r.number as number).filter((n) => !keep.has(n));
    if (extra.length) {
      const { error } = await db.from("hymns").delete().eq("series", series).in("number", extra);
      if (error) throw new Error(error.message);
    }
  }

  const count = (s: string) => rows.filter((r) => r.series === s).length;
  console.log(`Done. ${count("main")} hymns and ${count("akunleko")} Kneeling Songs in English and Yoruba, ${count("isoji")} Ìsọjí.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
