// The records foodlab stores (DESIGN.md §4). Client and server share these.
// Every record is saved whole (PUT /api/<kind>/<id>); `updatedAt` and `rev` are set by the server.

export type Id = string;

/** In the order they're offered: best first. */
export const RATINGS = ["love", "up", "down"] as const;
export type Rating = (typeof RATINGS)[number];
export const RATING_EMOJI: Record<Rating, string> = { down: "👎", up: "👍", love: "❤️" };
export const RATING_LABEL: Record<Rating, string> = { down: "Didn't like it", up: "Good", love: "Love it" };

export const STATUSES = ["tried", "want"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { tried: "Tried", want: "Want to try" };

/**
 * How sure I am it's gluten-free (DESIGN.md §4.6). Everything is, unless it's marked Not GF
 * (someone else's food); the rest says how I know. "unknown" = not said.
 */
export const GF = ["unknown", "certified", "labeled", "ingredients", "facility", "no"] as const;
export type GlutenFree = (typeof GF)[number];
export const GF_LABEL: Record<GlutenFree, string> = {
  unknown: "",
  certified: "Certified GF",
  labeled: "Labeled GF",
  ingredients: "No gluten ingredients",
  facility: "Shared facility",
  no: "Not GF",
};

export const TRAVELS = ["cold", "microwave", "asis"] as const;
export type Travels = (typeof TRAVELS)[number];
export const TRAVELS_LABEL: Record<Travels, string> = { cold: "Packs cold", microwave: "Needs microwave", asis: "Eat as-is" };

export const EFFORTS = ["grab", "quick", "prep"] as const;
export type Effort = (typeof EFFORTS)[number];
export const EFFORT_LABEL: Record<Effort, string> = { grab: "Grab (buy it)", quick: "Quick (< 15 min)", prep: "Prep (cook ahead)" };

export const METHODS = ["assembly", "no-cook", "cook", "bake"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<Method, string> = { assembly: "Assembly", "no-cook": "No-cook", cook: "Cook", bake: "Bake" };

export const BUY_AGAIN = ["yes", "no"] as const;
export type BuyAgain = (typeof BUY_AGAIN)[number];

export const LOG_KINDS = ["made", "ate", "bought", "note", "rating"] as const;
export type LogKind = (typeof LOG_KINDS)[number];
export const LOG_LABEL: Record<LogKind, string> = { made: "Made", ate: "Ate", bought: "Bought", note: "Note", rating: "Rating" };

/** What every stored record has. */
export interface Base {
  id: Id;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
  rev: number;
}

/** Recipes and products (and later dishes): the things that answer "what can I eat?". */
export interface Eating {
  rating: Rating | null;
  status: Status;
  glutenFree: GlutenFree;
  notes: string;
  links: string[];
  tagIds: Id[];
  travels: Travels | null;
  keepsDays: number | null;
  effort: Effort | null;
}

export interface Food extends Base {
  name: string;
  /** Is a: Cheese → American cheese. */
  parentId: Id | null;
  /** Form of: Lemon juice → Lemon. */
  formOfId: Id | null;
  staple: boolean;
  shelfLife: string;
  notes: string;
  tagIds: Id[];
}

export interface Product extends Base, Eating {
  name: string;
  /** Product of. Null = unsorted. */
  foodId: Id | null;
  brand: string;
  /** Sold at. */
  storeIds: Id[];
  buyAgain: BuyAgain | null;
  shelfLife: string;
}

export interface Store extends Base {
  name: string;
  notes: string;
}

export interface RecipeIngredient {
  id: Id;
  /** The line as typed; what's shown if the parse is off. */
  line: string;
  foodId: Id | null;
  quantity: number | null;
  unit: string;
  prep: string;
  optional: boolean;
  note: string;
}

export interface Recipe extends Base, Eating {
  name: string;
  method: Method | null;
  yieldQty: number | null;
  yieldUnit: string;
  prepMin: number | null;
  cookMin: number | null;
  instructions: string;
  /** In order. */
  ingredients: RecipeIngredient[];
}

export type TagKind = "meal" | "personal";
export interface Tag extends Base {
  name: string;
  kind: TagKind;
}

export type LogTarget = "recipes" | "products";
export interface LogEntry extends Base {
  itemKind: LogTarget;
  itemId: Id;
  /** YYYY-MM-DD, local. */
  date: string;
  kind: LogKind;
  rating: Rating | null;
  text: string;
}

/** An idea or bug noted while using the app, for working on it later; `path` is the page it was written on. */
export interface DevNote extends Base {
  text: string;
  path: string;
  done: boolean;
}

export interface Records {
  foods: Food;
  products: Product;
  stores: Store;
  recipes: Recipe;
  tags: Tag;
  log: LogEntry;
  devnotes: DevNote;
}
export type Kind = keyof Records;
export const KINDS: Kind[] = ["foods", "products", "stores", "recipes", "tags", "log", "devnotes"];
export type AnyRecord = Records[Kind];

/** Everything, keyed by id per kind. Deleted records are included (tombstones). */
export type State = { [K in Kind]: Record<Id, Records[K]> } & { rev: number };

export const emptyState = (): State => ({ rev: 0, foods: {}, products: {}, stores: {}, recipes: {}, tags: {}, log: {}, devnotes: {} });

/** The fixed meal tags (DESIGN.md §4.9), seeded with these ids. */
export const MEAL_TAGS: { id: Id; name: string }[] = [
  { id: "meal-breakfast", name: "Breakfast" },
  { id: "meal-lunch", name: "Lunch" },
  { id: "meal-work-lunch", name: "Work lunch" },
  { id: "meal-dinner", name: "Dinner" },
  { id: "meal-snack", name: "Snack" },
  { id: "meal-dessert", name: "Dessert" },
];
export const WORK_LUNCH = "meal-work-lunch";

const EMPTY_BASE = (id: Id, now: number): Base => ({ id, deleted: false, createdAt: now, updatedAt: now, rev: 0 });
const EMPTY_EATING = (): Eating => ({
  rating: null,
  status: "tried",
  glutenFree: "unknown",
  notes: "",
  links: [],
  tagIds: [],
  travels: null,
  keepsDays: null,
  effort: null,
});

export const blank = {
  foods: (id: Id, name: string, now = Date.now()): Food => ({
    ...EMPTY_BASE(id, now),
    name,
    parentId: null,
    formOfId: null,
    staple: false,
    shelfLife: "",
    notes: "",
    tagIds: [],
  }),
  products: (id: Id, name: string, now = Date.now()): Product => ({
    ...EMPTY_BASE(id, now),
    ...EMPTY_EATING(),
    name,
    foodId: null,
    brand: "",
    storeIds: [],
    buyAgain: null,
    shelfLife: "",
  }),
  stores: (id: Id, name: string, now = Date.now()): Store => ({ ...EMPTY_BASE(id, now), name, notes: "" }),
  recipes: (id: Id, name: string, now = Date.now()): Recipe => ({
    ...EMPTY_BASE(id, now),
    ...EMPTY_EATING(),
    name,
    method: null,
    yieldQty: null,
    yieldUnit: "",
    prepMin: null,
    cookMin: null,
    instructions: "",
    ingredients: [],
  }),
  tags: (id: Id, name: string, now = Date.now()): Tag => ({ ...EMPTY_BASE(id, now), name, kind: "personal" }),
  devnotes: (id: Id, text: string, path: string, now = Date.now()): DevNote => ({ ...EMPTY_BASE(id, now), text, path, done: false }),
};

/** A product as it's shown: brand first ("Bell & Evans" + "Gluten Free Chicken Breasts"). */
export function productName(p: { brand: string; name: string }): string {
  const brand = p.brand.trim();
  if (!brand || p.name.toLowerCase().startsWith(brand.toLowerCase())) return p.name;
  return `${brand} ${p.name}`;
}

/** The name without the brand in front, so it isn't shown twice ("Bell & Evans Chicken" → "Chicken"). */
export function withoutBrand(name: string, brand: string): string {
  const b = brand.trim();
  if (!b || !name.toLowerCase().startsWith(b.toLowerCase())) return name;
  const rest = name.slice(b.length);
  // Only at a word break, and never down to nothing ("Kraft" by Kraft stays).
  if (!/^[\s,:–—-]/.test(rest)) return name;
  return rest.replace(/^[\s,:–—-]+/, "") || name;
}

/** What a record is called on screen. */
export const nameOf = (x: { name: string; brand?: string }): string => (x.brand !== undefined ? productName(x as { brand: string; name: string }) : x.name);

/** Today as YYYY-MM-DD in local time. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
