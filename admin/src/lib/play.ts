import "server-only";
import { createSign } from "node:crypto";
import { supabaseService } from "./supabase/service";
import { unlockPayment } from "./unlock";

// Google Play purchases: the app sends the purchase token here, we ask Google
// whether it is real and paid, then unlock the books and tell Google we delivered
// them ("acknowledge"). Google refunds purchases that are not acknowledged in 3 days.

export const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || "com.onaiwamimo.app";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

type Key = { client_email: string; private_key: string };
let cached: { token: string; until: number } | null = null;

async function serviceKey(): Promise<Key> {
  const { data } = await supabaseService().from("server_secrets").select("value").eq("key", "google_play").maybeSingle();
  if (!data) throw new PlayError("no_key", "The Google Play key has not been saved in the admin (Settings > Google Play payments).");
  return JSON.parse(data.value) as Key;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** An access token for the Google Play Developer API, made from the service account key. */
async function accessToken() {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const key = await serviceKey();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${signature}` }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new PlayError("google_auth", `Google refused the key: ${body.error_description ?? res.status}`);
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export class PlayError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type GooglePurchase = {
  purchaseState?: number;          // 0 paid, 1 cancelled, 2 pending
  acknowledgementState?: number;   // 0 not yet, 1 done
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  purchaseTimeMillis?: string;
  regionCode?: string;
  purchaseType?: number;           // 0 = test purchase by a licence tester (no money taken)
};

async function google(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/${ANDROID_PACKAGE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, body };
}

/**
 * Check one purchase with Google and unlock the books for the member who bought it.
 * Safe to call again for the same purchase.
 */
export async function confirmPlayPurchase(userId: string, productId: string, purchaseToken: string) {
  const db = supabaseService();
  const { data: product } = await db.from("products").select("id, price_kobo, book_ids").eq("play_product_id", productId).maybeSingle();
  if (!product) throw new PlayError("unknown_product", `No product uses the Google Play ID ${productId}.`);
  const { data: me } = await db.from("profiles").select("id, phone").eq("id", userId).maybeSingle();
  if (!me?.phone) throw new PlayError("no_profile", "This account has no phone number yet.");

  // Already done before: make sure the books are there and stop.
  const { data: done } = await db.from("payments").select("id, payer_id, beneficiary_phone, product_id, status")
    .eq("play_purchase_token", purchaseToken).maybeSingle();
  if (done?.status === "paid") {
    if (done.payer_id && done.payer_id !== userId) throw new PlayError("other_account", "This purchase belongs to another account.");
    const r = await unlockPayment(done);
    return { state: "paid" as const, books: r.books };
  }

  const g = await google(`/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`);
  if (!g.ok) throw new PlayError("google_check", `Google could not find this purchase (${g.status}).`);
  const p = g.body as GooglePurchase;
  if (p.purchaseState === 2) return { state: "pending" as const, books: [] };
  if (p.purchaseState !== 0) throw new PlayError("not_paid", "Google says this purchase was cancelled.");
  if (p.obfuscatedExternalAccountId && p.obfuscatedExternalAccountId !== userId) {
    throw new PlayError("other_account", "This purchase was made from another account.");
  }

  const row = {
    tx_ref: `PLAY-${p.orderId ?? purchaseToken.slice(0, 24)}`,
    payer_id: userId,
    beneficiary_phone: me.phone,
    product_id: product.id,
    amount_kobo: product.price_kobo,
    status: "paid",
    channel: "google_play",
    method: p.purchaseType === 0 ? "google_play_test" : "google_play",
    verified_at: new Date().toISOString(),
    play_order_id: p.orderId ?? null,
    play_purchase_token: purchaseToken,
    raw: p,
  };
  const { data: saved, error } = await db.from("payments").upsert(row, { onConflict: "play_purchase_token" })
    .select("id, payer_id, beneficiary_phone, product_id").single();
  if (error || !saved) throw new PlayError("save", error?.message ?? "Could not save the payment.");
  const r = await unlockPayment(saved);

  if (p.acknowledgementState !== 1) {
    await google(`/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
      method: "POST", body: JSON.stringify({ developerPayload: saved.id }),
    }).catch(() => undefined); // the app also acknowledges after this answer
  }
  return { state: "paid" as const, books: r.books };
}
