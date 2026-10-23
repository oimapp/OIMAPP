import "server-only";
import { supabaseService } from "./supabase/service";

type Payment = {
  id: string;
  payer_id: string;
  beneficiary_phone: string;
  product_id: string;
};

/**
 * Give the books in a paid order to the person they were bought for.
 * If that phone number has no account yet, the books wait as gifts and
 * arrive automatically when they sign up (see claim_gifts in the database).
 * Safe to run twice.
 */
export async function unlockPayment(p: Payment): Promise<{ to: "account" | "gift"; books: string[] }> {
  const db = supabaseService();
  const { data: product, error } = await db.from("products").select("book_ids").eq("id", p.product_id).single();
  if (error || !product) throw new Error("Product not found for this payment.");
  const books: string[] = product.book_ids;

  const { data: person } = await db.from("profiles").select("id").eq("phone", p.beneficiary_phone).maybeSingle();
  if (person) {
    const source = person.id === p.payer_id ? "purchase" : "gift";
    const rows = books.map((book_id) => ({ user_id: person.id, book_id, source, payment_id: p.id }));
    const { error: e } = await db.from("entitlements").upsert(rows, { onConflict: "user_id,book_id", ignoreDuplicates: true });
    if (e) throw new Error(e.message);
    return { to: "account", books };
  }
  const rows = books.map((book_id) => ({ phone: p.beneficiary_phone, book_id, payment_id: p.id }));
  const { error: e } = await db.from("gifts").upsert(rows, { onConflict: "phone,book_id", ignoreDuplicates: true });
  if (e) throw new Error(e.message);
  return { to: "gift", books };
}
