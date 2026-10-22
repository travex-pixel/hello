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
          background: `radial-gradient(circle at 50% 50%, rgba(106,98,239,0.45) 0%, ${BRAND.paper} 70%)`,
          fontFamily: "Fraunces",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: ORB_BACKGROUND,
            border: "1.5px solid rgba(255,255,255,0.25)",
            color: "#ffffff",
            fontSize: 46,
            letterSpacing: -1,
          }}
        >
          hello
        </div>
      </div>
    ),
    { ...size, fonts: loadBrandFonts() },
  );
}
