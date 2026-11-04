import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { naira, when } from "@/lib/format";
import { PageTitle, Pill, PAY_STATUS } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { checkWithFlutterwave } from "@/app/actions";

export default async function PaymentPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const { data: p } = await supabaseService()
    .from("payments")
    .select("*, payer:profiles!payments_payer_id_fkey(id, full_name, phone)")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();
  const [tone, label] = PAY_STATUS[p.status] ?? ["grey", p.status];
  const rows: [string, React.ReactNode][] = [
    ["Status", <Pill key="s" tone={tone}>{label}</Pill>],
    ["Paid by", p.payer ? <Link key="m" href={`/members/${p.payer.id}`} className="text-brand underline">{p.payer.full_name || p.payer.phone}</Link> : [p.payer_name, p.payer_email, p.wa_phone].filter(Boolean).join(" · ") || "Unknown"],
    ["For phone number", p.beneficiary_phone],
    ["Product", p.product_id],
    ["Amount", naira(p.amount_kobo)],
    ["Channel", p.channel],
    ["Method", p.method ?? ""],
    ["Our reference", p.tx_ref],
    ["Flutterwave ID", p.flw_transaction_id ?? ""],
    ["Google Play order", p.play_order_id ?? ""],
    ["Created", when(p.created_at)],
    ["Confirmed", when(p.verified_at)],
  ];

  return (
    <>
      <PageTitle title="Payment"><Link href="/payments" className="btn-ghost">Back to payments</Link></PageTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <dl className="card grid grid-cols-[150px_1fr] gap-x-4 gap-y-2.5 p-5 text-sm lg:col-span-2">
          {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted">{k}</dt><dd className="font-medium break-all">{v}</dd></Fragment>))}
        </dl>
        {p.status !== "paid" && p.channel !== "google_play" && ["owner", "support"].includes(admin.role) && (
          <div className="card p-5">
            <h2 className="font-semibold">Member says they paid?</h2>
            <p className="mb-4 mt-1 text-sm text-muted">This asks Flutterwave directly. If the money arrived, the payment is marked paid and the books unlock on their phone.</p>
            <ActionForm action={checkWithFlutterwave}>
              <input type="hidden" name="id" value={p.id} />
              <Submit>Check with Flutterwave</Submit>
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}
