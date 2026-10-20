"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ChatScreen } from "@/components/chat/ChatScreen";

function ChatRoute() {
  const params = useParams<{ id: string }>();
  return <ChatScreen conversationId={params.id} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-ink-3">Opening chat…</div>}>
      <ChatRoute />
    </Suspense>
  );
}
