import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blank, Invalid, WORK_LUNCH } from "@foodlab/shared";
import { loadState, openDb, type DB } from "./db";
import { Store } from "./store";

let dir: string;
let db: DB;
let store: Store;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foodlab-"));
  db = openDb(join(dir, "t.db"));
  store = new Store(db);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("Store", () => {
  it("starts with the meal tags", () => {
    expect(store.state.tags[WORK_LUNCH]?.name).toBe("Work lunch");
  });

  it("saves whole records with their links, and reads them back the same", () => {
    store.put("foods", "lemon", blank.foods("lemon", "Lemon"));
    store.put("foods", "juice", { ...blank.foods("juice", "Lemon juice"), formOfId: "lemon" });
    store.put("stores", "weg", blank.stores("weg", "Wegmans"));
    store.put("products", "sc", {
      ...blank.products("sc", "Santa Cruz Organic"),
      foodId: "juice",
      storeIds: ["weg"],
      tagIds: [WORK_LUNCH],
      links: ["https://example.com"],
      keepsDays: 3,
    });
    store.put("recipes", "lc", {
      ...blank.recipes("lc", "Lemon chicken"),
      ingredients: [
        { id: "a", line: "2 tbsp lemon juice", foodId: "juice", quantity: 2, unit: "tbsp", prep: "", optional: false, note: "" },
        { id: "b", line: "1 lemon, zested", foodId: "lemon", quantity: 1, unit: "", prep: "zested", optional: true, note: "" },
      ],
    });
    const again = loadState(db);
    expect(again.products.sc).toEqual(store.state.products.sc);
    expect(again.recipes.lc).toEqual(store.state.recipes.lc);
    expect(again.foods.juice?.formOfId).toBe("lemon");
    expect(again.rev).toBe(store.rev);
  });

  it("refuses links to nothing and loops", () => {
    expect(() => store.put("products", "p", { ...blank.products("p", "X"), foodId: "nope" })).toThrow(Invalid);
    store.put("foods", "a", blank.foods("a", "A"));
    store.put("foods", "b", { ...blank.foods("b", "B"), parentId: "a" });
    expect(() => store.put("foods", "a", { ...blank.foods("a", "A"), formOfId: "b" })).toThrow(/itself/);
    expect(() => store.put("tags", WORK_LUNCH, { name: "Lunchies", kind: "meal" })).toThrow(/fixed/);
    expect(() => store.put("foods", "c", { name: "  " })).toThrow(/required/);
  });

  it("logs rating changes by itself", () => {
    store.put("products", "p", { ...blank.products("p", "Kraft"), rating: "up" });
    store.put("products", "p", { ...blank.products("p", "Kraft"), rating: "up", notes: "same rating" });
    store.put("products", "p", { ...blank.products("p", "Kraft"), rating: "down" });
    const log = Object.values(store.state.log).sort((a, b) => a.rev - b.rev);
    expect(log.map((e) => [e.kind, e.rating, e.text])).toEqual([
      ["rating", "up", "Rated 👍"],
      ["rating", "down", "👍 → 👎"],
    ]);
  });

  it("keeps createdAt and bumps rev each save", () => {
    const first = store.put("stores", "s", blank.stores("s", "MB", 1000), 5000);
    const second = store.put("stores", "s", { ...first.record, name: "Market Basket", createdAt: 99 }, 6000);
    expect(second.record.createdAt).toBe(1000); // when the device made it, not when it arrived
    expect(second.rev).toBe(first.rev + 1);
  });
});
