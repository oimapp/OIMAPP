import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../env";

/** Supabase as the signed-in admin (their own permissions). */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a page, where cookies cannot be set. The middleware refreshes them instead.
        }
      },
    },
  });
}
