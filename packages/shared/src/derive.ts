import { nameKey } from "./ingredients";
import {
  GF_LABEL,
  WORK_LUNCH,
  nameOf,
  today,
  type Effort,
  type Food,
  type GroceryItem,
  type Id,
  type LogEntry,
  type Product,
  type Rating,
  type Recipe,
  type State,
  type Status,
  type Store,
  type Tag,
  type Travels,
} from "./types";

// Everything worked out rather than stored (DESIGN.md §4.1): reverse links, preferred products,
// staple suggestions, the + search and the Eat list. Built once per state; cheap at personal size.

export type Eatable = { kind: "recipes"; item: Recipe } | { kind: "products"; item: Product };

const live = <T extends { deleted: boolean }>(rec: Record<Id, T>) => Object.values(rec).filter((x) => !x.deleted);
const byName = (a: { name: string }, b: { name: string }) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" });

/** ❤️ first, then 👍, then not rated, then 👎. */
export const RATING_RANK: Record<string, number> = { love: 0, up: 1, none: 2, down: 3 };
export const ratingRank = (r: Rating | null) => RATING_RANK[r ?? "none"]!;
export const byRating = <T extends { rating: Rating | null; name: string }>(a: T, b: T) =>
  ratingRank(a.rating) - ratingRank(b.rating) || byName(a, b);

export class View {
  readonly foods: Food[];
  readonly products: Product[];
  readonly stores: Store[];
  readonly recipes: Recipe[];
  readonly tags: Tag[];
  readonly groceries: GroceryItem[];
  private readonly foodByKey = new Map<string, Food>();
  private readonly productsByFood = new Map<Id, Product[]>();
  private readonly productsByStore = new Map<Id, Product[]>();
  private readonly recipesByFood = new Map<Id, Recipe[]>();
  private readonly childrenOf = new Map<Id, Food[]>();
  private readonly formsOf = new Map<Id, Food[]>();
  private readonly logByItem = new Map<Id, LogEntry[]>();

  constructor(readonly state: State) {
    this.foods = live(state.foods).sort(byName);
    this.products = live(state.products).sort(byName);
    this.stores = live(state.stores).sort(byName);
    this.recipes = live(state.recipes).sort(byName);
    this.tags = live(state.tags).sort((a, b) => (a.kind === b.kind ? (a.kind === "meal" ? 0 : byName(a, b)) : a.kind === "meal" ? -1 : 1));

    const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
      const list = m.get(k);
      if (list) list.push(v);
      else m.set(k, [v]);
    };
    for (const f of this.foods) {
      const key = nameKey(f.name);
      if (!this.foodByKey.has(key)) this.foodByKey.set(key, f);
      if (f.parentId) push(this.childrenOf, f.parentId, f);
      if (f.formOfId) push(this.formsOf, f.formOfId, f);
    }
    for (const p of this.products) {
      if (p.foodId) push(this.productsByFood, p.foodId, p);
      for (const s of p.storeIds) push(this.productsByStore, s, p);
    }
    for (const list of this.productsByFood.values()) list.sort(byRating);
    for (const list of this.productsByStore.values()) list.sort(byRating);
    for (const r of this.recipes) {
      for (const id of new Set(r.ingredients.map((i) => i.foodId).filter((x): x is Id => !!x))) push(this.recipesByFood, id, r);
    }
    this.groceries = live(state.groceries ?? {}).sort(byName);
    for (const e of live(state.log)) push(this.logByItem, e.itemId, e);
    for (const list of this.logByItem.values()) list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  food = (id: Id | null | undefined) => (id ? this.state.foods[id] : undefined);
  store = (id: Id) => this.state.stores[id];
  tag = (id: Id) => this.state.tags[id];

  /** The live food with this name (plurals and case ignored). */
  findFood = (name: string) => this.foodByKey.get(nameKey(name));
  findStore = (name: string) => this.stores.find((s) => nameKey(s.name) === nameKey(name));
  findTag = (name: string) => this.tags.find((t) => nameKey(t.name) === nameKey(name));

  productsOf = (foodId: Id) => this.productsByFood.get(foodId) ?? [];
  productsAt = (storeId: Id) => this.productsByStore.get(storeId) ?? [];
  childrenOfFood = (foodId: Id) => this.childrenOf.get(foodId) ?? [];
  formsOfFood = (foodId: Id) => this.formsOf.get(foodId) ?? [];
  recipesUsing = (foodId: Id) => this.recipesByFood.get(foodId) ?? [];
  logOf = (itemId: Id) => this.logByItem.get(itemId) ?? [];

  // ---- what the log says (DESIGN.md §5.4): times made, last bought ----

  /** How many times it was made / eaten / bought, and the latest date (YYYY-MM-DD). */
  done(itemId: Id, kind: "made" | "ate" | "bought"): { count: number; last: string | null } {
    const es = this.logOf(itemId).filter((e) => e.kind === kind); // newest first
    return { count: es.length, last: es[0]?.date ?? null };
  }

  /**
   * The last time this food (or a kind of it) was bought: a product's `bought` entry, or the
   * food itself checked off the grocery list. `product` says which, when it was a product.
   */
  lastBought(foodId: Id): { date: string; product: Product | null } | null {
    const foods = [foodId, ...this.descendants(foodId, "children").map((f) => f.id)];
    let best: { date: string; product: Product | null } | null = null;
    for (const id of foods) {
      for (const p of this.productsOf(id)) {
        const last = this.done(p.id, "bought").last;
        if (last && (!best || last > best.date)) best = { date: last, product: p };
      }
      for (const g of this.groceries) {
        if (g.foodId !== id || g.productId || !g.gotAt) continue;
        const date = today(new Date(g.gotAt));
        if (!best || date > best.date) best = { date, product: null };
      }
    }
    return best;
  }

  /** The live foods, products and recipes with this tag. */
  tagged(tagId: Id): { kind: "foods" | "products" | "recipes"; item: Food | Product | Recipe }[] {
    return [
      ...this.foods.filter((f) => f.tagIds.includes(tagId)).map((item) => ({ kind: "foods" as const, item })),
      ...this.products.filter((p) => p.tagIds.includes(tagId)).map((item) => ({ kind: "products" as const, item })),
      ...this.recipes.filter((r) => r.tagIds.includes(tagId)).map((item) => ({ kind: "recipes" as const, item })),
    ];
  }

  /** Recipes using any of this food's forms (Lemon → recipes with lemon juice), not the food itself. */
  recipesUsingForms(foodId: Id): Recipe[] {
    const direct = new Set(this.recipesUsing(foodId).map((r) => r.id));
    const out = new Map<Id, Recipe>();
    for (const form of this.descendants(foodId, "forms")) {
      for (const r of this.recipesUsing(form.id)) if (!direct.has(r.id)) out.set(r.id, r);
    }
    return [...out.values()].sort(byName);
  }

  /** The best product of a food: ❤️ else 👍 (not 👎 or unrated). */
  preferredProduct(foodId: Id): Product | undefined {
    const best = this.productsOf(foodId)[0];
    return best && (best.rating === "love" || best.rating === "up") ? best : undefined;
  }

  /** The words typed after this food in recipes ("diced", "zested"), most used first. */
  prepsOf(foodId: Id): string[] {
    const n = new Map<string, number>();
    for (const r of this.recipesUsing(foodId)) {
      for (const i of r.ingredients) if (i.foodId === foodId && i.prep) n.set(i.prep.toLowerCase(), (n.get(i.prep.toLowerCase()) ?? 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }

  /** Produce, Fruit or Vegetable, or a kind of one (is a, not form of: lemon juice has no PLU). */
  isProduce(foodId: Id): boolean {
    const seen = new Set<Id>();
    for (let f = this.food(foodId); f && !seen.has(f.id); f = this.food(f.parentId)) {
      if (PRODUCE.has(nameKey(f.name))) return true;
      seen.add(f.id);
    }
    return false;
  }

  /** Parents (is a) and what it's a form of, all the way up. Lemon juice → Lemon → Citrus → Fruit. */
  ancestors(foodId: Id): Food[] {
    const out: Food[] = [];
    const seen = new Set<Id>([foodId]);
    const queue = [foodId];
    while (queue.length) {
      const f = this.food(queue.shift());
      for (const up of [f?.parentId, f?.formOfId]) {
        const p = this.food(up);
        if (p && !p.deleted && !seen.has(p.id)) {
          seen.add(p.id);
          out.push(p);
          queue.push(p.id);
        }
      }
    }
    return out;
  }

  /**
   * Every food as a tree for browsing (DESIGN.md §5.3): kinds under what they are; a form under
   * what it's a form of when it isn't a kind of anything (Lemon juice under Lemon). Siblings by
   * name. `total` counts the products of the food and everything under it.
   */
  foodTree(): FoodNode[] {
    const kids = new Map<Id | null, Food[]>();
    const form = new Set<Id>();
    for (const f of this.foods) {
      const [up, isForm] = this.placed(f);
      if (isForm) form.add(f.id);
      kids.set(up, [...(kids.get(up) ?? []), f]);
    }
    const seen = new Set<Id>();
    const build = (f: Food): FoodNode => {
      seen.add(f.id);
      const under = (kids.get(f.id) ?? []).filter((k) => !seen.has(k.id)).map(build);
      return { food: f, form: form.has(f.id), kids: under, total: this.productsOf(f.id).length + under.reduce((n, k) => n + k.total, 0) };
    };
    const roots = (kids.get(null) ?? []).map(build);
    // A loop the server should have refused still shows up, at the top.
    for (const f of this.foods) if (!seen.has(f.id)) roots.push(build(f));
    return roots;
  }

  /** Where a food hangs in the tree: what it is, else what it's a form of (then `true`), else the top. */
  private placed(f: Food): [Id | null, boolean] {
    const live = (id: Id | null) => !!id && !!this.food(id) && !this.food(id)!.deleted;
    if (live(f.parentId)) return [f.parentId, false];
    if (live(f.formOfId)) return [f.formOfId, true];
    return [null, false];
  }

  /**
   * The food and what it hangs under, top first, as in the tree: Canned and jarred goods ›
   * Pickles › Baby pickles. Sorting products by it keeps every pickle together.
   */
  foodPath(foodId: Id | null): Food[] {
    const out: Food[] = [];
    const seen = new Set<Id>();
    for (let f = this.food(foodId); f && !seen.has(f.id); f = this.food(this.placed(f)[0])) {
      seen.add(f.id);
      out.unshift(f);
    }
    return out;
  }

  /** Everything below a food through children, forms, or both. */
  descendants(foodId: Id, via: "children" | "forms" | "both" = "both"): Food[] {
    const out: Food[] = [];
    const seen = new Set<Id>([foodId]);
    const queue = [foodId];
    while (queue.length) {
      const id = queue.shift()!;
      const next = [
        ...(via !== "forms" ? this.childrenOfFood(id) : []),
        ...(via !== "children" ? this.formsOfFood(id) : []),
      ];
      for (const f of next) {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          out.push(f);
          queue.push(f.id);
        }
      }
    }
    return out;
  }

  /** Would setting `foodId`'s parent / form-of to `targetId` make a loop? */
  wouldLoop(foodId: Id, targetId: Id): boolean {
    return targetId === foodId || this.ancestors(targetId).some((f) => f.id === foodId);
  }

  /** Recipe card line: "Ham · American cheese · tomato · GF bread". */
  ingredientSummary(r: Recipe): string {
    return r.ingredients
      .filter((i) => !i.optional)
      .map((i) => this.food(i.foodId)?.name ?? i.line)
      .filter(Boolean)
      .join(" · ");
  }

  eatables(): Eatable[] {
    return [
      ...this.recipes.map((item) => ({ kind: "recipes" as const, item })),
      ...this.products.map((item) => ({ kind: "products" as const, item })),
    ];
  }

  /** Staples (DESIGN.md §4.7). */
  staples(): Food[] {
    return this.foods.filter((f) => f.staple);
  }

  /**
   * Foods that aren't staples but are in 2+ recipes I like (👍 / ❤️) or have made, counting a
   * recipe that uses one of the food's forms or kinds toward it too.
   */
  stapleSuggestions(min = 2): { food: Food; recipes: Recipe[] }[] {
    const liked = this.recipes.filter(
      (r) => r.rating === "love" || r.rating === "up" || this.logOf(r.id).some((e) => e.kind === "made"),
    );
    const counts = new Map<Id, Set<Id>>();
    for (const r of liked) {
      for (const i of r.ingredients) {
        if (!i.foodId || i.optional) continue;
        for (const f of [this.food(i.foodId), ...this.ancestors(i.foodId)]) {
          if (!f || f.deleted) continue;
          let s = counts.get(f.id);
          if (!s) counts.set(f.id, (s = new Set()));
          s.add(r.id);
        }
      }
    }
    return [...counts.entries()]
      .map(([id, rs]) => ({ food: this.state.foods[id]!, recipes: [...rs].map((r) => this.state.recipes[r]!) }))
      .filter((x) => !x.food.staple && x.recipes.length >= min)
      .sort((a, b) => b.recipes.length - a.recipes.length || byName(a.food, b.food));
  }

  /** The standing list: each staple with its preferred product, grouped by where that's sold. */
  stapleList(): { store: Store | null; items: { food: Food; product?: Product }[] }[] {
    const groups = new Map<Id | "", { food: Food; product?: Product }[]>();
    for (const food of this.staples()) {
      const product = this.preferredProduct(food.id);
      const stores = product?.storeIds.filter((s) => this.store(s) && !this.store(s)!.deleted) ?? [];
      for (const s of stores.length ? stores : [""]) {
        const list = groups.get(s) ?? [];
        list.push({ food, product });
        groups.set(s, list);
      }
    }
    return [...groups.entries()]
      .map(([s, items]) => ({ store: s ? this.store(s)! : null, items }))
      .sort((a, b) => (!a.store ? 1 : !b.store ? -1 : byName(a.store, b.store)));
  }

  // ---- groceries (DESIGN.md §4.10, §5.8) ----

  /** The grocery item for this name, product or food, if I've ever had one. */
  findGrocery(by: { name?: string; productId?: Id | null; foodId?: Id | null }): GroceryItem | undefined {
    if (by.productId) {
      const g = this.groceries.find((x) => x.productId === by.productId);
      if (g) return g;
    }
    // A food's item ("Butter") stands for any of its products, until one is picked for it.
    if (by.foodId) {
      const g = this.groceries.find((x) => x.foodId === by.foodId && !x.productId);
      if (g) return g;
    }
    const key = by.name ? nameKey(by.name) : "";
    return key ? this.groceries.find((x) => nameKey(x.name) === key) : undefined;
  }

  /** On the list, in the order it went on. */
  groceryList(): GroceryItem[] {
    return this.groceries.filter((g) => g.need).sort((a, b) => (a.neededAt ?? 0) - (b.neededAt ?? 0));
  }

  /** Checked off this trip (not Done shopping yet, and since `since`), in the order got. */
  groceryTrip(since: number): GroceryItem[] {
    return this.groceries.filter((g) => inTrip(g, since)).sort((a, b) => (a.gotAt ?? 0) - (b.gotAt ?? 0));
  }

  /**
   * Usual: what I buy that isn't on the list (or this trip), most bought first, then staples
   * I haven't put on it yet.
   */
  groceryUsual(since: number): GroceryUsual[] {
    const items = this.groceries
      .filter((g) => !g.need && !inTrip(g, since))
      .sort((a, b) => b.count - a.count || byName(a, b))
      .map((item) => ({ name: item.name, item }));
    const staples = this.staples()
      .filter((f) => !this.findGrocery({ foodId: f.id, name: f.name }))
      .map((food) => ({ name: food.name, food }));
    return [...items, ...staples];
  }

  /** Where an item is sold: its product's stores, or the food's preferred product's. */
  groceryStores(g: GroceryItem): Store[] {
    const p = (g.productId && this.state.products[g.productId]) || (g.foodId ? this.preferredProduct(g.foodId) : undefined);
    if (!p || p.deleted) return [];
    return p.storeIds.map((s) => this.store(s)).filter((s): s is Store => !!s && !s.deleted);
  }

  /** As I type in the add box: Usual first, then foods and products I haven't bought yet. */
  groceryMatches(text: string, since: number, limit = 12): GroceryUsual[] {
    const t = norm(text);
    if (!t) return [];
    const hit = (name: string) => norm(name).includes(t);
    const usual = this.groceryUsual(since).filter((u) => hit(u.name));
    const taken = (by: Parameters<View["findGrocery"]>[0]) => !!this.findGrocery(by);
    const foods = this.foods.filter((f) => hit(f.name) && !taken({ foodId: f.id, name: f.name })).map((food) => ({ name: food.name, food }));
    const products = this.products
      .filter((p) => p.rating !== "down" && hit(nameOf(p)) && !taken({ productId: p.id, name: nameOf(p) }))
      .map((product) => ({ name: nameOf(product), product }));
    const seen = new Set(usual.map((u) => nameKey(u.name)));
    const rest = [...foods, ...products].filter((x) => !seen.has(nameKey(x.name)) && (seen.add(nameKey(x.name)), true));
    return [...usual, ...rest].slice(0, limit);
  }

  // ---- search (DESIGN.md §5.1) ----

  /**
   * The tags a thing gets from the foods it's a kind of (DESIGN.md §5.1), nearest first, each
   * with the food it comes from; not the ones it has itself. A food passes its own id (it's
   * skipped), a product its food's (that food's tags count too).
   */
  inheritedTags(foodId: Id | null, own: Id[], skipFirst: boolean): { tag: Tag; from: Food }[] {
    const out: { tag: Tag; from: Food }[] = [];
    const seen = new Set(own);
    for (const from of this.kindsUp(foodId).slice(skipFirst ? 1 : 0)) {
      for (const t of from.tagIds) {
        const tag = this.tag(t);
        if (tag && !tag.deleted && !seen.has(t)) {
          seen.add(t);
          out.push({ tag, from });
        }
      }
    }
    return out;
  }

  /** The food and what it is, up the "is a" links only (not form of): Diet soda → Soda → Drink. */
  private kindsUp(foodId: Id | null): Food[] {
    const out: Food[] = [];
    const seen = new Set<Id>();
    for (let f = this.food(foodId); f && !f.deleted && !seen.has(f.id); f = this.food(f.parentId)) {
      seen.add(f.id);
      out.push(f);
    }
    return out;
  }

  /** The words a thing can be found by, lowercased. */
  private haystack(kind: SearchKind, x: Food | Product | Recipe | Store): string[] {
    const out: string[] = [x.name];
    const foodWords = (id: Id | null) => {
      const f = this.food(id);
      if (!f || f.deleted) return;
      out.push(f.name, ...this.ancestors(f.id).map((a) => a.name));
    };
    const tagWords = (ids: Id[]) => {
      for (const t of ids) {
        const tag = this.tag(t);
        if (tag && !tag.deleted) out.push(tag.name);
      }
    };
    // A tag on a food counts for its kinds and their products ("drink" on Soda finds Diet soda
    // and every soda bought), down the "is a" links only. Not for recipes: a recipe with beer
    // in it isn't a drink.
    const kindTags = (foodId: Id | null) => {
      for (const f of this.kindsUp(foodId)) tagWords(f.tagIds);
    };
    if (kind === "foods") {
      const f = x as Food;
      out.push(f.notes, f.plu, ...this.ancestors(f.id).map((a) => a.name));
      kindTags(f.id);
      if (f.staple) out.push("staple");
    } else if (kind === "products") {
      const p = x as Product;
      out.push(nameOf(p), p.brand, p.notes, GF_LABEL[p.glutenFree]);
      foodWords(p.foodId);
      tagWords(p.tagIds);
      kindTags(p.foodId);
      for (const s of p.storeIds) if (this.store(s) && !this.store(s)!.deleted) out.push(this.store(s)!.name);
    } else if (kind === "recipes") {
      const r = x as Recipe;
      out.push(r.notes, r.instructions);
      for (const i of r.ingredients) {
        out.push(i.line);
        foodWords(i.foodId);
      }
      tagWords(r.tagIds);
    } else {
      out.push((x as Store).notes);
    }
    if (kind === "products" || kind === "recipes") for (const e of this.logOf(x.id)) out.push(e.text);
    return out.filter(Boolean).map(norm);
  }

  /**
   * "breakfast + lemon + potato": every term must match. Things matching only some terms come
   * back as partial matches, most terms first.
   */
  search(query: string): SearchResults {
    const terms = parseQuery(query);
    const empty: SearchResults = { terms, full: emptyGroups(), partial: emptyGroups(), count: 0 };
    if (!terms.length) return empty;
    const consider = <K extends SearchKind>(kind: K, list: SearchItem<K>[]) => {
      for (const item of list) {
        const hay = this.haystack(kind, item);
        const hits = terms.filter((t) => hay.some((h) => termMatches(h, t))).length;
        if (!hits) continue;
        const hit = { kind, item, hits } as SearchHit;
        if (hits === terms.length) empty.full[kind].push(hit as never);
        else empty.partial[kind].push(hit as never);
      }
    };
    consider("recipes", this.recipes);
    consider("products", this.products);
    consider("foods", this.foods);
    consider("stores", this.stores);
    for (const g of [empty.full, empty.partial]) {
      for (const k of SEARCH_KINDS) {
        (g[k] as SearchHit[]).sort((a, b) => {
          const ra = "rating" in a.item ? ratingRank(a.item.rating) : 2;
          const rb = "rating" in b.item ? ratingRank(b.item.rating) : 2;
          // Exact name matches first, then most terms, then rating, then name.
          const ea = norm(nameOf(a.item)) === terms.join(" ") || norm(a.item.name) === terms.join(" ") ? 0 : 1;
          const eb = norm(nameOf(b.item)) === terms.join(" ") || norm(b.item.name) === terms.join(" ") ? 0 : 1;
          return ea - eb || b.hits - a.hits || ra - rb || byName(a.item, b.item);
        });
      }
    }
    empty.count = SEARCH_KINDS.reduce((n, k) => n + empty.full[k].length, 0);
    return empty;
  }

  /** Every brand used, for suggestions. */
  brands(): string[] {
    const seen = new Map<string, string>();
    for (const p of this.products) if (p.brand && !seen.has(p.brand.toLowerCase())) seen.set(p.brand.toLowerCase(), p.brand);
    return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  /** The Eat list (DESIGN.md §5.2). Never what isn't gluten-free: that's someone else's. */
  eat(f: EatFilter): Eatable[] {
    return this.eatables()
      .filter(({ item }) => {
        if (item.glutenFree === "no") return false;
        if (f.tagId && !item.tagIds.includes(f.tagId)) return false;
        if (!f.showDown && item.rating === "down") return false;
        if (f.status && item.status !== f.status) return false;
        if (f.travels?.length && (!item.travels || !f.travels.includes(item.travels))) return false;
        if (f.minKeepsDays && (item.keepsDays ?? 0) < f.minKeepsDays) return false;
        if (f.effort?.length && (!item.effort || !f.effort.includes(item.effort))) return false;
        return true;
      })
      .sort((a, b) => byRating(a.item, b.item));
  }

  /** Recently changed things, for the empty search page. */
  recent(n = 12): ({ kind: SearchKind; item: Food | Product | Recipe | Store })[] {
    const all = [
      ...this.recipes.map((item) => ({ kind: "recipes" as const, item })),
      ...this.products.map((item) => ({ kind: "products" as const, item })),
      ...this.foods.map((item) => ({ kind: "foods" as const, item })),
      ...this.stores.map((item) => ({ kind: "stores" as const, item })),
    ];
    return all.sort((a, b) => b.item.updatedAt - a.item.updatedAt).slice(0, n);
  }
}

/** One tap from the list: an item I've had before, or a staple / food / product to make one from. */
const inTrip = (g: GroceryItem, since: number) => !g.need && g.inTrip && (g.gotAt ?? 0) >= since;

const PRODUCE = new Set(["produce", "fruit", "vegetable"]);

export type FoodNode = { food: Food; form: boolean; kids: FoodNode[]; total: number };
export type GroceryUsual ={ name: string; item?: GroceryItem; food?: Food; product?: Product };

/** A tag list with `from` swapped for `to` (merge) or dropped (`to` null, delete); no repeats. */
export function swapTag(tagIds: Id[], from: Id, to: Id | null): Id[] {
  const out: Id[] = [];
  for (const t of tagIds) {
    const x = t === from ? to : t;
    if (x && !out.includes(x)) out.push(x);
  }
  return out;
}

export const isWorkLunch = (tagIds: Id[]) => tagIds.includes(WORK_LUNCH);

export interface EatFilter {
  tagId?: Id | null;
  status?: Status | null;
  travels?: Travels[];
  minKeepsDays?: number | null;
  effort?: Effort[];
  showDown?: boolean;
}

export const SEARCH_KINDS = ["recipes", "products", "foods", "stores"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
type SearchItem<K extends SearchKind> = K extends "recipes" ? Recipe : K extends "products" ? Product : K extends "foods" ? Food : Store;
export type SearchHit = { [K in SearchKind]: { kind: K; item: SearchItem<K>; hits: number } }[SearchKind];
export type SearchGroups = { [K in SearchKind]: Extract<SearchHit, { kind: K }>[] };
export interface SearchResults {
  terms: string[];
  full: SearchGroups;
  partial: SearchGroups;
  /** How many full matches. */
  count: number;
}
const emptyGroups = (): SearchGroups => ({ recipes: [], products: [], foods: [], stores: [] });

/** Lowercase, letters/digits/spaces only, each word singular (so "potatoes" finds "potato"). */
function norm(s: string): string {
  return nameKey(s);
}

/** "Breakfast + lemon  +potato" → ["breakfast", "lemon", "potato"]. */
export function parseQuery(q: string): string[] {
  return q
    .split("+")
    .map((t) => norm(t))
    .filter(Boolean);
}

/** Does the term appear in the text at the start of a word? ("ham" finds "ham", not "graham"). */
function termMatches(hay: string, term: string): boolean {
  if (hay === term) return true;
  let i = hay.indexOf(term);
  while (i >= 0) {
    if (i === 0 || hay[i - 1] === " ") return true;
    i = hay.indexOf(term, i + 1);
  }
  return false;
}
