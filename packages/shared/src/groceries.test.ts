import { describe, expect, it } from "vitest";
import { moveGrocery } from "./groceries";
import { blank, type GroceryItem } from "./types";

const item = (id: string, neededAt: number): GroceryItem => ({ ...blank.groceries(id, id, 0), need: true, neededAt });
const apply = (list: GroceryItem[], moves: { id: string; neededAt: number }[]) =>
  list
    .map((g) => ({ ...g, neededAt: moves.find((m) => m.id === g.id)?.neededAt ?? g.neededAt }))
    .sort((a, b) => a.neededAt! - b.neededAt!)
    .map((g) => g.id);

describe("moveGrocery", () => {
  const list = [item("a", 1000), item("b", 2000), item("c", 3000)];
  const now = 10_000;
  it("moves up, down, to the top and to the end, saving only the moved item", () => {
    expect(apply(list, moveGrocery(list, "c", 0, now))).toEqual(["c", "a", "b"]);
    expect(apply(list, moveGrocery(list, "a", 1, now))).toEqual(["b", "a", "c"]);
    expect(apply(list, moveGrocery(list, "a", 2, now))).toEqual(["b", "c", "a"]);
    expect(moveGrocery(list, "b", 0, now)).toHaveLength(1);
    expect(moveGrocery(list, "c", 0, now)[0]?.neededAt).toBeGreaterThanOrEqual(0);
    expect(moveGrocery(list, "a", 2, now)[0]?.neededAt).toBeLessThanOrEqual(now);
  });
  it("does nothing when it stays put", () => {
    expect(moveGrocery(list, "b", 1, now)).toEqual([]);
  });
  it("respaces when there's no room", () => {
    const tight = [item("a", 1000), item("b", 1001), item("c", 1002)];
    expect(apply(tight, moveGrocery(tight, "c", 1, now))).toEqual(["a", "c", "b"]);
  });
});
