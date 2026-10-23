import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { day } from "@/lib/format";
import { PageTitle, Pill, Empty } from "@/components/ui";

const FILTERS = [["", "All"], ["teacher", "Teachers"], ["frozen", "Frozen"]];

export default async function MembersPage({ searchParams }: { searchParams: { q?: string; f?: string } }) {
  await requireAdmin();
  const q = (searchParams.q ?? "").trim().replace(/[%,()]/g, "");
  const f = searchParams.f ?? "";
  let query = supabaseService()
    .from("profiles")
    .select("id, full_name, phone, parish, is_teacher, status, created_at, entitlements(book_id)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,parish.ilike.%${q}%`);
  if (f === "teacher") query = query.eq("is_teacher", true);
  if (f === "frozen") query = query.eq("status", "frozen");
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <>
      <PageTitle title="Members" />
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, phone or parish" className="input max-w-sm" />
        <input type="hidden" name="f" value={f} />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={`/members?f=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${f === v ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{l}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        {!data?.length ? <Empty>No members found.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Member</th><th className="th">Books</th><th className="th">Joined</th><th className="th">Account</th></tr></thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} className="hover:bg-paper">
                  <td className="td">
                    <Link href={`/members/${m.id}`} className="font-semibold text-brand underline">{m.full_name || "No name yet"}</Link>
                    {m.is_teacher && <> <Pill tone="blue">Teacher</Pill></>}
                    <div className="text-xs text-muted">{m.phone} {m.parish && `· ${m.parish}`}</div>
                  </td>
                  <td className="td">
                    {(m.entitlements as { book_id: string }[]).map((e) => (
                      <span key={e.book_id} className="mr-1"><Pill tone="grey">{e.book_id.split("-")[0]}</Pill></span>
                    ))}
                  </td>
                  <td className="td whitespace-nowrap text-xs">{day(m.created_at)}</td>
                  <td className="td">{m.status === "frozen" ? <Pill tone="red">Frozen</Pill> : <Pill tone="green">Active</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Showing up to 200. Use search to find someone.</p>
    </>
  );
}
