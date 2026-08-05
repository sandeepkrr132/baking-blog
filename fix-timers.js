/**
 * fix-timers.js
 * Populates timerMinutes/timerLabel on recipe steps that mention a time in
 * their text but have no timer yet. Leaves existing timers untouched.
 *
 * Run: node fix-timers.js   (then: node build-recipes.js)
 */
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('recipes.json', 'utf-8'));
const recipes = data.recipes;

const MAX_MINUTES = 720; // cap: 12h

// ---- Time extraction (returns minutes or null) ----
function extractMinutes(text) {
    const t = text.toLowerCase();

    // "1 1/2 hours" / "2 3/4 hours" (mixed fraction)
    let m = t.match(/(\d+)\s+(\d+)\/(\d+)\s+(?:hour|hr)s?\b/);
    if (m) return Math.min(MAX_MINUTES, +m[1] * 60 + Math.round((+m[2] / +m[3]) * 60));

    // "1/2 hour" / "3/4 hours"
    m = t.match(/(\d+)\/(\d+)\s+(?:hour|hr)s?\b/);
    if (m) return Math.min(MAX_MINUTES, Math.round((+m[1] / +m[2]) * 60));

    // "2 hours 30 minutes" / "1 hour and 15 minutes"
    m = t.match(/(\d+)\s+(?:hour|hr)s?\s+(?:and\s+)?(\d+)\s+(?:min(?:ute)?s?)\b/);
    if (m) return Math.min(MAX_MINUTES, +m[1] * 60 + +m[2]);

    // Ranges in minutes: "25-30 minutes", "5 to 7 min", "5–7 minutes"
    m = t.match(/(\d+)\s*(?:to|and|–|—|-)\s*(\d+)\s+(?:min(?:ute)?s?)\b/);
    if (m) return Math.min(MAX_MINUTES, Math.min(+m[1], +m[2]));

    // Ranges in hours: "2-3 hours" (use lower bound)
    m = t.match(/(\d+)\s*(?:to|and|–|—|-)\s*(\d+)\s+(?:hour|hr)s?\b/);
    if (m) return Math.min(MAX_MINUTES, Math.min(+m[1], +m[2]) * 60);

    // "every 30 minutes" / "for at least 5 minutes" / "about 35 minutes"
    m = t.match(/(\d+)\s+(?:min(?:ute)?s?)\b/);
    if (m) return Math.min(MAX_MINUTES, +m[1]);

    // Single hours: "for 2 hours"
    m = t.match(/(\d+)\s+(?:hour|hr)s?\b/);
    if (m) return Math.min(MAX_MINUTES, +m[1] * 60);

    return null;
}

// ---- Label heuristic based on step text ----
function makeLabel(text, index) {
    const t = text.toLowerCase();
    if (/\bbake\b|\bbroil\b|\broast\b/.test(t)) return 'Bake time';
    if (/\brest\b|rise|proof|ferment|autolyse|let it sit\b|sit for/.test(t)) return 'Rest & rise';
    if (/\bcool\b/.test(t)) return 'Cooling time';
    if (/\bchill\b|refrigerat|freeze/.test(t)) return 'Chill / freeze';
    if (/marinat/.test(t)) return 'Marinate';
    if (/\bsoak\b|rehydrat/.test(t)) return 'Soak';
    if (/\bsimmer\b|saucepan|boil\b|fry\b|stew\b|saut[ée]\b|melt\b|stockpot|skillet|grill\b/.test(t)) return 'Cook time';
    if (/\bbeat\b|cream\b|whip\b|mix\b|knead\b|fold\b|stir\b|whisk\b|blend\b/.test(t)) return 'Mix & beat';
    if (/\bpreheat\b|oven/.test(t)) return 'Bake time';
    return `Step ${index + 1}`;
}

let added = 0, already = 0;
const changed = [];

for (const recipe of recipes) {
    (recipe.steps || []).forEach((step, i) => {
        if (step.timerMinutes) { already++; return; }
        const minutes = extractMinutes(step.text || '');
        if (minutes === null) return;
        step.timerMinutes = minutes;
        step.timerLabel = makeLabel(step.text || '', i);
        added++;
        if (changed.length < 25) changed.push(`${recipe.id} | ${minutes} min | ${step.timerLabel} | ${step.text.slice(0, 80)}`);
    });
}

fs.writeFileSync('recipes.json', JSON.stringify(data, null, 2), 'utf-8');

console.log(`Steps with timer already: ${already}`);
console.log(`Timers added: ${added}`);
console.log('--- samples ---');
changed.forEach(s => console.log(s));
