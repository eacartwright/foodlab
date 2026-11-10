import { CLASSIC_ROLE_LABEL, CLASSIC_ROLES, newId, type Classic, type ClassicIngredient, type ClassicRole, type Id } from "@foodlab/shared";
import { useState } from "react";
import { ensureClassic, ensureFood, remove, setClassicAliases } from "../actions";
import { suggestClassic, type ClassicSuggestion } from "../ai";
import { A, go, listPath, pathOf } from "../router";
import { data, put, useData } from "../sync";
import { showToast } from "../toast";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field, PageKind, Picker, Segmented, TagEditor, TitleInput } from "./controls";
import { Deleted, NotFound } from "./FoodPage";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow, Section } from "./rows";
import { WikiAbout, WikiField } from "./Wiki";

// A classic (DESIGN.md §5.14): a dish as an idea (Caesar salad), apart from any recipe for it.
// What it is, what defines it, and my recipes and the dishes I've eaten that are versions of it.

export function ClassicPage({ id }: { id: string }) {
  const { view, state } = useData();
  const c = state.classics?.[id];
  const [confirm, setConfirm] = useState(false);
  const [aliasReset, setAliasReset] = useState(0);
  const [addingKind, setAddingKind] = useState(false);
  const [addingIng, setAddingIng] = useState(false);
  const [linking, setLinking] = useState(false);
  if (!c) return <NotFound what="classic" />;
  const latest = () => data().state.classics[id] ?? c;
  const save = (patch: Partial<Classic>) => put("classics", { ...latest(), ...patch });
  const setIngredients = (fn: (list: ClassicIngredient[]) => ClassicIngredient[]) => save({ ingredients: fn(latest().ingredients) });

  const path = [...view.classicAncestors(c.id)].reverse();
  const below = new Set([c.id, ...view.classicDescendants(c.id).map((x) => x.id)]);
  const parentOptions = view.classics.filter((x) => !below.has(x.id)).map((x) => ({ id: x.id, label: x.name, also: x.aliases }));
  const kinds = view.classicKinds(c.id);
  const recipes = view.recipesOfClassic(c.id, true);
  const dishes = view.dishesOfClassic(c.id, true);
  const foodOptions = view.foods.filter((f) => !c.ingredients.some((i) => i.foodId === f.id)).map((f) => ({ id: f.id, label: f.name, also: f.aliases }));
  const addIngredient = (foodId: Id, role: ClassicRole = "required", note = "") =>
    setIngredients((list) => (list.some((i) => i.foodId === foodId) ? list : [...list, { id: newId(), foodId, role, note }]));
  // A recipe I already have, linked here (it's a version of this classic).
  const linkRecipe = (recipeId: Id) => {
    const r = data().state.recipes[recipeId];
    if (r) put("recipes", { ...r, classicId: c.id });
  };

  return (
    <article className="page">
      {c.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <PageKind kind="classics" trail={path.map((x) => ({ href: pathOf("classics", x.id), label: x.name }))} />
      <div className="title-row">
        <TitleInput value={c.name} required aria-label="Name" onCommit={(name) => save({ name })} />
      </div>
      {c.wiki && <WikiAbout url={c.wiki} />}
      <div className="fields">
        <Field label="Kind of">
          <Picker value={c.parentId} options={parentOptions} placeholder="Nothing (top level)" createLabel="New classic" onChange={(parentId) => save({ parentId })} onCreate={(n) => ensureClassic(n)} />
        </Field>
        <Field label="Also called">
          <DraftInput
            key={`aliases-${aliasReset}`}
            className="input"
            value={(c.aliases ?? []).join(", ")}
            onCommit={(text) => {
              setClassicAliases(c, text);
              setAliasReset((n) => n + 1);
            }}
          />
        </Field>
        <Field label="Wikipedia">
          <WikiField value={c.wiki} name={c.name} onChange={(wiki) => save({ wiki })} />
        </Field>
        <Field label="Tags">
          <TagEditor value={c.tagIds} noMeals onChange={(tagIds) => save({ tagIds })} />
        </Field>
        <Field label="Notes">
          <DraftTextarea className="input" rows={3} value={c.notes} onCommit={(notes) => save({ notes })} />
        </Field>
      </div>

      <Section
        title="Ingredients"
        count={c.ingredients.length}
        actions={
          <>
            <SuggestButton classic={c} onAdd={addIngredient} />
            <button className="btn subtle" onClick={() => setAddingIng(true)}>
              + Ingredient
            </button>
          </>
        }
      >
        {c.ingredients.length > 0 && (
          <div className="classic-ings">
            {c.ingredients.map((i) => {
              const f = view.food(i.foodId);
              const name = f?.name ?? "(deleted food)";
              return (
                <div key={i.id} className="classic-ing">
                  <span className="classic-ing-name">
                    <A href={pathOf("foods", i.foodId)}>{name}</A>
                    {f?.staple && (
                      <span className="muted" title="A staple: usually in the house">
                        {" "}
                        ★
                      </span>
                    )}
                  </span>
                  <Segmented
                    value={i.role}
                    options={CLASSIC_ROLES}
                    labels={CLASSIC_ROLE_LABEL}
                    clearable={false}
                    label={`How much ${c.name} needs ${name}`}
                    onChange={(role) => role && setIngredients((list) => list.map((x) => (x.id === i.id ? { ...x, role } : x)))}
                  />
                  <DraftInput
                    className="input cell-input classic-ing-note"
                    value={i.note}
                    aria-label={`Note on ${name}`}
                    onCommit={(note) => setIngredients((list) => list.map((x) => (x.id === i.id ? { ...x, note } : x)))}
                  />
                  <button className="btn icon subtle" aria-label={`Remove ${name}`} title="Remove" onClick={() => setIngredients((list) => list.filter((x) => x.id !== i.id))}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {addingIng && (
          <div className="inline-add">
            <Picker value={null} options={foodOptions} aria-label="Add an ingredient" placeholder="" autoFocus keepOpen createLabel="New food" onChange={(foodId) => foodId && addIngredient(foodId)} onCreate={(n) => ensureFood(n)} />
            <button className="btn" onClick={() => setAddingIng(false)}>
              Done
            </button>
          </div>
        )}
        {!c.ingredients.length && !addingIng && <p className="empty-line">None yet.</p>}
      </Section>

      <Section
        title="My recipes"
        count={recipes.length}
        actions={
          <>
            <button className="btn subtle" onClick={() => setLinking(true)}>
              + One of mine
            </button>
            <button className="btn subtle" onClick={() => openQuickAdd({ kind: "recipes", classicId: c.id })}>
              + New recipe
            </button>
          </>
        }
      >
        {linking && (
          <div className="inline-add">
            <Picker
              value={null}
              options={view.recipes.filter((r) => r.classicId !== c.id).map((r) => ({ id: r.id, label: r.name }))}
              aria-label="Link one of my recipes"
              placeholder=""
              autoFocus
              keepOpen
              onChange={(r) => r && linkRecipe(r)}
            />
            <button className="btn" onClick={() => setLinking(false)}>
              Done
            </button>
          </div>
        )}
        {recipes.length > 0 ? (
          <div className="rows">{recipes.map((r) => <ItemRow key={r.id} view={view} kind="recipes" item={r} showKind={false} hideFood={r.classicId === c.id} />)}</div>
        ) : (
          !linking && <p className="empty-line">None yet.</p>
        )}
      </Section>

      {dishes.length > 0 && (
        <Section title="Dishes I've eaten" count={dishes.length}>
          <div className="rows">{dishes.map((d) => <ItemRow key={d.id} view={view} kind="dishes" item={d} showKind={false} />)}</div>
        </Section>
      )}

      <Section title="Kinds" count={kinds.length} actions={<button className="btn subtle" onClick={() => setAddingKind(true)}>+ Kind</button>}>
        {addingKind && (
          <div className="inline-add">
            <Picker
              value={null}
              options={view.classics.filter((x) => !below.has(x.id) && !view.classicAncestors(c.id).includes(x)).map((x) => ({ id: x.id, label: x.name, also: x.aliases }))}
              aria-label="Add a kind"
              placeholder=""
              autoFocus
              keepOpen
              createLabel="New classic"
              onChange={(k) => {
                const x = k ? data().state.classics[k] : undefined;
                if (x) put("classics", { ...x, parentId: c.id });
              }}
              onCreate={(n) => ensureClassic(n, { parentId: c.id })}
            />
            <button className="btn" onClick={() => setAddingKind(false)}>
              Done
            </button>
          </div>
        )}
        {kinds.length > 0 ? (
          <div className="rows">{kinds.map((k) => <ItemRow key={k.id} view={view} kind="classics" item={k} showKind={false} />)}</div>
        ) : (
          !addingKind && <p className="empty-line">No kinds yet.</p>
        )}
      </Section>

      <div className="page-foot">
        {!c.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${c.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("classics", c);
            go(listPath("classics"), { replace: true });
          }}
        >
          <p>
            {recipes.length + dishes.length + kinds.length
              ? `${recipes.length} recipes, ${dishes.length} dishes and ${kinds.length} kinds point at it; they'll show it as deleted.`
              : "Nothing points at it."}{" "}
            You can undo this right after.
          </p>
        </ConfirmDialog>
      )}
    </article>
  );
}

/** ✨ Suggest: the AI model lists what defines the classic; each is matched to my foods, and I pick. */
function SuggestButton({ classic, onAdd }: { classic: Classic; onAdd: (foodId: Id, role: ClassicRole, note: string) => void }) {
  const { view } = useData();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<(ClassicSuggestion & { on: boolean })[] | null>(null);
  const have = new Set(classic.ingredients.map((i) => i.foodId));
  const ask = async () => {
    setBusy(true);
    const parent = view.classic(classic.parentId);
    const r = await suggestClassic({ name: classic.name, parent: parent && !parent.deleted ? parent.name : "", wiki: classic.wiki });
    setBusy(false);
    if (r.error || !r.ingredients) return showToast(r.message ?? "Couldn't suggest");
    if (!r.ingredients.length) return showToast("Nothing to suggest: it may be a family of dishes");
    setFound(r.ingredients.map((s) => ({ ...s, on: !have.has(view.matchFood(s.name)?.id ?? "") })));
  };
  const add = () => {
    let n = 0;
    for (const s of found ?? []) {
      if (!s.on) continue;
      const foodId = view.matchFood(s.name)?.id ?? ensureFood(s.name);
      if (!have.has(foodId)) (onAdd(foodId, s.role, s.note), n++);
    }
    setFound(null);
    showToast(`Added ${n} ingredient${n === 1 ? "" : "s"}`);
  };
  if (found)
    return (
      <div className="suggest-box" role="group" aria-label="Suggested ingredients">
        {found.map((s, k) => {
          const f = view.matchFood(s.name);
          return (
            <label key={k} className="check">
              <input type="checkbox" checked={s.on} onChange={(e) => setFound(found.map((x, j) => (j === k ? { ...x, on: e.target.checked } : x)))} />
              <span>
                <span className="strong">{f ? f.name : s.name}</span>
                <span className="muted small">
                  {" "}
                  · {CLASSIC_ROLE_LABEL[s.role].toLowerCase()}
                  {s.note && ` · ${s.note}`}
                  {!f && " · new food"}
                  {f && have.has(f.id) && " · already here"}
                </span>
              </span>
            </label>
          );
        })}
        <span className="inline">
          <button className="btn primary" disabled={!found.some((s) => s.on)} onClick={add}>
            Add {found.filter((s) => s.on).length}
          </button>
          <button className="btn" onClick={() => setFound(null)}>
            Cancel
          </button>
        </span>
      </div>
    );
  return (
    <button className="btn subtle" disabled={busy} onClick={() => void ask()}>
      {busy ? "Asking…" : "✨ Suggest"}
    </button>
  );
}
