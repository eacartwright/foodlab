import {
  COST_LABEL,
  PLACE_TYPE_LABEL,
  fileUrl,
  RATING_EMOJI,
  nameOf,
  type Dish,
  type Food,
  type Product,
  type Recipe,
  type SearchKind,
  type Store,
  type View,
} from "@foodlab/shared";
import type { ReactNode } from "react";
import { A, pathOf } from "../router";
import { KIND_ICON, KIND_ONE } from "./controls";

// One line per thing, used by search, Eat, lists and pages.

type Item = Food | Product | Recipe | Store | Dish;

export function Rating({ value }: { value: Product["rating"] }) {
  return value ? (
    <span className="rating" aria-label={value}>
      {RATING_EMOJI[value]}
    </span>
  ) : null;
}

/** What to show under a thing's name. */
export function subline(view: View, kind: SearchKind, item: Item, hideFood = false): ReactNode {
  if (kind === "recipes") return "";
  if (kind === "dishes") {
    if (hideFood) return ""; // under its place already
    const place = (item as Dish).placeId ? view.store((item as Dish).placeId!) : undefined;
    return place && !place.deleted ? `at ${place.name}` : "";
  }
  if (kind === "products") {
    const p = item as Product;
    const food = view.food(p.foodId);
    const stores = p.storeIds.map((s) => view.store(s)?.name).filter(Boolean);
    return [food && !food.deleted && !hideFood ? food.name : null, stores.length ? `at ${stores.join(", ")}` : null].filter(Boolean).join(" · ");
  }
  if (kind === "foods") {
    const f = item as Food;
    const up = [view.food(f.parentId), view.food(f.formOfId)].filter((x) => x && !x.deleted).map((x, i) =>
      i === 0 && f.parentId ? `a kind of ${x!.name}` : `a form of ${x!.name}`,
    );
    const products = view.productsOf(f.id).length;
    const recipes = view.recipesUsing(f.id).length;
    return [
      ...up,
      products ? `${products} product${products === 1 ? "" : "s"}` : null,
      recipes ? `in ${recipes} recipe${recipes === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const s = item as Store;
  const n = view.productsAt(s.id).length;
  const d = view.dishesAt(s.id).length;
  return [
    s.types.map((t) => PLACE_TYPE_LABEL[t]).join(", ") || null,
    s.cost ? COST_LABEL[s.cost] : null,
    n ? `${n} product${n === 1 ? "" : "s"}` : null,
    d ? `${d} dish${d === 1 ? "" : "es"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ItemRow({
  view,
  kind,
  item,
  extra,
  showKind = true,
  hideFood = false,
  noSub = false,
}: {
  view: View;
  kind: SearchKind;
  item: Item;
  extra?: ReactNode;
  showKind?: boolean;
  hideFood?: boolean;
  /** Just the name: no second line (Recently changed). */
  noSub?: boolean;
}) {
  const eating = kind === "recipes" || kind === "products" || kind === "dishes" ? (item as Product | Recipe | Dish) : null;
  const rated = eating ?? (kind === "stores" ? (item as Store) : null);
  const sub = noSub ? "" : subline(view, kind, item, hideFood);
  return (
    <A className={`row ${item.deleted ? "is-deleted" : ""}`} href={pathOf(kind, item.id)}>
      {/* Its main photo, when it has one: quicker to recognize than the name. */}
      {eating?.photos[0] ? (
        <img className="row-thumb" src={fileUrl(eating.photos[0].thumb)} alt="" loading="lazy" />
      ) : (
        showKind && (
          <span className="row-icon" title={KIND_ONE[kind]} aria-label={KIND_ONE[kind]}>
            {KIND_ICON[kind]}
          </span>
        )
      )}
      <span className="row-main">
        <span className="row-name">
          {nameOf(item)}
          {kind === "foods" && (item as Food).staple && (
            <span className="staple-mark" title="Staple">
              ★
            </span>
          )}
          {kind !== "recipes" && eating?.glutenFree === "no" && <NotGF />}
        </span>
        {sub && <span className="row-sub">{sub}</span>}
        {extra}
      </span>
      {rated && <Rating value={rated.rating} />}
    </A>
  );
}

/** On someone else's food: never in Eat, flagged everywhere else. */
export function NotGF() {
  return (
    <span className="badge badge-warn" title="Not gluten-free">
      not GF
    </span>
  );
}

export function Section({ title, count, actions, children }: { title: string; count?: number; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h3>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}
