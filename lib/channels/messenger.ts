import type { ChannelAdapter } from "../types";
import { sendViaMeta } from "./meta";

/** Facebook Messenger adapter. recipient = PSID. */
export const messenger: ChannelAdapter = {
  send: (input) => sendViaMeta(input),
};
