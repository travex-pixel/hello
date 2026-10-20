"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { HumanChatScreen } from "@/components/people/HumanChatScreen";

function HumanChatRoute() {
  const params = useParams<{ id: string }>();
  return <HumanChatScreen conversationId={params.id} />;
}

export default function HumanChatPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-ink-3">Opening…</div>}>
      <HumanChatRoute />
    </Suspense>
  );
}
