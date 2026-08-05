/**
 * build-compact-update.js
 * Emits a small, surgical UPDATE for public.recipes:
 *   - sb-img-*.sql  : image = '/images/<id>.jpg' bulk, then CASE-fix the 28 fallback rows
 *   - sb-timer-*.sql: jsonb_set timerMinutes + timerLabel at the matching step index
 *                     (verified step counts align 1:1 with recipes.json)
 * Outputs chunked files so each can be passed to execute_sql within output budgets.
 *
 * Run: node build-compact-update.js
 */
const fs = require('fs');

const { recipes } = JSON.parse(fs.readFileSync('recipes.json', 'utf-8'));

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";

// ---------- Images ----------
const fallbacks = recipes.filter(r => /\/images\/fallback-/.test(r.image));
const imgBulk = `UPDATE public.recipes SET "image" = '/images/' || id || '.jpg'\nWHERE created_by IS NULL;`;
const caseWhen = fallbacks.map(r => `    WHEN ${esc(r.id)} THEN ${esc(r.image)}`).join('\n');
const imgFix = `UPDATE public.recipes SET "image" = CASE id\n${caseWhen}\n    ELSE "image"\nEND\nWHERE created_by IS NULL AND id IN (${fallbacks.map(r => esc(r.id)).join(', ')});`;
fs.writeFileSync('sb-img.sql', imgBulk + '\n\n' + imgFix + '\n', 'utf-8');

// ---------- Timers ----------
const rows = []; // {id, idx, mins, lbl}
for (const r of recipes) {
  (r.steps || []).forEach((s, idx) => {
    if (s.timerMinutes) rows.push({ id: r.id, idx, mins: s.timerMinutes, lbl: s.timerLabel || `Step ${idx + 1}` });
  });
}

const CHUNK = 400;
const decl = `CREATE TEMP TABLE _t (id text, idx int, mins int, lbl text) ON COMMIT DROP;\n`;
const apply = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, idx, mins, lbl FROM _t LOOP
    UPDATE public.recipes
    SET steps = jsonb_set(
          jsonb_set(steps, ARRAY[r.idx::text, 'timerMinutes'], to_jsonb(r.mins), true),
          ARRAY[r.idx::text, 'timerLabel'], to_jsonb(r.lbl), true)
    WHERE id = r.id;
  END LOOP;
END $$;`;

let files = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const values = chunk.map(r => `(${esc(r.id)},${r.idx},${r.mins},${esc(r.lbl)})`).join(',\n');
  const sql = decl + `INSERT INTO _t VALUES\n${values};\n` + apply + '\n';
  files += 1;
  fs.writeFileSync(`sb-timer-${String(files).padStart(2, '0')}.sql`, sql, 'utf-8');
}

console.log(`Image SQL: sb-img.sql (${(imgBulk.length + imgFix.length) / 1024 | 0} KB)`);
console.log(`Timer rows: ${rows.length} in ${files} files`);
for (let i = 1; i <= files; i++) {
  const f = `sb-timer-${String(i).padStart(2, '0')}.sql`;
  console.log(`  ${f}: ${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
}
