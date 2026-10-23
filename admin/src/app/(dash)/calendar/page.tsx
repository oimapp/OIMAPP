import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { day } from "@/lib/format";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveEvent, deleteEvent } from "@/app/actions";

const KINDS = ["Service", "Meeting", "Event", "Program", "Convention"];

type Ev = { id?: string; date?: string; end_date?: string | null; title_en?: string; title_yo?: string; place?: string; kind?: string };

function EventFields({ e }: { e: Ev }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label">Name (English)</label><input name="title_en" defaultValue={e.title_en} className="input" required /></div>
      <div><label className="label">Name (Yoruba)</label><input name="title_yo" defaultValue={e.title_yo} className="input" /></div>
      <div><label className="label">Date</label><input type="date" name="date" defaultValue={e.date} className="input" required /></div>
      <div><label className="label">End date <span className="font-normal text-muted">(if more than one day)</span></label><input type="date" name="end_date" defaultValue={e.end_date ?? ""} className="input" /></div>
      <div><label className="label">Where</label><input name="place" defaultValue={e.place} className="input" placeholder="Venue, or All parishes" /></div>
      <div><label className="label">Type</label>
        <select name="kind" defaultValue={e.kind ?? "Event"} className="input">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
      </div>
    </div>
  );
}

export default async function CalendarPage() {
  const admin = await requireAdmin();
  const canEdit = ["owner", "editor"].includes(admin.role);
  const { data } = await supabaseService().from("events").select("*").order("date");

  return (
    <>
      <PageTitle title="Church calendar" />
      <p className="mb-4 text-sm text-muted">Members see this free, even without data. Phones get changes the next time they connect.</p>
      {canEdit && (
        <section className="card mb-5 p-5">
          <h2 className="mb-3 font-semibold">Add an event</h2>
          <ActionForm action={saveEvent} resetOnSuccess>
            <EventFields e={{}} />
            <div className="mt-4"><Submit>Add event</Submit></div>
          </ActionForm>
        </section>
      )}
      <div className="card divide-y divide-line">
        {!data?.length ? <Empty>No events yet.</Empty> : data.map((e) => (
          <details key={e.id} className="p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="w-24 shrink-0 text-sm font-semibold">{day(e.date)}</span>
              <span className="font-semibold">{e.title_en}</span>
              <span className="text-sm text-muted">{e.place} · {e.kind}</span>
            </summary>
            {canEdit && (
              <div className="mt-4">
                <ActionForm action={saveEvent}>
                  <input type="hidden" name="id" value={e.id} />
                  <EventFields e={e} />
                  <div className="mt-3"><Submit variant="btn-ghost">Save changes</Submit></div>
                </ActionForm>
                <ActionForm action={deleteEvent} confirm={`Delete "${e.title_en}"?`} className="mt-2">
                  <input type="hidden" name="id" value={e.id} />
                  <Submit variant="btn-danger">Delete</Submit>
                </ActionForm>
              </div>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
