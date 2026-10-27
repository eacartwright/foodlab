import { describe, expect, it } from "vitest";
import { minutes, readYield, recipeFromHtml, recipeFromText } from "./recipeRead";

const page = (ld: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>…</body></html>`;

describe("recipeFromHtml", () => {
  it("reads a Recipe inside @graph, with HowToSteps", () => {
    const r = recipeFromHtml(
      page({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "Easy Vegan Fried Rice - Minimalist Baker" },
          {
            "@type": "Recipe",
            name: "Easy Vegan Fried Rice",
            recipeYield: ["4", "4 servings"],
            prepTime: "PT15M",
            cookTime: "PT60M",
            recipeIngredient: ["1 cup extra-firm tofu* ((8 ounces yields ~1 cup))", "4 cloves garlic ((minced))"],
            recipeInstructions: [
              { "@type": "HowToStep", text: "Preheat oven to 400 degrees F." },
              { "@type": "HowToStep", text: "Press the tofu." },
            ],
          },
        ],
      }),
    );
    expect(r).toEqual({
      name: "Easy Vegan Fried Rice",
      yieldQty: 4,
      yieldUnit: "servings",
      prepMin: 15,
      cookMin: 60,
      ingredients: ["1 cup extra-firm tofu (8 ounces yields ~1 cup)", "4 cloves garlic (minced)"],
      instructions: "1. Preheat oven to 400 degrees F.\n2. Press the tofu.",
    });
  });

  it("reads sections, entities, a type list and skips broken JSON", () => {
    const html =
      `<script type="application/ld+json">{ not json</script>` +
      page([
        {
          "@type": ["Recipe", "NewsArticle"],
          name: "Mac &amp; cheese",
          recipeYield: "Makes 12",
          totalTime: "PT1H",
          prepTime: "PT20M",
          recipeIngredient: ["1&frac12; cups milk", "<b>8 oz</b> cheddar"],
          recipeInstructions: [
            { "@type": "HowToSection", name: "Sauce", itemListElement: [{ "@type": "HowToStep", text: "Melt butter." }] },
            { "@type": "HowToSection", name: "Bake", itemListElement: [{ "@type": "HowToStep", text: "Bake 20 min at 375&#176;F." }] },
          ],
        },
      ]);
    expect(recipeFromHtml(html)).toMatchObject({
      name: "Mac & cheese",
      yieldQty: 12,
      yieldUnit: "",
      prepMin: 20,
      cookMin: 40,
      ingredients: ["1½ cups milk", "8 oz cheddar"],
      instructions: "### Sauce\n1. Melt butter.\n\n### Bake\n2. Bake 20 min at 375°F.",
    });
  });

  it("splits one string of steps into numbered lines", () => {
    const r = recipeFromHtml(page({ "@type": "Recipe", name: "Toast", recipeIngredient: ["2 slices bread"], recipeInstructions: "1. Toast the bread.\n2. Butter it." }));
    expect(r?.instructions).toBe("1. Toast the bread.\n2. Butter it.");
  });

  it("splits ingredients run together, drops 'unit', 'Step N –' and bullets", () => {
    const glued =
      "6 Chicken thighs, bone-in, skin-onSalt, pepper for seasoning1/3 cup (42g) All-purpose Flour2 tbsp (28.5g) Unsalted butter1 large onion, peeled and diced7 – 8 sprigs parsley¾ cup dry white wine";
    const r = recipeFromHtml(
      page({
        "@type": "Recipe",
        name: "Marengo",
        recipeIngredient: [glued],
        recipeInstructions: [{ "@type": "HowToStep", text: "Step 1 – Rinse the thighs." }, { "@type": "HowToStep", text: "• Peel the carrot. • Slice it." }],
      }),
    );
    expect(r?.ingredients).toEqual([
      "6 Chicken thighs, bone-in, skin-on",
      "Salt, pepper for seasoning",
      "1/3 cup (42g) All-purpose Flour",
      "2 tbsp (28.5g) Unsalted butter",
      "1 large onion, peeled and diced",
      "7 – 8 sprigs parsley",
      "¾ cup dry white wine",
    ]);
    expect(r?.instructions).toBe("1. Rinse the thighs.\n2. Peel the carrot. Slice it.");
    expect(recipeFromHtml(page({ "@type": "Recipe", name: "Soup", recipeIngredient: ["2 unit Scallions", "McCormick paprika"] }))?.ingredients).toEqual(["2 Scallions", "McCormick paprika"]);
  });

  it("is null without a recipe", () => {
    expect(recipeFromHtml(page({ "@type": "Article", name: "Ten ways to eat eggs" }))).toBeNull();
    expect(recipeFromHtml("<html><body>No data</body></html>")).toBeNull();
  });
});

describe("pieces", () => {
  it("minutes", () => {
    expect(minutes("PT1H15M")).toBe(75);
    expect(minutes("PT0S")).toBeNull();
    expect(minutes("P0DT2H")).toBe(120);
    expect(minutes("20 minutes")).toBeNull();
  });
  it("readYield", () => {
    expect(readYield("1 loaf")).toEqual([1, "loaf"]);
    expect(readYield(["8", "8 slices"])).toEqual([8, "slices"]);
    expect(readYield("4-6 servings")).toEqual([4, "servings"]);
    expect(readYield(6)).toEqual([6, ""]);
    expect(readYield(undefined)).toEqual([null, ""]);
  });
});

describe("recipeFromText", () => {
  it("uses the headings", () => {
    const r = recipeFromText(`Deviled Eggs
Serves 6

Ingredients
▢ 6 large eggs
▢ ¼ cup mayonnaise
- salt, to taste

Instructions
1. Boil the eggs for 12 minutes.
2. Mash the yolks with the mayonnaise.

Notes
Keeps 2 days.`);
    expect(r.name).toBe("Deviled Eggs");
    expect(r.ingredients).toEqual(["6 large eggs", "¼ cup mayonnaise", "salt, to taste"]);
    expect(r.instructions).toBe("1. Boil the eggs for 12 minutes.\n2. Mash the yolks with the mayonnaise.");
  });

  it("drops Step N lines", () => {
    const r = recipeFromText("Meatloaf\nIngredients\n1 egg\nDirections\nStep 1\nPreheat the oven.\nStep 2\nMix it all.");
    expect(r.instructions).toBe("1. Preheat the oven.\n2. Mix it all.");
  });

  it("guesses without headings", () => {
    const r = recipeFromText("Toast\n2 slices bread\n1 tbsp butter\nToast the bread until golden.\nButter it while hot.");
    expect(r.name).toBe("Toast");
    expect(r.ingredients).toEqual(["2 slices bread", "1 tbsp butter"]);
    expect(r.instructions).toBe("1. Toast the bread until golden.\n2. Butter it while hot.");
  });
});
