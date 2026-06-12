import crypto from "node:crypto";
import { ingest } from "@/lib/ingest";

export const runtime = "nodejs";

// support+<conversationId>@domain — replies addressed this way are routed
// straight to that conversation.
const PLUS_ADDRESS_RE =
  /\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i;

interface EmailInboundPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  headers?: Record<string, string>;
}

/**
 * Generic provider signature check: HMAC-SHA256 of the raw body with
 * EMAIL_WEBHOOK_SECRET, sent as a hex digest in `x-webhook-signature`.
 * Swap this for your provider's real scheme (Resend uses svix headers).
 * With no secret configured, requests are accepted in development only.
 */
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Parse `Jane Doe <jane@example.com>` into name + lowercased address. */
function parseAddress(value: string): { email: string; name: string | null } {
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim().toLowerCase() };
  }
  return { name: null, email: value.trim().toLowerCase() };
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-webhook-signature"))) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: EmailInboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "bad_payload" }, { status: 400 });
  }
  if (!payload.from) {
    return Response.json({ error: "missing_from" }, { status: 400 });
  }

  const { email: fromEmail, name } = parseAddress(payload.from);
  const headers = Object.fromEntries(
    Object.entries(payload.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const conversationId = (payload.to ?? "").match(PLUS_ADDRESS_RE)?.[1] ?? null;

  const result = await ingest({
    channel: "email",
    externalContactId: fromEmail,
    contactName: name,
    text: payload.text ?? "",
    externalMessageId: headers["message-id"] ?? null,
    conversationId,
    // Subject rides along in attachments jsonb so replies can prefix "Re:".
    attachments: [{ type: "email", subject: payload.subject ?? null }],
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json({ ok: true, conversationId: result.conversationId });
}
