"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function SignIn({
  supabase,
  onSignedIn,
}: {
  supabase: SupabaseClient;
  onSignedIn: (user: { id: string; email: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error || !data.user) {
      setError(error?.message ?? "Sign-in failed");
      return;
    }
    onSignedIn({ id: data.user.id, email: data.user.email ?? email });
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-80 space-y-3 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <h1 className="text-lg font-semibold">Agent sign in</h1>
        <p className="text-xs text-zinc-500">
          Use a Supabase Auth user that has a matching row in the agents table.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
