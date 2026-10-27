import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { costUsd, crossed, monthOf, type AiSettings, type AiTokens, type AiUsage, type ReadRecipe } from "@foodlab/shared";
import type { DB } from "./db";

// Claude reads a recipe the plain reader can't: a page without recipe data, or pasted text
// (DESIGN.md §5.5, §5.9). The key comes from ANTHROPIC_API_KEY in .env and never leaves the
// server. Every call is recorded in ai_usage with its estimated cost; past the monthly cap the
// server makes no more calls.

export const hasKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | undefined;
const claude = () => (client ??= new Anthropic());

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

export class AiStopped extends Error {}

export interface AiResult {
  recipe: ReadRecipe | null;
  model: string;
  costUsd: number;
  tokens: AiTokens;
  ms: number;
  /** Alert levels (% of the cap) this call crossed. */
  alerts: number[];
}

export function monthSpend(db: DB, month = monthOf(Date.now())): number {
  return (db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM ai_usage WHERE month = ?").get(month) as { c: number }).c;
}

/** Ask Claude for the recipe in `text`. Throws AiStopped when there's no key, AI is off or the month's cap is spent. */
export async function aiRead(db: DB, ai: AiSettings, text: string, purpose: "read" | "paste" | "compare", model: string = ai.model): Promise<AiResult> {
  if (!hasKey()) throw new AiStopped("No API key on the server");
  if (model === "off") throw new AiStopped("AI is off in Settings");
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
    res = await claude().messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
      // Copying a recipe out of text needs little thinking.
      output_config: { effort: "low", format: zodOutputFormat(Recipe) },
    });
  } catch (err) {
    record({ input: 0, output: 0, cacheRead: 0 }, false, err instanceof Anthropic.APIError ? `${err.status ?? ""} ${err.message}`.trim().slice(0, 200) : "Couldn't reach Claude");
    throw err;
  }
  const tokens = { input: res.usage.input_tokens, output: res.usage.output_tokens, cacheRead: res.usage.cache_read_input_tokens ?? 0 };
  const out = res.stop_reason === "refusal" ? null : res.parsed_output;
  const cost = record(tokens, !!out, res.stop_reason === "refusal" ? "declined" : out ? "" : `no recipe (${res.stop_reason})`);
  return { recipe: out ? toRecipe(out) : null, model, costUsd: cost, tokens, ms: Date.now() - started, alerts: crossed(ai, before, before + cost) };
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

/** What Claude is sent for a page. */
export const pagePrompt = (url: string, html: string) => `A recipe page (${url}):\n\n${pageText(html)}`;

/** A page's readable text, for Claude: no scripts, styles or markup; one line per block. */
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
    configured: hasKey(),
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
