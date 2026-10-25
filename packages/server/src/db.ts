import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { emptyState, type DevNote, type Food, type GroceryItem, type Id, type LogEntry, type Product, type Recipe, type RecipeIngredient, type State, type Store, type Tag } from "@foodlab/shared";

// SQLite persistence: ordinary relational tables, one row per record, links in their own tables
// (product_stores, recipe_ingredients, item_tags), so the file reads well in any SQLite browser
// and queries like "favorites sold at Wegmans used in breakfast recipes" stay plain SQL.
// Schema changes go in MIGRATIONS, appended, never edited.

const EATING = `
    rating TEXT,
    status TEXT NOT NULL DEFAULT 'tried',
    gluten_free TEXT NOT NULL DEFAULT 'unknown',
    notes TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '[]',
    travels TEXT,
    keeps_days INTEGER,
    effort TEXT,`;
const BASE = `
    deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    rev INTEGER NOT NULL`;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,       -- is a
    form_of_id TEXT,      -- form of
    staple INTEGER NOT NULL DEFAULT 0,
    shelf_life TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',${BASE}
  );
  CREATE TABLE stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',${BASE}
  );
  CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    food_id TEXT,         -- product of
    brand TEXT NOT NULL DEFAULT '',
    buy_again TEXT,
    shelf_life TEXT NOT NULL DEFAULT '',${EATING}${BASE}
  );
  -- sold at
  CREATE TABLE product_stores (
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    PRIMARY KEY (product_id, store_id)
  );
  CREATE INDEX product_stores_store ON product_stores(store_id);
  CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT,
    yield_qty REAL,
    yield_unit TEXT NOT NULL DEFAULT '',
    prep_min INTEGER,
    cook_min INTEGER,
    instructions TEXT NOT NULL DEFAULT '',${EATING}${BASE}
  );
  -- ingredient in
  CREATE TABLE recipe_ingredients (
    recipe_id TEXT NOT NULL,
    id TEXT NOT NULL,
    position INTEGER NOT NULL,
    line TEXT NOT NULL,
    food_id TEXT,
    quantity REAL,
    unit TEXT NOT NULL DEFAULT '',
    prep TEXT NOT NULL DEFAULT '',
    optional INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (recipe_id, id)
  );
  CREATE INDEX recipe_ingredients_food ON recipe_ingredients(food_id);
  CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,   -- meal | personal${BASE}
  );
  -- tagged: item_kind is foods | products | recipes
  CREATE TABLE item_tags (
    item_kind TEXT NOT NULL,
    item_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (item_kind, item_id, tag_id)
  );
  CREATE INDEX item_tags_tag ON item_tags(tag_id);
  -- logged: history on a recipe or product
  CREATE TABLE log_entries (
    id TEXT PRIMARY KEY,
    item_kind TEXT NOT NULL,
    item_id TEXT NOT NULL,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    rating TEXT,
    text TEXT NOT NULL DEFAULT '',${BASE}
  );
  CREATE INDEX log_entries_item ON log_entries(item_id);
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  INSERT INTO meta (key, value) VALUES ('rev', '1');
  -- The fixed meal tags (DESIGN.md §4.9).
  INSERT INTO tags (id, name, kind, created_at, updated_at, rev) VALUES
    ('meal-breakfast', 'Breakfast', 'meal', 0, 0, 1),
    ('meal-lunch', 'Lunch', 'meal', 0, 0, 1),
    ('meal-work-lunch', 'Work lunch', 'meal', 0, 0, 1),
    ('meal-dinner', 'Dinner', 'meal', 0, 0, 1),
    ('meal-snack', 'Snack', 'meal', 0, 0, 1),
    ('meal-dessert', 'Dessert', 'meal', 0, 0, 1);
  `,
  // 2026-10-23: gluten-free says how sure (certified … not GF); "GF option" is for restaurant
  // dishes, later. Product names lose a leading brand (shown as brand + name now). Dev notes.
  `
  UPDATE products SET gluten_free = 'labeled' WHERE gluten_free = 'yes';
  UPDATE products SET gluten_free = 'unknown' WHERE gluten_free = 'option';
  UPDATE recipes SET gluten_free = 'unknown' WHERE gluten_free IN ('yes', 'option');
  UPDATE products SET name = ltrim(substr(name, length(brand) + 1), ' ,:-')
    WHERE brand <> ''
      AND lower(substr(name, 1, length(brand))) = lower(brand)
      AND substr(name, length(brand) + 1, 1) IN (' ', ',', ':', '-')
      AND ltrim(substr(name, length(brand) + 1), ' ,:-') <> '';
  CREATE TABLE dev_notes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',  -- the page it was written on
    done INTEGER NOT NULL DEFAULT 0,${BASE}
  );
  `,
  // 2026-10-24: Groceries (M2): things I buy, needed or not, never completed.
  `
  CREATE TABLE grocery_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    food_id TEXT,
    product_id TEXT,
    need INTEGER NOT NULL DEFAULT 0,   -- on the list
    note TEXT NOT NULL DEFAULT '',     -- this time only
    needed_at INTEGER,                 -- when it went on the list (its order)
    got_at INTEGER,                    -- last checked off
    count INTEGER NOT NULL DEFAULT 0,  -- times got${BASE}
  );
  `,
  // 2026-10-24: Done shopping ends the trip on every device, not just the one it was tapped on.
  `ALTER TABLE grocery_items ADD COLUMN in_trip INTEGER NOT NULL DEFAULT 0;`,
];

export type DB = DatabaseSync;

/** Open (creating if needed) and bring the schema up to date. */
export function openDb(file: string, upTo = MIGRATIONS.length): DB {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (version > 0 && version < upTo) {
    // Keep a copy from before the schema changes, so a bad migration can be undone.
    const copy = `${file}.before-v${version + 1}.db`;
    if (!existsSync(copy)) db.exec(`VACUUM INTO '${copy.replaceAll("'", "''")}'`);
  }
  for (let v = version; v < upTo; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return db;
}

/** Run `fn` in a write transaction; rolls back if it throws. */
export function transaction<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getRev(db: DB): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'rev'").get() as { value: string } | undefined;
  return row ? Number(row.value) : 0;
}
export function setRev(db: DB, rev: number) {
  db.prepare("INSERT INTO meta (key, value) VALUES ('rev', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(rev));
}

type Row = Record<string, any>;
const base = (r: Row) => ({ id: r.id as Id, deleted: !!r.deleted, createdAt: r.created_at as number, updatedAt: r.updated_at as number, rev: r.rev as number });
const eating = (r: Row, tags: Id[]) => ({
  rating: r.rating,
  status: r.status,
  glutenFree: r.gluten_free,
  notes: r.notes,
  links: JSON.parse(r.links) as string[],
  tagIds: tags,
  travels: r.travels,
  keepsDays: r.keeps_days,
  effort: r.effort,
});

export function loadState(db: DB): State {
  const s = emptyState();
  s.rev = getRev(db);
  const tagsOf = new Map<string, Id[]>();
  for (const r of db.prepare("SELECT * FROM item_tags").all() as Row[]) {
    const k = `${r.item_kind}:${r.item_id}`;
    tagsOf.set(k, [...(tagsOf.get(k) ?? []), r.tag_id]);
  }
  const storesOf = new Map<Id, Id[]>();
  for (const r of db.prepare("SELECT * FROM product_stores").all() as Row[]) {
    storesOf.set(r.product_id, [...(storesOf.get(r.product_id) ?? []), r.store_id]);
  }
  const ingredientsOf = new Map<Id, RecipeIngredient[]>();
  for (const r of db.prepare("SELECT * FROM recipe_ingredients ORDER BY recipe_id, position").all() as Row[]) {
    const list = ingredientsOf.get(r.recipe_id) ?? [];
    list.push({
      id: r.id,
      line: r.line,
      foodId: r.food_id,
      quantity: r.quantity,
      unit: r.unit,
      prep: r.prep,
      optional: !!r.optional,
      note: r.note,
    });
    ingredientsOf.set(r.recipe_id, list);
  }
  for (const r of db.prepare("SELECT * FROM foods").all() as Row[]) {
    s.foods[r.id] = {
      ...base(r),
      name: r.name,
      parentId: r.parent_id,
      formOfId: r.form_of_id,
      staple: !!r.staple,
      shelfLife: r.shelf_life,
      notes: r.notes,
      tagIds: tagsOf.get(`foods:${r.id}`) ?? [],
    } satisfies Food;
  }
  for (const r of db.prepare("SELECT * FROM stores").all() as Row[]) {
    s.stores[r.id] = { ...base(r), name: r.name, notes: r.notes } satisfies Store;
  }
  for (const r of db.prepare("SELECT * FROM products").all() as Row[]) {
    s.products[r.id] = {
      ...base(r),
      ...eating(r, tagsOf.get(`products:${r.id}`) ?? []),
      name: r.name,
      foodId: r.food_id,
      brand: r.brand,
      storeIds: storesOf.get(r.id) ?? [],
      buyAgain: r.buy_again,
      shelfLife: r.shelf_life,
    } satisfies Product;
  }
  for (const r of db.prepare("SELECT * FROM recipes").all() as Row[]) {
    s.recipes[r.id] = {
      ...base(r),
      ...eating(r, tagsOf.get(`recipes:${r.id}`) ?? []),
      name: r.name,
      method: r.method,
      yieldQty: r.yield_qty,
      yieldUnit: r.yield_unit,
      prepMin: r.prep_min,
      cookMin: r.cook_min,
      instructions: r.instructions,
      ingredients: ingredientsOf.get(r.id) ?? [],
    } satisfies Recipe;
  }
  for (const r of db.prepare("SELECT * FROM tags").all() as Row[]) {
    s.tags[r.id] = { ...base(r), name: r.name, kind: r.kind } satisfies Tag;
  }
  for (const r of db.prepare("SELECT * FROM log_entries").all() as Row[]) {
    s.log[r.id] = {
      ...base(r),
      itemKind: r.item_kind,
      itemId: r.item_id,
      date: r.date,
      kind: r.kind,
      rating: r.rating,
      text: r.text,
    } satisfies LogEntry;
  }
  for (const r of db.prepare("SELECT * FROM dev_notes").all() as Row[]) {
    s.devnotes[r.id] = { ...base(r), text: r.text, path: r.path, done: !!r.done } satisfies DevNote;
  }
  for (const r of db.prepare("SELECT * FROM grocery_items").all() as Row[]) {
    s.groceries[r.id] = {
      ...base(r),
      name: r.name,
      foodId: r.food_id,
      productId: r.product_id,
      need: !!r.need,
      note: r.note,
      neededAt: r.needed_at,
      gotAt: r.got_at,
      inTrip: !!r.in_trip,
      count: r.count,
    } satisfies GroceryItem;
  }
  return s;
}

const baseCols = (x: { id: Id; deleted: boolean; createdAt: number; updatedAt: number; rev: number }) => ({
  id: x.id,
  deleted: x.deleted ? 1 : 0,
  created_at: x.createdAt,
  updated_at: x.updatedAt,
  rev: x.rev,
});
const eatingCols = (x: Product | Recipe) => ({
  rating: x.rating,
  status: x.status,
  gluten_free: x.glutenFree,
  notes: x.notes,
  links: JSON.stringify(x.links),
  travels: x.travels,
  keeps_days: x.keepsDays,
  effort: x.effort,
});

function upsert(db: DB, table: string, cols: Record<string, unknown>) {
  const names = Object.keys(cols);
  db.prepare(`INSERT OR REPLACE INTO ${table} (${names.join(", ")}) VALUES (${names.map((n) => `@${n}`).join(", ")})`).run(
    cols as Record<string, any>,
  );
}

function setTags(db: DB, kind: "foods" | "products" | "recipes", id: Id, tagIds: Id[]) {
  db.prepare("DELETE FROM item_tags WHERE item_kind = ? AND item_id = ?").run(kind, id);
  const ins = db.prepare("INSERT INTO item_tags (item_kind, item_id, tag_id) VALUES (?, ?, ?)");
  for (const t of tagIds) ins.run(kind, id, t);
}

export const save = {
  foods(db: DB, x: Food) {
    upsert(db, "foods", {
      ...baseCols(x),
      name: x.name,
      parent_id: x.parentId,
      form_of_id: x.formOfId,
      staple: x.staple ? 1 : 0,
      shelf_life: x.shelfLife,
      notes: x.notes,
    });
    setTags(db, "foods", x.id, x.tagIds);
  },
  stores(db: DB, x: Store) {
    upsert(db, "stores", { ...baseCols(x), name: x.name, notes: x.notes });
  },
  products(db: DB, x: Product) {
    upsert(db, "products", {
      ...baseCols(x),
      ...eatingCols(x),
      name: x.name,
      food_id: x.foodId,
      brand: x.brand,
      buy_again: x.buyAgain,
      shelf_life: x.shelfLife,
    });
    setTags(db, "products", x.id, x.tagIds);
    db.prepare("DELETE FROM product_stores WHERE product_id = ?").run(x.id);
    const ins = db.prepare("INSERT INTO product_stores (product_id, store_id) VALUES (?, ?)");
    for (const s of x.storeIds) ins.run(x.id, s);
  },
  recipes(db: DB, x: Recipe) {
    upsert(db, "recipes", {
      ...baseCols(x),
      ...eatingCols(x),
      name: x.name,
      method: x.method,
      yield_qty: x.yieldQty,
      yield_unit: x.yieldUnit,
      prep_min: x.prepMin,
      cook_min: x.cookMin,
      instructions: x.instructions,
    });
    setTags(db, "recipes", x.id, x.tagIds);
    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(x.id);
    const ins = db.prepare(`INSERT INTO recipe_ingredients (recipe_id, id, position, line, food_id, quantity, unit, prep, optional, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    x.ingredients.forEach((i, n) => ins.run(x.id, i.id, n, i.line, i.foodId, i.quantity, i.unit, i.prep, i.optional ? 1 : 0, i.note));
  },
  tags(db: DB, x: Tag) {
    upsert(db, "tags", { ...baseCols(x), name: x.name, kind: x.kind });
  },
  log(db: DB, x: LogEntry) {
    upsert(db, "log_entries", {
      ...baseCols(x),
      item_kind: x.itemKind,
      item_id: x.itemId,
      date: x.date,
      kind: x.kind,
      rating: x.rating,
      text: x.text,
    });
  },
  devnotes(db: DB, x: DevNote) {
    upsert(db, "dev_notes", { ...baseCols(x), text: x.text, path: x.path, done: x.done ? 1 : 0 });
  },
  groceries(db: DB, x: GroceryItem) {
    upsert(db, "grocery_items", {
      ...baseCols(x),
      name: x.name,
      food_id: x.foodId,
      product_id: x.productId,
      need: x.need ? 1 : 0,
      note: x.note,
      needed_at: x.neededAt,
      got_at: x.gotAt,
      in_trip: x.inTrip ? 1 : 0,
      count: x.count,
    });
  },
};
