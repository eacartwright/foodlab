import { EFFORTS, EFFORT_LABEL, MEAL_TAGS, TRAVELS, TRAVELS_LABEL, WORK_LUNCH, type Effort, type Travels } from "@foodlab/shared";
import { useMemo } from "react";
import { A, setQuery, useRoute } from "../router";
import { useData } from "../sync";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow } from "./rows";

// What can I eat? (DESIGN.md §5.2): recipes and products for a meal, best first.

const LAST_TAG = "foodlab:eat-tag";
const list = <T extends string>(s: string | null, ok: readonly T[]) => (s ? (s.split(",").filter((x) => ok.includes(x as T)) as T[]) : []);

export function EatPage() {
  const { view } = useData();
  const { query } = useRoute();
  let tag = query.get("tag");
  if (!tag) {
    try {
      tag = localStorage.getItem(LAST_TAG);
    } catch {
      // Storage blocked.
    }
  }
  if (!tag || !MEAL_TAGS.some((t) => t.id === tag)) tag = WORK_LUNCH;
  const travels = list<Travels>(query.get("travels"), TRAVELS);
  const effort = list<Effort>(query.get("effort"), EFFORTS);
  const keeps = Number(query.get("keeps")) || null;
  const gf = query.get("gf") === "1";
  const want = query.get("status");
  const showDown = query.get("down") === "1";
  const lunch = tag === WORK_LUNCH;

  const items = useMemo(
    () =>
      view.eat({
        tagId: tag,
        travels: lunch ? travels : [],
        effort: lunch ? effort : [],
        minKeepsDays: lunch ? keeps : null,
        glutenFree: gf,
        status: want === "want" || want === "tried" ? want : null,
        showDown,
      }),
    [view, tag, lunch, travels.join(), effort.join(), keeps, gf, want, showDown], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setTag = (t: string) => {
    try {
      localStorage.setItem(LAST_TAG, t);
    } catch {
      // Not remembered.
    }
    setQuery({ tag: t });
  };
  const toggle = (key: string, values: string[], v: string) =>
    setQuery({ [key]: (values.includes(v) ? values.filter((x) => x !== v) : [...values, v]).join(",") || null });
  const filtered = travels.length || effort.length || keeps || gf || want;

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
        {lunch && (
          <>
            <div className="chips">
              {TRAVELS.map((t) => (
                <button key={t} className={`chip small ${travels.includes(t) ? "chip-on" : ""}`} onClick={() => toggle("travels", travels, t)}>
                  {TRAVELS_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="chips">
              {EFFORTS.map((e) => (
                <button key={e} className={`chip small ${effort.includes(e) ? "chip-on" : ""}`} onClick={() => toggle("effort", effort, e)}>
                  {EFFORT_LABEL[e]}
                </button>
              ))}
              <select className="select small" value={keeps ?? ""} onChange={(e) => setQuery({ keeps: e.target.value || null })} aria-label="Keeps at least">
                <option value="">Keeps any time</option>
                {[2, 3, 4, 5, 7].map((d) => (
                  <option key={d} value={d}>
                    Keeps {d}+ days
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="chips">
          <button className={`chip small ${gf ? "chip-on" : ""}`} onClick={() => setQuery({ gf: gf ? null : "1" })}>
            Gluten-free
          </button>
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
            <button className="btn subtle" onClick={() => setQuery({ travels: null, effort: null, keeps: null, gf: null, status: null })}>
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
