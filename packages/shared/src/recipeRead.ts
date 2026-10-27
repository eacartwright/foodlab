// Reading a shared recipe (DESIGN.md §5.5): the schema.org Recipe most recipe sites embed as
// JSON-LD, turned into what a new recipe needs. Pure: the server fetches, this reads.

export interface ReadRecipe {
  name: string;
  yieldQty: number | null;
  yieldUnit: string;
  prepMin: number | null;
  cookMin: number | null;
  /** One ingredient line per entry, as written. */
  ingredients: string[];
  /** Numbered steps, a section's name as a heading above its steps. */
  instructions: string;
}

/** The recipe in a page's HTML, or null when it has none. */
export function recipeFromHtml(html: string): ReadRecipe | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (r) return fromSchema(r);
  }
  return null;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);

function findRecipe(x: unknown): Obj | null {
  if (Array.isArray(x)) {
    for (const y of x) {
      const r = findRecipe(y);
      if (r) return r;
    }
    return null;
  }
  if (!isObj(x)) return null;
  if (([] as unknown[]).concat(x["@type"]).includes("Recipe")) return x;
  return findRecipe(x["@graph"]) ?? findRecipe(x.mainEntity);
}

export function fromSchema(r: Obj): ReadRecipe | null {
  const ingredients = unglue(list(r.recipeIngredient ?? r.ingredients)).map(cleanLine).filter(Boolean);
  const name = text(r.name);
  if (!name && !ingredients.length) return null;
  const [yieldQty, yieldUnit] = readYield(r.recipeYield);
  const prep = minutes(r.prepTime);
  const cook = minutes(r.cookTime);
  const total = minutes(r.totalTime);
  return {
    name,
    yieldQty,
    yieldUnit,
    prepMin: prep,
    // Some give only a total: the part that isn't prep.
    cookMin: cook ?? (total !== null ? Math.max(total - (prep ?? 0), 0) || null : null),
    ingredients,
    instructions: readSteps(r.recipeInstructions),
  };
}

const list = (x: unknown): string[] => (Array.isArray(x) ? x : x === undefined || x === null ? [] : [x]).map(text);

/** Text without tags, entities or runs of spaces. */
export function text(x: unknown): string {
  if (typeof x === "number") return String(x);
  if (typeof x !== "string") return isObj(x) ? text(x.text ?? x.name) : "";
  return decode(x.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

/**
 * Some sites give every ingredient run together as one ("…skin-onSalt, pepper…Flour2 tbsp
 * butter…", Pardon Your French): split one long line where a new one starts, after a letter
 * or ")" and before a capital, a number or a fraction. Lines of a normal length are left alone
 * ("McCormick").
 */
function unglue(lines: string[]): string[] {
  if (lines.length > 2 || !lines.some((l) => l.length > 150)) return lines;
  return lines.flatMap((l) => (l.length > 150 ? l.split(/(?<=[a-z)]\.?)(?=[A-Z\d¼½¾⅓⅔⅛])/) : [l]));
}

/**
 * WP Recipe Maker wraps notes twice ("4 cloves garlic ((minced))"); footnote stars ("tofu*")
 * go, and HelloFresh's "unit" ("2 unit Scallions").
 */
const cleanLine = (s: string) =>
  s
    .replace(/\(\(([^()]*)\)\)/g, "($1)")
    .replace(/^([\d½¼¾⅓⅔⅛./ ]+)\s*units?\s+/i, "$1")
    .replace(/([^\s*])\*+(?=[\s,(]|$)/g, "$1")
    .replace(/\s+([,.)])/g, "$1")
    .trim();

/** "PT1H15M" → 75. */
export function minutes(x: unknown): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:\d+(?:\.\d+)?S)?)?$/i.exec(text(x));
  if (!m) return null;
  const n = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return n > 0 ? Math.round(n) : null;
}

/** "4", ["4", "4 servings"], "Makes 12", "1 loaf" → [qty, unit]; the most telling of several. */
export function readYield(x: unknown): [number | null, string] {
  const all = list(x).filter(Boolean);
  let best: [number | null, string] = [null, ""];
  for (const s of all) {
    const m = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?\s*(.*)$/.exec(s);
    if (!m) continue;
    const unit = m[2]!.replace(/^(servings?|serves|people|portions?)$/i, "servings").trim();
    if (best[0] === null || (!best[1] && unit)) best = [Number(m[1]), unit];
  }
  return best;
}

/** Without the site's own "Step 3 –" or bullets ("• Peel the carrot. • Slice it."): numbering is made fresh. */
const stepText = (t: string) =>
  t
    .replace(/^step\s*\d+\s*[–—:.)-]?\s*/i, "")
    .replace(/^•\s*/, "")
    .replace(/\s+•\s+/g, " ")
    .trim();

function readSteps(x: unknown): string {
  const out: string[] = [];
  let n = 0;
  const walk = (y: unknown) => {
    if (Array.isArray(y)) return y.forEach(walk);
    if (typeof y === "string") {
      // One string for all the steps: a step per line.
      for (const line of y.split(/\n+|<br\s*\/?>|<\/p>/i)) {
        const t = stepText(text(line).replace(/^\d+[.)]\s*/, ""));
        if (t) out.push(`${++n}. ${t}`);
      }
      return;
    }
    if (!isObj(y)) return;
    if (([] as unknown[]).concat(y["@type"]).includes("HowToSection") || (y.itemListElement && !y.text)) {
      const title = text(y.name);
      if (title) out.push(`${out.length ? "\n" : ""}### ${title}`);
      return walk(y.itemListElement);
    }
    const t = stepText(text(y.text ?? y.name));
    if (t) out.push(`${++n}. ${t}`);
  };
  walk(x);
  return out.join("\n");
}

const HEAD_INGREDIENTS = /^#*\s*ingredients?\s*:?$/i;
const HEAD_STEPS = /^#*\s*(instructions?|directions?|method|steps|preparation|how to make it)\s*:?$/i;
const HEAD_OTHER = /^#*\s*(notes?|nutrition(\s+facts)?|equipment|tips?)\s*:?$/i;
const BULLET = /^[-•*▢□☐]\s*/;

/**
 * A recipe pasted as text (the site wouldn't let the server read it): the first line is the
 * name, lines under "Ingredients" are ingredients, lines under "Instructions" (Directions,
 * Method…) are steps. Without those headings, short lines that start with an amount are
 * ingredients and the rest are steps.
 */
export function recipeFromText(pasted: string): ReadRecipe {
  const lines = pasted
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: ReadRecipe = { name: "", yieldQty: null, yieldUnit: "", prepMin: null, cookMin: null, ingredients: [], instructions: "" };
  const steps: string[] = [];
  const headed = lines.some((l) => HEAD_INGREDIENTS.test(l)) && lines.some((l) => HEAD_STEPS.test(l));
  let part: "top" | "ingredients" | "steps" | "other" = "top";
  for (const line of lines) {
    // "Step 1" on a line of its own (Allrecipes): the numbering is made fresh below.
    if (/^step\s*\d+\s*[.:)]?$/i.test(line)) continue;
    if (HEAD_INGREDIENTS.test(line)) part = "ingredients";
    else if (HEAD_STEPS.test(line)) part = "steps";
    else if (HEAD_OTHER.test(line)) part = "other";
    else if (headed) {
      if (part === "top") out.name ||= line;
      else if (part === "ingredients") out.ingredients.push(bare(line));
      else if (part === "steps") steps.push(line);
    } else if (!out.name) out.name = line;
    else if (/^[-•*▢□☐]?\s*[\d½¼¾⅓⅔⅛]/.test(line) && !/^\d+[.):]\s/.test(line) && line.length < 120) out.ingredients.push(bare(line));
    else steps.push(line);
  }
  let n = 0;
  out.instructions = steps
    .map((l) => l.replace(BULLET, "").replace(/^(step\s*)?\d+[.):]?\s+/i, ""))
    .filter(Boolean)
    .map((l) => `${++n}. ${l}`)
    .join("\n");
  return out;
}

/** Without a list's bullet or checkbox. */
const bare = (l: string) => cleanLine(l.replace(BULLET, ""));
