import {
  blank,
  newId,
  parseLine,
  tidyName,
  today,
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
export function remove<K extends Exclude<Kind, "log" | "tags">>(kind: K, record: Records[K]) {
  put(kind, { ...record, deleted: true });
  showToast(`Deleted “${(record as { name: string }).name}”`, {
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
