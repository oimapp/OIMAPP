import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps the admin's sign-in fresh and sends anyone not signed in to /login.
export async function middleware(request: NextRequest) {
  // Public pages (welcome, privacy, delete account, payment page) and the webhooks are not for admins.
  const p = request.nextUrl.pathname;
  const PUBLIC = ["/pay", "/welcome", "/privacy", "/delete-account"];
  if (PUBLIC.some((x) => p === x || p.startsWith(`${x}/`)) || p.startsWith("/api/")) return NextResponse.next();

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
  // Visitors who are not admins see the public welcome page at the main address.
  if (!data.user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.rewrite(url);
  }
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
