import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { SUPABASE_URL } from "@/lib/env";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveBaba, deleteBaba } from "@/app/actions";

export default async function BabasPage() {
  const admin = await requireAdmin();
  const canEdit = ["owner", "editor"].includes(admin.role);
  const { data } = await supabaseService().from("baba_aladura").select("*").order("sort").order("name");
  const photo = (path: string | null) => (path ? `${SUPABASE_URL()}/storage/v1/object/public/public/${path}` : null);

  return (
    <>
      <PageTitle title="Past Baba Aladura" />
      <p className="mb-4 text-sm text-muted">Shown in order of the number you give, earliest first. Use a clear portrait photo under 4 MB.</p>
      {canEdit && (
        <section className="card mb-5 p-5">
          <h2 className="mb-3 font-semibold">Add a Baba Aladura</h2>
          <ActionForm action={saveBaba} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
            <div><label className="label">Order number</label><input name="sort" className="input" inputMode="numeric" placeholder="1" /></div>
            <div><label className="label">Name</label><input name="name" className="input" required /></div>
            <div><label className="label">Years</label><input name="years" className="input" placeholder="e.g. 1925 to 1933" /></div>
            <div><label className="label">Photo</label><input name="photo" type="file" accept="image/jpeg,image/png" className="text-sm" /></div>
            <div className="sm:col-span-4"><Submit>Add</Submit></div>
          </ActionForm>
        </section>
      )}
      {!data?.length ? <div className="card"><Empty>None added yet.</Empty></div> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((b) => (
            <div key={b.id} className="card p-3">
              {photo(b.photo_path) ? (
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
    </>
  );
}
