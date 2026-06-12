"use client";

import { useState } from "react";

export default function ReplyBox({
  disabled,
  disabledReason,
  onSend,
}: {
  disabled: boolean;
  disabledReason?: string;
  /** Returns an error message, or null on success. */
  onSend: (text: string) => Promise<string | null>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const err = await onSend(trimmed);
    setSending(false);
    if (err) {
      setError(err);
    } else {
      setText("");
    }
  }

  return (
    <div className="border-t border-zinc-200 bg-white p-3">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {disabled && disabledReason && (
        <p className="mb-2 text-xs text-zinc-500">{disabledReason}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          disabled={disabled || sending}
          placeholder={disabled ? "Replying is disabled" : "Type a reply…"}
          className="flex-1 resize-none rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none disabled:bg-zinc-100"
        />
        <button
          onClick={handleSend}
          disabled={disabled || sending || !text.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
