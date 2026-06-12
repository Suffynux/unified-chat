export type Channel = "messenger" | "instagram" | "email";

/**
 * The ONE normalized shape every channel adapter produces for inbound
 * traffic. The core (lib/ingest.ts) only ever sees this.
 */
export interface InboundMessage {
  channel: Channel;
  /** PSID (messenger), IGSID (instagram), or lowercased email address. */
  externalContactId: string;
  contactName?: string | null;
  text: string;
  /** Provider message id (Meta `mid` / email Message-ID). Used for dedupe + threading. */
  externalMessageId?: string | null;
  attachments?: unknown[];
  /** Route directly into a known conversation (email plus-addressed reply-to). */
  conversationId?: string | null;
}

/** Normalized outbound payload handed to a channel adapter's send(). */
export interface SendInput {
  conversationId: string;
  recipientExternalId: string;
  text: string;
  /** Meta only — computed from the 24h/7d window. */
  messagingType?: "RESPONSE" | "MESSAGE_TAG";
  tag?: string;
  /** Email only — threading. */
  toEmail?: string;
  subject?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}

export interface SendResult {
  ok: boolean;
  externalMessageId?: string | null;
  error?: string;
}

export interface ChannelAdapter {
  send(input: SendInput): Promise<SendResult>;
}

// ---- Database row shapes ----

export interface Agent {
  id: string;
  email: string;
  name: string;
  role: "admin" | "agent";
  allowed_channels: Channel[];
  avatar_url: string | null;
}

export interface Contact {
  id: string;
  channel: Channel;
  external_id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  channel: Channel;
  contact_id: string;
  status: "open" | "pending" | "closed";
  assignee_id: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
  unread_count: number;
  contact?: Contact;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  body: string;
  external_id: string | null;
  author: string | null;
  attachments: unknown;
  created_at: string;
}
