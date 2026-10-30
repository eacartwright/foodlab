import { MEAL_TAGS, mealNow, mealTimes } from "@foodlab/shared";
import { useMemo } from "react";
import { A, setQuery, useRoute } from "../router";
import { useData } from "../sync";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow } from "./rows";

// What can I eat? (DESIGN.md §5.2): recipes and products for a meal, best first. It opens on
// the meal for the time of day (Settings → Meal times); a picked meal stays in the address.

export function EatPage() {
  const { view } = useData();
  const { query } = useRoute();
  let tag = query.get("tag");
  if (!tag || !MEAL_TAGS.some((t) => t.id === tag)) tag = mealNow(mealTimes(view.state));
  const want = query.get("status");
  const showDown = query.get("down") === "1";

  const items = useMemo(
    () => view.eat({ tagId: tag, status: want === "want" || want === "tried" ? want : null, showDown }),
    [view, tag, want, showDown],
  );

  const setTag = (t: string) => setQuery({ tag: t });
  const filtered = !!want;

  return (
    <div className="page">
      <h1 className="page-title">What can I eat?</h1>
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

      {items.length ? (
        <div className="rows">
          {items.map(({ kind, item }) => (
            <ItemRow key={item.id} view={view} kind={kind} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>Nothing {filtered ? "matches those filters" : `tagged ${MEAL_TAGS.find((t) => t.id === tag)?.name}`} yet.</p>
          <p className="small">
            Tag a recipe or product with it, or{" "}
            <button className="btn subtle" onClick={() => openQuickAdd({ kind: "products" })}>
              + add one
            </button>
            {" "}(pick “{MEAL_TAGS.find((t) => t.id === tag)?.name}” under For). <A href="/products">All products</A>
          </p>
        </div>
      )}
    </div>
  );
}
