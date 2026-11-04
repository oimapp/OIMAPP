"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cleanPhone, productsOnSale, setting, startWebPayment } from "@/lib/payments";

export type PayState = { error?: string } | null;

export async function startPay(_: PayState, f: FormData): Promise<PayState> {
  const s = (k: string) => String(f.get(k) ?? "").trim();
  if ((await setting<boolean>("pay_web")) === false) return { error: "Paying here is paused for now. Please use the WhatsApp agent or message the help line." };
  const product = (await productsOnSale()).find((p) => p.id === s("product"));
  if (!product) return { error: "Choose a book." };
  const forPhone = cleanPhone(s("for_phone"));
  if (!forPhone) return { error: "Type the phone number on the app account, for example 0803 123 4567." };
  const payerPhone = cleanPhone(s("payer_phone")) ?? forPhone;
  const email = s("email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Type a correct email address for the receipt." };
  const name = s("name");
  if (name.length < 2) return { error: "Type your name." };

  const h = headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  let link: string;
  try {
    ({ link } = await startWebPayment({ product, beneficiaryPhone: forPhone, name, email, payerPhone, redirectUrl: `${origin}/pay/done` }));
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(link);
}
