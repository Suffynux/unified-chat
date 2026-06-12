import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gomila — Unified Inbox",
  description: "Gomila support inbox for Messenger, Instagram and email",
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
