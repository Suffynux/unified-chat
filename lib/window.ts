const DAY_MS = 24 * 60 * 60 * 1000;

export type SendWindow =
  | { allowed: true; messagingType: "RESPONSE" }
  | { allowed: true; messagingType: "MESSAGE_TAG"; tag: "HUMAN_AGENT" }
  | { allowed: false; reason: "no_inbound" | "template_required" };

/**
 * Meta outbound window, computed from conversation.last_inbound_at:
 *   < 24h         -> messaging_type RESPONSE
 *   24h – 7 days  -> messaging_type MESSAGE_TAG + tag HUMAN_AGENT
 *   > 7 days      -> blocked; a message template would be required
 */
export function computeSendWindow(
  lastInboundAt: string | null,
  now: number = Date.now()
): SendWindow {
  if (!lastInboundAt) return { allowed: false, reason: "no_inbound" };
  const elapsed = now - new Date(lastInboundAt).getTime();
  if (elapsed < DAY_MS) return { allowed: true, messagingType: "RESPONSE" };
  if (elapsed < 7 * DAY_MS) {
    return { allowed: true, messagingType: "MESSAGE_TAG", tag: "HUMAN_AGENT" };
  }
  return { allowed: false, reason: "template_required" };
}
