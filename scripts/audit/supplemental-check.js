// Supplemental checks: file existence, pinImage, external URLs
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
const IMAGES_DIR = path.join(REPO_ROOT, 'images');
const files = new Set();
if (fs.existsSync(IMAGES_DIR)) {
    fs.readdirSync(IMAGES_DIR).forEach(f => files.add('/images/' + f));
}

console.log('Images on disk:', files.size);

// 1. Referenced images vs files present
const missing = [];
const external = [];
const seen = new Set();
recipes.forEach(r => {
    if (!r.image) return;
    if (seen.has(r.image)) return;
    seen.add(r.image);
    if (/^https?:\/\//i.test(r.image)) {
        external.push({ image: r.image, recipe: r.title });
    } else if (!files.has(r.image)) {
        missing.push({ image: r.image, recipe: r.title });
    }
});
console.log('\n=== IMAGES REFERENCED BUT MISSING ON DISK ===');
missing.forEach(m => console.log(`  ${m.image} -> ${m.recipe}`));
console.log('Missing:', missing.length);

console.log('\n=== EXTERNAL (non-local) IMAGE URLs ===');
external.forEach(m => console.log(`  ${m.image} -> ${m.recipe}`));
console.log('External:', external.length);

// 2. pinImage fallback pattern check
console.log('\n=== PINIMAGE FIELD ANALYSIS ===');
const fallbackPatterns = ['fallback', 'placeholder', 'default', 'generic'];
const pinFb = [];
const pinMissing = [];
recipes.forEach(r => {
    if (!r.pinImage) return;
    if (fallbackPatterns.some(p => r.pinImage.toLowerCase().includes(p))) {
        pinFb.push({ pinImage: r.pinImage, recipe: r.title, image: r.image });
    }
    if (/^https?:\/\//i.test(r.pinImage)) {
        // external pinImage is normal (Pinterest), skip
    } else if (!files.has(r.pinImage)) {
        pinMissing.push({ pinImage: r.pinImage, recipe: r.title });
    }
});
console.log('Recipes with pinImage:', recipes.filter(r => r.pinImage).length);
console.log('pinImage matching fallback pattern:');
pinFb.forEach(m => console.log(`  ${m.pinImage} -> ${m.recipe} (image=${m.image})`));
console.log('pinImage fallback count:', pinFb.length);
console.log('pinImage referenced but missing on disk:');
pinMissing.forEach(m => console.log(`  ${m.pinImage} -> ${m.recipe}`));
console.log('pinImage missing:', pinMissing.length);

// 3. Check that all recipes have an image field at all
const noImage = recipes.filter(r => !r.image);
console.log('\nRecipes with no image field at all:', noImage.length);
