import { confirmPayment, naira } from "@/lib/payments";
import { supabaseService } from "@/lib/supabase/service";
import { Shell } from "../Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment · Ona Iwa Mimo", robots: { index: false } };

// Flutterwave sends the buyer back here after paying, with ?tx_ref=...&status=...
export default async function Done({ searchParams }: { searchParams: { tx_ref?: string; status?: string } }) {
  const tx = searchParams.tx_ref ?? "";
  const r = tx ? await confirmPayment(tx).catch(() => ({ state: "pending" as const })) : { state: "unknown" as const };
  const p = "payment" in r ? r.payment : null;
  const { data: product } = p ? await supabaseService().from("products").select("name_en, name_yo").eq("id", p.product_id).single() : { data: null };
  const { data: account } = p ? await supabaseService().from("profiles").select("id").eq("phone", p.beneficiary_phone).maybeSingle() : { data: null };

  return (
    <Shell>
      <div className="card p-6 text-center">
        {r.state === "paid" ? (
          <>
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-green-50 text-3xl text-green-700">✓</div>
            <h1 className="font-serif text-2xl font-bold">Payment received</h1>
            <p className="mt-1 text-muted">A ti gba owó yín. Ẹ ṣé o!</p>
            <p className="mt-4">
              <b>{product?.name_en}</b> ({naira(p!.amount_kobo)}) is unlocked for <b>{p!.beneficiary_phone}</b>.
            </p>
            <p className="mt-2 text-sm text-muted">
              {account
                ? "Open the Ona Iwa Mimo app and pull down on the Home page. The book will be there."
                : "There is no app account with that number yet. The book will be there as soon as they sign up with it."}
            </p>
          </>
        ) : r.state === "failed" || searchParams.status === "cancelled" ? (
          <>
            <h1 className="font-serif text-2xl font-bold">Payment not completed</h1>
            <p className="mt-2 text-muted">No money was taken. You can try again.</p>
            <a href="/pay" className="btn mt-5">Try again</a>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl font-bold">Waiting for confirmation</h1>
            <p className="mt-2 text-muted">Bank transfers can take a few minutes. The book unlocks by itself when the money arrives. You can close this page.</p>
            <a href={`/pay/done?tx_ref=${encodeURIComponent(tx)}`} className="btn-ghost mt-5">Check again</a>
          </>
        )}
        {tx && <p className="mt-6 text-xs text-muted">Reference: {tx}</p>}
      </div>
    </Shell>
  );
}
