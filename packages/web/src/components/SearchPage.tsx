import { MEAL_TAGS, SEARCH_KINDS, type SearchGroups } from "@foodlab/shared";
import { useMemo } from "react";
import { A, setQuery, useRoute } from "../router";
import { mealNow } from "../mealTimes";
import { useData } from "../sync";
import { KIND_ICON } from "./controls";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow, Section } from "./rows";

// Home: one box over everything (DESIGN.md §5.1). "breakfast + lemon + potato" = all three.

const GROUP_TITLE = { recipes: "Recipes", products: "Products", foods: "Foods", stores: "Stores" } as const;
const finePointer = typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches;

export function SearchPage() {
  const { view, loaded } = useData();
  const { query } = useRoute();
  const q = query.get("q") ?? "";
  const results = useMemo(() => view.search(q), [view, q]);
  const now = mealNow();
  const partial = SEARCH_KINDS.reduce((n, k) => n + results.partial[k].length, 0);

  return (
    <div className="page search-page">
      <div className="search-box">
        <input
          className="input big"
          type="search"
          autoFocus={finePointer}
          enterKeyHint="search"
          placeholder="Search everything…  (breakfast + lemon + potato)"
          aria-label="Search"
          value={q}
          onChange={(e) => setQuery({ q: e.target.value })}
        />
      </div>
      <div className="add-row">
        <button className="btn" onClick={() => openQuickAdd({ kind: "products" })}>
          + {KIND_ICON.products} Product
        </button>
        <button className="btn" onClick={() => openQuickAdd({ kind: "recipes" })}>
          + {KIND_ICON.recipes} Recipe
        </button>
        <button className="btn" onClick={() => openQuickAdd({ kind: "foods" })}>
          + {KIND_ICON.foods} Food
        </button>
      </div>

      {!results.terms.length ? (
        <>
          <Section title="What can I eat?">
            <div className="chips">
              {MEAL_TAGS.map((t) => (
                <A key={t.id} className={`chip ${t.id === now ? "chip-on" : ""}`} href={`/eat?tag=${t.id}`}>
                  {t.name}
                </A>
              ))}
            </div>
          </Section>
          <Section title="Recently changed">
            {view.recent().length ? (
              <div className="rows">{view.recent().map(({ kind, item }) => <ItemRow key={item.id} view={view} kind={kind} item={item} />)}</div>
            ) : (
              <p className="empty-line">{loaded ? "Nothing yet. Start with what you'd bring for lunch: + Product or + Recipe." : "Loading…"}</p>
            )}
          </Section>
        </>
      ) : (
        <>
          {results.terms.length > 1 && (
            <p className="muted small">
              Matching all of: {results.terms.map((t, n) => (
                <span key={n} className="term">
                  {t}
                </span>
              ))}
            </p>
          )}
          <Groups view={view} groups={results.full} />
          {results.count === 0 && (
            <div className="empty">
              Nothing matches {results.terms.length > 1 ? "all of those" : `“${q.trim()}”`}.{" "}
              <button className="btn subtle" onClick={() => openQuickAdd({ name: q.replace(/\+/g, " ").replace(/\s+/g, " ").trim() })}>
                + Add “{q.replace(/\+/g, " ").replace(/\s+/g, " ").trim()}”
              </button>
            </div>
          )}
          {partial > 0 && (
            <>
              <h2 className="subhead">Partial matches</h2>
              <Groups view={view} groups={results.partial} terms={results.terms.length} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Groups({ view, groups, terms }: { view: ReturnType<typeof useData>["view"]; groups: SearchGroups; terms?: number }) {
  return (
    <>
      {SEARCH_KINDS.map((k) =>
        groups[k].length ? (
          <Section key={k} title={GROUP_TITLE[k]} count={groups[k].length}>
            <div className="rows">
              {groups[k].slice(0, 50).map((h) => (
                <ItemRow
                  key={h.item.id}
                  view={view}
                  kind={k}
                  item={h.item}
                  showKind={false}
                  extra={terms ? <span className="row-sub muted">{h.hits} of {terms}</span> : undefined}
                />
              ))}
            </div>
            {groups[k].length > 50 && <p className="muted small">…and {groups[k].length - 50} more. Add a term with + to narrow it.</p>}
          </Section>
        ) : null,
      )}
    </>
  );
}
