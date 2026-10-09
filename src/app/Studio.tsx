"use client";
import { useEffect, useRef } from "react";

// The mapper is a self-contained browser app (src/studio/studio.js); React
// only gives it a place to live. `open` is a public process to show first.
export default function Studio({ open }: { open?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let done = false;
    import("@/studio/studio.js").then((m: any) => { if (!done && ref.current) m.mount(ref.current, { open }); });
    return () => { done = true; };
  }, [open]);
  return <div ref={ref} style={{ height: "100%" }} />;
}
