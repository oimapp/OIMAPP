import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import Link from "next/link";
import { addDistrict, deleteDistrict, saveChurch, deleteChurch, saveOfficer, deleteOfficer } from "@/app/actions";

type Church = { id: string; name: string; town: string; address: string; prophet: string; phone: string; district_id: string; is_hq: boolean; map_url: string };

function ChurchFields({ c, districts }: { c: Partial<Church>; districts: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="label">District</label>
        <select name="district_id" defaultValue={c.district_id} className="input" required>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div><label className="label">Church name</label><input name="name" defaultValue={c.name} className="input" required /></div>
      <div><label className="label">Town</label><input name="town" defaultValue={c.town} className="input" /></div>
      <div><label className="label">Address</label><input name="address" defaultValue={c.address} className="input" /></div>
      <div><label className="label">Prophet in charge</label><input name="prophet" defaultValue={c.prophet} className="input" /></div>
      <div><label className="label">Phone number</label><input name="phone" defaultValue={c.phone} className="input" inputMode="tel" /></div>
      <div className="sm:col-span-3"><label className="label">Google Maps link (optional)</label><input name="map_url" defaultValue={c.map_url} className="input" placeholder="Open the church in Google Maps, tap Share, copy the link and paste it here" /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <input type="checkbox" name="is_hq" defaultChecked={c.is_hq} className="h-4 w-4" />
        <span><b>District headquarters</b> <span className="text-muted">(shown under the district name in the app; only one per district)</span></span>
      </label>
    </div>
  );
}

export default async function DistrictsPage() {
  const admin = await requireAdmin();
  const canEdit = ["owner", "editor"].includes(admin.role);
  const db = supabaseService();
  const [{ data: districts }, { data: churches }, { data: officers }] = await Promise.all([
    db.from("districts").select("*").order("name"),
    db.from("churches").select("*").order("sort").order("name"),
    db.from("district_officers").select("*").order("sort"),
  ]);
  const list = districts ?? [];

  return (
    <>
      <PageTitle title="Districts and churches"><Link href="/districts/print" className="btn-ghost">Print list for checking</Link></PageTitle>
      <p className="mb-4 text-sm text-muted">Free for all members, shown in A to Z order. Tap a church or &quot;Officers&quot; to correct a name or phone number.</p>
      {canEdit && (
        <div className="mb-5 grid gap-4 lg:grid-cols-3">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Add a district</h2>
            <ActionForm action={addDistrict} resetOnSuccess>
              <input name="name" className="input mb-2" placeholder="District name" required />

              <Submit>Add district</Submit>
            </ActionForm>
          </section>
          {list.length > 0 && (
            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Add a church</h2>
              <ActionForm action={saveChurch} resetOnSuccess>
                <ChurchFields c={{}} districts={list} />
                <div className="mt-3"><Submit>Add church</Submit></div>
              </ActionForm>
            </section>
          )}
        </div>
      )}
      {!list.length && <div className="card"><Empty>No districts yet.</Empty></div>}
      {list.map((d) => {
        const mine = (churches ?? []).filter((c) => c.district_id === d.id).sort((a, b) => Number(b.is_hq) - Number(a.is_hq));
        const hq = mine.find((c) => c.is_hq);
        return (
          <section key={d.id} className="card mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
              <div>
                <h2 className="font-semibold">{d.name} <span className="text-sm font-normal text-muted">({mine.length} churches)</span></h2>
                <p className="text-sm text-muted">Headquarters: {hq ? <b className="text-ink">{hq.name}{hq.town ? `, ${hq.town}` : ""}</b> : "not chosen yet (tick it on one church)"}</p>
              </div>
              {canEdit && !mine.length && (
                <ActionForm action={deleteDistrict} confirm={`Delete the district "${d.name}"?`}>
                  <input type="hidden" name="id" value={d.id} />
                  <Submit variant="btn-danger">Delete district</Submit>
                </ActionForm>
              )}
            </div>
            <details className="mx-4 mt-3 rounded-lg bg-paper px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-brand">Officers ({(officers ?? []).filter((o) => o.district_id === d.id).length})</summary>
              <div className="mt-2 space-y-2">
                {(officers ?? []).filter((o) => o.district_id === d.id).map((o) => (
                  <div key={o.id} className="flex flex-wrap items-end gap-2">
                    {canEdit ? (
                      <>
                        <ActionForm action={saveOfficer} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="district_id" value={d.id} />
                          <input name="sort" defaultValue={o.sort} className="input w-16" inputMode="numeric" aria-label="Order" />
                          <input name="role" defaultValue={o.role} className="input w-48" aria-label="Office" />
                          <input name="name" defaultValue={o.name} className="input w-64" aria-label="Name" />
                          <input name="phone" defaultValue={o.phone} className="input w-40" aria-label="Phone" />
                          <Submit variant="btn-ghost">Save</Submit>
                        </ActionForm>
                        <ActionForm action={deleteOfficer} confirm={`Remove ${o.role}?`}>
                          <input type="hidden" name="id" value={o.id} />
                          <Submit variant="btn-danger">Remove</Submit>
                        </ActionForm>
                      </>
                    ) : (
                      <p className="text-sm"><span className="text-muted">{o.role}:</span> <b>{o.name}</b> {o.phone}</p>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <ActionForm action={saveOfficer} resetOnSuccess className="flex flex-wrap items-end gap-2 border-t border-line pt-2">
                    <input type="hidden" name="district_id" value={d.id} />
                    <input name="sort" className="input w-16" inputMode="numeric" placeholder="No." />
                    <input name="role" className="input w-48" placeholder="Office, e.g. Chairman" required />
                    <input name="name" className="input w-64" placeholder="Name" />
                    <input name="phone" className="input w-40" placeholder="Phone" />
                    <Submit variant="btn-ghost">Add officer</Submit>
                  </ActionForm>
                )}
              </div>
            </details>
            <div className="divide-y divide-line">
              {mine.map((c) => (
                <details key={c.id} className="px-4 py-3">
                  <summary className="cursor-pointer text-sm">{c.is_hq && <span className="mr-2 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand">HQ</span>}<b>{c.name}</b> <span className="text-muted">· {c.town} · {c.prophet} · {c.phone}</span></summary>
                  {canEdit && (
                    <div className="mt-3">
                      <ActionForm action={saveChurch}>
                        <input type="hidden" name="id" value={c.id} />
                        <ChurchFields c={c} districts={list} />
                        <div className="mt-3"><Submit variant="btn-ghost">Save changes</Submit></div>
                      </ActionForm>
                      <ActionForm action={deleteChurch} confirm={`Delete "${c.name}"?`} className="mt-2">
                        <input type="hidden" name="id" value={c.id} />
                        <Submit variant="btn-danger">Delete church</Submit>
                      </ActionForm>
                    </div>
                  )}
                </details>
              ))}
            </div>
            {!mine.length && <Empty>No churches in this district yet.</Empty>}
          </section>
        );
      })}
    </>
  );
}
