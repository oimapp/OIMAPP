"use client";

import { useFormState, useFormStatus } from "react-dom";
import { requestDeletion, type DeleteState } from "./actions";

function Send() {
  const { pending } = useFormStatus();
  return <button className="btn w-full" disabled={pending}>{pending ? "Please wait..." : "Ask to delete my account"}</button>;
}

export function DeleteForm() {
  const [state, action] = useFormState<DeleteState, FormData>(requestDeletion, null);
  if (state?.ok) {
    return <p role="status" className="font-medium text-green-700">Thank you. We have your request and will delete the account within 30 days.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="phone">Phone number of the account</label>
        <input id="phone" name="phone" className="input" inputMode="tel" placeholder="0803 123 4567" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email (optional, so we can tell you when it is done)</label>
        <input id="email" name="email" type="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="note">Anything else (optional)</label>
        <input id="note" name="note" className="input" maxLength={200} />
      </div>
      {/* Left empty by people; filled by spam robots. */}
      <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {state?.error && <p role="alert" className="text-sm font-medium text-church-red">{state.error}</p>}
      <Send />
    </form>
  );
}
