import {
  BUY_AGAIN,
  EFFORTS,
  GF,
  MEAL_TAGS,
  SETTINGS_ID,
  LOG_KINDS,
  METHODS,
  RATINGS,
  STATUSES,
  TRAVELS,
  withoutBrand,
  type DevNote,
  type Eating,
  type Food,
  type GroceryItem,
  type Kind,
  type LogEntry,
  type Product,
  type Recipe,
  type RecipeIngredient,
  type Settings,
  type Records,
  type Store,
  type Tag,
} from "./types";
import { AI_MODELS, DEFAULT_AI, type AiModel, type AiSettings } from "./ai";

// Turns a request body into a clean record, or says what's wrong. The server runs these on
// every save; references to other records are checked separately (server), since that needs state.

export class Invalid extends Error {}

type In = Record<string, unknown>;

const obj = (x: unknown): In => {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Invalid("Expected an object");
  return x as In;
};
const str = (x: unknown, field: string, max = 20_000): string => {
  if (x === undefined || x === null) return "";
  if (typeof x !== "string") throw new Invalid(`${field}: expected text`);
  if (x.length > max) throw new Invalid(`${field}: too long`);
  return x;
};
const name = (x: unknown, field = "name"): string => {
  const s = str(x, field, 300).trim();
  if (!s) throw new Invalid(`${field}: required`);
  return s;
};
const id = (x: unknown, field: string): string | null => {
  if (x === undefined || x === null || x === "") return null;
  if (typeof x !== "string" || x.length > 64) throw new Invalid(`${field}: expected an id`);
  return x;
};
const ids = (x: unknown, field: string): string[] => {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x)) throw new Invalid(`${field}: expected a list`);
  return [...new Set(x.map((v) => id(v, field)).filter((v): v is string => !!v))];
};
/** 4 or 5 digits (5 = organic, a 9 in front), or blank. */
const plu = (x: unknown): string => {
  const s = str(x, "plu", 20).replace(/\s+/g, "");
  if (s && !/^\d{4,5}$/.test(s)) throw new Invalid("plu: 4 or 5 digits");
  return s;
};
const strs = (x: unknown, field: string): string[] => {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x)) throw new Invalid(`${field}: expected a list`);
  return x.map((v) => str(v, field, 2000).trim()).filter(Boolean);
};
const oneOf = <T extends string>(x: unknown, options: readonly T[], field: string, fallback: T | null = null): T | null => {
  if (x === undefined || x === null || x === "") return fallback;
  if (typeof x !== "string" || !options.includes(x as T)) throw new Invalid(`${field}: expected one of ${options.join(", ")}`);
  return x as T;
};
const num = (x: unknown, field: string, min = 0, max = 1e6): number | null => {
  if (x === undefined || x === null || x === "") return null;
  if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max) throw new Invalid(`${field}: expected a number`);
  return x;
};
const bool = (x: unknown) => x === true;

/** The AI settings; a record saved before they existed gets the defaults. */
function aiSettings(x: unknown): AiSettings {
  if (x === undefined || x === null) return DEFAULT_AI;
  const b = obj(x);
  const model = b.model as AiModel;
  if (model !== "off" && !AI_MODELS.some((m) => m.id === model)) throw new Invalid("ai.model: off or a Claude model");
  if (!Array.isArray(b.alertsAt) || b.alertsAt.length > 6) throw new Invalid("ai.alertsAt: up to 6 percentages");
  const alertsAt = [...new Set(b.alertsAt.map((p, n) => Math.round(num(p, `ai.alertsAt[${n}]`, 1, 100) ?? 0)))].filter(Boolean).sort((p, q) => p - q);
  return { model, monthlyLimitUsd: num(b.monthlyLimitUsd, "ai.monthlyLimitUsd", 0, 1000), alertsAt };
}
const time = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? x : fallback);

function base(b: In, rid: string, now: number) {
  return { id: rid, deleted: bool(b.deleted), createdAt: time(b.createdAt, now), updatedAt: now, rev: 0 };
}

function eating(b: In): Eating {
  return {
    rating: oneOf(b.rating, RATINGS, "rating"),
    status: oneOf(b.status, STATUSES, "status", "tried")!,
    glutenFree: oneOf(b.glutenFree, GF, "glutenFree", "unknown")!,
    notes: str(b.notes, "notes"),
    links: strs(b.links, "links"),
    tagIds: ids(b.tagIds, "tagIds"),
    travels: oneOf(b.travels, TRAVELS, "travels"),
    keepsDays: num(b.keepsDays, "keepsDays", 0, 365),
    effort: oneOf(b.effort, EFFORTS, "effort"),
  };
}

function ingredient(x: unknown, i: number): RecipeIngredient {
  const b = obj(x);
  const f = `ingredients[${i}]`;
  return {
    id: id(b.id, `${f}.id`) ?? `${i}`,
    line: str(b.line, `${f}.line`, 500).trim(),
    foodId: id(b.foodId, `${f}.foodId`),
    quantity: num(b.quantity, `${f}.quantity`, 0, 1e5),
    unit: str(b.unit, `${f}.unit`, 40).trim(),
    prep: str(b.prep, `${f}.prep`, 200).trim(),
    optional: bool(b.optional),
    note: str(b.note, `${f}.note`, 500).trim(),
  };
}

export const validators: { [K in Kind]: (body: unknown, id: string, now: number) => Records[K] } = {
  foods(body, rid, now): Food {
    const b = obj(body);
    return {
      ...base(b, rid, now),
      name: name(b.name),
      parentId: id(b.parentId, "parentId"),
      formOfId: id(b.formOfId, "formOfId"),
      staple: bool(b.staple),
      shelfLife: str(b.shelfLife, "shelfLife", 200),
      notes: str(b.notes, "notes"),
      tagIds: ids(b.tagIds, "tagIds"),
      plu: plu(b.plu),
    };
  },
  products(body, rid, now): Product {
    const b = obj(body);
    const brand = str(b.brand, "brand", 200).trim();
    return {
      ...base(b, rid, now),
      ...eating(b),
      // Shown as brand + name, so the name doesn't repeat the brand.
      name: withoutBrand(name(b.name), brand),
      foodId: id(b.foodId, "foodId"),
      brand,
      storeIds: ids(b.storeIds, "storeIds"),
      buyAgain: oneOf(b.buyAgain, BUY_AGAIN, "buyAgain"),
      shelfLife: str(b.shelfLife, "shelfLife", 200),
    };
  },
  stores(body, rid, now): Store {
    const b = obj(body);
    return { ...base(b, rid, now), name: name(b.name), notes: str(b.notes, "notes") };
  },
  recipes(body, rid, now): Recipe {
    const b = obj(body);
    const list = b.ingredients === undefined ? [] : b.ingredients;
    if (!Array.isArray(list)) throw new Invalid("ingredients: expected a list");
    if (list.length > 200) throw new Invalid("ingredients: too many");
    return {
      ...base(b, rid, now),
      ...eating(b),
      name: name(b.name),
      method: oneOf(b.method, METHODS, "method"),
      yieldQty: num(b.yieldQty, "yieldQty", 0, 10_000),
      yieldUnit: str(b.yieldUnit, "yieldUnit", 60).trim(),
      prepMin: num(b.prepMin, "prepMin", 0, 100_000),
      cookMin: num(b.cookMin, "cookMin", 0, 100_000),
      instructions: str(b.instructions, "instructions", 100_000),
      ingredients: list.map(ingredient),
    };
  },
  tags(body, rid, now): Tag {
    const b = obj(body);
    return { ...base(b, rid, now), name: name(b.name), kind: b.kind === "meal" ? "meal" : "personal" };
  },
  log(body, rid, now): LogEntry {
    const b = obj(body);
    const date = str(b.date, "date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Invalid("date: expected YYYY-MM-DD");
    const itemKind = oneOf(b.itemKind, ["recipes", "products"] as const, "itemKind");
    if (!itemKind) throw new Invalid("itemKind: required");
    const itemId = id(b.itemId, "itemId");
    if (!itemId) throw new Invalid("itemId: required");
    return {
      ...base(b, rid, now),
      itemKind,
      itemId,
      date,
      kind: oneOf(b.kind, LOG_KINDS, "kind", "note")!,
      rating: oneOf(b.rating, RATINGS, "rating"),
      text: str(b.text, "text", 20_000),
    };
  },
  devnotes(body, rid, now): DevNote {
    const b = obj(body);
    const text = str(b.text, "text", 20_000).trim();
    if (!text) throw new Invalid("text: required");
    return { ...base(b, rid, now), text, path: str(b.path, "path", 500), done: bool(b.done) };
  },
  groceries(body, rid, now): GroceryItem {
    const b = obj(body);
    const stamp = (x: unknown, field: string) => num(x, field, 0, 1e15);
    return {
      ...base(b, rid, now),
      name: name(b.name),
      foodId: id(b.foodId, "foodId"),
      productId: id(b.productId, "productId"),
      need: bool(b.need),
      note: str(b.note, "note", 300).trim(),
      neededAt: stamp(b.neededAt, "neededAt"),
      gotAt: stamp(b.gotAt, "gotAt"),
      inTrip: bool(b.inTrip),
      count: Math.round(num(b.count, "count") ?? 0),
    };
  },
  settings(body, rid, now): Settings {
    if (rid !== SETTINGS_ID) throw new Invalid(`settings: the id is "${SETTINGS_ID}"`);
    const b = obj(body);
    if (!Array.isArray(b.mealTimes) || b.mealTimes.length < 1 || b.mealTimes.length > 12) throw new Invalid("mealTimes: 1 to 12 slots");
    const mealTimes = b.mealTimes.map((x, n) => {
      const s = obj(x);
      const from = str(s.from, `mealTimes[${n}].from`, 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(from)) throw new Invalid(`mealTimes[${n}].from: HH:MM`);
      if (!MEAL_TAGS.some((t) => t.id === s.tagId)) throw new Invalid(`mealTimes[${n}].tagId: a meal`);
      return { from, tagId: s.tagId as string };
    });
    return { ...base(b, rid, now), mealTimes, ai: aiSettings(b.ai) };
  },
};
