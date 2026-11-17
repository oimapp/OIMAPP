// Closes the OLD Supabase project that the first test APKs use, when moving to a new project.
// It freezes every member account there, so the old test APK stops opening the books
// and shows "account frozen" instead. Nothing is deleted, and it does not touch the new project.
//
// Run it BEFORE you put the new project's address in the .env file:
//   npx tsx scripts/close-old-test.ts --yes

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in the .env file.");
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.log(`This will freeze every member account in ${url}`);
  console.log("If that is the OLD project, run again with --yes at the end.");
  process.exit(0);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log(`Old project: ${url}`);
  const frozen = await db.from("profiles").update({ status: "frozen" }).eq("status", "active").select("id");
  if (frozen.error) throw new Error(frozen.error.message);
  console.log(`${frozen.data.length} member accounts frozen.`);

  const phones = await db.from("devices").update({ active: false, unlinked_at: new Date().toISOString(), unlinked_reason: "Test version ended" })
    .eq("active", true).select("id");
  console.log(phones.error ? "Phones: skipped." : `${phones.data.length} phones unlinked.`);

  // Phones must connect at least once a day, so the old app cannot keep reading offline for long.
  const off = await db.from("settings").update({ value: 1 }).eq("key", "offline_days");
  console.log(off.error ? "Offline days: skipped." : "Offline reading limit set to 1 day.");
  console.log("Done. The old test APK will stop opening the books the next time it connects.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
