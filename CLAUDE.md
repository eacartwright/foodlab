# foodlab — notes for Claude

Evan's external memory for food: foods (with is-a and form-of links), the products he buys,
the stores that sell them, recipes built on foods, tags (Work lunch first) and a history log,
on desktop and his Android phone. Principle: rich data underneath, a few fields on the everyday
path. **[DESIGN.md](DESIGN.md) is the spec**; read the relevant section before changing behavior,
and update it when a decision changes. Same stack and conventions as sideshow
(`C:\Dev\sideshow`); when in doubt, do it the way sideshow does.

## Run / test

```sh
npm install
npm run dev        # server :8788 + web :5174 (proxies /api); the phone uses the LAN "Network" URL
npm test           # vitest: parser, derived views and search (shared), the store (server)
npm run typecheck  # tsc (TypeScript 7) over all three packages
```

Data is `data/foodlab.db` (SQLite, git-ignored, per machine). Test against a scratch DB:
`FOODLAB_DB=<scratch>/t.db PORT=7798 node --import tsx packages/server/src/index.ts` after
`npm run build` (the server then serves the app too). Browser checks: `playwright-core` with
`channel: "msedge"` on NOSTROMO, headless, in a scratch folder. Two inputs can share an
aria-label (a page's title behind the Quick add dialog): scope selectors to `.quick-add`.

## Architecture

- `packages/shared` — `types.ts` (records, the eating fields, meal tags, `blank.*` for new
  records, `productName` = brand + name, `withoutBrand`), `validate.ts` (body → clean record, used by the server on every save),
  `ingredients.ts` (`parseLine`, `nameKey` for plural/case-proof matching, `formatAmount`),
  `derive.ts` (`View`: reverse links, preferred products, ancestors/descendants, staple
  suggestions, the `+` search, the Eat list). Pure; tests beside them.
- `packages/server` — Node + Hono + `node:sqlite` (Node ≥ 22.13). `db.ts`: relational tables
  (foods, stores, products + `product_stores`, recipes + `recipe_ingredients`, tags +
  `item_tags`, `log_entries`, `dev_notes`, `grocery_items`, `meta.rev`), `loadState` / `save.<kind>`. `store.ts`: the state
  in memory; `put(kind, id, body)` validates, checks links (no unknown ids, no food loops,
  meal tags fixed), writes a `rating` log entry when a rating changes, bumps `rev`.
  `index.ts`: `GET /api/state` (all of it, ETag = rev), `PUT /api/<kind>/<id>` (whole
  record), `/api/health`, and the built app with SPA fallback (`/share`, `/foods/<id>`…).
- `packages/web` — React + Vite, installable PWA with a **share target** (`/share`,
  `manifest.webmanifest`). `sync.ts`: server state cached in localStorage + an **outbox** of
  whole records (latest version per record, in first-changed order; a `seq` stops a reply
  for an older version clearing a newer one); 4xx drops the record with a toast, network
  errors retry. `router.tsx`: plain paths, `go`, `setQuery`, `<A>`; the snapshot compares the
  raw `location.search` (comparing re-encoded params looped forever, 2026-10-23).
  `actions.ts`: `ensureFood/Store/Tag` (find by `nameKey` or make), `ingredientsFromText`
  (unchanged lines keep their ingredient and hand-picked food), `remove` (tombstone + Undo),
  `duplicate`, `addDevNote`.
  Pages in `components/`; in-place inputs in `controls.tsx` (`DraftInput`, `DraftTextarea`,
  `Picker`, `MultiPicker`, `Segmented`, `RatingInput`, `TagEditor`).

Every save is a whole record and must build on the **latest** copy (`data().state…`), not
the one from the last render, or two quick saves undo each other. A new recipe opens with
`?edit=1` in the address: the mode must not depend on whether it has ingredients yet (it
used to flip to the recipe view mid-typing).

Schema changes: **append** a migration to `MIGRATIONS` in `server/src/db.ts`; never edit old
ones. The server copies the DB to `<db>.before-v<N>.db` before migrating. Deletions are
tombstones (`deleted`), restorable with Undo or the page's Restore.

## UI conventions (same as sideshow)

- All colors are tokens in `web/src/styles.css` (light + dark), dark keyed on
  `html[data-theme="dark"]` set by `theme.ts` from the per-device Colors setting; an inline
  script in `index.html` sets it before first paint. No `prefers-color-scheme` in CSS directly.
- Buttons `--tap` (36px), fields `--control` (34px), shared height and radius; inputs 16px text.
  Focus states always visible. foodlab's accent is green (`--primary`).
- Two personalities: lists and food/product/store pages look like a database editor; a recipe
  reads like a recipe until ✎ Edit. Under 860px: top bar, ☰ drawer, floating + (Quick add).
- The phone's Back closes the drawer, Quick add and Settings (`App.tsx` pushes a history entry).

## Gotchas (carried over from sideshow)

- `tsx watch` hangs under `concurrently` on Windows; the server uses `node --watch --import tsx`.
- Install workspace deps one command at a time and check package.json after.
- `'concurrently' is not recognized` = `npm install` hasn't been run. npm 12's "install
  scripts blocked … esbuild" warning is harmless (`@esbuild/win32-x64` still installs).
- `crypto.randomUUID` needs a secure context; use `newId()` from shared.
- `listen EACCES` on a free port = Windows NAT reserved it. Reserve 8788 and 5174 on NOSTROMO
  the same way as sideshow's 8787 / 5173; don't just pick another port.
- Android install needs the manifest and icons reachable without the Access login (runbook),
  or there's no share target.

## Working with Evan

- Commit and push only when asked.
- Prefers the Claude desktop app / claude.ai over the terminal; give GUI steps where possible.
- Develops on NOSTROMO (`C:\Dev\foodlab`). Personal phone: **Android** (always); the iPhone 13
  is sideshow's. The mini PC hosts the real app at `C:\Apps\foodlab`, port 8082
  ([docs/runbook.md](docs/runbook.md)).

## Status (2026-10-23)

- **M1 built** (DESIGN.md §10), in a cloud session, and checked there: 38 tests, typecheck,
  build, and a headless walkthrough (add product with a new store, recipe with parsed lines,
  food links, `+` search, Eat with lunch filters, staples, store page, offline add then sync,
  phone layout in dark, Back closing the drawer, Share to foodlab). 2026-10-22 on NOSTROMO:
  install, tests, typecheck and `npm run dev` all fine. Pushed to
  github.com/eacartwright/foodlab (private, `main`). Deployed the same day: live at
  https://foodlab.evans.tools (Access login on the app, the five icon paths public).
- 2026-10-23, first day of use: ratings ❤️ 👍 👎; gluten-free says how sure (migration 2 maps
  yes → labeled, GF option → blank; Not GF never in Eat); products shown as brand + name
  (migration 2 strips a leading brand from names); Duplicate on foods/products/recipes; Dev
  notes (📝 beside ⚙). Pushed 2026-10-24 (`8f19617`, with + Form / + Kind picking existing
  foods and a roomier desktop Quick add); deploy is Evan's `update.ps1` on the mini PC. Show or sort a product by `productName` / `nameOf`,
  never `.name` alone.
- 2026-10-24: **M2 Groceries built** (DESIGN.md §4.10, §5.8): `groceries` kind / `grocery_items`
  (migration 3), `View.grocery*`, actions `needGrocery` / `gotGrocery` / `ungotGrocery` /
  `addToGroceries`, `GroceriesPage.tsx` (+ `GroceryButton` on food, product, staple rows).
  48 tests, typecheck, build, headless walkthrough (desktop + phone dark). Pushed, not deployed yet.
- 2026-10-24, first trip with Groceries: Done shopping now syncs (`inTrip` on the item,
  migration 4; it used to be per-device localStorage, so the desktop kept the struck-through
  items), and the struck-through rows lost their Undo (tap the box again).
- 2026-10-25: **PLU** on foods (migration 5; shown under Produce / Fruit / Vegetable, on the
  grocery list, searchable). `scripts/import-products.ts` imports a reviewed Markdown file
  (Evan's Obsidian product list: 255 foods, 637 products) through the API; runbook has the steps.
  Tested on a scratch DB; not run on the real one yet.
- 2026-10-25: lists: every column sorts (`?sort=`); Foods and Products have a **List / Tree**
  switch (`View.foodTree`, `useTreeState` in `ListPages.tsx`; view and folds per device); the
  Products list shows a food's path ("Pickles › Baby pickles", `View.foodPath`) and sorts and
  filters by it; Stores has its own + Add. 52 tests, headless-checked on the imported list.
- **Next:** deploy, install on the Android phone, check Share to foodlab, use Groceries in a store.
- Then M3: derived facts from the log on pages, per-recipe product override,
  recipe cards, a Tags page.
