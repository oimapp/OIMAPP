// All settings come from environment variables. No fallbacks: a missing value stops the app with a clear message.
function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See admin/.env.example.`);
  return value;
}

// NEXT_PUBLIC_ values must be read with their full names so Next.js can include them in the browser code.
export const SUPABASE_URL = () => need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = () =>
  need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const SUPABASE_SECRET_KEY = () => need("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
export const FLUTTERWAVE_SECRET_KEY = () => need("FLUTTERWAVE_SECRET_KEY", process.env.FLUTTERWAVE_SECRET_KEY);
