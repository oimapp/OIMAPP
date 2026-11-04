import Link from "next/link";
import { naira, when } from "@/lib/format";
import { Pill, PAY_STATUS, Empty } from "@/components/ui";

export type PaymentRow = {
  id: string; tx_ref: string; amount_kobo: number; status: string; channel: string; method: string | null;
  created_at: string; beneficiary_phone: string; product_id: string;
  payer: { full_name: string; phone: string | null } | null;
  payer_name?: string;
  wa_phone?: string | null;
};

const CHANNEL: Record<string, string> = { web: "Payment page", whatsapp: "WhatsApp agent", google_play: "Google Play", admin: "Admin" };

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  if (!rows.length) return <Empty>No payments yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr><th className="th">Paid by</th><th className="th">For</th><th className="th">Amount</th><th className="th">How</th><th className="th">Status</th><th className="th">When</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const [tone, label] = PAY_STATUS[p.status] ?? ["grey", p.status];
            const gift = p.payer?.phone && p.payer.phone !== p.beneficiary_phone;
            return (
              <tr key={p.id} className="hover:bg-paper">
                <td className="td">
                  <Link href={`/payments/${p.id}`} className="font-semibold text-brand underline">{p.payer?.full_name || p.payer_name || p.wa_phone || "No name"}</Link>
                  <div className="text-xs text-muted">{p.payer?.phone ?? p.wa_phone}{gift || !p.payer ? ` · for ${p.beneficiary_phone}` : ""}</div>
                </td>
                <td className="td">{p.product_id}</td>
                <td className="td whitespace-nowrap">{naira(p.amount_kobo)}</td>
                <td className="td">{CHANNEL[p.channel] ?? p.channel}{p.method ? <div className="text-xs text-muted">{p.method}</div> : null}</td>
                <td className="td"><Pill tone={tone}>{label}</Pill></td>
                <td className="td whitespace-nowrap text-xs">{when(p.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
