import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { setting } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy policy · Ona Iwa Mimo app", robots: { index: true, follow: true } };

const UPDATED = "14 November 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-7 font-serif text-xl font-bold text-brand-deep">{children}</h2>;
}

export default async function Privacy() {
  const [email, whatsapp] = await Promise.all([setting<string>("contact_email"), setting<string>("support_whatsapp")]);
  return (
    <PublicShell>
      <article className="leading-relaxed text-ink [&_li]:mb-1.5 [&_ul]:ml-5 [&_ul]:list-disc">
        <h1 className="font-serif text-3xl font-bold text-brand-deep">Privacy policy</h1>
        <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>

        <p className="mt-5">
          The Ona Iwa Mimo app (&quot;the app&quot;) is run for Ona Iwa Mimo Cherubim and Seraphim Church of Nigeria and Overseas
          (&quot;the church&quot;, &quot;we&quot;). This page explains what we collect when you use the app and this website, why, who else
          handles it, and how you can delete it.
        </p>

        <H>What we collect</H>
        <ul>
          <li><b>Your account:</b> your name, phone number, email address, parish and preferred language.</li>
          <li><b>Your phone:</b> the make and model of your phone, the app version and a random number the app creates. We use these so one account is used on one phone at a time.</li>
          <li><b>Your books:</b> which books you own, and records of your payments (amount, date, reference, and the payment service used). We never see or store your card or bank details.</li>
          <li><b>What you write in the app:</b> notes and bookmarks (kept so you do not lose them when you change phones), prayer requests, counselling requests and testimonies you choose to send.</li>
          <li><b>Teachers only:</b> the class registers they keep (pupils&apos; names, optional phone numbers and attendance).</li>
          <li><b>Notifications:</b> a notification address for your phone, so messages from the church office can reach you.</li>
        </ul>
        <p className="mt-3">We do not collect your location, contacts, photos or files. The app has no advertising and no tracking for advertising.</p>

        <H>Why we use it</H>
        <ul>
          <li>To create your account, unlock the books you buy and keep them on your phone.</li>
          <li>To check payments and help you when something goes wrong.</li>
          <li>To send the daily reading reminder and messages from the church office (you can turn notifications off on your phone).</li>
          <li>To pass prayer requests and counselling requests to the church leaders chosen to handle them. Prayer and counselling requests are private: only those leaders can read them. A testimony is shown to other members only after the church approves it, with your first name only if you allow it.</li>
        </ul>

        <H>Who else handles your information</H>
        <p>We do not sell your information. These services handle it for us, only to run the app:</p>
        <ul>
          <li><b>Supabase</b> stores the accounts and the books (our database).</li>
          <li><b>Google Play</b> handles payments made inside the app.</li>
          <li><b>Flutterwave</b> handles payments made by bank transfer or on our payment page.</li>
          <li><b>Expo and Google Firebase</b> deliver notifications to your phone.</li>
          <li><b>Netlify</b> hosts this website.</li>
          <li><b>WhatsApp (Meta)</b>, only if you choose to message our help line or payment agent.</li>
        </ul>

        <H>How we keep it safe</H>
        <p>Information travels between the app and our servers in encrypted form. Books saved on your phone are locked so they cannot be read outside the app. Only named church admins can see member details, and every change they make is recorded.</p>

        <H>How long we keep it</H>
        <p>We keep your information while you have an account. When you delete your account, we delete your account details, books, notes, bookmarks, prayer requests, counselling requests and phone record. We keep payment records, without your name, for as long as the law requires for accounting, and a short note that the account was deleted.</p>

        <H>Deleting your account</H>
        <p>In the app, open <b>More</b>, then <b>Delete my account</b>. If you no longer have the app, use the form on the <Link href="/delete-account" className="text-brand underline">delete your account</Link> page. We complete requests within 30 days.</p>

        <H>Children</H>
        <p>The app is for church members and families. Children under 13 should use it with a parent or guardian. We do not knowingly collect information from children except the names that Sunday School teachers enter in their class registers.</p>

        <H>Changes</H>
        <p>If we change this policy, we will update this page and the date at the top.</p>

        <H>Contact us</H>
        <p>
          {email ? <>Email: <a className="text-brand underline" href={`mailto:${email}`}>{email}</a><br /></> : null}
          {whatsapp ? <>WhatsApp: <a className="text-brand underline" href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}>{whatsapp}</a><br /></> : null}
          Ona Iwa Mimo C&amp;S Church, National Headquarters, Temple Obaago, Igboho, Oyo State, Nigeria.
        </p>
      </article>
    </PublicShell>
  );
}
