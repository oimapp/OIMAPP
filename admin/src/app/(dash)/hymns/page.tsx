import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveHymn, deleteHymn } from "@/app/actions";

type Hymn = { id: string; number: number; title_en: string; title_yo: string; text_en: string; text_yo: string; category: string };

function HymnFields({ h }: { h: Partial<Hymn> }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className="label">Number</label><input name="number" defaultValue={h.number} className="input" inputMode="numeric" required /></div>
        <div className="sm:col-span-3"><label className="label">Group (optional, e.g. Morning hymns)</label><input name="category" defaultValue={h.category} className="input" /></div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <label className="label">Title in Yoruba</label>
          <input name="title_yo" defaultValue={h.title_yo} className="input mb-2" />
          <label className="label">Words in Yoruba</label>
          <textarea name="text_yo" defaultValue={h.text_yo} className="input min-h-[260px] py-2 font-serif leading-relaxed" />
        </div>
        <div>
          <label className="label">Title in English</label>
          <input name="title_en" defaultValue={h.title_en} className="input mb-2" />
          <label className="label">Words in English</label>
          <textarea name="text_en" defaultValue={h.text_en} className="input min-h-[260px] py-2 font-serif leading-relaxed" />
        </div>
      </div>
      <p className="hint mt-2">Leave one empty line between verses. Start a chorus with &quot;Chorus:&quot; or &quot;Ègbè:&quot;.</p>
    </>
  );
}

export default async function HymnsPage({ searchParams }: { searchParams: { q?: string } }) {
  const admin = await requireAdmin();
  const canEdit = ["owner", "editor"].includes(admin.role);
  const q = (searchParams.q ?? "").trim();
  let query = supabaseService().from("hymns").select("*").order("number").limit(300);
  if (/^\d+$/.test(q)) query = query.eq("number", Number(q));
  else if (q) query = query.or(`title_en.ilike.%${q}%,title_yo.ilike.%${q}%`);
  const { data } = await query;
  const list = (data ?? []) as Hymn[];

  return (
    <>
      <PageTitle title="Hymn book" />
      <p className="mb-4 max-w-3xl text-sm text-muted">The C&amp;S Hymn Book in the app, free for every member. Add hymns one by one here. When the conference sends a Word or PDF copy, they can be loaded all at once.</p>
      {canEdit && (
        <details className="card mb-5 p-5">
          <summary className="cursor-pointer font-semibold">Add a hymn</summary>
          <ActionForm action={saveHymn} resetOnSuccess className="mt-4">
            <HymnFields h={{}} />
            <div className="mt-3"><Submit>Add hymn</Submit></div>
          </ActionForm>
        </details>
      )}
      <form className="mb-3 flex gap-2">
        <input name="q" defaultValue={q} className="input max-w-xs" placeholder="Number or title" />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="card divide-y divide-line">
        {!list.length && <Empty>No hymns yet.</Empty>}
        {list.map((h) => (
          <details key={h.id} className="px-4 py-3">
            <summary className="cursor-pointer text-sm"><b className="mr-2 text-brand">{h.number}</b><b>{h.title_yo || h.title_en}</b> <span className="text-muted">{h.title_yo && h.title_en ? `· ${h.title_en}` : ""}</span></summary>
            {canEdit && (
              <div className="mt-3">
                <ActionForm action={saveHymn}>
                  <input type="hidden" name="id" value={h.id} />
                  <HymnFields h={h} />
                  <div className="mt-3"><Submit variant="btn-ghost">Save changes</Submit></div>
                </ActionForm>
                <ActionForm action={deleteHymn} confirm={`Delete hymn ${h.number}?`} className="mt-2">
                  <input type="hidden" name="id" value={h.id} />
                  <Submit variant="btn-danger">Delete hymn</Submit>
                </ActionForm>
              </div>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
