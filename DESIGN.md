# foodlab — Design

*v0.6 · 2026-11-09 · living document, edit freely*

## 1. Purpose

foodlab is **my external memory for food**: what foods are, which specific products I buy and
what I think of them, where I buy them, what I can make, what I've learned making it, and
(later) where I eat. Not a recipe app. (Formerly planned as The Pantry Ledger.)

The question it answers first is **"what can I eat?"**, and the most urgent version of that is
**"what do I bring for lunch tomorrow?"** That answer pulls from recipes and products (and
later restaurant dishes) at once, not from recipes alone.

Two goals:

1. **The system remembers things for me without making me maintain it.** The everyday path is
   a few fields; the rich detail exists when I care about it.
2. **Fast answers.** "Work lunches that pack cold and keep 3 days", "everything with lemon",
   "what do I buy at Wegmans" are one search or one tap.

Over time it also shows **my food infrastructure**: the foods that keep turning up in what I
like are the staples I should always have, and staples + preferred products + stores are most
of a standing shopping list.

## 2. Principles (in priority order)

1. **Rich data underneath, simple interaction on top.** Adding a product is name, food, rating,
   done. Adding a recipe is name, ingredients, instructions, done. Everything else is optional
   and can come later.
2. **Never delete what I didn't like.** A 👎 product stays, with why ("too salty, doesn't
   melt"), so six months later I know I tried it.
3. **Foods are concepts, products are things I buy.** Recipes use foods ("American cheese");
   a food knows my preferred products. Finding a better cheese changes one place, not 40 recipes.
4. **Derive what can be derived.** Preferred products, "used in", "contains lemon", staple
   suggestions and history are worked out, not typed in.
5. **Tags over categories, fields where I filter.** Breakfast/lunch/work lunch/quick/no-cook
   overlap, so they're tags. "Needs a microwave" and "keeps 3 days" are fields, because the
   lunch view filters on them.
6. **Recipes are living records.** Experiments go in a dated log; the recipe isn't overwritten.
7. **The data outlives any service.** Self-hosted, one SQLite file of ordinary relational
   tables, backed up like sideshow.
8. **Store exact, show human.** Quantities are stored as exact numbers and units so scaling
   and weights can come later without re-entering anything.
9. **One database, two personalities.** Foods, products and stores look like a database
   editor (fields, links, lists); a recipe reads like a recipe. Same records underneath.
10. **Phone for capture and lookup, desktop for curating.** Capture and lookup screens are
    phone-first (store, kitchen); bulk editing and tidying are desktop work.
11. **Same stack and conventions as sideshow** (§9).

## 3. Non-goals (for now, not forever)

Nutrition and allergen calculation, barcode scanning, pantry inventory (how many eggs I have),
meal planning, price tracking, OCR, AI generation or substitution engines (reading a shared
recipe is planned, §5.5),
multiple users, native apps. Any can come later once the core is in daily use; nothing in the
model blocks them (inventory would hang off foods and products, like staples do).

## 4. Core concepts

```
                 is a (parentId)                    form of (formOfId)
   Cheese ◀──────────── American cheese     Lemon ◀──────────── Lemon juice
                              ▲                                      ▲
                     product of (foodId)                    product of (foodId)
                              │                                      │
                  Kraft Deli Deluxe ──sold at──▶ Wegmans ◀──sold at── Santa Cruz Organic
                                                   ▲
Ham & cheese sandwich ─ingredient in─▶ American cheese, GF bread…     (stores ⋈ products)
       │
       ├─ tagged ─▶ Lunch, Work lunch
       └─ logged ─▶ 10/22 made · "used Cooper Sharp, better"
```

**Eatables** answer "what can I eat?": recipes and products at home, dishes at places (M4,
§4.11). They share the eating fields (§4.6). Foods don't: a food is a concept, not a meal.

### 4.1 Relationship vocabulary

Everything the app stores between things is one of these. Everything else is derived.

| Link | From → to | Stored as | Example |
|---|---|---|---|
| **is a** | food → food | `food.parentId` | American cheese is a Cheese |
| **form of** | food → food | `food.formOfId` | Lemon juice is a form of Lemon |
| **product of** | product → food | `product.foodId` | Santa Cruz Organic is a product of Lemon juice |
| **sold at** | product ⋈ store | `product_stores` | Santa Cruz Organic is sold at Wegmans |
| **at** | dish → place | `dish.placeId` | Hot bar mac and cheese is at Wegmans |
| **ingredient in** | food → recipe | `recipe_ingredients` (+ quantity, unit, prep) | 2 slices American cheese in Ham & cheese |
| **tagged** | anything ⋈ tag | `item_tags` | Ham & cheese is tagged Work lunch |
| **logged** | log entry → recipe/product | `log_entries` | 10/22 made it, used Cooper Sharp |
| *substitutes for* | food → food | later; food notes until then | cornstarch for flour |

Read backwards or computed, not stored: **used in** (ingredient in, reversed), **sells**
(sold at, reversed), **forms** (form of, reversed), **preferred product** (the food's products
by rating), **potential staple** (§4.7), **times made / last made** (log entries).

### 4.2 Food

| Field | Notes |
|---|---|
| `name` | Required. "American cheese", "lemon juice", "GF sandwich bread". |
| `parentId` | **Is a**, optional, any depth, for browsing (Cheese → American cheese). Labelled **Kind of** on screen (2026-10-30), so a group can be named singular or plural ("Kind of: Spices and seasonings"). |
| `formOfId` | **Form of**, optional: a derived food (Lemon juice → Lemon). |
| `staple` | Something I want to keep in the house. Not inventory. |
| `shelfLife` | Optional text ("3 weeks opened, fridge"). Belongs on a form or product, not on Lemon. |
| `plu` | The produce sticker code ("4053" = lemon), 4 or 5 digits. Asked for only on Produce, Fruit, Vegetable and their kinds (is a, not form of); searchable, and shown beside the item on the grocery list, so I learn them. |
| `notes` | What I know about it generally (melts well, mild), substitutions, storage. |
| `wiki` | **Wikipedia** (2026-11-09, migration 16): its article, a tidy URL (section kept: Lettuce#Varieties). See §5.13. |
| `aliases` | **Also called** (2026-11-09, migration 18): other names, comma-separated on the page ("green onions, spring onions" for Scallions). Found, searched, offered in every food picker and matched in recipe lines like the name; a name wins over an alias. One name, one food: a name that's already another food's name or alias is left off, with a toast. |
| `tagsOff` | **Not here** (2026-11-09, migration 17): tags from the foods above switched off here and for everything under it. See §5.1. |
| `tags` | |

**Form vs prep.** A form is its own food with its own page; a prep is a word on a recipe line
("diced", "zested"). The test for promoting a prep to a form: **does it have its own products,
its own shelf life, or its own substitutions?** Lemon juice has all three, so it's a form.
Zest, for me, has none, so it's prep ("1 lemon, zested") until I start buying dried zest; then
it becomes a form and recipes don't change. "Bottled lemon juice" isn't a food at all: bottled
is just what lemon juice's *products* are, and fresh is its *form of* link back to Lemon.

A food's page shows: what it is (parent) and what it's a form of; its forms; its products, best
first; the recipes that use it (and those using its forms); the preps used on it in recipes.

### 4.3 Product

| Field | Notes |
|---|---|
| `brand` | "Bell & Evans". Typed first, suggested from brands already used. |
| `name` | Required. The rest of the name: "Gluten Free Chicken Breasts". |
| `foodId` | **Product of**. Optional at capture ("unsorted"), easy to fill later. |
| `notFood` | (2026-11-04) Toothpaste, tissues: see below. |
| `storage` | **Kept in** (2026-11-09, migration 15): Pantry · Fridge · Freezer, blank = not set. Where it is in the store and at home. The food tree says what a thing *is*, so frozen tater tots and fresh potatoes can share a branch; this says it's frozen. Search finds it by "frozen" / "freezer", "fridge" / "refrigerated", "pantry" / "shelf-stable". |
| `storeIds` | **Sold at**, any number of stores. |
| `buyAgain` | yes · no · blank. Separate from rating: liked but too pricey, etc. |
| `shelfLife` | Optional. |
| eating fields | §4.5 |

Ready-made meals I buy (a Wegmans prepared bowl, a frozen meal) are products, with or without
a food.

**Not food** (2026-11-04): grocery stores sell things I don't eat. Typing "toothpaste" on the
grocery list is enough for most of them; when the brand or the store matters it's a product with
the Not food box ticked, not a new kind of record or a sidebar entry. It has no food (saving clears
the link; ticking it on the page offers Undo), is never in What can I eat?, doesn't ask gluten-free,
shelf life or meals, and has no "ate" in its history. It's still in Products (its own group in the
Tree), search, its places' pages and Groceries.

**Brand + name, shown as one** (2026-10-23): a product is shown everywhere as "<brand> <name>"
("Bell & Evans Gluten Free Chicken Breasts"), so two brands of the same thing never look
generic. The page title is two boxes, brand then name; Quick add has a Brand box before the
name. The name never repeats the brand: saving strips a leading brand, and Quick add splits a
known brand off a typed or shared name ("Bell & Evans Nuggets" → Bell & Evans + "Nuggets").
Quick add's Brand box suggests known brands as you type (+ New brand for one it doesn't know),
and a brand that's also a place (Wegmans) fills in Sold at with it (2026-11-08).
Brand stays its own field so brand pages or filters can come later.

### 4.4 Place (was Store)

**Stores became Places** (M4, 2026-10-31): Wegmans is where I buy products *and* where I eat
from the hot bar, so it's one record, not two. Still `stores` in the code, tables and sync
(`Store`, `storeIds`, `product_stores`); "Place" on screen and `/places` in the address
(`/stores` still works).

| Field | Notes |
|---|---|
| `name` | Required. |
| `types` | Any of **Grocery store · Specialty store · Prepared food · Restaurant**: a fixed list, like meal tags, so the Places filters are reliable. **Prepared food** (2026-10-31) is a store you can eat at (a hot bar, deli counter or café inside), so Wegmans is Grocery store + Prepared food, not a restaurant. |
| `speed` | **Quick** (fast food, fast casual, a counter or hot bar) · **Sit-down**. Not Takeout (2026-11-01): nearly everywhere does it, so it isn't a speed; places I order ahead from get a personal `takeout` tag. |
| `cost` | $ · $$ · $$$. |
| `status` | **Been** · **Want to go** (stored as tried / want), blank = not said (most stores). |
| `rating` | ❤️ · 👍 · 👎, like everything else. |
| `locations` | (2026-10-31) Where it is: one for most places, several for a chain. Each has a `name` that tells it apart ("Pittsford"; blank when there's one), `address` (🗺️ Map ↗), `phone` (📞 Call) and `hours` (text, as the place says them). Products and dishes point at the place, not a location: "sold at Wegmans" is what I ask. Migration 12 moved a place's address / phone / hours into its first location. |
| `links` | Its site, Find Me Gluten Free, a menu. |
| `tags`, `notes` | |

A place's page: those fields, then **Dishes** (when it has any, or is a restaurant or has a
speed or prepared food) and **Sold here** (products, grouped ❤️ / 👍 / not rated / 👎 don't buy; when it has any, or
is a store, or has no type yet). Searching "Wegmans" finds the place, its products and its dishes;
"restaurant" finds the restaurants.

### 4.5 Recipe

| Field | Notes |
|---|---|
| `name` | Required. |
| `method` | `assembly` · `no-cook` · `cook` · `bake`. A sandwich or cereal is a legit recipe. |
| `yieldQty` / `yieldUnit` | "1 sandwich", "1 loaf", "12 muffins", "4 servings". |
| `myYield` | How many I usually make, in the yield's unit; the recipe opens scaled to it. Blank = as written. |
| `prepMin` / `cookMin` | Optional. |
| `instructions` | Light Markdown (lists, bold, links). |
| eating fields | §4.6 |

**Recipe ingredient**: `position`, the original `line`, `foodId`, `quantity` (exact number),
`unit`, optional `grams` (later), `prep`, `optional`, `note`, optional `productId` (later: this
recipe wants Cooper Sharp, not the food's usual pick). I type lines; they're parsed:

```
2 slices American cheese          → 2 · slices · American cheese
1 lemon, zested                   → 1 · — · Lemon · prep "zested"
1½ cups cooked rice (optional)    → 1.5 · cups · cooked rice · optional
salt, to taste                    → — · — · salt · prep "to taste"
```

The food is matched by name and the line is kept as typed, so a parse I don't like never
loses anything. Plurals and case match the same food ("Lemons" → Lemon). A line whose food
doesn't exist yet stays **text**, linked to nothing: typing never makes a food (2026-10-25,
after half-typed lines made junk ones). Linking it is the Food box beside the line, opened with
the parsed name typed in: pick a food, or **New food** on purpose. Changing a line's amount or
prep keeps the food it was linked to.

A line can link any food, a kind included: the level chosen says how picky the recipe is
(Caesar → Romaine; a side salad where any greens work → Leafy greens). See §4a, parents vs leaves.

### 4.6 Eating fields (recipes, products, dishes)

| Field | Values |
|---|---|
| `rating` | ❤️ · 👍 · 👎 (offered best first), blank = not rated. |
| `status` | `tried` · `want to try`. |
| `glutenFree` | Products: `certified` · `labeled` · `ingredients` (no gluten ingredients) · `facility` (shared facility) · `no`, blank by default. Dishes: `menu` · `modified` · `ask` · `no` (§4.11). Recipes: none on screen (2026-10-31; the column stays, unread). |
| `notes` | |
| `links` | URLs (recipe source, product page, Find Me Gluten Free). |
| `travels` | `packs cold` · `needs microwave` · `eat as-is`. **Shelved** 2026-10-30 (below). |
| `keepsDays` | Days it lasts in the fridge. Shelved. |
| `effort` | `grab` (buy it) · `quick` (< 15 min) · `prep` (cook ahead). Shelved. |

**The Work lunch box is shelved** (2026-10-30): splitting Lunch and Work lunch wasn't as
intuitive as it looked; Lunch covers it. Travels, keeps and effort aren't shown or filtered on
any more, but stay in the tables (and in `View.eat`'s filter) with what was entered, to bring
back if a lunch view wants them.

**Gluten-free** (2026-10-23): everything in foodlab is gluten-free, because I have celiac and
never knowingly eat anything else; a product I find isn't GF gets marked, not kept as an
option. So the field doesn't ask *whether*, it says **how sure**: certified, labeled, no gluten
ingredients, or made in a shared facility. **Not GF** is for someone else's food (a partner's
favorite): it's flagged "not GF" in lists and **never shows in Eat**. A recipe is GF by what
goes in it, so it has no field: its "Not GF (someone else's)" box went 2026-10-31, and a non-GF
version of a recipe will be a **variant** with substitutions (§10, later). It's not on Quick add. "GF option" is gone: that's a
restaurant idea (GFM, gluten-free modified), and belongs to dishes in M4.

### 4.7 Staples

- **Marked**: the `staple` flag on a food, set by me.
- **Suggested**: foods that aren't staples but show up in **2 or more recipes I've rated 👍 or
  ❤️** (or have made), counted through their forms too ("Garlic — in 6 recipes you like").
  One tap marks one.
- **The standing list**: each staple with its preferred product and where that's sold, grouped
  by store. That's the boilerplate shopping list, with no inventory needed. The real one,
  with "need it now", is Groceries (§4.10); staples are always in its Usual (§5.8).

### 4.8 Log entry (the history of everything)

One dated record on a recipe or product: `date` (today by default), `kind` (`made` · `ate` ·
`bought` · `note` · `rating`), optional `rating` (how it was *this time*), `text`.

- The current rating is a field on the thing; **changing it writes a `rating` log entry by
  itself** (👍 → 👎), so rating history exists without my keeping it.
- "I made Lemon Chicken on 08/22" is a `made` entry. No separate recipe-instance object until
  log entries prove too thin (actual quantities, photos).
- The recipe itself is edited separately when I decide a change is permanent.

### 4.9 Tags

Shared by everything, two kinds:

- **Meal tags**, a fixed list so filters are reliable: Breakfast · Lunch · Dinner · Snack ·
  Dessert. Shown as chips, never misspelled. Work lunch was one until 2026-10-30; it's a
  personal tag now, `work lunch` (migration 10 kept everything tagged; meal times on it moved to Lunch).
- **Personal tags**, free-form and autocompleted: quick, no-cook, meal prep, comfort food,
  "good when I'm exhausted". Stored lowercase; tidied on the Tags page (§5.10).

"Contains lemon" is **not** a tag: search derives it from ingredients (§5.1).

**Flavor tags** (2026-11-09): personal tags for how something tastes, kept to a short list so
they get used: `sweet` · `savory` · `salty` · `spicy` · `tangy` · `lemony` · `smoky` · `creamy` ·
`cheesy` · `crunchy` · `fresh` · `rich`. Flavor belongs to the finished thing, so they go on
**recipes** one by one, and on a **food** only when every kind and product under it tastes that
way (Desserts `sweet`, Hot sauce `spicy`, Pickles `tangy`, Potato chips `salty` `crunchy`): a
food's tag never reaches a recipe that uses it (§5.1), and a recipe with lemon in it isn't
necessarily lemony. `lemony` is narrower than `tangy`, not the same, so lemony things get both.
Flavors that differ inside one food (rice crisps: Caramel vs Buffalo Ranch) go on the products.

**Aliases** (2026-11-09, migration 14, `Tag.aliases`): other words for a tag (tangy: sour, tart,
bright, acidic, zesty). Search matches them like the name; a Tags box picks the tag when one is
typed ("bright" adds tangy, the alias shown beside it), so tagging stays one word and searching
takes any. A word means one tag: one that's already another tag's name or alias is left off,
with a toast (checked in the app, not on the server, so an Undo arriving in either order never
bounces). A name wins over an alias (`View.findTag`). An alias is the **same** meaning: a
narrower word (lemony) is its own tag.

### 4.10 Grocery item

Groceries is **one standing list of things I buy, and each one is either needed or not**. No
due dates, no projects, nothing to complete. Getting milk doesn't finish milk: it goes back to
being a thing I usually buy, one tap from being on the list again. Nothing is ever rewritten.
(Why: Todoist turned the same list into a dated task, a pile of "completed" items and a 25/30
counter, and the same ten things typed out again every week.)

| Field | Notes |
|---|---|
| `name` | Required, as typed: "Milk", "the good bagels". |
| `foodId` / `productId` | Optional links, filled in when the typed name matches a food or product (by `nameKey`), or picked later. A product gives the item its stores. |
| `need` | yes / no. **On the list** or not. The only thing the everyday path changes. |
| `note` | This time only: "2", "the big one". Cleared when it goes back on the list. |
| `neededAt` | When it last went on the list: the list's order. |
| `gotAt` | When it was last checked off: this trip, and undoing it. |
| `inTrip` | Checked off and still on screen this trip. Done shopping clears it, so it ends the trip on every device. |
| `count` | Times got. Orders the Usual list. |

- An item is made **once**, the first time I type it, and is never made again: typing "milk"
  next time finds it and sets `need`.
- A food's item ("Butter") stands for any of its products until one is picked for it: Kerrygold's
  page says it's on the list, and + Groceries there links the same item to Kerrygold rather
  than making a second butter.
- Checking it off sets `need` to no, `gotAt` to now, adds one to `count`. If it links a product,
  it also writes a **`bought` log entry** on the product, so "last bought" exists for free.
  Undo takes both back.
- **Not needed** (on the row) takes it off without counting it as bought.
- Delete (a tombstone, as everywhere) is for something I'll never buy again, not for "got it".
  It's on the row, and for what's off the list, **Tidy** on Usual (2026-10-26): the chips
  turn to × and delete, each with Undo. Staples stay (they come from foods).
- Pantry inventory stays a non-goal (§3): `need` is "I'm out", not "I have 3".

### 4.11 Dish (M4)

Something I eat at a place: a restaurant's burger, a bowl I assemble at the hot bar. `name`,
`placeId` (optional at capture, like a product's food) and the eating fields (§4.6), photos and
history (`ate` and notes; ratings logged like everything else).

**Dish or product?** (2026-10-31) Anything packaged with a label is a **product**, even made by
the store: Wegmans' frozen meals, and its fresh bowls made daily (they're on its site). Assembled
at a hot bar or made to order is a **dish**.

**Gluten-free on a dish** says how it's offered: **GF menu** (on the gluten-free menu) ·
**GF modified** (GFM: made GF on request; notes say how) · **Ask** (ask each time) · **Not GF**
(someone else's; never in Eat). Places don't have a GF field: dedicated GF kitchens and the like
go in notes and tags until that proves too thin.

## 4a. Model decisions

Answers to the ChatGPT sessions' modeling questions. Each is revisitable once there's data.

- **Own object or field?** An object if I'd search it, link to it, or it has history: food,
  product, store, recipe, log entry, tag (place and dish later). Everything else is a field.
- **Ingredient = food + quantity + unit + prep.** "Shredded cheddar" is cheddar, prep
  "shredded"; diced/minced/sliced onion are all onion.
- **Granularity:** a separate food only if I'd **buy or substitute it differently**. Chicken
  thigh, yes; bone-in chicken thigh, only if a recipe cares; large chicken thigh, no (size goes
  in the line: "2 large"). Romaine, spinach and arugula, yes: each is bought separately and
  none stands in for the others in a Caesar. Spring mix, yes: it's bought as one thing.
- **Parents vs leaves** (2026-11-09): **parents (kinds) are for browsing and flexible recipes;
  leaves are for buying and specific recipes.**
  - Products point at the most specific food. Wegmans Romaine Hearts is a product of Romaine;
    "hearts" is packaging, a product detail, not a food.
  - A recipe line points at the most specific food the recipe *really needs*: Caesar → Romaine;
    a side salad where any greens work → Leafy greens or Lettuce. The level chosen records how
    picky the recipe is.
  - The **Kind of** tree follows how I shop and substitute, not loose everyday naming. Search
    walks up the tree (§5.1), so a wrong kind makes search wrong: if Spinach were a kind of
    Lettuce, "lettuce" would find sautéed spinach. Example:

    ```
    Leafy greens
    ├── Lettuce
    │   ├── Romaine
    │   ├── Iceberg
    │   └── Butter lettuce
    ├── Spinach
    ├── Arugula
    ├── Kale
    └── Spring mix
    ```
  - Most products and most recipe lines should land on leaves.
- **Food vs product:** facts about the food in general go on the food; opinion, brand, where I
  buy it, price and package go on the product.
- **Opinion:** 👎 / 👍 / ❤️ + buy again + tried / want to try + staple. No taste/texture/value
  sub-scores: they wouldn't change what I buy.
- **History:** current state is editable fields; history is log entries, written by me or
  automatically (rating changes). Nothing else is versioned.
- **Stores are objects** (2026-10-23): "what do I buy at Wegmans" is a real question, and a
  text field would have to be torn apart later.
- **Substitutions:** notes on the food until there are enough to deserve a link.
- **Gluten-free stays manual:** deriving it from ingredients would be confidently wrong too often.
  It records how sure, not whether (§4.6).
- **Would I actually enter this?** Every field must pass that test to be on the everyday form.
  Anything that only "theoretically" would gets stored if supplied, never asked for.

## 5. Views

```
Desktop                                         Phone
┌──────────┬───────────────────────────────┐   ┌──────────────────────┐
│ foodlab  │  [ breakfast + lemon + potato ] │   │ foodlab       ● Saved│
│          │  + Food  + Product  + Recipe   │   │ [ search…          ] │
│ Search   │                                │   │ + Food + Prod + Rec  │
│ Eat      │  Recipes · Products · Foods …  │   │ …results / recent    │
│ Groceries│                                │   │                (+)   │
│ ──────── │                                │   ├──────────────────────┤
│ Foods    │                                │   │ ☰  🍳  🛒  🧺  🔍    │
│ Products │                                │   └──────────────────────┘
│ Recipes  │                                │   More Recipes Products
│ Stores   │                                │   Groceries Search;
│ Staples  │                                │   (+) = Quick add
│ ⚙        │                                │
└──────────┴───────────────────────────────┘
```

**The phone's tab bar** (2026-10-26): the right thumb can't reach a menu at the top, so the
most used pages sit at the bottom, most used rightmost: More · Recipes · Products · Groceries ·
Search. **More** opens the drawer (every page, 🧪 and ⚙️), its items pushed to the bottom; the
top bar is just the name and the sync status.

### 5.1 Search (home)

One box over everything. **Terms joined with `+` must all match**: "breakfast + lemon + potato"
finds what is tagged Breakfast *and* involves lemon *and* potato. Without `+` the whole text is
one term. A term matches a thing through its name, brand, notes, tags, its food and that food's
parents and forms, a recipe's ingredient foods (and their parents: "meat" finds a recipe with
chicken thigh when Chicken thigh is a Meat), and its stores ("wegmans" finds what's sold there).
Plurals match ("potatoes" = "potato").

Matching through foods goes **up** the *is a* links, never down: "greens" finds a Caesar that
uses Romaine, but "romaine" doesn't find a salad that only asks for Leafy greens, because that
recipe doesn't call for romaine.

**A food's tags count for its kinds and their products** (2026-10-29), down the *is a* links
only: tag Soda `drink` once and "drinks" finds Diet soda and every soda product. Not down *form
of* (a tag on Lemon isn't one on Lemon juice), and not for recipes (beer-battered fish isn't a
drink). This is how drinks are grouped: "drink" is how I have something, not what it is, so it's
a tag, and the tree stays free to say Huel is a Protein powder. The Tags page's counts are
still the directly tagged things. A tag's aliases count as its words (§4.9): "bright" finds
what's tagged tangy. A food's and a product's Tags show what they inherit (2026-10-30): faded
chips under the tag box, not buttons, "From Beverage" on hover (`View.inheritedTags`);
they're changed on the food they come from. Since 2026-11-09 each faded chip (filled, no border) links
to the food it comes from.

**Not here** (2026-11-09): a tag from above can be switched off on a food, for it and everything
under it (`Food.tagsOff`). Tag Fruit `sweet` once and switch it off on Citrus: Lemon and Lime aren't
sweet, Apple still is. On a food's page each inherited chip has ✕ (*Not here*); a switched-off one
stays, struck through, with ↺ where it was switched off (below that, it just says where). Walking
up the tree, a food's tags count unless a food below switched them off; a food's own tag always
counts (`View.foodTagIds`, `View.inheritedTags`). Products inherit the same way but have no
switches of their own: their own tags say what's different. Merging or deleting a tag rewrites
switches too.

Results are grouped Recipes · Products · Foods · Stores, ❤️ first. With several terms, things
matching only some of them follow under **Partial matches**, most terms first, each saying
which it matched ("1 of 3: breakfast"). Nothing matching offers + Add only for a single term:
"breakfast + lemon" is a search, not something missing. With nothing typed: Add buttons, meal
shortcuts into Eat (the one for the time of day highlighted, §5.2), and recently changed
things (12, then Show more; names only, no second line).

### 5.2 Eat (what can I eat?)

**Home · Out · All** (M4, 2026-10-31), top right: Home (the default) is recipes and products;
Out is dishes, grouped by place (the place with the best dish first); All is everything, mixed.
Out / All stay in the address (`?where=`). The meal chips and filters work the same on all three.

Meal chips (Breakfast · Lunch · Dinner · Snack · Dessert) over one mixed list of
recipes and products with that tag: ❤️, then 👍, then not rated; 👎 hidden unless asked; Not GF
products never. Filters: tried / want to try, show 👎. (Work lunch's travels / keeps / effort filters
were shelved with it, 2026-10-30.)

**Opens on the meal for the time of day** (2026-10-25): four slots in Settings → Meal times,
each a start time and a meal, running until the next (defaults 4:00 Breakfast, 10:30
Lunch, 16:00 Dinner, 23:00 Snack, the last past midnight). App-wide (2026-10-25; it was per
device): the one `settings` record, id `app`, synced like the rest; Colors stays per device.
The search page's meal shortcuts highlight the same meal. A picked chip stays in the address (`?tag=`); it no longer remembers the last one picked, which would beat the clock.

### 5.3 Lists (the database personality)

Foods, Products, Recipes, Stores: a filter box and rows with the useful columns (a product's
brand + name, food, stores, rating; a food's parent, form-of, product and recipe counts, staple).
Clicking a row opens its page. **Every column sorts** (2026-10-25): click a header, again to
flip, a third time back to A–Z by name. Text starts A–Z, counts and ratings start highest
(❤️ first); blanks always last. The sort lives in the address (`?sort=food`, `-` for the other
way), like the filters.

**A product's food with what it's under** (2026-10-25): the Products list shows "Pickles ›
Baby pickles" (the top level dropped once there are three, and a level in between whose name
the food's own name contains, "Tea › Iced tea drink mix"; full path on hover). Sorting by
Food uses the whole path, so every pickle product sits together whatever its kind, and the
filter matches any level ("pickles" finds them all). Stores get **+ Add** on their list (just a
name; an existing one opens instead), not a Quick add kind.

**Foods as a tree** (2026-10-25): a List / Tree switch on Foods (remembered per device, and in
the address as `?view=tree`). The tree is the "is a" links, indented: Condiments › Mustard ›
Yellow mustard. A form with no "is a" sits under what it's a form of, marked *form* (Lemon juice
under Lemon). Products shows the food's own count and, in brackets, the count with its kinds
(Mustard (8)). Branches fold, per device, with Expand all / Collapse all. Sorting orders
siblings. Filtering shows the matches with what they sit under (dimmed), everything open.

**Products as a tree** (2026-10-25): the same List / Tree switch on Products. The foods are
folding headings (plain text, with how many products are under each); products sit under their
food, a food's kinds before its own products; foods with nothing showing are left out, and
products without a food go last under Unsorted. Filters (text, store, rating) open everything
and show only what matches, under its foods. Sorting orders the products within each food.

### 5.4 Pages

Every field edited in place and saved as I go. Links are links: Lemon juice → Santa Cruz → its
stores → Wegmans → everything sold there. Every page has **Delete** (a tombstone, with Undo).
Foods, products and recipes have **Duplicate**: a copy named "… (copy)", opened with the name
selected to type over. It copies what describes the thing, not what I thought of it: no
rating, buy again or history; a product's notes, links and gluten-free stay with the original
(they're about that one product), a recipe's come along (a version of it shares its source).

A **recipe** opens in **recipe view** (the casual personality): yield and time, ingredients as
written with each food a link, instructions, notes and history. Tapping an ingredient shows a
small card (other recipes using it, Open; the preferred product is hidden, see below). **Edit** switches to the fields
and the ingredient lines. A new recipe opens in Edit. The first link is the **source**: a **🔗 site.com ↗**
button beside Made it today (2026-10-28). Any others (a video, what it was adapted from, a crust
from another site) are **More links** at the bottom; Edit still takes as many as wanted.

**What the log says** (`View.done`, `View.lastBought`): a recipe's meta line ends "made 3×,
last Oct 25". Food and product pages had a line like it under the name ("last bought Oct 26",
"bought 2×"); dropped 2026-10-30 so every page goes title, then its fields (the History section
still lists every entry). Recipes and Products lists have a sortable **Last made** /
**Last bought** column (newest first, never-done last). Nothing shows until the log has it.

**Scaling** (`shared/scale.ts`): with a yield, the view has **− 4 servings +** (whole steps, a
half below one). Only what's shown changes; the lines keep their amounts as written. The
instructions scale their measured amounts ("measure 2 cups", "1-cup rice"), never times,
temperatures, pan sizes or a can's size ("a 10-ounce can"). A scaled amount is shown in the accent, rounded to what you'd
measure: tsp / tbsp / cups switch to the handiest ("1 tbsp + 1 tsp", ¼ cup), spoons to ⅛–¾,
cups to ¼ / ⅓ / ½ / ⅔ / ¾, under about ⅛ tsp "a pinch", lb ↔ oz, counted things in halves
(quarters below a half). "≈" marks an amount rounded more than 3%. Lines without a number
("salt to taste", "a pinch of salt") stay. **Save** keeps the size as the recipe's `myYield`;
**Reset** goes back to as written.

### 5.5 Quick add and sharing into foodlab

**+** (header on desktop, floating on the phone) opens Quick add: Food · Product · Recipe, the
name focused, then only the everyday fields (product: food, stores, rating; its meals are
set on its page, 2026-11-08). Enter
saves and opens the new page; **Add another** keeps the form open. On desktop (most adding
happens at a 1920×1080 screen) it's a roomy dialog, about 820px wide; the phone layout gets its
own pass later.

**Share to foodlab (Android):** installed from Chrome, foodlab is a share target. Sharing a page
(a recipe site, a product listing, a Find Me Gluten Free place) opens Quick add with its title
as the name and its link filled in.

**Reading a shared recipe** (M3; built 2026-10-26). Sharing any link has the server fetch it
(`GET /api/read-recipe`, openly as foodlab, web pages only, 15 s, 5 MB) and read the recipe
data most recipe sites embed (schema.org `Recipe`, `shared/recipeRead.ts`): name, yield,
times, ingredient lines, instructions (HowToSections become `###` headings). Free, no AI. A
page with a recipe turns Quick add into a Recipe showing "✓ 12 ingredients · 10 steps"; Add
makes it and opens it in **Edit** to check (the review is the Edit page, not a step before
saving: deleting is a tombstone with Undo). Ingredient lines link foods the usual way (§4.5).

**Suggested photo** (2026-10-27): the page's own picture of the dish, the recipe data's `image`
(what the site gives Google), else the picture its link shows when shared (`og:image`,
`twitter:image`): `photoFromHtml`. Quick add shows it under the summary with **Use this photo**,
ticked. The server fetches it (`GET /api/fetch-photo`: images only, 15 MB, every redirect checked
like the page, never the home network), since sites often won't let another page show theirs;
on Add it's shrunk and uploaded like any photo (§5.11), after the recipe is saved. Paste has none.
The picture is the site's: kept for my own reference in a private app, never shared on.
Recipes saved before this, or without a photo (2026-10-28): **🔗 Photo from link** in Edit on a
recipe with a link and no photo, and **Settings → Data → Find photos** for all of them, one at a time with a
count. `GET /api/page-photo?url=` reads the page again (no AI, so no cost) and answers with its
photo; the app shrinks and adds it the same way.

Some sites refuse anything but a browser (Allrecipes, Serious Eats, Budget Bytes, Brown Eyed Baker: 403). foodlab
doesn't disguise itself to get past that; Quick add says the site wouldn't let it read the
page and offers **Paste**: copy the recipe on the phone, paste, **Read it**
(`recipeFromText`: first line the name, lines under Ingredients / Instructions, else lines
starting with an amount are ingredients). Paste works without a link too.

**Claude reads what the plain reader can't** (2026-10-26, §5.9): a page with no recipe data
has its readable text sent to Claude (`server/ai.ts`, structured output in the recipe's
shape, effort low), and **Read it** on pasted text goes to Claude, falling back to
`recipeFromText` when AI is off, capped, keyless or offline. Quick add shows which read it
and the cost ("Opus 5.5 · 3.10¢"). Pages with recipe data never go to Claude.

### 5.6 Staples

Marked staples by store (the standing list, §4.7), then Suggested staples with **Mark staple**.

### 5.7 Dev notes (while foodlab is being built)

🧪 at the bottom of the sidebar (and the phone's drawer), beside ⚙️, opens **Dev Notes**: one box
for an idea, a bug or something odd, and the open notes below with a Done box and ✎ to edit
the text. **Link it to this page** (off to start, remembered per device; 2026-10-25) saves the
page it was written on, which is often beside the point. **Copy** puts the open ones on the
clipboard as a Markdown list, to paste into a work session. The server also rewrites
`data/dev-notes.md` on every change, so Claude can read them on the mini PC without the database. They're their own records (`devnotes`), kept apart from the food, synced
like everything else, never in search. They can go once the app settles.

### 5.8 Groceries

Its own sidebar entry, under Eat, and phone-first (it's used in the store, often with no
signal: checking off goes through the outbox like any save). A red badge counts what's left to
get, beside the word in the sidebar and drawer, on the icon in the phone's tab bar; none at zero.

```
┌ Groceries ──────────────── 5 ┐   the count is what's on the list, nothing else
│ [ add…                     ] │   typing matches Usual first, then foods, products
│ ○ Milk                       │
│ ○ Eggs                  · 2  │   note
│ ○ Butter        Wegmans      │   a product's store
│ ✓ Bread                      │   checked this trip, struck through; tap again to undo
│ ──── Usual ───────────────── │
│ + Cheddar  + Bananas  + Rice │   one tap puts it back on the list
└──────────────────────────────┘
```

- **The list**: what's needed, in the order added. Tap the circle to check it off.
- **This trip**: checked items stay on screen struck through for 3 hours or until **Done
  shopping**, which syncs, so the trip ends on the phone and the desktop alike. Tapping the
  checked box again undoes it (no separate Undo). Then they quietly join Usual. They never pile up.
- Tapping an item opens its row: name, this time's note, food, product, Not needed, Delete.
- **Usual**: everything I've bought that isn't needed, most-bought first, plus staples (§4.7)
  not yet on it. One tap = needed. Typing in the add box filters it, then offers foods and
  products I haven't bought yet (not 👎 ones); Enter adds the text as typed, linked to the food
  or product it names.
- Adding from elsewhere: **+ Groceries** on a food, product or staple row puts it on the list
  (making the item if it's new).

### 5.9 Settings and AI

⚙ opens Settings with its **sections down the side** (2026-10-26; sideshow's tabs across the
top got crowded): General (Colors, per device) · Meal times · **AI** · Data · Experimental. On
the phone the side column is narrow, icon over label. The last section opened is remembered per device.

**Experimental** (2026-10-29, sideshow's font tester): Header font and App font, per device,
from any Google Fonts sans-serif (`web/fonts.ts`, `fonts-sans.ts`); arrowing through the list
applies each live, and Settings doesn't dim the app meanwhile. Temporary: the defaults stay
Unbounded / Bricolage Grotesque; delete the tester (and restore the dimming) when done.

**AI** (app-wide, in the settings record's `ai`):

- **Two providers** (2026-10-29, as in sideshow; Evan wants to try both): Anthropic (Claude)
  and OpenAI (GPT), each on when the server has its key. Under the Model box, a dot per
  provider says which keys the server has.
- **Model**: a dropdown, Off or a model grouped by provider, with its list price (`shared/ai.ts`,
  sideshow's prices, checked 2026-10-29): Claude Haiku / Sonnet / Opus 5.5, GPT-6 Luna,
  GPT-6.1 Terra / Sol. A provider without a key has its models greyed out. Opus 5.5 until
  testing says otherwise. Both read with low effort into the same recipe shape (Zod; Anthropic
  `messages.parse`, OpenAI `responses.parse`).
- **This month**: estimated cost (from token counts × list prices, `shared/ai.ts`), a meter
  against the cap with a tick per alert level (green, warn past an alert, danger at the cap),
  calls and tokens, a bar per day, a table by model, the recent calls (`GET /api/ai`, from
  the `ai_usage` table, migration 7). Usage is server-only, not part of the synced state.
- **Monthly cap** in dollars (default $5; blank = none): at it the server makes no more calls
  until the month turns. The call that crosses it still finishes, so the total can end a
  little over.
- **Alerts at** 50 / 75 / 90% of the cap (default 75 and 90; 100% always): a call that
  crosses one shows a toast, and the meter turns. No push notifications (yet).
- **Compare**: a link or pasted text through every model with a key and the plain reader, side by side
  (cost, time, tokens, what each read), counted in the month's use. For choosing the model.

The keys are `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `.env` on the mini PC (runbook),
either or both, never in the app. Without either the AI section says so and reading works as
before; a picked model whose provider has no key falls back to the plain reader with a note. Refusal fallbacks (re-running a
declined request on another model) are left out: recipes don't trip them, and a fallback
bills at another model's price, which the tracker would miss.

### 5.10 Tags

A list in the sidebar (and More on the phone): **+ Add** makes a personal tag (the box stays open
for the next; they're also made from any item's Tags box). Every tag, how many foods, products and recipes
use it (a link to them: Eat for a meal tag, search for a personal one), sortable. Meal tags
are fixed and listed first. A personal tag's name is edited in its row; a name that's already
another tag's asks to **merge** instead. **Merge…** picks the tag to merge into: everything
tagged with this one gets that one (no repeats) and this one goes. **✕** deletes a tag and takes
it off everything. Merge and delete rewrite the tagged items, so nothing points at a gone tag,
and both have Undo.

**Also** (2026-11-09): a personal tag's aliases (§4.9), comma-separated, edited in their own
column (on the phone, under the name). The filter matches them too. A rename to a word that's
another tag's alias asks to merge into that tag. A merge keeps the merged tag's name and aliases
as aliases of the one it went into, so the old word still finds things; Undo takes them back off.

### 5.11 Photos and files

**Photos** on products and recipes (dishes too, with M4): `photos` on the eating fields, a list
of `{ id, thumb }`, the first the main one. **📷 Add photo** (on the phone: the camera or the
gallery, several at once) shrinks each on the device to 1600px (a JPEG of a few hundred KB, not a
12 MP original) plus a 400px thumbnail, uploads both (`POST /api/files`), then saves the record
through the outbox as usual. An upload needs the server: offline, it says so. **Pasting** (2026-10-28): a
picture pasted anywhere on the page (Ctrl+V; not while a dialog is open) is added the same way, and
**📋 Paste photo** reads one from the clipboard (the phone has no Ctrl+V; the browser asks once). A product shows its
photos under its name; a recipe shows its main photo uncropped, in its own shape (at most 460 × 340): on a desktop to the right of the title, times, servings, tags and rating (2026-10-31), on the phone under the title (adding photos is in Edit only, 2026-10-28;
the view has no "want to try" badge: Tried / Want to try is a filter and a column); search, Eat and Recently changed rows show the main photo's thumbnail
in place of the kind icon. Tapping a photo opens it big: ‹ ›, **Make main**, **Delete** (Undo).

**Files on dev notes:** 📎 in the new note's box and on each note attaches any file as it is (a
screenshot stays sharp), up to 25 MB; pasting a picture into the new note's box (or a note being
edited) attaches it the same way (2026-10-28); pictures show as small previews, everything opens in a new
tab. `data/dev-notes.md` lists them as `files/<id>` beside it, so Claude can open them.

**Storage** (`server/files.ts`, sideshow's): each file once, under its id, in `data/files`, its
name and type in the `files` table; `GET /api/files/<id>` serves it, cached for good (it never
changes). Backups copy new files to `<backups>/files`. Deleting a photo only takes it off the
record; the file stays (small, and Undo works).

### 5.12 Places and dishes (M4)

**Places** in the sidebar (📍), the Stores list renamed: rows with rating, type and speed, cost,
dish and product counts, all sortable, and **filter pills** for type, speed, cost and Been / Want to
go (`?type=restaurant`). **+ Add** asks for a name right there; a new place gets the type being
filtered on. **Dishes** (🥘) is its own list: dish, place, gluten-free, last ate. Quick add has a
**Dish** kind (name, place, rating, meal tags); a new place made from a dish is a Restaurant.
A place's page has **+ Dish**.

**Locations** (2026-10-31): the page shows one location's address, phone and hours at a time;
with two or more a **Location** dropdown picks which (named by its name, else its street), with a
**Location name** box and **Remove** (Undo). **+ Location** adds a blank one. **✨ Fill from page**
takes the place's first link (or any link, or text copied from the page when a site refuses),
the AI model reads it for locations (`POST /api/ai/place`, cost in `ai_usage` as `place`), and
the dialog lists what it found, each checked, marked "updates …" when it's at an address I have.
**Add** fills those in (what was found wins, blanks keep mine) and adds the rest (`withFound` in
`shared/places.ts`), with Undo. Search finds a place by a location's name or address.

Later, if wanted: sharing a Find Me Gluten Free or Google Maps link to make a place (address,
phone and hours read from the page), looking a place up by name alone (needs the model's web
search, a few cents a lookup), "near me", and a dish's price.

### 5.13 Wikipedia (learning about a food)

Built 2026-11-09. A food's **Wikipedia** field: **🔍 Find** searches Wikipedia with the food's name
(the box can be changed, or a link pasted, the mobile site's too), each hit with its picture and
one-line description, so "Chard" or "Pepper" is picked, not guessed. Set, it shows the article's
name (a link), **Change** and ✕. The page then shows an **About** card under the title: the
article's first paragraph (four lines, **More**) and its picture, credited "Wikipedia ↗". It
comes from Wikipedia's public REST interface through the server (`server/wiki.ts`,
`GET /api/wiki/search?q=`, `GET /api/wiki/summary?url=`, asked openly as foodlab, a summary kept a
day); offline there's no card, just the link. A disambiguation page says to pick one meaning. The
point is learning: Endive's page says what endive is, what it's like and its relatives.

Filled in bulk once (2026-11-09) by a script through the API: a food whose name is an article's
title (plurals and "X (food)" too) gets it; the rest went to a review list. Group foods with no
article of their own (Prepared foods) stay blank.

Later: Wikidata's *subclass of* to check the Kind of tree or suggest kinds; the article's
picture as a food's own picture.

### 5.14 Classics and AI recipes (classics built 2026-11-09; AI recipes designed, not built)

The way from a database of what I eat to an app that helps me cook new things.

**Classics** (working name): a dish as an idea, apart from any recipe for it: **Caesar salad**,
**BLT**, **Chicken pot pie**. A new kind, `classics`, a tree like foods (**Salads › Caesar
salad, Cobb salad**; **Sandwiches › BLT, Reuben, Cuban**; **One-pot meals**; **Soups**), each with:

- a **Wikipedia** link and About card (as §5.13);
- its **defining ingredients**, linked to foods, each *required* or *usual* (a Caesar needs
  Romaine, Parmesan and Caesar dressing; croutons and anchovies are usual);
- notes, tags (flavor tags too: a Caesar is `tangy` `savory` `crunchy`), and photos.

A **recipe** says which classic it's a version of (`classicId`, optional), and so can a **dish**
(Panera's Caesar). A classic's page lists my recipes for it and the dishes I've eaten, ❤️ first,
and which of its ingredients I usually have (staples, recently bought). Search matches a recipe
through its classic and the classic's parents ("salad" finds a Caesar recipe that never says
salad). **Variants** (§6) become a recipe that's a version of another.

**Seeding:** Wikipedia's lists (List of salads, List of sandwiches, List of soups) read into
classics, each with its link; the AI model suggests defining ingredients from the article,
linked to my foods, for me to check. A list grows classics the same way Quick add grows foods.

**AI recipes** (after classics): a request ("a Cobb salad", "one-pot chicken dinners", "something
tangy and crunchy for lunch") goes to the model with what the app knows: the classic and its
defining ingredients; my foods (staples, what I buy, what I ❤️ and 👎); my rules (gluten-free,
dairy-free notes); flavor tags and their aliases; my recipes for it so far. It answers with recipes
in foodlab's own shape (lines already linked to my foods, missing ones named), shown in Quick add
to keep, change or drop, never saved by itself. Cost goes through the usual meter and cap (§5.9).

**Before these:** ingredient lines link themselves (§6, "Line matching"), or every AI recipe
comes back half unlinked.

**As built (2026-11-09, migration 19; `Classic`, `classics` / `classic_ingredients` tables,
`recipes.classic_id`, `dishes.classic_id`):** 📖 **Classics** in the sidebar, after Recipes: the
tree (groups bold, kinds indented), what each needs and how many of my recipes (its kinds'
too); + Add asks for a name and opens the new classic. A classic's page: the About card, **Kind
of**, **Also called**, **Wikipedia**, tags (no meal chips: those are for what I eat), notes;
**Ingredients**, each a food with **Needs / Usually** and a short note, ★ when it's a staple,
✕; **+ Ingredient** (any food, or a new one) and **✨ Suggest** (`POST /api/ai/classic`: the name,
its parent and its Wikipedia summary to the model; the answers, matched to my foods with
`matchFood`, come back as a checklist, "new food" where there's none, and only what I tick is
added); **My recipes** (its kinds' too), **+ One of mine** links an existing recipe, **+ New
recipe** opens Quick add with it set; **Dishes I've eaten**; **Kinds**. A recipe's header reads
RECIPE › Salads › Caesar salad; its **Classic** is set in Edit, a dish's on its page. A food's
page lists the classics it's in. Search has a Classics group and finds recipes and dishes
through their classic and its kinds.

Seeded on the live data the same day: nine groups (Salads, Sandwiches, Soups and stews,
One-pot meals, Pasta dishes, Chicken dishes, Breakfast, Mexican dishes, Appetizers and sides)
and about 75 popular classics with their Wikipedia articles and defining ingredients, plus the
foods they needed (Anchovies, Capers, Sauerkraut…); my recipes linked where it was clear
(Butter chicken, Breakfast pizza ×2, Deviled eggs, Disco fries under Poutine…). Grows like
foods: from what I cook and want to try, not a catalog.

## 6. Later (designed for, not built)

- **Line matching and food aliases**: *built 2026-11-09*. A recipe line links to its food by name
  or alias exactly, or else by the longest food name or alias found word for word *inside* its food
  part ("packed cheddar cheese shredded" → Cheddar cheese, "juice of 1 lime" → Lime, "crushed red
  pepper flakes" → Red pepper flakes, not Pepper); `View.matchFood`. Accents don't count ("creme
  fraiche" = Crème fraîche). Settings → Data → **Link lines** links every line with no food that now
  names one (after adding foods or aliases), with Undo.

- **Scaling** in three layers: exact quantity → human measurement (3½ tbsp) → practical, using
  the measuring tools I own. Ingredient behavior (discrete: eggs, onions; sensitive: salt,
  leavening) decides how to round. *Built 2026-10-27 (§5.4)*: exact → kitchen measures, counted
  things in halves; not yet "the tools I own" or salt and leavening rounded more carefully.
- **Weight alongside volume** (`grams` on ingredients), with a volume/weight toggle.
- **Techniques** as their own pages ("dicing an onion"), linked from instructions.
- **Variants** (my version, small batch). Until then, log entries and notes cover it.
- **Substitutions** as links. Until then, food notes.
- **Inventory**: counts on foods or products, if they ever earn their keep. The shopping list
  is Groceries (M2), and needs no inventory.
- **Recipe view header, round two** (to revisit, 2026-10-31): with a tall photo beside it the
  facts leave empty space under the source link. Ideas: times and servings on one line ("Cook ·
  prep 5 min · cook 20 min · makes − 4 servings +"), tags beside the rating buttons; and, apart
  from the header, the Ingredients column staying in view while scrolling the instructions.
- **Saved searches**: a `+` search kept by name, one tap from home.
- **Groceries by store or aisle**: grouping the list by a product's store, or a store's aisle
  order, once the list is in use and it's clear whether that's wanted.

## 7. Look & feel

Same as sideshow: the same fonts and token structure, high contrast, visible focus, light/dark
from one set of tokens with a per-device System/Light/Dark setting, `--tap` 36 px buttons and
`--control` 34 px fields, 16 px input text. foodlab's own accent (green) so the two apps are
told apart at a glance. Ratings are the emoji themselves, big enough to tap.

## 8. Platforms

- **Android phone (Chrome), installed as an app** from the site (Chrome menu → Add to home
  screen / Install). That gives the home-screen icon, a full-screen app and **Share to
  foodlab**. Evan's personal phone is and will stay Android; the iPhone is sideshow's (work) and
  not a foodlab target.
- **Windows desktops**, in the browser (installable from Edge/Chrome too).

## 9. Architecture

```
Android (installed) ──┐                 ┌─ Mini PC ─────────────────────┐
                      ├─ Cloudflare ───▶│ foodlab server (Node + Hono)  │
Desktop browser ──────┘  Tunnel+Access  │  ├─ SQLite (node:sqlite)      │
                                        │  └─ daily backup → NAS        │
                                        └───────────────────────────────┘
```

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | Same as sideshow; types, validation, parsing and search shared by client and server. |
| Layout | npm workspaces: `packages/shared`, `packages/server`, `packages/web` | Same as sideshow. |
| UI | React + Vite, installable PWA | Same as sideshow. |
| Server | Node + Hono | Same as sideshow. |
| DB | `node:sqlite`, plain SQL, append-only numbered migrations | Same as sideshow. Relational tables (foods, products, stores, product_stores, recipes, recipe_ingredients, tags, item_tags, log_entries; grocery_items from M2): the relationships are the point. |
| Sync | **Whole-record saves + a small outbox** (not sideshow's ops/reducer) | See below. |
| Hosting | Mini PC, `C:\Apps\foodlab`, port 8082, `https://foodlab.evans.tools` via Cloudflare Tunnel + Access | Same pattern as sideshow (8081). |

**Sync.** The app loads everything (`GET /api/state`; a personal food database is small) and
keeps a copy for reading offline. Each change saves the **whole record** (`PUT /api/<kind>/<id>`),
which is idempotent and last-write-wins, so it goes through a tiny **outbox**: the latest version
of each changed record waits in localStorage until the server takes it, in the order made. That
makes adding things with no signal (a store basement) work from the start, for less code than
handling failures would take. sideshow's ops + reducer exist for shared running timers and exact
timestamps; foodlab has neither. A save the server refuses (a bug, not a connection problem) is
dropped with a message instead of blocking the rest.

**New builds** (2026-10-25). An installed app can stay open for days on an old build (there's
no service worker; Android just resumes the page). Every `/api` reply carries
`X-Foodlab-Build`, the hashed script `index.html` loads; when it differs from the page's own,
**Saved** becomes **↻ Update** (a reload). Coming back to the app with one waiting, nothing
unsaved and nothing focused reloads by itself.

**"Usually" (the preferred product) is hidden** on food pages and ingredient cards
(2026-10-26): it isn't accurate yet. `View.preferredProduct` stays; bring the line back when
ratings and buys make it right.

**Text saves when the box is left**, never on a pause in typing. Ingredient lines first
(2026-10-25): pauses mid-word made foods called "GF b", "GF bran flakes (" and so on. Then
all text boxes (2026-10-26): the server trims, and its reply to a pause save reset the box
mid-typing (the space just typed vanished, the cursor stepped back). Leaving the app or the
page counts as leaving the box (Done on a recipe too). Lines no longer make foods at all (§4.5).

## 10. Milestones

| # | Goal | Done when… |
|---|---|---|
| **M1** | What can I eat (lunch first) | Foods (is a, form of, staple), products (stores, ratings, eating fields), stores, recipes with parsed ingredient lines, meal and personal tags, the `+` search, Eat with Work lunch filters, lists and pages, Quick add, Share to foodlab, Staples with suggestions, rating history and hand-written log notes, offline outbox. Deployed at foodlab.evans.tools, installed on the phone. **Done 2026-10-26**: deployed, installed from Chrome on the Pixel 8a, Share to foodlab working. |
| **M2** | Groceries | A standing list that replaces Todoist (§4.10, §5.8): items made once and needed or not, check off with this trip's Undo, Usual (most bought + staples) one tap from the list, + Groceries on foods, products and staples, `bought` log entries for linked products. Works offline in the store. **Done 2026-10-26**: deployed and used for a shop; offline checked in airplane mode (revisit if a real store says otherwise). |
| **M3** | Memory | Log entries' derived facts on pages (times made, last made, last bought); reading a shared recipe (§5.5); Tags page (rename, merge, delete). **Done 2026-10-27** (card view and product override moved to later). |
| **M4** | Places & dishes | Places (restaurants, stores with prepared food: address → Maps, phone, hours, Find Me Gluten Free link, been / want to try) and dishes with the eating fields, Tried / Want to try per place. Dishes join Eat. **Built 2026-10-31** (§4.4, §4.11, §5.2, §5.12): stores became places, migration 11. |
| **M5** | Photos | On products, recipes and dishes (sideshow's file store), and photos or files on dev notes (§5.11). **Built 2026-10-27** for products, recipes and dev notes; dishes get them with M4. |
| **M6** | Scaling & weights | §6. |
| later | — | **Cook view** of a recipe: only ingredients and steps, bigger text, screen kept awake (no rating, tags, notes or history). **Per-recipe product override**, once "Usually" is accurate (maybe from what's bought most among liked products). Techniques, variants, substitutions, inventory, Groceries by store or aisle, then §3. |

## 11. Open questions

(None blocking.) To watch once there's real data: whether staple suggestions need a tighter
rule; whether log entries need actual quantities (a recipe-instance object).

- **Kinds on recipe lines** (2026-11-09, decide before much is filed this way). When a line
  links a kind (Leafy greens), the kind usually has no products of its own, so its "Usually"
  (hidden for now, §9) would be empty. Leaning: **roll up its kinds' products**, ❤️ first ("your
  greens: Wegmans Spring Mix, Organic Girl Baby Spinach…"). Staple suggestions already count a
  line toward the food *and its kinds above it* (`View.stapleSuggestions`), never toward foods
  below: a Leafy greens line doesn't count for Romaine, which is right. The catch is the other
  direction: one Romaine recipe and one Spinach recipe would suggest **Leafy greens** as a
  staple, which is too vague to shop from. Watch for it; maybe suggest only foods with products,
  or leaves.

- **Found in** (2026-10-25, to try): where in a store a product is ("Refrigerated" vs the
  shelf, the dairy section), without going store-specific (aisle 15 at Westwood Wegmans). Could
  group the grocery list by section. The import put "Refrigerated" in those products' notes
  until then.
- **Storage** (2026-10-25, to try; **built 2026-11-09** as Kept in, §4.3): wanted once the food tree
  stopped grouping by aisle (Frozen foods gone). Grouping the grocery list by it is still to try.
- **Links in the system browser** (2026-10-31, from a dev note; **built 2026-10-31** as Settings →
  General → Outside links: In the app / Browser, shown on Android only, `web/links.ts`; **works on the
  Pixel**, 2026-10-31: Chrome hands the intent link to the browser): in the installed app on Android, outside links (recipe source, product links, links in
  notes) open in Chrome's in-app view over the app. Plan: Settings → General, **per device**
  (localStorage, like Colors), off by default. When on and on Android, one click handler catches
  outside http(s) links and opens an Android intent link instead,
  `intent://<host><path>#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=<url>;end`,
  so the default browser (or the matching app, e.g. YouTube) opens it; the fallback opens the link
  as now. Unknown: whether Chrome hands the intent off or just opens it in place when Chrome is
  itself the default browser. Build it, deploy, then check on the phone; drop it if Chrome
  keeps it in place. Desktop doesn't need it (an installed app already opens links in the browser).

Decided:

- 2026-11-09: **parents vs leaves** (§4a): products and specific recipe lines land on leaves;
  kinds are for browsing and flexible recipes; the Kind of tree follows how I shop and
  substitute (Spinach and Arugula are Leafy greens, not Lettuce). Search matches up the tree,
  never down (§5.1).
- 2026-10-31: **M4**: stores become **places** (one record for Wegmans the store and Wegmans the
  hot bar), typed Grocery store / Specialty store / Restaurant, with speed (Quick / Sit-down) and
  cost ($–$$$) as filter pills. **Dishes** are what's assembled or made to order at a place;
  anything packaged (frozen meals, the daily fresh bowls) stays a product. A dish's GF is GF menu
  / GF modified / Ask / Not GF. Eat gets **Home / Out / All**, opening on Home.
- 2026-10-31: a recipe's **Not GF (someone else's)** box is gone (§4.6); non-GF versions will be
  recipe variants with substitutions. A product page's header shows its food's whole path
  (PRODUCT › Dry good › Bread crumbs › Panko bread crumbs), like a food page's.
- 2026-10-27: **M5 photos** (§5.11): shrunk on the device (1600px + a 400px thumbnail), files kept
  forever in `data/files` like sideshow's; dev notes attach any file as it is.
- 2026-10-27: **M3 done.** The recipe card view (now "cook view": ingredients and steps only,
  bigger text, screen awake) and the per-recipe product override are low priority: moved to later.
- 2026-10-27: **Tags page** (§5.10, M3): rename, merge, delete; merge and delete take the tag
  off (or swap it on) every item rather than leaving a tombstone behind them.
- 2026-10-27: **scaling** a recipe's amounts for the view, rounded to kitchen measures (§5.4).
  It opens as written unless a size is saved for that recipe (`myYield`, migration 8).
  Lists don't mark want-to-try (most recipes will be); the rating marks tried, and Recipes
  filters by tried.
- 2026-10-25: **PLU on foods** (§4.2). The Obsidian "Food Products" list imported through a
  reviewed Markdown file (`scripts/import-products.ts`, runbook): ⭐ → ❤️, ~~struck~~ → 👎,
  *italic* → want to try; its headings became the food tree, Produce split into Fruit and Vegetable.
- 2026-10-24: **Groceries** is M2, ahead of Memory, because Todoist isn't working for it. It's
  one standing list: each item is needed or not, never completed, never retyped (§4.10, §5.8).
  Its own sidebar entry. Later milestones move down one (dishes are M4).
- 2026-10-23 (first day of use): ratings offered ❤️ 👍 👎. **Gluten-free says how sure**
  (certified · labeled · no gluten ingredients · shared facility · not GF); Not GF never in Eat;
  "GF option" left for M4 dishes (§4.6). **Brand + name shown as one**, brand first (§4.3).
  **Duplicate** on foods, products, recipes (§5.4). **Dev notes** (§5.7). Sidebar foot: sync
  status left, 🧪 and ⚙️ right.

- 2026-10-23: **forms** (`formOfId`) beside **is a** (`parentId`); the form-vs-prep test (§4.2);
  "bottled" lives on products, not as a food. **Stores are objects.** **Staples** are marked and
  suggested; inventory stays later. The **relationship vocabulary** (§4.1). The `+` search as
  the home page, a sidebar of lists, two personalities (§5). **Share to foodlab** on Android.
  Writes go through an outbox from M1 (offline capture no longer a milestone).
- 2026-10-22: **the phone is Android** (Evan's personal phone, always).
- 2026-10-22: rating is 👎 / 👍 / ❤️, not stars.
- 2026-10-22: **The Pantry Ledger** was an earlier name for this same app.
- 2026-10-22: data model from the ChatGPT design sessions: foods vs products, recipes built on
  foods, overlapping tags, never delete disliked products, recipe logs, yield vs servings,
  assembly as a recipe method, exact quantities stored for later scaling. Its Python stack is
  dropped for sideshow's. Its modeling questions are answered in §4a.
