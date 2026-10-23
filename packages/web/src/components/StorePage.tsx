import { type Product, type Store } from "@foodlab/shared";
import { useState } from "react";
import { remove } from "../actions";
import { go } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field } from "./controls";
import { Deleted, NotFound } from "./FoodPage";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow, Section } from "./rows";

// A store: everything I know is sold there, best first, and what not to buy.

export function StorePage({ id }: { id: string }) {
  const { view, state } = useData();
  const s = state.stores[id];
  const [confirm, setConfirm] = useState(false);
  if (!s) return <NotFound what="store" />;
  const save = (patch: Partial<Store>) => put("stores", { ...(data().state.stores[id] ?? s), ...patch });
  const products = view.productsAt(s.id);
  const groups: [string, Product[]][] = [
    ["❤️ Love", products.filter((p) => p.rating === "love")],
    ["👍 Good", products.filter((p) => p.rating === "up")],
    ["Not rated", products.filter((p) => !p.rating)],
    ["👎 Don't buy", products.filter((p) => p.rating === "down")],
  ];

  return (
    <article className="page">
      {s.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <div className="page-kind">🏪 Store</div>
      <div className="title-row">
        <DraftInput className="title-input" value={s.name} required aria-label="Name" onCommit={(name) => save({ name })} />
      </div>
      <div className="fields">
        <Field label="Notes">
          <DraftTextarea className="input" rows={2} value={s.notes} placeholder="Which one, hours, where things are…" onCommit={(notes) => save({ notes })} />
        </Field>
      </div>
      <Section
        title="Sold here"
        count={products.length}
        actions={
          <button className="btn subtle" onClick={() => openQuickAdd({ kind: "products", storeIds: [s.id] })}>
            + Product
          </button>
        }
      >
        {products.length === 0 && <p className="empty-line">No products yet. Add a store to a product and it shows up here.</p>}
        {groups.map(([title, list]) =>
          list.length ? (
            <div key={title} className="group">
              <div className="group-title">{title}</div>
              <div className="rows">{list.map((p) => <ItemRow key={p.id} view={view} kind="products" item={p} showKind={false} />)}</div>
            </div>
          ) : null,
        )}
      </Section>
      <div className="page-foot">
        <span className="spacer" />
        {!s.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${s.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("stores", s);
            go("/stores", { replace: true });
          }}
        >
          <p>{products.length ? `${products.length} products say they're sold here; they'll show it as deleted.` : "No products point at it."} You can undo this right after.</p>
        </ConfirmDialog>
      )}
    </article>
  );
}
