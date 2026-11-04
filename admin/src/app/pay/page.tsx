import { naira, productsOnSale, setting } from "@/lib/payments";
import { PayForm } from "./PayForm";
import { Shell } from "./Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buy the books · Ona Iwa Mimo", robots: { index: false } };

export default async function PayPage({ searchParams }: { searchParams: { book?: string; phone?: string } }) {
  const [products, on, agent] = await Promise.all([productsOnSale(), setting<boolean>("pay_web"), setting<string>("agent_whatsapp")]);
  return (
    <Shell>
      <h1 className="mb-1 font-serif text-2xl font-bold">Buy the 2027 books</h1>
      <p className="mb-5 text-sm text-muted">Rà àwọn ìwé 2027. The books open in the Ona Iwa Mimo app, in English and Yoruba.</p>
      {on === false || !products.length ? (
        <div className="card p-5 text-sm">
          {products.length ? "Paying on this page is paused for now." : "The 2027 books are not on sale yet."}{" "}
          {agent ? <>You can message our WhatsApp agent on <b>{agent}</b>.</> : null}
        </div>
      ) : (
        <div className="card p-5">
          <PayForm products={products.map((p) => ({ id: p.id, name_en: p.name_en, name_yo: p.name_yo, price: naira(p.price_kobo) }))} preset={{ product: searchParams.book, phone: searchParams.phone }} />
        </div>
      )}
      {agent ? <p className="mt-5 text-center text-sm text-muted">Prefer bank transfer on WhatsApp? Message <b>{agent}</b>.</p> : null}
    </Shell>
  );
}
