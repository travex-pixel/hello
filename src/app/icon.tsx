import { ImageResponse } from "next/og";
import { BRAND, ORB_BACKGROUND } from "@/lib/og/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser tab icon: the coral speech bubble on midnight navy. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.paper, borderRadius: 14, position: "relative" }}>
        <div style={{ position: "absolute", left: 14, top: 40, width: 12, height: 12, borderRadius: 2, background: "#e8503c", transform: "rotate(45deg)" }} />
        <div style={{ width: 42, height: 42, borderRadius: 999, background: ORB_BACKGROUND }} />
      </div>
    ),
    size,
  );
}
