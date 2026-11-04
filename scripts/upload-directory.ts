// Sends the 2027 church directory and calendar (made from the conference's
// "Daily Bread District Meetings 2027" Word file) to Supabase.
//
// What it does:
//   - adds or updates every district and annexe by name
//   - replaces the churches and officers of those districts with the ones in the file
//   - replaces the National Executive Council list
//   - replaces the 2027 events in the church calendar
// Districts you added by hand that are not in the file are left alone.
//
// Run:  npm run upload-directory

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
const FILE = "content/out/directory-2027.json";

type Church = { name: string; leader: string; phone: string; is_hq?: boolean };
type Officer = { role: string; name: string; phone: string };
type District = { name: string; kind: "district" | "annex"; admin_hq: string; state: string; officers: Officer[]; churches: Church[] };

function ok<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

async function main() {
  if (!existsSync(FILE)) {
    console.error(`${FILE} not found. Put the files from the update zip in content/out.`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(FILE, "utf8")) as {
    districts: District[]; council: { post: string; name: string }[];
    events: { date: string; end_date: string | null; title_en: string; title_yo: string; kind: string; place: string; texts: string }[];
  };

  console.log("Sending districts and churches...");
  let churches = 0, officers = 0;
  for (const [i, d] of data.districts.entries()) {
    const row = ok(await db.from("districts")
      .upsert({ name: d.name, kind: d.kind, admin_hq: d.admin_hq, state: d.state, sort: i + 1 }, { onConflict: "name" })
      .select("id").single(), `district ${d.name}`) as { id: string };
    ok(await db.from("churches").delete().eq("district_id", row.id), "clear churches");
    ok(await db.from("district_officers").delete().eq("district_id", row.id), "clear officers");
    if (d.churches.length) {
      ok(await db.from("churches").insert(d.churches.map((c, j) => ({
        district_id: row.id, name: c.name, prophet: c.leader, phone: c.phone, is_hq: !!c.is_hq, sort: j + 1,
      }))), `churches of ${d.name}`);
    }
    if (d.officers.length) {
      ok(await db.from("district_officers").insert(d.officers.map((o, j) => ({
        district_id: row.id, role: o.role, name: o.name, phone: o.phone, sort: j + 1,
      }))), `officers of ${d.name}`);
    }
    churches += d.churches.length;
    officers += d.officers.length;
  }
  console.log(`  ${data.districts.length} districts and annexes, ${churches} churches, ${officers} officers`);

  ok(await db.from("council_members").delete().neq("post", ""), "clear council");
  ok(await db.from("council_members").insert(data.council.map((c, i) => ({ post: c.post, name: c.name, sort: i + 1 }))), "council");
  console.log(`  ${data.council.length} National Executive Council members`);

  ok(await db.from("events").delete().gte("date", "2027-01-01").lte("date", "2027-12-31"), "clear 2027 events");
  ok(await db.from("events").insert(data.events), "events");
  console.log(`  ${data.events.length} events in the 2027 calendar`);
  console.log("Done. Check Districts and churches, and Church calendar, in the admin.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
