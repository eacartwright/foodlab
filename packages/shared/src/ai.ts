// Claude for reading recipes the plain reader can't (DESIGN.md §5.5, §5.9): which model, what it
// has cost this month, the cap and the alerts. The key lives on the server, never here.

export type AiModel = "off" | "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5";

/** Dollars per million tokens (Anthropic's list prices, 2026-10). Cost is an estimate from these. */
export const AI_MODELS: { id: Exclude<AiModel, "off">; label: string; input: number; output: number; cacheRead: number }[] = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5", input: 0.1, output: 0.5, cacheRead: 0.01 },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", input: 2, output: 10, cacheRead: 0.2 },
  { id: "claude-opus-5-5", label: "Opus 5.5", input: 4, output: 20, cacheRead: 0.2 },
];

export interface AiSettings {
  model: AiModel;
  /** Dollars a calendar month; past it the server makes no more calls. Null = no cap. */
  monthlyLimitUsd: number | null;
  /** Percentages of the cap that raise an alert when a call crosses them. */
  alertsAt: number[];
}

export const DEFAULT_AI: AiSettings = { model: "claude-opus-5-5", monthlyLimitUsd: 5, alertsAt: [75, 90] };

export const aiOf = (state: { settings: Record<string, { ai?: AiSettings } | undefined> }): AiSettings => state.settings.app?.ai ?? DEFAULT_AI;

export const modelLabel =(m: string) => AI_MODELS.find((x) => x.id === m)?.label ?? m;

export interface AiTokens {
  input: number;
  output: number;
  cacheRead: number;
}

export function costUsd(model: string, t: AiTokens): number {
  const p = AI_MODELS.find((x) => x.id === model);
  if (!p) return 0;
  return (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead) / 1_000_000;
}

/** The alert levels a call moving spend from `before` to `after` crossed. */
export function crossed(ai: AiSettings, before: number, after: number): number[] {
  const cap = ai.monthlyLimitUsd;
  if (!cap) return [];
  return [...ai.alertsAt, 100].filter((pct, i, all) => all.indexOf(pct) === i && before < (cap * pct) / 100 && after >= (cap * pct) / 100);
}

/** What GET /api/ai answers: this month's use, for the AI settings. */
export interface AiUsage {
  /** The server has a key. */
  configured: boolean;
  month: string;
  costUsd: number;
  tokens: AiTokens;
  calls: number;
  byModel: { model: string; costUsd: number; calls: number; tokens: AiTokens }[];
  /** Day of the month (1…) → dollars. */
  byDay: { day: number; costUsd: number }[];
  recent: { at: number; model: string; purpose: string; costUsd: number; tokens: AiTokens; ok: boolean; note: string }[];
}

/** The local month, "2026-10". */
export const monthOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
