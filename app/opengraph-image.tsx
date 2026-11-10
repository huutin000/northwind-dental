import { ImageResponse } from "next/og";

export const alt = "Northwind Dental, a fictional demo clinic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Raw hex is an accepted exception in this file (see CLAUDE.md): next/og renders
// outside the page CSS, so design tokens (CSS variables) are not available.
// Token source: app/globals.css, @theme block. Keep these values in sync:
//   #fbf8f2 = --color-canvas       #f3ebdd = --color-sand
//   #dcebf5 = --color-tint-strong  #0369a1 = --color-brand
//   #075985 = --color-brand-strong #0b2540 = --color-ink
//   #46607a = --color-muted        #f6c3a0 = --color-peach
// The tooth path is the ToothMark shape from components/illustrations/Decor.tsx.
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
          background: "#fbf8f2",
          color: "#0b2540",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            Northwind Dental
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: "#46607a" }}>
            A fictional dental clinic for a demo project
          </div>
          <div
            style={{
              marginTop: 40,
              fontSize: 26,
              color: "#075985",
              background: "#dcebf5",
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
            width: 360,
            height: 500,
            marginTop: 130,
            borderTopLeftRadius: 180,
            borderTopRightRadius: 180,
            background: "#f3ebdd",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 280,
              height: 400,
              borderTopLeftRadius: 140,
              borderTopRightRadius: 140,
              background: "#f6c3a0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="190" height="190" viewBox="0 0 24 24">
              <path
                d="M12 6C10.5 4.2 8.5 3.5 6.8 4.2 4.8 5 4 7 4.4 9.4 4.8 12 6 13.5 6.4 16.2 6.7 18.2 7.2 20.5 8.6 20.5 10 20.5 10.2 17 12 17 13.8 17 14 20.5 15.4 20.5 16.8 20.5 17.3 18.2 17.6 16.2 18 13.5 19.2 12 19.6 9.4 20 7 19.2 5 17.2 4.2 15.5 3.5 13.5 4.2 12 6Z"
                fill="#fbf8f2"
                stroke="#0369a1"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
