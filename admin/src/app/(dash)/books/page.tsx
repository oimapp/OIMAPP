import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { bookName } from "@/lib/format";
import { PageTitle, Pill } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { setBookStatus, saveCover } from "@/app/actions";
import { SUPABASE_URL } from "@/lib/env";
import { tableFor } from "./tables";

const STATUS: Record<string, ["green" | "amber" | "grey", string]> = {
  published: ["green", "Published"], draft: ["amber", "Draft (members can't buy it yet)"], coming_soon: ["grey", "Coming soon"],
};

export default async function BooksPage() {
  const admin = await requireAdmin();
  const db = supabaseService();
  const { data: books } = await db.from("books").select("*").order("id");
  const counts = await Promise.all(
    (books ?? []).map(async (b) => {
      const { count } = await db.from(tableFor(b.id)).select("*", { count: "exact", head: true }).eq("book_id", b.id);
      return count ?? 0;
    }),
  );
  const canEdit = ["owner", "editor"].includes(admin.role);

  return (
    <>
      <PageTitle title="Books" />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        To load or replace a whole book from Word files, run <code className="rounded bg-white px-1">npm run import</code> and then{" "}
        <code className="rounded bg-white px-1">npm run upload</code> on the computer. Small fixes can be made here.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {(books ?? []).map((b, i) => {
          const [tone, label] = STATUS[b.status] ?? ["grey", b.status];
          return (
            <div key={b.id} className="card flex flex-col p-5">
              {b.cover_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${SUPABASE_URL()}/storage/v1/object/public/public/${b.cover_path}`} alt={bookName(b.id)} className="mb-3 aspect-[3/4] w-full rounded-lg object-cover" />
              ) : (
                <div className="mb-3 flex aspect-[3/4] items-end rounded-lg bg-brand-deep p-4 font-serif text-xl font-bold leading-tight text-white">{bookName(b.id)}</div>
              )}
              <div className="text-sm text-muted">{b.title_yo}</div>
              <div className="mt-2 text-sm">{counts[i]} {b.kind === "daily" ? "days" : "lessons"} loaded</div>
              <div className="mt-2"><Pill tone={tone}>{label}</Pill></div>
              <Link href={`/books/${b.id}`} className="btn mt-4">Open</Link>
              {canEdit && (
                <ActionForm action={setBookStatus} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <select name="status" defaultValue={b.status} className="input">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="coming_soon">Coming soon</option>
                  </select>
                  <Submit variant="btn-ghost">Save</Submit>
                </ActionForm>
              )}
              {canEdit && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand underline">Change cover picture</summary>
                  <ActionForm action={saveCover} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input name="cover" type="file" accept="image/jpeg,image/png" className="text-sm" />
                    <span className="hint block">A photo or scan of the printed cover, upright (portrait), under 4 MB.</span>
                    {b.cover_path && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="remove" /> Remove the cover picture</label>}
                    <Submit variant="btn-ghost">Save cover</Submit>
                  </ActionForm>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
