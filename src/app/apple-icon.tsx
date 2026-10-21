import { ImageResponse } from "next/og";
import { BRAND, ORB_BACKGROUND, loadBrandFonts } from "@/lib/og/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon on iPhone. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.paper, position: "relative", fontFamily: "Fraunces" }}>
        <div style={{ position: "absolute", left: 38, top: 116, width: 32, height: 32, borderRadius: 6, background: "#e8503c", transform: "rotate(45deg)" }} />
        <div style={{ width: 124, height: 124, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: ORB_BACKGROUND, color: "#080d19", fontSize: 52, letterSpacing: -1 }}>
          hello
        </div>
      </div>
    ),
    { ...size, fonts: loadBrandFonts() },
  );
}
