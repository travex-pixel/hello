import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * The brand: lowercase "hello" in the display serif with a vermilion full
 * stop. The stop is the mark; it recurs on the big button and the icons.
 */
export function Wordmark({ size = "md", href, className }: { size?: "sm" | "md" | "lg"; href?: string; className?: string }) {
  const text = (
    <span className={cn("display inline-flex items-baseline leading-none text-ink", size === "sm" ? "text-[22px]" : size === "lg" ? "text-[34px]" : "text-[26px]", className)}>
      hello
      <span aria-hidden="true" className="text-accent">
        .
      </span>
    </span>
  );
  if (!href) return text;
  return (
    <Link href={href} aria-label="hello home" className="-m-1 rounded-sm p-1">
      {text}
    </Link>
  );
}
