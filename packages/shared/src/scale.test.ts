import { describe, expect, it } from "vitest";
import { scaleAmount, scaleLine, yieldText } from "./scale";

describe("scaleAmount", () => {
  it("rounds spoons to sizes the set has", () => {
    expect(scaleAmount(1.5, "tsp", 1 / 3)).toEqual({ text: "½ tsp", approx: false });
    expect(scaleAmount(1, "tsp", 1 / 3)).toEqual({ text: "¼ tsp", approx: true });
    expect(scaleAmount(1, "tsp", 1 / 2).text).toBe("½ tsp");
    expect(scaleAmount(1, "tsp", 1 / 2).approx).toBe(false);
  });
  it("never says 3/32 tsp", () => {
    expect(scaleAmount(0.375, "tsp", 1 / 4).text).toBe("⅛ tsp");
    expect(scaleAmount(0.25, "tsp", 1 / 4)).toEqual({ text: "a pinch", approx: true });
  });
  it("moves between teaspoons, tablespoons and cups", () => {
    expect(scaleAmount(0.25, "cup", 1 / 4).text).toBe("1 tbsp");
    expect(scaleAmount(2, "tbsp", 2 / 3).text).toBe("1 tbsp + 1 tsp");
    expect(scaleAmount(1, "tbsp", 1 / 2).text).toBe("1½ tsp");
    expect(scaleAmount(3, "tbsp", 1 / 2).text).toBe("1½ tbsp");
    expect(scaleAmount(4, "tbsp", 2).text).toBe("½ cup");
    expect(scaleAmount(2, "cup", 1 / 3).text).toBe("⅔ cup");
  });
  it("pounds and ounces", () => {
    expect(scaleAmount(1, "lb", 1 / 4)).toEqual({ text: "4 oz", approx: false });
    expect(scaleAmount(2, "lb", 3 / 4).text).toBe("1½ lb");
  });
  it("counted things in halves", () => {
    expect(scaleAmount(3, "", 1 / 4)).toEqual({ text: "1", approx: true });
    expect(scaleAmount(2, "clove", 1 / 4).text).toBe("½ clove");
    expect(scaleAmount(1, "can", 1 / 4).text).toBe("¼ can");
    expect(scaleAmount(1, "pinch", 1 / 4).text).toBe("1 pinch");
  });
});

describe("scaleLine", () => {
  it("swaps only the amount", () => {
    expect(scaleLine("1½ cups cooked rice, rinsed", 1 / 2)).toEqual({ before: "", amount: "¾ cup", after: " cooked rice, rinsed", approx: false });
    expect(scaleLine("2 large eggs", 1 / 2)).toMatchObject({ amount: "1", after: " large eggs" });
    expect(scaleLine("2 eggs", 1 / 4)).toMatchObject({ amount: "½", after: " egg" });
    expect(scaleLine("- 1/4 tsp salt", 2)).toMatchObject({ before: "- ", amount: "½ tsp", after: " salt" });
  });
  it("leaves lines without a number", () => {
    expect(scaleLine("Salt to taste", 1 / 2)).toBeNull();
    expect(scaleLine("a pinch of salt", 1 / 2)).toBeNull();
  });
  it("scales both ends of a range", () => {
    expect(scaleLine("2-3 tbsp olive oil", 1 / 2)?.amount).toBe("1–1½ tbsp");
  });
});

describe("yieldText", () => {
  it("one serving, two loaves", () => {
    expect(yieldText(1, "servings", 4)).toBe("1 serving");
    expect(yieldText(2, "loaf", 1)).toBe("2 loaves");
    expect(yieldText(2, "servings", 4)).toBe("2 servings");
  });
});
