import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { SUPABASE_URL } from "@/lib/env";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveBaba, deleteBaba, saveCouncil, deleteCouncil } from "@/app/actions";

type Person = { id: string; name: string; years: string; sort: number; photo_path: string | null; role: string };

const LISTS: [string, string, string][] = [
  ["baba", "Baba Aladura", "Add a Baba Aladura"],
  ["secretary", "Conference Secretaries", "Add a Conference Secretary"],
];

export default async function LeadersPage({ searchParams }: { searchParams: { tab?: string } }) {
  const admin = await requireAdmin();
  const canEdit = ["owner", "editor"].includes(admin.role);
  const tab = ["baba", "secretary", "council"].includes(searchParams.tab ?? "") ? searchParams.tab! : "baba";
  const db = supabaseService();
  const [{ data: people }, { data: council }] = await Promise.all([
    db.from("baba_aladura").select("*").order("sort").order("name"),
    db.from("council_members").select("*").order("sort"),
  ]);
  const photo = (path: string | null) => (path ? `${SUPABASE_URL()}/storage/v1/object/public/public/${path}` : null);
  const tabs: [string, string][] = [["baba", "Baba Aladura"], ["secretary", "Conference Secretaries"], ["council", "National Executive Council"]];

  return (
    <>
      <PageTitle title="Leaders" />
      <p className="mb-4 max-w-3xl text-sm text-muted">Each list has its own tab in the app (Church &gt; Leaders). People are shown in the order of the number you give, earliest first.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <a key={k} href={`/babas?tab=${k}`} className={`rounded-full px-3 py-1.5 text-sm ${tab === k ? "bg-brand text-white" : "bg-white text-muted"}`}>{label}</a>
        ))}
      </div>

      {tab === "council" ? (
        <Council rows={council ?? []} canEdit={canEdit} />
      ) : (
        LISTS.filter(([role]) => role === tab).map(([role, title, addLabel]) => {
          const list = ((people ?? []) as Person[]).filter((p) => (p.role ?? "baba") === role);
          return (
            <div key={role}>
              {canEdit && (
                <section className="card mb-5 p-5">
                  <h2 className="mb-3 font-semibold">{addLabel}</h2>
                  <ActionForm action={saveBaba} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
                    <input type="hidden" name="role" value={role} />
                    <div><label className="label">Order number</label><input name="sort" className="input" inputMode="numeric" placeholder="1" /></div>
                    <div><label className="label">Name</label><input name="name" className="input" required /></div>
                    <div><label className="label">Years</label><input name="years" className="input" placeholder="e.g. 1925 to 1933" /></div>
                    <div><label className="label">Photo</label><input name="photo" type="file" accept="image/jpeg,image/png" className="text-sm" /></div>
                    <div className="sm:col-span-4"><Submit>Add</Submit></div>
                  </ActionForm>
                </section>
              )}
              <h2 className="mb-3 font-semibold">{title}</h2>
              {!list.length ? <div className="card"><Empty>None added yet.</Empty></div> : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {list.map((b) => (
                    <div key={b.id} className="card p-3">
                      {photo(b.photo_path) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo(b.photo_path)!} alt={b.name} className="aspect-[3/4] w-full rounded-lg object-cover" />
                      ) : (
                        <div className="grid aspect-[3/4] w-full place-items-center rounded-lg border-2 border-dashed border-line text-xs text-muted">No photo</div>
                      )}
                      <div className="mt-2 text-sm font-semibold">{b.sort}. {b.name}</div>
                      <div className="text-xs text-muted">{b.years}</div>
                      {canEdit && (
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer text-brand underline">Edit</summary>
                          <ActionForm action={saveBaba} className="mt-2 space-y-2">
                            <input type="hidden" name="id" value={b.id} />
                            <input name="sort" defaultValue={b.sort} className="input" inputMode="numeric" />
                            <input name="name" defaultValue={b.name} className="input" required />
                            <input name="years" defaultValue={b.years} className="input" />
                            <select name="role" defaultValue={b.role ?? "baba"} className="input">
                              <option value="baba">Baba Aladura</option>
                              <option value="secretary">Conference Secretary</option>
                            </select>
                            <input name="photo" type="file" accept="image/jpeg,image/png" className="text-xs" />
                            <Submit variant="btn-ghost">Save</Submit>
                          </ActionForm>
                          <ActionForm action={deleteBaba} confirm={`Remove ${b.name}?`} className="mt-2">
                            <input type="hidden" name="id" value={b.id} />
                            <Submit variant="btn-danger">Remove</Submit>
                          </ActionForm>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}

function Council({ rows, canEdit }: { rows: { id: string; post: string; name: string; sort: number }[]; canEdit: boolean }) {
  return (
    <>
      {canEdit && (
        <section className="card mb-5 p-5">
          <h2 className="mb-3 font-semibold">Add a member of the National Executive Council</h2>
          <ActionForm action={saveCouncil} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
            <div><label className="label">Order number</label><input name="sort" className="input" inputMode="numeric" /></div>
            <div><label className="label">Post</label><input name="post" className="input" required placeholder="e.g. General Secretary" /></div>
            <div className="sm:col-span-2"><label className="label">Name</label><input name="name" className="input" /></div>
            <div className="sm:col-span-4"><Submit>Add</Submit></div>
          </ActionForm>
        </section>
      )}
      <div className="card divide-y divide-line">
        {!rows.length && <Empty>None added yet.</Empty>}
        {rows.map((r) => (
          <details key={r.id} className="px-4 py-3">
            <summary className="cursor-pointer text-sm"><span className="text-muted">{r.sort}. {r.post}:</span> <b>{r.name || "-"}</b></summary>
            {canEdit && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <ActionForm action={saveCouncil} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="sort" defaultValue={r.sort} className="input w-20" inputMode="numeric" />
                  <input name="post" defaultValue={r.post} className="input w-64" required />
                  <input name="name" defaultValue={r.name} className="input w-72" />
                  <Submit variant="btn-ghost">Save</Submit>
                </ActionForm>
                <ActionForm action={deleteCouncil} confirm={`Remove ${r.post}?`}>
                  <input type="hidden" name="id" value={r.id} />
                  <Submit variant="btn-danger">Remove</Submit>
                </ActionForm>
              </div>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
