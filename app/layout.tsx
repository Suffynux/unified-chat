import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Inbox",
  description: "Messenger, Instagram and email support inbox",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
