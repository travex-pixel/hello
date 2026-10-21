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
        {/* Warm light behind the button and a cool one low on the left, kept inside the frame. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            background:
              "radial-gradient(ellipse 720px 560px at 930px 315px, rgba(255,107,87,0.28) 0%, rgba(255,107,87,0.08) 45%, rgba(8,13,25,0) 75%), radial-gradient(ellipse 500px 360px at 120px 640px, rgba(71,123,255,0.22) 0%, rgba(8,13,25,0) 70%)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 0 56px 76px", width: 690 }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 44, letterSpacing: -1 }}>
            hello<span style={{ color: BRAND.accent }}>.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Fraunces", fontSize: 84, lineHeight: 1, letterSpacing: -3 }}>
              <span>Meet someone</span>
              <div style={{ display: "flex" }}>
                <span>interesting</span>
                <span style={{ color: BRAND.accent }}>.</span>
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: BRAND.ink2 }}>A good conversation can start with anyone.</div>
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
                    background: i === 0 ? "rgba(255,107,87,0.14)" : BRAND.surface,
                    border: `1.5px solid ${i === 0 ? BRAND.accent : BRAND.line}`,
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
            <div key={d} style={{ position: "absolute", width: d, height: d, borderRadius: 9999, border: `2px solid rgba(255,107,87,${i === 0 ? 0.14 : 0.26})` }} />
          ))}
          {/* Speech-bubble tail */}
          <div style={{ position: "absolute", left: 104, top: 428, width: 60, height: 60, borderRadius: 10, background: "#e8503c", transform: "rotate(45deg)" }} />
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 338,
                height: 338,
                borderRadius: 9999,
                border: "1.5px solid rgba(255,255,255,0.3)",
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: 5,
                lineHeight: 1.3,
                color: "#080d19",
              }}
            >
              <span>START A</span>
              <span>CONVERSATION</span>
              <span style={{ marginTop: 10, fontSize: 34, letterSpacing: 0 }}>→</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: loadBrandFonts() },
  );
}
