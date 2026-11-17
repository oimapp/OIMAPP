import { PublicShell } from "@/components/PublicShell";
import { DeleteForm } from "./DeleteForm";

export const metadata = { title: "Delete your account · Ona Iwa Mimo app", robots: { index: true, follow: true } };

export default function DeleteAccount() {
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold text-brand-deep">Delete your Ona Iwa Mimo account</h1>
      <p className="mt-3">You can delete your account and the information linked to it at any time.</p>

      <h2 className="mb-2 mt-6 font-serif text-xl font-bold text-brand-deep">In the app (fastest)</h2>
      <ol className="ml-5 list-decimal leading-relaxed">
        <li>Open the Ona Iwa Mimo app.</li>
        <li>Tap <b>More</b> at the bottom.</li>
        <li>Scroll down and tap <b>Delete my account</b>.</li>
        <li>Type <b>DELETE</b> and confirm. Your account is deleted straight away.</li>
      </ol>

      <h2 className="mb-2 mt-6 font-serif text-xl font-bold text-brand-deep">Without the app</h2>
      <p className="mb-4">Fill in this form with the phone number of your account. We will delete the account within 30 days and let you know.</p>
      <div className="card p-5"><DeleteForm /></div>

      <h2 className="mb-2 mt-6 font-serif text-xl font-bold text-brand-deep">What is deleted</h2>
      <ul className="ml-5 list-disc leading-relaxed">
        <li>Your account: name, phone number, email, parish and language.</li>
        <li>The books on your account. They cannot be given back after the account is deleted.</li>
        <li>Your notes, bookmarks, prayer requests, counselling requests and testimonies.</li>
        <li>The record of the phone you used.</li>
      </ul>
      <p className="mt-3">We keep payment records, without your name, for as long as the law requires for accounting, and a short note that the account was deleted.</p>
    </PublicShell>
  );
}
