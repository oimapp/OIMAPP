import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps the admin's sign-in fresh and sends anyone not signed in to /login.
export async function middleware(request: NextRequest) {
  // The payment page and the webhooks are for the public, not for admins.
  const p = request.nextUrl.pathname;
  if (p === "/pay" || p.startsWith("/pay/") || p.startsWith("/api/")) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const onLogin = path.startsWith("/login");
  if (!data.user && !onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)"],
};
