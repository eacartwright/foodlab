import { newId } from "./id";
import type { Id, RecipeIngredient } from "./types";

// Ingredient lines (DESIGN.md §4.5): "1½ cups cooked rice, rinsed (optional)" → quantity, unit,
// food name, prep. The line is always kept as typed, so a parse that's off loses nothing.

export interface ParsedLine {
  quantity: number | null;
  unit: string;
  /** The food's name as typed ("American cheese"). Empty if the line has none. */
  food: string;
  prep: string;
  optional: boolean;
  note: string;
}

/** Canonical unit → the ways it's written. Matched case-insensitively, with or without a dot. */
const UNITS: Record<string, string[]> = {
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons", "t"],
  tbsp: ["tbsp", "tbsps", "tbs", "tablespoon", "tablespoons", "T"],
  cup: ["cup", "cups", "c"],
  oz: ["oz", "ounce", "ounces"],
  "fl oz": ["fl oz", "fluid ounce", "fluid ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  g: ["g", "gram", "grams", "gr"],
  kg: ["kg", "kilogram", "kilograms"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  pint: ["pint", "pints", "pt"],
  quart: ["quart", "quarts", "qt"],
  gallon: ["gallon", "gallons", "gal"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  clove: ["clove", "cloves"],
  slice: ["slice", "slices"],
  piece: ["piece", "pieces"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  bottle: ["bottle", "bottles"],
  package: ["package", "packages", "pkg", "packet", "packets"],
  bag: ["bag", "bags"],
  box: ["box", "boxes"],
  stick: ["stick", "sticks"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  sprig: ["sprig", "sprigs"],
  handful: ["handful", "handfuls"],
  scoop: ["scoop", "scoops"],
  sheet: ["sheet", "sheets"],
  leaf: ["leaf", "leaves"],
  stalk: ["stalk", "stalks"],
  drop: ["drop", "drops"],
  serving: ["serving", "servings"],
};

// Written form → canonical. Case matters only for t / T (teaspoon / tablespoon).
const UNIT_OF = new Map<string, string>();
for (const [canon, forms] of Object.entries(UNITS)) {
  for (const f of forms) UNIT_OF.set(f === "T" || f === "t" ? f : f.toLowerCase(), canon);
}
const unitOf = (word: string): string | undefined => {
  const w = word.replace(/\.$/, "");
  return w === "T" || w === "t" ? UNIT_OF.get(w) : UNIT_OF.get(w.toLowerCase());
};

const FRACTIONS: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅙": 1 / 6, "⅚": 5 / 6 };
const FRAC = Object.keys(FRACTIONS).join("");
const SIZES = new Set(["small", "medium", "large", "extra-large", "xl", "big", "jumbo"]);

/** Reads a number at the start of `s`: "2", "1.5", "1/2", "1 1/2", "1½", "½", "2-3" (→ 2). */
function readQuantity(s: string): { value: number; rest: string; range: string } | null {
  const re = new RegExp(`^(\\d+(?:\\.\\d+)?)?(?:\\s*([${FRAC}]))?(?:\\s+(\\d+)\\/(\\d+)|\\/(\\d+))?`);
  const m = re.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  let value = 0;
  if (m[5] && m[1]) {
    // "1/2"
    value = Number(m[1]) / Number(m[5]);
  } else {
    if (m[1]) value += Number(m[1]);
    if (m[2]) value += FRACTIONS[m[2]]!;
    if (m[3] && m[4]) value += Number(m[3]) / Number(m[4]);
  }
  if (!Number.isFinite(value) || value <= 0) return null;
  let rest = s.slice(m[0].length);
  // A range: "2-3", "2 to 3". Keep the low end; the line says the rest.
  let range = "";
  const r = /^\s*(?:-|–|to)\s*(\d+(?:\.\d+)?(?:\/\d+)?)/.exec(rest);
  if (r) {
    range = r[1]!;
    rest = rest.slice(r[0].length);
  }
  return { value, rest, range };
}

export function parseLine(input: string): ParsedLine {
  let s = input.trim().replace(/\s+/g, " ");
  const out: ParsedLine = { quantity: null, unit: "", food: "", prep: "", optional: false, note: "" };
  const notes: string[] = [];

  // Leading bullets from pasted lists: "- ", "* ", "• ", "1. "
  s = s.replace(/^(?:[-*•]\s+|\d+[.)]\s+(?=\D))/, "");

  // "(optional)" / ", optional" anywhere; other parentheses are notes.
  s = s.replace(/\(\s*optional\s*\)|,\s*optional\s*$/gi, () => {
    out.optional = true;
    return "";
  });
  s = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return "";
  });
  s = s.replace(/\s+/g, " ").trim();

  // Quantity ("a" / "an" before a unit counts as 1: "a pinch of salt").
  const q = readQuantity(s);
  if (q) {
    out.quantity = q.value;
    if (q.range) notes.push(`up to ${q.range}`);
    s = q.rest.trim();
  } else {
    const a = /^(an?)\s+(\S+)/i.exec(s);
    if (a && unitOf(a[2]!)) {
      out.quantity = 1;
      s = s.slice(a[1]!.length).trim();
    }
  }

  // Unit: "fl oz" is two words; otherwise the next word.
  const two = /^(fl\.?\s*oz\.?|fluid ounces?)\b/i.exec(s);
  if (two) {
    out.unit = "fl oz";
    s = s.slice(two[0].length).trim();
  } else {
    const w = /^(\S+)/.exec(s);
    const unit = w && unitOf(w[1]!);
    // A bare "t"/"c"/"l"/"g" only counts as a unit right after a number ("2 c flour", not "c").
    if (unit && (w![1]!.length > 1 || out.quantity !== null)) {
      out.unit = unit;
      s = s.slice(w![1]!.length).trim();
    }
  }
  if (out.unit) s = s.replace(/^of\s+/i, "");

  // Size goes in the note ("2 large eggs" → Egg, note "large").
  const size = /^(\S+)\s+/.exec(s);
  if (size && SIZES.has(size[1]!.toLowerCase())) {
    notes.unshift(size[1]!.toLowerCase());
    s = s.slice(size[0].length);
  }

  // "food, prep" and "food — note"
  const dash = /\s+[—–-]\s+/.exec(s);
  if (dash) {
    notes.push(s.slice(dash.index + dash[0].length).trim());
    s = s.slice(0, dash.index);
  }
  const comma = s.indexOf(",");
  if (comma >= 0) {
    out.prep = s.slice(comma + 1).trim().replace(/[,.;]+$/, "");
    s = s.slice(0, comma);
  }
  out.food = s.trim().replace(/[.;:]+$/, "");
  out.note = notes.filter(Boolean).join("; ");
  return out;
}

/**
 * Where a line's amount is, as typed, for scaling: "1½ cups rice" → quantity 1.5, unit "cup",
 * and the "1½ cups" span. A range keeps its high end ("2-3 tbsp"). No number, no amount.
 */
export function amountIn(line: string): { start: number; end: number; quantity: number; high: number | null; unit: string } | null {
  const start = /^\s*(?:[-*•]\s+|\d+[.)]\s+(?=\D))?/.exec(line)![0].length;
  const q = readQuantity(line.slice(start));
  if (!q) return null;
  let end = line.length - q.rest.length;
  const high = q.range ? (readQuantity(q.range)?.value ?? null) : null;
  let unit = "";
  const rest = line.slice(end);
  const two = /^\s*(fl\.?\s*oz\.?|fluid ounces?)\b/i.exec(rest);
  const w = /^\s*([^\s,(]+)/.exec(rest);
  if (two) {
    unit = "fl oz";
    end += two[0].length;
  } else if (w && unitOf(w[1]!)) {
    unit = unitOf(w[1]!)!;
    end += w[0].length;
  }
  return { start, end, quantity: q.value, high, unit };
}

/**
 * Ingredient lines as typed → the recipe's ingredients. A line typed exactly as before keeps
 * its ingredient. A changed line keeps the food of the old line it replaced (same food name, so
 * "2 slices cheese" → "3 slices cheese" keeps a hand-picked American cheese). Otherwise the food
 * is only ever an existing one (`findFood`); a line with no match stays text, never a new food.
 */
export function ingredientsFromText(text: string, before: RecipeIngredient[], findFood: (name: string) => Id | null | undefined): RecipeIngredient[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const unused = [...before];
  const take = (i: RecipeIngredient | undefined) => i && unused.splice(unused.indexOf(i), 1)[0];
  const same = lines.map((line) => take(unused.find((i) => i.line === line)));
  return lines.map((line, n) => {
    if (same[n]) return same[n];
    const p = parseLine(line);
    const key = nameKey(p.food);
    const was = key ? take(unused.find((i) => i.foodId && nameKey(parseLine(i.line).food) === key)) : undefined;
    return {
      id: was?.id ?? newId(),
      line,
      foodId: was?.foodId ?? (p.food ? (findFood(p.food) ?? null) : null),
      quantity: p.quantity,
      unit: p.unit,
      prep: p.prep,
      optional: p.optional,
      note: p.note,
    };
  });
}

/**
 * A name's matching key: lowercase, letters and digits only, each word singular.
 * "Lemons" = "lemon", "Roma Tomatoes" = "roma tomato", "GF bread" = "gf bread".
 */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map(singular)
    .join(" ");
}

export function singular(w: string): string {
  if (w.length <= 3) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/(oes|ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (/ves$/.test(w) && !/(olives|chives)$/.test(w)) return w.slice(0, -3) + "f";
  if (/[^su]s$/.test(w)) return w.slice(0, -1);
  return w;
}

/** A food name as it should be stored: trimmed, first letter capital ("american cheese" → "American cheese"). */
export function tidyName(name: string): string {
  const s = name.trim().replace(/\s+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PLURAL: Record<string, string> = { box: "boxes", bunch: "bunches", pinch: "pinches", dash: "dashes", leaf: "leaves" };
const COUNTED = new Set(["cup", "pint", "quart", "gallon", "clove", "slice", "piece", "can", "jar", "bottle", "package", "bag", "stick", "head", "sprig", "handful", "scoop", "sheet", "stalk", "drop", "serving", ...Object.keys(PLURAL)]);

/** Quantity and unit as they'd be written: "2 slices", "1½ cups", "1 tbsp", "3". */
export function formatAmount(quantity: number | null, unit: string): string {
  const q = quantity !== null ? formatQuantity(quantity) : "";
  const many = quantity !== null && quantity > 1;
  const u = many && COUNTED.has(unit) ? (PLURAL[unit] ?? `${unit}s`) : unit;
  return [q, u].filter(Boolean).join(" ");
}

/** 1.5 → "1½", 0.333 → "⅓", 2 → "2", 0.4 → "0.4". */
export function formatQuantity(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const frac = q - whole;
  if (frac < 0.01) return String(whole);
  for (const [sym, v] of Object.entries(FRACTIONS)) {
    if (Math.abs(frac - v) < 0.01) return whole ? `${whole}${sym}` : sym;
  }
  return String(Math.round(q * 100) / 100);
}
