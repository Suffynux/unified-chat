import type { SendInput, SendResult } from "../types";

/**
 * Shared Meta send path. ONE Meta app serves both Messenger and Instagram:
 * both channels send via POST /me/messages with the Page access token
 * (Messenger Platform path). The recipient id is a PSID (messenger) or
 * IGSID (instagram) — the Graph API resolves it from the id itself.
 */
export async function sendViaMeta(input: SendInput): Promise<SendResult> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: "meta_not_configured: set FB_PAGE_ACCESS_TOKEN" };
  }
  const version = process.env.GRAPH_API_VERSION || "v23.0";

  const res = await fetch(
    `https://graph.facebook.com/${version}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: input.recipientExternalId },
        messaging_type: input.messagingType ?? "RESPONSE",
        ...(input.tag ? { tag: input.tag } : {}),
        message: { text: input.text },
      }),
    }
  );

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      error: `graph_api_error ${res.status}: ${JSON.stringify(json?.error ?? json)}`,
    };
  }
  return { ok: true, externalMessageId: json?.message_id ?? null };
}
