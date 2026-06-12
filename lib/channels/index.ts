import type { Channel, ChannelAdapter } from "../types";
import { messenger } from "./messenger";
import { instagram } from "./instagram";
import { email } from "./email";

const adapters: Record<Channel, ChannelAdapter> = {
  messenger,
  instagram,
  email,
};

/** Router: pick the outbound adapter for a conversation's channel. */
export function adapterFor(channel: Channel): ChannelAdapter {
  return adapters[channel];
}
