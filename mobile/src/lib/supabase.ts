import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE_KEY, SUPABASE_URL, missingEnv } from "./env";

export const supabase = createClient(
  missingEnv.length ? "https://missing.supabase.co" : SUPABASE_URL,
  missingEnv.length ? "missing" : SUPABASE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Only refresh the sign-in while the app is on screen.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Errors we raise on purpose in the database functions. Anything else is treated as "no internet". */
const KNOWN = [
  "not_signed_in", "name_needed", "phone_invalid", "phone_locked", "phone_taken",
  "no_install_id", "account_frozen", "wrong_phone", "not_owned", "no_book",
];

export function errorCode(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  return KNOWN.find((k) => msg.includes(k)) ?? (/network|fetch|timed? ?out|abort/i.test(msg) ? "offline" : msg);
}

/** Call a database function and throw a short error code if it fails. */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errorCode(error));
  return data as T;
}
