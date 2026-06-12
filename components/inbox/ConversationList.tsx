"use client";

import type { Conversation } from "@/lib/types";
import ChannelBadge from "./ChannelBadge";

export default function ConversationList({
  conversations,
  selectedId,
  currentAgentId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  currentAgentId: string;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="p-4 text-sm text-zinc-500">
        No conversations yet (or none in your allowed channels).
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {conversations.map((c) => {
        const assignedToOther =
          c.assignee_id !== null && c.assignee_id !== currentAgentId;
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={`w-full px-4 py-3 text-left hover:bg-zinc-50 ${
                c.id === selectedId ? "bg-zinc-100" : ""
              } ${assignedToOther ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {c.contact?.name || c.contact?.external_id || "Unknown"}
                </span>
                {c.unread_count > 0 && (
                  <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <ChannelBadge channel={c.channel} />
                <span>{c.status}</span>
                {assignedToOther && <span>· assigned to another agent</span>}
                {c.last_message_at && (
                  <span className="ml-auto">
                    {new Date(c.last_message_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
