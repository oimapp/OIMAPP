import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SECRET_KEY } from "../env";

/** Supabase with full access. Server only, and only after requireAdmin() has checked the caller. */
export function supabaseService() {
  return createClient(SUPABASE_URL(), SUPABASE_SECRET_KEY(), { auth: { persistSession: false } });
}
