import { describe, expect, it } from "vitest";
import { DEFAULT_SLOTS, mealNow } from "./mealTimes";

describe("mealNow", () => {
  const at = (h: number, m = 0) => mealNow(DEFAULT_SLOTS, new Date(2026, 9, 25, h, m));
  it("picks the slot that has started", () => {
    expect(at(4)).toBe("meal-breakfast");
    expect(at(10, 29)).toBe("meal-breakfast");
    expect(at(10, 30)).toBe("meal-work-lunch");
    expect(at(18)).toBe("meal-dinner");
    expect(at(23, 30)).toBe("meal-snack");
  });
  it("runs the last slot past midnight", () => {
    expect(at(0)).toBe("meal-snack");
    expect(at(3, 59)).toBe("meal-snack");
  });
  it("doesn't mind the order they're in", () => {
    expect(mealNow([...DEFAULT_SLOTS].reverse(), new Date(2026, 9, 25, 12))).toBe("meal-work-lunch");
  });
});
