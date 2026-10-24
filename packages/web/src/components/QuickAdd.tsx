import { MEAL_TAGS, blank, newId, tidyName, withoutBrand, type Id, type Rating } from "@foodlab/shared";
import { useId, useState, useSyncExternalStore } from "react";
import { ensureFood, ensureStore } from "../actions";
import { go, pathOf } from "../router";
import { put, useData } from "../sync";
import { showToast } from "../toast";
import { Dialog } from "./Dialog";
import { Field, MultiPicker, Picker, RatingInput, Segmented } from "./controls";

// Quick add (DESIGN.md §5.5): a kind, a name, and only the everyday fields. Also what
// Share to foodlab opens, with the shared page's title and link filled in.

type AddKind = "foods" | "products" | "recipes";
export interface QuickAddInit {
  kind?: AddKind;
  name?: string;
  link?: string;
  foodId?: Id;
  storeIds?: Id[];
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

const KINDS: readonly AddKind[] = ["products", "recipes", "foods"];
const LABELS: Record<AddKind, string> = { products: "🛒 Product", recipes: "🍳 Recipe", foods: "🥕 Food" };
const LAST_KIND = "foodlab:add-kind";

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
  const brandList = useId();
  const [link, setLink] = useState(init.link ?? "");
  const [foodId, setFoodId] = useState<Id | null>(init.foodId ?? null);
  const [storeIds, setStoreIds] = useState<Id[]>(init.storeIds ?? []);
  const [rating, setRating] = useState<Rating | null>(null);
  const [tagIds, setTagIds] = useState<Id[]>([]);
  const [staple, setStaple] = useState(false);
  const [another, setAnother] = useState(false);
  const [added, setAdded] = useState(0);

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
      put("products", { ...blank.products(id, withoutBrand(n, b)), brand: b, foodId, storeIds, rating, tagIds, links, status });
    } else {
      put("recipes", { ...blank.recipes(id, n), rating, tagIds, links, status });
    }
    if (another) {
      setBrand("");
      setName("");
      setLink("");
      setRating(null);
      setAdded((a) => a + 1);
      showToast(`Added “${n}”`);
    } else {
      closeQuickAdd();
      go(pathOf(kind, id));
    }
  };

  const toggleTag = (t: Id) => setTagIds((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  return (
    <Dialog title="Add" onClose={closeQuickAdd} className="quick-add">
      <div className="stack">
        <Segmented value={kind} options={KINDS} labels={LABELS} clearable={false} onChange={(k) => k && pickKind(k)} label="What" />
        <div className="inline name-row">
          {kind === "products" && (
            <>
              <input
                className="input big brand-box"
                autoFocus={!init.name}
                placeholder="Brand"
                value={brand}
                list={brandList}
                onChange={(e) => setBrand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                aria-label="Brand"
              />
              <datalist id={brandList}>
                {view.brands().map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </>
          )}
          <input
            className="input big"
            autoFocus={kind !== "products" || !!init.name}
            placeholder={kind === "products" ? "e.g. Deli Deluxe American" : kind === "recipes" ? "e.g. Ham & cheese sandwich" : "e.g. Lemon juice"}
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
                  <Picker
                    value={foodId}
                    options={view.foods.map((f) => ({ id: f.id, label: f.name }))}
                    placeholder="Which food is it? (optional)"
                    createLabel="New food"
                    onChange={setFoodId}
                    onCreate={(t) => ensureFood(t)}
                  />
                </Field>
                <Field label="Sold at">
                  <MultiPicker
                    values={storeIds}
                    options={view.stores.map((s) => ({ id: s.id, label: s.name }))}
                    onChange={setStoreIds}
                    onCreate={ensureStore}
                    placeholder="Add a store…"
                    createLabel="New store"
                  />
                </Field>
              </>
            )}
            <Field label="Rating">
              <RatingInput value={rating} onChange={setRating} />
            </Field>
            <Field label="For">
              <div className="chips">
                {MEAL_TAGS.map((t) => (
                  <button key={t.id} className={`chip ${tagIds.includes(t.id) ? "chip-on" : ""}`} aria-pressed={tagIds.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            </Field>
            {(link || init.link) && (
              <Field label="Link">
                <input className="input" value={link} onChange={(e) => setLink(e.target.value)} />
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
  const recipe = /recipe|allrecipes|seriouseats|food52|bonappetit|nytimes\.com\/.*cooking|budgetbytes/i.test(url + " " + text);
  return { kind: recipe ? "recipes" : "products", name, link: url };
}
