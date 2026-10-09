"use client";
import { useEffect, useRef } from "react";

export default function Admin() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let done = false;
    import("@/studio/admin.js").then((m: any) => { if (!done && ref.current) m.mountAdmin(ref.current); });
    return () => { done = true; };
  }, []);
  return <div ref={ref} style={{ minHeight: "100%" }} />;
}
