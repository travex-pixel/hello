import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared pieces for the generated share and icon images. Rendered at build
 * time (statically generated), so reading font files synchronously is fine.
 */
export const BRAND = {
  paper: "#080d19",
  surface: "#111827",
  ink: "#f7f7fb",
  ink2: "#9aa8c4",
  ink3: "#8593b0",
  accent: "#ff6b57",
  coral: "#ff6b57",
  cobalt: "#477bff",
  cobaltSoft: "rgba(71,123,255,0.16)",
  mintInk: "#62e6b5",
  line: "#27334a",
};

export const ORB_BACKGROUND = "radial-gradient(circle at 32% 22%, #ffa08f 0%, #ff6b57 48%, #e8503c 100%)";

export const SHARE_TITLE = "hello: Meet someone interesting.";
export const SHARE_DESCRIPTION =
  "A good conversation can start with anyone. Pick a mood, tap once, and start talking. Try the AI demo now, no sign-up needed.";
export const SHARE_ALT = "hello. Meet someone interesting. A good conversation can start with anyone. Choose I'm bored, Warm me up or Surprise me.";

export function loadBrandFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  return [
    { name: "Geist", data: readFileSync(join(dir, "Geist-Medium.ttf")), weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: readFileSync(join(dir, "Geist-SemiBold.ttf")), weight: 600 as const, style: "normal" as const },
    { name: "Fraunces", data: readFileSync(join(dir, "Fraunces-Medium.woff")), weight: 500 as const, style: "normal" as const },
  ];
}
