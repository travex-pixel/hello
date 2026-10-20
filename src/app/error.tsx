"use client";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
      <p className="text-sm text-ink-2">Your conversations are still saved on this device.</p>
      <Button className="mt-2" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
