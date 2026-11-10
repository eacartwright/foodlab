// The records foodlab stores (DESIGN.md §4). Client and server share these.
// Every record is saved whole (PUT /api/<kind>/<id>); `updatedAt` and `rev` are set by the server.

import { DEFAULT_AI, type AiSettings } from "./ai";

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
export const GF = ["unknown", "certified", "labeled", "ingredients", "facility", "no", "menu", "modified", "ask"] as const;
export type GlutenFree = (typeof GF)[number];
export const GF_LABEL: Record<GlutenFree, string> = {
  unknown: "",
  certified: "Certified GF",
  labeled: "Labeled GF",
  ingredients: "No gluten ingredients",
  facility: "Shared facility",
  no: "Not GF",
  menu: "GF menu",
  modified: "GF modified",
  ask: "Ask",
};
/** The ones a product offers, and the ones a restaurant dish does (DESIGN.md §4.6, §4.11). */
export const PRODUCT_GF = ["certified", "labeled", "ingredients", "facility", "no"] as const satisfies readonly GlutenFree[];
export const DISH_GF = ["menu", "modified", "ask", "no"] as const satisfies readonly GlutenFree[];

/** What a place is (DESIGN.md §4.4): any of these. */
export const PLACE_TYPES = ["grocery", "specialty", "prepared", "restaurant"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];
export const PLACE_TYPE_LABEL: Record<PlaceType, string> = { grocery: "Grocery store", specialty: "Specialty store", prepared: "Prepared food", restaurant: "Restaurant" };
/** How fast the food comes: a counter, hot bar or fast casual, or a table. */
export const SPEEDS = ["quick", "sitdown"] as const;
export type Speed = (typeof SPEEDS)[number];
export const SPEED_LABEL: Record<Speed, string> = { quick: "Quick", sitdown: "Sit-down" };
export const COSTS = ["1", "2", "3"] as const;
export type Cost = (typeof COSTS)[number];
export const COST_LABEL: Record<Cost, string> = { "1": "$", "2": "$$", "3": "$$$" };
/** A place's status reads differently from a dish's: been there, or want to go. */
export const PLACE_STATUS_LABEL: Record<Status, string> = { tried: "Been", want: "Want to go" };

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

/** Where a product is kept (2026-11-09): the store section it's in, and where it goes at home. Blank = not set. */
export const STORAGE = ["pantry", "fridge", "freezer"] as const;
export type Storage = (typeof STORAGE)[number];
export const STORAGE_LABEL: Record<Storage, string> = { pantry: "Pantry", fridge: "Fridge", freezer: "Freezer" };
/** The words that find it in search: "frozen" finds what's kept in the freezer. */
export const STORAGE_WORDS: Record<Storage, string> = { pantry: "pantry shelf-stable", fridge: "fridge refrigerated", freezer: "freezer frozen" };

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
/** A photo (DESIGN.md §5.11): the picture, and a small copy for lists. Both are files (/api/files/<id>). */
export interface Photo {
  id: Id;
  thumb: Id;
}
/** A file attached to a dev note: a photo or anything else. */
export interface Attachment {
  id: Id;
  name: string;
  type: string;
}
export const fileUrl = (id: Id, name = "") => `/api/files/${id}${name ? `/${encodeURIComponent(name)}` : ""}`;

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
  /** The first is the main one. */
  photos: Photo[];
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
  /** Produce code from the sticker ("4053" = lemon); only asked for under Produce, Fruit or Vegetable. */
  plu: string;
}

export interface Product extends Base, Eating {
  name: string;
  /** Product of. Null = unsorted. */
  foodId: Id | null;
  /** Toothpaste, tissues: bought at the store, never eaten (no food, never in Eat). */
  notFood: boolean;
  brand: string;
  /** Sold at. */
  storeIds: Id[];
  buyAgain: BuyAgain | null;
  storage: Storage | null;
  shelfLife: string;
}

/**
 * A place (DESIGN.md §4.4): a store I buy products at, a restaurant with dishes, or both
 * (Wegmans). Called a store in the code and tables, where it began; "Place" on screen.
 */
export interface Store extends Base {
  name: string;
  notes: string;
  types: PlaceType[];
  speed: Speed | null;
  cost: Cost | null;
  /** Been / want to go; null = not said (most stores). */
  status: Status | null;
  rating: Rating | null;
  /** Where it is: one for most places, several for a chain (Wegmans Pittsford, Perinton). */
  locations: PlaceLocation[];
  /** Its site, Find Me Gluten Free, a menu. */
  links: string[];
  tagIds: Id[];
}

/** One of a place's locations; `name` tells them apart ("Pittsford"), blank when there's one. */
export interface PlaceLocation {
  id: Id;
  name: string;
  address: string;
  phone: string;
  hours: string;
}

/** Something I eat at a place (DESIGN.md §4.11): the hot bar bowl, a restaurant's burger. */
export interface Dish extends Base, Eating {
  name: string;
  /** Where. Null = not said yet. */
  placeId: Id | null;
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
  /** How many I usually make (same unit as the yield); the page opens scaled to it. Null = as written. */
  myYield: number | null;
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
  /** Other words for it (2026-11-09): "bright", "tart" for tangy. Searched and picked like the name. Lowercase. */
  aliases: string[];
}

export type LogTarget = "recipes" | "products" | "dishes";
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
  files: Attachment[];
}

/**
 * Something I buy, on the grocery list or not (DESIGN.md §4.10). Made once, the first time
 * it's typed; after that it's only ever needed again or got. Never completed, never retyped.
 */
export interface GroceryItem extends Base {
  name: string;
  foodId: Id | null;
  /** A product gives the item its stores. */
  productId: Id | null;
  /** On the list. */
  need: boolean;
  /** This time only ("2", "the big one"); cleared when it's got. */
  note: string;
  /** When it last went on the list: the list's order. */
  neededAt: number | null;
  /** When it was last checked off: this trip, and its Undo. */
  gotAt: number | null;
  /** Checked off and still on screen this trip, until Done shopping (on any device) or 3 hours. */
  inTrip: boolean;
  /** Times got: orders Usual. */
  count: number;
}

/** From `from` ("HH:MM", local) until the next slot, What can I eat? opens on this meal (DESIGN.md §5.2). */
export interface MealSlot {
  from: string;
  tagId: Id;
}

/** App-wide settings: one record, id `SETTINGS_ID`. Per-device ones (Colors) stay on the device. */
export interface Settings extends Base {
  mealTimes: MealSlot[];
  ai: AiSettings;
}
export const SETTINGS_ID = "app";

export interface Records {
  foods: Food;
  products: Product;
  stores: Store;
  recipes: Recipe;
  dishes: Dish;
  tags: Tag;
  log: LogEntry;
  devnotes: DevNote;
  groceries: GroceryItem;
  settings: Settings;
}
export type Kind = keyof Records;
export const KINDS: Kind[] = ["foods", "products", "stores", "recipes", "dishes", "tags", "log", "devnotes", "groceries", "settings"];
export type AnyRecord = Records[Kind];

/** Everything, keyed by id per kind. Deleted records are included (tombstones). */
export type State = { [K in Kind]: Record<Id, Records[K]> } & { rev: number };

export const emptyState = (): State => ({ rev: 0, foods: {}, products: {}, stores: {}, recipes: {}, dishes: {}, tags: {}, log: {}, devnotes: {}, groceries: {}, settings: {} });

/** The fixed meal tags (DESIGN.md §4.9), seeded with these ids. */
export const MEAL_TAGS: { id: Id; name: string }[] = [
  { id: "meal-breakfast", name: "Breakfast" },
  { id: "meal-lunch", name: "Lunch" },
  { id: "meal-dinner", name: "Dinner" },
  { id: "meal-snack", name: "Snack" },
  { id: "meal-dessert", name: "Dessert" },
];
/** The "work lunch" tag: a meal until 2026-10-30, a personal tag since (migration 10); keeps its id. */
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
  photos: [],
});

export const DEFAULT_MEAL_TIMES: MealSlot[] = [
  { from: "04:00", tagId: "meal-breakfast" },
  { from: "10:30", tagId: "meal-lunch" },
  { from: "16:00", tagId: "meal-dinner" },
  { from: "23:00", tagId: "meal-snack" },
];

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
    plu: "",
  }),
  products: (id: Id, name: string, now = Date.now()): Product => ({
    ...EMPTY_BASE(id, now),
    ...EMPTY_EATING(),
    name,
    foodId: null,
    notFood: false,
    storage: null,
    brand: "",
    storeIds: [],
    buyAgain: null,
    shelfLife: "",
  }),
  stores: (id: Id, name: string, now = Date.now()): Store => ({
    ...EMPTY_BASE(id, now),
    name,
    notes: "",
    types: [],
    speed: null,
    cost: null,
    status: null,
    rating: null,
    locations: [],
    links: [],
    tagIds: [],
  }),
  dishes: (id: Id, name: string, now = Date.now()): Dish => ({ ...EMPTY_BASE(id, now), ...EMPTY_EATING(), name, placeId: null }),
  recipes: (id: Id, name: string, now = Date.now()): Recipe => ({
    ...EMPTY_BASE(id, now),
    ...EMPTY_EATING(),
    name,
    method: null,
    yieldQty: null,
    yieldUnit: "",
    myYield: null,
    prepMin: null,
    cookMin: null,
    instructions: "",
    ingredients: [],
  }),
  tags: (id: Id, name: string, now = Date.now()): Tag => ({ ...EMPTY_BASE(id, now), name, kind: "personal", aliases: [] }),
  devnotes: (id: Id, text: string, path: string, now = Date.now()): DevNote => ({ ...EMPTY_BASE(id, now), text, path, done: false, files: [] }),
  settings: (now = Date.now()): Settings => ({ ...EMPTY_BASE(SETTINGS_ID, now), mealTimes: DEFAULT_MEAL_TIMES, ai: DEFAULT_AI }),
  groceries: (id: Id, name: string, now = Date.now()): GroceryItem => ({
    ...EMPTY_BASE(id, now),
    name,
    foodId: null,
    productId: null,
    need: true,
    note: "",
    neededAt: now,
    gotAt: null,
    inTrip: false,
    count: 0,
  }),
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

/**
 * A US number as (617) 123-4567, however it was typed or pasted ("617.123.4567", "+1 617-123-4567").
 * Anything else (an extension, a number abroad) stays as typed.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10 || /[a-z]/i.test(phone)) return phone.trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** What a record is called on screen. */
export const nameOf = (x: { name: string; brand?: string }): string => (x.brand !== undefined ? productName(x as { brand: string; name: string }) : x.name);

/** Today as YYYY-MM-DD in local time. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
