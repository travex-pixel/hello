import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared pieces for the generated share and icon images. Rendered at build
 * time (statically generated), so reading font files synchronously is fine.
 */
export const BRAND = {
  paper: "#07080d",
  surface: "#161922",
  ink: "#f4f5f8",
  ink2: "#a8afbf",
  ink3: "#8c93a5",
  accent: "#aeabff",
  mintInk: "#6fe3b6",
  line: "rgba(255,255,255,0.1)",
};

export const ORB_BACKGROUND = "radial-gradient(circle at 30% 20%, #c9c5ff 0%, #8a80fa 26%, #5b52e4 55%, #3a2fb6 80%, #241c7a 100%)";

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
