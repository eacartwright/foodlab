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
  // "2 green onions, chopped" at half: "1 green onion, chopped". (A unit says its own plural: "1 clove".)
  if (!a.unit && a.quantity > 1 && a.quantity * factor <= 1) after = after.replace(/^([^,(;]*?)([a-z]+)(?=\s*(?:[,(;]|$))/i, (_, head: string, w: string) => head + singular(w));
  return { before: line.slice(0, a.start), amount, after: after && !/^\s/.test(after) ? ` ${after}` : after, approx };
}

/** What instructions measure in; "2 minutes", "350°F", "9-inch pan" have none, so they stay. */
const MEASURES = new Set(["tsp", "tbsp", "cup", "oz", "fl oz", "lb", "g", "kg", "ml", "l", "pint", "quart", "gallon"]);
/** "a 10-ounce can" is the can's size, not an amount. */
const PACKAGE = /^[\s-]*(?:\)\s*)?(?:cans?|jars?|packages?|pkgs?|bags?|box(?:es)?|bottles?|containers?|cartons?|tins?|sticks?)\b/i;
const FRACS = "½⅓⅔¼¾⅛⅜⅝⅞⅕⅙⅚";

/** Running text (a recipe's instructions) with its measured amounts scaled: "add 2 cups broth". */
export function scaleText(text: string, factor: number): (string | { amount: string; approx: boolean })[] {
  if (factor === 1) return [text];
  const out: (string | { amount: string; approx: boolean })[] = [];
  const start = new RegExp(`(?<![\\w/.,${FRACS}])[\\d${FRACS}]`, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = start.exec(text))) {
    // "1-cup rice" reads as "1 cup rice" (same length, so the span still lines up).
    const rest = text.slice(m.index).replace(new RegExp(`^([\\d${FRACS}/. ]+)-(?=[a-z])`, "i"), "$1 ");
    const a = amountIn(rest);
    if (!a || a.start !== 0 || !MEASURES.has(a.unit) || PACKAGE.test(rest.slice(a.end))) continue;
    let end = a.end;
    while (end > 0 && /\s/.test(rest[end - 1]!)) end--;
    if (rest[end - 1] === ".") end--; // "measure 2 cups." keeps its full stop
    if (m.index > last) out.push(text.slice(last, m.index));
    const lo = scaleAmount(a.quantity, a.unit, factor);
    const hi = a.high !== null ? scaleAmount(a.high, a.unit, factor) : null;
    out.push({ amount: hi ? `${lo.text} – ${hi.text}` : lo.text, approx: lo.approx || !!hi?.approx });
    last = m.index + end;
    start.lastIndex = last;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** "4 servings" at 1 → "1 serving"; "1 loaf" at 2 → "2 loaves". */
export function yieldText(qty: number, unit: string, writtenQty: number): string {
  let u = unit;
  if (/\(s\)$/.test(u)) return `${formatQuantity(qty)} ${u.replace(/\(s\)$/, qty > 1 ? "s" : "")}`;
  if (qty <= 1 && writtenQty > 1) u = u.replace(/ies$/, "y").replace(/ves$/, "f").replace(/(?<=[^s])s$/, "");
  else if (qty > 1 && writtenQty <= 1 && u && !/s$/.test(u)) u = u.replace(/y$/, "ie").replace(/f$/, "ve") + "s";
  return `${formatQuantity(qty)}${u ? ` ${u}` : ""}`;
}
