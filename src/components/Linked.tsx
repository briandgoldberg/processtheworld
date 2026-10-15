import type { ReactNode } from "react";

// Shows an evidence source with its web links and DOIs clickable.
const RE = /(https?:\/\/[^\s)>\]"',;]+|\b10\.\d{4,9}\/[^\s)>\]"',;]+)/gi;

export default function Linked({ text }: { text: string }) {
  const out: ReactNode[] = []; let last = 0; let m: RegExpExecArray | null; let i = 0;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) {
    const raw = m[0].replace(/[.]+$/, "");
    const href = raw.startsWith("http") ? raw : "https://doi.org/" + raw;
    out.push(text.slice(last, m.index));
    out.push(<a key={i++} href={href} target="_blank" rel="noopener noreferrer nofollow">{raw}</a>);
    last = m.index + raw.length; RE.lastIndex = last;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}
