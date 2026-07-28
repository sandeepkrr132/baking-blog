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
async function fetchRecipes() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=*`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
    return await response.json();
}

async function fetchRecipeById(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${encodeURIComponent(id)}&select=*`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
    const data = await response.json();
    return data[0] || null;
}

// ========================================
// Render Recipe Cards (Homepage)
// ========================================
function renderRecipeCards(recipesList, container) {
    container.innerHTML = recipesList.map(recipe => `
        <article class="recipe-card" data-category="${recipe.category}" onclick="window.location.href='recipe.html?id=${recipe.id}'">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-card-image" loading="lazy">
            <div class="recipe-card-content">
                <span class="recipe-card-category">${recipe.category}</span>
                <h3 class="recipe-card-title">${recipe.title}</h3>
                <p class="recipe-card-description">${recipe.description}</p>
                <div class="recipe-card-meta">
                    <span>⏱️ ${recipe.prepTime + recipe.cookTime} min</span>
                    <span>👥 ${recipe.servings} servings</span>
                    <span>📊 ${recipe.difficulty}</span>
                </div>
            </div>
        </article>
    `).join('');
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

    // Get recipe ID from URL
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
