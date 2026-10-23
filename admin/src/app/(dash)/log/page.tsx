import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { when } from "@/lib/format";
import { PageTitle, Empty } from "@/components/ui";

export default async function LogPage() {
  await requireAdmin(["owner"]);
  const db = supabaseService();
  const [{ data: log }, { data: admins }] = await Promise.all([
    db.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
    db.from("admin_users").select("user_id, name"),
  ]);
  const name = (id: string | null) => admins?.find((a) => a.user_id === id)?.name ?? "Unknown";

  return (
    <>
      <PageTitle title="Admin activity" />
      <div className="card overflow-x-auto">
        {!log?.length ? <Empty>Nothing yet.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">When</th><th className="th">Who</th><th className="th">What</th><th className="th">On</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="td whitespace-nowrap text-xs">{when(l.at)}</td>
                  <td className="td">{name(l.actor)}</td>
                  <td className="td">{l.action.replace(/_/g, " ")}</td>
                  <td className="td break-all text-xs text-muted">{l.target} {Object.keys(l.detail ?? {}).length ? JSON.stringify(l.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
