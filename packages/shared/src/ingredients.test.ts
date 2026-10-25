import { describe, expect, it } from "vitest";
import { formatAmount, formatQuantity, ingredientsFromText, nameKey, parseLine } from "./ingredients";

describe("parseLine", () => {
  const cases: [string, Partial<ReturnType<typeof parseLine>>][] = [
    ["2 slices American cheese", { quantity: 2, unit: "slice", food: "American cheese", prep: "" }],
    ["1 lemon, zested", { quantity: 1, unit: "", food: "lemon", prep: "zested" }],
    ["1½ cups cooked rice (optional)", { quantity: 1.5, unit: "cup", food: "cooked rice", optional: true }],
    ["salt, to taste", { quantity: null, unit: "", food: "salt", prep: "to taste" }],
    ["1 1/2 tbsp olive oil", { quantity: 1.5, unit: "tbsp", food: "olive oil" }],
    ["1/2 tsp garlic powder", { quantity: 0.5, unit: "tsp", food: "garlic powder" }],
    ["2 T butter", { quantity: 2, unit: "tbsp", food: "butter" }],
    ["2 t salt", { quantity: 2, unit: "tsp", food: "salt" }],
    ["2 cups of chicken broth", { quantity: 2, unit: "cup", food: "chicken broth" }],
    ["2 large eggs", { quantity: 2, unit: "", food: "eggs", note: "large" }],
    ["3 cloves garlic, minced", { quantity: 3, unit: "clove", food: "garlic", prep: "minced" }],
    ["a pinch of salt", { quantity: 1, unit: "pinch", food: "salt" }],
    ["2-3 chicken thighs", { quantity: 2, food: "chicken thighs", note: "up to 3" }],
    ["8 oz. cream cheese, softened", { quantity: 8, unit: "oz", food: "cream cheese", prep: "softened" }],
    ["1 can (15 oz) black beans, drained and rinsed", { quantity: 1, unit: "can", food: "black beans", prep: "drained and rinsed", note: "15 oz" }],
    ["- 1 tomato, sliced", { quantity: 1, food: "tomato", prep: "sliced" }],
    ["GF sandwich bread", { quantity: null, food: "GF sandwich bread" }],
    ["2 tbsp lemon juice — fresh or bottled", { quantity: 2, unit: "tbsp", food: "lemon juice", note: "fresh or bottled" }],
    ["4 fl oz milk", { quantity: 4, unit: "fl oz", food: "milk" }],
    ["¼ cup mayonnaise", { quantity: 0.25, unit: "cup", food: "mayonnaise" }],
    ["cilantro, chopped, optional", { food: "cilantro", prep: "chopped", optional: true }],
  ];
  for (const [line, expected] of cases) {
    it(line, () => expect(parseLine(line)).toMatchObject(expected));
  }
});

describe("nameKey", () => {
  it("matches plurals and case", () => {
    expect(nameKey("Lemons")).toBe(nameKey("lemon"));
    expect(nameKey("Roma Tomatoes")).toBe("roma tomato");
    expect(nameKey("potatoes")).toBe(nameKey("Potato"));
    expect(nameKey("berries")).toBe("berry");
    expect(nameKey("Chicken thighs")).toBe("chicken thigh");
    expect(nameKey("Swiss cheese")).toBe("swiss cheese");
    expect(nameKey("hummus")).toBe("hummus");
    expect(nameKey("Trader Joe's")).toBe("trader joe");
  });
});

describe("formatQuantity", () => {
  it("writes fractions", () => {
    expect(formatQuantity(1.5)).toBe("1½");
    expect(formatQuantity(0.25)).toBe("¼");
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(0.4)).toBe("0.4");
  });
});

describe("formatAmount", () => {
  it("pluralizes counted units only", () => {
    expect(formatAmount(2, "slice")).toBe("2 slices");
    expect(formatAmount(1.5, "cup")).toBe("1½ cups");
    expect(formatAmount(2, "tbsp")).toBe("2 tbsp");
    expect(formatAmount(2, "pinch")).toBe("2 pinches");
    expect(formatAmount(1, "clove")).toBe("1 clove");
    expect(formatAmount(null, "")).toBe("");
  });
});

describe("ingredientsFromText", () => {
  const foods: Record<string, string> = { lemon: "lemon-id", "american cheese": "cheese-id" };
  const find = (name: string) => foods[nameKey(name)];
  const lines = (text: string, before = []) => ingredientsFromText(text, before, find);

  it("links existing foods and leaves the rest as text, making none", () => {
    const [a, b] = lines("1 lemon, zested\n1 cup GF bran flakes (Wegm");
    expect(a!.foodId).toBe("lemon-id");
    expect(b!.foodId).toBeNull();
    expect(b!.line).toBe("1 cup GF bran flakes (Wegm");
  });

  it("keeps an unchanged line, and a hand-picked food when only the amount changes", () => {
    const before = [{ ...lines("2 slices cheese")[0]!, foodId: "cheese-id" }, lines("1 lemon")[0]!];
    const after = ingredientsFromText("1 lemon\n3 slices cheese", before, find);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toMatchObject({ id: before[0]!.id, foodId: "cheese-id", quantity: 3 });
  });
});
