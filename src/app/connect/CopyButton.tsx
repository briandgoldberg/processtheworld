"use client";
import { useState } from "react";

// Copies a piece of text (given directly, or fetched from a URL on this site).
export default function CopyButton({ text, url, label = "Copy", primary = false }: { text?: string; url?: string; label?: string; primary?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      let value = text ?? "";
      if (!text && url) value = await (await fetch(url)).text();
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt("Copy this:", text ?? url ?? "");
    }
  }
  return (
    <button type="button" className={"btn" + (primary ? " primary" : "")} onClick={copy}>
      {done ? "Copied" : label}
    </button>
  );
}
