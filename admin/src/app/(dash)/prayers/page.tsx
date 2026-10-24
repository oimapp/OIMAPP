import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { when } from "@/lib/format";
import { PageTitle, Empty, Pill } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { setRequestStatus } from "@/app/actions";

const STATUS: Record<string, ["green" | "amber" | "grey" | "blue", string]> = {
  new: ["amber", "New"], prayed: ["green", "Prayed for"], approved: ["blue", "Shared in the app"], hidden: ["grey", "Hidden"],
};

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
  await requireAdmin();
  const k = searchParams.k === "testimony" ? "testimony" : searchParams.k === "prayer" ? "prayer" : "";
  const s = searchParams.s ?? "new";
  let q = supabaseService().from("prayer_requests").select("*, profiles(full_name, phone, parish)").order("created_at", { ascending: false }).limit(200);
  if (k) q = q.eq("kind", k);
  if (s !== "all") q = q.eq("status", s);
  const { data } = await q;
  const tab = (label: string, kk: string, ss: string) => (
    <Link href={`/prayers?k=${kk}&s=${ss}`} className={`rounded-full px-3 py-1.5 text-sm ${k === kk && s === ss ? "bg-brand text-white" : "bg-white text-muted"}`}>{label}</Link>
  );

  return (
    <>
      <PageTitle title="Prayer requests and testimonies" />
      <p className="mb-4 max-w-3xl text-sm text-muted">Prayer requests are private. Testimonies only show in the app after you press &quot;Share in the app&quot;.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {tab("New", "", "new")}{tab("Prayer requests", "prayer", "all")}{tab("Testimonies", "testimony", "all")}{tab("Shared", "testimony", "approved")}{tab("Everything", "", "all")}
      </div>
      <div className="space-y-3">
        {!data?.length && <div className="card"><Empty>Nothing here.</Empty></div>}
        {(data ?? []).map((r) => {
          const [tone, label] = STATUS[r.status] ?? ["grey", r.status];
          const p = r.profiles as { full_name?: string; phone?: string; parish?: string } | null;
          return (
            <div key={r.id} className="card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Pill tone={r.kind === "prayer" ? "red" : "blue"}>{r.kind === "prayer" ? "Prayer request" : "Testimony"}</Pill>
                <Pill tone={tone}>{label}</Pill>
                <span>{when(r.created_at)}</span>
                <span>· {p?.full_name} {p?.phone} {p?.parish ? `· ${p.parish}` : ""}</span>
                {r.kind === "testimony" && <span>· shown as: {r.display_name || "A member"}</span>}
              </div>
              <p className="whitespace-pre-wrap font-serif leading-relaxed">{r.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.kind === "prayer" && r.status !== "prayed" && <Btn id={r.id} status="prayed" label="Mark as prayed for" />}
                {r.kind === "testimony" && r.status !== "approved" && <Btn id={r.id} status="approved" label="Share in the app" />}
                {r.status !== "hidden" && <Btn id={r.id} status="hidden" label={r.status === "approved" ? "Stop sharing" : "Hide"} variant="btn-danger" />}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
