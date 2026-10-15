"use client";
import { useState } from "react";

export default function CopyBox({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="copybox">
      <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* ignore */ } }}>{done ? "Copied" : label}</button>
      <pre>{text}</pre>
    </div>
  );
}
