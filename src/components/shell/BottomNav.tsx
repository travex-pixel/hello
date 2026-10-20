"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/", label: "Discover", icon: Sparkles, match: (p: string) => p === "/" },
  { href: "/chats", label: "Chats", icon: MessageCircle, match: (p: string) => p.startsWith("/chats") },
  { href: "/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/profile") || p.startsWith("/people") },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[var(--safe-bottom)] backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:rounded-t-2xl sm:border-x"
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-md items-stretch justify-around px-2">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors duration-150",
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <Icon className={cn("size-[22px]", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
