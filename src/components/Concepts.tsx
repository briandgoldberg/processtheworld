export const CONCEPTS: [string, string][] = [
  ["Participant", "Someone or something that takes part in a process or influences it: a plant, a microbe, a river, a machine, a force. Participants are the rows of a map."],
  ["Resource", "Something a step uses or uses up: water, oxygen, sunlight, a tool. Each step has an arrow down to the resources it uses."],
  ["Step", "One thing that happens in a process. Every step has at least one participant and carries evidence."],
  ["Decision fork", "A step where the process can go several ways. Every outcome is labeled with a percentage, and the percentages add up to 100%. It is not limited to yes or no."],
  ["Loop", "A line that carries the process back to an earlier step. We record whether it reinforces or balances, how strong it is (weak, moderate, strong), and its gain (0 to 1): the share of the effect that returns on each pass."],
  ["Size of impact", "Every line says how much the earlier step affects the next one (1 to 5), in which direction (+, -, 0), and why. Thicker lines mean bigger impact."],
  ["Evidence", "The support for a claim: a source and what it shows. Every step, line, change and vote needs it. Click any step or line to read its evidence."],
  ["Boundary", "Where a process starts and where it ends. Every process, and every subprocess, has a start and an end."],
  ["Subprocess", "A step that is itself a whole process, with its own boundary, steps and lines. Click a step marked ↘ to open it. Subprocesses nest as deep as the evidence goes."],
  ["Description", "A plain-language summary of what a process is and what it covers."],
  ["Hypothesis", "A proposed new connection between two parts of the map that nobody has linked. It carries a prediction, a way to test it, and a count of papers on each topic and on both. It is an unverified idea until someone tests it."],
];

export default function Concepts({ open = false }: { open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary><b>What am I looking at?</b> The concepts on every map</summary>
      <dl style={{ margin: "12px 0 0", display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))" }}>
        {CONCEPTS.map(([t, d]) => <div key={t}><dt style={{ fontWeight: 700 }}>{t}</dt><dd style={{ margin: 0 }} className="muted small">{d}</dd></div>)}
      </dl>
    </details>
  );
}
