import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { when } from "@/lib/format";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { sendAnnouncement } from "@/app/actions";

const AUDIENCE: Record<string, string> = {
  all: "Everyone", manual: "Members with the Sunday School Manual", daily: "Members with Daily Divine Bread",
  teachers: "Sunday School teachers", no_book: "Members who haven't bought a book",
};

export default async function MessagesPage() {
  const admin = await requireAdmin();
  const canSend = ["owner", "editor"].includes(admin.role);
  const { data } = await supabaseService().from("announcements").select("*").order("sent_at", { ascending: false }).limit(50);

  return (
    <>
      <PageTitle title="Messages" />
      <div className="grid gap-4 lg:grid-cols-2">
        {canSend && (
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">New message</h2>
            <ActionForm action={sendAnnouncement} resetOnSuccess>
              <label className="label" htmlFor="audience">Who gets it</label>
              <select id="audience" name="audience" className="input mb-3">
                {Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="label" htmlFor="body_en">Message in English</label>
              <textarea id="body_en" name="body_en" maxLength={160} className="input mb-3 min-h-[80px] py-2" required />
              <label className="label" htmlFor="body_yo">Message in Yoruba</label>
              <textarea id="body_yo" name="body_yo" maxLength={160} className="input min-h-[80px] py-2" />
              <span className="hint">Up to 160 characters each. Members see the one in their app language.</span>
              <div className="mt-4"><Submit>Send</Submit></div>
            </ActionForm>
          </section>
        )}
        <section className="card">
          <h2 className="px-4 pt-4 font-semibold">Sent</h2>
          {!data?.length ? <Empty>No messages yet.</Empty> : (
            <ul className="divide-y divide-line">
              {data.map((m) => (
                <li key={m.id} className="px-4 py-3 text-sm">
                  <div className="text-xs text-muted">{when(m.sent_at)} · {AUDIENCE[m.audience]}</div>
                  <div className="mt-1">{m.body_en}</div>
                  {m.body_yo && <div className="mt-1 text-muted">{m.body_yo}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
