"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { BottomNav } from "./BottomNav";
import { useHello } from "@/lib/conversation/store";
import { trackVisit } from "@/lib/analytics/track";

const FULLSCREEN = [/^\/chat\//, /^\/people\/chat\//];

/**
 * Reads the URL, so it lives inside Suspense: Next prerenders the static
 * shell without it and streams it in. Chat screens hide the nav and take the
 * whole viewport themselves.
 */
function NavSlot() {
  const pathname = usePathname();
  if (FULLSCREEN.some((rx) => rx.test(pathname))) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[calc(var(--nav-height)+var(--safe-bottom)+14px)] shrink-0" />
      <BottomNav />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const setReducedMotion = useHello((s) => s.setReducedMotion);

  useEffect(() => {
    void useHello.persist.rehydrate();
    trackVisit();
  }, []);

  useEffect(() => {
    setReducedMotion(!!reduce);
  }, [reduce, setReducedMotion]);

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col overflow-x-clip">
      {children}
      <Suspense fallback={null}>
        <NavSlot />
      </Suspense>
    </main>
  );
}
