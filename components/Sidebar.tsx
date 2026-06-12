"use client";

import Link from "next/link";
import type { Agent } from "@/lib/types";
import Avatar from "@/components/inbox/Avatar";

type Page = "inbox" | "dashboard" | "profile";

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

/** shadcn-style dark app sidebar: brand, nav, user footer. */
export default function Sidebar({
  active,
  agent,
  email,
  onSignOut,
}: {
  active: Page;
  agent: Agent | null;
  email: string;
  onSignOut: () => void;
}) {
  const items: {
    key: Page;
    href: string;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    { key: "inbox", href: "/", label: "Inbox", icon: <InboxIcon /> },
    {
      key: "dashboard",
      href: "/dashboard",
      label: "Dashboard",
      icon: <DashboardIcon />,
      adminOnly: true,
    },
    { key: "profile", href: "/profile", label: "Profile", icon: <ProfileIcon /> },
  ];

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_luxury_footwear.avif"
          alt="Gomila"
          className="h-9 w-9 rounded-md object-cover"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide">GOMILA</p>
          <p className="text-[11px] text-zinc-400">Unified Inbox</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          if (item.adminOnly && agent?.role !== "admin") return null;
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar name={agent?.name ?? email} url={agent?.avatar_url} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {agent?.name ?? email}
            </p>
            <p className="truncate text-[11px] text-zinc-400">
              {agent ? agent.role : email}
            </p>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            className="text-zinc-400 hover:text-white"
          >
            <SignOutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
