// The two public values the app needs. They come from mobile/.env on your computer
// and from the EAS environment variables when the APK is built in the cloud.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Names of any settings that are missing, so the app can say so instead of crashing. */
export const missingEnv = [
  !SUPABASE_URL && "EXPO_PUBLIC_SUPABASE_URL",
  !SUPABASE_KEY && "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
].filter(Boolean) as string[];
