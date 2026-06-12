"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";

export default function ThreadView({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.length === 0 && (
        <p className="text-sm text-zinc-500">No messages in this thread.</p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
              m.direction === "out"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.body || "(no text)"}</p>
            <p
              className={`mt-1 text-[10px] ${
                m.direction === "out" ? "text-zinc-400" : "text-zinc-400"
              }`}
            >
              {new Date(m.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
