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
          background: BRAND.bg,
          fontFamily: "Geist",
          color: BRAND.ink,
          overflow: "hidden",
        }}
      >
        {/* Ambient light behind the orb. Kept inside the frame: the renderer cuts off gradients that overflow it. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            background: "radial-gradient(ellipse 760px 560px at 950px 315px, rgba(111,124,255,0.26) 0%, rgba(111,124,255,0.08) 45%, rgba(10,12,20,0) 75%)",
          }}
        />

        {/* Left column: message */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 76px", width: 700 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: 10 }}>HELLO</div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2.5 }}>
              <span>Meet someone</span>
              <span>interesting.</span>
              <span style={{ color: BRAND.accentStrong }}>In one tap.</span>
            </div>
            <div style={{ display: "flex", marginTop: 34, gap: 12 }}>
              {MODES.map((m, i) => (
                <div
                  key={m}
                  style={{
                    display: "flex",
                    padding: "12px 22px",
                    borderRadius: 999,
                    fontSize: 25,
                    fontWeight: 500,
                    border: `1.5px solid ${i === 0 ? "rgba(141,152,255,0.6)" : BRAND.line}`,
                    background: i === 0 ? "rgba(111,124,255,0.18)" : "rgba(255,255,255,0.04)",
                    color: i === 0 ? BRAND.ink : BRAND.ink2,
                  }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", fontSize: 24, fontWeight: 500, color: BRAND.ink3 }}>
            <div style={{ width: 11, height: 11, borderRadius: 999, background: "#5bd58c", marginRight: 14 }} />
            Try the AI demo now. No sign-up.
          </div>
        </div>

        {/* Right column: the signature button */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}>
          {/* Glow as a gradient: large blurred shadows get clipped into a visible rectangle by the renderer. */}
          <div
            style={{
              position: "absolute",
              width: 640,
              height: 640,
              borderRadius: 9999,
              background: "radial-gradient(circle, rgba(111,124,255,0.55) 0%, rgba(111,124,255,0.22) 34%, rgba(111,124,255,0) 62%)",
            }}
          />
          {[540, 450].map((d, i) => (
            <div
              key={d}
              style={{
                position: "absolute",
                width: d,
                height: d,
                borderRadius: 9999,
                border: `2px solid rgba(141,152,255,${i === 0 ? 0.14 : 0.26})`,
              }}
            />
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 360,
              height: 360,
              borderRadius: 9999,
              background: ORB_BACKGROUND,
              border: "2px solid rgba(141,152,255,0.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 336,
                height: 336,
                borderRadius: 9999,
                border: "1.5px solid rgba(255,255,255,0.18)",
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
