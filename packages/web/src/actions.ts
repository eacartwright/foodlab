import {
  blank,
  nameOf,
  newId,
  parseLine,
  tidyName,
  today,
  type DevNote,
  type Food,
  type Id,
  type Kind,
  type LogEntry,
  type LogKind,
  type LogTarget,
  type Rating,
  type Recipe,
  type RecipeIngredient,
  type Records,
} from "@foodlab/shared";
import { go, pathOf } from "./router";
import { data, put } from "./sync";
import { showToast } from "./toast";

// Changes that touch more than one record, or need a look at the data first.

/** The food with this name, made if there's none ("Lemons" finds Lemon). */
export function ensureFood(name: string, extra: Partial<Food> = {}): Id {
  const found = data().view.findFood(name);
  if (found) return found.id;
  const food = { ...blank.foods(newId(), tidyName(name)), ...extra };
  put("foods", food);
  return food.id;
}

export function ensureStore(name: string): Id {
  const found = data().view.findStore(name);
  if (found) return found.id;
  const s = blank.stores(newId(), tidyName(name));
  put("stores", s);
  return s.id;
}

export function ensureTag(name: string): Id {
  const found = data().view.findTag(name);
  if (found) return found.id;
  const t = blank.tags(newId(), name.trim().replace(/\s+/g, " ").toLowerCase());
  put("tags", t);
  return t.id;
}

/**
 * Ingredient lines as typed → the recipe's ingredients. A line typed exactly as before keeps
 * its ingredient (and any food picked for it by hand); a new or changed line is parsed and its
 * food found or made.
 */
export function ingredientsFromText(text: string, before: RecipeIngredient[]): RecipeIngredient[] {
  const old = new Map<string, RecipeIngredient[]>();
  for (const i of before) old.set(i.line, [...(old.get(i.line) ?? []), i]);
  const out: RecipeIngredient[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const same = old.get(line)?.shift();
    if (same) {
      out.push(same);
      continue;
    }
    const p = parseLine(line);
    out.push({
      id: newId(),
      line,
      foodId: p.food ? ensureFood(p.food) : null,
      quantity: p.quantity,
      unit: p.unit,
      prep: p.prep,
      optional: p.optional,
      note: p.note,
    });
  }
  return out;
}

export function setIngredientFood(recipe: Recipe, ingredientId: Id, foodId: Id | null) {
  const r = data().state.recipes[recipe.id] ?? recipe;
  put("recipes", { ...r, ingredients: r.ingredients.map((i) => (i.id === ingredientId ? { ...i, foodId } : i)) });
}

/** Delete (a tombstone), with Undo. */
export function remove<K extends Exclude<Kind, "log" | "tags" | "devnotes">>(kind: K, record: Records[K]) {
  put(kind, { ...record, deleted: true });
  showToast(`Deleted “${nameOf(record)}”`, {
    label: "Undo",
    run: () => {
      const now = data().state[kind][record.id] as Records[K] | undefined;
      if (now) put(kind, { ...now, deleted: false });
    },
  });
}

export function addLog(itemKind: LogTarget, itemId: Id, kind: LogKind, text: string, rating: Rating | null = null, date = today()) {
  const e: LogEntry = {
    id: newId(),
    deleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rev: 0,
    itemKind,
    itemId,
    date,
    kind,
    rating,
    text,
  };
  put("log", e);
}

export function removeLog(e: LogEntry) {
  put("log", { ...e, deleted: true });
  showToast("Deleted the entry", { label: "Undo", run: () => put("log", { ...e, deleted: false }) });
}

/**
 * A copy to start the next one from, opened with its name ready to change. It takes what
 * describes the thing, not what I thought of it: no rating, buy again or history, and for a
 * product no notes, links or gluten-free (those belong to that one product).
 */
export function duplicate(kind: "foods" | "products" | "recipes", id: Id) {
  const now = Date.now();
  const copy = { id: newId(), deleted: false, createdAt: now, updatedAt: now, rev: 0 };
  const name = (n: string) => `${n} (copy)`;
  if (kind === "foods") {
    const f = data().state.foods[id]!;
    put("foods", { ...f, ...copy, name: name(f.name), staple: false, notes: "" });
  } else if (kind === "products") {
    const p = data().state.products[id]!;
    put("products", { ...blank.products(copy.id, name(p.name), now), ...pick(p, ["foodId", "brand", "storeIds", "tagIds", "travels", "keepsDays", "effort", "shelfLife"]) });
  } else {
    const r = data().state.recipes[id]!;
    put("recipes", {
      ...r,
      ...copy,
      name: name(r.name),
      rating: null,
      status: "tried",
      ingredients: r.ingredients.map((i) => ({ ...i, id: newId() })),
    });
  }
  go(pathOf(kind, copy.id) + (kind === "recipes" ? "?edit=1" : ""));
  // Once the new page is up: its name selected, to type over.
  setTimeout(() => {
    const el = document.querySelector<HTMLInputElement>('.page input[aria-label="Name"]');
    el?.focus();
    el?.select();
  }, 50);
}

const pick = <T, K extends keyof T>(x: T, keys: K[]) => Object.fromEntries(keys.map((k) => [k, x[k]])) as Pick<T, K>;

/** Note an idea or bug, with the page it was written on. */
export function addDevNote(text: string) {
  put("devnotes", blank.devnotes(newId(), text, location.pathname + location.search));
}

export function removeDevNote(n: DevNote) {
  put("devnotes", { ...n, deleted: true });
  showToast("Deleted the note", { label: "Undo", run: () => put("devnotes", { ...(data().state.devnotes[n.id] ?? n), deleted: false }) });
}
