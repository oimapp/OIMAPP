import { NextResponse } from "next/server";
import { FLUTTERWAVE_WEBHOOK_HASH } from "@/lib/env";
import { confirmPayment } from "@/lib/payments";
import { notifyPaid } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Flutterwave calls this when money arrives (card, transfer to a one-time account, USSD).
// We never trust the message itself: we ask Flutterwave again before unlocking anything.
export async function POST(req: Request) {
  if (req.headers.get("verif-hash") !== FLUTTERWAVE_WEBHOOK_HASH()) {
    return new NextResponse("Forbidden", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const tx_ref: string | undefined = body?.data?.tx_ref ?? body?.txRef;
  if (tx_ref) {
    try {
      const r = await confirmPayment(tx_ref);
      if (r.state === "paid") await notifyPaid(tx_ref).catch((e) => console.error("WhatsApp notify failed", e));
    } catch (e) {
      console.error("Flutterwave webhook error", e);
      return new NextResponse("Try again", { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
