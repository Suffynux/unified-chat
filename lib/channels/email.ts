import type { ChannelAdapter } from "../types";

/**
 * Email adapter — Resend placeholder.
 *
 * Replies map back to conversations via a plus-addressed reply-to
 * (support+<conversationId>@EMAIL_REPLY_DOMAIN); the inbound webhook parses
 * the UUID back out. In-Reply-To / References are set from the last inbound
 * Message-ID so mail clients keep the thread together.
 */
export const email: ChannelAdapter = {
  async send(input) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM_ADDRESS;
    const replyDomain = process.env.EMAIL_REPLY_DOMAIN;
    if (!apiKey || !from || !replyDomain) {
      return {
        ok: false,
        error:
          "email_not_configured: set RESEND_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_REPLY_DOMAIN",
      };
    }

    const headers: Record<string, string> = {};
    if (input.inReplyTo) {
      headers["In-Reply-To"] = input.inReplyTo;
      headers["References"] = input.references ?? input.inReplyTo;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.toEmail ?? input.recipientExternalId,
        subject: input.subject ?? "Re: your message",
        text: input.text,
        reply_to: `support+${input.conversationId}@${replyDomain}`,
        headers,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `resend_error ${res.status}: ${JSON.stringify(json)}` };
    }
    return { ok: true, externalMessageId: json?.id ?? null };
  },
};
