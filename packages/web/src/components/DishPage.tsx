import { type Dish } from "@foodlab/shared";
import { useState } from "react";
import { duplicate, ensureStore, remove } from "../actions";
import { go, listPath, pathOf } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftTextarea, Field, PageKind, Picker, TitleInput } from "./controls";
import { EatingFields, LogSection } from "./eating";
import { Deleted, NotFound } from "./FoodPage";
import { Photos } from "./Photos";
import { ItemRow, Section } from "./rows";

// A dish (DESIGN.md §4.11): something I eat at a place, what I thought of it, how sure it's GF.

export function DishPage({ id }: { id: string }) {
  const { view, state } = useData();
  const d = state.dishes[id];
  const [confirm, setConfirm] = useState(false);
  if (!d) return <NotFound what="dish" />;
  const save = (patch: Partial<Dish>) => put("dishes", { ...(data().state.dishes[id] ?? d), ...patch });
  const place = d.placeId ? view.store(d.placeId) : undefined;
  const others = place ? view.dishesAt(place.id).filter((x) => x.id !== d.id) : [];

  return (
    <article className="page">
      {d.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <PageKind kind="dishes" trail={place ? [{ href: pathOf("stores", place.id), label: place.name }] : []} />
      <div className="title-row">
        <TitleInput value={d.name} required aria-label="Name" onCommit={(name) => save({ name })} />
      </div>
      <Photos
        photos={d.photos}
        name={d.name}
        update={(fn) => {
          const now = data().state.dishes[id] ?? d;
          put("dishes", { ...now, photos: fn(now.photos) });
        }}
      />
      <div className="fields">
        <Field label="Place">
          <Picker
            value={d.placeId}
            options={view.stores.map((s) => ({ id: s.id, label: s.name }))}
            createLabel="New place"
            onChange={(placeId) => save({ placeId })}
            onCreate={(n) => ensureStore(n, { types: ["restaurant"] })}
          />
        </Field>
        <EatingFields item={d} save={save} />
        <Field label="Notes">
          <DraftTextarea className="input" rows={3} value={d.notes} onCommit={(notes) => save({ notes })} />
        </Field>
      </div>

      <LogSection itemKind="dishes" itemId={d.id} />

      {place && others.length > 0 && (
        <Section title={`More at ${place.name}`} count={others.length}>
          <div className="rows">{others.map((x) => <ItemRow key={x.id} view={view} kind="dishes" item={x} showKind={false} hideFood />)}</div>
        </Section>
      )}

      <div className="page-foot">
        {!d.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
        <button className="btn subtle" onClick={() => duplicate("dishes", d.id)} title="Another dish at the same place">
          Duplicate
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${d.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("dishes", d);
            go(listPath("dishes"), { replace: true });
          }}
        >
          <p>If you just didn't like it, rate it 👎 instead: then you'll know you tried it. You can undo a delete right after.</p>
        </ConfirmDialog>
      )}
    </article>
  );
}
