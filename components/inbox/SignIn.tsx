"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import PasswordInput from "@/components/ui/PasswordInput";

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
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <form
        onSubmit={handleSubmit}
        className="w-80 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
      >
        <div className="flex flex-col items-center gap-2 pb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_luxury_footwear.avif"
            alt="Gomila"
            className="h-14 w-14 rounded-lg object-cover"
          />
          <h1 className="text-lg font-semibold tracking-wide">GOMILA</h1>
          <p className="text-xs text-zinc-500">
            Sign in to the support inbox
          </p>
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        />
        <PasswordInput
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
