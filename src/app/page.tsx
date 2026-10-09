"use client";
import { useEffect, useRef } from "react";

// The mapper is a self-contained browser app (src/studio/studio.js); React
// only gives it a place to live.
export default function Home() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let done = false;
    import("@/studio/studio.js").then((m: any) => { if (!done && ref.current) m.mount(ref.current); });
    return () => { done = true; };
  }, []);
  return <div ref={ref} style={{ height: "100%" }} />;
}
