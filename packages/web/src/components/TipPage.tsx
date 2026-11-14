import { TIP_WHEN, TIP_WHEN_LABEL, type Tip } from "@foodlab/shared";
import { useState } from "react";
import { ensureFood, remove } from "../actions";
import { A, go, listPath, pathOf } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftTextarea, Field, MultiPicker, PageKind, Picker, Segmented, TagEditor, TitleInput } from "./controls";
import { Deleted, NotFound } from "./FoodPage";
import { ItemRow, Section } from "./rows";

// A tip (DESIGN.md §5.15): "Drop the thin outer ring" on Onion, when cooked. It shows on every
// recipe using one of its foods whose method fits, and on recipes it's added to by hand.

export function TipPage({ id }: { id: string }) {
  const { view, state } = useData();
  const t = state.tips?.[id];
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!t) return <NotFound what="tip" />;
  const save = (patch: Partial<Tip>) => put("tips", { ...(data().state.tips[id] ?? t), ...patch });

  const on = view.recipesWithTip(t.id);
  const hidden = view.recipes.filter((r) => view.recipeTips(r).some((x) => x.tip.id === t.id && x.off));
  const addTo = (recipeId: string) => {
    const r = data().state.recipes[recipeId];
    if (!r) return;
    // Switched off there: switch it back on; otherwise add it by hand.
    if (r.tipsOff.includes(t.id)) put("recipes", { ...r, tipsOff: r.tipsOff.filter((x) => x !== t.id) });
    else if (!r.tipIds.includes(t.id)) put("recipes", { ...r, tipIds: [...r.tipIds, t.id] });
  };

  return (
    <article className="page">
      {t.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <PageKind kind="tips" />
      <div className="title-row">
        <TitleInput value={t.name} required aria-label="Tip" onCommit={(name) => save({ name })} />
      </div>
      <div className="fields">
        <Field label="Foods">
          <MultiPicker
            values={t.foodIds}
            options={view.foods.map((f) => ({ id: f.id, label: f.name, also: f.aliases }))}
            createLabel="New food"
            linkTo={(f) => pathOf("foods", f)}
            onChange={(foodIds) => save({ foodIds })}
            onCreate={(n) => ensureFood(n)}
          />
        </Field>
        <Field label="When">
          <Segmented value={t.when} options={TIP_WHEN} labels={TIP_WHEN_LABEL} clearable={false} onChange={(when) => when && save({ when })} />
        </Field>
        <Field label="More">
          <DraftTextarea className="input" rows={4} value={t.text} onCommit={(text) => save({ text })} />
        </Field>
        <Field label="Tags">
          <TagEditor value={t.tagIds} noMeals onChange={(tagIds) => save({ tagIds })} />
        </Field>
      </div>

      <Section
        title="On recipes"
        count={on.length}
        actions={
          <button className="btn subtle" onClick={() => setAdding(true)}>
            + Recipe
          </button>
        }
      >
        {adding && (
          <div className="inline-add">
            <Picker
              value={null}
              options={view.recipes.filter((r) => !on.includes(r)).map((r) => ({ id: r.id, label: r.name }))}
              aria-label="Add to a recipe"
              placeholder=""
              autoFocus
              keepOpen
              onChange={(r) => r && addTo(r)}
            />
            <button className="btn" onClick={() => setAdding(false)}>
              Done
            </button>
          </div>
        )}
        {on.length > 0 ? (
          <div className="rows">{on.map((r) => <ItemRow key={r.id} view={view} kind="recipes" item={r} showKind={false} />)}</div>
        ) : (
          !adding && <p className="empty-line">None yet.</p>
        )}
      </Section>

      {hidden.length > 0 && (
        <Section title="Switched off on" count={hidden.length}>
          <ul className="plain tip-off-list">
            {hidden.map((r) => (
              <li key={r.id}>
                <A href={pathOf("recipes", r.id)}>{r.name}</A>
                <button className="btn subtle" onClick={() => addTo(r.id)}>
                  Show it
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="page-foot">
        {!t.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${t.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("tips", t);
            go(listPath("tips"), { replace: true });
          }}
        >
          <p>{on.length ? `It comes off ${on.length} recipe${on.length === 1 ? "" : "s"}.` : "It isn't on any recipe."} You can undo this right after.</p>
        </ConfirmDialog>
      )}
    </article>
  );
}
