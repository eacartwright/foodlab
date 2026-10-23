import { type Food } from "@foodlab/shared";
import { useState } from "react";
import { ensureFood, remove } from "../actions";
import { A, go, pathOf } from "../router";
import { data, put, useData } from "../sync";
import { DraftInput, DraftTextarea, Field, Picker, TagEditor } from "./controls";
import { ConfirmDialog } from "./ConfirmDialog";
import { ItemRow, Section } from "./rows";
import { openQuickAdd } from "./QuickAdd";

// A food: the database personality. What it is, its forms, its products best first, the
// recipes it's in.

export function FoodPage({ id }: { id: string }) {
  const { view, state } = useData();
  const food = state.foods[id];
  const [adding, setAdding] = useState<"form" | "kind" | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (!food) return <NotFound what="food" />;
  const save = (patch: Partial<Food>) => put("foods", { ...(data().state.foods[id] ?? food), ...patch });

  // A food can't sit inside (or be a form of) itself or anything below it.
  const below = new Set([food.id, ...view.descendants(food.id).map((f) => f.id)]);
  const options = view.foods.filter((f) => !below.has(f.id)).map((f) => ({ id: f.id, label: f.name }));
  const parent = view.food(food.parentId);
  const formOf = view.food(food.formOfId);
  const path = [...view.ancestors(food.id)].reverse();
  const forms = view.formsOfFood(food.id);
  const kinds = view.childrenOfFood(food.id);
  const products = view.productsOf(food.id);
  const used = view.recipesUsing(food.id);
  const viaForms = view.recipesUsingForms(food.id);
  const preps = view.prepsOf(food.id);
  const best = view.preferredProduct(food.id);

  return (
    <article className="page">
      {food.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <div className="page-kind">
        🥕 Food
        {path.length > 0 && (
          <span className="crumbs">
            {path.map((f) => (
              <span key={f.id}>
                <A href={pathOf("foods", f.id)}>{f.name}</A> ›{" "}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="title-row">
        <DraftInput className="title-input" value={food.name} required aria-label="Name" onCommit={(name) => save({ name })} />
        <button className={`btn staple ${food.staple ? "on" : ""}`} aria-pressed={food.staple} onClick={() => save({ staple: !food.staple })} title="Something I want to keep in the house">
          {food.staple ? "★ Staple" : "☆ Staple"}
        </button>
      </div>
      {best && (
        <p className="lede">
          Usually: <A href={pathOf("products", best.id)}>{best.name}</A>
          {best.storeIds.length > 0 && <span className="muted"> · {best.storeIds.map((s) => view.store(s)?.name).join(", ")}</span>}
        </p>
      )}

      <div className="fields">
        <Field label="Is a">
          <Picker value={food.parentId} options={options} placeholder="Nothing (top level)" onChange={(parentId) => save({ parentId })} onCreate={(n) => ensureFood(n)} />
        </Field>
        <Field label="Form of">
          <Picker value={food.formOfId} options={options} placeholder="Not a form of anything" onChange={(formOfId) => save({ formOfId })} onCreate={(n) => ensureFood(n)} />
        </Field>
        <Field label="Shelf life">
          <DraftInput className="input" value={food.shelfLife} placeholder="e.g. 3 weeks opened, fridge" onCommit={(shelfLife) => save({ shelfLife })} />
        </Field>
        <Field label="Tags">
          <TagEditor value={food.tagIds} onChange={(tagIds) => save({ tagIds })} />
        </Field>
        <Field label="Notes">
          <DraftTextarea className="input" rows={3} value={food.notes} placeholder="What it's like, substitutions, storage…" onCommit={(notes) => save({ notes })} />
        </Field>
      </div>
      {(parent?.deleted || formOf?.deleted) && <p className="warn small">Points at a deleted food.</p>}

      <Section
        title="Products"
        count={products.length}
        actions={
          <button className="btn subtle" onClick={() => openQuickAdd({ kind: "products", foodId: food.id })}>
            + Product
          </button>
        }
      >
        {products.length ? (
          <div className="rows">{products.map((p) => <ItemRow key={p.id} view={view} kind="products" item={p} showKind={false} hideFood />)}</div>
        ) : (
          <p className="empty-line">None yet: add the ones you buy (and the ones you didn't like).</p>
        )}
      </Section>

      <Section title="Forms" count={forms.length} actions={<button className="btn subtle" onClick={() => setAdding("form")}>+ Form</button>}>
        {adding === "form" && <AddFood label="New form (e.g. Lemon juice)" onDone={() => setAdding(null)} make={(name) => ensureFood(name, { formOfId: food.id })} />}
        {forms.length > 0 ? (
          <div className="rows">{forms.map((f) => <ItemRow key={f.id} view={view} kind="foods" item={f} showKind={false} />)}</div>
        ) : (
          adding !== "form" && <p className="empty-line">Things made from it that you buy or use on their own (juice, zest you buy dried).</p>
        )}
        {preps.length > 0 && (
          <p className="small muted">
            In recipes as: {preps.join(", ")}
          </p>
        )}
      </Section>

      {(kinds.length > 0 || adding === "kind") && (
        <Section title="Kinds" count={kinds.length} actions={<button className="btn subtle" onClick={() => setAdding("kind")}>+ Kind</button>}>
          {adding === "kind" && <AddFood label="New kind (e.g. Roma tomato)" onDone={() => setAdding(null)} make={(name) => ensureFood(name, { parentId: food.id })} />}
          <div className="rows">{kinds.map((f) => <ItemRow key={f.id} view={view} kind="foods" item={f} showKind={false} />)}</div>
        </Section>
      )}

      <Section title="Used in" count={used.length + viaForms.length}>
        {used.length + viaForms.length ? (
          <div className="rows">
            {used.map((r) => <ItemRow key={r.id} view={view} kind="recipes" item={r} showKind={false} />)}
            {viaForms.map((r) => (
              <ItemRow key={r.id} view={view} kind="recipes" item={r} showKind={false} extra={<span className="row-sub muted">through a form</span>} />
            ))}
          </div>
        ) : (
          <p className="empty-line">No recipes yet.</p>
        )}
      </Section>

      <div className="page-foot">
        {kinds.length === 0 && adding !== "kind" && (
          <button className="btn subtle" onClick={() => setAdding("kind")}>
            + Kind of {food.name}
          </button>
        )}
        <span className="spacer" />
        {!food.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${food.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("foods", food);
            go("/foods", { replace: true });
          }}
        >
          <p>
            {products.length + used.length + forms.length + kinds.length
              ? `${products.length} products, ${used.length} recipes, ${forms.length + kinds.length} other foods point at it; they'll show it as deleted.`
              : "Nothing points at it."}{" "}
            You can undo this right after.
          </p>
        </ConfirmDialog>
      )}
    </article>
  );
}

function AddFood({ label, make, onDone }: { label: string; make: (name: string) => string; onDone: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="inline-add">
      <input
        className="input grow"
        autoFocus
        placeholder={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            make(text.trim());
            setText("");
          } else if (e.key === "Escape") onDone();
        }}
      />
      <button
        className="btn"
        onClick={() => {
          if (text.trim()) make(text.trim());
          onDone();
        }}
      >
        {text.trim() ? "Add" : "Done"}
      </button>
    </div>
  );
}

export function Deleted({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="deleted-bar">
      Deleted.{" "}
      <button className="btn subtle" onClick={onRestore}>
        Restore
      </button>
    </div>
  );
}

export function NotFound({ what }: { what: string }) {
  const { loaded } = useData();
  return <p className="empty">{loaded ? `No such ${what}.` : "Loading…"}</p>;
}
