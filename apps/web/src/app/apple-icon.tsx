import { ImageResponse } from "next/og";
import { BRAND, markDataUri } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const alt = "Pluto app icon";

/** Apple touch icon: full-bleed graphite tile with the mint planet mark. */
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
          background: BRAND.canvas,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={markDataUri({
            ink: BRAND.planetDark,
            ring: BRAND.emerald,
            strokeWidth: 2.6,
          })}
          width={126}
          height={126}
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
