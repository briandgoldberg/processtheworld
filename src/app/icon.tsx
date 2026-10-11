import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// The tab icon: the "f" mark.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2448C9", borderRadius: 14, color: "#fff", fontSize: 44, fontWeight: 800 }}>
        f
      </div>
    ),
    size,
  );
}
