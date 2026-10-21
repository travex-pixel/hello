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
 * One art direction for every character: a deep tinted disc with a pale
 * serif initial. It reads as an illustration, never a photo of a person,
 * which keeps the AI demo honest at a glance.
 */
export function Avatar({ name, hue, size = "md", className }: AvatarProps) {
  const initial = name.trim().charAt(0).toLowerCase();
  return (
    <div
      aria-hidden="true"
      className={cn("display relative inline-flex shrink-0 items-center justify-center rounded-full select-none", SIZE[size], className)}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 48% 30%), hsl(${hue} 52% 20%))`,
        color: `hsl(${hue} 85% 84%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.12) inset, 0 0 0 1px hsl(${hue} 50% 45% / 0.45)`,
      }}
    >
      <span className="-translate-y-[0.06em]">{initial}</span>
    </div>
  );
}
