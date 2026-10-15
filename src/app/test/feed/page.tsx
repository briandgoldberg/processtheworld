import type { Metadata } from "next";
import { W, Linktrees, Process, trees } from "../shared";

export const metadata: Metadata = {
  title: "Test: step by step",
  description: "Every step, line, participant and resource in the test process, with evidence and validations.",
  alternates: { canonical: "/test/feed" },
  robots: { index: false },
};

export default function Feed() {
  return (
    <main className="lib privacy">
      <p><a href="/test">Back to the test</a></p>
      <h1>The process, step by step</h1>
      <p>{W.meta.title}</p>
      <details>
        <summary><b>Linktrees</b> (participants and resources)</summary>
        <p>Pick a name to see every process and step that uses it.</p>
        <Linktrees title="Participants" data={trees("participants")} />
        <Linktrees title="Resources" data={trees("resources")} />
      </details>
      <h2>Steps</h2>
      <Process id="p0" depth={0} />
    </main>
  );
}
