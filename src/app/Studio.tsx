"use client";
import { useEffect, useRef } from "react";

// The mapper is a self-contained browser app (src/studio/studio.js); React
// only gives it a place to live. `open` is a public process to show first;
// `embed` shows just the map, for use inside an iframe.
export default function Studio({ open, embed }: { open?: string; embed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let done = false;
    import("@/studio/studio.js").then((m: any) => { if (!done && ref.current) m.mount(ref.current, { open, embed }); });
    return () => { done = true; };
  }, [open, embed]);
  return <div ref={ref} style={{ height: "100%" }} />;
}
