export type AgentApi = "openai" | "anthropic" | "modelark" | "claude-key";

export type Agent = {
  id: string;
  name: string;
  short: string;
  role: string;
  model?: string;
  api?: AgentApi;
  available: boolean;
  accent: string;
  /** Shown in the picker so the user knows where the agent runs. */
  provider: string;
};

export const AGENTS: Agent[] = [
  { id: "orchestrator", name: "Orchestrator", short: "OR", role: "Runs the crew · routes every brief to the right agent", model: "openai/gpt-6-astra", api: "openai", available: true, accent: "var(--chart-1)", provider: "Lovable AI" },
  { id: "astra", name: "GPT-6 Astra", short: "AS", role: "Creative director · pacing & structure", model: "openai/gpt-6-astra", api: "openai", available: true, accent: "var(--chart-1)", provider: "Lovable AI" },
  { id: "codex", name: "Claude Codex", short: "CX", role: "Precision cuts · timecode & assembly", model: "anthropic/claude-opus-5-5", api: "anthropic", available: true, accent: "var(--chart-2)", provider: "Lovable AI" },
  { id: "fable", name: "Claude Fable", short: "FB", role: "Narrative · emotional pacing", model: "anthropic/claude-fable-5-1", api: "anthropic", available: true, accent: "var(--chart-4)", provider: "Lovable AI" },
  { id: "gemini", name: "Gemini Omni", short: "GM", role: "Rush scanning · b-roll discovery", model: "google/gemini-3.8-flash", api: "openai", available: true, accent: "var(--chart-5)", provider: "Lovable AI" },
  { id: "sonnet", name: "Claude Sonnet", short: "SN", role: "Balanced everyday editing", model: "anthropic/claude-sonnet-5", api: "anthropic", available: true, accent: "var(--chart-2)", provider: "Lovable AI" },
  { id: "luna", name: "GPT-6 Luna", short: "LN", role: "Fast rough cuts · silence trims", model: "openai/gpt-6-luna", api: "openai", available: true, accent: "var(--chart-1)", provider: "Lovable AI" },
  { id: "claude-own", name: "Claude (your key)", short: "CK", role: "Claude on your own Anthropic key", model: "claude-sonnet-4-5", api: "claude-key", available: true, accent: "var(--chart-2)", provider: "Anthropic" },
  // ModelArk crew — served with your ModelArk key.
  { id: "ark-glm", name: "GLM 5.2", short: "GL", role: "ModelArk · rapid assembly", model: "glm-5-2-260617", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-glm-flash", name: "GLM 5.3 Flash", short: "GF", role: "ModelArk · instant trims", model: "glm-5-3-flash-260828", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-deepseek-pro", name: "DeepSeek V4 Pro", short: "DS", role: "ModelArk · speech alignment & logic", model: "deepseek-v4-pro-ga-260813", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-deepseek-flash", name: "DeepSeek V4.1 Flash", short: "DF", role: "ModelArk · fast silence strip", model: "deepseek-v4-1-flash-260910", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-seed-pro", name: "Seed 2.0 Pro", short: "SP", role: "ModelArk · reasoning & shot logic", model: "seed-2-0-pro-260328", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-seed-code", name: "Seed 2.0 Code", short: "SC", role: "ModelArk · precise edit lists", model: "seed-2-0-code-preview-260328", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-seed-lite", name: "Seed 2.0 Lite", short: "SL", role: "ModelArk · everyday edits", model: "seed-2-0-lite-260428", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
  { id: "ark-dola", name: "Dola Seed 2.1 Turbo", short: "DL", role: "ModelArk · motion & transition FX", model: "dola-seed-2-1-turbo-260628", api: "modelark", available: true, accent: "var(--chart-3)", provider: "ModelArk" },
];

export function agentById(id: string) {
  return AGENTS.find((a) => a.id === id) ?? AGENTS[0]!;
}

export const TRACKS = ["V3", "V2", "V1", "A1", "A2"] as const;
export type TrackId = (typeof TRACKS)[number];

export const TRACK_LABEL: Record<TrackId, string> = {
  V3: "Titles & overlays",
  V2: "B-roll & inserts",
  V1: "Main footage",
  A1: "Dialogue / VO",
  A2: "Music & SFX",
};

export type AgentAction =
  | { op: "add"; assetId: string; track: TrackId; start: number; dur: number; name?: string }
  | { op: "move"; clipId: string; track?: TrackId; start?: number }
  | { op: "trim"; clipId: string; dur: number }
  | { op: "split"; clipId: string; at: number }
  | { op: "remove"; clipId: string }
  | { op: "set"; clipId: string; volume?: number; opacity?: number; speed?: number; filter?: string };

export type AgentReply = { reply: string; steps: string[]; actions: AgentAction[] };

/** Stages the orchestrator reports while it routes a brief through the crew. */
export const ORCHESTRATOR_STAGES = [
  "Reading the brief",
  "Scanning the media bin",
  "Choosing the crew",
  "Drafting edit decisions",
  "Applying to the timeline",
] as const;
