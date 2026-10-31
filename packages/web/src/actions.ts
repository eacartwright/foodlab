import {
  blank,
  type Attachment,
  nameOf,
  newId,
  nameKey,
  productName,
  swapTag,
  tidyName,
  today,
  type DevNote,
  type Food,
  type GroceryItem,
  type GroceryUsual,
  type Id,
  type Kind,
  type LogEntry,
  type LogKind,
  type LogTarget,
  type Rating,
  type Recipe,
  type Records,
  type Store,
  type Tag,
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

/** The place with this name, made if there's none (a new one from a dish is a restaurant). */
export function ensureStore(name: string, extra: Partial<Store> = {}): Id {
  const found = data().view.findStore(name);
  if (found) return found.id;
  const s = { ...blank.stores(newId(), tidyName(name)), ...extra };
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
 * Merge (`to`) or delete (`to` null) a personal tag: every food, product and recipe with it
 * gets `to` instead, or loses it, so nothing points at a gone tag. Undo puts them back.
 */
function retag(tag: Tag, to: Tag | null) {
  const uses = data().view.tagged(tag.id).map(({ kind, item }) => ({ kind, id: item.id, hadTo: !!to && item.tagIds.includes(to.id) }));
  for (const u of uses) {
    const now = data().state[u.kind][u.id]!;
    put(u.kind, { ...now, tagIds: swapTag(now.tagIds, tag.id, to?.id ?? null) });
  }
  put("tags", { ...(data().state.tags[tag.id] ?? tag), deleted: true });
  const n = uses.length;
  const what = `${n} thing${n === 1 ? "" : "s"}`;
  showToast(to ? `Merged “${tag.name}” into “${to.name}” (${what})` : `Deleted “${tag.name}”${n ? ` from ${what}` : ""}`, {
    label: "Undo",
    run: () => {
      put("tags", { ...(data().state.tags[tag.id] ?? tag), deleted: false });
      for (const u of uses) {
        const now = data().state[u.kind][u.id];
        if (!now) continue;
        const ids = to && !u.hadTo ? now.tagIds.filter((t) => t !== to.id) : now.tagIds;
        put(u.kind, { ...now, tagIds: ids.includes(tag.id) ? ids : [...ids, tag.id] });
      }
    },
  });
}
export const mergeTag = (tag: Tag, into: Tag) => retag(tag, into);
export const deleteTag = (tag: Tag) => retag(tag, null);

/** Personal tags are stored lowercase, like `ensureTag` makes them. */
export function renameTag(tag: Tag, name: string) {
  put("tags", { ...(data().state.tags[tag.id] ?? tag), name: name.trim().replace(/\s+/g, " ").toLowerCase() });
}

export function setIngredientFood(recipe: Recipe, ingredientId: Id, foodId: Id | null) {
  const r = data().state.recipes[recipe.id] ?? recipe;
  put("recipes", { ...r, ingredients: r.ingredients.map((i) => (i.id === ingredientId ? { ...i, foodId } : i)) });
}

/** Delete (a tombstone), with Undo. */
export function remove<K extends Exclude<Kind, "log" | "tags" | "devnotes" | "settings">>(kind: K, record: Records[K]) {
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
export function duplicate(kind: "foods" | "products" | "recipes" | "dishes", id: Id) {
  const now = Date.now();
  const copy = { id: newId(), deleted: false, createdAt: now, updatedAt: now, rev: 0 };
  const name = (n: string) => `${n} (copy)`;
  if (kind === "foods") {
    const f = data().state.foods[id]!;
    put("foods", { ...f, ...copy, name: name(f.name), staple: false, notes: "" });
  } else if (kind === "products") {
    const p = data().state.products[id]!;
    put("products", { ...blank.products(copy.id, name(p.name), now), ...pick(p, ["foodId", "brand", "storeIds", "tagIds", "travels", "keepsDays", "effort", "shelfLife"]) });
  } else if (kind === "dishes") {
    // Another dish at the same place: what describes it, not what I thought of it.
    const d = data().state.dishes[id]!;
    put("dishes", { ...blank.dishes(copy.id, name(d.name), now), ...pick(d, ["placeId", "tagIds", "glutenFree"]) });
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

/** Note an idea or bug, with the page it was written on if asked. */
export function addDevNote(text: string, withPage: boolean, files: Attachment[] = []) {
  put("devnotes", { ...blank.devnotes(newId(), text, withPage ? location.pathname + location.search : ""), files });
}

/** New text for a note; emptying it leaves the note as it was (✕ deletes). */
export function editDevNote(n: DevNote, text: string) {
  if (text.trim()) put("devnotes", { ...(data().state.devnotes[n.id] ?? n), text: text.trim() });
}

export function removeDevNote(n: DevNote) {
  put("devnotes", { ...n, deleted: true });
  showToast("Deleted the note", { label: "Undo", run: () => put("devnotes", { ...(data().state.devnotes[n.id] ?? n), deleted: false }) });
}

// ---- groceries (DESIGN.md §4.10, §5.8) ----

const latest = (g: GroceryItem) => data().state.groceries[g.id] ?? g;

/**
 * Put something on the grocery list: the item I've had before if there is one (by product,
 * food or name), else a new one, linked to the food or product it names.
 */
export function needGrocery(what: { name: string; foodId?: Id | null; productId?: Id | null } | GroceryUsual): GroceryItem {
  const { view } = data();
  const w = "item" in what || "food" in what || "product" in what ? fromUsual(what as GroceryUsual) : (what as { name: string; foodId?: Id | null; productId?: Id | null });
  let productId = w.productId ?? null;
  let foodId = w.foodId ?? null;
  // A typed name that's a food or product I know links to it.
  if (!productId && !foodId) {
    const food = view.findFood(w.name);
    const product = !food ? view.products.find((p) => nameKey(productName(p)) === nameKey(w.name)) : undefined;
    foodId = food?.id ?? product?.foodId ?? null;
    productId = product?.id ?? null;
  }
  if (productId && !foodId) foodId = data().state.products[productId]?.foodId ?? null;
  const found = view.findGrocery({ name: w.name, foodId, productId });
  const now = Date.now();
  if (found) {
    const g = latest(found);
    // "Butter" on the list, then + Groceries on Kerrygold: the same item, now that product.
    const linked = productId && !g.productId ? { productId, foodId: g.foodId ?? foodId } : {};
    if (g.need) {
      if (linked.productId) put("groceries", { ...g, ...linked });
      return { ...g, ...linked };
    }
    const next = { ...g, ...linked, need: true, neededAt: now, note: "" };
    put("groceries", next);
    return next;
  }
  const g = { ...blank.groceries(newId(), tidyName(w.name), now), foodId, productId };
  put("groceries", g);
  return g;
}

function fromUsual(u: GroceryUsual) {
  if (u.item) return { name: u.item.name, foodId: u.item.foodId, productId: u.item.productId };
  if (u.product) return { name: productName(u.product), foodId: u.product.foodId, productId: u.product.id };
  return { name: u.name, foodId: u.food?.id ?? null, productId: null };
}

/** + Groceries on a food, product or staple: on the list, with Undo. */
export function addToGroceries(what: { name: string; foodId?: Id | null; productId?: Id | null }) {
  const before = what.productId || what.foodId ? data().view.findGrocery({ ...what }) : undefined;
  const g = needGrocery(what);
  showToast(`${g.name} is on the grocery list`, {
    label: "Undo",
    run: () => {
      const now = latest(g);
      if (before) put("groceries", { ...now, need: before.need, neededAt: before.neededAt, productId: before.productId });
      else put("groceries", { ...now, need: false, deleted: true });
    },
  });
}

/** Checked off: off the list, one more time bought, and a `bought` entry on its product. */
export function gotGrocery(item: GroceryItem) {
  const g = latest(item);
  const now = Date.now();
  put("groceries", { ...g, need: false, gotAt: now, inTrip: true, count: g.count + 1 });
  if (g.productId && data().state.products[g.productId]) {
    const e: LogEntry = { ...boughtEntry(g.productId, g.note), createdAt: now, updatedAt: now };
    put("log", e);
  }
}

const boughtEntry = (productId: Id, note: string): LogEntry => ({
  id: newId(),
  deleted: false,
  createdAt: 0,
  updatedAt: 0,
  rev: 0,
  itemKind: "products",
  itemId: productId,
  date: today(),
  kind: "bought",
  rating: null,
  text: note,
});

/** Undo a check-off this trip: back on the list where it was, and the `bought` entry gone. */
export function ungotGrocery(item: GroceryItem) {
  const g = latest(item);
  put("groceries", { ...g, need: true, inTrip: false, count: Math.max(0, g.count - 1) });
  // The entry the check-off wrote has the same timestamp.
  for (const e of Object.values(data().state.log)) {
    if (!e.deleted && e.kind === "bought" && e.itemId === g.productId && e.createdAt === g.gotAt) put("log", { ...e, deleted: true });
  }
}

export function saveGrocery(item: GroceryItem, patch: Partial<GroceryItem>) {
  put("groceries", { ...latest(item), ...patch });
}

// This trip ends at Done shopping, on any device, or on its own a few hours after a check-off
// (DESIGN.md §5.8).
const TRIP_HOURS = 3;

export function tripStart(now = Date.now()): number {
  return now - TRIP_HOURS * 3600_000;
}

/** Done shopping: this trip's check-offs join Usual, on every device (it syncs). */
export function doneShopping() {
  for (const g of data().view.groceryTrip(tripStart())) put("groceries", { ...latest(g), inTrip: false });
}
