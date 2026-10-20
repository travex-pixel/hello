"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Lightbulb } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils/cn";

interface Props {
  onSend: (text: string) => void;
  onToggleStarters?: () => void;
  startersOpen?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export interface ComposerHandle {
  /** Pre-fill the box, for example from a conversation starter. */
  setText: (text: string) => void;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, onToggleStarters, startersOpen, disabled, placeholder = "Say something" }, handle) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const coarse = useRef(false);

  useEffect(() => {
    coarse.current = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  }, []);

  useImperativeHandle(handle, () => ({
    setText(text: string) {
      setValue(text);
      ref.current?.focus();
    },
  }));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !coarse.current) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      className="flex items-end gap-2 border-t border-line bg-bg/90 px-3 pb-[calc(10px+var(--safe-bottom))] pt-2.5 backdrop-blur-md"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {onToggleStarters && (
        <IconButton label={startersOpen ? "Hide conversation starters" : "Show conversation starters"} onClick={onToggleStarters} className={cn("mb-0.5", startersOpen && "text-accent-strong")}>
          <Lightbulb className="size-5" />
        </IconButton>
      )}
      <label className="sr-only" htmlFor="composer">
        Message
      </label>
      <textarea
        id="composer"
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        enterKeyHint="send"
        autoComplete="off"
        maxLength={1000}
        className="max-h-[140px] min-h-[46px] flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-3 text-[15px] leading-5 text-ink placeholder:text-ink-3 focus:border-accent/60 disabled:opacity-60"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!canSend}
        className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors duration-150 active:scale-95 disabled:bg-surface-3 disabled:text-ink-3"
      >
        <ArrowUp className="size-5" strokeWidth={2.4} />
      </button>
    </form>
  );
});
