"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useHello } from "@/lib/conversation/store";
import type { Feedback } from "@/lib/conversation/types";

interface Props {
  open: boolean;
  conversationId: string;
  characterName: string;
  onClose: () => void;
}

const OPTIONS: { value: Feedback; label: string }[] = [
  { value: "great", label: "Great conversation" },
  { value: "fine", label: "Fine" },
  { value: "not_for_me", label: "Not for me" },
];

/** After the conversation: an optional, one-tap rating, then what next. */
export function EndSheet({ open, conversationId, characterName, onClose }: Props) {
  const router = useRouter();
  const setFeedback = useHello((s) => s.setFeedback);
  const setAutoStart = useHello((s) => s.setAutoStart);
  const [done, setDone] = useState(false);

  const choose = (f: Feedback) => {
    setFeedback(conversationId, f);
    setDone(true);
  };

  const meetSomeoneElse = () => {
    setAutoStart(true);
    router.push("/");
  };

  return (
    <Sheet open={open} onClose={onClose} title={done ? "Thanks. What next?" : `How was ${characterName}?`}>
      {!done ? (
        <div className="flex flex-col gap-2">
          <p className="mb-1 text-sm text-ink-3">Optional. Helps us improve.</p>
          {OPTIONS.map((o) => (
            <Button key={o.value} variant="secondary" size="lg" block onClick={() => choose(o.value)}>
              {o.label}
            </Button>
          ))}
          <Button variant="ghost" block onClick={() => setDone(true)}>
            Skip
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={meetSomeoneElse}>
            Meet someone else
          </Button>
          <Button variant="ghost" block onClick={() => router.push("/")}>
            Done
          </Button>
        </div>
      )}
    </Sheet>
  );
}
