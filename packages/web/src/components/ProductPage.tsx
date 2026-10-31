import { BUY_AGAIN, productName, withoutBrand, type Product } from "@foodlab/shared";
import { useId, useState } from "react";
import { duplicate, ensureFood, ensureStore, remove } from "../actions";
import { go, pathOf } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field, MultiPicker, PageKind, Picker, Segmented, TitleInput } from "./controls";
import { EatingFields, LogSection } from "./eating";
import { Photos } from "./Photos";
import { Deleted, NotFound } from "./FoodPage";
import { GroceryButton } from "./GroceriesPage";
import { ItemRow, Section } from "./rows";

// A product: a specific thing I buy, what I think of it, where it's sold.

export function ProductPage({ id }: { id: string }) {
  const { view, state } = useData();
  const p = state.products[id];
  const [confirm, setConfirm] = useState(false);
  const brands = useId();
  if (!p) return <NotFound what="product" />;
  const save = (patch: Partial<Product>) => {
    const next = { ...(data().state.products[id] ?? p), ...patch };
    // The brand is shown in front of the name, so the name shouldn't say it again.
    put("products", { ...next, name: withoutBrand(next.name, next.brand) });
  };
  const food = view.food(p.foodId);
  const others = food ? view.productsOf(food.id).filter((x) => x.id !== p.id) : [];

  return (
    <article className="page">
      {p.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      {/* The food's whole path, like a food page's, ending at the food itself. */}
      <PageKind kind="products" trail={food ? [...[...view.ancestors(food.id)].reverse(), food].map((f) => ({ href: pathOf("foods", f.id), label: f.name })) : []} />
      {/* Brand, then name: reads as the whole name ("Bell & Evans" "Gluten Free Chicken Breasts"). */}
      <div className="title-row product-title">
        <DraftInput className="title-input brand-input" value={p.brand} placeholder="Brand" aria-label="Brand" list={brands} onCommit={(brand) => save({ brand })} />
        <TitleInput value={p.name} required aria-label="Name" onCommit={(name) => save({ name })} />
        <GroceryButton name={productName(p)} foodId={p.foodId} productId={p.id} />
        <datalist id={brands}>
          {view.brands().map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>
      <Photos
        photos={p.photos}
        name={productName(p)}
        update={(fn) => {
          const now = data().state.products[id] ?? p;
          put("products", { ...now, photos: fn(now.photos) });
        }}
      />

      <div className="fields">
        <Field label="Food">
          <Picker
            value={p.foodId}
            options={view.foods.map((f) => ({ id: f.id, label: f.name }))}
            placeholder="Which food is it? (optional)"
            createLabel="New food"
            onChange={(foodId) => save({ foodId })}
            onCreate={(n) => ensureFood(n)}
          />
        </Field>
        <Field label="Sold at">
          <MultiPicker
            values={p.storeIds}
            options={view.stores.map((s) => ({ id: s.id, label: s.name }))}
            onChange={(storeIds) => save({ storeIds })}
            onCreate={ensureStore}
            createLabel="New place"
            linkTo={(s) => pathOf("stores", s)}
          />
        </Field>
        <Field label="Buy again">
          <Segmented value={p.buyAgain} options={BUY_AGAIN} labels={{ yes: "Yes", no: "No" }} onChange={(buyAgain) => save({ buyAgain })} />
        </Field>
        <EatingFields item={p} save={save} inheritedTags={view.inheritedTags(p.foodId, p.tagIds, false)} />
        <Field label="Shelf life">
          <DraftInput className="input" value={p.shelfLife} onCommit={(shelfLife) => save({ shelfLife })} />
        </Field>
        <Field label="Notes">
          <DraftTextarea className="input" rows={3} value={p.notes} onCommit={(notes) => save({ notes })} />
        </Field>
      </div>

      <LogSection itemKind="products" itemId={p.id} />

      {food && others.length > 0 && (
        <Section title={`Other ${food.name.toLowerCase()}`} count={others.length}>
          <div className="rows">{others.map((x) => <ItemRow key={x.id} view={view} kind="products" item={x} showKind={false} hideFood />)}</div>
        </Section>
      )}

      <div className="page-foot">
        {!p.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
        <button className="btn subtle" onClick={() => duplicate("products", p.id)} title="A copy with the same food, brand, stores and tags">
          Duplicate
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${productName(p)}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("products", p);
            go("/products", { replace: true });
          }}
        >
          <p>If you just didn't like it, rate it 👎 instead: then you'll know you tried it. You can undo a delete right after.</p>
        </ConfirmDialog>
      )}
    </article>
  );
}

