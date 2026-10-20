import { ImageResponse } from "next/og";
import { BRAND, ORB_BACKGROUND, SHARE_ALT, loadBrandFonts } from "@/lib/og/brand";

export const alt = SHARE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MODES = ["I'm bored", "Warm me up", "Surprise me"];

/** The preview card shown when the link is shared in messages and social apps. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BRAND.paper,
          fontFamily: "Geist",
          color: BRAND.ink,
          overflow: "hidden",
        }}
      >
        {/* Warm light behind the button, kept inside the frame. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            background: "radial-gradient(ellipse 700px 540px at 930px 315px, rgba(242,85,44,0.22) 0%, rgba(242,85,44,0.07) 45%, rgba(251,247,240,0) 75%)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 0 56px 76px", width: 690 }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 44, letterSpacing: -1 }}>
            hello<span style={{ color: BRAND.accent }}>.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Fraunces", fontSize: 88, lineHeight: 0.98, letterSpacing: -3 }}>
              <span>Meet someone new.</span>
              <span style={{ color: BRAND.accent }}>In one tap.</span>
            </div>
            <div style={{ display: "flex", marginTop: 36, gap: 12 }}>
              {MODES.map((m, i) => (
                <div
                  key={m}
                  style={{
                    display: "flex",
                    padding: "12px 22px",
                    borderRadius: 999,
                    fontSize: 25,
                    fontWeight: 600,
                    background: i === 0 ? BRAND.surface : "rgba(255,255,255,0.5)",
                    border: `1.5px solid ${i === 0 ? "rgba(28,25,20,0.2)" : BRAND.line}`,
                    color: i === 0 ? BRAND.ink : BRAND.ink2,
                  }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", fontSize: 24, fontWeight: 500, color: BRAND.ink3 }}>
            <div style={{ width: 11, height: 11, borderRadius: 999, background: BRAND.mintInk, marginRight: 14 }} />
            Try the AI demo now. No sign-up.
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}>
          {[540, 450].map((d, i) => (
            <div key={d} style={{ position: "absolute", width: d, height: d, borderRadius: 9999, border: `2px solid rgba(242,85,44,${i === 0 ? 0.14 : 0.26})` }} />
          ))}
          {/* Speech-bubble tail */}
          <div style={{ position: "absolute", left: 104, top: 428, width: 60, height: 60, borderRadius: 10, background: "#cf3d1b", transform: "rotate(45deg)" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 360,
              height: 360,
              borderRadius: 9999,
              background: ORB_BACKGROUND,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 338,
                height: 338,
                borderRadius: 9999,
                border: "1.5px solid rgba(255,255,255,0.3)",
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: 7,
                color: "#ffffff",
              }}
            >
              SAY HELLO
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: loadBrandFonts() },
  );
}
