import {
  AI_MODELS,
  AI_PROVIDERS,
  aiOf,
  blank,
  DEFAULT_MEAL_TIMES,
  KEY_NAMES,
  MEAL_TAGS,
  mealTimes,
  modelLabel,
  PROVIDER_NAMES,
  SETTINGS_ID,
  type AiSettings,
  type AiUsage,
  type MealSlot,
  type ReadRecipe,
  type Settings,
} from "@foodlab/shared";
import { useEffect, useState } from "react";
import { aiAlert, money, photoFromLink, photoless, type ReadReply } from "../ai";
import { FONTS, fontChoice, loaded, setFont, type FontSlot } from "../fonts";
import { ALL_SANS } from "../fonts-sans";
import { isAndroid, linksInBrowser, setLinksInBrowser } from "../links";
import { Markdown } from "../markdown";
import { data, put, refresh, useData } from "../sync";
import { showToast } from "../toast";
import { setThemePref, themePref, type ThemePref } from "../theme";
import { Dialog } from "./Dialog";
import { Field, NumberInput, Segmented } from "./controls";

// Settings (DESIGN.md §5.9): sections down the side, so there's room for more of them.
// Meal times and AI are app-wide (the settings record); Colors is per device. Things being
// tried out go under Experimental.

const SECTIONS = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "meals", label: "Meal times", icon: "🕑" },
  { id: "ai", label: "AI", icon: "✨" },
  { id: "data", label: "Data", icon: "🗄️" },
  { id: "experimental", label: "Experimental", icon: "🔬" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];
const LAST = "foodlab:settings-section";

/** Saves the settings record, built on the latest copy. */
const saveSettings = (patch: Partial<Settings>) => put("settings", { ...(data().state.settings[SETTINGS_ID] ?? blank.settings()), ...patch });

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>(() => {
    try {
      const s = localStorage.getItem(LAST) as Section | null;
      if (s && SECTIONS.some((x) => x.id === s)) return s;
    } catch {
      // Storage blocked: start at General.
    }
    return "general";
  });
  const pick = (s: Section) => {
    setSection(s);
    try {
      localStorage.setItem(LAST, s);
    } catch {
      // Not remembered; fine.
    }
  };
  return (
    <Dialog title="Settings" onClose={onClose} className="settings">
      <div className="settings-layout">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              id={`settings-tab-${s.id}`}
              aria-selected={section === s.id}
              aria-controls="settings-panel"
              className={section === s.id ? "on" : ""}
              onClick={() => pick(s.id)}
            >
              <span className="settings-icon">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${section}`} className="settings-panel">
          {section === "general" ? <General /> : section === "meals" ? <MealTimes /> : section === "ai" ? <AiSection /> : section === "data" ? <DataSection /> : <Experimental />}
        </div>
      </div>
    </Dialog>
  );
}

function General() {
  const [theme, setTheme] = useState<ThemePref>(themePref());
  const [links, setLinks] = useState(linksInBrowser() ? "browser" : "app");
  return (
    <div className="fields">
      <Field label="Colors">
        <Segmented
          value={theme}
          options={["system", "light", "dark"] as const}
          labels={{ system: "System", light: "Light", dark: "Dark" }}
          clearable={false}
          onChange={(t) => {
            if (!t) return;
            setTheme(t);
            setThemePref(t);
          }}
        />
        <p className="muted small">This device only.</p>
      </Field>
      {isAndroid && (
        <Field label="Outside links">
          <Segmented
            value={links}
            options={["app", "browser"] as const}
            labels={{ app: "In the app", browser: "Browser" }}
            clearable={false}
            onChange={(v) => {
              if (!v) return;
              setLinks(v);
              setLinksInBrowser(v === "browser");
            }}
          />
          <p className="muted small">This device only.</p>
        </Field>
      )}
    </div>
  );
}

/** Being tried out: may change or go away. */
function Experimental() {
  return (
    <div className="fields">
      <p className="muted small">Things being tried out. They may change or go away.</p>
      <FontSetting slot="header" label="Header font" />
      <FontSetting slot="app" label="App font" />
    </div>
  );
}

/** TEMPORARY: try Google Fonts (fonts.ts, as in sideshow). Arrow keys in the dropdown apply each one live. */
function FontSetting({ slot, label }: { slot: FontSlot; label: string }) {
  const [family, setFamily] = useState(() => fontChoice(slot));
  const [missing, setMissing] = useState(false);
  return (
    <Field label={label} htmlFor={`font-${slot}`}>
      <select
        id={`font-${slot}`}
        className="select"
        value={family}
        onChange={async (e) => {
          const f = e.target.value;
          setFamily(f);
          setMissing(false);
          const ok = await setFont(slot, f);
          if (fontChoice(slot) === f) setMissing(!ok);
        }}
      >
        <option value="">{slot === "app" ? "Bricolage Grotesque (default)" : "Unbounded (default)"}</option>
        <option value="system-ui">System font</option>
        <optgroup label="Picks (from sideshow)">
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
              {loaded.get(f) === false ? " (not on Google Fonts)" : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label={`All ${ALL_SANS.length} sans-serif, most popular first`}>
          {ALL_SANS.filter((f) => !FONTS.includes(f)).map((f) => (
            <option key={f} value={f}>
              {f}
              {loaded.get(f) === false ? " (couldn't load)" : ""}
            </option>
          ))}
        </optgroup>
      </select>
      {missing && <p className="warn small">Google Fonts doesn't have “{family}”; showing the system font.</p>}
      {slot === "app" && <p className="muted small">This device only. Focus the list and use the arrow keys to flip through them.</p>}
    </Field>
  );
}

function MealTimes() {
  const { state } = useData();
  const slots = mealTimes(state);
  const saveSlots = (mealTimes: MealSlot[]) => saveSettings({ mealTimes });
  const changeSlot = (i: number, change: Partial<MealSlot>) => saveSlots(mealTimes(data().state).map((s, j) => (j === i ? { ...s, ...change } : s)));
  return (
    <div className="fields">
      <Field label="Meal times">
        <div className="meal-times">
          {slots.map((s, i) => (
            <div className="inline" key={i}>
              <input
                type="time"
                className="input"
                value={s.from}
                aria-label={`Slot ${i + 1} starts`}
                onChange={(e) => e.target.value && changeSlot(i, { from: e.target.value })}
              />
              <select className="select grow" value={s.tagId} aria-label={`Slot ${i + 1} meal`} onChange={(e) => changeSlot(i, { tagId: e.target.value })}>
                {MEAL_TAGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div>
          <button className="btn subtle" onClick={() => saveSlots(DEFAULT_MEAL_TIMES)}>
            Reset
          </button>
        </div>
      </Field>
    </div>
  );
}

function DataSection() {
  const { state, pending, status } = useData();
  const count = (k: "foods" | "products" | "recipes" | "stores" | "dishes") => Object.values(state[k]).filter((x) => !x.deleted).length;
  return (
    <div className="fields">
      <Field label="Data">
        <p className="small">
          {count("foods")} foods · {count("products")} products · {count("recipes")} recipes · {count("stores")} places · {count("dishes")} dishes
          <br />
          Version {state.rev} · {pending ? `${pending} change${pending === 1 ? "" : "s"} waiting to save` : "everything saved"} ({status})
        </p>
        <button className="btn" onClick={() => void refresh()}>
          Reload from the server
        </button>
      </Field>
      <FindPhotos />
    </div>
  );
}

/** Recipes saved with a link and no photo get their page's picture of the dish, one at a time. */
function FindPhotos() {
  const { state } = useData();
  const [run, setRun] = useState<{ done: number; of: number; found: number } | null>(null);
  const todo = photoless(state.recipes);
  if (!todo.length && !run) return null;
  const start = async () => {
    const list = photoless(data().state.recipes);
    let found = 0;
    for (const [i, r] of list.entries()) {
      setRun({ done: i, of: list.length, found });
      try {
        if (await photoFromLink(r)) found++;
      } catch (err) {
        // Offline or signed out: the rest would fail the same way. A picture that won't read is just skipped.
        if (/reach|connection|Signed out/.test((err as Error).message)) {
          setRun(null);
          return showToast(`${(err as Error).message} (${plural(found, "photo")} found)`);
        }
      }
    }
    setRun(null);
    showToast(`Found ${plural(found, "photo")}${found < list.length ? `; ${list.length - found} without one` : ""}`);
  };
  return (
    <Field label="Recipe photos">
      <p className="small">{run ? `Looking: ${run.done + 1} of ${run.of} (${run.found} found)` : `${plural(todo.length, "recipe")} with a link and no photo`}</p>
      <button className="btn" disabled={!!run} onClick={() => void start()}>
        🔗 Find photos
      </button>
    </Field>
  );
}

// ---- AI (DESIGN.md §5.9) ----

const ALERT_CHOICES = [50, 75, 90];
const tokensK = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function AiSection() {
  const { state } = useData();
  const ai = aiOf(state);
  const [use, setUse] = useState<AiUsage | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    fetch("/api/ai")
      .then((r) => r.json() as Promise<AiUsage>)
      .then((u) => {
        setUse(u);
        setError("");
      })
      .catch(() => setError("Couldn't reach foodlab (offline?)"));
  useEffect(() => void load(), []);
  const saveAi = (patch: Partial<AiSettings>) => saveSettings({ ai: { ...aiOf(data().state), ...patch } });

  return (
    <div className="fields ai-settings">
      {use && !use.providers.length && (
        <p className="notice">
          No API key on the server yet: add <code>ANTHROPIC_API_KEY=…</code> or <code>OPENAI_API_KEY=…</code> to <code>.env</code> and restart (runbook). Until then
          recipes are read without AI.
        </p>
      )}
      {error && <p className="notice">{error}</p>}
      <Field label="Model" htmlFor="ai-model">
        <select id="ai-model" className="select" value={ai.model} onChange={(e) => saveAi({ model: e.target.value })}>
          <option value="off">Off</option>
          {AI_PROVIDERS.map((p) => {
            const on = !use || use.providers.includes(p);
            return (
              <optgroup key={p} label={`${PROVIDER_NAMES[p]}${on ? "" : " (no key)"}`}>
                {AI_MODELS.filter((m) => m.provider === p).map((m) => (
                  <option key={m.id} value={m.id} disabled={!on && m.id !== ai.model}>
                    {m.label} · ${m.input} in / ${m.output} out per M tokens
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {use && (
          <p className="small ai-keys">
            {AI_PROVIDERS.map((p) => (
              <span key={p} className={use.providers.includes(p) ? "" : "muted"}>
                {use.providers.includes(p) ? "●" : "○"} {PROVIDER_NAMES[p]}
                {use.providers.includes(p) ? "" : ` (no ${KEY_NAMES[p]})`}
              </span>
            ))}
          </p>
        )}
      </Field>
      <Field label="This month">{use ? <Spend use={use} ai={ai} /> : !error && <p className="muted small">Loading…</p>}</Field>
      <Field label="Monthly cap">
        <div className="inline">
          <span>$</span>
          <NumberInput className="input money-input" value={ai.monthlyLimitUsd} aria-label="Monthly cap in dollars" onCommit={(monthlyLimitUsd) => saveAi({ monthlyLimitUsd })} />
        </div>
      </Field>
      <Field label="Alerts at">
        <div className="chips">
          {ALERT_CHOICES.map((p) => {
            const on = ai.alertsAt.includes(p);
            return (
              <button
                key={p}
                className={`chip ${on ? "chip-on" : ""}`}
                aria-pressed={on}
                onClick={() => saveAi({ alertsAt: on ? ai.alertsAt.filter((x) => x !== p) : [...ai.alertsAt, p].sort((a, b) => a - b) })}
              >
                {p}%
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Compare">
        <Compare onDone={() => void load()} />
      </Field>
    </div>
  );
}

function Spend({ use, ai }: { use: AiUsage; ai: AiSettings }) {
  const cap = ai.monthlyLimitUsd;
  const pct = cap ? use.costUsd / cap : 0;
  const level = !cap ? "" : pct >= 1 ? "over" : ai.alertsAt.some((a) => pct * 100 >= a) ? "warn" : "";
  const [y, m] = use.month.split("-").map(Number) as [number, number];
  const days = new Date(y, m, 0).getDate();
  const byDay = new Map(use.byDay.map((d) => [d.day, d.costUsd]));
  const most = Math.max(...use.byDay.map((d) => d.costUsd), 0);
  const monthName = new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short" });
  return (
    <div className="stack-sm">
      <div className="spend-head">
        <strong className="spend-total">{money(use.costUsd)}</strong>
        <span className="muted small">est.</span>
        <span className="muted">
          {cap ? ` of $${cap.toFixed(2)} · ${Math.round(pct * 100)}%` : " (no cap)"}
          {level === "over" && " · cap reached, AI paused"}
          {level === "warn" && " · past an alert"}
        </span>
      </div>
      {cap !== null && cap > 0 && (
        <div className={`meter ${level}`} role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={use.costUsd} aria-label="Spent this month">
          <div className="meter-fill" style={{ width: `${Math.min(pct, 1) * 100}%` }} />
          {ai.alertsAt.map((a) => (
            <span key={a} className="meter-tick" style={{ left: `${a}%` }} />
          ))}
        </div>
      )}
      <p className="small muted">
        {use.calls} call{use.calls === 1 ? "" : "s"} · {tokensK(use.tokens.input)} tokens in · {tokensK(use.tokens.output)} out
      </p>
      {use.calls > 0 && (
        <>
          <div className="day-bars" aria-label="Cost by day">
            {Array.from({ length: days }, (_, i) => {
              const c = byDay.get(i + 1) ?? 0;
              return (
                <span key={i} className="day-bar" title={`${monthName} ${i + 1}: ${money(c)}`}>
                  {c > 0 && <span style={{ height: `${Math.max((c / most) * 100, 6)}%` }} />}
                </span>
              );
            })}
          </div>
          <table className="db small">
            <thead>
              <tr>
                <th>Model</th>
                <th className="num">Calls</th>
                <th className="num wide-only">In / out</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {use.byModel.map((b) => (
                <tr key={b.model}>
                  <td>{modelLabel(b.model)}</td>
                  <td className="num">{b.calls}</td>
                  <td className="num wide-only">
                    {tokensK(b.tokens.input)} / {tokensK(b.tokens.output)}
                  </td>
                  <td className="num">{money(b.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary className="small">Recent calls</summary>
            <ul className="recent-calls small">
              {use.recent.map((r) => (
                <li key={r.at}>
                  <span className="muted">{new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> {modelLabel(r.model)} · {r.purpose} ·{" "}
                  {money(r.costUsd)}
                  {!r.ok && <span className="muted"> · {r.note || "failed"}</span>}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

type CompareResult = ReadReply & { model: string; ms?: number; tokens?: { input: number; output: number } };

/** The same recipe through every model with a key and the plain reader, side by side. */
function Compare({ onDone }: { onDone: () => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ plain: ReadRecipe | null; results: CompareResult[] } | null>(null);
  const [error, setError] = useState("");
  const run = async () => {
    const t = input.trim();
    const isUrl = /^https?:\/\/\S+$/.test(t);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(isUrl ? { url: t } : { text: t }) });
      const body = (await res.json()) as { plain?: ReadRecipe | null; results?: CompareResult[]; message?: string };
      if (body.results) {
        setOut({ plain: body.plain ?? null, results: body.results });
        body.results.forEach(aiAlert);
      } else setError(body.message ?? "Couldn't compare");
    } catch {
      setError("Couldn't reach foodlab (offline?)");
    }
    setBusy(false);
    onDone();
  };
  return (
    <div className="stack-sm">
      <textarea className="input" rows={3} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Recipe link or text to compare" />
      <div className="inline">
        <button className="btn" disabled={!input.trim() || busy} onClick={() => void run()}>
          {busy ? "Reading with each model…" : "Compare models"}
        </button>
        {error && <span className="muted small">{error}</span>}
      </div>
      {out && (
        <div className="compare-grid">
          <CompareCard title="Plain reader" sub="free" recipe={out.plain} />
          {out.results.map((r) => (
            <CompareCard
              key={r.model}
              title={modelLabel(r.model)}
              sub={r.error ? r.error : `${money(r.costUsd ?? 0)} · ${((r.ms ?? 0) / 1000).toFixed(1)} s · ${tokensK(r.tokens?.input ?? 0)} in / ${tokensK(r.tokens?.output ?? 0)} out`}
              recipe={r.recipe ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompareCard({ title, sub, recipe }: { title: string; sub: string; recipe: ReadRecipe | null }) {
  const steps = recipe ? recipe.instructions.split("\n").filter((l) => /^\d+\./.test(l)).length : 0;
  return (
    <div className="compare-card">
      <div className="strong">{title}</div>
      <div className="muted small">{sub}</div>
      {recipe ? (
        <>
          <div className="compare-name">{recipe.name || "(no name)"}</div>
          <div className="small">
            {plural(recipe.ingredients.length, "ingredient")} · {plural(steps, "step")}
            {recipe.yieldQty !== null && ` · makes ${recipe.yieldQty}${recipe.yieldUnit ? ` ${recipe.yieldUnit}` : ""}`}
            {recipe.prepMin !== null && ` · prep ${recipe.prepMin}`}
            {recipe.cookMin !== null && ` · cook ${recipe.cookMin}`}
          </div>
          <details>
            <summary className="small">Ingredients and steps</summary>
            <ul className="small compare-ingredients">
              {recipe.ingredients.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
            <Markdown className="small" text={recipe.instructions} />
          </details>
        </>
      ) : (
        <div className="muted small">No recipe.</div>
      )}
    </div>
  );
}
