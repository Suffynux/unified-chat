/** Round avatar: photo when set, otherwise the first letter of the name. */
export default function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url: string | null | undefined;
  size?: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
