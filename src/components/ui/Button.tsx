"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "cobalt";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

/* Primary is pearl: the brightest object on a dark screen, so there is never doubt about what to tap. */
const VARIANT: Record<Variant, string> = {
  primary: "bg-[linear-gradient(180deg,#ffffff,#e6e8ef)] text-ink-inverse shadow-button hover:brightness-105 active:brightness-95 disabled:bg-none disabled:bg-surface-3 disabled:text-ink-3 disabled:shadow-none",
  cobalt: "bg-cobalt-deep text-white hover:bg-cobalt active:bg-cobalt-deep disabled:bg-surface-3 disabled:text-ink-3",
  secondary: "bg-white/[0.06] text-ink shadow-soft hover:bg-white/[0.1] active:bg-white/[0.04] disabled:text-ink-3 disabled:shadow-none",
  ghost: "bg-transparent text-ink-2 hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.04] disabled:text-ink-3",
  danger: "bg-white/[0.04] text-danger shadow-soft hover:bg-danger/10 active:bg-danger/15 disabled:text-ink-3",
};

const SIZE: Record<Size, string> = {
  sm: "h-10 px-4 text-sm gap-2",
  md: "h-12 px-5 text-[15px] gap-2",
  lg: "h-[56px] px-6 text-[17px] gap-2.5",
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
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed",
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
