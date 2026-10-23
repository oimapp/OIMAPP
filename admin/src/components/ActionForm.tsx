"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { State } from "@/app/actions";

type Action = (state: State, f: FormData) => Promise<State>;

/** A form that runs a server action and shows "Saved" or the problem under it. */
export function ActionForm({
  action, children, className, confirm, resetOnSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {children}
      {state?.error && <p role="alert" className="mt-2 text-sm font-medium text-church-red">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-sm font-medium text-green-700">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, variant = "btn" }: { children: React.ReactNode; variant?: "btn" | "btn-ghost" | "btn-danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={variant} disabled={pending}>
      {pending ? "Please wait..." : children}
    </button>
  );
}
