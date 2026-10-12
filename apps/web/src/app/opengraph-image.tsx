import { ImageResponse } from "next/og";
import { BRAND, markDataUri } from "@/lib/brand-mark";

export const alt =
  "Pluto — spend in any currency, understand it in yours. Track spending with daily ECB exchange rates.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card. Figures are illustrative. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: BRAND.canvas,
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Soft emerald glow, top-left. */}
        <div
          style={{
            position: "absolute",
            top: "-260px",
            left: "-120px",
            width: "760px",
            height: "760px",
            display: "flex",
            background:
              "radial-gradient(closest-side, rgba(52,211,153,0.28), rgba(52,211,153,0))",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={markDataUri({ ink: BRAND.planetDark, ring: BRAND.emerald })}
            width={72}
            height={72}
            alt=""
          />
          <div style={{ fontSize: "44px", fontWeight: 700, color: BRAND.ink }}>Pluto</div>
          <div
            style={{
              marginLeft: "12px",
              display: "flex",
              alignItems: "center",
              fontSize: "20px",
              fontWeight: 600,
              color: BRAND.emerald,
              background: "rgba(52,211,153,0.14)",
              borderRadius: "999px",
              padding: "8px 18px",
            }}
          >
            Web and mobile
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "44px",
            maxWidth: "980px",
            fontSize: "68px",
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: "-1.5px",
            color: BRAND.ink,
          }}
        >
          Spend in any currency. Understand it in yours.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "26px",
            maxWidth: "900px",
            fontSize: "28px",
            lineHeight: 1.4,
            color: BRAND.muted,
          }}
        >
          Record every purchase as you paid it. Totals, budgets and reports,
          converted with daily ECB reference rates.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginTop: "44px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "18px",
              background: BRAND.surface,
              padding: "16px 24px",
              fontSize: "26px",
            }}
          >
            <span style={{ color: BRAND.muted, fontWeight: 600 }}>Paid €6.50</span>
            <span style={{ color: BRAND.emerald, fontWeight: 700 }}>→</span>
            <span
              style={{
                color: BRAND.ink,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ₹585
            </span>
          </div>
          <span style={{ fontSize: "22px", color: BRAND.muted }}>Illustrative</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
