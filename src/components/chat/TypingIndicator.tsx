export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-start" role="status" aria-label={`${name} is typing`}>
      <div className="flex h-10 items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-surface-2 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.06)]">
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden="true" className="size-1.5 rounded-full bg-ink-2 animate-typing-dot" style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
    </div>
  );
}
