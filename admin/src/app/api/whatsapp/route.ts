import { NextResponse } from "next/server";
import { WHATSAPP_VERIFY_TOKEN } from "@/lib/env";
import { handleMessage, validSignature } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Meta calls this once when you connect the webhook, to check the verify token.
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === WHATSAPP_VERIFY_TOKEN()) {
    return new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Every message a member sends to the agent number arrives here.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Bad signature", { status: 401 });
  }
  const body = JSON.parse(raw);
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const names = Object.fromEntries((value.contacts ?? []).map((c: { wa_id: string; profile?: { name?: string } }) => [c.wa_id, c.profile?.name ?? ""]));
      for (const m of value.messages ?? []) {
        const text =
          m.type === "text" ? m.text?.body :
          m.type === "interactive" ? (m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id) :
          m.type === "button" ? m.button?.text : "";
        if (!text) continue;
        try {
          await handleMessage(m.from, String(text), names[m.from] ?? "");
        } catch (e) {
          console.error("WhatsApp agent error", e);
        }
      }
    }
  }
  // Always answer 200 quickly, or Meta sends the same message again.
  return NextResponse.json({ ok: true });
}
