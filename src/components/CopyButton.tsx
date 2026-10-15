"use client";
import { useState } from "react";

// One button that copies text to the clipboard. The text itself is not shown.
export default function CopyButton({ text, label = "Copy prompt", className = "btn primary" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={className} onClick={async () => {
      try { await navigator.clipboard.writeText(text); }
      catch {
        const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); } catch { /* no clipboard available */ }
        t.remove();
      }
      setDone(true); setTimeout(() => setDone(false), 1800);
    }}>{done ? "Copied" : label}</button>
  );
}
