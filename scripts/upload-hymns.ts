// Sends the Yoruba C&S Hymn Book (made from the conference's Word file) to Supabase.
// Safe to run again: hymns already there are updated, not duplicated.
// Hymns typed in the admin with the same number are replaced by the book's version.
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
const FILE = "content/out/hymns-yo.json";

async function main() {
  if (!existsSync(FILE)) {
    console.error(`${FILE} not found. Put the files from the update zip in content/out.`);
    process.exit(1);
  }
  const hymns = JSON.parse(readFileSync(FILE, "utf8")) as {
    series: string; number: number; label: string; title_yo: string; text_yo: string; scripture: string; tune: string; category: string;
  }[];
  const rows = hymns.map((h) => ({
    series: h.series, number: h.number, label: h.label, title_yo: h.title_yo, text_yo: h.text_yo,
    scripture: h.scripture, tune: h.tune, category: h.category, updated_at: new Date().toISOString(),
  }));
  console.log("Sending the hymn book...");
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from("hymns").upsert(rows.slice(i, i + 100), { onConflict: "series,number" });
    if (error) throw new Error(error.message);
  }
  const count = (s: string) => rows.filter((r) => r.series === s).length;
  console.log(`Done. ${count("main")} hymns, ${count("akunleko")} Akúnlẹ̀kọ, ${count("isoji")} Ìsọjí.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
