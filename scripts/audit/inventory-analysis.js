// Inventory analysis for Sweet Crumbs recipe images
// Phase 1-2: full inventory + duplicate detection
const fs = require('fs');
const path = require('path');

// Resolve the repo root (the dir containing recipes.json) so this script works
// regardless of where it lives (e.g. scripts/audit/).
let REPO_ROOT = __dirname;
while (!fs.existsSync(path.join(REPO_ROOT, 'recipes.json'))) {
    const parent = path.dirname(REPO_ROOT);
    if (parent === REPO_ROOT) { throw new Error('recipes.json not found above ' + __dirname); }
    REPO_ROOT = parent;
}

const recipes = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'recipes.json'), 'utf-8')).recipes;

console.log('Total recipes:', recipes.length);

// Build image -> recipes map
const imageMap = {};
recipes.forEach(r => {
    const img = r.image || '(none)';
    if (!imageMap[img]) imageMap[img] = [];
    imageMap[img].push({ title: r.title, category: r.category, id: r.id });
});

const uniqueImages = Object.keys(imageMap).length;
console.log('Unique images:', uniqueImages);

console.log('\n=== IMAGES SHARED BY 2+ RECIPES ===');
let sharedCount = 0;
let totalAffected = 0;
for (const [img, recs] of Object.entries(imageMap)) {
    if (recs.length >= 2) {
        sharedCount++;
        totalAffected += recs.length;
        console.log('\n' + img + ' (' + recs.length + ' recipes):');
        recs.forEach(r => console.log('  - ' + r.title + ' [' + r.category + '] (' + r.id + ')'));
    }
}
console.log('\nTotal shared image groups:', sharedCount);
console.log('Total recipes affected by shared images:', totalAffected);

console.log('\n=== FALLBACK PATTERN MATCHES ===');
const fallbackPatterns = ['fallback', 'placeholder', 'default', 'generic'];
let fallbackGroups = 0;
let fallbackRecipes = [];
for (const [img, recs] of Object.entries(imageMap)) {
    if (fallbackPatterns.some(p => img.toLowerCase().includes(p))) {
        fallbackGroups++;
        recs.forEach(r => fallbackRecipes.push({ img, title: r.title, category: r.category, id: r.id }));
    }
}
fallbackRecipes.forEach(r => console.log('  ' + r.img + ' -> ' + r.title + ' [' + r.category + ']'));
console.log('Fallback pattern groups:', fallbackGroups);
console.log('Fallback pattern recipes:', fallbackRecipes.length);

console.log('\n=== RECIPES WITH NO IMAGE ===');
const noImage = imageMap['(none)'] || [];
noImage.forEach(r => console.log('  - ' + r.title + ' [' + r.category + ']'));
console.log('No image recipes:', noImage.length);
