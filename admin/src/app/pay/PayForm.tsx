"use client";

import { useFormState, useFormStatus } from "react-dom";
import { startPay, type PayState } from "./actions";

type P = { id: string; name_en: string; name_yo: string; price: string };

function Go() {
  const { pending } = useFormStatus();
  return <button className="btn w-full text-base" disabled={pending}>{pending ? "Opening Flutterwave..." : "Continue to payment"}</button>;
}

export function PayForm({ products, preset }: { products: P[]; preset?: { product?: string; phone?: string } }) {
  const [state, action] = useFormState<PayState, FormData>(startPay, null);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="label">Choose / Yan ìwé</legend>
        {products.map((p, i) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="radio" name="product" value={p.id} defaultChecked={preset?.product ? preset.product === p.id : i === 0} className="h-5 w-5" />
            <span className="flex-1"><b className="block">{p.name_en}</b><span className="text-sm text-muted">{p.name_yo}</span></span>
            <b className="font-serif text-lg text-brand">{p.price}</b>
          </label>
        ))}
      </fieldset>
      <div>
        <label className="label" htmlFor="for_phone">Phone number on the app account the book is for</label>
        <input id="for_phone" name="for_phone" defaultValue={preset?.phone} className="input" inputMode="tel" placeholder="0803 123 4567" required />
        <span className="hint">Nọ́ńbà fóònù tó wà lórí àkáǹtì áàpù. To buy for someone else, type their number. If they have no account yet, the book waits for them.</span>
      </div>
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input id="name" name="name" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Your email (for the receipt)</label>
        <input id="email" name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="payer_phone">Your phone number (optional)</label>
        <input id="payer_phone" name="payer_phone" className="input" inputMode="tel" />
      </div>
      {state?.error && <p className="rounded-lg bg-church-soft p-3 text-sm text-church-red">{state.error}</p>}
      <Go />
      <p className="text-center text-xs text-muted">You pay securely on Flutterwave by card, bank transfer or USSD.</p>
    </form>
  );
}
