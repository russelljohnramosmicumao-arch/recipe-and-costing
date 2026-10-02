# Kape’Bar-Rio Recipe Book

A static recipe webapp for GitHub Pages. No installation or server is required.

## Publish
1. Extract this ZIP.
2. Upload the contents of `recipe-app` to the root of your GitHub repository (index.html should be at the root).
3. In GitHub, open Settings → Pages. Choose Deploy from a branch, select your branch and /(root), then save.
4. Open the Pages URL once GitHub finishes publishing.

If preserving another app in the same repository, put these files in a `recipes` folder and open your Pages URL followed by `/recipes/`.

## Included
- 57 drink entries, matching the supplied ordering app's drink menu, prices, categories, and photos.
- Drink pages with photo/name, price/cost table, 12/16/22 oz tabs, ingredients, packaging, and procedures.
- Regular/premium coffee selection and applicable ice cream variants.
- Costing fixed at zero pending the next costing stage.
- Original recipe PDF with links to source pages.

## Data notes
The PDF has conflicting ingredient/procedure quantities, duplicate and mislabeled recipes, missing recipes, and some size differences from the ordering menu. Imported values remain unchanged and require review. Missing sizes/recipes are explicitly shown rather than inferred. Some ingredients used in procedures are absent from the PDF ingredient list; these require confirmation before costing.

Packaging: a size-specific cup is assumed; lids/parchment follow the procedure when specified. Straw/bag quantities are not inferred.

All three size tabs remain visible, including unavailable sizes. A dash in selling price means the ordering app has no price for that size. Original category duplicates and price differences are retained. Frappe & Smoothies size overrides from the ordering app are retained. Some Coffee/Matcha category frappe entries still have different size labels; these are flagged.

This app is standalone and does not sync with the ordering/inventory app yet. There is no recipe editor or costing calculation in this version.

## Edit
`data.js` contains the imported menu, selling prices, and size-specific recipes. `app.js` contains the page rendering. `styles.css` controls appearance. All assets use relative paths, so project GitHub Pages URLs work.
