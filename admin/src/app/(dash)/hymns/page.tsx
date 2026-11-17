import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveHymn, deleteHymn } from "@/app/actions";

type Hymn = {
  id: string; series: string; number: number; label: string; title_en: string; title_yo: string; text_en: string; text_yo: string;
  category: string; category_yo: string; scripture: string; scripture_yo: string; tune: string;
};

const SERIES: [string, string][] = [["main", "Hymns"], ["akunleko", "Kneeling Songs (Akúnlẹ̀kọ)"], ["isoji", "Ìsọjí"]];

function HymnFields({ h }: { h: Partial<Hymn> }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className="label">List</label>
          <select name="series" defaultValue={h.series ?? "main"} className="input">
            {SERIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div><label className="label">Number</label><input name="number" defaultValue={h.number} className="input" inputMode="numeric" required /></div>
        <div><label className="label">Shown as (Kneeling Songs: I, II...)</label><input name="label" defaultValue={h.label} className="input" /></div>
        <div><label className="label">Tune line</label><input name="tune" defaultValue={h.tune} className="input" /></div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <label className="label">Group in Yoruba (e.g. Orin Owurọ)</label>
          <input name="category_yo" defaultValue={h.category_yo} className="input mb-2" />
          <label className="label">Title in Yoruba</label>
          <input name="title_yo" defaultValue={h.title_yo} className="input mb-2" />
          <label className="label">Bible line in Yoruba</label>
          <input name="scripture_yo" defaultValue={h.scripture_yo} className="input mb-2" />
          <label className="label">Words in Yoruba</label>
          <textarea name="text_yo" defaultValue={h.text_yo} className="input min-h-[260px] py-2 font-serif leading-relaxed" />
        </div>
        <div>
          <label className="label">Group in English (e.g. Morning Devotion)</label>
          <input name="category" defaultValue={h.category} className="input mb-2" />
          <label className="label">Title in English</label>
          <input name="title_en" defaultValue={h.title_en} className="input mb-2" />
          <label className="label">Bible line in English</label>
          <input name="scripture" defaultValue={h.scripture} className="input mb-2" />
          <label className="label">Words in English</label>
          <textarea name="text_en" defaultValue={h.text_en} className="input min-h-[260px] py-2 font-serif leading-relaxed" />
        </div>
      </div>
      <p className="hint mt-2">Leave one empty line between verses. Start a chorus with &quot;Chorus:&quot; (English) or &quot;Ègbè:&quot; (Yoruba).</p>
    </>
  );
}

export default async function HymnsPage({ searchParams }: { searchParams: { q?: string; s?: string } }) {
  const admin = await requireAdmin();
  const canEdit = ["owner", "editor"].includes(admin.role);
  const q = (searchParams.q ?? "").trim().replace(/[%,()]/g, " ");
  const series = SERIES.some(([v]) => v === searchParams.s) ? searchParams.s! : "main";
  let query = supabaseService().from("hymns").select("*").eq("series", series).order("number").limit(1000);
  if (/^\d+$/.test(q)) query = query.eq("number", Number(q));
  else if (q) query = query.or(`title_en.ilike.%${q}%,title_yo.ilike.%${q}%,text_en.ilike.%${q}%,text_yo.ilike.%${q}%`);
  const { data } = await query;
  const list = (data ?? []) as Hymn[];

  return (
    <>
      <PageTitle title="Hymn book" />
      <p className="mb-4 max-w-3xl text-sm text-muted">The hymn book in the app, in English and Yoruba, free for every member. To load the whole book again from the Word files, run <code className="rounded bg-white px-1">npm run upload-hymns</code> on the computer.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {SERIES.map(([v, l]) => (
          <Link key={v} href={`/hymns?s=${v}`} className={`rounded-full px-3 py-1.5 text-sm ${series === v ? "bg-brand text-white" : "bg-white text-muted"}`}>{l}</Link>
        ))}
      </div>
      {canEdit && (
        <details className="card mb-5 p-5">
          <summary className="cursor-pointer font-semibold">Add a hymn</summary>
          <ActionForm action={saveHymn} resetOnSuccess className="mt-4">
            <HymnFields h={{ series }} />
            <div className="mt-3"><Submit>Add hymn</Submit></div>
          </ActionForm>
        </details>
      )}
      <form className="mb-3 flex gap-2">
        <input type="hidden" name="s" value={series} />
        <input name="q" defaultValue={q} className="input max-w-xs" placeholder="Number, title or words" />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="card divide-y divide-line">
        {!list.length && <Empty>No hymns found.</Empty>}
        {list.map((h) => (
          <details key={h.id} className="px-4 py-3">
            <summary className="cursor-pointer text-sm"><b className="mr-2 text-brand">{h.label || h.number}</b><b>{h.title_yo || h.title_en}</b> <span className="text-muted">{h.title_yo && h.title_en ? `· ${h.title_en}` : ""}</span></summary>
            {canEdit && (
              <div className="mt-3">
                <ActionForm action={saveHymn}>
                  <input type="hidden" name="id" value={h.id} />
                  <HymnFields h={h} />
                  <div className="mt-3"><Submit variant="btn-ghost">Save changes</Submit></div>
                </ActionForm>
                <ActionForm action={deleteHymn} confirm={`Delete hymn ${h.label || h.number}?`} className="mt-2">
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
