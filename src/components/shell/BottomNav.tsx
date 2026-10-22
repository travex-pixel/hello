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

/** A floating frosted tab bar, clear of the home indicator. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(var(--safe-bottom)+10px)]">
      <ul className="glass pointer-events-auto flex h-[var(--nav-height)] w-full max-w-[340px] items-stretch rounded-full p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_-12px_rgba(0,0,0,0.85)]">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors duration-150",
                  active ? "bg-white/[0.08] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <Icon className={cn("size-[21px]", active && "text-accent")} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
