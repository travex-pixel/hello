import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE = {
  sm: "size-9 text-[17px]",
  md: "size-12 text-[22px]",
  lg: "size-20 text-[38px]",
  xl: "size-24 text-[44px]",
};

/**
 * One art direction for every character: a soft tinted disc with a serif
 * initial. It reads as an illustration, never a photo of a person, which
 * keeps the AI demo honest at a glance.
 */
export function Avatar({ name, hue, size = "md", className }: AvatarProps) {
  const initial = name.trim().charAt(0).toLowerCase();
  return (
    <div
      aria-hidden="true"
      className={cn("display relative inline-flex shrink-0 items-center justify-center rounded-full select-none", SIZE[size], className)}
      style={{
        background: `hsl(${hue} 72% 86%)`,
        color: `hsl(${hue} 45% 26%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 0 0 1px hsl(${hue} 40% 70% / 0.5)`,
      }}
    >
      <span className="-translate-y-[0.06em]">{initial}</span>
    </div>
  );
}
