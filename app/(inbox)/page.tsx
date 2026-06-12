"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import type { Agent, Conversation, Message } from "@/lib/types";
import ChannelBadge from "@/components/inbox/ChannelBadge";
import Sidebar from "@/components/Sidebar";
import ConversationList from "@/components/inbox/ConversationList";
import ReplyBox from "@/components/inbox/ReplyBox";
import SignIn from "@/components/inbox/SignIn";
import ThreadView from "@/components/inbox/ThreadView";

interface SessionUser {
  id: string;
  email: string;
}

export default function InboxPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  // Restore an existing session.
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

  // Load the agent row for the signed-in user (RLS lets agents read their own).
  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("agents")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAgent((data as Agent) ?? null));
  }, [supabase, user]);

  const loadConversations = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("conversations")
      .select("*, contact:contacts(*)")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setConversations((data as unknown as Conversation[]) ?? []);
  }, [supabase]);

  // Initial load + Realtime subscription. RLS applies to both the fetch and
  // the realtime stream, so agents only ever see their allowed channels.
  useEffect(() => {
    if (!supabase || !user) return;
    loadConversations();

    const channel = supabase
      .channel("inbox-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadConversations()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            m.conversation_id === selectedIdRef.current &&
            !prev.some((x) => x.id === m.id)
              ? [...prev, m]
              : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, loadConversations]);

  // Load the thread when the selection changes.
  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!supabase || !selectedId) {
      setMessages([]);
      return;
    }
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []));
  }, [supabase, selectedId]);

  const handleSend = useCallback(
    async (text: string): Promise<string | null> => {
      if (!selectedId) return "No conversation selected";
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedId,
          text,
          agentId: user?.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return json.message ?? json.error ?? "Send failed";
      return null; // the stored outbound message arrives via Realtime
    },
    [selectedId, user]
  );

  if (!supabase) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm">
          <h1 className="mb-2 font-semibold">Supabase not configured</h1>
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill
            in <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then restart the dev
            server. See README.md for the full setup order.
          </p>
        </div>
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

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const lockedByOther =
    selected !== null &&
    selected.assignee_id !== null &&
    selected.assignee_id !== user.id;

  return (
    <div className="flex h-screen">
      <Sidebar
        active="inbox"
        agent={agent}
        email={user.email}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setUser(null);
          setAgent(null);
        }}
      />

      <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 px-4 py-4">
          <h1 className="text-sm font-semibold">Conversations</h1>
        </header>
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            currentAgentId={user.id}
            onSelect={setSelectedId}
          />
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selected.contact?.name ||
                    selected.contact?.external_id ||
                    "Unknown"}
                </p>
                <p className="text-xs text-zinc-500">{selected.status}</p>
              </div>
              <ChannelBadge channel={selected.channel} />
            </header>
            <ThreadView messages={messages} />
            <ReplyBox
              disabled={lockedByOther}
              disabledReason={
                lockedByOther
                  ? "This conversation is assigned to another agent."
                  : undefined
              }
              onSend={handleSend}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Select a conversation
          </div>
        )}
      </main>
    </div>
  );
}
