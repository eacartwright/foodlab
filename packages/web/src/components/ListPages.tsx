import {
  COSTS,
  COST_LABEL,
  GF_LABEL,
  METHOD_LABEL,
  PLACE_STATUS_LABEL,
  PLACE_TYPES,
  PLACE_TYPE_LABEL,
  RATINGS,
  RATING_EMOJI,
  SPEEDS,
  SPEED_LABEL,
  STATUSES,
  STATUS_LABEL,
  nameKey,
  productName,
  type Food,
  type FoodNode,
  type PlaceType,
  type Product,
  type Rating,
  type Tag,
  type View,
} from "@foodlab/shared";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { deleteTag, ensureStore, ensureTag, mergeTag, renameTag } from "../actions";
import { showToast } from "../toast";
import { A, go, pathOf, setQuery, useRoute } from "../router";
import { useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, KIND_ICON, Segmented } from "./controls";
import { openQuickAdd } from "./QuickAdd";
import { NotGF, Rating as RatingMark } from "./rows";
import { fmtDate } from "./eating";

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
  const { tree, folded, fold, toggle } = useTreeState("foods");
  const nodes = useMemo(() => view.foodTree(), [view]);
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    const walk = (ns: FoodNode[]) => ns.forEach((n) => (m.set(n.food.id, n.total), walk(n.kids)));
    walk(nodes);
    return m;
  }, [nodes]);
  // In the tree, Products counts the food and its kinds (Mustard: all the mustards).
  const { sorted, th } = useSort(tree ? view.foods : rows, {
    name: { value: (x) => x.name },
    up: { value: (x) => (view.food(x.parentId) ?? view.food(x.formOfId))?.name },
    products: { value: (x) => (tree ? totals.get(x.id) : view.productsOf(x.id).length), desc: true },
    recipes: { value: (x) => view.recipesUsing(x.id).length, desc: true },
  });
  const filtering = !!f.trim() || staples;
  const withKids = () => {
    const out: string[] = [];
    const walk = (ns: FoodNode[]) => ns.forEach((n) => n.kids.length && (out.push(n.food.id), walk(n.kids)));
    walk(nodes);
    return out;
  };
  return (
    <ListShell
      title="Foods"
      icon={KIND_ICON.foods}
      count={rows.length}
      add={() => openQuickAdd({ kind: "foods" })}
      empty="No foods yet. They're made for you as you add products and recipe ingredients."
      filters={
        <>
          <TreeSwitch kind="foods" tree={tree} />
          <label className="check">
            <input type="checkbox" checked={staples} onChange={(e) => setQuery({ staple: e.target.checked ? "1" : null })} /> Staples
          </label>
          {tree && !filtering && <FoldAll onExpand={() => fold(new Set())} onCollapse={() => fold(new Set(withKids()))} />}
        </>
      }
      head={
        <tr>
          {th("name", "Food")}
          {!tree && th("up", "Kind of / form of", "hide-sm")}
          {th("products", "Products", "num")}
          {th("recipes", "Recipes", "num")}
        </tr>
      }
    >
      {tree ? (
        <FoodTreeRows
          nodes={nodes}
          order={new Map(sorted.map((x, i) => [x.id, i]))}
          shown={filtering ? new Set(rows.map((x) => x.id)) : null}
          folded={folded}
          onFold={toggle}
        />
      ) : (
        sorted.map((x) => {
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
        })
      )}
    </ListShell>
  );
}

// ---- List or Tree (Foods, Products): per device, which way and which branches are folded ----

type TreeKind = "foods" | "products";
const viewKey = (k: TreeKind) => `foodlab:${k}View`;
const foldKey = (k: TreeKind) => `foodlab:${k}Folded`;

/** The address says List or Tree, else what this device used last; folds are kept per device. */
function useTreeState(kind: TreeKind) {
  const { query } = useRoute();
  const tree = (query.get("view") ?? stored(viewKey(kind))) === "tree";
  const [folded, setFolded] = useState<Set<string>>(() => new Set(readFolded(foldKey(kind))));
  const fold = (next: Set<string>) => {
    setFolded(next);
    keep(foldKey(kind), JSON.stringify([...next]));
  };
  const toggle = (id: string) => {
    const next = new Set(folded);
    if (!next.delete(id)) next.add(id);
    fold(next);
  };
  return { tree, folded, fold, toggle };
}

function TreeSwitch({ kind, tree }: { kind: TreeKind; tree: boolean }) {
  return (
    <Segmented
      value={tree ? "tree" : "list"}
      options={["list", "tree"] as const}
      labels={{ list: "List", tree: "Tree" }}
      clearable={false}
      label="Show as"
      onChange={(v) => {
        keep(viewKey(kind), v ?? "list");
        setQuery({ view: v ?? "list" });
      }}
    />
  );
}

function FoldAll({ onExpand, onCollapse }: { onExpand: () => void; onCollapse: () => void }) {
  return (
    <span className="tree-all">
      <button className="btn subtle" onClick={onExpand}>
        Expand all
      </button>
      <button className="btn subtle" onClick={onCollapse}>
        Collapse all
      </button>
    </span>
  );
}

/** A fold button, or the same space when there's nothing to fold. */
function TreeToggle({ name, open, can, disabled, onClick }: { name: string; open: boolean; can: boolean; disabled?: boolean; onClick: () => void }) {
  if (!can) return <span className="tree-toggle" aria-hidden />;
  return (
    <button className="tree-toggle" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${name}`} disabled={disabled} onClick={onClick}>
      {open ? "▾" : "▸"}
    </button>
  );
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function keep(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Blocked storage: it just isn't remembered.
  }
}
function readFolded(key: string): string[] {
  try {
    const v: unknown = JSON.parse(stored(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The tree's rows: siblings in the list's sort order, folded branches hidden. While filtering,
 * `shown` holds the matches: they show with what they sit under (dimmed), everything open.
 */
function FoodTreeRows({
  nodes,
  order,
  shown,
  folded,
  onFold,
}: {
  nodes: FoodNode[];
  order: Map<string, number>;
  shown: Set<string> | null;
  folded: Set<string>;
  onFold: (id: string) => void;
}) {
  const { view } = useData();
  const has = new Map<string, boolean>();
  const visible = (n: FoodNode): boolean => {
    if (!shown) return true;
    let v = has.get(n.food.id);
    if (v === undefined) has.set(n.food.id, (v = shown.has(n.food.id) || n.kids.some(visible)));
    return v;
  };
  const out: ReactNode[] = [];
  const walk = (ns: FoodNode[], depth: number) => {
    const sorted = [...ns].sort((a, b) => (order.get(a.food.id) ?? 0) - (order.get(b.food.id) ?? 0));
    for (const n of sorted) {
      if (!visible(n)) continue;
      const x = n.food;
      const open = !!shown || !folded.has(x.id);
      const own = view.productsOf(x.id).length;
      out.push(
        <tr key={x.id} className={shown && !shown.has(x.id) ? "context" : undefined}>
          <td>
            <span className="tree-cell" style={{ "--depth": depth } as CSSProperties}>
              <TreeToggle name={x.name} open={open} can={n.kids.length > 0} disabled={!!shown} onClick={() => onFold(x.id)} />
              <A href={pathOf("foods", x.id)} className="strong">
                {x.name}
              </A>
              {n.form && <span className="muted small">form</span>}
              {x.staple && <span className="staple-mark">★</span>}
            </span>
          </td>
          <td className="num" title={n.total > own ? `${own} of its own, ${n.total} with its kinds` : undefined}>
            {own || ""}
            {n.total > own && <span className="muted small"> ({n.total})</span>}
          </td>
          <td className="num">{view.recipesUsing(x.id).length || ""}</td>
        </tr>,
      );
      if (open) walk(n.kids, depth + 1);
    }
  };
  walk(nodes, 0);
  return <>{out}</>;
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
        // "pickles" finds every pickle product, whatever kind of pickle its food is.
        return (
          (match(productName(p), f) || view.foodPath(p.foodId).some((x) => match(x.name, f))) &&
          (!store || p.storeIds.includes(store)) &&
          ratingOk(p.rating, rating)
        );
      }),
    [view, f, store, rating],
  );
  const { sorted, th } = useSort(rows, {
    rating: { value: (p) => rank(p.rating), desc: true },
    name: { value: (p) => productName(p) },
    // By the whole path, so kinds of the same food sort together (all the pickles, then …).
    food: { value: (p) => pathText(view.foodPath(p.foodId)) },
    stores: { value: (p) => p.storeIds.map((s) => view.store(s)?.name).filter(Boolean).join(", ") },
    bought: { value: (p) => view.done(p.id, "bought").last, desc: true },
  });
  // Tree: foods as folding headings, each product under its food (DESIGN.md §5.3).
  const { tree, folded, fold, toggle } = useTreeState("products");
  const nodes = useMemo(() => view.foodTree(), [view]);
  const filtering = !!f.trim() || !!store || !!rating;
  return (
    <ListShell
      title="Products"
      icon={KIND_ICON.products}
      count={rows.length}
      add={() => openQuickAdd({ kind: "products", storeIds: store ? [store] : [] })}
      empty="No products match."
      filters={
        <>
          <TreeSwitch kind="products" tree={tree} />
          <select className="select" value={store ?? ""} onChange={(e) => setQuery({ store: e.target.value || null })} aria-label="Store">
            <option value="">Any store</option>
            {view.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <RatingFilter />
          {tree && !filtering && (
            <FoldAll
              onExpand={() => fold(new Set())}
              onCollapse={() => fold(new Set([UNSORTED, ...view.foods.filter((x) => (totalsOf(nodes).get(x.id) ?? 0) > 0).map((x) => x.id)]))}
            />
          )}
        </>
      }
      head={
        <tr>
          {th("rating", "❤️", "rate-col", "Rating")}
          {th("name", "Product")}
          {!tree && th("food", "Food", "hide-sm")}
          {th("stores", "Sold at", "hide-sm")}
          {th("bought", "Last bought", "hide-sm")}
        </tr>
      }
    >
      {tree ? (
        <ProductTreeRows nodes={nodes} products={sorted} openAll={filtering} folded={folded} onFold={toggle} />
      ) : (
        sorted.map((p) => {
        const path = view.foodPath(p.foodId);
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
              {path.length > 0 && <div className="show-sm muted small">{pathText(shortPath(path))}</div>}
            </td>
            <td className="hide-sm">
              <FoodPath path={path} />
            </td>
            <td className="hide-sm muted">{p.storeIds.map((s) => view.store(s)?.name).filter(Boolean).join(", ")}</td>
            <td className="hide-sm muted">
              <LastDone view={view} id={p.id} kind="bought" />
            </td>
          </tr>
        );
        })
      )}
    </ListShell>
  );
}

const UNSORTED = "unsorted";
const totalsOf = (nodes: FoodNode[]) => {
  const m = new Map<string, number>();
  const walk = (ns: FoodNode[]) => ns.forEach((n) => (m.set(n.food.id, n.total), walk(n.kids)));
  walk(nodes);
  return m;
};

/**
 * Products as a tree: each food a folding heading with how many products are under it, its kinds
 * first, then its own products (in the list's sort order). Foods with nothing showing are left
 * out; products without a food go last, under Unsorted. `openAll` while filtering.
 */
function ProductTreeRows({
  nodes,
  products,
  openAll,
  folded,
  onFold,
}: {
  nodes: FoodNode[];
  products: Product[];
  openAll: boolean;
  folded: Set<string>;
  onFold: (id: string) => void;
}) {
  const { view } = useData();
  const byFood = new Map<string, Product[]>();
  for (const p of products) {
    const f = view.food(p.foodId);
    const key = f && !f.deleted ? f.id : UNSORTED;
    byFood.set(key, [...(byFood.get(key) ?? []), p]);
  }
  const counts = new Map<string, number>();
  const count = (n: FoodNode): number => {
    let c = counts.get(n.food.id);
    if (c === undefined) counts.set(n.food.id, (c = (byFood.get(n.food.id)?.length ?? 0) + n.kids.reduce((s, k) => s + count(k), 0)));
    return c;
  };
  const out: ReactNode[] = [];
  const heading = (id: string, name: ReactNode, label: string, n: number, depth: number, open: boolean) =>
    out.push(
      <tr key={`h:${id}`} className="group-row">
        <td colSpan={4}>
          <span className="tree-cell" style={{ "--depth": depth } as CSSProperties}>
            <TreeToggle name={label} open={open} can disabled={openAll} onClick={() => onFold(id)} />
            {name}
            <span className="muted small">{n}</span>
          </span>
        </td>
      </tr>,
    );
  const items = (ps: Product[], depth: number) => {
    for (const p of ps)
      out.push(
        <tr key={p.id}>
          <td className="rate-col">
            <RatingMark value={p.rating} />
          </td>
          <td>
            <span className="tree-cell" style={{ "--depth": depth } as CSSProperties}>
              <A href={pathOf("products", p.id)} className="strong">
                {productName(p)}
              </A>
              {p.glutenFree === "no" && <NotGF />}
            </span>
          </td>
          <td className="hide-sm muted">{p.storeIds.map((s) => view.store(s)?.name).filter(Boolean).join(", ")}</td>
          <td className="hide-sm muted">
            <LastDone view={view} id={p.id} kind="bought" />
          </td>
        </tr>,
      );
  };
  const walk = (ns: FoodNode[], depth: number) => {
    for (const n of ns) {
      const c = count(n);
      if (!c) continue;
      const open = openAll || !folded.has(n.food.id);
      heading(
        n.food.id,
        <A href={pathOf("foods", n.food.id)} className="strong">
          {n.food.name}
        </A>,
        n.food.name,
        c,
        depth,
        open,
      );
      if (!open) continue;
      walk(n.kids, depth + 1);
      items(byFood.get(n.food.id) ?? [], depth + 1);
    }
  };
  walk(nodes, 0);
  const loose = byFood.get(UNSORTED);
  if (loose) {
    const open = openAll || !folded.has(UNSORTED);
    heading(UNSORTED, <span className="strong">Unsorted</span>, "Unsorted", loose.length, 0, open);
    if (open) items(loose, 1);
  }
  return <>{out}</>;
}

const pathText =(path: { name: string }[]) => path.map((x) => x.name).join(" › ");
// Shown without the top (the aisle-like "Canned and jarred goods") once there are three levels;
// sorting still uses the whole path.
const shortPath = <T,>(path: T[]) => (path.length > 2 ? path.slice(1) : path);

/** "Pickles › Baby pickles": what it's under muted, the food itself in link color. */
function FoodPath({ path }: { path: Food[] }) {
  const shown = shortPath(path);
  return (
    <span className="food-path" title={path.length > shown.length ? pathText(path) : undefined}>
      {shown.map((x, i) => (
        <span key={x.id} className={i < shown.length - 1 ? "muted" : undefined}>
          <A href={pathOf("foods", x.id)}>{x.name}</A>
          {i < shown.length - 1 && " › "}
        </span>
      ))}
    </span>
  );
}

export function RecipesList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const tag = query.get("tag");
  const rating = query.get("rating");
  const status = query.get("status");
  const rows = useMemo(
    () =>
      view.recipes.filter(
        (r) =>
          (match(r.name, f) || r.ingredients.some((i) => match(view.food(i.foodId)?.name ?? i.line, f))) &&
          (!tag || r.tagIds.includes(tag)) &&
          ratingOk(r.rating, rating) &&
          (!status || r.status === status),
      ),
    [view, f, tag, rating, status],
  );
  const { sorted, th } = useSort(rows, {
    rating: { value: (r) => rank(r.rating), desc: true },
    name: { value: (r) => r.name },
    ingredients: { value: (r) => r.ingredients.length, desc: true },
    method: { value: (r) => (r.method ? METHOD_LABEL[r.method] : null) },
    min: { value: (r) => (r.prepMin ?? 0) + (r.cookMin ?? 0) },
    made: { value: (r) => view.done(r.id, "made").last, desc: true },
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
          <select className="select" value={status ?? ""} onChange={(e) => setQuery({ status: e.target.value || null })} aria-label="Tried">
            <option value="">Tried or not</option>
            {[...STATUSES].reverse().map((x) => (
              <option key={x} value={x}>
                {STATUS_LABEL[x]}
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
          {th("made", "Last made", "hide-sm")}
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
          </td>
          <td className="hide-sm muted small clip">{r.ingredients.length || ""}</td>
          <td className="hide-sm muted">{r.method ? METHOD_LABEL[r.method] : ""}</td>
          <td className="hide-sm num">{(r.prepMin ?? 0) + (r.cookMin ?? 0) || ""}</td>
          <td className="hide-sm muted">
            <LastDone view={view} id={r.id} kind="made" />
          </td>
        </tr>
      ))}
    </ListShell>
  );
}

/** Tags (DESIGN.md §5.10): meal tags are fixed; personal ones rename, merge and delete here. */
export function TagsList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const rows = useMemo(() => view.tags.filter((t) => match(t.name, f)), [view, f]);
  const uses = (t: Tag) => view.tagged(t.id).length;
  const { sorted, th } = useSort(rows, {
    name: { value: (t) => (t.kind === "meal" ? "" : t.name) }, // meal tags stay first, in their order
    uses: { value: uses, desc: true },
  });
  const [merging, setMerging] = useState<{ tag: Tag; into: Tag } | null>(null);
  // A rename that lands on another tag's name is a merge; cancelling it puts the old name back.
  // Opened after the key: the Enter that committed the name would otherwise press Cancel.
  const [reset, setReset] = useState(0);
  const rename = (t: Tag, name: string) => {
    const other = view.findTag(name);
    if (other && other.id !== t.id) setTimeout(() => setMerging({ tag: t, into: other }));
    else renameTag(t, name);
  };
  // A tag is just a name with no page, so + Add asks for it here and stays open for the next.
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const create = () => {
    if (!name.trim()) return;
    const had = view.findTag(name);
    ensureTag(name);
    if (had) showToast(`“${had.name}” is already a tag`);
    setName("");
  };
  return (
    <ListShell
      title="Tags"
      icon="🏷️"
      count={rows.length}
      add={() => setAdding(true)}
      filters={
        adding && (
          <span className="inline">
            <input
              className="input"
              placeholder="Tag name"
              aria-label="New tag"
              autoFocus
              value={name}
              enterKeyHint="done"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                else if (e.key === "Escape") setAdding(false);
              }}
            />
            <button className="btn primary" disabled={!name.trim()} onClick={create}>
              Add
            </button>
            <button className="btn subtle" onClick={() => setAdding(false)}>
              Done
            </button>
          </span>
        )
      }
      empty="No tags match."
      head={
        <tr>
          {th("name", "Tag")}
          {th("uses", "Used", "num", "Used on")}
          <th className="tag-actions" aria-label="Merge or delete" />
        </tr>
      }
    >
      {sorted.map((t) => {
        const n = uses(t);
        const meal = t.kind === "meal";
        return (
          <tr key={t.id}>
            <td>
              {meal ? (
                <span className="strong">
                  {t.name} <span className="muted small">meal</span>
                </span>
              ) : (
                <DraftInput key={`${t.id}-${reset}`} className="input cell-input" value={t.name} required aria-label="Tag name" onCommit={(name) => rename(t, name)} />
              )}
            </td>
            <td className="num">
              {n ? (
                <A href={meal ? `/eat?tag=${t.id}` : `/?q=${encodeURIComponent(t.name)}`}>{n}</A>
              ) : (
                <span className="muted">0</span>
              )}
            </td>
            <td className="tag-actions">
              {!meal && (
                <span className="inline">
                  <select
                    className="select small"
                    value=""
                    aria-label={`Merge “${t.name}” into`}
                    onChange={(e) => {
                      const into = view.tag(e.target.value);
                      if (into) setMerging({ tag: t, into });
                    }}
                  >
                    <option value="">Merge…</option>
                    {view.tags
                      .filter((o) => o.id !== t.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                  <button className="btn icon subtle" aria-label={`Delete “${t.name}”`} title="Delete" onClick={() => deleteTag(t)}>
                    ✕
                  </button>
                </span>
              )}
            </td>
          </tr>
        );
      })}
      {merging && (
        <ConfirmDialog
          title={`Merge “${merging.tag.name}” into “${merging.into.name}”?`}
          confirm="Merge"
          onCancel={() => {
            setMerging(null);
            setReset((r) => r + 1);
          }}
          onConfirm={() => {
            mergeTag(merging.tag, merging.into);
            setMerging(null);
          }}
        >
          <p>
            {uses(merging.tag)
              ? `${uses(merging.tag)} thing${uses(merging.tag) === 1 ? "" : "s"} tagged “${merging.tag.name}” get “${merging.into.name}” instead.`
              : `Nothing is tagged “${merging.tag.name}”, so it just goes.`}
          </p>
        </ConfirmDialog>
      )}
    </ListShell>
  );
}

/** "Oct 20 (3×)": the last time, and how many times when more than once. */
function LastDone({ view, id, kind }: { view: View; id: string; kind: "made" | "bought" | "ate" }) {
  const { count, last } = view.done(id, kind);
  if (!last) return null;
  return (
    <span title={`${kind} ${count}×`}>
      {fmtDate(last)}
      {count > 1 && <span className="small"> ({count}×)</span>}
    </span>
  );
}

/** A row of pills that filter by one field, kept in the address (?type=restaurant). Tap again to clear. */
function Pills<T extends string>({ param, options, labels }: { param: string; options: readonly T[]; labels: Record<T, string> }) {
  const { query } = useRoute();
  const on = query.get(param);
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={`chip small ${on === o ? "chip-on" : ""}`} aria-pressed={on === o} onClick={() => setQuery({ [param]: on === o ? null : o })}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

export function PlacesList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const type = query.get("type");
  const speed = query.get("speed");
  const cost = query.get("cost");
  const status = query.get("status");
  const rows = useMemo(
    () =>
      view.stores.filter(
        (s) =>
          match(s.name, f) &&
          (!type || s.types.includes(type as PlaceType)) &&
          (!speed || s.speed === speed) &&
          (!cost || s.cost === cost) &&
          (!status || s.status === status),
      ),
    [view, f, type, speed, cost, status],
  );
  const { sorted, th } = useSort(rows, {
    rating: { value: (s) => rank(s.rating), desc: true },
    name: { value: (s) => s.name },
    type: { value: (s) => s.types.map((t) => PLACE_TYPE_LABEL[t]).join(", ") },
    cost: { value: (s) => (s.cost ? Number(s.cost) : null) },
    dishes: { value: (s) => view.dishesAt(s.id).length, desc: true },
    products: { value: (s) => view.productsAt(s.id).length, desc: true },
  });
  // A place starts as just a name, so + Add asks for it right here instead of in Quick add.
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const create = () => {
    if (!name.trim()) return;
    // An existing place by that name opens instead; a new one gets the type being filtered on.
    const id = ensureStore(name, type ? { types: [type as PlaceType] } : {});
    setName("");
    setAdding(false);
    go(pathOf("stores", id));
  };
  const filtered = !!(type || speed || cost || status);
  return (
    <ListShell
      title="Places"
      icon={KIND_ICON.stores}
      count={rows.length}
      add={() => setAdding(true)}
      filters={
        adding ? (
          <span className="inline">
            <input
              className="input"
              aria-label="New place"
              autoFocus
              value={name}
              enterKeyHint="done"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                else if (e.key === "Escape") setAdding(false);
              }}
            />
            <button className="btn primary" disabled={!name.trim()} onClick={create}>
              Add
            </button>
            <button className="btn subtle" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <>
            <Pills param="type" options={PLACE_TYPES} labels={PLACE_TYPE_LABEL} />
            <Pills param="speed" options={SPEEDS} labels={SPEED_LABEL} />
            <Pills param="cost" options={COSTS} labels={COST_LABEL} />
            <Pills param="status" options={STATUSES} labels={PLACE_STATUS_LABEL} />
            {filtered && (
              <button className="btn subtle" onClick={() => setQuery({ type: null, speed: null, cost: null, status: null })}>
                Clear filters
              </button>
            )}
          </>
        )
      }
      empty={filtered || f ? "No places match." : "No places yet: + Add one, or from a product's Sold at."}
      head={
        <tr>
          {th("rating", "❤️", "rate-col", "Rating")}
          {th("name", "Place")}
          {th("type", "Type", "hide-sm")}
          {th("cost", "$", "hide-sm", "Cost")}
          {th("dishes", "Dishes", "num")}
          {th("products", "Products", "num")}
        </tr>
      }
    >
      {sorted.map((s) => (
        <tr key={s.id}>
          <td className="rate-col">
            <RatingMark value={s.rating} />
          </td>
          <td>
            <A href={pathOf("stores", s.id)} className="strong">
              {s.name}
            </A>
            {s.status === "want" && <span className="muted small"> · want to go</span>}
          </td>
          <td className="hide-sm muted">
            {s.types.map((t) => PLACE_TYPE_LABEL[t]).join(", ")}
            {s.speed && <span className="small"> · {SPEED_LABEL[s.speed]}</span>}
          </td>
          <td className="hide-sm muted">{s.cost ? COST_LABEL[s.cost] : ""}</td>
          <td className="num">{view.dishesAt(s.id).length || ""}</td>
          <td className="num">{view.productsAt(s.id).length || ""}</td>
        </tr>
      ))}
    </ListShell>
  );
}

export function DishesList() {
  const { view } = useData();
  const { query } = useRoute();
  const f = query.get("f") ?? "";
  const rating = query.get("rating");
  const status = query.get("status");
  const placeName = (placeId: string | null) => {
    const p = placeId ? view.store(placeId) : undefined;
    return p && !p.deleted ? p.name : "";
  };
  const rows = useMemo(
    () => view.dishes.filter((d) => (match(d.name, f) || match(placeName(d.placeId), f)) && ratingOk(d.rating, rating) && (!status || d.status === status)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, f, rating, status],
  );
  const { sorted, th } = useSort(rows, {
    rating: { value: (d) => rank(d.rating), desc: true },
    name: { value: (d) => d.name },
    place: { value: (d) => placeName(d.placeId) },
    gf: { value: (d) => GF_LABEL[d.glutenFree] },
    ate: { value: (d) => view.done(d.id, "ate").last, desc: true },
  });
  return (
    <ListShell
      title="Dishes"
      icon={KIND_ICON.dishes}
      count={rows.length}
      add={() => openQuickAdd({ kind: "dishes" })}
      empty={view.dishes.length ? "No dishes match." : "No dishes yet: + Add one, or from a place's page."}
      filters={
        <>
          <select className="select" value={status ?? ""} onChange={(e) => setQuery({ status: e.target.value || null })} aria-label="Tried">
            <option value="">Tried or not</option>
            {[...STATUSES].reverse().map((x) => (
              <option key={x} value={x}>
                {STATUS_LABEL[x]}
              </option>
            ))}
          </select>
          <RatingFilter />
        </>
      }
      head={
        <tr>
          {th("rating", "❤️", "rate-col", "Rating")}
          {th("name", "Dish")}
          {th("place", "Place")}
          {th("gf", "Gluten-free", "hide-sm")}
          {th("ate", "Last ate", "hide-sm")}
        </tr>
      }
    >
      {sorted.map((d) => (
        <tr key={d.id}>
          <td className="rate-col">
            <RatingMark value={d.rating} />
          </td>
          <td>
            <A href={pathOf("dishes", d.id)} className="strong">
              {d.name}
            </A>
            {d.glutenFree === "no" && <NotGF />}
          </td>
          <td className="muted">{d.placeId && placeName(d.placeId) ? <A href={pathOf("stores", d.placeId)}>{placeName(d.placeId)}</A> : ""}</td>
          <td className="hide-sm muted">{d.glutenFree !== "no" ? GF_LABEL[d.glutenFree] : ""}</td>
          <td className="hide-sm muted">
            <LastDone view={view} id={d.id} kind="ate" />
          </td>
        </tr>
      ))}
    </ListShell>
  );
}
