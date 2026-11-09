import { ImageResponse } from "next/og";

export const alt = "Northwind Dental, a fictional demo clinic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Raw hex is an accepted exception in this file (see CLAUDE.md): next/og renders
// outside the page CSS, so design tokens (CSS variables) are not available.
// Token source: app/globals.css, @theme block. Keep these values in sync:
//   #f0f9ff = --color-tint         #e0f2fe = --color-tint-strong
//   #bae6fd = --color-wash         #0369a1 = --color-brand
//   #075985 = --color-brand-strong #082f49 = --color-ink
//   #35546a = --color-muted
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 90px",
          background: "#f0f9ff",
          color: "#082f49",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            Northwind Dental
          </div>
          <div style={{ marginTop: 28, fontSize: 36, color: "#35546a" }}>
            Friendly dental care for the whole family
          </div>
          <div
            style={{
              marginTop: 40,
              fontSize: 26,
              color: "#075985",
              background: "#e0f2fe",
              padding: "10px 22px",
              borderRadius: 999,
              alignSelf: "flex-start",
            }}
          >
            Demo project, not a real clinic
          </div>
        </div>
        <div
          style={{
            width: 340,
            height: 340,
            borderRadius: 170,
            background: "#e0f2fe",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="220" height="220" viewBox="0 0 48 48">
            <path
              d="M24 8c-3-2-8-3-11 0-4 3-4 9-2 14 1 4 1 9 3 15 1 3 4 3 5 0 1-3 1-7 5-7s4 4 5 7c1 3 4 3 5 0 2-6 2-11 3-15 2-5 2-11-2-14-3-3-8-2-11 0z"
              fill="#bae6fd"
              stroke="#0369a1"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
