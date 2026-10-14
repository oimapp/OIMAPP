// Sends the clean book content (made by `npm run import`) to Supabase.
// Safe to run again: it updates lessons that are already there.
//
// Needs a .env file in the project folder with:
//   SUPABASE_URL=...
//   SUPABASE_SECRET_KEY=...
//
// Run:  npm run upload

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const YEAR = 2027;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in the .env file. See docs/STEPS.md, Stage 2.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

function load(name: string) {
  const path = `content/out/${name}-${YEAR}.json`;
  if (!existsSync(path)) {
    console.error(`${path} not found. Run "npm run import" first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

async function send(table: string, rows: object[], conflict: string) {
  // Send in small batches so a slow connection does not time out.
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 50), { onConflict: conflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} saved`);
}

async function main() {
  console.log("Sending content to Supabase...");

  const manual = load("manual").map((l: any) => ({
    book_id: `manual-${YEAR}`, n: l.n, date: l.date, review: l.review, en: l.en, yo: l.yo,
  }));
  const daily = load("daily").map((r: any) => ({
    book_id: `daily-${YEAR}`, date: r.date, sunday: r.sunday, en: r.en, yo: r.yo,
  }));
  const children = load("children").map((l: any) => ({
    book_id: `children-${YEAR}`, n: l.n, date: l.date, theme: l.theme, en: l.en, yo: l.yo,
  }));

  await send("lessons", manual, "book_id,n");
  await send("readings", daily, "book_id,date");
  await send("children_lessons", children, "book_id,n");

  console.log("Done. Check the tables in Supabase: lessons (52), readings (365), children_lessons (52).");
}

main().catch((e) => {
  console.error("Upload failed:", e.message);
  process.exit(1);
});
