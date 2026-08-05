/**
 * build-supabase-update.js
 * Emits UPDATE statements for public.recipes (image + steps) so the DB matches
 * recipes.json after edits (new timers + real images). Only touches rows whose
 * id exists in recipes.json (seed rows); user-created rows are left alone.
 *
 * Run: node build-supabase-update.js
 * Output: supabase-update.sql + per-batch files (sb-upd-*.sql). Execute each
 * batch through the Supabase SQL editor / execute_sql (postgres role bypasses
 * RLS since the UPDATE policy only allows owners).
 */
const fs = require('fs');

const { recipes } = JSON.parse(fs.readFileSync('recipes.json', 'utf-8'));

function esc(v) {
    return "'" + String(v).replace(/'/g, "''") + "'";
}

const rows = recipes.map(r => {
    const stepsJson = JSON.stringify(r.steps);
    return `UPDATE public.recipes SET
    "image" = ${esc(r.image || null)},
    "steps" = '${stepsJson.replace(/'/g, "''")}'::jsonb
WHERE id = ${esc(r.id)};`;
});

const BATCH = 100;
let sql = '';
let files = 0;
for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    files += 1;
    const file = `sb-upd-${String(files).padStart(2, '0')}.sql`;
    fs.writeFileSync(file, chunk.join('\n'), 'utf-8');
    sql += chunk.join('\n') + '\n';
}
fs.writeFileSync('supabase-update.sql', sql, 'utf-8');
console.log(`Generated ${files} batch files (${rows.length} UPDATE statements)`);
console.log('Total SQL size:', (sql.length / 1024).toFixed(0) + ' KB');
