import {
  COSTS,
  COST_LABEL,
  formatPhone,
  PLACE_STATUS_LABEL,
  PLACE_TYPES,
  PLACE_TYPE_LABEL,
  SPEEDS,
  SPEED_LABEL,
  STATUSES,
  type Product,
  type Store,
} from "@foodlab/shared";
import { useState } from "react";
import { remove } from "../actions";
import { go, listPath } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field, LinksEditor, PageKind, RatingInput, Segmented, TagEditor, TitleInput } from "./controls";
import { Deleted, NotFound } from "./FoodPage";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow, Section } from "./rows";

// A place (DESIGN.md §4.4, §5.12): a store, a restaurant, or both. What I eat there (dishes),
// everything I know is sold there (products), and how to get there.

/** Google Maps for the address (the Maps app on the phone). */
export const mapsUrl = (s: Store) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address].filter(Boolean).join(", "))}`;

export function PlacePage({ id }: { id: string }) {
  const { view, state } = useData();
  const s = state.stores[id];
  const [confirm, setConfirm] = useState(false);
  if (!s) return <NotFound what="place" />;
  const save = (patch: Partial<Store>) => put("stores", { ...(data().state.stores[id] ?? s), ...patch });
  const products = view.productsAt(s.id);
  const dishes = view.dishesAt(s.id);
  const groups: [string, Product[]][] = [
    ["❤️ Love", products.filter((p) => p.rating === "love")],
    ["👍 Good", products.filter((p) => p.rating === "up")],
    ["Not rated", products.filter((p) => !p.rating)],
    ["👎 Don't buy", products.filter((p) => p.rating === "down")],
  ];
  // A grocery store doesn't need an empty Dishes section, nor a restaurant an empty Sold here.
  const eatsHere = dishes.length > 0 || s.types.includes("restaurant") || s.types.includes("prepared") || !!s.speed;
  const sellsHere = products.length > 0 || s.types.includes("grocery") || s.types.includes("specialty") || !s.types.length;
  const toggleType = (t: (typeof PLACE_TYPES)[number]) => {
    const now = data().state.stores[id] ?? s;
    save({ types: now.types.includes(t) ? now.types.filter((x) => x !== t) : PLACE_TYPES.filter((x) => x === t || now.types.includes(x)) });
  };

  return (
    <article className="page">
      {s.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <PageKind kind="stores" />
      <div className="title-row">
        <TitleInput value={s.name} required aria-label="Name" onCommit={(name) => save({ name })} />
      </div>
      <div className="fields">
        <Field label="Type">
          <div className="chips">
            {PLACE_TYPES.map((t) => (
              <button key={t} className={`chip ${s.types.includes(t) ? "chip-on" : ""}`} aria-pressed={s.types.includes(t)} onClick={() => toggleType(t)}>
                {PLACE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Speed">
          <Segmented value={s.speed} options={SPEEDS} labels={SPEED_LABEL} onChange={(speed) => save({ speed })} />
        </Field>
        <Field label="Cost">
          <Segmented value={s.cost} options={COSTS} labels={COST_LABEL} onChange={(cost) => save({ cost })} />
        </Field>
        <Field label="Status">
          <Segmented value={s.status} options={STATUSES} labels={PLACE_STATUS_LABEL} onChange={(status) => save({ status })} />
        </Field>
        <Field label="Rating">
          <RatingInput value={s.rating} onChange={(rating) => save({ rating })} />
        </Field>
        <Field label="Address">
          <div className="inline">
            <DraftInput className="input grow" value={s.address} onCommit={(address) => save({ address })} />
            {s.address && (
              <a className="btn subtle" href={mapsUrl(s)} target="_blank" rel="noreferrer noopener">
                🗺️ Map ↗
              </a>
            )}
          </div>
        </Field>
        <Field label="Phone">
          <div className="inline">
            <DraftInput className="input grow" type="tel" value={s.phone} onCommit={(phone) => save({ phone: formatPhone(phone) })} />
            {s.phone && (
              <a className="btn subtle" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>
                📞 Call
              </a>
            )}
          </div>
        </Field>
        <Field label="Hours">
          <DraftTextarea className="input" rows={2} value={s.hours} onCommit={(hours) => save({ hours })} />
        </Field>
        <Field label="Links">
          <LinksEditor value={s.links} onChange={(links) => save({ links })} />
        </Field>
        <Field label="Tags">
          <TagEditor value={s.tagIds} onChange={(tagIds) => save({ tagIds })} />
        </Field>
        <Field label="Notes">
          <DraftTextarea className="input" rows={2} value={s.notes} onCommit={(notes) => save({ notes })} />
        </Field>
      </div>
      {eatsHere && (
        <Section
          title="Dishes"
          count={dishes.length}
          actions={
            <button className="btn subtle" onClick={() => openQuickAdd({ kind: "dishes", placeId: s.id })}>
              + Dish
            </button>
          }
        >
          {dishes.length === 0 && <p className="empty-line">No dishes yet.</p>}
          {dishes.length > 0 && <div className="rows">{dishes.map((d) => <ItemRow key={d.id} view={view} kind="dishes" item={d} showKind={false} hideFood />)}</div>}
        </Section>
      )}
      {sellsHere && (
        <Section
          title="Sold here"
          count={products.length}
          actions={
            <button className="btn subtle" onClick={() => openQuickAdd({ kind: "products", storeIds: [s.id] })}>
              + Product
            </button>
          }
        >
          {products.length === 0 && <p className="empty-line">No products yet. Add this place to a product's Sold at and it shows up here.</p>}
          {groups.map(([title, list]) =>
            list.length ? (
              <div key={title} className="group">
                <div className="group-title">{title}</div>
                <div className="rows">{list.map((p) => <ItemRow key={p.id} view={view} kind="products" item={p} showKind={false} />)}</div>
              </div>
            ) : null,
          )}
        </Section>
      )}
      <div className="page-foot">
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
            go(listPath("stores"), { replace: true });
          }}
        >
          <p>
            {products.length || dishes.length
              ? `${[products.length ? `${products.length} products` : "", dishes.length ? `${dishes.length} dishes` : ""].filter(Boolean).join(" and ")} point at it; they'll show it as deleted.`
              : "Nothing points at it."}{" "}
            You can undo this right after.
          </p>
        </ConfirmDialog>
      )}
    </article>
  );
}
