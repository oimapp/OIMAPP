// Sends the Church Constitution (English) and Òfin Ìjọ (Yoruba) to Supabase,
// made from the conference's Word files (content/out/constitution.json).
// Replaces the sections already there, then tells phones that own the book to refresh it.
//
// Run:  npm run upload-constitution

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
const FILE = "content/out/constitution.json";
const BOOK = "constitution";

type Section = { n: number; title: string; body: { t: string; x: string }[] };

async function main() {
  if (!existsSync(FILE)) {
    console.error(`${FILE} not found. Put the files from the update zip in content/out.`);
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(FILE, "utf8")) as Record<"en" | "yo", Section[]>;
  const { data: book } = await db.from("books").select("id").eq("id", BOOK).maybeSingle();
  if (!book) {
    console.error("The Constitution book is not in the database yet. Run the Update 7 database file in Supabase first.");
    process.exit(1);
  }
  const { error: delError } = await db.from("doc_sections").delete().eq("book_id", BOOK);
  if (delError) throw new Error(delError.message);
  const rows = (["en", "yo"] as const).flatMap((lang) =>
    doc[lang].map((s) => ({ book_id: BOOK, lang, n: s.n, title: s.title, body: s.body, published: true })));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await db.from("doc_sections").insert(rows.slice(i, i + 50));
    if (error) throw new Error(error.message);
  }
  await db.rpc("bump_content_version", { b: BOOK });
  console.log(`Done. ${doc.en.length} English sections and ${doc.yo.length} Yoruba sections.`);
  console.log("In the admin, open Books and set the Constitution to Published when you are ready to sell it.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
