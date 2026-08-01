/* ========================================
   Sweet Crumbs Baking Blog - JavaScript
   ======================================== */

// ========================================
// Supabase Config (shared with auth.js)
// ========================================
// SUPABASE_URL and SUPABASE_ANON_KEY are defined in auth.js

// ========================================
// Recipe Data (loaded from Supabase)
// ========================================
let recipes = [];

// Timer state management
const timers = {};

// ========================================
// Audio Alert using Web Audio API
// ========================================
function playAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Play 3 rounds of ascending chimes for a noticeable alert
        const chimeNotes = [
            [523.25, 659.25, 783.99],  // C5-E5-G5
            [659.25, 783.99, 1046.50], // E5-G5-C6
            [523.25, 659.25, 783.99],  // C5-E5-G5
        ];

        chimeNotes.forEach((chord, round) => {
            const roundStart = audioContext.currentTime + round * 0.5;

            chord.forEach((freq, noteIndex) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const noteTime = roundStart + noteIndex * 0.12;
                gainNode.gain.setValueAtTime(0, noteTime);
                gainNode.gain.linearRampToValueAtTime(0.4, noteTime + 0.04);
                gainNode.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.35);

                oscillator.start(noteTime);
                oscillator.stop(noteTime + 0.35);
            });
        });
    } catch (e) {
        console.log('Audio not supported');
    }
}

// ========================================
// Vibration Alert (mobile devices)
// ========================================
function vibrateAlert() {
    try {
        if (navigator.vibrate) {
            // Pattern: vibrate-pause-vibrate-pause-vibrate (long pulses)
            navigator.vibrate([300, 150, 300, 150, 500]);
        }
    } catch (e) {
        // Vibration not supported
    }
}

// ========================================
// Toast Notification
// ========================================
function showToast(message, duration = 5000) {
    // Remove any existing toast
    const existing = document.querySelector('.timer-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'timer-toast';
    toast.innerHTML = `
        <span class="timer-toast-icon">⏰</span>
        <span class="timer-toast-text">${message}</span>
        <button class="timer-toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => toast.classList.add('timer-toast-visible'));

    // Auto-dismiss after duration
    setTimeout(() => {
        toast.classList.remove('timer-toast-visible');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ========================================
// Format time as MM:SS
// ========================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ========================================
// Convert minutes to ISO 8601 duration
// ========================================
function toISO8601Duration(minutes) {
    if (!minutes || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `PT${hours}H${mins}M`;
    if (hours > 0) return `PT${hours}H`;
    return `PT${mins}M`;
}

// ========================================
// Populate JSON-LD Structured Data
// ========================================
function populateJsonLd(recipe) {
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

    // Add times (ISO 8601 duration)
    const prepTime = toISO8601Duration(recipe.prepTime);
    const cookTime = toISO8601Duration(recipe.cookTime);
    const totalTime = toISO8601Duration((recipe.prepTime || 0) + (recipe.cookTime || 0));

    if (prepTime) schema.prepTime = prepTime;
    if (cookTime) schema.cookTime = cookTime;
    if (totalTime) schema.totalTime = totalTime;

    // Add keywords from category + title words
    const titleWords = recipe.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    schema.keywords = [recipe.category, ...titleWords].join(', ');

    // Pin image if available
    if (recipe.pinImage) {
        schema.image.push(recipe.pinImage);
    }

    // Inject into page
    const scriptEl = document.getElementById('recipeSchema');
    if (scriptEl) {
        scriptEl.textContent = JSON.stringify(schema, null, 2);
    }
}

// ========================================
// Populate Open Graph & Twitter Meta Tags
// ========================================
function populateOgTags(recipe) {
    const ogImage = recipe.pinImage || recipe.image;
    const pageUrl = window.location.href;

    const setMeta = (selector, content) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute('content', content);
    };

    setMeta('meta[property="og:title"]', `${recipe.title} | Sweet Crumbs`);
    setMeta('meta[property="og:description"]', recipe.description);
    setMeta('meta[property="og:image"]', ogImage);
    setMeta('meta[property="og:url"]', pageUrl);
    setMeta('meta[name="twitter:title"]', `${recipe.title} | Sweet Crumbs`);
    setMeta('meta[name="twitter:description"]', recipe.description);
    setMeta('meta[name="twitter:image"]', ogImage);
}

// ========================================
// Timer Functions
// ========================================
function startTimer(timerId) {
    const timer = timers[timerId];
    if (!timer || timer.running) return;

    timer.running = true;
    updateTimerDisplay(timerId);

    timer.interval = setInterval(() => {
        timer.remaining--;

        if (timer.remaining <= 0) {
            // Timer finished!
            clearInterval(timer.interval);
            timer.running = false;
            timer.remaining = 0;
            timer.finished = true;
            updateTimerDisplay(timerId);
            playAlertSound();
            vibrateAlert();
            showToast(`Timer Complete: ${timer.label} is done!`);
        } else {
            updateTimerDisplay(timerId);
        }
    }, 1000);
}

function pauseTimer(timerId) {
    const timer = timers[timerId];
    if (!timer || !timer.running) return;

    clearInterval(timer.interval);
    timer.running = false;
    updateTimerDisplay(timerId);
}

function resetTimer(timerId) {
    const timer = timers[timerId];
    if (!timer) return;

    clearInterval(timer.interval);
    timer.running = false;
    timer.remaining = timer.totalSeconds;
    timer.finished = false;
    updateTimerDisplay(timerId);
}

function updateTimerDisplay(timerId) {
    const timer = timers[timerId];
    const display = document.getElementById(`timer-display-${timerId}`);
    const startBtn = document.getElementById(`timer-start-${timerId}`);
    const pauseBtn = document.getElementById(`timer-pause-${timerId}`);

    if (!display) return;

    display.textContent = formatTime(timer.remaining);

    // Add warning class when less than 30 seconds
    display.classList.remove('warning', 'finished');
    if (timer.finished) {
        display.classList.add('finished');
    } else if (timer.remaining <= 30 && timer.remaining > 0) {
        display.classList.add('warning');
    }

    // Update button states
    if (startBtn && pauseBtn) {
        startBtn.disabled = timer.running;
        pauseBtn.disabled = !timer.running;
    }
}

// ========================================
// Fetch Recipes from Supabase
// ========================================
// All data calls go through supabaseClient, which attaches the session's
// access token and refreshes it automatically when expired (with a retry).
async function fetchRecipes() {
    // Homepage shows only public recipes (private ones are owner-only)
    const { data, error } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('visibility', 'public');
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return data || [];
}

async function fetchRecipeById(id) {
    // Uses the signed-in session when available so owners can read their private recipes
    const { data, error } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return data || null;
}

// ========================================
// Session helpers
// ========================================
async function isLoggedIn() {
    const { data } = await supabaseClient.auth.getSession();
    return !!data?.session;
}

// If the session is genuinely gone (refresh failed), send the user to log in.
// Transient failures are retried by the client internally, so reaching this
// helper means the request really failed — verify once more whether we still
// have a valid user before surfacing a generic error.
async function redirectIfSignedOut() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return true;
    }
    return false;
}

async function isRecipeSaved(recipeId) {
    const user = await getCurrentUser();
    if (!user) return false;
    const { data, error } = await supabaseClient
        .from('saved_recipes')
        .select('recipe_id')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
}

async function toggleSave(recipeId) {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    const saved = await isRecipeSaved(recipeId);
    let error;
    if (saved) {
        ({ error } = await supabaseClient
            .from('saved_recipes')
            .delete()
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId));
    } else {
        ({ error } = await supabaseClient
            .from('saved_recipes')
            .insert({ user_id: user.id, recipe_id: recipeId }));
    }
    if (error) throw new Error('Failed to update saved state');
    return !saved; // new saved state
}

async function fetchSavedRecipes() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabaseClient
        .from('saved_recipes')
        .select('recipe_id,recipes(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    const rows = data || [];
    // recipes(*) is a to-one embed: PostgREST returns it as an object (or
    // an array for to-many embeds) — normalize both shapes.
    return rows.map(r => {
        const rc = r.recipes;
        if (!rc) return null;
        return Array.isArray(rc) ? (rc[0] || null) : rc;
    }).filter(Boolean);
}

async function fetchMyRecipes() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return data || [];
}

function slugify(title) {
    return String(title || 'recipe').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'recipe';
}

async function createRecipe(payload) {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    const id = `${slugify(payload.title)}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabaseClient
        .from('recipes')
        .insert({ ...payload, id, created_by: user.id })
        .select()
        .single();
    if (error) throw new Error(error.message || 'Failed to create recipe');
    return data;
}

async function updateRecipe(id, payload) {
    const { data, error } = await supabaseClient
        .from('recipes')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message || 'Failed to update recipe');
    return data;
}

async function deleteRecipe(id) {
    const { error } = await supabaseClient
        .from('recipes')
        .delete()
        .eq('id', id);
    if (error) throw new Error('Failed to delete recipe');
    return true;
}

async function uploadRecipeImage(file) {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Not logged in');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${user.id}/${Date.now()}-${safeName}`;
    // No x-upsert header — a plain POST keeps storage RLS on the happy path.
    const { error } = await supabaseClient.storage
        .from('recipe-images')
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (error) throw new Error(error.message || 'Failed to upload image');
    return `${SUPABASE_URL}/storage/v1/object/public/recipe-images/${path}`;
}

// ========================================
// Render Recipe Cards (Homepage)
// ========================================
function renderRecipeCards(recipesList, container) {
    container.innerHTML = recipesList.map(recipe => {
        // User-created recipes have no static page; route them to the dynamic view
        const href = recipe.created_by
            ? `recipe.html?id=${encodeURIComponent(recipe.id)}`
            : `${recipe.id}.html`;
        return `
        <article class="recipe-card" data-category="${recipe.category}" onclick="window.location.href='${href}'">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-card-image" loading="lazy">
            <div class="recipe-card-content">
                <span class="recipe-card-category">${recipe.category}${recipe.visibility === 'private' ? ' · Private' : ''}</span>
                <h3 class="recipe-card-title">${recipe.title}</h3>
                <p class="recipe-card-description">${recipe.description}</p>
                <div class="recipe-card-meta">
                    <span>⏱️ ${recipe.prepTime + recipe.cookTime} min</span>
                    <span>👥 ${recipe.servings} servings</span>
                    <span>📊 ${recipe.difficulty}</span>
                </div>
            </div>
        </article>
    `;
    }).join('');
}

// ========================================
// My Recipes cards (with Edit / Delete actions)
// ========================================
function renderMyRecipeCards(recipesList, container) {
    container.innerHTML = recipesList.map(recipe => `
        <article class="recipe-card" data-category="${recipe.category}">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-card-image" loading="lazy">
            <div class="recipe-card-content">
                <span class="recipe-card-category">${recipe.category}${recipe.visibility === 'private' ? ' · Private' : ''}</span>
                <h3 class="recipe-card-title">${recipe.title}</h3>
                <p class="recipe-card-description">${recipe.description}</p>
                <div class="recipe-card-meta">
                    <span>⏱️ ${recipe.prepTime + recipe.cookTime} min</span>
                    <span>👥 ${recipe.servings} servings</span>
                    <span>📊 ${recipe.difficulty}</span>
                </div>
                <div class="my-recipe-actions">
                    <a href="create-recipe.html?id=${encodeURIComponent(recipe.id)}" class="btn btn-secondary my-action-btn">Edit</a>
                    <button class="btn my-action-btn my-action-delete" onclick="handleDeleteRecipe('${recipe.id}')">Delete</button>
                </div>
            </div>
        </article>
    `).join('');
}

async function handleDeleteRecipe(id) {
    if (!confirm('Delete this recipe? This cannot be undone.')) return;
    try {
        await deleteRecipe(id);
        showToast('Recipe deleted');
        await refreshMyRecipes();
    } catch (err) {
        console.error(err);
        showToast('Could not delete recipe');
    }
}

async function refreshMyRecipes() {
    const grid = document.getElementById('myRecipesGrid');
    const empty = document.getElementById('emptyState');
    if (!grid) return;
    const user = await getCurrentUser();
    if (!user) { window.location.href = 'login.html'; return; }
    const mine = await fetchMyRecipes();
    if (!mine.length) {
        grid.style.display = 'none';
        if (empty) empty.style.display = 'block';
    } else {
        grid.style.display = '';
        if (empty) empty.style.display = 'none';
        renderMyRecipeCards(mine, grid);
    }
}

// ========================================
// Setup Category Filter
// ========================================
function setupCategoryFilter(container) {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.dataset.category;
            const filtered = category === 'all'
                ? recipes
                : recipes.filter(r => r.category === category);

            renderRecipeCards(filtered, container);
        });
    });
}

// ========================================
// Save button (recipe pages)
// ========================================
async function initSaveButton(recipeId) {
    const btn = document.getElementById('saveRecipeBtn');
    if (!btn || !recipeId) return;
    btn.dataset.recipeId = recipeId;

    const user = await getCurrentUser();
    if (!user) {
        btn.innerHTML = '♡ Save';
        btn.disabled = false;
        btn.onclick = () => { window.location.href = 'login.html'; };
        return;
    }

    const saved = await isRecipeSaved(recipeId);
    btn.classList.toggle('saved', saved);
    btn.innerHTML = saved ? '♥ Saved' : '♡ Save';
    btn.disabled = false;

    btn.onclick = async () => {
        btn.disabled = true;
        try {
            const nowSaved = await toggleSave(recipeId);
            btn.classList.toggle('saved', nowSaved);
            btn.innerHTML = nowSaved ? '♥ Saved' : '♡ Save';
            showToast(nowSaved ? 'Saved to your recipes!' : 'Removed from saved recipes');
        } catch (err) {
            console.error(err);
            showToast('Could not update saved state');
        } finally {
            btn.disabled = false;
        }
    };
}

// ========================================
// Load Homepage
// ========================================
async function loadHomepage() {
    const grid = document.getElementById('recipeGrid');
    if (!grid) return;

    try {
        grid.innerHTML = '<p class="loading">Loading recipes...</p>';
        recipes = await fetchRecipes();
        renderRecipeCards(recipes, grid);
        setupCategoryFilter(grid);
    } catch (err) {
        console.error('Failed to load recipes:', err);
        grid.innerHTML = '<p class="loading">Failed to load recipes. Please try again later.</p>';
    }
}

// ========================================
// Load Single Recipe
// ========================================
async function loadRecipePage() {
    const heroSection = document.getElementById('recipeHero');
    const ingredientsList = document.getElementById('ingredientsList');
    const stepsContainer = document.getElementById('stepsContainer');

    if (!heroSection || !ingredientsList || !stepsContainer) return;

    // If page has embedded static data, use it directly (no Supabase fetch needed)
    if (window.__RECIPE_DATA__) {
        const recipe = window.__RECIPE_DATA__;
        document.title = `${recipe.title} | Sweet Crumbs`;
        populateJsonLd(recipe);
        populateOgTags(recipe);

        // Initialize timers from embedded data
        if (recipe.__timers) {
            recipe.__timers.forEach(t => {
                timers[t.stepId] = {
                    totalSeconds: t.totalSeconds,
                    remaining: t.totalSeconds,
                    running: false,
                    finished: false,
                    label: t.label,
                    interval: null
                };
            });
        }
        initSaveButton(recipe.id);
        return;
    }

    // Get recipe ID from URL (for development/fallback path)
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');

    if (!recipeId) {
        heroSection.innerHTML = '<p class="loading">No recipe selected. <a href="index.html">Browse recipes</a></p>';
        return;
    }

    try {
        heroSection.innerHTML = '<p class="loading">Loading recipe...</p>';
        const recipe = await fetchRecipeById(recipeId);

        if (!recipe) {
            heroSection.innerHTML = '<p class="loading">Recipe not found. <a href="index.html">Browse recipes</a></p>';
            return;
        }

        // Update page title
        document.title = `${recipe.title} | Sweet Crumbs`;

        // Populate structured data and meta tags
        populateJsonLd(recipe);
        populateOgTags(recipe);

        // Render hero
        heroSection.innerHTML = `
            <div class="recipe-hero-content">
                <img src="${recipe.image}" alt="${recipe.title}" class="recipe-hero-image">
                <div class="recipe-hero-info">
                    <h1>${recipe.title}</h1>
                    <p class="recipe-hero-description">${recipe.description}</p>
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
                            <div class="recipe-meta-value">${recipe.difficulty}</div>
                        </div>
                    </div>
                </div>
                <button id="saveRecipeBtn" class="save-btn" disabled>♡ Save</button>
            </div>
        `;

        // Render ingredients
        ingredientsList.innerHTML = recipe.ingredients.map((ing, index) => `
            <li class="ingredient-item" data-index="${index}" onclick="toggleIngredient(this)">
                <div class="ingredient-checkbox"></div>
                <span class="ingredient-amount">${ing.amount}</span>
                <span class="ingredient-name">${ing.name}</span>
            </li>
        `).join('');

        // Render steps with timers
        stepsContainer.innerHTML = recipe.steps.map((step, index) => {
            const stepId = `step-${index}`;
            let timerHtml = '';

            if (step.timerMinutes) {
                const totalSeconds = step.timerMinutes * 60;
                timers[stepId] = {
                    totalSeconds: totalSeconds,
                    remaining: totalSeconds,
                    running: false,
                    finished: false,
                    label: step.timerLabel || `Step ${index + 1}`,
                    interval: null
                };

                timerHtml = `
                    <div class="timer-container">
                        <span class="timer-label">⏱️ ${step.timerLabel || 'Timer'}:</span>
                        <span class="timer-display" id="timer-display-${stepId}">${formatTime(totalSeconds)}</span>
                        <div class="timer-buttons">
                            <button class="timer-btn timer-btn-start" id="timer-start-${stepId}" onclick="startTimer('${stepId}')">Start</button>
                            <button class="timer-btn timer-btn-pause" id="timer-pause-${stepId}" onclick="pauseTimer('${stepId}')" disabled>Pause</button>
                            <button class="timer-btn timer-btn-reset" onclick="resetTimer('${stepId}')">Reset</button>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="step" id="${stepId}">
                    <div class="step-header">
                        <span class="step-number">${index + 1}</span>
                        <p class="step-text">${step.text}</p>
                    </div>
                    ${timerHtml}
                    <button class="step-complete-btn" onclick="toggleStepComplete('${stepId}')">
                        Mark Complete
                    </button>
                </div>
            `;
        }).join('');

        initSaveButton(recipe.id);
    } catch (err) {
        console.error('Failed to load recipe:', err);
        heroSection.innerHTML = '<p class="loading">Failed to load recipe. Please try again later.</p>';
    }
}

// ========================================
// Ingredient Toggle
// ========================================
function toggleIngredient(element) {
    element.classList.toggle('checked');
}

// ========================================
// Step Complete Toggle
// ========================================
function toggleStepComplete(stepId) {
    const stepEl = document.getElementById(stepId);
    if (!stepEl) return;

    stepEl.classList.toggle('completed');

    // If marking as complete and timer is running, stop it
    if (stepEl.classList.contains('completed') && timers[stepId] && timers[stepId].running) {
        pauseTimer(stepId);
    }
}

// ========================================
// Initialize on DOM Load
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Render auth nav
    renderAuthNav();

    // Check if we're on the homepage or recipe page
    if (document.getElementById('recipeGrid')) {
        loadHomepage();
    } else if (document.getElementById('recipeHero')) {
        loadRecipePage();
    }
});

// ========================================
// Auth Nav Rendering
// ========================================
async function renderAuthNav() {
    const navEl = document.getElementById('authNav');
    if (!navEl) return;

    try {
        const user = await checkSession();
        if (user && user.email) {
            const meta = user.user_metadata || user.raw_user_meta_data || {};
            const name = meta.full_name || meta.name || user.email.split('@')[0];
            const avatar = meta.avatar_url || meta.picture || null;
            navEl.innerHTML = `
                <a href="saved.html" class="nav-link">Saved</a>
                <a href="my-recipes.html" class="nav-link">My Recipes</a>
                <a href="create-recipe.html" class="nav-link">+ Create</a>
                <div class="user-menu" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;position:relative;">
                    ${avatar
                        ? `<img src="${avatar}" alt="${name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
                        : `<span style="width:32px;height:32px;border-radius:50%;background:var(--color-primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.875rem;">${name.charAt(0).toUpperCase()}</span>`
                    }
                    <span style="font-weight:500;color:var(--color-text);font-size:0.9rem;">${name}</span>
                    <button onclick="signOut()" style="margin-left:0.5rem;padding:0.375rem 0.75rem;border:1px solid var(--color-border);background:white;border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;color:var(--color-text-light);">Sign out</button>
                </div>
            `;
        } else {
            navEl.innerHTML = `<a href="login.html" class="nav-link" style="padding:0.5rem 1rem;border:2px solid var(--color-primary);border-radius:var(--radius-sm);color:var(--color-primary);font-weight:600;">Sign In</a>`;
        }
    } catch (e) {
        navEl.innerHTML = `<a href="login.html" class="nav-link" style="padding:0.5rem 1rem;border:2px solid var(--color-primary);border-radius:var(--radius-sm);color:var(--color-primary);font-weight:600;">Sign In</a>`;
    }
}

// Clean up intervals on page unload
window.addEventListener('beforeunload', () => {
    Object.keys(timers).forEach(timerId => {
        if (timers[timerId].interval) {
            clearInterval(timers[timerId].interval);
        }
    });
});
