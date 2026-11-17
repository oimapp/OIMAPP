import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { PrintButton } from "./PrintButton";

// One page with every district, its officers and its churches, so the committee
// can check the names on paper (or save as PDF and share).
export default async function PrintDistricts() {
  await requireAdmin();
  const db = supabaseService();
  const [{ data: districts }, { data: officers }, { data: churches }] = await Promise.all([
    db.from("districts").select("id, name, kind, state, admin_hq").order("name"),
    db.from("district_officers").select("district_id, role, name, phone, sort").order("sort"),
    db.from("churches").select("district_id, name, prophet, phone, is_hq, sort").order("sort").order("name"),
  ]);

  return (
    <div className="bg-white p-2 text-[13px] leading-snug text-ink print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-semibold">Districts, officers and churches</h1>
        <PrintButton />
      </div>
      <p className="mb-4 text-muted">Please check every name and phone number. Write corrections on this list, or correct them in the admin (Districts and churches).</p>
      {(districts ?? []).map((d) => (
        <section key={d.id} className="mb-5 break-inside-avoid border-b border-line pb-3">
          <h2 className="text-base font-bold">{d.name} {d.kind === "annex" ? "(Annexe)" : ""} <span className="font-normal text-muted">{d.state}</span></h2>
          {d.admin_hq && <p className="text-muted">Headquarters: {d.admin_hq}</p>}
          <table className="mt-2 w-full">
            <tbody>
              {(officers ?? []).filter((o) => o.district_id === d.id).map((o, i) => (
                <tr key={i}><td className="w-1/3 py-0.5 pr-2 text-muted">{o.role}</td><td className="py-0.5 pr-2 font-semibold">{o.name || "........................"}</td><td className="py-0.5">{o.phone}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 font-semibold">Churches</p>
          <ol className="ml-5 list-decimal">
            {(churches ?? []).filter((c) => c.district_id === d.id).map((c, i) => (
              <li key={i}>{c.name}{c.is_hq ? " (HQ)" : ""}{c.prophet ? `: ${c.prophet}` : ""}{c.phone ? `, ${c.phone}` : ""}</li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
