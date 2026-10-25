// Import foods and products from a reviewed Markdown file (the "foodlab import" format: a
// "# Foods" tree and "# Products" grouped by "## Food"; see the file's own header).
//
//   node --import tsx scripts/import-products.ts "<file.md>"            dry run: what would change
//   node --import tsx scripts/import-products.ts "<file.md>" --apply    write it
//   --server http://127.0.0.1:8082 (the default) to aim it elsewhere
//
// Goes through the server's API, so every record is validated and link-checked like an app save.
// Only adds: a food or product already there (same name, plural/case-proof) is matched, never
// duplicated, and only gets blanks filled in. Imported ratings aren't new, so the "Rated ❤️"
// history entries the server writes for them are removed again.

import { readFileSync } from "node:fs";
import { blank, nameKey, newId, productName, type Food, type Product, type Rating, type State } from "@foodlab/shared";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--server");
const apply = args.includes("--apply");
const server = (args.includes("--server") ? args[args.indexOf("--server") + 1] : "http://127.0.0.1:8082")!.replace(/\/$/, "");
if (!file) {
  console.error('Usage: node --import tsx scripts/import-products.ts "<file.md>" [--apply] [--server URL]');
  process.exit(2);
}

// ---- read the file ----
type InFood = { name: string; parent: string | null; plu: string; notes: string };
type InProduct = { brand: string; name: string; food: string; rating: Rating | null; want: boolean; notes: string; links: string[]; line: number };
const RATING: Record<string, Rating> = { "❤️": "love", "❤": "love", "👍": "up", "👎": "down" };

const foods: InFood[] = [];
const products: InProduct[] = [];
const problems: string[] = [];
let section = "";
let food = "";
const path: string[] = [];

readFileSync(file, "utf8")
  .split(/\r?\n/)
  .forEach((raw, i) => {
    const h = /^(#{1,2})\s+(.+?)\s*$/.exec(raw);
    if (h) {
      if (h[1] === "#") section = h[2]!;
      else food = h[2]!;
      return;
    }
    const li = /^(\t*)-\s+(.+?)\s*$/.exec(raw);
    if (!li) return;
    const parts = li[2]!.split(" · ").map((s) => s.trim());
    if (section === "Foods") {
      const depth = li[1]!.length;
      path.length = depth;
      const name = parts[0]!;
      const plu = parts.find((p) => /^PLU\s+\d{4,5}$/.test(p))?.replace(/^PLU\s+/, "") ?? "";
      const notes = parts.slice(1).filter((p) => !/^PLU\s/.test(p)).join("\n");
      foods.push({ name, parent: path[depth - 1] ?? null, plu, notes });
      path[depth] = name;
    } else if (section === "Products") {
      if (!food) return void problems.push(`line ${i + 1}: a product before any "## Food"`);
      let head = parts[0]!;
      let rating: Rating | null = null;
      for (const [e, r] of Object.entries(RATING)) {
        if (head.endsWith(e)) {
          rating = r;
          head = head.slice(0, -e.length).trim();
          break;
        }
      }
      const bar = head.indexOf("|");
      const brand = bar < 0 ? "" : head.slice(0, bar).trim();
      const name = (bar < 0 ? head : head.slice(bar + 1)).trim();
      if (!name) return void problems.push(`line ${i + 1}: no name`);
      const extra = parts.slice(1);
      products.push({
        brand,
        name,
        food,
        rating,
        want: extra.includes("want"),
        notes: extra.filter((p) => p !== "want" && !/^<.+>$/.test(p)).join("\n"),
        links: extra.filter((p) => /^<.+>$/.test(p)).map((p) => p.slice(1, -1)),
        line: i + 1,
      });
    }
  });

// ---- plan against what's there ----
const res = await fetch(`${server}/api/state`);
if (!res.ok) throw new Error(`GET /api/state: ${res.status}`);
const state = (await res.json()) as State;
const liveFoods = Object.values(state.foods).filter((f) => !f.deleted);
const liveProducts = Object.values(state.products).filter((p) => !p.deleted);

const foodByKey = new Map<string, Food>(liveFoods.map((f) => [nameKey(f.name), f]));
const productByKey = new Map<string, Product>(liveProducts.map((p) => [nameKey(productName(p)), p]));
const now = Date.now();
const writes: { kind: "foods" | "products"; rec: Food | Product; what: string }[] = [];
const counts = { newFoods: 0, matchedFoods: 0, filledFoods: 0, newProducts: 0, matchedProducts: 0, filledProducts: 0 };

const knownFood = (name: string) => foodByKey.get(nameKey(name));
for (const f of foods) {
  const parentId = f.parent ? (knownFood(f.parent)?.id ?? null) : null;
  const have = knownFood(f.name);
  if (have) {
    counts.matchedFoods++;
    const patch: Partial<Food> = {};
    if (!have.parentId && parentId && parentId !== have.id) patch.parentId = parentId;
    if (!have.plu && f.plu) patch.plu = f.plu;
    if (!have.notes && f.notes) patch.notes = f.notes;
    if (Object.keys(patch).length) {
      counts.filledFoods++;
      const rec = { ...have, ...patch };
      foodByKey.set(nameKey(f.name), rec);
      writes.push({ kind: "foods", rec, what: `food ${f.name}: fill ${Object.keys(patch).join(", ")}` });
    }
    continue;
  }
  counts.newFoods++;
  const rec: Food = { ...blank.foods(newId(), f.name, now), parentId, plu: f.plu, notes: f.notes };
  foodByKey.set(nameKey(f.name), rec);
  writes.push({ kind: "foods", rec, what: `food ${f.parent ? f.parent + " > " : ""}${f.name}` });
}

for (const p of products) {
  const foodId = knownFood(p.food)?.id ?? null;
  if (!foodId) problems.push(`line ${p.line}: "## ${p.food}" isn't in Foods; ${p.brand} ${p.name} goes in unsorted`);
  const shown = productName({ brand: p.brand, name: p.name });
  const have = productByKey.get(nameKey(shown));
  if (have) {
    counts.matchedProducts++;
    const patch: Partial<Product> = {};
    if (!have.foodId && foodId) patch.foodId = foodId;
    if (!have.rating && p.rating) patch.rating = p.rating;
    if (!have.brand && p.brand) patch.brand = p.brand;
    if (Object.keys(patch).length) {
      counts.filledProducts++;
      writes.push({ kind: "products", rec: { ...have, ...patch }, what: `product ${shown}: fill ${Object.keys(patch).join(", ")}` });
    }
    continue;
  }
  counts.newProducts++;
  const rec: Product = {
    ...blank.products(newId(), p.name, now),
    brand: p.brand,
    foodId,
    rating: p.rating,
    status: p.want ? "want" : "tried",
    notes: p.notes,
    links: p.links,
  };
  productByKey.set(nameKey(shown), rec);
  writes.push({ kind: "products", rec, what: `product ${shown}` });
}

console.log(`${file}\n→ ${server} (rev ${state.rev})\n`);
console.log(`Foods:    ${counts.newFoods} new, ${counts.matchedFoods} already there (${counts.filledFoods} get blanks filled)`);
console.log(`Products: ${counts.newProducts} new, ${counts.matchedProducts} already there (${counts.filledProducts} get blanks filled)`);
for (const w of writes.filter((w) => w.what.includes(": fill"))) console.log(`  ${w.what}`);
if (problems.length) console.log(`\nCheck:\n${problems.map((p) => "  " + p).join("\n")}`);

if (!apply) {
  console.log(`\nDry run: nothing written. Add --apply to write ${writes.length} records.`);
  process.exit(0);
}

// ---- write: foods first (parents before kinds, as listed), then products ----
let done = 0;
const ratingEntries: string[] = [];
for (const w of writes) {
  const r = await fetch(`${server}/api/${w.kind}/${w.rec.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(w.rec) });
  if (!r.ok) {
    console.error(`\nStopped at ${w.what}: ${r.status} ${await r.text()}\n${done} of ${writes.length} written; running it again skips what's there.`);
    process.exit(1);
  }
  const body = (await r.json()) as { log: { id: string; kind: string }[] };
  for (const e of body.log) if (e.kind === "rating") ratingEntries.push(e.id);
  done++;
}
// The server logs "Rated ❤️" today for each imported rating; they weren't rated today.
const after = (await (await fetch(`${server}/api/state`)).json()) as State;
for (const id of ratingEntries) {
  const e = after.log[id];
  if (e) await fetch(`${server}/api/log/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...e, deleted: true }) });
}
console.log(`\nWrote ${done} records (and tidied ${ratingEntries.length} rating entries). Open foodlab and it syncs.`);
