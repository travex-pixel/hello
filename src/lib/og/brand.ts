import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared pieces for the generated share and icon images. They are rendered
 * at build time (statically generated), so reading font files is fine.
 */
export const BRAND = {
  bg: "#0a0c14",
  ink: "#f3f4f8",
  ink2: "#a9aec0",
  ink3: "#6f7489",
  accent: "#6f7cff",
  accentStrong: "#8d98ff",
  line: "rgba(255,255,255,0.10)",
};

export const ORB_BACKGROUND = "radial-gradient(circle at 35% 25%, #9aa3ff 0%, #6f7cff 45%, #3f4bd6 100%)";

export const SHARE_TITLE = "HELLO: Meet someone interesting. In one tap.";
export const SHARE_DESCRIPTION =
  "Bored, a bit shy, or curious? Tap once and start a conversation. Try the AI demo now, no sign-up needed.";
export const SHARE_ALT = "HELLO. Meet someone interesting. In one tap. Choose I'm bored, Warm me up or Surprise me.";

/**
 * Synchronous on purpose: an async file read counts as live data in this
 * Next.js version and would turn the images into per-request renders.
 */
export function loadBrandFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const medium = readFileSync(join(dir, "Geist-Medium.ttf"));
  const semibold = readFileSync(join(dir, "Geist-SemiBold.ttf"));
  return [
    { name: "Geist", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}
