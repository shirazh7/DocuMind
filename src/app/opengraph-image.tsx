import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DocuMind — Enterprise Knowledge Assistant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 50%, #0a0a0b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
            >
              <path
                d="M8 10h10M8 16h16M8 22h12"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="24" cy="10" r="3" fill="#93C5FD" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            DocuMind
          </span>
        </div>
        <span
          style={{
            fontSize: "24px",
            color: "#a1a1aa",
            maxWidth: "600px",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Enterprise Knowledge Assistant
        </span>
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "48px",
            color: "#71717a",
            fontSize: "16px",
          }}
        >
          <span>RAG Pipeline</span>
          <span style={{ color: "#3f3f46" }}>|</span>
          <span>Tool Calling</span>
          <span style={{ color: "#3f3f46" }}>|</span>
          <span>Vercel AI SDK</span>
          <span style={{ color: "#3f3f46" }}>|</span>
          <span>Next.js</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
