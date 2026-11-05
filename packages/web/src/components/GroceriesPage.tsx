import { productName, type GroceryItem } from "@foodlab/shared";
import { useState } from "react";
import { addToGroceries, doneShopping, ensureFood, gotGrocery, needGrocery, remove, saveGrocery, tripStart, ungotGrocery } from "../actions";
import { A, pathOf } from "../router";
import { useData } from "../sync";
import { showToast } from "../toast";
import { DraftInput, Field, Picker } from "./controls";
import { Section } from "./rows";

// Groceries (DESIGN.md §4.10, §5.8): one standing list. Each thing I buy is needed or not;
// checking it off sends it back to Usual, one tap from the list again. Phone-first: it's used
// in the store.

export function GroceriesPage() {
  const { view } = useData();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [tidy, setTidy] = useState(false);
  const since = tripStart();
  const list = view.groceryList();
  const trip = view.groceryTrip(since);
  const typed = text.trim();
  // Tidying deletes what I've bought before; staples come from foods, so they stay.
  const usual = typed ? view.groceryMatches(typed, since) : view.groceryUsual(since).filter((u) => !tidy || u.item);
  const already = typed ? list.filter((g) => g.name.toLowerCase().includes(typed.toLowerCase())) : [];

  const add = () => {
    if (!typed) return;
    const had = view.findGrocery({ name: typed });
    if (had?.need) showToast(`${had.name} is already on the list`);
    else needGrocery({ name: typed });
    setText("");
  };

  return (
    <div className="page groceries">
      <h1 className="page-title">
        🧺 Groceries
        {list.length > 0 && <span className="count">{list.length}</span>}
      </h1>
      <div className="inline">
        <input
          className="input grow"
          placeholder="Add… (milk, eggs)"
          aria-label="Add to the list"
          value={text}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
            else if (e.key === "Escape") setText("");
          }}
        />
        <button className="btn primary" disabled={!typed} onClick={add}>
          Add
        </button>
      </div>

      {list.length === 0 && trip.length === 0 && <p className="empty-line">Nothing on the list.</p>}
      <ul className="grocery-list">
        {list.map((g) => (
          <GroceryRow key={g.id} g={g} editing={editing === g.id} onEdit={() => setEditing(editing === g.id ? null : g.id)} />
        ))}
        {trip.map((g) => (
          <li key={g.id} className="got">
            <input type="checkbox" checked aria-label={`Not got: ${g.name}`} title="Not got: back on the list" onChange={() => ungotGrocery(g)} />
            <span className="grocery-name">{g.name}</span>
          </li>
        ))}
      </ul>
      {trip.length > 0 && (
        <button className="btn" onClick={doneShopping}>
          Done shopping
        </button>
      )}

      <Section
        title={typed ? "Matching" : "Usual"}
        count={usual.length || undefined}
        actions={
          !typed && (
            <button className="btn subtle" aria-pressed={tidy} onClick={() => setTidy(!tidy)} title="Delete things I won't buy again">
              {tidy ? "Done tidying" : "Tidy"}
            </button>
          )
        }
      >
        {usual.length === 0 ? (
          <p className="empty-line">
            {!typed
              ? "What you buy shows up here once it's checked off, with your staples."
              : already.length
                ? `Already on the list: ${already.map((g) => g.name).join(", ")}.`
                : "Nothing yet by that name: Add makes it."}
          </p>
        ) : (
          <div className="chips">
            {usual.map((u) => (
              <button
                key={u.item?.id ?? u.product?.id ?? u.food?.id ?? u.name}
                className={`chip ${tidy && !typed ? "chip-remove" : ""}`}
                title={u.item ? `Bought ${u.item.count}×` : u.food?.staple ? "A staple" : undefined}
                onClick={() => {
                  if (tidy && !typed && u.item) return remove("groceries", u.item);
                  needGrocery(u);
                  setText("");
                }}
              >
                {tidy && !typed ? "×" : "+"} {u.name}
                {!u.item && u.food?.staple && <span className="muted">★</span>}
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function GroceryRow({ g, editing, onEdit }: { g: GroceryItem; editing: boolean; onEdit: () => void }) {
  const { view } = useData();
  const stores = view.groceryStores(g);
  const food = view.food(g.foodId);
  const product = g.productId ? view.state.products[g.productId] : undefined;
  const products = (food ? view.productsOf(food.id) : view.products).map((p) => ({ id: p.id, label: productName(p) }));
  return (
    <li className={editing ? "editing" : ""}>
      <input type="checkbox" checked={false} aria-label={`Got ${g.name}`} onChange={() => gotGrocery(g)} />
      <button className="grocery-main" onClick={onEdit} aria-expanded={editing} title="Note, food, product">
        <span className="grocery-name">{g.name}</span>
        {g.note && <span className="grocery-note"> · {g.note}</span>}
        {food?.plu && <span className="muted grocery-plu" title="PLU"> · {food.plu}</span>}
        {stores.length > 0 && <span className="muted small grocery-stores">{stores.map((s) => s.name).join(", ")}</span>}
      </button>
      {editing && (
        <div className="grocery-edit fields compact">
          <Field label="Name">
            <DraftInput className="input" value={g.name} required aria-label="Name" onCommit={(name) => saveGrocery(g, { name })} />
          </Field>
          <Field label="This time">
            <DraftInput className="input" value={g.note} placeholder="2, the big one…" aria-label="Note" autoFocus onCommit={(note) => saveGrocery(g, { note })} />
          </Field>
          {!product?.notFood && (
            <Field label="Food">
              <Picker
                value={g.foodId}
                options={view.foods.map((f) => ({ id: f.id, label: f.name }))}
                placeholder="Which food? (optional)"
                createLabel="New food"
                onChange={(foodId) => saveGrocery(g, { foodId, productId: foodId && product && product.foodId !== foodId ? null : g.productId })}
                onCreate={(n) => ensureFood(n)}
              />
            </Field>
          )}
          <Field label="Product">
            <Picker
              value={g.productId}
              options={products}
              placeholder="Which one? (optional)"
              onChange={(productId) => saveGrocery(g, { productId, foodId: (productId && view.state.products[productId]?.foodId) || g.foodId })}
            />
          </Field>
          <div className="row-actions">
            {product && <A href={pathOf("products", product.id)}>Open {productName(product)}</A>}
            {!product && food && <A href={pathOf("foods", food.id)}>Open {food.name}</A>}
            <span className="spacer" />
            <button
              className="btn subtle"
              onClick={() => {
                saveGrocery(g, { need: false, note: "" });
                showToast(`${g.name} is off the list`, { label: "Undo", run: () => saveGrocery(g, { need: true, note: g.note }) });
              }}
              title="Off the list without counting it as bought"
            >
              Not needed
            </button>
            <button className="btn danger" onClick={() => remove("groceries", g)} title="Never buying it again">
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** + Groceries on a food, product or staple; says so when it's already on the list. */
export function GroceryButton({ name, foodId = null, productId = null, small }: { name: string; foodId?: string | null; productId?: string | null; small?: boolean }) {
  const { view } = useData();
  const g = view.findGrocery({ name, foodId, productId });
  if (g?.need)
    return (
      <A href="/groceries" className={`btn subtle ${small ? "icon" : ""}`} title="On the grocery list">
        {small ? "🧺" : "🧺 On the list"}
      </A>
    );
  return (
    <button className={`btn subtle ${small ? "icon" : ""}`} aria-label={`Add ${name} to groceries`} title="Put it on the grocery list" onClick={() => addToGroceries({ name, foodId, productId })}>
      {small ? "+🧺" : "+ Groceries"}
    </button>
  );
}
