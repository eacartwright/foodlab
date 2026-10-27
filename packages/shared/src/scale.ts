import { amountIn, formatAmount, formatQuantity, singular } from "./ingredients";

// Scaling a recipe (DESIGN.md §5.4): amounts as you'd measure them, never "3/32 tsp".
// Only what's shown changes; the recipe keeps its amounts as written.

export interface Scaled {
  text: string;
  /** Rounded more than a little from the exact amount. */
  approx: boolean;
}

const TSP = { tsp: 1, tbsp: 3, cup: 48 } as const;
/** What the spoons measure, in tsp. */
const SPOONS = [1 / 8, 1 / 4, 1 / 2, 3 / 4, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75];
/** What the cups measure, as a part of a cup. */
const CUP_PARTS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];

const nearest = (v: number, options: number[]) => options.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const approxOf = (exact: number, shown: number) => Math.abs(shown - exact) > exact * 0.03;

/** Teaspoons, tablespoons and cups: the handiest of the three, in sizes the set has. */
function volume(tsp: number): { text: string; shown: number } {
  if (tsp < 0.09) return { text: "a pinch", shown: tsp };
  if (tsp < 3) {
    const t = nearest(tsp, SPOONS);
    return { text: formatAmount(t, "tsp"), shown: t };
  }
  if (tsp < 12) {
    // Half-teaspoon steps, written with a tablespoon: "1 tbsp + 1 tsp", "1½ tbsp".
    const n = roundTo(tsp, 0.5);
    const tb = Math.floor(n / 3 + 1e-9);
    const rest = n - tb * 3;
    if (rest === 0) return { text: formatAmount(tb, "tbsp"), shown: n };
    if (rest === 1.5) return { text: formatAmount(tb + 0.5, "tbsp"), shown: n };
    return { text: `${formatAmount(tb, "tbsp")} + ${formatAmount(rest, "tsp")}`, shown: n };
  }
  const cups = tsp / 48;
  const whole = Math.floor(cups);
  const c = whole + nearest(cups - whole, CUP_PARTS);
  return { text: formatAmount(c, "cup"), shown: c * 48 };
}

/** One amount times `factor`, rounded to something you can measure. */
export function scaleAmount(quantity: number, unit: string, factor: number): Scaled {
  const exact = quantity * factor;
  if (unit in TSP) {
    const tsp = exact * TSP[unit as keyof typeof TSP];
    const v = volume(tsp);
    return { text: v.text, approx: v.text === "a pinch" || approxOf(tsp, v.shown) };
  }
  if (unit === "oz" || unit === "lb") {
    const oz = exact * (unit === "lb" ? 16 : 1);
    if (oz >= 16) {
      const lb = roundTo(oz / 16, 0.25);
      return { text: formatAmount(lb, "lb"), approx: approxOf(oz, lb * 16) };
    }
    const o = Math.max(0.5, roundTo(oz, oz < 4 ? 0.5 : 1));
    return { text: formatAmount(o, "oz"), approx: approxOf(oz, o) };
  }
  if (unit === "g" || unit === "ml") {
    const n = Math.max(1, roundTo(exact, exact >= 100 ? 5 : 1));
    return { text: formatAmount(n, unit), approx: approxOf(exact, n) };
  }
  if (unit === "pinch" || unit === "dash") {
    const n = Math.max(1, Math.round(exact));
    return { text: formatAmount(n, unit), approx: approxOf(exact, n) };
  }
  // Things you count (eggs, cloves, cans) and the rest: halves, quarters below a half.
  const n = exact < 0.5 ? Math.max(0.25, roundTo(exact, 0.25)) : roundTo(exact, 0.5);
  return { text: formatAmount(n, unit), approx: approxOf(exact, n) };
}

/** An ingredient line with its amount scaled; the rest of the line stays as typed. */
export function scaleLine(line: string, factor: number): { before: string; amount: string; after: string; approx: boolean } | null {
  const a = amountIn(line);
  if (!a || factor === 1) return null;
  const lo = scaleAmount(a.quantity, a.unit, factor);
  let amount = lo.text;
  let approx = lo.approx;
  if (a.high !== null) {
    const hi = scaleAmount(a.high, a.unit, factor);
    // "1–1½ tbsp" when both ends land in the same unit, "1 tsp – 1½ tbsp" otherwise.
    const unitLo = lo.text.replace(/^[\d½⅓⅔¼¾⅛⅜⅝⅞⅕⅙⅚.]+\s*/, "");
    const unitHi = hi.text.replace(/^[\d½⅓⅔¼¾⅛⅜⅝⅞⅕⅙⅚.]+\s*/, "");
    const qLo = lo.text.slice(0, lo.text.length - unitLo.length).trim();
    amount = unitLo === unitHi && qLo && !lo.text.includes("+") ? `${qLo}–${hi.text}` : `${lo.text} – ${hi.text}`;
    approx ||= hi.approx;
  }
  let after = line.slice(a.end);
  // "2 eggs" at a quarter: "½ egg". (A unit says its own plural: "1 clove".)
  if (!a.unit && a.quantity > 1 && a.quantity * factor <= 1) after = after.replace(/^(\s*)([a-z]+)/i, (_, sp: string, w: string) => sp + singular(w));
  return { before: line.slice(0, a.start), amount, after: after && !/^\s/.test(after) ? ` ${after}` : after, approx };
}

/** "4 servings" at 1 → "1 serving"; "1 loaf" at 2 → "2 loaves". */
export function yieldText(qty: number, unit: string, writtenQty: number): string {
  let u = unit;
  if (qty <= 1 && writtenQty > 1) u = u.replace(/ies$/, "y").replace(/ves$/, "f").replace(/(?<=[^s])s$/, "");
  else if (qty > 1 && writtenQty <= 1 && u && !/s$/.test(u)) u = u.replace(/y$/, "ie").replace(/f$/, "ve") + "s";
  return `${formatQuantity(qty)}${u ? ` ${u}` : ""}`;
}
