# foodlab import: Food Products (review)

Made from `Food Products.md` on 2026-10-25. Edit anything below, then the importer reads this
file back. Nothing is in foodlab yet.

**How it reads**

- **Foods** is the "is a" tree, by indent (tabs). `· PLU 4061` sets the PLU; anything else after
  a `·` becomes the food's notes. Rename, move or delete lines freely.
- **Products** are grouped by `## Food`. Each line is `- Brand | Name`, then an optional ❤️ 👍 👎,
  then `·`-separated extras: `want` (= Want to try; otherwise Tried), notes, `<links>`.
- Moving a product = moving its line under another `## Food`. Deleting the line = not imported.
- Foods and products already in foodlab are matched by name (plural and case don't matter)
  and never duplicated: a match only gets blanks filled in (its food, rating, PLU).

**Calls I made — change any you disagree with**

1. **Your headings are foods**, including the aisle-like ones (Dry goods, Canned and jarred goods,
   Frozen foods, Baking needs…), so browsing works the way your list does. Produce now has
   **Fruit** (lemon, lime) and **Vegetable** (the rest) under it, so the PLU field shows there.
2. **⭐ → ❤️, 👍 → 👍, ~~struck~~ → 👎, *italic* → want.** A rating on a brand line carries to its
   products (all three Le Veneziane pastas are ❤️). 🫳 ♻️ 💧 dropped; 🆒 → "Refrigerated".
3. **Plain lines are Tried with no rating.** That includes the second ice cream block (Brigham's,
   Hood, Friendly's… under each flavor) — if those were really "brands to look at", add `· want`
   or delete them.
4. **Brand-only lines take the food as their name**: "Duke's" → Duke's | Mayonnaise. A few read
   oddly (Udi's | Baguettes and Large Rolls, Against the Grain | Small Rolls); fix as you like.
5. **Merged duplicates**: the Trader Joe's white bread under Hot dog buns and the Schär Ciabatta
   under Hamburger buns are the same products as in Sandwich bread / Small rolls (noted "Also
   for…"); Wegmans Organic Lemonade was listed twice.
6. **Spellings fixed**: Bell & Evans, Lay's, Hellmann's, Oscar Mayer, Jennie-O, Aldi, Cascadian
   Farm, Ore-Ida, La Costeña, Chosen Foods. Graza's oils are Sizzle (cooking) and Drizzle (finishing).
7. **Moved**: "Other cheese" (feta, Gruyere…) sits under Dairy, not Block cheese; jarred tomato
   sauce is your existing **Pasta sauce** food; chicken "Skin-on/Skinless", ground beef
   "80/20, 85/15" and water "Cold, filtered" became notes on those foods.

# Foods

- Produce
	- Vegetable
		- Lettuce
			- Iceberg lettuce · PLU 4061
			- Romaine lettuce · PLU 4640
		- Tomatoes
			- Beefsteak tomato · PLU 3061
			- Roma tomato · PLU 4087 · Also called plum, Italian or Saladette
			- Vine-ripe tomato · PLU 4664
			- Large hydroponic tomato · PLU 4799
			- Small hydroponic tomato · PLU 4798
			- Large tomato · PLU 3151
		- Garlic · PLU 4608
		- Shallots · PLU 4662
		- Red onion · PLU 4082
		- White onion · PLU 4663
		- Yellow onion · PLU 4093
		- Russet potato · PLU 4072 · The baking potato
		- Yukon Gold potato · PLU 4727 · Also called yellow or butter potato
		- Artichoke · PLU 4084
	- Fruit
		- Lemon · PLU 4053
		- Lime · PLU 4048
- Meat
	- Chicken · Skin-on or skinless
		- Boneless chicken thighs
		- Bone-in chicken thighs
		- Chicken breasts
	- Pork
	- Beef
		- Ground beef · 80/20, 85/15
		- Beef patties
		- Hot dogs
	- Cold cuts
		- Chicken cold cuts
		- Turkey cold cuts
		- Ham cold cuts
		- Bologna
	- Sausage
		- Summer sausage
		- Chorizo
		- Turkey sausage
- Dairy
	- Sliced cheese
	- Shredded cheese
		- Shredded extra sharp cheddar
	- Block cheese
		- Cheddar cheese
	- Feta
		- Crumbled feta
		- Feta in brine
	- Gruyere
	- Fontina
	- Cotija
	- Queso blanco
	- Queso fresco
	- Oaxaca cheese
	- Cream cheese
	- Macaroni and cheese
- Bread
	- Sandwich bread
	- Small rolls
	- Baguettes and large rolls
	- Hamburger buns
	- Hot dog buns
	- Pita bread
	- Bagels
	- English muffins
	- Texas toast
	- Cinnamon raisin bread
	- Muffins
	- Tortillas
		- Corn tortillas
		- Flour tortillas
- Dry goods
	- Pasta
		- Rice pasta
	- Rice
	- Bread crumbs
	- Cereal
		- Corn flakes
	- Oatmeal
	- Granola
	- Rice cakes
		- Rice crisps
	- Potato chips
		- Kettle-cooked potato chips
	- Tortilla chips
	- Crackers
	- Pretzels
- Canned and jarred goods
	- Tuna fish
		- Solid albacore tuna
	- Baked beans
	- Refried beans
	- Nuts and seeds
		- Almonds
			- Marcona almonds
		- Pistachios
		- Peanuts
		- Cashews
		- Brazil nuts
		- Walnuts
		- Macadamia nuts
		- Pecans
		- Hazelnuts
		- Chestnuts
		- Edamame
		- Sunflower seeds
		- Pumpkin seeds (pepitas)
	- Peanut butter
		- Creamy peanut butter
		- Crunchy peanut butter
	- Jam and jelly
	- Chocolate sauce
		- Chocolate syrup
		- Hot fudge
	- Syrup
		- Maple syrup
		- Pancake syrup
	- Pickles
		- Pickle spears
		- Pickle halves
		- Whole pickles
		- Baby pickles
		- Gherkins
		- Cornichons
		- Pickle chips
	- Salsa
	- Soup
		- Tomato soup
	- Tomato products
		- Canned tomato sauce
		- Pasta sauce
		- Passata
		- Canned tomatoes · Whole, chopped, diced, crushed, puree, strained, paste
	- Stock and broth
		- Beef stock
		- Beef broth
		- Beef bone broth
		- Chicken stock
		- Chicken broth
		- Chicken bone broth
		- Vegetable broth
- Cooking fats and acids
	- Olive oil
		- Cooking olive oil
		- Finishing olive oil
	- Avocado oil
	- Peanut oil
	- Vegetable oil
	- Vegetable shortening
	- Ghee
	- Lard
	- White wine vinegar
	- Red wine vinegar
- Spices and seasonings
	- Salt
		- Kosher salt
		- Table salt
		- Flaked salt
	- Pepper
		- Black Tellicherry Peppercorns
	- Garlic powder
	- Onion powder
	- Smoked paprika
	- Thyme
	- Rosemary
	- Sage
	- Basil
	- Parsley
	- Red pepper flakes
- Baking needs
	- Baking soda
	- Baking powder
	- Corn starch
	- All-purpose flour
	- Pancake/waffle mix
	- Cornbread mix
	- Muffin mix
	- Extracts
	- Melting wafers
- Condiments
	- Mayonnaise
	- Mustard
		- Yellow mustard
		- Dijon mustard
		- Spicy brown mustard
		- Honey mustard
	- Ketchup
	- Relish
	- Salad dressing
		- Greek dressing
		- Italian dressing
		- Ranch dressing
		- Caesar dressing
		- Blue cheese dressing
	- Hot sauce
	- Sweet chili sauce
	- Sweet and sour sauce
	- Orange sauce
	- Duck sauce
	- General Tso sauce
	- Gochujang sauce
	- Yum Yum sauce
- Frozen foods
	- Frozen chicken
		- Breaded chicken breasts
		- Chicken tenders
		- Chicken nuggets
		- Chicken patties
	- Frozen pizza
	- French fries
		- Straight-cut fries
		- Crinkle-cut fries
		- Tater tots
		- Steak fries
		- Hash browns
		- Waffle-cut fries
		- Curly fries
	- Frozen vegetables
		- Frozen potatoes
		- Mashed potatoes
	- Frozen snack foods
	- Ice cream
		- Vanilla ice cream
		- Chocolate ice cream
		- Coffee ice cream
		- Strawberry ice cream
	- Sherbet
	- Sorbet
	- Frozen yogurt
	- Ice cream bars
	- Frozen yogurt bars
- Beverages
	- Water · Cold, filtered
	- Milk
		- 2% milk
		- Almond milk
			- Unsweetened almond milk
			- Unsweetened vanilla almond milk
	- Juice
		- Orange juice
		- Fruit punch
			- Fruit punch drink mix
	- Iced tea
		- Iced tea drink mix
	- Lemonade
		- Strawberry lemonade
		- Lemonade drink mix
	- Limeade
		- Limeade drink mix
	- Water enhancers
	- Soda
		- Energy drinks

# Products

## Hot dogs

- Kayem | Fenway Beef Franks
- Kayem | Beef Hot Dogs
- Nathan's | Angus Beef Franks
- Nathan's | Jumbo Restaurant Style Beef Franks
- Ball Park | Angus Beef Franks
- Ball Park | Beef Hot Dogs

## Turkey cold cuts

- Wegmans | Artisan
- Wegmans | Organic Smoked
- Jennie-O | Cracked Pepper

## Ham cold cuts

- Boar's Head | Deluxe Ham
- Krakus | Polish Ham
- Wegmans | 97% Reduced Fat Ham

## Bologna

- Deutschmacher | German-Style Bologna
- Boar's Head | Bologna
- Oscar Mayer | Original

## Summer sausage

- Bridgford | Summer Sausage

## Sliced cheese

- Sargento | Smoked Provolone Sliced Cheese ❤️
- Kraft | Deluxe Yellow American Deli Slices ❤️

## Cheddar cheese

- Cabot | Vermont Seriously Sharp (Yellow) Cheddar Cheese
- Cabot | Vermont Extra Sharp (Yellow) Cheddar Cheese
- Cabot | New York Extra Sharp (Yellow) Cheddar Cheese

## Cream cheese

- Philadelphia | Original Whipped
- Lucerne | Plain Whipped
- Wegmans | Plain Whipped

## Macaroni and cheese

- Kraft | Macaroni and Cheese
- Great Value | Macaroni and Cheese
- Aldi | Macaroni and Cheese
- Annie's | Macaroni and Cheese
- Goodles | Macaroni and Cheese
- Trader Joe's | Gluten-Free 4-Cheese
- Beecher's | Macaroni and Cheese
- Banza | Macaroni and Cheese 👎

## Sandwich bread

- Trader Joe's | Gluten Free White ❤️ · Also for hot dog buns
- Trader Joe's | Gluten Free Multigrain ❤️
- Canyon Bakehouse | Heritage Style Honey White 👍
- Canyon Bakehouse | Heritage Style Whole Grain · want
- Canyon Bakehouse | 7-Grain
- Canyon Bakehouse | Ancient Grain · want
- Schär | Deli Style Sourdough · want
- Schär | Artisan Baker White · want
- Schär | Artisan Baker Multigrain · want

## Small rolls

- Schär | Ciabatta ❤️ · Also for hamburger buns
- Schär | Multigrain Ciabatta · want
- Canyon Bakehouse | Brioche-Style Sweet Rolls · want
- BFree | Dutch Crunch Sandwich Rolls · want
- Against the Grain | Small Rolls

## Baguettes and large rolls

- BFree | White Demi Baguettes
- Canyon Bakehouse | Sub Rolls
- Schär | Baguette
- Schär | Artisan Style Sandwich Rolls
- Udi's | Baguettes and Large Rolls

## Hamburger buns

- Trader Joe's | Gluten Free Hamburger Buns
- Udi's | Hamburger Buns · want
- Canyon Bakehouse | Brioche Hamburger Buns · want

## Pita bread

- BFree | Pita Bread

## Bagels

- Canyon Bakehouse | Plain Bagels · want
- Canyon Bakehouse | Everything Bagels · want
- Canyon Bakehouse | Deli White Bagels · want
- O'Doughs | Bagels · want

## English muffins

- Glutino | Original English Muffins · want
- Canyon Bakehouse | Honey Whole Grain English Muffins · want
- Udi's | English Muffins · want
- Katz | English Muffins · want

## Texas toast

- Katz | Texas Toast
- Rudi's | Texas Toast

## Cinnamon raisin bread

- Trader Joe's | Gluten Free Cinnamon Raisin Bread ❤️

## Muffins

- Schär | Classic Muffin

## Corn tortillas

- La Banderita | White Corn Tortillas
- Guerrero | White Corn Tortillas
- Mission | Yellow Corn Tortillas 5.5" (30ct)
- Mission | Extra Thin Yellow Corn Tortillas 6" (24ct)
- Mission | Super Size Yellow Corn Tortillas 6.5" (10ct)
- Mission | Yellow Corn Street Taco Tortillas 4.5" (24ct)
- Mission | White Corn Tortillas 5" (30ct)
- Mission | Super Size White Corn Tortillas 6.5" (10ct)
- Mission | White Corn Street Taco Tortillas 4.5" (24ct)
- Mission | Extra Thin White Corn Tortillas 6" (90ct) 👎
- Olé | Xtreme Wellness Gluten-Free Street Taco 5" (14ct)

## Flour tortillas

- Mission | Gluten Free Original Tortilla Wraps ❤️
- Olé | Xtreme Wellness Gluten-Free Tortilla Wraps
- Rudi's | Gluten Free Plain Tortillas

## Pasta

- Le Veneziane | Fettuccini ❤️ · <https://molinodiferro.com/prodotti/pasta/>
- Le Veneziane | Capellini ❤️ · <https://molinodiferro.com/prodotti/pasta/>
- Le Veneziane | Ditalini ❤️ · <https://molinodiferro.com/prodotti/pasta/>
- DeLallo | Gluten Free Orzo
- DeLallo | Gluten Free Gnocchi
- Barilla | Pasta 👍
- Ronzoni | Pasta
- Trader Joe's | Pasta

## Rice pasta

- Haiku | Rice Pasta
- Thai Kitchen | Rice Pasta · want
- Wegmans | Soba

## Bread crumbs

- 4C | Plain
- 4C | Seasoned
- 4C | Panko
- Gillian's | Plain
- Gillian's | Italian
- Nature's Promise | Gluten Free Panko Bread Crumbs

## Cereal

- VitaBella | Choco & Hazelnut Pillows · want
- Cheerios | Honey Nut ❤️
- Cheerios | Chocolate
- Cheerios | Chocolate Peanut Butter
- Cheerios | Frosted
- Cheerios | Apple Cinnamon
- Cheerios | Fruity
- Cheerios | Strawberry Banana
- Chex | Rice ❤️
- Chex | Corn
- Chex | Honey Nut
- Chex | Chocolate
- Chex | Cinnamon
- Chex | Peanut Butter
- Chex | Blueberry
- Chex | Strawberry Vanilla
- Cascadian Farm | Fruitful-O's ❤️ · At Whole Foods
- Fruity Pebbles | Marshmallow Fruity Pebbles
- Lucky Charms | Cereal
- Whole Foods 365 | Cocoa Hazelnut Pillows
- Whole Foods 365 | Marshmallow Galaxy
- EnviroKidz | Panda Puffs
- EnviroKidz | Choco Chimps
- EnviroKidz | Leapin' Lemurs'
- EnviroKidz | Turtle Splash
- EnviroKidz | Monarch Magic
- EnviroKidz | Rhino Rolls
- EnviroKidz | Cheetah Chomps
- EnviroKidz | Koala Crisp
- EnviroKidz | Amazon Frosted Flakes

## Corn flakes

- VitaBella | Corn Flakes

## Oatmeal

- Nature's Path | Gluten Free Instant Oatmeal

## Granola

- Bear Naked | Granola

## Rice cakes

- Quaker | Apple Cinnamon 👍
- Quaker | Chocolate 👍
- Quaker | Butter Popcorn · want
- Quaker | Caramel · want
- Quaker | Everything · want
- Quaker | Tomato & Basil · want
- Lundberg | Cinnamon Toast 👍
- Lundberg | Salted Caramel · want

## Rice crisps

- Quaker | Rice Crisps Caramel 👍
- Quaker | Rice Crisps Apple Cinnamon 👍
- Quaker | Rice Crisps Chocolate · want
- Quaker | Rice Crisps Buttermilk Ranch · want
- Quaker | Rice Crisps Cheddar · want
- Quaker | Rice Crisps Sour Cream & Onion · want
- Quaker | Rice Crisps Sweet & Spicy Chili · want
- Quaker | Rice Crisps Sweet Barbecue · want
- Quaker | Rice Crisps Sea Salt & Lime · want
- Quaker | Rice Crisps Buffalo Ranch · want
- Quaker | Rice Crisps Dill Pickle · want
- Quaker | Rice Crisps Jalapeno Cheddar · want
- Lundberg | Minis Apple Pie
- Lundberg | Minis Fiery Hot
- Lundberg | Minis White Cheddar

## Potato chips

- Ruffles | Original 👍
- Lay's | Classic 👍
- Lay's | Wavy Original
- Utz | Wavy
- Utz | Ripples
- Munchos | Potato Chips

## Kettle-cooked potato chips

- Cape Cod | Original
- Cape Cod | Salt & Vinegar
- Kettle Brand | Sea Salt
- Kettle Brand | Sea Salt & Vinegar
- Lay's | Kettle Cooked Original · want
- Lay's | Kettle Cooked Sea Salt & Vinegar · want

## Tortilla chips

- Tostitos | Crispy Rounds Original Tortilla Chips
- Santitas | White Corn Tortilla Chips 👍
- Santitas | Yellow Corn Tortilla Chips

## Crackers

- Lance | Gluten Free Baked Original Crackers ❤️
- Nut Thins | Pecan Gluten-Free Crackers

## Pretzels

- Snyder's of Hanover | Gluten Free Mini Pretzels

## Solid albacore tuna

- Bumble Bee | Solid Albacore Tuna
- Wegmans | Solid Albacore Tuna
- Nature's Promise | Solid Albacore Tuna · Stop & Shop's store brand

## Baked beans

- Bush's | Organic Baked Beans ❤️
- B&M | Original

## Refried beans

- La Costeña | Refried Pinto Beans
- Rosarita | Traditional Refried Beans 👍
- Ortega | Traditional Refried Beans
- Old El Paso | Traditional Refried Beans

## Pistachios

- Setton Farms | Garlic Onion Pistachios
- Setton Farms | Tajin 👎
- Wonderful | Chili Roasted

## Creamy peanut butter

- Jif | Creamy Peanut Butter
- Jif | Natural Creamy Peanut Butter · want
- Jif | Natural Creamy Peanut Butter and Honey · want
- Jif | Simply Jif Creamy Peanut Butter · want
- Skippy | Creamy Peanut Butter
- Skippy | Roasted Honey Nut Creamy Peanut Butter · want
- Skippy | Natural Creamy Peanut Butter · want

## Crunchy peanut butter

- Jif | Extra Crunchy Peanut Butter · want
- Jif | Natural Crunchy Peanut Butter · want
- Skippy | Super Chunk Peanut Butter · want
- Skippy | Natural Super Chunk Peanut Butter · want

## Jam and jelly

- Bonne Maman | Strawberry Preserve

## Chocolate syrup

- Nesquik | Chocolate Syrup ❤️
- Bosco | Chocolate Syrup 👍
- Hershey's | Simply 5 Genuine Chocolate Syrup

## Hot fudge

- Mrs. Richardson's | Hot Fudge Dessert Topping · want
- Smucker's | Hot Fudge Topping · want
- Hershey's | Hot Fudge Topping · want

## Pickle spears

- Mt. Olive | Simply Pickles Kosher Dill Spears ❤️
- Mt. Olive | Kosher Dill Spears 👍
- Grillo's | Dill Spears
- Vlasic | Purely Pickles Kosher Dill Spears · want
- Claussen | Pickle Spears

## Pickle halves

- Grillo's | Dill Halves
- Claussen | Dill Halves

## Whole pickles

- Grillo's | Whole Pickles
- Vlasic | Purely Pickles Kosher Dill Wholes · want

## Baby pickles

- Mt. Olive | Simply Pickles Kosher Baby Dills
- Mt. Olive | Simply Pickles Kosher Petite Dills
- Mt. Olive | Kosher Baby Dills
- Mt. Olive | Kosher Petite Dills

## Gherkins

- Mt. Olive | Sweet Gherkins · want
- Vlasic | Sweet Gherkins · want
- Vlasic | Kosher Dill Gherkins · want
- Wegmans | Sweet Gherkins · want

## Cornichons

- Maille | Original Cornichons ❤️
- Wegmans | Cornichons · want

## Pickle chips

- Mt. Olive | Simply Pickles Kosher Dill Hamburger Chips 👍
- Mt. Olive | Kosher Dill Hamburger Chips 👍
- Claussen | Kosher Dill Chips · want

## Salsa

- Herdez | Salsa Casera, Mild
- ROTEL | Original
- ROTEL | Mild · want
- ROTEL | Fire Roasted · want

## Soup

- Pacific Foods | Chicken & Wild Rice ❤️
- Progresso | Gluten Free Italian-Style Wedding with Meatballs · <https://www.progresso.com/products/gluten-free>
- Progresso | Gluten Free Minestrone · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Chicken Rice with Vegetables ❤️ · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Chicken & Wild Rice · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Chicken Tortilla · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Chicken Cheese Enchilada · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Beef & Vegetable · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Split Pea with Ham · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional Broccoli Cheese · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Traditional New England Clam Chowder · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Rich & Hearty Broccoli Cheese with Bacon · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Rich & Hearty Slow Cooked Vegetable Beef · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Rich & Hearty Steak & Vegetables · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Rich & Hearty Chicken Corn Chowder Flavored with Bacon · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Rich & Hearty Beef Pot Roast with Country Vegetables · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Rich & Hearty New England Clam Chowder · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Vegetable Classics French Onion · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Light Zesty Santa Fe Style Chicken · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Light Creamy Potato with Bacon & Cheese · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Light Beef Pot Roast · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Light Broccoli Cheese · want · <https://www.progresso.com/products/gluten-free>
- Progresso | Light New England Clam Chowder · want · <https://www.progresso.com/products/gluten-free>

## Tomato soup

- Pacific Foods | Organic Creamy Tomato Soup ❤️ · Resealable carton
- Pacific Foods | Organic Roasted Red Pepper & Tomato Soup · Resealable carton
- Wegmans | OMG! Creamy Tomato Soup · Refrigerated
- Panera Bread | Creamy Tomato Soup · Refrigerated
- Annie's | Organic Tomato Soup · Canned
- Progresso | Tomato Basil · Canned

## Canned tomato sauce

- Hunt's | Tomato Sauce
- Goya | Spanish Style Tomato Sauce

## Pasta sauce

- Pastene | Pasta Sauce
- Rao's | Pasta Sauce

## Passata

- Cento | Passata
- Wegmans | Passata
- Mutti | Passata
- Pomi | Strained Tomatoes

## Canned tomatoes

- Hunt's | Canned Tomatoes
- Cento | Canned Tomatoes
- Pastene | Canned Tomatoes
- Pomi | Crushed Tomatoes

## Beef stock

- Kitchen Basics | Beef Stock

## Beef broth

- Progresso | Beef Broth ❤️
- Swanson | Beef Broth
- College Inn | Beef Broth
- Pacific Foods | Beef Broth
- Knorr | Beef Flavor Bouillon

## Chicken stock

- Kitchen Basics | Chicken Stock

## Chicken broth

- Swanson | Chicken Broth
- College Inn | Chicken Broth
- Kitchen Basics | Chicken Broth
- Progresso | Chicken Broth
- Pacific Foods | Chicken Broth
- Knorr | Chicken Flavor Bouillon
- Knorr | Tomato Bouillon with Chicken Flavor
- Orrington Farms | Chicken Flavored Broth Base

## Vegetable broth

- Swanson | Vegetable Broth
- College Inn | Vegetable Broth
- Kitchen Basics | Vegetable Broth
- Progresso | Vegetable Broth
- Pacific Foods | Vegetable Broth

## Cooking olive oil

- Graza | Sizzle

## Finishing olive oil

- Graza | Drizzle
- UC Davis | Finishing Olive Oil

## Avocado oil

- Chosen Foods | Avocado Oil

## Vegetable shortening

- Spectrum | Vegetable Shortening

## Lard

- Goya | Lard/Manteca

## Kosher salt

- Diamond Crystal | Kosher Salt ❤️

## Table salt

- Morton | Plain Table Salt ❤️

## Flaked salt

- Maldon | Sea Salt Flakes ❤️

## Baking soda

- Arm & Hammer | Baking Soda
- Bob's Red Mill | Baking Soda

## Baking powder

- Clabber Girl | Baking Powder
- Rumford | Baking Powder

## Corn starch

- Argo | Corn Starch

## All-purpose flour

- King Arthur | Gluten-Free All-Purpose Flour · <https://shop.kingarthurbaking.com/gluten-free>
- Bob's Red Mill | Gluten Free 1-to-1 Baking Flour · <https://www.bobsredmill.com/products/gluten-free>

## Pancake/waffle mix

- King Arthur | Pancake/Waffle Mix

## Cornbread mix

- Krusteaz | Honey Cornbread & Muffin Mix · <https://www.krusteaz.com/products/gluten-free/>

## Extracts

- McCormick | Vanilla
- McCormick | Lemon

## Melting wafers

- Ghirardelli | Milk Chocolate Melting Wafers
- Ghirardelli | White Chocolate Melting Wafers
- Ghirardelli | Dark Chocolate Melting Wafers
- Dolci Frutta | Chocolate Melting Wafers
- Dolci Frutta | Creamy White Melting Wafers
- Guittard | Melting Wafers
- Lily's | Melting Wafers

## Mayonnaise

- Duke's | Mayonnaise ❤️
- McCormick | Mayonnaise 👍
- Kewpie | Mayonnaise 👍 · The bagged one
- Hellmann's | Mayonnaise
- Cains | Mayonnaise

## Yellow mustard

- Heinz | Yellow Mustard ❤️
- Plochman's | Yellow Mustard
- Mike's Amazing | Yellow Mustard
- French's | Yellow Mustard 👎

## Dijon mustard

- Maille | Dijon Mustard ❤️
- Grey Poupon | Dijon Mustard 👍

## Spicy brown mustard

- Kosciusko | Spicy Brown Mustard ❤️

## Honey mustard

- Inglehoffer | Sweet Honey Mustard ❤️

## Ketchup

- Heinz | Tomato Ketchup ❤️
- Heinz | Simply Tomato Ketchup
- Heinz | Chili Sauce
- Hunt's | Tomato Ketchup 👍
- Rao's | Roma Tomato Ketchup 👍
- Rao's | Arrabbiata Ketchup · want

## Relish

- Mt. Olive | Sweet Relish ❤️
- Mt. Olive | Sweet Salad Cubes 👍

## Greek dressing

- Yasou | Greek Dressing ❤️
- Gazebo Room | Greek Dressing and Marinade
- Ken's | Simply Vinaigrette Greek Dressing

## Italian dressing

- Newman's Own | Italian Family Recipe ❤️
- Ken's | Tuscan Italian with Lemon, Garlic & Herbs 👍
- Ken's | Italian with Aged Romano
- Ken's | Italian

## Ranch dressing

- Litehouse | Homestyle Ranch ❤️
- Marie's | Ranch · want
- Ken's | Peppercorn Ranch · want

## Caesar dressing

- Cardini's | Original Caesar Dressing ❤️
- Cardini's | Lemon Garlic Caesar Dressing ❤️
- Newman's Own | Creamy Caesar Dressing
- Brianna's | Asiago Caesar Dressing
- Ken's | Creamy Caesar Dressing
- Marie's | Caesar Dressing · want

## Blue cheese dressing

- Marie's | Super Blue Cheese Dressing
- Marie's | Chunky Blue Cheese Dressing

## Hot sauce

- Tabasco | Hot Sauce
- Cholula | Hot Sauce
- El Yucateco | Hot Sauce
- Crystal | Hot Sauce
- Frank's | Hot Sauce
- Texas Pete | Hot Sauce
- Louisiana | Hot Sauce

## Sweet chili sauce

- Wegmans | Organic Sweet Chili Sauce ❤️
- Pantai Norasingh | Sweetened Chili Sauce for Spring Roll
- Double Golden Fish | Sweet Chili Sauce for Spring Roll
- Shirakiku | Sweet Chili Sauce
- Blue Dragon | Thai Mango Sweet Chili Sauce

## Sweet and sour sauce

- Wegmans | Organic Sweet and Sour Sauce

## Orange sauce

- Wegmans | Organic Spicy Orange Sauce

## Duck sauce

- Ah-So | Duck Sauce ❤️
- Gold's | Duck Sauce

## General Tso sauce

- Wegmans | Organic General Tso Sauce

## Breaded chicken breasts

- Bell & Evans | Gluten Free Breaded Chicken Breasts

## Chicken tenders

- Bell & Evans | Gluten Free Breaded Chicken Tenders ❤️
- Applegate | Naturals Gluten-Free Chicken Breast Tenders
- Perdue | Simply Smart Organic Breaded Gluten Free Chicken Tenders
- Perdue | Gluten Free Chicken Breast Tenders

## Chicken nuggets

- Applegate | Naturals Gluten-Free Chicken Nuggets
- Nature's Promise | Gluten-Free Chicken Nuggets
- Perdue | Simply Smart Organic Breaded Gluten Free Chicken Nuggets 👎
- Bell & Evans | Gluten Free Breaded Chicken Nuggets 👎

## Chicken patties

- Nature's Promise | Gluten-Free Chicken Patties ❤️
- Bell & Evans | Gluten Free Breaded Chicken Patties 👎
- Bell & Evans | Chicken Burgers

## Frozen pizza

- Against the Grain | Frozen Pizza
- Freschetta | Four Cheese
- Caulipower | Frozen Pizza
- Banza | Frozen Pizza
- Udi's | Frozen Pizza
- Milton's | Meat Lovers 👍
- Amy's | Frozen Pizza
- Open Nature | Frozen Pizza
- Pizza Oggi | Frozen Pizza
- Wegmans | Frozen Pizza
- Nature's Promise | Frozen Pizza
- Town Spa | Frozen Pizza

## French fries

- McCain | Smiles
- McCain | Baby Cakes
- Red Robin | Seasoned Steak Fries

## Straight-cut fries

- Ore-Ida | Crispy Shoestrings
- Ore-Ida | Extra Crispy Fast Food Fries
- Ore-Ida | Country Style French Fries
- McCain | Classic Cut French Fries
- McCain | Extra Crispy Classic Fries
- McCain | Quick Cook Straight Cut Fries
- McCain | Classic Fries
- Alexia | Rosemary Fries
- Alexia | House Cut
- Sonic | Fries

## Crinkle-cut fries

- Ore-Ida | Extra Crispy Crinkles
- Ore-Ida | Extra Crispy Golden Crinkles
- Ore-Ida | Extra Crispy Seasoned Crinkles
- McCain | Crinkle Cut French Fries
- McCain | Extra Crispy Crinkle Fries
- McCain | Seasoned Crinkle Fries
- McCain | Quick Cook Crinkle Fries
- McCain | Crinkle Fries

## Tater tots

- Ore-Ida | Extra Crispy Tater Tots
- Ore-Ida | Crispy Mini Tater Tots ❤️
- Ore-Ida | Crispy Crowns
- McCain | Quick Cook Tasti Taters
- Alexia | Crispy Potato Puffs
- Sonic | Tots

## Hash browns

- Ore-Ida | Shredded Hash Browns
- Ore-Ida | Diced Hash Browns
- Ore-Ida | Potatoes O'Brien
- Ore-Ida | Hash Brown Patties
- McCain | Quick Cook Hash Browns
- Alexia | Hashed Browns with Onion, Garlic & White Pepper
- Wegmans | Hash Brown Patties
- Cavendish | Old Fashioned Hashbrown Potato Patties
- Stop & Shop | Hash Browns O'Brien Style

## Waffle-cut fries

- Ore-Ida | Crispy Waffle Fries
- McCain | Quick Cook Waffle Fries
- Alexia | Waffle Cut Seasoned Fries

## Curly fries

- Ore-Ida | Zesty Twirls

## Frozen potatoes

- Birds Eye | Oven Roasters Seasoned Red Potato Wedges & Onions
- Birds Eye | Quick Roasters Red Potatoes
- Birds Eye | Loaded Potato Bake

## Mashed potatoes

- Ore-Ida | Homestyle Steam 'N' Mash

## Frozen snack foods

- Feel Good Foods | Crispy Jalapeño Bites
- Feel Good Foods | Mac & Cheese Bites
- Feel Good Foods | Mozzarella Sticks
- Feel Good Foods | Pizza Snacks

## Ice cream

- Häagen-Dazs | Vanilla Swiss Almond · want
- Häagen-Dazs | Vanilla Chocolate Chip · want
- Häagen-Dazs | Chocolate Peanut Butter ❤️
- Häagen-Dazs | Butter Pecan · want
- Häagen-Dazs | Mint Chip · want
- Häagen-Dazs | Peppermint Bark · want
- Häagen-Dazs | Pineapple Coconut · want
- Häagen-Dazs | Pistachio · want
- Häagen-Dazs | Rocky Road · want
- Häagen-Dazs | Rum Raisin · want
- Häagen-Dazs | Creamy Mango · want
- Häagen-Dazs | Dulce de Leche · want
- Häagen-Dazs | Honey Salted Caramel Almond · want
- Häagen-Dazs | Matcha Green Tea · want
- Ben & Jerry's | Ice Cream
- Turkey Hill | Vanilla & Chocolate · want
- Turkey Hill | Vanilla Salted Caramel · want
- Turkey Hill | Cookie Butter · want
- Turkey Hill | Fudge Ripple · want
- Turkey Hill | Peanut Butter Ripple · want
- Turkey Hill | Chocolate Marshmallow · want
- Turkey Hill | Chocolate Peanut Butter · want
- Turkey Hill | Neapolitan · want
- Turkey Hill | Strawberries & Cream · want
- Turkey Hill | Orange Cream Swirl · want
- Turkey Hill | Peaches & Cream · want
- Turkey Hill | Colombian Coffee · want
- Turkey Hill | Choco Mint Chip · want
- Turkey Hill | Pistachio Almond · want
- Turkey Hill | Black Raspberry · want
- Turkey Hill | Black Cherry · want
- Turkey Hill | Butter Pecan · want
- Turkey Hill | Egg Nog · want
- Turkey Hill | Moose Tracks · want
- Turkey Hill | Rocky Road · want
- Tillamook | Sea Salt & Honeycomb Toffee · want
- Tillamook | Malted Moo Shake · want
- Tillamook | Caramel Toffee Crunch · want
- Tillamook | Caramel Swirl · want
- Tillamook | Udderly Chocolate · want
- Tillamook | Tillamook Mudslide · want
- Tillamook | Chocolate Peanut Butter · want
- Tillamook | Campfire Peanut Butter Cup · want
- Tillamook | Coffee Almond Fudge · want
- Tillamook | Neapolitan · want
- Tillamook | Oregon Strawberry · want
- Tillamook | Orange & Cream · want
- Tillamook | Peaches & Cream · want
- Tillamook | Oregon Dark Cherry · want
- Tillamook | Mountain Huckleberry · want
- Tillamook | Mint Chocolate Chip · want
- Tillamook | Butter Pecan · want
- Tillamook | Rocky Road · want

## Vanilla ice cream

- Häagen-Dazs | Vanilla Bean ❤️
- Wegmans | Madagascar Vanilla 👍
- Van Leeuwen | Vanilla Bean 👍
- Brigham's | Vanilla Ice Cream
- Hood | Vanilla Ice Cream
- Friendly's | Vanilla Ice Cream
- Turkey Hill | Original Vanilla 👎
- Turkey Hill | Homemade Vanilla 👍
- Turkey Hill | Simply Natural Homemade Vanilla · want
- Turkey Hill | French Vanilla · want
- Turkey Hill | Vanilla Bean · want
- Turkey Hill | Simply Natural Vanilla Bean · want
- Tillamook | Old-Fashioned Vanilla · want
- Tillamook | French Vanilla · want
- Tillamook | Vanilla Bean · want
- Tillamook | White Chocolate Raspberry · want
- Breyers | Natural Vanilla · want

## Chocolate ice cream

- Häagen-Dazs | Chocolate 👍
- Häagen-Dazs | Chocolate Chocolate Chip · want
- Häagen-Dazs | Belgian Double Chocolate Chip · want
- Brigham's | Chocolate Ice Cream
- Hood | Chocolate Ice Cream
- Friendly's | Chocolate · want
- Turkey Hill | Dutch Chocolate · want
- Tillamook | Chocolate · want
- Tillamook | Chocolate Chip · want

## Coffee ice cream

- Häagen-Dazs | Coffee · want
- Häagen-Dazs | Coffee Chip · want
- Brigham's | Coffee Ice Cream
- Hood | Coffee Ice Cream
- Friendly's | Coffee Ice Cream
- Turkey Hill | Coffee Ice Cream
- Tillamook | Coffee Ice Cream

## Strawberry ice cream

- Häagen-Dazs | Strawberry · want
- Brigham's | Strawberry Ice Cream
- Hood | Strawberry Ice Cream
- Friendly's | Strawberry Ice Cream
- Turkey Hill | Strawberry Ice Cream
- Tillamook | Strawberry Ice Cream

## Sorbet

- Häagen-Dazs | Passion Fruit & Sweet Pear
- Häagen-Dazs | Sweet Lemon Coconut
- Häagen-Dazs | Summer Blueberry & Lemon
- Häagen-Dazs | Mango
- Häagen-Dazs | Raspberry

## Ice cream bars

- Häagen-Dazs | Vanilla Milk Chocolate Almond
- Häagen-Dazs | Coffee Almond Toffee Crunch
- Häagen-Dazs | Salted Caramel Macadamia
- Häagen-Dazs | New York Strawberry Cheesecake
- Häagen-Dazs | Mini Vanilla Milk Chocolate Almond
- Häagen-Dazs | Mini Coffee Almond Toffee Crunch

## Frozen yogurt bars

- Yasso | Black Raspberry Chip · want
- Yasso | Chocolate Peanut Butter Chip · want
- Yasso | Coffee Chocolate Chip · want
- Yasso | Mint Chocolate Chip · want
- Yasso | Creamy Mango · want
- Yasso | Strawberries & Cream · want
- Yasso | Peanut Butter Chocolate Crunch · want
- Yasso | Strawberry Chocolate Crunch · want
- Yasso | Cherry Chocolate Crunch · want
- Yasso | Mint Chocolate Crunch · want
- Yasso | Sea Salt Caramel Chocolate Crunch · want

## Water

- PUR | Plus Water Filter

## Juice

- Goya | Pear (Pera)
- Goya | Peach (Melocotón Durazno) Néctar Juice
- Goya | Guava (Guayaba) Néctar Juice
- Naked | Strawberry Banana 👍
- Naked | Mighty Mango ❤️
- Naked | Piña Colada 👍
- Naked | Tropical Guava · want
- Naked | Berry Blast · want
- Naked | Power-C Machine ❤️
- Naked | Rainbow Machine ❤️
- Naked | Red Machine · want
- Naked | Superfood Machine · want
- Naked | Blue Machine
- Naked | Protein Tropical ❤️
- Naked | Protein Double Berry · want
- Naked | Lower Sugar Tropical Sunrise · want
- Naked | Lower Sugar Berrylicious 👍
- Naked | Lower Sugar Glorious Greens · want

## Orange juice

- Florida's Natural | Orange Juice

## Fruit punch drink mix

- 4C | Fruit Punch Drink Mix
- 4C | Reduced Sugar Drink Mix
- Wyler's | Light Fruit Punch Drink Mix
- Crystal Light | Fruit Punch Drink Mix

## Iced tea

- Arizona | Arnold Palmer Lite ❤️

## Iced tea drink mix

- 4C | Lemon Iced Tea Drink Mix
- 4C | Decaf Iced Tea Drink Mix ❤️
- 4C | Half & Half Iced Tea/Lemonade Mix
- 4C | Reduced Sugar Lemon Iced Tea
- 4C | Reduced Sugar Sweet Tea
- Country Time | Half & Half
- Country Time | Sweet Iced Tea Drink Mix
- Crystal Light | Lemon Iced Tea Drink Mix

## Lemonade

- Newman's Own | Pink Lemonade
- Newman's Own | Old Fashioned Roadside Lemonade
- Wegmans | Fresh Lemonade ❤️
- Wegmans | Organic Lemonade · Refrigerated
- Tropicana | Classic Lemonade · Refrigerated
- Whole Foods 365 | Lemonade

## Strawberry lemonade

- Wegmans | Organic Lemonade with Strawberry · Refrigerated
- Simply | Lemonade with Strawberry · Refrigerated
- Tropicana | Strawberry Lemonade · Refrigerated

## Lemonade drink mix

- 4C | Lemonade Drink Mix
- 4C | Pink Lemonade Drink Mix
- 4C | Reduced Sugar Lemonade Drink Mix
- Wyler's | Light Lemonade Drink Mix
- Wyler's | Light Pink Lemonade Drink Mix
- Wyler's | Light Strawberry Lemonade Drink Mix
- True Lemon | Lemonade Drink Mix
- True Lemon | Strawberry Lemonade Drink Mix
- Crystal Light | Lemonade Drink Mix
- Crystal Light | Pink Lemonade Drink Mix
- Country Time | Lemonade Drink Mix
- Country Time | Pink Lemonade Drink Mix
- Country Time | Strawberry Lemonade Drink Mix
- Country Time | Cherry Lemonade Drink Mix

## Limeade

- Newman's Own | Limeade · Refrigerated
- Simply | Limeade · Refrigerated
- Wegmans | Limeade

## Limeade drink mix

- Wyler's | Light Cherry Limeade Drink Mix
- True Lime | Black Cherry Limeade Drink Mix

## Water enhancers

- Gatorade | Zero Glacier Freeze

## Soda

- Pepsi | Diet Caffeine-Free
- Pepsi | Diet
- Pepsi | Zero Sugar
- Pepsi | Original
- Coca-Cola | Zero Sugar
- Coca-Cola | Zero Sugar Caffeine-Free
- Coca-Cola | Diet
- Coca-Cola | Diet Caffeine-Free
- Coca-Cola | Original
- Sprite | Original
- Sprite | Zero Sugar
- A&W | Cream Soda
- A&W | Zero Sugar Cream Soda
- A&W | Root Beer
- A&W | Zero Sugar Root Beer

## Energy drinks

- Alani Nu | Hawaiian Shaved Ice
- Alani Nu | Cherry Slush
