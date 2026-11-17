// Buying books with Google Play (only in the Play Store version of the app).
// 1. Google Play takes the payment.
// 2. The app sends the purchase to the church website, which checks it with Google
//    and unlocks the books on the member's account.
// 3. Only then does the app tell Google the purchase is finished.
// A purchase that was interrupted (no network, app closed) is finished the next
// time the member opens a book page or taps "Restore purchases".

import {
  endConnection, fetchProducts, finishTransaction, getAvailablePurchases, initConnection,
  isUserCancelledError, purchaseErrorListener, purchaseUpdatedListener, requestPurchase,
  type Purchase,
} from "expo-iap";
import { SITE_URL } from "./env";
import { supabase } from "./supabase";

export type BuyResult = "paid" | "pending" | "cancelled" | "failed" | "unavailable";

let connecting: Promise<boolean> | null = null;

async function connect() {
  if (!connecting) {
    connecting = initConnection()
      .then(() => true)
      .catch(() => {
        connecting = null;
        return false;
      });
  }
  return connecting;
}

export async function disconnect() {
  if (connecting) {
    connecting = null;
    await endConnection().catch(() => undefined);
  }
}

/** Google's price for each product, as shown to the member (for example "NGN 1,700.00"). */
export async function playPrices(skus: string[]): Promise<Record<string, string>> {
  if (!skus.length || !(await connect())) return {};
  try {
    const list = (await fetchProducts({ skus, type: "in-app" })) ?? [];
    return Object.fromEntries(list.map((p) => [p.id, p.displayPrice]));
  } catch {
    return {};
  }
}

/** Ask the church website to check a purchase with Google and unlock the books. */
async function confirmOnServer(productId: string, purchaseToken: string): Promise<"paid" | "pending" | "failed"> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return "failed";
  try {
    const res = await fetch(`${SITE_URL}/api/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ productId, purchaseToken }),
    });
    const body = (await res.json().catch(() => ({}))) as { state?: string };
    if (res.ok && body.state === "paid") return "paid";
    if (res.ok && body.state === "pending") return "pending";
    return "failed";
  } catch {
    return "failed";
  }
}

/** Check one purchase on the server; when the books are unlocked, finish it with Google. */
async function settle(p: Purchase): Promise<"paid" | "pending" | "failed"> {
  if (p.purchaseState === "pending") return "pending";
  const token = p.purchaseToken;
  if (!token) return "failed";
  const r = await confirmOnServer(p.productId, token);
  if (r === "paid") await finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
  return r;
}

/** Buy one product. The member's account id goes with the payment so it cannot be claimed by another account. */
export async function buy(sku: string, userId: string): Promise<BuyResult> {
  if (!(await connect())) return "unavailable";
  return new Promise<BuyResult>((resolve) => {
    let done = false;
    const finish = (r: BuyResult) => {
      if (done) return;
      done = true;
      ok.remove();
      bad.remove();
      resolve(r);
    };
    const ok = purchaseUpdatedListener((p) => {
      if (p.productId !== sku) return;
      void settle(p).then(finish);
    });
    const bad = purchaseErrorListener((e) => {
      finish(isUserCancelledError(e) ? "cancelled" : "failed");
    });
    requestPurchase({
      request: { google: { skus: [sku], obfuscatedAccountId: userId } },
      type: "in-app",
    }).catch((e) => finish(isUserCancelledError(e) ? "cancelled" : "failed"));
  });
}

/** Finish any purchase that was paid but not yet unlocked. Returns how many books were unlocked. */
export async function restore(): Promise<number> {
  if (!(await connect())) return 0;
  try {
    const list = await getAvailablePurchases();
    let n = 0;
    for (const p of list ?? []) {
      if ((await settle(p)) === "paid") n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}
