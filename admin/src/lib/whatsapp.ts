import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WHATSAPP_APP_SECRET, WHATSAPP_PHONE_ID, WHATSAPP_TOKEN } from "./env";
import { cleanPhone, confirmPayment, naira, productsOnSale, setting, startTransferPayment, type Product } from "./payments";
import { supabaseService } from "./supabase/service";

// The WhatsApp payment agent. A member messages the agent number, picks a book,
// gets a one-time bank account for the exact amount, pays by transfer, and the
// books unlock by themselves when Flutterwave confirms the money.

const GRAPH = "https://graph.facebook.com/v23.0";

/** Check that a webhook call really came from Meta (signed with the app secret). */
export function validSignature(raw: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", WHATSAPP_APP_SECRET()).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7)), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function log(wa: string, direction: "in" | "out", body: string, payment_id?: string) {
  await supabaseService().from("whatsapp_chats").insert({ wa_phone: wa, direction, body: body.slice(0, 2000), payment_id: payment_id ?? null });
}

async function send(to: string, payload: object, logText: string, payment_id?: string) {
  const res = await fetch(`${GRAPH}/${WHATSAPP_PHONE_ID()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace("+", ""), ...payload }),
  });
  if (!res.ok) console.error("WhatsApp send failed", res.status, await res.text().catch(() => ""));
  await log(to, "out", logText, payment_id);
}

export const sendText = (to: string, body: string, payment_id?: string) =>
  send(to, { type: "text", text: { body, preview_url: false } }, body, payment_id);

async function sendMenu(to: string, products: Product[]) {
  const body =
    "Ẹ káàbọ̀ to Ona Iwa Mimo. Which book do you want to buy?\n" +
    "Ẹ káàbọ̀. Ìwé wo ni ẹ fẹ́ rà?\n\n" +
    products.map((p, i) => `${i + 1}. ${p.name_en} (${p.name_yo}): ${naira(p.price_kobo)}`).join("\n") +
    "\n\nReply with the number. / Ẹ fi nọ́ńbà dáhùn.\nReply HELP to talk to a person.";
  await send(to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body.slice(0, 1020) },
      action: {
        button: "Choose a book",
        sections: [{
          title: "Books 2027",
          rows: products.slice(0, 10).map((p) => ({ id: `p:${p.id}`, title: p.name_en.slice(0, 24), description: `${p.name_yo} · ${naira(p.price_kobo)}`.slice(0, 72) })),
        }],
      },
    },
  }, body);
}

type Session = { step: string; data: { product?: string; phone?: string; tx_ref?: string } };

async function getSession(wa: string): Promise<Session> {
  const { data } = await supabaseService().from("whatsapp_sessions").select("step, data").eq("wa_phone", wa).maybeSingle();
  // A conversation left for more than a day starts again.
  return (data as Session) ?? { step: "menu", data: {} };
}

async function saveSession(wa: string, s: Session) {
  await supabaseService().from("whatsapp_sessions").upsert({ wa_phone: wa, step: s.step, data: s.data, updated_at: new Date().toISOString() });
}

/** Handle one message from a member. `text` is the typed text or the id of the option they tapped. */
export async function handleMessage(waRaw: string, text: string, name: string) {
  const wa = cleanPhone(`+${waRaw}`) ?? `+${waRaw}`;
  const msg = text.trim();
  await log(wa, "in", msg);

  const support = (await setting<string>("support_whatsapp")) ?? "";
  if ((await setting<boolean>("pay_whatsapp")) === false) {
    return sendText(wa, `Buying on WhatsApp is paused for now. Please message ${support} for help.\nA ti dá rírà lórí WhatsApp dúró fún ìgbà díẹ̀. Ẹ kọ̀wé sí ${support}.`);
  }
  if (/^(help|iranlowo|ìrànlọ́wọ́|agent|person)$/i.test(msg)) {
    return sendText(wa, `Please message our help line: ${support}\nẸ kọ̀wé sí nọ́ńbà ìrànlọ́wọ́ wa: ${support}`);
  }

  const products = await productsOnSale();
  if (!products.length) {
    return sendText(wa, "The 2027 books are not on sale yet. We will announce when they are.\nÀwọn ìwé 2027 kò tíì wà fún títà. A ó kéde rẹ̀.");
  }

  const s = await getSession(wa);
  const restart = /^(hi|hello|menu|start|bawo|báwo|e kaaro|ẹ káàárọ̀|e kaasan|e kaale|0)$/i.test(msg);

  // Waiting for a transfer: let them check, or start again.
  if (s.step === "await" && s.data.tx_ref && !restart) {
    if (/^1$|check|paid|mo ti san/i.test(msg)) {
      const r = await confirmPayment(s.data.tx_ref);
      if (r.state === "paid") return notifyPaid(s.data.tx_ref);
      return sendText(wa, "We have not received the money yet. Transfers can take a few minutes. Reply 1 to check again, or MENU to start again.\nOwó náà kò tíì dé. Ẹ dáhùn 1 láti tún ṣàyẹ̀wò.");
    }
    return sendText(wa, "We are waiting for your transfer. Reply 1 to check if it has arrived, or MENU to buy something else.\nA ń dúró de owó yín. Ẹ dáhùn 1 láti ṣàyẹ̀wò.");
  }

  if (restart || s.step === "menu" && !/^(\d+|p:.+)$/.test(msg)) {
    await saveSession(wa, { step: "pick", data: {} });
    return sendMenu(wa, products);
  }

  if (s.step === "pick" || s.step === "menu" || s.step === "await") {
    const n = Number(msg);
    const product = msg.startsWith("p:") ? products.find((p) => p.id === msg.slice(2)) : products[n - 1];
    if (!product) {
      await saveSession(wa, { step: "pick", data: {} });
      return sendMenu(wa, products);
    }
    await saveSession(wa, { step: "phone", data: { product: product.id } });
    return sendText(wa,
      `${product.name_en}: ${naira(product.price_kobo)}.\n\n` +
      "Which phone number is on the Ona Iwa Mimo app account this book is for?\n" +
      "Reply 1 if it is this WhatsApp number, or type the number (for example 0803 123 4567). You can buy for someone else this way.\n\n" +
      "Nọ́ńbà fóònù wo ló wà lórí àkáǹtì áàpù tí ìwé yìí jẹ́ fún? Ẹ dáhùn 1 tó bá jẹ́ nọ́ńbà WhatsApp yìí.");
  }

  if (s.step === "phone") {
    const phone = msg === "1" ? wa : cleanPhone(msg);
    if (!phone) return sendText(wa, "That does not look like a phone number. Type it like 0803 123 4567, or reply 1 for this WhatsApp number.\nKọ nọ́ńbà bí 0803 123 4567.");
    const { data: account } = await supabaseService().from("profiles").select("email, full_name").eq("phone", phone).maybeSingle();
    if (account?.email) return makeAccount(wa, { ...s.data, phone }, account.email, account.full_name || name);
    await saveSession(wa, { step: "email", data: { ...s.data, phone } });
    return sendText(wa,
      (account ? "" : `There is no app account with ${phone} yet. That is fine: the book will be waiting when they sign up with that number.\n\n`) +
      "Please type your email address for the payment receipt.\nẸ kọ àdírẹ́sì ímeèlì yín fún ìwé-ẹ̀rí owó.");
  }

  if (s.step === "email") {
    if (!/^\S+@\S+\.\S+$/.test(msg)) return sendText(wa, "Please type a correct email address, like name@gmail.com.\nẸ kọ ímeèlì tó tọ̀nà.");
    return makeAccount(wa, s.data, msg.toLowerCase(), name);
  }

  await saveSession(wa, { step: "pick", data: {} });
  return sendMenu(wa, products);
}

async function makeAccount(wa: string, data: Session["data"], email: string, name: string) {
  const products = await productsOnSale();
  const product = products.find((p) => p.id === data.product);
  if (!product || !data.phone) {
    await saveSession(wa, { step: "pick", data: {} });
    return sendMenu(wa, products);
  }
  try {
    const acc = await startTransferPayment({ product, beneficiaryPhone: data.phone, email, waPhone: wa, name });
    await saveSession(wa, { step: "await", data: { ...data, tx_ref: acc.tx_ref } });
    const until = acc.expires ? new Date(acc.expires).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";
    const { data: p } = await supabaseService().from("payments").select("id").eq("tx_ref", acc.tx_ref).single();
    return sendText(wa,
      `Please transfer exactly ₦${acc.amount.toLocaleString("en-NG")} to:\n\n` +
      `Bank: ${acc.bank}\nAccount number: ${acc.account}\n\n` +
      `This account is for this payment only${until ? ` and works until ${until}` : ""}. ` +
      `The book unlocks by itself for ${data.phone} as soon as the money arrives.\n\n` +
      `Ẹ fi ₦${acc.amount.toLocaleString("en-NG")} ránṣẹ́ sí àkáǹtì òkè yìí. Ìwé náà yóò ṣí fúnra rẹ̀ nígbà tí owó bá dé.\n\nReply 1 after paying to check.`,
      p?.id);
  } catch {
    return sendText(wa, "Sorry, we could not create the account number right now. Please try again in a few minutes, or reply HELP.\nẸ jọ̀wọ́ ẹ gbìyànjú lẹ́ẹ̀kan sí i.");
  }
}

/** Tell the member on WhatsApp that their payment arrived (called once per payment). */
export async function notifyPaid(tx_ref: string) {
  const db = supabaseService();
  const { data: p } = await db.from("payments").select("id, wa_phone, beneficiary_phone, product_id, notified, status, channel").eq("tx_ref", tx_ref).maybeSingle();
  if (!p || p.status !== "paid" || p.notified || !p.wa_phone) return;
  const { data: won } = await db.from("payments").update({ notified: true }).eq("id", p.id).eq("notified", false).select("id");
  if (!won?.length) return;
  const { data: product } = await db.from("products").select("name_en, name_yo").eq("id", p.product_id).single();
  const { data: account } = await db.from("profiles").select("id").eq("phone", p.beneficiary_phone).maybeSingle();
  await db.from("whatsapp_sessions").upsert({ wa_phone: p.wa_phone, step: "menu", data: {}, updated_at: new Date().toISOString() });
  await sendText(p.wa_phone,
    `Payment received. Thank you!\n\n${product?.name_en} is now unlocked for ${p.beneficiary_phone}. ` +
    (account
      ? "Open the Ona Iwa Mimo app and pull down on the Home page to see it."
      : "It will appear in the app when they create an account with that phone number.") +
    `\n\nA ti gba owó náà. Ẹ ṣé o! ${product?.name_yo} ti ṣí fún ${p.beneficiary_phone}.`,
    p.id);
}
