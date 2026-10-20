import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared pieces for the generated share and icon images. Rendered at build
 * time (statically generated), so reading font files synchronously is fine.
 */
export const BRAND = {
  paper: "#fbf7f0",
  surface: "#ffffff",
  ink: "#1b1917",
  ink2: "#5a554e",
  ink3: "#736c62",
  accent: "#c93a18",
  coral: "#f2552c",
  cobalt: "#1e3fd9",
  cobaltSoft: "#e4e9fb",
  mintInk: "#176b42",
  line: "rgba(28,25,20,0.12)",
};

export const ORB_BACKGROUND = "radial-gradient(circle at 32% 22%, #ff8a66 0%, #f2552c 48%, #c93a18 100%)";

export const SHARE_TITLE = "hello: Meet someone new. In one tap.";
export const SHARE_DESCRIPTION =
  "Bored, a bit shy, or curious? Tap once and start a conversation. Try the AI demo now, no sign-up needed.";
export const SHARE_ALT = "hello. Meet someone new. In one tap. Choose I'm bored, Warm me up or Surprise me.";

export function loadBrandFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  return [
    { name: "Geist", data: readFileSync(join(dir, "Geist-Medium.ttf")), weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: readFileSync(join(dir, "Geist-SemiBold.ttf")), weight: 600 as const, style: "normal" as const },
    { name: "Fraunces", data: readFileSync(join(dir, "Fraunces-Medium.woff")), weight: 500 as const, style: "normal" as const },
  ];
}
