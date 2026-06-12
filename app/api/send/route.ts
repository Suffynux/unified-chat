import { adapterFor } from "@/lib/channels";
import { supabaseServer } from "@/lib/supabase";
import { computeSendWindow } from "@/lib/window";
import type { Channel, Contact, SendInput } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST { conversationId, text, agentId? }
 * Looks up the conversation's channel + last_inbound_at, enforces the Meta
 * outbound window, routes to the channel adapter, stores the outbound message.
 */
export async function POST(req: Request) {
  let body: { conversationId?: string; text?: string; agentId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!body.conversationId || !text) {
    return Response.json(
      { error: "conversationId and text are required" },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  if (!db) {
    return Response.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const { data: conversation, error } = await db
    .from("conversations")
    .select("*, contact:contacts(*)")
    .eq("id", body.conversationId)
    .single();
  if (error || !conversation) {
    return Response.json({ error: "conversation_not_found" }, { status: 404 });
  }

  const channel = conversation.channel as Channel;
  const contact = conversation.contact as Contact;
  const input: SendInput = {
    conversationId: conversation.id,
    recipientExternalId: contact.external_id,
    text,
  };

  if (channel === "messenger" || channel === "instagram") {
    const window = computeSendWindow(conversation.last_inbound_at);
    if (!window.allowed) {
      return Response.json(
        {
          error: window.reason,
          templateRequired: window.reason === "template_required",
          message:
            window.reason === "template_required"
              ? "Last inbound message is older than 7 days — Meta requires an approved message template to re-open this conversation."
              : "No inbound message yet — Meta only allows replies to customer-initiated conversations.",
        },
        { status: 422 }
      );
    }
    input.messagingType = window.messagingType;
    if (window.messagingType === "MESSAGE_TAG") input.tag = window.tag;
  }

  if (channel === "email") {
    const { data: lastInbound } = await db
      .from("messages")
      .select("external_id, attachments")
      .eq("conversation_id", conversation.id)
      .eq("direction", "in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    input.toEmail = contact.external_id;
    input.inReplyTo = lastInbound?.external_id ?? null;
    input.references = lastInbound?.external_id ?? null;

    const meta = Array.isArray(lastInbound?.attachments)
      ? (lastInbound.attachments as Array<{ type?: string; subject?: string | null }>).find(
          (a) => a?.type === "email"
        )
      : null;
    const subject = meta?.subject ?? null;
    input.subject = subject
      ? /^re:/i.test(subject)
        ? subject
        : `Re: ${subject}`
      : null;
  }

  const result = await adapterFor(channel).send(input);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  const { data: stored, error: insertError } = await db
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "out",
      body: text,
      external_id: result.externalMessageId ?? null,
      author: body.agentId ?? "agent",
      attachments: [],
    })
    .select("id")
    .single();
  if (insertError) {
    // The provider accepted the message but we failed to record it.
    return Response.json(
      { error: `sent_but_not_stored: ${insertError.message}` },
      { status: 500 }
    );
  }

  await db
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), unread_count: 0 })
    .eq("id", conversation.id);

  return Response.json({
    ok: true,
    messageId: stored.id,
    messagingType: input.messagingType ?? null,
  });
}
