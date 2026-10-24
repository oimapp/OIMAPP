"use server";

// Every change the admin team makes goes through these functions.
// Each one checks the person's role first, then writes an entry in the audit log.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireAdmin, audit } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { supabaseServer } from "@/lib/supabase/server";
import { fromText } from "@/lib/lessonText";
import { unlockPayment } from "@/lib/unlock";
import { FLUTTERWAVE_SECRET_KEY } from "@/lib/env";

export type State = { ok?: string; error?: string; at?: number } | null;

/** Runs an action and turns any problem into a message the page can show. */
async function run(fn: () => Promise<void>, ok: string): Promise<State> {
  try {
    await fn();
    return { ok, at: Date.now() };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : "Something went wrong.", at: Date.now() };
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function fail(msg: string): never {
  throw new Error(msg);
}
const check = (error: { message: string } | null) => { if (error) fail(error.message); };

// ---------- sign out ----------

export async function signOut() {
  await supabaseServer().auth.signOut();
  redirect("/login");
}

// ---------- members ----------

async function _resetPhone(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const id = str(f, "id");
  const { error } = await supabaseService()
    .from("devices")
    .update({ active: false, unlinked_at: new Date().toISOString(), unlinked_reason: "Reset by admin" })
    .eq("user_id", id).eq("active", true);
  check(error);
  await audit(admin, "reset_phone", id);
  revalidatePath(`/members/${id}`);
}

async function _setTeacher(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const id = str(f, "id");
  const on = str(f, "on") === "1";
  const { error } = await supabaseService().from("profiles").update({ is_teacher: on }).eq("id", id);
  check(error);
  await audit(admin, on ? "make_teacher" : "remove_teacher", id);
  revalidatePath(`/members/${id}`);
}

async function _setFrozen(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const id = str(f, "id");
  const frozen = str(f, "frozen") === "1";
  const { error } = await supabaseService().from("profiles").update({ status: frozen ? "frozen" : "active" }).eq("id", id);
  check(error);
  if (frozen) {
    await supabaseService().from("devices")
      .update({ active: false, unlinked_at: new Date().toISOString(), unlinked_reason: "Account frozen" })
      .eq("user_id", id).eq("active", true);
  }
  await audit(admin, frozen ? "freeze" : "unfreeze", id);
  revalidatePath(`/members/${id}`);
}

async function _grantBook(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const id = str(f, "id");
  const book = str(f, "book");
  const reason = str(f, "reason");
  if (!reason) fail("Write a reason, for example the Flutterwave reference of the payment.");
  const { error } = await supabaseService().from("entitlements").upsert(
    { user_id: id, book_id: book, source: "admin", granted_by: admin.userId, reason },
    { onConflict: "user_id,book_id", ignoreDuplicates: true },
  );
  check(error);
  await audit(admin, "grant_book", id, { book, reason });
  revalidatePath(`/members/${id}`);
}

// ---------- payments ----------

/** Ask Flutterwave whether a payment really arrived; if yes, mark it paid and unlock the books. */
async function _checkWithFlutterwave(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const id = str(f, "id");
  const db = supabaseService();
  const { data: p, error } = await db.from("payments").select("*").eq("id", id).single();
  if (error || !p) fail("Payment not found.");
  if (p.channel === "google_play") fail("Google Play payments are checked with Google, not Flutterwave.");

  const secret = FLUTTERWAVE_SECRET_KEY();
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(p.tx_ref)}`,
    { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
  ).catch(() => fail("Could not reach Flutterwave. Check the internet connection and try again."));
  const body = await res.json().catch(() => ({}));
  const tx = body?.data;
  const ok =
    res.ok && tx?.status === "successful" && tx?.currency === p.currency &&
    Math.round(Number(tx?.amount) * 100) >= p.amount_kobo;

  if (!ok) {
    await audit(admin, "check_payment", id, { result: "not_paid", flw_status: tx?.status ?? body?.message ?? res.status });
    revalidatePath(`/payments/${id}`);
    fail(`Flutterwave does not show this payment as complete (${tx?.status ?? body?.message ?? "no answer"}).`);
  }
  await db.from("payments").update({
    status: "paid", flw_transaction_id: tx.id, method: tx.payment_type ?? p.method, verified_at: new Date().toISOString(), raw: tx,
  }).eq("id", id);
  const result = await unlockPayment(p);
  await audit(admin, "check_payment", id, { result: "paid", unlocked: result });
  revalidatePath(`/payments/${id}`);
}

// ---------- books ----------

async function _saveLesson(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const table = str(f, "table");
  if (!["lessons", "readings", "children_lessons"].includes(table)) fail("Unknown book table.");
  const book = str(f, "book");
  const key = str(f, "key");
  const db = supabaseService();
  const match = table === "readings" ? { book_id: book, date: key } : { book_id: book, n: Number(key) };
  const { data: row, error } = await db.from(table).select("en, yo").match(match).single();
  if (error || !row) fail("Lesson not found.");

  const part = (lang: "en" | "yo") => ({
    ...row[lang],
    topic: str(f, `${lang}_topic`),
    text: str(f, `${lang}_text`),
    body: fromText(String(f.get(`${lang}_body`) ?? "")),
  });
  const { error: e } = await db.from(table)
    .update({ en: part("en"), yo: part("yo"), published: f.get("published") === "on" })
    .match(match);
  check(e);
  await db.rpc("bump_content_version", { b: book }).then(() => undefined, () => undefined);
  await audit(admin, "edit_lesson", `${book}/${key}`);
  revalidatePath(`/books/${book}`);
  revalidatePath(`/books/${book}/${key}`);
}

async function _saveGuide(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const book = str(f, "book");
  const n = Number(str(f, "n"));
  const { error } = await supabaseService().from("teacher_guides").upsert({
    book_id: book, n, aim: str(f, "aim"), discussion: str(f, "discussion"),
    updated_by: admin.userId, updated_at: new Date().toISOString(),
  });
  check(error);
  await audit(admin, "edit_guide", `${book}/${n}`);
  revalidatePath(`/books/${book}/${n}`);
}

async function _setBookStatus(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const status = str(f, "status");
  if (!["draft", "published", "coming_soon"].includes(status)) fail("Unknown status.");
  const { error } = await supabaseService().from("books").update({ status }).eq("id", id);
  check(error);
  await audit(admin, "book_status", id, { status });
  revalidatePath("/books");
}

async function _saveCover(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const db = supabaseService();
  if (f.get("remove") === "on") {
    check((await db.from("books").update({ cover_path: null }).eq("id", id)).error);
  } else {
    const path = await uploadPicture(f, "cover", "covers");
    if (!path) fail("Choose a cover picture first.");
    check((await db.from("books").update({ cover_path: path }).eq("id", id)).error);
  }
  await audit(admin, "book_cover", id);
  revalidatePath("/books");
}

// ---------- calendar ----------

async function _saveEvent(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const row = {
    date: str(f, "date"), end_date: str(f, "end_date") || null, title_en: str(f, "title_en"),
    title_yo: str(f, "title_yo"), place: str(f, "place"), kind: str(f, "kind") || "Event",
    updated_at: new Date().toISOString(),
  };
  if (!row.date || !row.title_en) fail("Give the event a date and an English name.");
  const db = supabaseService();
  const { error } = id ? await db.from("events").update(row).eq("id", id) : await db.from("events").insert(row);
  check(error);
  await audit(admin, id ? "edit_event" : "add_event", row.title_en);
  revalidatePath("/calendar");
}

async function _deleteEvent(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const { error } = await supabaseService().from("events").delete().eq("id", str(f, "id"));
  check(error);
  await audit(admin, "delete_event", str(f, "id"));
  revalidatePath("/calendar");
}

// ---------- districts and churches ----------

async function _addDistrict(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const name = str(f, "name");
  if (!name) fail("Type the district name.");
  const { error } = await supabaseService().from("districts").insert({ name, sort: Number(str(f, "sort")) || 0 });
  check(error);
  await audit(admin, "add_district", name);
  revalidatePath("/districts");
}

async function _deleteDistrict(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const { error } = await supabaseService().from("districts").delete().eq("id", str(f, "id"));
  check(error);
  await audit(admin, "delete_district", str(f, "id"));
  revalidatePath("/districts");
}

async function _saveChurch(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const row = {
    district_id: str(f, "district_id"), name: str(f, "name"), town: str(f, "town"),
    address: str(f, "address"), prophet: str(f, "prophet"), phone: str(f, "phone"),
    is_hq: f.get("is_hq") === "on",
  };
  if (!row.name || !row.district_id) fail("Choose a district and type the church name.");
  const db = supabaseService();
  // Only one headquarters per district: clear the old one first.
  if (row.is_hq) {
    let clear = db.from("churches").update({ is_hq: false }).eq("district_id", row.district_id).eq("is_hq", true);
    if (id) clear = clear.neq("id", id);
    check((await clear).error);
  }
  const { error } = id ? await db.from("churches").update(row).eq("id", id) : await db.from("churches").insert(row);
  check(error);
  await audit(admin, id ? "edit_church" : "add_church", row.name);
  revalidatePath("/districts");
}

async function _deleteChurch(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const { error } = await supabaseService().from("churches").delete().eq("id", str(f, "id"));
  check(error);
  await audit(admin, "delete_church", str(f, "id"));
  revalidatePath("/districts");
}

// ---------- pictures ----------

/** Upload a picture from a form to the public bucket and return its path, or null if none was chosen. */
async function uploadPicture(f: FormData, field: string, folder: string): Promise<string | null> {
  const pic = f.get(field);
  if (!(pic instanceof File) || pic.size === 0) return null;
  if (!pic.type.startsWith("image/")) fail("The picture must be an image (JPG or PNG).");
  if (pic.size > 4 * 1024 * 1024) fail("The picture is too large. Use one under 4 MB.");
  const ext = pic.type === "image/png" ? "png" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseService().storage.from("public").upload(path, pic, { contentType: pic.type });
  check(error);
  return path;
}

// ---------- Baba Aladura ----------

async function _saveBaba(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const db = supabaseService();
  const row: Record<string, unknown> = { name: str(f, "name"), years: str(f, "years"), sort: Number(str(f, "sort")) || 0 };
  if (!row.name) fail("Type the name.");

  const path = await uploadPicture(f, "photo", "baba-aladura");
  if (path) row.photo_path = path;
  const { error } = id ? await db.from("baba_aladura").update(row).eq("id", id) : await db.from("baba_aladura").insert(row);
  check(error);
  await audit(admin, id ? "edit_baba" : "add_baba", String(row.name));
  revalidatePath("/babas");
}

async function _deleteBaba(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const { error } = await supabaseService().from("baba_aladura").delete().eq("id", str(f, "id"));
  check(error);
  await audit(admin, "delete_baba", str(f, "id"));
  revalidatePath("/babas");
}

// ---------- messages ----------

async function _sendAnnouncement(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const row = { audience: str(f, "audience"), body_en: str(f, "body_en"), body_yo: str(f, "body_yo"), sent_by: admin.userId };
  if (!row.body_en) fail("Write the message in English at least.");
  if (row.body_en.length > 160 || row.body_yo.length > 160) fail("Keep each message under 160 characters.");
  const { error } = await supabaseService().from("announcements").insert(row);
  check(error);
  await audit(admin, "send_message", row.audience, { body: row.body_en });
  revalidatePath("/messages");
}

// ---------- settings ----------

async function _savePrices(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const db = supabaseService();
  for (const [id, field] of [["manual-2027", "manual"], ["daily-2027", "daily"], ["both-2027", "both"], ["children-2027", "children"]]) {
    const naira = Number(str(f, field).replace(/[^\d.]/g, ""));
    if (!naira) continue;
    await db.from("products").update({ price_kobo: Math.round(naira * 100), on_sale: f.get(`${field}_on`) === "on" }).eq("id", id);
  }
  await audit(admin, "change_prices", "products");
  revalidatePath("/settings");
}

async function _saveSettings(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const db = supabaseService();
  const num = (k: string) => Number(str(f, k)) || 0;
  const values: Record<string, unknown> = {
    support_whatsapp: str(f, "support_whatsapp"),
    agent_whatsapp: str(f, "agent_whatsapp"),
    phone_moves_per_year: num("phone_moves_per_year"),
    move_wait_days: num("move_wait_days"),
    offline_days: num("offline_days"),
    watermark: f.get("watermark") === "on",
    block_screenshots: f.get("block_screenshots") === "on",
    pay_google_play: f.get("pay_google_play") === "on",
    pay_whatsapp: f.get("pay_whatsapp") === "on",
    pay_web: f.get("pay_web") === "on",
    home_notice: { en: str(f, "notice_en"), yo: str(f, "notice_yo") },
    maintenance: { on: f.get("maintenance_on") === "on", en: str(f, "maintenance_en"), yo: str(f, "maintenance_yo") },
    min_app_version: str(f, "min_app_version") || "1.0.0",
    about: { en: str(f, "about_en"), yo: str(f, "about_yo") },
  };
  const { data: old } = await db.from("settings").select("value").eq("key", "welcome").maybeSingle();
  const photo = await uploadPicture(f, "welcome_photo", "welcome");
  values.welcome = {
    en: str(f, "welcome_en"), yo: str(f, "welcome_yo"),
    verse_en: str(f, "verse_en"), verse_yo: str(f, "verse_yo"), verse_ref: str(f, "verse_ref"),
    photo_path: f.get("welcome_photo_remove") === "on" ? "" : photo ?? (old?.value as { photo_path?: string })?.photo_path ?? "",
  };
  for (const [key, value] of Object.entries(values)) {
    const { error } = await db.from("settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    check(error);
  }
  await audit(admin, "change_settings", "settings");
  revalidatePath("/settings");
}

async function _addAdmin(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const email = str(f, "email").toLowerCase();
  const name = str(f, "name");
  const role = str(f, "role");
  const password = str(f, "password");
  if (!email || !name || !["owner", "editor", "support"].includes(role)) fail("Fill in the name, email and role.");
  if (password.length < 10) fail("Give a starting password of at least 10 characters. They can change it later.");
  const db = supabaseService();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  check(error);
  const { error: e } = await db.from("admin_users").insert({ user_id: data.user!.id, name, role });
  check(e);
  await audit(admin, "add_admin", email, { role });
  revalidatePath("/settings");
}

async function _removeAdmin(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const id = str(f, "user_id");
  if (id === admin.userId) fail("You cannot remove yourself.");
  const { error } = await supabaseService().from("admin_users").delete().eq("user_id", id);
  check(error);
  await audit(admin, "remove_admin", id);
  revalidatePath("/settings");
}

// ---------- what the pages call ----------

export async function resetPhone(_: State, f: FormData): Promise<State> {
  return run(() => _resetPhone(f), "Phone reset. They can sign in on a new phone now.");
}
export async function setTeacher(_: State, f: FormData): Promise<State> {
  return run(() => _setTeacher(f), "Saved.");
}
export async function setFrozen(_: State, f: FormData): Promise<State> {
  return run(() => _setFrozen(f), "Saved.");
}
export async function grantBook(_: State, f: FormData): Promise<State> {
  return run(() => _grantBook(f), "Book unlocked. It downloads next time their phone connects.");
}
export async function checkWithFlutterwave(_: State, f: FormData): Promise<State> {
  return run(() => _checkWithFlutterwave(f), "Confirmed with Flutterwave. The books are unlocked.");
}
export async function saveLesson(_: State, f: FormData): Promise<State> {
  return run(() => _saveLesson(f), "Lesson saved.");
}
export async function saveGuide(_: State, f: FormData): Promise<State> {
  return run(() => _saveGuide(f), "Teaching guide saved.");
}
export async function setBookStatus(_: State, f: FormData): Promise<State> {
  return run(() => _setBookStatus(f), "Saved.");
}
export async function saveCover(_: State, f: FormData): Promise<State> {
  return run(() => _saveCover(f), "Cover saved.");
}
export async function saveEvent(_: State, f: FormData): Promise<State> {
  return run(() => _saveEvent(f), "Event saved.");
}
export async function deleteEvent(_: State, f: FormData): Promise<State> {
  return run(() => _deleteEvent(f), "Event deleted.");
}
export async function addDistrict(_: State, f: FormData): Promise<State> {
  return run(() => _addDistrict(f), "District added.");
}
export async function deleteDistrict(_: State, f: FormData): Promise<State> {
  return run(() => _deleteDistrict(f), "District deleted.");
}
export async function saveChurch(_: State, f: FormData): Promise<State> {
  return run(() => _saveChurch(f), "Church saved.");
}
export async function deleteChurch(_: State, f: FormData): Promise<State> {
  return run(() => _deleteChurch(f), "Church deleted.");
}
export async function saveBaba(_: State, f: FormData): Promise<State> {
  return run(() => _saveBaba(f), "Saved.");
}
export async function deleteBaba(_: State, f: FormData): Promise<State> {
  return run(() => _deleteBaba(f), "Deleted.");
}
export async function sendAnnouncement(_: State, f: FormData): Promise<State> {
  return run(() => _sendAnnouncement(f), "Message saved. It shows in the app the next time phones connect.");
}
export async function savePrices(_: State, f: FormData): Promise<State> {
  return run(() => _savePrices(f), "Prices saved.");
}
export async function saveSettings(_: State, f: FormData): Promise<State> {
  return run(() => _saveSettings(f), "Settings saved.");
}
export async function addAdmin(_: State, f: FormData): Promise<State> {
  return run(() => _addAdmin(f), "Admin added. Give them their email and starting password.");
}
export async function removeAdmin(_: State, f: FormData): Promise<State> {
  return run(() => _removeAdmin(f), "Admin removed.");
}
