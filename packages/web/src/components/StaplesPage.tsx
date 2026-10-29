import { productName } from "@foodlab/shared";
import { useState } from "react";
import { A, pathOf } from "../router";
import { put, useData } from "../sync";
import { showToast } from "../toast";
import { GroceryButton } from "./GroceriesPage";
import { Section } from "./rows";

// Staples (DESIGN.md §4.7): what I keep in the house, grouped by where I buy it (the standing
// shopping list), then foods my liked recipes keep using.

export function StaplesPage() {
  const { view, state } = useData();
  const [more, setMore] = useState(false);
  const list = view.stapleList();
  const suggestions = view.stapleSuggestions();
  const shown = more ? suggestions : suggestions.slice(0, 12);
  const mark = (id: string, staple: boolean) => {
    const f = state.foods[id];
    if (!f) return;
    put("foods", { ...f, staple });
    if (staple) showToast(`${f.name} is a staple`, { label: "Undo", run: () => put("foods", { ...state.foods[id]!, staple: false }) });
  };

  return (
    <div className="page">
      <h1 className="page-title">⭐ Staples</h1>
      <p className="muted">What you want to keep in the house, with the product you like and where it's sold.</p>
      {list.length === 0 && <p className="empty-line">No staples yet. Mark a food ☆ Staple on its page, or pick from the suggestions below.</p>}
      {list.map((g) => (
        <Section key={g.store?.id ?? "none"} title={g.store ? g.store.name : "Where to buy: not known yet"} count={g.items.length}>
          <ul className="staples">
            {g.items.map(({ food, product }) => (
              <li key={food.id}>
                <A href={pathOf("foods", food.id)} className="strong">
                  {food.name}
                </A>
                {product ? (
                  <A href={pathOf("products", product.id)} className="muted">
                    {productName(product)}
                  </A>
                ) : (
                  <span className="muted small">no favorite product yet</span>
                )}
                <GroceryButton name={food.name} foodId={food.id} small />
                <button className="btn icon subtle" title="Not a staple" aria-label={`${food.name} isn't a staple`} onClick={() => mark(food.id, false)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Suggested" count={suggestions.length}>
        <p className="muted small">Foods in 2 or more recipes you like or have made.</p>
        {suggestions.length === 0 ? (
          <p className="empty-line">None yet: they show up as you rate and make recipes.</p>
        ) : (
          <ul className="staples">
            {shown.map(({ food, recipes }) => (
              <li key={food.id}>
                <A href={pathOf("foods", food.id)} className="strong">
                  {food.name}
                </A>
                <span className="muted small" title={recipes.map((r) => r.name).join(", ")}>
                  in {recipes.length} recipes you like
                </span>
                <button className="btn subtle" onClick={() => mark(food.id, true)}>
                  ☆ Staple
                </button>
              </li>
            ))}
          </ul>
        )}
        {suggestions.length > shown.length && (
          <button className="btn subtle" onClick={() => setMore(true)}>
            Show all {suggestions.length}
          </button>
        )}
      </Section>
    </div>
  );
}
