import { METHOD_LABEL, RATINGS, RATING_EMOJI, nameKey, productName, type Rating } from "@foodlab/shared";
import { useMemo, type ReactNode } from "react";
import { A, pathOf, setQuery, useRoute } from "../router";
import { useData } from "../sync";
import { KIND_ICON } from "./controls";
import { openQuickAdd } from "./QuickAdd";
import { NotGF, Rating as RatingMark } from "./rows";

// The database personality (DESIGN.md §5.3): every food, product, recipe or store, with a filter
// and the columns that matter. Filters live in the address, so Back returns to the same list.

const match = (text: string, filter: string) => !filter.trim() || nameKey(text).includes(nameKey(filter)) || text.toLowerCase().includes(filter.trim().toLowerCase());

function ListShell({
  title,
  icon,
  count,
  add,
  filters,
  head,
  children,
  empty,
}: {
  title: string;
  icon: string;
  count: number;
  add?: () => void;
  filters?: ReactNode;
  head: ReactNode;
  children: ReactNode;
  empty: string;
}) {
  const { query } = useRoute();
  return (
    <div className="page wide">
      <div className="list-head">
        <h1 className="page-title">
          {icon} {title} <span className="count">{count}</span>
        </h1>
        <span className="spacer" />
        {add && (
          <button className="btn primary" onClick={add}>
            + Add
          </button>
        )}
      </div>
      <div className="list-filters">
        <input
          className="input"
          type="search"
          placeholder="Filter…"
          aria-label="Filter"
          value={query.get("f") ?? ""}
          onChange={(e) => setQuery({ f: e.target.value })}
        />
        {filters}
      </div>
      {count ? (
        <table className="db">
          <thead>{head}</thead>
          <tbody>{children}</tbody>
        </table>
      ) : (
        <p className="empty">{empty}</p>
      )}
    </div>
  );
}

function RatingFilter() {
  const { query } = useRoute();
  const r = query.get("rating");
  return (
    <select className="select" value={r ?? ""} onChange={(e) => setQuery({ rating: e.target.value || null })} aria-label="Rating">
      <option value="">Any rating</option>
      {RATINGS.map((x) => (
        <option key={x} value={x}>
          {RATING_EMOJI[x]}
        </option>
      ))}
      <option value="none">Not rated</option>
    </select>
  );
}
const ratingOk = (rating: Rating | null, f: string | null) => !f || (f === "none" ? !rating : rating === f);

// ---- sorting: ?sort=<column>, "-" in front for the other way; blanks always last ----

type SortValue = string | number | null | undefined;
/** Per column: its value, and whether the first click sorts high-to-low (counts, ratings). */
type SortCols<T> = Record<string, { value: (x: T) => SortValue; desc?: boolean }>;
const RATING_RANK: Record<Rating, number> = { love: 3, up: 2, down: 1 };
const rank = (r: Rating | null) => (r ? RATING_RANK[r] : null);
const blank = (v: SortValue) => v === null || v === undefined || v === "" || v === 0;

function useSort<T>(rows: T[], cols: SortCols<T>) {
  const { query } = useRoute();
  const raw = query.get("sort") ?? "";
  const key = raw.replace(/^-/, "");
  const col = cols[key];
  // The address says which way: "-" = the opposite of the column's first click.
  const desc = col ? (col.desc ?? false) !== raw.startsWith("-") : false;
  const sorted = useMemo(() => {
    if (!col) return rows;
    const keyed = rows.map((x) => ({ x, v: col.value(x) }));
    keyed.sort((a, b) => {
      if (blank(a.v) || blank(b.v)) return Number(blank(a.v)) - Number(blank(b.v));
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: "base" });
      return desc ? -c : c;
    });
    return keyed.map((k) => k.x);
  }, [rows, col, desc]);
  /** A header that sorts by its column; again flips it, a third time goes back to A–Z by name. */
  const th = (k: string, label: ReactNode, className = "", ariaLabel?: string) => {
    const on = key === k && !!col;
    const next = !on ? k : raw.startsWith("-") ? null : `-${k}`;
    return (
      <th className={className} aria-sort={on ? (desc ? "descending" : "ascending") : undefined}>
        <button className="sort-th" onClick={() => setQuery({ sort: next })} aria-label={ariaLabel ? `Sort by ${ariaLabel}` : undefined} title={ariaLabel}>
          {label}
          <span className="sort-mark" aria-hidden>
            {on ? (desc ? "▼" : "▲") : ""}
          </span>
        </button>
      </th>
    );
  };
  return { sorted, th };
}

export function FoodsList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const staples = query.get("staple") === "1";
  const rows = useMemo(
    () =>
      view.foods.filter(
        (x) => (match(x.name, f) || view.ancestors(x.id).some((a) => match(a.name, f))) && (!staples || x.staple),
      ),
    [view, f, staples],
  );
  const { sorted, th } = useSort(rows, {
    name: { value: (x) => x.name },
    up: { value: (x) => (view.food(x.parentId) ?? view.food(x.formOfId))?.name },
    products: { value: (x) => view.productsOf(x.id).length, desc: true },
    recipes: { value: (x) => view.recipesUsing(x.id).length, desc: true },
  });
  return (
    <ListShell
      title="Foods"
      icon={KIND_ICON.foods}
      count={rows.length}
      add={() => openQuickAdd({ kind: "foods" })}
      empty="No foods yet. They're made for you as you add products and recipe ingredients."
      filters={
        <label className="check">
          <input type="checkbox" checked={staples} onChange={(e) => setQuery({ staple: e.target.checked ? "1" : null })} /> Staples
        </label>
      }
      head={
        <tr>
          {th("name", "Food")}
          {th("up", "Is a / form of", "hide-sm")}
          {th("products", "Products", "num")}
          {th("recipes", "Recipes", "num")}
        </tr>
      }
    >
      {sorted.map((x) => {
        const up = view.food(x.parentId) ?? view.food(x.formOfId);
        return (
          <tr key={x.id}>
            <td>
              <A href={pathOf("foods", x.id)} className="strong">
                {x.name}
              </A>
              {x.staple && <span className="staple-mark">★</span>}
            </td>
            <td className="hide-sm muted">
              {up && (
                <>
                  {x.parentId ? "" : "form of "}
                  <A href={pathOf("foods", up.id)}>{up.name}</A>
                </>
              )}
            </td>
            <td className="num">{view.productsOf(x.id).length || ""}</td>
            <td className="num">{view.recipesUsing(x.id).length || ""}</td>
          </tr>
        );
      })}
    </ListShell>
  );
}

export function ProductsList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const store = query.get("store");
  const rating = query.get("rating");
  const rows = useMemo(
    () =>
      view.products.filter((p) => {
        const food = view.food(p.foodId);
        return (
          (match(productName(p), f) || (food ? match(food.name, f) : false)) &&
          (!store || p.storeIds.includes(store)) &&
          ratingOk(p.rating, rating)
        );
      }),
    [view, f, store, rating],
  );
  const { sorted, th } = useSort(rows, {
    rating: { value: (p) => rank(p.rating), desc: true },
    name: { value: (p) => productName(p) },
    food: { value: (p) => view.food(p.foodId)?.name },
    stores: { value: (p) => p.storeIds.map((s) => view.store(s)?.name).filter(Boolean).join(", ") },
  });
  return (
    <ListShell
      title="Products"
      icon={KIND_ICON.products}
      count={rows.length}
      add={() => openQuickAdd({ kind: "products", storeIds: store ? [store] : [] })}
      empty="No products match."
      filters={
        <>
          <select className="select" value={store ?? ""} onChange={(e) => setQuery({ store: e.target.value || null })} aria-label="Store">
            <option value="">Any store</option>
            {view.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <RatingFilter />
        </>
      }
      head={
        <tr>
          {th("rating", "❤️", "rate-col", "Rating")}
          {th("name", "Product")}
          {th("food", "Food", "hide-sm")}
          {th("stores", "Sold at", "hide-sm")}
        </tr>
      }
    >
      {sorted.map((p) => {
        const food = view.food(p.foodId);
        return (
          <tr key={p.id}>
            <td className="rate-col">
              <RatingMark value={p.rating} />
            </td>
            <td>
              <A href={pathOf("products", p.id)} className="strong">
                {productName(p)}
              </A>
              {p.glutenFree === "no" && <NotGF />}
              {food && <div className="show-sm muted small">{food.name}</div>}
            </td>
            <td className="hide-sm">{food && <A href={pathOf("foods", food.id)}>{food.name}</A>}</td>
            <td className="hide-sm muted">{p.storeIds.map((s) => view.store(s)?.name).filter(Boolean).join(", ")}</td>
          </tr>
        );
      })}
    </ListShell>
  );
}

export function RecipesList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const tag = query.get("tag");
  const rating = query.get("rating");
  const rows = useMemo(
    () =>
      view.recipes.filter(
        (r) =>
          (match(r.name, f) || r.ingredients.some((i) => match(view.food(i.foodId)?.name ?? i.line, f))) &&
          (!tag || r.tagIds.includes(tag)) &&
          ratingOk(r.rating, rating),
      ),
    [view, f, tag, rating],
  );
  const { sorted, th } = useSort(rows, {
    rating: { value: (r) => rank(r.rating), desc: true },
    name: { value: (r) => r.name },
    ingredients: { value: (r) => r.ingredients.length, desc: true },
    method: { value: (r) => (r.method ? METHOD_LABEL[r.method] : null) },
    min: { value: (r) => (r.prepMin ?? 0) + (r.cookMin ?? 0) },
  });
  return (
    <ListShell
      title="Recipes"
      icon={KIND_ICON.recipes}
      count={rows.length}
      add={() => openQuickAdd({ kind: "recipes" })}
      empty="No recipes match."
      filters={
        <>
          <select className="select" value={tag ?? ""} onChange={(e) => setQuery({ tag: e.target.value || null })} aria-label="Tag">
            <option value="">Any tag</option>
            {view.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <RatingFilter />
        </>
      }
      head={
        <tr>
          {th("rating", "❤️", "rate-col", "Rating")}
          {th("name", "Recipe")}
          {th("ingredients", "Ingredients", "hide-sm")}
          {th("method", "Method", "hide-sm")}
          {th("min", "Min", "hide-sm num", "Minutes")}
        </tr>
      }
    >
      {sorted.map((r) => (
        <tr key={r.id}>
          <td className="rate-col">
            <RatingMark value={r.rating} />
          </td>
          <td>
            <A href={pathOf("recipes", r.id)} className="strong">
              {r.name}
            </A>
            {r.status === "want" && <span className="badge">want to try</span>}
            {r.glutenFree === "no" && <NotGF />}
            <div className="muted small clip">{view.ingredientSummary(r)}</div>
          </td>
          <td className="hide-sm muted small clip">{r.ingredients.length || ""}</td>
          <td className="hide-sm muted">{r.method ? METHOD_LABEL[r.method] : ""}</td>
          <td className="hide-sm num">{(r.prepMin ?? 0) + (r.cookMin ?? 0) || ""}</td>
        </tr>
      ))}
    </ListShell>
  );
}

export function StoresList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const rows = useMemo(() => view.stores.filter((s) => match(s.name, f)), [view, f]);
  const liked = (id: string) => view.productsAt(id).filter((p) => p.rating === "love" || p.rating === "up").length;
  const { sorted, th } = useSort(rows, {
    name: { value: (s) => s.name },
    products: { value: (s) => view.productsAt(s.id).length, desc: true },
    liked: { value: (s) => liked(s.id), desc: true },
  });
  return (
    <ListShell
      title="Stores"
      icon={KIND_ICON.stores}
      count={rows.length}
      empty="No stores yet. Add one from a product's Sold at."
      head={
        <tr>
          {th("name", "Store")}
          {th("products", "Products", "num")}
          {th("liked", "❤️ / 👍", "num", "Liked products")}
        </tr>
      }
    >
      {sorted.map((s) => {
        const ps = view.productsAt(s.id);
        return (
          <tr key={s.id}>
            <td>
              <A href={pathOf("stores", s.id)} className="strong">
                {s.name}
              </A>
            </td>
            <td className="num">{ps.length || ""}</td>
            <td className="num">{liked(s.id) || ""}</td>
          </tr>
        );
      })}
    </ListShell>
  );
}
