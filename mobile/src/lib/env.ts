// The two public values the app needs. They come from mobile/.env on your computer
// and from the EAS environment variables when the APK is built in the cloud.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Names of any settings that are missing, so the app can say so instead of crashing. */
export const missingEnv = [
  !SUPABASE_URL && "EXPO_PUBLIC_SUPABASE_URL",
  !SUPABASE_KEY && "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
].filter(Boolean) as string[];

/**
 * "pilot" for test APKs shared directly with members: they show the WhatsApp and
 * payment page options. Builds for Google Play ("play") must not show outside
 * payment options (Google Play rules), so they only show Google Play buying.
 */
export const CHANNEL = process.env.EXPO_PUBLIC_CHANNEL === "pilot" ? "pilot" : "play";

/** The admin website: Google Play purchases are checked there, and the privacy page lives there. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://oimapp.netlify.app").replace(/\/$/, "");
