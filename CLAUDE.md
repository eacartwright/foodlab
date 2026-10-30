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
  `ingredients.ts` (`parseLine`, `ingredientsFromText`: links existing foods only, never makes one, `nameKey` for plural/case-proof matching, `formatAmount`),
  `ai.ts` (models + prices, `AiSettings`, `costUsd`, `crossed` alert levels),
  `recipeRead.ts` (`recipeFromHtml`: schema.org Recipe JSON-LD; `recipeFromText`: pasted text),
  `derive.ts` (`View`: reverse links, preferred products, ancestors/descendants, staple
  suggestions, the `+` search, the Eat list). Pure; tests beside them.
- `packages/server` — Node + Hono + `node:sqlite` (Node ≥ 22.13). `db.ts`: relational tables
  (foods, stores, products + `product_stores`, recipes + `recipe_ingredients`, tags +
  `item_tags`, `log_entries`, `dev_notes`, `grocery_items`, `settings` (one row, `app`: Meal times, AI), `ai_usage` (server-only), `meta.rev`), `loadState` / `save.<kind>`. `store.ts`: the state
  in memory; `put(kind, id, body)` validates, checks links (no unknown ids, no food loops,
  meal tags fixed), writes a `rating` log entry when a rating changes, bumps `rev`.
  `index.ts`: `GET /api/state` (all of it, ETag = rev), `PUT /api/<kind>/<id>` (whole
  record), `/api/health`, `GET` / `POST /api/files` (`files.ts`: photos and attachments in `data/files`), `GET /api/read-recipe?url=` (`readRecipe.ts`: fetches a shared page openly, never
  disguised as a browser; no recipe data → Claude), `POST /api/read-text`, `GET /api/ai`, `POST /api/ai/compare`
  (`ai.ts`: Claude via `@anthropic-ai/sdk` `messages.parse`, GPT via `openai` `responses.parse`, both + Zod,
  effort low, each provider on with its key, cost into `ai_usage`, monthly cap), and the built app with SPA fallback (`/share`, `/foods/<id>`…).
- `packages/web` — React + Vite, installable PWA with a **share target** (`/share`,
  `manifest.webmanifest`). `sync.ts`: server state cached in localStorage + an **outbox** of
  whole records (latest version per record, in first-changed order; a `seq` stops a reply
  for an older version clearing a newer one); 4xx drops the record with a toast, network
  errors retry. `router.tsx`: plain paths, `go`, `setQuery`, `<A>`; the snapshot compares the
  raw `location.search` (comparing re-encoded params looped forever, 2026-10-23).
  `actions.ts`: `ensureFood/Store/Tag` (find by `nameKey` or make), `setIngredientFood`, `remove` (tombstone + Undo),
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
  reads like a recipe until ✏️ Edit. Under 860px: top bar, bottom tab bar (☰ More opens the drawer), floating + (Quick add).
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
- Develops on NOSTROMO, his desktop, and sometimes HPBROBOOK, his laptop (`C:\Dev\foodlab` on both). Personal phone: **Android** (always); the iPhone 13
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
  Run on the real one by Evan, 2026-10-25: the product list now lives in foodlab, not Obsidian.
- 2026-10-25: lists: every column sorts (`?sort=`); Foods and Products have a **List / Tree**
  switch (`View.foodTree`, `useTreeState` in `ListPages.tsx`; view and folds per device); the
  Products list shows a food's path ("Pickles › Baby pickles", `View.foodPath`) and sorts and
  filters by it; Stores has its own + Add. 52 tests, headless-checked on the imported list.
- 2026-10-25, Evan's dev notes: ingredient lines save on leaving the box (pauses made junk foods,
  10 left to delete); Dev Notes edit and an optional page link, mirrored to `data/dev-notes.md`;
  Eat opens on the meal for the time (Settings → Meal times, `mealTimes.ts`); `X-Foodlab-Build`
  → **↻ Update**. 56 tests, headless-checked from a scratch copy. Then ingredient lines stopped
  making foods at all: no match = text, linked from the Food box (opens with the parsed name).
  Meal times went app-wide: `settings` kind (migration 6), `mealNow` / `mealTimes` in shared;
  search highlights the same meal. 59 tests, browser-checked on a scratch copy.
- 2026-10-26, Evan's dev notes: text boxes save only when left (a pause save's trimmed reply
  reset the box mid-typing); Groceries' Usual has **Tidy** (chips delete, with Undo); "Usually"
  (preferred product) hidden until accurate; the phone has a **bottom tab bar** (More · Recipes ·
  Products · Groceries · Search). Pushed (`951c25e`). Placeholder text: Evan is listing which to cut.
- `Z:` on Evan's laptop is the mini PC's `C:` (`\\ripley\C`), so `Z:\Apps\foodlab` is the
  **live clone**: never edit, build or `npm install` there, and never open its `data/foodlab.db`
  over the share (copy it with its `-wal` to scratch to look). Develop in
  `C:\Dev\foodlab`; read the live dev notes at `Z:\Apps\foodlab\data\dev-notes.md`.
- 2026-10-26: **M1 and M2 done** (deployed, installed from Chrome on the Pixel 8a, Share working,
  Groceries offline checked in airplane mode).
- 2026-10-26: **reading a shared recipe** built (DESIGN.md §5.5): any shared link is read; a
  recipe fills Quick add and opens in Edit; sites that refuse (403) get **Paste**. 68 tests.
- 2026-10-26: **Settings → sections down the side; AI section** (DESIGN.md §5.9): model switch, month's
  cost meter + alerts + cap, Compare models. Claude reads pages without recipe data and pasted text.
  Tested against a local stand-in for the API (no key on the laptop); 72 tests. Not yet run for real:
  Evan adds `ANTHROPIC_API_KEY` (runbook), then Compare Haiku vs Opus on real recipes and picks one.
- 2026-10-27: Lists: no ingredient line under recipes, no want-to-try pill (Recipes filters by
  tried). **Scaling** on the recipe view (DESIGN.md §5.4, `shared/scale.ts`): − servings +, kitchen
  rounding, Save keeps `myYield` (migration 8). 81 tests, browser-checked on a scratch DB.
- 2026-10-27: **Tags page** (`/tags`, DESIGN.md §5.10): rename, merge, delete with Undo
  (actions `mergeTag` / `deleteTag` / `renameTag`, `View.tagged`, `swapTag`). 86 tests, browser-checked.
- 2026-10-27: **log facts** (DESIGN.md §5.4): made / bought / ate counts and last dates on recipe,
  product and food pages, Last made / Last bought columns (`View.done`, `View.lastBought`). 87 tests.
- 2026-10-27: **M3 done**; cook view and product override moved to "later" (DESIGN.md §10).
- 2026-10-27: **M5 photos built** (DESIGN.md §5.11): `photos` on products and recipes, `files` on dev notes
  (migration 9), `server/files.ts` (sideshow's), `web/uploads.ts` (shrinks on the device),
  `components/Photos.tsx`. 89 tests, browser-checked on a scratch copy.
- 2026-10-27: **suggested photo** on a read recipe (DESIGN.md §5.5): `photoFromHtml`, `GET /api/fetch-photo`,
  Use this photo in Quick add. Checked with a real BBC Good Food link. 92 tests.
- 2026-10-28, Evan's dev notes: **Photo from link** on a recipe without one and Settings → Data →
  **Find photos** (`GET /api/page-photo`, `photoFromLink` in `web/ai.ts`); pasting a picture into Dev
  Notes attaches it; sidebar icons are all emoji (🔍 Search, ⭐ Staples, 🏷️ with VS16, 🧪 Dev Notes, ⚙️). 92 tests,
  browser-checked on a scratch DB.
- 2026-10-28: recipe view lost the "want to try" badge and its 📷 / 🔗 photo buttons (Edit only).
- 2026-10-28: photos can be pasted (Ctrl+V on the page, or 📋 Paste photo via `navigator.clipboard.read`), on
  recipes in Edit and on products. Browser-checked.
- 2026-10-29: Settings → **Experimental**: sideshow's font tester (header and app font, per device,
  `fonts.ts` / `fonts-sans.ts`, Settings undimmed). Browser-checked.
- 2026-10-29: **OpenAI beside Claude** (as in sideshow, DESIGN.md §5.9): GPT-6 Luna, GPT-6.1 Terra / Sol;
  each provider on with its key (`OPENAI_API_KEY`); Model is a dropdown by provider; Compare runs the
  models with a key. Checked against a stand-in OpenAI server (`OPENAI_BASE_URL`). 92 tests.
- **Next: M4** (places & dishes) or M6 (weights).
