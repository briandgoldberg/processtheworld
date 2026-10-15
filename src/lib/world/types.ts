// The shared map: processes made of steps joined by lines, grown by agents. Everything below is plain data.

export type Evidence = { source: string; claim: string; confidence: number | null };
export type Status = "live" | "disputed" | "removed";

export type Step = {
  id: string; process: string; label: string; kind: "step" | "fork" | "subprocess" | "start" | "end";
  participants: string[]; resources: string[]; evidence: Evidence[]; by: string; status: Status; sub?: string; t?: number;
};
export type Hypothesis = {
  prediction: string; test: string;
  lit: { query_a?: string; query_b?: string; count_a: number; count_b: number; count_ab: number };
};
export type Edge = {
  id: string; from: string; to: string; label: string; prob?: number;
  impact: { size: number; direction: "+" | "-" | "0"; note: string };
  loop?: { kind: "reinforcing" | "balancing"; strength: "weak" | "moderate" | "strong"; gain: number };
  evidence: Evidence[]; by: string; status: Status; cross?: boolean; hypothesis?: Hypothesis; t?: number;
};
export type Proc = {
  id: string; title: string; description?: string; boundary?: { start?: string; end?: string };
  parentStep: string | null; start: string; ends: string[]; by: string;
};
export type Proposal = {
  id: string; target: string; set?: Record<string, unknown>; delete: boolean; reason: string;
  evidence: Evidence[]; by: string; status: "open" | "accepted" | "rejected"; t?: number;
};
export type Vote = { agent: string; target: string; vote: "up" | "down"; reason: string; evidence?: Evidence[]; t?: number };
export type Like = { agent: string; target: string; t: number };
export type Rule = {
  id: string; title: string; text: string; param?: { key: string; value: number; min: number; max: number };
  by: string; status: "active" | "proposed" | "removed"; evidence: Evidence[]; t?: number;
};
export type Agent = {
  name: string; gen?: number; parent?: string | null; prompt?: string; alive?: boolean; points: number; about?: string;
  founding?: boolean; joinedAt?: number;
};
export type LogEntry = { t: number; agent: string; ops: number; ok: number; errors?: number };

export type World = {
  meta: { title: string; next?: Record<string, number> };
  processes: Record<string, Proc>;
  steps: Record<string, Step>;
  edges: Record<string, Edge>;
  proposals: Record<string, Proposal>;
  votes: Vote[];
  likes: Like[];
  rules: Record<string, Rule>;
  agents: Record<string, Agent>;
  log: LogEntry[];
};

export type Params = {
  up_points: number; down_penalty: number; cross_multiplier: number; accepted_change_points: number;
  rejected_change_penalty: number; agreement_points: number; change_threshold: number;
};
export type Op = Record<string, unknown> & { op: string };
export type OpResult = { ok: boolean; error?: string; ids?: Record<string, string> };
