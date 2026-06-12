import type { Channel } from "@/lib/types";

const styles: Record<Channel, string> = {
  messenger: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
  email: "bg-amber-100 text-amber-700",
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
