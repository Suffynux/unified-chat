import crypto from "node:crypto";
import { ingest } from "@/lib/ingest";
import type { Channel } from "@/lib/types";

export const runtime = "nodejs";

interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
  delivery?: unknown;
  read?: unknown;
  reaction?: unknown;
  postback?: unknown;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{ messaging?: MetaMessagingEvent[] }>;
}

/** Meta verification handshake: echo hub.challenge when the verify token matches. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.FB_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.FB_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.slice("sha256=".length), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * One webhook for both Meta channels. The payload `object` field tells them
 * apart: "page" = Messenger (sender.id is a PSID), "instagram" = Instagram
 * (sender.id is an IGSID). Everything else is the same handler.
 */
export async function POST(req: Request) {
  // Raw body FIRST — the HMAC is over the exact bytes Meta sent. Parsing
  // before hashing (re-serialized JSON) would break verification.
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const channel: Channel | null =
    payload.object === "page"
      ? "messenger"
      : payload.object === "instagram"
        ? "instagram"
        : null;
  if (!channel) return new Response("EVENT_RECEIVED", { status: 200 });

  const events = (payload.entry ?? []).flatMap((e) => e.messaging ?? []);
  for (const event of events) {
    // Skip non-message events (delivery receipts, reads, reactions,
    // postbacks) and echoes of our own outbound messages.
    if (!event.message || event.message.is_echo || !event.sender?.id) continue;

    try {
      const result = await ingest({
        channel,
        externalContactId: event.sender.id,
        text: event.message.text ?? "",
        externalMessageId: event.message.mid ?? null,
        attachments: event.message.attachments ?? [],
      });
      if (!result.ok) console.error("webhook ingest failed:", result.error);
    } catch (err) {
      console.error("webhook ingest threw:", err);
    }
  }

  // Always 200 once the signature checks out, even on ingest errors —
  // otherwise Meta retries aggressively and eventually disables the webhook.
  return new Response("EVENT_RECEIVED", { status: 200 });
}
