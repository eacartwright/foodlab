import {
  BUY_AGAIN,
  EFFORTS,
  GF,
  LOG_KINDS,
  METHODS,
  RATINGS,
  STATUSES,
  TRAVELS,
  type Eating,
  type Food,
  type Kind,
  type LogEntry,
  type Product,
  type Recipe,
  type RecipeIngredient,
  type Records,
  type Store,
  type Tag,
} from "./types";

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
    };
  },
  products(body, rid, now): Product {
    const b = obj(body);
    return {
      ...base(b, rid, now),
      ...eating(b),
      name: name(b.name),
      foodId: id(b.foodId, "foodId"),
      brand: str(b.brand, "brand", 200).trim(),
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
};
