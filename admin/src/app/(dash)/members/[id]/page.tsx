import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { day, when, bookName } from "@/lib/format";
import { PageTitle, Pill } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { resetPhone, setTeacher, setFrozen, grantBook } from "@/app/actions";
import { PaymentsTable } from "../../payments/PaymentsTable";

export default async function MemberPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const db = supabaseService();
  const { data: m } = await db.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!m) notFound();
  const [{ data: books }, { data: devices }, { data: payments }, { data: allBooks }] = await Promise.all([
    db.from("entitlements").select("book_id, source, reason, created_at").eq("user_id", m.id),
    db.from("devices").select("*").eq("user_id", m.id).order("linked_at", { ascending: false }),
    db.from("payments")
      .select("id, tx_ref, amount_kobo, status, channel, method, created_at, beneficiary_phone, product_id, payer_name, wa_phone, payer:profiles!payments_payer_id_fkey(full_name, phone)")
      .or(`payer_id.eq.${m.id},beneficiary_phone.eq.${m.phone}`)
      .order("created_at", { ascending: false }),
    db.from("books").select("id").neq("status", "coming_soon"),
  ]);
  const active = devices?.find((d) => d.active);
  const movesThisYear = (devices ?? []).filter((d) => d.link_kind === "self_move" && d.linked_at >= `${new Date().getFullYear()}-01-01`).length;
  const canAct = ["owner", "support"].includes(admin.role);
  const owned = new Set((books ?? []).map((b) => b.book_id));

  return (
    <>
      <PageTitle title={m.full_name || m.phone || "Member"}><Link href="/members" className="btn-ghost">Back to members</Link></PageTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <dl className="card grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 p-5 text-sm">
            <dt className="text-muted">Phone</dt><dd className="font-medium">{m.phone}</dd>
            <dt className="text-muted">Email</dt><dd className="font-medium">{m.email || "None"}</dd>
            <dt className="text-muted">Parish</dt><dd className="font-medium">{m.parish || "Not given"}</dd>
            <dt className="text-muted">Language</dt><dd className="font-medium">{m.language === "yo" ? "Yorùbá" : "English"}</dd>
            <dt className="text-muted">Joined</dt><dd className="font-medium">{day(m.created_at)}</dd>
            <dt className="text-muted">Account</dt>
            <dd className="flex gap-2">{m.status === "frozen" ? <Pill tone="red">Frozen</Pill> : <Pill tone="green">Active</Pill>}{m.is_teacher && <Pill tone="blue">Sunday School teacher</Pill>}</dd>
          </dl>

          <section className="card p-5">
            <h2 className="mb-2 font-semibold">Books</h2>
            {!books?.length ? <p className="text-sm text-muted">No books yet.</p> : (
              <ul className="space-y-1.5 text-sm">
                {books.map((b) => (
                  <li key={b.book_id}>
                    <b>{bookName(b.book_id)}</b>{" "}
                    <span className="text-muted">({b.source === "admin" ? `unlocked by admin: ${b.reason}` : b.source}, {day(b.created_at)})</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-2 font-semibold">Phones</h2>
            <p className="mb-3 text-sm text-muted">
              {active ? <>In use now: <b className="text-ink">{active.model || "Unknown phone"}</b> since {day(active.linked_at)}. Last seen {when(active.last_seen_at)}.</> : "Not signed in on any phone."}
              {" "}Phone changes by the member this year: <b className="text-ink">{movesThisYear}</b>.
            </p>
            {!!devices?.length && (
              <ul className="space-y-1 text-xs text-muted">
                {devices.map((d) => (
                  <li key={d.id}>{d.model || "Unknown phone"} ({d.platform}), linked {day(d.linked_at)}{d.unlinked_at ? `, removed ${day(d.unlinked_at)}: ${d.unlinked_reason}` : ", active"}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="px-4 pt-4 font-semibold">Payments</h2>
            <PaymentsTable rows={(payments ?? []) as never} />
          </section>
        </div>

        {canAct && (
          <div className="space-y-3">
            <div className="card p-4">
              <h3 className="font-semibold">Reset phone</h3>
              <p className="mb-3 mt-1 text-xs text-muted">Signs out the current phone so they can sign in on a new one. Does not count against their yearly changes.</p>
              <ActionForm action={resetPhone} confirm="Sign this member out of their current phone?">
                <input type="hidden" name="id" value={m.id} />
                <Submit variant="btn-ghost">Reset phone</Submit>
              </ActionForm>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold">Sunday School teacher</h3>
              <p className="mb-3 mt-1 text-xs text-muted">Teachers see the teaching guide and class register for every lesson.</p>
              <ActionForm action={setTeacher}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="on" value={m.is_teacher ? "0" : "1"} />
                <Submit variant="btn-ghost">{m.is_teacher ? "Remove teacher account" : "Make teacher"}</Submit>
              </ActionForm>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold">Unlock a book by hand</h3>
              <p className="mb-3 mt-1 text-xs text-muted">Only when a payment went through but the book did not unlock. Write the payment reference as the reason.</p>
              <ActionForm action={grantBook} resetOnSuccess>
                <input type="hidden" name="id" value={m.id} />
                <select name="book" className="input mb-2" required>
                  {(allBooks ?? []).filter((b) => !owned.has(b.id)).map((b) => <option key={b.id} value={b.id}>{bookName(b.id)}</option>)}
                </select>
                <input name="reason" className="input mb-2" placeholder="Reason, e.g. FLW-123456" required />
                <Submit variant="btn-ghost">Unlock</Submit>
              </ActionForm>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold">{m.status === "frozen" ? "Unfreeze account" : "Freeze account"}</h3>
              <p className="mb-3 mt-1 text-xs text-muted">{m.status === "frozen" ? "They can sign in and read again." : "Signs them out and stops reading until you unfreeze."}</p>
              <ActionForm action={setFrozen} confirm={m.status === "frozen" ? undefined : "Freeze this account?"}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="frozen" value={m.status === "frozen" ? "0" : "1"} />
                <Submit variant={m.status === "frozen" ? "btn-ghost" : "btn-danger"}>{m.status === "frozen" ? "Unfreeze" : "Freeze"}</Submit>
              </ActionForm>
            </div>
            {m.phone && (
              <a className="btn-ghost w-full" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${m.phone.replace(/\D/g, "")}`}>Message on WhatsApp</a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
