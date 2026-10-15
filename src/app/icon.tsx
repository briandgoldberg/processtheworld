import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// The tab icon: the fork mark.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#2448C9,#7C4DFF)", borderRadius: 14 }}>
        <svg width="38" height="46" viewBox="0 0 18 22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v6a5 5 0 005 5m0 0a5 5 0 005-5V2M9 2v11m0 0v7" /></svg>
      </div>
    ),
    size,
  );
}
