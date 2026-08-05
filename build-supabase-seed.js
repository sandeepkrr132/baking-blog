/**
 * build-supabase-seed.js
 * Reads recipes.json and emits batched INSERT statements for the public.recipes
 * table, matching the existing seed-recipe pattern (created_by = null,
 * visibility = 'public'). RLS on INSERT requires created_by = auth.uid(), so
 * these run as the postgres role (bypasses RLS) via the Supabase SQL editor /
 * execute_sql. ON CONFLICT (id) DO NOTHING keeps existing rows untouched.
 *
 * Run: node build-supabase-seed.js > supabase-seed.sql
 * Then execute each batch (separated by a ; at top level) against the DB.
 */
const fs = require('fs');

const { recipes } = JSON.parse(fs.readFileSync('recipes.json', 'utf-8'));

function esc(v) {
    if (v === null || v === undefined) return 'NULL';
    return "'" + String(v).replace(/'/g, "''") + "'";
}

function buildRows(recipes) {
    const rows = recipes.map(r => {
        const ingJson = JSON.stringify(r.ingredients);
        const stepsJson = JSON.stringify(r.steps);
        return `(${[
            esc(r.id),
            esc(r.title),
            esc(r.image || null),
            esc(r.category),
            r.prepTime || 0,
            r.cookTime || 0,
            r.servings || 4,
            esc(r.difficulty || 'Easy'),
            esc(r.description || null),
            `'${ingJson.replace(/'/g, "''")}'::jsonb`,
            `'${stepsJson.replace(/'/g, "''")}'::jsonb`,
            'NULL',
            esc('public'),
        ].join(', ')})`;
    });
    return rows;
}

const COLS = `id, title, image, category, "prepTime", "cookTime", servings, difficulty,
    description, ingredients, steps, "created_by", visibility`;

const rows = buildRows(recipes);
const BATCH = 200;
let sql = '';
let files = 0;
for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const stmt = `INSERT INTO public.recipes (${COLS}) VALUES\n${chunk.join(',\n')}\nON CONFLICT (id) DO NOTHING;`;
    files += 1;
    fs.writeFileSync(`sb-${String(files).padStart(2, '0')}.sql`, stmt, 'utf-8');
    sql += stmt + '\n\n';
}
fs.writeFileSync('supabase-seed.sql', sql, 'utf-8');
console.log(`Generated ${files} batch files (${recipes.length} rows total, ${BATCH} rows/batch)`);
console.log('Total SQL size:', (sql.length / 1024).toFixed(0) + ' KB');
