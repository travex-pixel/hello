import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE = {
  sm: "size-9 text-sm",
  md: "size-12 text-lg",
  lg: "size-20 text-3xl",
  xl: "size-24 text-4xl",
};

/**
 * Characters have no photos on purpose: a letter on a tinted field reads as
 * an illustration, not a person, which keeps the AI demo honest at a glance.
 */
export function Avatar({ name, hue, size = "md", className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none", SIZE[size], className)}
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, hsl(${hue} 85% 72%) 0%, hsl(${hue} 60% 48%) 55%, hsl(${(hue + 30) % 360} 55% 32%) 100%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 10px 30px -14px hsl(${hue} 80% 55% / 0.8)`,
      }}
    >
      <span className="translate-y-px">{initial}</span>
    </div>
  );
}
