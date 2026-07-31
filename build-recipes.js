/**
 * build-recipes.js
 * Generates static recipe HTML files from recipe data.
 * Run before each deployment: node build-recipes.js
 *
 * Each generated page has recipe content, JSON-LD, OG tags,
 * and window.__RECIPE_DATA__ embedded — so crawlers see
 * complete content AND interactive features still work via JS.
 */

const fs = require('fs');
const path = require('path');

// ============================
// Config
// ============================
const SITE_URL = 'https://baking-blog-three.vercel.app';

// ============================
// Helpers
// ============================

function toISO8601Duration(minutes) {
    if (!minutes || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `PT${hours}H${mins}M`;
    if (hours > 0) return `PT${hours}H`;
    return `PT${mins}M`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildJsonLd(recipe) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": recipe.title,
        "image": [recipe.image],
        "description": recipe.description,
        "recipeCategory": recipe.category,
        "recipeYield": `${recipe.servings} servings`,
        "recipeIngredient": recipe.ingredients.map(ing => `${ing.amount} ${ing.name}`.trim()),
        "recipeInstructions": recipe.steps.map(step => ({
            "@type": "HowToStep",
            "text": step.text
        }))
    };

    const prepTime = toISO8601Duration(recipe.prepTime);
    const cookTime = toISO8601Duration(recipe.cookTime);
    const totalTime = toISO8601Duration((recipe.prepTime || 0) + (recipe.cookTime || 0));

    if (prepTime) schema.prepTime = prepTime;
    if (cookTime) schema.cookTime = cookTime;
    if (totalTime) schema.totalTime = totalTime;

    const titleWords = recipe.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    schema.keywords = [recipe.category, ...titleWords].join(', ');

    if (recipe.pinImage) {
        schema.image.push(recipe.pinImage);
    }

    return JSON.stringify(schema, null, 2);
}

// ============================
// Generate one recipe page
// ============================

function generateRecipeHTML(template, recipe) {
    const slug = recipe.id;
    const pageUrl = `${SITE_URL}/${slug}.html`;
    const ogImage = recipe.pinImage || recipe.image;

    let html = template;

    // --- Page title ---
    html = html.replace(
        '<title>Recipe | Sweet Crumbs</title>',
        `<title>${escapeHtml(recipe.title)} | Sweet Crumbs</title>`
    );

    // --- OG & Twitter meta tags ---
    html = html.replace(
        '<meta property="og:title" content="">',
        `<meta property="og:title" content="${escapeHtml(recipe.title)} | Sweet Crumbs">`
    );
    html = html.replace(
        '<meta property="og:description" content="">',
        `<meta property="og:description" content="${escapeHtml(recipe.description)}">`
    );
    html = html.replace(
        '<meta property="og:image" content="">',
        `<meta property="og:image" content="${escapeHtml(ogImage)}">`
    );
    html = html.replace(
        '<meta property="og:url" content="">',
        `<meta property="og:url" content="${escapeHtml(pageUrl)}">`
    );
    html = html.replace(
        '<meta name="twitter:title" content="">',
        `<meta name="twitter:title" content="${escapeHtml(recipe.title)} | Sweet Crumbs">`
    );
    html = html.replace(
        '<meta name="twitter:description" content="">',
        `<meta name="twitter:description" content="${escapeHtml(recipe.description)}">`
    );
    html = html.replace(
        '<meta name="twitter:image" content="">',
        `<meta name="twitter:image" content="${escapeHtml(ogImage)}">`
    );

    // --- JSON-LD ---
    const jsonLd = buildJsonLd(recipe);
    html = html.replace(
        '<script type="application/ld+json" id="recipeSchema"></script>',
        `<script type="application/ld+json" id="recipeSchema">\n${jsonLd}\n</script>`
    );

    // --- Recipe hero ---
    const heroHtml = `
        <div class="recipe-hero-content">
            <img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" class="recipe-hero-image">
            <div class="recipe-hero-info">
                <h1>${escapeHtml(recipe.title)}</h1>
                <p class="recipe-hero-description">${escapeHtml(recipe.description)}</p>
                <div class="recipe-meta">
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Prep Time</div>
                        <div class="recipe-meta-value">${recipe.prepTime} min</div>
                    </div>
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Cook Time</div>
                        <div class="recipe-meta-value">${recipe.cookTime} min</div>
                    </div>
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Servings</div>
                        <div class="recipe-meta-value">${recipe.servings}</div>
                    </div>
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Difficulty</div>
                        <div class="recipe-meta-value">${escapeHtml(recipe.difficulty)}</div>
                    </div>
                </div>
            </div>
        </div>`;

    html = html.replace('<!-- Recipe content loaded by JavaScript -->', heroHtml);

    // --- Ingredients ---
    const ingredientsHtml = recipe.ingredients.map((ing, index) => `
        <li class="ingredient-item" data-index="${index}" onclick="toggleIngredient(this)">
            <div class="ingredient-checkbox"></div>
            <span class="ingredient-amount">${escapeHtml(ing.amount)}</span>
            <span class="ingredient-name">${escapeHtml(ing.name)}</span>
        </li>`).join('');

    html = html.replace('<!-- Ingredients loaded here -->', ingredientsHtml);

    // --- Steps with timers ---
    let timerInitData = [];

    const stepsHtml = recipe.steps.map((step, index) => {
        const stepId = `step-${index}`;
        let timerHtml = '';

        if (step.timerMinutes) {
            const totalSeconds = step.timerMinutes * 60;
            timerInitData.push({
                stepId,
                totalSeconds,
                label: step.timerLabel || `Step ${index + 1}`
            });

            timerHtml = `
                <div class="timer-container">
                    <span class="timer-label">⏱️ ${escapeHtml(step.timerLabel || 'Timer')}:</span>
                    <span class="timer-display" id="timer-display-${stepId}">${formatTime(totalSeconds)}</span>
                    <div class="timer-buttons">
                        <button class="timer-btn timer-btn-start" id="timer-start-${stepId}" onclick="startTimer('${stepId}')">Start</button>
                        <button class="timer-btn timer-btn-pause" id="timer-pause-${stepId}" onclick="pauseTimer('${stepId}')" disabled>Pause</button>
                        <button class="timer-btn timer-btn-reset" onclick="resetTimer('${stepId}')">Reset</button>
                    </div>
                </div>`;
        }

        return `
            <div class="step" id="${stepId}">
                <div class="step-header">
                    <span class="step-number">${index + 1}</span>
                    <p class="step-text">${escapeHtml(step.text)}</p>
                </div>
                ${timerHtml}
                <button class="step-complete-btn" onclick="toggleStepComplete('${stepId}')">Mark Complete</button>
            </div>`;
    }).join('');

    html = html.replace('<!-- Steps loaded here -->', stepsHtml);

    // --- Embedded recipe data for JS interactivity ---
    const embedData = JSON.stringify({
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        category: recipe.category,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        pinImage: recipe.pinImage || null,
        __timers: timerInitData
    });

    const embedScript = `<script>window.__RECIPE_DATA__=${embedData};</script>`;

    html = html.replace('</body>', `${embedScript}\n</body>`);

    return html;
}

// ============================
// Main
// ============================

function main() {
    // Load recipe data
    const recipeData = JSON.parse(fs.readFileSync('recipes.json', 'utf-8'));
    const recipes = recipeData.recipes;

    if (!recipes || recipes.length === 0) {
        console.error('No recipes found in recipes.json');
        process.exit(1);
    }

    // Load template
    const template = fs.readFileSync('recipe.html', 'utf-8');

    console.log(`Generating ${recipes.length} recipe pages...\n`);

    for (const recipe of recipes) {
        const html = generateRecipeHTML(template, recipe);
        const filename = `${recipe.id}.html`;
        fs.writeFileSync(filename, html, 'utf-8');
        console.log(`  ✓ ${filename}`);
    }

    console.log(`\nDone! Generated ${recipes.length} static recipe pages.`);
    console.log('Run `vercel deploy` or deploy via MCP to publish.');
}

main();
