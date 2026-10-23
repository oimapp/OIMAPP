import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { day, bookName } from "@/lib/format";
import { PageTitle, Pill, Empty } from "@/components/ui";
import { tableFor } from "../tables";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Item = { n?: number; date: string; published: boolean; en: { topic: string; text: string }; yo: { topic: string } };

export default async function BookPage({ params, searchParams }: { params: { id: string }; searchParams: { m?: string } }) {
  await requireAdmin();
  const db = supabaseService();
  const { data: book } = await db.from("books").select("*").eq("id", params.id).maybeSingle();
  if (!book) notFound();
  const table = tableFor(book.id);
  const daily = table === "readings";
  const month = Math.min(12, Math.max(1, Number(searchParams.m) || new Date().getMonth() + 1));
  let query = db.from(table).select(daily ? "date, published, en, yo" : "n, date, published, en, yo").eq("book_id", book.id);
  if (daily) {
    const y = book.year;
    const next = month === 12 ? `${y + 1}-01-01` : `${y}-${String(month + 1).padStart(2, "0")}-01`;
    query = query.gte("date", `${y}-${String(month).padStart(2, "0")}-01`).lt("date", next).order("date");
  } else {
    query = query.order("n");
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const items = (data ?? []) as unknown as Item[];

  return (
    <>
      <PageTitle title={bookName(book.id)}><Link href="/books" className="btn-ghost">All books</Link></PageTitle>
      {daily && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MONTHS.map((m, i) => (
            <Link key={m} href={`/books/${book.id}?m=${i + 1}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${month === i + 1 ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{m.slice(0, 3)}</Link>
          ))}
        </div>
      )}
      <div className="card overflow-x-auto">
        {!items.length ? <Empty>Nothing loaded yet. Run the import and upload on the computer.</Empty> : (
          <table className="w-full">
            <thead><tr>{!daily && <th className="th">#</th>}<th className="th">Date</th><th className="th">English topic</th><th className="th">Yoruba topic</th><th className="th">In the app</th></tr></thead>
            <tbody>
              {items.map((it) => {
                const key = daily ? it.date : String(it.n);
                return (
                  <tr key={key} className="hover:bg-paper">
                    {!daily && <td className="td">{it.n}</td>}
                    <td className="td whitespace-nowrap">{day(it.date, false)}</td>
                    <td className="td"><Link href={`/books/${book.id}/${key}`} className="font-semibold text-brand underline">{it.en.topic || "(no topic)"}</Link><div className="text-xs text-muted">{it.en.text}</div></td>
                    <td className="td">{it.yo.topic}</td>
                    <td className="td">{it.published ? <Pill tone="green">Shown</Pill> : <Pill tone="grey">Hidden</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
