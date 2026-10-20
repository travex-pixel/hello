import { ImageResponse } from "next/og";
import { BRAND, ORB_BACKGROUND, loadBrandFonts } from "@/lib/og/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon on iPhone. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 45%, rgba(111,124,255,0.35) 0%, ${BRAND.bg} 70%)`,
          fontFamily: "Geist",
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: ORB_BACKGROUND,
            border: "1.5px solid rgba(141,152,255,0.6)",
            color: "#fff",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
          }}
        >
          HELLO
        </div>
      </div>
    ),
    { ...size, fonts: loadBrandFonts() },
  );
}
