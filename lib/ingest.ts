import { supabaseServer } from "./supabase";
import type { InboundMessage } from "./types";

export interface IngestResult {
  ok: boolean;
  conversationId?: string;
  duplicate?: boolean;
  error?: string;
}

/**
 * Channel-agnostic inbound pipeline. Every adapter (Messenger, Instagram,
 * email) funnels into this with the same normalized shape:
 *   1. find-or-create the contact by (channel, external_id)
 *   2. find-or-create the open conversation (or use an explicit id from
 *      email plus-addressing)
 *   3. insert the message
 *   4. bump last_inbound_at / last_message_at / unread_count atomically
 */
export async function ingest(msg: InboundMessage): Promise<IngestResult> {
  const db = supabaseServer();
  if (!db) return { ok: false, error: "supabase_not_configured" };

  // Providers retry webhooks; dedupe on the provider message id.
  if (msg.externalMessageId) {
    const { data: existing } = await db
      .from("messages")
      .select("id, conversation_id")
      .eq("external_id", msg.externalMessageId)
      .maybeSingle();
    if (existing) {
      return { ok: true, conversationId: existing.conversation_id, duplicate: true };
    }
  }

  // 1. Contact
  let { data: contact } = await db
    .from("contacts")
    .select("id, name")
    .eq("channel", msg.channel)
    .eq("external_id", msg.externalContactId)
    .maybeSingle();

  if (!contact) {
    const { data: created, error } = await db
      .from("contacts")
      .insert({
        channel: msg.channel,
        external_id: msg.externalContactId,
        name: msg.contactName ?? null,
      })
      .select("id, name")
      .single();
    if (error) {
      // Unique violation = a concurrent webhook created it first; re-read.
      const { data: again } = await db
        .from("contacts")
        .select("id, name")
        .eq("channel", msg.channel)
        .eq("external_id", msg.externalContactId)
        .maybeSingle();
      if (!again) return { ok: false, error: error.message };
      contact = again;
    } else {
      contact = created;
    }
  } else if (msg.contactName && !contact.name) {
    await db.from("contacts").update({ name: msg.contactName }).eq("id", contact.id);
  }

  // 2. Conversation — an explicit id (email plus-address) wins.
  let conversationId: string | null = null;
  if (msg.conversationId) {
    const { data } = await db
      .from("conversations")
      .select("id")
      .eq("id", msg.conversationId)
      .maybeSingle();
    if (data) conversationId = data.id as string;
  }
  if (!conversationId) {
    const { data } = await db
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data) conversationId = data.id as string;
  }
  if (!conversationId) {
    const { data, error } = await db
      .from("conversations")
      .insert({ channel: msg.channel, contact_id: contact.id, status: "open" })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    conversationId = data.id as string;
  }

  // 3. Message
  const { error: msgError } = await db.from("messages").insert({
    conversation_id: conversationId,
    direction: "in",
    body: msg.text,
    external_id: msg.externalMessageId ?? null,
    author: msg.contactName ?? msg.externalContactId,
    attachments: msg.attachments ?? [],
  });
  if (msgError) {
    // 23505 = unique violation on external_id (concurrent retry) — already stored.
    if (msgError.code === "23505") {
      return { ok: true, conversationId, duplicate: true };
    }
    return { ok: false, error: msgError.message };
  }

  // 4. Counters — single UPDATE in SQL so concurrent webhooks don't lose bumps.
  const { error: rpcError } = await db.rpc("record_inbound", {
    p_conversation_id: conversationId,
    p_at: new Date().toISOString(),
  });
  if (rpcError) return { ok: false, error: rpcError.message };

  return { ok: true, conversationId };
}
