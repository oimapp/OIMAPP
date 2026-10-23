import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { PageTitle } from "@/components/ui";
import { PaymentsTable } from "./PaymentsTable";

const FILTERS = [["", "All"], ["paid", "Paid"], ["pending", "Waiting"], ["failed", "Failed"]];

export default async function PaymentsPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireAdmin();
  const status = searchParams.status ?? "";
  const q = (searchParams.q ?? "").trim();
  let query = supabaseService()
    .from("payments")
    .select("id, tx_ref, amount_kobo, status, channel, method, created_at, beneficiary_phone, product_id, payer:profiles!payments_payer_id_fkey(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`tx_ref.ilike.%${q.replace(/[%,()]/g, "")}%,beneficiary_phone.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <>
      <PageTitle title="Payments" />
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search payment reference or phone number" className="input max-w-sm" />
        <input type="hidden" name="status" value={status} />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={`/payments?status=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${status === v ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{l}</Link>
        ))}
      </div>
      <div className="card"><PaymentsTable rows={(data ?? []) as never} /></div>
      <p className="mt-2 text-xs text-muted">Showing the latest 200.</p>
    </>
  );
}
