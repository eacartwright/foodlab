import { MEAL_TAGS, mealNow, mealTimes, type Dish, type Eatable, type Id, type Where } from "@foodlab/shared";
import { useMemo } from "react";
import { A, pathOf, setQuery, useRoute } from "../router";
import { useData } from "../sync";
import { Segmented } from "./controls";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow } from "./rows";

// What can I eat? (DESIGN.md §5.2): recipes and products for a meal at home, dishes at places
// out, best first. It opens on the meal for the time of day (Settings → Meal times) and on Home;
// a picked meal and Out / All stay in the address.

const WHERE = ["home", "out", "all"] as const;
const WHERE_LABEL: Record<Where, string> = { home: "Home", out: "Out", all: "All" };

export function EatPage() {
  const { view } = useData();
  const { query } = useRoute();
  let tag = query.get("tag");
  if (!tag || !MEAL_TAGS.some((t) => t.id === tag)) tag = mealNow(mealTimes(view.state));
  const want = query.get("status");
  const showDown = query.get("down") === "1";
  const w = query.get("where");
  const where: Where = w === "out" || w === "all" ? w : "home";

  const items = useMemo(
    () => view.eat({ where, tagId: tag, status: want === "want" || want === "tried" ? want : null, showDown }),
    [view, where, tag, want, showDown],
  );
  // Out: by place, the place with the best dish first (the list is already best first).
  const byPlace = useMemo(() => {
    if (where !== "out") return [];
    const groups = new Map<Id | "", Dish[]>();
    for (const e of items as Extract<Eatable, { kind: "dishes" }>[]) {
      const k = e.item.placeId && !view.store(e.item.placeId)?.deleted ? e.item.placeId : "";
      groups.set(k, [...(groups.get(k) ?? []), e.item]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
  }, [view, where, items]);

  const setTag = (t: string) => setQuery({ tag: t });
  const filtered = !!want;

  return (
    <div className="page">
      <div className="list-head">
        <h1 className="page-title">What can I eat?</h1>
        <span className="spacer" />
        <Segmented value={where} options={WHERE} labels={WHERE_LABEL} clearable={false} label="Where" onChange={(v) => setQuery({ where: v === "home" ? null : v })} />
      </div>
      <div className="chips meal-chips">
        {MEAL_TAGS.map((t) => (
          <button key={t.id} className={`chip ${t.id === tag ? "chip-on" : ""}`} aria-pressed={t.id === tag} onClick={() => setTag(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="chips">
          <button className={`chip small ${want === "want" ? "chip-on" : ""}`} onClick={() => setQuery({ status: want === "want" ? null : "want" })}>
            Want to try
          </button>
          <button className={`chip small ${want === "tried" ? "chip-on" : ""}`} onClick={() => setQuery({ status: want === "tried" ? null : "tried" })}>
            Tried
          </button>
          <button className={`chip small ${showDown ? "chip-on" : ""}`} onClick={() => setQuery({ down: showDown ? null : "1" })}>
            Show 👎
          </button>
          {filtered && (
            <button className="btn subtle" onClick={() => setQuery({ status: null })}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {items.length && where === "out" ? (
        byPlace.map(([placeId, dishes]) => (
          <div key={placeId} className="group">
            <div className="group-title">{placeId ? <A href={pathOf("stores", placeId)}>{view.store(placeId)!.name}</A> : "No place"}</div>
            <div className="rows">
              {dishes.map((d) => (
                <ItemRow key={d.id} view={view} kind="dishes" item={d} showKind={false} hideFood />
              ))}
            </div>
          </div>
        ))
      ) : items.length ? (
        <div className="rows">
          {items.map(({ kind, item }) => (
            <ItemRow key={item.id} view={view} kind={kind} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>Nothing {filtered ? "matches those filters" : `tagged ${MEAL_TAGS.find((t) => t.id === tag)?.name}`} yet.</p>
          <p className="small">
            Tag {where === "out" ? "a dish" : "a recipe or product"} with it, or{" "}
            <button className="btn subtle" onClick={() => openQuickAdd({ kind: where === "out" ? "dishes" : "products" })}>
              + add one
            </button>
            {" "}(pick “{MEAL_TAGS.find((t) => t.id === tag)?.name}” under For). {where === "out" ? <A href="/places">All places</A> : <A href="/products">All products</A>}
          </p>
        </div>
      )}
    </div>
  );
}
