"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import type { Agent } from "@/lib/types";
import Avatar from "@/components/inbox/Avatar";
import SignIn from "@/components/inbox/SignIn";

interface SessionUser {
  id: string;
  email: string;
}

export default function ProfilePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSessionChecked(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? "" });
      }
      setSessionChecked(true);
    });
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("agents")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const a = (data as Agent) ?? null;
        setAgent(a);
        if (a) setName(a.name);
      });
  }, [supabase, user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !supabase || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ kind: "error", text: "Image must be under 2 MB." });
      return;
    }
    setUploading(true);
    setNotice(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setNotice({ kind: "error", text: uploadError.message });
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbError } = await supabase
      .from("agents")
      .update({ avatar_url: pub.publicUrl })
      .eq("id", user.id);
    setUploading(false);
    if (dbError) {
      setNotice({ kind: "error", text: dbError.message });
      return;
    }
    setAgent((a) => (a ? { ...a, avatar_url: pub.publicUrl } : a));
    setNotice({ kind: "ok", text: "Profile photo updated." });
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user || !name.trim()) return;
    setSavingName(true);
    setNotice(null);
    const { error } = await supabase
      .from("agents")
      .update({ name: name.trim() })
      .eq("id", user.id);
    setSavingName(false);
    if (error) {
      setNotice({ kind: "error", text: error.message });
      return;
    }
    setAgent((a) => (a ? { ...a, name: name.trim() } : a));
    setNotice({ kind: "ok", text: "Name updated." });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 6) {
      setNotice({
        kind: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ kind: "error", text: "Passwords do not match." });
      return;
    }
    setSavingPassword(true);
    setNotice(null);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSavingPassword(false);
    if (error) {
      setNotice({ kind: "error", text: error.message });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setNotice({ kind: "ok", text: "Password changed." });
  }

  if (!supabase) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Supabase not configured — see README.md.
      </div>
    );
  }

  if (!sessionChecked) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <SignIn supabase={supabase} onSignedIn={setUser} />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My profile</h1>
        <Link href="/" className="text-xs text-zinc-600 hover:underline">
          ← Back to inbox
        </Link>
      </div>

      {notice && (
        <p
          className={`rounded border px-3 py-2 text-xs ${
            notice.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Photo</h2>
        <div className="flex items-center gap-4">
          <Avatar
            name={agent?.name ?? user.email}
            url={agent?.avatar_url}
            size={64}
          />
          <label className="cursor-pointer rounded border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-50">
            {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={handleAvatarChange}
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Email</label>
            <input
              value={user.email}
              disabled
              className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Email and channel access are managed by the admin.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {savingName ? "Saving…" : "Save details"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">Change password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {savingPassword ? "Saving…" : "Change password"}
          </button>
        </form>
      </section>
    </div>
  );
}
