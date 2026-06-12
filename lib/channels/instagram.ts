import type { ChannelAdapter } from "../types";
import { sendViaMeta } from "./meta";

/**
 * Instagram DM adapter. recipient = IGSID. Sends through the same
 * /me/messages endpoint with the same Page token as Messenger.
 */
export const instagram: ChannelAdapter = {
  send: (input) => sendViaMeta(input),
};
