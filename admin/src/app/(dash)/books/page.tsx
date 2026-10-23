import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { bookName } from "@/lib/format";
import { PageTitle, Pill } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { setBookStatus } from "@/app/actions";
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
              <div className="mb-3 flex h-24 items-end rounded-lg bg-brand-deep p-3 font-serif text-lg font-bold leading-tight text-white">{bookName(b.id)}</div>
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
            </div>
          );
        })}
      </div>
    </>
  );
}
