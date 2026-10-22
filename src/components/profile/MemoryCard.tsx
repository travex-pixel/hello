"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useHello } from "@/lib/conversation/store";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

/** What hello remembers about you: visible, editable, deletable, and switchable off. */
export function MemoryCard({ Card }: { Card: (p: { title: string; children: React.ReactNode }) => React.ReactNode }) {
  const memories = useHello((s) => s.memories);
  const enabled = useHello((s) => s.memoryEnabled);
  const setEnabled = useHello((s) => s.setMemoryEnabled);
  const update = useHello((s) => s.updateMemory);
  const remove = useHello((s) => s.deleteMemory);
  const clear = useHello((s) => s.clearMemories);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <Card title="What hello remembers">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-1 size-4" />
        <span>
          Remember things I mention, like my name or my dog&rsquo;s name, so characters can bring them up next time.{" "}
          <span className="text-ink-3">Kept on this device only.</span>
        </span>
      </label>
      {memories.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {memories.map((m) => (
            <li key={m.id} className="flex min-h-[48px] items-center gap-2 py-1.5">
              {editing === m.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    update(m.id, draft);
                    setEditing(null);
                  }}
                >
                  <label className="sr-only" htmlFor={`mem-${m.id}`}>
                    Edit memory
                  </label>
                  <input
                    id={`mem-${m.id}`}
                    autoFocus
                    value={draft}
                    maxLength={120}
                    onChange={(e) => setDraft(e.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-black/30 px-3 text-[15px] text-ink"
                  />
                  <Button size="sm" type="submit">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 text-[15px] text-ink">{m.kind === "name" ? `Goes by ${m.text}` : m.text.charAt(0).toUpperCase() + m.text.slice(1)}</span>
                  <IconButton
                    label={`Edit "${m.text}"`}
                    onClick={() => {
                      setEditing(m.id);
                      setDraft(m.text);
                    }}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={`Forget "${m.text}"`} onClick={() => remove(m.id)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {memories.length > 0 && (
        <Button variant="danger" block onClick={clear}>
          Forget everything
        </Button>
      )}
    </Card>
  );
}
