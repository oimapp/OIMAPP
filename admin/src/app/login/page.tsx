"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(
    params.get("reason") === "not-admin" ? "This account is not on the admin team. Ask the main admin to add you." : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "The email or password is wrong." : error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-deep p-5">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <img src="/logo.jpg" alt="Church logo" className="h-16 w-16 rounded-full" />
        <h1 className="mt-4 font-serif text-2xl font-bold text-brand">Ona Iwa Mimo Admin</h1>
        <p className="mb-6 mt-1 text-sm text-muted">For the conference team only.</p>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input mb-4" />
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        {error && <p role="alert" className="mt-3 text-sm font-medium text-church-red">{error}</p>}
        <button className="btn mt-6 w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
