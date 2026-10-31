import {
  COSTS,
  COST_LABEL,
  formatPhone,
  locationLabel,
  matchLocation,
  newId,
  withFound,
  type FoundLocation,
  type PlaceLocation,
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
import { money, readPlace } from "../ai";
import { showToast } from "../toast";
import { Dialog } from "./Dialog";
import { remove } from "../actions";
import { go, listPath } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field, LinksEditor, PageKind, RatingInput, Segmented, TagEditor, TitleInput } from "./controls";
import { Deleted, NotFound } from "./FoodPage";
import { openQuickAdd } from "./QuickAdd";
import { ItemRow, Section } from "./rows";

// A place (DESIGN.md §4.4, §5.12): a store, a restaurant, or both. What I eat there (dishes),
// everything I know is sold there (products), and how to get there: its locations, one at a
// time (a dropdown once there are two).

/** Google Maps for a location's address (the Maps app on the phone). */
export const mapsUrl = (s: Store, l: PlaceLocation) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, l.address].filter(Boolean).join(", "))}`;

const blankLocation = (): PlaceLocation => ({ id: newId(), name: "", address: "", phone: "", hours: "" });

export function PlacePage({ id }: { id: string }) {
  const { view, state } = useData();
  const s = state.stores[id];
  const [confirm, setConfirm] = useState(false);
  const [locId, setLocId] = useState<string | null>(null);
  const [blank] = useState(blankLocation);
  const [filling, setFilling] = useState(false);
  if (!s) return <NotFound what="place" />;
  const latest = () => data().state.stores[id] ?? s;
  const save = (patch: Partial<Store>) => put("stores", { ...latest(), ...patch });
  // The location on screen; a place without one shows blank fields, and the first edit makes it.
  const loc = s.locations.find((l) => l.id === locId) ?? s.locations[0] ?? blank;
  const saveLoc = (patch: Partial<PlaceLocation>) => {
    const locs = latest().locations;
    save({ locations: locs.some((l) => l.id === loc.id) ? locs.map((l) => (l.id === loc.id ? { ...l, ...patch } : l)) : [...locs, { ...loc, ...patch }] });
  };
  const addLocation = () => {
    const l = blankLocation();
    const locs = latest().locations;
    // A second one for a place with none yet keeps the (blank) first to fill in later.
    save({ locations: [...(locs.length ? locs : [loc]), l] });
    setLocId(l.id);
  };
  const removeLocation = () => {
    const before = latest().locations;
    save({ locations: before.filter((l) => l.id !== loc.id) });
    setLocId(null);
    showToast(`Removed ${locationLabel(loc, before.findIndex((l) => l.id === loc.id))}`, { label: "Undo", run: () => save({ locations: before }) });
  };
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
        <Field label="Location">
          <div className="inline">
            {s.locations.length > 1 && (
              <select className="select location-select" value={loc.id} onChange={(e) => setLocId(e.target.value)} aria-label="Location">
                {s.locations.map((l, i) => (
                  <option key={l.id} value={l.id}>
                    {locationLabel(l, i)}
                  </option>
                ))}
              </select>
            )}
            <button className="btn subtle" onClick={addLocation}>
              + Location
            </button>
            <button className="btn subtle" onClick={() => setFilling(true)} title="Read the place's page for its locations, address, phone and hours">
              ✨ Fill from page
            </button>
          </div>
        </Field>
        {s.locations.length > 1 && (
          <Field label="Location name">
            <div className="inline">
              <DraftInput key={loc.id} className="input grow" value={loc.name} onCommit={(name) => saveLoc({ name: name.trim() })} />
              <button className="btn subtle" onClick={removeLocation}>
                Remove
              </button>
            </div>
          </Field>
        )}
        <Field label="Address">
          <div className="inline">
            <DraftInput key={loc.id} className="input grow" value={loc.address} onCommit={(address) => saveLoc({ address: address.trim() })} />
            {loc.address && (
              <a className="btn subtle" href={mapsUrl(s, loc)} target="_blank" rel="noreferrer noopener">
                🗺️ Map ↗
              </a>
            )}
          </div>
        </Field>
        <Field label="Phone">
          <div className="inline">
            <DraftInput key={loc.id} className="input grow" type="tel" value={loc.phone} onCommit={(phone) => saveLoc({ phone: formatPhone(phone) })} />
            {loc.phone && (
              <a className="btn subtle" href={`tel:${loc.phone.replace(/[^\d+]/g, "")}`}>
                📞 Call
              </a>
            )}
          </div>
        </Field>
        <Field label="Hours">
          <DraftTextarea key={loc.id} className="input" rows={2} value={loc.hours} onCommit={(hours) => saveLoc({ hours })} />
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
      {filling && (
        <FillDialog
          place={s}
          onClose={() => setFilling(false)}
          onAdd={(found) => {
            const now = latest();
            const locations = withFound(now.locations, found);
            save({ locations });
            setFilling(false);
            const added = locations.length - now.locations.length;
            const filled = found.length - added;
            showToast([added && `Added ${added} location${added > 1 ? "s" : ""}`, filled && `Filled in ${filled}`].filter(Boolean).join(", "), {
              label: "Undo",
              run: () => save({ locations: now.locations }),
            });
            if (added) setLocId(locations[now.locations.length]!.id);
          }}
        />
      )}
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

/**
 * ✨ Fill from page: the place's page (its first link, or another) or text copied from it, read by
 * AI for its locations. What's found is listed to pick from; nothing is saved until Add.
 */
function FillDialog({ place, onClose, onAdd }: { place: Store; onClose: () => void; onAdd: (found: FoundLocation[]) => void }) {
  const [input, setInput] = useState(place.links.find((l) => /^https?:\/\//i.test(l)) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<FoundLocation[] | null>(null);
  const [cost, setCost] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const read = async () => {
    const t = input.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    const r = await readPlace(/^https?:\/\/\S+$/i.test(t) ? { url: t } : { text: t });
    setBusy(false);
    if (r.error || !r.locations) {
      setError(r.error === "refused" ? `${r.message}. Copy the page's text and paste it here instead.` : (r.message ?? "Couldn't read it"));
      return;
    }
    if (!r.locations.length) {
      setError("No locations found there.");
      return;
    }
    setFound(r.locations);
    setPicked(new Set(r.locations.map((_, i) => i)));
    setCost(r.costUsd !== undefined ? money(r.costUsd) : "");
  };
  const toggle = (i: number) => setPicked((p) => (p.has(i) ? new Set([...p].filter((x) => x !== i)) : new Set([...p, i])));
  return (
    <Dialog title="Fill from page" onClose={onClose} className="fill-place">
      {!found ? (
        <div className="stack">
          <textarea className="input" rows={3} aria-label="Link or text from the page" value={input} autoFocus onChange={(e) => setInput(e.target.value)} />
          {error && <p className="warn small">{error}</p>}
          <div className="inline">
            <button className="btn primary" disabled={busy || !input.trim()} onClick={read}>
              {busy ? "Reading…" : "Read"}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <ul className="plain found-list">
            {found.map((f, i) => {
              const same = matchLocation(place.locations, f);
              return (
                <li key={i}>
                  <label className="found">
                    <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                    <span>
                      <span className="strong">{f.name || f.address.split(",")[0]}</span>
                      {same && <span className="muted small"> · updates {locationLabel(same, place.locations.indexOf(same))}</span>}
                      <span className="muted small found-lines">{[f.address, f.phone && formatPhone(f.phone), f.hours].filter(Boolean).join("\n")}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="inline">
            <button className="btn primary" disabled={!picked.size} onClick={() => onAdd(found.filter((_, i) => picked.has(i)))}>
              Add {picked.size}
            </button>
            {cost && <span className="muted small">{cost}</span>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
