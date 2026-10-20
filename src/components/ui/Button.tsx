"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_8px_24px_-12px_rgba(111,124,255,0.8)] hover:bg-accent-strong active:bg-accent-deep disabled:bg-surface-3 disabled:text-ink-3 disabled:shadow-none",
  secondary: "bg-surface-2 text-ink border border-line hover:bg-surface-3 active:bg-surface-3 disabled:text-ink-3",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-3 disabled:text-ink-3",
  danger: "bg-transparent text-danger border border-line hover:bg-danger/10 active:bg-danger/15 disabled:text-ink-3",
};

const SIZE: Record<Size, string> = {
  sm: "h-10 px-4 text-sm rounded-sm gap-2",
  md: "h-12 px-5 text-[15px] rounded-md gap-2",
  lg: "h-14 px-6 text-base rounded-lg gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, block = false, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.975 }}
      transition={{ duration: 0.12 }}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center font-medium select-none transition-colors duration-150 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...(rest as object)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children && <span className={cn(loading && "opacity-80")}>{children}</span>}
    </motion.button>
  );
});
