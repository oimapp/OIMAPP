"use server";

import { cleanPhone } from "@/lib/payments";
import { supabaseService } from "@/lib/supabase/service";

export type DeleteState = { ok?: boolean; error?: string } | null;

/** A request from someone who no longer has the app. The support desk finishes it in the admin (Members). */
export async function requestDeletion(_: DeleteState, f: FormData): Promise<DeleteState> {
  if (String(f.get("website") ?? "")) return { ok: true };
  const phone = cleanPhone(String(f.get("phone") ?? ""));
  if (!phone) return { error: "Type the phone number like 0803 123 4567." };
  const email = String(f.get("email") ?? "").trim().slice(0, 120);
  const note = String(f.get("note") ?? "").trim().slice(0, 200);
  const db = supabaseService();
  const { count } = await db.from("account_deletions").select("*", { count: "exact", head: true })
    .eq("phone", phone).eq("status", "requested");
  if (!count) {
    const { error } = await db.from("account_deletions").insert({ phone, email, note, source: "web", status: "requested" });
    if (error) return { error: "Something went wrong. Please try again later." };
  }
  return { ok: true };
}
