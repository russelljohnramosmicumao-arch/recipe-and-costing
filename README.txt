KAPE' BAR-RIO - OFFLINE RECIPE & COSTING WEB APP

FILES
- index.html
- styles.css
- app.js
- seed-data.js
- manifest.webmanifest
- sw.js

WHAT IT DOES
- Ingredient purchase price + quantity + base-unit costing
- Add/edit/delete ingredients
- Per-ingredient recipe unit conversions (example: 1 pump = 10 ml)
- Recipe editor with 12 oz / 16 oz / 22 oz panes
- Ingredient dropdowns and quantity/unit editing
- Automatic recipe cost per size
- Optional selling price and food-cost percentage
- Menu & Costing overview
- JSON backup/restore and CSV cost export
- Offline storage on the tablet/browser using localStorage
- PWA service worker for offline use after first load

HOW TO RUN
For full offline/PWA behavior, serve this folder through HTTP/HTTPS rather than opening index.html directly as a file.

Simple local test on a computer:
  python3 -m http.server 8080
Then open http://localhost:8080/kape-barrio-costing/

For a tablet, put the folder on a small local web server or host it once on HTTPS, open it in the tablet browser, and use Add to Home Screen / Install App. After the service worker caches it, it can run without internet.

IMPORTANT SOURCE NOTES
The imported menu PDF contains several inconsistencies. The app preserves source values and flags affected recipes as Needs review instead of guessing. For example, some milk-tea ingredient lists show 100 ml milk for all sizes while procedures state 180/200 ml for larger sizes; some premium coffee pages mix coffee beans, syrup and espresso-shot instructions; and the Mango Smoothie 22 oz procedure appears to include copied Matcha Frappe steps.

COSTING CONVERSIONS
The spreadsheet prices ingredients by a base unit (ml, grams, pc). Some recipes use cup, tablespoon, scoop, sachet or shot. These cannot safely be converted without knowing your actual scoop/cup/ingredient density. Edit the ingredient and add a conversion, for example:
- syrup: pump -> 10 ml (already seeded where applicable from the menu document)
- your taro powder: tbsp -> measured grams per tablespoon
- your ice: cup -> measured grams per cup
- your ice cream: scoop -> measured ml or grams per scoop
- espresso shot: shot -> your actual ml per shot

BACKUP
Use Data & Backup > Export backup regularly. Browser data can be cleared by device/browser maintenance, so keep copies.

Ingredient cleanup
------------------
Only ingredients referenced by the imported recipes are included in the default ingredient master. The app still lets you add new ingredients later. Existing v1 local data is migrated once and unused ingredients are removed while recipe-linked ingredient edits are preserved.

V3 PACKAGING RULES
------------------
Packaging costs are seeded from the supplied packaging sheet:
- 12 oz cup with logo: ₱2.81 each
- 16 oz cup with logo: ₱2.39 each
- 22 oz cup with logo: ₱2.08 each
- Flat lid: ₱0.76 each
- Dome lid: ₱0.92 each
- Thin straw: ₱0.45 each
- Bobba straw: ₱0.679 each
- Single bag: ₱0.73 each
- Parchment paper: ₱0.70 each

Rules:
- Milk Tea (Single Flavour) and Milk Tea Fusion use Bobba Straws.
- All other categories use Thin straws.
- Frappes/Smoothies use Dome lids; other drinks use Flat lids.
- Strawless lids are discontinued and are not included.
- One Single Bag is allocated to each drink costing as the current per-order default. If one customer order contains multiple drinks sharing a single bag, the recipe-level costing will over-allocate bags; adjust at order level until an Order Builder is added.
- Parchment paper is included for Fruit Soda, Milk Tea, Budget Coffee, and Premium Coffee, following the current menu preparation instructions. It is not added to Floats or Frappes/Smoothies.

CHUCKIE
-------
Chuckie is now costed by ml. Shop standard: 110 ml small pack and 180 ml big pack. The 22 oz Chuckie Float uses 290 ml (110 + 180).


v4 update:
- Dutch Mill Float standardized to the same pack sizes as Chuckie: 110 ml small, 180 ml big, and 290 ml for 22 oz (110 + 180).
- Existing local recipe data is migrated automatically.

v5 update:
- Standard tablespoon conversion: 1 tbsp = 13 g for powder ingredients currently used by recipes.
- Espresso costing standard: 1 shot = 18 g coffee.
- Mango jam: 1 scoop = 40 g.
- Instant coffee: 1 sachet = 5 g.
- Existing local data migrates automatically.

v6 update:
- Standard ice fill is now 200 g (12 oz), 250 g (16 oz), 330 g (22 oz).
- Water/liquid 'to fill' placeholders are standardized to 150 ml (12 oz), 200 ml (16 oz), 300 ml (22 oz).
- Existing recipe-specific liquids that already had explicit quantities were NOT overwritten automatically.
- Existing local data migrates automatically.

v7 update:
- Ice and main liquid quantities now use a MINIMUM-FILL rule.
- Ice minimums: 12 oz 200 g, 16 oz 250 g, 22 oz 330 g.
- Main liquid minimums: 12 oz 150 ml, 16 oz 200 ml, 22 oz 300 ml.
- If the menu already specifies a higher amount, the higher menu amount is kept.
- If the menu specifies a lower amount, the shop minimum replaces it.
- Applied only to ice and main/base liquids (milk, Sprite, Coke, water, Chuckie, Dutch Mill), not syrups/sweeteners.

v8 update:
- Chuckie and Dutch Mill now keep their actual package volumes: 110 ml (12 oz), 180 ml (16 oz), 290 ml (22 oz).
- Milk (Made) tops them up to the shop minimum liquid fill:
  12 oz: +40 ml Milk (Made)
  16 oz: +20 ml Milk (Made)
  22 oz: +10 ml Milk (Made)
- Generic/fresh milk is no longer used. Any old "Milk" / "Fresh Milk" recipe reference is migrated to Milk (Made), and the fresh-milk ingredient entry is removed.
- Condensed milk and powdered/milk-tea ingredients are unaffected.

v9 update:
- Imported current menu selling prices from Kape-Bar-Rio-Drink-Prices-and-Variants.csv where the CSV clearly matches an existing recipe.
- Costing view now shows: Costing Price, Current Price, Difference, and Food Cost %.
- A negative difference is highlighted as a loss warning.
- If a recipe still has unresolved costing lines, its difference is marked provisional.
- CSV export now includes current selling price and difference for every size.
- Existing user-edited selling prices are preserved; migration fills only blank selling prices.
