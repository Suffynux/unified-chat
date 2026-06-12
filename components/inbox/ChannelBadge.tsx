import type { Channel } from "@/lib/types";

// Monochrome variants: distinguishable by weight, not color.
const styles: Record<Channel, string> = {
  messenger: "bg-zinc-900 text-white",
  instagram: "bg-zinc-200 text-zinc-800",
  email: "border border-zinc-300 bg-white text-zinc-600",
};

export default function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[channel]}`}
    >
      {channel}
    </span>
  );
}
