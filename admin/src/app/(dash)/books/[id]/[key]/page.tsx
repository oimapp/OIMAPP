import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { day, bookName } from "@/lib/format";
import { toText, type Block } from "@/lib/lessonText";
import { PageTitle } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveLesson, saveGuide } from "@/app/actions";
import { tableFor } from "../../tables";
import { AudioUpload } from "@/components/AudioUpload";

type Part = { name?: string; topic: string; text: string; body: Block[] };

export default async function LessonPage({ params }: { params: { id: string; key: string } }) {
  const admin = await requireAdmin();
  const db = supabaseService();
  const table = tableFor(params.id);
  const match = table === "readings" ? { book_id: params.id, date: params.key } : { book_id: params.id, n: Number(params.key) };
  const { data: row } = await db.from(table).select("*").match(match).maybeSingle();
  if (!row) notFound();
  const en = row.en as Part;
  const yo = row.yo as Part;
  const canEdit = ["owner", "editor"].includes(admin.role);
  const { data: tracks } = await db.from("audio_tracks").select("lang, path, reader").eq("book_id", params.id).eq("item_key", params.key);
  const track = (l: string) => (tracks ?? []).find((x) => x.lang === l);
  const { data: guide } = table !== "readings"
    ? await db.from("teacher_guides").select("*").eq("book_id", params.id).eq("n", Number(params.key)).maybeSingle()
    : { data: null };

  const side = (lang: "en" | "yo", p: Part) => (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">{lang === "en" ? "English" : "Yorùbá"} {p.name ? <span className="text-sm font-normal text-muted">({p.name})</span> : null}</h2>
      <label className="label" htmlFor={`${lang}_topic`}>Topic</label>
      <input id={`${lang}_topic`} name={`${lang}_topic`} defaultValue={p.topic} className="input mb-3" disabled={!canEdit} />
      <label className="label" htmlFor={`${lang}_text`}>Bible text</label>
      <input id={`${lang}_text`} name={`${lang}_text`} defaultValue={p.text} className="input mb-3" disabled={!canEdit} />
      <label className="label" htmlFor={`${lang}_body`}>Lesson</label>
      <textarea id={`${lang}_body`} name={`${lang}_body`} defaultValue={toText(p.body ?? [])} disabled={!canEdit}
        className="input min-h-[480px] py-2 font-serif leading-relaxed" />
    </div>
  );

  return (
    <>
      <PageTitle title={`${bookName(params.id)} · ${day(row.date)}`}>
        <Link href={`/books/${params.id}`} className="btn-ghost">Back to the list</Link>
      </PageTitle>
      {row.theme && <p className="mb-3 text-sm text-muted">Monthly theme: <b className="text-ink">{row.theme.en}</b> / {row.theme.yo}</p>}
      <details className="mb-4 rounded-lg border border-line bg-white p-3 text-sm">
        <summary className="cursor-pointer font-semibold">How to write the lesson box</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Leave an empty line between paragraphs.</li>
          <li><code>## </code> at the start makes a heading, e.g. <code>## (A) Power of the light</code></li>
          <li><code>- </code> at the start makes a bullet point.</li>
          <li><code>&gt; </code> makes the memory verse: <code>&gt; “Enter His gates...” | Psalms 100:4</code></li>
          <li><code>Prayer: </code>, <code>Challenge: </code>, <code>Question: </code> (or the Yoruba words) make labelled boxes.</li>
        </ul>
      </details>
      <ActionForm action={saveLesson}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="book" value={params.id} />
        <input type="hidden" name="key" value={params.key} />
        <div className="grid gap-4 lg:grid-cols-2">{side("en", en)}{side("yo", yo)}</div>
        {canEdit && (
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-4 border-t border-line bg-paper py-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={row.published} className="h-5 w-5" /> Show in the app</label>
            <Submit>Save lesson</Submit>
          </div>
        )}
      </ActionForm>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">Recorded reading (audio)</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Optional. When a recording is here, members who own this book hear it instead of the phone&apos;s reading voice. It needs internet to play.</p>
        {canEdit ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <AudioUpload book={params.id} itemKey={params.key} lang="yo" current={track("yo")?.path} reader={track("yo")?.reader} />
            <AudioUpload book={params.id} itemKey={params.key} lang="en" current={track("en")?.path} reader={track("en")?.reader} />
          </div>
        ) : <p className="text-sm text-muted">{tracks?.length ? `${tracks.length} recording(s) uploaded.` : "No recordings yet."}</p>}
      </section>

      {table !== "readings" && (
        <section className="card mt-6 p-5">
          <h2 className="font-semibold">Teaching guide</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Only teacher accounts see this. Do not write answers to the lesson questions here.</p>
          <ActionForm action={saveGuide}>
            <input type="hidden" name="book" value={params.id} />
            <input type="hidden" name="n" value={params.key} />
            <label className="label" htmlFor="aim">Aim of the lesson</label>
            <textarea id="aim" name="aim" defaultValue={guide?.aim ?? ""} className="input mb-3 min-h-[90px] py-2" disabled={!canEdit} />
            <label className="label" htmlFor="discussion">Points for discussion (one per line)</label>
            <textarea id="discussion" name="discussion" defaultValue={guide?.discussion ?? ""} className="input mb-3 min-h-[120px] py-2" disabled={!canEdit} />
            {canEdit && <Submit>Save teaching guide</Submit>}
          </ActionForm>
        </section>
      )}
    </>
  );
}
