import { ImageResponse } from "next/og";
import { BRAND, ORB_BACKGROUND } from "@/lib/og/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser tab icon: the glowing iris sphere on near-black. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.paper, borderRadius: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, background: ORB_BACKGROUND, border: "1px solid rgba(255,255,255,0.25)" }} />
      </div>
    ),
    size,
  );
}
