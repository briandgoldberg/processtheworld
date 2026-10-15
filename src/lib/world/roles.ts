// How a step relates to a resource, following the usual process-mapping convention for inputs, outputs and mechanisms:
//   consumed: taken in and used up (an input)        arrow runs from the resource into the step
//   produced: made or released by the step (output)   arrow runs from the step out to the resource
//   used:     needed but not used up (a mechanism)    arrow runs from the resource into the step, drawn lighter
// Agents can say which on a step ("resourceRoles"). Until they do, the role is read from the step's wording.
import type { Step } from "./types";

export type Role = "consumed" | "produced" | "used";
export const ROLE_LABEL: Record<Role, string> = { consumed: "uses up", produced: "makes", used: "uses" };

const PRODUCE = /(releas|emit|produc|generat|form(s|ed|ing)?\b|export|exud|secret|excret|deposit|leach|outgas|degas|discharg|yield|return|supplie|supply|deliver|creat|build|lay down|put out|give off|gives off|fix(es)? into|convert\w* (in)?to)/;
const CONSUME = /(consum|absorb|uptake|take[sn]? up|takes in|take in|captur|fix(es)?\b|oxidi[sz]|respir|dissolv|use[sd]? up|draw[s]?\b|burn|incorporat|assimilat|immobili[sz]|adsorb|sorb|sequester|ingest|eat|feed on|metaboli[sz]|intercept|harvest)/;
const PRODUCE_AFTER = /^\s*(is |are |gets? |be |being )?(releas|emitt|produc|form|generat|lost|exported|leach|returned|deposit|given off|created|made)/;
const CONSUME_AFTER = /^\s*(is |are |gets? |be |being )?(consum|absorb|taken|drawn|used up|oxidi|fixed|captur|dissolv|immobili|sorb|burn|used|ingest|eaten)/;

export function inferRole(label: string, resource: string): Role {
  const l = label.toLowerCase(), r = resource.toLowerCase();
  const stem = r.replace(/s$/, "");
  let i = l.indexOf(r); let len = r.length;
  if (i < 0) { i = l.indexOf(stem); len = stem.length; }
  if (i < 0) return "used";
  const before = l.slice(Math.max(0, i - 48), i), after = l.slice(i + len, i + len + 40);
  if (PRODUCE_AFTER.test(after)) return "produced";
  if (CONSUME_AFTER.test(after)) return "consumed";
  const lastP = Math.max(before.search(new RegExp(PRODUCE.source + "[^,;.]*$")), -1);
  const lastC = Math.max(before.search(new RegExp(CONSUME.source + "[^,;.]*$")), -1);
  if (lastP >= 0 && lastP >= lastC) return "produced";
  if (lastC >= 0) return "consumed";
  return "used";
}

export function roleOf(s: Pick<Step, "label" | "resourceRoles">, resource: string): { role: Role; inferred: boolean } {
  const given = s.resourceRoles?.[resource] ?? Object.entries(s.resourceRoles || {}).find(([k]) => k.toLowerCase() === resource.toLowerCase())?.[1];
  if (given === "consumed" || given === "produced" || given === "used") return { role: given, inferred: false };
  return { role: inferRole(s.label, resource), inferred: true };
}
