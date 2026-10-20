"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "default" | "subtle";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, tone = "default", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150 active:scale-95",
        tone === "default" ? "text-ink-2 hover:bg-surface-2 hover:text-ink" : "text-ink-3 hover:text-ink-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
