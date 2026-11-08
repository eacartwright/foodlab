import { MEAL_TAGS, blank, ingredientsFromText, nameKey, newId, tidyName, withoutBrand, type Id, type Rating, type ReadRecipe } from "@foodlab/shared";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ensureFood, ensureStore } from "../actions";
import { go, pathOf } from "../router";
import { fetchPhoto, readLink as readFromLink, readText, viaText, type ReadReply } from "../ai";
import { uploadPhoto } from "../uploads";
import { data, put, useData } from "../sync";
import { showToast } from "../toast";
import { Dialog } from "./Dialog";
import { Field, MultiPicker, Picker, RatingInput, Segmented, Suggest } from "./controls";

// Quick add (DESIGN.md §5.5): a kind, a name, and only the everyday fields. Also what
// Share to foodlab opens, with the shared page's title and link filled in.

type AddKind = "foods" | "products" | "recipes" | "dishes";
export interface QuickAddInit {
  kind?: AddKind;
  name?: string;
  link?: string;
  foodId?: Id;
  storeIds?: Id[];
  placeId?: Id;
}

let open: QuickAddInit | null = null;
const listeners = new Set<() => void>();
export function openQuickAdd(init: QuickAddInit = {}) {
  open = init;
  listeners.forEach((fn) => fn());
}
export function closeQuickAddFromBack() {
  closeQuickAdd();
}
function closeQuickAdd() {
  open = null;
  listeners.forEach((fn) => fn());
}
export function useQuickAdd() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => open,
  );
}

const KINDS: readonly AddKind[] = ["products", "recipes", "dishes", "foods"];
const LABELS: Record<AddKind, string> = { products: "🛒 Product", recipes: "🍳 Recipe", dishes: "🥘 Dish", foods: "🥕 Food" };
const LAST_KIND = "foodlab:add-kind";

/** The page's photo onto the recipe just added: shrunk and uploaded like any (uploads.ts), then put on the latest copy. */
async function addSuggested(recipeId: Id, name: string, blob: Blob) {
  try {
    const photo = await uploadPhoto(new File([blob], `${name.slice(0, 60)}.jpg`, { type: blob.type }));
    const now = data().state.recipes[recipeId];
    if (now) put("recipes", { ...now, photos: [...now.photos, photo] });
  } catch (err) {
    showToast(`The photo didn't come along: ${(err as Error).message}`);
  }
}

export function QuickAdd({ init }: { init: QuickAddInit }) {
  const { view } = useData();
  const [kind, setKind] = useState<AddKind>(() => {
    if (init.kind) return init.kind;
    try {
      const k = localStorage.getItem(LAST_KIND) as AddKind | null;
      if (k && KINDS.includes(k)) return k;
    } catch {
      // Storage blocked: start with products.
    }
    return "products";
  });
  const [brand, setBrand] = useState("");
  const [name, setName] = useState(init.name ?? "");
  const [link, setLink] = useState(init.link ?? "");
  const [foodId, setFoodId] = useState<Id | null>(init.foodId ?? null);
  const [notFood, setNotFood] = useState(false);
  const [storeIds, setStoreIds] = useState<Id[]>(init.storeIds ?? []);
  // A brand that's also a place (Wegmans) is sold there: added to Sold at, and taken off again
  // if the brand changes, unless it was picked by hand.
  const autoStore = useRef<Id | null>(null);
  useEffect(() => {
    const k = nameKey(brand.trim());
    const match = k ? view.stores.find((s) => nameKey(s.name) === k)?.id ?? null : null;
    const was = autoStore.current;
    if (match === was) return;
    autoStore.current = match && !storeIds.includes(match) ? match : null;
    setStoreIds((ids) => {
      const next = was ? ids.filter((x) => x !== was) : ids;
      return match && !next.includes(match) ? [...next, match] : next;
    });
  }, [brand]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placeId, setPlaceId] = useState<Id | null>(init.placeId ?? null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [tagIds, setTagIds] = useState<Id[]>([]);
  const [staple, setStaple] = useState(false);
  const [another, setAnother] = useState(false);
  const [added, setAdded] = useState(0);
  // A recipe read from its link, or from text pasted when the site won't let foodlab read it.
  const [read, setRead] = useState<ReadRecipe | null>(null);
  const [reading, setReading] = useState<"" | "busy" | "paste" | string>("");
  const [pasted, setPasted] = useState("");
  const [via, setVia] = useState("");
  // The page's own photo of the dish, suggested for the new recipe (DESIGN.md §5.5).
  const [photo, setPhoto] = useState<{ blob: Blob; src: string } | null>(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const clearPhoto = () =>
    setPhoto((p) => {
      if (p) URL.revokeObjectURL(p.src);
      return null;
    });

  const applyRead = (reply: ReadReply) => {
    const r = reply.recipe;
    if (!r) return setReading(reply.message ?? "Couldn't read it");
    setRead(r);
    setVia(viaText(reply));
    clearPhoto();
    setUsePhoto(true);
    if (reply.photo)
      void fetchPhoto(reply.photo).then((blob) => {
        if (blob) setPhoto({ blob, src: URL.createObjectURL(blob) });
      });
    setKind("recipes");
    setReading("");
    // The page's own name beats a share title ("Easy Pancakes Recipe | BBC Good Food"), not a typed one.
    if (r.name) setName((n) => (!n.trim() || n === (init.name ?? "") ? r.name : n));
  };
  const readLink = async (url = link.trim()) => {
    if (!url) return;
    setReading("busy");
    applyRead(await readFromLink(url));
  };
  const readPasted = async () => {
    setReading("busy-paste");
    applyRead(await readText(pasted));
  };
  // Shared to foodlab: read the page straight away; a page with a recipe makes this a recipe.
  useEffect(() => {
    if (init.link) void readLink(init.link);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickKind = (k: AddKind) => {
    setKind(k);
    try {
      localStorage.setItem(LAST_KIND, k);
    } catch {
      // Not remembered; fine.
    }
  };

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const id = newId();
    const links = link.trim() ? [link.trim()] : [];
    // Something shared from the web and not rated yet is usually something to try.
    const status = !rating && links.length ? ("want" as const) : ("tried" as const);
    if (kind === "foods") {
      const existing = view.findFood(n);
      if (existing) {
        showToast(`“${existing.name}” is already there`);
        if (!another) {
          closeQuickAdd();
          go(pathOf("foods", existing.id));
        }
        return;
      }
      put("foods", { ...blank.foods(id, tidyName(n)), staple, notes: links.join("\n") });
    } else if (kind === "products") {
      // A name that starts with a brand I already have ("Bell & Evans Nuggets", often from Share) gets it split off.
      const b = brand.trim() || view.brands().find((x) => withoutBrand(n, x) !== n) || "";
      put("products", { ...blank.products(id, withoutBrand(n, b)), brand: b, foodId: notFood ? null : foodId, notFood, storeIds, rating, tagIds: notFood ? [] : tagIds, links, status });
    } else if (kind === "dishes") {
      put("dishes", { ...blank.dishes(id, n), placeId, rating, tagIds, links, status });
    } else {
      const fromRead = read
        ? {
            yieldQty: read.yieldQty,
            yieldUnit: read.yieldUnit,
            prepMin: read.prepMin,
            cookMin: read.cookMin,
            instructions: read.instructions,
            ingredients: ingredientsFromText(read.ingredients.join("\n"), [], (f) => data().view.findFood(f)?.id),
          }
        : {};
      put("recipes", { ...blank.recipes(id, n), ...fromRead, rating, tagIds, links, status });
      // The suggested photo goes up after: the recipe is saved (and opens) without waiting for it.
      if (read && photo && usePhoto) void addSuggested(id, n, photo.blob);
    }
    if (another) {
      setBrand("");
      setName("");
      setLink("");
      setRating(null);
      setRead(null);
      setVia("");
      clearPhoto();
      setReading("");
      setPasted("");
      setAdded((a) => a + 1);
      showToast(`Added “${n}”`);
    } else {
      closeQuickAdd();
      // A read recipe opens in Edit, to check what came in.
      go(pathOf(kind, id) + (kind === "recipes" && read ? "?edit=1" : ""));
    }
  };

  const toggleTag = (t: Id) => setTagIds((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  return (
    <Dialog title="Add" onClose={closeQuickAdd} className="quick-add">
      <div className="stack">
        <Segmented value={kind} options={KINDS} labels={LABELS} clearable={false} onChange={(k) => k && pickKind(k)} label="What" />
        <div className="inline name-row">
          {kind === "products" && (
            <Suggest
              className="brand-box"
              placeholder="Brand"
              autoFocus={!init.name}
              value={brand}
              options={view.brands()}
              onChange={setBrand}
              onEnter={add}
              createLabel="New brand"
              aria-label="Brand"
            />
          )}
          <input
            className="input big"
            autoFocus={kind !== "products" || !!init.name}
            placeholder={kind === "products" ? "Product name" : kind === "recipes" ? "e.g. Ham & cheese sandwich" : kind === "dishes" ? "e.g. Burrito bowl" : "e.g. Lemon juice"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            aria-label="Name"
          />
        </div>
        {kind === "foods" ? (
          <label className="check">
            <input type="checkbox" checked={staple} onChange={(e) => setStaple(e.target.checked)} /> A staple (I want to keep it in the house)
          </label>
        ) : (
          <div className="fields compact">
            {kind === "products" && (
              <>
                <Field label="Food">
                  <div className="food-row">
                    {!notFood && (
                      <Picker
                        value={foodId}
                        options={view.foods.map((f) => ({ id: f.id, label: f.name }))}
                        placeholder=""
                        createLabel="New food"
                        onChange={setFoodId}
                        onCreate={(t) => ensureFood(t)}
                      />
                    )}
                    <label className="check">
                      <input type="checkbox" checked={notFood} onChange={(e) => setNotFood(e.target.checked)} /> Not food
                    </label>
                  </div>
                </Field>
                <Field label="Sold at">
                  <MultiPicker
                    values={storeIds}
                    options={view.stores.map((s) => ({ id: s.id, label: s.name }))}
                    onChange={setStoreIds}
                    onCreate={ensureStore}
                    placeholder=""
                    createLabel="New place"
                  />
                </Field>
              </>
            )}
            {kind === "dishes" && (
              <Field label="Place">
                <Picker
                  value={placeId}
                  options={view.stores.map((s) => ({ id: s.id, label: s.name }))}
                  createLabel="New place"
                  onChange={setPlaceId}
                  onCreate={(t) => ensureStore(t, { types: ["restaurant"] })}
                />
              </Field>
            )}
            {/* A product's rating and meals are set on its page, after adding. */}
            {kind !== "products" && (
              <Field label="Rating">
                <RatingInput value={rating} onChange={setRating} />
              </Field>
            )}
            {kind !== "products" && (
              <Field label="For">
                <div className="chips">
                  {MEAL_TAGS.map((t) => (
                    <button key={t.id} className={`chip ${tagIds.includes(t.id) ? "chip-on" : ""}`} aria-pressed={tagIds.includes(t.id)} onClick={() => toggleTag(t.id)}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {(link || init.link || kind === "recipes") && (
              <Field label="Link">
                <input className="input" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link" />
              </Field>
            )}
            {kind === "recipes" && (
              <Field label="Recipe">
                <div className="stack-sm">
                  {read ? (
                    <>
                    <div className="inline read-summary">
                      <span>
                        ✓ {read.ingredients.length} ingredients · {read.instructions.split("\n").filter((l) => /^\d+\./.test(l)).length} steps
                        {read.yieldQty !== null && ` · makes ${read.yieldQty}${read.yieldUnit ? ` ${read.yieldUnit}` : ""}`}
                        {via && <span className="muted small"> · {via}</span>}
                      </span>
                      <button
                        className="btn icon subtle"
                        aria-label="Don't use it"
                        title="Don't use it"
                        onClick={() => {
                          setRead(null);
                          clearPhoto();
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {photo && (
                      <label className="suggested-photo">
                        <img src={photo.src} alt="" />
                        <span className="check">
                          <input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} /> Use this photo
                        </span>
                      </label>
                    )}
                    </>
                  ) : reading === "paste" || reading === "busy-paste" ? (
                    <>
                      <textarea className="input" rows={6} autoFocus value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Pasted recipe" />
                      <div className="inline">
                        <button className="btn" disabled={!pasted.trim() || reading === "busy-paste"} onClick={() => void readPasted()}>
                          {reading === "busy-paste" ? "Reading…" : "Read it"}
                        </button>
                        <button className="btn subtle" onClick={() => setReading("")}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="inline">
                      {reading && reading !== "busy" && <span className="muted small">{reading}.</span>}
                      {link.trim() && (
                        <button className="btn" disabled={reading === "busy"} onClick={() => void readLink()}>
                          {reading === "busy" ? "Reading…" : "Read link"}
                        </button>
                      )}
                      <button className="btn subtle" onClick={() => setReading("paste")}>
                        Paste
                      </button>
                    </div>
                  )}
                </div>
              </Field>
            )}
          </div>
        )}
        <div className="row-actions">
          <label className="check">
            <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} /> Add another
          </label>
          {added > 0 && <span className="muted small">{added} added</span>}
          <span className="spacer" />
          <button className="btn primary" disabled={!name.trim()} onClick={add}>
            Add
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Share to foodlab (Android): /share?title=…&text=…&url=… → Quick add with those filled in. */
export function fromShare(q: URLSearchParams): QuickAddInit {
  const title = (q.get("title") ?? "").trim();
  const text = (q.get("text") ?? "").trim();
  let url = (q.get("url") ?? "").trim();
  // Many apps put the link in the text ("Look at this https://…").
  if (!url) url = /(https?:\/\/\S+)/.exec(text)?.[1] ?? "";
  const rest = text.replace(url, "").trim();
  const name = (title || rest.split("\n")[0] || "").replace(/\s+[|–—-]\s+[^|–—-]+$/, "").replace(/\s+recipe$/i, "").trim();
  const recipe = /recipe|allrecipes|seriouseats|food52|bonappetit|nytimes\.com\/.*cooking|budgetbytes/i.test(`${url} ${title} ${text}`);
  return { kind: recipe ? "recipes" : "products", name, link: url };
}
