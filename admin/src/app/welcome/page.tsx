import { PublicShell } from "@/components/PublicShell";
import { setting } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ona Iwa Mimo app",
  description: "The Sunday School Manual, Daily Divine Bread, hymn book and Bible of Ona Iwa Mimo C&S Church, in English and Yoruba.",
  robots: { index: true, follow: true },
};

const FEATURES: [string, string][] = [
  ["Sunday School Manual", "Every lesson for the year, in English and Yoruba, with a teacher's area for class registers."],
  ["Daily Divine Bread (Oúnjẹ Ìyè Ojoojúmọ́)", "The reading for each day, with a reminder every morning."],
  ["Hymn book", "866 hymns and 45 Kneeling Songs in English and Yoruba. Search by number, title or any words you remember."],
  ["The Holy Bible", "King James Version and the Yoruba Bible, free and offline."],
  ["Church Constitution", "The Constitution of the church in English and the Òfin in Yoruba."],
  ["Church life", "The church calendar, districts and churches with phone numbers and directions, leaders, prayer requests and testimonies."],
];

export default async function Welcome() {
  const play = (await setting<string>("play_url")) || "https://play.google.com/store/apps/details?id=com.onaiwamimo.app";
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold leading-tight text-brand-deep">The Ona Iwa Mimo app</h1>
      <p className="mt-3 text-lg text-ink">The books of Ona Iwa Mimo Cherubim and Seraphim Church on your phone, in English and Yoruba. Read anywhere, even without data.</p>
      <a href={play} className="btn mt-5 inline-flex">Get it on Google Play</a>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="card p-4">
            <h2 className="font-semibold text-brand-deep">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        Motto: &quot;And an highway shall be there, and a way, and it shall be called The way of holiness.&quot; Isaiah 35:8
      </p>
    </PublicShell>
  );
}
