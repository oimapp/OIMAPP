import "server-only";
import { randomBytes } from "node:crypto";
import { FLUTTERWAVE_SECRET_KEY } from "./env";
import { supabaseService } from "./supabase/service";
import { unlockPayment } from "./unlock";

const FLW = "https://api.flutterwave.com/v3";

export type Product = { id: string; name_en: string; name_yo: string; price_kobo: number; book_ids: string[]; on_sale: boolean };

/** +2348031234567 from 0803 123 4567, 2348031234567 or +234... ; null if it is not a phone number. */
export function cleanPhone(p: string) {
  const d = p.replace(/[^\d+]/g, "");
  if (/^0[789][01]\d{8}$/.test(d)) return `+234${d.slice(1)}`;
  if (/^234\d{10}$/.test(d)) return `+${d}`;
  if (/^\+[1-9]\d{9,14}$/.test(d)) return d;
  return null;
}

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export function newTxRef(channel: string) {
  return `OIM-${channel.slice(0, 2).toUpperCase()}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`.toUpperCase();
}

async function flw(path: string, init?: RequestInit) {
  const res = await fetch(`${FLW}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

export async function productsOnSale(): Promise<Product[]> {
  const { data } = await supabaseService().from("products").select("*").eq("on_sale", true).order("sort");
  return (data ?? []) as Product[];
}

export async function setting<T>(key: string): Promise<T | undefined> {
  const { data } = await supabaseService().from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value as T | undefined;
}

/** Payment page: make a payment and get Flutterwave's checkout link (card, transfer, USSD). */
export async function startWebPayment(opts: {
  product: Product; beneficiaryPhone: string; name: string; email: string; payerPhone: string; redirectUrl: string;
}) {
  const db = supabaseService();
  const tx_ref = newTxRef("web");
  const { data: payer } = await db.from("profiles").select("id").eq("phone", opts.payerPhone).maybeSingle();
  const { error } = await db.from("payments").insert({
    tx_ref, payer_id: payer?.id ?? null, beneficiary_phone: opts.beneficiaryPhone, product_id: opts.product.id,
    amount_kobo: opts.product.price_kobo, channel: "web", payer_name: opts.name, payer_email: opts.email,
  });
  if (error) throw new Error("Could not start the payment. Please try again.");
  const { ok, body } = await flw("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref, amount: opts.product.price_kobo / 100, currency: "NGN",
      redirect_url: opts.redirectUrl,
      customer: { email: opts.email, phonenumber: opts.payerPhone, name: opts.name },
      customizations: { title: "Ona Iwa Mimo", description: opts.product.name_en },
      meta: { beneficiary_phone: opts.beneficiaryPhone, product: opts.product.id },
    }),
  });
  if (!ok || !body?.data?.link) throw new Error("Flutterwave did not answer. Please try again in a minute.");
  return { tx_ref, link: body.data.link as string };
}

/** WhatsApp agent: a one-time bank account for this exact amount (expires in about an hour). */
export async function startTransferPayment(opts: {
  product: Product; beneficiaryPhone: string; email: string; waPhone: string; name: string;
}) {
  const db = supabaseService();
  const tx_ref = newTxRef("whatsapp");
  const { data: payer } = await db.from("profiles").select("id").eq("phone", opts.waPhone).maybeSingle();
  const { error } = await db.from("payments").insert({
    tx_ref, payer_id: payer?.id ?? null, beneficiary_phone: opts.beneficiaryPhone, product_id: opts.product.id,
    amount_kobo: opts.product.price_kobo, channel: "whatsapp", method: "banktransfer",
    payer_name: opts.name, payer_email: opts.email, wa_phone: opts.waPhone,
  });
  if (error) throw new Error("payment_insert");
  const [first, ...rest] = (opts.name || "Ona Iwa Mimo member").split(" ");
  const { ok, body } = await flw("/virtual-account-numbers", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email, amount: opts.product.price_kobo / 100, tx_ref, is_permanent: false,
      phonenumber: opts.waPhone.replace("+234", "0"), firstname: first, lastname: rest.join(" ") || "Member",
      narration: `Ona Iwa Mimo ${opts.product.name_en}`,
    }),
  });
  const d = body?.data;
  if (!ok || !d?.account_number) throw new Error("flutterwave_account");
  await db.from("payments").update({
    account_number: d.account_number, account_bank: d.bank_name,
    account_expires_at: d.expiry_date ? new Date(d.expiry_date).toISOString() : null,
  }).eq("tx_ref", tx_ref);
  return { tx_ref, account: d.account_number as string, bank: d.bank_name as string, amount: Number(d.amount ?? opts.product.price_kobo / 100), expires: d.expiry_date as string | undefined };
}

/**
 * Ask Flutterwave whether a payment is complete. If it is, mark it paid and unlock the books.
 * Safe to call many times (the webhook, the return page and the admin may all call it).
 */
export async function confirmPayment(tx_ref: string) {
  const db = supabaseService();
  const { data: p } = await db.from("payments").select("*").eq("tx_ref", tx_ref).maybeSingle();
  if (!p) return { state: "unknown" as const };
  if (p.status === "paid") return { state: "paid" as const, payment: p, already: true };

  const { ok, body } = await flw(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`);
  const tx = body?.data;
  const paid = ok && tx?.status === "successful" && tx?.currency === "NGN" && Math.round(Number(tx?.amount) * 100) >= p.amount_kobo;
  if (!paid) {
    if (ok && tx?.status === "failed") await db.from("payments").update({ status: "failed", raw: tx }).eq("id", p.id).eq("status", "pending");
    return { state: (tx?.status as string) === "failed" ? ("failed" as const) : ("pending" as const), payment: p };
  }
  // Only one caller wins the change from pending to paid, so books are unlocked once.
  const { data: won } = await db.from("payments")
    .update({ status: "paid", flw_transaction_id: tx.id, method: tx.payment_type ?? p.method, verified_at: new Date().toISOString(), raw: tx })
    .eq("id", p.id).neq("status", "paid").select("id");
  const result = await unlockPayment(p);
  return { state: "paid" as const, payment: { ...p, status: "paid" }, unlocked: result, already: !won?.length };
}
