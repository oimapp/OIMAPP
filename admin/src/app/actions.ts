"use server";

// Every change the admin team makes goes through these functions.
// Each one checks the person's role first, then writes an entry in the audit log.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { ALL_ROLES, requireAdmin, audit } from "@/lib/auth";
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
    map_url: str(f, "map_url"),
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
  const row: Record<string, unknown> = {
    name: str(f, "name"), years: str(f, "years"), sort: Number(str(f, "sort")) || 0,
    role: str(f, "role") === "secretary" ? "secretary" : "baba",
  };
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

// ---------- National Executive Council and district officers ----------

async function _saveCouncil(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const row = { post: str(f, "post"), name: str(f, "name"), sort: Number(str(f, "sort")) || 0 };
  if (!row.post) fail("Type the post, for example General Secretary.");
  const db = supabaseService();
  check((id ? await db.from("council_members").update(row).eq("id", id) : await db.from("council_members").insert(row)).error);
  await audit(admin, id ? "edit_council" : "add_council", row.post, { name: row.name });
  revalidatePath("/babas");
}

async function _deleteCouncil(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  check((await supabaseService().from("council_members").delete().eq("id", str(f, "id"))).error);
  await audit(admin, "delete_council", str(f, "id"));
  revalidatePath("/babas");
}

async function _saveOfficer(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const row = { district_id: str(f, "district_id"), role: str(f, "role"), name: str(f, "name"), phone: str(f, "phone"), sort: Number(str(f, "sort")) || 0 };
  if (!row.role || !row.district_id) fail("Type the office, for example Chairman.");
  const db = supabaseService();
  check((id ? await db.from("district_officers").update(row).eq("id", id) : await db.from("district_officers").insert(row)).error);
  await audit(admin, id ? "edit_officer" : "add_officer", row.role, { name: row.name, district: row.district_id });
  revalidatePath("/districts");
}

async function _deleteOfficer(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  check((await supabaseService().from("district_officers").delete().eq("id", str(f, "id"))).error);
  await audit(admin, "delete_officer", str(f, "id"));
  revalidatePath("/districts");
}

// ---------- messages ----------

async function _sendAnnouncement(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const row = { audience: str(f, "audience"), body_en: str(f, "body_en"), body_yo: str(f, "body_yo"), sent_by: admin.userId };
  if (!row.body_en) fail("Write the message in English at least.");
  if (row.body_en.length > 160 || row.body_yo.length > 160) fail("Keep each message under 160 characters.");
  const { error } = await supabaseService().from("announcements").insert(row);
  check(error);
  const pushed = await pushAnnouncement(row.audience, row.body_en, row.body_yo);
  await audit(admin, "send_message", row.audience, { body: row.body_en, pushed });
  revalidatePath("/messages");
}

/**
 * Send the message as a phone notification to everyone in the audience who allowed notifications.
 * Uses Expo's push service. Returns how many phones it was sent to.
 */
async function pushAnnouncement(audience: string, en: string, yo: string) {
  const db = supabaseService();
  const { data: tokens } = await db.from("push_tokens").select("token, user_id, profiles(language, is_teacher)");
  if (!tokens?.length) return 0;
  const { data: owned } = await db.from("entitlements").select("user_id, book_id");
  const books = new Map<string, string[]>();
  for (const e of owned ?? []) books.set(e.user_id, [...(books.get(e.user_id) ?? []), e.book_id]);
  const wanted = tokens.filter((t) => {
    const b = books.get(t.user_id) ?? [];
    const p = t.profiles as unknown as { is_teacher?: boolean } | null;
    if (audience === "manual") return b.some((x) => x.startsWith("manual-"));
    if (audience === "daily") return b.some((x) => x.startsWith("daily-"));
    if (audience === "teachers") return !!p?.is_teacher;
    if (audience === "no_book") return b.length === 0;
    return true;
  });
  const messages = wanted.map((t) => {
    const p = t.profiles as unknown as { language?: string } | null;
    return { to: t.token, title: "Ona Iwa Mimo", body: p?.language === "yo" && yo ? yo : en, sound: "default", channelId: "default", data: { url: "/" } };
  });
  for (let i = 0; i < messages.length; i += 100) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch(() => undefined);
  }
  return messages.length;
}

// ---------- hymn book ----------

async function _saveHymn(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const id = str(f, "id");
  const number = Number(str(f, "number"));
  if (!number) fail("Give the hymn its number.");
  const series = ["main", "akunleko", "isoji"].includes(str(f, "series")) ? str(f, "series") : "main";
  const row = {
    series, number, label: str(f, "label"), title_en: str(f, "title_en"), title_yo: str(f, "title_yo"),
    text_en: String(f.get("text_en") ?? "").trim(), text_yo: String(f.get("text_yo") ?? "").trim(),
    category: str(f, "category"), category_yo: str(f, "category_yo"),
    scripture: str(f, "scripture"), scripture_yo: str(f, "scripture_yo"), tune: str(f, "tune"),
    updated_at: new Date().toISOString(),
  };
  if (!row.text_en && !row.text_yo) fail("Type the words of the hymn in English or Yoruba.");
  const db = supabaseService();
  const { error } = id ? await db.from("hymns").update(row).eq("id", id) : await db.from("hymns").insert(row);
  if (error?.code === "23505") fail(`There is already a hymn number ${number} in that list.`);
  check(error);
  await audit(admin, id ? "edit_hymn" : "add_hymn", String(number));
  revalidatePath("/hymns");
}

async function _deleteHymn(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  check((await supabaseService().from("hymns").delete().eq("id", str(f, "id"))).error);
  await audit(admin, "delete_hymn", str(f, "id"));
  revalidatePath("/hymns");
}

// ---------- prayer requests and testimonies ----------

async function _setRequestStatus(f: FormData) {
  const admin = await requireAdmin(ALL_ROLES);
  const status = str(f, "status");
  if (!["new", "prayed", "approved", "hidden"].includes(status)) fail("Unknown status.");
  const db = supabaseService();
  const { data: req } = await db.from("prayer_requests").select("kind").eq("id", str(f, "id")).maybeSingle();
  if (!req) fail("Request not found.");
  const allowed = req.kind === "prayer" ? admin.readsPrayers : req.kind === "counselling" ? admin.readsCounselling : admin.role !== "reader";
  if (!allowed) fail("You have not been given access to these requests.");
  check((await db.from("prayer_requests").update({ status }).eq("id", str(f, "id"))).error);
  await audit(admin, "prayer_status", str(f, "id"), { status });
  revalidatePath("/prayers");
}

// ---------- recorded audio ----------

/** Called by the upload box after the file is in the 'audio' bucket. */
async function _saveAudio(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const row = { book_id: str(f, "book"), item_key: str(f, "key"), lang: str(f, "lang"), path: str(f, "path"), reader: str(f, "reader"), updated_at: new Date().toISOString() };
  if (!["en", "yo"].includes(row.lang) || !row.path.startsWith(`${row.book_id}/`)) fail("Upload problem. Try again.");
  check((await supabaseService().from("audio_tracks").upsert(row, { onConflict: "book_id,item_key,lang" })).error);
  await audit(admin, "upload_audio", `${row.book_id} ${row.item_key}`, { lang: row.lang });
  revalidatePath(`/books/${row.book_id}/${row.item_key}`);
}

async function _removeAudio(f: FormData) {
  const admin = await requireAdmin(["owner", "editor"]);
  const db = supabaseService();
  const book = str(f, "book"), key = str(f, "key"), lang = str(f, "lang");
  const { data } = await db.from("audio_tracks").select("path").match({ book_id: book, item_key: key, lang }).maybeSingle();
  if (data?.path) await db.storage.from("audio").remove([data.path]);
  check((await db.from("audio_tracks").delete().match({ book_id: book, item_key: key, lang })).error);
  await audit(admin, "remove_audio", `${book} ${key}`, { lang });
  revalidatePath(`/books/${book}/${key}`);
}

// ---------- settings ----------

async function _savePrices(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const db = supabaseService();
  for (const [id, field] of [["manual-2027", "manual"], ["daily-2027", "daily"], ["both-2027", "both"], ["children-2027", "children"], ["constitution", "constitution"]]) {
    const naira = Number(str(f, field).replace(/[^\d.]/g, ""));
    if (!naira) continue;
    await db.from("products").update({ price_kobo: Math.round(naira * 100), on_sale: f.get(`${field}_on`) === "on" }).eq("id", id);
  }
  await audit(admin, "change_prices", "products");
  revalidatePath("/settings");
}

const SOCIAL = ["linktree", "facebook", "youtube", "telegram", "tiktok", "instagram", "whatsapp", "website"];

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
    pay_page_url: str(f, "pay_page_url"),
    contact_email: str(f, "contact_email"),
    play_url: str(f, "play_url") || "https://play.google.com/store/apps/details?id=com.onaiwamimo.app",
    counselling_on: f.get("counselling_on") === "on",
    social_links: SOCIAL.map((kind) => ({ kind, url: str(f, `social_${kind}`) })).filter((l) => /^https?:\/\//.test(l.url)),
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
  if (!email || !name || !["owner", "editor", "support", "reader"].includes(role)) fail("Fill in the name, email and role.");
  if (password.length < 10) fail("Give a starting password of at least 10 characters. They can change it later.");
  const db = supabaseService();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  check(error);
  const { error: e } = await db.from("admin_users").insert({
    user_id: data.user!.id, name, role,
    reads_prayers: f.get("reads_prayers") === "on", reads_counselling: f.get("reads_counselling") === "on",
  });
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

/** Choose who may read prayer requests and counselling requests. */
async function _setAdminAccess(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const id = str(f, "user_id");
  const role = str(f, "role");
  if (!["owner", "editor", "support", "reader"].includes(role)) fail("Unknown role.");
  if (id === admin.userId && role !== "owner") fail("You cannot remove your own main admin role.");
  const row = { role, reads_prayers: f.get("reads_prayers") === "on", reads_counselling: f.get("reads_counselling") === "on" };
  check((await supabaseService().from("admin_users").update(row).eq("user_id", id)).error);
  await audit(admin, "admin_access", id, row);
  revalidatePath("/settings");
}

/** Launch day: the test APK stops working (or works again). */
async function _setPilot(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const open = str(f, "open") === "1";
  check((await supabaseService().from("settings").update({ value: open, updated_at: new Date().toISOString() }).eq("key", "pilot_open")).error);
  await audit(admin, open ? "pilot_open" : "pilot_closed", "settings");
  revalidatePath("/settings");
}

/** Launch day: take back every book that was unlocked by hand for testing. */
async function _endTest(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  if (str(f, "confirm").toUpperCase() !== "END") fail('Type END in the box to confirm.');
  const db = supabaseService();
  const { data, error } = await db.from("entitlements").delete().eq("source", "admin").select("user_id, book_id");
  check(error);
  await audit(admin, "end_test_unlocks", "entitlements", { removed: data?.length ?? 0 });
  revalidatePath("/settings");
  revalidatePath("/");
}

/** The Google Play service account key, pasted from the JSON file Google gives. Kept where only the server can read it. */
async function _savePlayKey(f: FormData) {
  const admin = await requireAdmin(["owner"]);
  const raw = String(f.get("key_json") ?? "").trim();
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("That is not the key file. Open the .json file Google gave you in Notepad, copy everything and paste it here.");
  }
  if (!parsed.client_email || !parsed.private_key?.includes("PRIVATE KEY")) fail("The key file is missing client_email or private_key.");
  const value = JSON.stringify({ client_email: parsed.client_email, private_key: parsed.private_key });
  check((await supabaseService().from("server_secrets").upsert({ key: "google_play", value, updated_at: new Date().toISOString() })).error);
  await audit(admin, "save_play_key", parsed.client_email);
  revalidatePath("/settings");
}

/** Delete a member's account and everything linked to it (Google Play rule). Payment records are kept without their name. */
async function _deleteMember(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const id = str(f, "id");
  if (str(f, "confirm").toUpperCase() !== "DELETE") fail('Type DELETE in the box to confirm.');
  const db = supabaseService();
  const { data: p } = await db.from("profiles").select("phone, email").eq("id", id).maybeSingle();
  const { data: books } = await db.from("entitlements").select("book_id").eq("user_id", id);
  await db.from("account_deletions").insert({
    user_id: id, phone: p?.phone ?? "", email: p?.email ?? "", books: (books ?? []).map((b) => b.book_id),
    source: "admin", status: "done", done_at: new Date().toISOString(), note: `By ${admin.name}`,
  });
  check((await db.from("profiles").delete().eq("id", id)).error);
  const { error } = await db.auth.admin.deleteUser(id);
  if (error && !/not found/i.test(error.message)) fail(error.message);
  if (p?.phone) {
    await db.from("account_deletions").update({ status: "done", done_at: new Date().toISOString() })
      .eq("status", "requested").eq("phone", p.phone);
  }
  await audit(admin, "delete_member", id);
  redirect("/members?deleted=1");
}

async function _closeDeletionRequest(f: FormData) {
  const admin = await requireAdmin(["owner", "support"]);
  const status = str(f, "status") === "rejected" ? "rejected" : "done";
  check((await supabaseService().from("account_deletions").update({ status, done_at: new Date().toISOString(), note: str(f, "note") }).eq("id", str(f, "id"))).error);
  await audit(admin, "deletion_request", str(f, "id"), { status });
  revalidatePath("/members");
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
export async function saveHymn(_: State, f: FormData): Promise<State> {
  return run(() => _saveHymn(f), "Hymn saved.");
}
export async function deleteHymn(_: State, f: FormData): Promise<State> {
  return run(() => _deleteHymn(f), "Hymn deleted.");
}
export async function setRequestStatus(_: State, f: FormData): Promise<State> {
  return run(() => _setRequestStatus(f), "Saved.");
}
export async function saveAudio(_: State, f: FormData): Promise<State> {
  return run(() => _saveAudio(f), "Audio saved. Members hear it next time they open this page.");
}
export async function removeAudio(_: State, f: FormData): Promise<State> {
  return run(() => _removeAudio(f), "Audio removed.");
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
  return run(() => _sendAnnouncement(f), "Message sent. It shows in the app, and as a notification on phones that allowed them.");
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
export async function saveCouncil(_: State, f: FormData): Promise<State> {
  return run(() => _saveCouncil(f), "Saved.");
}
export async function deleteCouncil(_: State, f: FormData): Promise<State> {
  return run(() => _deleteCouncil(f), "Removed.");
}
export async function saveOfficer(_: State, f: FormData): Promise<State> {
  return run(() => _saveOfficer(f), "Officer saved.");
}
export async function deleteOfficer(_: State, f: FormData): Promise<State> {
  return run(() => _deleteOfficer(f), "Officer removed.");
}
export async function setAdminAccess(_: State, f: FormData): Promise<State> {
  return run(() => _setAdminAccess(f), "Saved.");
}
export async function setPilot(_: State, f: FormData): Promise<State> {
  return run(() => _setPilot(f), "Saved. Phones pick this up the next time they open the app.");
}
export async function endTest(_: State, f: FormData): Promise<State> {
  return run(() => _endTest(f), "Done. Every book unlocked by hand has been taken back.");
}
export async function savePlayKey(_: State, f: FormData): Promise<State> {
  return run(() => _savePlayKey(f), "Google Play key saved.");
}
export async function deleteMember(_: State, f: FormData): Promise<State> {
  return run(() => _deleteMember(f), "Account deleted.");
}
export async function closeDeletionRequest(_: State, f: FormData): Promise<State> {
  return run(() => _closeDeletionRequest(f), "Saved.");
}
