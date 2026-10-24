import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { bookName, day } from "@/lib/format";
import { PageTitle, Empty } from "@/components/ui";

export default async function RegistersPage() {
  await requireAdmin();
  const db = supabaseService();
  const [{ data: classes }, { data: students }, { data: att }] = await Promise.all([
    db.from("classes").select("id, name, book_id, teacher:profiles(full_name, phone, parish)").order("created_at"),
    db.from("class_students").select("id, class_id").eq("active", true),
    db.from("attendance").select("class_id, date, present"),
  ]);

  return (
    <>
      <PageTitle title="Class registers" />
      <p className="mb-4 max-w-3xl text-sm text-muted">Teachers keep these registers in the app. Turn a member into a teacher from their page under Members.</p>
      <div className="card overflow-x-auto">
        {!classes?.length ? <Empty>No classes yet.</Empty> : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-muted">
              <tr><th className="p-3">Class</th><th className="p-3">Teacher</th><th className="p-3">Book</th><th className="p-3">Students</th><th className="p-3">Last register</th><th className="p-3">Present</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {classes.map((c) => {
                const t = c.teacher as unknown as { full_name?: string; phone?: string; parish?: string } | null;
                const mine = (att ?? []).filter((a) => a.class_id === c.id);
                const last = mine.map((a) => a.date).sort().pop();
                const lastRows = mine.filter((a) => a.date === last);
                return (
                  <tr key={c.id}>
                    <td className="p-3 font-semibold">{c.name}</td>
                    <td className="p-3">{t?.full_name}<div className="text-xs text-muted">{t?.phone} {t?.parish ? `· ${t.parish}` : ""}</div></td>
                    <td className="p-3">{c.book_id ? bookName(c.book_id) : ""}</td>
                    <td className="p-3">{(students ?? []).filter((s) => s.class_id === c.id).length}</td>
                    <td className="p-3">{last ? day(last) : "None yet"}</td>
                    <td className="p-3">{last ? `${lastRows.filter((r) => r.present).length} of ${lastRows.length}` : ""}</td>
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
