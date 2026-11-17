import { NextResponse } from "next/server";
import { confirmPlayPurchase, PlayError } from "@/lib/play";
import { supabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// The app calls this right after a Google Play purchase (and again later for any
// purchase that was not finished). The member's sign-in token proves who is asking.
export async function POST(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const { data: user } = await supabaseService().auth.getUser(jwt);
  if (!user?.user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { productId?: string; purchaseToken?: string };
  if (!body.productId || !body.purchaseToken) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const r = await confirmPlayPurchase(user.user.id, body.productId, body.purchaseToken);
    return NextResponse.json(r);
  } catch (e) {
    const code = e instanceof PlayError ? e.code : "server";
    console.error("Google Play check failed", code, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: code }, { status: code === "other_account" || code === "not_paid" ? 409 : 502 });
  }
}
