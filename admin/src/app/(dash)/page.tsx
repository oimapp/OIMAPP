import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { naira, day } from "@/lib/format";
import { PageTitle, Stat } from "@/components/ui";
import { PaymentsTable } from "./payments/PaymentsTable";

type Overview = {
  members: number; members_today: number; month_kobo: number;
  manual_owners: number; daily_owners: number; children_owners: number; constitution_owners?: number; test_unlocks?: number; test_phones?: number;
  pending_old: number; by_day: { day: string; count: number }[];
};

export default async function OverviewPage() {
  await requireAdmin();
  const { data, error } = await supabaseServer().rpc("admin_overview");
  if (error) throw new Error(error.message);
  const o = data as Overview;
  const db = supabaseService();
  const { data: recent } = await db
    .from("payments")
    .select("id, tx_ref, amount_kobo, status, channel, method, created_at, beneficiary_phone, product_id, payer:profiles!payments_payer_id_fkey(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(6);
  const { data: limit } = await db.from("settings").select("value").eq("key", "phone_moves_per_year").single();
  const { data: heavy } = await db.from("member_phone_moves").select("user_id, moves_this_year").gte("moves_this_year", Number(limit?.value ?? 2));
  const max = Math.max(1, ...o.by_day.map((d) => d.count));

  return (
    <>
      <PageTitle title="Overview" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={o.members.toLocaleString()} note={`${o.members_today} joined today`} />
        <Stat label="Money in this month" value={naira(o.month_kobo)} note="Paid orders, all channels" />
        <Stat label="Sunday School Manual" value={`${o.manual_owners.toLocaleString()} readers`} />
        <Stat label="Daily Divine Bread" value={`${o.daily_owners.toLocaleString()} readers`} note={`Children's Manual: ${o.children_owners} · Constitution: ${o.constitution_owners ?? 0}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="card p-4 lg:col-span-3">
          <h2 className="mb-3 font-semibold">Orders paid, last 14 days</h2>
          <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Orders paid each day for the last 14 days">
            {o.by_day.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] text-muted">{d.count || ""}</span>
                <div className="w-full max-w-[30px] rounded-t bg-brand" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 1 }} />
                <span className="text-[11px] text-muted">{day(d.day, false).split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="px-4 pb-1 pt-4 font-semibold">Needs your attention</h2>
          <ul className="divide-y divide-line">
            {o.pending_old > 0 && (
              <li className="px-4 py-3 text-sm">
                <Link href="/payments?status=pending" className="font-semibold text-brand underline">
                  {o.pending_old} payment{o.pending_old > 1 ? "s" : ""} still waiting after 30 minutes
                </Link>
                <p className="text-muted">Open each one and press "Check with Flutterwave".</p>
              </li>
            )}
            {(heavy ?? []).map((h) => (
              <li key={h.user_id} className="px-4 py-3 text-sm">
                <Link href={`/members/${h.user_id}`} className="font-semibold text-brand underline">
                  A member has changed phones {h.moves_this_year} times this year
                </Link>
                <p className="text-muted">Possible account sharing. Have a look.</p>
              </li>
            ))}
            {(o.test_unlocks ?? 0) > 0 && (
              <li className="px-4 py-3 text-sm">
                <Link href="/settings" className="font-semibold text-brand underline">{o.test_unlocks} book{o.test_unlocks === 1 ? "" : "s"} unlocked by hand for testing</Link>
                <p className="text-muted">On launch day, take them back in Settings &gt; Launch day.</p>
              </li>
            )}
            {o.pending_old === 0 && !(heavy ?? []).length && !(o.test_unlocks ?? 0) && <li className="px-4 py-4 text-sm text-muted">Nothing needs attention right now.</li>}
          </ul>
        </section>
      </div>

      <section className="card mt-4">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="font-semibold">Latest payments</h2>
          <Link href="/payments" className="btn-ghost">See all</Link>
        </div>
        <PaymentsTable rows={(recent ?? []) as never} />
      </section>
    </>
  );
}
