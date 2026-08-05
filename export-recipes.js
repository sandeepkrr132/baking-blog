/**
 * export-recipes.js
 * Rebuilds recipes.json from a Supabase dump of the public.recipes table.
 *
 * The site is static-first: recipe detail pages are baked from recipes.json by
 * build-recipes.js. Admin edits land in Supabase, so before regenerating the
 * static pages this script folds the DB rows back into recipes.json — the
 * canonical file build-recipes.js and build-supabase-seed.js both read.
 *
 * Usage:
 *   node export-recipes.js dump.json
 *
 * where dump.json is a JSON array of rows from the recipes table, e.g. from:
 *   select json_agg(t) from (select * from public.recipes) t;
 * (or from the Supabase MCP `execute_sql` result).
 *
 * Output: recipes.json  — { "recipes": [ {id,title,image,category,prepTime,
 *   cookTime,servings,difficulty,description,ingredients,steps,pinImage} ... ] }
 */
const fs = require('fs');

const dumpPath = process.argv[2];
if (!dumpPath) {
    console.error('Usage: node export-recipes.js <dump.json>');
    process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
if (!Array.isArray(rows)) {
    console.error('dump.json must be a JSON array of recipe rows');
    process.exit(1);
}

// Fields build-recipes.js / the site consume. Supabase rows also carry
// created_at, created_by, visibility — dropped here (visibility is only
// meaningful for user-created recipes; seed recipes are public).
const recipes = rows.map(r => ({
    id: r.id,
    title: r.title,
    image: r.image || null,
    category: r.category,
    prepTime: r.prepTime ?? 0,
    cookTime: r.cookTime ?? 0,
    servings: r.servings ?? 4,
    difficulty: r.difficulty || 'Easy',
    description: r.description || null,
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    pinImage: r.pinImage || null,
}));

// Preserve recipes.json ordering: id ascending keeps diffs stable.
recipes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

fs.writeFileSync('recipes.json', JSON.stringify({ recipes }, null, 2) + '\n', 'utf-8');
console.log(`Wrote recipes.json with ${recipes.length} recipes`);
