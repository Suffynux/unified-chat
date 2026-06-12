"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import type { Agent, Channel, Conversation } from "@/lib/types";
import Avatar from "@/components/inbox/Avatar";
import ChannelBadge from "@/components/inbox/ChannelBadge";
import SignIn from "@/components/inbox/SignIn";
import Sidebar from "@/components/Sidebar";

interface SessionUser {
  id: string;
  email: string;
}

const CHANNELS: Channel[] = ["messenger", "instagram", "email"];

export default function DashboardPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentChecked, setAgentChecked] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

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
        setAgent((data as Agent) ?? null);
        setAgentChecked(true);
      });
  }, [supabase, user]);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const [agentsRes, convsRes] = await Promise.all([
      supabase.from("agents").select("*").order("created_at"),
      supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .order("last_message_at", { ascending: false, nullsFirst: false }),
    ]);
    setAgents((agentsRes.data as Agent[]) ?? []);
    setConversations((convsRes.data as unknown as Conversation[]) ?? []);
  }, [supabase]);

  // Only load (and live-refresh) once we know the viewer is an admin.
  useEffect(() => {
    if (!supabase || agent?.role !== "admin") return;
    loadData();
    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, agent, loadData]);

  if (!supabase) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Supabase not configured — see README.md.
      </div>
    );
  }

  if (!sessionChecked || (user && !agentChecked)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <SignIn supabase={supabase} onSignedIn={setUser} />;
  }

  if (agent?.role !== "admin") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-sm text-zinc-500">
        <p>This page is for admins only.</p>
        <Link href="/" className="text-zinc-700 underline">
          Back to inbox
        </Link>
      </div>
    );
  }

  const open = conversations.filter((c) => c.status === "open");
  const unreadTotal = conversations.reduce((n, c) => n + c.unread_count, 0);
  const byChannel = Object.fromEntries(
    CHANNELS.map((ch) => [ch, conversations.filter((c) => c.channel === ch).length])
  ) as Record<Channel, number>;
  const agentName = (id: string | null) =>
    id ? agents.find((a) => a.id === id)?.name ?? "Unknown" : "Unassigned";

  return (
    <div className="flex h-screen">
      <Sidebar
        active="dashboard"
        agent={agent}
        email={user.email}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setUser(null);
          setAgent(null);
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <div>
            <h1 className="text-lg font-semibold">Admin dashboard</h1>
            <p className="text-xs text-zinc-500">
              Live overview of all channels and the team
            </p>
          </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Conversations", conversations.length],
          ["Open", open.length],
          ["Unread", unreadTotal],
          ["Messenger", byChannel.messenger],
          ["Instagram", byChannel.instagram],
          ["Email", byChannel.email],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold">
          Team
        </h2>
        <ul className="divide-y divide-zinc-100">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={a.name} url={a.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {a.name}
                  {a.role === "admin" && (
                    <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                      admin
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-zinc-500">{a.email}</p>
              </div>
              <div className="flex gap-1">
                {a.allowed_channels.map((ch) => (
                  <ChannelBadge key={ch} channel={ch} />
                ))}
              </div>
              <p className="w-24 text-right text-xs text-zinc-500">
                {
                  conversations.filter(
                    (c) => c.assignee_id === a.id && c.status === "open"
                  ).length
                }{" "}
                open
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold">
          Recent conversations (all channels)
        </h2>
        {conversations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            No conversations yet — they will appear here as soon as a channel
            is connected and a customer messages you.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {conversations.slice(0, 20).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <ChannelBadge channel={c.channel} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.contact?.name || c.contact?.external_id || "Unknown"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {c.status} · {agentName(c.assignee_id)}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                    {c.unread_count}
                  </span>
                )}
                <p className="w-36 text-right text-xs text-zinc-400">
                  {c.last_message_at
                    ? new Date(c.last_message_at).toLocaleString()
                    : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
        </div>
      </main>
    </div>
  );
}
