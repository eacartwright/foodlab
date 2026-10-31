import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  AI_MODELS,
  costUsd,
  crossed,
  KEY_NAMES,
  modelInfo,
  monthOf,
  type AiProvider,
  type AiSettings,
  type AiTokens,
  type AiUsage,
  type ReadPlace,
  type ReadRecipe,
} from "@foodlab/shared";
import type { DB } from "./db";

// Claude or GPT reads a recipe the plain reader can't: a page without recipe data, or pasted
// text (DESIGN.md §5.5, §5.9); and a place's page for its locations (§5.12). The keys come from ANTHROPIC_API_KEY and OPENAI_API_KEY in .env
// (either or both, as in sideshow) and never leave the server. Every call is recorded in
// ai_usage with its estimated cost; past the monthly cap the server makes no more calls.

/** Which providers have a key: their models can be picked. */
export const providers = (env: NodeJS.ProcessEnv = process.env): AiProvider[] => [
  ...(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN ? (["anthropic"] as const) : []),
  ...(env.OPENAI_API_KEY ? (["openai"] as const) : []),
];

/** The models that can be used now (their provider has a key). */
export const availableModels = () => AI_MODELS.filter((m) => providers().includes(m.provider));

let anthropic: Anthropic | undefined;
let openai: OpenAI | undefined;

const Recipe = z.object({
  name: z.string(),
  yield_quantity: z.number().nullable(),
  yield_unit: z.string(),
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  ingredients: z.array(z.string()),
  sections: z.array(z.object({ title: z.string(), steps: z.array(z.string()) })),
});

const SYSTEM = `You read recipes for a personal recipe box. From the text you're given, return the one recipe in it.

- name: the recipe's name, without the site's name or words like "Recipe" or "Easy".
- yield_quantity and yield_unit: what it makes ("4" and "servings", "1" and "loaf"); null and "" when not given.
- prep_minutes, cook_minutes: from the recipe's own times; null when not given.
- ingredients: one line per ingredient, as the recipe writes it, amount first ("2 tbsp olive oil", "1 can (15 oz) black beans, drained"). Leave out headings, checkboxes, nutrition and ads. When ingredients are in groups, keep them in order without the group names.
- sections: the method. One section with an empty title unless the recipe groups its steps ("For the sauce"). Each step is one step, in the recipe's words, without its number or "Step 3".

Copy, don't improve: no added steps, amounts or tips. If the text holds no recipe, return an empty name and empty lists.`;

const Place = z.object({
  locations: z.array(z.object({ name: z.string(), address: z.string(), phone: z.string(), hours: z.string() })),
});

const PLACE_SYSTEM = `You read a restaurant's or store's web page (or text copied from one) for a personal list of places. Return its locations.

- One entry per physical location the text gives. A chain's locations page may list many; a single shop has one.
- name: what tells this location apart, usually the town or neighborhood ("Pittsford", "Downtown"); "" when there's only one location.
- address: the street address on one line ("3195 Monroe Ave, Rochester, NY 14618").
- phone: as written; "" when not given.
- hours: one line per day or range, as the page gives them ("Mon–Fri 7am–10pm", "Sat–Sun 8am–9pm"); "" when not given.

Copy what the text says; never guess an address, phone or hours. If it gives no locations, return an empty list.`;

export class AiStopped extends Error {}

/** One kind of read: what the model is told, and the shape it answers in. */
interface Job<T> {
  name: string;
  system: string;
  schema: z.ZodType<T>;
}

const RECIPE_JOB: Job<z.infer<typeof Recipe>> = { name: "recipe", system: SYSTEM, schema: Recipe };
const PLACE_JOB: Job<z.infer<typeof Place>> = { name: "place", system: PLACE_SYSTEM, schema: Place };

export interface AiCall<T> {
  out: T | null;
  model: string;
  costUsd: number;
  tokens: AiTokens;
  ms: number;
  /** Alert levels (% of the cap) this call crossed. */
  alerts: number[];
}

export interface AiResult {
  recipe: ReadRecipe | null;
  model: string;
  costUsd: number;
  tokens: AiTokens;
  ms: number;
  /** Alert levels (% of the cap) this call crossed. */
  alerts: number[];
}

/** One provider's call: what it read (null when it declined), its tokens, and anything odd. */
type Ask = <T>(job: Job<T>, model: string, text: string) => Promise<{ out: T | null; tokens: AiTokens; note: string }>;

const askAnthropic: Ask = async (job, model, text) => {
  const res = await (anthropic ??= new Anthropic()).messages.parse({
    model,
    max_tokens: 16000,
    system: job.system,
    messages: [{ role: "user", content: text }],
    // Copying things out of text needs little thinking.
    output_config: { effort: "low", format: zodOutputFormat(job.schema) },
  });
  const tokens = { input: res.usage.input_tokens, output: res.usage.output_tokens, cacheRead: res.usage.cache_read_input_tokens ?? 0 };
  const out = res.stop_reason === "refusal" ? null : res.parsed_output;
  return { out, tokens, note: res.stop_reason === "refusal" ? "declined" : out ? "" : `no ${job.name} (${res.stop_reason})` };
};

const askOpenAi: Ask = async (job, model, text) => {
  const res = await (openai ??= new OpenAI()).responses.parse({
    model,
    instructions: job.system,
    input: text,
    reasoning: { effort: "low" },
    max_output_tokens: 16000,
    text: { format: zodTextFormat(job.schema, job.name) },
  });
  // OpenAI counts cached input inside input_tokens; the bill (and costUsd) counts them apart.
  const cached = res.usage?.input_tokens_details?.cached_tokens ?? 0;
  const tokens = { input: (res.usage?.input_tokens ?? 0) - cached, output: res.usage?.output_tokens ?? 0, cacheRead: cached };
  const out = res.output_parsed;
  return { out, tokens, note: out ? "" : `no ${job.name} (${res.status})` };
};

const ASK: Record<AiProvider, Ask> = { anthropic: askAnthropic, openai: askOpenAi };

/** A provider's error, short enough to show and log. */
function errorNote(err: unknown): string {
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) return `${err.status ?? ""} ${err.message}`.trim().slice(0, 200);
  return "Couldn't reach the AI service";
}

export function monthSpend(db: DB, month = monthOf(Date.now())): number {
  return (db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM ai_usage WHERE month = ?").get(month) as { c: number }).c;
}

/** Ask the model for the recipe in `text`. Throws AiStopped when AI is off, its provider has no key or the month's cap is spent. */
export async function aiRead(db: DB, ai: AiSettings, text: string, purpose: "read" | "paste" | "compare", model: string = ai.model): Promise<AiResult> {
  const { out, ...rest } = await aiCall(db, ai, RECIPE_JOB, text, purpose, model);
  return { recipe: out ? toRecipe(out) : null, ...rest };
}

/** Ask the model for a place's locations in `text` (its page, or pasted). Throws AiStopped like aiRead. */
export async function aiPlace(db: DB, ai: AiSettings, text: string): Promise<AiCall<ReadPlace>> {
  const { out, ...rest } = await aiCall(db, ai, PLACE_JOB, text, "place", ai.model);
  const locations = (out?.locations ?? [])
    .map((l) => ({ name: l.name.trim(), address: l.address.trim(), phone: l.phone.trim(), hours: l.hours.trim() }))
    .filter((l) => l.address || l.phone || l.hours);
  return { out: out && { locations }, ...rest };
}

async function aiCall<T>(db: DB, ai: AiSettings, job: Job<T>, text: string, purpose: string, model: string): Promise<AiCall<T>> {
  if (model === "off") throw new AiStopped("AI is off in Settings");
  const info = modelInfo(model);
  if (!info) throw new AiStopped(`Not a model foodlab knows: ${model}`);
  if (!providers().includes(info.provider)) throw new AiStopped(`No ${KEY_NAMES[info.provider]} on the server`);
  const before = monthSpend(db);
  if (ai.monthlyLimitUsd !== null && before >= ai.monthlyLimitUsd) throw new AiStopped(`This month's $${ai.monthlyLimitUsd} cap is spent`);
  const started = Date.now();
  const record = (tokens: AiTokens, ok: boolean, note: string) => {
    const cost = costUsd(model, tokens);
    db.prepare(
      "INSERT INTO ai_usage (at, month, model, purpose, input_tokens, output_tokens, cache_read_tokens, cost_usd, ok, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(started, monthOf(started), model, purpose, tokens.input, tokens.output, tokens.cacheRead, cost, ok ? 1 : 0, note);
    return cost;
  };
  let res;
  try {
    res = await ASK[info.provider](job, model, text);
  } catch (err) {
    record({ input: 0, output: 0, cacheRead: 0 }, false, errorNote(err));
    throw err;
  }
  const { out, tokens } = res;
  const cost = record(tokens, !!out, res.note);
  return { out, model, costUsd: cost, tokens, ms: Date.now() - started, alerts: crossed(ai, before, before + cost) };
}

function toRecipe(r: z.infer<typeof Recipe>): ReadRecipe | null {
  const ingredients = r.ingredients.map((l) => l.trim()).filter(Boolean);
  if (!r.name.trim() && !ingredients.length) return null;
  let n = 0;
  const lines: string[] = [];
  for (const s of r.sections) {
    if (s.title.trim() && r.sections.length > 1) lines.push(`${lines.length ? "\n" : ""}### ${s.title.trim()}`);
    for (const step of s.steps) if (step.trim()) lines.push(`${++n}. ${step.trim()}`);
  }
  const mins = (x: number | null) => (x && x > 0 ? Math.round(x) : null);
  return {
    name: r.name.trim(),
    yieldQty: r.yield_quantity && r.yield_quantity > 0 ? r.yield_quantity : null,
    yieldUnit: r.yield_unit.trim(),
    prepMin: mins(r.prep_minutes),
    cookMin: mins(r.cook_minutes),
    ingredients,
    instructions: lines.join("\n"),
  };
}

/** What the model is sent for a page. */
export const pagePrompt = (url: string, html: string, what = "A recipe page") => `${what} (${url}):\n\n${pageText(html)}`;

/** A page's readable text, for the model: no scripts, styles or markup; one line per block. */
export function pageText(html: string, max = 60_000): string {
  const t = html
    .replace(/<(script|style|noscript|svg|head|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return t.slice(0, max);
}

/** This month's use, for Settings → AI. */
export function usage(db: DB): AiUsage {
  const month = monthOf(Date.now());
  type Row = { model: string; purpose: string; at: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; cost_usd: number; ok: number; note: string };
  const rows = db.prepare("SELECT * FROM ai_usage WHERE month = ? ORDER BY at").all(month) as Row[];
  const tok = (r: Row): AiTokens => ({ input: r.input_tokens, output: r.output_tokens, cacheRead: r.cache_read_tokens });
  const add = (a: AiTokens, b: AiTokens): AiTokens => ({ input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead });
  const zero = (): AiTokens => ({ input: 0, output: 0, cacheRead: 0 });
  const byModel = new Map<string, AiUsage["byModel"][number]>();
  const byDay = new Map<number, number>();
  let tokens = zero();
  let cost = 0;
  for (const r of rows) {
    tokens = add(tokens, tok(r));
    cost += r.cost_usd;
    const m = byModel.get(r.model) ?? { model: r.model, costUsd: 0, calls: 0, tokens: zero() };
    byModel.set(r.model, { ...m, costUsd: m.costUsd + r.cost_usd, calls: m.calls + 1, tokens: add(m.tokens, tok(r)) });
    const day = new Date(r.at).getDate();
    byDay.set(day, (byDay.get(day) ?? 0) + r.cost_usd);
  }
  return {
    providers: providers(),
    month,
    costUsd: cost,
    tokens,
    calls: rows.length,
    byModel: [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd),
    byDay: [...byDay].map(([day, c]) => ({ day, costUsd: c })),
    recent: rows
      .slice(-8)
      .reverse()
      .map((r) => ({ at: r.at, model: r.model, purpose: r.purpose, costUsd: r.cost_usd, tokens: tok(r), ok: !!r.ok, note: r.note })),
  };
}
