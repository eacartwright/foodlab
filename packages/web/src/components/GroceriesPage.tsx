import { moveGrocery, productName, type GroceryItem, type View } from "@foodlab/shared";
import { useRef, useState, type ButtonHTMLAttributes } from "react";
import { addToGroceries, doneShopping, ensureFood, gotGrocery, needGrocery, newProductFor, remove, saveGrocery, tripStart, ungotGrocery } from "../actions";
import { A, pathOf } from "../router";
import { useData } from "../sync";
import { showToast } from "../toast";
import { DraftInput, Field, Picker, Segmented } from "./controls";
import { Section } from "./rows";
import { SwipeRow } from "./SwipeRow";

// Groceries (DESIGN.md §4.10, §5.8): one standing list. Each thing I buy is needed or not;
// checking it off sends it back to Usual, one tap from the list again. Phone-first: it's used
// in the store.

type Names = "foods" | "products";
const NAMES_KEY = "foodlab:groceryNames";

/** What a row says: its food or its product (the switch, per device), else the name as typed. */
function labelOf(g: GroceryItem, names: Names, view: View): string {
  const food = view.food(g.foodId);
  const product = g.productId ? view.state.products[g.productId] : undefined;
  const p = product && !product.deleted ? productName(product) : undefined;
  const f = food && !food.deleted ? food.name : undefined;
  return (names === "products" ? (p ?? f) : (f ?? p)) ?? g.name;
}

function storedNames(): Names {
  try {
    return localStorage.getItem(NAMES_KEY) === "products" ? "products" : "foods";
  } catch {
    return "foods";
  }
}

export function GroceriesPage() {
  const { view } = useData();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [tidy, setTidy] = useState(false);
  const [names, setNames] = useState<Names>(storedNames);
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const ul = useRef<HTMLUListElement>(null);
  const since = tripStart();
  const list = view.groceryList();
  const label = (g: GroceryItem) => labelOf(g, names, view);
  const trip = view.groceryTrip(since);
  const typed = text.trim();
  // Tidying deletes what I've bought before; staples come from foods, so they stay.
  const usual = typed ? view.groceryMatches(typed, since) : view.groceryUsual(since).filter((u) => !tidy || u.item);
  const already = typed ? list.filter((g) => label(g).toLowerCase().includes(typed.toLowerCase())) : [];

  // Dragging by the handle: the list shows the new order as it goes, saved on letting go.
  const others = drag ? list.filter((g) => g.id !== drag.id) : list;
  const dragged = drag && list.find((g) => g.id === drag.id);
  const shown = dragged ? [...others.slice(0, drag.to), dragged, ...others.slice(drag.to)] : list;
  /** Where the pointer is among the other rows: how many of them sit above it. */
  const indexAt = (y: number, id: string) =>
    [...(ul.current?.querySelectorAll<HTMLElement>("li[data-id]") ?? [])].filter((li) => li.dataset.id !== id && li.getBoundingClientRect().top + li.offsetHeight / 2 < y).length;
  const move = (id: string, to: number) => {
    for (const m of moveGrocery(list, id, to)) {
      const g = view.state.groceries[m.id];
      if (g) saveGrocery(g, { neededAt: m.neededAt });
    }
  };
  // The moves and the drop are heard on the window: reordering moves the row's element, which
  // loses the pointer capture, so the handle itself may never hear the finger lift.
  const grip = (g: GroceryItem, i: number): Grip => ({
    onPointerDown: (e) => {
      if (e.button !== 0 || drag) return;
      e.preventDefault(); // no text selection
      e.stopPropagation(); // a drag, not a swipe
      const id = g.id;
      let to = i;
      setDrag({ id, to });
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        // Near the top or bottom of the screen, scroll along.
        if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 10);
        else if (ev.clientY < 60) window.scrollBy(0, -10);
        const at = indexAt(ev.clientY, id);
        if (at !== to) setDrag({ id, to: (to = at) });
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        if (ev.type === "pointerup") move(id, to);
        setDrag(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    onKeyDown: (e) => {
      const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : null;
      if (to === null || to < 0 || to >= list.length) return;
      e.preventDefault();
      move(g.id, to);
      // The row moved: keep the focus on its handle.
      setTimeout(() => ul.current?.querySelector<HTMLElement>(`li[data-id="${g.id}"] .grocery-grip`)?.focus());
    },
  });

  const add = () => {
    if (!typed) return;
    const had = view.findGrocery({ name: typed });
    if (had?.need) showToast(`${had.name} is already on the list`);
    else needGrocery({ name: typed });
    setText("");
  };

  return (
    <div className="page groceries">
      <div className="list-head">
        <h1 className="page-title">
          🧺 Groceries
          {list.length > 0 && <span className="count">{list.length}</span>}
        </h1>
        <span className="spacer" />
        <Segmented
          value={names}
          options={["foods", "products"] as const}
          labels={{ foods: "Foods", products: "Products" }}
          clearable={false}
          label="Show items as"
          onChange={(v) => {
            const next = v ?? "foods";
            setNames(next);
            try {
              localStorage.setItem(NAMES_KEY, next);
            } catch {
              // Blocked storage: it just isn't remembered.
            }
          }}
        />
      </div>
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
      <ul className="grocery-list" ref={ul}>
        {shown.map((g, i) => (
          <GroceryRow
            key={g.id}
            g={g}
            label={label(g)}
            editing={editing === g.id}
            onEdit={() => setEditing(editing === g.id ? null : g.id)}
            grip={list.length > 1 ? grip(g, i) : undefined}
            dragging={drag?.id === g.id}
          />
        ))}
        {trip.map((g) => (
          <li key={g.id} className="got">
            <input type="checkbox" checked aria-label={`Not got: ${label(g)}`} title="Not got: back on the list" onChange={() => ungotGrocery(g)} />
            <span className="grocery-name">{label(g)}</span>
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

/** Off the list without counting it as bought (back to Usual), with Undo. */
function notNeeded(g: GroceryItem, label: string) {
  saveGrocery(g, { need: false, note: "" });
  showToast(`${label} is off the list`, { label: "Undo", run: () => saveGrocery(g, { need: true, note: g.note }) });
}

type Grip = Required<Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onPointerDown" | "onKeyDown">>;

function GroceryRow({ g, label, editing, onEdit, grip, dragging }: { g: GroceryItem; label: string; editing: boolean; onEdit: () => void; grip?: Grip; dragging: boolean }) {
  const { view } = useData();
  const stores = view.groceryStores(g);
  const food = view.food(g.foodId);
  const product = g.productId ? view.state.products[g.productId] : undefined;
  const products = (food ? view.productsOf(food.id) : view.products).map((p) => ({ id: p.id, label: productName(p) }));
  return (
    <li data-id={g.id} className={[editing && "editing", dragging && "dragging"].filter(Boolean).join(" ")}>
      <SwipeRow label="Remove" onAction={() => notNeeded(g, label)} disabled={editing || dragging}>
        <input type="checkbox" checked={false} aria-label={`Got ${label}`} onChange={() => gotGrocery(g)} />
        <button className="grocery-main" onClick={onEdit} aria-expanded={editing} title="Food, product, note">
          <span className="grocery-name">{label}</span>
          {g.note && <span className="grocery-note"> · {g.note}</span>}
          {food?.plu && <span className="muted grocery-plu" title="PLU"> · {food.plu}</span>}
          {stores.length > 0 && <span className="muted small grocery-stores">{stores.map((s) => s.name).join(", ")}</span>}
        </button>
        {grip && (
          <button className="grocery-grip" aria-label={`Move ${label} (arrow keys)`} title="Drag to reorder" {...grip}>
            ⠿
          </button>
        )}
      </SwipeRow>
      {editing && (
        <div className="grocery-edit fields compact">
          {/* Name only for free text: a food or product names it (DESIGN.md §5.8). */}
          {!g.foodId && !g.productId && (
            <Field label="Name">
              <DraftInput className="input" value={g.name} required aria-label="Name" onCommit={(name) => saveGrocery(g, { name })} />
            </Field>
          )}
          {!product?.notFood && (
            <Field label="Food">
              <Picker
                value={g.foodId}
                options={view.foods.map((f) => ({ id: f.id, label: f.name, also: f.aliases }))}
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
              createLabel="New product"
              onChange={(productId) => saveGrocery(g, { productId, foodId: (productId && view.state.products[productId]?.foodId) || g.foodId })}
              onCreate={(text) => newProductFor(text, g.foodId)}
            />
          </Field>
          <Field label="This time">
            {/* Not focused on opening: on the phone that pops the keyboard up. */}
            <DraftInput className="input" value={g.note} placeholder="2, the big one…" aria-label="Note" onCommit={(note) => saveGrocery(g, { note })} />
          </Field>
          <div className="row-actions">
            {food && (
              <A className="btn subtle" href={pathOf("foods", food.id)}>
                Open food
              </A>
            )}
            {product && (
              <A className="btn subtle" href={pathOf("products", product.id)}>
                Open product
              </A>
            )}
            <span className="spacer" />
            <button
              className="btn subtle"
              onClick={() => notNeeded(g, label)}
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
