import {
  GF_LABEL,
  METHODS,
  METHOD_LABEL,
  fileUrl,
  formatAmount,
  formatQuantity,
  ingredientsFromText,
  parseLine,
  scaleLine,
  scaleText,
  today,
  yieldText,
  type Id,
  type Recipe,
  type RecipeIngredient,
} from "@foodlab/shared";
import { useEffect, useState } from "react";
import { addLog, duplicate, ensureFood, remove, setIngredientFood } from "../actions";
import { Markdown } from "../markdown";
import { A, go, pathOf, setQuery, useRoute } from "../router";
import { data, put, useData } from "../sync";
import { showToast } from "../toast";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field, NumberInput, Picker, RatingInput, Segmented } from "./controls";
import { EatingFields, LogSection, doneText } from "./eating";
import { PhotoFromLink, PhotoViewer, Photos } from "./Photos";
import { Deleted, NotFound } from "./FoodPage";
import { lunchFacts, Section } from "./rows";

// A recipe has two faces (DESIGN.md §5.4): it reads like a recipe, and Edit shows its fields.

export function RecipePage({ id }: { id: string }) {
  const { state } = useData();
  const { query } = useRoute();
  const r = state.recipes[id];
  const fresh = !!r && !r.ingredients.length && !r.instructions;
  // A new recipe opens in Edit, and stays there until Done (the mode is in the address).
  useEffect(() => {
    if (fresh && !query.has("edit")) setQuery({ edit: "1" });
  }, [fresh, query]);
  if (!r) return <NotFound what="recipe" />;
  const editing = query.get("edit") === "1" || (fresh && query.get("edit") !== "0");
  return editing ? <RecipeEdit r={r} /> : <RecipeView key={r.id} r={r} />;
}

function RecipeView({ r }: { r: Recipe }) {
  const { view } = useData();
  const [open, setOpen] = useState<Id | null>(null);
  const [photo, setPhoto] = useState<number | null>(null);
  const updatePhotos = (fn: (ps: Recipe["photos"]) => Recipe["photos"]) => {
    const now = data().state.recipes[r.id] ?? r;
    put("recipes", { ...now, photos: fn(now.photos) });
  };
  // Opens at my usual size if I saved one, else as written. Scaling changes only what's shown.
  const [servings, setServings] = useState(r.myYield ?? r.yieldQty);
  const factor = r.yieldQty && servings ? servings / r.yieldQty : 1;
  const save = (patch: Partial<Recipe>) => put("recipes", { ...(data().state.recipes[r.id] ?? r), ...patch });
  const time = [r.prepMin ? `prep ${r.prepMin} min` : null, r.cookMin ? `cook ${r.cookMin} min` : null];
  const meta = [
    r.method ? METHOD_LABEL[r.method] : null,
    r.yieldQty === null && r.yieldUnit ? `makes ${r.yieldUnit}` : null,
    ...time,
    r.glutenFree !== "unknown" ? GF_LABEL[r.glutenFree] : null,
    doneText(view, r.id, "made") || null,
  ].filter(Boolean);
  const lunch = lunchFacts(r);
  // The first link is where the recipe came from: a button up top. Any others (a video, what it
  // was adapted from) go at the bottom.
  const [source, ...more] = r.links;
  const tags = r.tagIds.map((t) => view.tag(t)).filter((t) => t && !t.deleted);
  const madeToday = view.logOf(r.id).some((e) => e.kind === "made" && e.date === today());

  return (
    <article className="page recipe">
      {r.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <div className="page-kind">
        🍳 Recipe
        <span className="spacer" />
        <button className="btn" onClick={() => setQuery({ edit: "1" })}>
          ✏️ Edit
        </button>
      </div>
      <h1 className="recipe-title">{r.name}</h1>
      {r.photos.length > 0 && (
        <div className="recipe-photos">
          <button className="recipe-hero" onClick={() => setPhoto(0)} aria-label="Main photo">
            <img src={fileUrl(r.photos[0]!.id)} alt="" />
          </button>
          {r.photos.slice(1).map((p, i) => (
            <button key={p.id} className="photo-thumb" onClick={() => setPhoto(i + 1)} aria-label={`Photo ${i + 2}`}>
              <img src={fileUrl(p.thumb)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {photo !== null && r.photos[photo] && <PhotoViewer photos={r.photos} at={photo} setAt={setPhoto} update={updatePhotos} name={r.name} />}
      {meta.length > 0 && <p className="recipe-meta">{meta.join(" · ")}</p>}
      {r.yieldQty !== null && servings !== null && <Servings r={r} servings={servings} setServings={setServings} save={save} />}
      {(tags.length > 0 || lunch) && (
        <div className="chips">
          {tags.map((t) => (
            <A key={t!.id} className="tag" href={t!.kind === "meal" ? `/eat?tag=${t!.id}` : `/?q=${encodeURIComponent(t!.name)}`}>
              {t!.name}
            </A>
          ))}
          {lunch && <span className="muted small">{lunch}</span>}
        </div>
      )}
      <div className="recipe-actions">
        <RatingInput value={r.rating} onChange={(rating) => save({ rating })} size="big" />
        <button
          className="btn"
          disabled={madeToday}
          onClick={() => {
            addLog("recipes", r.id, "made", "");
            if (r.status === "want") save({ status: "tried" });
            showToast("Logged: made it today");
          }}
        >
          {madeToday ? "✓ Made today" : "Made it today"}
        </button>
        {source && (
          <a className="btn subtle" href={source} target="_blank" rel="noreferrer noopener" title={source}>
            🔗 {siteOf(source)} ↗
          </a>
        )}
      </div>

      <div className="recipe-body">
        <section className="ingredients">
          <h3>Ingredients</h3>
          {r.ingredients.length ? (
            <ul>
              {r.ingredients.map((i) => {
                const s = scaleLine(i.line, factor);
                return (
                <li key={i.id}>
                  <button className={`ing ${open === i.id ? "open" : ""} ${i.optional ? "optional" : ""}`} onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>
                    {s ? (
                      <>
                        {s.before}
                        <span className="scaled" title={s.approx ? "Rounded" : undefined}>
                          {s.approx && "≈ "}
                          {s.amount}
                        </span>
                        {s.after}
                      </>
                    ) : (
                      i.line
                    )}
                  </button>
                  {open === i.id && <IngredientCard r={r} i={i} />}
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-line">None yet.</p>
          )}
        </section>
        <section className="instructions">
          <h3>Instructions</h3>
          {r.instructions ? <Markdown text={r.instructions} plain={factor !== 1 ? (t, k) => scaledText(t, k, factor) : undefined} /> : <p className="empty-line">None yet.</p>}
        </section>
      </div>
      {r.notes && (
        <Section title="Notes">
          <Markdown text={r.notes} />
        </Section>
      )}
      {more.length > 0 && (
        <Section title="More links">
          <ul className="plain">
            {more.map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noreferrer noopener">
                  {l.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <LogSection itemKind="recipes" itemId={r.id} />
    </article>
  );
}

/** "bbcgoodfood.com" for a link to one of its pages; anything else as it is. */
const siteOf = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};

/** Tapping an ingredient: where else it's used, and fixing the link. */
function IngredientCard({ r, i }: { r: Recipe; i: RecipeIngredient }) {
  const { view } = useData();
  const [relink, setRelink] = useState(false);
  const food = view.food(i.foodId);
  const also = food ? view.recipesUsing(food.id).filter((x) => x.id !== r.id) : [];
  return (
    <div className="ing-card">
      {food ? (
        <>
          <div className="ing-card-head">
            <A href={pathOf("foods", food.id)} className="strong">
              {food.name}
            </A>
            {food.staple && <span className="staple-mark">★</span>}
            {[i.prep, i.note].filter(Boolean).length > 0 && <span className="muted small">{[i.prep, i.note].filter(Boolean).join("; ")}</span>}
          </div>
          {also.length > 0 && (
            <div className="small">
              Also in{" "}
              {also.slice(0, 5).map((x, n) => (
                <span key={x.id}>
                  {n > 0 && ", "}
                  <A href={pathOf("recipes", x.id)}>{x.name}</A>
                </span>
              ))}
              {also.length > 5 && ` and ${also.length - 5} more`}
            </div>
          )}
        </>
      ) : (
        <div className="muted small">Not linked to a food.</div>
      )}
      {relink ? (
        <Picker
          autoFocus
          value={i.foodId}
          options={view.foods.map((f) => ({ id: f.id, label: f.name }))}
          placeholder="Which food?"
          createLabel="New food"
          onChange={(foodId) => {
            setIngredientFood(r, i.id, foodId);
            setRelink(false);
          }}
          onCreate={(n) => ensureFood(n)}
        />
      ) : (
        <button className="btn subtle small-btn" onClick={() => setRelink(true)}>
          {food ? "Wrong food?" : "Link a food"}
        </button>
      )}
    </div>
  );
}

/** Instructions with their measured amounts scaled, marked like the ingredient lines. */
function scaledText(text: string, key: string, factor: number) {
  return scaleText(text, factor).map((p, n) =>
    typeof p === "string" ? (
      p
    ) : (
      <span key={`${key}-s${n}`} className="scaled" title={p.approx ? "Rounded" : undefined}>
        {p.approx && "≈ "}
        {p.amount}
      </span>
    ),
  );
}

/** −  4 servings  + , and Save when it's not my usual size. */
function Servings({ r, servings, setServings, save }: { r: Recipe; servings: number; setServings: (n: number) => void; save: (p: Partial<Recipe>) => void }) {
  const written = r.yieldQty!;
  const usual = r.myYield ?? written;
  // Whole steps, and a half below one ("½ loaf").
  const down = servings > 1 ? Math.ceil(servings - 1) : 0.5;
  const up = servings < 1 ? 1 : Math.floor(servings + 1);
  return (
    <div className="servings">
      makes
      <button className="btn icon subtle" onClick={() => setServings(down)} disabled={servings <= 0.5} aria-label="Fewer servings">
        −
      </button>
      <span className={servings !== written ? "scaled" : undefined}>{yieldText(servings, r.yieldUnit, written)}</span>
      <button className="btn icon subtle" onClick={() => setServings(up)} disabled={servings >= 1000} aria-label="More servings">
        +
      </button>
      {servings !== usual && (
        <button className="btn subtle" onClick={() => save({ myYield: servings === written ? null : servings })} title="Open this recipe at this size from now on">
          Save
        </button>
      )}
      {servings !== written && (
        <button className="btn subtle" onClick={() => setServings(written)} title={`As written: ${yieldText(written, r.yieldUnit, written)}`}>
          Reset
        </button>
      )}
    </div>
  );
}

function RecipeEdit({ r }: { r: Recipe }) {
  const { view } = useData();
  const [confirm, setConfirm] = useState(false);
  const save = (patch: Partial<Recipe>) => put("recipes", { ...(data().state.recipes[r.id] ?? r), ...patch });
  const done = () => setQuery({ edit: r.ingredients.length || r.instructions ? null : "0" });

  return (
    <article className="page">
      {r.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <div className="page-kind">
        🍳 Recipe · editing
        <span className="spacer" />
        <button className="btn primary" onClick={done}>
          Done
        </button>
      </div>
      <div className="title-row">
        <DraftInput className="title-input" value={r.name} required aria-label="Name" onCommit={(name) => save({ name })} />
      </div>

      <div className="fields">
        <Field label="Ingredients">
          <DraftTextarea
            className="input mono-ish"
            rows={5}
            value={r.ingredients.map((i) => i.line).join("\n")}
            placeholder={"One per line:\n2 slices American cheese\n1 lemon, zested\n1½ cups cooked rice (optional)"}
            onCommit={(text) => save({ ingredients: ingredientsFromText(text, (data().state.recipes[r.id] ?? r).ingredients, (n) => data().view.findFood(n)?.id) })}
          />
          {r.ingredients.length > 0 && (
            <table className="parsed">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Food</th>
                  <th>Prep / note</th>
                </tr>
              </thead>
              <tbody>
                {r.ingredients.map((i) => (
                  <tr key={i.id}>
                    <td className="nowrap">{formatAmount(i.quantity, i.unit) || "—"}</td>
                    <td>
                      <Picker
                        value={i.foodId}
                        options={view.foods.map((f) => ({ id: f.id, label: f.name }))}
                        placeholder="No food"
                        startText={parseLine(i.line).food}
                        createLabel="New food"
                        onChange={(foodId) => setIngredientFood(r, i.id, foodId)}
                        onCreate={(n) => ensureFood(n)}
                      />
                    </td>
                    <td className="muted small">
                      {[i.prep, i.note, i.optional ? "optional" : ""].filter(Boolean).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Field>
        <Field label="Instructions">
          <DraftTextarea
            className="input"
            rows={5}
            value={r.instructions}
            placeholder={"1. Toast the bread\n2. …\n\n**bold**, - bullets and links work"}
            onCommit={(instructions) => save({ instructions })}
          />
        </Field>
        <Field label="Method">
          <Segmented value={r.method} options={METHODS} labels={METHOD_LABEL} onChange={(method) => save({ method })} />
        </Field>
        <Field label="Makes">
          <div className="inline">
            <NumberInput className="input narrow" value={r.yieldQty} placeholder="1" onCommit={(yieldQty) => save({ yieldQty })} aria-label="How many" />
            <DraftInput className="input" value={r.yieldUnit} placeholder="sandwich, loaf, servings…" onCommit={(yieldUnit) => save({ yieldUnit })} aria-label="Of what" />
          </div>
        </Field>
        <Field label="Time (min)">
          <div className="inline">
            <NumberInput className="input narrow" value={r.prepMin} placeholder="prep" onCommit={(prepMin) => save({ prepMin })} aria-label="Prep minutes" />
            <NumberInput className="input narrow" value={r.cookMin} placeholder="cook" onCommit={(cookMin) => save({ cookMin })} aria-label="Cook minutes" />
          </div>
        </Field>
        <EatingFields item={r} save={save} />
        <Field label="Photos">
          <Photos photos={r.photos} name={r.name} update={(fn) => save({ photos: fn((data().state.recipes[r.id] ?? r).photos) })}>
            <PhotoFromLink recipe={r} className="btn subtle" />
          </Photos>
        </Field>
        <Field label="Notes">
          <DraftTextarea className="input" rows={3} value={r.notes} placeholder="What makes it work, what you'd change…" onCommit={(notes) => save({ notes })} />
        </Field>
      </div>

      {/* Done on the right, where the eye ends; Delete kept away from it. */}
      <div className="page-foot">
        {!r.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
        <button className="btn subtle" onClick={() => duplicate("recipes", r.id)} title="A copy to make a version of it">
          Duplicate
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={done}>
          Done
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${r.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("recipes", r);
            go("/recipes", { replace: true });
          }}
        >
          <p>If it just wasn't good, rate it 👎 instead, so you remember. You can undo a delete right after.</p>
        </ConfirmDialog>
      )}
    </article>
  );
}
