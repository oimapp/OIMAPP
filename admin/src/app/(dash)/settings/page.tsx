import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { PageTitle } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { savePrices, saveSettings, addAdmin, removeAdmin, setAdminAccess, setPilot, endTest, savePlayKey } from "@/app/actions";
import { SUPABASE_URL } from "@/lib/env";

const PRODUCTS: [string, string, string][] = [
  ["manual", "manual-2027", "Sunday School Manual"], ["daily", "daily-2027", "Daily Divine Bread"], ["both", "both-2027", "Both books"],
  ["children", "children-2027", "Children's Manual"], ["constitution", "constitution", "Church Constitution"],
];

const SOCIAL: [string, string][] = [
  ["linktree", "All links (Linktree)"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["telegram", "Telegram"],
  ["tiktok", "TikTok"], ["instagram", "Instagram"], ["whatsapp", "WhatsApp channel"], ["website", "Church website"],
];

const ROLES: [string, string][] = [
  ["support", "Support desk: members and payments"],
  ["editor", "Content editor: books, calendar, districts, messages"],
  ["reader", "Prayer and counselling only (for example the Chairman of the Prophet Council)"],
  ["owner", "Main admin: everything"],
];

function Toggle({ name, label, hint, on }: { name: string; label: string; hint?: string; on: boolean }) {
  return (
    <label className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 h-5 w-5" />
      <span className="text-sm"><b className="font-semibold">{label}</b>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

const s0 = (rows: { key: string; value: unknown }[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.key, r.value])) as Record<string, any>;

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const owner = admin.role === "owner";
  const db = supabaseService();
  const [{ data: products }, { data: settings }, { data: admins }] = await Promise.all([
    db.from("products").select("*").order("sort"),
    db.from("settings").select("key, value"),
    db.from("admin_users").select("user_id, name, role, reads_prayers, reads_counselling, created_at").order("created_at"),
  ]);
  const [{ data: playKey }, { count: testUnlocks }, { count: testPhones }] = await Promise.all([
    db.from("server_secrets").select("value, updated_at").eq("key", "google_play").maybeSingle(),
    db.from("entitlements").select("*", { count: "exact", head: true }).eq("source", "admin"),
    db.from("devices").select("*", { count: "exact", head: true }).eq("active", true).neq("channel", "play"),
  ]);
  const playEmail = playKey ? (JSON.parse(playKey.value) as { client_email: string }).client_email : "";
  const links = new Map(((s0(settings).social_links ?? []) as { kind: string; url: string }[]).map((l) => [l.kind, l.url]));
  const s = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value])) as Record<string, any>;
  const price = (id: string) => products?.find((p) => p.id === id);

  if (!owner) {
    return (
      <>
        <PageTitle title="Settings" />
        <p className="card p-5 text-sm text-muted">Only the main admin can change settings.</p>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Prices for 2027</h2>
          <p className="mb-4 mt-1 text-xs text-muted">In naira. A new price only affects new purchases. Tick "On sale" when the book is ready to sell.</p>
          <ActionForm action={savePrices}>
            {PRODUCTS.map(([field, id, label]) => (
              <div key={id} className="mb-3 grid grid-cols-[1fr_120px_auto] items-center gap-3">
                <label className="text-sm font-semibold" htmlFor={field}>{label}<span className="block text-xs font-normal text-muted">Google Play ID: {price(id)?.play_product_id ?? "-"}</span></label>
                <input id={field} name={field} defaultValue={(price(id)?.price_kobo ?? 0) / 100} className="input" inputMode="numeric" />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name={`${field}_on`} defaultChecked={price(id)?.on_sale} className="h-4 w-4" /> On sale</label>
              </div>
            ))}
            <p className="mb-3 text-xs text-muted">Prices for Google Play are set in Play Console. Keep them the same as here.</p>
            <Submit>Save prices</Submit>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Admin team</h2>
          <ul className="mb-4 divide-y divide-line text-sm">
            {(admins ?? []).map((a) => (
              <li key={a.user_id} className="py-2.5">
                <details>
                  <summary className="cursor-pointer">
                    <b>{a.name}</b> <span className="text-muted">· {ROLES.find(([r]) => r === a.role)?.[1].split(":")[0] ?? a.role}</span>
                    {a.reads_prayers && <span className="ml-2 rounded bg-church-soft px-1.5 py-0.5 text-xs text-church-red">reads prayers</span>}
                    {a.reads_counselling && <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-800">reads counselling</span>}
                  </summary>
                  <ActionForm action={setAdminAccess} className="mt-2 space-y-2 rounded-lg bg-paper p-3">
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <select name="role" defaultValue={a.role} className="input">
                      {ROLES.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reads_prayers" defaultChecked={a.reads_prayers} className="h-4 w-4" /> Can read prayer requests</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reads_counselling" defaultChecked={a.reads_counselling} className="h-4 w-4" /> Can read counselling requests</label>
                    <Submit variant="btn-ghost">Save</Submit>
                  </ActionForm>
                  {a.user_id !== admin.userId && (
                    <ActionForm action={removeAdmin} confirm={`Remove ${a.name} from the admin team?`} className="mt-2">
                      <input type="hidden" name="user_id" value={a.user_id} />
                      <Submit variant="btn-danger">Remove from the team</Submit>
                    </ActionForm>
                  )}
                </details>
              </li>
            ))}
          </ul>
          <p className="mb-3 text-xs text-muted">Prayer requests and counselling requests are private: only the people ticked here can read them, even the main admin. Tap a name to change it.</p>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-brand underline">Add someone to the admin team</summary>
            <ActionForm action={addAdmin} resetOnSuccess className="mt-3 space-y-2">
              <input name="name" className="input" placeholder="Their name" required />
              <input name="email" type="email" className="input" placeholder="Their email" required />
              <input name="password" className="input" placeholder="Starting password (10+ characters)" required minLength={10} />
              <select name="role" className="input" defaultValue="support">
                {ROLES.map(([r, label]) => <option key={r} value={r}>{label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reads_prayers" className="h-4 w-4" /> Can read prayer requests</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reads_counselling" className="h-4 w-4" /> Can read counselling requests</label>
              <Submit>Add to team</Submit>
            </ActionForm>
          </details>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Launch day: end the test</h2>
          <p className="mb-3 mt-1 text-xs text-muted">Use these when the app is live on Google Play.</p>
          <div className="mb-4 rounded-lg bg-paper p-3 text-sm">
            <b>Test APK:</b> {s.pilot_open === false ? <span className="text-church-red">switched off</span> : <span className="text-green-700">still working</span>}
            <span className="block text-xs text-muted">{testPhones ?? 0} phone{testPhones === 1 ? "" : "s"} last opened a test APK. When it is off, the test APK stops opening and asks people to get the app from Google Play.</span>
            <ActionForm action={setPilot} className="mt-2" confirm={s.pilot_open === false ? "Let the test APK work again?" : "Switch off the test APK for everyone?"}>
              <input type="hidden" name="open" value={s.pilot_open === false ? "1" : "0"} />
              <Submit variant={s.pilot_open === false ? "btn-ghost" : "btn-danger"}>{s.pilot_open === false ? "Let the test APK work again" : "Switch off the test APK"}</Submit>
            </ActionForm>
          </div>
          <div className="rounded-lg bg-paper p-3 text-sm">
            <b>Books unlocked by hand:</b> {testUnlocks ?? 0}
            <span className="block text-xs text-muted">Takes back every book you opened with &quot;Unlock a book by hand&quot;, so testers pay like everyone else. Their accounts stay. Bought books are not touched.</span>
            <ActionForm action={endTest} className="mt-2 flex flex-wrap items-center gap-2">
              <input name="confirm" className="input max-w-[140px]" placeholder="Type END" />
              <Submit variant="btn-danger">Take back the books</Submit>
            </ActionForm>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Google Play payments</h2>
          <p className="mb-3 mt-1 text-xs text-muted">The key that lets this site check Google Play payments before unlocking books. Open the .json key file from Google Cloud in Notepad, copy everything, paste it here and save. It is kept where only the server can read it.</p>
          <p className="mb-3 text-sm">{playEmail ? <>Key saved for <b className="break-all">{playEmail}</b> ({String(playKey?.updated_at).slice(0, 10)}).</> : <span className="text-church-red">No key saved yet. Google Play purchases cannot unlock books until it is.</span>}</p>
          <ActionForm action={savePlayKey} resetOnSuccess>
            <textarea name="key_json" className="input min-h-[110px] py-2 font-mono text-xs" placeholder='{"type": "service_account", ...}' />
            <div className="mt-2"><Submit variant="btn-ghost">Save key</Submit></div>
          </ActionForm>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-1 font-semibold">App settings</h2>
          <p className="mb-4 text-xs text-muted">Phones pick these up the next time they connect.</p>
          <ActionForm action={saveSettings}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-brand">Support</h3>
                <label className="label" htmlFor="support_whatsapp">Help line shown in the app (WhatsApp)</label>
                <input id="support_whatsapp" name="support_whatsapp" defaultValue={s.support_whatsapp} className="input mb-3" />
                <label className="label" htmlFor="agent_whatsapp">WhatsApp payment agent number</label>
                <input id="agent_whatsapp" name="agent_whatsapp" defaultValue={s.agent_whatsapp} className="input mb-3" />
                <label className="label" htmlFor="contact_email">Contact email (shown on the privacy page)</label>
                <input id="contact_email" name="contact_email" type="email" defaultValue={s.contact_email} className="input mb-3" placeholder="e.g. onaiwamimo.app@gmail.com" />
                <label className="label" htmlFor="play_url">Google Play link of the app</label>
                <input id="play_url" name="play_url" defaultValue={s.play_url} className="input mb-3" />
                <Toggle name="counselling_on" label="Members can ask for counselling in the app" hint="Singles and married. Only admins allowed to read counselling see them." on={s.counselling_on !== false} />
                <div className="mb-5" />

                <h3 className="mb-2 text-sm font-bold text-brand">One phone per account</h3>
                <label className="label" htmlFor="phone_moves_per_year">Phone changes a member can do by themselves each year</label>
                <input id="phone_moves_per_year" name="phone_moves_per_year" defaultValue={s.phone_moves_per_year} className="input mb-3" inputMode="numeric" />
                <label className="label" htmlFor="move_wait_days">Days to wait between phone changes</label>
                <input id="move_wait_days" name="move_wait_days" defaultValue={s.move_wait_days} className="input mb-3" inputMode="numeric" />
                <label className="label" htmlFor="offline_days">Phones must connect at least every (days)</label>
                <input id="offline_days" name="offline_days" defaultValue={s.offline_days} className="input mb-3" inputMode="numeric" />
                <Toggle name="watermark" label="Phone number watermark on pages" on={!!s.watermark} />
                <Toggle name="block_screenshots" label="Block screenshots" hint="Android only" on={!!s.block_screenshots} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-brand">Ways to pay</h3>
                <Toggle name="pay_google_play" label="Google Play (inside the app)" on={!!s.pay_google_play} />
                <Toggle name="pay_whatsapp" label="WhatsApp agent" on={!!s.pay_whatsapp} />
                <Toggle name="pay_web" label="Payment page" on={!!s.pay_web} />
                <label className="label mt-3" htmlFor="pay_page_url">Payment page link (shown in test APKs and shared on WhatsApp)</label>
                <input id="pay_page_url" name="pay_page_url" defaultValue={s.pay_page_url} className="input" placeholder="https://your-admin-site.netlify.app/pay" />

                <h3 className="mb-2 mt-5 text-sm font-bold text-brand">Notice on the app's Home screen</h3>
                <input name="notice_en" defaultValue={s.home_notice?.en} className="input mb-2" placeholder="English (leave empty for no notice)" />
                <input name="notice_yo" defaultValue={s.home_notice?.yo} className="input mb-5" placeholder="Yoruba" />

                <h3 className="mb-2 text-sm font-bold text-brand">Maintenance</h3>
                <Toggle name="maintenance_on" label="Show a maintenance notice" hint="Reading still works offline" on={!!s.maintenance?.on} />
                <input name="maintenance_en" defaultValue={s.maintenance?.en} className="input mb-2" placeholder="Message in English" />
                <input name="maintenance_yo" defaultValue={s.maintenance?.yo} className="input mb-5" placeholder="Message in Yoruba" />

                <label className="label" htmlFor="min_app_version">Oldest app version allowed</label>
                <input id="min_app_version" name="min_app_version" defaultValue={s.min_app_version} className="input" />
                <span className="hint">Phones with an older version are asked to update from the Play Store.</span>
              </div>
            </div>
            <div className="mt-6 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-bold text-brand">Welcome page</h3>
                <p className="mb-3 text-xs text-muted">Members see this every time they open the app, before the books.</p>
                <label className="label" htmlFor="welcome_en">Welcome message (English)</label>
                <textarea id="welcome_en" name="welcome_en" defaultValue={s.welcome?.en} className="input mb-3 min-h-[90px] py-2" />
                <label className="label" htmlFor="welcome_yo">Welcome message (Yoruba)</label>
                <textarea id="welcome_yo" name="welcome_yo" defaultValue={s.welcome?.yo} className="input mb-3 min-h-[90px] py-2" />
                <label className="label" htmlFor="verse_en">Bible verse on the welcome page (optional)</label>
                <input id="verse_en" name="verse_en" defaultValue={s.welcome?.verse_en} className="input mb-2" placeholder="English" />
                <input name="verse_yo" defaultValue={s.welcome?.verse_yo} className="input mb-2" placeholder="Yoruba" />
                <input name="verse_ref" defaultValue={s.welcome?.verse_ref} className="input mb-3" placeholder="Reference, e.g. Psalm 100:4" />
                <label className="label">Picture (optional: the founder, or the church)</label>
                {s.welcome?.photo_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${SUPABASE_URL()}/storage/v1/object/public/public/${s.welcome.photo_path}`} alt="" className="mb-2 h-28 rounded-lg object-cover" />
                ) : null}
                <input name="welcome_photo" type="file" accept="image/jpeg,image/png" className="mb-1 block text-sm" />
                {s.welcome?.photo_path ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="welcome_photo_remove" /> Remove the picture (show the logo instead)</label> : <span className="hint">Without a picture, the church logo is shown.</span>}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-bold text-brand">About the church</h3>
                <p className="mb-3 text-xs text-muted">Shown on the About page in the app. Leave a blank line between paragraphs.</p>
                <label className="label" htmlFor="about_en">English</label>
                <textarea id="about_en" name="about_en" defaultValue={s.about?.en} className="input mb-3 min-h-[180px] py-2" />
                <label className="label" htmlFor="about_yo">Yoruba</label>
                <textarea id="about_yo" name="about_yo" defaultValue={s.about?.yo} className="input min-h-[180px] py-2" />
                <h3 className="mb-1 mt-5 text-sm font-bold text-brand">Church social media</h3>
                <p className="mb-3 text-xs text-muted">Shown as icons on the Home and About pages of the app. Leave a box empty to hide that icon.</p>
                {SOCIAL.map(([kind, label]) => (
                  <div key={kind} className="mb-2">
                    <label className="label" htmlFor={`social_${kind}`}>{label}</label>
                    <input id={`social_${kind}`} name={`social_${kind}`} defaultValue={links.get(kind) ?? ""} className="input" placeholder="https://..." />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5"><Submit>Save settings</Submit></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
