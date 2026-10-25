import { describe, expect, it } from "vitest";
import { View } from "./derive";
import { blank, emptyState, MEAL_TAGS, productName, withoutBrand, WORK_LUNCH, type Food, type GroceryItem, type Product, type Recipe, type State } from "./types";

// A small world: Lemon → Lemon juice (form) → Santa Cruz (product, Wegmans); Meat → Chicken thigh.
function world(): State {
  const s = emptyState();
  for (const t of MEAL_TAGS) s.tags[t.id] = { ...blank.tags(t.id, t.name), kind: "meal" };
  const food = (id: string, name: string, extra: Partial<Food> = {}) => (s.foods[id] = { ...blank.foods(id, name), ...extra });
  food("fruit", "Fruit");
  food("lemon", "Lemon", { parentId: "fruit" });
  food("juice", "Lemon juice", { formOfId: "lemon" });
  food("meat", "Meat");
  food("thigh", "Chicken thigh", { parentId: "meat" });
  food("potato", "Potato");
  food("garlic", "Garlic");
  food("butter", "Butter", { staple: true });
  s.stores.weg = blank.stores("weg", "Wegmans");
  s.stores.mb = blank.stores("mb", "Market Basket");
  const product = (id: string, name: string, extra: Partial<Product> = {}) =>
    (s.products[id] = { ...blank.products(id, name), ...extra });
  product("sc", "Santa Cruz Organic Lemon Juice", { foodId: "juice", storeIds: ["weg"], rating: "love" });
  product("bx", "Brand X lemon juice", { foodId: "juice", storeIds: ["mb"], rating: "down" });
  product("kerry", "Kerrygold butter", { foodId: "butter", storeIds: ["weg", "mb"], rating: "up" });
  product("bowl", "Wegmans chicken bowl", { storeIds: ["weg"], tagIds: [WORK_LUNCH], travels: "microwave", keepsDays: 3, effort: "grab", rating: "up" });
  const ing = (foodId: string, line: string, prep = "") => ({ id: line, line, foodId, quantity: 1, unit: "", prep, optional: false, note: "" });
  const recipe = (id: string, name: string, extra: Partial<Recipe> = {}) => (s.recipes[id] = { ...blank.recipes(id, name), ...extra });
  recipe("lc", "Lemon chicken", {
    rating: "love",
    tagIds: ["meal-dinner", WORK_LUNCH],
    travels: "microwave",
    keepsDays: 4,
    effort: "prep",
    ingredients: [ing("thigh", "4 chicken thighs"), ing("juice", "2 tbsp lemon juice"), ing("garlic", "3 cloves garlic", "minced")],
  });
  recipe("hash", "Breakfast hash", {
    rating: "up",
    tagIds: ["meal-breakfast"],
    ingredients: [ing("potato", "2 potatoes", "diced"), ing("lemon", "1 lemon", "zested"), ing("thigh", "1 chicken thigh"), ing("garlic", "garlic")],
  });
  recipe("bad", "Sad salad", { rating: "down", tagIds: [WORK_LUNCH], travels: "cold", ingredients: [ing("lemon", "lemon")] });
  return s;
}

describe("View", () => {
  const v = new View(world());

  it("follows is-a and form-of upwards", () => {
    expect(v.ancestors("juice").map((f) => f.name)).toEqual(["Lemon", "Fruit"]);
  });

  it("finds the preferred product (not a 👎 one)", () => {
    expect(v.preferredProduct("juice")?.id).toBe("sc");
    expect(v.productsOf("juice").map((p) => p.id)).toEqual(["sc", "bx"]);
  });

  it("lists recipes using a food's forms", () => {
    expect(v.recipesUsing("lemon").map((r) => r.id).sort()).toEqual(["bad", "hash"]);
    expect(v.recipesUsingForms("lemon").map((r) => r.id)).toEqual(["lc"]);
    expect(v.prepsOf("lemon")).toEqual(["zested"]);
  });

  it("refuses loops", () => {
    expect(v.wouldLoop("fruit", "juice")).toBe(true);
    expect(v.wouldLoop("juice", "meat")).toBe(false);
  });

  it("matches every + term, through ingredients, parents and tags", () => {
    const r = v.search("breakfast + lemon + meat + potato");
    expect(r.terms).toEqual(["breakfast", "lemon", "meat", "potato"]);
    expect(r.full.recipes.map((h) => h.item.id)).toEqual(["hash"]);
    // Lemon chicken has lemon (via lemon juice) and meat, but no potato or breakfast.
    expect(r.partial.recipes.map((h) => h.item.id)).toContain("lc");
  });

  it("finds products by store and plural", () => {
    expect(v.search("wegmans").full.products.map((h) => h.item.id)).toEqual(["sc", "kerry", "bowl"]);
    expect(v.search("potatoes").full.foods.map((h) => h.item.id)).toEqual(["potato"]);
    expect(v.search("ham").full.recipes).toEqual([]);
  });

  it("builds the Eat list for work lunch", () => {
    const all = v.eat({ tagId: WORK_LUNCH });
    expect(all.map((e) => e.item.id)).toEqual(["lc", "bowl"]); // ❤️ before 👍; 👎 hidden
    expect(v.eat({ tagId: WORK_LUNCH, showDown: true }).map((e) => e.item.id)).toContain("bad");
    expect(v.eat({ tagId: WORK_LUNCH, effort: ["grab"] }).map((e) => e.item.id)).toEqual(["bowl"]);
    expect(v.eat({ tagId: WORK_LUNCH, minKeepsDays: 4 }).map((e) => e.item.id)).toEqual(["lc"]);
  });

  it("suggests staples from liked recipes", () => {
    const s = v.stapleSuggestions().map((x) => x.food.name);
    expect(s).toContain("Garlic");
    expect(s).toContain("Chicken thigh");
    expect(s).toContain("Lemon"); // zest in one, juice (a form) in the other
    expect(s).not.toContain("Potato"); // only one recipe
    expect(s).not.toContain("Butter"); // already a staple
  });

  it("groups the staple list by store", () => {
    const list = v.stapleList();
    expect(list.map((g) => g.store?.name)).toEqual(["Market Basket", "Wegmans"]);
    expect(list[0]!.items[0]!.product?.id).toBe("kerry");
  });
});

describe("products by brand", () => {
  it("shows the brand first, once", () => {
    expect(productName({ brand: "Bell & Evans", name: "Gluten Free Chicken Breasts" })).toBe("Bell & Evans Gluten Free Chicken Breasts");
    expect(productName({ brand: "Kraft", name: "Kraft Singles" })).toBe("Kraft Singles");
    expect(productName({ brand: "", name: "Eggs" })).toBe("Eggs");
    expect(withoutBrand("Bell & Evans - Nuggets", "bell & evans")).toBe("Nuggets");
    expect(withoutBrand("Krafty cheese", "Kraft")).toBe("Krafty cheese");
  });

  it("finds and sorts products by the whole name; Eat never shows what isn't gluten-free", () => {
    const s = world();
    s.products.be = { ...blank.products("be", "Gluten Free Chicken Breasts"), brand: "Bell & Evans", tagIds: [WORK_LUNCH] };
    s.products.wheat = { ...blank.products("wheat", "Wheat wrap"), glutenFree: "no", tagIds: [WORK_LUNCH] };
    const v = new View(s);
    expect(v.search("bell evans gluten free").full.products.map((h) => h.item.id)).toEqual(["be"]);
    expect(v.products[0]?.id).toBe("be");
    expect(v.brands()).toEqual(["Bell & Evans"]);
    expect(v.eat({ tagId: WORK_LUNCH }).map((e) => e.item.id)).not.toContain("wheat");
  });
});

describe("groceries", () => {
  const T = 1_000_000;
  function shop() {
    const s = world();
    const g = (id: string, name: string, extra: Partial<GroceryItem> = {}) => (s.groceries[id] = { ...blank.groceries(id, name, T), ...extra });
    g("milk", "Milk", { need: false, gotAt: T - 10, count: 9 });
    g("eggs", "Eggs", { neededAt: T + 2 });
    g("bread", "Bread", { neededAt: T + 1 });
    g("juice", "Lemon juice", { foodId: "juice", productId: "sc", need: false, gotAt: T + 50, inTrip: true, count: 2 });
    g("rice", "Rice", { need: false, gotAt: T - 20, count: 3 });
    g("gone", "Gone", { need: false, deleted: true });
    return new View(s);
  }

  it("lists what's needed in the order it went on, and this trip in the order got", () => {
    const v = shop();
    expect(v.groceryList().map((g) => g.id)).toEqual(["bread", "eggs"]);
    expect(v.groceryTrip(T).map((g) => g.id)).toEqual(["juice"]);
  });

  it("Done shopping (on any device) ends the trip: the item joins Usual", () => {
    const v = shop();
    const s = { ...v.state, groceries: { ...v.state.groceries, juice: { ...v.state.groceries.juice!, inTrip: false } } };
    const after = new View(s);
    expect(after.groceryTrip(T)).toEqual([]);
    expect(after.groceryUsual(T).map((u) => u.name)).toContain("Lemon juice");
    expect(v.groceryTrip(T + 100)).toEqual([]); // and on its own, a few hours on
  });

  it("Usual: the rest by times bought, then staples not on it yet", () => {
    const v = shop();
    expect(v.groceryUsual(T).map((u) => u.name)).toEqual(["Milk", "Rice", "Butter"]);
    expect(v.groceryUsual(T)[2]!.food?.staple).toBe(true);
  });

  it("finds an item by product, food or name (plurals ignored), and where it's sold", () => {
    const v = shop();
    expect(v.findGrocery({ name: "lemon juice" })?.id).toBe("juice");
    expect(v.findGrocery({ name: "x", productId: "sc" })?.id).toBe("juice");
    expect(v.findGrocery({ name: "egg" })?.id).toBe("eggs");
    expect(v.findGrocery({ name: "gone" })).toBeUndefined();
    expect(v.groceryStores(v.state.groceries.juice!).map((s) => s.name)).toEqual(["Wegmans"]);
  });

  it("a food's item stands for its products until one is picked", () => {
    const s = world();
    s.groceries.b = { ...blank.groceries("b", "Butter"), foodId: "butter" };
    const v = new View(s);
    expect(v.findGrocery({ name: "Kerrygold Butter", foodId: "butter", productId: "kerry" })?.id).toBe("b");
    expect(v.groceryStores(s.groceries.b!).map((x) => x.name)).toEqual(["Wegmans", "Market Basket"]); // its preferred product's
  });

  it("matches typing against Usual first, then foods and products not yet bought", () => {
    const v = shop();
    expect(v.groceryMatches("ri", T).map((u) => u.name)).toEqual(["Rice"]);
    const lemon = v.groceryMatches("lemon", T);
    expect(lemon.map((u) => u.name)).toEqual(["Lemon"]);
    expect(lemon.some((u) => u.product?.id === "bx")).toBe(false); // 👎 isn't suggested
  });
});
