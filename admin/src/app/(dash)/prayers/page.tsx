import Link from "next/link";
import { ALL_ROLES, requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { when } from "@/lib/format";
import { PageTitle, Empty, Pill } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { setRequestStatus } from "@/app/actions";

const STATUS: Record<string, ["green" | "amber" | "grey" | "blue", string]> = {
  new: ["amber", "New"], prayed: ["green", "Done"], approved: ["blue", "Shared in the app"], hidden: ["grey", "Hidden"],
};
const KIND: Record<string, ["red" | "blue" | "green", string]> = {
  prayer: ["red", "Prayer request"], counselling: ["green", "Counselling"], testimony: ["blue", "Testimony"],
};
const TOPIC: Record<string, string> = { singles: "Singles", married: "Married", other: "Other" };

function Btn({ id, status, label, variant = "btn-ghost" }: { id: string; status: string; label: string; variant?: "btn-ghost" | "btn-danger" }) {
  return (
    <ActionForm action={setRequestStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Submit variant={variant}>{label}</Submit>
    </ActionForm>
  );
}

export default async function PrayersPage({ searchParams }: { searchParams: { k?: string; s?: string } }) {
  const admin = await requireAdmin(ALL_ROLES);
  // Who may read what: prayer requests and counselling only by the people the main admin chose.
  const kinds = [
    ...(admin.readsPrayers ? ["prayer"] : []),
    ...(admin.readsCounselling ? ["counselling"] : []),
    ...(admin.role !== "reader" ? ["testimony"] : []),
  ];
  const k = kinds.includes(searchParams.k ?? "") ? searchParams.k! : "";
  const s = searchParams.s ?? "new";

  let data: Record<string, any>[] = [];
  if (kinds.length) {
    let q = supabaseService().from("prayer_requests").select("*, profiles(full_name, phone, parish)")
      .in("kind", k ? [k] : kinds).order("created_at", { ascending: false }).limit(200);
    if (s !== "all") q = q.eq("status", s);
    data = (await q).data ?? [];
  }
  const tab = (label: string, kk: string, ss: string) => (
    <Link href={`/prayers?k=${kk}&s=${ss}`} className={`rounded-full px-3 py-1.5 text-sm ${k === kk && s === ss ? "bg-brand text-white" : "bg-white text-muted"}`}>{label}</Link>
  );

  return (
    <>
      <PageTitle title={admin.role === "reader" ? "Prayer and counselling requests" : "Prayer, counselling and testimonies"} />
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Prayer requests and counselling requests are private. Only the people the main admin chose in Settings &gt; Admin team can read them
        {admin.readsPrayers || admin.readsCounselling ? ", and you are one of them" : ""}. Testimonies only show in the app after you press &quot;Share in the app&quot;.
      </p>
      {!kinds.length ? (
        <div className="card"><Empty>You have not been given access to any requests.</Empty></div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {tab("New", "", "new")}
            {kinds.includes("prayer") && tab("Prayer requests", "prayer", "all")}
            {kinds.includes("counselling") && tab("Counselling", "counselling", "all")}
            {kinds.includes("testimony") && tab("Testimonies", "testimony", "all")}
            {kinds.includes("testimony") && tab("Shared", "testimony", "approved")}
            {tab("Everything", "", "all")}
          </div>
          <div className="space-y-3">
            {!data.length && <div className="card"><Empty>Nothing here.</Empty></div>}
            {data.map((r) => {
              const [tone, label] = STATUS[r.status] ?? ["grey", r.status];
              const [ktone, klabel] = KIND[r.kind] ?? ["blue", r.kind];
              const p = r.profiles as { full_name?: string; phone?: string; parish?: string } | null;
              return (
                <div key={r.id} className="card p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Pill tone={ktone}>{klabel}{r.topic ? `: ${TOPIC[r.topic] ?? r.topic}` : ""}</Pill>
                    <Pill tone={tone}>{label}</Pill>
                    <span>{when(r.created_at)}</span>
                    <span>· {p?.full_name} {p?.phone} {p?.parish ? `· ${p.parish}` : ""}</span>
                    {r.kind === "testimony" && <span>· shown as: {r.display_name || "A member"}</span>}
                  </div>
                  <p className="whitespace-pre-wrap font-serif leading-relaxed">{r.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.kind === "prayer" && r.status !== "prayed" && <Btn id={r.id} status="prayed" label="Mark as prayed for" />}
                    {r.kind === "counselling" && r.status !== "prayed" && <Btn id={r.id} status="prayed" label="Mark as attended to" />}
                    {r.kind === "counselling" && p?.phone && (
                      <a className="btn-ghost" href={`https://wa.me/${p.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp {p.full_name?.split(" ")[0]}</a>
                    )}
                    {r.kind === "testimony" && r.status !== "approved" && <Btn id={r.id} status="approved" label="Share in the app" />}
                    {r.status !== "hidden" && <Btn id={r.id} status="hidden" label={r.status === "approved" ? "Stop sharing" : "Hide"} variant="btn-danger" />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
